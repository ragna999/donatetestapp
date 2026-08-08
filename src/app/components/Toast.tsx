'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type ToastType = 'success' | 'error' | 'loading' | 'info';
interface ToastItem { id: number; type: ToastType; message: string; exiting: boolean }

interface ToastCtx {
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    loading: (msg: string) => number;
    info: (msg: string) => void;
    dismiss: (id: number) => void;
  };
}

/* ─── Context ───────────────────────────────────────────────────────────────── */
const ToastContext = createContext<ToastCtx | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx.toast;
}

/* ─── Provider ──────────────────────────────────────────────────────────────── */
let _nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  }, []);

  const add = useCallback((type: ToastType, message: string, duration = 4000) => {
    const id = _nextId++;
    setToasts(prev => [...prev, { id, type, message, exiting: false }]);
    if (type !== 'loading' && duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  const toast = {
    success: (msg: string) => add('success', msg),
    error: (msg: string) => add('error', msg, 6000),
    loading: (msg: string) => add('loading', msg, 0),
    info: (msg: string) => add('info', msg),
    dismiss,
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
        role="region"
        aria-label="Notifikasi"
        aria-live="polite"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            role="alert"
            aria-live="assertive"
            className={`
              pointer-events-auto max-w-sm w-full rounded-lg border px-4 py-3
              shadow-lg backdrop-blur-sm text-sm font-medium
              flex items-start gap-3
              ${t.exiting ? 'animate-toast-out' : 'animate-toast-in'}
              ${t.type === 'success' ? 'bg-emerald-950/90 border-emerald-700/50 text-emerald-200' : ''}
              ${t.type === 'error'   ? 'bg-red-950/90 border-red-700/50 text-red-200' : ''}
              ${t.type === 'loading' ? 'bg-indigo-950/90 border-indigo-700/50 text-indigo-200' : ''}
              ${t.type === 'info'    ? 'bg-gray-900/90 border-gray-700/50 text-gray-200' : ''}
            `}
          >
            <span className="mt-0.5 shrink-0">
              {t.type === 'success' && '✅'}
              {t.type === 'error'   && '❌'}
              {t.type === 'loading' && <span className="inline-block animate-spin">⏳</span>}
              {t.type === 'info'    && 'ℹ️'}
            </span>
            <span className="flex-1">{t.message}</span>
            {t.type !== 'loading' && (
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 opacity-60 hover:opacity-100 transition-opacity ml-2"
                aria-label="Tutup notifikasi"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
