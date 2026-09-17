import { useMemo } from 'react';
import { buildRoster, summarizeRoster, type RosterRow } from '@/lib/attendance';
import { todayWorkDate } from '@/lib/date';
import { useWorkers } from '@/features/workers/queries';
import { useDailyAttendance } from './queries';

/**
 * 把「在職人員」與「當日紀錄」合成打卡頁需要的一列一列資料。
 * 沒有紀錄的人視為出勤／未打卡，第一次操作時服務層才真的建立紀錄。
 */
export function useRoster(crewId: string | undefined, workDate: string) {
  const workersQuery = useWorkers(crewId ? { crewId, active: true } : undefined);
  const attendanceQuery = useDailyAttendance(crewId, workDate);

  const rows: RosterRow[] = useMemo(
    () => buildRoster(workersQuery.data ?? [], attendanceQuery.data ?? []),
    [workersQuery.data, attendanceQuery.data],
  );

  const summary = useMemo(() => summarizeRoster(rows), [rows]);

  return {
    rows,
    summary,
    isLoading: workersQuery.isLoading || attendanceQuery.isLoading,
    isError: workersQuery.isError || attendanceQuery.isError,
    error: workersQuery.error ?? attendanceQuery.error,
    refetch: () => {
      void workersQuery.refetch();
      void attendanceQuery.refetch();
    },
    /** 過去日期一律唯讀，只有管理員能在其他頁面修改。 */
    isPast: workDate < todayWorkDate(),
  };
}
