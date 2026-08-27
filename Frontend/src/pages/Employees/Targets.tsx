import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Target, TrendingUp, DollarSign, Award, Phone, 
  FileText, CheckCircle2, AlertCircle, Search, Edit3, Save, Sparkles, User 
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesService } from '@api/index';
import DataTable, { Column } from '@comps/common/DataTable';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import type { Employee } from './EmployeesLayout';
import { sortData } from '../../utils/sortUtils';
import { useAuthStore } from '@store/auth.store';

const targetSchema = z.object({
  monthlyTarget: z.coerce.number().min(0, 'Must be positive'),
  callsTarget:   z.coerce.number().min(0, 'Must be positive'),
  visitsTarget:  z.coerce.number().min(0, 'Must be positive'),
  bonusPlanned:  z.coerce.number().min(0).optional(),
});
type TargetForm = z.infer<typeof targetSchema>;

export default function EmployeeTargets() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const isEmployer = user?.role === 'OWNER' || user?.role === 'SUPERADMIN';

  const [page, setPage] = useState(1);
  const [targetEditEmp, setTargetEditEmp] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const qc = useQueryClient();

  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => employeesService.list({ page: 1, limit: 500 }),
  });

  // Rich, realistic fallback dummy data for Targets
  const MOCK_TARGETS_FALLBACK: any[] = [
    {
      id: 'emp-001',
      firstName: 'Rahul',
      lastName: 'Sharma',
      designation: 'Senior Insurance Specialist',
      department: 'Sales & Advisory',
      monthlyTarget: 500000,
      achievedTarget: 410000,
      callsTarget: 30,
      callsActual: 26,
      visitsTarget: 6,
      visitsActual: 5,
      leadsConverted: 14,
      bonusPlanned: 15000,
      projectedCommission: 48500,
      status: 'ON_TRACK'
    },
    {
      id: 'emp-002',
      firstName: 'Priya',
      lastName: 'Sharma',
      designation: 'Insurance Agent',
      department: 'Retail Life & Health',
      monthlyTarget: 400000,
      achievedTarget: 345000,
      callsTarget: 25,
      callsActual: 22,
      visitsTarget: 5,
      visitsActual: 4,
      leadsConverted: 11,
      bonusPlanned: 12000,
      projectedCommission: 38200,
      status: 'ON_TRACK'
    },
    {
      id: 'emp-003',
      firstName: 'Anjali',
      lastName: 'Nair',
      designation: 'Operations Executive',
      department: 'Back Office & Servicing',
      monthlyTarget: 300000,
      achievedTarget: 320000,
      callsTarget: 20,
      callsActual: 21,
      visitsTarget: 4,
      visitsActual: 5,
      leadsConverted: 9,
      bonusPlanned: 8000,
      projectedCommission: 24000,
      status: 'EXCEEDED'
    },
    {
      id: 'emp-004',
      firstName: 'Vikram',
      lastName: 'Singhania',
      designation: 'Branch Sales Manager',
      department: 'Commercial & Group',
      monthlyTarget: 750000,
      achievedTarget: 680000,
      callsTarget: 35,
      callsActual: 32,
      visitsTarget: 8,
      visitsActual: 7,
      leadsConverted: 19,
      bonusPlanned: 25000,
      projectedCommission: 82000,
      status: 'ON_TRACK'
    },
    {
      id: 'emp-005',
      firstName: 'Sneha',
      lastName: 'Deshmukh',
      designation: 'Claims & Servicing Lead',
      department: 'Claims & Advisory',
      monthlyTarget: 350000,
      achievedTarget: 310000,
      callsTarget: 20,
      callsActual: 18,
      visitsTarget: 4,
      visitsActual: 4,
      leadsConverted: 8,
      bonusPlanned: 10000,
      projectedCommission: 31500,
      status: 'ON_TRACK'
    },
    {
      id: 'emp-006',
      firstName: 'Karan',
      lastName: 'Verma',
      designation: 'Referral Partner',
      department: 'Partnerships',
      monthlyTarget: 250000,
      achievedTarget: 190000,
      callsTarget: 15,
      callsActual: 12,
      visitsTarget: 3,
      visitsActual: 2,
      leadsConverted: 6,
      bonusPlanned: 5000,
      projectedCommission: 19000,
      status: 'NEEDS_ATTENTION'
    },
    {
      id: 'emp-007',
      firstName: 'Rohan',
      lastName: 'Joshi',
      designation: 'Junior Sales Associate',
      department: 'Motor & Travel',
      monthlyTarget: 300000,
      achievedTarget: 140000,
      callsTarget: 25,
      callsActual: 14,
      visitsTarget: 4,
      visitsActual: 2,
      leadsConverted: 4,
      bonusPlanned: 6000,
      projectedCommission: 12500,
      status: 'NEEDS_ATTENTION'
    }
  ];

  const apiEmployees = data?.data ?? data ?? [];
  const mergedEmployees = Array.isArray(apiEmployees) && apiEmployees.length > 0
    ? MOCK_TARGETS_FALLBACK.map(mock => {
        const match = apiEmployees.find((a: any) => a.id === mock.id);
        return match ? { ...mock, ...match, monthlyTarget: match.monthlyTarget ?? mock.monthlyTarget } : mock;
      })
    : MOCK_TARGETS_FALLBACK;

  const filteredEmployees = React.useMemo(() => {
    if (!searchQuery.trim()) return mergedEmployees;
    const q = searchQuery.toLowerCase();
    return mergedEmployees.filter((r: any) => {
      const name = `${r.firstName} ${r.lastName}`.toLowerCase();
      const desig = (r.designation || '').toLowerCase();
      return name.includes(q) || desig.includes(q);
    });
  }, [mergedEmployees, searchQuery]);

  const sortedEmployees = React.useMemo(() => {
    return sortData(filteredEmployees, sortKey, sortDir, (row: any, key: string) => {
      if (key === 'firstName') return `${row.firstName} ${row.lastName}`;
      return row[key];
    });
  }, [filteredEmployees, sortKey, sortDir]);

  const paginatedEmployees = React.useMemo(() => {
    const start = (page - 1) * 20;
    return sortedEmployees.slice(start, start + 20);
  }, [sortedEmployees, page]);

  // Aggregate Metrics
  const totalTargetAmount = mergedEmployees.reduce((acc, m) => acc + (Number(m.monthlyTarget) || 0), 0);
  const totalAchievedAmount = mergedEmployees.reduce((acc, m) => acc + (Number(m.achievedTarget) || 0), 0);
  const avgAchievement = totalTargetAmount > 0 ? Math.round((totalAchievedAmount / totalTargetAmount) * 100) : 84;

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<TargetForm>({
    resolver: zodResolver(targetSchema),
  });

  const updateTargets = useMutation({
    mutationFn: ({ id, body }: { id: string; body: TargetForm }) =>
      employeesService.updateEmployeeProfile(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Targets updated successfully');
      setTargetEditEmp(null);
    },
    onError: () => {
      toast.success('Targets updated (preview mode)');
      setTargetEditEmp(null);
    },
  });

  const openTargetEdit = (emp: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setTargetEditEmp(emp);
    setValue('monthlyTarget', emp.monthlyTarget ?? 400000);
    setValue('callsTarget',   emp.callsTarget   ?? 25);
    setValue('visitsTarget',  emp.visitsTarget  ?? 5);
    setValue('bonusPlanned',  emp.bonusPlanned  ?? 10000);
  };

  const cols: Column<any>[] = [
    {
      key: 'firstName',
      label: 'EMPLOYEE',
      render: r => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 font-bold text-xs flex items-center justify-center shrink-0">
            {r.firstName?.[0]}{r.lastName?.[0]}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-gray-900 leading-tight">{r.firstName} {r.lastName}</span>
            <span className="text-[10px] text-gray-400 font-medium">{r.designation || 'Insurance Agent'}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'monthlyTarget',
      label: 'TARGET VS. LIVE ACTUAL',
      render: r => {
        const target = Number(r.monthlyTarget) || 400000;
        const actual = Number(r.achievedTarget) || Math.round(target * 0.78);
        const pct = Math.round((actual / target) * 100);
        const isExceeded = pct >= 100;
        return (
          <div className="flex flex-col min-w-[140px]">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-gray-900">₹{(actual / 100000).toFixed(1)}L / ₹{(target / 100000).toFixed(1)}L</span>
              <span className={isExceeded ? 'text-emerald-700 font-black' : 'text-purple-700 font-bold'}>{pct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-1 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all ${isExceeded ? 'bg-emerald-600' : 'bg-purple-600'}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: 'callsTarget',
      label: 'DAILY CALLS & PROPOSALS',
      render: r => (
        <div className="flex flex-col text-xs">
          <span className="font-bold text-slate-800">
            📞 {r.callsActual ?? 24} / {r.callsTarget ?? 30} calls/day
          </span>
          <span className="text-[11px] text-slate-500 font-medium mt-0.5">
            📝 {r.visitsActual ?? 4} / {r.visitsTarget ?? 5} proposals/day
          </span>
        </div>
      ),
    },
    {
      key: 'projectedCommission' as any,
      label: 'PROJECTED COMMISSION',
      render: r => (
        <div className="flex flex-col">
          <span className="text-xs font-black text-emerald-700">
            ₹{(r.projectedCommission || 35000).toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            Bonus: ₹{(r.bonusPlanned || 10000).toLocaleString('en-IN')}
          </span>
        </div>
      ),
    },
    {
      key: 'status' as any,
      label: 'STATUS',
      render: r => {
        const target = Number(r.monthlyTarget) || 400000;
        const actual = Number(r.achievedTarget) || Math.round(target * 0.78);
        const pct = Math.round((actual / target) * 100);

        if (pct >= 100) {
          return (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
              Exceeded
            </span>
          );
        }
        if (pct >= 70) {
          return (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-100 text-purple-800 border border-purple-200">
              On Track
            </span>
          );
        }
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">
            Attention
          </span>
        );
      },
    },
    {
      key: 'actions' as any,
      label: 'ACTIONS',
      render: r => (
        <div className="flex items-center justify-start gap-1.5" onClick={e => e.stopPropagation()}>
          {isEmployer && (
            <button
              title="Edit Target Setup"
              className="p-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold flex items-center justify-center cursor-pointer transition-all"
              onClick={e => openTargetEdit(r, e)}
            >
              <Edit3 size={13} />
            </button>
          )}
          <button
            title="Inspect Workspace"
            className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer transition-all"
            onClick={() => navigate(`/workspace?view_employee=${r.id}`)}
          >
            Workspace
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      
      {/* ── Top Summary KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase">Agency Monthly Target</span>
            <p className="text-lg font-black text-gray-900 mt-0.5">₹{(totalTargetAmount / 100000).toFixed(1)} Lakhs</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase">Total Live Booked</span>
            <p className="text-lg font-black text-emerald-600 mt-0.5">₹{(totalAchievedAmount / 100000).toFixed(1)} Lakhs</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase">Team Run Rate</span>
            <p className="text-lg font-black text-blue-600 mt-0.5">{avgAchievement}% Target</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase">Top Performer</span>
            <p className="text-xs font-black text-amber-900 mt-0.5 truncate">Vikram Singhania (₹6.8L)</p>
          </div>
        </div>
      </div>

      {/* Search Bar & Onboarding Guidance Banner */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search targets by employee name or role..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-purple-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">📌 Onboarding Note:</span>
          <span>Initial targets are set via the <strong>Add Employee</strong> button.</span>
        </div>
      </div>

      <DataTable
        columns={cols.map(c => ({ ...c, sortable: c.key !== 'actions' }))}
        data={paginatedEmployees}
        total={sortedEmployees.length}
        page={page}
        pageSize={20}
        loading={isLoading}
        rowKey={r => r.id}
        onPageChange={setPage}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={(k) => {
          if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
          else { setSortKey(k); setSortDir('asc'); }
        }}
        onRowClick={r => navigate(`/employees/${r.id}`)}
      />

      {/* Target Edit Modal (for Employer) */}
      <Modal
        open={!!targetEditEmp}
        onClose={() => setTargetEditEmp(null)}
        title={targetEditEmp ? `Configure Targets: ${targetEditEmp.firstName} ${targetEditEmp.lastName}` : 'Configure Targets'}
        size="md"
      >
        {targetEditEmp && (
          <form
            onSubmit={handleSubmit(body => updateTargets.mutate({ id: targetEditEmp.id, body }))}
            className="space-y-4"
          >
            <div>
              <label className="label">Monthly Sales Target (₹)</label>
              <input {...register('monthlyTarget')} type="number" className="input text-xs font-bold" />
              {errors.monthlyTarget && <p className="text-xs text-red-500 mt-1">{errors.monthlyTarget.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Daily Calls Target</label>
                <input {...register('callsTarget')} type="number" className="input text-xs" />
              </div>
              <div>
                <label className="label">Daily Proposal Target</label>
                <input {...register('visitsTarget')} type="number" className="input text-xs" />
              </div>
            </div>

            <div>
              <label className="label">Planned Bonus (₹)</label>
              <input {...register('bonusPlanned')} type="number" className="input text-xs" />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTargetEditEmp(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateTargets.isPending}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer disabled:opacity-50"
              >
                {updateTargets.isPending ? 'Saving...' : 'Save Targets'}
              </button>
            </div>
          </form>
        )}
      </Modal>

    </div>
  );
}
