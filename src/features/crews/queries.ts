import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Crew, CrewCreateInput, CrewUpdateInput } from '@/types';
import { services } from '@/services';
import { queryKeys } from '@/lib/queryKeys';

export function useCrews() {
  return useQuery({
    queryKey: queryKeys.crews,
    queryFn: () => services.crews.list(),
  });
}

export function useCrew(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.crew(id ?? ''),
    queryFn: () => services.crews.getById(id!),
    enabled: Boolean(id),
  });
}

export function useCreateCrew() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrewCreateInput) => services.crews.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.crews });
    },
  });
}

export function useUpdateCrew() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CrewUpdateInput }) =>
      services.crews.update(id, input),
    onSuccess: (crew: Crew) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.crews });
      void queryClient.invalidateQueries({ queryKey: queryKeys.crew(crew.id) });
      // 指派領班會連動人員角色
      void queryClient.invalidateQueries({ queryKey: ['workers'] });
    },
  });
}

export function useRemoveCrew() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => services.crews.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.crews });
    },
  });
}
