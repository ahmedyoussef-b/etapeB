'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, Loader2, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { useToastHelpers } from '@/components/notifications/toast-provider';
import { invoke } from '@tauri-apps/api/core';
import { isTauriEnv } from '@/lib/tauri/env';
import { StructureSource } from '@/lib/database/structure-types';

export interface UploadResult {
  success: boolean;
  file: string;
  path: string;
  action: 'uploaded' | 'deduplicated' | 'error';
  message: string;
  targetPath?: string;
}

interface FileUploadButtonProps {
  targetPath: string;
  source: StructureSource;
  onUploadComplete?: (results: UploadResult[]) => void;
  onUploadProgress?: (progress: number) => void;
  className?: string;
  iconSize?: number;
  label?: string;
  accept?: string;
  maxSize?: number;
  multiple?: boolean;
  uploadEnabled?: boolean;
  repository?: string;
}

const toBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
};

export function FileUploadButton({
  targetPath,
  source,
  onUploadComplete,
  onUploadProgress,
  className = '',
  iconSize = 14,
  label,
  accept = '*/*',
  maxSize = 50,
  multiple = true,
  uploadEnabled = true,
  repository
}: FileUploadButtonProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToastHelpers();

  const handleUpload = useCallback(async (files: FileList) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setResults([]);
    setShowResults(false);
    setProgress(0);

    const uploadResults: UploadResult[] = [];
    let completed = 0;

    for (const file of Array.from(files)) {
      try {
        if (file.size > maxSize * 1024 * 1024) {
          uploadResults.push({
            success: false, file: file.name, path: targetPath, action: 'error',
            message: `Fichier trop volumineux (max ${maxSize}MB)`
          });
          continue;
        }

        const buffer = await file.arrayBuffer();
        const base64 = toBase64(buffer);

        let data: any;
        if (isTauriEnv()) {
          const res = await invoke<any>('upload_file', {
            fileName: file.name,
            destinationPath: targetPath || null,
            base64Data: base64,
            repository: repository || null,
          });
          data = res;
        } else {
          const response = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file: { name: file.name, type: file.type, size: file.size, base64 },
              targetPath,
              source,
              repository
            })
          });
          data = await response.json();
        }

        if (data.success) {
          uploadResults.push({
            success: true, file: file.name, path: targetPath,
            action: data.action || 'uploaded',
            message: data.message || 'OK',
            targetPath: data.filePath || data.path
          });
        } else {
          uploadResults.push({
            success: false, file: file.name, path: targetPath, action: 'error',
            message: data.error || data.message || 'Erreur upload'
          });
        }
      } catch (err) {
        uploadResults.push({
          success: false, file: file.name, path: targetPath, action: 'error',
          message: err instanceof Error ? err.message : 'Erreur inconnue'
        });
      }

      completed++;
      const pct = Math.round((completed / files.length) * 100);
      setProgress(pct);
      onUploadProgress?.(pct);
    }

    setResults(uploadResults);
    setIsUploading(false);
    setShowResults(true);

    const ok = uploadResults.filter(r => r.success).length;
    const dedup = uploadResults.filter(r => r.action === 'deduplicated').length;
    const failed = uploadResults.length - ok;
    if (failed > 0) toast.warning(`${failed} échec(s)`, 'Upload partiel');
    else if (dedup > 0) toast.success(`${ok - dedup} uploadé(s), ${dedup} dédupliqué(s)`, 'Upload terminé');
    else toast.success(`${ok} fichier(s) uploadé(s)`);

    if (ok > 0 || dedup > 0) {
      window.dispatchEvent(new CustomEvent('structure-refresh'));
    }

    onUploadComplete?.(uploadResults);
  }, [targetPath, source, maxSize, onUploadProgress, onUploadComplete, toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) handleUpload(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const getStatusIcon = (r: UploadResult) => {
    if (!r.success) return <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />;
    if (r.action === 'deduplicated') return <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />;
    return <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />;
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />

      <button
        onClick={(e) => {
          e.stopPropagation();
          fileInputRef.current?.click();
        }}
        onDrop={(e) => { e.stopPropagation(); handleDrop(e); }}
        onDragOver={(e) => { e.stopPropagation(); handleDragOver(e); }}
        onDragLeave={(e) => { e.stopPropagation(); handleDragLeave(e); }}
        disabled={isUploading || !uploadEnabled}
        title={`Uploader vers ${targetPath}`}
        className={`
          flex items-center gap-1 px-1.5 py-1 rounded transition-all
          ${isDragging ? 'bg-blue-100 border border-blue-400' : 'bg-transparent text-blue-600 hover:bg-blue-50'}
          ${isUploading ? 'cursor-wait opacity-60' : ''}
        `}
      >
        {isUploading ? (
          <>
            <Loader2 style={{ width: iconSize, height: iconSize }} className="animate-spin" />
            <span className="text-[10px] font-medium">{progress}%</span>
          </>
        ) : (
          <>
            <Upload style={{ width: iconSize, height: iconSize }} />
            {label && <span className="text-xs font-medium">{label}</span>}
          </>
        )}
      </button>

      {showResults && results.length > 0 && !isUploading && (
        <div
          className="absolute right-0 top-full mt-1 w-72 bg-white rounded-md shadow-lg border p-2 z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">
              {results.filter(r => r.success).length}/{results.length} OK
            </span>
            <button onClick={() => setShowResults(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs p-1 rounded hover:bg-gray-50">
                {getStatusIcon(r)}
                <span className="flex-1 truncate text-gray-700">{r.file}</span>
                <span className={`text-[10px] px-1 rounded ${
                  !r.success ? 'bg-red-100 text-red-700' :
                  r.action === 'deduplicated' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {!r.success ? 'Échec' : r.action === 'deduplicated' ? 'Dédup' : 'OK'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}