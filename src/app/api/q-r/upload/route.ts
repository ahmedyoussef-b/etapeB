export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { WebDatabaseAdapter } from '@/lib/database/web-adapter';
import { getAuthenticatedUser, hasPermission, unauthorizedResponse, unauthenticatedResponse } from '@/lib/api/auth-guard';

interface QRManifest {
  createdAt: string;
  versions: Array<{ name: string; date: string; count: number }>;
  lastUpdated: string;
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthenticatedResponse();
  }
  if (!hasPermission(user.role, 'settings:*')) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { items, filename } = body;

    if (!Array.isArray(items)) {
      return NextResponse.json({ success: false, error: 'Données Q/R requises' }, { status: 400 });
    }

    const webUrl = process.env.WEB_API_URL;
    const apiKey = process.env.WEB_API_KEY;
    const databaseUrl = process.env.DATABASE_URL;

    if (!webUrl && !databaseUrl) {
      return NextResponse.json({ success: false, error: 'BDD Web non configurée (DATABASE_URL ou WEB_API_URL requis)' }, { status: 503 });
    }

    const adapter = new WebDatabaseAdapter(webUrl || '', apiKey || '', true, databaseUrl);
    const targetPath = 'registry/items';
    // Ensure filename always has .json extension
    const rawFileName = (filename || 'qa_export.json').trim() || 'qa_export.json';
    const fileName = rawFileName.endsWith('.json') ? rawFileName : `${rawFileName}.json`;
    const baseName = fileName.replace(/\.[^.]+$/, '');
    const extension = fileName.includes('.') ? fileName.split('.').pop()! : '';
    const filePath = `${targetPath}/${fileName}`;
    const dirPath = `${targetPath}/${baseName}`;

    const exactExists = await adapter.exists(filePath).catch(() => false);
    let directoryExists = false;
    let existingFiles: string[] = [];

    try {
      existingFiles = await adapter.list(dirPath);
      directoryExists = Array.isArray(existingFiles) && existingFiles.length > 0;
    } catch {}

    let finalPath = filePath;
    let action: 'uploaded' | 'versioned' = 'uploaded';

    if (exactExists && !directoryExists) {
      // Second upload: flat file exists, no directory yet
      await adapter.mkdir(dirPath);

      const versionedOld = `${dirPath}/${baseName}_v1.${extension}`;
      const oldContent = await adapter.read(filePath);
      await adapter.write(versionedOld, oldContent);
      await adapter.delete(filePath);

      const versionedNew = `${dirPath}/${baseName}_v2.${extension}`;
      const jsonContent = JSON.stringify(items, null, 2);
      await adapter.write(versionedNew, Buffer.from(jsonContent, 'utf-8'));

      finalPath = versionedNew;
      action = 'versioned';
    } else if (directoryExists) {
      const escapedBase = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedExt = extension.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const versionPattern = new RegExp(`^${escapedBase}_v(\\d+)\\.${escapedExt}$`);
      const versions = existingFiles
        .filter(name => versionPattern.test(name))
        .map(name => {
          const match = name.match(versionPattern);
          return match ? parseInt(match[1]) : 0;
        });

      if (exactExists && versions.length === 0) {
        // Edge case: flat file exists AND directory exists (e.g. legacy manifest from old code)
        // Move the flat file to v1 first, then write new as v2
        const versionedOld = `${dirPath}/${baseName}_v1.${extension}`;
        const oldContent = await adapter.read(filePath);
        await adapter.write(versionedOld, oldContent);
        await adapter.delete(filePath);

        const versionedNew = `${dirPath}/${baseName}_v2.${extension}`;
        const jsonContent = JSON.stringify(items, null, 2);
        await adapter.write(versionedNew, Buffer.from(jsonContent, 'utf-8'));

        finalPath = versionedNew;
        action = 'versioned';
      } else {
        const nextVersion = versions.length > 0 ? Math.max(...versions) + 1 : 1;

        const versionedName = `${baseName}_v${nextVersion}.${extension}`;
        const versionedPath = `${dirPath}/${versionedName}`;
        const jsonContent = JSON.stringify(items, null, 2);
        await adapter.write(versionedPath, Buffer.from(jsonContent, 'utf-8'));

        // If a legacy flat file still exists alongside the directory, delete it
        if (exactExists) {
          await adapter.delete(filePath).catch(() => {});
        }

        finalPath = versionedPath;
        action = 'versioned';
      }
    } else {
      // First upload: write flat file only, no manifest directory yet
      const jsonContent = JSON.stringify(items, null, 2);
      await adapter.write(filePath, Buffer.from(jsonContent, 'utf-8'));
    }

    // Only create/update manifest when versioning (not on first upload)
    if (action === 'versioned') {
      let manifest: QRManifest | null = null;
      try {
        manifest = await adapter.readJSON<QRManifest>(`${dirPath}/manifest.json`);
      } catch {}
      manifest = manifest || { createdAt: new Date().toISOString(), versions: [], lastUpdated: new Date().toISOString() };
      manifest.versions.push({ name: finalPath.split('/').pop()!, date: new Date().toISOString(), count: items.length });
      manifest.lastUpdated = new Date().toISOString();
      await adapter.writeJSON(`${dirPath}/manifest.json`, manifest);
    }

    return NextResponse.json({
      success: true,
      action,
      path: finalPath,
      message: action === 'versioned'
        ? `Fichier versionné dans ${finalPath}`
        : 'Fichier envoyé avec succès'
    });
  } catch (error) {
    console.error('[QRUploadAPI]', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
