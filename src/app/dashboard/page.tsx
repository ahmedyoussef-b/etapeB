"use client";

import { useAuth } from "@/lib/auth/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const dashboardMap: Record<string, string> = {
  admin: "/admin",
  "chef-de-quart": "/chef-de-quart",
  "chef-de-bloc": "/chef-de-bloc",
  rondier: "/rondier",
};

export default function DashboardRedirectPage() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    const role = user?.role;
    const dashboard = role ? dashboardMap[role] : null;
    router.push(dashboard || "/admin");
  }, [user, isLoading, isAuthenticated, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    </div>
  );
}
