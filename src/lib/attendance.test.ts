import { describe, expect, it } from 'vitest';
import type { AttendanceRecord, Worker } from '@/types';
import {
  buildRoster,
  resolvePunchState,
  selectBatchTargets,
  summarizeRoster,
  validatePunchTimes,
} from './attendance';
import { workDateTimeToIso } from './date';

const WORK_DATE = '2026-09-17';

function makeWorker(id: string, name: string, role: Worker['role'] = 'worker'): Worker {
  return {
    id,
    name,
    crewId: 'crew-1',
    role,
    canSelfCheckIn: false,
    hasAccount: false,
    active: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

function makeRecord(
  workerId: string,
  overrides: Partial<AttendanceRecord> = {},
): AttendanceRecord {
  return {
    id: `rec-${workerId}`,
    workerId,
    crewId: 'crew-1',
    workDate: WORK_DATE,
    checkInAt: null,
    checkOutAt: null,
    status: 'present',
    recordedBy: 'foreman-1',
    createdAt: '2026-09-17T00:00:00.000Z',
    updatedAt: '2026-09-17T00:00:00.000Z',
    ...overrides,
  };
}

describe('resolvePunchState', () => {
  it('請假與未到一律不可打卡', () => {
    expect(resolvePunchState('leave', null, null)).toBe('blocked');
    expect(resolvePunchState('absent', null, null)).toBe('blocked');
  });

  it('依打卡進度決定按鈕狀態', () => {
    const inAt = workDateTimeToIso(WORK_DATE, '07:30');
    const outAt = workDateTimeToIso(WORK_DATE, '17:00');
    expect(resolvePunchState('present', null, null)).toBe('idle');
    expect(resolvePunchState('present', inAt, null)).toBe('working');
    expect(resolvePunchState('present', inAt, outAt)).toBe('done');
  });
});

describe('buildRoster', () => {
  it('沒有紀錄的人視為出勤且未打卡', () => {
    const rows = buildRoster([makeWorker('w1', '王大同')], []);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.record).toBeNull();
    expect(rows[0]!.status).toBe('present');
    expect(rows[0]!.punchState).toBe('idle');
  });

  it('領班排在最前面', () => {
    const workers = [
      makeWorker('w2', '林建良'),
      makeWorker('w1', '陳志明', 'foreman'),
      makeWorker('w3', '吳俊傑'),
    ];
    const rows = buildRoster(workers, []);
    expect(rows[0]!.worker.role).toBe('foreman');
  });

  it('標示只打上班沒打下班的異常', () => {
    const rows = buildRoster(
      [makeWorker('w1', '王大同')],
      [makeRecord('w1', { checkInAt: workDateTimeToIso(WORK_DATE, '07:30') })],
    );
    expect(rows[0]!.missingCheckOut).toBe(true);
    expect(rows[0]!.workedMinutes).toBeNull();
  });
});

describe('selectBatchTargets', () => {
  const inAt = workDateTimeToIso(WORK_DATE, '07:30');
  const outAt = workDateTimeToIso(WORK_DATE, '17:00');
  const workers = [
    makeWorker('w1', '甲'),
    makeWorker('w2', '乙'),
    makeWorker('w3', '丙'),
    makeWorker('w4', '丁'),
  ];
  const records = [
    makeRecord('w2', { checkInAt: inAt }),
    makeRecord('w3', { checkInAt: inAt, checkOutAt: outAt }),
    makeRecord('w4', { status: 'leave' }),
  ];
  const rows = buildRoster(workers, records);

  it('全班上班只打尚未打卡且狀態為出勤的人', () => {
    const targets = selectBatchTargets(rows, 'in');
    expect(targets.map((row) => row.worker.id)).toEqual(['w1']);
  });

  it('全班下班只打已上班但未下班的人', () => {
    const targets = selectBatchTargets(rows, 'out');
    expect(targets.map((row) => row.worker.id)).toEqual(['w2']);
  });

  it('請假者不會被批次打卡選中', () => {
    const allTargets = [...selectBatchTargets(rows, 'in'), ...selectBatchTargets(rows, 'out')];
    expect(allTargets.some((row) => row.worker.id === 'w4')).toBe(false);
  });
});

describe('summarizeRoster', () => {
  it('統計出勤概況', () => {
    const rows = buildRoster(
      [makeWorker('w1', '甲'), makeWorker('w2', '乙'), makeWorker('w3', '丙')],
      [
        makeRecord('w1', {
          checkInAt: workDateTimeToIso(WORK_DATE, '07:30'),
          checkOutAt: workDateTimeToIso(WORK_DATE, '17:00'),
        }),
        makeRecord('w2', { checkInAt: workDateTimeToIso(WORK_DATE, '07:35') }),
        makeRecord('w3', { status: 'leave' }),
      ],
    );
    const summary = summarizeRoster(rows);
    expect(summary).toMatchObject({
      total: 3,
      checkedIn: 2,
      checkedOut: 1,
      present: 2,
      leave: 1,
      absent: 0,
      missingCheckOut: 1,
    });
  });
});

describe('validatePunchTimes', () => {
  it('下班早於上班要擋下', () => {
    const inAt = workDateTimeToIso(WORK_DATE, '08:00');
    const outAt = workDateTimeToIso(WORK_DATE, '07:00');
    expect(validatePunchTimes(inAt, outAt)).toBe('下班時間必須晚於上班時間');
  });

  it('相同時間也要擋下', () => {
    const at = workDateTimeToIso(WORK_DATE, '08:00');
    expect(validatePunchTimes(at, at)).toBe('下班時間必須晚於上班時間');
  });

  it('跨夜班以絕對時間比較，視為合法', () => {
    const inAt = workDateTimeToIso(WORK_DATE, '20:00');
    const outAt = workDateTimeToIso(WORK_DATE, '04:00', 1);
    expect(validatePunchTimes(inAt, outAt)).toBeNull();
  });

  it('只有下班時間視為錯誤', () => {
    expect(validatePunchTimes(null, workDateTimeToIso(WORK_DATE, '17:00'))).toBe(
      '尚未打上班卡，不能只填下班時間',
    );
  });

  it('尚未打下班不算錯誤', () => {
    expect(validatePunchTimes(workDateTimeToIso(WORK_DATE, '07:30'), null)).toBeNull();
  });

  it('超過 20 小時視為輸入錯誤', () => {
    const inAt = workDateTimeToIso(WORK_DATE, '06:00');
    const outAt = workDateTimeToIso(WORK_DATE, '07:00', 1);
    expect(validatePunchTimes(inAt, outAt)).toContain('20 小時');
  });
});
