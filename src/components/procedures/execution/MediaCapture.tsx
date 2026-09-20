"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Camera, Video, Mic, Hand, Upload, Trash2, Check, X, Download, Eye, AlertTriangle } from "lucide-react";
import { proceduresFR } from "@/lib/i18n/procedures";

interface CapturedMediaItem {
  id: string;
  type: "photo" | "video" | "audio" | "signature";
  name: string;
  base64: string;
  mimeType: string;
  size: number;
  timestamp: number;
  geolocation?: { latitude: number; longitude: number } | null;
  previewUrl?: string;
  uploading?: boolean;
  uploaded?: boolean;
  uploadProgress?: number;
  uploadError?: string;
}

interface MediaCaptureProps {
  stepId: string;
  stepOrder: number;
  procedureId: string;
  procedureCode: string;
  mediaRequirements: Array<{
    type: "photo" | "video" | "audio" | "signature";
    mandatory: boolean;
    options?: { geolocation?: boolean; timestamp?: boolean };
  }>;
  onMediaCaptured: (media: CapturedMediaItem) => void;
  onMediaRemoved: (mediaId: string) => void;
  existingMedia?: CapturedMediaItem[];
}

const mediaTypeConfig: Record<string, { icon: React.ReactNode; label: string; accept: string; color: string; maxSize: number }> = {
  photo: { icon: <Camera className="h-4 w-4" />, label: "Photo", accept: "image/*", color: "text-blue-500", maxSize: 10 * 1024 * 1024 },
  video: { icon: <Video className="h-4 w-4" />, label: "Vidéo", accept: "video/*", color: "text-green-500", maxSize: 50 * 1024 * 1024 },
  audio: { icon: <Mic className="h-4 w-4" />, label: "Audio", accept: "audio/*", color: "text-amber-500", maxSize: 20 * 1024 * 1024 },
  signature: { icon: <Hand className="h-4 w-4" />, label: "Signature", accept: "image/*", color: "text-purple-500", maxSize: 2 * 1024 * 1024 },
};

export function MediaCapture({
  stepId,
  stepOrder,
  procedureId,
  procedureCode,
  mediaRequirements,
  onMediaCaptured,
  onMediaRemoved,
  existingMedia = [],
}: MediaCaptureProps) {
  const [capturedMedia, setCapturedMedia] = useState<CapturedMediaItem[]>(existingMedia);
  const [isCapturing, setIsCapturing] = useState<"photo" | "video" | "audio" | "signature" | null>(null);
  const [showFileInput, setShowFileInput] = useState<"photo" | "video" | "audio" | "signature" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [signaturePoints, setSignaturePoints] = useState<{ x: number; y: number }[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);

  // Cleanup MediaStream on unmount or when isCapturing changes
  useEffect(() => {
    return () => {
      stopMediaStream();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const uploadMedia = useCallback(
    async (mediaItem: CapturedMediaItem, retryCount = 0) => {
      // Upload is now handled by useProcedureExecution.saveCapturedMedia()
      // which uses the new procedure-media.service.ts (Document table).
      // This function is kept for backward compatibility but does nothing
      // — the hook will upload on procedure completion.
      setCapturedMedia((prev) =>
        prev.map((m) => (m.id === mediaItem.id ? { ...m, uploading: false, uploaded: false } : m))
      );
    },
    []
  );

  const handleCapture = useCallback(
    (mediaItem: CapturedMediaItem) => {
      setCapturedMedia((prev) => [...prev, mediaItem]);
      onMediaCaptured(mediaItem);
      uploadMedia(mediaItem);
    },
    [onMediaCaptured, uploadMedia]
  );

  const handleRemove = useCallback(
    (mediaId: string) => {
      setCapturedMedia((prev) => prev.filter((m) => m.id !== mediaId));
      onMediaRemoved(mediaId);
    },
    [onMediaRemoved]
  );

  const handleFileSelect = useCallback(
    (type: "photo" | "video" | "audio" | "signature", file: File) => {
      const maxSize = mediaTypeConfig[type].maxSize;
      if (file.size > maxSize) {
        alert(`Fichier trop volumineux. Taille maximum : ${(maxSize / 1024 / 1024).toFixed(0)} MB`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const mediaItem: CapturedMediaItem = {
          id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          type,
          name: file.name,
          base64,
          mimeType: file.type,
          size: file.size,
          timestamp: Date.now(),
        };
        handleCapture(mediaItem);
      };
      reader.readAsDataURL(file);
    },
    [handleCapture]
  );

  const openFileInput = useCallback((type: "photo" | "video" | "audio" | "signature") => {
    setShowFileInput(type);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, type: "photo" | "video" | "audio" | "signature") => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(type, file);
      }
      setShowFileInput(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [handleFileSelect]
  );

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCapturing("photo");
    } catch (error) {
      console.error("[MediaCapture] Camera error:", error);
      alert("Impossible d'accéder à la caméra");
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const base64 = canvas.toDataURL("image/jpeg", 0.8);
      const mediaItem: CapturedMediaItem = {
        id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        type: "photo",
        name: `photo_${Date.now()}.jpg`,
        base64,
        mimeType: "image/jpeg",
        size: Math.round(base64.length * 0.75),
        timestamp: Date.now(),
        geolocation: pendingGeolocationRef.current,
      };
      pendingGeolocationRef.current = null;
      handleCapture(mediaItem);
    }
    stopMediaStream();
    setIsCapturing(null);
  }, [handleCapture]);

  const startVideoRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: "video/webm" });
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "video/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          const mediaItem: CapturedMediaItem = {
            id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            type: "video",
            name: `video_${Date.now()}.webm`,
            base64,
            mimeType: "video/webm",
            size: blob.size,
            timestamp: Date.now(),
            geolocation: pendingGeolocationRef.current,
          };
          pendingGeolocationRef.current = null;
          handleCapture(mediaItem);
        };
        reader.readAsDataURL(blob);
        audioChunksRef.current = [];
      };
      mediaRecorderRef.current.start();
      setIsCapturing("video");
    } catch (error) {
      console.error("[MediaCapture] Video recording error:", error);
      alert("Impossible d'accéder à la caméra/microphone");
    }
  }, [handleCapture]);

  const stopVideoRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    stopMediaStream();
    setIsCapturing(null);
  }, []);

  const startAudioRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          const mediaItem: CapturedMediaItem = {
            id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            type: "audio",
            name: `audio_${Date.now()}.webm`,
            base64,
            mimeType: "audio/webm",
            size: blob.size,
            timestamp: Date.now(),
            geolocation: pendingGeolocationRef.current,
          };
          pendingGeolocationRef.current = null;
          handleCapture(mediaItem);
        };
        reader.readAsDataURL(blob);
        audioChunksRef.current = [];
      };
      mediaRecorderRef.current.start();
      setIsCapturing("audio");
    } catch (error) {
      console.error("[MediaCapture] Audio recording error:", error);
      alert("Impossible d'accéder au microphone");
    }
  }, [handleCapture]);

  const stopAudioRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    stopMediaStream();
    setIsCapturing(null);
  }, []);

  const stopMediaStream = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startSignature = useCallback(() => {
    setIsCapturing("signature");
    setSignaturePoints([]);
    setCurrentStroke([]);
  }, []);

  const handleSignatureMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentStroke([{ x, y }]);
  }, []);

  const handleSignatureMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentStroke.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentStroke((prev) => [...prev, { x, y }]);
  }, [currentStroke.length]);

  const handleSignatureMouseUp = useCallback(() => {
    if (currentStroke.length > 0) {
      setSignaturePoints((prev) => [...prev, currentStroke]);
      setCurrentStroke([]);
    }
  }, [currentStroke]);

  const getTouchPoint = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0] || e.changedTouches[0];
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  };

  const handleSignatureTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const point = getTouchPoint(e);
    setCurrentStroke([point]);
  }, []);

  const handleSignatureTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (currentStroke.length === 0) return;
    const point = getTouchPoint(e);
    setCurrentStroke((prev) => [...prev, point]);
  }, [currentStroke.length]);

  const handleSignatureTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (currentStroke.length > 0) {
      setSignaturePoints((prev) => [...prev, currentStroke]);
      setCurrentStroke([]);
    }
  }, [currentStroke]);

  const captureSignature = useCallback(() => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    [...signaturePoints, currentStroke].forEach((stroke) => {
      if (stroke.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    });
    const base64 = canvas.toDataURL("image/png");
    const mediaItem: CapturedMediaItem = {
      id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: "signature",
      name: `signature_${Date.now()}.png`,
      base64,
      mimeType: "image/png",
      size: Math.round(base64.length * 0.75),
      timestamp: Date.now(),
      geolocation: pendingGeolocationRef.current,
    };
    pendingGeolocationRef.current = null;
    handleCapture(mediaItem);
    setIsCapturing(null);
    setSignaturePoints([]);
    setCurrentStroke([]);
  }, [signaturePoints, currentStroke, handleCapture]);

  const clearSignature = useCallback(() => {
    setSignaturePoints([]);
    setCurrentStroke([]);
  }, []);

  const mandatoryTypes = mediaRequirements.filter((m) => m.mandatory).map((m) => m.type);
  const capturedTypes = capturedMedia.map((m) => m.type);
  const missingMandatory = mandatoryTypes.filter((t) => !capturedTypes.includes(t));

  const getGeolocation = useCallback((): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 5000 }
      );
    });
  }, []);

  const handleCaptureWithGeo = useCallback(
    async (type: "photo" | "video" | "audio" | "signature", startCaptureFn: () => void) => {
      const requirement = mediaRequirements.find((m) => m.type === type);
      let geo: { latitude: number; longitude: number } | null = null;
      if (requirement?.options?.geolocation) {
        geo = await getGeolocation();
      }
      pendingGeolocationRef.current = geo;
      startCaptureFn();
    },
    [mediaRequirements, getGeolocation]
  );

  const pendingGeolocationRef = useRef<{ latitude: number; longitude: number } | null>(null);

  const startCameraWithGeo = useCallback(() => {
    handleCaptureWithGeo("photo", startCamera);
  }, [handleCaptureWithGeo]);

  const startVideoRecordingWithGeo = useCallback(() => {
    handleCaptureWithGeo("video", startVideoRecording);
  }, [handleCaptureWithGeo]);

  const startAudioRecordingWithGeo = useCallback(() => {
    handleCaptureWithGeo("audio", startAudioRecording);
  }, [handleCaptureWithGeo]);

  const startSignatureWithGeo = useCallback(() => {
    handleCaptureWithGeo("signature", startSignature);
  }, [handleCaptureWithGeo]);

  return (
    <div className="space-y-4">
      {missingMandatory.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Médias obligatoires manquants : {missingMandatory.join(", ")}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {mediaRequirements.map((req) => {
          const config = mediaTypeConfig[req.type];
          const captured = capturedMedia.find((m) => m.type === req.type);
          const isMandatory = req.mandatory;
          const isUploading = captured?.uploading;
          const isUploaded = captured?.uploaded;

          return (
            <div key={req.type} className="relative">
              {isCapturing === req.type ? (
                <div className="flex items-center gap-2 rounded-lg border border-primary bg-primary/5 p-3">
                  <span className="text-sm font-medium">Capture {config.label} en cours...</span>
                  <Button variant="outline" size="sm" onClick={() => setIsCapturing(null)}>
                    <X className="h-3.5 w-3.5" />
                    Annuler
                  </Button>
                </div>
              ) : captured ? (
                <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/5 p-2">
                  <Badge variant="secondary" className={config.color}>
                    {config.icon}
                    {config.label}
                    {isUploading && <span className="ml-1 animate-spin">⟳</span>}
                    {isUploaded && <Check className="h-3 w-3 ml-1" />}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleRemove(captured.id)}
                    disabled={isUploading}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant={isMandatory ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    switch (req.type) {
                      case "photo": startCameraWithGeo(); break;
                      case "video": startVideoRecordingWithGeo(); break;
                      case "audio": startAudioRecordingWithGeo(); break;
                      case "signature": startSignatureWithGeo(); break;
                    }
                  }}
                >
                  {config.icon}
                  {config.label}
                  {isMandatory && <span className="text-xs text-destructive">*</span>}
                </Button>
              )}

              {showFileInput === req.type && (
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={config.accept}
                  onChange={(e) => handleFileInputChange(e, req.type)}
                  className="hidden"
                  onBlur={() => setShowFileInput(null)}
                  autoFocus
                />
              )}

              {(isCapturing === "photo" || isCapturing === "video") && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
                  <div className="relative bg-card p-4 rounded-lg max-w-2xl w-full mx-4">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full max-h-[60vh] rounded-lg"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="flex items-center justify-between mt-4 gap-2">
                      {isCapturing === "photo" && (
                        <>
                          <Button variant="outline" onClick={() => setIsCapturing(null)}>
                            <X className="h-4 w-4 mr-2" />
                            Annuler
                          </Button>
                          <Button onClick={capturePhoto} className="ml-auto">
                            <Camera className="h-4 w-4 mr-2" />
                            Capturer
                          </Button>
                        </>
                      )}
                      {isCapturing === "video" && (
                        <>
                          <Button variant="outline" onClick={stopVideoRecording}>
                            <X className="h-4 w-4 mr-2" />
                            Arrêter
                          </Button>
                          <span className="text-sm text-muted-foreground">Enregistrement en cours...</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {isCapturing === "audio" && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
                  <div className="bg-card p-6 rounded-lg text-center">
                    <Mic className="h-12 w-12 text-red-500 mx-auto mb-4 animate-pulse" />
                    <p className="text-lg font-medium">Enregistrement audio en cours...</p>
                    <p className="text-sm text-muted-foreground mt-1">Parlez maintenant</p>
                    <Button variant="destructive" onClick={stopAudioRecording} className="mt-4">
                      <X className="h-4 w-4 mr-2" />
                      Arrêter l'enregistrement
                    </Button>
                  </div>
                </div>
              )}

              {isCapturing === "signature" && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
                  <div className="bg-card p-4 rounded-lg max-w-xl w-full mx-4">
                    <div className="mb-4">
                      <label className="text-sm font-medium text-muted-foreground block mb-2">
                        Signez ci-dessous
                      </label>
                      <canvas
                        ref={signatureCanvasRef}
                        width={600}
                        height={300}
                        className="w-full border border-border rounded-lg bg-white touch-none"
                        onMouseDown={handleSignatureMouseDown}
                        onMouseMove={handleSignatureMouseMove}
                        onMouseUp={handleSignatureMouseUp}
                        onMouseLeave={handleSignatureMouseUp}
                        onTouchStart={handleSignatureTouchStart}
                        onTouchMove={handleSignatureTouchMove}
                        onTouchEnd={handleSignatureTouchEnd}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Button variant="outline" onClick={clearSignature}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Effacer
                      </Button>
                      <Button variant="outline" onClick={() => setIsCapturing(null)}>
                        <X className="h-4 w-4 mr-2" />
                        Annuler
                      </Button>
                      <Button onClick={captureSignature} className="ml-auto" disabled={signaturePoints.length === 0 && currentStroke.length === 0}>
                        <Check className="h-4 w-4 mr-2" />
                        Valider la signature
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {capturedMedia.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">Médias capturés</Label>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {capturedMedia.map((media) => {
              const config = mediaTypeConfig[media.type];
              const previewUrl = media.previewUrl || media.base64;
              return (
                <Card key={media.id} className="p-3 relative">
                  <div className="flex items-start justify-between">
                    <Badge variant="secondary" className={config.color}>
                      {config.icon} {config.label}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleRemove(media.id)}
                      disabled={media.uploading}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="mt-2 flex items-center justify-center">
                    {media.type === "photo" || media.type === "signature" ? (
                      <img
                        src={previewUrl}
                        alt={media.name}
                        className="max-h-32 max-w-full rounded object-cover cursor-pointer"
                      />
                    ) : media.type === "video" ? (
                      <video src={previewUrl} controls className="max-h-32 max-w-full rounded" />
                    ) : media.type === "audio" ? (
                      <audio src={previewUrl} controls className="w-full" />
                    ) : null}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
                    <span>{media.name}</span>
                    <span>{(media.size / 1024).toFixed(1)} KB</span>
                  </div>
                  {media.uploading && (
                    <>
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
                      </div>
                      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${media.uploadProgress || 0}%` }}
                        />
                      </div>
                    </>
                  )}
                  {media.uploaded && (
                    <div className="absolute inset-0 bg-green-500/10 flex items-center justify-center rounded-lg">
                      <Check className="h-6 w-6 text-green-500" />
                    </div>
                  )}
                  {media.uploadError && (
                    <div className="mt-2 p-2 text-xs text-destructive bg-destructive/10 rounded">
                      Erreur: {media.uploadError}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}