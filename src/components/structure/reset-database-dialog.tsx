"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshCw } from "lucide-react";
import { StructureSource } from "@/lib/database/structure-types";

interface ResetDatabaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: StructureSource;
  onConfirm: (options: { backup: boolean }) => Promise<void>;
  isLoading?: boolean;
}

export function ResetDatabaseDialog({
  open,
  onOpenChange,
  source,
  onConfirm,
  isLoading = false,
}: ResetDatabaseDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [backup, setBackup] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setConfirmText("");
      setBackup(true);
      setIsSubmitting(false);
    }
  }, [open]);

  const isConfirmed = confirmText === "RESET";
  const canSubmit = isConfirmed && !isSubmitting && !isLoading;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await onConfirm({ backup });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Réinitialiser la base de données</DialogTitle>
          <DialogDescription>
            Cette action est irréversible. Toutes les données seront remplacées par le contenu de référence (.data/).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="backup"
              checked={backup}
              onCheckedChange={(checked) => setBackup(checked === true)}
            />
            <label htmlFor="backup" className="text-sm text-foreground cursor-pointer">
              Créer un backup avant reset
            </label>
          </div>

          <div className="space-y-2">
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder='Tapez "RESET" pour confirmer'
              autoComplete="off"
            />
            {!isConfirmed && confirmText.length > 0 && (
              <p className="text-xs text-destructive">
                Tapez exactement RESET en majuscules pour confirmer
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting || isLoading}
          >
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canSubmit}
          >
            {isSubmitting || isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                Réinitialisation...
              </>
            ) : (
              "Confirmer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
