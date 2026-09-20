'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, File, X, Loader2, CheckCircle, AlertCircle, FileJson, FileSpreadsheet, FileText } from 'lucide-react';

interface UploadResult {
  imported: number;
  failed: number;
  warnings: number;
  total: number;
  details: {
    title: string;
    status: 'success' | 'warning' | 'error';
    message: string;
  }[];
}

export function FileUploadZone() {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState('Production');
  const [priority, setPriority] = useState('Moyenne');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles = droppedFiles.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ['json', 'csv', 'xlsx', 'xls', 'pdf'].includes(ext || '');
    });

    if (validFiles.length !== droppedFiles.length) {
      setError('Certains fichiers ne sont pas supportés (JSON, CSV, Excel, PDF)');
    }

    setFiles(prev => [...prev, ...validFiles]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...selectedFiles]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      files.forEach(file => formData.append('file', file));
      formData.append('category', category);
      formData.append('priority', priority);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Erreur lors de l\'upload');
        return;
      }

      setResult(data.result);
      setFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsUploading(false);
    }
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'json': return <FileJson className="w-5 h-5 text-blue-500" />;
      case 'csv': return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
      case 'xlsx':
      case 'xls': return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
      case 'pdf': return <FileText className="w-5 h-5 text-red-500" />;
      default: return <File className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusIcon = (status: 'success' | 'warning' | 'error') => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Upload className="w-5 h-5" />
        📤 Upload de Fichiers
      </h2>

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".json,.csv,.xlsx,.xls,.pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600">
          {isDragging ? (
            '📥 Déposez vos fichiers ici'
          ) : (
            <>
              Glissez-déposez vos fichiers ici, ou cliquez pour sélectionner
              <br />
              <span className="text-sm text-gray-400">
                JSON, CSV, Excel, PDF (max 50MB)
              </span>
            </>
          )}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Catégorie par défaut</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full p-2 border rounded-lg"
          >
            <option value="Production">Production</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Sécurité">Sécurité</option>
            <option value="Qualité">Qualité</option>
            <option value="Logistique">Logistique</option>
            <option value="Environnement">Environnement</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Priorité par défaut</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full p-2 border rounded-lg"
          >
            <option value="Basse">Basse</option>
            <option value="Moyenne">Moyenne</option>
            <option value="Haute">Haute</option>
            <option value="Critique">Critique</option>
          </select>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="font-medium">Fichiers sélectionnés ({files.length})</h3>
          {files.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <div className="flex items-center gap-2">
                {getFileIcon(file.name)}
                <span className="text-sm">{file.name}</span>
                <span className="text-xs text-gray-400">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="text-red-500 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <button
          onClick={handleUpload}
          disabled={isUploading}
          className="mt-4 w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Upload en cours...
            </>
          ) : (
            '🚀 Uploader les fichiers'
          )}
        </button>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">❌ Erreur</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
          <div className="flex items-center gap-4 mb-4">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <div>
              <p className="font-medium">Upload terminé</p>
              <p className="text-sm text-gray-600">
                {result.imported} importées · {result.failed} échouées · {result.warnings} avertissements
              </p>
            </div>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {result.details.map((item, index) => (
              <div
                key={index}
                className={`flex items-center gap-2 p-2 rounded text-sm
                  ${item.status === 'success' ? 'bg-green-50' :
                    item.status === 'warning' ? 'bg-yellow-50' :
                    'bg-red-50'}`}
              >
                {getStatusIcon(item.status)}
                <span className="flex-1 truncate">{item.title}</span>
                <span className="text-xs text-gray-400">{item.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium mb-1">📋 Formats supportés:</h4>
        <div className="flex flex-wrap gap-2 text-xs text-gray-600">
          <span className="px-2 py-1 bg-blue-100 rounded flex items-center gap-1">
            <FileJson className="w-3 h-3" /> JSON
          </span>
          <span className="px-2 py-1 bg-green-100 rounded flex items-center gap-1">
            <FileSpreadsheet className="w-3 h-3" /> CSV
          </span>
          <span className="px-2 py-1 bg-green-200 rounded flex items-center gap-1">
            <FileSpreadsheet className="w-3 h-3" /> Excel
          </span>
          <span className="px-2 py-1 bg-red-100 rounded flex items-center gap-1">
            <FileText className="w-3 h-3" /> PDF
          </span>
        </div>
      </div>
    </div>
  );
}
