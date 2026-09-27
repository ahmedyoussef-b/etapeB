import type { MediaItem } from "./mock-service";

export interface MediaFolder {
  slug: string;
  folderPath: string;
  mainImage: {
    path: string;
    name: string;
    size: number;
    mime: string;
  } | null;
  metadata: {
    path: string;
  } | null;
  category: string;
  item: MediaItem;
}

export function groupMediaByFolder(items: MediaItem[]): MediaFolder[] {
  const folders = new Map<string, MediaFolder>();

  for (const item of items) {
    let folderPath: string | null = null;
    const fileName = item.path ? item.path.split('/').pop() : item.title;

    if (!fileName) continue;

    if (item.path) {
      const idx = item.path.lastIndexOf('/');
      if (idx > 0) {
        folderPath = item.path.substring(0, idx);
      }
    } else if (item.category) {
      folderPath = item.category;
    }

    if (!folderPath) continue;

    if (!folderPath.startsWith('bank/')) continue;

    if (fileName === '.placeholder') continue;

    const isJson = item.mimeType === 'application/json';

    let folder = folders.get(folderPath);
    if (!folder) {
      folder = {
        slug: folderPath.split('/').pop() || folderPath,
        folderPath,
        mainImage: null,
        metadata: null,
        category: item.category || folderPath,
        item,
      };
      folders.set(folderPath, folder);
    }

    if (isJson) {
      folder.metadata = {
        path: item.path || `${folderPath}/${fileName}`,
      };
    } else {
      if (!folder.mainImage) {
        folder.mainImage = {
          path: item.path || item.title,
          name: item.title,
          size: item.size,
          mime: item.mimeType,
        };
        folder.item = item;
      } else if (item.mimeType.startsWith('image/') && !folder.mainImage.mime.startsWith('image/')) {
        folder.mainImage = {
          path: item.path || item.title,
          name: item.title,
          size: item.size,
          mime: item.mimeType,
        };
        folder.item = item;
      }
    }
  }

  return Array.from(folders.values()).filter((f) => f.mainImage !== null);
}
