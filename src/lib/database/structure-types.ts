export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: TreeNode[];
  metadata?: {
    type?: string;
    id?: string;
    block?: string;
    groupName?: string;
    equipmentCode?: string;
    description?: string;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: any;
  };
}

/**
 * Source de données pour la structure BDD.
 * - 'local' : répertoire de travail local (%APPDATA%\NexaFlow\repository)
 * - 'web'   : BDD cloud (Neon PostgreSQL via API Vercel)
 */
export type StructureSource = "local" | "web" | "vector";

function isVisibleEntry(name: string): boolean {
  if (name === 'mirror_repertoire.json' || name === 'mirror.json') return false;
  if (name === 'system') return false;
  return name.endsWith('.meta.json') || !name.startsWith('.');
}

export async function detectEntryType(
  adapter: { list: (path: string) => Promise<string[]>; read: (path: string) => Promise<Buffer>; readJSON?: (path: string) => Promise<any> },
  fullPath: string
): Promise<'directory' | 'file'> {
  if (!fullPath || fullPath.endsWith('/')) return 'directory';
  if (fullPath.endsWith('.meta.json')) return 'file';

  try {
    const entries = await adapter.list(fullPath);
    if (Array.isArray(entries) && entries.length > 0) return 'directory';
  } catch {}

  if (adapter.readJSON) {
    try {
      const data = await adapter.readJSON(fullPath);
      if (data !== null && data !== undefined && data.type !== 'directory') return 'file';
    } catch {}
  }

  try {
    await adapter.read(fullPath);
    return 'file';
  } catch {
    const name = fullPath.split('/').pop() || '';
    if (/\.(json|jpg|jpeg|png|gif|bmp|svg|webp|pdf|txt|csv|xlsx|docx?|pptx?|zip|tar|gz|7z|mp3|mp4|avi|mov|wav|flac|mkv)$/i.test(name)) {
      return 'file';
    }
    return 'directory';
  }
}

export { isVisibleEntry };
