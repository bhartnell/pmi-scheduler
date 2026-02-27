'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  addToast: (type: ToastType, message: string, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    // Return no-op functions if used outside provider (prevents crashes)
    return {
      addToast: () => {},
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
    };
  }
  return context;
}

const TOAST_STYLES: Record<ToastType, { icon: typeof CheckCircle; bg: string; border: string; text: string }> = {
  success: { icon: CheckCircle, bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', text: 'text-green-800 dark:text-green-300' },
  error: { icon: AlertCircle, bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-800 dark:text-red-300' },
  warning: { icon: AlertTriangle, bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', text: 'text-yellow-800 dark:text-yellow-300' },
  info: { icon: Info, bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-800 dark:text-blue-300' },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const style = TOAST_STYLES[toast.type];
  const Icon = style.icon;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg ${style.bg} ${style.border} animate-in slide-in-from-right duration-300`}
      role="alert"
      aria-atomic="true"
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${style.text}`} aria-hidden="true" />
      <p className={`text-sm flex-1 ${style.text}`}>{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className={`flex-shrink-0 ${style.text} hover:opacity-70`}
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string, duration = 5000) => {
    const id = `toast-${++counterRef.current}`;
    const toast: Toast = { id, type, message, duration };
    setToasts(prev => [...prev.slice(-4), toast]); // Keep max 5 toasts

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  }, [removeToast]);

  const contextValue: ToastContextType = {
    addToast,
    success: useCallback((msg: string) => addToast('success', msg), [addToast]),
    error: useCallback((msg: string) => addToast('error', msg), [addToast]),
    warning: useCallback((msg: string) => addToast('warning', msg), [addToast]),
    info: useCallback((msg: string) => addToast('info', msg), [addToast]),
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Toast container - fixed position, top-right */}
      {toasts.length > 0 && (
        <div
          className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
          aria-live="polite"
          aria-atomic="false"
          aria-label="Notifications"
        >
          {toasts.map(toast => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem toast={toast} onDismiss={removeToast} />
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
