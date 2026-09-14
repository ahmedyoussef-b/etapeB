"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLayoutEffect, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopNav } from "@/components/dashboard/top-nav";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/notifications/toast-provider";
import { AlertPoller } from "@/components/notifications/alert-poller";
import { PublishButton } from "@/components/PublishButton";

type Role = "admin" | "chef-de-quart" | "chef-de-bloc" | "rondier";


function deriveRoleFromPath(pathname: string): Role {
  if (pathname.startsWith("/admin") || pathname.startsWith("/pipeline")) return "admin";
  if (pathname.startsWith("/chef-de-quart")) return "chef-de-quart";
  if (pathname.startsWith("/chef-de-bloc")) return "chef-de-bloc";
  if (pathname.startsWith("/rondier")) return "rondier";
  return "rondier";
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [hydrated, setHydrated] = useState(false);
  const [role, setRole] = useState<Role>(deriveRoleFromPath(pathname));
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isTauri, setIsTauri] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsTauri(typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
  }, []);


  const sessionRole = (session?.user?.role as Role) || "rondier";
  const pathRole = deriveRoleFromPath(pathname);
  const roleRef = useRef(role);
  roleRef.current = role;

  useLayoutEffect(() => {
    if (status === "loading") {
      setHydrated(true);
      return;
    }

    const next =
      status === "authenticated" && session?.user?.role
        ? sessionRole
        : status === "unauthenticated"
          ? pathRole
          : roleRef.current;

    if (next !== roleRef.current) {
      setRole(next);
    }

    setHydrated(true);
  }, [status, session?.user?.role, sessionRole, pathRole]);

  useEffect(() => {
    if (!hydrated) return;
    const hasRolePrefix = pathname.startsWith("/admin") || pathname.startsWith("/pipeline") || pathname.startsWith("/chef-de-quart") || pathname.startsWith("/chef-de-bloc") || pathname.startsWith("/rondier");
    if (hasRolePrefix && status === "authenticated") {
      try {
        window.sessionStorage.setItem("dashboardRole", sessionRole);
      } catch {}
    }
  }, [pathname, hydrated, status, sessionRole]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading" || !hydrated) {
    return (
      <ThemeProvider>
        <ToastProvider>
          <div className="flex h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </ToastProvider>
      </ThemeProvider>
    );
  }

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  return (
    <ThemeProvider>
      <ToastProvider>
        <AlertPoller enabled={true} />
        <div className="flex h-screen overflow-hidden" data-role={role}>
          <div
            className={`h-screen shrink-0 transition-all duration-300 ease-in-out ${
              sidebarOpen ? "w-64 opacity-100 border-r border-border" : "w-0 opacity-0 overflow-hidden border-0"
            }`}
          >
            <DashboardSidebar collapsed={!sidebarOpen} />
          </div>
          <main className="flex flex-1 flex-col overflow-hidden min-w-0">
            <DashboardTopNav onToggleSidebar={toggleSidebar} />
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
          </main>
          {isTauri && <PublishButton />}
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}
