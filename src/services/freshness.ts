export type FreshnessLevel = 'fresh' | 'recent' | 'stale' | 'old' | 'unknown';

export interface FreshnessInfo {
  level: FreshnessLevel;
  daysSinceSync: number | null;
  lastSyncAt: Date | null;
  pendingCount: number;
  label: string;
  color: string;
  emoji: string;
}

const FRESHNESS_THRESHOLDS = {
  fresh: 1,     // < 1 jour
  recent: 7,    // 1-7 jours
  stale: 30,    // 7-30 jours
  // > 30 jours = old
};

export function computeFreshness(
  lastSyncAt: string | null,
  pendingCount: number
): FreshnessInfo {
  if (!lastSyncAt) {
    return {
      level: 'unknown',
      daysSinceSync: null,
      lastSyncAt: null,
      pendingCount,
      label: 'Jamais synchronisé',
      color: 'bg-gray-400',
      emoji: '❓',
    };
  }

  const lastSync = new Date(lastSyncAt);
  const now = new Date();
  const daysSince = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60 * 24);

  if (pendingCount > 0) {
    return {
      level: 'stale',
      daysSinceSync: daysSince,
      lastSyncAt: lastSync,
      pendingCount,
      label: `${pendingCount} mise(s) à jour disponible(s)`,
      color: 'bg-orange-500',
      emoji: '🔄',
    };
  }

  if (daysSince < FRESHNESS_THRESHOLDS.fresh) {
    return {
      level: 'fresh',
      daysSinceSync: daysSince,
      lastSyncAt: lastSync,
      pendingCount,
      label: 'À jour',
      color: 'bg-green-500',
      emoji: '✅',
    };
  }

  if (daysSince < FRESHNESS_THRESHOLDS.recent) {
    return {
      level: 'recent',
      daysSinceSync: daysSince,
      lastSyncAt: lastSync,
      pendingCount,
      label: `Synchronisé il y a ${Math.floor(daysSince)} jour(s)`,
      color: 'bg-yellow-500',
      emoji: '🟡',
    };
  }

  return {
    level: 'old',
    daysSinceSync: daysSince,
    lastSyncAt: lastSync,
    pendingCount,
    label: `Données anciennes (${Math.floor(daysSince)} jours)`,
    color: 'bg-red-500',
    emoji: '🔴',
  };
}

export function formatLastSync(date: Date | null): string {
  if (!date) return 'Jamais';
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return 'À l\'instant';
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffH < 24) return `Il y a ${diffH}h`;
  return `Il y a ${diffD} jour(s)`;
}
