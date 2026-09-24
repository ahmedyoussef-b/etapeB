import { getServerSession } from "next-auth/next";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { Role, Permission, RBAC_MATRIX } from "@/lib/types/rbac";
import { verifyInjectToken } from "@/lib/auth/inject-token";
import { getPrismaClient } from "@/lib/services/db";
import logger from "@/lib/logger";

// Rate limiting store (in-memory, for production use Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(req: NextRequest, maxRequests: number = 20, windowMs: number = 60_000): NextResponse | null {
  const ip = req.ip || req.headers.get('x-forwarded-for') || 'anonymous';
  const now = Date.now();
  const key = `rate:${ip}`;

  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (record.count >= maxRequests) {
    const resetIn = Math.ceil((record.resetAt - now) / 1000);
    logger.warn('Rate limit exceeded', { ip, resetIn });
    return NextResponse.json(
      { error: `Trop de requêtes. Réessayez dans ${resetIn} secondes.` },
      { status: 429, headers: { 'Retry-After': String(resetIn) } }
    );
  }

  record.count += 1;
  return null;
}

export async function getAuthenticatedUser(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (session?.user) {
      return {
        id: session.user.id,
        email: session.user.email!,
        role: session.user.role as Role,
        name: session.user.name,
      };
    }

    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length).trim();
      const verified = verifyInjectToken(token);
      if (verified?.sub) {
        const prisma = getPrismaClient();
        const user = await prisma.user.findUnique({
          where: { id: verified.sub },
          select: { id: true, email: true, role: true, name: true },
        });
        if (user) {
          // Normalize role to lowercase to match RBAC_MATRIX keys
          const normalizedRole = (user.role as string).toLowerCase();
          const role: Role = (normalizedRole in RBAC_MATRIX ? normalizedRole : "rondier") as Role;
          console.log('[AUTH-GUARD][Bearer] User found', {
            id: user.id, email: user.email, dbRole: user.role, normalizedRole: role,
          });
          return {
            id: user.id,
            email: user.email,
            role,
            name: user.name,
          };
        }
      }
    }

    logger.warn('Unauthenticated request', { url: req.url, ip: req.ip });
    throw new Error("Unauthorized");
  } catch (error) {
    logger.warn('Auth failed', { url: req.url, ip: req.ip, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

export async function requirePermission(
  req: NextRequest,
  requiredPermission: Permission
) {
  try {
    const user = await getAuthenticatedUser(req);
    const userPermissions = RBAC_MATRIX[user.role] || [];

    const hasAccess = userPermissions.includes(requiredPermission);

    if (!hasAccess) {
      logger.warn('Permission denied', { userId: user.id, role: user.role, permission: requiredPermission });
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Permission denied" },
          { status: 403 }
        )
      };
    }

    return { authorized: true, user };
  } catch (error) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    };
  }
}

export function withAuth<TContext extends Record<string, any> = { user: { id: string; email: string; role: Role; name?: string | null } }>(
  handler: (req: NextRequest, context: TContext) => Promise<NextResponse>,
  requiredPermission?: Permission
) {
  return async function(req: NextRequest, ...args: any[]) {
    const rateLimitResponse = checkRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    try {
      const user = await getAuthenticatedUser(req);

      if (requiredPermission) {
        const userPermissions = RBAC_MATRIX[user.role] || [];
        const hasAccess = userPermissions.includes(requiredPermission) ||
                          userPermissions.includes(`${requiredPermission.split(':')[0]}:*` as Permission);

        if (!hasAccess) {
          logger.warn('Permission denied in withAuth', { userId: user.id, role: user.role, permission: requiredPermission });
          return NextResponse.json(
            { error: "Permission denied" },
            { status: 403 }
          );
        }
      }

      logger.debug('Request authorized', { userId: user.id, role: user.role, url: req.url });
      return handler(req, { user, ...(args[0] || {}) } as TContext);
    } catch (error) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
  };
}

// Legacy exports for backward compatibility
export function hasPermission(userRole: string, permission: Permission): boolean {
  const permissions = RBAC_MATRIX[userRole as keyof typeof RBAC_MATRIX] || [];

  if (permissions.includes(permission)) return true;

  const [resource] = permission.split(":");
  const wildcard = `${resource}:*` as Permission;
  if (permissions.includes(wildcard)) return true;

  return false;
}

export function hasAnyPermission(userRole: string, perms: Permission[]): boolean {
  return perms.some(p => hasPermission(userRole, p));
}

export function hasAllPermissions(userRole: string, perms: Permission[]): boolean {
  return perms.every(p => hasPermission(userRole, p));
}

export function unauthorizedResponse(message = "Non autorisé") {
  return NextResponse.json(
    { error: message },
    { status: 403 }
  );
}

export function unauthenticatedResponse() {
  return NextResponse.json(
    { error: "Non authentifié" },
    { status: 401 }
  );
}
