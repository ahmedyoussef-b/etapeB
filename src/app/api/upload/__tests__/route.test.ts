import { describe, expect, it, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockExists = vi.fn();
const mockMkdir = vi.fn();
const mockWrite = vi.fn();
const mockList = vi.fn();
const mockReadJSON = vi.fn();
const mockWriteJSON = vi.fn();

vi.mock('@/lib/database/local-adapter', () => ({
  LocalDatabaseAdapter: class {
    exists = mockExists;
    mkdir = mockMkdir;
    write = mockWrite;
    list = mockList;
    readJSON = mockReadJSON;
    writeJSON = mockWriteJSON;
  }
}));

vi.mock('@/lib/database/web-adapter', () => ({
  WebDatabaseAdapter: class {
    exists = mockExists;
    mkdir = mockMkdir;
    write = mockWrite;
    list = mockList;
    readJSON = mockReadJSON;
    writeJSON = mockWriteJSON;
  }
}));

describe('API /api/upload', () => {
  beforeEach(() => {
    mockExists.mockReset();
    mockMkdir.mockReset();
    mockWrite.mockReset();
    mockList.mockReset();
    mockReadJSON.mockReset();
    mockWriteJSON.mockReset();
  });

  it('rejette si fichier ou chemin manquant', async () => {
    const { POST } = await import('@/app/api/upload/route');
    const req = new NextRequest('http://x/api/upload', {
      method: 'POST',
      body: JSON.stringify({ targetPath: 'foo' }),
      headers: { 'Content-Type': 'application/json' }
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('upload simple quand le fichier n\'existe pas', async () => {
    mockExists.mockResolvedValue(false);
    mockMkdir.mockResolvedValue(undefined);
    mockWrite.mockResolvedValue(undefined);

    const { POST } = await import('@/app/api/upload/route');
    const req = new NextRequest('http://x/api/upload', {
      method: 'POST',
      body: JSON.stringify({
        file: { name: 'doc.txt', base64: Buffer.from('hello').toString('base64') },
        targetPath: 'Centrale/B3',
        source: 'local'
      }),
      headers: { 'Content-Type': 'application/json' }
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.action).toBe('uploaded');
    expect(data.path).toBe('Centrale/B3/doc.txt');
    expect(mockMkdir).toHaveBeenCalledWith('Centrale/B3');
    expect(mockWrite).toHaveBeenCalledWith('Centrale/B3/doc.txt', expect.any(Buffer));
  });

  it('déduplique quand le fichier existe déjà (crée _duplicates avec manifest)', async () => {
    mockExists.mockResolvedValue(true);
    mockMkdir.mockResolvedValue(undefined);
    mockWrite.mockResolvedValue(undefined);
    mockList.mockResolvedValue([]);
    mockReadJSON.mockResolvedValue(null);
    mockWriteJSON.mockResolvedValue(undefined);

    const { POST } = await import('@/app/api/upload/route');
    const req = new NextRequest('http://x/api/upload', {
      method: 'POST',
      body: JSON.stringify({
        file: { name: 'plan.pdf', base64: Buffer.from('pdf').toString('base64') },
        targetPath: 'Centrale/B3',
        source: 'local'
      }),
      headers: { 'Content-Type': 'application/json' }
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.action).toBe('deduplicated');
    expect(data.path).toBe('Centrale/B3/plan_duplicates/plan_v1.pdf');
    expect(mockMkdir).toHaveBeenCalledWith('Centrale/B3/plan_duplicates');
    expect(mockWriteJSON).toHaveBeenCalledWith(
      'Centrale/B3/plan_duplicates/manifest.json',
      expect.objectContaining({ versions: expect.any(Array), lastUpdated: expect.any(String) })
    );
  });

  it('incrémente la version si _v1 existe déjà', async () => {
    mockExists.mockResolvedValue(true);
    mockMkdir.mockResolvedValue(undefined);
    mockWrite.mockResolvedValue(undefined);
    mockList.mockResolvedValue(['plan_v1.pdf', 'manifest.json']);
    mockReadJSON.mockResolvedValue({ versions: [] });
    mockWriteJSON.mockResolvedValue(undefined);

    const { POST } = await import('@/app/api/upload/route');
    const req = new NextRequest('http://x/api/upload', {
      method: 'POST',
      body: JSON.stringify({
        file: { name: 'plan.pdf', base64: Buffer.from('x').toString('base64') },
        targetPath: 'registry',
        source: 'local'
      }),
      headers: { 'Content-Type': 'application/json' }
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.action).toBe('deduplicated');
    expect(data.path).toBe('registry/plan_duplicates/plan_v2.pdf');
  });

  it('évite le conflit quand un dossier porte déjà le même nom de base que le fichier', async () => {
    mockExists.mockResolvedValue(false);
    mockMkdir.mockResolvedValue(undefined);
    mockWrite.mockResolvedValue(undefined);
    mockList.mockImplementation(async (path: string) =>
      path === 'bank/Nouveau document texte (2)' ? ['fichier.txt'] : []
    );
    mockReadJSON.mockResolvedValue(null);
    mockWriteJSON.mockResolvedValue(undefined);

    const { POST } = await import('@/app/api/upload/route');
    const req = new NextRequest('http://x/api/upload', {
      method: 'POST',
      body: JSON.stringify({
        file: { name: 'Nouveau document texte (2).txt', base64: Buffer.from('hello').toString('base64') },
        targetPath: 'bank',
        source: 'local'
      }),
      headers: { 'Content-Type': 'application/json' }
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.action).toBe('deduplicated');
    expect(data.path).toBe('bank/Nouveau document texte (2)_duplicates/Nouveau document texte (2)_v1.txt');
    expect(mockWrite).toHaveBeenCalledWith(
      'bank/Nouveau document texte (2)_duplicates/Nouveau document texte (2)_v1.txt',
      expect.any(Buffer)
    );
  });

  it('refuse l\'upload vers la BDD Web si WEB_API_URL non configuré', async () => {
    const prevUrl = process.env.WEB_API_URL;
    delete process.env.WEB_API_URL;

    const { POST } = await import('@/app/api/upload/route');
    const req = new NextRequest('http://x/api/upload', {
      method: 'POST',
      body: JSON.stringify({
        file: { name: 'x.txt', base64: 'YQ==' },
        targetPath: 'foo',
        source: 'web'
      }),
      headers: { 'Content-Type': 'application/json' }
    });
    const res = await POST(req);
    expect(res.status).toBe(503);

    if (prevUrl) process.env.WEB_API_URL = prevUrl;
  });
});