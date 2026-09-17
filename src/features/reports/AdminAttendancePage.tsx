import { useMemo, useState } from 'react';
import { CalendarRange, Download, Pencil } from 'lucide-react';
import type { AttendanceRecord } from '@/types';
import { buildRosterRow, type RosterRow } from '@/lib/attendance';
import { formatClock, shiftWorkDate, todayWorkDate } from '@/lib/date';
import { computeWorkedMinutes, formatWorkedDuration } from '@/lib/hours';
import { holidayName } from '@/lib/calendar';
import { attendanceToCsv, buildExportFileName, downloadCsv } from '@/lib/export';
import { toErrorMessage } from '@/lib/errors';
import { Button } from '@/components/Button';
import { StatusChip } from '@/components/StatusChip';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/Feedback';
import { useToast } from '@/components/toast';
import { useCrews } from '@/features/crews/queries';
import { useWorkers } from '@/features/workers/queries';
import { useAttendanceList } from '@/features/attendance/queries';
import { EditPunchSheet } from '@/features/attendance/EditPunchSheet';
import { RangeFilter, type RangeFilterValue } from './RangeFilter';

const today = todayWorkDate();

export function AdminAttendancePage() {
  const [filter, setFilter] = useState<RangeFilterValue>({
    from: shiftWorkDate(today, -13),
    to: today,
    crewId: '',
  });
  const [editing, setEditing] = useState<{ row: RosterRow; record: AttendanceRecord } | null>(null);

  const toast = useToast();
  const crewsQuery = useCrews();
  const workersQuery = useWorkers();
  const attendanceQuery = useAttendanceList({
    from: filter.from,
    to: filter.to,
    crewId: filter.crewId || undefined,
  });

  const workerById = useMemo(
    () => new Map((workersQuery.data ?? []).map((worker) => [worker.id, worker])),
    [workersQuery.data],
  );
  const crewNameById = useMemo(
    () => new Map((crewsQuery.data ?? []).map((crew) => [crew.id, crew.name])),
    [crewsQuery.data],
  );

  const records = attendanceQuery.data ?? [];

  const handleExport = () => {
    if (records.length === 0) {
      toast.error('目前條件下沒有資料可以匯出');
      return;
    }
    downloadCsv(
      buildExportFileName('attendance', filter.from, filter.to),
      attendanceToCsv(records, workersQuery.data ?? [], crewsQuery.data ?? []),
    );
    toast.success(`已匯出 ${records.length} 筆明細`);
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">打卡紀錄</h1>
        <Button variant="secondary" icon={<Download size={16} />} onClick={handleExport}>
          匯出 CSV
        </Button>
      </header>

      <RangeFilter
        value={filter}
        onChange={setFilter}
        presets={[
          { label: '今天', apply: () => ({ ...filter, from: today, to: today }) },
          { label: '近 7 天', apply: () => ({ ...filter, from: shiftWorkDate(today, -6), to: today }) },
          { label: '近 30 天', apply: () => ({ ...filter, from: shiftWorkDate(today, -29), to: today }) },
        ]}
      />

      {attendanceQuery.isLoading ? (
        <ListSkeleton rows={6} />
      ) : attendanceQuery.isError ? (
        <ErrorState
          message={toErrorMessage(attendanceQuery.error)}
          onRetry={() => void attendanceQuery.refetch()}
        />
      ) : records.length === 0 ? (
        <EmptyState
          icon={<CalendarRange size={36} strokeWidth={1.5} />}
          title="這段期間沒有打卡紀錄"
          description="換個日期區間或工班看看，或確認該工班是否已經開始打卡。"
        />
      ) : (
        <>
          <p className="text-sm text-ink-soft">共 {records.length} 筆</p>
          <ul className="space-y-2">
            {records.map((record) => {
              const worker = workerById.get(record.workerId);
              const holiday = holidayName(record.workDate);
              const workedMinutes = computeWorkedMinutes(record);
              return (
                <li
                  key={record.id}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="tnum text-sm font-bold text-ink">{record.workDate}</span>
                      {holiday ? (
                        <span className="rounded-md bg-leave-soft px-1.5 py-0.5 text-[11px] font-bold text-leave">
                          {holiday}
                        </span>
                      ) : null}
                      <span className="truncate font-bold text-ink">{worker?.name ?? '（已刪除）'}</span>
                      <StatusChip status={record.status} />
                    </div>
                    <p className="tnum mt-1 text-xs text-ink-soft">
                      <span>{crewNameById.get(record.crewId) ?? '未知工班'}</span>
                      <span className="ml-2">
                        {formatClock(record.checkInAt)} – {formatClock(record.checkOutAt)}
                      </span>
                      <span className="ml-2">{formatWorkedDuration(workedMinutes)}</span>
                    </p>
                    {record.note ? (
                      <p className="mt-0.5 truncate text-xs text-ink-mute">備註：{record.note}</p>
                    ) : null}
                  </div>

                  {worker ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Pencil size={15} />}
                      onClick={() => setEditing({ row: buildRosterRow(worker, record), record })}
                    >
                      修改
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {editing ? (
        <EditPunchSheet
          row={editing.row}
          crewId={editing.record.crewId}
          workDate={editing.record.workDate}
          readOnly={false}
          // 這是管理員專屬頁面，本來就看得到也改得了時間
          showTimes
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
