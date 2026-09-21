"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NexaFlowLogo } from "@/components/brand/nexaflow-logo";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Shield, UserPlus, Loader2 } from "lucide-react";
import { isTauriEnv } from "@/lib/tauri/env";

type RoleValue = "RONDIER" | "CHEF_DE_BLOC" | "CHEF_DE_QUART" | "ADMIN";

const ROLES: { value: RoleValue; label: string }[] = [
  { value: "RONDIER", label: "Rondier" },
  { value: "CHEF_DE_BLOC", label: "Chef de bloc" },
  { value: "CHEF_DE_QUART", label: "Chef de quart" },
  { value: "ADMIN", label: "Administrateur" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<RoleValue>("RONDIER");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isTauriEnv()) {
        router.push(`/register/success?email=${encodeURIComponent(email)}`);
        return;
      }

      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          confirmPassword,
          role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erreur lors de l'inscription");
        return;
      }

      const emailParam = data.request?.email ? `?email=${encodeURIComponent(data.request.email)}` : "";
      router.push(`/register/success${emailParam}`);
    } catch {
      setError("Une erreur est survenue lors de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:flex lg:w-1/2 xl:w-2/5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/10 bg-[length:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black,transparent)]" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <div className="flex items-center gap-3">
              <NexaFlowLogo className="h-10 w-10" iconClassName="h-5 w-5" />
              <span className="text-lg font-semibold tracking-tight">NexaFlow</span>
            </div>
            <p className="mt-8 text-lg font-medium leading-relaxed text-slate-200">
              Créez votre compte et accédez à votre espace industriel.
            </p>
          </div>
          <div className="space-y-4 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span>Accès sécurisé par rôle</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span>Données tracées et auditées</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span>Interface adaptée à votre métier</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="mx-auto lg:hidden mb-4">
              <NexaFlowLogo className="h-10 w-10 mx-auto" iconClassName="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Créer un compte
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Rejoignez NexaFlow pour gérer vos procédures et équipements.
            </p>
          </div>

          <Card className="border-border/70 shadow-lg">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">Nom complet</Label>
                  <div className="relative">
                    <UserPlus className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="Jean Dupont"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      disabled={loading}
                      autoComplete="name"
                      className="pl-9 h-11 rounded-lg border-border/70 focus-visible:ring-2 focus-visible:ring-primary/40"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="nom@nexaflow.local"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      autoComplete="email"
                      className="pl-9 h-11 rounded-lg border-border/70 focus-visible:ring-2 focus-visible:ring-primary/40"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      autoComplete="new-password"
                      className="pl-9 pr-9 h-11 rounded-lg border-border/70 focus-visible:ring-2 focus-visible:ring-primary/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                      autoComplete="new-password"
                      className="pl-9 pr-9 h-11 rounded-lg border-border/70 focus-visible:ring-2 focus-visible:ring-primary/40"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Rôle</Label>
                  <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as RoleValue)}
                    disabled={loading}
                    className="h-11 w-full rounded-lg border border-border/70 bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Création...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Créer mon compte
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Vous avez déjà un compte ?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
