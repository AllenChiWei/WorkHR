import { describe, expect, it } from 'vitest';
import {
  DAILY_WAGE_FLOOR,
  MINIMUM_WAGE,
  annualLeaveDaysByYears,
  annualLeaveEntitlement,
  attendanceRetentionCutoff,
  formatServiceLength,
  longestConsecutiveWorkDays,
  serviceMonths,
} from './labor';

describe('特別休假天數（勞基法 §38）', () => {
  it('依年資級距給假', () => {
    expect(annualLeaveDaysByYears(1)).toBe(7);
    expect(annualLeaveDaysByYears(2)).toBe(10);
    expect(annualLeaveDaysByYears(3)).toBe(14);
    expect(annualLeaveDaysByYears(4)).toBe(14);
    expect(annualLeaveDaysByYears(5)).toBe(15);
    expect(annualLeaveDaysByYears(9)).toBe(15);
  });

  it('十年以上每滿一年加一日', () => {
    expect(annualLeaveDaysByYears(10)).toBe(16);
    expect(annualLeaveDaysByYears(11)).toBe(17);
    expect(annualLeaveDaysByYears(15)).toBe(21);
  });

  it('加至三十日封頂', () => {
    expect(annualLeaveDaysByYears(24)).toBe(30);
    expect(annualLeaveDaysByYears(30)).toBe(30);
    expect(annualLeaveDaysByYears(40)).toBe(30);
  });

  it('未滿一年沒有年度特休（六個月以上另計 3 日）', () => {
    expect(annualLeaveDaysByYears(0)).toBe(0);
  });
});

describe('特休年度（週年制）', () => {
  it('年資未滿六個月尚無特休', () => {
    const result = annualLeaveEntitlement('2026-07-01', '2026-09-17');
    expect(result.notYetEligible).toBe(true);
    expect(result.entitledDays).toBe(0);
  });

  it('滿六個月給 3 日，年度到滿一年前一天為止', () => {
    const result = annualLeaveEntitlement('2026-01-10', '2026-09-17');
    expect(result.entitledDays).toBe(3);
    expect(result.from).toBe('2026-07-10');
    expect(result.to).toBe('2027-01-09');
    expect(result.notYetEligible).toBe(false);
  });

  it('滿一年後以到職週年日為年度起點', () => {
    const result = annualLeaveEntitlement('2024-03-15', '2026-09-17');
    expect(result.entitledDays).toBe(10); // 年資滿 2 年
    expect(result.from).toBe('2026-03-15');
    expect(result.to).toBe('2027-03-14');
  });

  it('剛好在週年日當天會進入新的特休年度', () => {
    const result = annualLeaveEntitlement('2023-09-17', '2026-09-17');
    expect(result.from).toBe('2026-09-17');
    expect(result.entitledDays).toBe(14); // 年資滿 3 年
  });

  it('年資滿十年的天數正確', () => {
    const result = annualLeaveEntitlement('2016-05-01', '2026-09-17');
    expect(result.entitledDays).toBe(16);
  });
});

describe('年資計算', () => {
  it('以月為單位', () => {
    expect(serviceMonths('2026-03-17', '2026-09-17')).toBe(6);
    expect(serviceMonths('2026-03-18', '2026-09-17')).toBe(5);
    expect(serviceMonths('2024-09-17', '2026-09-17')).toBe(24);
  });

  it('到職日在未來時回傳 0，不會出現負年資', () => {
    expect(serviceMonths('2027-01-01', '2026-09-17')).toBe(0);
  });

  it('年資顯示字串', () => {
    expect(formatServiceLength('2024-03-17', '2026-09-17')).toBe('2 年 6 個月');
    expect(formatServiceLength('2024-09-17', '2026-09-17')).toBe('2 年');
    expect(formatServiceLength('2026-06-17', '2026-09-17')).toBe('3 個月');
  });
});

describe('出勤紀錄保存（§30）', () => {
  it('保存五年，回推五年前的日期', () => {
    expect(attendanceRetentionCutoff('2026-09-17')).toBe('2021-09-17');
  });
});

describe('連續出勤天數（§36 檢核用）', () => {
  it('找出最長的連續區段', () => {
    expect(
      longestConsecutiveWorkDays([
        '2026-09-01',
        '2026-09-02',
        '2026-09-03',
        '2026-09-05',
        '2026-09-06',
      ]),
    ).toBe(3);
  });

  it('跨月連續也算得出來', () => {
    expect(longestConsecutiveWorkDays(['2026-08-30', '2026-08-31', '2026-09-01'])).toBe(3);
  });

  it('重複日期不會灌水', () => {
    expect(longestConsecutiveWorkDays(['2026-09-01', '2026-09-01', '2026-09-02'])).toBe(2);
  });

  it('空陣列為 0、單日為 1', () => {
    expect(longestConsecutiveWorkDays([])).toBe(0);
    expect(longestConsecutiveWorkDays(['2026-09-01'])).toBe(1);
  });
});

describe('基本工資', () => {
  it('2026 年公告值', () => {
    expect(MINIMUM_WAGE.monthly).toBe(29_500);
    expect(MINIMUM_WAGE.hourly).toBe(196);
    expect(MINIMUM_WAGE.effectiveYear).toBe(2026);
  });

  it('日薪門檻以時薪 × 8 小時換算', () => {
    expect(DAILY_WAGE_FLOOR).toBe(1_568);
  });
});
