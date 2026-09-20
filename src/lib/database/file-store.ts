import fs from "fs/promises";
import path from "path";

export class FileStore {
  private filePath: string;
  private lockFile: string;
  private backupFile: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.lockFile = `${filePath}.lock`;
    this.backupFile = `${filePath}.bak`;
  }

  private async ensureDir(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    } catch {
      // Directory may already exist
    }
  }

  private async withLock<T>(operation: () => Promise<T>, maxRetries = 5): Promise<T> {
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      let lockHandle: import("fs/promises").FileHandle | undefined;
      try {
        lockHandle = await fs.open(this.lockFile, "wx");
        await lockHandle.close();

        try {
          const result = await operation();
          return result;
        } finally {
          try {
            await fs.unlink(this.lockFile);
          } catch {
            // Lock file may have been removed already
          }
        }
      } catch (error) {
        if (lockHandle) {
          try {
            await lockHandle.close();
          } catch {
            // Ignore close errors
          }
        }

        if (attempt < maxRetries - 1) {
          await delay(50 * (attempt + 1));
          continue;
        }
        throw error;
      }
    }

    throw new Error(`Failed to acquire file lock after ${maxRetries} attempts`);
  }

  async read<T>(): Promise<T> {
    await this.ensureDir();
    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(raw);
      return parsed as T;
    } catch {
      try {
        const raw = await fs.readFile(this.backupFile, "utf-8");
        const parsed = JSON.parse(raw);
        await fs.copyFile(this.backupFile, this.filePath);
        return parsed as T;
      } catch {
        throw new Error(`Failed to read file: ${this.filePath}`);
      }
    }
  }

  async write<T>(data: T): Promise<void> {
    return this.withLock(async () => {
      await this.ensureDir();
      const tmpFile = `${this.filePath}.${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`;
      const content = JSON.stringify(data, null, 2);

      try {
        await fs.writeFile(tmpFile, content, "utf-8");
        try {
          await fs.copyFile(this.filePath, this.backupFile);
        } catch {
          // Backup may not exist yet
        }
        await fs.rename(tmpFile, this.filePath);
      } catch (error) {
        try {
          await fs.unlink(tmpFile);
        } catch {
          // Ignore cleanup errors
        }
        throw error;
      }
    });
  }

  async readArray<T>(): Promise<T[]> {
    try {
      const data = await this.read<T[]>();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  async mutateArray<T>(mutator: (items: T[]) => T[]): Promise<T[]> {
    return this.withLock(async () => {
      const items = await this.readArray<T>();
      const updated = mutator(items);
      await this.write<T[]>(updated);
      return updated;
    });
  }

  async cleanup(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      const entries = await fs.readdir(dir);
      const prefix = path.basename(this.filePath);
      
      for (const entry of entries) {
        if (entry.startsWith(`${prefix}.`) && entry.endsWith('.tmp')) {
          try {
            await fs.unlink(path.join(dir, entry));
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}
