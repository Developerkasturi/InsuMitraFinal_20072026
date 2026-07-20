import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { claimsService } from '@api/index';
import toast from 'react-hot-toast';

export function useClaims(params?: Record<string, any>) {
  return useQuery({ queryKey: ['claims', params], queryFn: () => claimsService.list(params) });
}

export function useClaim(id: string) {
  return useQuery({ queryKey: ['claims', id], queryFn: () => claimsService.get(id), enabled: !!id });
}

export function useClaimSummary() {
  return useQuery({ queryKey: ['claims', 'summary'], queryFn: () => claimsService.summary() });
}

export function useCreateClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: claimsService.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['claims'] }); toast.success('Claim created'); },
    onError:   (e: any) => toast.error(e.response?.data?.message ?? 'Error'),
  });
}

export function useUpdateClaimStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => claimsService.updateStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['claims'] }); toast.success('Status updated'); },
  });
}

export function useDeleteClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => claimsService.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['claims'] }); toast.success('Claim deleted'); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Error deleting claim'),
  });
}

export function useAddClaimExpense(claimId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => claimsService.addExpense(claimId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['claim', claimId] });
      qc.invalidateQueries({ queryKey: ['claims'] });
      toast.success('Expense added');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to add expense'),
  });
}

export function useRemoveClaimExpense(claimId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => claimsService.removeExpense(claimId, expenseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['claim', claimId] });
      qc.invalidateQueries({ queryKey: ['claims'] });
      toast.success('Expense removed');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to remove expense'),
  });
}
