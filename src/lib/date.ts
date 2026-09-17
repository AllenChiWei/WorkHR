import { addDays, format, parse } from 'date-fns';

/**
 * 時區固定 Asia/Taipei。台北全年 UTC+8 且無日光節約時間，
 * 因此「瞬間 ↔ 台北牆上時間」可用固定位移換算，不需額外時區套件。
 */
export const TAIPEI_OFFSET_MINUTES = 480;
const MS_PER_MINUTE = 60_000;

export interface TaipeiWallClock {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

/** 把 ISO 瞬間換成台北的牆上時間。 */
export function toTaipeiWallClock(iso: string): TaipeiWallClock {
  const shifted = new Date(new Date(iso).getTime() + TAIPEI_OFFSET_MINUTES * MS_PER_MINUTE);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

/** 取 ISO 瞬間在台北所屬的日期 'YYYY-MM-DD'。 */
export function workDateFromIso(iso: string): string {
  const { year, month, day } = toTaipeiWallClock(iso);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** 顯示用時間 'HH:mm'；未打卡顯示 '--:--'。 */
export function formatClock(iso: string | null | undefined): string {
  if (!iso) return '--:--';
  const { hour, minute } = toTaipeiWallClock(iso);
  return `${pad(hour)}:${pad(minute)}`;
}

/** 顯示用日期時間 'MM/DD HH:mm'。 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '--';
  const { month, day, hour, minute } = toTaipeiWallClock(iso);
  return `${pad(month)}/${pad(day)} ${pad(hour)}:${pad(minute)}`;
}

/** 目前台北日期 'YYYY-MM-DD'。 */
export function todayWorkDate(now: Date = new Date()): string {
  return workDateFromIso(now.toISOString());
}

/**
 * 把工作日與 'HH:mm' 組成 ISO 瞬間。
 * dayOffset 用於跨夜班：下班時間落在隔天時傳 1。
 */
export function workDateTimeToIso(workDate: string, clock: string, dayOffset = 0): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock.trim());
  if (!match) throw new Error(`時間格式錯誤：${clock}`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error(`時間超出範圍：${clock}`);

  const [year, month, day] = workDate.split('-').map(Number) as [number, number, number];
  const utcMs = Date.UTC(year, month - 1, day + dayOffset, hour, minute);
  return new Date(utcMs - TAIPEI_OFFSET_MINUTES * MS_PER_MINUTE).toISOString();
}

/** 工作日加減天數，維持 'YYYY-MM-DD' 格式（純日期運算，與時區無關）。 */
export function shiftWorkDate(workDate: string, deltaDays: number): string {
  const base = parse(workDate, 'yyyy-MM-dd', new Date());
  return format(addDays(base, deltaDays), 'yyyy-MM-dd');
}

/** 比較兩個工作日：a < b 回傳負數。 */
export function compareWorkDate(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isSameOrBefore(a: string, b: string): boolean {
  return compareWorkDate(a, b) <= 0;
}

/** 列出區間內的每一天（閉區間）。 */
export function eachWorkDate(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = from;
  let guard = 0;
  while (isSameOrBefore(cursor, to) && guard < 400) {
    dates.push(cursor);
    cursor = shiftWorkDate(cursor, 1);
    guard += 1;
  }
  return dates;
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'] as const;

/** 顯示用日期標題，例如「9/17（三）· 今天」。 */
export function formatWorkDateLabel(workDate: string, today: string = todayWorkDate()): string {
  const [year, month, day] = workDate.split('-').map(Number) as [number, number, number];
  const weekday = WEEKDAY_LABELS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const base = `${month}/${day}（${weekday}）`;
  if (workDate === today) return `${base} · 今天`;
  if (workDate === shiftWorkDate(today, -1)) return `${base} · 昨天`;
  return base;
}

/** 是否為週末（報表備註用，不影響出勤計算）。 */
export function isWeekend(workDate: string): boolean {
  const [year, month, day] = workDate.split('-').map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 || weekday === 6;
}

/** 某年某月的天數。 */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * 產生月曆矩陣：每列 7 天（週日起算），不足的位置補 null。
 * 供出勤月曆畫面排版使用。
 */
export function buildMonthMatrix(year: number, month: number): (string | null)[][] {
  const total = daysInMonth(year, month);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();

  const cells: (string | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= total; day += 1) {
    cells.push(`${year}-${pad(month)}-${pad(day)}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
}

/** 月份加減，回傳 { year, month }。 */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const zeroBased = year * 12 + (month - 1) + delta;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

export const WEEKDAY_SHORT = WEEKDAY_LABELS;
