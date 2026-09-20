import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createNextRequest } from '../../__tests__/next-request-helper';

const mockExists = vi.fn();
const mockRead = vi.fn();

vi.mock('@/lib/database/local-adapter', () => ({
  LocalDatabaseAdapter: class {
    exists = mockExists;
    read = mockRead;
  }
}));

vi.mock('@/lib/database/web-adapter', () => ({
  WebDatabaseAdapter: class {
    exists = mockExists;
    read = mockRead;
  }
}));

describe('API /api/file-content', () => {
  beforeEach(() => {
    mockExists.mockReset();
    mockRead.mockReset();
  });

  it('rejette si chemin manquant', async () => {
    const { GET } = await import('@/app/api/file-content/route');
    const req = createNextRequest('http://x/api/file-content');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('retourne 404 si le fichier n\'existe pas', async () => {
    mockExists.mockResolvedValue(false);
    const { GET } = await import('@/app/api/file-content/route');
    const req = createNextRequest('http://x/api/file-content?path=missing.txt');
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('retourne du texte pour un fichier .json', async () => {
    mockExists.mockResolvedValue(true);
    mockRead.mockResolvedValue(Buffer.from('{"a":1}'));
    const { GET } = await import('@/app/api/file-content/route');
    const req = createNextRequest('http://x/api/file-content?path=foo/bar.json');
    const res = await GET(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.kind).toBe('text');
    expect(data.content).toBe('{"a":1}');
  });

  it('retourne une data URL pour une image PNG', async () => {
    mockExists.mockResolvedValue(true);
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    mockRead.mockResolvedValue(pngBuffer);
    const { GET } = await import('@/app/api/file-content/route');
    const req = createNextRequest('http://x/api/file-content?path=img/photo.png');
    const res = await GET(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.kind).toBe('image');
    expect(data.content).toMatch(/^data:image\/png;base64,/);
    expect(data.mimeType).toBe('image/png');
  });

  it('retourne base64 pour un fichier binaire volumineux non image', async () => {
    mockExists.mockResolvedValue(true);
    const bigBuffer = Buffer.alloc(300 * 1024, 0xff);
    mockRead.mockResolvedValue(bigBuffer);
    const { GET } = await import('@/app/api/file-content/route');
    const req = createNextRequest('http://x/api/file-content?path=data/file.bin');
    const res = await GET(req);
    const data = await res.json();

    expect(data.kind).toBe('binary');
    expect(data.mimeType).toBe('application/octet-stream');
  });

  it('refuse la source web si non configurée', async () => {
    const prevUrl = process.env.WEB_API_URL;
    delete process.env.WEB_API_URL;

    const { GET } = await import('@/app/api/file-content/route');
    const req = createNextRequest('http://x/api/file-content?path=foo.txt&source=web');
    const res = await GET(req);
    expect(res.status).toBe(503);

    if (prevUrl) process.env.WEB_API_URL = prevUrl;
  });
});