import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { employeesService } from '@api/index';
import DataTable, { Column } from '@comps/common/DataTable';
import Modal from '@comps/common/Modal';
import type { Employee } from './EmployeesLayout';

export default function EmployeeEodReports() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [nextDayPlan, setNextDayPlan] = useState('');
  const [notes, setNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['employees', page],
    queryFn: () => employeesService.list({ page, limit: 20 }),
  });

  useEffect(() => {
    const log = editTarget?.user?.dailyLogs?.[0];
    setNextDayPlan(log?.nextDayPlan ?? '');
    setNotes(log?.notes ?? log?.adminRemarks ?? '');
  }, [editTarget]);

  const saveLog = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => employeesService.dailyLog(id, body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['employees'] });
      setEditTarget(null);
    },
  });

  const cols: Column<Employee>[] = [
    {
      key: 'firstName',
      label: 'EMPLOYEE',
      render: r => (
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900">{r.firstName} {r.lastName}</span>
          <span className="text-[11px] text-gray-400 font-medium">ID: {r.id.length > 6 ? r.id.slice(-3) : r.id}</span>
        </div>
      ),
    },
    {
      key: 'user' as any,
      label: 'CALLS MADE',
      render: r => {
        const log = r.user?.dailyLogs?.[0];
        return <span className="text-sm font-semibold text-slate-700">{log?.callsMade ?? 0}</span>;
      },
    },
    {
      key: 'user' as any,
      label: 'MEETINGS DONE',
      render: r => {
        const log = r.user?.dailyLogs?.[0];
        return <span className="text-sm font-semibold text-slate-700">{log?.visitsCompleted ?? 0}</span>;
      },
    },
    {
      key: 'user' as any,
      label: 'PREMIUM COLLECTED',
      render: r => {
        const log = r.user?.dailyLogs?.[0];
        return (
          <span className="text-sm font-semibold text-green-600">
            ₹{Number(log?.premiumCollected ?? 0).toLocaleString('en-IN')}
          </span>
        );
      },
    },
    {
      key: 'user' as any,
      label: 'NEXT DAY PLAN',
      render: r => {
        const log = r.user?.dailyLogs?.[0];
        return <span className="text-xs text-slate-600 max-w-xs truncate block" title={log?.nextDayPlan || undefined}>{log?.nextDayPlan || '—'}</span>;
      },
    },
    {
      key: 'user' as any,
      label: 'NOTES / REMARKS',
      render: r => {
        const log = r.user?.dailyLogs?.[0];
        return <span className="text-xs text-slate-600 max-w-xs truncate block" title={log?.notes || undefined}>{log?.notes || '—'}</span>;
      },
    },
    {
      key: 'user' as any,
      label: 'ADMIN REMARKS',
      render: r => {
        const log = r.user?.dailyLogs?.[0];
        return <span className="text-xs text-orange-600 max-w-xs truncate block" title={log?.adminRemarks || undefined}>{log?.adminRemarks || '—'}</span>;
      },
    },
    {
      key: 'actions' as any,
      label: 'ACTION',
      render: r => (
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <button
            title="Add / Edit EOD"
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            onClick={() => setEditTarget(r)}
          >
            <Pencil size={14} />
          </button>
          <button
            title="View Employee"
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => navigate(`/employees/${r.id}`)}
          >
            View
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={cols}
        data={data?.data ?? []}
        total={data?.meta?.total}
        page={page}
        pageSize={20}
        loading={isLoading}
        rowKey={r => r.id}
        onPageChange={setPage}
        onRowClick={r => navigate(`/employees/${r.id}`)}
      />

      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={editTarget ? `EOD Update - ${editTarget.firstName} ${editTarget.lastName}` : 'EOD Update'}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="label">NEXT DAY PLAN</label>
            <textarea
              value={nextDayPlan}
              onChange={e => setNextDayPlan(e.target.value)}
              rows={4}
              className="input w-full"
              placeholder="Plan for tomorrow..."
            />
          </div>

          <div>
            <label className="label">NOTES / REMARKS</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              className="input w-full"
              placeholder="Additional notes or remarks..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setEditTarget(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!editTarget || saveLog.isPending}
              onClick={() => {
                if (!editTarget) return;
                saveLog.mutate({
                  id: editTarget.id,
                  body: {
                    date: new Date().toISOString(),
                    nextDayPlan,
                    notes,
                  },
                });
              }}
            >
              {saveLog.isPending ? 'Saving...' : 'Save EOD'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
