import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AttendanceQuery, AttendanceRecord } from '@/types';
import { services } from '@/services';
import type { BatchPunchInput, PunchInput, UpsertAttendanceInput } from '@/services/contracts';
import { queryKeys } from '@/lib/queryKeys';
import { createId } from '@/lib/id';

export function useDailyAttendance(crewId: string | undefined, workDate: string) {
  return useQuery({
    queryKey: queryKeys.attendanceDaily(crewId ?? '', workDate),
    queryFn: () => services.attendance.listDaily(crewId!, workDate),
    enabled: Boolean(crewId),
  });
}

export function useAttendanceList(query: AttendanceQuery, enabled = true) {
  return useQuery({
    queryKey: queryKeys.attendance(query),
    queryFn: () => services.attendance.list(query),
    enabled,
  });
}

type DailyCache = AttendanceRecord[] | undefined;

/** 在快取中就地套用一筆變更，供 optimistic update 使用。 */
function patchDaily(
  records: DailyCache,
  workerId: string,
  patch: (record: AttendanceRecord | undefined) => AttendanceRecord,
): AttendanceRecord[] {
  const list = records ?? [];
  const index = list.findIndex((record) => record.workerId === workerId);
  if (index < 0) return [...list, patch(undefined)];
  const next = list.slice();
  next[index] = patch(list[index]);
  return next;
}

function optimisticRecord(
  base: AttendanceRecord | undefined,
  input: { workerId: string; crewId: string; workDate: string },
  changes: Partial<AttendanceRecord>,
): AttendanceRecord {
  const now = new Date().toISOString();
  return {
    id: base?.id ?? `optimistic-${createId()}`,
    workerId: input.workerId,
    crewId: input.crewId,
    workDate: input.workDate,
    checkInAt: base?.checkInAt ?? null,
    checkOutAt: base?.checkOutAt ?? null,
    status: base?.status ?? 'present',
    note: base?.note,
    recordedBy: base?.recordedBy ?? '',
    lastModifiedBy: base?.lastModifiedBy,
    createdAt: base?.createdAt ?? now,
    updatedAt: now,
    ...changes,
  };
}

interface DailyContext {
  previous: DailyCache;
}

/**
 * 單人打卡。採 optimistic update：先改快取讓該列立刻反應，
 * 失敗時由 onError 回滾，畫面再顯示可重試的錯誤 toast。
 */
export function usePunch() {
  const queryClient = useQueryClient();

  return useMutation<AttendanceRecord, Error, PunchInput, DailyContext>({
    mutationFn: (input) => services.attendance.punch(input),

    onMutate: async (input) => {
      const key = queryKeys.attendanceDaily(input.crewId, input.workDate);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<AttendanceRecord[]>(key);
      const at = input.at ?? new Date().toISOString();

      queryClient.setQueryData<AttendanceRecord[]>(key, (current) =>
        patchDaily(current, input.workerId, (record) =>
          optimisticRecord(
            record,
            input,
            input.kind === 'in' ? { checkInAt: at } : { checkOutAt: at },
          ),
        ),
      );

      return { previous };
    },

    onError: (_error, input, context) => {
      queryClient.setQueryData(
        queryKeys.attendanceDaily(input.crewId, input.workDate),
        context?.previous,
      );
    },

    onSettled: (_data, _error, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.attendanceDaily(input.crewId, input.workDate),
      });
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
}

/** 全班打卡：同樣先改快取，失敗整批回滾。 */
export function useBatchPunch() {
  const queryClient = useQueryClient();

  return useMutation<AttendanceRecord[], Error, BatchPunchInput, DailyContext>({
    mutationFn: (input) => services.attendance.batchPunch(input),

    onMutate: async (input) => {
      const key = queryKeys.attendanceDaily(input.crewId, input.workDate);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<AttendanceRecord[]>(key);
      const at = input.at ?? new Date().toISOString();

      queryClient.setQueryData<AttendanceRecord[]>(key, (current) => {
        let next = current ?? [];
        for (const workerId of input.workerIds) {
          next = patchDaily(next, workerId, (record) =>
            optimisticRecord(
              record,
              { workerId, crewId: input.crewId, workDate: input.workDate },
              input.kind === 'in' ? { checkInAt: at } : { checkOutAt: at },
            ),
          );
        }
        return next;
      });

      return { previous };
    },

    onError: (_error, input, context) => {
      queryClient.setQueryData(
        queryKeys.attendanceDaily(input.crewId, input.workDate),
        context?.previous,
      );
    },

    onSettled: (_data, _error, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.attendanceDaily(input.crewId, input.workDate),
      });
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
}

/** 修改時間、狀態或備註。 */
export function useUpsertAttendance() {
  const queryClient = useQueryClient();

  return useMutation<AttendanceRecord, Error, UpsertAttendanceInput, DailyContext>({
    mutationFn: (input) => services.attendance.upsert(input),

    onMutate: async (input) => {
      const key = queryKeys.attendanceDaily(input.crewId, input.workDate);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<AttendanceRecord[]>(key);

      queryClient.setQueryData<AttendanceRecord[]>(key, (current) =>
        patchDaily(current, input.workerId, (record) => {
          const next = optimisticRecord(record, input, {
            ...(input.checkInAt !== undefined ? { checkInAt: input.checkInAt } : {}),
            ...(input.checkOutAt !== undefined ? { checkOutAt: input.checkOutAt } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.note !== undefined ? { note: input.note } : {}),
          });
          if (next.status !== 'present') {
            next.checkInAt = null;
            next.checkOutAt = null;
          }
          return next;
        }),
      );

      return { previous };
    },

    onError: (_error, input, context) => {
      queryClient.setQueryData(
        queryKeys.attendanceDaily(input.crewId, input.workDate),
        context?.previous,
      );
    },

    onSettled: (_data, _error, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.attendanceDaily(input.crewId, input.workDate),
      });
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
}
