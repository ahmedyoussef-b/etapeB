'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useToastHelpers } from './toast-provider';

interface SyncAlert {
  id: string;
  severity: 'error' | 'warning';
  title: string;
  message: string;
  timestamp: string;
}

const POLL_MS = 30_000;

export function AlertPoller({ enabled = true }: { enabled?: boolean }) {
  const { error, warning } = useToastHelpers();
  const seenIds = useRef<Set<string>>(new Set());
  const errorRef = useRef(error);
  const warningRef = useRef(warning);

  errorRef.current = error;
  warningRef.current = warning;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const fetchAlerts = async () => {
      try {
        const res = await fetch('/api/notifications');
        const data = await res.json();
        if (cancelled || !data.success) return;
        for (const alert of data.alerts as SyncAlert[]) {
          if (seenIds.current.has(alert.id)) continue;
          seenIds.current.add(alert.id);
          if (alert.severity === 'error') errorRef.current(alert.message, alert.title);
          else warningRef.current(alert.message, alert.title);
        }
      } catch {}
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [enabled]);

  return null;
}

export function SyncFailureBanner() {
  return null;
}