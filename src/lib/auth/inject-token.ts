import { createHmac } from 'crypto';
import { getPrismaClient } from '@/lib/services/db';

const ALG = 'HS256';
const TYP = 'JWT';
const EXPIRY_SECONDS = 15 * 60;

function base64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not set');
  }
  return secret;
}

export function signInjectToken(userId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    iat: now,
    exp: now + EXPIRY_SECONDS,
  };

  const header = base64url(Buffer.from(JSON.stringify({ alg: ALG, typ: TYP })));
  const payloadB64 = base64url(Buffer.from(JSON.stringify(payload)));
  const signature = createHmac('sha256', getSecret()).update(`${header}.${payloadB64}`).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

  return `${header}.${payloadB64}.${signature}`;
}

export async function verifyInjectToken(token: string): Promise<{ sub: string } | null> {
  try {
    const [headerB64, payloadB64, signature] = token.split('.');
    if (!headerB64 || !payloadB64 || !signature) return null;

    const expected = createHmac('sha256', getSecret()).update(`${headerB64}.${payloadB64}`).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    if (expected !== signature) return null;

    const payload = JSON.parse(Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8'));
    if (typeof payload?.sub !== 'string') return null;
    if (typeof payload.exp !== 'number' || Date.now() / 1000 > payload.exp) return null;

    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, active: true },
    });
    if (!user || !user.active) return null;

    return { sub: payload.sub };
  } catch {
    return null;
  }
}
