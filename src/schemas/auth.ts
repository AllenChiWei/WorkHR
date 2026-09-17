import { z } from 'zod';
import { idSchema, roleSchema } from './common';

export const authUserSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  role: roleSchema,
  /** admin 為 null。 */
  crewId: idSchema.nullable(),
  /** 對應的人員 id；admin 沒有人員資料，為 null。 */
  workerId: idSchema.nullable(),
  canSelfCheckIn: z.boolean(),
});

export const credentialsSchema = z.object({
  /** 帳號：可輸入 username、手機或員工編號。 */
  identifier: z.string().min(1, '請輸入帳號'),
  password: z.string().min(1, '請輸入密碼'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '請輸入目前密碼'),
    newPassword: z.string().min(4, '新密碼至少 4 碼'),
    confirmPassword: z.string().min(1, '請再次輸入新密碼'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: '兩次輸入的新密碼不一致',
    path: ['confirmPassword'],
  });

export type AuthUser = z.infer<typeof authUserSchema>;
export type Credentials = z.infer<typeof credentialsSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
