import { NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/services/db';
import { compare } from 'bcryptjs';
import { signInjectToken } from '@/lib/auth/inject-token';
import logger from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const attempts = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfter: number | null } {
  const now = Date.now();
  const record = attempts.get(ip);

  if (!record || now > record.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfter: null };
  }

  if (record.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  record.count += 1;
  return { allowed: true, retryAfter: null };
}

async function logAuditFailure(prisma: ReturnType<typeof getPrismaClient>, email: string, ip: string) {
  try {
    await prisma.auditLog.create({
      data: {
        action: 'TAURI_TOKEN_FAILED',
        entity: 'auth',
        entityId: email,
        ipAddress: ip,
        after: { email },
      },
    });
  } catch (auditErr) {
    logger.warn('Audit log failed', { error: auditErr instanceof Error ? auditErr.message : String(auditErr) });
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateCheck.retryAfter ?? 900),
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { email, password } = body as { email?: string; password?: string };

    logger.info('Tauri token auth: attempt', { email: email?.trim().toLowerCase(), hasPassword: !!password, ip });

    if (!email || !password) {
      logger.warn('Tauri token auth: missing email or password', { email: !!email, password: !!password, ip });
      return NextResponse.json(
        { error: 'Invalid credentials' },
        {
          status: 401,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    logger.info('Tauri token auth: normalized email', { email: normalizedEmail, ip });

    let prisma;
    try {
      prisma = getPrismaClient();
    } catch (err) {
      logger.error('Tauri token auth: database unavailable', { error: err instanceof Error ? err.message : String(err) });
      return NextResponse.json(
        { error: 'Invalid credentials' },
        {
          status: 401,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    logger.info('Tauri token auth: user lookup result', { email: normalizedEmail, found: !!user, role: user?.role, ip });

    if (!user || !user.password) {
      await logAuditFailure(prisma, normalizedEmail, ip);
      logger.warn('Tauri token auth: user not found', { email: normalizedEmail, ip });
      return NextResponse.json(
        { error: 'Invalid credentials' },
        {
          status: 401,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }

    const isPasswordValid = await compare(password, user.password);
    logger.info('Tauri token auth: password check', { email: normalizedEmail, valid: isPasswordValid, ip });

    if (!isPasswordValid) {
      await logAuditFailure(prisma, normalizedEmail, ip);
      logger.warn('Tauri token auth: invalid password', { email: normalizedEmail, userId: user.id, ip });
      return NextResponse.json(
        { error: 'Invalid credentials' },
        {
          status: 401,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }

    const isAdmin = user.role?.toLowerCase() === 'admin';
    logger.info('Tauri token auth: role check', { email: normalizedEmail, userId: user.id, role: user.role, isAdmin, ip });

    if (!isAdmin) {
      await logAuditFailure(prisma, normalizedEmail, ip);
      logger.warn('Tauri token auth: non-admin role', { email: normalizedEmail, userId: user.id, role: user.role, ip });
      return NextResponse.json(
        { error: 'Invalid credentials' },
        {
          status: 403,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }

    const token = signInjectToken(user.id);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    logger.info('Tauri token auth: success', { email: normalizedEmail, userId: user.id, ip });

    return NextResponse.json(
      { token, expiresAt },
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  } catch (err) {
    logger.error('[API /auth/tauri-token] Erreur:', err);
    return NextResponse.json(
      { error: 'Invalid credentials' },
      {
        status: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
