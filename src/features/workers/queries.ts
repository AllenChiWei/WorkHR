import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WorkerCreateInput, WorkerUpdateInput } from '@/types';
import { services } from '@/services';
import { queryKeys } from '@/lib/queryKeys';

export function useWorkers(filter?: { crewId?: string | null; active?: boolean }) {
  return useQuery({
    queryKey: queryKeys.workers(filter),
    queryFn: () => services.workers.list(filter),
  });
}

export function useWorker(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.worker(id ?? ''),
    queryFn: () => services.workers.getById(id!),
    enabled: Boolean(id),
  });
}

function invalidateWorkers(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['workers'] });
  // 成員異動會影響工班的領班欄位
  void queryClient.invalidateQueries({ queryKey: queryKeys.crews });
}

export function useCreateWorker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkerCreateInput) => services.workers.create(input),
    onSuccess: () => invalidateWorkers(queryClient),
  });
}

export function useUpdateWorker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: WorkerUpdateInput }) =>
      services.workers.update(id, input),
    onSuccess: () => invalidateWorkers(queryClient),
  });
}

export function useRemoveWorker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => services.workers.remove(id),
    onSuccess: () => invalidateWorkers(queryClient),
  });
}

export function useAssignCrew() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workerId, crewId }: { workerId: string; crewId: string | null }) =>
      services.workers.assignCrew(workerId, crewId),
    onSuccess: () => invalidateWorkers(queryClient),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (workerId: string) => services.auth.resetPassword(workerId),
  });
}
