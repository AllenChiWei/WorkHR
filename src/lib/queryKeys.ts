import type { AttendanceQuery } from '@/types';

/** 集中管理 query key，避免各頁自行拼字串導致快取失效不一致。 */
export const queryKeys = {
  crews: ['crews'] as const,
  crew: (id: string) => ['crews', id] as const,
  workers: (filter?: { crewId?: string | null; active?: boolean }) =>
    ['workers', filter ?? {}] as const,
  worker: (id: string) => ['workers', 'detail', id] as const,
  attendance: (query: AttendanceQuery) => ['attendance', query] as const,
  attendanceDaily: (crewId: string, workDate: string) =>
    ['attendance', 'daily', crewId, workDate] as const,
};
