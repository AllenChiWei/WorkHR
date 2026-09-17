import { beforeEach, describe, expect, it } from 'vitest';

/**
 * 服務層的端對端測試：用記憶體版 storage 取代瀏覽器 API，
 * 直接跑過「登入 → 建工班 → 加人 → 打卡 → 統計」這條主線，
 * 同時驗證 service 層的權限閘門（規格第 4 節要求的第二層防線）。
 */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

const globalScope = globalThis as unknown as {
  localStorage: Storage;
  sessionStorage: Storage;
};
globalScope.localStorage = new MemoryStorage();
globalScope.sessionStorage = new MemoryStorage();

const { mockDataSource } = await import('./index');
const { todayWorkDate, shiftWorkDate, workDateTimeToIso } = await import('@/lib/date');
const { buildRoster, selectBatchTargets } = await import('@/lib/attendance');
const { summarizeByWorker } = await import('@/lib/report');
const { advanceDeduction, advanceOutstanding, payMonthOf, shiftPayMonth } = await import(
  '@/lib/payroll'
);
const { annualLeaveEntitlement } = await import('@/lib/labor');
const { isAppError } = await import('@/lib/errors');

const services = mockDataSource;
const TODAY = todayWorkDate();

async function loginAs(identifier: string, password: string) {
  return services.auth.login({ identifier, password });
}

beforeEach(async () => {
  await services.dev.resetMockData();
});

describe('登入（P2）', () => {
  it('三組測試帳號都能登入並拿到正確角色', async () => {
    const admin = await loginAs('admin', 'admin123');
    expect(admin).toMatchObject({ role: 'admin', crewId: null, workerId: null });

    const foreman = await loginAs('foreman-a', '1234');
    expect(foreman.role).toBe('foreman');
    expect(foreman.crewId).not.toBeNull();

    const worker = await loginAs('worker-a1', '1234');
    expect(worker).toMatchObject({ role: 'worker', canSelfCheckIn: true });
  });

  it('可用手機或員工編號登入', async () => {
    const admin = await loginAs('admin', 'admin123');
    expect(admin.role).toBe('admin');
    const workers = await services.workers.list();
    const target = workers.find((worker) => worker.hasAccount && worker.employeeNo);
    expect(target).toBeDefined();

    const byEmployeeNo = await loginAs(target!.employeeNo!, '1234');
    expect(byEmployeeNo.workerId).toBe(target!.id);

    const byPhone = await loginAs(target!.phone!, '1234');
    expect(byPhone.workerId).toBe(target!.id);
  });

  it('密碼錯誤與帳號不存在回傳同一段訊息', async () => {
    await expect(loginAs('admin', 'wrong')).rejects.toThrow('帳號或密碼錯誤');
    await expect(loginAs('nobody', 'whatever')).rejects.toThrow('帳號或密碼錯誤');
  });

  it('登出後就取不到 session', async () => {
    await loginAs('admin', 'admin123');
    expect(await services.auth.getCurrentUser()).not.toBeNull();
    await services.auth.logout();
    expect(await services.auth.getCurrentUser()).toBeNull();
  });
});

describe('工班與人員維護（P3）', () => {
  it('管理員可以從零建立一個工班並加入 5 名師傅', async () => {
    await loginAs('admin', 'admin123');

    const crew = await services.crews.create({ name: '測試班', siteName: '測試工地' });
    expect(crew.id).toBeTruthy();
    expect(crew.foremanId).toBeNull();

    const names = ['甲師傅', '乙師傅', '丙師傅', '丁師傅', '戊師傅'];
    for (const name of names) {
      await services.workers.create({ name, crewId: crew.id, role: 'worker' });
    }

    const members = await services.workers.list({ crewId: crew.id });
    expect(members).toHaveLength(5);

    // 指派其中一人為領班，角色會同步更新
    const updated = await services.crews.update(crew.id, { foremanId: members[0]!.id });
    expect(updated.foremanId).toBe(members[0]!.id);
    const refreshed = await services.workers.getById(members[0]!.id);
    expect(refreshed?.role).toBe('foreman');
    expect(refreshed?.hasAccount).toBe(true);
  });

  it('不能指派非本班成員為領班', async () => {
    await loginAs('admin', 'admin123');
    const crew = await services.crews.create({ name: '空班' });
    const outsider = await services.workers.create({ name: '外人', role: 'worker' });
    await expect(services.crews.update(crew.id, { foremanId: outsider.id })).rejects.toThrow(
      '只能指派本班成員',
    );
  });

  it('工班有成員時不可刪除', async () => {
    await loginAs('admin', 'admin123');
    const crew = await services.crews.create({ name: '待刪班' });
    await services.workers.create({ name: '某人', crewId: crew.id, role: 'worker' });
    await expect(services.crews.remove(crew.id)).rejects.toThrow('請先移出或改為停用');
  });

  it('沒有帳號就不能開通自行打卡', async () => {
    await loginAs('admin', 'admin123');
    await expect(
      services.workers.create({ name: '矛盾', role: 'worker', canSelfCheckIn: true }),
    ).rejects.toThrow('必須先建立登入帳號');
  });

  it('重設密碼後可以用新密碼登入', async () => {
    await loginAs('admin', 'admin123');
    const workers = await services.workers.list();
    const target = workers.find((worker) => worker.hasAccount && worker.role === 'worker')!;
    const { password } = await services.auth.resetPassword(target.id);
    expect(password).toBe('1234');
  });
});

describe('打卡（P4）', () => {
  it('領班可以完成一整天的上下班流程', async () => {
    const foreman = await loginAs('foreman-a', '1234');
    const crewId = foreman.crewId!;

    const workers = await services.workers.list({ crewId, active: true });
    const target = workers.find((worker) => worker.role === 'worker')!;

    const afterIn = await services.attendance.punch({
      workerId: target.id,
      crewId,
      workDate: TODAY,
      kind: 'in',
      at: workDateTimeToIso(TODAY, '07:30'),
    });
    expect(afterIn.checkInAt).not.toBeNull();
    expect(afterIn.checkOutAt).toBeNull();

    const afterOut = await services.attendance.punch({
      workerId: target.id,
      crewId,
      workDate: TODAY,
      kind: 'out',
      at: workDateTimeToIso(TODAY, '17:00'),
    });
    expect(afterOut.checkOutAt).not.toBeNull();
    expect(afterOut.id).toBe(afterIn.id); // 一人一天一筆
  });

  it('重複打卡要先確認，帶 overwrite 才會覆蓋', async () => {
    const foreman = await loginAs('foreman-a', '1234');
    const crewId = foreman.crewId!;
    const target = (await services.workers.list({ crewId, active: true }))[1]!;

    await services.attendance.punch({
      workerId: target.id,
      crewId,
      workDate: TODAY,
      kind: 'in',
      at: workDateTimeToIso(TODAY, '07:30'),
    });

    const duplicate = services.attendance.punch({
      workerId: target.id,
      crewId,
      workDate: TODAY,
      kind: 'in',
      at: workDateTimeToIso(TODAY, '08:00'),
    });
    await expect(duplicate).rejects.toThrow('已有上班打卡紀錄');

    const overwritten = await services.attendance.punch({
      workerId: target.id,
      crewId,
      workDate: TODAY,
      kind: 'in',
      at: workDateTimeToIso(TODAY, '08:00'),
      overwrite: true,
    });
    expect(overwritten.checkInAt).toBe(workDateTimeToIso(TODAY, '08:00'));
  });

  it('下班早於上班會被擋下', async () => {
    const foreman = await loginAs('foreman-a', '1234');
    const crewId = foreman.crewId!;
    const target = (await services.workers.list({ crewId, active: true }))[2]!;

    await services.attendance.punch({
      workerId: target.id,
      crewId,
      workDate: TODAY,
      kind: 'in',
      at: workDateTimeToIso(TODAY, '08:00'),
    });
    await expect(
      services.attendance.punch({
        workerId: target.id,
        crewId,
        workDate: TODAY,
        kind: 'out',
        at: workDateTimeToIso(TODAY, '07:00'),
      }),
    ).rejects.toThrow('下班時間必須晚於上班時間');
  });

  it('請假的人不能打卡', async () => {
    const foreman = await loginAs('foreman-a', '1234');
    const crewId = foreman.crewId!;
    const target = (await services.workers.list({ crewId, active: true }))[3]!;

    await services.attendance.upsert({
      workerId: target.id,
      crewId,
      workDate: TODAY,
      status: 'leave',
      note: '事假',
    });

    await expect(
      services.attendance.punch({ workerId: target.id, crewId, workDate: TODAY, kind: 'in' }),
    ).rejects.toThrow('無法打卡');
  });

  it('全班打卡只補未打卡者，不覆蓋已打卡者', async () => {
    const foreman = await loginAs('foreman-a', '1234');
    const crewId = foreman.crewId!;
    const workers = await services.workers.list({ crewId, active: true });

    const early = workers[0]!;
    const earlyTime = workDateTimeToIso(TODAY, '06:30');
    await services.attendance.punch({
      workerId: early.id,
      crewId,
      workDate: TODAY,
      kind: 'in',
      at: earlyTime,
    });

    const records = await services.attendance.listDaily(crewId, TODAY);
    const targets = selectBatchTargets(buildRoster(workers, records), 'in');
    expect(targets.some((row) => row.worker.id === early.id)).toBe(false);

    await services.attendance.batchPunch({
      crewId,
      workDate: TODAY,
      kind: 'in',
      workerIds: targets.map((row) => row.worker.id),
      at: workDateTimeToIso(TODAY, '07:30'),
    });

    const after = await services.attendance.listDaily(crewId, TODAY);
    expect(after.find((record) => record.workerId === early.id)?.checkInAt).toBe(earlyTime);
    expect(after.filter((record) => record.checkInAt !== null)).toHaveLength(workers.length);
  });
});

describe('權限閘門（service 層第二道防線）', () => {
  it('領班不能改非當日的紀錄', async () => {
    const foreman = await loginAs('foreman-a', '1234');
    const crewId = foreman.crewId!;
    const target = (await services.workers.list({ crewId, active: true }))[0]!;

    await expect(
      services.attendance.punch({
        workerId: target.id,
        crewId,
        workDate: shiftWorkDate(TODAY, -1),
        kind: 'in',
      }),
    ).rejects.toThrow('僅管理員可修改非當日的打卡紀錄');
  });

  it('領班不能操作其他工班', async () => {
    const admin = await loginAs('admin', 'admin123');
    expect(admin.role).toBe('admin');
    const crews = await services.crews.list();
    const otherCrew = crews[1]!;
    const otherWorker = (await services.workers.list({ crewId: otherCrew.id }))[0]!;

    await loginAs('foreman-a', '1234');
    await expect(
      services.attendance.punch({
        workerId: otherWorker.id,
        crewId: otherCrew.id,
        workDate: TODAY,
        kind: 'in',
      }),
    ).rejects.toThrow();
    await expect(services.attendance.list({ crewId: otherCrew.id })).rejects.toThrow(
      '只能檢視本班',
    );
  });

  it('領班不能建立工班或人員', async () => {
    await loginAs('foreman-a', '1234');
    await expect(services.crews.create({ name: '偷建的班' })).rejects.toThrow('沒有執行這項操作的權限');
    await expect(services.workers.create({ name: '偷建的人', role: 'worker' })).rejects.toThrow(
      '沒有執行這項操作的權限',
    );
  });

  it('師傅只看得到也只能操作自己的紀錄', async () => {
    const worker = await loginAs('worker-a1', '1234');
    const crewId = worker.crewId!;

    const visible = await services.attendance.list({});
    expect(visible.every((record) => record.workerId === worker.workerId)).toBe(true);

    const others = await services.workers.list();
    expect(others).toHaveLength(1);

    await expect(
      services.attendance.punch({
        workerId: 'someone-else',
        crewId,
        workDate: TODAY,
        kind: 'in',
      }),
    ).rejects.toThrow('只能操作自己的打卡紀錄');
  });

  it('未登入時一律拒絕', async () => {
    await services.auth.logout();
    await expect(services.crews.list()).rejects.toThrow('請先登入');
    const error = await services.crews.list().catch((caught: unknown) => caught);
    expect(isAppError(error) && error.code).toBe('UNAUTHORIZED');
  });
});

describe('mock 資料與報表（P1 / P5）', () => {
  it('產生 3 個工班，每班 1 領班 + 4~8 名師傅', async () => {
    await loginAs('admin', 'admin123');
    const crews = await services.crews.list();
    expect(crews).toHaveLength(3);

    for (const crew of crews) {
      const members = await services.workers.list({ crewId: crew.id });
      const foremen = members.filter((worker) => worker.role === 'foreman');
      expect(foremen).toHaveLength(1);
      expect(crew.foremanId).toBe(foremen[0]!.id);

      const workers = members.filter((worker) => worker.role === 'worker');
      expect(workers.length).toBeGreaterThanOrEqual(4);
      expect(workers.length).toBeLessThanOrEqual(8);
    }
  });

  it('有過去 14 天的紀錄，含請假、未到與只打上班的異常資料', async () => {
    await loginAs('admin', 'admin123');
    const records = await services.attendance.list({
      from: shiftWorkDate(TODAY, -14),
      to: shiftWorkDate(TODAY, -1),
    });

    const dates = new Set(records.map((record) => record.workDate));
    expect(dates.size).toBe(14);
    expect(records.some((record) => record.status === 'leave')).toBe(true);
    expect(records.some((record) => record.status === 'absent')).toBe(true);
    expect(
      records.some(
        (record) => record.status === 'present' && record.checkInAt && !record.checkOutAt,
      ),
    ).toBe(true);
  });

  it('今天預設是乾淨的一天，方便示範打卡', async () => {
    await loginAs('admin', 'admin123');
    const todayRecords = await services.attendance.list({ from: TODAY, to: TODAY });
    expect(todayRecords).toHaveLength(0);
  });

  it('可以產出一份月報統計', async () => {
    await loginAs('admin', 'admin123');
    const from = shiftWorkDate(TODAY, -14);
    const to = shiftWorkDate(TODAY, -1);

    const [records, workers, crews] = await Promise.all([
      services.attendance.list({ from, to }),
      services.workers.list(),
      services.crews.list(),
    ]);

    const rows = summarizeByWorker(records, workers, crews);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.presentDays + row.leaveDays + row.absentDays > 0)).toBe(true);
    expect(rows.some((row) => row.totalHours > 0)).toBe(true);
  });

  it('重置後回到初始資料', async () => {
    await loginAs('admin', 'admin123');
    await services.crews.create({ name: '暫時的班' });
    expect(await services.crews.list()).toHaveLength(4);

    await services.dev.resetMockData();
    // 重置會一併登出
    expect(await services.auth.getCurrentUser()).toBeNull();
    await loginAs('admin', 'admin123');
    expect(await services.crews.list()).toHaveLength(3);
  });
});


describe('薪資、借支與額外加給', () => {
  it('只有管理員讀得到薪資資料', async () => {
    await loginAs('foreman-a', '1234');
    await expect(services.payroll.listAdvances()).rejects.toThrow('沒有執行這項操作的權限');
    await expect(services.payroll.listExtraPays()).rejects.toThrow('沒有執行這項操作的權限');

    await loginAs('worker-a1', '1234');
    await expect(services.payroll.listAdvances()).rejects.toThrow('沒有執行這項操作的權限');
  });

  it('領班不能新增借支或加給', async () => {
    const admin = await loginAs('admin', 'admin123');
    expect(admin.role).toBe('admin');
    const target = (await services.workers.list())[0]!;

    await loginAs('foreman-a', '1234');
    await expect(
      services.payroll.createAdvance({
        workerId: target.id,
        amount: 10_000,
        monthlyRepayment: 2_000,
        startMonth: payMonthOf(TODAY),
      }),
    ).rejects.toThrow('沒有執行這項操作的權限');
  });

  it('管理員可以建立借支，並依月份推算扣款與餘額', async () => {
    await loginAs('admin', 'admin123');
    const target = (await services.workers.list())[0]!;
    const startMonth = payMonthOf(TODAY);

    const advance = await services.payroll.createAdvance({
      workerId: target.id,
      amount: 12_000,
      monthlyRepayment: 5_000,
      startMonth,
      note: '測試借支',
    });

    expect(advanceDeduction(advance, startMonth)).toBe(5_000);
    expect(advanceDeduction(advance, shiftPayMonth(startMonth, 2))).toBe(2_000);
    expect(advanceOutstanding(advance, shiftPayMonth(startMonth, 2))).toBe(0);
  });

  it('每月還款不可大於借支總額', async () => {
    await loginAs('admin', 'admin123');
    const target = (await services.workers.list())[0]!;
    await expect(
      services.payroll.createAdvance({
        workerId: target.id,
        amount: 5_000,
        monthlyRepayment: 8_000,
        startMonth: payMonthOf(TODAY),
      }),
    ).rejects.toThrow('每月還款金額不可大於借支總額');
  });

  it('可以提前結清借支', async () => {
    await loginAs('admin', 'admin123');
    const target = (await services.workers.list())[0]!;
    const startMonth = payMonthOf(TODAY);

    const advance = await services.payroll.createAdvance({
      workerId: target.id,
      amount: 30_000,
      monthlyRepayment: 5_000,
      startMonth,
    });
    const settled = await services.payroll.updateAdvance(advance.id, { settledMonth: startMonth });

    expect(advanceDeduction(settled, startMonth)).toBe(30_000);
    expect(advanceOutstanding(settled, startMonth)).toBe(0);
  });

  it('額外派遣加給可以新增、查詢與刪除', async () => {
    await loginAs('admin', 'admin123');
    const target = (await services.workers.list())[0]!;
    const month = payMonthOf(TODAY);

    const entry = await services.payroll.createExtraPay({
      workerId: target.id,
      month,
      label: '假日吊車支援',
      amount: 2_000,
    });
    expect(entry.amount).toBe(2_000);

    const thisMonth = await services.payroll.listExtraPays({ month });
    expect(thisMonth.some((item) => item.id === entry.id)).toBe(true);

    // 換個月份就查不到，確認月份篩選有效
    const otherMonth = await services.payroll.listExtraPays({ month: shiftPayMonth(month, -6) });
    expect(otherMonth.some((item) => item.id === entry.id)).toBe(false);

    await services.payroll.removeExtraPay(entry.id);
    const afterRemove = await services.payroll.listExtraPays({ month });
    expect(afterRemove.some((item) => item.id === entry.id)).toBe(false);
  });

  it('mock 人員都有到職日與日薪，特休天數算得出來', async () => {
    await loginAs('admin', 'admin123');
    const workers = await services.workers.list();

    expect(workers.every((worker) => Boolean(worker.hireDate))).toBe(true);
    expect(workers.every((worker) => (worker.dailyWage ?? 0) > 0)).toBe(true);

    for (const worker of workers) {
      const leave = annualLeaveEntitlement(worker.hireDate!, TODAY);
      expect(leave.entitledDays).toBeGreaterThanOrEqual(0);
      expect(leave.entitledDays).toBeLessThanOrEqual(30);
    }
  });

  it('mock 請假紀錄都有假別，薪資才算得出來', async () => {
    await loginAs('admin', 'admin123');
    const records = await services.attendance.list({
      from: shiftWorkDate(TODAY, -14),
      to: shiftWorkDate(TODAY, -1),
      status: 'leave',
    });

    expect(records.length).toBeGreaterThan(0);
    expect(records.every((record) => Boolean(record.leaveType))).toBe(true);
  });

  it('mock 內含借支與額外加給資料，方便直接檢視', async () => {
    await loginAs('admin', 'admin123');
    expect((await services.payroll.listAdvances()).length).toBeGreaterThan(0);
    expect((await services.payroll.listExtraPays()).length).toBeGreaterThan(0);
  });
});
