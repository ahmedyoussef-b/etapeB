export const runtime = 'nodejs';
// src/app/api/implante/generate/route.ts
// Génère le contenu de schema.prisma et seed-from-repertoire.ts depuis les modèles inférés
import { NextRequest, NextResponse } from 'next/server';

interface InferredModel {
  name: string;
  tableName: string;
  fields: { name: string; type: string; isId?: boolean; isUnique?: boolean; isIndex?: boolean }[];
  relations: { from: string; to: string; type: string; field?: string }[];
}

function generateSchema(models: InferredModel[]): string {
  const lines: string[] = [];

  lines.push('generator client {');
  lines.push('  provider = "prisma-client-js"');
  lines.push('}');
  lines.push('');
  lines.push('datasource db {');
  lines.push('  provider = "postgresql"');
  lines.push('}');
  lines.push('');

  // Enum SyncState
  lines.push('enum SyncState {');
  lines.push('  local_only');
  lines.push('  synced');
  lines.push('  pending');
  lines.push('  conflict');
  lines.push('}');
  lines.push('');

  for (const model of models) {
    lines.push(`model ${model.name} {`);

    for (const field of model.fields) {
      let fieldLine = `  ${field.name} ${field.type}`;

      if (field.isId) {
        fieldLine += ' @id @default(cuid())';
      } else if (field.name === 'createdAt') {
        fieldLine += ' @default(now())';
      } else if (field.name === 'updatedAt') {
        fieldLine += ' @updatedAt';
      }

      if (field.isUnique && !field.isId) {
        fieldLine += ' @unique';
      }
      if (field.isIndex && !field.isId) {
        fieldLine += ' @index';
      }

      lines.push(fieldLine);
    }

    // Relations
    const relationNames = new Set<string>();
    for (const rel of model.relations) {
      const relKey = `${rel.from}-${rel.to}-${rel.type}`;
      if (relationNames.has(relKey)) continue;
      relationNames.add(relKey);

      if (rel.type === '1-N') {
        const pluralName = `${rel.to.toLowerCase()}s`;
        lines.push(`  ${pluralName} ${rel.to}[]`);
      } else if (rel.type === 'N-1' && rel.field) {
        const lowerTo = rel.to.charAt(0).toLowerCase() + rel.to.slice(1);
        lines.push(`  ${lowerTo} ${rel.to} @relation(fields: [${rel.field}], references: [id])`);
      }
    }

    lines.push('');
    lines.push(`  @@map("${model.tableName}")`);
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}

function generateSeed(models: InferredModel[]): string {
  const lines: string[] = [];

  lines.push("// Auto-generated seed from repository analysis");
  lines.push("import 'dotenv/config';");
  lines.push("import { PrismaClient } from '@prisma/client';");
  lines.push("import { promises as fs } from 'node:fs';");
  lines.push("import * as nodePath from 'node:path';");
  lines.push('');

  for (const model of models) {
    lines.push(`async function sync${model.name}(root: any, prisma: PrismaClient) {`);
    lines.push(`  console.log('📦 Synchronisation des ${model.tableName}...');`);
    lines.push('');
    lines.push(`  const dir = root.children?.find((c: any) => c.name === '${model.tableName}' || c.name === '${model.name}');`);
    lines.push('  if (!dir || !dir.children) {');
    lines.push('    console.log(`   Aucun ${model.tableName} trouvé`);');
    lines.push('    return;');
    lines.push('  }');
    lines.push('');
    lines.push(`  for (const entry of dir.children.filter((c: any) => c.type === 'file' && c.name.endsWith('.json'))) {`);
    lines.push('    try {');
    lines.push('      const content = JSON.parse(entry.content || "{}");');
    lines.push(`      await prisma.${model.name.toLowerCase()}.upsert({`);
    lines.push('        where: { id: content.id || entry.name },');
    lines.push('        create: content,');
    lines.push('        update: content,');
    lines.push('      });');
    lines.push('    } catch (e) {');
    lines.push('      console.error(`   Erreur sur ${entry.name}:`, e);');
    lines.push('    }');
    lines.push('  }');
  lines.push('}');
  lines.push('');
  }

  lines.push('export async function syncFromRepertoire(prisma: PrismaClient) {');
  lines.push('  console.log("Synchronisation BDD depuis .data/...\\n");');
  lines.push('  // TODO: load repertoire data');
  lines.push('  const root = { children: [] };');
  lines.push('');

  for (const model of models) {
    lines.push(`  await sync${model.name}(root, prisma);`);
    lines.push('  console.log("");');
  }

  lines.push('  const stats = {');
  for (const model of models) {
    lines.push(`    ${model.name.toLowerCase()}: await prisma.${model.name.toLowerCase()}.count(),`);
  }
  lines.push('  };');

  lines.push('');
  lines.push('  console.log("📊 Statistiques finales:", stats);');
  lines.push('  console.log("\\n🎉 Synchronisation terminée avec succès !");');
  lines.push('}');

  return lines.join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const models = body.models as InferredModel[];

    if (!models || !Array.isArray(models) || models.length === 0) {
      return NextResponse.json({ success: false, error: 'Modèles requis' }, { status: 400 });
    }

    const schema = generateSchema(models);
    const seed = generateSeed(models);

    return NextResponse.json({
      success: true,
      schema,
      seed,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}
