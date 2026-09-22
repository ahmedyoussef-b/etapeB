import * as fs from 'node:fs';
import * as path from 'node:path';

const DATA_DIR = path.join(__dirname, '..', '.data');
const OUTPUT = path.join(__dirname, '..', 'lib', 'seed-data.ts');

const TEXT_EXTS = ['.json', '.txt', '.md', '.csv', '.log'];
const BINARY_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.bin'];

interface SeedFile {
  path: string;
  content: string;
  size: number;
}

interface SeedMetadata {
  generatedAt: string;
  totalFiles: number;
  textFiles: number;
  binaryFiles: number;
  source: string;
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
      if (BINARY_EXTS.includes(ext)) continue;
      if (!TEXT_EXTS.includes(ext)) continue;
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const size = fs.statSync(fullPath).size;
        files.push({ path: relPath, content, size });
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

  const binaryCount = files.filter(f => BINARY_EXTS.includes(path.extname(f.path).toLowerCase())).length;
  const textCount = files.filter(f => TEXT_EXTS.includes(path.extname(f.path).toLowerCase())).length;

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
