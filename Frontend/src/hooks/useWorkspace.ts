import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workspaceService, employeesService } from '@api/index';
import toast from 'react-hot-toast';

export function useWorkspaceData() {
  return useQuery({
    queryKey: ['workspace', 'data'],
    queryFn: workspaceService.getData,
    staleTime: 30_000,
  });
}

export function useClockIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: workspaceService.clockIn,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['workspace', 'data'] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success(res.message || 'Clocked in successfully');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Clock in failed'),
  });
}

export function useClockOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eodData?: {
      notes?: string;
      callsMade?: number;
      visitsCompleted?: number;
      premiumCollected?: number;
      nextDayPlan?: string;
    }) => workspaceService.clockOut(eodData),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['workspace', 'data'] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success(res.message || 'Clocked out successfully');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Clock out failed'),
  });
}

export function useUpsertDailyLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: employeesService.upsertDailyLog,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['workspace', 'data'] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success(res.message || 'Daily log saved');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to save daily log'),
  });
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      employeesService.updateTaskStatus(taskId, status),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['workspace', 'data'] });
      toast.success(res.message || 'Task status updated');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to update task'),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: employeesService.createTask,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['workspace', 'data'] });
      toast.success(res.message || 'Task created successfully');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to create task'),
  });
}

