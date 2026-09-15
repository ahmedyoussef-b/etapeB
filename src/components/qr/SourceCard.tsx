import { FileText, FileCode, FileJson, FileSpreadsheet, FileType2, Image, File } from 'lucide-react';
import type { RagSource } from '../../services/conversation-store';

function getFileIcon(extension: string) {
  switch (extension.toLowerCase()) {
    case '.ts':
    case '.tsx':
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs':
      return FileCode;
    case '.json':
    case '.jsonl':
      return FileJson;
    case '.csv':
    case '.xlsx':
    case '.xls':
      return FileSpreadsheet;
    case '.png':
    case '.jpg':
    case '.jpeg':
    case '.gif':
    case '.svg':
    case '.webp':
      return Image;
    default:
      return File;
  }
}

interface SourceCardProps {
  source: RagSource;
  onClick?: () => void;
}

export default function SourceCard({ source, onClick }: SourceCardProps) {
  const extension = source.filename.includes('.')
    ? '.' + source.filename.split('.').pop()
    : '';
  const Icon = getFileIcon(extension);
  const similarity = Math.round(source.similarity * 100);

  return (
    <div
      className="rounded-lg border border-border bg-background p-3 text-xs space-y-1.5 cursor-pointer hover:border-primary/30 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-mono text-foreground font-medium">
          <Icon className="h-3.5 w-3.5 text-primary" />
          {source.path}
        </span>
        <span className="text-[10px] border border-border rounded px-1.5 py-0.5 bg-muted/40 text-muted-foreground">
          Similarité: {similarity}%
        </span>
      </div>
      <p className="text-muted-foreground line-clamp-2 bg-muted/40 p-2 rounded">
        {source.chunk}
      </p>
    </div>
  );
}
