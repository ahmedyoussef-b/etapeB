'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'confirm';

export interface Toast {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface ToastContextValue {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
  clear: () => void;
  confirm: (message: string, title?: string, options?: { confirmLabel?: string; cancelLabel?: string }) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, { bg: string; text: string; border: string; Icon: any }> = {
  success: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200', Icon: CheckCircle },
  error:   { bg: 'bg-red-50',   text: 'text-red-800',   border: 'border-red-200',   Icon: AlertCircle },
  warning: { bg: 'bg-yellow-50',text: 'text-yellow-800',border: 'border-yellow-200',Icon: AlertTriangle },
  info:    { bg: 'bg-blue-50',  text: 'text-blue-800',  border: 'border-blue-200',  Icon: Info },
  confirm: { bg: 'bg-amber-50',  text: 'text-amber-800', border: 'border-amber-200',  Icon: AlertTriangle }
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry: Toast = { id, duration: 0, ...toast };
    setToasts(prev => [...prev, entry]);
    return id;
  }, []);

  const confirm = useCallback((message: string, title?: string, options?: { confirmLabel?: string; cancelLabel?: string }): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const id = push({
        variant: 'confirm',
        title: title || 'Confirmation requise',
        message,
        duration: 0,
        confirmLabel: options?.confirmLabel || 'Confirmer',
        cancelLabel: options?.cancelLabel || 'Annuler',
        onConfirm: () => { dismiss(id); resolve(true); },
        onCancel: () => { dismiss(id); resolve(false); }
      });
    });
  }, [push, dismiss]);

  const clear = useCallback(() => setToasts([]), []);

  return (
    <ToastContext.Provider value={{ toasts, push, dismiss, clear, confirm }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(t => {
        const style = VARIANT_STYLES[t.variant];
        const Icon = style.Icon;
        return (
          <div
            key={t.id}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`toast-title-${t.id}`}
            aria-describedby={`toast-msg-${t.id}`}
            className={`pointer-events-auto flex flex-col gap-2 p-3 rounded-md border shadow-md ${style.bg} ${style.border}`}
          >
            <div className="flex items-start gap-2">
              <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${style.text}`} />
              <div className="flex-1 min-w-0">
                {t.title && <p id={`toast-title-${t.id}`} className={`font-semibold text-sm ${style.text}`}>{t.title}</p>}
                <p id={`toast-msg-${t.id}`} className={`text-sm ${style.text} break-words`}>{t.message}</p>
              </div>
              <button
                onClick={() => onDismiss(t.id)}
                className={`flex-shrink-0 ${style.text} opacity-60 hover:opacity-100`}
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {t.variant === 'confirm' && (
              <div className="flex justify-end gap-2 mt-1">
                <button
                  onClick={() => t.onCancel?.()}
                  className="px-3 py-1 text-xs font-medium rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  {t.cancelLabel || 'Annuler'}
                </button>
                <button
                  onClick={() => t.onConfirm?.()}
                  className="px-3 py-1 text-xs font-medium rounded bg-amber-600 text-white hover:bg-amber-700"
                >
                  {t.confirmLabel || 'Confirmer'}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé dans un <ToastProvider>');
  return ctx;
}

export function useToastHelpers() {
  const { push, confirm } = useToast();
  return {
    success: (message: string, title?: string) => push({ variant: 'success', message, title }),
    error:   (message: string, title?: string) => push({ variant: 'error',   message, title, duration: 8000 }),
    warning: (message: string, title?: string) => push({ variant: 'warning', message, title }),
    info:    (message: string, title?: string) => push({ variant: 'info',    message, title }),
    confirm: (message: string, title?: string, options?: { confirmLabel?: string; cancelLabel?: string }) =>
      confirm(message, title, options)
  };
}