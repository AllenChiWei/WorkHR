import type { RosterSummary } from '@/lib/attendance';

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex-1 rounded-xl bg-surface-sunken px-2 py-2 text-center">
      <p className={`tnum text-xl font-bold ${tone}`}>{value}</p>
      <p className="text-xs font-semibold text-ink-soft">{label}</p>
    </div>
  );
}

export function RosterSummaryBar({ summary }: { summary: RosterSummary }) {
  return (
    <div className="space-y-2">
      <p className="tnum text-sm font-semibold text-ink-soft">
        已上班 <span className="text-lg font-bold text-present">{summary.checkedIn}</span> ／ 共{' '}
        <span className="text-lg font-bold text-ink">{summary.total}</span> 人
        {summary.checkedOut > 0 ? (
          <span className="ml-3">已下班 {summary.checkedOut} 人</span>
        ) : null}
      </p>
      <div className="flex gap-2">
        <Stat label="出勤" value={summary.present} tone="text-present" />
        <Stat label="請假" value={summary.leave} tone="text-leave" />
        <Stat label="未到" value={summary.absent} tone="text-absent" />
        <Stat label="缺下班" value={summary.missingCheckOut} tone="text-ink-soft" />
      </div>
    </div>
  );
}
