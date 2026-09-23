import * as fs from 'node:fs';
import * as path from 'node:path';

const DATA_DIR = path.join(__dirname, '..', '.data');
const OUTPUT = path.join(__dirname, '..', 'lib', 'seed-data.ts');

const TEXT_EXTS = new Set(['.json', '.txt', '.md', '.csv', '.log']);
const BINARY_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.bin', '.webp', '.svg', '.bmp', '.zip', '.tar', '.gz', '.7z', '.mp3', '.mp4', '.avi', '.mov', '.wav', '.flac', '.mkv', '.xlsx', '.doc', '.docx', '.pptx']);

interface SeedFile {
  path: string;
  content: string;
  size: number;
  encoding: 'utf-8' | 'base64';
}

interface SeedMetadata {
  generatedAt: string;
  totalFiles: number;
  textFiles: number;
  binaryFiles: number;
  source: string;
}

function isBinaryByExt(ext: string): boolean {
  return BINARY_EXTS.has(ext);
}

function isTextByExt(ext: string): boolean {
  return TEXT_EXTS.has(ext);
}

function detectEncoding(content: Buffer): 'utf-8' | 'base64' {
  // Heuristic: if the buffer contains null bytes or high ratio of non-printable chars, treat as binary
  let nonPrintable = 0;
  const sampleSize = Math.min(content.length, 4096);
  for (let i = 0; i < sampleSize; i++) {
    const byte = content[i];
    if (byte === 0) return 'base64';
    if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) nonPrintable++;
  }
  if (nonPrintable > sampleSize * 0.1) return 'base64';
  return 'utf-8';
}

function walk(dir: string, baseDir: string): SeedFile[] {
  const files: SeedFile[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') && !entry.name.endsWith('.meta.json')) continue;
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      files.push(...walk(fullPath, baseDir));
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      try {
        const buffer = fs.readFileSync(fullPath);
        const size = buffer.length;
        let encoding: 'utf-8' | 'base64';
        let content: string;

        if (isBinaryByExt(ext) || !isTextByExt(ext)) {
          encoding = 'base64';
          content = buffer.toString('base64');
        } else {
          encoding = detectEncoding(buffer);
          if (encoding === 'base64') {
            content = buffer.toString('base64');
          } else {
            content = buffer.toString('utf-8');
          }
        }

        files.push({ path: relPath, content, size, encoding });
      } catch {
        // skip unreadable files
      }
    }
  }
  return files;
}

function main() {
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`❌ Directory not found: ${DATA_DIR}`);
    process.exit(1);
  }

  const files = walk(DATA_DIR, DATA_DIR);
  files.sort((a, b) => a.path.localeCompare(b.path));

  const binaryCount = files.filter(f => f.encoding === 'base64').length;
  const textCount = files.filter(f => f.encoding === 'utf-8').length;

  const metadata: SeedMetadata = {
    generatedAt: new Date().toISOString(),
    totalFiles: files.length,
    textFiles: textCount,
    binaryFiles: binaryCount,
    source: '.data',
  };

  const output = `// AUTO-GENERATED — ne pas éditer manuellement
// Source : .data/
// Généré : ${metadata.generatedAt}

export interface SeedFile {
  path: string;
  content: string;
  size: number;
  encoding: 'utf-8' | 'base64';
}

export const SEED_FILES: SeedFile[] = ${JSON.stringify(files)};

export const SEED_METADATA = ${JSON.stringify(metadata)};
`;

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, output, 'utf-8');
  const sizeKB = (output.length / 1024).toFixed(1);
  console.log(`✅ Generated ${OUTPUT} (${sizeKB} KB, ${files.length} files)`);
}

main();
