import { useMemo, useState } from 'react';
import { Download, FileBarChart } from 'lucide-react';
import { summarizeByWorker, totalsOf } from '@/lib/report';
import { shiftWorkDate, todayWorkDate } from '@/lib/date';
import { buildExportFileName, downloadCsv, summaryToCsv } from '@/lib/export';
import { toErrorMessage } from '@/lib/errors';
import { Button } from '@/components/Button';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/Feedback';
import { useToast } from '@/components/toast';
import { useCrews } from '@/features/crews/queries';
import { useWorkers } from '@/features/workers/queries';
import { useAttendanceList } from '@/features/attendance/queries';
import { RangeFilter, type RangeFilterValue } from './RangeFilter';

const today = todayWorkDate();

/** 當月第一天。 */
function firstOfMonth(workDate: string): string {
  return `${workDate.slice(0, 7)}-01`;
}

export function AdminReportsPage() {
  const [filter, setFilter] = useState<RangeFilterValue>({
    from: firstOfMonth(today),
    to: today,
    crewId: '',
  });

  const toast = useToast();
  const crewsQuery = useCrews();
  const workersQuery = useWorkers();
  const attendanceQuery = useAttendanceList({
    from: filter.from,
    to: filter.to,
    crewId: filter.crewId || undefined,
  });

  const rows = useMemo(
    () => summarizeByWorker(attendanceQuery.data ?? [], workersQuery.data ?? [], crewsQuery.data ?? []),
    [attendanceQuery.data, workersQuery.data, crewsQuery.data],
  );
  const totals = useMemo(() => totalsOf(rows), [rows]);

  const handleExport = () => {
    if (rows.length === 0) {
      toast.error('目前條件下沒有資料可以匯出');
      return;
    }
    downloadCsv(buildExportFileName('summary', filter.from, filter.to), summaryToCsv(rows));
    toast.success(`已匯出 ${rows.length} 位人員的統計`);
  };

  const lastMonth = shiftWorkDate(firstOfMonth(today), -1);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">工時統計</h1>
        <Button variant="secondary" icon={<Download size={16} />} onClick={handleExport}>
          匯出 CSV
        </Button>
      </header>

      <RangeFilter
        value={filter}
        onChange={setFilter}
        presets={[
          { label: '本月', apply: () => ({ ...filter, from: firstOfMonth(today), to: today }) },
          {
            label: '上個月',
            apply: () => ({ ...filter, from: firstOfMonth(lastMonth), to: lastMonth }),
          },
        ]}
      />

      {attendanceQuery.isLoading ? (
        <ListSkeleton rows={5} />
      ) : attendanceQuery.isError ? (
        <ErrorState
          message={toErrorMessage(attendanceQuery.error)}
          onRetry={() => void attendanceQuery.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<FileBarChart size={36} strokeWidth={1.5} />}
          title="這段期間沒有可統計的資料"
          description="換個日期區間或工班，或確認該期間是否有打卡紀錄。"
        />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-line bg-surface p-3">
              <p className="tnum text-2xl font-bold text-ink">{totals.workers}</p>
              <p className="text-xs font-semibold text-ink-soft">人員</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3">
              <p className="tnum text-2xl font-bold text-present">{totals.presentDays}</p>
              <p className="text-xs font-semibold text-ink-soft">出勤人日</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3">
              <p className="tnum text-2xl font-bold text-ink">{totals.totalHours}</p>
              <p className="text-xs font-semibold text-ink-soft">總工時</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3">
              <p className="tnum text-2xl font-bold text-leave">{totals.missingCheckOutCount}</p>
              <p className="text-xs font-semibold text-ink-soft">未打下班</p>
            </div>
          </section>

          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-soft">
                  <th className="px-3 py-2 font-semibold">工班</th>
                  <th className="px-3 py-2 font-semibold">姓名</th>
                  <th className="px-3 py-2 text-right font-semibold">出勤</th>
                  <th className="px-3 py-2 text-right font-semibold">請假</th>
                  <th className="px-3 py-2 text-right font-semibold">未到</th>
                  <th className="px-3 py-2 text-right font-semibold">假日出勤</th>
                  <th className="px-3 py-2 text-right font-semibold">總工時</th>
                  <th className="px-3 py-2 text-right font-semibold">未打下班</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.workerId} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 text-ink-soft">{row.crewName}</td>
                    <td className="px-3 py-2 font-semibold text-ink">{row.workerName}</td>
                    <td className="tnum px-3 py-2 text-right text-ink">{row.presentDays}</td>
                    <td className="tnum px-3 py-2 text-right text-ink">{row.leaveDays}</td>
                    <td className="tnum px-3 py-2 text-right text-ink">{row.absentDays}</td>
                    <td className="tnum px-3 py-2 text-right text-ink">{row.holidayWorkDays}</td>
                    <td className="tnum px-3 py-2 text-right font-bold text-ink">{row.totalHours}</td>
                    <td className="tnum px-3 py-2 text-right text-leave">{row.missingCheckOutCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-ink-mute">
            工時 = 下班時間 − 上班時間；只打上班沒打下班的日子工時以 0 計，另列於「未打下班」。
            工班沒有固定休假日，因此不計算出勤率；國定假日僅作標注。
          </p>
        </>
      )}
    </div>
  );
}
