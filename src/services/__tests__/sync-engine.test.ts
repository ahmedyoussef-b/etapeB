import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadAndStore } from '../sync-engine';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

describe('downloadAndStore — C3 vérification hash', () => {
  const mockFile = {
    id: 'test-file-1',
    path: 'documents/test.txt',
    hash: 'abc123',
    size: 10,
    version: '1.0.0',
    publishedAt: '2026-09-16T00:00:00Z',
  };
  const basePath = '/tmp/nexaflow-test';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("CAS 1 : hash OK → pas d'erreur", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'X-File-Hash': 'abc123' }),
      text: async () => 'contenu',
    });

    (invoke as any).mockImplementation(async (cmd: string) => {
      if (cmd === 'write_file_content') return undefined;
      if (cmd === 'read_file_content') return { hash: 'abc123', size: 7 };
      throw new Error(`Commande inconnue: ${cmd}`);
    });

    await expect(downloadAndStore(mockFile, basePath)).resolves.toBeUndefined();
  });

  it('CAS 2 : hash mismatch → throw', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'X-File-Hash': 'abc123' }),
      text: async () => 'contenu corrompu',
    });

    (invoke as any).mockImplementation(async (cmd: string) => {
      if (cmd === 'write_file_content') return undefined;
      if (cmd === 'read_file_content') return { hash: 'DIFFERENT', size: 16 };
      throw new Error(`Commande inconnue: ${cmd}`);
    });

    await expect(downloadAndStore(mockFile, basePath)).rejects.toThrow(
      /Hash mismatch/
    );
  });

  it("CAS 3 : header X-File-Hash absent → throw", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      text: async () => 'contenu',
    });

    await expect(downloadAndStore(mockFile, basePath)).rejects.toThrow(
      /Header X-File-Hash manquant/
    );
  });

  it('CAS 4 : HTTP non-ok → throw', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(downloadAndStore(mockFile, basePath)).rejects.toThrow(
      /HTTP 500/
    );
  });
});