'use client';

import * as React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastVariant = 'default' | 'success' | 'destructive';

export type Toast = {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
};

type ToastInput = Omit<Toast, 'id'>;

type ToastContextValue = {
  toasts: Toast[];
  toast: (toast: ToastInput) => void;
  dismiss: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    ({ title, description, variant = 'default' }: ToastInput) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, title, description, variant }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <Toaster />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

const VARIANT_ICON: Record<ToastVariant, React.ComponentType<{ className?: string }>> = {
  default: Info,
  success: CheckCircle2,
  destructive: AlertCircle,
};

const VARIANT_STYLES: Record<ToastVariant, string> = {
  default: 'border-border bg-card text-foreground',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-foreground',
  destructive: 'border-destructive/40 bg-destructive/10 text-foreground',
};

const VARIANT_ICON_STYLES: Record<ToastVariant, string> = {
  default: 'text-primary',
  success: 'text-emerald-500',
  destructive: 'text-destructive',
};

function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-end gap-2 p-4 sm:bottom-4 sm:right-4 sm:items-end">
      {toasts.map((t) => {
        const Icon = VARIANT_ICON[t.variant ?? 'default'];
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur animate-in slide-in-from-bottom-4 fade-in duration-200',
              VARIANT_STYLES[t.variant ?? 'default'],
            )}
          >
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', VARIANT_ICON_STYLES[t.variant ?? 'default'])} />
            <div className="flex-1 space-y-0.5">
              <p className="text-sm font-medium leading-none">{t.title}</p>
              {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
