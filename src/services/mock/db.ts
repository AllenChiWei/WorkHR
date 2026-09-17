import { z } from 'zod';
import { attendanceRecordSchema } from '@/schemas/attendance';
import { crewSchema } from '@/schemas/crew';
import { workerSchema } from '@/schemas/worker';
import { roleSchema } from '@/schemas/common';
import type { AttendanceRecord, Crew, Worker } from '@/types';
import { buildSeed } from './seed';

/** localStorage key 一律使用 siteclock: 前綴。 */
const PREFIX = 'siteclock:';
const SCHEMA_VERSION = 1;

export const STORAGE_KEYS = {
  version: `${PREFIX}version`,
  crews: `${PREFIX}crews`,
  workers: `${PREFIX}workers`,
  attendance: `${PREFIX}attendance`,
  accounts: `${PREFIX}accounts`,
  session: `${PREFIX}session`,
} as const;

/**
 * mock 帳號表。password 為明文，純屬前端 mock 的展示用途，
 * 接上後端後整張表都會消失（見 src/services/mock/auth.ts 的說明）。
 */
export const mockAccountSchema = z.object({
  id: z.string(),
  username: z.string(),
  password: z.string(),
  role: roleSchema,
  name: z.string(),
  workerId: z.string().nullable(),
});

export type MockAccount = z.infer<typeof mockAccountSchema>;

export interface MockDb {
  crews: Crew[];
  workers: Worker[];
  attendance: AttendanceRecord[];
  accounts: MockAccount[];
}

const collectionSchemas = {
  crews: z.array(crewSchema),
  workers: z.array(workerSchema),
  attendance: z.array(attendanceRecordSchema),
  accounts: z.array(mockAccountSchema),
} as const;

function readCollection<K extends keyof MockDb>(key: K): MockDb[K] | null {
  const raw = localStorage.getItem(STORAGE_KEYS[key]);
  if (!raw) return null;
  try {
    const parsed = collectionSchemas[key].safeParse(JSON.parse(raw));
    // 資料結構不符（例如改過 schema）就視為沒有資料，重新 seed
    return parsed.success ? (parsed.data as MockDb[K]) : null;
  } catch {
    return null;
  }
}

function writeCollection<K extends keyof MockDb>(key: K, value: MockDb[K]): void {
  localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(value));
}

let cache: MockDb | null = null;

/** 讀取整個 mock 資料庫；第一次呼叫或資料不合法時自動 seed。 */
export function getDb(): MockDb {
  if (cache) return cache;

  const version = localStorage.getItem(STORAGE_KEYS.version);
  const crews = readCollection('crews');
  const workers = readCollection('workers');
  const attendance = readCollection('attendance');
  const accounts = readCollection('accounts');

  if (version !== String(SCHEMA_VERSION) || !crews || !workers || !attendance || !accounts) {
    return resetDb();
  }

  cache = { crews, workers, attendance, accounts };
  return cache;
}

/** 覆寫其中一個集合並同步寫入 localStorage。 */
export function commit<K extends keyof MockDb>(key: K, value: MockDb[K]): void {
  const db = getDb();
  db[key] = value;
  writeCollection(key, value);
}

/** 重置為初始 mock 資料（DEV 模式的「重置 mock 資料」按鈕會呼叫）。 */
export function resetDb(): MockDb {
  const seed = buildSeed();
  cache = seed;
  writeCollection('crews', seed.crews);
  writeCollection('workers', seed.workers);
  writeCollection('attendance', seed.attendance);
  writeCollection('accounts', seed.accounts);
  localStorage.setItem(STORAGE_KEYS.version, String(SCHEMA_VERSION));
  return seed;
}

export function clearSessionStorage(): void {
  sessionStorage.removeItem(STORAGE_KEYS.session);
}

/** 模擬網路延遲 200~400ms。 */
export function delay(): Promise<void> {
  const ms = 200 + Math.floor(Math.random() * 201);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function nowIso(): string {
  return new Date().toISOString();
}
