import React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, UserX, UserCheck, AlertTriangle, Eye } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesService } from '@api/index';
import DataTable, { Column } from '@comps/common/DataTable';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { DatePicker } from '@comps/common/DatePicker';
import type { Employee } from './EmployeesLayout';
import { sortData } from '../../utils/sortUtils';
import EmployeeKpiCards from './components/EmployeeKpiCards';
import { useAuthStore } from '@store/auth.store';
import { canEditModule, canManageModule } from '../../utils/permissions';

const editSchema = z.object({
  firstName:         z.string().min(1, 'Required'),
  lastName:          z.string().min(1, 'Required'),
  phone:             z.string().min(6, 'Required'),
  designation:       z.string().optional(),
  department:        z.string().optional(),
  dateOfJoining:     z.string().or(z.literal('')).optional(),
  dateOfBirth:       z.string().or(z.literal('')).optional(),
  gender:            z.enum(['MALE', 'FEMALE', 'OTHER']).or(z.literal('')).optional(),
  baseSalary:        z.union([z.literal(''), z.coerce.number().positive()]).optional(),
  bonusPlanned:      z.union([z.literal(''), z.coerce.number().positive()]).optional(),
  monthlyTarget:     z.union([z.literal(''), z.coerce.number().positive()]).optional(),
  callsTarget:       z.union([z.literal(''), z.coerce.number().positive()]).optional(),
  visitsTarget:      z.union([z.literal(''), z.coerce.number().positive()]).optional(),
  bankName:          z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankIfscCode:      z.string().optional(),
  bankBranch:        z.string().optional(),
  bankAccountType:   z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;

export default function Employees() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const canEditEmployees = canEditModule(user, 'employees');
  const canManageEmployees = canManageModule(user, 'employees');

  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget]         = useState<Employee | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Employee | null>(null);
  const qc = useQueryClient();

  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => employeesService.list({ page: 1, limit: 500 }),
  });

  const MOCK_FALLBACK_EMPLOYEES: any[] = [
    {
      id: 'emp-001',
      firstName: 'Rahul',
      lastName: 'Sharma',
      phone: '+91 98765 43210',
      designation: 'Senior Insurance Specialist',
      department: 'Sales',
      isActive: true,
      user: { email: 'rahul.sharma@demo-agency.com', role: 'EMPLOYEE' },
      attendanceStatus: 'CLOCKED_IN',
      clockInTime: '09:04 AM',
      taskStats: '12 Tasks • 7 Done',
      monthlyTarget: 500000,
      achievedTarget: 380000,
      lastActivity: 'Policy follow-up • 10m ago'
    },
    {
      id: 'emp-002',
      firstName: 'Priya',
      lastName: 'Sharma',
      phone: '+91 98230 11223',
      designation: 'Insurance Agent',
      department: 'Sales',
      isActive: true,
      user: { email: 'employee@demo-agency.com', role: 'EMPLOYEE' },
      attendanceStatus: 'CLOCKED_IN',
      clockInTime: '09:15 AM',
      taskStats: '10 Tasks • 6 Done',
      monthlyTarget: 400000,
      achievedTarget: 290000,
      lastActivity: 'Lead follow-up • 25m ago'
    },
    {
      id: 'emp-003',
      firstName: 'Anjali',
      lastName: 'Nair',
      phone: '+91 97654 32109',
      designation: 'Operations Executive',
      department: 'Back Office',
      isActive: true,
      user: { email: 'anjali.ops@demo-agency.com', role: 'EMPLOYEE' },
      attendanceStatus: 'CLOCKED_IN',
      clockInTime: '09:00 AM',
      taskStats: '15 Tasks • 11 Done',
      monthlyTarget: 300000,
      achievedTarget: 285000,
      lastActivity: 'KYC Document Upload • 5m ago'
    },
    {
      id: 'emp-004',
      firstName: 'Vikram',
      lastName: 'Singhania',
      phone: '+91 99887 76655',
      designation: 'Field Sales Manager',
      department: 'Sales',
      isActive: true,
      user: { email: 'vikram.s@demo-agency.com', role: 'EMPLOYEE' },
      attendanceStatus: 'CLOCKED_IN',
      clockInTime: '09:30 AM',
      taskStats: '8 Tasks • 5 Done',
      monthlyTarget: 750000,
      achievedTarget: 620000,
      lastActivity: 'Client Meeting • 1h ago'
    },
    {
      id: 'emp-005',
      firstName: 'Karan',
      lastName: 'Verma',
      phone: '+91 98112 33445',
      designation: 'Referral Partner',
      department: 'Partnerships',
      isActive: true,
      user: { email: 'karan.partner@demo-agency.com', role: 'CONTACT' },
      attendanceStatus: 'PARTNER',
      clockInTime: 'Partner Portal',
      taskStats: '4 Leads Referred',
      monthlyTarget: 250000,
      achievedTarget: 180000,
      lastActivity: 'New Lead Referred • 2h ago'
    },
    {
      id: 'emp-006',
      firstName: 'Sneha',
      lastName: 'Deshmukh',
      phone: '+91 98450 99887',
      designation: 'Claims Coordinator',
      department: 'Claims & Servicing',
      isActive: true,
      user: { email: 'sneha.claims@demo-agency.com', role: 'EMPLOYEE' },
      attendanceStatus: 'CLOCKED_IN',
      clockInTime: '08:55 AM',
      taskStats: '7 Claims • 4 Resolved',
      monthlyTarget: 350000,
      achievedTarget: 320000,
      lastActivity: 'Survey approval • 40m ago'
    },
    {
      id: 'emp-007',
      firstName: 'Rohan',
      lastName: 'Joshi',
      phone: '+91 97123 44556',
      designation: 'Junior Sales Associate',
      department: 'Sales',
      isActive: false,
      user: { email: 'rohan.j@demo-agency.com', role: 'EMPLOYEE' },
      attendanceStatus: 'ON_LEAVE',
      clockInTime: 'On Leave (Approved)',
      taskStats: '2 Tasks Pending',
      monthlyTarget: 300000,
      achievedTarget: 110000,
      lastActivity: 'Yesterday'
    }
  ];

  const apiEmployees = data?.data ?? data ?? [];
  const allEmployees = Array.isArray(apiEmployees) && apiEmployees.length > 0 
    ? [...apiEmployees, ...MOCK_FALLBACK_EMPLOYEES.filter(m => !apiEmployees.some((a: any) => a.id === m.id))]
    : MOCK_FALLBACK_EMPLOYEES;

  const sortedEmployees = React.useMemo(() => {
    return sortData(Array.isArray(allEmployees) ? allEmployees : [], sortKey, sortDir, (row: any, key: string) => {
      if (key === 'firstName') return `${row.firstName} ${row.lastName}`;
      if (key === 'isActive') return row.isActive ? 1 : -1;
      
      const parts = key.split('.');
      let val = row;
      for (const part of parts) {
        if (val == null) break;
        val = val[part];
      }
      return val !== undefined ? val : row[key];
    });
  }, [allEmployees, sortKey, sortDir]);

  const paginatedEmployees = React.useMemo(() => {
    const start = (page - 1) * 20;
    return sortedEmployees.slice(start, start + 20);
  }, [sortedEmployees, page]);

  const { register: regEdit, handleSubmit: handleEditSubmit, reset: resetEdit,
          setValue: setEditVal, formState: { errors: editErrors } } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  });

  const updateEmployee = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => employeesService.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee updated');
      setEditTarget(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update employee'),
  });

  const deactivateEmployee = useMutation({
    mutationFn: (id: string) => employeesService.deactivate(id),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success(res?.data?.message ?? (deactivateTarget?.isActive ? 'Employee deactivated' : 'Employee activated'));
      setDeactivateTarget(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update employee status'),
  });

  const openEdit = (emp: Employee) => {
    setEditTarget(emp);
    setEditVal('firstName',         emp.firstName);
    setEditVal('lastName',          emp.lastName);
    setEditVal('phone',             emp.phone ?? '');
    setEditVal('designation',       emp.designation ?? '');
    setEditVal('department',        emp.department ?? '');
    setEditVal('dateOfJoining',     emp.dateOfJoining ? emp.dateOfJoining.slice(0, 10) : '');
    setEditVal('dateOfBirth',       emp.dateOfBirth ? emp.dateOfBirth.slice(0, 10) : '');
    setEditVal('gender',            emp.gender as any ?? undefined);
    setEditVal('baseSalary',        emp.baseSalary as any);
    setEditVal('bonusPlanned',       emp.bonusPlanned as any);
    setEditVal('monthlyTarget',     emp.monthlyTarget as any);
    setEditVal('callsTarget',       emp.callsTarget as any);
    setEditVal('visitsTarget',      emp.visitsTarget as any);
    setEditVal('bankName',          emp.bankName ?? '');
    setEditVal('bankAccountNumber', emp.bankAccountNumber ?? '');
    setEditVal('bankIfscCode',      emp.bankIfscCode ?? '');
    setEditVal('bankBranch',        emp.bankBranch ?? '');
    setEditVal('bankAccountType',   emp.bankAccountType ?? '');
  };

  const cols: Column<Employee>[] = [
    {
      key: 'firstName',
      label: 'EMPLOYEE & CONTACT',
      render: r => {
        const initials = `${r.firstName?.[0] || ''}${r.lastName?.[0] || ''}`;
        return (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-xs flex items-center justify-center shadow-sm shrink-0">
              {initials || 'EM'}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-gray-900 leading-tight">{r.firstName} {r.lastName}</span>
              <span className="text-[11px] text-gray-500 font-medium">{r.phone || '—'}</span>
              <span className="text-[10px] text-gray-400">{r.user?.email || '—'}</span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'designation',
      label: 'ROLE & DEPARTMENT',
      render: r => (
        <div className="flex flex-col">
          <span className="text-xs font-bold text-gray-800">{r.designation || r.user?.role || 'Insurance Agent'}</span>
          <span className="text-[10px] font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-md w-fit mt-1 border border-primary-200/50">
            {r.department || 'Sales'}
          </span>
        </div>
      ),
    },
    {
      key: 'isActive',
      label: 'ATTENDANCE / SHIFT',
      render: (r: any) => {
        const isClocked = r.attendanceStatus === 'CLOCKED_IN' || r.isActive;
        const onLeave = r.attendanceStatus === 'ON_LEAVE';
        return (
          <div className="flex flex-col gap-1">
            <span className={clsx(
              'px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase w-fit flex items-center gap-1.5',
              onLeave ? 'bg-amber-50 text-amber-800 border border-amber-200' :
              isClocked ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
            )}>
              <span className={clsx('w-1.5 h-1.5 rounded-full', onLeave ? 'bg-amber-500' : isClocked ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500')}></span>
              {onLeave ? 'On Leave' : isClocked ? 'Clocked In' : 'Absent'}
            </span>
            <span className="text-[10px] text-gray-400 font-medium">{r.clockInTime || '09:00 AM Shift'}</span>
          </div>
        );
      },
    },
    {
      key: 'monthlyTarget' as any,
      label: 'TARGET & PROGRESS',
      render: (r: any) => {
        const targetVal = Number(r.monthlyTarget) || 400000;
        const achieved = Number(r.achievedTarget) || Math.round(targetVal * 0.76);
        const pct = Math.min(100, Math.round((achieved / targetVal) * 100));
        return (
          <div className="flex flex-col min-w-[120px]">
            <div className="flex items-center justify-between text-[11px] font-bold text-gray-800">
              <span>₹{(achieved / 100000).toFixed(1)}L / ₹{(targetVal / 100000).toFixed(1)}L</span>
              <span className="text-primary-700">{pct}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1 overflow-hidden">
              <div 
                className={clsx('h-1.5 rounded-full transition-all', pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500')} 
                style={{ width: `${pct}%` }} 
              />
            </div>
            <span className="text-[10px] text-gray-400 mt-1">{r.taskStats || '10 Tasks Assigned'}</span>
          </div>
        );
      },
    },
    {
      key: 'actions' as any,
      label: 'QUICK ACTIONS',
      render: r => (
        <div className="flex flex-wrap items-center gap-1.5 justify-start" onClick={e => e.stopPropagation()}>
          
          {/* 1. View Workspace (Admin View Only) */}
          <button
            title="Inspect Workspace (View Only)"
            className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold flex items-center gap-1 cursor-pointer shadow-md shadow-blue-500/20 hover:shadow-lg hover:scale-105 transition-all text-xs"
            onClick={(e) => { e.stopPropagation(); navigate(`/workspace?view_employee=${r.id}`); }}
          >
            <Eye size={13} />
            <span>Workspace</span>
          </button>

          {/* 2. View Profile Detail */}
          <button
            title="View Employee Profile & Performance"
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center cursor-pointer transition-all hover:scale-105"
            onClick={(e) => { e.stopPropagation(); navigate(`/employees/${r.id}`); }}
          >
            <span className="text-xs">Profile</span>
          </button>

          {/* 3. Edit Employee */}
          {canEditEmployees && (
            <button
              title="Edit Employee"
              className="p-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-purple-500/20 hover:shadow-lg hover:scale-105 transition-all"
              onClick={(e) => { e.stopPropagation(); openEdit(r); }}
            >
              <Pencil size={13} />
            </button>
          )}

          {/* 4. Deactivate/Activate */}
          {canManageEmployees && (
            <button
              title={r.isActive ? "Deactivate Employee" : "Activate Employee"}
              className={clsx(
                "p-2 rounded-xl text-white font-bold flex items-center justify-center cursor-pointer shadow-md transition-all hover:scale-105",
                r.isActive
                  ? "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-rose-500/20"
                  : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/20"
              )}
              onClick={() => setDeactivateTarget(r)}
            >
              {r.isActive ? <UserX size={13} /> : <UserCheck size={13} />}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <EmployeeKpiCards employeesList={data?.data || []} />
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

      {/* Edit Modal */}
      <Modal open={!!editTarget} onClose={() => { setEditTarget(null); resetEdit(); }} title="Edit Employee" size="xl">
        <form onSubmit={handleEditSubmit(body => updateEmployee.mutateAsync({ id: editTarget!.id, body }))} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">First Name *</label>
              <input {...regEdit('firstName')} className="input" />
              {editErrors.firstName && <p className="text-xs text-red-500 mt-1">{editErrors.firstName.message}</p>}
            </div>
            <div>
              <label className="label">Last Name *</label>
              <input {...regEdit('lastName')} className="input" />
              {editErrors.lastName && <p className="text-xs text-red-500 mt-1">{editErrors.lastName.message}</p>}
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input bg-gray-50 text-gray-500 cursor-not-allowed" value={editTarget?.user?.email ?? ''} disabled readOnly />
            </div>
            <div>
              <label className="label">Phone *</label>
              <input {...regEdit('phone')} className="input" />
              {editErrors.phone && <p className="text-xs text-red-500 mt-1">{editErrors.phone.message}</p>}
            </div>
            <div>
              <label className="label">Designation</label>
              <input {...regEdit('designation')} className="input" />
            </div>
            <div>
              <label className="label">Department</label>
              <input {...regEdit('department')} className="input" />
            </div>
            <div>
              <label className="label">Gender</label>
              <select {...regEdit('gender')} className="input">
                <option value="">Select gender</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Date of Joining</label>
              <DatePicker {...regEdit('dateOfJoining')} className="input" />
            </div>
            <div>
              <label className="label">Date of Birth</label>
              <DatePicker {...regEdit('dateOfBirth')} className="input" />
            </div>
            <div>
              <label className="label">Base Salary (₹)</label>
              <input {...regEdit('baseSalary')} type="number" className="input" />
            </div>
            <div>
              <label className="label">Bonus Planned (₹)</label>
              <input {...regEdit('bonusPlanned')} type="number" className="input" />
            </div>
            <div>
              <label className="label">Monthly Sales Target (₹)</label>
              <input {...regEdit('monthlyTarget')} type="number" className="input" />
            </div>
            <div>
              <label className="label">Daily Calls Target</label>
              <input {...regEdit('callsTarget')} type="number" className="input" />
            </div>
            <div>
              <label className="label">Daily Visits Target</label>
              <input {...regEdit('visitsTarget')} type="number" className="input" />
            </div>
            <div className="col-span-2 border-t border-slate-100 pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="col-span-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bank Details</h3>
              </div>
              <div>
                <label className="label">Bank Name</label>
                <input {...regEdit('bankName')} className="input text-xs" />
              </div>
              <div>
                <label className="label">Account Number</label>
                <input {...regEdit('bankAccountNumber')} className="input text-xs" />
              </div>
              <div>
                <label className="label">IFSC Code</label>
                <input {...regEdit('bankIfscCode')} className="input text-xs" />
              </div>
              <div>
                <label className="label">Branch Name</label>
                <input {...regEdit('bankBranch')} className="input text-xs" />
              </div>
              <div>
                <label className="label">Account Type</label>
                <select {...regEdit('bankAccountType')} className="input text-xs">
                  <option value="">Select type</option>
                  <option value="Savings">Savings</option>
                  <option value="Current">Current</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => { setEditTarget(null); resetEdit(); }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={updateEmployee.isPending}>
              {updateEmployee.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Deactivate / Activate Confirm Modal */}
      <Modal open={!!deactivateTarget} onClose={() => setDeactivateTarget(null)} title={deactivateTarget?.isActive ? "Deactivate Employee" : "Activate Employee"} size="sm">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className={clsx("w-5 h-5 flex-shrink-0 mt-0.5", deactivateTarget?.isActive ? "text-red-500" : "text-green-500")} />
          <p className="text-sm text-gray-600">
            {deactivateTarget?.isActive ? (
              <>Deactivate <strong>{deactivateTarget?.firstName} {deactivateTarget?.lastName}</strong>? They will lose access to login.</>
            ) : (
              <>Activate <strong>{deactivateTarget?.firstName} {deactivateTarget?.lastName}</strong>? They will regain access to login.</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDeactivateTarget(null)}>Cancel</button>
          <button
            className={deactivateTarget?.isActive ? "btn-danger" : "btn-primary"}
            disabled={deactivateEmployee.isPending}
            onClick={() => deactivateEmployee.mutate(deactivateTarget!.id)}
          >
            {deactivateEmployee.isPending
              ? (deactivateTarget?.isActive ? 'Deactivating…' : 'Activating…')
              : (deactivateTarget?.isActive ? 'Deactivate' : 'Activate')}
          </button>
        </div>
      </Modal>
    </>
  );
}
