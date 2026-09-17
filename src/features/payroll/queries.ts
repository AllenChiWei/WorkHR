import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdvanceCreateInput,
  AdvanceUpdateInput,
  ExtraPayCreateInput,
  ExtraPayUpdateInput,
} from '@/types';
import { services } from '@/services';

const advanceKey = (filter?: { workerId?: string }) => ['advances', filter ?? {}] as const;
const extraPayKey = (filter?: { workerId?: string; month?: string }) =>
  ['extraPays', filter ?? {}] as const;

export function useAdvances(filter?: { workerId?: string }) {
  return useQuery({
    queryKey: advanceKey(filter),
    queryFn: () => services.payroll.listAdvances(filter),
  });
}

export function useExtraPays(filter?: { workerId?: string; month?: string }) {
  return useQuery({
    queryKey: extraPayKey(filter),
    queryFn: () => services.payroll.listExtraPays(filter),
  });
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>, key: 'advances' | 'extraPays') {
  void queryClient.invalidateQueries({ queryKey: [key] });
}

export function useCreateAdvance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdvanceCreateInput) => services.payroll.createAdvance(input),
    onSuccess: () => invalidate(queryClient, 'advances'),
  });
}

export function useUpdateAdvance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdvanceUpdateInput }) =>
      services.payroll.updateAdvance(id, input),
    onSuccess: () => invalidate(queryClient, 'advances'),
  });
}

export function useRemoveAdvance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => services.payroll.removeAdvance(id),
    onSuccess: () => invalidate(queryClient, 'advances'),
  });
}

export function useCreateExtraPay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ExtraPayCreateInput) => services.payroll.createExtraPay(input),
    onSuccess: () => invalidate(queryClient, 'extraPays'),
  });
}

export function useUpdateExtraPay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ExtraPayUpdateInput }) =>
      services.payroll.updateExtraPay(id, input),
    onSuccess: () => invalidate(queryClient, 'extraPays'),
  });
}

export function useRemoveExtraPay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => services.payroll.removeExtraPay(id),
    onSuccess: () => invalidate(queryClient, 'extraPays'),
  });
}
