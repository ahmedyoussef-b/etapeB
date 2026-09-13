// src/app/api/implante/deploy/route.ts
// Déploie le schéma Prisma : generate → migrate → seed
import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient } from '@/lib/services/db';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'node:fs';
import * as nodePath from 'node:path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const schema = body.schema as string;
    const seed = body.seed as string;

    if (!schema || !seed) {
      return NextResponse.json({ success: false, error: 'Schéma et seed requis' }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        const log = (message: string) => {
          send({ type: 'log', message });
        };

        try {
          // 1. Write schema.prisma
          log('📝 Écriture de prisma/schema.prisma...');
          const schemaPath = nodePath.join(process.cwd(), 'prisma', 'schema.prisma');
          await fs.writeFile(schemaPath, schema, 'utf-8');
          log('✅ schema.prisma écrit');

          // 2. Write seed file
          log('📝 Écriture de prisma/seed-from-repertoire.ts...');
          const seedPath = nodePath.join(process.cwd(), 'prisma', 'seed-from-repertoire.ts');
          await fs.writeFile(seedPath, seed, 'utf-8');
          log('✅ seed-from-repertoire.ts écrit');

          // 3. prisma generate
          log('🔧 Exécution de prisma generate...');
          try {
            const { stdout: genStdout } = await execAsync('npx prisma generate', {
              cwd: process.cwd(),
              maxBuffer: 10 * 1024 * 1024,
            });
            log(genStdout || 'prisma generate terminé');
          } catch (e) {
            log(`⚠️ prisma generate: ${e instanceof Error ? e.message : String(e)}`);
          }

          // 4. prisma migrate deploy
          log('🗄️ Exécution de prisma migrate deploy...');
          try {
            const { stdout: migrateStdout } = await execAsync('npx prisma migrate deploy', {
              cwd: process.cwd(),
              maxBuffer: 10 * 1024 * 1024,
            });
            log(migrateStdout || 'prisma migrate deploy terminé');
          } catch (e) {
            log(`⚠️ prisma migrate deploy: ${e instanceof Error ? e.message : String(e)}`);
          }

          // 5. Seed
          log('🌱 Exécution du seed...');
          try {
            const prisma = getPrismaClient();

            // Dynamic import of the generated seed file
            const seedModule = await import('../../../../../prisma/seed-from-repertoire');
            if (typeof seedModule.syncFromRepertoire === 'function') {
              await seedModule.syncFromRepertoire(prisma);
              log('✅ Seed exécuté avec succès');
            } else {
              log('⚠️ Fonction syncFromRepertoire introuvable dans le seed');
            }
          } catch (e) {
            log(`⚠️ Seed: ${e instanceof Error ? e.message : String(e)}`);
          }

          log('🎉 Déploiement terminé');
          send({ type: 'done', success: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Erreur inconnue';
          log(`❌ Erreur: ${message}`);
          send({ type: 'done', success: false, error: message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}
