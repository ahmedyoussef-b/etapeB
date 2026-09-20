export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { LocalDatabaseAdapter } from '@/lib/database/local-adapter';
import { WebDatabaseAdapter } from '@/lib/database/web-adapter';
import { withAuth } from '@/lib/api/auth-guard';
import { WORKING_REPOSITORY_NAME } from '@/lib/config/repository';

function mapWebPathToAdapter(path: string): string {
  if (path === '.data' || path === '.data/') return '.';
  if (path.startsWith('.data/')) return path.slice(6);
  return path;
}

function mapAdapterPathToWeb(path: string): string {
  if (path === '.' || path === '') return '.data';
  return `.data/${path}`;
}

export const POST = withAuth(async (request: NextRequest) => {
  // En production Vercel, le FS est read-only : refuser l'upload local
  if (process.env.VERCEL === '1') {
    return NextResponse.json(
      { error: 'Cette fonctionnalité est désactivée en production (FS read-only).' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { file, targetPath, source, repository } = body;

    if (!file || !targetPath) {
      return NextResponse.json({ success: false, error: 'Fichier et chemin cible requis' }, { status: 400 });
    }
    if (!file.name || !file.base64) {
      return NextResponse.json({ success: false, error: 'Nom et contenu requis' }, { status: 400 });
    }

    let base64Data = String(file.base64);
    const commaIdx = base64Data.indexOf('base64,');
    if (base64Data.startsWith('data:') && commaIdx >= 0) {
      base64Data = base64Data.slice(commaIdx + 'base64,'.length);
    }
    const buffer = Buffer.from(base64Data, 'base64');
    const fileName = String(file.name);
    const adapterTargetPath = source === 'web' ? mapWebPathToAdapter(targetPath) : targetPath;
    const filePath = `${adapterTargetPath}/${fileName}`;
    const baseName = fileName.replace(/\.[^.]+$/, '');
    const extension = fileName.includes('.') ? fileName.split('.').pop()! : '';
    const directoryCollisionPath = `${adapterTargetPath}/${baseName}`;

    let adapter: LocalDatabaseAdapter | WebDatabaseAdapter;
    if (source === 'web') {
      const webUrl = process.env.WEB_API_URL;
      const apiKey = process.env.WEB_API_KEY;
      const databaseUrl = process.env.DATABASE_URL;
      if (!webUrl && !databaseUrl) {
        return NextResponse.json({ success: false, error: 'BDD Web non configurée (DATABASE_URL ou WEB_API_URL requis)' }, { status: 503 });
      }
      adapter = new WebDatabaseAdapter(webUrl || '', apiKey || '', true, databaseUrl);
    } else {
      const activeRepo = repository || WORKING_REPOSITORY_NAME;
      adapter = new LocalDatabaseAdapter(activeRepo);
    }

    const exactExists = await adapter.exists(filePath).catch(() => false);
    let directoryCollision = false;
    try {
      const entries = await adapter.list(directoryCollisionPath);
      directoryCollision = Array.isArray(entries) && entries.length > 0;
    } catch {
      directoryCollision = false;
    }

    let action: 'uploaded' | 'deduplicated' = 'uploaded';
    let finalPath = filePath;

    if (exactExists || directoryCollision) {
      const dedupFolder = `${adapterTargetPath}/${baseName}_duplicates`;

      await adapter.mkdir(dedupFolder);

      let existingNames: string[] = [];
      try { existingNames = await adapter.list(dedupFolder); } catch {}

      const existingVersions = existingNames.filter(n => n.startsWith(`${baseName}_v`));
      const versionCount = existingVersions.length + 1;
      const versionedName = `${baseName}_v${versionCount}.${extension}`;
      const versionedPath = `${dedupFolder}/${versionedName}`;

      await adapter.write(versionedPath, buffer);

      const manifestPath = `${dedupFolder}/manifest.json`;
      let manifest: any = null;
      try { manifest = await adapter.readJSON<any>(manifestPath); } catch {}
      manifest = manifest || { originalName: fileName, createdAt: new Date().toISOString(), versions: [] };
      manifest.versions.push({ name: versionedName, source, date: new Date().toISOString() });
      manifest.lastUpdated = new Date().toISOString();
      await adapter.writeJSON(manifestPath, manifest);

      action = 'deduplicated';
      finalPath = versionedPath;
    } else {
      await adapter.mkdir(adapterTargetPath);
      await adapter.write(filePath, buffer);
    }

    return NextResponse.json({
      success: true,
      action,
      path: source === 'web' ? mapAdapterPathToWeb(finalPath) : finalPath,
      message: action === 'deduplicated'
        ? `Fichier dédupliqué dans ${finalPath}`
        : 'Fichier uploadé avec succès'
    });
  } catch (error) {
    console.error('[UploadAPI]', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}, 'settings:*');