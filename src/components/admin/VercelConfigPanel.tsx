"use client";

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToastHelpers } from "@/components/notifications/toast-provider";
import { ShieldCheck, Trash2, Save } from "lucide-react";

export function VercelConfigPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hasCreds, setHasCreds] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const toast = useToastHelpers();

  useEffect(() => {
    invoke<boolean>("has_vercel_credentials")
      .then(setHasCreds)
      .catch(() => setHasCreds(false));
  }, []);

  const handleSave = async () => {
    if (!email.trim() || !password.trim()) {
      toast.error("Email et mot de passe requis", "Configuration Vercel");
      return;
    }

    setIsTesting(true);
    setMessage(null);

    try {
      await invoke("save_vercel_credentials", {
        email: email.trim(),
        password: password.trim(),
      });

      setHasCreds(true);
      setPassword("");
      setMessage({ type: "success", text: "Credentials enregistrés dans le trousseau Windows." });
      toast.success("Credentials Vercel enregistrés", "Configuration Vercel");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      setMessage({ type: "error", text: msg });
      toast.error(`Échec: ${msg}`, "Configuration Vercel");
    } finally {
      setIsTesting(false);
    }
  };

  const handleClear = async () => {
    try {
      await invoke("clear_vercel_credentials");
      setHasCreds(false);
      setEmail("");
      setPassword("");
      setMessage({ type: "success", text: "Credentials supprimés du trousseau." });
      toast.success("Credentials Vercel supprimés", "Configuration Vercel");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      setMessage({ type: "error", text: msg });
      toast.error(`Échec: ${msg}`, "Configuration Vercel");
    }
  };

  return (
    <div className="rounded-xl border border-border/60 bg-background p-4">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold">Configuration Vercel</h3>
      </div>

      {hasCreds ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
            Credentials configurés ✅
            <p className="text-xs text-green-700 mt-1">
              Les identifiants sont stockés dans le trousseau Windows.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleClear}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Effacer les credentials
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Email Vercel</label>
             <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@nexaflow.local"
              disabled={isTesting}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Mot de passe Vercel</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isTesting}
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={isTesting || !email.trim() || !password.trim()}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {isTesting ? "Test en cours..." : "Tester et enregistrer"}
          </Button>
        </div>
      )}

      {message && (
        <div
          className={`mt-3 rounded-lg border p-3 text-xs ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
