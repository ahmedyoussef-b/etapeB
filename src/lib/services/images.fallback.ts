import { getAllMedia, createMedia, getMediaById, updateMedia, removeMedia, getCategories } from './images.service';
import * as localStore from '@/lib/images/server-store';

export async function safeGetAllMedia() {
  try {
    return await getAllMedia();
  } catch (error) {
    console.warn('Prisma unavailable for images, falling back to local storage:', error);
    const [items, categories] = await Promise.all([localStore.getAll(), localStore.getCategories()]);
    return items;
  }
}

export async function safeCreateMedia(body: Parameters<typeof createMedia>[0]) {
  try {
    return await createMedia(body);
  } catch (error) {
    console.warn('Prisma unavailable for images, falling back to local storage:', error);
    return localStore.create(body as Parameters<typeof localStore.create>[0]);
  }
}

export async function safeGetMediaById(id: string) {
  try {
    return await getMediaById(id);
  } catch (error) {
    console.warn('Prisma unavailable for images, falling back to local storage:', error);
    return localStore.getById(id);
  }
}

export async function safeUpdateMedia(id: string, updates: Parameters<typeof updateMedia>[1]) {
  try {
    return await updateMedia(id, updates);
  } catch (error) {
    console.warn('Prisma unavailable for images, falling back to local storage:', error);
    return localStore.update(id, updates as Parameters<typeof localStore.update>[1]);
  }
}

export async function safeRemoveMedia(id: string) {
  try {
    return await removeMedia(id);
  } catch (error) {
    console.warn('Prisma unavailable for images, falling back to local storage:', error);
    return localStore.remove(id);
  }
}

export async function safeGetCategories() {
  try {
    return await getCategories();
  } catch (error) {
    console.warn('Prisma unavailable for images, falling back to local storage:', error);
    return localStore.getCategories();
  }
}
