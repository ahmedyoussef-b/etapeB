'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useToastHelpers } from '@/components/notifications/toast-provider';
import { isTauriEnv } from '@/lib/tauri/env';

export function WebStatusBadge() {
  const isTauri = isTauriEnv();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role?.toLowerCase() === 'admin';
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToastHelpers();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const hasErroredRef = useRef(false);

  useEffect(() => {
    if (isTauri || !isAdmin) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    hasErroredRef.current = false;

    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/admin/web-status');
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        if (!cancelled) {
          setCount(json.count ?? 0);
          hasErroredRef.current = false;
        }
      } catch (err) {
        if (!cancelled && !hasErroredRef.current) {
          hasErroredRef.current = true;
          toastRef.current.error('Impossible de charger le statut Web', 'BDD Web');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchStatus();
    timer = setInterval(fetchStatus, 30000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [isTauri, isAdmin]);

  if (isTauri) return null;
  if (!isAdmin) return null;

  if (loading || count === null || count === 0) {
    return null;
  }

  return (
    <Link
      href="/admin"
      className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-200"
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      <span>BDD Web peuplée ({count} fichier{count === 1 ? '' : 's'})</span>
    </Link>
  );
}
