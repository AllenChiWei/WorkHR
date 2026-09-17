import { differenceInMinutes } from 'date-fns';
import type { AttendanceRecord } from '@/types';

/**
 * 工時是衍生值，一律由 checkOutAt - checkInAt 計算，不存進資料。
 * 只打上班沒打下班（異常資料）回傳 null，報表以 0 工時計並另計異常筆數。
 */
export function computeWorkedMinutes(
  record: Pick<AttendanceRecord, 'checkInAt' | 'checkOutAt'>,
): number | null {
  if (!record.checkInAt || !record.checkOutAt) return null;
  const minutes = differenceInMinutes(new Date(record.checkOutAt), new Date(record.checkInAt));
  return minutes > 0 ? minutes : null;
}

/** 分鐘換算成小時，四捨五入到小數第 2 位。 */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/** 顯示用工時，例如「8 小時 30 分」。 */
export function formatWorkedDuration(minutes: number | null): string {
  if (minutes === null) return '--';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} 分`;
  if (rest === 0) return `${hours} 小時`;
  return `${hours} 小時 ${rest} 分`;
}

/** 已上班但未打下班：需要在清單與報表中標示的異常。 */
export function isMissingCheckOut(
  record: Pick<AttendanceRecord, 'status' | 'checkInAt' | 'checkOutAt'>,
): boolean {
  return record.status === 'present' && record.checkInAt !== null && record.checkOutAt === null;
}
