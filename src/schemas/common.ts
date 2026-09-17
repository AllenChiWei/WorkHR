import { z } from 'zod';

/** 所有 ID 一律 string（UUID），方便日後對應 MongoDB 的 _id。 */
export const idSchema = z.string().min(1, '缺少識別碼');

/** 時間一律以 ISO 8601 字串傳遞，只在顯示層格式化。 */
export const isoDateTimeSchema = z
  .string()
  .datetime({ message: '必須是 ISO 8601 時間字串' });

/** 工作日 'YYYY-MM-DD'（跨夜班以上班日為準）。 */
export const workDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必須是 YYYY-MM-DD');

export const roleSchema = z.enum(['admin', 'foreman', 'worker']);
export const workerRoleSchema = z.enum(['foreman', 'worker']);
export const attendanceStatusSchema = z.enum(['present', 'leave', 'absent']);

/**
 * 假別。特休照給全薪、病假半薪、事假不給薪（勞工請假規則），
 * 因此薪資試算與特休餘額都需要這個欄位。
 */
export const leaveTypeSchema = z.enum(['annual', 'personal', 'sick', 'other']);

export type Role = z.infer<typeof roleSchema>;
export type WorkerRole = z.infer<typeof workerRoleSchema>;
export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>;
export type LeaveType = z.infer<typeof leaveTypeSchema>;
