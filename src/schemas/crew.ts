import { z } from 'zod';
import { idSchema, isoDateTimeSchema } from './common';

export const crewSchema = z.object({
  id: idSchema,
  name: z.string().min(1, '工班名稱必填').max(40, '工班名稱過長'),
  foremanId: idSchema.nullable(),
  siteName: z.string().max(60).optional(),
  note: z.string().max(200).optional(),
  active: z.boolean(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const crewCreateInputSchema = crewSchema
  .pick({ name: true, siteName: true, note: true })
  .extend({
    foremanId: idSchema.nullable().default(null),
    active: z.boolean().default(true),
  });

export const crewUpdateInputSchema = crewCreateInputSchema.partial();

export type Crew = z.infer<typeof crewSchema>;
export type CrewCreateInput = z.input<typeof crewCreateInputSchema>;
export type CrewUpdateInput = z.input<typeof crewUpdateInputSchema>;
