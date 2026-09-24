"use client";

import { useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToastHelpers } from "@/components/notifications/toast-provider";
import { RefreshCw, ArrowDownToLine, AlertTriangle } from "lucide-react";

interface InjectReport {
  injected: number;
  conflicts: number;
  errors: string[];
  skipped: number;
}

interface InjectFromWebDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function InjectFromWebDialog({ open, onOpenChange, onComplete }: InjectFromWebDialogProps) {
  const [hasCreds, setHasCreds] = useState(false);
  const [vercelUrl, setVercelUrl] = useState("https://etape-b.vercel.app");
  const [isInjecting, setIsInjecting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; path: string } | null>(null);
  const [report, setReport] = useState<InjectReport | null>(null);
  const toast = useToastHelpers();

  const progressRef = useRef(progress);
  const reportRef = useRef(report);

  useEffect(() => {
    if (open) {
      setVercelUrl("https://etape-b.vercel.app");
      setIsInjecting(false);
      setProgress(null);
      setReport(null);
      invoke<boolean>("has_vercel_credentials").then(setHasCreds).catch(() => setHasCreds(false));
    }
  }, [open]);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    reportRef.current = report;
  }, [report]);

  useEffect(() => {
    if (!open) return;

    let unlistenProgress: UnlistenFn | undefined;
    let unlistenComplete: UnlistenFn | undefined;

    const setupListeners = async () => {
      try {
        unlistenProgress = await listen<{ current: number; total: number; path: string }>(
          "inject-progress",
          (event) => {
            setProgress(event.payload);
          }
        );

        unlistenComplete = await listen<InjectReport>(
          "inject-complete",
          (event) => {
            setReport(event.payload);
            setIsInjecting(false);
          }
        );
      } catch (err) {
        console.error("[InjectFromWebDialog] listener setup failed:", err);
      }
    };

    setupListeners();

    return () => {
      if (unlistenProgress) {
        unlistenProgress();
      }
      if (unlistenComplete) {
        unlistenComplete();
      }
    };
  }, [open]);

  const handleInject = async () => {
    if (!vercelUrl.trim()) {
      toast.error("URL Vercel requise", "Injection Web");
      return;
    }

    setIsInjecting(true);
    setProgress(null);
    setReport(null);

    try {
      const result = await invoke<InjectReport>("inject_from_web", {
        vercelUrl: vercelUrl.trim().replace(/\/$/, ""),
      });

      setReport(result);
      setIsInjecting(false);

      if (result.errors.length === 0) {
        toast.success(
          `${result.injected} fichier(s) injecté(s), ${result.conflicts} conflit(s)`,
          "Injection Web"
        );
      } else {
        toast.warning(
          `${result.injected} fichier(s) injecté(s), ${result.errors.length} erreur(s)`,
          "Injection Web"
        );
      }

      onComplete?.();
    } catch (err) {
      setIsInjecting(false);
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Échec de l'injection: ${message}`, "Injection Web");
    }
  };

  const handleClose = () => {
    if (isInjecting) {
      toast.info("Injection en cours, veuillez patienter", "Injection Web");
      return;
    }
    onOpenChange(false);
  };

  const progressText = progress
    ? `${progress.current}/${progress.total} — ${progress.path}`
    : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Injecter depuis Web vers Local</DialogTitle>
          <DialogDescription>
            Télécharge les fichiers uploadés en Web vers le repository local.
            Les conflits sont versionnés automatiquement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!hasCreds && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Credentials Vercel non configurés
              </div>
              <p className="mt-1 text-xs">
                Configurez vos identifiants Vercel dans{" "}
                <span className="font-medium">Paramètres → Configuration Vercel</span> avant de lancer l&apos;injection.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">URL Vercel</label>
            <Input
              value={vercelUrl}
              onChange={(e) => setVercelUrl(e.target.value)}
              disabled={isInjecting}
            />
          </div>

          {isInjecting && progressText && (
            <div className="space-y-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{
                    width: progress
                      ? `${Math.round((progress.current / progress.total) * 100)}%`
                      : "0%",
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{progressText}</p>
            </div>
          )}

          {report && !isInjecting && (
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/40 p-3">
              <p className="text-sm font-medium">Rapport d'injection</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>Injectés : {report.injected}</li>
                <li>Conflits : {report.conflicts}</li>
                <li>Ignorés : {report.skipped}</li>
              </ul>
              {report.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto text-xs text-destructive space-y-1">
                  {report.errors.slice(0, 20).map((err, idx) => (
                    <p key={idx}>• {err}</p>
                  ))}
                  {report.errors.length > 20 && (
                    <p>... et {report.errors.length - 20} erreur(s) supplémentaire(s)</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isInjecting}
          >
            Fermer
          </Button>
          <Button
            onClick={handleInject}
            disabled={isInjecting || !vercelUrl.trim()}
          >
            {isInjecting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                Injection en cours...
              </>
            ) : (
              <>
                <ArrowDownToLine className="w-4 h-4 mr-2" />
                Injecter depuis Web
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
