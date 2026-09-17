import { eachWorkDate, isWeekend } from './date';

/**
 * 工作日曆：決定報表裡的「應出勤天數」。
 *
 * 規則：週六、週日與國定假日為非工作日；補班日雖然是週末仍算工作日。
 *
 * ⚠️ 下面的假日表是依一般年度慣例先填的基準值，**上線前請依行政院人事行政總處
 * 當年度公告校正**（尤其是春節長度、彈性放假與補班日，每年都不同）。
 * 這張表刻意集中在單一檔案，校正時只需要改這裡，不影響其他程式碼；
 * 日後接後端時，建議改由 API 提供，讓管理員可以自行維護。
 */
export const HOLIDAYS: Readonly<Record<string, string>> = {
  // ---- 2026 ----
  '2026-01-01': '開國紀念日',
  '2026-01-02': '彈性放假',
  '2026-02-16': '除夕',
  '2026-02-17': '春節',
  '2026-02-18': '春節',
  '2026-02-19': '春節',
  '2026-02-20': '春節彈性放假',
  '2026-02-27': '和平紀念日彈性放假',
  '2026-02-28': '和平紀念日',
  '2026-04-03': '兒童節補假',
  '2026-04-04': '兒童節',
  '2026-04-05': '清明節',
  '2026-04-06': '清明節補假',
  '2026-05-01': '勞動節',
  '2026-06-19': '端午節',
  '2026-09-25': '中秋節',
  '2026-09-28': '教師節',
  '2026-10-09': '國慶日補假',
  '2026-10-10': '國慶日',
  '2026-10-26': '台灣光復節補假',
  '2026-12-25': '行憲紀念日',
  // ---- 2025 年末（跨年度查詢用）----
  '2025-12-25': '行憲紀念日',
};

/** 補班日：日期落在週末但仍須上班（通常對應彈性放假）。 */
export const MAKEUP_WORKDAYS: readonly string[] = ['2026-02-14', '2026-09-26'];

const makeupSet = new Set(MAKEUP_WORKDAYS);

export function holidayName(workDate: string): string | null {
  return HOLIDAYS[workDate] ?? null;
}

export function isHoliday(workDate: string): boolean {
  return workDate in HOLIDAYS;
}

export function isMakeupWorkday(workDate: string): boolean {
  return makeupSet.has(workDate);
}

/** 是否為應出勤的工作日。 */
export function isWorkday(workDate: string): boolean {
  if (isHoliday(workDate)) return false;
  if (isMakeupWorkday(workDate)) return true;
  return !isWeekend(workDate);
}

/** 非工作日的原因，用於畫面上標註。 */
export function nonWorkdayReason(workDate: string): string | null {
  const name = holidayName(workDate);
  if (name) return name;
  if (isMakeupWorkday(workDate)) return null;
  if (isWeekend(workDate)) return '例假日';
  return null;
}

/** 區間內的應出勤天數（閉區間）。 */
export function countWorkdays(from: string, to: string): number {
  return eachWorkDate(from, to).filter(isWorkday).length;
}

export function listWorkdays(from: string, to: string): string[] {
  return eachWorkDate(from, to).filter(isWorkday);
}
