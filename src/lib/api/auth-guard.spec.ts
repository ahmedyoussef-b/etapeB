import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedUser,
  requirePermission,
  withAuth,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  unauthorizedResponse,
  unauthenticatedResponse,
} from '@/lib/api/auth-guard';
import { Role, Permission, RBAC_MATRIX } from '@/lib/types/rbac';
import { getServerSession } from 'next-auth/next';
import { getPrismaClient } from '@/lib/services/db';
import { verifyInjectToken } from '@/lib/auth/inject-token';
import logger from '@/lib/logger';

// --- Mocks ---

vi.mock('next-auth/next');
vi.mock('@/lib/services/db');
vi.mock('@/lib/auth/inject-token');
vi.mock('@/lib/logger');

const mockGetServerSession = vi.mocked(getServerSession);
const mockGetPrismaClient = vi.mocked(getPrismaClient);
const mockVerifyInjectToken = vi.mocked(verifyInjectToken);
const mockLogger = vi.mocked(logger);

// --- Helpers ---

function createRequest(headers: Record<string, string> = {}, ip?: string): NextRequest {
  const req = {
    headers: new Headers(headers),
    ip,
    url: 'http://localhost/api/test',
  } as unknown as NextRequest;
  return req;
}

const MOCK_SESSION = {
  user: {
    id: 'user-1',
    email: 'user@example.com',
    role: 'admin' as Role,
    name: 'Test User',
  },
};

const MOCK_DB_USER_ACTIVE = {
  id: 'user-1',
  email: 'user@example.com',
  active: true,
};

const MOCK_DB_USER_INACTIVE = {
  id: 'user-1',
  email: 'user@example.com',
  active: false,
};

// --- Tests ---

describe('getAuthenticatedUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // A. Session NextAuth valide + user actif
  it('retourne le user quand la session NextAuth est valide et le user est actif', async () => {
    mockGetServerSession.mockResolvedValue(MOCK_SESSION as any);
    mockGetPrismaClient.mockReturnValue({
      user: { findUnique: vi.fn().mockResolvedValue(MOCK_DB_USER_ACTIVE) },
    } as any);

    const req = createRequest();
    const user = await getAuthenticatedUser(req);

    expect(user).toBeDefined();
    expect(user.id).toBe('user-1');
    expect(user.email).toBe('user@example.com');
    expect(user.role).toBe('admin');
  });

  // A. Session valide + user inactif
  it('retourne 401 quand la session est valide mais le user est inactif', async () => {
    mockGetServerSession.mockResolvedValue(MOCK_SESSION as any);
    mockGetPrismaClient.mockReturnValue({
      user: { findUnique: vi.fn().mockResolvedValue(MOCK_DB_USER_INACTIVE) },
    } as any);

    const req = createRequest();
    await expect(getAuthenticatedUser(req)).rejects.toThrow('Unauthorized');
  });

  // A. Session valide + DB error
  it('retourne 401 quand la session est valide mais la DB throw', async () => {
    mockGetServerSession.mockResolvedValue(MOCK_SESSION as any);
    mockGetPrismaClient.mockReturnValue({
      user: { findUnique: vi.fn().mockRejectedValue(new Error('DB error')) },
    } as any);

    const req = createRequest();
    await expect(getAuthenticatedUser(req)).rejects.toThrow('Unauthorized');
  });

  // A. Bearer token injecté valide + user actif
  it('retourne le user avec role normalisé quand le Bearer token est valide et le user est actif', async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockVerifyInjectToken.mockResolvedValue({ sub: 'user-1' });
    mockGetPrismaClient.mockReturnValue({
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'user-1', email: 'user@example.com', role: 'ADMIN', name: 'Test', active: true }) },
    } as any);

    const req = createRequest({ authorization: 'Bearer valid-token' });
    const user = await getAuthenticatedUser(req);

    expect(user).toBeDefined();
    expect(user.id).toBe('user-1');
    expect(user.role).toBe('admin');
  });

  // A. Bearer token injecté + user inactif
  it('retourne 401 quand le Bearer token est valide mais le user est inactif', async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockVerifyInjectToken.mockResolvedValue({ sub: 'user-1' });
    mockGetPrismaClient.mockReturnValue({
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'user-1', email: 'user@example.com', role: 'ADMIN', name: 'Test', active: false }) },
    } as any);

    const req = createRequest({ authorization: 'Bearer valid-token' });
    await expect(getAuthenticatedUser(req)).rejects.toThrow('Unauthorized');
  });

  // A. Bearer token injecté + user inexistant
  it('retourne 401 quand le Bearer token est valide mais le user n\'existe pas', async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockVerifyInjectToken.mockResolvedValue({ sub: 'user-1' });
    mockGetPrismaClient.mockReturnValue({
      user: { findUnique: vi.fn().mockResolvedValue(null) },
    } as any);

    const req = createRequest({ authorization: 'Bearer valid-token' });
    await expect(getAuthenticatedUser(req)).rejects.toThrow('Unauthorized');
  });

  // A. Bearer token malformé
  it('retourne 401 quand le Bearer token est malformé', async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockVerifyInjectToken.mockResolvedValue(null);

    const req = createRequest({ authorization: 'Bearer not-a-jwt' });
    await expect(getAuthenticatedUser(req)).rejects.toThrow('Unauthorized');
  });

  // A. Header Authorization vide (Bearer + espace)
  it('retourne 401 quand l\'header Authorization est "Bearer " (vide)', async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockVerifyInjectToken.mockResolvedValue(null);

    const req = createRequest({ authorization: 'Bearer ' });
    await expect(getAuthenticatedUser(req)).rejects.toThrow('Unauthorized');
  });

  // A. Aucun header
  it('retourne 401 quand aucun header d\'authentification n\'est présent', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const req = createRequest();
    await expect(getAuthenticatedUser(req)).rejects.toThrow('Unauthorized');
  });

  // C. Rôle inconnu → fallback "rondier" (Bearer uniquement)
  it('retourne le role "rondier" quand le role Prisma est inconnu via Bearer token', async () => {
    mockGetServerSession.mockResolvedValue(null);
    mockVerifyInjectToken.mockResolvedValue({ sub: 'user-1' });
    mockGetPrismaClient.mockReturnValue({
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'user-1', email: 'user@example.com', role: 'UNKNOWN_ROLE', name: 'Test', active: true }) },
    } as any);

    const req = createRequest({ authorization: 'Bearer valid-token' });
    const user = await getAuthenticatedUser(req);

    expect(user.role).toBe('rondier');
  });
});

describe('requirePermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retourne authorized: true quand la permission est accordée', async () => {
    mockGetServerSession.mockResolvedValue(MOCK_SESSION as any);
    mockGetPrismaClient.mockReturnValue({
      user: { findUnique: vi.fn().mockResolvedValue(MOCK_DB_USER_ACTIVE) },
    } as any);

    const req = createRequest();
    const result = await requirePermission(req, 'dashboard:view');

    expect(result.authorized).toBe(true);
    expect(result.user).toBeDefined();
  });

  it('retourne 403 quand la permission est refusée', async () => {
    mockGetServerSession.mockResolvedValue({
      ...MOCK_SESSION,
      user: { ...MOCK_SESSION.user, role: 'rondier' },
    } as any);
    mockGetPrismaClient.mockReturnValue({
      user: { findUnique: vi.fn().mockResolvedValue(MOCK_DB_USER_ACTIVE) },
    } as any);

    const req = createRequest();
    const result = await requirePermission(req, 'users:manage');

    expect(result.authorized).toBe(false);
    expect(result.response?.status).toBe(403);
  });

  it('retourne 401 quand l\'utilisateur n\'est pas authentifié', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const req = createRequest();
    const result = await requirePermission(req, 'dashboard:view');

    expect(result.authorized).toBe(false);
    expect(result.response?.status).toBe(401);
  });
});

describe('withAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // D. Handler autorisé
  it('exécute le handler quand l\'utilisateur est autorisé', async () => {
    mockGetServerSession.mockResolvedValue(MOCK_SESSION as any);
    mockGetPrismaClient.mockReturnValue({
      user: { findUnique: vi.fn().mockResolvedValue(MOCK_DB_USER_ACTIVE) },
    } as any);

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAuth(handler);

    const req = createRequest();
    const response = await wrapped(req);

    expect(handler).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  // D. Handler non autorisé
  it('retourne 401/403 quand l\'utilisateur n\'est pas autorisé', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAuth(handler);

    const req = createRequest();
    const response = await wrapped(req);

    expect(handler).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
  });

  // D. Rate limit dépassé → 429 sans tentative d'auth
  it('retourne 429 quand le rate limit est dépassé, sans tentative d\'authentification', async () => {
    mockGetServerSession.mockResolvedValue(MOCK_SESSION as any);
    mockGetPrismaClient.mockReturnValue({
      user: { findUnique: vi.fn().mockResolvedValue(MOCK_DB_USER_ACTIVE) },
    } as any);

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAuth(handler);

    const req = createRequest({ 'x-forwarded-for': '10.0.0.1' });
    // 20 requêtes → dans la limite
    for (let i = 0; i < 20; i++) {
      await wrapped(req);
    }
    // Reset le compteur d'appels pour vérifier le 21ᵉ
    mockGetServerSession.mockClear();
    // 21ᵉ requête → 429
    const response = await wrapped(req);
    expect(response.status).toBe(429);
    expect(mockGetServerSession).not.toHaveBeenCalled();
  });

  // D. Fenêtre expirée → reset compteur
  it('réinitialise le rate limit après expiration de la fenêtre', async () => {
    mockGetServerSession.mockResolvedValue(MOCK_SESSION as any);
    mockGetPrismaClient.mockReturnValue({
      user: { findUnique: vi.fn().mockResolvedValue(MOCK_DB_USER_ACTIVE) },
    } as any);

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAuth(handler);

    const req = createRequest({ 'x-forwarded-for': '10.0.0.2' });
    // Atteindre la limite
    for (let i = 0; i < 20; i++) {
      await wrapped(req);
    }
    // Simuler expiration de la fenêtre
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000);
    const response = await wrapped(req);
    expect(response.status).toBe(200);
    vi.spyOn(Date, 'now').mockRestore();
  });

  // D. Handler async rejeté → 401 propre (correction ADR 007).
  // Le try/catch de withAuth capture désormais le rejet.
  it('handler async qui rejette est capté et retourne 401', async () => {
    mockGetServerSession.mockResolvedValue(MOCK_SESSION as any);
    mockGetPrismaClient.mockReturnValue({
      user: { findUnique: vi.fn().mockResolvedValue(MOCK_DB_USER_ACTIVE) },
    } as any);

    const handler = vi.fn().mockRejectedValue(new Error('Handler error'));
    const wrapped = withAuth(handler);

    const req = createRequest();
    const response = await wrapped(req);

    expect(response.status).toBe(401);
    expect(handler).toHaveBeenCalled();
  });

  // Note : le cas fail-closed (store inaccessible → 401) n'est pas testé
  // directement car il nécessiterait de mocker Map.prototype.get, ce qui
  // contamine le worker Vitest. Le comportement est documenté comme
  // fail-closed implicite dans ADR 006, section Dette structurelle D1.
});

describe('hasPermission / hasAnyPermission / hasAllPermissions', () => {
  // E. Permission directe
  it('retourne true pour une permission directe', () => {
    expect(hasPermission('admin', 'dashboard:view')).toBe(true);
  });

  // E. Wildcard resource:*
  it('retourne true pour un wildcard resource:*', () => {
    expect(hasPermission('admin', 'etat-lieux:*')).toBe(true);
  });

  // E. Rôle inconnu
  it('retourne false pour un rôle inconnu', () => {
    expect(hasPermission('unknown_role', 'dashboard:view')).toBe(false);
  });

  // hasAnyPermission
  it('retourne true si au moins une permission est accordée', () => {
    expect(hasAnyPermission('admin', ['dashboard:view', 'settings:*'])).toBe(true);
  });

  // hasAllPermissions
  it('retourne true si toutes les permissions sont accordées', () => {
    expect(hasAllPermissions('admin', ['dashboard:view', 'etat-lieux:*'])).toBe(true);
  });
});

describe('unauthorizedResponse / unauthenticatedResponse', () => {
  it('retourne 403 pour unauthorizedResponse', () => {
    const response = unauthorizedResponse();
    expect(response.status).toBe(403);
  });

  it('retourne 401 pour unauthenticatedResponse', () => {
    const response = unauthenticatedResponse();
    expect(response.status).toBe(401);
  });
});
