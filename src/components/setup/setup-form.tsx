"use client";

import { useState } from "react";
import { useToastHelpers } from "@/components/notifications/toast-provider";
import { saveConfig } from "@/lib/ai/config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Check, AlertCircle, KeyRound } from "lucide-react";

const KNOWN_MODELS = [
  "openai/gpt-oss-120b",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
  "gemma-7b-it",
  "gemma2-9b-it",
  "deepseek-r1-distill-llama-70b",
];

interface SetupFormProps {
  onCompleted: () => void;
  initialConfig?: { groq_api_key: string | null; groq_model: string | null } | null;
}

export function SetupForm({ onCompleted, initialConfig }: SetupFormProps) {
  const toast = useToastHelpers();
  const [key, setKey] = useState(initialConfig?.groq_api_key || "");
  const [model, setModel] = useState(initialConfig?.groq_model || "openai/gpt-oss-120b");
  const [customModel, setCustomModel] = useState("");
  const [testResult, setTestResult] = useState<"testing" | "valid" | "invalid" | "error" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCustomModel = model === "custom";

  const handleTestKey = async () => {
    if (!key.trim()) {
      setTestResult("invalid");
      return;
    }
    setTestResult("testing");
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key.trim()}`,
        },
        body: JSON.stringify({
          model: isCustomModel ? customModel || "llama-3.1-8b-instant" : model,
          messages: [{ role: "user", content: "Test" }],
          max_tokens: 10,
        }),
      });
      if (response.ok) {
        setTestResult("valid");
        toast.success("Clé valide ✅", "Test de la clé réussi");
      } else {
        setTestResult("invalid");
        toast.error("Clé invalide ❌", "La clé semble incorrecte");
      }
    } catch {
      setTestResult("error");
      toast.error("Erreur réseau", "Impossible de vérifier la clé");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await saveConfig({
        groq_api_key: key.trim() || null,
        groq_model: isCustomModel ? customModel || null : model,
        setup_completed: true,
        setup_completed_at: new Date().toISOString(),
      });
      onCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      toast.error("Erreur de configuration", "Impossible de sauvegarder");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    try {
      await saveConfig({
        groq_api_key: null,
        groq_model: null,
        setup_completed: false,
        setup_completed_at: null,
      });
      onCompleted();
    } catch (err) {
      toast.error("Erreur", "Impossible de sauvegarder");
    }
  };

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) {
      setError("La clé API est requise pour continuer");
      return;
    }
    handleSubmit(e);
  };

  const selectedModel = isCustomModel ? "custom" : model;

  return (
    <form onSubmit={handleContinue} className="w-full max-w-lg space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuration IA</CardTitle>
          <CardDescription>
            Entrez votre clé API Groq pour activer l'assistant IA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="groq-key" className="text-sm font-medium">
              Clé API Groq
            </label>
            <Input
              id="groq-key"
              type="password"
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setTestResult(null);
              }}
              placeholder="gsk_..."
              required={!initialConfig?.groq_api_key}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <label className="text-sm font-medium">Modèle</label>
            <div className="flex flex-wrap gap-2">
              {KNOWN_MODELS.map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant={selectedModel === m ? "default" : "outline"}
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setModel(m);
                    setCustomModel("");
                  }}
                >
                  {m}
                </Button>
              ))}
              <Button
                type="button"
                variant={isCustomModel ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setModel("custom");
                }}
              >
                Custom
              </Button>
            </div>
            {isCustomModel && (
              <Input
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="modèle personnalisalisé..."
                className="mt-2"
              />
            )}
          </div>

          {testResult && (
            <div className="flex items-center gap-2">
              {testResult === "valid" && (
                <>
                  <Check className="h-4 w-4 text-green-600" />
                  <Badge className="bg-green-100 text-green-800">
                    Clé valide
                  </Badge>
                </>
              )}
              {testResult === "invalid" && (
                <>
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <Badge variant="destructive" className="bg-red-100 text-red-800">
                    Clé invalide
                  </Badge>
                </>
              )}
              {testResult === "testing" && (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-sm text-muted-foreground">Vérification...</span>
                </>
              )}
              {testResult === "error" && (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <Badge variant="secondary">Erreur réseau</Badge>
                </>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleTestKey}
          disabled={testResult === "testing"}
        >
          <KeyRound className="h-4 w-4 mr-2" />
          Tester la clé
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : null}
          Continuer
        </Button>
        <Button type="button" variant="ghost" onClick={handleSkip}>
          Plus tard
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Pas de clé ? En obtenir une :{" "}
        <a
          href="https://console.groq.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline"
        >
          console.groq.com
        </a>
      </p>
    </form>
  );
}
