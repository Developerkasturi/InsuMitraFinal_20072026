import { useState, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  Plus, AlertTriangle, AlertCircle, Users, Target, CalendarCheck, 
  FileText, ShieldCheck, Search, ChevronDown, X, Upload, 
  User, Briefcase, Landmark, Sparkles, Eye, EyeOff, 
  CheckCircle2, Link2, Unlink, ArrowRight, ArrowLeft
} from 'lucide-react';
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
  firstName:         z.string().min(1, 'First name is required'),
  lastName:          z.string().min(1, 'Last name is required'),
  email:             z.string().email('Valid email is required'),
  phone:             z.string().min(6, 'Valid phone number is required'),
  password:          z.string().min(8, 'Minimum 8 characters required'),
  aadhaarNumber:     z.string().min(1, 'Aadhaar is required').regex(/^\d{12}$/, 'Must be exactly 12 digits'),
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

type TabKey = 'personal' | 'job' | 'targets' | 'bank';

const TABS: { id: TabKey; label: string; stepNumber: number; icon: typeof User; fields: (keyof CreateForm)[] }[] = [
  { 
    id: 'personal', 
    label: 'Personal & Login', 
    stepNumber: 1, 
    icon: User, 
    fields: ['firstName', 'lastName', 'email', 'phone', 'password', 'aadhaarNumber', 'dateOfBirth', 'gender'] 
  },
  { 
    id: 'job', 
    label: 'Job & Department', 
    stepNumber: 2, 
    icon: Briefcase, 
    fields: ['designation', 'department', 'dateOfJoining'] 
  },
  { 
    id: 'targets', 
    label: 'Targets & Pay', 
    stepNumber: 3, 
    icon: Target, 
    fields: ['monthlyTarget', 'callsTarget', 'visitsTarget', 'baseSalary', 'bonusPlanned'] 
  },
  { 
    id: 'bank', 
    label: 'Bank & Settlement', 
    stepNumber: 4, 
    icon: Landmark, 
    fields: ['bankName', 'bankAccountNumber', 'bankIfscCode', 'bankBranch', 'bankAccountType'] 
  },
];

export default function EmployeesLayout() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const isOverview = location.pathname === '/employees' || location.pathname === '/employees/';
  const user      = useAuthStore(s => s.user);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('personal');
  const [showPassword, setShowPassword] = useState(false);
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

  const { register, handleSubmit, reset, setValue, trigger, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    mode: 'onTouched',
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
      setValue('firstName', c.firstName || '', { shouldValidate: true });
      setValue('lastName', c.lastName || '', { shouldValidate: true });
      setValue('phone', c.phone || '', { shouldValidate: true });
      setValue('email', c.email || '', { shouldValidate: true });
      if (c.aadhaarNumber) setValue('aadhaarNumber', c.aadhaarNumber, { shouldValidate: true });
      if (c.gender) setValue('gender', c.gender, { shouldValidate: true });
      if (c.dateOfBirth) {
        const dobStr = typeof c.dateOfBirth === 'string' ? c.dateOfBirth.split('T')[0] : '';
        setValue('dateOfBirth', dobStr, { shouldValidate: true });
      }
      setValue('contactId', c.id);
      toast.success(`Populated details from ${c.firstName} ${c.lastName}`);
    } else {
      setSelectedContactId('');
      setValue('contactId', '');
    }
    setIsContactDropdownOpen(false);
  };

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let generated = '';
    for (let i = 0; i < 10; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Ensure complexity
    generated = `Emp#${generated}9`;
    setValue('password', generated, { shouldValidate: true });
    setShowPassword(true);
    navigator.clipboard?.writeText(generated);
    toast.success('Generated strong password & copied to clipboard!', { icon: '🔑' });
  };

  const createEmployee = useMutation({
    mutationFn: (body: CreateForm) => employeesService.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      setModalOpen(false);
      reset();
      setSelectedContactId('');
      setActiveTab('personal');
      toast.success('Employee created successfully');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to create employee'),
  });

  const handleCloseModal = () => {
    setModalOpen(false);
    reset();
    setSelectedContactId('');
    setContactSearch('');
    setIsContactDropdownOpen(false);
    setActiveTab('personal');
  };

  const currentTabIndex = TABS.findIndex(t => t.id === activeTab);

  const goToNextTab = async () => {
    const currentTabObj = TABS[currentTabIndex];
    const isStepValid = await trigger(currentTabObj.fields as any);
    if (isStepValid && currentTabIndex < TABS.length - 1) {
      setActiveTab(TABS[currentTabIndex + 1].id);
    }
  };

  const goToPrevTab = () => {
    if (currentTabIndex > 0) {
      setActiveTab(TABS[currentTabIndex - 1].id);
    }
  };

  // Find if a tab has errors
  const getTabErrorCount = (tab: typeof TABS[0]) => {
    return tab.fields.filter(f => !!errors[f]).length;
  };

  const onFormSubmit = async (data: CreateForm) => {
    try {
      await createEmployee.mutateAsync(data);
    } catch {
      // If error or invalid, ensure the user lands on the tab with error
      for (const tab of TABS) {
        if (getTabErrorCount(tab) > 0) {
          setActiveTab(tab.id);
          break;
        }
      }
    }
  };

  const onInvalidSubmit = (formErrors: any) => {
    for (const tab of TABS) {
      const hasErr = tab.fields.some(f => !!formErrors[f]);
      if (hasErr) {
        setActiveTab(tab.id);
        toast.error(`Please complete required fields in "${tab.label}"`);
        break;
      }
    }
  };

  return (
    <div className="space-y-4 relative pb-20">
      {/* Near-limit warning */}
      {isNearLimit && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl flex items-center justify-between text-sm shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
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
          <div className="flex flex-wrap items-center gap-2">
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
      </div>

      {/* Sub-page Navigation Tabs (Mobile Responsive Horizontal Scroll) */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3 overflow-x-auto no-scrollbar flex-nowrap scroll-smooth">
        {[
          { label: 'Directory', path: '/employees', icon: Users },
          { label: 'Job Descriptions', path: '/employees/job-descriptions', icon: Briefcase },
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
                'shrink-0 whitespace-nowrap px-3.5 sm:px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer select-none border',
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

      {/* Floating Right Action Panel (Upload & Add Employee) */}
      {isOverview && canEditEmployees && (
        <div className="fixed right-5 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-3 bg-white/90 backdrop-blur-xl p-2 rounded-2xl shadow-2xl border border-slate-200/80 animate-fadeIn">
          {/* Upload */}
          <button
            type="button"
            onClick={() => toast('Bulk Employee Import feature available', { icon: '📥' })}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white flex items-center justify-center transition-all hover:scale-105 shadow-md shadow-emerald-500/25 cursor-pointer group relative"
            title="Import Employees CSV"
          >
            <Upload size={18} strokeWidth={2.2} />
            <span className="absolute right-full mr-3 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl border border-slate-800">
              Import Employees CSV
            </span>
          </button>

          {/* Add Employee Button */}
          <button
            type="button"
            onClick={() => { setModalOpen(true); setActiveTab('personal'); }}
            disabled={isLimitReached}
            className={clsx(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 shadow-lg cursor-pointer group relative",
              isLimitReached
                ? "bg-slate-400 text-white cursor-not-allowed opacity-60"
                : "bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/30"
            )}
            title="Add New Employee"
          >
            <Plus size={20} strokeWidth={2.5} />
            <span className="absolute right-full mr-3 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl border border-slate-800">
              + Add New Employee
            </span>
          </button>
        </div>
      )}

      {/* Sub-page rendered here */}
      <Outlet />

      {/* ── Create Employee Modal ──────────────────────────────────────────── */}
      <Modal 
        open={modalOpen} 
        onClose={handleCloseModal} 
        title="Add New Employee" 
        subtitle="Onboard a new team member with portal credentials, targets and payroll settings"
        icon={<Users size={20} />}
        size="xl"
      >
        <form onSubmit={handleSubmit(onFormSubmit, onInvalidSubmit)} className="flex flex-col h-full">
          {/* Step & Tab Navigation Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 bg-slate-100/70 p-1.5 rounded-2xl border border-slate-200/80">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              const errorCount = getTabErrorCount(tab);
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    "flex items-center justify-center sm:justify-start gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all relative select-none cursor-pointer",
                    isActive
                      ? "bg-white text-blue-700 shadow-md shadow-slate-200 border border-slate-200/80"
                      : "text-slate-500 hover:text-slate-800 hover:bg-white/60"
                  )}
                >
                  <span className={clsx(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0",
                    isActive ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"
                  )}>
                    {tab.stepNumber}
                  </span>
                  <Icon size={14} className={isActive ? "text-blue-600" : "text-slate-400"} />
                  <span className="truncate hidden sm:inline">{tab.label}</span>

                  {errorCount > 0 && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                      {errorCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Fixed Height Tab Content Container (Prevents Height Shifts) */}
          <div className="min-h-[390px] max-h-[440px] overflow-y-auto custom-scrollbar px-1 pr-2 space-y-4">
            
            {/* ── TAB 1: Personal & Login ───────────────────────────────────── */}
            {activeTab === 'personal' && (
              <div className="space-y-4 animate-fadeIn">
                {/* Promote Contact Section */}
                <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 p-3.5 rounded-2xl border border-blue-200/60 shadow-2xs relative">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <Link2 size={14} className="text-blue-600" />
                      Link &amp; Promote Existing Contact
                    </label>
                    <span className="text-[11px] font-medium text-slate-500">
                      Auto-fills name, phone, email &amp; KYC
                    </span>
                  </div>

                  {selectedContact ? (
                    <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-blue-200 shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-black flex items-center justify-center text-sm shadow-md shadow-blue-500/20">
                          {selectedContact.firstName?.charAt(0)}{selectedContact.lastName?.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-900">
                              {selectedContact.firstName} {selectedContact.lastName}
                            </h4>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                              <CheckCircle2 size={10} /> Linked
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium">
                            {selectedContact.email || 'No email'} • {selectedContact.phone || 'No phone'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => selectContactItem(null)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-red-200 text-slate-600 hover:text-red-600 hover:bg-red-50 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Unlink Contact"
                      >
                        <Unlink size={13} /> Unlink
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsContactDropdownOpen(!isContactDropdownOpen)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 flex items-center justify-between shadow-2xs hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-left transition-all cursor-pointer"
                      >
                        <span className="truncate text-slate-600">
                          -- Search &amp; Promote an Existing Contact / Client --
                        </span>
                        <ChevronDown size={15} className={`text-slate-400 shrink-0 ml-2 transition-transform duration-150 ${isContactDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isContactDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-2.5 animate-fadeIn text-xs">
                          <div className="relative mb-2">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              autoFocus
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-7 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none shadow-2xs"
                              placeholder="Search contact by name, phone or email..."
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

                          <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                            <button
                              type="button"
                              onClick={() => selectContactItem(null)}
                              className="w-full text-left px-3 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-50 transition-colors select-none cursor-pointer"
                            >
                              -- Skip / Create Fresh Employee --
                            </button>

                            {filteredContactsList.length === 0 ? (
                              <div className="px-3 py-3 text-center text-slate-400 font-semibold italic">
                                No matching contacts found
                              </div>
                            ) : (
                              filteredContactsList.map((c: any) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => selectContactItem(c)}
                                  className="w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between font-semibold select-none cursor-pointer text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                                >
                                  <div className="truncate">
                                    <span className="font-bold">{c.firstName} {c.lastName}</span>
                                    <span className="text-[11px] text-slate-400 ml-2">({c.phone || c.email || 'No contact info'})</span>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Personal & Login Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="label font-bold text-slate-700">First Name <span className="text-red-500">*</span></label>
                    <input {...register('firstName')} className="input" placeholder="e.g. Rahul" />
                    {errors.firstName && <p className="text-xs text-red-500 mt-1 font-medium">{errors.firstName.message}</p>}
                  </div>
                  <div>
                    <label className="label font-bold text-slate-700">Last Name <span className="text-red-500">*</span></label>
                    <input {...register('lastName')} className="input" placeholder="e.g. Sharma" />
                    {errors.lastName && <p className="text-xs text-red-500 mt-1 font-medium">{errors.lastName.message}</p>}
                  </div>
                  <div>
                    <label className="label font-bold text-slate-700">Work / Login Email <span className="text-red-500">*</span></label>
                    <input {...register('email')} type="email" className="input" placeholder="rahul@agency.com" />
                    {errors.email && <p className="text-xs text-red-500 mt-1 font-medium">{errors.email.message}</p>}
                  </div>
                  <div>
                    <label className="label font-bold text-slate-700">Mobile Phone <span className="text-red-500">*</span></label>
                    <input {...register('phone')} className="input" placeholder="9876543210" />
                    {errors.phone && <p className="text-xs text-red-500 mt-1 font-medium">{errors.phone.message}</p>}
                  </div>

                  {/* Password with generator */}
                  <div className="sm:col-span-2 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="label font-bold text-slate-700 mb-0">
                        Login Password <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleGeneratePassword}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <Sparkles size={13} /> Generate Strong Password
                      </button>
                    </div>
                    <div className="relative">
                      <input 
                        {...register('password')} 
                        type={showPassword ? 'text' : 'password'} 
                        className="input pr-10 font-mono text-xs" 
                        placeholder="Min 8 characters (used by employee to login)" 
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.password && <p className="text-xs text-red-500 font-medium">{errors.password.message}</p>}
                  </div>

                  <div>
                    <label className="label font-bold text-slate-700">Aadhaar Number <span className="text-red-500">*</span></label>
                    <input {...register('aadhaarNumber')} className="input font-mono" placeholder="12-digit Aadhaar number" maxLength={12} />
                    {errors.aadhaarNumber && <p className="text-xs text-red-500 mt-1 font-medium">{errors.aadhaarNumber.message}</p>}
                  </div>
                  <div>
                    <label className="label font-bold text-slate-700">Gender</label>
                    <select {...register('gender')} className="input">
                      <option value="">Select gender</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label font-bold text-slate-700">Date of Birth</label>
                    <DatePicker {...register('dateOfBirth')} className="input" />
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 2: Job & Department ───────────────────────────────────── */}
            {activeTab === 'job' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-start gap-2.5">
                  <Briefcase className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-600">
                    <p className="font-bold text-slate-800">Role &amp; Placement</p>
                    <p>Assign employee designation, departmental team and official onboarding date.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="label font-bold text-slate-700">Designation / Role Title</label>
                    <input {...register('designation')} className="input" placeholder="e.g. Senior Insurance Advisor" />
                  </div>
                  <div>
                    <label className="label font-bold text-slate-700">Department</label>
                    <input {...register('department')} className="input" placeholder="e.g. Sales &amp; Advisory" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label font-bold text-slate-700">Date of Joining</label>
                    <DatePicker {...register('dateOfJoining')} className="input" />
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 3: Targets & Compensation ────────────────────────────── */}
            {activeTab === 'targets' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 flex items-start gap-2.5">
                  <Target className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-600">
                    <p className="font-bold text-purple-900">Targets &amp; Performance Quotas</p>
                    <p>Set baseline quotas for calls, proposals, monthly sales target, and salary package commitments.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="sm:col-span-3 bg-white p-3.5 rounded-xl border border-purple-200/80 shadow-2xs">
                    <label className="label font-extrabold text-purple-900">Monthly Sales Target (₹)</label>
                    <input {...register('monthlyTarget')} type="number" className="input text-base font-black text-purple-700" placeholder="e.g. 500000" />
                    <p className="text-[11px] text-slate-400 mt-1">Calculates attainment % in Employee Targets dashboard</p>
                  </div>
                  <div>
                    <label className="label font-bold text-slate-700">Daily Calls Target</label>
                    <input {...register('callsTarget')} type="number" className="input font-bold" placeholder="e.g. 30" />
                  </div>
                  <div>
                    <label className="label font-bold text-slate-700">Daily Proposals / Visits Target</label>
                    <input {...register('visitsTarget')} type="number" className="input font-bold" placeholder="e.g. 5" />
                  </div>
                  <div>
                    <label className="label font-bold text-slate-700">Base Salary (₹ / month)</label>
                    <input {...register('baseSalary')} type="number" className="input font-bold" placeholder="e.g. 45000" />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="label font-bold text-slate-700">Planned Monthly Performance Bonus (₹)</label>
                    <input {...register('bonusPlanned')} type="number" className="input font-bold" placeholder="e.g. 15000" />
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 4: Bank & Settlement ─────────────────────────────────── */}
            {activeTab === 'bank' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 flex items-start gap-2.5">
                  <Landmark className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-600">
                    <p className="font-bold text-emerald-900">Payroll &amp; Settlement Account</p>
                    <p>Bank account particulars for salary payout and commission disbursements.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="label font-bold text-slate-700">Bank Name</label>
                    <input {...register('bankName')} className="input text-xs" placeholder="e.g. HDFC Bank" />
                  </div>
                  <div>
                    <label className="label font-bold text-slate-700">Account Number</label>
                    <input {...register('bankAccountNumber')} className="input text-xs font-mono" placeholder="e.g. 501002345678" />
                  </div>
                  <div>
                    <label className="label font-bold text-slate-700">IFSC Code</label>
                    <input {...register('bankIfscCode')} className="input text-xs font-mono uppercase" placeholder="e.g. HDFC0001234" />
                  </div>
                  <div>
                    <label className="label font-bold text-slate-700">Branch Name</label>
                    <input {...register('bankBranch')} className="input text-xs" placeholder="e.g. Connaught Place, New Delhi" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label font-bold text-slate-700">Account Type</label>
                    <select {...register('bankAccountType')} className="input text-xs">
                      <option value="">Select account type</option>
                      <option value="Savings">Savings Account</option>
                      <option value="Salary">Salary Account</option>
                      <option value="Current">Current Account</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sticky Modal Footer Navigation */}
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-200/80 bg-white shrink-0">
            <div>
              {currentTabIndex > 0 ? (
                <button
                  type="button"
                  onClick={goToPrevTab}
                  className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3.5 cursor-pointer"
                >
                  <ArrowLeft size={14} /> Previous
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn-secondary text-xs py-2 px-3.5 cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {currentTabIndex < TABS.length - 1 ? (
                <button
                  type="button"
                  onClick={goToNextTab}
                  className="btn-primary flex items-center gap-1.5 text-xs py-2 px-4 cursor-pointer"
                >
                  Next Step <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={createEmployee.isPending}
                  className="btn-primary flex items-center gap-1.5 text-xs py-2 px-5 cursor-pointer shadow-lg shadow-blue-500/20"
                >
                  <CheckCircle2 size={15} />
                  {createEmployee.isPending ? 'Creating Employee…' : 'Create Employee'}
                </button>
              )}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
