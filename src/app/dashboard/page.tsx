"use client";

import { useSession } from "next-auth/react";
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
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/auth/login");
      return;
    }

    const role = session.user?.role;
    const dashboard = role ? dashboardMap[role] : null;
    router.push(dashboard || "/admin");
  }, [session, status, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    </div>
  );
}
