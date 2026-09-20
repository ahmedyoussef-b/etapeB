export const runtime = 'nodejs';
// src/app/api/repository/route.ts
// Gestion du répertoire de travail — copie depuis .data, cible fixe
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, hasPermission, unauthorizedResponse, unauthenticatedResponse } from '@/lib/api/auth-guard';
import { promises as fs } from 'node:fs';
import * as nodePath from 'node:path';
import { WORKING_REPOSITORY_NAME } from '@/lib/config/repository';

async function copyDirectoryRecursive(src: string, dest: string): Promise<{ files: number; dirs: number }> {
  await fs.mkdir(dest, { recursive: true });
  let files = 0;
  let dirs = 0;

  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;

    const srcPath = nodePath.join(src, entry.name);
    const destPath = nodePath.join(dest, entry.name);

    if (entry.isDirectory()) {
      dirs++;
      await copyDirectoryRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
      files++;
    }
  }

  return { files, dirs };
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthenticatedResponse();
  if (!hasPermission(user.role, 'settings:*')) return unauthorizedResponse();

  try {
    return NextResponse.json({
      success: true,
      activeRepository: WORKING_REPOSITORY_NAME,
      repositories: [WORKING_REPOSITORY_NAME],
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthenticatedResponse();
  if (!hasPermission(user.role, 'settings:*')) return unauthorizedResponse();

  try {
    const body = (await request.json()) as { action?: string };
    const { action } = body;

    if (action === 'resetFromData') {
      const cwd = process.cwd();
      const sourceRepo = nodePath.join(cwd, '.data');
      const targetRepo = nodePath.join(cwd, WORKING_REPOSITORY_NAME);

      try {
        await fs.rm(targetRepo, { recursive: true, force: true });
      } catch {}

      const stats = await copyDirectoryRecursive(sourceRepo, targetRepo);

      return NextResponse.json({
        success: true,
        activeRepository: WORKING_REPOSITORY_NAME,
        repositories: [WORKING_REPOSITORY_NAME],
        lastChanged: new Date().toISOString(),
        stats,
      });
    }

    return NextResponse.json({ success: false, error: `Action non reconnue: ${action}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
