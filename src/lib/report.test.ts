import { describe, expect, it } from 'vitest';
import type { AttendanceRecord, Crew, Worker } from '@/types';
import { summarizeByWorker, totalsOf } from './report';
import { computeWorkedMinutes, formatWorkedDuration, minutesToHours } from './hours';
import { escapeCsvCell, summaryToCsv, toCsv, buildExportFileName } from './export';
import { workDateTimeToIso } from './date';

const crews: Crew[] = [
  {
    id: 'crew-a',
    name: 'A 班（水電）',
    foremanId: 'w-fa',
    active: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
];

const workers: Worker[] = [
  {
    id: 'w-a1',
    name: '王大同',
    crewId: 'crew-a',
    role: 'worker',
    employeeNo: 'E1002',
    canSelfCheckIn: true,
    hasAccount: true,
    active: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
];

function record(
  workDate: string,
  overrides: Partial<AttendanceRecord> = {},
): AttendanceRecord {
  return {
    id: `rec-${workDate}`,
    workerId: 'w-a1',
    crewId: 'crew-a',
    workDate,
    checkInAt: workDateTimeToIso(workDate, '08:00'),
    checkOutAt: workDateTimeToIso(workDate, '17:00'),
    status: 'present',
    recordedBy: 'w-fa',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('工時計算', () => {
  it('以下班減上班取得工時', () => {
    expect(computeWorkedMinutes(record('2026-09-15'))).toBe(540);
    expect(minutesToHours(540)).toBe(9);
    expect(formatWorkedDuration(540)).toBe('9 小時');
    expect(formatWorkedDuration(545)).toBe('9 小時 5 分');
    expect(formatWorkedDuration(null)).toBe('--');
  });

  it('未打下班沒有工時', () => {
    expect(computeWorkedMinutes(record('2026-09-15', { checkOutAt: null }))).toBeNull();
  });

  it('跨夜班工時正確', () => {
    const minutes = computeWorkedMinutes({
      checkInAt: workDateTimeToIso('2026-09-15', '20:00'),
      checkOutAt: workDateTimeToIso('2026-09-15', '04:00', 1),
    });
    expect(minutes).toBe(480);
  });
});

describe('summarizeByWorker', () => {
  const records = [
    record('2026-09-14'),
    record('2026-09-15'),
    record('2026-09-16', { status: 'leave', checkInAt: null, checkOutAt: null }),
    record('2026-09-17', { checkOutAt: null }),
  ];
  const rows = summarizeByWorker(records, workers, crews);

  it('統計出勤天數、請假次數與總工時', () => {
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      workerName: '王大同',
      crewName: 'A 班（水電）',
      presentDays: 3,
      leaveDays: 1,
      absentDays: 0,
      holidayWorkDays: 0,
      totalHours: 18,
      missingCheckOutCount: 1,
    });
  });

  it('未打下班的那天工時以 0 計，但仍算出勤天數', () => {
    expect(rows[0]!.totalMinutes).toBe(1080);
  });

  it('找不到對應人員的紀錄會被忽略', () => {
    const orphan = summarizeByWorker([record('2026-09-14', { workerId: 'ghost' })], workers, crews);
    expect(orphan).toHaveLength(0);
  });

  it('totalsOf 彙總全部人員', () => {
    expect(totalsOf(rows)).toMatchObject({
      workers: 1,
      presentDays: 3,
      leaveDays: 1,
      totalHours: 18,
      missingCheckOutCount: 1,
    });
  });

  it('國定假日出勤會被單獨標注', () => {
    const holidayRows = summarizeByWorker([record('2026-10-10')], workers, crews);
    expect(holidayRows[0]).toMatchObject({ presentDays: 1, holidayWorkDays: 1 });
  });
});

describe('CSV 匯出', () => {
  it('第一個字元是 BOM，Excel 才不會中文亂碼', () => {
    const csv = toCsv(['姓名'], [['王大同']]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('逗號、引號、換行要跳脫', () => {
    expect(escapeCsvCell('A,B')).toBe('"A,B"');
    expect(escapeCsvCell('說「他說"好"」')).toBe('"說「他說""好""」"');
    expect(escapeCsvCell('第一行\n第二行')).toBe('"第一行\n第二行"');
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(8.5)).toBe('8.5');
  });

  it('使用 CRLF 換行', () => {
    const csv = toCsv(['a', 'b'], [['1', '2']]);
    expect(csv).toBe('﻿a,b\r\n1,2');
  });

  it('彙總 CSV 欄位順序固定', () => {
    const rows = summarizeByWorker([record('2026-09-14')], workers, crews);
    const csv = summaryToCsv(rows);
    const lines = csv.replace('﻿', '').split('\r\n');
    expect(lines[0]).toBe('工班,姓名,員工編號,出勤天數,請假次數,未到次數,假日出勤,總工時,未打下班筆數');
    expect(lines[1]).toBe('A 班（水電）,王大同,E1002,1,0,0,0,9,0');
  });

  it('檔名帶日期區間', () => {
    expect(buildExportFileName('attendance', '2026-09-01', '2026-09-30')).toBe(
      'attendance_20260901-20260930.csv',
    );
  });
});
