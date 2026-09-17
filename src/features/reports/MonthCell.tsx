import type { AttendanceRecord } from '@/types';
import { formatClock, isWeekend } from '@/lib/date';
import { holidayName } from '@/lib/calendar';

interface MonthCellProps {
  /** null 代表月初／月底的補白格。 */
  workDate: string | null;
  record: AttendanceRecord | null;
  isToday: boolean;
}

const STATUS_STYLE = {
  present: 'bg-present-soft ring-present',
  leave: 'bg-leave-soft ring-leave',
  absent: 'bg-absent-soft ring-absent',
} as const;

/** 出勤月曆的一格：顯示日期、國定假日名稱與當天打卡時間。 */
export function MonthCell({ workDate, record, isToday }: MonthCellProps) {
  if (!workDate) return <div className="h-20 rounded-lg" />;

  const day = Number(workDate.slice(8, 10));
  const holiday = holidayName(workDate);
  const restDay = Boolean(holiday) || isWeekend(workDate);

  const tone = record ? STATUS_STYLE[record.status] : 'bg-surface-sunken ring-line-strong';

  return (
    <div
      className={`h-20 rounded-lg px-1.5 py-1 ring-1 ${tone} ${isToday ? 'outline-2 outline-brand' : ''}`}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span
          className={`tnum text-sm font-bold ${restDay ? 'text-absent' : 'text-ink'}`}
        >
          {day}
        </span>
        {isToday ? <span className="text-[10px] font-bold text-brand">今天</span> : null}
      </div>

      {holiday ? (
        <p className="truncate text-[10px] font-bold text-absent" title={holiday}>
          {holiday}
        </p>
      ) : null}

      {record ? (
        record.status === 'present' ? (
          <p className="tnum mt-0.5 text-[10px] leading-tight text-ink-soft">
            {formatClock(record.checkInAt)}
            <br />
            {formatClock(record.checkOutAt)}
          </p>
        ) : (
          <p className="mt-0.5 text-[10px] font-bold text-ink-soft">
            {record.status === 'leave' ? '請假' : '未到'}
          </p>
        )
      ) : null}
    </div>
  );
}
