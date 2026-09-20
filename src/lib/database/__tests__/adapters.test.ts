import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { LocalDatabaseAdapter } from '../local-adapter';
import { WebDatabaseAdapter } from '../web-adapter';
import { StorageError } from '../storage-adapter';

describe('StorageAdapters', () => {
  let localAdapter: LocalDatabaseAdapter;
  const testBasePath = '.test-data';
  const testPath = 'test/test-file.txt';
  const testContent = 'Hello World!';

  beforeAll(async () => {
    localAdapter = new LocalDatabaseAdapter(testBasePath);
    await localAdapter.mkdir('test');
  });

  afterAll(async () => {
    await localAdapter.delete(testBasePath).catch(() => {});
  });

  describe('LocalDatabaseAdapter', () => {
    it('devrait écrire et lire un fichier texte', async () => {
      await localAdapter.writeText(testPath, testContent);
      const content = await localAdapter.readText(testPath);
      expect(content).toBe(testContent);
    });

    it('devrait écrire et lire un buffer', async () => {
      const buffer = Buffer.from('Buffer test');
      await localAdapter.write('test/buffer.bin', buffer);
      const read = await localAdapter.read('test/buffer.bin');
      expect(read).toEqual(buffer);
    });

    it('devrait créer un répertoire', async () => {
      await localAdapter.mkdir('test/nested/dir');
      const exists = await localAdapter.exists('test/nested/dir');
      expect(exists).toBe(true);
    });

    it('devrait lister un répertoire', async () => {
      await localAdapter.writeText('test/list/file1.txt', 'content1');
      await localAdapter.writeText('test/list/file2.txt', 'content2');

      const entries = await localAdapter.list('test/list');
      expect(entries).toContain('file1.txt');
      expect(entries).toContain('file2.txt');
    });

    it('devrait supprimer un fichier', async () => {
      await localAdapter.writeText('test/to-delete.txt', 'delete me');
      await localAdapter.delete('test/to-delete.txt');
      const exists = await localAdapter.exists('test/to-delete.txt');
      expect(exists).toBe(false);
    });

    it('devrait supprimer un répertoire', async () => {
      await localAdapter.mkdir('test/dir-to-delete');
      await localAdapter.delete('test/dir-to-delete');
      const exists = await localAdapter.exists('test/dir-to-delete');
      expect(exists).toBe(false);
    });

    it('devrait gérer JSON', async () => {
      const data = { name: 'Test', value: 123, nested: { key: 'value' } };
      await localAdapter.writeJSON('test/data.json', data);
      const readData = await localAdapter.readJSON('test/data.json');
      expect(readData).toEqual(data);
    });

    it('devrait retourner null pour JSON inexistant', async () => {
      const data = await localAdapter.readJSON('test/nonexistent.json');
      expect(data).toBeNull();
    });

    it('devrait gérer les erreurs de permission', async () => {
      const maliciousPath = '../etc/passwd';
      await expect(localAdapter.read(maliciousPath)).rejects.toThrow(StorageError);
    });

    it('devrait retourner des stats', async () => {
      const stats = await localAdapter.getStats!();
      expect(stats).toHaveProperty('files');
      expect(stats).toHaveProperty('size');
      expect(stats.files).toBeGreaterThan(0);
    });
  });

  describe('LocalDatabaseAdapter - garde-fou .data (lecture seule)', () => {
    const refAdapter = new LocalDatabaseAdapter('.data');

    it('est en lecture seule sur le répertoire de référence', () => {
      expect((refAdapter as any).readOnly).toBe(true);
    });

    it('bloque toute tentative d\'écriture', async () => {
      await expect(refAdapter.writeText('Centrale/A0/.meta.json', 'x')).rejects.toThrow(StorageError);
      await expect(refAdapter.writeJSON('Centrale/A0/.meta.json', { x: 1 })).rejects.toThrow(StorageError);
      await expect(refAdapter.write('Centrale/A0/.meta.json', Buffer.from('x'))).rejects.toThrow(StorageError);
      await expect(refAdapter.delete('Centrale/A0/.meta.json')).rejects.toThrow(StorageError);
      await expect(refAdapter.mkdir('Centrale/A0')).rejects.toThrow(StorageError);
      await expect(refAdapter.rename('Centrale/A0/.meta.json', 'Centrale/A0/b.json')).rejects.toThrow(StorageError);
    });

    it('utilise le code d\'erreur READONLY', async () => {
      try {
        await refAdapter.writeText('Centrale/A0/.meta.json', 'x');
        throw new Error('should have thrown');
      } catch (e: any) {
        expect(e).toBeInstanceOf(StorageError);
        expect(e.code).toBe('READONLY');
      }
    });

    it('n\'bloque pas les lectures', async () => {
      expect(await refAdapter.exists('does-not-exist.json')).toBe(false);
      await expect(refAdapter.read('does-not-exist.json')).rejects.toThrow(StorageError);
    });

    it('laisse les chemins non référence accessibles en écriture', () => {
      const tmp = new LocalDatabaseAdapter('.test-garde-fou');
      expect((tmp as any).readOnly).toBe(false);
    });
  });

  describe('WebDatabaseAdapter', () => {
    const webUrl = process.env.TEST_WEB_URL;
    const webKey = process.env.TEST_WEB_KEY;

    const itIfWeb = webUrl && webKey ? it : it.skip;

    let webAdapter: WebDatabaseAdapter;

    beforeAll(() => {
      if (webUrl && webKey) {
        webAdapter = new WebDatabaseAdapter(webUrl, webKey);
      }
    });

    itIfWeb('devrait se connecter', async () => {
      const ping = await webAdapter.ping();
      expect(ping).toBe(true);
    });

    itIfWeb('devrait écrire et lire via API', async () => {
      await webAdapter.writeText(testPath, testContent);
      const content = await webAdapter.readText(testPath);
      expect(content).toBe(testContent);
    });

    itIfWeb('devrait gérer JSON via API', async () => {
      const data = { test: 'web', value: 456 };
      await webAdapter.writeJSON('test/web-data.json', data);
      const readData = await webAdapter.readJSON('test/web-data.json');
      expect(readData).toEqual(data);
    });

    itIfWeb('devrait vérifier l\'existence', async () => {
      await webAdapter.writeText('test/exists.txt', 'exists');
      const exists = await webAdapter.exists('test/exists.txt');
      expect(exists).toBe(true);

      const notExists = await webAdapter.exists('test/notexists.txt');
      expect(notExists).toBe(false);
    });

    itIfWeb('devrait supprimer via API', async () => {
      await webAdapter.writeText('test/to-delete-web.txt', 'delete');
      await webAdapter.delete('test/to-delete-web.txt');
      const exists = await webAdapter.exists('test/to-delete-web.txt');
      expect(exists).toBe(false);
    });
  });
});
