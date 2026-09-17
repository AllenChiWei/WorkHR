import { z } from 'zod';
import { attendanceStatusSchema, idSchema, isoDateTimeSchema, workDateSchema } from './common';

/** 打卡紀錄：一人一天一筆。工時為衍生值，不存進資料。 */
export const attendanceRecordSchema = z.object({
  id: idSchema,
  workerId: idSchema,
  crewId: idSchema,
  workDate: workDateSchema,
  checkInAt: isoDateTimeSchema.nullable(),
  checkOutAt: isoDateTimeSchema.nullable(),
  status: attendanceStatusSchema,
  note: z.string().max(200).optional(),
  recordedBy: idSchema,
  lastModifiedBy: idSchema.optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

/** 對單筆紀錄可寫入的欄位；服務層會補上 recordedBy / lastModifiedBy 與時間戳。 */
export const attendanceWriteSchema = z.object({
  checkInAt: isoDateTimeSchema.nullable().optional(),
  checkOutAt: isoDateTimeSchema.nullable().optional(),
  status: attendanceStatusSchema.optional(),
  note: z.string().max(200).optional(),
});

/** 查詢條件（日期區間為閉區間）。 */
export const attendanceQuerySchema = z.object({
  crewId: idSchema.optional(),
  workerId: idSchema.optional(),
  from: workDateSchema.optional(),
  to: workDateSchema.optional(),
  status: attendanceStatusSchema.optional(),
});

export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>;
export type AttendanceWriteInput = z.infer<typeof attendanceWriteSchema>;
export type AttendanceQuery = z.infer<typeof attendanceQuerySchema>;

/** 打卡動作的種類，供批次打卡與單人打卡共用。 */
export type PunchKind = 'in' | 'out';
