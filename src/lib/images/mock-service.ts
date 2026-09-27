export type MediaKind = "image" | "video";

export interface MediaItem {
  id: string;
  title: string;
  category: string;
  description: string;
  tags: string[];
  kind: MediaKind;
  mimeType: string;
  size: number;
  dataUrl: string;
  thumbnailDataUrl?: string;
  createdAt: string;
  updatedAt: string;
  path?: string;
}

import { invoke } from "@tauri-apps/api/core";
import { isTauriEnv } from "@/lib/tauri/env";

const API_BASE = "/api/images";

function delay(ms = 200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

export const imageService = {
  async init(): Promise<void> {
    await delay(100);
  },

  async getAll(): Promise<MediaItem[]> {
    await delay();
    const data = await fetchJson<{ items: MediaItem[] }>(API_BASE);
    return data.items;
  },

  async getById(id: string): Promise<MediaItem | undefined> {
    await delay();
    const item = await fetchJson<MediaItem>(`${API_BASE}/${id}`);
    return item;
  },

  async create(item: Omit<MediaItem, "id" | "createdAt" | "updatedAt">): Promise<MediaItem> {
    await delay();
    return fetchJson<MediaItem>(API_BASE, {
      method: "POST",
      body: JSON.stringify(item),
    });
  },

  async createFromFile(file: File, overrides?: Partial<MediaItem>): Promise<MediaItem> {
    await delay();

    if (isTauriEnv()) {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Data = window.btoa(binary);

      const result = await invoke<{
        success: boolean;
        slug: string;
        folder: string;
        image_path: string;
        json_path: string;
        message?: string;
      }>("upload_bank_image", {
        fileName: file.name,
        base64Data,
        mimeType: file.type,
        destination: overrides?.category || "bank",
        description: overrides?.description || "",
      });

      if (!result.success) {
        throw new Error(result.message || "Upload Tauri échoué");
      }

      const dataUrl = `data:${file.type};base64,${base64Data}`;

      return {
        id: result.slug,
        title: overrides?.title || file.name.replace(/\.[^/.]+$/, ""),
        category: overrides?.category || "bank",
        description: overrides?.description || "",
        tags: overrides?.tags || [result.slug.replace(/_/g, " ")],
        kind: file.type.startsWith("video/") ? "video" : "image",
        mimeType: file.type,
        size: bytes.byteLength,
        dataUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        path: result.json_path,
      };
    }

    const formData = new FormData();
    formData.append("file", file);
    if (overrides?.title) formData.append("title", overrides.title);
    if (overrides?.category) formData.append("category", overrides.category);
    if (overrides?.description) formData.append("description", overrides.description);
    if (overrides?.tags && overrides.tags.length > 0) formData.append("tags", overrides.tags.join(","));
    if (overrides?.kind) formData.append("kind", overrides.kind);
    if (overrides?.mimeType) formData.append("mimeType", overrides.mimeType);

    const res = await fetch(API_BASE, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(error.error || "Upload failed");
    }

    const data = await res.json();
    return data.item as MediaItem;
  },

  async update(id: string, updates: Partial<Omit<MediaItem, "id" | "createdAt">>): Promise<MediaItem | undefined> {
    await delay();
    return fetchJson<MediaItem>(`${API_BASE}/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  },

  async delete(id: string): Promise<boolean> {
    await delay();
    const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
    return res.ok;
  },

  async getCategories(): Promise<string[]> {
    await delay();
    const data = await fetchJson<{ categories: string[] }>(API_BASE);
    return data.categories;
  },

  async getCount(): Promise<number> {
    await delay();
    const items = await this.getAll();
    return items.length;
  },

  async getTotalSize(): Promise<string> {
    await delay();
    const items = await this.getAll();
    const bytes = items.reduce((acc, item) => acc + item.size, 0);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  },
};