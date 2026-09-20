"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SetupForm } from "@/components/setup/setup-form";
import { getConfig } from "@/lib/ai/config";
import { Settings2 } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const [existingConfig, setExistingConfig] = useState<{
    groq_api_key: string | null;
    groq_model: string | null;
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      const config = await getConfig();
      if (config && !config.setup_completed) {
        setExistingConfig({
          groq_api_key: config.groq_api_key,
          groq_model: config.groq_model,
        });
      }
    };
    void load();
  }, []);

  const handleCompleted = () => {
    router.replace("/dashboard");
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12 text-slate-50">
      <div className="w-full max-w-xl space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 text-primary">
            <Settings2 className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight">
            Bienvenue dans NexaFlow
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Configuration initiale — une seule fois
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl backdrop-blur-sm">
          <SetupForm onCompleted={handleCompleted} initialConfig={existingConfig} />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Votre clé est stockée uniquement sur cette machine dans{" "}
          <code className="rounded bg-slate-800 px-1 py-0.5">%APPDATA%\NexaFlow\config.json</code>
        </p>
      </div>
    </main>
  );
}
