import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { createId } from '@/lib/id';
import { ToastContext, type ToastOptions, type ToastTone } from './context';

interface ToastItem extends ToastOptions {
  id: string;
  tone: ToastTone;
}

const TONE_STYLE: Record<ToastTone, string> = {
  success: 'bg-present text-ink-invert',
  error: 'bg-danger text-ink-invert',
  info: 'bg-ink text-ink-invert',
};

const TONE_ICON: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 size={20} />,
  error: <XCircle size={20} />,
  info: <Info size={20} />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      const id = createId();
      const tone = options.tone ?? 'info';
      // 有操作按鈕的 toast 停留久一點，讓使用者來得及點「重試」
      const duration = options.durationMs ?? (options.action ? 8000 : 3200);
      setToasts((current) => [...current, { ...options, id, tone }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      show,
      success: (message: string) => show({ message, tone: 'success' }),
      error: (message: string, action?: ToastOptions['action']) =>
        show({ message, tone: 'error', action }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 px-3 pt-safe"
        role="region"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl px-4 py-3 shadow-lg ${TONE_STYLE[toast.tone]}`}
          >
            <span className="shrink-0">{TONE_ICON[toast.tone]}</span>
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            {toast.action ? (
              <button
                type="button"
                className="tap shrink-0 rounded-lg bg-white/20 px-3 text-sm font-bold underline-offset-2 hover:bg-white/30"
                onClick={() => {
                  dismiss(toast.id);
                  toast.action?.onClick();
                }}
              >
                {toast.action.label}
              </button>
            ) : (
              <button
                type="button"
                aria-label="關閉"
                className="tap shrink-0 px-2 text-lg leading-none opacity-80 hover:opacity-100"
                onClick={() => dismiss(toast.id)}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
