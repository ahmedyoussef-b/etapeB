"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NexaFlowLogo } from "@/components/brand/nexaflow-logo";
import { CheckCircle2, Clock, Mail, ArrowRight } from "lucide-react";

export default function RegisterSuccessPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
              Votre demande est en cours de validation par notre équipe.
            </p>
          </div>
          <div className="space-y-4 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-400" />
              <span>Traitement généralement sous 24h</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-emerald-400" />
              <span>Vous recevrez une confirmation par email</span>
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
              Demande envoyée
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Votre inscription est en attente de validation par un administrateur.
            </p>
          </div>

          <Card className="border-border/70 shadow-lg">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className={`rounded-full bg-emerald-50 p-3 transition-all duration-500 ${mounted ? "scale-100 opacity-100" : "scale-75 opacity-0"}`}>
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Email utilisé</p>
                  <p className="text-sm text-muted-foreground break-all">{email || "—"}</p>
                </div>

                <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <p className="font-medium">Prochaine étape</p>
                  <p className="mt-1">
                    Un administrateur va examiner votre demande. Vous recevrez une confirmation dès que votre compte sera activé.
                  </p>
                </div>

                <Button
                  onClick={() => router.push("/login")}
                  className="w-full"
                >
                  <span className="flex items-center gap-2">
                    Retour à la connexion
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Button>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Besoin d'aide ? Contactez votre administrateur NexaFlow.
          </p>
        </div>
      </div>
    </div>
  );
}
