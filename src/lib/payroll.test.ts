import { describe, expect, it } from 'vitest';
import type { Advance, AttendanceRecord, Worker } from '@/types';
import {
  advanceDeduction,
  advanceOutstanding,
  calcMonthlyPay,
  formatMoney,
  isAdvanceCleared,
  monthDiff,
  payMonthOf,
  repaidThrough,
  shiftPayMonth,
  sumExtraPay,
  type AttendanceTally,
} from './payroll';
import { checkWorkerMonth, checkWorkerProfile, countByLevel } from './compliance';
import { workDateTimeToIso } from './date';

function makeAdvance(overrides: Partial<Advance> = {}): Advance {
  return {
    id: 'adv-1',
    workerId: 'w-1',
    amount: 30_000,
    monthlyRepayment: 5_000,
    startMonth: '2026-07',
    repaidAdjustment: 0,
    settledMonth: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('月份運算', () => {
  it('monthDiff 可跨年', () => {
    expect(monthDiff('2026-01', '2026-09')).toBe(8);
    expect(monthDiff('2025-11', '2026-02')).toBe(3);
    expect(monthDiff('2026-09', '2026-07')).toBe(-2);
  });

  it('shiftPayMonth 可跨年', () => {
    expect(shiftPayMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftPayMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftPayMonth('2026-09', 0)).toBe('2026-09');
  });

  it('payMonthOf 取工作日的月份', () => {
    expect(payMonthOf('2026-09-17')).toBe('2026-09');
  });
});

describe('借支還款', () => {
  const advance = makeAdvance();

  it('起扣前不扣款', () => {
    expect(advanceDeduction(advance, '2026-06')).toBe(0);
    expect(advanceOutstanding(advance, '2026-06')).toBe(30_000);
  });

  it('起扣月開始每月扣固定金額', () => {
    expect(advanceDeduction(advance, '2026-07')).toBe(5_000);
    expect(advanceDeduction(advance, '2026-08')).toBe(5_000);
    expect(repaidThrough(advance, '2026-08')).toBe(10_000);
    expect(advanceOutstanding(advance, '2026-08')).toBe(20_000);
  });

  it('最後一期只扣剩餘金額，不會超扣', () => {
    const odd = makeAdvance({ amount: 12_000, monthlyRepayment: 5_000 });
    expect(advanceDeduction(odd, '2026-07')).toBe(5_000);
    expect(advanceDeduction(odd, '2026-08')).toBe(5_000);
    expect(advanceDeduction(odd, '2026-09')).toBe(2_000);
    expect(advanceDeduction(odd, '2026-10')).toBe(0);
    expect(advanceOutstanding(odd, '2026-09')).toBe(0);
    expect(isAdvanceCleared(odd, '2026-09')).toBe(true);
  });

  it('提前結清當月扣掉剩餘全額，之後不再扣', () => {
    const settled = makeAdvance({ settledMonth: '2026-09' });
    expect(advanceDeduction(settled, '2026-08')).toBe(5_000);
    expect(advanceDeduction(settled, '2026-09')).toBe(20_000);
    expect(advanceDeduction(settled, '2026-10')).toBe(0);
    expect(advanceOutstanding(settled, '2026-09')).toBe(0);
  });

  it('手動調整已還金額會反映在餘額上', () => {
    const adjusted = makeAdvance({ repaidAdjustment: 3_000 });
    expect(repaidThrough(adjusted, '2026-07')).toBe(8_000);
    expect(advanceOutstanding(adjusted, '2026-07')).toBe(22_000);
  });

  it('負數調整可沖銷多扣，且已還金額不會低於 0', () => {
    const adjusted = makeAdvance({ repaidAdjustment: -20_000 });
    expect(repaidThrough(adjusted, '2026-07')).toBe(0);
    expect(advanceOutstanding(adjusted, '2026-07')).toBe(30_000);
  });
});

describe('月薪試算', () => {
  const tally: AttendanceTally = {
    presentDays: 22,
    annualLeaveDays: 1,
    sickLeaveDays: 2,
    personalLeaveDays: 1,
    otherLeaveDays: 0,
    absentDays: 0,
    workedMinutes: 0,
  };

  it('出勤、特休全薪，病假半薪，事假不給薪', () => {
    const result = calcMonthlyPay(2_000, tally, 0, 0);
    expect(result.attendancePay).toBe(44_000);
    expect(result.annualLeavePay).toBe(2_000);
    expect(result.sickLeavePay).toBe(2_000); // 2 天 × 2000 × 0.5
    expect(result.basePay).toBe(48_000);
    // 事假那天完全不計薪
    expect(result.netPay).toBe(48_000);
  });

  it('加上額外加給、扣掉借支還款', () => {
    const result = calcMonthlyPay(2_000, tally, 3_500, 5_000);
    expect(result.extraPayTotal).toBe(3_500);
    expect(result.advanceDeductionTotal).toBe(5_000);
    expect(result.netPay).toBe(48_000 + 3_500 - 5_000);
  });

  it('全月未出勤時實領可能為負（借支扣款大於工資）', () => {
    const empty: AttendanceTally = {
      presentDays: 0,
      annualLeaveDays: 0,
      sickLeaveDays: 0,
      personalLeaveDays: 0,
      otherLeaveDays: 0,
      absentDays: 20,
      workedMinutes: 0,
    };
    const result = calcMonthlyPay(2_000, empty, 0, 5_000);
    expect(result.netPay).toBe(-5_000);
  });

  it('額外加給加總', () => {
    expect(
      sumExtraPay([
        { amount: 1_500 },
        { amount: 2_000 },
      ] as Parameters<typeof sumExtraPay>[0]),
    ).toBe(3_500);
    expect(sumExtraPay([])).toBe(0);
  });

  it('金額格式化', () => {
    expect(formatMoney(48_000)).toBe('NT$ 48,000');
    expect(formatMoney(0)).toBe('NT$ 0');
  });
});

describe('法遵檢核', () => {
  function record(workDate: string, inClock: string, outClock: string | null): AttendanceRecord {
    return {
      id: `r-${workDate}`,
      workerId: 'w-1',
      crewId: 'c-1',
      workDate,
      checkInAt: workDateTimeToIso(workDate, inClock),
      checkOutAt: outClock ? workDateTimeToIso(workDate, outClock) : null,
      status: 'present',
      recordedBy: 'f-1',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
  }

  it('缺下班時間會提示紀錄不完整（§30）', () => {
    const issues = checkWorkerMonth([record('2026-09-01', '08:00', null)]);
    expect(issues.map((issue) => issue.code)).toContain('INCOMPLETE_RECORD');
  });

  it('單日工時超過 12 小時判定為違規（§32）', () => {
    const issues = checkWorkerMonth([record('2026-09-01', '06:00', '19:00')]);
    const issue = issues.find((item) => item.code === 'DAILY_HOURS_EXCEEDED');
    expect(issue?.level).toBe('violation');
  });

  it('正好 12 小時不算違規', () => {
    const issues = checkWorkerMonth([record('2026-09-01', '07:00', '19:00')]);
    expect(issues.map((issue) => issue.code)).not.toContain('DAILY_HOURS_EXCEEDED');
  });

  it('當月延長工時超過 46 小時判定為違規（§32）', () => {
    // 連續 24 天、每天 10 小時 → 延長工時 48 小時
    const records = Array.from({ length: 24 }, (_, index) =>
      record(`2026-09-${String(index + 1).padStart(2, '0')}`, '08:00', '18:00'),
    );
    const issues = checkWorkerMonth(records);
    expect(issues.map((issue) => issue.code)).toContain('MONTHLY_OVERTIME_EXCEEDED');
  });

  it('連續出勤超過 6 天會提示（§36）', () => {
    const records = Array.from({ length: 7 }, (_, index) =>
      record(`2026-09-${String(index + 1).padStart(2, '0')}`, '08:00', '17:00'),
    );
    const issues = checkWorkerMonth(records);
    const issue = issues.find((item) => item.code === 'CONSECUTIVE_DAYS');
    expect(issue?.title).toContain('7');
  });

  it('正常的一週不會產生任何提示', () => {
    const records = [
      record('2026-09-01', '08:00', '17:00'),
      record('2026-09-02', '08:00', '17:00'),
      record('2026-09-03', '08:00', '17:00'),
    ];
    expect(checkWorkerMonth(records)).toHaveLength(0);
  });

  it('人員資料缺到職日或日薪會提示', () => {
    const worker = {
      id: 'w-1',
      name: '測試',
      crewId: 'c-1',
      role: 'worker',
      canSelfCheckIn: false,
      hasAccount: false,
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } satisfies Worker;

    const issues = checkWorkerProfile(worker);
    const codes = issues.map((issue) => issue.code);
    expect(codes).toContain('MISSING_HIRE_DATE');
    expect(codes).toContain('MISSING_DAILY_WAGE');
  });

  it('日薪低於基本工資換算值會提示', () => {
    const worker = {
      id: 'w-1',
      name: '測試',
      crewId: 'c-1',
      role: 'worker',
      hireDate: '2024-01-01',
      dailyWage: 1_200,
      canSelfCheckIn: false,
      hasAccount: false,
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } satisfies Worker;

    const issues = checkWorkerProfile(worker);
    expect(issues.map((issue) => issue.code)).toContain('BELOW_MINIMUM_WAGE');
    expect(countByLevel(issues).warning).toBeGreaterThan(0);
  });

  it('資料齊全且日薪合規時沒有提示', () => {
    const worker = {
      id: 'w-1',
      name: '測試',
      crewId: 'c-1',
      role: 'worker',
      hireDate: '2024-01-01',
      dailyWage: 2_200,
      canSelfCheckIn: false,
      hasAccount: false,
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } satisfies Worker;

    expect(checkWorkerProfile(worker)).toHaveLength(0);
  });
});
