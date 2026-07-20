import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, UserX, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesService } from '@api/index';
import DataTable, { Column } from '@comps/common/DataTable';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import type { Employee } from './EmployeesLayout';

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
  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget]         = useState<Employee | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Employee | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['employees', page],
    queryFn: () => employeesService.list({ page, limit: 20 }),
  });

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee deactivated');
      setDeactivateTarget(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to deactivate employee'),
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
      label: 'EMPLOYEE ▲',
      render: r => (
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900">{r.firstName} {r.lastName}</span>
          <span className="text-[11px] text-gray-400 font-medium">ID: {r.id.length > 6 ? r.id.slice(-3) : r.id}</span>
        </div>
      ),
    },
    {
      key: 'designation',
      label: 'ROLE',
      render: r => <span className="text-sm font-medium text-gray-700">{r.designation || r.user?.role || 'Agent'}</span>,
    },
    {
      key: 'isActive',
      label: 'STATUS',
      render: r => (
        <span className={clsx('px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase',
          r.isActive ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-700')}>
          {r.isActive ? 'ACTIVE' : 'INACTIVE'}
        </span>
      ),
    },
    {
      key: 'phone',
      label: 'CONTACT',
      render: r => (
        <div className="flex flex-col text-sm text-gray-600">
          <span>{r.phone ?? '—'}</span>
          <span className="text-xs text-gray-400">{r.user?.email ?? '—'}</span>
        </div>
      ),
    },
    {
      key: 'actions' as any,
      label: 'ACTIONS',
      render: r => (
        <div className="flex items-center gap-1 justify-center" onClick={e => e.stopPropagation()}>
          <button title="Edit" className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" onClick={() => openEdit(r)}>
            <Pencil size={16} />
          </button>
          <button title="Deactivate" className="p-1.5 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" onClick={() => setDeactivateTarget(r)}>
            <UserX size={16} />
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

      {/* Edit Modal */}
      <Modal open={!!editTarget} onClose={() => { setEditTarget(null); resetEdit(); }} title="Edit Employee" size="xl">
        <form onSubmit={handleEditSubmit(body => updateEmployee.mutateAsync({ id: editTarget!.id, body }))} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
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
              <input {...regEdit('dateOfJoining')} type="date" className="input" />
            </div>
            <div>
              <label className="label">Date of Birth</label>
              <input {...regEdit('dateOfBirth')} type="date" className="input" />
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
            <div className="col-span-2 border-t border-slate-100 pt-3 grid grid-cols-3 gap-3">
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
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => { setEditTarget(null); resetEdit(); }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={updateEmployee.isPending}>
              {updateEmployee.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Deactivate Confirm Modal */}
      <Modal open={!!deactivateTarget} onClose={() => setDeactivateTarget(null)} title="Deactivate Employee" size="sm">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-600">
            Deactivate <strong>{deactivateTarget?.firstName} {deactivateTarget?.lastName}</strong>? They will lose access to the system.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDeactivateTarget(null)}>Cancel</button>
          <button className="btn-danger" disabled={deactivateEmployee.isPending}
            onClick={() => deactivateEmployee.mutate(deactivateTarget!.id)}>
            {deactivateEmployee.isPending ? 'Deactivating…' : 'Deactivate'}
          </button>
        </div>
      </Modal>
    </>
  );
}
