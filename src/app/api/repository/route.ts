export const runtime = 'nodejs';
// src/app/api/repository/route.ts
// Gestion des répertoires de référence — parcours PC, copie, sélection
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, hasPermission, unauthorizedResponse, unauthenticatedResponse } from '@/lib/api/auth-guard';
import { promises as fs } from 'node:fs';
import * as nodePath from 'node:path';
import { createHash } from 'node:crypto';

const REPOSITORIES_DIR = nodePath.join(process.cwd(), 'repositories');
const CONFIG_FILE = nodePath.join(process.cwd(), 'repository-config.json');

interface RepositoryConfig {
  activeRepository: string;
  repositories: string[];
  lastChanged: string;
}

async function readConfig(): Promise<RepositoryConfig> {
  const defaultConfig: RepositoryConfig = {
    activeRepository: '.data',
    repositories: [],
    lastChanged: new Date().toISOString(),
  };

  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw) as RepositoryConfig;
  } catch {
    // En production Vercel, le FS est read-only : ne pas tenter d'écrire
    if (process.env.VERCEL === '1') {
      return defaultConfig;
    }
    // En local : créer le fichier si absent
    try {
      await fs.mkdir(REPOSITORIES_DIR, { recursive: true });
      await fs.writeFile(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    } catch {
      // Ignore silencieusement si l'écriture échoue
    }
    return defaultConfig;
  }
}

async function writeConfig(config: RepositoryConfig): Promise<void> {
  await fs.mkdir(nodePath.dirname(CONFIG_FILE), { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

async function copyDirectoryRecursive(src: string, dest: string): Promise<{ files: number; dirs: number }> {
  await fs.mkdir(dest, { recursive: true });
  let files = 0;
  let dirs = 0;

  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    // Skip .git and node_modules only
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
    const config = await readConfig();

    // Lister les répertoires déjà copiés
    const existingRepos: string[] = [];
    try {
      const entries = await fs.readdir(REPOSITORIES_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          existingRepos.push(entry.name);
        }
      }
    } catch {}

    const allRepos = Array.from(new Set([...config.repositories, ...existingRepos]));
    const activeRepository = config.activeRepository === '.data' ? '.data' : (config.activeRepository.startsWith('repositories/') ? config.activeRepository : `repositories/${config.activeRepository}`);
    return NextResponse.json({
      success: true,
      activeRepository,
      repositories: allRepos,
      repositoriesDir: 'repositories',
      lastChanged: config.lastChanged
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

interface RepositoryRequestBody {
  action?: string;
  sourcePath?: string;
  targetRepo?: string;
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthenticatedResponse();
  if (!hasPermission(user.role, 'settings:*')) return unauthorizedResponse();

  try {
    const body = (await request.json()) as RepositoryRequestBody;
    const { action, sourcePath } = body;

    if (action === 'select' && sourcePath) {
      // Vérifier que le répertoire source existe
      const absSource = nodePath.resolve(sourcePath);
      try {
        const stat = await fs.stat(absSource);
        if (!stat.isDirectory()) {
          return NextResponse.json({ success: false, error: 'Le chemin n\'est pas un répertoire' }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ success: false, error: `Répertoire introuvable: ${sourcePath}` }, { status: 404 });
      }

      // Créer un nom de dossier unique basé sur le chemin source
      const repoName = nodePath.basename(absSource) || 'repository';
      const destPath = nodePath.join(REPOSITORIES_DIR, repoName);

      // Supprimer l'ancien exemplaire s'il existe
      try {
        await fs.rm(destPath, { recursive: true, force: true });
      } catch {}

      // Copier le répertoire
      const stats = await copyDirectoryRecursive(absSource, destPath);

      // Mettre à jour la config
      const config = await readConfig();
      if (!config.repositories.includes(repoName)) {
        config.repositories.push(repoName);
      }
      config.repositories.sort();
      config.activeRepository = `repositories/${repoName}`;
      config.lastChanged = new Date().toISOString();
      await writeConfig(config);

      return NextResponse.json({
        success: true,
        activeRepository: config.activeRepository,
        sourcePath: absSource,
        copiedTo: destPath,
        stats,
        repositories: config.repositories
      });
    }

    if (action === 'setActive' && sourcePath) {
      const config = await readConfig();
      const normalized = sourcePath.startsWith('repositories/') ? sourcePath : `repositories/${sourcePath}`;
      config.activeRepository = normalized;
      config.lastChanged = new Date().toISOString();
      await writeConfig(config);
      return NextResponse.json({ success: true, ...config });
    }

    if (action === 'resetFromData') {
      const sourceRepo = nodePath.resolve(process.cwd(), '.data');
      const targetName = body.targetRepo || body.sourcePath || 'repository';
      const targetRepo = nodePath.resolve(REPOSITORIES_DIR, nodePath.basename(targetName));

      try {
        await fs.rm(targetRepo, { recursive: true, force: true });
      } catch {}

      const stats = await copyDirectoryRecursive(sourceRepo, targetRepo);

      const config = await readConfig();
      if (!config.repositories.includes(nodePath.basename(targetRepo))) {
        config.repositories.push(nodePath.basename(targetRepo));
      }
      config.activeRepository = nodePath.basename(targetRepo);
      config.lastChanged = new Date().toISOString();
      await writeConfig(config);

      return NextResponse.json({
        success: true,
        activeRepository: config.activeRepository,
        repositories: config.repositories,
        lastChanged: config.lastChanged,
        stats
      });
    }

    return NextResponse.json({ success: false, error: 'Action non reconnue' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}