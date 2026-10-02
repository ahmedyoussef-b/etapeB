import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'crypto';
import { signInjectToken, verifyInjectToken } from '../inject-token';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/services/db', () => ({
  getPrismaClient: vi.fn(),
}));

import { getPrismaClient } from '@/lib/services/db';

const TEST_SECRET = 'test-secret';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Construit un JWT HS256 minimal, sans `exp`, pour le cas T2.
 *
 * Duplication assumée de la logique de `signInjectToken`
 * (référence : ADR 004 §Décision.1 — « exp obligatoire »).
 */
function buildTokenWithoutExp(sub: string): string {
  const base64url = (input: Buffer): string =>
    input
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

  const header = base64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = base64url(Buffer.from(JSON.stringify({ sub })));
  const signature = createHmac('sha256', TEST_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return `${header}.${payload}.${signature}`;
}

/**
 * Altère le dernier caractère du segment de signature d'un JWT,
 * pour produire une signature invalide (cas T4).
 */
function tamperSignature(token: string): string {
  const [header, payload, signature] = token.split('.');
  if (!signature) throw new Error('Token sans signature');
  const lastChar = signature.slice(-1);
  const newLastChar = lastChar === 'A' ? 'B' : 'A';
  return `${header}.${payload}.${signature.slice(0, -1)}${newLastChar}`;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('verifyInjectToken (ADR 004 hardening)', () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = TEST_SECRET;
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.NEXTAUTH_SECRET;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // T1 — token valide, sub existant, exp futur
  // -------------------------------------------------------------------------
  it('T1 : accepte un token valide avec sub existant et exp futur', async () => {
    const prismaMock = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'user_existant' }),
      },
    };
    vi.mocked(getPrismaClient).mockReturnValue(prismaMock as never);

    const token = signInjectToken('user_existant');
    const result = await verifyInjectToken(token);

    expect(result).toEqual({ sub: 'user_existant' });
    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user_existant' },
      select: { id: true },
    });
  });

  // -------------------------------------------------------------------------
  // T2 — token sans exp
  // -------------------------------------------------------------------------
  it('T2 : rejette un token sans exp', async () => {
    const prismaMock = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'user_existant' }),
      },
    };
    vi.mocked(getPrismaClient).mockReturnValue(prismaMock as never);

    const token = buildTokenWithoutExp('user_existant');
    const result = await verifyInjectToken(token);

    expect(result).toBeNull();
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // T3 — token avec sub inexistant en BDD
  // -------------------------------------------------------------------------
  it('T3 : rejette un token dont le sub est inexistant en BDD', async () => {
    const prismaMock = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    vi.mocked(getPrismaClient).mockReturnValue(prismaMock as never);

    const token = signInjectToken('user_inexistant');
    const result = await verifyInjectToken(token);

    expect(result).toBeNull();
    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // T4 — signature invalide
  // -------------------------------------------------------------------------
  it('T4 : rejette un token dont la signature est altérée', async () => {
    const prismaMock = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'user_existant' }),
      },
    };
    vi.mocked(getPrismaClient).mockReturnValue(prismaMock as never);

    const token = signInjectToken('user_existant');
    const tampered = tamperSignature(token);
    const result = await verifyInjectToken(tampered);

    expect(result).toBeNull();
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // T5 — exp dans le passé
  // -------------------------------------------------------------------------
  it('T5 : rejette un token expiré', async () => {
    const prismaMock = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'user_existant' }),
      },
    };
    vi.mocked(getPrismaClient).mockReturnValue(prismaMock as never);

    // Signature avec Date.now() réel → exp = maintenant + 15 min
    const token = signInjectToken('user_existant');

    // Avance le temps de 16 minutes
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 16 * 60 * 1000);

    const result = await verifyInjectToken(token);

    expect(result).toBeNull();
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });
});
