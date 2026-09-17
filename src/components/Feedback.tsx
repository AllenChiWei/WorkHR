import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { Button } from './Button';

/** 骨架載入：規格第 8 節要求不使用整頁 spinner。 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} aria-hidden />;
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="載入中">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="rounded-xl bg-surface p-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-3 h-4 w-48" />
        </div>
      ))}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  /** 下一步引導：說明使用者現在該做什麼。 */
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line-strong bg-surface px-6 py-10 text-center">
      <div className="mb-3 text-ink-mute">{icon ?? <Inbox size={36} strokeWidth={1.5} />}</div>
      <p className="text-lg font-semibold text-ink">{title}</p>
      {description ? <p className="mt-2 max-w-sm text-sm text-ink-soft">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}

export function ErrorState({ message, onRetry, retrying }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-danger bg-danger-soft px-4 py-5 text-center"
    >
      <AlertTriangle className="mx-auto mb-2 text-danger" size={28} strokeWidth={1.8} />
      <p className="font-semibold text-ink">{message}</p>
      {onRetry ? (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={onRetry} loading={retrying} icon={<RefreshCw size={16} />}>
            重試
          </Button>
        </div>
      ) : null}
    </div>
  );
}
