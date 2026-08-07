import { useState, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Plus, AlertTriangle, AlertCircle, Users, Target, CalendarCheck, FileText, ShieldCheck, Search, ChevronDown, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesService, subscriptionsService, contactsService } from '@api/index';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { useAuthStore } from '@store/auth.store';
import clsx from 'clsx';
import { DatePicker } from '@comps/common/DatePicker';

import { canEditModule, canManageModule } from '../../utils/permissions';

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
  aadhaarNumber:     z.string().min(1, 'Required').regex(/^\d{12}$/, 'Must be 12 digits'),
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
  const isOverview = location.pathname === '/employees' || location.pathname === '/employees/';
  const user      = useAuthStore(s => s.user);
  const [modalOpen, setModalOpen] = useState(false);
  const qc = useQueryClient();

  const canEditEmployees = canEditModule(user, 'employees');
  const canManageEmployees = canManageModule(user, 'employees');

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
  const [selectedContactId, setSelectedContactId] = useState('');
  const [isContactDropdownOpen, setIsContactDropdownOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

  const selectedContact = useMemo(() => {
    return contactsList.find((c: any) => c.id === selectedContactId);
  }, [contactsList, selectedContactId]);

  const filteredContactsList = useMemo(() => {
    if (!contactSearch.trim()) return contactsList;
    const q = contactSearch.toLowerCase().trim();
    return contactsList.filter((c: any) => {
      const fullName = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const email = (c.email || '').toLowerCase();
      return fullName.includes(q) || phone.includes(q) || email.includes(q);
    });
  }, [contactsList, contactSearch]);

  const selectContactItem = (c: any | null) => {
    if (c) {
      setSelectedContactId(c.id);
      setValue('firstName', c.firstName || '');
      setValue('lastName', c.lastName || '');
      setValue('phone', c.phone || '');
      setValue('email', c.email || '');
      if (c.aadhaarNumber) setValue('aadhaarNumber', c.aadhaarNumber);
      setValue('contactId', c.id);
    } else {
      setSelectedContactId('');
      setValue('contactId', '');
    }
    setIsContactDropdownOpen(false);
  };

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
        {isOverview && canEditEmployees && (
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

      {/* Sub-page Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3 overflow-x-auto custom-scrollbar">
        {[
          { label: 'Directory', path: '/employees', icon: Users },
          { label: 'Targets', path: '/employees/targets', icon: Target },
          { label: 'Attendance & Leaves', path: '/employees/attendance', icon: CalendarCheck },
          { label: 'Reports', path: '/employees/eod-reports', icon: FileText },
          ...(canManageEmployees ? [{ label: 'Access Control', path: '/employees/access-control', icon: ShieldCheck }] : []),
        ].map(tab => {
          const isActive = tab.path === '/employees'
            ? location.pathname === '/employees' || location.pathname === '/employees/'
            : location.pathname.startsWith(tab.path);
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              type="button"
              onClick={() => navigate(tab.path)}
              className={clsx(
                'px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap select-none border',
                isActive
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Sub-page rendered here */}
      <Outlet />

      {/* ── Create Employee Modal ──────────────────────────────────────────── */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset(); setSelectedContactId(''); setContactSearch(''); setIsContactDropdownOpen(false); }} title="New Employee" size="xl">
        <form onSubmit={handleSubmit(async body => { try { await createEmployee.mutateAsync(body); } catch {} })} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-200/60 relative">
              <label className="label font-bold text-slate-700 block mb-1.5">
                Link Existing Contact (Promote Contact to Employee)
              </label>

              {/* Custom Searchable Select Trigger */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsContactDropdownOpen(!isContactDropdownOpen)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 flex items-center justify-between shadow-2xs hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-left transition-all cursor-pointer"
                >
                  <span className="truncate">
                    {selectedContact
                      ? `${selectedContact.firstName} ${selectedContact.lastName}`
                      : '-- Promote New Contact / Select Contact --'}
                  </span>
                  <ChevronDown size={15} className={`text-slate-400 shrink-0 ml-2 transition-transform duration-150 ${isContactDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Panel with Search Bar Inside */}
                {isContactDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-2.5 animate-fadeIn text-xs">
                    {/* Search Bar Inside Dropdown Menu */}
                    <div className="relative mb-2">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        autoFocus
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-7 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none shadow-2xs"
                        placeholder="Search contact by name..."
                        value={contactSearch}
                        onChange={e => setContactSearch(e.target.value)}
                      />
                      {contactSearch && (
                        <button
                          type="button"
                          onClick={() => setContactSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    {/* Scrollable Options List */}
                    <div className="max-h-52 overflow-y-auto space-y-1 custom-scrollbar">
                      <button
                        type="button"
                        onClick={() => selectContactItem(null)}
                        className={`w-full text-left px-3 py-2 rounded-lg font-bold transition-colors select-none cursor-pointer ${
                          !selectedContactId ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        -- Promote New Contact / None --
                      </button>

                      {filteredContactsList.length === 0 ? (
                        <div className="px-3 py-3 text-center text-slate-400 font-semibold italic">
                          No matching contacts found
                        </div>
                      ) : (
                        filteredContactsList.map((c: any) => {
                          const isSel = c.id === selectedContactId;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => selectContactItem(c)}
                              className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between font-semibold select-none cursor-pointer ${
                                isSel ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span className="truncate">
                                {c.firstName} {c.lastName}
                              </span>
                              {isSel && <span className="text-blue-600 font-bold shrink-0 ml-1">✓</span>}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="label">First Name <span className="text-red-500">*</span></label>
              <input {...register('firstName')} className="input" placeholder="Ravi" />
              {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="label">Last Name <span className="text-red-500">*</span></label>
              <input {...register('lastName')} className="input" placeholder="Sharma" />
              {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName.message}</p>}
            </div>
            <div>
              <label className="label">Email <span className="text-red-500">*</span></label>
              <input {...register('email')} type="email" className="input" placeholder="ravi@agency.com" />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Phone <span className="text-red-500">*</span></label>
              <input {...register('phone')} className="input" placeholder="9876543210" />
              {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="label">Password <span className="text-red-500">*</span></label>
              <input {...register('password')} type="password" className="input" placeholder="Min 8 characters" />
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
            </div>
            <div>
              <label className="label">Aadhaar Number <span className="text-red-500">*</span></label>
              <input {...register('aadhaarNumber')} className="input" placeholder="12-digit Aadhaar number" maxLength={12} />
              {errors.aadhaarNumber && <p className="text-xs text-red-500 mt-1">{errors.aadhaarNumber.message}</p>}
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
              <DatePicker {...register('dateOfJoining')} className="input" />
            </div>
            <div>
              <label className="label">Date of Birth</label>
              <DatePicker {...register('dateOfBirth')} className="input" />
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
              <label className="label">Proposal Target</label>
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
