"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/use-auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NexaFlowLogo } from "@/components/brand/nexaflow-logo";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Shield, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!email) {
      setRegistrationStatus(null);
      return;
    }

    let cancelled = false;
    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/auth/check-registration-status?email=${encodeURIComponent(email.trim())}`);
        const data = await res.json();

        if (!res.ok || !data.hasPendingRequest) {
          if (!cancelled) setRegistrationStatus(null);
          return;
        }

        if (!cancelled) {
          if (data.status === "PENDING") {
            setRegistrationStatus("pending");
            setError("Votre compte est en attente de validation par un administrateur.");
          } else if (data.status === "REJECTED") {
            setRegistrationStatus("rejected");
            setError("Votre demande d'inscription a été rejetée.");
          } else {
            setRegistrationStatus(null);
          }
        }
      } catch {
        if (!cancelled) setRegistrationStatus(null);
      }
    };

    checkStatus();
    return () => { cancelled = true; };
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await login(email, password);

      if (result?.error) {
        setError("Email ou mot de passe incorrect");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Une erreur est survenue lors de la connexion");
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
              Automatisez vos workflows industriels sans complexité.
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
              Connexion
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Connectez-vous à votre espace NexaFlow
            </p>
          </div>

          <Card className="border-border/70 shadow-lg">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div
                    className={`rounded-md p-3 text-sm ${
                      registrationStatus === "pending"
                        ? "border border-amber-200 bg-amber-50 text-amber-800"
                        : registrationStatus === "rejected"
                          ? "border border-red-200 bg-red-50 text-red-800"
                          : "border border-destructive/50 bg-destructive/10 text-destructive"
                    }`}
                  >
                    {error}
                  </div>
                )}

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
                      autoComplete="username"
                      data-lpignore="true"
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
                      autoComplete="current-password"
                      data-lpignore="true"
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

                <Button
                  type="submit"
                  className="w-full h-11 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connexion...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Se connecter
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Pas encore de compte ?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
