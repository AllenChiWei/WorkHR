/**
 * 型別全部由 Zod schema 以 z.infer 推導，這裡只做集中轉出，
 * 讓元件 import 型別時不必知道 schema 檔案的位置。
 */
export type {
  Role,
  WorkerRole,
  AttendanceStatus,
} from '@/schemas/common';
export type { Crew, CrewCreateInput, CrewUpdateInput } from '@/schemas/crew';
export type { Worker, WorkerCreateInput, WorkerUpdateInput } from '@/schemas/worker';
export type {
  AttendanceRecord,
  AttendanceWriteInput,
  AttendanceQuery,
  PunchKind,
} from '@/schemas/attendance';
export type { AuthUser, Credentials, ChangePasswordInput } from '@/schemas/auth';
