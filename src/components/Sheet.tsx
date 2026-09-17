import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** 固定在底部的操作區。 */
  footer?: ReactNode;
}

/**
 * 手機優先的 bottom sheet：從畫面下緣升起，主要操作落在拇指可及範圍。
 * 桌機寬度下改為置中卡片。
 */
export function Sheet({ open, title, onClose, children, footer }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    // 開啟期間鎖住背景捲動
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[88vh] w-full flex-col rounded-t-2xl bg-surface shadow-2xl sm:max-w-lg sm:rounded-2xl"
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="tap -mr-2 flex items-center justify-center rounded-lg text-ink-soft hover:bg-surface-sunken"
          >
            <X size={22} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>

        {footer ? (
          <footer className="border-t border-line px-4 pt-3 pb-safe sm:pb-4">{footer}</footer>
        ) : null}
      </div>
    </div>
  );
}
