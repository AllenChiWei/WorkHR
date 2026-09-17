import { useMemo } from 'react';
import type { Advance, AttendanceRecord, ExtraPay, Worker } from '@/types';
import { computeWorkedMinutes } from '@/lib/hours';
import { daysInMonth } from '@/lib/date';
import {
  advanceDeduction,
  advanceOutstanding,
  calcMonthlyPay,
  sumExtraPay,
  type AttendanceTally,
  type PayrollBreakdown,
} from '@/lib/payroll';
import { checkWorkerMonth, checkWorkerProfile, type ComplianceIssue } from '@/lib/compliance';
import { annualLeaveEntitlement, type LeaveYear } from '@/lib/labor';
import { useWorkers } from '@/features/workers/queries';
import { useAttendanceList } from '@/features/attendance/queries';
import { useAdvances, useExtraPays } from './queries';

export interface PayrollRow {
  worker: Worker;
  tally: AttendanceTally;
  extraPays: ExtraPay[];
  /** 當月要扣款的借支，以及各自的扣款金額。 */
  advances: { advance: Advance; deduction: number; outstanding: number }[];
  breakdown: PayrollBreakdown;
  issues: ComplianceIssue[];
  /** 本特休年度資訊；未填到職日時為 null。 */
  leaveYear: LeaveYear | null;
  /** 本特休年度內已使用的特休天數。 */
  annualLeaveUsed: number;
}

function tallyOf(records: AttendanceRecord[]): AttendanceTally {
  return records.reduce<AttendanceTally>(
    (acc, record) => {
      if (record.status === 'present') {
        if (record.checkInAt) acc.presentDays += 1;
        acc.workedMinutes += computeWorkedMinutes(record) ?? 0;
      } else if (record.status === 'absent') {
        acc.absentDays += 1;
      } else {
        switch (record.leaveType) {
          case 'annual':
            acc.annualLeaveDays += 1;
            break;
          case 'sick':
            acc.sickLeaveDays += 1;
            break;
          case 'personal':
            acc.personalLeaveDays += 1;
            break;
          default:
            acc.otherLeaveDays += 1;
        }
      }
      return acc;
    },
    {
      presentDays: 0,
      annualLeaveDays: 0,
      sickLeaveDays: 0,
      personalLeaveDays: 0,
      otherLeaveDays: 0,
      absentDays: 0,
      workedMinutes: 0,
    },
  );
}

export interface PayrollMonthFilter {
  crewId?: string;
  /** 只算單一人員（出勤月曆用）。 */
  workerId?: string;
}

/**
 * 組出某個月份的薪資試算表。
 *
 * 全部由當月出勤紀錄即時計算，不存任何薪資快照，
 * 因此領班今天打的卡，管理員重新整理就會反映在金額上。
 *
 * 特休已使用天數是以「特休年度」為範圍計算（不是當月），
 * 因為特休餘額依 §38 是按年資週年計算的。
 */
export function usePayrollMonth(month: string, filter: PayrollMonthFilter = {}) {
  const { crewId, workerId } = filter;
  const from = `${month}-01`;
  const to = `${month}-${String(daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)))).padStart(2, '0')}`;

  const workersQuery = useWorkers();
  const monthRecordsQuery = useAttendanceList({
    from,
    to,
    crewId: crewId || undefined,
    workerId: workerId || undefined,
  });
  const advancesQuery = useAdvances(workerId ? { workerId } : undefined);
  const extraPaysQuery = useExtraPays(workerId ? { workerId, month } : { month });

  // 特休餘額要看整個特休年度，範圍可能跨年，這裡多抓兩年份
  const leaveWindow = useAttendanceList({
    from: `${Number(month.slice(0, 4)) - 1}-01-01`,
    to: `${Number(month.slice(0, 4)) + 1}-12-31`,
    status: 'leave',
    workerId: workerId || undefined,
  });

  const rows: PayrollRow[] = useMemo(() => {
    const workers = (workersQuery.data ?? []).filter((worker) => {
      if (workerId) return worker.id === workerId;
      return worker.active && (!crewId || worker.crewId === crewId);
    });
    const records = monthRecordsQuery.data ?? [];
    const advances = advancesQuery.data ?? [];
    const extraPays = extraPaysQuery.data ?? [];
    const leaveRecords = leaveWindow.data ?? [];

    return workers.map((worker) => {
      const workerRecords = records.filter((record) => record.workerId === worker.id);
      const tally = tallyOf(workerRecords);

      const workerExtras = extraPays.filter((entry) => entry.workerId === worker.id);
      const extraTotal = sumExtraPay(workerExtras);

      const workerAdvances = advances
        .filter((advance) => advance.workerId === worker.id)
        .map((advance) => ({
          advance,
          deduction: advanceDeduction(advance, month),
          outstanding: advanceOutstanding(advance, month),
        }));
      const deductionTotal = workerAdvances.reduce((sum, item) => sum + item.deduction, 0);

      const leaveYear = worker.hireDate ? annualLeaveEntitlement(worker.hireDate, to) : null;
      const annualLeaveUsed = leaveYear
        ? leaveRecords.filter(
            (record) =>
              record.workerId === worker.id &&
              record.leaveType === 'annual' &&
              record.workDate >= leaveYear.from &&
              record.workDate <= leaveYear.to,
          ).length
        : 0;

      return {
        worker,
        tally,
        extraPays: workerExtras,
        advances: workerAdvances,
        breakdown: calcMonthlyPay(worker.dailyWage ?? 0, tally, extraTotal, deductionTotal),
        issues: [...checkWorkerProfile(worker), ...checkWorkerMonth(workerRecords)],
        leaveYear,
        annualLeaveUsed,
      };
    });
  }, [
    workersQuery.data,
    monthRecordsQuery.data,
    advancesQuery.data,
    extraPaysQuery.data,
    leaveWindow.data,
    crewId,
    workerId,
    month,
    to,
  ]);

  return {
    rows,
    range: { from, to },
    isLoading:
      workersQuery.isLoading ||
      monthRecordsQuery.isLoading ||
      advancesQuery.isLoading ||
      extraPaysQuery.isLoading,
    isError:
      workersQuery.isError ||
      monthRecordsQuery.isError ||
      advancesQuery.isError ||
      extraPaysQuery.isError,
    error:
      workersQuery.error ?? monthRecordsQuery.error ?? advancesQuery.error ?? extraPaysQuery.error,
    refetch: () => {
      void workersQuery.refetch();
      void monthRecordsQuery.refetch();
      void advancesQuery.refetch();
      void extraPaysQuery.refetch();
      void leaveWindow.refetch();
    },
  };
}
