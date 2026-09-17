import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight, HardHat } from 'lucide-react';
import { buildRoster, summarizeRoster } from '@/lib/attendance';
import { formatWorkDateLabel, todayWorkDate } from '@/lib/date';
import { holidayName } from '@/lib/calendar';
import { toErrorMessage } from '@/lib/errors';
import { Button } from '@/components/Button';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/Feedback';
import { useCrews } from '@/features/crews/queries';
import { useWorkers } from '@/features/workers/queries';
import { useAttendanceList } from '@/features/attendance/queries';

export function AdminDashboard() {
  const workDate = todayWorkDate();
  const crewsQuery = useCrews();
  const workersQuery = useWorkers({ active: true });
  const attendanceQuery = useAttendanceList({ from: workDate, to: workDate });

  const isLoading = crewsQuery.isLoading || workersQuery.isLoading || attendanceQuery.isLoading;
  const isError = crewsQuery.isError || workersQuery.isError || attendanceQuery.isError;

  const perCrew = useMemo(() => {
    const crews = (crewsQuery.data ?? []).filter((crew) => crew.active);
    const workers = workersQuery.data ?? [];
    const records = attendanceQuery.data ?? [];

    return crews.map((crew) => {
      const rows = buildRoster(
        workers.filter((worker) => worker.crewId === crew.id),
        records.filter((record) => record.crewId === crew.id),
      );
      return { crew, summary: summarizeRoster(rows) };
    });
  }, [crewsQuery.data, workersQuery.data, attendanceQuery.data]);

  const totals = useMemo(
    () =>
      perCrew.reduce(
        (acc, item) => ({
          total: acc.total + item.summary.total,
          checkedIn: acc.checkedIn + item.summary.checkedIn,
          checkedOut: acc.checkedOut + item.summary.checkedOut,
          leave: acc.leave + item.summary.leave,
          absent: acc.absent + item.summary.absent,
          missingCheckOut: acc.missingCheckOut + item.summary.missingCheckOut,
        }),
        { total: 0, checkedIn: 0, checkedOut: 0, leave: 0, absent: 0, missingCheckOut: 0 },
      ),
    [perCrew],
  );

  const holiday = holidayName(workDate);

  if (isLoading) return <ListSkeleton rows={4} />;
  if (isError) {
    return (
      <ErrorState
        message={toErrorMessage(crewsQuery.error ?? workersQuery.error ?? attendanceQuery.error)}
        onRetry={() => {
          void crewsQuery.refetch();
          void workersQuery.refetch();
          void attendanceQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-ink">今日出勤概況</h1>
        <p className="text-sm text-ink-soft">
          {formatWorkDateLabel(workDate)}
          {holiday ? <span className="ml-2 font-semibold text-leave">{holiday}</span> : null}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="tnum text-2xl font-bold text-present">{totals.checkedIn}</p>
          <p className="text-xs font-semibold text-ink-soft">已上班 / 共 {totals.total} 人</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="tnum text-2xl font-bold text-ink">{totals.checkedOut}</p>
          <p className="text-xs font-semibold text-ink-soft">已下班</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="tnum text-2xl font-bold text-leave">{totals.leave}</p>
          <p className="text-xs font-semibold text-ink-soft">請假</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="tnum text-2xl font-bold text-absent">{totals.absent}</p>
          <p className="text-xs font-semibold text-ink-soft">未到</p>
        </div>
      </section>

      {totals.missingCheckOut > 0 ? (
        <p className="flex items-center gap-2 rounded-xl bg-leave-soft px-3 py-2 text-sm font-semibold text-leave">
          <AlertTriangle size={16} />
          今日有 {totals.missingCheckOut} 人已上班但尚未打下班卡
        </p>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-ink">各工班</h2>
        {perCrew.length === 0 ? (
          <EmptyState
            icon={<HardHat size={36} strokeWidth={1.5} />}
            title="尚未建立任何工班"
            description="建立工班並加入成員後，這裡就會顯示每日出勤概況。"
            action={
              <Link to="/admin/crews">
                <Button>前往工班管理</Button>
              </Link>
            }
          />
        ) : (
          <ul className="space-y-2">
            {perCrew.map(({ crew, summary }) => (
              <li key={crew.id}>
                <Link
                  to={`/admin/crews/${crew.id}`}
                  className="tap flex items-center gap-3 rounded-xl border border-line bg-surface p-4 hover:bg-surface-sunken"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-ink">{crew.name}</p>
                    <p className="tnum mt-1 text-sm text-ink-soft">
                      已上班 <span className="font-bold text-present">{summary.checkedIn}</span> ／
                      共 {summary.total} 人
                      {summary.leave > 0 ? <span className="ml-2">請假 {summary.leave}</span> : null}
                      {summary.absent > 0 ? <span className="ml-2">未到 {summary.absent}</span> : null}
                    </p>
                  </div>
                  <ChevronRight size={20} className="shrink-0 text-ink-mute" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
