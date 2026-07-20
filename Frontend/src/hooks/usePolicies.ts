import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { policiesService } from '@api/index';
import toast from 'react-hot-toast';

export function usePolicies(params?: Record<string, any>) {
  return useQuery({ queryKey: ['policies', params], queryFn: () => policiesService.list(params) });
}

export function usePolicy(id: string) {
  return useQuery({ queryKey: ['policies', id], queryFn: () => policiesService.get(id), enabled: !!id });
}

export function useCreatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: policiesService.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['policies'] }); toast.success('Policy created'); },
    onError: (e: any) => {
      const errs: string[] = e?.response?.data?.errors ?? [];
      const msg = errs.length ? errs.join(' · ') : (e?.response?.data?.message ?? 'Error creating policy');
      toast.error(msg, { duration: 6000 });
    },
  });
}

export function useUpdatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => policiesService.update(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['policies'] }); toast.success('Policy updated'); },
    onError: (e: any) => {
      const errs: string[] = e?.response?.data?.errors ?? [];
      const msg = errs.length ? errs.join(' · ') : (e?.response?.data?.message ?? 'Error updating policy');
      toast.error(msg, { duration: 6000 });
    },
  });
}

export function useDeletePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => policiesService.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['policies'] }); toast.success('Policy deleted'); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Error deleting policy'),
  });
}

export function useBulkAssignPolicies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, assignedEmployeeId }: { ids: string[]; assignedEmployeeId: string | null }) =>
      policiesService.bulkAssign(ids, assignedEmployeeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policies'] });
      toast.success('Policies successfully reassigned');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to reassign policies'),
  });
}

