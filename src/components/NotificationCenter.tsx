'use client';

import { useState, useEffect } from 'react';

export interface AppNotification {
  id: string;
  message: string;
  createdAt: Date;
  read: boolean;
}

const STORAGE_KEY = 'nexaflow-notifications';

export function useNotificationCenter() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Charger depuis localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setNotifications(parsed.map((n: { id: string; message: string; createdAt: string; read: boolean }) => ({
          ...n,
          createdAt: new Date(n.createdAt),
        })));
      }
    } catch (e) {
      console.error('[notifications] load error:', e);
    }
  }, []);

  // Persister dans localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications]);

  function push(message: string) {
    const notification: AppNotification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message,
      createdAt: new Date(),
      read: false,
    };
    setNotifications(prev => [notification, ...prev].slice(0, 50)); // max 50
  }

  function markRead(id: string) {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  function clearAll() {
    setNotifications([]);
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    push,
    markRead,
    markAllRead,
    clearAll,
  };
}

export function NotificationBell({
  unreadCount,
  notifications,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
}: {
  unreadCount: number;
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-600 hover:text-gray-900 rounded-xl"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold text-white bg-red-600 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-white text-gray-900 shadow-xl rounded-lg border border-gray-200 z-50">
            <div className="flex items-center justify-between p-3 border-b border-gray-200">
              <span className="font-semibold text-sm text-gray-900">Notifications</span>
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllRead}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Tout lire
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={onClearAll}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Effacer
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">
                  Aucune notification
                </div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => onMarkRead(n.id)}
                    className={`p-3 cursor-pointer hover:bg-gray-50 transition ${
                      n.read ? 'opacity-60' : 'bg-blue-50/30'
                    }`}
                  >
                    <div className="text-sm text-gray-800">{n.message}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(n.createdAt).toLocaleString('fr-FR')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
