export interface StorageAdapter {
  read(path: string): Promise<Buffer>;
  write(path: string, data: Buffer): Promise<void>;
  mkdir(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  list(path: string): Promise<string[]>;
  delete(path: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  readText(path: string): Promise<string>;
  writeText(path: string, content: string): Promise<void>;
  readJSON<T = any>(path: string): Promise<T | null>;
  writeJSON<T = any>(path: string, data: T): Promise<void>;
  getStats?(): Promise<{ files: number; size: number }>;
}

export class StorageError extends Error {
  constructor(
    public code: string,
    message: string,
    public path?: string
  ) {
    super(message);
    this.name = 'StorageError';
  }
}
