"use client";

import React, { useState, useMemo } from "react";
import { Download, Monitor, Apple, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  APP_VERSION,
  RELEASE_DATE,
  INSTALLERS,
  getInstallerForOS,
  formatSize,
} from "./download-data";
import { detectOS, getOSLabel, getOSIcon } from "@/lib/detect-os";
import { DownloadCard } from "./components/DownloadCard";
import { InstallInstructions } from "./components/InstallInstructions";
import { ChangelogSection } from "./components/ChangelogSection";

const OS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  windows: Monitor,
  macos: Apple,
  linux: Terminal,
};

export default function DownloadPage() {
  const [selectedOS, setSelectedOS] = useState<string | null>(null);

  const detectedOS = useMemo(() => detectOS(), []);
  const recommendedOS = useMemo(() => {
    if (detectedOS === "windows" || detectedOS === "macos" || detectedOS === "linux") {
      return detectedOS;
    }
    return "windows";
  }, [detectedOS]);

  const activeOS = selectedOS || recommendedOS;
  const activeInstaller = getInstallerForOS(activeOS);

  const availableOS = useMemo(
    () => Array.from(new Set(INSTALLERS.map((i) => i.os))),
    []
  );

  const handleDownload = (installer: (typeof INSTALLERS)[0]) => {
    if (!installer.url || installer.size === 0) return;
    window.open(installer.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Download className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Télécharger NexaFlow</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary" className="font-mono">
            v{APP_VERSION}
          </Badge>
          <span>•</span>
          <span>Release du {RELEASE_DATE}</span>
        </div>
      </div>

      <Separator />

      {/* OS selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground mr-1">Plateforme</span>
        {availableOS.map((os) => {
          const Icon = OS_ICON[os] || Monitor;
          const isActive = activeOS === os;
          return (
            <button
              key={os}
              onClick={() => setSelectedOS(os)}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm border transition-all ${
                isActive
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              <Icon className="h-4 w-4" />
              {getOSLabel(os as any)}
            </button>
          );
        })}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {INSTALLERS.map((installer) => (
          <DownloadCard
            key={installer.format + installer.os}
            installer={installer}
            isRecommended={installer.os === recommendedOS}
            onDownload={handleDownload}
          />
        ))}
      </div>

      {/* Instructions */}
      <InstallInstructions installer={activeInstaller} />

      {/* Changelog */}
      <ChangelogSection />
    </div>
  );
}