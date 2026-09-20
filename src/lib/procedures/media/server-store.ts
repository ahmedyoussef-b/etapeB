import fs from 'fs';
import path from 'path';

const MEDIA_BASE_DIR = path.join(process.cwd(), '.local-db', 'procedures');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getMediaDir(procedureCode: string): string {
  return path.join(MEDIA_BASE_DIR, procedureCode, 'media');
}

function getStepMediaDir(procedureCode: string, stepId: string): string {
  return path.join(getMediaDir(procedureCode), stepId);
}

export interface LocalMediaItem {
  id: string;
  procedureCode: string;
  stepId: string;
  stepOrder: number;
  type: 'photo' | 'video' | 'audio' | 'signature';
  filename: string;
  mimeType: string;
  size: number;
  data: string; // base64
  geolocation?: { latitude: number; longitude: number } | null;
  timestamp: number;
  capturedAt: string;
  uploadedBy?: string;
  metadata?: Record<string, unknown>;
}

export async function saveMediaLocal(
  procedureCode: string,
  stepId: string,
  stepOrder: number,
  media: {
    name: string;
    data: Buffer;
    mimeType: string;
    type: 'photo' | 'video' | 'audio' | 'signature';
    geolocation?: { latitude: number; longitude: number } | null;
    timestamp?: number;
    uploadedBy?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<LocalMediaItem> {
  const stepDir = getStepMediaDir(procedureCode, stepId);
  ensureDir(stepDir);

  const id = `pmedia_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const ext = media.mimeType === 'image/png' ? 'png'
    : media.mimeType === 'image/webp' ? 'webp'
    : media.mimeType === 'image/jpeg' ? 'jpg'
    : media.mimeType === 'video/mp4' ? 'mp4'
    : media.mimeType === 'video/webm' ? 'webm'
    : media.mimeType === 'audio/wav' ? 'wav'
    : media.mimeType === 'audio/mpeg' ? 'mp3'
    : 'bin';

  const filename = `${media.type}_${id.slice(0, 8)}.${ext}`;
  const filePath = path.join(stepDir, filename);
  fs.writeFileSync(filePath, media.data);

  const item: LocalMediaItem = {
    id,
    procedureCode,
    stepId,
    stepOrder,
    type: media.type,
    filename,
    mimeType: media.mimeType,
    size: media.data.length,
    data: media.data.toString('base64'),
    geolocation: media.geolocation || null,
    timestamp: media.timestamp || Date.now(),
    capturedAt: new Date().toISOString(),
    uploadedBy: media.uploadedBy,
    metadata: media.metadata,
  };

  // Write metadata sidecar
  const metaPath = path.join(stepDir, `${filename}.meta.json`);
  fs.writeFileSync(metaPath, JSON.stringify({
    id,
    procedureCode,
    stepId,
    stepOrder,
    type: media.type,
    filename,
    mimeType: media.mimeType,
    size: media.data.length,
    geolocation: media.geolocation,
    timestamp: media.timestamp,
    capturedAt: item.capturedAt,
    uploadedBy: media.uploadedBy,
    metadata: media.metadata,
  }, null, 2), 'utf-8');

  return item;
}

export async function getMediaLocal(procedureCode: string): Promise<LocalMediaItem[]> {
  const mediaDir = getMediaDir(procedureCode);
  if (!fs.existsSync(mediaDir)) return [];

  const items: LocalMediaItem[] = [];
  const walk = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.meta.json')) {
        try {
          const meta = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
          items.push(meta);
        } catch { /* ignore */ }
      }
    }
  };
  walk(mediaDir);
  return items.sort((a, b) => a.timestamp - b.timestamp);
}

export async function getMediaByStepLocal(
  procedureCode: string,
  stepId: string
): Promise<LocalMediaItem[]> {
  const all = await getMediaLocal(procedureCode);
  return all.filter(m => m.stepId === stepId);
}

export async function deleteMediaLocal(procedureCode: string): Promise<number> {
  const mediaDir = getMediaDir(procedureCode);
  if (!fs.existsSync(mediaDir)) return 0;

  let count = 0;
  const walk = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        fs.unlinkSync(fullPath);
        count++;
      }
    }
  };
  walk(mediaDir);
  fs.rmSync(mediaDir, { recursive: true, force: true });
  return count;
}

export async function deleteMediaByStepLocal(
  procedureCode: string,
  stepId: string
): Promise<number> {
  const stepDir = getStepMediaDir(procedureCode, stepId);
  if (!fs.existsSync(stepDir)) return 0;

  let count = 0;
  const entries = fs.readdirSync(stepDir);
  for (const entry of entries) {
    fs.unlinkSync(path.join(stepDir, entry));
    count++;
  }
  fs.rmSync(stepDir, { recursive: true, force: true });
  return count;
}

export async function deleteMediaByIdLocal(id: string): Promise<boolean> {
  const mediaDir = MEDIA_BASE_DIR;
  if (!fs.existsSync(mediaDir)) return false;

  const walk = (dir: string): boolean => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (walk(fullPath)) return true;
      } else if (entry.name.endsWith('.meta.json')) {
        try {
          const meta = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
          if (meta.id === id) {
            // Supprimer le fichier media correspondant
            const mediaFile = fullPath.replace('.meta.json', '');
            if (fs.existsSync(mediaFile)) fs.unlinkSync(mediaFile);
            fs.unlinkSync(fullPath);
            return true;
          }
        } catch { /* ignore */ }
      }
    }
    return false;
  };
  return walk(mediaDir);
}

export async function getMediaCountLocal(procedureCode: string): Promise<number> {
  const items = await getMediaLocal(procedureCode);
  return items.length;
}