import { StorageAdapter, StorageError } from './storage-adapter';
import { PrismaAdapter } from './prisma-adapter';
import { resolveDatabaseUrl } from './connection-manager';

export class WebDatabaseAdapter implements StorageAdapter {
  private prismaAdapter: PrismaAdapter | null = null;
  private baseUrl: string;
  private apiKey: string;
  public usePrisma: boolean;

  constructor(baseUrl: string, apiKey: string, usePrisma: boolean = true, databaseUrl?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.usePrisma = false;
    
    if (usePrisma) {
      try {
        const url = resolveDatabaseUrl(databaseUrl);
        this.prismaAdapter = new PrismaAdapter(url);
        this.usePrisma = true;
      } catch (error) {
        console.warn('⚠️ PrismaAdapter non disponible, fallback vers HTTP:', error);
        this.usePrisma = false;
      }
    }
  }

  private async request<T = any>(
    method: 'GET' | 'POST' | 'DELETE' | 'HEAD' | 'PUT',
    endpoint: string,
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}/api/data/${endpoint}`;

    const headers: HeadersInit = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Accept': 'application/json'
    };

    if (method !== 'HEAD' && method !== 'GET') {
      headers['Content-Type'] = 'application/json';
    }

    const options: RequestInit = {
      method,
      headers
    };

    if (body && method !== 'HEAD' && method !== 'GET') {
      options.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ 
          message: response.statusText 
        }));
        console.error('[web-adapter] request error response', { method, endpoint, status: response.status, error: error.message });
        throw new StorageError(
          `HTTP_${response.status}`,
          error.message || `Erreur HTTP ${response.status}`,
          endpoint
        );
      }

      if (method === 'HEAD' || response.status === 204) {
        return null as T;
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        return data;
      }

      const arrayBuffer = await response.arrayBuffer();
      return arrayBuffer as T;

    } catch (error: any) {
      if (error instanceof StorageError) throw error;
      console.error('[web-adapter] request network error', { method, endpoint, error: error.message });
      throw new StorageError(
        'NETWORK_ERROR',
        `Erreur réseau: ${error.message}`,
        endpoint
      );
    }
  }

  async read(path: string): Promise<Buffer> {
    if (this.usePrisma && this.prismaAdapter) {
      const data = await this.prismaAdapter.read(path);
      return data;
    }
    const data = await this.request('GET', path) as any;
    if (data instanceof ArrayBuffer) {
      return Buffer.from(data);
    }
    const jsonStr = JSON.stringify(data);
    return Buffer.from(jsonStr);
  }

  async write(path: string, data: Buffer): Promise<void> {
    if (this.usePrisma && this.prismaAdapter) {
      return this.prismaAdapter.write(path, data);
    }
    await this.request('POST', path, data.toString('base64'));
  }

  async mkdir(path: string): Promise<void> {
    if (this.usePrisma && this.prismaAdapter) {
      return this.prismaAdapter.mkdir(path);
    }
    await this.request('POST', `directory/${path}`);
  }

  async exists(path: string): Promise<boolean> {
    if (this.usePrisma && this.prismaAdapter) {
      const result = await this.prismaAdapter.exists(path);
      return result;
    }
    try {
      await this.request('HEAD', path);
      return true;
    } catch {
      return false;
    }
  }

  async list(path: string): Promise<string[]> {
    if (this.usePrisma && this.prismaAdapter) {
      const result = await this.prismaAdapter.list(path);
      return result;
    }
    const result = await this.request('GET', `list/${path}`);
    return result;
  }

  async delete(path: string): Promise<void> {
    if (this.usePrisma && this.prismaAdapter) {
      return this.prismaAdapter.delete(path);
    }
    await this.request('DELETE', path);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    if (this.usePrisma && this.prismaAdapter) {
      return this.prismaAdapter.rename(oldPath, newPath);
    }
    await this.request('PUT', `rename/${oldPath}`, { newPath });
  }

  async readText(path: string): Promise<string> {
    if (this.usePrisma && this.prismaAdapter) {
      const result = await this.prismaAdapter.readText(path);
      return result;
    }
    const buffer = await this.read(path);
    const text = buffer.toString('utf-8');
    return text;
  }

  async writeText(path: string, content: string): Promise<void> {
    if (this.usePrisma && this.prismaAdapter) {
      return this.prismaAdapter.writeText(path, content);
    }
    await this.write(path, Buffer.from(content, 'utf-8'));
  }

  async readJSON<T = any>(path: string): Promise<T | null> {
    if (this.usePrisma && this.prismaAdapter) {
      const result = await this.prismaAdapter.readJSON<T>(path);
      return result;
    }
    try {
      const content = await this.readText(path);
      const data = JSON.parse(content);
      return data;
    } catch (error: any) {
      if (error.code === 'HTTP_404' || error.code === 'NOT_FOUND') {
        return null;
      }
      console.error('[web-adapter] readJSON error', { path, error: error.message });
      throw error;
    }
  }

  async writeJSON<T = any>(path: string, data: T): Promise<void> {
    if (this.usePrisma && this.prismaAdapter) {
      return this.prismaAdapter.writeJSON(path, data);
    }
    await this.writeText(path, JSON.stringify(data, null, 2));
  }

  async ping(): Promise<boolean> {
    if (this.usePrisma && this.prismaAdapter) {
      try {
        await this.prismaAdapter.getStats();
        return true;
      } catch {
        return false;
      }
    }
    try {
      await this.request('GET', 'ping');
      return true;
    } catch {
      return false;
    }
  }

  async getStats(): Promise<{ files: number; size: number }> {
    if (this.usePrisma && this.prismaAdapter) {
      return this.prismaAdapter.getStats();
    }
    try {
      return await this.request('GET', 'stats');
    } catch {
      return { files: 0, size: 0 };
    }
  }
}
