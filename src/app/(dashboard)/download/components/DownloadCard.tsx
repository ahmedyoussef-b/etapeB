import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, CheckCircle2, Clock } from "lucide-react";
import { Installer, formatSize } from "../download-data";

interface DownloadCardProps {
  installer: Installer;
  isRecommended: boolean;
  onDownload: (installer: Installer) => void;
}

export function DownloadCard({ installer, isRecommended, onDownload }: DownloadCardProps) {
  const isReady = installer.size > 0 && installer.sha256;

  return (
    <Card
      className={`flex flex-col h-full transition-all duration-200 ${
        isRecommended
          ? "border-2 border-primary shadow-lg scale-[1.02]"
          : "border border-border hover:shadow-md"
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            {installer.label}
          </CardTitle>
          {isRecommended && (
            <Badge variant="default" className="text-xs">
              Recommandé
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="secondary" className="text-xs font-mono">
            v{installer.version}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {installer.format}
          </Badge>
        </div>
      </CardHeader>

      <Separator className="mb-3" />

      <CardContent className="flex-1 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Taille</span>
          <span className="font-mono font-medium">
            {isReady ? formatSize(installer.size) : <Clock className="h-4 w-4 inline" />}
          </span>
        </div>

        {isReady && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">SHA-256</span>
              <CheckCircle2 className="h-3 w-3 text-green-500" />
            </div>
            <code className="block text-xs break-all bg-muted rounded px-2 py-1 font-mono">
              {installer.sha256}
            </code>
          </div>
        )}

        {!isReady && (
          <p className="text-sm text-muted-foreground italic">
            En cours de publication
          </p>
        )}
      </CardContent>

      <CardFooter className="mt-auto pt-3">
        <Button
          className="w-full"
          variant={isRecommended ? "default" : "outline"}
          disabled={!isReady}
          onClick={() => onDownload(installer)}
        >
          <Download className="h-4 w-4 mr-2" />
          {isReady ? "Télécharger" : "Bientôt disponible"}
        </Button>
      </CardFooter>
    </Card>
  );
}