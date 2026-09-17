import type {
  Advance,
  AttendanceRecord,
  AttendanceStatus,
  Crew,
  ExtraPay,
  LeaveType,
  Worker,
} from '@/types';
import { createId } from '@/lib/id';
import { shiftWorkDate, todayWorkDate, workDateTimeToIso } from '@/lib/date';
import { payMonthOf, shiftPayMonth } from '@/lib/payroll';
import type { MockAccount, MockDb } from './db';

/** 重設密碼後的預設密碼（mock 用）。 */
export const DEFAULT_PASSWORD = '1234';

/** 固定種子的亂數，讓每次重置都產生同一份資料，方便驗收與重現問題。 */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface CrewBlueprint {
  name: string;
  siteName: string;
  note?: string;
  foremanName: string;
  foremanUsername: string;
  workerNames: string[];
  /** 這些人開通自行打卡（同時會建立登入帳號）。 */
  selfCheckIn: Record<string, string>;
}

const BLUEPRINTS: CrewBlueprint[] = [
  {
    name: 'A 班（水電）',
    siteName: '中山北路捷運聯開宅',
    note: '早班 07:30 進場',
    foremanName: '陳志明',
    foremanUsername: 'foreman-a',
    workerNames: ['王大同', '林建良', '吳俊傑', '張文華', '李國強'],
    selfCheckIn: { 王大同: 'worker-a1' },
  },
  {
    name: 'B 班（模板）',
    siteName: '新莊副都心 B3 基地',
    foremanName: '黃世昌',
    foremanUsername: 'foreman-b',
    workerNames: ['劉家豪', '鄭明德', '許志偉', '蔡承翰', '洪銘宏', '賴柏宇'],
    selfCheckIn: {},
  },
  {
    name: 'C 班（鋼筋）',
    siteName: '桃園航空城倉儲案',
    note: '需配合吊車時段',
    foremanName: '周文彬',
    foremanUsername: 'foreman-c',
    workerNames: ['謝孟翰', '方志鴻', '簡書豪', '高子軒'],
    selfCheckIn: {},
  },
];

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

/** 產生初始 mock 資料：3 個工班、每班 1 領班 + 4~8 名師傅、過去 14 天打卡紀錄。 */
export function buildSeed(): MockDb {
  const random = createRandom(20260917);
  const createdAt = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const crews: Crew[] = [];
  const workers: Worker[] = [];
  const accounts: MockAccount[] = [];
  const attendance: AttendanceRecord[] = [];
  const advances: Advance[] = [];
  const extraPays: ExtraPay[] = [];

  const today = todayWorkDate();
  const thisMonth = payMonthOf(today);

  /** 產生一個到職日：距今 monthsAgo 個月。 */
  const hireDateMonthsAgo = (monthsAgo: number): string => {
    const [year, month, day] = today.split('-').map(Number) as [number, number, number];
    const zeroBased = year * 12 + (month - 1) - monthsAgo;
    const hireYear = Math.floor(zeroBased / 12);
    const hireMonth = (zeroBased % 12) + 1;
    // 用 28 日以內的日期，避免月底日期在短月份失效
    const hireDay = Math.min(day, 28);
    return `${hireYear}-${pad(hireMonth)}-${pad(hireDay)}`;
  };

  accounts.push({
    id: createId(),
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    name: '系統管理員',
    workerId: null,
  });

  let employeeSeq = 1001;

  for (const blueprint of BLUEPRINTS) {
    const crewId = createId();
    const foremanId = createId();

    const foreman: Worker = {
      id: foremanId,
      name: blueprint.foremanName,
      crewId,
      role: 'foreman',
      phone: `09${String(10_000_000 + Math.floor(random() * 89_999_999))}`,
      employeeNo: `E${employeeSeq++}`,
      // 領班年資較長，用來展示不同的特休級距
      hireDate: hireDateMonthsAgo(38 + Math.floor(random() * 60)),
      dailyWage: 2600 + Math.floor(random() * 5) * 100,
      canSelfCheckIn: true,
      hasAccount: true,
      active: true,
      createdAt,
      updatedAt: createdAt,
    };
    workers.push(foreman);
    accounts.push({
      id: createId(),
      username: blueprint.foremanUsername,
      password: DEFAULT_PASSWORD,
      role: 'foreman',
      name: foreman.name,
      workerId: foreman.id,
    });

    crews.push({
      id: crewId,
      name: blueprint.name,
      foremanId,
      siteName: blueprint.siteName,
      note: blueprint.note,
      active: true,
      createdAt,
      updatedAt: createdAt,
    });

    for (const workerName of blueprint.workerNames) {
      const username = blueprint.selfCheckIn[workerName];
      const worker: Worker = {
        id: createId(),
        name: workerName,
        crewId,
        role: 'worker',
        phone: `09${String(10_000_000 + Math.floor(random() * 89_999_999))}`,
        employeeNo: `E${employeeSeq++}`,
        hireDate: hireDateMonthsAgo(Math.floor(random() * 80)),
        dailyWage: 1900 + Math.floor(random() * 8) * 100,
        canSelfCheckIn: Boolean(username),
        hasAccount: Boolean(username),
        active: true,
        createdAt,
        updatedAt: createdAt,
      };
      workers.push(worker);

      if (username) {
        accounts.push({
          id: createId(),
          username,
          password: DEFAULT_PASSWORD,
          role: 'worker',
          name: worker.name,
          workerId: worker.id,
        });
      }
    }

    const crewWorkers = workers.filter((worker) => worker.crewId === crewId);
    const today = todayWorkDate();

    // 過去 14 天（不含今天，讓今天是一張乾淨的打卡頁）
    for (let back = 14; back >= 1; back -= 1) {
      const workDate = shiftWorkDate(today, -back);

      for (const worker of crewWorkers) {
        const roll = random();
        let status: AttendanceStatus = 'present';
        let leaveType: LeaveType | undefined;
        let note: string | undefined;

        if (roll < 0.05) {
          status = 'leave';
          const typeRoll = random();
          leaveType = typeRoll < 0.4 ? 'annual' : typeRoll < 0.75 ? 'personal' : 'sick';
          note =
            leaveType === 'annual' ? '排休' : leaveType === 'sick' ? '身體不適' : '家中有事';
        } else if (roll < 0.08) {
          status = 'absent';
          note = '未到、電話未接';
        }

        let checkInAt: string | null = null;
        let checkOutAt: string | null = null;

        if (status === 'present') {
          const inHour = random() < 0.85 ? 7 : 8;
          const inMinute = Math.floor(random() * 60);
          checkInAt = workDateTimeToIso(workDate, `${pad(inHour)}:${pad(inMinute)}`);

          // 少量「只打上班沒打下班」的異常資料
          if (random() >= 0.07) {
            const outHour = 17 + (random() < 0.3 ? 1 : 0);
            const outMinute = Math.floor(random() * 60);
            checkOutAt = workDateTimeToIso(workDate, `${pad(outHour)}:${pad(outMinute)}`);
          } else {
            note = '忘記打下班卡';
          }
        }

        const recordedAt = checkInAt ?? workDateTimeToIso(workDate, '08:00');
        attendance.push({
          id: createId(),
          workerId: worker.id,
          crewId,
          workDate,
          checkInAt,
          checkOutAt,
          status,
          leaveType,
          note,
          recordedBy: foremanId,
          createdAt: recordedAt,
          updatedAt: checkOutAt ?? recordedAt,
        });
      }
    }
  }

  // 借支：挑兩位師傅，一筆還款中、一筆接近還清
  const borrowers = workers.filter((worker) => worker.role === 'worker').slice(0, 2);
  borrowers.forEach((worker, index) => {
    const amount = index === 0 ? 30_000 : 12_000;
    const monthlyRepayment = index === 0 ? 5_000 : 4_000;
    advances.push({
      id: createId(),
      workerId: worker.id,
      amount,
      monthlyRepayment,
      startMonth: shiftPayMonth(thisMonth, index === 0 ? -2 : -2),
      repaidAdjustment: 0,
      settledMonth: null,
      borrowedOn: shiftWorkDate(today, index === 0 ? -70 : -65),
      note: index === 0 ? '家中急用' : '機車修理',
      createdAt,
      updatedAt: createdAt,
    });
  });

  // 額外派遣加給：本月與上月各幾筆
  const extraCandidates = workers.filter((worker) => worker.role === 'worker').slice(0, 5);
  const extraLabels = ['假日吊車支援', '夜間趕工支援', '他案支援', '高空作業加給'];
  extraCandidates.forEach((worker, index) => {
    if (random() < 0.45) return;
    extraPays.push({
      id: createId(),
      workerId: worker.id,
      month: index % 2 === 0 ? thisMonth : shiftPayMonth(thisMonth, -1),
      workDate: shiftWorkDate(today, -(index + 1) * 3),
      label: extraLabels[index % extraLabels.length]!,
      amount: 1_000 + Math.floor(random() * 4) * 500,
      createdAt,
      updatedAt: createdAt,
    });
  });

  return { crews, workers, attendance, accounts, advances, extraPays };
}
