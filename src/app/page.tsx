"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Navbar } from "@/components/homepage/navbar";
import { Hero } from "@/components/homepage/hero";
import { Features } from "@/components/homepage/features";
import { Stats } from "@/components/homepage/stats";
import { Pricing } from "@/components/homepage/pricing";
import { CTA } from "@/components/homepage/cta";
import { Footer } from "@/components/homepage/footer";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (status === "authenticated") {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Features />
        <Stats />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
