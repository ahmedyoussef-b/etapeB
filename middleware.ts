import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { RBAC_MATRIX, Permission } from "@/lib/types/rbac";

const publicPaths = ["/login", "/auth/error", "/api/auth"];

const routePermissions: Record<string, Permission> = {
  "/admin": "users:manage",
  "/admin/": "users:manage",
  "/admin/*": "users:manage",
  "/equipes": "equipes:view",
  "/equipes/*": "equipes:manage",
  "/procedures/nouvelle": "procedures:create",
  "/procedures/*/editer": "procedures:edit",
  "/rapports/creer": "rapports:create",
  "/parametres": "settings:*",
};

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const { pathname } = request.nextUrl;

  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

  if (isPublicPath) {
    return NextResponse.next();
  }

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = token.role as keyof typeof RBAC_MATRIX;
  const userPermissions = token.permissions || RBAC_MATRIX[role] || [];

  for (const [routePattern, requiredPermission] of Object.entries(routePermissions)) {
    if (matchRoute(pathname, routePattern)) {
      const hasAccess = userPermissions.includes(requiredPermission);

      if (!hasAccess) {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }
      break;
    }
  }

  return NextResponse.next();
}

function matchRoute(pathname: string, pattern: string): boolean {
  if (pattern.endsWith("/*")) {
    const base = pattern.slice(0, -2);
    return pathname === base || pathname.startsWith(base + "/");
  }
  return pathname === pattern;
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/admin",
    "/admin/:path*",
    "/equipes/:path*",
    "/procedures/:path*",
    "/rapports/:path*",
    "/parametres/:path*",
    "/chef-de-quart/:path*",
    "/chef-de-bloc/:path*",
    "/rondier/:path*",
  ],
};
