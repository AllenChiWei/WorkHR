import { AlertTriangle, Check, ChevronRight, LogIn, LogOut } from 'lucide-react';
import type { RosterRow } from '@/lib/attendance';
import { formatClock } from '@/lib/date';
import { formatWorkedDuration } from '@/lib/hours';
import { StatusChip } from '@/components/StatusChip';
import { Button } from '@/components/Button';

interface RosterRowItemProps {
  row: RosterRow;
  /** 唯讀模式（過去日期）時所有編輯按鈕停用。 */
  readOnly: boolean;
  pending: boolean;
  onPunch: (row: RosterRow, kind: 'in' | 'out') => void;
  onOpenDetail: (row: RosterRow) => void;
}

/** 依打卡進度決定主要按鈕：上班 → 下班 → 已完成。 */
function PrimaryAction({
  row,
  readOnly,
  pending,
  onPunch,
}: Omit<RosterRowItemProps, 'onOpenDetail'>) {
  if (row.punchState === 'blocked') {
    return (
      <Button size="sm" variant="secondary" disabled>
        不可打卡
      </Button>
    );
  }

  if (row.punchState === 'done') {
    return (
      <Button size="sm" variant="secondary" disabled icon={<Check size={16} />}>
        已完成
      </Button>
    );
  }

  const isCheckIn = row.punchState === 'idle';
  return (
    <Button
      size="sm"
      variant={isCheckIn ? 'success' : 'primary'}
      disabled={readOnly}
      loading={pending}
      icon={isCheckIn ? <LogIn size={16} /> : <LogOut size={16} />}
      onClick={() => onPunch(row, isCheckIn ? 'in' : 'out')}
    >
      {isCheckIn ? '上班' : '下班'}
    </Button>
  );
}

export function RosterRowItem({
  row,
  readOnly,
  pending,
  onPunch,
  onOpenDetail,
}: RosterRowItemProps) {
  return (
    <li className="rounded-xl border border-line bg-surface">
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={() => onOpenDetail(row)}
          className="tap min-w-0 flex-1 text-left"
          aria-label={`開啟 ${row.worker.name} 的詳細設定`}
        >
          <div className="flex items-center gap-2">
            <span className="truncate text-xl font-bold text-ink">{row.worker.name}</span>
            {row.worker.role === 'foreman' ? (
              <span className="shrink-0 rounded-md bg-brand-soft px-1.5 py-0.5 text-[11px] font-bold text-brand">
                領班
              </span>
            ) : null}
            <StatusChip status={row.status} />
            <ChevronRight size={16} className="shrink-0 text-ink-mute" />
          </div>

          <div className="tnum mt-1.5 flex items-center gap-3 text-sm text-ink-soft">
            <span>
              上班 <span className="font-semibold text-ink">{formatClock(row.checkInAt)}</span>
            </span>
            <span>
              下班 <span className="font-semibold text-ink">{formatClock(row.checkOutAt)}</span>
            </span>
            {row.workedMinutes !== null ? (
              <span className="text-ink-mute">{formatWorkedDuration(row.workedMinutes)}</span>
            ) : null}
          </div>

          {row.missingCheckOut ? (
            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-leave">
              <AlertTriangle size={13} />
              尚未打下班卡
            </p>
          ) : null}

          {row.note ? <p className="mt-1 truncate text-xs text-ink-mute">備註：{row.note}</p> : null}
        </button>

        <div className="shrink-0">
          <PrimaryAction row={row} readOnly={readOnly} pending={pending} onPunch={onPunch} />
        </div>
      </div>
    </li>
  );
}
