import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { employeesService } from '@api/index';
import DataTable, { Column } from '@comps/common/DataTable';
import { format } from 'date-fns';
import clsx from 'clsx';
import type { Employee } from './EmployeesLayout';

const todayStr = format(new Date(), 'yyyy-MM-dd');

export default function EmployeeAttendance() {
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
        <span className="font-medium text-gray-900">{r.firstName} {r.lastName}</span>
      ),
    },
    {
      key: 'user' as any,
      label: 'DATE',
      render: () => (
        <span className="text-blue-500 font-medium text-sm">{todayStr}</span>
      ),
    },
    {
      key: 'user' as any,
      label: 'CHECK IN',
      render: r => {
        const log = r.user?.dailyLogs?.[0];
        return log?.checkIn
          ? <span className="text-gray-700 text-sm">{format(new Date(log.checkIn), 'hh:mm a')}</span>
          : <span className="text-gray-400 text-sm">–</span>;
      },
    },
    {
      key: 'user' as any,
      label: 'CHECK OUT',
      render: r => {
        const log = r.user?.dailyLogs?.[0];
        if (log?.checkOut) {
          return <span className="text-gray-700 text-sm">{format(new Date(log.checkOut), 'hh:mm a')}</span>;
        }
        if (log?.checkIn) {
          return <span className="text-xs text-orange-500 font-semibold">Active</span>;
        }
        return <span className="text-gray-400 text-sm">–</span>;
      },
    },
    {
      key: 'isActive' as any,
      label: 'STATUS',
      render: r => {
        const log = r.user?.dailyLogs?.[0];
        const present = !!log?.checkIn;
        return (
          <span className={clsx(
            'px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider',
            present ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
          )}>
            {present ? 'PRESENT' : 'ABSENT'}
          </span>
        );
      },
    },
    {
      key: 'actions' as any,
      label: 'ADMIN',
      render: r => (
        <div className="flex items-center" onClick={e => e.stopPropagation()}>
          <button
            title="View Employee"
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => navigate(`/employees/${r.id}`)}
          >
            <Pencil size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <h3 className="text-base font-bold text-gray-800 mb-3">Today's Attendance</h3>
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
    </>
  );
}
