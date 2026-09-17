import type { AttendanceStatus } from '@/types';
import { STATUS_LABEL } from '@/lib/attendance';

const STATUS_STYLE: Record<AttendanceStatus, string> = {
  present: 'bg-present-soft text-present',
  leave: 'bg-leave-soft text-leave',
  absent: 'bg-absent-soft text-absent',
};

export function StatusChip({ status, className = '' }: { status: AttendanceStatus; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[status]} ${className}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Chip({
  children,
  tone = 'idle',
}: {
  children: React.ReactNode;
  tone?: 'idle' | 'brand' | 'warn';
}) {
  const style =
    tone === 'brand'
      ? 'bg-brand-soft text-brand'
      : tone === 'warn'
        ? 'bg-leave-soft text-leave'
        : 'bg-idle-soft text-idle';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${style}`}>
      {children}
    </span>
  );
}
