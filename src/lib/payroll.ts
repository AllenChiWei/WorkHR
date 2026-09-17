import type { Advance, ExtraPay } from '@/types';

/**
 * 月薪試算。
 *
 * 公式（依 2026-09-17 與使用者確認的規則）：
 *   工資小計 = 日薪 × 出勤天數
 *            + 日薪 × 特休天數        （勞工請假規則：特休照給全薪）
 *            + 日薪 × 病假天數 × 0.5  （普通傷病假半薪）
 *   事假與其他假別不給薪。
 *   實領 = 工資小計 + 額外派遣加給 − 當月借支還款
 *
 * 不含加班費：工班只有早班、採日薪制，加班費需先確認工時制度才能正確計算，
 * 目前改以法遵警示提醒管理員（見 src/lib/compliance.ts）。
 */

/** 普通傷病假之工資折半發給。 */
export const SICK_LEAVE_PAY_RATE = 0.5;

/** 'YYYY-MM' 的月份相減，回傳相差幾個月（b - a）。 */
export function monthDiff(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split('-').map(Number) as [number, number];
  const [toYear, toMonth] = to.split('-').map(Number) as [number, number];
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

/** 'YYYY-MM' 加減月份。 */
export function shiftPayMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  const zeroBased = year * 12 + (monthNumber - 1) + delta;
  const nextYear = Math.floor(zeroBased / 12);
  const nextMonth = (zeroBased % 12) + 1;
  return `${nextYear}-${nextMonth.toString().padStart(2, '0')}`;
}

/** 工作日 'YYYY-MM-DD' 所屬的薪資月份。 */
export function payMonthOf(workDate: string): string {
  return workDate.slice(0, 7);
}

/** 截至指定月份（含）為止，這筆借支累計已還的金額。 */
export function repaidThrough(advance: Advance, month: string): number {
  if (advance.settledMonth && month >= advance.settledMonth) return advance.amount;

  const elapsed = monthDiff(advance.startMonth, month) + 1;
  if (elapsed <= 0) return Math.min(advance.amount, Math.max(0, advance.repaidAdjustment));

  const scheduled = advance.monthlyRepayment * elapsed + advance.repaidAdjustment;
  return Math.min(advance.amount, Math.max(0, scheduled));
}

/** 指定月份應從薪資扣除的還款金額。 */
export function advanceDeduction(advance: Advance, month: string): number {
  const before = repaidThrough(advance, shiftPayMonth(month, -1));
  const after = repaidThrough(advance, month);
  return Math.max(0, after - before);
}

/** 指定月份結束後仍未還清的餘額。 */
export function advanceOutstanding(advance: Advance, month: string): number {
  return Math.max(0, advance.amount - repaidThrough(advance, month));
}

export function isAdvanceCleared(advance: Advance, month: string): boolean {
  return advanceOutstanding(advance, month) === 0;
}

export interface AttendanceTally {
  /** 狀態為出勤且有打上班卡的天數。 */
  presentDays: number;
  annualLeaveDays: number;
  sickLeaveDays: number;
  personalLeaveDays: number;
  otherLeaveDays: number;
  absentDays: number;
  /** 實際工時合計（分鐘），只用於顯示與法遵檢核，不參與薪資計算。 */
  workedMinutes: number;
}

export interface PayrollBreakdown {
  dailyWage: number;
  presentDays: number;
  /** 出勤工資 = 日薪 × 出勤天數 */
  attendancePay: number;
  /** 特休工資（全薪） */
  annualLeavePay: number;
  /** 病假工資（半薪） */
  sickLeavePay: number;
  /** 工資小計 */
  basePay: number;
  extraPayTotal: number;
  advanceDeductionTotal: number;
  /** 實領 */
  netPay: number;
}

export function calcMonthlyPay(
  dailyWage: number,
  tally: AttendanceTally,
  extraPayTotal: number,
  advanceDeductionTotal: number,
): PayrollBreakdown {
  const attendancePay = dailyWage * tally.presentDays;
  const annualLeavePay = dailyWage * tally.annualLeaveDays;
  const sickLeavePay = Math.round(dailyWage * tally.sickLeaveDays * SICK_LEAVE_PAY_RATE);
  const basePay = attendancePay + annualLeavePay + sickLeavePay;

  return {
    dailyWage,
    presentDays: tally.presentDays,
    attendancePay,
    annualLeavePay,
    sickLeavePay,
    basePay,
    extraPayTotal,
    advanceDeductionTotal,
    netPay: basePay + extraPayTotal - advanceDeductionTotal,
  };
}

export function sumExtraPay(entries: ExtraPay[]): number {
  return entries.reduce((total, entry) => total + entry.amount, 0);
}

/** 顯示用金額，例如 NT$ 32,500。 */
export function formatMoney(amount: number): string {
  return `NT$ ${Math.round(amount).toLocaleString('zh-Hant-TW')}`;
}
