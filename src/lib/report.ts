import type { AttendanceRecord, Crew, Worker } from '@/types';
import { computeWorkedMinutes, isMissingCheckOut, minutesToHours } from './hours';
import { isWorkday } from './calendar';

export interface ReportRange {
  from: string;
  to: string;
}

export interface WorkerReportRow {
  workerId: string;
  workerName: string;
  employeeNo: string;
  crewId: string;
  crewName: string;
  /** 狀態為出勤且有打上班卡的天數。 */
  presentDays: number;
  leaveDays: number;
  absentDays: number;
  /** 出勤日落在國定假日或週末的天數。工班沒有固定休假日，此欄位只作標注用。 */
  holidayWorkDays: number;
  totalMinutes: number;
  totalHours: number;
  /** 只打上班沒打下班的筆數，工時以 0 計。 */
  missingCheckOutCount: number;
}

export interface ReportTotals {
  workers: number;
  presentDays: number;
  leaveDays: number;
  absentDays: number;
  holidayWorkDays: number;
  totalHours: number;
  missingCheckOutCount: number;
}

/**
 * 依日期區間 + 工班統計每位人員的出勤天數、總工時與請假次數。
 *
 * 不計算「應出勤天數」與「出勤率」：工班沒有固定的休假日，
 * 出勤與否由實際派工決定，算出來的比率沒有意義。
 * 國定假日只在月曆與明細上標注，不影響統計。
 */
export function summarizeByWorker(
  records: AttendanceRecord[],
  workers: Worker[],
  crews: Crew[],
): WorkerReportRow[] {
  const workerById = new Map(workers.map((worker) => [worker.id, worker]));
  const crewById = new Map(crews.map((crew) => [crew.id, crew]));
  const rows = new Map<string, WorkerReportRow>();

  for (const record of records) {
    const worker = workerById.get(record.workerId);
    if (!worker) continue;

    let row = rows.get(record.workerId);
    if (!row) {
      row = {
        workerId: worker.id,
        workerName: worker.name,
        employeeNo: worker.employeeNo ?? '',
        crewId: record.crewId,
        crewName: crewById.get(record.crewId)?.name ?? '（未指派）',
        presentDays: 0,
        leaveDays: 0,
        absentDays: 0,
        holidayWorkDays: 0,
        totalMinutes: 0,
        totalHours: 0,
        missingCheckOutCount: 0,
      };
      rows.set(record.workerId, row);
    }

    if (record.status === 'leave') row.leaveDays += 1;
    if (record.status === 'absent') row.absentDays += 1;
    if (record.status === 'present' && record.checkInAt) {
      row.presentDays += 1;
      if (!isWorkday(record.workDate)) row.holidayWorkDays += 1;
    }
    if (isMissingCheckOut(record)) row.missingCheckOutCount += 1;

    const minutes = computeWorkedMinutes(record);
    if (minutes !== null) row.totalMinutes += minutes;
  }

  return [...rows.values()]
    .map((row) => ({ ...row, totalHours: minutesToHours(row.totalMinutes) }))
    .sort(
      (a, b) =>
        a.crewName.localeCompare(b.crewName, 'zh-Hant') ||
        a.workerName.localeCompare(b.workerName, 'zh-Hant'),
    );
}

export function totalsOf(rows: WorkerReportRow[]): ReportTotals {
  return rows.reduce<ReportTotals>(
    (acc, row) => ({
      workers: acc.workers + 1,
      presentDays: acc.presentDays + row.presentDays,
      leaveDays: acc.leaveDays + row.leaveDays,
      absentDays: acc.absentDays + row.absentDays,
      holidayWorkDays: acc.holidayWorkDays + row.holidayWorkDays,
      totalHours: Math.round((acc.totalHours + row.totalHours) * 100) / 100,
      missingCheckOutCount: acc.missingCheckOutCount + row.missingCheckOutCount,
    }),
    {
      workers: 0,
      presentDays: 0,
      leaveDays: 0,
      absentDays: 0,
      holidayWorkDays: 0,
      totalHours: 0,
      missingCheckOutCount: 0,
    },
  );
}
