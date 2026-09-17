import { z } from 'zod';
import { idSchema, isoDateTimeSchema, workerRoleSchema } from './common';

export const workerSchema = z.object({
  id: idSchema,
  name: z.string().min(1, '姓名必填').max(20, '姓名過長'),
  crewId: idSchema.nullable(),
  role: workerRoleSchema,
  phone: z
    .string()
    .regex(/^09\d{8}$/, '手機格式須為 09 開頭共 10 碼')
    .optional(),
  employeeNo: z.string().max(20).optional(),
  /** 是否開通自行打卡；前提是 hasAccount 為 true（見 workerWriteSchema 的 refine）。 */
  canSelfCheckIn: z.boolean(),
  hasAccount: z.boolean(),
  active: z.boolean(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

const workerWritableSchema = workerSchema
  .pick({
    name: true,
    role: true,
    phone: true,
    employeeNo: true,
  })
  .extend({
    crewId: idSchema.nullable().default(null),
    canSelfCheckIn: z.boolean().default(false),
    hasAccount: z.boolean().default(false),
    active: z.boolean().default(true),
  });

/** 開通自行打卡必須同時有登入帳號，否則沒有登入的入口。 */
const selfCheckInNeedsAccount = (value: { canSelfCheckIn?: boolean; hasAccount?: boolean }) =>
  !value.canSelfCheckIn || value.hasAccount === true;

export const workerCreateInputSchema = workerWritableSchema.refine(selfCheckInNeedsAccount, {
  message: '開通自行打卡前必須先建立登入帳號',
  path: ['canSelfCheckIn'],
});

export const workerUpdateInputSchema = workerWritableSchema
  .partial()
  .refine(selfCheckInNeedsAccount, {
    message: '開通自行打卡前必須先建立登入帳號',
    path: ['canSelfCheckIn'],
  });

export type Worker = z.infer<typeof workerSchema>;
export type WorkerCreateInput = z.input<typeof workerCreateInputSchema>;
export type WorkerUpdateInput = z.input<typeof workerUpdateInputSchema>;
