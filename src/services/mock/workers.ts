import { workerCreateInputSchema, workerUpdateInputSchema } from '@/schemas/worker';
import type { Worker, WorkerCreateInput, WorkerUpdateInput } from '@/types';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { createId } from '@/lib/id';
import type { WorkerRepository } from '../contracts';
import { commit, delay, getDb, nowIso, type MockAccount } from './db';
import { requirePermission, requireUser } from './guard';
import { DEFAULT_PASSWORD } from './seed';

/** 由員工編號／手機推導登入帳號，重複時補流水號。 */
function deriveUsername(worker: Worker, accounts: MockAccount[]): string {
  const base = (worker.employeeNo ?? worker.phone ?? worker.id.slice(0, 6)).toLowerCase();
  let candidate = base;
  let suffix = 1;
  while (accounts.some((account) => account.username === candidate)) {
    candidate = `${base}-${suffix++}`;
  }
  return candidate;
}

/** 依 hasAccount 建立或移除 mock 帳號。 */
function syncAccount(worker: Worker): void {
  const db = getDb();
  const existing = db.accounts.find((account) => account.workerId === worker.id);

  if (worker.hasAccount && !existing) {
    commit('accounts', [
      ...db.accounts,
      {
        id: createId(),
        username: deriveUsername(worker, db.accounts),
        password: DEFAULT_PASSWORD,
        role: worker.role,
        name: worker.name,
        workerId: worker.id,
      },
    ]);
    return;
  }

  if (!worker.hasAccount && existing) {
    commit(
      'accounts',
      db.accounts.filter((account) => account.workerId !== worker.id),
    );
    return;
  }

  if (worker.hasAccount && existing && (existing.role !== worker.role || existing.name !== worker.name)) {
    commit(
      'accounts',
      db.accounts.map((account) =>
        account.workerId === worker.id
          ? { ...account, role: worker.role, name: worker.name }
          : account,
      ),
    );
  }
}

function visibleWorkers(): Worker[] {
  const user = requireUser();
  const { workers } = getDb();
  if (user.role === 'admin') return workers;
  if (user.role === 'foreman') return workers.filter((worker) => worker.crewId === user.crewId);
  return workers.filter((worker) => worker.id === user.workerId);
}

export const mockWorkerRepository: WorkerRepository = {
  async list(filter): Promise<Worker[]> {
    await delay();
    return visibleWorkers()
      .filter((worker) => {
        if (filter?.crewId !== undefined && worker.crewId !== filter.crewId) return false;
        if (filter?.active !== undefined && worker.active !== filter.active) return false;
        return true;
      })
      .slice()
      .sort((a, b) => {
        if (a.role !== b.role) return a.role === 'foreman' ? -1 : 1;
        return a.name.localeCompare(b.name, 'zh-Hant');
      });
  },

  async getById(id: string): Promise<Worker | null> {
    await delay();
    return visibleWorkers().find((worker) => worker.id === id) ?? null;
  },

  async create(input: WorkerCreateInput): Promise<Worker> {
    await delay();
    requirePermission('worker:manage');

    const parsed = workerCreateInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? '人員資料不正確');
    }

    const db = getDb();
    if (
      parsed.data.employeeNo &&
      db.workers.some((worker) => worker.employeeNo === parsed.data.employeeNo)
    ) {
      throw new ConflictError('員工編號重複');
    }
    if (parsed.data.crewId && !db.crews.some((crew) => crew.id === parsed.data.crewId)) {
      throw new NotFoundError('找不到指定的工班');
    }

    const timestamp = nowIso();
    const worker: Worker = {
      id: createId(),
      name: parsed.data.name,
      crewId: parsed.data.crewId,
      role: parsed.data.role,
      phone: parsed.data.phone,
      employeeNo: parsed.data.employeeNo,
      canSelfCheckIn: parsed.data.canSelfCheckIn,
      hasAccount: parsed.data.hasAccount,
      active: parsed.data.active,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    commit('workers', [...db.workers, worker]);
    syncAccount(worker);
    return worker;
  },

  async update(id: string, input: WorkerUpdateInput): Promise<Worker> {
    await delay();
    requirePermission('worker:manage');

    const parsed = workerUpdateInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? '人員資料不正確');
    }

    const db = getDb();
    const index = db.workers.findIndex((worker) => worker.id === id);
    if (index < 0) throw new NotFoundError('找不到人員');

    const merged: Worker = {
      ...db.workers[index]!,
      ...parsed.data,
      updatedAt: nowIso(),
    };

    // 開通自行打卡必須同時有帳號（schema 已擋，這裡再保險一次）
    if (merged.canSelfCheckIn && !merged.hasAccount) {
      throw new ValidationError('開通自行打卡前必須先建立登入帳號');
    }
    if (
      merged.employeeNo &&
      db.workers.some((worker) => worker.id !== id && worker.employeeNo === merged.employeeNo)
    ) {
      throw new ConflictError('員工編號重複');
    }

    const next = db.workers.slice();
    next[index] = merged;
    commit('workers', next);
    syncAccount(merged);

    // 領班被移出工班或停用時，解除工班的領班指派
    const crews = db.crews.map((crew) => {
      if (crew.foremanId !== id) return crew;
      const stillValid = merged.active && merged.crewId === crew.id && merged.role === 'foreman';
      return stillValid ? crew : { ...crew, foremanId: null, updatedAt: nowIso() };
    });
    commit('crews', crews);

    return merged;
  },

  async remove(id: string): Promise<void> {
    await delay();
    requirePermission('worker:manage');

    const db = getDb();
    if (!db.workers.some((worker) => worker.id === id)) throw new NotFoundError('找不到人員');

    const recordCount = db.attendance.filter((record) => record.workerId === id).length;
    if (recordCount > 0) {
      throw new ConflictError(`此人員已有 ${recordCount} 筆打卡紀錄，請改為停用`);
    }

    commit(
      'workers',
      db.workers.filter((worker) => worker.id !== id),
    );
    commit(
      'accounts',
      db.accounts.filter((account) => account.workerId !== id),
    );
    commit(
      'crews',
      db.crews.map((crew) => (crew.foremanId === id ? { ...crew, foremanId: null } : crew)),
    );
  },

  async assignCrew(workerId: string, crewId: string | null): Promise<Worker> {
    return mockWorkerRepository.update(workerId, { crewId });
  },
};
