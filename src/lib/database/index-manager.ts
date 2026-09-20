import { StorageAdapter } from './storage-adapter';
import { PathResolver } from './path-resolver';

export interface IndexEntry {
  id: string;
  [key: string]: any;
}

export interface IndexData {
  items: IndexEntry[];
  lastUpdated: string;
  total: number;
}

export class IndexManager {
  constructor(private adapter: StorageAdapter) {}

  async getIndex(type: string): Promise<IndexData> {
    const path = PathResolver.resolveIndex(type);

    try {
      const data = await this.adapter.readJSON<IndexData>(path);
      return data || { items: [], lastUpdated: new Date().toISOString(), total: 0 };
    } catch {
      return { items: [], lastUpdated: new Date().toISOString(), total: 0 };
    }
  }

  async updateIndex(type: string, entry: IndexEntry): Promise<void> {
    const index = await this.getIndex(type);

    const existingIndex = index.items.findIndex(item => item.id === entry.id);
    if (existingIndex >= 0) {
      index.items[existingIndex] = { ...index.items[existingIndex], ...entry };
    } else {
      index.items.push(entry);
    }

    index.lastUpdated = new Date().toISOString();
    index.total = index.items.length;

    const path = PathResolver.resolveIndex(type);
    await this.adapter.writeJSON(path, index);
  }

  async removeFromIndex(type: string, id: string): Promise<void> {
    const index = await this.getIndex(type);
    index.items = index.items.filter(item => item.id !== id);
    index.lastUpdated = new Date().toISOString();
    index.total = index.items.length;

    const path = PathResolver.resolveIndex(type);
    await this.adapter.writeJSON(path, index);
  }

  async searchIndex(
    type: string,
    query: (item: IndexEntry) => boolean
  ): Promise<IndexEntry[]> {
    const index = await this.getIndex(type);
    return index.items.filter(query);
  }

  async rebuildIndex(
    type: string,
    items: IndexEntry[]
  ): Promise<void> {
    const index: IndexData = {
      items,
      lastUpdated: new Date().toISOString(),
      total: items.length
    };

    const path = PathResolver.resolveIndex(type);
    await this.adapter.writeJSON(path, index);
  }

  async getIndexStats(type: string): Promise<{ total: number; lastUpdated: string }> {
    const index = await this.getIndex(type);
    return {
      total: index.total,
      lastUpdated: index.lastUpdated
    };
  }
}
