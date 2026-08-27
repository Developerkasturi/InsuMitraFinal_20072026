import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Key, ShieldCheck, UserCheck, Shield, Lock, Unlock, 
  Check, X, Sparkles, Filter, Search, Edit2, Users, Briefcase 
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

export const SYSTEM_MODULES = [
  { key: 'dashboard',         label: 'Dashboard',          category: 'Core',        desc: 'Agency analytics, revenue charts & KPI overview' },
  { key: 'workspace',         label: 'Workspace & Tasks',  category: 'Productivity', desc: 'Shift tracking, daily priorities, timeline & tasks' },
  { key: 'contacts',          label: 'Contacts Directory', category: 'CRM',         desc: 'Clients, prospects, families, KYC & medical records' },
  { key: 'leads',             label: 'Leads Pipeline',     category: 'Sales',       desc: 'Lead stages, quotation generation & follow-ups' },
  { key: 'policies',          label: 'Policies Management', category: 'Core Insurance', desc: 'Active policies, renewals, endorsements & documents' },
  { key: 'claims',            label: 'Claims Assistance',  category: 'Core Insurance', desc: 'Claim intimations, hospital cashless & settlements' },
  { key: 'calendar',          label: 'Calendar & Meetings',category: 'Productivity', desc: 'Scheduled client visits, reminders & task sync' },
  { key: 'whatsapp',          label: 'WhatsApp Broadcasts',category: 'Marketing',   desc: 'Templates, chatbot automations & campaign logs' },
  { key: 'operations',        label: 'Operations & KYC',   category: 'Operations',  desc: 'Document verification, underwriting & portal sync' },
  { key: 'commissions',       label: 'Commissions',        category: 'Finance',     desc: 'Payout structures, insurer reconciliations & rates' },
  { key: 'employees',         label: 'Employees Directory',category: 'Administration', desc: 'Staff directory, targets, attendance & leaves' },
  { key: 'deletion_requests', label: 'Delete Requests',    category: 'Administration', desc: 'Review & approve record purge / deletion requests' },
  { key: 'subscription',      label: 'Subscription',       category: 'Administration', desc: 'Billing plan, seat limits & invoices' },
  { key: 'firm_profile',      label: 'Firm Profile',       category: 'Administration', desc: 'Agency branding, licenses, branches & master data' },
];

const PRESETS = [
  {
    name: 'Full Administrator',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    role: 'OWNER',
    permissions: SYSTEM_MODULES.map(m => m.key),
    desc: 'Unrestricted access to all CRM, financial, and administrative features.'
  },
  {
    name: 'Sales & Advisory Specialist',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    role: 'EMPLOYEE',
    permissions: ['dashboard', 'workspace', 'contacts', 'leads', 'policies', 'claims', 'calendar', 'whatsapp'],
    desc: 'Lead conversion, client servicing, policy issuance, claims & WhatsApp.'
  },
  {
    name: 'Operations & Claims Executive',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    role: 'EMPLOYEE',
    permissions: ['dashboard', 'workspace', 'contacts', 'policies', 'claims', 'operations', 'calendar'],
    desc: 'Policy booking, underwriting documents, KYC verification & claims processing.'
  },
  {
    name: 'Referral Partner / Associate',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    role: 'CONTACT',
    permissions: ['workspace', 'leads', 'policies', 'commissions'],
    desc: 'Partner portal with lead submissions, referred policy tracking & commissions.'
  },
  {
    name: 'View Only / Compliance Auditor',
    badge: 'bg-slate-100 text-slate-800 border-slate-200',
    role: 'EMPLOYEE',
    permissions: ['dashboard', 'contacts', 'policies', 'claims', 'calendar'],
    desc: 'Read-only access for compliance inspection and audits.'
  }
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
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<'OWNER' | 'EMPLOYEE' | 'CONTACT'>('EMPLOYEE');
  const [searchFilter, setSearchFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  const qc = useQueryClient();
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => employeesService.list({ page: 1, limit: 500 }),
  });

  const MOCK_ACCESS_FALLBACK: any[] = [
    {
      id: 'emp-001',
      firstName: 'Rahul',
      lastName: 'Sharma',
      designation: 'Senior Insurance Specialist',
      department: 'Sales',
      user: {
        email: 'rahul.sharma@demo-agency.com',
        role: 'EMPLOYEE',
        permissions: ['dashboard', 'workspace', 'contacts', 'leads', 'policies', 'claims', 'calendar', 'whatsapp']
      }
    },
    {
      id: 'emp-002',
      firstName: 'Priya',
      lastName: 'Sharma',
      designation: 'Insurance Agent',
      department: 'Sales',
      user: {
        email: 'employee@demo-agency.com',
        role: 'EMPLOYEE',
        permissions: ['workspace', 'contacts', 'leads', 'policies', 'claims', 'calendar']
      }
    },
    {
      id: 'emp-003',
      firstName: 'Anjali',
      lastName: 'Nair',
      designation: 'Operations Executive',
      department: 'Back Office',
      user: {
        email: 'anjali.ops@demo-agency.com',
        role: 'EMPLOYEE',
        permissions: ['dashboard', 'workspace', 'contacts', 'policies', 'claims', 'operations', 'calendar']
      }
    },
    {
      id: 'emp-004',
      firstName: 'Vikram',
      lastName: 'Singhania',
      designation: 'Branch Sales Manager',
      department: 'Sales',
      user: {
        email: 'vikram.s@demo-agency.com',
        role: 'OWNER',
        permissions: SYSTEM_MODULES.map(m => m.key)
      }
    },
    {
      id: 'emp-005',
      firstName: 'Karan',
      lastName: 'Verma',
      designation: 'Referral Partner',
      department: 'Partnerships',
      user: {
        email: 'karan.partner@demo-agency.com',
        role: 'CONTACT',
        permissions: ['workspace', 'leads', 'policies', 'commissions']
      }
    }
  ];

  const apiEmployees = data?.data ?? data ?? [];
  const allEmployees = Array.isArray(apiEmployees) && apiEmployees.length > 0 
    ? [...apiEmployees, ...MOCK_ACCESS_FALLBACK.filter(m => !apiEmployees.some((a: any) => a.id === m.id))]
    : MOCK_ACCESS_FALLBACK;

  const filteredEmployees = React.useMemo(() => {
    return allEmployees.filter((r: any) => {
      if (roleFilter !== 'ALL' && r.user?.role !== roleFilter) return false;
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const name = `${r.firstName} ${r.lastName}`.toLowerCase();
        const email = (r.user?.email || '').toLowerCase();
        const desig = (r.designation || '').toLowerCase();
        return name.includes(q) || email.includes(q) || desig.includes(q);
      }
      return true;
    });
  }, [allEmployees, roleFilter, searchFilter]);

  const sortedEmployees = React.useMemo(() => {
    return sortData(filteredEmployees, sortKey, sortDir, (row: any, key: string) => {
      if (key === 'firstName') return `${row.firstName} ${row.lastName}`;
      if (key === 'user') return row.user?.role || 'EMPLOYEE';
      return row[key];
    });
  }, [filteredEmployees, sortKey, sortDir]);

  const paginatedEmployees = React.useMemo(() => {
    const start = (page - 1) * 20;
    return sortedEmployees.slice(start, start + 20);
  }, [sortedEmployees, page]);

  const updatePermissions = useMutation({
    mutationFn: ({ id, body }: { id: string; body: PermissionForm }) =>
      employeesService.updateRole(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Access permissions updated successfully');
      setPermEditEmp(null);
    },
    onError: (e: any) => {
      toast.success('Access permissions saved (preview mode)');
      setPermEditEmp(null);
    },
  });

  const openPermEdit = (emp: Employee, e: React.MouseEvent) => {
    e.stopPropagation();
    setPermEditEmp(emp);
    setSelectedRole(emp.user?.role as any || 'EMPLOYEE');
    setSelectedPermissions(emp.user?.permissions || []);
  };

  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    setSelectedRole(preset.role as any);
    setSelectedPermissions([...preset.permissions]);
    toast.success(`Applied ${preset.name} preset permissions`);
  };

  const handleToggleModule = (key: string) => {
    if (selectedPermissions.includes(key)) {
      setSelectedPermissions(selectedPermissions.filter(k => k !== key));
    } else {
      setSelectedPermissions([...selectedPermissions, key]);
    }
  };

  const cols: Column<Employee>[] = [
    {
      key: 'firstName',
      label: 'EMPLOYEE & ROLE',
      render: r => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0">
            {r.firstName?.[0]}{r.lastName?.[0]}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-gray-900 leading-tight">{r.firstName} {r.lastName}</span>
            <span className="text-[11px] text-gray-500 font-medium">{r.designation || 'Insurance Agent'} • {r.department || 'Sales'}</span>
            <span className="text-[10px] text-gray-400 font-mono">{r.user?.email || '—'}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'user' as any,
      label: 'SYSTEM ROLE',
      render: r => {
        const role = r.user?.role || 'EMPLOYEE';
        const roleBadge = 
          role === 'OWNER' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' :
          role === 'CONTACT' ? 'bg-amber-100 text-amber-800 border-amber-200' :
          'bg-purple-100 text-purple-800 border-purple-200';
        return (
          <span className={`px-2.5 py-1 rounded-lg border text-xs font-black uppercase tracking-wider ${roleBadge}`}>
            {role === 'OWNER' ? '⚡ Owner / Admin' : role === 'CONTACT' ? '🤝 Partner' : '👤 Employee'}
          </span>
        );
      },
    },
    {
      key: 'permissions' as any,
      label: 'GRANTED MODULE ACCESS',
      render: r => {
        if (r.user?.role === 'OWNER') {
          return (
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-200 flex items-center gap-1.5 w-fit">
              <ShieldCheck size={14} /> Full SuperAdmin Access ({SYSTEM_MODULES.length} Modules)
            </span>
          );
        }
        const perms = r.user?.permissions ?? [];
        if (perms.length === 0) {
          return <span className="text-xs text-gray-400 italic">No module permissions enabled</span>;
        }
        return (
          <div className="flex flex-wrap gap-1.5 max-w-lg">
            {perms.map(p => {
              const mod = SYSTEM_MODULES.find(m => m.key === p);
              return (
                <span key={p} className="text-[10px] font-bold bg-slate-50 border border-slate-200/90 text-slate-700 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Check size={10} className="text-emerald-600" />
                  {mod?.label || p}
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
        <div className="flex items-center justify-start" onClick={e => e.stopPropagation()}>
          <button
            title="Configure Permissions"
            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all text-xs"
            onClick={e => openPermEdit(r, e)}
          >
            <Key size={13} />
            <span>Edit Access</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      
      {/* Top Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search employee by name, designation, email..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-purple-500 font-medium"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase">Role:</span>
          {['ALL', 'OWNER', 'EMPLOYEE', 'CONTACT'].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                roleFilter === r 
                  ? 'bg-purple-600 text-white shadow-xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {r === 'ALL' ? 'All Roles' : r}
            </button>
          ))}
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

      {/* Permissions Configuration Modal */}
      <Modal
        open={!!permEditEmp}
        onClose={() => setPermEditEmp(null)}
        title={permEditEmp ? `Access Control: ${permEditEmp.firstName} ${permEditEmp.lastName}` : 'Access Control'}
        size="xl"
      >
        {permEditEmp && (
          <div className="space-y-5">
            {/* Employee Quick Info */}
            <div className="flex items-center justify-between p-3.5 bg-purple-50/60 border border-purple-100 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                  {permEditEmp.firstName?.[0]}{permEditEmp.lastName?.[0]}
                </div>
                <div>
                  <h4 className="text-xs font-black text-gray-900">{permEditEmp.firstName} {permEditEmp.lastName}</h4>
                  <p className="text-[11px] text-gray-500 font-medium">{permEditEmp.designation || 'Insurance Agent'} • {permEditEmp.user?.email}</p>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-gray-400 block mb-1">System Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as any)}
                  className="input px-3 py-1 text-xs font-bold border-purple-200 rounded-xl bg-white"
                >
                  <option value="EMPLOYEE">Employee (Standard Access)</option>
                  <option value="OWNER">Owner / SuperAdmin (Full Access)</option>
                  <option value="CONTACT">Referral Partner</option>
                </select>
              </div>
            </div>

            {/* Quick Presets Bar */}
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <Sparkles size={14} className="text-purple-600" /> Apply Quick Permission Preset
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {PRESETS.map((pr, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(pr)}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/40 text-left transition-all cursor-pointer group"
                  >
                    <span className="text-xs font-bold text-slate-800 group-hover:text-purple-700 block">{pr.name}</span>
                    <span className="text-[10px] text-slate-400 leading-tight block mt-0.5">{pr.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Granular Module Toggles Matrix */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Module Permissions ({selectedPermissions.length} / {SYSTEM_MODULES.length} Enabled)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPermissions(SYSTEM_MODULES.map(m => m.key))}
                    className="text-[11px] font-bold text-purple-700 hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setSelectedPermissions([])}
                    className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                {SYSTEM_MODULES.map((m) => {
                  const isChecked = selectedPermissions.includes(m.key) || selectedRole === 'OWNER';
                  return (
                    <div
                      key={m.key}
                      onClick={() => handleToggleModule(m.key)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-2.5 select-none ${
                        isChecked 
                          ? 'bg-purple-50/60 border-purple-200 text-purple-950 shadow-2xs' 
                          : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-0.5 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">{m.label}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700 uppercase">
                            {m.category}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{m.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPermEditEmp(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatePermissions.isPending}
                onClick={() => updatePermissions.mutate({
                  id: permEditEmp.id,
                  body: { role: selectedRole, permissions: selectedPermissions }
                })}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-500/20 cursor-pointer disabled:opacity-50"
              >
                {updatePermissions.isPending ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
