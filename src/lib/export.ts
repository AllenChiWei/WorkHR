import type { AttendanceRecord, Crew, Worker } from '@/types';
import { formatClock } from './date';
import { computeWorkedMinutes, minutesToHours } from './hours';
import { STATUS_LABEL } from './attendance';
import { isWorkday, nonWorkdayReason } from './calendar';
import type { WorkerReportRow } from './report';

/** Excel 開啟 UTF-8 CSV 需要 BOM，否則中文亂碼。 */
const BOM = '﻿';

export type CsvCell = string | number | null | undefined;

/** 逗號、引號、換行都要用雙引號包起來並跳脫。 */
export function escapeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(','));
  return BOM + lines.join('\r\n');
}

export const ATTENDANCE_CSV_HEADERS = [
  '工作日',
  '日別',
  '工班',
  '姓名',
  '員工編號',
  '狀態',
  '上班',
  '下班',
  '工時',
  '備註',
];

/** 明細 CSV：一筆打卡紀錄一列。 */
export function attendanceToCsv(
  records: AttendanceRecord[],
  workers: Worker[],
  crews: Crew[],
): string {
  const workerById = new Map(workers.map((worker) => [worker.id, worker]));
  const crewById = new Map(crews.map((crew) => [crew.id, crew]));

  const rows = records
    .slice()
    .sort((a, b) => a.workDate.localeCompare(b.workDate) || a.crewId.localeCompare(b.crewId))
    .map((record) => {
      const minutes = computeWorkedMinutes(record);
      return [
        record.workDate,
        isWorkday(record.workDate) ? '工作日' : (nonWorkdayReason(record.workDate) ?? '非工作日'),
        crewById.get(record.crewId)?.name ?? '',
        workerById.get(record.workerId)?.name ?? '',
        workerById.get(record.workerId)?.employeeNo ?? '',
        STATUS_LABEL[record.status],
        formatClock(record.checkInAt),
        formatClock(record.checkOutAt),
        minutes === null ? 0 : minutesToHours(minutes),
        record.note ?? '',
      ];
    });

  return toCsv(ATTENDANCE_CSV_HEADERS, rows);
}

export const SUMMARY_CSV_HEADERS = [
  '工班',
  '姓名',
  '員工編號',
  '出勤天數',
  '請假次數',
  '未到次數',
  '假日出勤',
  '總工時',
  '未打下班筆數',
];

/** 彙總 CSV：一位人員一列。 */
export function summaryToCsv(rows: WorkerReportRow[]): string {
  return toCsv(
    SUMMARY_CSV_HEADERS,
    rows.map((row) => [
      row.crewName,
      row.workerName,
      row.employeeNo,
      row.presentDays,
      row.leaveDays,
      row.absentDays,
      row.holidayWorkDays,
      row.totalHours,
      row.missingCheckOutCount,
    ]),
  );
}

export function buildExportFileName(prefix: string, from: string, to: string): string {
  const compact = (value: string) => value.replaceAll('-', '');
  return `${prefix}_${compact(from)}-${compact(to)}.csv`;
}

/** 觸發瀏覽器下載；純字串組裝留在上面的函式，方便測試。 */
export function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
