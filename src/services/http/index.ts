/**
 * HTTP adapter：接上後端時，全部的實作都補在這個資料夾，其餘程式碼不需要改動。
 *
 * 目前每個方法都丟 NotImplementedError，這是刻意的：
 * 若有人誤把 VITE_DATA_SOURCE 設成 api，會立刻在畫面上看到明確錯誤，
 * 而不是拿到空資料誤以為系統正常。
 *
 * 建議的實作方式：
 *   - 共用一支 request() 包 fetch，統一處理 baseURL、憑證、錯誤碼轉 AppError。
 *   - 後端回傳的 JSON 一律用 src/schemas 的 Zod schema parse 過再回傳，
 *     讓型別保證延伸到執行期。
 *   - 認證改用 HttpOnly cookie 或 Authorization header，前端不儲存密碼。
 */
import { NotImplementedError } from '@/lib/errors';
import type {
  AttendanceRepository,
  AuthRepository,
  CrewRepository,
  DataSource,
  DevRepository,
  WorkerRepository,
} from '../contracts';

/** 後端位址；實作時由 .env 提供 VITE_API_BASE_URL。 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

function notImplemented(method: string): never {
  throw new NotImplementedError(method);
}

const httpAuthRepository: AuthRepository = {
  login: () => notImplemented('auth.login'),
  logout: () => notImplemented('auth.logout'),
  getCurrentUser: () => notImplemented('auth.getCurrentUser'),
  changePassword: () => notImplemented('auth.changePassword'),
  resetPassword: () => notImplemented('auth.resetPassword'),
};

const httpCrewRepository: CrewRepository = {
  list: () => notImplemented('crews.list'),
  getById: () => notImplemented('crews.getById'),
  create: () => notImplemented('crews.create'),
  update: () => notImplemented('crews.update'),
  remove: () => notImplemented('crews.remove'),
};

const httpWorkerRepository: WorkerRepository = {
  list: () => notImplemented('workers.list'),
  getById: () => notImplemented('workers.getById'),
  create: () => notImplemented('workers.create'),
  update: () => notImplemented('workers.update'),
  remove: () => notImplemented('workers.remove'),
  assignCrew: () => notImplemented('workers.assignCrew'),
};

const httpAttendanceRepository: AttendanceRepository = {
  list: () => notImplemented('attendance.list'),
  getById: () => notImplemented('attendance.getById'),
  listDaily: () => notImplemented('attendance.listDaily'),
  punch: () => notImplemented('attendance.punch'),
  batchPunch: () => notImplemented('attendance.batchPunch'),
  upsert: () => notImplemented('attendance.upsert'),
  remove: () => notImplemented('attendance.remove'),
};

const httpDevRepository: DevRepository = {
  // 真實後端沒有「重置假資料」這種操作
  resetMockData: () => notImplemented('dev.resetMockData'),
};

export const httpDataSource: DataSource = {
  auth: httpAuthRepository,
  crews: httpCrewRepository,
  workers: httpWorkerRepository,
  attendance: httpAttendanceRepository,
  dev: httpDevRepository,
};
