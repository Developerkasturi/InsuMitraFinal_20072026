import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Key } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesService } from '@api/index';
import DataTable, { Column } from '@comps/common/DataTable';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import type { Employee } from './EmployeesLayout';

const AVAILABLE_PERMISSIONS = [
  { key: 'manage_leads',       label: 'Leads Pipeline Management' },
  { key: 'manage_policies',    label: 'Policies Module Access' },
  { key: 'manage_claims',      label: 'Claims Module Access' },
  { key: 'manage_commissions', label: 'Commissions Module Access' },
  { key: 'manage_whatsapp',    label: 'WhatsApp Module Access' },
  { key: 'manage_employees',   label: 'Employees Module Access' },
];

const permissionSchema = z.object({
  role:        z.enum(['OWNER', 'EMPLOYEE', 'CONTACT']),
  permissions: z.array(z.string()),
});
type PermissionForm = z.infer<typeof permissionSchema>;

export default function EmployeeAccessControl() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [permEditEmp, setPermEditEmp] = useState<Employee | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['employees', page],
    queryFn: () => employeesService.list({ page, limit: 20 }),
  });

  const { register, handleSubmit, setValue } = useForm<PermissionForm>({
    resolver: zodResolver(permissionSchema),
  });

  const updatePermissions = useMutation({
    mutationFn: ({ id, body }: { id: string; body: PermissionForm }) =>
      employeesService.updateRole(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Permissions updated successfully');
      setPermEditEmp(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update permissions'),
  });

  const openPermEdit = (emp: Employee, e: React.MouseEvent) => {
    e.stopPropagation();
    setPermEditEmp(emp);
    setValue('role', emp.user?.role as any ?? 'EMPLOYEE');
    setValue('permissions', emp.user?.permissions ?? []);
  };

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
      label: 'SYSTEM ROLE',
      render: r => (
        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded text-xs font-bold uppercase">
          {r.user?.role || 'EMPLOYEE'}
        </span>
      ),
    },
    {
      key: 'permissions' as any,
      label: 'MODULE PERMISSIONS',
      render: r => {
        if (r.user?.role === 'OWNER') {
          return <span className="text-xs font-semibold text-primary-700 bg-primary-50 px-2.5 py-0.5 rounded border border-primary-100">Full Access (Owner)</span>;
        }
        const perms = r.user?.permissions ?? [];
        if (perms.length === 0) {
          return <span className="text-xs text-gray-400 italic">No modules enabled</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {perms.map(p => {
              const label = AVAILABLE_PERMISSIONS.find(ap => ap.key === p)?.label.replace(' Access', '').replace(' Management', '') || p;
              return (
                <span key={p} className="text-[10px] bg-slate-50 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                  {label}
                </span>
              );
            })}
          </div>
        );
      },
    },
    {
      key: 'actions' as any,
      label: 'ACTIONS',
      render: r => (
        <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
          <button
            title="Edit Permissions"
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            onClick={e => openPermEdit(r, e)}
          >
            <Key size={16} />
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

      {/* Permission Edit Modal */}
      <Modal
        open={!!permEditEmp}
        onClose={() => setPermEditEmp(null)}
        title="Manage Access Control"
        size="md"
      >
        {permEditEmp && (
          <form
            onSubmit={handleSubmit(body => updatePermissions.mutate({ id: permEditEmp.id, body }))}
            className="space-y-4"
          >
            <div className="text-xs text-slate-500 mb-2 font-medium">
              Updating system role and permissions for <strong className="text-slate-800">{permEditEmp.firstName} {permEditEmp.lastName}</strong>.
            </div>
            <div>
              <label className="label">System Role *</label>
              <select {...register('role')} className="input">
                <option value="EMPLOYEE">Employee / Agent</option>
                <option value="OWNER">Agency Owner / Super Admin</option>
              </select>
            </div>
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <label className="label font-bold text-slate-600 mb-2">Module Access Control Permissions</label>
              <div className="space-y-2">
                {AVAILABLE_PERMISSIONS.map(p => (
                  <label key={p.key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 p-1.5 rounded transition-colors">
                    <input
                      type="checkbox"
                      value={p.key}
                      className="rounded text-primary-600 focus:ring-primary-500"
                      {...register('permissions')}
                    />
                    <span>{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setPermEditEmp(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={updatePermissions.isPending}>
                {updatePermissions.isPending ? 'Saving…' : 'Save Permissions'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
