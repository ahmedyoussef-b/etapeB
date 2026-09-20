import { getPendingCount } from './sync-engine';

export type NotificationListener = (count: number, delta: number) => void;

interface PollerConfig {
  userId: string;
  intervalMs?: number;      // défaut: 300000 (5 min)
  onNewData?: NotificationListener;
  onError?: (error: Error) => void;
}

let activePoller: { stop: () => void } | null = null;

export function startNotificationPoller(config: PollerConfig): { stop: () => void } {
  const {
    userId,
    intervalMs = 300000,
    onNewData,
    onError,
  } = config;

  let lastCount: number | null = null;
  let stopped = false;
  let timerId: NodeJS.Timeout | null = null;

  async function poll() {
    if (stopped) return;

    // Ne rien faire si la page est cachée (économie batterie)
    if (typeof document !== 'undefined' && document.hidden) {
      scheduleNext();
      return;
    }

    // Ne rien faire si offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      scheduleNext();
      return;
    }

    try {
      const count = await getPendingCount(userId);

      // Première mesure : on stocke juste la valeur
      if (lastCount === null) {
        lastCount = count;
      } else if (count > lastCount) {
        // Nouveaux fichiers détectés
        onNewData?.(count, count - lastCount);
        lastCount = count;
      } else if (count < lastCount) {
        // L'utilisateur a synchronisé entre-temps
        lastCount = count;
      }
    } catch (error) {
      onError?.(error as Error);
    }

    scheduleNext();
  }

  function scheduleNext() {
    if (stopped) return;
    timerId = setTimeout(poll, intervalMs);
  }

  function stop() {
    stopped = true;
    if (timerId) clearTimeout(timerId);
  }

  // Premier appel immédiat
  poll();

  return { stop };
}

export function stopAllPollers() {
  activePoller?.stop();
  activePoller = null;
}
