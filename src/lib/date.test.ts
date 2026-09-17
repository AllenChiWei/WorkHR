import { describe, expect, it } from 'vitest';
import {
  compareWorkDate,
  eachWorkDate,
  formatClock,
  formatWorkDateLabel,
  isWeekend,
  shiftWorkDate,
  todayWorkDate,
  workDateFromIso,
  workDateTimeToIso,
} from './date';

describe('台北時區換算', () => {
  it('UTC 00:00 在台北是同日的 08:00', () => {
    expect(formatClock('2026-09-17T00:00:00.000Z')).toBe('08:00');
    expect(workDateFromIso('2026-09-17T00:00:00.000Z')).toBe('2026-09-17');
  });

  it('UTC 前一日 16:00 之後已經是台北的隔天', () => {
    expect(workDateFromIso('2026-09-16T16:00:00.000Z')).toBe('2026-09-17');
    expect(formatClock('2026-09-16T16:00:00.000Z')).toBe('00:00');
  });

  it('未打卡顯示 --:--', () => {
    expect(formatClock(null)).toBe('--:--');
    expect(formatClock(undefined)).toBe('--:--');
  });

  it('workDateTimeToIso 與 formatClock 可互相還原', () => {
    const iso = workDateTimeToIso('2026-09-17', '07:30');
    expect(iso).toBe('2026-09-16T23:30:00.000Z');
    expect(formatClock(iso)).toBe('07:30');
    expect(workDateFromIso(iso)).toBe('2026-09-17');
  });

  it('跨夜班用 dayOffset 讓下班落在隔天', () => {
    const checkIn = workDateTimeToIso('2026-09-17', '20:00');
    const checkOut = workDateTimeToIso('2026-09-17', '04:00', 1);
    expect(new Date(checkOut).getTime()).toBeGreaterThan(new Date(checkIn).getTime());
    // 工作日仍以上班日為準
    expect(workDateFromIso(checkOut)).toBe('2026-09-18');
  });

  it('拒絕格式錯誤的時間', () => {
    expect(() => workDateTimeToIso('2026-09-17', '25:00')).toThrow();
    expect(() => workDateTimeToIso('2026-09-17', '早上八點')).toThrow();
  });

  it('todayWorkDate 回傳 YYYY-MM-DD', () => {
    expect(todayWorkDate(new Date('2026-09-17T15:59:59.000Z'))).toBe('2026-09-17');
    expect(todayWorkDate(new Date('2026-09-17T16:00:00.000Z'))).toBe('2026-09-18');
  });
});

describe('工作日運算', () => {
  it('跨月加減正確', () => {
    expect(shiftWorkDate('2026-09-30', 1)).toBe('2026-10-01');
    expect(shiftWorkDate('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('compareWorkDate 依時間排序', () => {
    expect(compareWorkDate('2026-09-01', '2026-09-02')).toBeLessThan(0);
    expect(compareWorkDate('2026-09-02', '2026-09-01')).toBeGreaterThan(0);
    expect(compareWorkDate('2026-09-01', '2026-09-01')).toBe(0);
  });

  it('eachWorkDate 為閉區間', () => {
    expect(eachWorkDate('2026-09-01', '2026-09-03')).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
    ]);
    expect(eachWorkDate('2026-09-01', '2026-09-01')).toEqual(['2026-09-01']);
  });

  it('日期標題標示今天與昨天', () => {
    expect(formatWorkDateLabel('2026-09-17', '2026-09-17')).toBe('9/17（四） · 今天');
    expect(formatWorkDateLabel('2026-09-16', '2026-09-17')).toBe('9/16（三） · 昨天');
    expect(formatWorkDateLabel('2026-09-12', '2026-09-17')).toBe('9/12（六）');
  });

  it('判斷週末', () => {
    expect(isWeekend('2026-09-12')).toBe(true);
    expect(isWeekend('2026-09-13')).toBe(true);
    expect(isWeekend('2026-09-14')).toBe(false);
  });
});
