import { describe, expect, it } from 'vitest';
import {
  countWorkdays,
  holidayName,
  isHoliday,
  isMakeupWorkday,
  isWorkday,
  listWorkdays,
  nonWorkdayReason,
} from './calendar';

describe('工作日曆', () => {
  it('平日是工作日', () => {
    expect(isWorkday('2026-09-17')).toBe(true); // 週四
    expect(isWorkday('2026-09-14')).toBe(true); // 週一
  });

  it('週末不是工作日', () => {
    expect(isWorkday('2026-09-12')).toBe(false); // 週六
    expect(isWorkday('2026-09-13')).toBe(false); // 週日
    expect(nonWorkdayReason('2026-09-12')).toBe('例假日');
  });

  it('國定假日不是工作日，且回報假日名稱', () => {
    expect(isHoliday('2026-10-10')).toBe(true);
    expect(isWorkday('2026-10-10')).toBe(false);
    expect(holidayName('2026-10-10')).toBe('國慶日');
    expect(nonWorkdayReason('2026-01-01')).toBe('開國紀念日');
  });

  it('補班日雖是週末仍算工作日', () => {
    expect(isMakeupWorkday('2026-09-26')).toBe(true);
    expect(isWorkday('2026-09-26')).toBe(true); // 週六補班
    expect(nonWorkdayReason('2026-09-26')).toBeNull();
  });

  it('假日優先於補班（同一天不會既補班又放假）', () => {
    expect(isWorkday('2026-02-14')).toBe(true);
    expect(isHoliday('2026-02-14')).toBe(false);
  });

  it('countWorkdays 扣掉週末', () => {
    // 2026-09-14(一) ~ 2026-09-20(日)：扣掉 9/19、9/20
    expect(countWorkdays('2026-09-14', '2026-09-20')).toBe(5);
  });

  it('countWorkdays 扣掉國定假日', () => {
    // 該週包含 9/25 中秋（五）與 9/26 補班（六）
    expect(countWorkdays('2026-09-21', '2026-09-27')).toBe(5);
  });

  it('單日區間也正確', () => {
    expect(countWorkdays('2026-10-10', '2026-10-10')).toBe(0);
    expect(countWorkdays('2026-09-17', '2026-09-17')).toBe(1);
  });

  it('listWorkdays 只列出應出勤日', () => {
    expect(listWorkdays('2026-09-11', '2026-09-14')).toEqual(['2026-09-11', '2026-09-14']);
  });
});

describe('月曆矩陣', () => {
  it('2026-09 的第一天是週二，前面補兩格空白', async () => {
    const { buildMonthMatrix } = await import('./date');
    const weeks = buildMonthMatrix(2026, 9);
    expect(weeks[0]!.slice(0, 3)).toEqual([null, null, '2026-09-01']);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
    // 每一列都是 7 格
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it('二月天數正確（含閏年）', async () => {
    const { daysInMonth } = await import('./date');
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
  });

  it('月份加減可跨年', async () => {
    const { shiftMonth } = await import('./date');
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
});
