import { attendanceQuerySchema, attendanceWriteSchema } from '@/schemas/attendance';
import type { AttendanceQuery, AttendanceRecord, AuthUser } from '@/types';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { createId } from '@/lib/id';
import { todayWorkDate } from '@/lib/date';
import { validatePunchTimes } from '@/lib/attendance';
import type {
  AttendanceRepository,
  BatchPunchInput,
  PunchInput,
  UpsertAttendanceInput,
} from '../contracts';
import { commit, delay, getDb, nowIso } from './db';
import { requirePermission, requireUser } from './guard';

/**
 * 寫入權限：
 *   管理員 — 任何工班、任何日期
 *   領班   — 僅本班、僅當日
 *   師傅   — 僅自己、僅當日，且需開通自行打卡
 */
function assertCanWrite(crewId: string, workDate: string, workerId: string): AuthUser {
  const user = requireUser();
  if (user.role === 'admin') return user;

  if (user.role === 'foreman') {
    return requirePermission('attendance:edit', { crewId, workDate });
  }

  if (workerId !== user.workerId) {
    throw new ForbiddenError('你只能操作自己的打卡紀錄');
  }
  requirePermission('attendance:punchSelf', { crewId });
  if (workDate !== todayWorkDate()) {
    throw new ForbiddenError('僅管理員可修改非當日的打卡紀錄');
  }
  return user;
}

/** 讀取權限：把查詢條件限縮到使用者可見的範圍。 */
function scopeQuery(query: AttendanceQuery): AttendanceQuery {
  const user = requireUser();
  if (user.role === 'admin') return query;

  if (user.role === 'foreman') {
    if (query.crewId && query.crewId !== user.crewId) {
      throw new ForbiddenError('你只能檢視本班的打卡資料');
    }
    return { ...query, crewId: user.crewId ?? undefined };
  }

  return { ...query, workerId: user.workerId ?? undefined };
}

function matches(record: AttendanceRecord, query: AttendanceQuery): boolean {
  if (query.crewId && record.crewId !== query.crewId) return false;
  if (query.workerId && record.workerId !== query.workerId) return false;
  if (query.status && record.status !== query.status) return false;
  if (query.from && record.workDate < query.from) return false;
  if (query.to && record.workDate > query.to) return false;
  return true;
}

function findRecord(workerId: string, workDate: string): AttendanceRecord | null {
  return (
    getDb().attendance.find(
      (record) => record.workerId === workerId && record.workDate === workDate,
    ) ?? null
  );
}

function persist(record: AttendanceRecord): AttendanceRecord {
  const db = getDb();
  const index = db.attendance.findIndex((item) => item.id === record.id);
  const next = db.attendance.slice();
  if (index < 0) {
    next.push(record);
  } else {
    next[index] = record;
  }
  commit('attendance', next);
  return record;
}

function blankRecord(
  workerId: string,
  crewId: string,
  workDate: string,
  actorId: string,
): AttendanceRecord {
  const timestamp = nowIso();
  return {
    id: createId(),
    workerId,
    crewId,
    workDate,
    checkInAt: null,
    checkOutAt: null,
    status: 'present',
    recordedBy: actorId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function applyPunch(record: AttendanceRecord, input: PunchInput, actorId: string): AttendanceRecord {
  if (record.status !== 'present') {
    throw new ValidationError('此人員狀態為請假或未到，無法打卡');
  }

  const at = input.at ?? nowIso();

  if (input.kind === 'in') {
    // 重複打卡防呆：已有上班時間時必須明確要求覆蓋
    if (record.checkInAt && !input.overwrite) {
      throw new ConflictError('已有上班打卡紀錄，確定要覆蓋嗎？');
    }
    const error = validatePunchTimes(at, record.checkOutAt);
    if (error) throw new ValidationError(error);
    return { ...record, checkInAt: at, lastModifiedBy: actorId, updatedAt: nowIso() };
  }

  if (!record.checkInAt) {
    throw new ValidationError('尚未打上班卡，無法打下班卡');
  }
  if (record.checkOutAt && !input.overwrite) {
    throw new ConflictError('已有下班打卡紀錄，確定要覆蓋嗎？');
  }
  const error = validatePunchTimes(record.checkInAt, at);
  if (error) throw new ValidationError(error);
  return { ...record, checkOutAt: at, lastModifiedBy: actorId, updatedAt: nowIso() };
}

export const mockAttendanceRepository: AttendanceRepository = {
  async list(query: AttendanceQuery = {}): Promise<AttendanceRecord[]> {
    await delay();
    const parsed = attendanceQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? '查詢條件不正確');
    }
    const scoped = scopeQuery(parsed.data);
    return getDb()
      .attendance.filter((record) => matches(record, scoped))
      .sort((a, b) => b.workDate.localeCompare(a.workDate) || a.workerId.localeCompare(b.workerId));
  },

  async getById(id: string): Promise<AttendanceRecord | null> {
    await delay();
    const record = getDb().attendance.find((item) => item.id === id);
    if (!record) return null;
    const scoped = scopeQuery({});
    return matches(record, scoped) ? record : null;
  },

  async listDaily(crewId: string, workDate: string): Promise<AttendanceRecord[]> {
    await delay();
    const user = requireUser();
    if (user.role !== 'admin') {
      requirePermission(user.role === 'foreman' ? 'attendance:viewCrew' : 'attendance:punchSelf', {
        crewId,
      });
    }
    return getDb().attendance.filter(
      (record) =>
        record.crewId === crewId &&
        record.workDate === workDate &&
        (user.role === 'worker' ? record.workerId === user.workerId : true),
    );
  },

  async punch(input: PunchInput): Promise<AttendanceRecord> {
    await delay();
    const actor = assertCanWrite(input.crewId, input.workDate, input.workerId);
    const existing = findRecord(input.workerId, input.workDate);
    const base = existing ?? blankRecord(input.workerId, input.crewId, input.workDate, actor.id);
    return persist(applyPunch(base, input, actor.id));
  },

  async batchPunch(input: BatchPunchInput): Promise<AttendanceRecord[]> {
    await delay();
    const actor = requireUser();
    const results: AttendanceRecord[] = [];
    const at = input.at ?? nowIso();

    for (const workerId of input.workerIds) {
      assertCanWrite(input.crewId, input.workDate, workerId);
      const existing = findRecord(workerId, input.workDate);
      const base = existing ?? blankRecord(workerId, input.crewId, input.workDate, actor.id);

      // 批次打卡「不覆蓋」已打卡者：遇到衝突就跳過，不中斷整批
      try {
        results.push(
          persist(
            applyPunch(base, { ...input, workerId, overwrite: false, at }, actor.id),
          ),
        );
      } catch {
        continue;
      }
    }

    return results;
  },

  async upsert(input: UpsertAttendanceInput): Promise<AttendanceRecord> {
    await delay();
    const actor = assertCanWrite(input.crewId, input.workDate, input.workerId);

    const parsed = attendanceWriteSchema.safeParse({
      checkInAt: input.checkInAt,
      checkOutAt: input.checkOutAt,
      status: input.status,
      note: input.note,
    });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? '打卡資料不正確');
    }

    const existing = findRecord(input.workerId, input.workDate);
    const base = existing ?? blankRecord(input.workerId, input.crewId, input.workDate, actor.id);

    const merged: AttendanceRecord = {
      ...base,
      ...(parsed.data.checkInAt !== undefined ? { checkInAt: parsed.data.checkInAt } : {}),
      ...(parsed.data.checkOutAt !== undefined ? { checkOutAt: parsed.data.checkOutAt } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.note !== undefined ? { note: parsed.data.note } : {}),
      lastModifiedBy: actor.id,
      updatedAt: nowIso(),
    };

    // 改為請假／未到時清掉時間，避免留下矛盾資料
    if (merged.status !== 'present') {
      merged.checkInAt = null;
      merged.checkOutAt = null;
    }

    const error = validatePunchTimes(merged.checkInAt, merged.checkOutAt);
    if (error) throw new ValidationError(error);

    return persist(merged);
  },

  async remove(id: string): Promise<void> {
    await delay();
    const db = getDb();
    const record = db.attendance.find((item) => item.id === id);
    if (!record) throw new NotFoundError('找不到打卡紀錄');
    assertCanWrite(record.crewId, record.workDate, record.workerId);
    commit(
      'attendance',
      db.attendance.filter((item) => item.id !== id),
    );
  },
};
