import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Clock, RotateCcw, FileJson, Eye, History } from "lucide-react";
import { proceduresFR } from "@/lib/i18n/procedures";

interface VersionInfo {
  id: string;
  code: string;
  version: number;
  path: string;
  data: any;
  createdAt: Date;
}

interface VersionHistoryDialogProps {
  code: string;
  currentVersion: number;
  onRestore: (version: number) => void;
  onCompare: (v1: number, v2: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VersionHistoryDialog({
  code,
  currentVersion,
  onRestore,
  onCompare,
  open,
  onOpenChange,
}: VersionHistoryDialogProps) {
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<number[]>([]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <DialogTitle>
              {proceduresFR.versions.title} — {code}
            </DialogTitle>
          </div>
          <DialogDescription>
            {proceduresFR.versions.description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <FileJson className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">{proceduresFR.versions.empty}</p>
            </div>
          ) : (
            <ScrollArea className="h-full pr-4">
              <div className="space-y-2">
                {versions.map((v) => (
                  <VersionItem
                    key={v.id}
                    version={v}
                    isCurrent={v.version === currentVersion}
                    selected={selectedVersions.includes(v.version)}
                    onToggleSelect={() => {
                      if (selectedVersions.includes(v.version)) {
                        setSelectedVersions(selectedVersions.filter((x) => x !== v.version));
                      } else if (selectedVersions.length < 2) {
                        setSelectedVersions([...selectedVersions, v.version]);
                      }
                    }}
                    onRestore={() => onRestore(v.version)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {selectedVersions.length === 2 && (
          <div className="flex items-center gap-2 pt-3 border-t">
            <Button size="sm" variant="outline" onClick={() => onCompare(selectedVersions[0], selectedVersions[1])}>
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              {proceduresFR.versions.compare}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedVersions([])}
            >
              {proceduresFR.versions.cancel}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function VersionItem({
  version,
  isCurrent,
  selected,
  onToggleSelect,
  onRestore,
}: {
  version: VersionInfo;
  isCurrent: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onRestore: () => void;
}) {
  const dateStr = new Date(version.createdAt).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-muted/50 ${
        selected ? "border-primary bg-primary/5" : "border-border"
      }`}
      onClick={onToggleSelect}
    >
      <div className="flex flex-col items-center w-12">
        <Badge variant={isCurrent ? "default" : "secondary"} className="text-xs">
          v{version.version}
        </Badge>
        {isCurrent && (
          <span className="text-[10px] text-primary font-medium mt-0.5">actuel</span>
        )}
      </div>
      <Separator orientation="vertical" className="h-10" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {version.data?.metadata?.title || "Sans titre"}
        </p>
        <p className="text-xs text-muted-foreground">{dateStr}</p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          title={proceduresFR.versions.restore}
          onClick={(e) => {
            e.stopPropagation();
            onRestore();
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}