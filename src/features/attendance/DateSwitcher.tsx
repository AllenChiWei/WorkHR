import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { formatWorkDateLabel, shiftWorkDate, todayWorkDate } from '@/lib/date';
import { holidayName } from '@/lib/calendar';

interface DateSwitcherProps {
  workDate: string;
  onChange: (workDate: string) => void;
  /** 不允許切到未來日期。 */
  maxDate?: string;
}

export function DateSwitcher({ workDate, onChange, maxDate = todayWorkDate() }: DateSwitcherProps) {
  const canGoForward = workDate < maxDate;
  const holiday = holidayName(workDate);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="前一天"
        onClick={() => onChange(shiftWorkDate(workDate, -1))}
        className="tap flex items-center justify-center rounded-xl border border-line-strong bg-surface text-ink-soft hover:bg-surface-sunken"
      >
        <ChevronLeft size={22} />
      </button>

      <div className="flex-1 text-center">
        <p className="text-lg font-bold text-ink">{formatWorkDateLabel(workDate)}</p>
        {holiday ? <p className="text-xs font-semibold text-leave">{holiday}</p> : null}
      </div>

      <button
        type="button"
        aria-label="後一天"
        disabled={!canGoForward}
        onClick={() => onChange(shiftWorkDate(workDate, 1))}
        className="tap flex items-center justify-center rounded-xl border border-line-strong bg-surface text-ink-soft hover:bg-surface-sunken disabled:opacity-35"
      >
        <ChevronRight size={22} />
      </button>

      <button
        type="button"
        aria-label="回到今天"
        disabled={workDate === maxDate}
        onClick={() => onChange(maxDate)}
        className="tap flex items-center justify-center rounded-xl border border-line-strong bg-surface px-3 text-sm font-semibold text-ink-soft hover:bg-surface-sunken disabled:opacity-35"
      >
        <CalendarDays size={18} />
      </button>
    </div>
  );
}
