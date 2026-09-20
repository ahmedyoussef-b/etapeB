"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Camera, Video, Mic, Hand, Trash2, Check, X, Paperclip, Image, FileVideo, FileAudio, FileSignature } from "lucide-react";
import { proceduresFR } from "@/lib/i18n/procedures";
import { MediaCapture } from "@/components/procedures/execution/MediaCapture";
import { useCreationMedia, CreationMediaItem } from "@/lib/procedures/hooks/useCreationMedia";

interface MediaCaptureFormProps {
  procedureCode: string;
  stepId: string;
  stepOrder: number;
  mediaRequirements: Array<{
    type: "photo" | "video" | "audio" | "signature";
    mandatory: boolean;
    options?: { geolocation?: boolean; timestamp?: boolean };
  }>;
  onMediaChange?: (media: CreationMediaItem[]) => void;
}

const mediaTypeConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  photo: { icon: <Image className="h-4 w-4" />, label: "Photo", color: "text-blue-500" },
  video: { icon: <FileVideo className="h-4 w-4" />, label: "Vidéo", color: "text-green-500" },
  audio: { icon: <FileAudio className="h-4 w-4" />, label: "Audio", color: "text-amber-500" },
  signature: { icon: <FileSignature className="h-4 w-4" />, label: "Signature", color: "text-purple-500" },
};

export function MediaCaptureForm({
  procedureCode,
  stepId,
  stepOrder,
  mediaRequirements,
  onMediaChange,
}: MediaCaptureFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { media, addMedia, removeMedia, getMediaByStep, uploadAll } = useCreationMedia({
    procedureCode,
    autoUpload: true,
  });

  const stepMedia = getMediaByStep(stepId);

  const handleMediaCaptured = useCallback((item: CreationMediaItem) => {
    addMedia(item);
  }, [addMedia]);

  const handleMediaRemoved = useCallback((mediaId: string) => {
    removeMedia(mediaId);
  }, [removeMedia]);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      uploadAll();
      onMediaChange?.(stepMedia);
    }
  }, [uploadAll, onMediaChange, stepMedia]);

  if (mediaRequirements.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5" />
          {proceduresFR.media.title}
        </Label>
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger
            render={
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Camera className="h-3.5 w-3.5" />
                Capturer des médias
              </Button>
            }
          />
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Capture de médias — Étape {stepOrder + 1}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <MediaCapture
                stepId={stepId}
                stepOrder={stepOrder}
                procedureId={procedureCode}
                procedureCode={procedureCode}
                mediaRequirements={mediaRequirements}
                onMediaCaptured={handleMediaCaptured as any}
                onMediaRemoved={handleMediaRemoved}
                existingMedia={stepMedia as any}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {stepMedia.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {stepMedia.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <div className="relative">
                {item.type === "photo" || item.type === "signature" ? (
                  <img
                    src={item.base64}
                    alt={item.name}
                    className="h-24 w-full object-cover"
                  />
                ) : item.type === "video" ? (
                  <video src={item.base64} className="h-24 w-full object-cover" />
                ) : item.type === "audio" ? (
                  <audio src={item.base64} className="w-full h-8" />
                ) : null}
                <Badge
                  variant="secondary"
                  className={`absolute top-1 left-1 text-[10px] gap-1 ${mediaTypeConfig[item.type]?.color}`}
                >
                  {mediaTypeConfig[item.type]?.icon}
                  {mediaTypeConfig[item.type]?.label}
                </Badge>
                {item.uploaded && (
                  <Badge variant="default" className="absolute top-1 right-1 text-[10px] gap-1">
                    <Check className="h-2.5 w-2.5" />
                    Sauvegardé
                  </Badge>
                )}
                {item.uploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  </div>
                )}
              </div>
              <CardContent className="p-2 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground truncate">{item.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => removeMedia(item.id)}
                  disabled={item.uploading}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}