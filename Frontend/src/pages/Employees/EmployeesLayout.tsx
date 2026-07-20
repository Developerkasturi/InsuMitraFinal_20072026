import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Plus, AlertTriangle, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesService, subscriptionsService, contactsService } from '@api/index';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { useAuthStore } from '@store/auth.store';
import clsx from 'clsx';

// ─── Shared Employee type (re-exported so sub-pages can import it) ────────────
export interface Employee {
  id: string; firstName: string; lastName: string;
  user?: {
    id: string; email: string; role: string;
    permissions?: string[];
    lastLoginAt?: string | null;
    dailyLogs?: {
      checkIn: string | null; checkOut: string | null;
      notes?: string | null; callsMade?: number;
      visitsCompleted?: number; premiumCollected?: number;
      nextDayPlan?: string | null;
      adminRemarks?: string | null;
    }[];
  };
  designation?: string; department?: string; phone?: string; isActive: boolean;
  dateOfJoining?: string; dateOfBirth?: string; gender?: string;
  baseSalary?: number; bonusPlanned?: number; monthlyTarget?: number;
  bankName?: string; bankAccountNumber?: string; bankIfscCode?: string;
  bankBranch?: string; bankAccountType?: string;
  callsTarget?: number; visitsTarget?: number;
}

const createSchema = z.object({
  firstName:         z.string().min(1, 'Required'),
  lastName:          z.string().min(1, 'Required'),
  email:             z.string().email('Invalid email'),
  phone:             z.string().min(6, 'Required'),
  password:          z.string().min(8, 'Min 8 characters'),
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
  contactId:         z.string().optional(),
});
type CreateForm = z.infer<typeof createSchema>;


export default function EmployeesLayout() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const isOverview = location.pathname === '/employees';
  const user      = useAuthStore(s => s.user);
  const [modalOpen, setModalOpen] = useState(false);
  const qc = useQueryClient();

  // Subscription + seat count
  const { data: subRes } = useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: subscriptionsService.current,
    staleTime: 5 * 60_000,
  });
  const { data: empMeta } = useQuery({
    queryKey: ['employees', 1],
    queryFn: () => employeesService.list({ page: 1, limit: 1 }),
  });

  const sub              = subRes?.data;
  const maxUsers         = sub?.plan?.maxUsers ?? 1;
  const activeUsersCount = empMeta?.meta?.total ?? 0;
  const usagePercentage  = maxUsers > 0 ? (activeUsersCount / maxUsers) * 100 : 0;
  const isLimitReached   = maxUsers !== -1 && activeUsersCount >= maxUsers;
  const isNearLimit      = maxUsers !== -1 && usagePercentage >= 80 && usagePercentage < 100;

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  });

  const { data: contactsData } = useQuery({
    queryKey: ['employees-contacts-list'],
    queryFn: () => contactsService.list({ limit: 500 }),
  });
  const contactsList = contactsData?.data || [];

  const createEmployee = useMutation({
    mutationFn: (body: CreateForm) => employeesService.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      setModalOpen(false);
      reset();
      toast.success('Employee created successfully');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to create employee'),
  });

  return (
    <div className="space-y-4 relative pb-20">
      {/* Near-limit warning */}
      {isNearLimit && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl flex items-center justify-between text-sm shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <span>
              <span className="font-semibold">Capacity Warning:</span> You have used {activeUsersCount} of your {maxUsers === -1 ? 'unlimited' : maxUsers} seats ({Math.round(usagePercentage)}%).
            </span>
          </div>
          {user?.role === 'OWNER' && (
            <button onClick={() => navigate('/subscription')} className="text-xs font-semibold text-primary-700 hover:text-primary-800 underline cursor-pointer">Upgrade Now</button>
          )}
        </div>
      )}

      {/* Limit-reached error */}
      {isLimitReached && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-center justify-between text-sm shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span>
              <span className="font-semibold">Limit Reached:</span> You have reached your limit of {maxUsers} user/employee seats.
            </span>
          </div>
          {user?.role === 'OWNER' && (
            <button onClick={() => navigate('/subscription')} className="text-xs font-semibold text-primary-700 hover:text-primary-800 underline cursor-pointer">Upgrade Now</button>
          )}
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Employees</h2>
        {isOverview && (
          <button
            className={clsx(
              'btn-primary h-9 py-0 px-3 text-xs flex items-center gap-1.5 font-bold cursor-pointer',
              isLimitReached && 'bg-gray-400 border-gray-400 hover:bg-gray-400 hover:border-gray-400 cursor-not-allowed opacity-60'
            )}
            onClick={() => setModalOpen(true)}
            disabled={isLimitReached}
            title={isLimitReached ? 'Limit reached. Upgrade plan to add more user seats.' : undefined}
          >
            <Plus size={13} /> Add Employee
          </button>
        )}
      </div>

      {/* Sub-page rendered here */}
      <Outlet />

      {/* ── Create Employee Modal ──────────────────────────────────────────── */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset(); }} title="New Employee" size="xl">
        <form onSubmit={handleSubmit(async body => { try { await createEmployee.mutateAsync(body); } catch {} })} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
              <label className="label font-bold text-slate-700">Link Existing Contact (Promote Contact to Employee)</label>
              <select
                onChange={(e) => {
                  const cid = e.target.value;
                  if (cid) {
                    const found = contactsList.find((c: any) => c.id === cid);
                    if (found) {
                      setValue('firstName', found.firstName || '');
                      setValue('lastName', found.lastName || '');
                      setValue('phone', found.phone || '');
                      setValue('email', found.email || '');
                      setValue('contactId', found.id);
                    }
                  } else {
                    setValue('contactId', '');
                  }
                }}
                className="input bg-white mt-1"
              >
                <option value="">-- Promote New Contact / Select Contact --</option>
                {contactsList.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} ({c.phone || 'No Phone'} - {c.email || 'No Email'})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">First Name *</label>
              <input {...register('firstName')} className="input" placeholder="Ravi" />
              {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="label">Last Name *</label>
              <input {...register('lastName')} className="input" placeholder="Sharma" />
              {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName.message}</p>}
            </div>
            <div>
              <label className="label">Email *</label>
              <input {...register('email')} type="email" className="input" placeholder="ravi@agency.com" />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Phone *</label>
              <input {...register('phone')} className="input" placeholder="9876543210" />
              {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
            </div>
            <div className="col-span-2">
              <label className="label">Password *</label>
              <input {...register('password')} type="password" className="input" placeholder="Min 8 characters" />
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
            </div>
            <div>
              <label className="label">Designation</label>
              <input {...register('designation')} className="input" placeholder="Sales Agent" />
            </div>
            <div>
              <label className="label">Department</label>
              <input {...register('department')} className="input" placeholder="Life Insurance" />
            </div>
            <div>
              <label className="label">Gender</label>
              <select {...register('gender')} className="input">
                <option value="">Select gender</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Date of Joining</label>
              <input {...register('dateOfJoining')} type="date" className="input" />
            </div>
            <div>
              <label className="label">Date of Birth</label>
              <input {...register('dateOfBirth')} type="date" className="input" />
            </div>
            <div>
              <label className="label">Base Salary (₹)</label>
              <input {...register('baseSalary')} type="number" className="input" placeholder="e.g. 30000" />
            </div>
            <div>
              <label className="label">Bonus Planned (₹)</label>
              <input {...register('bonusPlanned')} type="number" className="input" placeholder="e.g. 5000" />
            </div>
            <div>
              <label className="label">Monthly Sales Target (₹)</label>
              <input {...register('monthlyTarget')} type="number" className="input" placeholder="e.g. 100000" />
            </div>
            <div>
              <label className="label">Daily Calls Target</label>
              <input {...register('callsTarget')} type="number" className="input" placeholder="e.g. 30" />
            </div>
            <div>
              <label className="label">Daily Visits Target</label>
              <input {...register('visitsTarget')} type="number" className="input" placeholder="e.g. 5" />
            </div>
            <div className="col-span-2 border-t border-slate-100 pt-3 grid grid-cols-3 gap-3">
              <div className="col-span-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bank Details</h3>
              </div>
              <div>
                <label className="label">Bank Name</label>
                <input {...register('bankName')} className="input text-xs" placeholder="e.g. HDFC Bank" />
              </div>
              <div>
                <label className="label">Account Number</label>
                <input {...register('bankAccountNumber')} className="input text-xs" placeholder="e.g. 50100123" />
              </div>
              <div>
                <label className="label">IFSC Code</label>
                <input {...register('bankIfscCode')} className="input text-xs" placeholder="e.g. HDFC0000123" />
              </div>
              <div>
                <label className="label">Branch Name</label>
                <input {...register('bankBranch')} className="input text-xs" placeholder="e.g. Connaught Place" />
              </div>
              <div>
                <label className="label">Account Type</label>
                <select {...register('bankAccountType')} className="input text-xs">
                  <option value="">Select type</option>
                  <option value="Savings">Savings</option>
                  <option value="Current">Current</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => { setModalOpen(false); reset(); }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createEmployee.isPending}>
              {createEmployee.isPending ? 'Saving…' : 'Create Employee'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
