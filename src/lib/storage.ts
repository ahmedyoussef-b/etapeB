import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data');

export function storeFile(relPath: string, buffer: Buffer, mimeType?: string): string {
  const absPath = path.join(DATA_DIR, relPath);
  const dir = path.dirname(absPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(absPath, buffer);
  return absPath;
}

export function readFile(relPath: string): Buffer {
  const absPath = path.join(DATA_DIR, relPath);
  return fs.readFileSync(absPath);
}

export function fileExists(relPath: string): boolean {
  const absPath = path.join(DATA_DIR, relPath);
  return fs.existsSync(absPath);
}

export function getDataDir(): string {
  return DATA_DIR;
}
