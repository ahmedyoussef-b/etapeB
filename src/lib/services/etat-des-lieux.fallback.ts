import { getAllReports, createReport, getReportById, updateReport, removeReport } from './etat-des-lieux.service';
import * as localStore from '@/lib/etat-des-lieux/server-store';

export async function safeGetAllReports() {
  try {
    return await getAllReports();
  } catch (error) {
    console.warn('Prisma unavailable for etat-des-lieux, falling back to local storage:', error);
    return localStore.getAll();
  }
}

export async function safeCreateReport(body: Parameters<typeof createReport>[0]) {
  try {
    return await createReport(body);
  } catch (error) {
    console.warn('Prisma unavailable for etat-des-lieux, falling back to local storage:', error);
    return localStore.create(body as Parameters<typeof localStore.create>[0]);
  }
}

export async function safeGetReportById(id: string) {
  try {
    return await getReportById(id);
  } catch (error) {
    console.warn('Prisma unavailable for etat-des-lieux, falling back to local storage:', error);
    return localStore.getById(id);
  }
}

export async function safeUpdateReport(id: string, updates: Parameters<typeof updateReport>[1]) {
  try {
    return await updateReport(id, updates);
  } catch (error) {
    console.warn('Prisma unavailable for etat-des-lieux, falling back to local storage:', error);
    return localStore.update(id, updates as Parameters<typeof localStore.update>[1]);
  }
}

export async function safeRemoveReport(id: string) {
  try {
    return await removeReport(id);
  } catch (error) {
    console.warn('Prisma unavailable for etat-des-lieux, falling back to local storage:', error);
    return localStore.remove(id);
  }
}
