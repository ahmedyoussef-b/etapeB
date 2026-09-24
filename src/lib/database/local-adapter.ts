import fs from 'fs/promises';
import * as nodePath from 'path';
import { StorageAdapter, StorageError } from './storage-adapter';

export class LocalDatabaseAdapter implements StorageAdapter {
  private basePath: string;
  private readonly readOnly: boolean;

  constructor(basePath: string = '.data', readOnly?: boolean) {
    this.basePath = nodePath.resolve(process.cwd(), basePath);
    // Garde-fou : '.data' est la référence immuable de l'arborescence
    // (modeèle d'affichage pour la BDD locale et la BDD web). Aucune
    // mutation n'est autorisée sur ce répertoire, sous quelque pretexte.
    const canonicalRef = nodePath.resolve(process.cwd(), '.data');
    this.readOnly = readOnly ?? this.basePath === canonicalRef;
  }

  getBasePath(): string {
    return this.basePath;
  }

  private assertWritable(path: string): void {
    if (this.readOnly) {
      throw new StorageError(
        'READONLY',
        "Le répertoire .data est une référence immuable : aucune modification n'est autorisée sous aucun pretexte.",
        path
      );
    }
  }

  private resolvePath(filePath: string): string {
    const resolved = nodePath.resolve(this.basePath, filePath);
    if (!resolved.startsWith(this.basePath)) {
      throw new StorageError('PERMISSION_DENIED', 'Accès interdit', filePath);
    }
    return resolved;
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  async read(path: string): Promise<Buffer> {
    console.log('[local-adapter] read start', { path, readOnly: this.readOnly });
    try {
      const fullPath = this.resolvePath(path);
      const data = await fs.readFile(fullPath);
      console.log('[local-adapter] read success', { path, fullPath, size: data.length });
      return data;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log('[local-adapter] read not found', { path });
        throw new StorageError('NOT_FOUND', `Fichier non trouvé: ${path}`, path);
      }
      console.error('[local-adapter] read error', { path, error: error.message });
      throw new StorageError('READ_ERROR', `Erreur de lecture: ${error.message}`, path);
    }
  }

  async write(path: string, data: Buffer): Promise<void> {
    this.assertWritable(path);
    console.log('[local-adapter] write start', { path, size: data.length, readOnly: this.readOnly });
    try {
      const fullPath = this.resolvePath(path);
      await this.ensureDirectory(nodePath.dirname(fullPath));
      await fs.writeFile(fullPath, data);
      console.log('[local-adapter] write success', { path, fullPath });
    } catch (error: any) {
      console.error('[local-adapter] write error', { path, error: error.message });
      throw new StorageError('WRITE_ERROR', `Erreur d'écriture: ${error.message}`, path);
    }
  }

  async mkdir(path: string): Promise<void> {
    this.assertWritable(path);
    console.log('[local-adapter] mkdir start', { path, readOnly: this.readOnly });
    try {
      const fullPath = this.resolvePath(path);
      await this.ensureDirectory(fullPath);
      console.log('[local-adapter] mkdir success', { path, fullPath });
    } catch (error: any) {
      console.error('[local-adapter] mkdir error', { path, error: error.message });
      throw new StorageError('MKDIR_ERROR', `Erreur création répertoire: ${error.message}`, path);
    }
  }

  async exists(path: string): Promise<boolean> {
    console.log('[local-adapter] exists', { path });
    try {
      const fullPath = this.resolvePath(path);
      await fs.access(fullPath);
      console.log('[local-adapter] exists result', { path, exists: true });
      return true;
    } catch {
      console.log('[local-adapter] exists result', { path, exists: false });
      return false;
    }
  }

  async list(path: string): Promise<string[]> {
    console.log('[local-adapter] list start', { path });
    try {
      const fullPath = this.resolvePath(path);
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const names = entries.map(entry => entry.name);
      console.log('[local-adapter] list result', { path, fullPath, count: names.length });
      return names;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log('[local-adapter] list not found', { path });
        return [];
      }
      console.error('[local-adapter] list error', { path, error: error.message });
      throw new StorageError('LIST_ERROR', `Erreur de listing: ${error.message}`, path);
    }
  }

  async delete(path: string): Promise<void> {
    this.assertWritable(path);
    console.log('[local-adapter] delete start', { path, readOnly: this.readOnly });
    try {
      const fullPath = this.resolvePath(path);
      const stats = await fs.stat(fullPath);
      if (stats.isDirectory()) {
        await fs.rm(fullPath, { recursive: true });
        console.log('[local-adapter] delete directory success', { path, fullPath });
      } else {
        await fs.unlink(fullPath);
        console.log('[local-adapter] delete file success', { path, fullPath });
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log('[local-adapter] delete already absent', { path });
        return;
      }
      console.error('[local-adapter] delete error', { path, error: error.message });
      throw new StorageError('DELETE_ERROR', `Erreur de suppression: ${error.message}`, path);
    }
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    this.assertWritable(oldPath);
    console.log('[local-adapter] rename start', { oldPath, newPath, readOnly: this.readOnly });
    try {
      const fullOldPath = this.resolvePath(oldPath);
      const fullNewPath = this.resolvePath(newPath);
      await this.ensureDirectory(nodePath.dirname(fullNewPath));
      await fs.rename(fullOldPath, fullNewPath);
      console.log('[local-adapter] rename success', { oldPath, newPath, fullOldPath, fullNewPath });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.error('[local-adapter] rename not found', { oldPath, newPath });
        throw new StorageError('NOT_FOUND', `Chemin non trouvé: ${oldPath}`, oldPath);
      }
      console.error('[local-adapter] rename error', { oldPath, newPath, error: error.message });
      throw new StorageError('RENAME_ERROR', `Erreur de renommage: ${error.message}`, oldPath);
    }
  }

  async readText(path: string): Promise<string> {
    const buffer = await this.read(path);
    return buffer.toString('utf-8');
  }

  async writeText(path: string, content: string): Promise<void> {
    await this.write(path, Buffer.from(content, 'utf-8'));
  }

  async readJSON<T = any>(path: string): Promise<T | null> {
    try {
      let content = await this.readText(path);
      // Remove BOM if present
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
      }
      return JSON.parse(content);
    } catch (error: any) {
      if (error.code === 'NOT_FOUND') {
        return null;
      }
      throw new StorageError('JSON_PARSE_ERROR', `Erreur parsing JSON: ${error.message}`, path);
    }
  }

  async writeJSON<T = any>(path: string, data: T): Promise<void> {
    await this.writeText(path, JSON.stringify(data, null, 2));
  }

  async getStats(): Promise<{ files: number; size: number }> {
    let files = 0;
    let size = 0;

    const walk = async (dir: string) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = nodePath.join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(fullPath);
          } else {
            files++;
            const stat = await fs.stat(fullPath);
            size += stat.size;
          }
        }
      } catch {
        // Ignorer les erreurs de lecture
      }
    };

    await walk(this.basePath);
    return { files, size };
  }

  isReadOnly(): boolean {
    return this.readOnly;
  }
}
