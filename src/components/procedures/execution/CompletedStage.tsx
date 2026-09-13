"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { TProcedure } from "@/lib/procedures/services/validator.service";
import { ProcedureExecutionContext, CapturedMedia } from "@/lib/procedures/types";
import { proceduresFR } from "@/lib/i18n/procedures";
import { CheckCircle2, Clock, FileText, AlertTriangle, XCircle, Camera, Video, Mic, Hand, Download, Eye, MapPin, Check } from "lucide-react";

interface CompletedStageProps {
  procedure: TProcedure;
  context: ProcedureExecutionContext;
  onClose: () => void;
}

const mediaTypeConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  photo: { icon: <Camera className="h-3.5 w-3.5" />, label: "Photo", color: "text-blue-500" },
  video: { icon: <Video className="h-3.5 w-3.5" />, label: "Vidéo", color: "text-green-500" },
  audio: { icon: <Mic className="h-3.5 w-3.5" />, label: "Audio", color: "text-amber-500" },
  signature: { icon: <Hand className="h-3.5 w-3.5" />, label: "Signature", color: "text-purple-500" },
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins} min ${secs} s`;
}

export function CompletedStage({ procedure, context, onClose }: CompletedStageProps) {
  const totalDuration = context.finishedAt
    ? Math.round((context.finishedAt - context.startedAt) / 1000)
    : Math.round((Date.now() - context.startedAt) / 1000);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border bg-card/50">
        <h2 className="text-base font-semibold text-foreground">
          {proceduresFR.guide.completed.title}
        </h2>
      </div>

      <ScrollArea className="flex-1 p-4 sm:p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <Card className="p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {procedure.metadata.title || "Procédure sans titre"}
                </h3>
                <p className="text-xs text-muted-foreground font-mono">
                  {procedure.metadata.code}
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {proceduresFR.guide.completed.duration}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatDuration(totalDuration)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {proceduresFR.guide.completed.completedSteps}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {context.completedSteps.size} / {procedure.steps.length}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Code</p>
                  <p className="text-sm font-semibold text-foreground font-mono">
                    {procedure.metadata.code}
                  </p>
                </div>
              </div>
            </div>

            {context.anomalies.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    {proceduresFR.guide.completed.anomalies}
                  </p>
                  <ul className="space-y-1.5">
                    {context.anomalies.map((anomaly, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-foreground"
                      >
                        <XCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                        {anomaly}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {(context.capturedMedia?.length ?? 0) > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    Médias capturés ({context.capturedMedia.length})
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {context.capturedMedia.map((media: CapturedMedia) => {
                      const config = mediaTypeConfig[media.type];
                      return (
                        <Card key={media.id} className="p-3 relative">
                          <div className="flex items-start justify-between">
                            <Badge variant="secondary" className={config.color}>
                              {config.icon} {config.label}
                            </Badge>
                            {media.uploaded && (
                              <Badge variant="outline" className="text-[10px] text-green-600 border-green-300">
                                <Check className="h-2.5 w-2.5 mr-1" />
                                Uploadé
                              </Badge>
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-center">
                            {media.type === "photo" || media.type === "signature" ? (
                              <img
                                src={media.dataUrl}
                                alt={media.name}
                                className="max-h-32 max-w-full rounded object-cover"
                              />
                            ) : media.type === "video" ? (
                              <video src={media.dataUrl} controls className="max-h-32 max-w-full rounded" />
                            ) : media.type === "audio" ? (
                              <audio src={media.dataUrl} controls className="w-full" />
                            ) : null}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
                            <span className="truncate">{media.name}</span>
                            <span>{(media.size / 1024).toFixed(1)} KB</span>
                          </div>
                          {media.geolocation && (
                            <div className="mt-1 text-[10px] text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-2.5 w-2.5" />
                              {media.geolocation.latitude.toFixed(4)}, {media.geolocation.longitude.toFixed(4)}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={onClose} className="gap-1.5">
                {proceduresFR.guide.completed.closeButton}
              </Button>
            </div>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
