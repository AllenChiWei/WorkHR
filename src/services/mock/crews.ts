import { crewCreateInputSchema, crewUpdateInputSchema } from '@/schemas/crew';
import type { Crew, CrewCreateInput, CrewUpdateInput } from '@/types';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { createId } from '@/lib/id';
import type { CrewRepository } from '../contracts';
import { commit, delay, getDb, nowIso } from './db';
import { requirePermission, requireUser } from './guard';

/** 依角色限制可見範圍：管理員看全部，領班只看得到自己的工班。 */
function visibleCrews(): Crew[] {
  const user = requireUser();
  const { crews } = getDb();
  if (user.role === 'admin') return crews;
  return crews.filter((crew) => crew.id === user.crewId);
}

export const mockCrewRepository: CrewRepository = {
  async list(): Promise<Crew[]> {
    await delay();
    return visibleCrews()
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
  },

  async getById(id: string): Promise<Crew | null> {
    await delay();
    return visibleCrews().find((crew) => crew.id === id) ?? null;
  },

  async create(input: CrewCreateInput): Promise<Crew> {
    await delay();
    requirePermission('crew:manage');

    const parsed = crewCreateInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? '工班資料不正確');
    }

    const db = getDb();
    if (db.crews.some((crew) => crew.name === parsed.data.name)) {
      throw new ConflictError('已有同名工班');
    }

    const timestamp = nowIso();
    const crew: Crew = {
      id: createId(),
      name: parsed.data.name,
      foremanId: parsed.data.foremanId,
      siteName: parsed.data.siteName,
      note: parsed.data.note,
      active: parsed.data.active,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    commit('crews', [...db.crews, crew]);
    return crew;
  },

  async update(id: string, input: CrewUpdateInput): Promise<Crew> {
    await delay();
    requirePermission('crew:manage');

    const parsed = crewUpdateInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? '工班資料不正確');
    }

    const db = getDb();
    const index = db.crews.findIndex((crew) => crew.id === id);
    if (index < 0) throw new NotFoundError('找不到工班');

    if (
      parsed.data.name &&
      db.crews.some((crew) => crew.id !== id && crew.name === parsed.data.name)
    ) {
      throw new ConflictError('已有同名工班');
    }

    // 指派領班時，該人員必須屬於這個工班
    if (parsed.data.foremanId) {
      const foreman = db.workers.find((worker) => worker.id === parsed.data.foremanId);
      if (!foreman) throw new NotFoundError('找不到要指派為領班的人員');
      if (foreman.crewId !== id) throw new ValidationError('只能指派本班成員擔任領班');
    }

    const next = db.crews.slice();
    const updated: Crew = {
      ...next[index]!,
      ...parsed.data,
      updatedAt: nowIso(),
    };
    next[index] = updated;
    commit('crews', next);

    // 同步把新領班的角色調整為 foreman，舊領班降回 worker
    if (parsed.data.foremanId !== undefined) {
      const workers = db.workers.map((worker) => {
        if (worker.crewId !== id) return worker;
        const shouldBeForeman = worker.id === parsed.data.foremanId;
        const role = shouldBeForeman ? ('foreman' as const) : ('worker' as const);
        if (worker.role === role) return worker;
        return {
          ...worker,
          role,
          hasAccount: shouldBeForeman ? true : worker.hasAccount,
          canSelfCheckIn: shouldBeForeman ? true : worker.canSelfCheckIn,
          updatedAt: nowIso(),
        };
      });
      commit('workers', workers);
    }

    return updated;
  },

  async remove(id: string): Promise<void> {
    await delay();
    requirePermission('crew:manage');

    const db = getDb();
    const crew = db.crews.find((item) => item.id === id);
    if (!crew) throw new NotFoundError('找不到工班');

    const memberCount = db.workers.filter((worker) => worker.crewId === id).length;
    if (memberCount > 0) {
      throw new ConflictError(`此工班還有 ${memberCount} 名成員，請先移出或改為停用`);
    }

    commit(
      'crews',
      db.crews.filter((item) => item.id !== id),
    );
  },
};
