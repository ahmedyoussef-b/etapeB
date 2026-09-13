import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getPrismaClient } from "@/lib/services/db";
import { Role, RBAC_MATRIX } from "@/lib/types/rbac";
import { compare } from "bcryptjs";
import logger from "@/lib/logger";

// Guard: warn at startup if NEXTAUTH_SECRET is missing
const authSecret = process.env.NEXTAUTH_SECRET?.trim();
if (!authSecret) {
  console.error(
    '[NextAuth] ⚠️  NEXTAUTH_SECRET is not set! Authentication will fail. ' +
    'Set it in your Vercel dashboard or .env.local file.'
  );
}

const PRISMA_ROLE_TO_APP_ROLE: Record<string, Role> = {
  RONDIER: "rondier",
  CHEF_DE_BLOC: "chef-de-bloc",
  CHEF_DE_QUART: "chef-de-quart",
  ADMIN: "admin",
};

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "NexaFlow",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const rawEmail = (credentials?.email as string | undefined) ?? '';
        const rawPassword = (credentials?.password as string | undefined) ?? '';

        const email = rawEmail.trim().toLowerCase();
        const password = rawPassword;

        if (!email || !password) {
          logger.warn('Auth attempt missing credentials', { email });
          return null;
        }

        let prisma;
        try {
          prisma = getPrismaClient();
        } catch (err) {
          logger.error('Auth failed: database connection unavailable', { 
            error: err instanceof Error ? err.message : String(err) 
          });
          return null;
        }
        const user = await prisma.user.findUnique({
          where: { email },
          include: { block: true },
        });

        if (!user || !user.password) {
          const pendingRequest = await prisma.registrationRequest.findUnique({
            where: { email },
          });

          if (pendingRequest) {
            logger.warn('Auth failed: pending registration request', { email, status: pendingRequest.status });
            if (pendingRequest.status === 'PENDING') {
              return null;
            }
            if (pendingRequest.status === 'REJECTED') {
              return null;
            }
          }

          logger.warn('Auth failed: user not found', { email });
          return null;
        }

        const isPasswordValid = await compare(password, user.password);
        if (!isPasswordValid) {
          logger.warn('Auth failed: invalid password', { email, userId: user.id });
          return null;
        }

        const prismaRole = user.role as string;
        const role = PRISMA_ROLE_TO_APP_ROLE[prismaRole] || "rondier";
        const permissions = RBAC_MATRIX[role] || [];

        logger.info('Auth success', { userId: user.id, email: user.email, role });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role,
          blockId: user.blockId,
          blockName: user.block?.libelle || null,
          permissions,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.blockId = user.blockId;
        token.blockName = user.blockName;
        token.permissions = user.permissions;
        logger.info('JWT callback', { role: token.role, permissionsCount: Array.isArray(token.permissions) ? token.permissions.length : 'n/a' });
      } else if (token.role && PRISMA_ROLE_TO_APP_ROLE[token.role as string]) {
        const normalized = PRISMA_ROLE_TO_APP_ROLE[token.role as string];
        token.role = normalized;
        token.permissions = RBAC_MATRIX[normalized] || [];
        logger.info('JWT callback normalized legacy role', { from: token.role, to: normalized });
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
        session.user.id = token.id;
        session.user.blockId = token.blockId;
        session.user.blockName = token.blockName;
        session.user.permissions = token.permissions;
        logger.info('Session callback', { role: session.user.role, permissionsCount: Array.isArray(session.user.permissions) ? session.user.permissions.length : 'n/a' });
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
  secret: authSecret,
};
