'use client';

import Link from 'next/link';
import type { RagSource } from '@/services/conversation-store';

interface SourceCardProps {
  source: RagSource;
}

function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (ext === 'json') return '📋';
  if (ext === 'md') return '📝';
  if (ext === 'pdf') return '📕';
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return '🖼️';
  return '📄';
}

export function SourceCard({ source }: SourceCardProps) {
  const score = Math.round(source.similarity * 100);
  const href = `/structure-bdd?path=${encodeURIComponent(source.path)}`;
  
  return (
    <Link
      href={href}
      className="block p-3 border rounded-lg hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-start gap-2">
        <span className="text-xl">{getFileIcon(source.filename)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium truncate">
              {source.filename}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              score > 70 ? 'bg-green-100 text-green-700' :
              score > 40 ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {score}%
            </span>
          </div>
          <div className="text-xs text-gray-500 truncate mt-0.5">
            📁 {source.directory || '/'}
          </div>
          <div className="text-xs text-gray-600 mt-2 line-clamp-2">
            {source.chunk.substring(0, 100)}
            {source.chunk.length > 100 ? '...' : ''}
          </div>
        </div>
      </div>
    </Link>
  );
}
