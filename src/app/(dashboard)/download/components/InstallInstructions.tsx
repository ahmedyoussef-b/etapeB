import React from "react";
import { Installer } from "../download-data";

interface InstallInstructionsProps {
  installer: Installer | null;
}

export function InstallInstructions({ installer }: InstallInstructionsProps) {
  if (!installer) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground text-sm">
        Sélectionnez une plateforme pour voir les instructions d'installation.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border p-5 space-y-3">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        Instructions d'installation — {installer.label} ({installer.format})
      </h3>
      <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
        {installer.instructions.map((step, i) => (
          <li key={i} className="leading-relaxed">{step}</li>
        ))}
      </ol>
    </div>
  );
}