import { describe, expect, it } from 'vitest';
import type { AuthUser } from '@/types';
import { can, homePathFor } from './permissions';

const TODAY = '2026-09-17';
const YESTERDAY = '2026-09-16';

const admin: AuthUser = {
  id: 'acc-admin',
  name: '系統管理員',
  role: 'admin',
  crewId: null,
  workerId: null,
  canSelfCheckIn: false,
};

const foremanA: AuthUser = {
  id: 'acc-fa',
  name: '陳志明',
  role: 'foreman',
  crewId: 'crew-a',
  workerId: 'w-fa',
  canSelfCheckIn: true,
};

const openedWorker: AuthUser = {
  id: 'acc-wa1',
  name: '王大同',
  role: 'worker',
  crewId: 'crew-a',
  workerId: 'w-a1',
  canSelfCheckIn: true,
};

const closedWorker: AuthUser = { ...openedWorker, id: 'acc-wa2', canSelfCheckIn: false };

describe('管理員', () => {
  it('可做所有維護操作，且不受日期限制', () => {
    expect(can(admin, 'crew:manage')).toBe(true);
    expect(can(admin, 'worker:manage')).toBe(true);
    expect(can(admin, 'attendance:viewAll')).toBe(true);
    expect(can(admin, 'account:resetPassword')).toBe(true);
    expect(can(admin, 'attendance:viewHistory')).toBe(true);
    expect(can(admin, 'attendance:viewPunchTime')).toBe(true);
    expect(can(admin, 'attendance:edit', { crewId: 'crew-b', workDate: '2026-01-01', today: TODAY })).toBe(
      true,
    );
  });
});

describe('領班', () => {
  it('不能維護工班與人員', () => {
    expect(can(foremanA, 'crew:manage')).toBe(false);
    expect(can(foremanA, 'worker:manage')).toBe(false);
    expect(can(foremanA, 'attendance:viewAll')).toBe(false);
    expect(can(foremanA, 'account:resetPassword')).toBe(false);
  });

  it('只能檢視與代打本班', () => {
    expect(can(foremanA, 'attendance:viewCrew', { crewId: 'crew-a' })).toBe(true);
    expect(can(foremanA, 'attendance:viewCrew', { crewId: 'crew-b' })).toBe(false);
    expect(can(foremanA, 'attendance:punchOthers', { crewId: 'crew-a' })).toBe(true);
    expect(can(foremanA, 'attendance:punchOthers', { crewId: 'crew-b' })).toBe(false);
  });

  it('只能修改當日紀錄', () => {
    expect(can(foremanA, 'attendance:edit', { crewId: 'crew-a', workDate: TODAY, today: TODAY })).toBe(
      true,
    );
    expect(
      can(foremanA, 'attendance:edit', { crewId: 'crew-a', workDate: YESTERDAY, today: TODAY }),
    ).toBe(false);
  });

  it('看不到實際打卡時間點，只知道有沒有打卡', () => {
    expect(can(foremanA, 'attendance:viewPunchTime', { crewId: 'crew-a' })).toBe(false);
    expect(can(openedWorker, 'attendance:viewPunchTime', { crewId: 'crew-a' })).toBe(false);
    expect(can(admin, 'attendance:viewPunchTime')).toBe(true);
  });

  it('不能檢視出勤歷史與匯出報表（只有管理員可以）', () => {
    expect(can(foremanA, 'attendance:viewHistory', { crewId: 'crew-a' })).toBe(false);
    expect(can(foremanA, 'report:export', { crewId: 'crew-a' })).toBe(false);
    expect(can(admin, 'attendance:viewHistory')).toBe(true);
    expect(can(admin, 'attendance:viewPunchTime')).toBe(true);
    expect(can(admin, 'report:export')).toBe(true);
  });

  it('可為自己打卡', () => {
    expect(can(foremanA, 'attendance:punchSelf', { crewId: 'crew-a' })).toBe(true);
  });
});

describe('師傅', () => {
  it('已開通才可自行打卡', () => {
    expect(can(openedWorker, 'attendance:punchSelf', { crewId: 'crew-a' })).toBe(true);
    expect(can(closedWorker, 'attendance:punchSelf', { crewId: 'crew-a' })).toBe(false);
  });

  it('不能代打、不能檢視全班、不能匯出', () => {
    expect(can(openedWorker, 'attendance:punchOthers', { crewId: 'crew-a' })).toBe(false);
    expect(can(openedWorker, 'attendance:viewCrew', { crewId: 'crew-a' })).toBe(false);
    expect(can(openedWorker, 'report:export', { crewId: 'crew-a' })).toBe(false);
    expect(can(openedWorker, 'attendance:edit', { crewId: 'crew-a', workDate: TODAY, today: TODAY })).toBe(
      false,
    );
  });
});

describe('未登入', () => {
  it('一律拒絕', () => {
    expect(can(null, 'attendance:punchSelf')).toBe(false);
    expect(can(null, 'crew:manage')).toBe(false);
  });
});

describe('homePathFor', () => {
  it('依角色導向各自首頁', () => {
    expect(homePathFor(admin)).toBe('/admin');
    expect(homePathFor(foremanA)).toBe('/crew');
    expect(homePathFor(openedWorker)).toBe('/me');
  });
});
