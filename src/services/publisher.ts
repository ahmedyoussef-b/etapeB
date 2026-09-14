export interface PublishFile {
  path: string;
  content?: string;      // Base64
  textContent?: string;  // Texte brut
  hash: string;
  size: number;
  version: string;
}

export interface PublishResult {
  success: boolean;
  version: string;
  fileCount: number;
  error?: string;
}

export async function publishToCloud(files: PublishFile[]): Promise<PublishResult> {
  try {
    const response = await fetch('https://etape-b.vercel.app/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ files }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        version: '',
        fileCount: 0,
        error: errorData.error || `HTTP ${response.status}`,
      };
    }
    
    const data = await response.json();
    return {
      success: true,
      version: data.version,
      fileCount: data.fileCount,
    };
  } catch (error) {
    return {
      success: false,
      version: '',
      fileCount: 0,
      error: (error as Error).message,
    };
  }
}
