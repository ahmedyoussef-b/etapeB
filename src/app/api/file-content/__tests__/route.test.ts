import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createNextRequest } from '../../__tests__/next-request-helper';

const mockExists = vi.fn();
const mockRead = vi.fn();
const mockWriteText = vi.fn();
const mockGetAuthenticatedUser = vi.fn().mockResolvedValue({
  id: 'test-user',
  email: 'test@example.com',
  role: 'admin',
  name: 'Test User',
});
const mockHasPermission = vi.fn().mockReturnValue(true);

vi.mock('@/lib/database/local-adapter', () => ({
  LocalDatabaseAdapter: class {
    exists = mockExists;
    read = mockRead;
    writeText = mockWriteText;
  }
}));

vi.mock('@/lib/database/web-adapter', () => ({
  WebDatabaseAdapter: class {
    exists = mockExists;
    read = mockRead;
    writeText = mockWriteText;
  }
}));

vi.mock('@/lib/api/auth-guard', () => ({
  getAuthenticatedUser: mockGetAuthenticatedUser,
  hasPermission: mockHasPermission,
  unauthorizedResponse: () => new Response('Non autorisé', { status: 403 }),
  unauthenticatedResponse: () => new Response('Non authentifié', { status: 401 }),
}));

describe('API /api/file-content', () => {
  beforeEach(() => {
    mockExists.mockReset();
    mockRead.mockReset();
    mockWriteText.mockReset();
    mockGetAuthenticatedUser.mockReset();
    mockHasPermission.mockReset();
    mockHasPermission.mockReturnValue(true);
    mockGetAuthenticatedUser.mockResolvedValue({
      id: 'test-user',
      email: 'test@example.com',
      role: 'admin',
      name: 'Test User',
    });
  });

  it('rejette si chemin manquant', async () => {
    const { GET } = await import('@/app/api/file-content/route');
    const req = createNextRequest('http://x/api/file-content');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('retourne 404 si le fichier n\'existe pas', async () => {
    const { StorageError } = await import('@/lib/database/storage-adapter');
    mockRead.mockRejectedValue(new StorageError('NOT_FOUND', 'Fichier non trouvé: missing.txt', 'missing.txt'));
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

  it('PUT écrit un fichier texte en local', async () => {
    mockExists.mockResolvedValue(true);
    mockWriteText.mockResolvedValue(undefined);
    const { PUT } = await import('@/app/api/file-content/route');
    const req = createNextRequest('http://x/api/file-content?path=foo.json&source=local', {
      method: 'PUT',
      body: JSON.stringify({ path: 'foo.json', content: '{"a":1}', source: 'local' })
    });
    const res = await PUT(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockWriteText).toHaveBeenCalledWith('foo.json', '{"a":1}');
  });

  it('PUT refuse un chemin invalide', async () => {
    const { PUT } = await import('@/app/api/file-content/route');
    const req = createNextRequest('http://x/api/file-content', {
      method: 'PUT',
      body: JSON.stringify({ path: '../etc/passwd', content: 'bad' })
    });
    const res = await PUT(req);
    expect(res.status).toBe(415);
  });

  it('PUT refuse un fichier non-texte', async () => {
    const { PUT } = await import('@/app/api/file-content/route');
    const req = createNextRequest('http://x/api/file-content?path=foo.png', {
      method: 'PUT',
      body: JSON.stringify({ path: 'foo.png', content: 'not-text' })
    });
    const res = await PUT(req);
    expect(res.status).toBe(415);
  });

  it('PUT refuse un chemin web avec traversal', async () => {
    const { PUT } = await import('@/app/api/file-content/route');
    const req = createNextRequest('http://x/api/file-content?path=foo.txt&source=web', {
      method: 'PUT',
      body: JSON.stringify({ path: '../etc/passwd', content: 'bad', source: 'web' })
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });
});