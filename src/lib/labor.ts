import { differenceInCalendarDays, differenceInMonths, format, parse, addDays, addMonths, addYears } from 'date-fns';

/**
 * 勞動基準法相關計算。
 *
 * 條文依據（全國法規資料庫，2026-09 查證）：
 *   §38  特別休假年資級距與天數、未休折發工資
 *   §30  出勤紀錄應逐日記載至分鐘，保存五年
 *   §32  單日正常＋延長工時上限 12 小時；每月延長工時上限 46 小時
 *   §36  每七日應有二日休息（一日例假、一日休息日）
 *
 * 這裡只做「計算與檢核」，不做自動扣薪或自動加班費，
 * 避免在工時制度尚未確認的情況下算出錯誤金額。
 */

/** 2026 年基本工資（勞動部 2025-09-26 公告，2026-01-01 生效）。 */
export const MINIMUM_WAGE = {
  monthly: 29_500,
  hourly: 196,
  /** 公告年度，換年度時要更新這整個物件。 */
  effectiveYear: 2026,
} as const;

/** 法定正常工時：每日 8 小時（§30）。 */
export const NORMAL_DAILY_HOURS = 8;
/** 單日正常＋延長工時上限（§32）。 */
export const MAX_DAILY_HOURS = 12;
/** 每月延長工時上限（§32）。 */
export const MAX_MONTHLY_OVERTIME_HOURS = 46;
/** 出勤紀錄保存年限（§30）。 */
export const ATTENDANCE_RETENTION_YEARS = 5;

/**
 * 日薪制對照基本工資的門檻：時薪 196 × 每日 8 小時。
 * 註：日薪制如何對照基本工資實務上有不同見解（亦有以月薪 ÷ 30 計算者），
 * 這裡採較保守的時薪換算，僅作為提醒用途，不作為法律意見。
 */
export const DAILY_WAGE_FLOOR = MINIMUM_WAGE.hourly * NORMAL_DAILY_HOURS;

function toDate(workDate: string): Date {
  return parse(workDate, 'yyyy-MM-dd', new Date());
}

function toWorkDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** 到職至指定日期的年資（月）。 */
export function serviceMonths(hireDate: string, asOf: string): number {
  return Math.max(0, differenceInMonths(toDate(asOf), toDate(hireDate)));
}

/** 年資的顯示字串，例如「2 年 6 個月」。 */
export function formatServiceLength(hireDate: string, asOf: string): string {
  const months = serviceMonths(hireDate, asOf);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} 個月`;
  if (rest === 0) return `${years} 年`;
  return `${years} 年 ${rest} 個月`;
}

/**
 * 依年資（滿幾年）取得特別休假天數（§38 第 1 項）。
 * 未滿一年者請改用 annualLeaveEntitlement，因為六個月以上未滿一年是 3 日。
 */
export function annualLeaveDaysByYears(years: number): number {
  if (years < 1) return 0;
  if (years < 2) return 7;
  if (years < 3) return 10;
  if (years < 5) return 14;
  if (years < 10) return 15;
  // 十年以上，每滿一年加給一日，加至三十日為止
  return Math.min(15 + (years - 9), 30);
}

export interface LeaveYear {
  /** 本特休年度的起訖日（採週年制，以到職日起算）。 */
  from: string;
  to: string;
  /** 本年度應給特休天數。 */
  entitledDays: number;
  /** 年資尚未滿六個月時為 true，此時尚無特休。 */
  notYetEligible: boolean;
  /** 說明文字，用於畫面提示。 */
  basis: string;
}

/**
 * 計算目前所處的特休年度與應給天數（週年制）。
 *
 * 週年制是勞基法的法定基準（以個人到職日起算）；
 * 若改採曆年制或其他制度，依 §38 需經勞雇協商，屆時要改這個函式。
 */
export function annualLeaveEntitlement(hireDate: string, asOf: string): LeaveYear {
  const hire = toDate(hireDate);
  const months = serviceMonths(hireDate, asOf);

  if (months < 6) {
    return {
      from: hireDate,
      to: toWorkDate(addDays(addMonths(hire, 6), -1)),
      entitledDays: 0,
      notYetEligible: true,
      basis: '年資未滿六個月，依 §38 尚無特別休假',
    };
  }

  if (months < 12) {
    return {
      from: toWorkDate(addMonths(hire, 6)),
      to: toWorkDate(addDays(addYears(hire, 1), -1)),
      entitledDays: 3,
      notYetEligible: false,
      basis: '六個月以上一年未滿：3 日',
    };
  }

  const years = Math.floor(months / 12);
  const from = addYears(hire, years);
  return {
    from: toWorkDate(from),
    to: toWorkDate(addDays(addYears(from, 1), -1)),
    entitledDays: annualLeaveDaysByYears(years),
    notYetEligible: false,
    basis: `年資滿 ${years} 年：${annualLeaveDaysByYears(years)} 日`,
  };
}

/** 出勤紀錄依 §30 應保存五年；早於這個日期的資料才可以刪除。 */
export function attendanceRetentionCutoff(asOf: string): string {
  return toWorkDate(addYears(toDate(asOf), -ATTENDANCE_RETENTION_YEARS));
}

/** 連續出勤天數：回傳區間內最長的連續出勤日數（§36 七休一檢核用）。 */
export function longestConsecutiveWorkDays(workDates: string[]): number {
  if (workDates.length === 0) return 0;
  const sorted = [...new Set(workDates)].sort();
  let longest = 1;
  let current = 1;

  for (let index = 1; index < sorted.length; index += 1) {
    const gap = differenceInCalendarDays(toDate(sorted[index]!), toDate(sorted[index - 1]!));
    current = gap === 1 ? current + 1 : 1;
    if (current > longest) longest = current;
  }
  return longest;
}
