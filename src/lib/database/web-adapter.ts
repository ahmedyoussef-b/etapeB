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
        if (url) {
          console.log('[WebDatabaseAdapter] Prisma enabled with URL:', url.replace(/\/\/.*@/, '//***@'));
        }
      } catch (error) {
        console.warn('⚠️ PrismaAdapter non disponible, fallback vers HTTP:', error);
        this.usePrisma = false;
      }
    } else {
      console.log('[WebDatabaseAdapter] HTTP mode (usePrisma=false)');
    }
  }

  private async request<T = any>(
    method: 'GET' | 'POST' | 'DELETE' | 'HEAD' | 'PUT',
    endpoint: string,
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}/api/data/${endpoint}`;
    console.log('[web-adapter] request start', { method, endpoint, url, usePrisma: this.usePrisma });

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
      console.log('[web-adapter] request response', { method, endpoint, status: response.status, ok: response.ok });

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
        console.log('[web-adapter] request no content', { method, endpoint });
        return null as T;
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        console.log('[web-adapter] request json success', { method, endpoint });
        return data;
      }

      const arrayBuffer = await response.arrayBuffer();
      console.log('[web-adapter] request buffer success', { method, endpoint, size: arrayBuffer.byteLength });
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
    console.log('[web-adapter] read', { path, usePrisma: this.usePrisma });
    if (this.usePrisma && this.prismaAdapter) {
      const data = await this.prismaAdapter.read(path);
      console.log('[web-adapter] read prisma success', { path, size: data.length });
      return data;
    }
    const data = await this.request('GET', path) as any;
    if (data instanceof ArrayBuffer) {
      console.log('[web-adapter] read http buffer success', { path, size: data.byteLength });
      return Buffer.from(data);
    }
    const jsonStr = JSON.stringify(data);
    console.log('[web-adapter] read http json success', { path, size: jsonStr.length });
    return Buffer.from(jsonStr);
  }

  async write(path: string, data: Buffer): Promise<void> {
    console.log('[web-adapter] write', { path, size: data.length, usePrisma: this.usePrisma });
    if (this.usePrisma && this.prismaAdapter) {
      return this.prismaAdapter.write(path, data);
    }
    await this.request('POST', path, data.toString('base64'));
  }

  async mkdir(path: string): Promise<void> {
    console.log('[web-adapter] mkdir', { path, usePrisma: this.usePrisma });
    if (this.usePrisma && this.prismaAdapter) {
      return this.prismaAdapter.mkdir(path);
    }
    console.log('[web-adapter] mkdir via HTTP', { path });
    await this.request('POST', `directory/${path}`);
    console.log('[web-adapter] mkdir via HTTP success', { path });
  }

  async exists(path: string): Promise<boolean> {
    console.log('[web-adapter] exists', { path, usePrisma: this.usePrisma });
    if (this.usePrisma && this.prismaAdapter) {
      const result = await this.prismaAdapter.exists(path);
      console.log('[web-adapter] exists prisma result', { path, exists: result });
      return result;
    }
    try {
      await this.request('HEAD', path);
      console.log('[web-adapter] exists http result', { path, exists: true });
      return true;
    } catch {
      console.log('[web-adapter] exists http result', { path, exists: false });
      return false;
    }
  }

  async list(path: string): Promise<string[]> {
    console.log('[web-adapter] list', { path, usePrisma: this.usePrisma });
    if (this.usePrisma && this.prismaAdapter) {
      const result = await this.prismaAdapter.list(path);
      console.log('[web-adapter] list prisma result', { path, count: result.length });
      return result;
    }
    const result = await this.request('GET', `list/${path}`);
    console.log('[web-adapter] list http result', { path, count: Array.isArray(result) ? result.length : 'n/a' });
    return result;
  }

  async delete(path: string): Promise<void> {
    console.log('[web-adapter] delete', { path, usePrisma: this.usePrisma });
    if (this.usePrisma && this.prismaAdapter) {
      return this.prismaAdapter.delete(path);
    }
    console.log('[web-adapter] delete via HTTP', { path });
    await this.request('DELETE', path);
    console.log('[web-adapter] delete via HTTP success', { path });
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    console.log('[web-adapter] rename', { oldPath, newPath, usePrisma: this.usePrisma });
    if (this.usePrisma && this.prismaAdapter) {
      return this.prismaAdapter.rename(oldPath, newPath);
    }
    console.log('[web-adapter] rename via HTTP', { oldPath, newPath });
    await this.request('PUT', `rename/${oldPath}`, { newPath });
    console.log('[web-adapter] rename via HTTP success', { oldPath, newPath });
  }

  async readText(path: string): Promise<string> {
    console.log('[web-adapter] readText', { path, usePrisma: this.usePrisma });
    if (this.usePrisma && this.prismaAdapter) {
      const result = await this.prismaAdapter.readText(path);
      console.log('[web-adapter] readText prisma success', { path, size: result.length });
      return result;
    }
    const buffer = await this.read(path);
    const text = buffer.toString('utf-8');
    console.log('[web-adapter] readText success', { path, size: text.length });
    return text;
  }

  async writeText(path: string, content: string): Promise<void> {
    console.log('[web-adapter] writeText', { path, size: content.length, usePrisma: this.usePrisma });
    if (this.usePrisma && this.prismaAdapter) {
      return this.prismaAdapter.writeText(path, content);
    }
    await this.write(path, Buffer.from(content, 'utf-8'));
  }

  async readJSON<T = any>(path: string): Promise<T | null> {
    console.log('[web-adapter] readJSON', { path, usePrisma: this.usePrisma });
    if (this.usePrisma && this.prismaAdapter) {
      const result = await this.prismaAdapter.readJSON(path);
      console.log('[web-adapter] readJSON prisma result', { path, found: result !== null });
      return result;
    }
    try {
      const content = await this.readText(path);
      const data = JSON.parse(content);
      console.log('[web-adapter] readJSON success', { path });
      return data;
    } catch (error: any) {
      if (error.code === 'HTTP_404' || error.code === 'NOT_FOUND') {
        console.log('[web-adapter] readJSON not found', { path });
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
