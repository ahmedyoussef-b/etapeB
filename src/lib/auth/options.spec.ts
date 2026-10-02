import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Role, RBAC_MATRIX } from '@/lib/types/rbac';
import { getPrismaClient } from '@/lib/services/db';
import { compare } from 'bcryptjs';
import logger from '@/lib/logger';

// --- Mocks ---

vi.mock('next-auth/providers/credentials', () => ({
  default: vi.fn((options: any) => options),
}));

vi.mock('@/lib/services/db');
vi.mock('bcryptjs');
vi.mock('@/lib/logger');

const mockGetPrismaClient = vi.mocked(getPrismaClient);
const mockCompare = vi.mocked(compare);
const mockLogger = vi.mocked(logger);

// --- Helpers ---

const MOCK_DB_USER = {
  id: 'user-1',
  email: 'user@test.com',
  password: 'hashed-password',
  active: true,
  role: 'ADMIN',
  blockId: 'block-1',
  block: { libelle: 'Block A' },
};

const MOCK_DB_USER_INACTIVE = {
  ...MOCK_DB_USER,
  active: false,
};

function setupPrisma(user: typeof MOCK_DB_USER | null, registrationRequest: { status: string } | null) {
  mockGetPrismaClient.mockReturnValue({
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
    },
    registrationRequest: {
      findUnique: vi.fn().mockResolvedValue(registrationRequest),
    },
  } as any);
}

// --- Tests ---

describe('NEXTAUTH_SECRET guard', () => {
  const originalEnv = process.env.NEXTAUTH_SECRET;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NEXTAUTH_SECRET = originalEnv;
    } else {
      delete process.env.NEXTAUTH_SECRET;
    }
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('affiche une erreur si NEXTAUTH_SECRET est absent', async () => {
    delete process.env.NEXTAUTH_SECRET;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await import('@/lib/auth/options');
    expect(console.error).toHaveBeenCalled();
  });

  it('affiche une erreur si NEXTAUTH_SECRET est vide', async () => {
    process.env.NEXTAUTH_SECRET = '';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await import('@/lib/auth/options');
    expect(console.error).toHaveBeenCalled();
  });

  it('affiche une erreur si NEXTAUTH_SECRET est whitespace', async () => {
    process.env.NEXTAUTH_SECRET = '   ';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await import('@/lib/auth/options');
    expect(console.error).toHaveBeenCalled();
  });

  it('n\'affiche pas d\'erreur si NEXTAUTH_SECRET est présent', async () => {
    process.env.NEXTAUTH_SECRET = 'secret123';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await import('@/lib/auth/options');
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe('authorize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompare.mockResolvedValue(true);
  });

  // B.1 Credentials manquants
  it('retourne null si les credentials sont manquants', async () => {
    const { authOptions } = await import('@/lib/auth/options');
    const provider = authOptions.providers[0] as any;
    const result = await provider.authorize({});
    expect(result).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  // B.2 Email vide
  it('retourne null si l\'email est vide', async () => {
    const { authOptions } = await import('@/lib/auth/options');
    const provider = authOptions.providers[0] as any;
    const result = await provider.authorize({ email: '', password: 'x' });
    expect(result).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  // B.3 Email valide + password vide
  it('retourne null si le password est vide', async () => {
    const { authOptions } = await import('@/lib/auth/options');
    const provider = authOptions.providers[0] as any;
    const result = await provider.authorize({ email: 'user@test.com', password: '' });
    expect(result).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  // B.4 User non trouvé + registrationRequest PENDING
  it('retourne null si user non trouvé + registrationRequest PENDING', async () => {
    setupPrisma(null, { status: 'PENDING' });
    const { authOptions } = await import('@/lib/auth/options');
    const provider = authOptions.providers[0] as any;
    const result = await provider.authorize({ email: 'user@test.com', password: 'x' });
    expect(result).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  // B.5 User non trouvé + registrationRequest REJECTED
  it('retourne null si user non trouvé + registrationRequest REJECTED', async () => {
    setupPrisma(null, { status: 'REJECTED' });
    const { authOptions } = await import('@/lib/auth/options');
    const provider = authOptions.providers[0] as any;
    const result = await provider.authorize({ email: 'user@test.com', password: 'x' });
    expect(result).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  // B.6 User non trouvé + pas de registrationRequest
  it('retourne null si user non trouvé + pas de registrationRequest', async () => {
    setupPrisma(null, null);
    const { authOptions } = await import('@/lib/auth/options');
    const provider = authOptions.providers[0] as any;
    const result = await provider.authorize({ email: 'user@test.com', password: 'x' });
    expect(result).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  // B.7 Password invalide
  it('retourne null si le password est invalide', async () => {
    mockCompare.mockResolvedValue(false);
    setupPrisma(MOCK_DB_USER, null);
    const { authOptions } = await import('@/lib/auth/options');
    const provider = authOptions.providers[0] as any;
    const result = await provider.authorize({ email: 'user@test.com', password: 'wrong' });
    expect(result).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  // B.8 User inactif
  it('retourne null si le user est inactif', async () => {
    setupPrisma(MOCK_DB_USER_INACTIVE, null);
    const { authOptions } = await import('@/lib/auth/options');
    const provider = authOptions.providers[0] as any;
    const result = await provider.authorize({ email: 'user@test.com', password: 'x' });
    expect(result).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  // B.9 getPrismaClient throw
  it('retourne null si getPrismaClient throw', async () => {
    mockGetPrismaClient.mockImplementation(() => {
      throw new Error('DB error');
    });
    const { authOptions } = await import('@/lib/auth/options');
    const provider = authOptions.providers[0] as any;
    const result = await provider.authorize({ email: 'user@test.com', password: 'x' });
    expect(result).toBeNull();
    expect(mockLogger.error).toHaveBeenCalled();
  });

  // B.10 Authentification succès
  it('retourne le user avec permissions et role normalisé en cas de succès', async () => {
    setupPrisma(MOCK_DB_USER, null);
    const { authOptions } = await import('@/lib/auth/options');
    const provider = authOptions.providers[0] as any;
    const result = await provider.authorize({ email: 'user@test.com', password: 'x' });
    expect(result).toBeDefined();
    expect(result.id).toBe('user-1');
    expect(result.email).toBe('user@test.com');
    expect(result.role).toBe('admin');
    expect(result.permissions).toEqual(RBAC_MATRIX['admin']);
    expect(mockLogger.info).toHaveBeenCalled();
  });

  // B.11 BUG CONNU : bcrypt.compare throw non capté
  it('BUG CONNU : bcrypt.compare throw n\'est pas capté par authorize', async () => {
    setupPrisma(MOCK_DB_USER, null);
    mockCompare.mockRejectedValue(new Error('bcrypt error'));
    const { authOptions } = await import('@/lib/auth/options');
    const provider = authOptions.providers[0] as any;
    const result = provider.authorize({ email: 'user@test.com', password: 'x' });
    await expect(result).rejects.toThrow('bcrypt error');
  });
});

describe('PRISMA_ROLE_TO_APP_ROLE via authorize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompare.mockResolvedValue(true);
  });

  it('mappe RONDIER -> rondier', async () => {
    setupPrisma({ ...MOCK_DB_USER, role: 'RONDIER' }, null);
    const { authOptions } = await import('@/lib/auth/options');
    const provider = authOptions.providers[0] as any;
    const result = await provider.authorize({ email: 'user@test.com', password: 'x' });
    expect(result.role).toBe('rondier');
  });

  it('mappe CHEF_DE_BLOC -> chef-de-bloc', async () => {
    setupPrisma({ ...MOCK_DB_USER, role: 'CHEF_DE_BLOC' }, null);
    const { authOptions } = await import('@/lib/auth/options');
    const provider = authOptions.providers[0] as any;
    const result = await provider.authorize({ email: 'user@test.com', password: 'x' });
    expect(result.role).toBe('chef-de-bloc');
  });

  it('mappe CHEF_DE_QUART -> chef-de-quart', async () => {
    setupPrisma({ ...MOCK_DB_USER, role: 'CHEF_DE_QUART' }, null);
    const { authOptions } = await import('@/lib/auth/options');
    const provider = authOptions.providers[0] as any;
    const result = await provider.authorize({ email: 'user@test.com', password: 'x' });
    expect(result.role).toBe('chef-de-quart');
  });

  it('mappe ADMIN -> admin', async () => {
    setupPrisma({ ...MOCK_DB_USER, role: 'ADMIN' }, null);
    const { authOptions } = await import('@/lib/auth/options');
    const provider = authOptions.providers[0] as any;
    const result = await provider.authorize({ email: 'user@test.com', password: 'x' });
    expect(result.role).toBe('admin');
  });

  it('fallback sur rondier pour rôle inconnu / null / undefined', async () => {
    // Rôle inconnu
    setupPrisma({ ...MOCK_DB_USER, role: 'UNKNOWN_ROLE' }, null);
    let { authOptions } = await import('@/lib/auth/options');
    let provider = authOptions.providers[0] as any;
    let result = await provider.authorize({ email: 'user@test.com', password: 'x' });
    expect(result.role).toBe('rondier');

    // null
    setupPrisma({ ...MOCK_DB_USER, role: null }, null);
    ({ authOptions } = await import('@/lib/auth/options'));
    provider = authOptions.providers[0] as any;
    result = await provider.authorize({ email: 'user@test.com', password: 'x' });
    expect(result.role).toBe('rondier');

    // undefined
    setupPrisma({ ...MOCK_DB_USER, role: undefined }, null);
    ({ authOptions } = await import('@/lib/auth/options'));
    provider = authOptions.providers[0] as any;
    result = await provider.authorize({ email: 'user@test.com', password: 'x' });
    expect(result.role).toBe('rondier');
  });
});

describe('callbacks JWT', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enrichit le token au premier login (user présent)', async () => {
    const { authOptions } = await import('@/lib/auth/options');
    const jwtCallback = authOptions.callbacks.jwt;
    const token: any = {};
    const user = {
      role: 'admin',
      id: 'user-1',
      blockId: 'block-1',
      blockName: 'Block A',
      permissions: RBAC_MATRIX['admin'],
    };
    const result = await jwtCallback({ token, user } as any);
    expect(result.role).toBe('admin');
    expect(result.id).toBe('user-1');
    expect(result.blockId).toBe('block-1');
    expect(result.blockName).toBe('Block A');
    expect(result.permissions).toEqual(RBAC_MATRIX['admin']);
  });

  it('ne normalise pas un rôle inconnu du mapping (ADM)', async () => {
    // NOTE : ADM n'a jamais été un rôle dans ce projet.
    // Ce test documente le comportement du code : un rôle inconnu
    // du mapping PRISMA_ROLE_TO_APP_ROLE reste inchangé dans le token.
    const { authOptions } = await import('@/lib/auth/options');
    const jwtCallback = authOptions.callbacks.jwt;
    const token: any = { role: 'ADM' };
    const result = await jwtCallback({ token, user: undefined } as any);
    expect(result.role).toBe('ADM'); // inchangé
  });

  it('laisse le token inchangé si le rôle est déjà normalisé', async () => {
    const { authOptions } = await import('@/lib/auth/options');
    const jwtCallback = authOptions.callbacks.jwt;
    const token: any = { role: 'admin' };
    const result = await jwtCallback({ token, user: undefined } as any);
    expect(result.role).toBe('admin');
  });
});

describe('callbacks session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enrichit session.user depuis le token', async () => {
    const { authOptions } = await import('@/lib/auth/options');
    const sessionCallback = authOptions.callbacks.session;
    const session: any = { user: {} };
    const token: any = {
      role: 'admin',
      id: 'user-1',
      blockId: 'block-1',
      blockName: 'Block A',
      permissions: RBAC_MATRIX['admin'],
    };
    const result = await sessionCallback({ session, token } as any);
    expect(result.user.role).toBe('admin');
    expect(result.user.id).toBe('user-1');
    expect(result.user.blockId).toBe('block-1');
    expect(result.user.blockName).toBe('Block A');
    expect(result.user.permissions).toEqual(RBAC_MATRIX['admin']);
  });
});
