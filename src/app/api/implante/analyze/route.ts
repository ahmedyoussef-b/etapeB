// src/app/api/implante/analyze/route.ts
// Analyse un répertoire et infère un schéma Prisma
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import * as nodePath from 'node:path';

interface InferredField {
  name: string;
  type: string;
  isId?: boolean;
  isUnique?: boolean;
  isIndex?: boolean;
}

interface InferredRelation {
  from: string;
  to: string;
  type: string;
  field?: string;
}

interface InferredModel {
  name: string;
  tableName: string;
  fields: InferredField[];
  relations: InferredRelation[];
}

function detectType(value: unknown): string {
  if (typeof value === 'string') {
    if (value.match(/^\d{4}-\d{2}-\d{2}/)) return 'DateTime';
    if (value === 'true' || value === 'false') return 'Boolean';
    return 'String';
  }
  if (typeof value === 'number') return 'Int';
  if (typeof value === 'boolean') return 'Boolean';
  if (Array.isArray(value)) return 'Json';
  if (value && typeof value === 'object') return 'Json';
  return 'String';
}

function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''))
    .replace(/^(.)/, (char) => char.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '');
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

async function analyzeDirectory(dirPath: string): Promise<InferredModel[]> {
  const models: InferredModel[] = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const dirFullPath = nodePath.join(dirPath, entry.name);
    const modelName = toPascalCase(entry.name);
    const tableName = entry.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

    const fields: InferredField[] = [];
    const relations: InferredRelation[] = [];
    const seenFieldNames = new Set<string>();

    // Add default fields
    fields.push({ name: 'id', type: 'String', isId: true });
    fields.push({ name: 'createdAt', type: 'DateTime' });
    fields.push({ name: 'updatedAt', type: 'DateTime' });

    // Read all files in the directory
    const files = await fs.readdir(dirFullPath);
    for (const file of files) {
      const filePath = nodePath.join(dirFullPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) continue;

      const ext = nodePath.extname(file).toLowerCase();
      if (ext === '.meta.json') continue;

      try {
        if (ext === '.json') {
          const content = await fs.readFile(filePath, 'utf-8');
          const data = JSON.parse(content);

          if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
            for (const [key, value] of Object.entries(data)) {
              const fieldName = toCamelCase(key);
              if (seenFieldNames.has(fieldName)) continue;
              seenFieldNames.add(fieldName);

              if (fieldName === 'id' || fieldName === 'createdAt' || fieldName === 'updatedAt') continue;

              const type = detectType(value);
              fields.push({ name: fieldName, type });

              // Detect relations
              if (typeof value === 'string' && value.includes('/') && !value.match(/^\d{4}/)) {
                const parts = value.split('/');
                if (parts.length >= 2) {
                  relations.push({
                    from: modelName,
                    to: toPascalCase(parts[0]),
                    type: 'N-1',
                    field: fieldName,
                  });
                }
              }
            }
          }
        }
      } catch {
        // Ignore unreadable files
      }
    }

    // Detect parent-child relations from directory structure
    const subDirs = entries.filter(e => e.isDirectory());
    if (subDirs.length > 0) {
      relations.push({
        from: modelName,
        to: toPascalCase(subDirs[0].name),
        type: '1-N',
      });
    }

    models.push({
      name: modelName,
      tableName,
      fields,
      relations,
    });
  }

  return models;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const repository = body.repository as string;

    if (!repository) {
      return NextResponse.json({ success: false, error: 'Répertoire requis' }, { status: 400 });
    }

    let dirPath: string;
    if (repository === '.data') {
      dirPath = nodePath.join(process.cwd(), '.data');
    } else {
      dirPath = nodePath.join(process.cwd(), 'repositories', repository);
    }

    const stat = await fs.stat(dirPath).catch(() => null);
    if (!stat || !stat.isDirectory()) {
      return NextResponse.json({ success: false, error: 'Répertoire introuvable' }, { status: 404 });
    }

    const models = await analyzeDirectory(dirPath);

    return NextResponse.json({
      success: true,
      models,
      repository,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}
