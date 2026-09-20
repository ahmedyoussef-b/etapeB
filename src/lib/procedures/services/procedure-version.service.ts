import { PrismaClient } from '@prisma/client';
import { executeWithDatabaseTimed } from '@/lib/database/connection-manager';
import { TProcedure } from '@/lib/procedures/services/validator.service';
import { Role } from '@prisma/client';

export interface VersionedProcedure {
  id: string;
  code: string;
  version: number;
  path: string;
  data: any;
  createdAt: Date;
}

class ProcedureVersionService {
  private toPrismaRow(procedure: TProcedure, id?: string) {
    const metadata = procedure.metadata;
    const validRoles = new Set(['ADMIN', 'CHEF_DE_QUART', 'CHEF_DE_BLOC', 'RONDIER']);
    const mappedRoles: Role[] = (metadata.requiredRoles || [])
      .map((r: string) => r.toUpperCase().replace(/[-\s]+/g, '_'))
      .filter((r: string) => validRoles.has(r)) as Role[];

    return {
      id: id || `proc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      code: metadata.code,
      title: metadata.title || metadata.code,
      description: metadata.description || null,
      category: metadata.category || 'general',
      priority: metadata.priority || 'moyenne',
      status: 'draft' as const,
      estimatedTimeMinutes: metadata.estimatedTimeMinutes || 1,
      requiredRoles: mappedRoles,
      steps: procedure.steps as any,
      metadata: {
        globalSafetyInstructions: metadata.globalSafetyInstructions || [],
      } as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async getNextVersion(code: string): Promise<number> {
    const { result } = await executeWithDatabaseTimed(async (prisma) => {
      const docs = await prisma.document.findMany({
        where: {
          path: {
            startsWith: `registry/procedures/${code}/`
          }
        },
        select: { path: true }
      });

      let maxVersion = 0;
      for (const doc of docs) {
        const docPath = doc.path;
        if (!docPath) continue;
        const match = docPath.match(/_v(\d+)\.json$/);
        if (match) {
          const v = parseInt(match[1], 10);
          if (v > maxVersion) maxVersion = v;
        }
      }
      return maxVersion + 1;
    });
    return result;
  }

  async saveWithVersion(code: string, procedure: any): Promise<VersionedProcedure> {
    const { result } = await executeWithDatabaseTimed(async (prisma) => {
      const latestPath = `registry/procedures/${code}/procedure.json`;
      const content = JSON.stringify(procedure, null, 2);
      const bytes = Buffer.from(content, 'utf-8');

      // Run the whole versioning operation in a transaction for atomicity
      const version = await prisma.$transaction(async (tx) => {
        // Determine the next version number inside the transaction
        const docs = await tx.document.findMany({
          where: {
            path: {
              startsWith: `registry/procedures/${code}/`
            }
          },
          select: { path: true }
        });

        let maxVersion = 0;
        for (const doc of docs) {
          const docPath = doc.path;
          if (!docPath) continue;
          const match = docPath.match(/_v(\d+)\.json$/);
          if (match) {
            const v = parseInt(match[1], 10);
            if (v > maxVersion) maxVersion = v;
          }
        }
        const nextVersion = maxVersion + 1;
        const versionedPath = `registry/procedures/${code}/${code}_v${nextVersion}.json`;

        // 1. If latestPath exists, move it to versioned path
        const existing = await tx.document.findUnique({
          where: { path: latestPath },
          select: { id: true, data: true }
        });

        if (existing) {
          await tx.document.update({
            where: { id: existing.id },
            data: { path: versionedPath, updatedAt: new Date() }
          });
        }

        // 2. Write the new version to latestPath
        await tx.document.upsert({
          where: { path: latestPath },
          update: {
            data: bytes,
            size: bytes.length,
            filename: 'procedure.json',
            updatedAt: new Date()
          },
          create: {
            path: latestPath,
            filename: 'procedure.json',
            data: bytes,
            size: bytes.length
          }
        });

        // 3. Also upsert in the Procedure table so it shows in the list
        const procRow = this.toPrismaRow(procedure as TProcedure);
        await tx.procedure.upsert({
          where: { code: procedure.metadata.code },
          create: procRow,
          update: {
            title: procRow.title,
            description: procRow.description,
            category: procRow.category,
            priority: procRow.priority,
            status: procRow.status,
            estimatedTimeMinutes: procRow.estimatedTimeMinutes,
            requiredRoles: procRow.requiredRoles,
            steps: procRow.steps,
            metadata: procRow.metadata,
            updatedAt: new Date(),
          }
        });

        return nextVersion;
      }, { timeout: 10000 });

      // 4. Copy media files to versioned path
      // Les médias sont stockés avec path: registry/procedures/{code}/media/...
      // On les copie vers: registry/procedures/{code}/media_v{version}/...
      const mediaDocs = await prisma.document.findMany({
        where: {
          path: {
            startsWith: `registry/procedures/${code}/media/`,
          },
        },
        select: { id: true, path: true, filename: true, mimeType: true, size: true, data: true, metadata: true, createdAt: true, updatedAt: true },
      });

      const versionedMediaBase = `registry/procedures/${code}/media_v${version}`;
      for (const doc of mediaDocs) {
        if (!doc.path) continue;
        const relativePath = doc.path.slice(`registry/procedures/${code}/media/`.length);
        const versionedMediaPath = `${versionedMediaBase}/${relativePath}`;

        await prisma.document.upsert({
          where: { path: versionedMediaPath },
          update: {
            data: doc.data || undefined,
            size: doc.size || undefined,
            filename: doc.filename,
            updatedAt: new Date(),
          },
          create: {
            path: versionedMediaPath,
            filename: doc.filename,
            mimeType: doc.mimeType || undefined,
            data: doc.data || undefined,
            size: doc.size || undefined,
            metadata: doc.metadata || undefined,
            createdAt: doc.createdAt,
            updatedAt: new Date(),
          },
        });
      }

      return {
        id: latestPath,
        code,
        version,
        path: latestPath,
        data: procedure,
        createdAt: new Date()
      };
    });

    return result;
  }

  async getLatest(code: string): Promise<any | null> {
    try {
      const { result } = await executeWithDatabaseTimed(async (prisma) => {
        const doc = await prisma.document.findUnique({
          where: { path: `registry/procedures/${code}/procedure.json` },
          select: { data: true }
        });
        if (doc?.data) {
          return JSON.parse(Buffer.from(doc.data).toString('utf-8'));
        }
        return null;
      });
      return result;
    } catch {
      return null;
    }
  }

  async getVersion(code: string, version: number): Promise<any | null> {
    try {
      const { result } = await executeWithDatabaseTimed(async (prisma) => {
        const doc = await prisma.document.findUnique({
          where: { path: `registry/procedures/${code}/${code}_v${version}.json` },
          select: { data: true }
        });
        if (doc?.data) {
          return JSON.parse(Buffer.from(doc.data).toString('utf-8'));
        }
        return null;
      });
      return result;
    } catch {
      return null;
    }
  }

  async listVersions(code: string): Promise<VersionedProcedure[]> {
    try {
      const { result } = await executeWithDatabaseTimed(async (prisma) => {
        const docs = await prisma.document.findMany({
          where: {
            path: {
              startsWith: `registry/procedures/${code}/`
            }
          },
          select: { path: true, data: true, createdAt: true },
          orderBy: { path: 'desc' }
        });

        const versions: VersionedProcedure[] = [];
        for (const doc of docs) {
          const docPath = doc.path;
          if (!docPath) continue;
          const match = docPath.match(/_v(\d+)\.json$/);
          if (match) {
            versions.push({
              id: docPath,
              code,
              version: parseInt(match[1], 10),
              path: docPath,
              data: doc.data ? JSON.parse(Buffer.from(doc.data).toString('utf-8')) : null,
              createdAt: doc.createdAt
            });
          }
        }
        return versions;
      });
      return result;
    } catch {
      return [];
    }
  }

  async deleteProcedure(code: string): Promise<boolean> {
    try {
      const { result } = await executeWithDatabaseTimed(async (prisma) => {
        const docs = await prisma.document.findMany({
          where: {
            path: {
              startsWith: `registry/procedures/${code}/`
            }
          },
          select: { id: true }
        });

        for (const doc of docs) {
          await prisma.document.delete({ where: { id: doc.id } });
        }
        return true;
      });
      return result;
    } catch {
      return false;
    }
  }
}

export const procedureVersionService = new ProcedureVersionService();