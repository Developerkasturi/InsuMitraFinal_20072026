import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deletionRequestsService } from '@api/deletionRequestsService';
import { useAuthStore } from '@store/auth.store';
import { ShieldAlert, Check, X, Clock, Trash2, Shield, Calendar as CalendarIcon, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import clsx from 'clsx';
import DataTable, { Column } from '@comps/common/DataTable';
import Modal from '@comps/common/Modal';

export default function DeletionRequests() {
  const qc = useQueryClient();
  const { user: authUser } = useAuthStore();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');

  const isAdmin = authUser?.role === 'SUPERADMIN' || authUser?.role === 'OWNER';

  const { data: requestsRes, isLoading } = useQuery({
    queryKey: ['deletion-requests', page, statusFilter],
    queryFn: () => {
      const filters: any = { page, limit: 10 };
      if (statusFilter !== 'ALL') filters.status = statusFilter;
      // The backend should handle global vs scoped based on the JWT token.
      return deletionRequestsService.getRequests(filters);
    },
    enabled: isAdmin,
  });

  const requests = requestsRes?.data ?? [];
  const meta = requestsRes?.meta ?? { total: 0, pages: 1 };

  const [resolveTarget, setResolveTarget] = useState<any | null>(null);

  const resolveMutation = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: 'APPROVED' | 'REJECTED'; reason?: string }) => {
      return deletionRequestsService.resolveRequest(id, { action: status, adminNotes: reason });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deletion-requests'] });
      setResolveTarget(null);
      toast.success('Request resolved successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to resolve request');
    }
  });

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
        <ShieldAlert size={48} className="text-red-400" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  const columns: Column<any>[] = [
    {
      label: 'Entity Info',
      key: 'entityType',
      render: (row: any) => (
        <div>
          <div className="font-semibold text-gray-900">{row.entityType}</div>
          <div className="text-xs text-gray-500 mt-0.5">ID: <span className="font-mono">{row.entityId.slice(-6)}</span></div>
        </div>
      )
    },
    {
      label: 'Requested By',
      key: 'requestedBy',
      render: (row: any) => {
        const reqUser = typeof row.requestedBy === 'object' ? row.requestedBy : null;
        const name = reqUser?.name || (reqUser?.firstName ? `${reqUser.firstName} ${reqUser.lastName || ''}`.trim() : null) || 'Unknown User';
        const email = reqUser?.email || '';
        const initials = (reqUser?.firstName && reqUser?.lastName)
          ? `${reqUser.firstName[0]}${reqUser.lastName[0]}`.toUpperCase()
          : name.slice(0, 2).toUpperCase();

        return (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-xs shrink-0">
              {initials}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">{name}</div>
              {email && <div className="text-xs text-gray-500">{email}</div>}
            </div>
          </div>
        );
      }
    },
    {
      label: 'Reason / Details',
      key: 'reason',
      render: (row: any) => (
        <div className="max-w-xs text-sm text-gray-600 truncate" title={row.reason}>
          {row.reason || 'No reason provided'}
        </div>
      )
    },
    {
      label: 'Date',
      key: 'createdAt',
      render: (row: any) => (
        <div className="text-sm text-gray-600 flex items-center gap-1.5">
          <CalendarIcon size={14} className="text-gray-400" />
          {format(new Date(row.createdAt), 'dd MMM yyyy, HH:mm')}
        </div>
      )
    },
    {
      label: 'Status',
      key: 'status',
      render: (row: any) => {
        const badges: Record<string, string> = {
          PENDING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
          APPROVED: 'bg-green-50 text-green-700 border-green-200',
          REJECTED: 'bg-red-50 text-red-700 border-red-200',
        };
        return (
          <span className={clsx('px-2.5 py-1 text-xs font-semibold rounded-full border', badges[row.status] || 'bg-gray-50 text-gray-700')}>
            {row.status}
          </span>
        );
      }
    },
    {
      label: 'Action',
      key: 'id',
      render: (row: any) => {
        if (row.status !== 'PENDING') {
          return <div className="text-xs text-gray-400 font-medium tracking-wide px-2 uppercase">{row.status}</div>;
        }
        return (
          <div className="flex items-center gap-2">
            <button 
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-md transition-colors border border-emerald-100"
              onClick={() => setResolveTarget({ ...row, action: 'APPROVED' })}
            >
              <Check size={14} /> Approve
            </button>
            <button 
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 rounded-md transition-colors border border-red-100"
              onClick={() => setResolveTarget({ ...row, action: 'REJECTED' })}
            >
              <X size={14} /> Reject
            </button>
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Shield className="text-indigo-600" size={28} />
            Deletion Requests
          </h1>
          <p className="text-gray-500 mt-1">Review and manage delete requests submitted by employees.</p>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-lg p-1 border shadow-sm">
          {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(tab => (
            <button
              key={tab}
              onClick={() => { setStatusFilter(tab as any); setPage(1); }}
              className={clsx(
                'px-4 py-1.5 text-sm font-medium rounded-md transition-all',
                statusFilter === tab ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden border-t-4 border-t-indigo-500">
        <DataTable
          columns={columns as any}
          data={requests}
          rowKey={(row: any) => row.id}
          loading={isLoading}
          emptyMessage={`No ${statusFilter === 'ALL' ? '' : statusFilter.toLowerCase()} requests found.`}
        />
        {meta.pages > 1 && (
          <div className="flex justify-between items-center p-4 border-t bg-gray-50/50">
            <span className="text-sm text-gray-500 font-medium">Page {page} of {meta.pages}</span>
            <div className="flex gap-2">
              <button className="btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
              <button className="btn-secondary" disabled={page === meta.pages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>

      <Modal open={!!resolveTarget} onClose={() => setResolveTarget(null)} title={resolveTarget?.action === 'APPROVED' ? 'Approve Deletion' : 'Reject Deletion'} size="sm">
        <form onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          resolveMutation.mutate({
            id: resolveTarget!.id,
            status: resolveTarget!.action,
            reason: fd.get('reason') as string,
          });
        }}>
          <p className="text-sm text-gray-600 mb-4">
            Are you sure you want to <strong>{resolveTarget?.action === 'APPROVED' ? 'approve' : 'reject'}</strong> the deletion of <strong>{resolveTarget?.entityType}</strong> (ID: {resolveTarget?.entityId.slice(-6)})?
          </p>
          
          <div className="mb-6">
            <label className="label">Admin Notes / Reason (Optional)</label>
            <textarea name="reason" className="input" rows={3} placeholder={`Why are you ${resolveTarget?.action === 'APPROVED' ? 'approving' : 'rejecting'} this request?`}></textarea>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setResolveTarget(null)}>Cancel</button>
            <button 
              type="submit" 
              className={resolveTarget?.action === 'APPROVED' ? 'btn-danger' : 'btn-primary'}
              disabled={resolveMutation.isPending}
            >
              {resolveMutation.isPending ? 'Processing...' : resolveTarget?.action === 'APPROVED' ? 'Approve & Delete' : 'Reject Request'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
