import type {
  AttendanceQuery,
  AttendanceRecord,
  AttendanceStatus,
  AttendanceWriteInput,
  AuthUser,
  ChangePasswordInput,
  Credentials,
  Crew,
  CrewCreateInput,
  CrewUpdateInput,
  PunchKind,
  Worker,
  WorkerCreateInput,
  WorkerUpdateInput,
} from '@/types';

/**
 * 所有資料存取都走這些介面，元件不得直接呼叫 fetch。
 * mock 與 http 兩種實作必須完全符合同一組簽章，換後端時元件不需改動。
 */

export interface AuthRepository {
  login(credentials: Credentials): Promise<AuthUser>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<AuthUser | null>;
  changePassword(input: ChangePasswordInput): Promise<void>;
  /** 管理員把指定人員的密碼重設為系統預設值，回傳新密碼供畫面顯示。 */
  resetPassword(workerId: string): Promise<{ password: string }>;
}

export interface CrewRepository {
  list(): Promise<Crew[]>;
  getById(id: string): Promise<Crew | null>;
  create(input: CrewCreateInput): Promise<Crew>;
  update(id: string, input: CrewUpdateInput): Promise<Crew>;
  remove(id: string): Promise<void>;
}

export interface WorkerRepository {
  list(filter?: { crewId?: string | null; active?: boolean }): Promise<Worker[]>;
  getById(id: string): Promise<Worker | null>;
  create(input: WorkerCreateInput): Promise<Worker>;
  update(id: string, input: WorkerUpdateInput): Promise<Worker>;
  remove(id: string): Promise<void>;
  /** 指派／解除指派工班；傳 null 代表移出工班。 */
  assignCrew(workerId: string, crewId: string | null): Promise<Worker>;
}

export interface PunchInput {
  workerId: string;
  crewId: string;
  workDate: string;
  kind: PunchKind;
  /** 打卡時間（ISO）；未提供則以現在時間為準。 */
  at?: string;
  /** 已打過卡時要再次覆蓋，必須明確帶 true（重複打卡防呆）。 */
  overwrite?: boolean;
}

export interface BatchPunchInput {
  crewId: string;
  workDate: string;
  kind: PunchKind;
  /** 要打卡的人員；由 selectBatchTargets 篩選後傳入。 */
  workerIds: string[];
  at?: string;
}

export interface UpsertAttendanceInput extends AttendanceWriteInput {
  workerId: string;
  crewId: string;
  workDate: string;
  status?: AttendanceStatus;
}

export interface AttendanceRepository {
  list(query?: AttendanceQuery): Promise<AttendanceRecord[]>;
  getById(id: string): Promise<AttendanceRecord | null>;
  /** 某工班某日的全部紀錄（沒有紀錄的人不會出現，由 buildRoster 補齊）。 */
  listDaily(crewId: string, workDate: string): Promise<AttendanceRecord[]>;
  punch(input: PunchInput): Promise<AttendanceRecord>;
  batchPunch(input: BatchPunchInput): Promise<AttendanceRecord[]>;
  /** 建立或更新單日紀錄（改時間、改狀態、加備註）。 */
  upsert(input: UpsertAttendanceInput): Promise<AttendanceRecord>;
  remove(id: string): Promise<void>;
}

/** 僅供開發模式使用：重置 mock 資料。http 實作會直接丟 NotImplementedError。 */
export interface DevRepository {
  resetMockData(): Promise<void>;
}

export interface DataSource {
  auth: AuthRepository;
  crews: CrewRepository;
  workers: WorkerRepository;
  attendance: AttendanceRepository;
  dev: DevRepository;
}
