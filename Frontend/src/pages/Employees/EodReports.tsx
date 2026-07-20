import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { employeesService } from '@api/index';
import DataTable, { Column } from '@comps/common/DataTable';
import type { Employee } from './EmployeesLayout';

export default function EmployeeEodReports() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['employees', page],
    queryFn: () => employeesService.list({ page, limit: 20 }),
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
  ];

  return (
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
  );
}
