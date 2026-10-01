import 'dotenv/config';
import { getPrismaClient } from '@/lib/services/db';
import { embedTexts } from '@/lib/ai/cloudflare-embeddings';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';

const REPERTOIRE_PATH = 'docs/data-repertoire.json';
const EMBEDDING_BATCH_SIZE = 10;
const NEON_SOURCES = [
  'bank/ahmed_abbes/ahmed_abbes.json',
  'bank/img_20191213_115100/img_20191213_115100.json',
  'registry/items/admin.json',
];

interface RepertoireNode {
  code?: string;
  path: string;
  type: string;
  label_fr?: string;
  label_en?: string;
  description_fr?: string;
  description_en?: string;
  children?: RepertoireNode[];
}

interface Chunk {
  source: string;
  chunkIndex: number;
  content: string;
}

function buildRepertoireChunks(): Chunk[] {
  const raw = fs.readFileSync(REPERTOIRE_PATH, 'utf-8');
  const doc = JSON.parse(raw) as { Centrale: RepertoireNode };
  const chunks: Chunk[] = [];
  const source = REPERTOIRE_PATH;

  function walk(node: RepertoireNode) {
    const parts: string[] = [];
    if (node.label_fr) parts.push(node.label_fr);
    if (node.label_en) parts.push(node.label_en);
    if (node.description_fr) parts.push(node.description_fr);
    if (node.description_en) parts.push(node.description_en);
    if (node.path) parts.push(`path: ${node.path}`);

    if (parts.length > 0) {
      chunks.push({
        source,
        chunkIndex: chunks.length,
        content: parts.join('\n'),
      });
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  walk(doc.Centrale);
  return chunks;
}

async function loadNeonDocuments(): Promise<Chunk[]> {
  const prisma = getPrismaClient();
  const chunks: Chunk[] = [];

  for (const source of NEON_SOURCES) {
    const rows = (await prisma.$queryRaw`
      SELECT path, encode(data, 'escape') AS data_text
      FROM documents
      WHERE path = ${source}
      LIMIT 1
    `) as Array<{ path: string; data_text: string }>;

    const doc = rows[0];
    if (!doc) {
      console.warn(`[NEON] Document introuvable: ${source}`);
      continue;
    }

    const content = doc.data_text ?? '';
    if (!content) {
      console.warn(`[NEON] Document vide: ${source}`);
      continue;
    }

    chunks.push({
      source: doc.path,
      chunkIndex: 0,
      content,
    });
  }

  return chunks;
}

async function embedChunks(chunks: Chunk[]): Promise<number[][]> {
  const texts = chunks.map((c) => c.content);
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const embeddings = await embedTexts(batch);
    results.push(...embeddings);

    if (embeddings.length !== batch.length) {
      throw new Error(
        `[EMBED] Batch ${i / EMBEDDING_BATCH_SIZE + 1}: attendu ${batch.length} embeddings, reçu ${embeddings.length}`
      );
    }
  }

  return results;
}

async function upsertChunks(chunks: Chunk[], embeddings: number[][]): Promise<{ inserted: number; updated: number; errors: number }> {
  const prisma = getPrismaClient();
  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings[i];
    const embeddingStr = `[${embedding.join(',')}]`;

    try {
      const existing = await prisma.documentChunk.findUnique({
        where: {
          source_chunkIndex: {
            source: chunk.source,
            chunkIndex: chunk.chunkIndex,
          },
        },
        select: { id: true },
      });

      const id = existing?.id ?? randomUUID();

      await prisma.$executeRaw`
        INSERT INTO document_chunks (id, source, "chunkIndex", content, embedding, "createdAt", "updatedAt")
        VALUES (${id}, ${chunk.source}, ${chunk.chunkIndex}, ${chunk.content}, ${embeddingStr}::vector, NOW(), NOW())
        ON CONFLICT (source, "chunkIndex") DO UPDATE
        SET content = EXCLUDED.content,
            embedding = EXCLUDED.embedding,
            "updatedAt" = NOW()
      `;

      if (existing) {
        updated++;
      } else {
        inserted++;
      }
    } catch (error) {
      errors++;
      console.error(`[DB] Erreur upsert source=${chunk.source} chunkIndex=${chunk.chunkIndex}`, error);
    }
  }

  return { inserted, updated, errors };
}

async function main() {
  const start = Date.now();
  console.log('[START] Vectorisation de document_chunks');

  const neonChunks = await loadNeonDocuments();
  console.log(`[NEON] ${neonChunks.length} document(s) chargé(s)`);

  const repertoireChunks = buildRepertoireChunks();
  console.log(`[REPERTOIRE] ${repertoireChunks.length} chunk(s) généré(s)`);

  const allChunks = [...neonChunks, ...repertoireChunks];
  console.log(`[TOTAL] ${allChunks.length} chunk(s) à vectoriser`);

  if (allChunks.length === 0) {
    console.log('[DONE] Aucun chunk à traiter.');
    return;
  }

  console.log('[EMBED] Génération des embeddings...');
  const maxLen = Math.max(...allChunks.map((c) => c.content.length));
  console.log(`[INFO] Taille max d'un chunk: ${maxLen} caractères`);
  const embeddings = await embedChunks(allChunks);
  console.log(`[EMBED] ${embeddings.length} embedding(s) généré(s)`);

  console.log('[DB] Upsert dans document_chunks...');
  const { inserted, updated, errors } = await upsertChunks(allChunks, embeddings);

  const totalInDb = await getPrismaClient().documentChunk.count();
  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`[DONE] Total: ${allChunks.length} chunks | ${inserted} insérés, ${updated} mis à jour, ${errors} erreurs | durée: ${duration}s`);
  console.log(`[VERIFY] Ligne(s) dans document_chunks: ${totalInDb}`);
}

main()
  .catch((error) => {
    console.error('[FATAL]', error);
    process.exit(1);
  });
