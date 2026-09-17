import type { AttendanceRecord, AttendanceStatus, Crew, Worker } from '@/types';
import { createId } from '@/lib/id';
import { shiftWorkDate, todayWorkDate, workDateTimeToIso } from '@/lib/date';
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
        let note: string | undefined;

        if (roll < 0.05) {
          status = 'leave';
          note = random() < 0.5 ? '事假' : '家中有事';
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
          note,
          recordedBy: foremanId,
          createdAt: recordedAt,
          updatedAt: checkOutAt ?? recordedAt,
        });
      }
    }
  }

  return { crews, workers, attendance, accounts };
}
