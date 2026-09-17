import type { AttendanceRecord, AttendanceStatus, LeaveType, PunchKind, Worker } from '@/types';
import { computeWorkedMinutes, isMissingCheckOut } from './hours';

/**
 * 打卡頁的一列：以「在職人員」為基底，left join 當日紀錄。
 * 尚未產生紀錄的人視為「出勤／未打卡」，第一次操作時服務層才真的建立紀錄。
 */
export interface RosterRow {
  worker: Worker;
  record: AttendanceRecord | null;
  status: AttendanceStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  note?: string;
  workedMinutes: number | null;
  missingCheckOut: boolean;
  punchState: PunchState;
}

/** 依狀態決定該列主要按鈕要顯示什麼。 */
export type PunchState =
  | 'idle' // 尚未上班打卡
  | 'working' // 已上班、未下班
  | 'done' // 已完成
  | 'blocked'; // 請假／未到，不可打卡

export function resolvePunchState(
  status: AttendanceStatus,
  checkInAt: string | null,
  checkOutAt: string | null,
): PunchState {
  if (status !== 'present') return 'blocked';
  if (!checkInAt) return 'idle';
  if (!checkOutAt) return 'working';
  return 'done';
}

export function buildRosterRow(worker: Worker, record: AttendanceRecord | null): RosterRow {
  const status: AttendanceStatus = record?.status ?? 'present';
  const checkInAt = record?.checkInAt ?? null;
  const checkOutAt = record?.checkOutAt ?? null;
  return {
    worker,
    record,
    status,
    checkInAt,
    checkOutAt,
    note: record?.note,
    workedMinutes: computeWorkedMinutes({ checkInAt, checkOutAt }),
    missingCheckOut: isMissingCheckOut({ status, checkInAt, checkOutAt }),
    punchState: resolvePunchState(status, checkInAt, checkOutAt),
  };
}

/** 領班排在最前面，其餘依姓名排序。 */
export function buildRoster(workers: Worker[], records: AttendanceRecord[]): RosterRow[] {
  const byWorkerId = new Map(records.map((record) => [record.workerId, record]));
  return workers
    .slice()
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'foreman' ? -1 : 1;
      return a.name.localeCompare(b.name, 'zh-Hant');
    })
    .map((worker) => buildRosterRow(worker, byWorkerId.get(worker.id) ?? null));
}

/**
 * 批次打卡只影響「尚未打卡且狀態為出勤」的人，已打卡者不覆蓋。
 * 下班批次則只影響「已上班但尚未下班」的人。
 */
export function selectBatchTargets(rows: RosterRow[], kind: PunchKind): RosterRow[] {
  if (kind === 'in') {
    return rows.filter((row) => row.status === 'present' && row.checkInAt === null);
  }
  return rows.filter(
    (row) => row.status === 'present' && row.checkInAt !== null && row.checkOutAt === null,
  );
}

export interface RosterSummary {
  total: number;
  checkedIn: number;
  checkedOut: number;
  present: number;
  leave: number;
  absent: number;
  missingCheckOut: number;
}

export function summarizeRoster(rows: RosterRow[]): RosterSummary {
  return rows.reduce<RosterSummary>(
    (acc, row) => {
      acc.total += 1;
      if (row.status === 'present') acc.present += 1;
      if (row.status === 'leave') acc.leave += 1;
      if (row.status === 'absent') acc.absent += 1;
      if (row.checkInAt) acc.checkedIn += 1;
      if (row.checkOutAt) acc.checkedOut += 1;
      if (row.missingCheckOut) acc.missingCheckOut += 1;
      return acc;
    },
    {
      total: 0,
      checkedIn: 0,
      checkedOut: 0,
      present: 0,
      leave: 0,
      absent: 0,
      missingCheckOut: 0,
    },
  );
}

/**
 * 時間驗證：下班不得早於或等於上班。
 * 跨夜班的下班時間雖然「時鐘上比較小」，但 ISO 瞬間仍較晚，因此以絕對時間比較。
 */
export function validatePunchTimes(
  checkInAt: string | null | undefined,
  checkOutAt: string | null | undefined,
): string | null {
  if (!checkInAt && checkOutAt) return '尚未打上班卡，不能只填下班時間';
  if (!checkInAt || !checkOutAt) return null;
  const inMs = new Date(checkInAt).getTime();
  const outMs = new Date(checkOutAt).getTime();
  if (Number.isNaN(inMs) || Number.isNaN(outMs)) return '時間格式不正確';
  if (outMs <= inMs) return '下班時間必須晚於上班時間';
  if (outMs - inMs > 20 * 60 * 60 * 1000) return '單日工時超過 20 小時，請確認時間是否正確';
  return null;
}

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: '出勤',
  leave: '請假',
  absent: '未到',
};

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  annual: '特休',
  personal: '事假',
  sick: '病假',
  other: '其他',
};
