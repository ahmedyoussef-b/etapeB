import { describe, it, expect, vi } from 'vitest';
import { searchHybrid, searchLexicalOnly, type RagSearchResult } from './rag-search';

function createMockPrisma(vectorialResults: any[], lexicalResults: any[]) {
  return {
    $queryRaw: vi.fn().mockResolvedValueOnce(vectorialResults).mockResolvedValueOnce(lexicalResults),
  } as any;
}

describe('searchHybrid - RRF fusion', () => {
  it('T1 - cumule les scores si chunk present dans les 2 listes', async () => {
    const vectorial = [
      { id: 'a', content: 'A', source: 'src', chunkIndex: 0, similarity: 0.9 },
    ];
    const lexical = [
      { id: 'a', content: 'A', source: 'src', chunkIndex: 0, rank: 0.5 },
    ];
    const prisma = createMockPrisma(vectorial, lexical);
    const results = await searchHybrid(prisma, 'q', [0.1], 5);
    expect(results).toHaveLength(1);
    expect(results[0].rrfScore).toBeCloseTo(2 / 61, 5);
  });

  it('T2 - score simple si chunk present dans 1 seule liste', async () => {
    const vectorial = [
      { id: 'a', content: 'A', source: 'src', chunkIndex: 0, similarity: 0.9 },
    ];
    const lexical: any[] = [];
    const prisma = createMockPrisma(vectorial, lexical);
    const results = await searchHybrid(prisma, 'q', [0.1], 5);
    expect(results).toHaveLength(1);
    expect(results[0].rrfScore).toBeCloseTo(1 / 61, 5);
  });

  it('T3 - tri decroissant par score', async () => {
    const vectorial = [
      { id: 'a', content: 'A', source: 's', chunkIndex: 0, similarity: 0.9 },
      { id: 'b', content: 'B', source: 's', chunkIndex: 1, similarity: 0.8 },
    ];
    const lexical = [
      { id: 'b', content: 'B', source: 's', chunkIndex: 1, rank: 0.5 },
    ];
    const prisma = createMockPrisma(vectorial, lexical);
    const results = await searchHybrid(prisma, 'q', [0.1], 5);
    expect(results[0].id).toBe('b');
    expect(results[1].id).toBe('a');
  });

  it('T4 - deduplication par id', async () => {
    const vectorial = [
      { id: 'a', content: 'A', source: 's', chunkIndex: 0, similarity: 0.9 },
    ];
    const lexical = [
      { id: 'a', content: 'A', source: 's', chunkIndex: 0, rank: 0.5 },
    ];
    const prisma = createMockPrisma(vectorial, lexical);
    const results = await searchHybrid(prisma, 'q', [0.1], 5);
    expect(results).toHaveLength(1);
  });

  it('T5 - topK respecte', async () => {
    const vectorial = Array.from({ length: 10 }, (_, i) => ({
      id: `v${i}`,
      content: `V${i}`,
      source: 's',
      chunkIndex: i,
      similarity: 0.9 - i * 0.01,
    }));
    const lexical: any[] = [];
    const prisma = createMockPrisma(vectorial, lexical);
    const results = await searchHybrid(prisma, 'q', [0.1], 3);
    expect(results).toHaveLength(3);
  });

  it('T6 - fallback vectoriel vide + lexical non vide', async () => {
    const vectorial: any[] = [];
    const lexical = [
      { id: 'a', content: 'A', source: 's', chunkIndex: 0, rank: 0.5 },
    ];
    const prisma = createMockPrisma(vectorial, lexical);
    const results = await searchHybrid(prisma, 'q', [0.1], 5);
    expect(results).toHaveLength(1);
    expect(results[0].rrfScore).toBeCloseTo(1 / 61, 5);
  });

  it('T7 - fallback vectoriel non vide + lexical vide (H6-A)', async () => {
    const vectorial = [
      { id: 'a', content: 'A', source: 's', chunkIndex: 0, similarity: 0.9 },
    ];
    const lexical: any[] = [];
    const prisma = createMockPrisma(vectorial, lexical);
    const results = await searchHybrid(prisma, 'q', [0.1], 5);
    expect(results).toHaveLength(1);
  });

  it('T8 - les deux vides retourne []', async () => {
    const prisma = createMockPrisma([], []);
    const results = await searchHybrid(prisma, 'q', [0.1], 5);
    expect(results).toHaveLength(0);
  });
});

describe('searchHybrid - gestion erreurs', () => {
  it('T10 - searchVectorial throw retourne []', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockRejectedValueOnce(new Error('DB error')).mockResolvedValueOnce([]),
    } as any;
    const results = await searchHybrid(prisma, 'q', [0.1], 5);
    expect(results).toHaveLength(0);
  });
});

describe('searchLexicalOnly - fallback E4', () => {
  it('L1 - retourne les chunks lexicaux uniquement', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValueOnce([
        { id: 'a', content: 'A', source: 's', chunkIndex: 0, rank: 0.5 },
      ]),
    } as any;
    const results = await searchLexicalOnly(prisma, 'q', 5);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('a');
    expect(results[0].rrfScore).toBeCloseTo(1 / 61, 5);
  });

  it('L2 - retourne [] si aucun resultat lexical', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValueOnce([]),
    } as any;
    const results = await searchLexicalOnly(prisma, 'q', 5);
    expect(results).toHaveLength(0);
  });

  it('L3 - topK respecte', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValueOnce(
        Array.from({ length: 10 }, (_, i) => ({
          id: `l${i}`,
          content: `L${i}`,
          source: 's',
          chunkIndex: i,
          rank: 0.5 - i * 0.01,
        }))
      ),
    } as any;
    const results = await searchLexicalOnly(prisma, 'q', 3);
    expect(results).toHaveLength(3);
  });
});
