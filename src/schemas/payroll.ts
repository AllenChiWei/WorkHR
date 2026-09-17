import { z } from 'zod';
import { idSchema, isoDateTimeSchema, workDateSchema } from './common';

/** 薪資月份 'YYYY-MM'。 */
export const payMonthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, '月份格式必須是 YYYY-MM');

/**
 * 借支：員工預先支領一筆金額，之後每月從薪資固定扣還。
 * 無息；已還金額由起扣月份與每月還款額推算，另提供手動調整與提前結清。
 */
export const advanceSchema = z.object({
  id: idSchema,
  workerId: idSchema,
  /** 借支總額。 */
  amount: z.number().int('金額請填整數').positive('借支金額必須大於 0'),
  /** 每月約定還款金額。 */
  monthlyRepayment: z.number().int('金額請填整數').positive('每月還款金額必須大於 0'),
  /** 起扣月份。 */
  startMonth: payMonthSchema,
  /** 手動調整已還金額（對帳用），可為負數以沖銷多扣。 */
  repaidAdjustment: z.number().int(),
  /** 提前結清的月份；設定後該月結清餘額，之後不再扣款。 */
  settledMonth: payMonthSchema.nullable(),
  /** 借支日期與事由。 */
  borrowedOn: workDateSchema.optional(),
  note: z.string().max(200).optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const advanceCreateInputSchema = advanceSchema
  .pick({
    workerId: true,
    amount: true,
    monthlyRepayment: true,
    startMonth: true,
    borrowedOn: true,
    note: true,
  })
  .extend({
    repaidAdjustment: z.number().int().default(0),
    settledMonth: payMonthSchema.nullable().default(null),
  })
  .refine((value) => value.monthlyRepayment <= value.amount, {
    message: '每月還款金額不可大於借支總額',
    path: ['monthlyRepayment'],
  });

export const advanceUpdateInputSchema = advanceSchema
  .pick({
    amount: true,
    monthlyRepayment: true,
    startMonth: true,
    repaidAdjustment: true,
    settledMonth: true,
    borrowedOn: true,
    note: true,
  })
  .partial();

/** 額外派遣加給：當月的臨時工作另外給的薪資。 */
export const extraPaySchema = z.object({
  id: idSchema,
  workerId: idSchema,
  /** 歸屬的薪資月份。 */
  month: payMonthSchema,
  /** 實際發生日期，選填，方便對照出勤。 */
  workDate: workDateSchema.optional(),
  /** 項目說明，例如「假日吊車支援」。 */
  label: z.string().min(1, '請填寫項目說明').max(40, '說明過長'),
  amount: z.number().int('金額請填整數').positive('金額必須大於 0'),
  note: z.string().max(200).optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const extraPayCreateInputSchema = extraPaySchema.pick({
  workerId: true,
  month: true,
  workDate: true,
  label: true,
  amount: true,
  note: true,
});

export const extraPayUpdateInputSchema = extraPayCreateInputSchema.partial().omit({ workerId: true });

export type PayMonth = z.infer<typeof payMonthSchema>;
export type Advance = z.infer<typeof advanceSchema>;
export type AdvanceCreateInput = z.input<typeof advanceCreateInputSchema>;
export type AdvanceUpdateInput = z.input<typeof advanceUpdateInputSchema>;
export type ExtraPay = z.infer<typeof extraPaySchema>;
export type ExtraPayCreateInput = z.input<typeof extraPayCreateInputSchema>;
export type ExtraPayUpdateInput = z.input<typeof extraPayUpdateInputSchema>;
