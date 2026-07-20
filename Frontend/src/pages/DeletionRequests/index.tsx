import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deletionRequestsService } from '@api/deletionRequestsService';
import { superAdminService } from '@api/superadmin.service';
import Modal from '@comps/common/Modal';
import { CheckCircle2, XCircle, Clock3, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

type RequestRow = {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  reason?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedBy?: string;
  resolvedBy?: string | null;
  createdAt?: string;
  resolvedAt?: string | null;
};

export default function DeletionRequestsPage() {
  const qc = useQueryClient();
  const { pathname } = useLocation();
  const isSuperadminRoute = pathname.startsWith('/superadmin');
  const [actionTarget, setActionTarget] = useState<{ row: RequestRow; action: 'APPROVED' | 'REJECTED' } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['deletion-requests', isSuperadminRoute],
    queryFn: () => isSuperadminRoute
      ? superAdminService.getDeletionRequests()
      : deletionRequestsService.getRequests(),
  });

  const requests: RequestRow[] = useMemo(() => data?.data ?? [], [data]);

  const resolveRequest = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'APPROVED' | 'REJECTED' }) =>
      isSuperadminRoute
        ? superAdminService.resolveDeletionRequest(id, action)
        : deletionRequestsService.resolveRequest(id, action),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['deletion-requests'] });
      toast.success(vars.action === 'APPROVED' ? 'Deletion approved' : 'Deletion rejected');
      setActionTarget(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update request'),
  });

  const confirmAction = () => {
    if (!actionTarget) return;
    resolveRequest.mutate({ id: actionTarget.row.id, action: actionTarget.action });
  };

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deletion Requests</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review deletion requests and approve or reject them before any record is removed.
          </p>
        </div>
        <div className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold">
          Pending: {pendingCount}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Clock3 size={16} className="text-amber-500" />
          <h2 className="font-semibold text-gray-900">Requests</h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-sm text-gray-400">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <Trash2 size={28} className="mx-auto mb-3 text-gray-200" />
            No deletion requests found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-5 py-3 text-left">Entity</th>
                  <th className="px-5 py-3 text-left">Tenant</th>
                  <th className="px-5 py-3 text-left">Requested By</th>
                  <th className="px-5 py-3 text-left">Reason</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50/70">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-gray-900">{req.entityType}</div>
                      <div className="text-xs text-gray-400 break-all">{req.entityId}</div>
                    </td>
                    <td className="px-5 py-4 text-gray-700 break-all">{req.tenantId}</td>
                    <td className="px-5 py-4 text-gray-700 break-all">{req.requestedBy ?? '—'}</td>
                    <td className="px-5 py-4 text-gray-600 max-w-[280px]">{req.reason || 'No reason provided'}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        req.status === 'PENDING'
                          ? 'bg-amber-50 text-amber-700'
                          : req.status === 'APPROVED'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-red-50 text-red-700'
                      }`}>
                        {req.status === 'PENDING' ? <Clock3 size={12} /> : req.status === 'APPROVED' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {req.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-500">
                      {req.createdAt ? format(new Date(req.createdAt), 'dd MMM yyyy, HH:mm') : '—'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {req.status === 'PENDING' ? (
                        <div className="inline-flex gap-2">
                          <button
                            className="btn-secondary text-xs"
                            onClick={() => setActionTarget({ row: req, action: 'REJECTED' })}
                          >
                            Reject
                          </button>
                          <button
                            className="btn-danger text-xs"
                            onClick={() => setActionTarget({ row: req, action: 'APPROVED' })}
                          >
                            Approve & Delete
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">
                          {req.resolvedAt ? `Resolved ${format(new Date(req.resolvedAt), 'dd MMM yyyy')}` : 'Resolved'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={!!actionTarget}
        onClose={() => setActionTarget(null)}
        title={actionTarget?.action === 'APPROVED' ? 'Approve Deletion' : 'Reject Deletion'}
        size="sm"
      >
        <p className="text-sm text-gray-600 mb-4">
          {actionTarget?.action === 'APPROVED'
            ? `Approve deletion for ${actionTarget?.row.entityType} and permanently remove the record?`
            : `Reject deletion request for ${actionTarget?.row.entityType}?`}
        </p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setActionTarget(null)}>Cancel</button>
          <button
            className={actionTarget?.action === 'APPROVED' ? 'btn-danger' : 'btn-primary'}
            disabled={resolveRequest.isPending}
            onClick={confirmAction}
          >
            {resolveRequest.isPending
              ? (actionTarget?.action === 'APPROVED' ? 'Approving...' : 'Rejecting...')
              : (actionTarget?.action === 'APPROVED' ? 'Approve' : 'Reject')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
