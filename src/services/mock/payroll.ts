import {
  advanceCreateInputSchema,
  advanceUpdateInputSchema,
  extraPayCreateInputSchema,
  extraPayUpdateInputSchema,
} from '@/schemas/payroll';
import type {
  Advance,
  AdvanceCreateInput,
  AdvanceUpdateInput,
  ExtraPay,
  ExtraPayCreateInput,
  ExtraPayUpdateInput,
} from '@/types';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { createId } from '@/lib/id';
import type { PayrollRepository } from '../contracts';
import { commit, delay, getDb, nowIso } from './db';
import { requirePermission } from './guard';

/** 薪資資料只有管理員可讀寫，每個方法都先過權限閘門。 */
export const mockPayrollRepository: PayrollRepository = {
  async listAdvances(filter): Promise<Advance[]> {
    await delay();
    requirePermission('payroll:manage');
    return getDb()
      .advances.filter((advance) => !filter?.workerId || advance.workerId === filter.workerId)
      .sort((a, b) => b.startMonth.localeCompare(a.startMonth));
  },

  async createAdvance(input: AdvanceCreateInput): Promise<Advance> {
    await delay();
    requirePermission('payroll:manage');

    const parsed = advanceCreateInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? '借支資料不正確');
    }

    const db = getDb();
    if (!db.workers.some((worker) => worker.id === parsed.data.workerId)) {
      throw new NotFoundError('找不到人員');
    }

    const timestamp = nowIso();
    const advance: Advance = {
      id: createId(),
      workerId: parsed.data.workerId,
      amount: parsed.data.amount,
      monthlyRepayment: parsed.data.monthlyRepayment,
      startMonth: parsed.data.startMonth,
      repaidAdjustment: parsed.data.repaidAdjustment,
      settledMonth: parsed.data.settledMonth,
      borrowedOn: parsed.data.borrowedOn,
      note: parsed.data.note,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    commit('advances', [...db.advances, advance]);
    return advance;
  },

  async updateAdvance(id: string, input: AdvanceUpdateInput): Promise<Advance> {
    await delay();
    requirePermission('payroll:manage');

    const parsed = advanceUpdateInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? '借支資料不正確');
    }

    const db = getDb();
    const index = db.advances.findIndex((advance) => advance.id === id);
    if (index < 0) throw new NotFoundError('找不到借支紀錄');

    const merged: Advance = { ...db.advances[index]!, ...parsed.data, updatedAt: nowIso() };
    if (merged.monthlyRepayment > merged.amount) {
      throw new ValidationError('每月還款金額不可大於借支總額');
    }

    const next = db.advances.slice();
    next[index] = merged;
    commit('advances', next);
    return merged;
  },

  async removeAdvance(id: string): Promise<void> {
    await delay();
    requirePermission('payroll:manage');

    const db = getDb();
    if (!db.advances.some((advance) => advance.id === id)) {
      throw new NotFoundError('找不到借支紀錄');
    }
    commit(
      'advances',
      db.advances.filter((advance) => advance.id !== id),
    );
  },

  async listExtraPays(filter): Promise<ExtraPay[]> {
    await delay();
    requirePermission('payroll:manage');
    return getDb()
      .extraPays.filter((entry) => {
        if (filter?.workerId && entry.workerId !== filter.workerId) return false;
        if (filter?.month && entry.month !== filter.month) return false;
        return true;
      })
      .sort((a, b) => b.month.localeCompare(a.month) || a.label.localeCompare(b.label, 'zh-Hant'));
  },

  async createExtraPay(input: ExtraPayCreateInput): Promise<ExtraPay> {
    await delay();
    requirePermission('payroll:manage');

    const parsed = extraPayCreateInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? '加給資料不正確');
    }

    const db = getDb();
    if (!db.workers.some((worker) => worker.id === parsed.data.workerId)) {
      throw new NotFoundError('找不到人員');
    }

    const timestamp = nowIso();
    const entry: ExtraPay = {
      id: createId(),
      ...parsed.data,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    commit('extraPays', [...db.extraPays, entry]);
    return entry;
  },

  async updateExtraPay(id: string, input: ExtraPayUpdateInput): Promise<ExtraPay> {
    await delay();
    requirePermission('payroll:manage');

    const parsed = extraPayUpdateInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? '加給資料不正確');
    }

    const db = getDb();
    const index = db.extraPays.findIndex((entry) => entry.id === id);
    if (index < 0) throw new NotFoundError('找不到加給紀錄');

    const merged: ExtraPay = { ...db.extraPays[index]!, ...parsed.data, updatedAt: nowIso() };
    const next = db.extraPays.slice();
    next[index] = merged;
    commit('extraPays', next);
    return merged;
  },

  async removeExtraPay(id: string): Promise<void> {
    await delay();
    requirePermission('payroll:manage');

    const db = getDb();
    if (!db.extraPays.some((entry) => entry.id === id)) {
      throw new NotFoundError('找不到加給紀錄');
    }
    commit(
      'extraPays',
      db.extraPays.filter((entry) => entry.id !== id),
    );
  },
};
