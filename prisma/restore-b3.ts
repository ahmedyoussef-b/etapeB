import * as fs from 'node:fs';
import * as nodePath from 'node:path';

interface EquipEntry {
  external_id: string;
  path: string;
  level: number;
  label_fr?: string;
  type?: string;
}

function splitJsonArrays(text: string): string[] {
  const results: string[] = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) { esc = false; }
      else if (c === '\\') { esc = true; }
      else if (c === '"') { inStr = false; }
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '[') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === ']') {
      depth--;
      if (depth === 0 && start >= 0) {
        results.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return results;
}

function main() {
  const file = nodePath.resolve(process.cwd(), '.data', 'data-repertoire.json');
  const raw = fs.readFileSync(file, 'utf-8').replace(/^\uFEFF/, '');
  const sheets = splitJsonArrays(raw).map(s => JSON.parse(s) as EquipEntry[]);

  const blocksSheet = sheets[0];
  const blockCodes = new Set(blocksSheet.map(e => e.external_id));

  const blockSheet = sheets.find(s => s.length && s[0].external_id.startsWith('B3.')) || [];

  const centraleRoot = nodePath.resolve(process.cwd(), '.data', 'Centrale');
  if (!fs.existsSync(centraleRoot)) {
    console.error('❌ .data/Centrale introuvable');
    process.exit(1);
  }

  fs.mkdirSync(nodePath.join(centraleRoot, 'B3'), { recursive: true });

  fs.writeFileSync(
    nodePath.join(centraleRoot, 'B3', '.meta.json'),
    JSON.stringify({ code: 'B3', libelle: 'Bloc B3', type: 'centrale', syncState: 'local-only' }) + '\n'
  );

  let created = 0;
  for (const e of blockSheet) {
    if (e.level !== 2) continue;
    const code = e.path.split('/').pop()!;
    const dir = nodePath.join(centraleRoot, 'B3', code);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      nodePath.join(dir, '.meta.json'),
      JSON.stringify({
        type: 'equipment',
        blockCode: 'B3',
        block: 'B3',
        syncState: 'local-only',
        code,
        libelle: code
      }) + '\n'
    );
    created++;
  }

  const blockCodesList = Array.from(blockCodes).join(', ');
  console.log(`✅ B3 restauré : ${created} équipements (+ block), blocs référence: ${blockCodesList}`);
}

main();
