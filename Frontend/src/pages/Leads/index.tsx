import { useState, useRef, useEffect, useMemo } from 'react';
import { useLeadKanban, useMoveLeadStage, useCreateLead, useUpdateLead, useDeleteLead } from '@hooks/useLeads';
import Modal from '@comps/common/Modal';
import {
  Plus, Search, Pencil, Trash2, Shield, Upload, Phone, Calendar,
  MessageCircle, LayoutGrid, List, Filter, X, UserPlus,
  UserCircle2, Mail, ChevronDown, Flame, Thermometer, Snowflake,
  Columns, ArrowUpDown, ChevronUp, ChevronRight, Send, RefreshCw,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import clsx from 'clsx';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { contactsService, policiesService, leadsService, employeesService } from '@api/index';
import toast from 'react-hot-toast';
import { useAuthStore } from '@store/auth.store';
import { format } from 'date-fns';

// ── Stage Mappings ────────────────────────────────────────────────────────────

export const STAGE_LABELS: Record<string, string> = {
  OPEN:           'New',
  CONTACTED:      'Contacted',
  PROPOSAL_SENT:  'Proposal Sent',
  IN_DISCUSSION:  'In Discussion',
  LOGIN_PROGRESS: 'Login Progress',
  PAYMENT_DONE:   'Payment Done',
  LOST:           'Lost',
};

const UI_STAGES = ['New', 'Contacted', 'Proposal Sent', 'In Discussion', 'Login Progress', 'Payment Done', 'Lost'];

const STAGE_MAPPINGS: Record<string, string> = {
  'New': 'OPEN',
  'Contacted': 'CONTACTED',
  'Proposal Sent': 'PROPOSAL_SENT',
  'In Discussion': 'IN_DISCUSSION',
  'Login Progress': 'LOGIN_PROGRESS',
  'Payment Done': 'PAYMENT_DONE',
  'Lost': 'LOST',
};

const BACKEND_TO_UI: Record<string, string> = {
  OPEN: 'New',
  CONTACTED: 'Contacted',
  PROPOSAL_SENT: 'Proposal Sent',
  IN_DISCUSSION: 'In Discussion',
  LOGIN_PROGRESS: 'Login Progress',
  PAYMENT_DONE: 'Payment Done',
  LOST: 'Lost',
};

const STAGE_COLORS: Record<string, string> = {
  'New': 'bg-blue-50/20 border-blue-100',
  'Contacted': 'bg-indigo-50/20 border-indigo-100',
  'Proposal Sent': 'bg-purple-50/20 border-purple-100',
  'In Discussion': 'bg-amber-50/20 border-amber-100',
  'Login Progress': 'bg-orange-50/20 border-orange-100',
  'Payment Done': 'bg-green-50/20 border-green-100',
  'Lost': 'bg-rose-50/20 border-rose-100',
};

const BADGE_STYLES: Record<string, string> = {
  OPEN: 'bg-blue-50 text-blue-700 border-blue-200',
  CONTACTED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  IN_DISCUSSION: 'bg-amber-50 text-amber-700 border-amber-200',
  PROPOSAL_SENT: 'bg-purple-50 text-purple-700 border-purple-200',
  LOGIN_PROGRESS: 'bg-orange-50 text-orange-700 border-orange-200',
  PAYMENT_DONE: 'bg-green-50 text-green-700 border-green-200',
  LOST: 'bg-red-50 text-red-700 border-red-200',
};

// ── Hotness Level ─────────────────────────────────────────────────────────────
type HotnessLevel = 'HOT' | 'WARM' | 'COLD';

function deriveHotness(lead: any): HotnessLevel {
  if (!lead.followUpDate) return 'COLD';
  const daysUntil = Math.ceil((new Date(lead.followUpDate).getTime() - Date.now()) / 86400000);
  if (daysUntil < 0) return 'HOT';
  if (daysUntil <= 3) return 'HOT';
  if (daysUntil <= 7) return 'WARM';
  return 'COLD';
}

const HOTNESS_CONFIG: Record<HotnessLevel, { label: string; cls: string; iconName: string }> = {
  HOT:  { label: 'Hot',  cls: 'text-red-600 bg-red-50 border-red-200',     iconName: 'Flame' },
  WARM: { label: 'Warm', cls: 'text-amber-600 bg-amber-50 border-amber-200', iconName: 'Thermometer' },
  COLD: { label: 'Cold', cls: 'text-blue-500 bg-blue-50 border-blue-200',   iconName: 'Snowflake' },
};

function HotnessIcon({ level }: { level: HotnessLevel }) {
  if (level === 'HOT') return <Flame size={10} />;
  if (level === 'WARM') return <Thermometer size={10} />;
  return <Snowflake size={10} />;
}

// ── Form schema ───────────────────────────────────────────────────────────────
const schema = z.object({
  contactId:          z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid contact ID').optional().or(z.literal('')),
  planId:             z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid plan ID').optional().or(z.literal('')),
  sumAssuredRequired: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.coerce.number().positive().optional()
  ),
  premiumBudget: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.coerce.number().positive().optional()
  ),
  followUpDate: z.string().optional(),
  lostReason:   z.string().optional(),
  notes:        z.string().optional(),
});
type Form = z.infer<typeof schema>;

// ── Column definitions ────────────────────────────────────────────────────────
const ALL_TABLE_COLUMNS = [
  { key: 'name',          label: 'Client Name',    defaultVisible: true },
  { key: 'plan',          label: 'Product',        defaultVisible: true },
  { key: 'hotness',       label: 'Hotness',        defaultVisible: true },
  { key: 'employee',      label: 'Assigned To',    defaultVisible: true },
  { key: 'premiumBudget', label: 'Exp. Premium',   defaultVisible: true },
  { key: 'followUpDate',  label: 'Next Follow-up', defaultVisible: true },
  { key: 'stage',         label: 'Stage',          defaultVisible: true },
  { key: 'actions',       label: '',               defaultVisible: true },
];

const PLAN_CATEGORIES = [
  { value: 'LIFE',    label: 'Life Insurance' },
  { value: 'HEALTH',  label: 'Health Insurance' },
  { value: 'MOTOR',   label: 'Motor Insurance' },
  { value: 'TRAVEL',  label: 'Travel Insurance' },
  { value: 'GENERAL', label: 'General Insurance' },
];

const ALL_BACKEND_STAGES = [
  { value: 'OPEN',           label: 'New' },
  { value: 'CONTACTED',      label: 'Contacted' },
  { value: 'PROPOSAL_SENT',  label: 'Proposal Sent' },
  { value: 'IN_DISCUSSION',  label: 'In Discussion' },
  { value: 'LOGIN_PROGRESS', label: 'Login Progress' },
  { value: 'PAYMENT_DONE',   label: 'Payment Done' },
  { value: 'LOST',           label: 'Lost' },
];

import { useSearchParams } from 'react-router-dom';

// ── Main Component ────────────────────────────────────────────────────────────
export default function Leads() {
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [showFilters, setShowFilters] = useState(false);
  const [createInitialStage, setCreateInitialStage] = useState<string>('OPEN');

  // Filters
  const [filterPlans, setFilterPlans]       = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo]     = useState('');
  const [search, setSearch]                 = useState('');

  const [planFilterOpen, setPlanFilterOpen]     = useState(false);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const planFilterRef   = useRef<HTMLDivElement>(null);
  const statusFilterRef = useRef<HTMLDivElement>(null);

  // Table sort
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Table column visibility
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    Object.fromEntries(ALL_TABLE_COLUMNS.map(c => [c.key, c.defaultVisible]))
  );
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  // Modals
  const [modalOpen, setModalOpen]       = useState(false);

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setModalOpen(true);
    }
  }, [searchParams]);
  const [editTarget, setEditTarget]     = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  // Detail popup
  const [detailTarget, setDetailTarget] = useState<any | null>(null);
  const [detailOpen, setDetailOpen]     = useState(false);
  const [detailTab, setDetailTab]       = useState<'overview' | 'comments' | 'stage'>('overview');

  // Contact lookup
  const [isNewContact, setIsNewContact]   = useState(false);
  const [newContactFields, setNewContactFields] = useState({ firstName: '', lastName: '', phone: '', email: '' });
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [dropdownOpen, setDropdownOpen]   = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Plan picker
  const [planSearch, setPlanSearch]     = useState('');
  const [selectedPlan, setSelectedPlan] = useState<{ id: string; name: string } | null>(null);
  const [planDropdown, setPlanDropdown] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: kanbanRes, isLoading } = useLeadKanban();
  const moveStage  = useMoveLeadStage();
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const qc         = useQueryClient();
  const user       = useAuthStore(s => s.user);
  const isOwner    = user?.role === 'OWNER';

  const [draggedOverStage, setDraggedOverStage] = useState<string | null>(null);

  const { data: empRes } = useQuery({
    queryKey: ['employees-list-leads'],
    queryFn: () => employeesService.list({ limit: 100 }),
    enabled: isOwner,
    staleTime: 5 * 60_000,
  });
  const employees = empRes?.data ?? [];

  // Flat leads
  const leadsFlat = useMemo(() => {
    const rawData = kanbanRes?.data ?? {};
    const flat: any[] = [];
    Object.keys(rawData).forEach(backendStage => {
      (rawData[backendStage] || []).forEach((card: any) => {
        flat.push({ ...card, uiStage: BACKEND_TO_UI[card.stage] || 'New' });
      });
    });
    return flat;
  }, [kanbanRes]);

  // Client-side filter
  const filteredLeads = useMemo(() => {
    const sTerm = search.toLowerCase();
    return leadsFlat.filter(lead => {
      const fullName = `${lead.contact?.firstName || ''} ${lead.contact?.lastName || ''}`.toLowerCase();
      if (search && !fullName.includes(sTerm) && !(lead.contact?.phone || '').includes(sTerm)) return false;
      if (filterPlans.length > 0 && !filterPlans.includes(lead.plan?.category ?? '')) return false;
      if (filterEmployee && lead.assignedEmployeeId !== filterEmployee) return false;
      if (filterStatuses.length > 0 && !filterStatuses.includes(lead.stage)) return false;
      if (filterDateFrom) {
        const fromDate = new Date(filterDateFrom); fromDate.setHours(0, 0, 0, 0);
        if (!lead.followUpDate || new Date(lead.followUpDate) < fromDate) return false;
      }
      if (filterDateTo) {
        const toDate = new Date(filterDateTo); toDate.setHours(23, 59, 59, 999);
        if (!lead.followUpDate || new Date(lead.followUpDate) > toDate) return false;
      }
      return true;
    });
  }, [leadsFlat, search, filterPlans, filterEmployee, filterStatuses, filterDateFrom, filterDateTo]);

  // Sorted leads for table
  const sortedLeads = useMemo(() => {
    if (!sortKey) return filteredLeads;
    return [...filteredLeads].sort((a, b) => {
      let av: any = '';
      let bv: any = '';
      if (sortKey === 'name') {
        av = `${a.contact?.firstName ?? ''} ${a.contact?.lastName ?? ''}`;
        bv = `${b.contact?.firstName ?? ''} ${b.contact?.lastName ?? ''}`;
      } else if (sortKey === 'plan') {
        av = a.plan?.name ?? ''; bv = b.plan?.name ?? '';
      } else if (sortKey === 'premiumBudget') {
        av = a.premiumBudget ?? 0; bv = b.premiumBudget ?? 0;
      } else if (sortKey === 'followUpDate') {
        av = a.followUpDate ? new Date(a.followUpDate).getTime() : 0;
        bv = b.followUpDate ? new Date(b.followUpDate).getTime() : 0;
      } else if (sortKey === 'stage') {
        av = a.stage ?? ''; bv = b.stage ?? '';
      }
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [filteredLeads, sortKey, sortDir]);

  // Board columns
  const filteredBoard = useMemo(() => {
    const b: Record<string, any[]> = {};
    UI_STAGES.forEach(s => { b[s] = filteredLeads.filter(l => l.uiStage === s); });
    return b;
  }, [filteredLeads]);

  const expectedBusiness = (uiStage: string) =>
    (filteredBoard[uiStage] ?? []).reduce((sum, c) => sum + (c.premiumBudget ?? 0), 0);

  // Click-outside
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
      if (planFilterRef.current && !planFilterRef.current.contains(e.target as Node)) setPlanFilterOpen(false);
      if (statusFilterRef.current && !statusFilterRef.current.contains(e.target as Node)) setStatusFilterOpen(false);
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenuOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleWhatsApp = (phone?: string) => {
    if (!phone) return;
    window.open(`https://wa.me/91${phone.replace(/\D/g, '')}`, '_blank');
  };
  const handleCall = (phone?: string) => {
    if (!phone) return;
    window.location.href = `tel:${phone}`;
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const toastId = toast.loading('Importing leads...');
    try {
      const res = await leadsService.importCsv(file);
      toast.success(res.message || 'Successfully imported leads!', { id: toastId });
      qc.invalidateQueries({ queryKey: ['leads'] });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to import leads', { id: toastId });
    }
  };

  const { data: contactResults } = useQuery({
    queryKey: ['contacts-search', contactSearch],
    queryFn:  () => contactsService.list({ search: contactSearch, limit: 8 }),
    enabled:  modalOpen && !editTarget && !isNewContact && contactSearch.length >= 1,
  });
  const contactsList: any[] = contactResults?.data ?? [];

  const { data: planResults } = useQuery({
    queryKey: ['plan-search-leads', planSearch],
    queryFn:  () => policiesService.plans(planSearch || undefined),
    enabled:  modalOpen,
  });
  const plans: any[] = (planResults?.data ?? []).filter((p: any) =>
    !planSearch || p.name.toLowerCase().includes(planSearch.toLowerCase())
  );

  const { register, handleSubmit, reset, setValue } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (body: Form) => {
    let contactId = body.contactId?.trim() ? body.contactId : undefined;
    const planId = body.planId?.trim() ? body.planId : undefined;

    if (!editTarget && isNewContact) {
      if (!newContactFields.firstName.trim() || !newContactFields.lastName.trim() || !newContactFields.phone.trim()) {
        toast.error('Please enter first name, last name and phone for the new contact');
        return;
      }
      const toastId = toast.loading('Creating contact...');
      try {
        const contactRes = await contactsService.create({
          firstName: newContactFields.firstName,
          lastName:  newContactFields.lastName,
          phone:     newContactFields.phone,
          email:     newContactFields.email || undefined,
        });
        contactId = contactRes.data.id;
        toast.success('Contact created', { id: toastId });
      } catch (err: any) {
        toast.error(err.response?.data?.message ?? 'Failed to create contact', { id: toastId });
        return;
      }
    }

    if (editTarget) {
      await updateLead.mutateAsync({ id: editTarget.id, body: {
        notes: body.notes,
        planId,
        sumAssuredRequired: body.sumAssuredRequired,
        premiumBudget: body.premiumBudget,
        followUpDate: body.followUpDate || undefined,
      }});
    } else {
      if (!contactId) { toast.error('Please select or create a contact'); return; }
      await createLead.mutateAsync({
        contactId,
        planId,
        sumAssuredRequired: body.sumAssuredRequired,
        premiumBudget: body.premiumBudget,
        followUpDate: body.followUpDate || undefined,
        notes: body.notes,
        stage: createInitialStage,
      });
    }
    closeModal();
    qc.invalidateQueries();
  };

  const openCreate = (stage?: string) => {
    setEditTarget(null);
    setSelectedContact(null);
    setContactSearch('');
    setSelectedPlan(null);
    setPlanSearch('');
    setIsNewContact(false);
    setNewContactFields({ firstName: '', lastName: '', phone: '', email: '' });
    setCreateInitialStage(stage || 'OPEN');
    reset();
    setModalOpen(true);
  };

  const openEdit = (card: any) => {
    setEditTarget(card);
    setValue('contactId', card.contactId ?? card.contact?.id ?? '');
    setValue('notes', card.notes ?? '');
    setValue('planId', card.planId ?? '');
    setValue('sumAssuredRequired', card.sumAssuredRequired ?? undefined);
    setValue('premiumBudget', card.premiumBudget ?? undefined);
    setValue('followUpDate', card.followUpDate ? card.followUpDate.slice(0, 10) : '');
    if (card.plan) setSelectedPlan({ id: card.plan.id, name: card.plan.name });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditTarget(null);
    setSelectedContact(null);
    setContactSearch('');
    setSelectedPlan(null);
    setPlanSearch('');
    setIsNewContact(false);
    setNewContactFields({ firstName: '', lastName: '', phone: '', email: '' });
    reset();
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    await deleteLead.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
    qc.invalidateQueries();
  };

  const openDetail = (card: any) => {
    setDetailTarget(card);
    setDetailTab('overview');
    setDetailOpen(true);
  };

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const activeFilterCount =
    filterPlans.length + filterStatuses.length +
    (filterEmployee ? 1 : 0) + (filterDateFrom ? 1 : 0) + (filterDateTo ? 1 : 0);

  if (isLoading) return <div className="flex h-48 items-center justify-center text-gray-400">Loading pipeline…</div>;

  return (
    <div className="h-full flex flex-col gap-4">

      {/* Floating Bottom-Right Action Panel */}
      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
      <div className="fixed right-6 bottom-8 z-40 flex flex-row gap-3 bg-white/90 backdrop-blur-xl p-2 rounded-2xl shadow-2xl border border-slate-200/80 animate-fadeIn">
        {/* Import CSV */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white flex items-center justify-center transition-all hover:scale-105 shadow-md shadow-emerald-500/25 cursor-pointer group relative"
          title="Import Leads CSV"
        >
          <Upload size={18} strokeWidth={2.2} />
          <span className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl border border-slate-800">
            Import Leads CSV
          </span>
        </button>

        {/* New Lead */}
        <button
          type="button"
          onClick={() => openCreate('OPEN')}
          className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center justify-center transition-all hover:scale-105 shadow-lg shadow-blue-500/30 cursor-pointer group relative"
          title="New Lead"
        >
          <UserPlus size={18} strokeWidth={2.2} />
          <span className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl border border-slate-800">
            New Lead
          </span>
        </button>
      </div>

      {/* Unified Search & Actions Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 border border-slate-100 rounded-2xl shadow-sm">
        {/* Left: Search Bar */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search leads by name or phone..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-slate-800"
          />
        </div>

        {/* Right: View toggle and controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Kanban / Table Toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/50">
            <button
              onClick={() => setViewMode('board')}
              className={clsx('flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold cursor-pointer transition-all select-none',
                viewMode === 'board' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-900')}
            >
              <LayoutGrid size={13} /> <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={clsx('flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold cursor-pointer transition-all select-none',
                viewMode === 'table' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-900')}
            >
              <List size={13} /> <span className="hidden sm:inline">Table</span>
            </button>
          </div>

          {/* Filters Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx('btn-secondary h-9 py-0 px-3 text-xs flex items-center gap-1.5 font-bold cursor-pointer rounded-lg',
              showFilters && 'bg-blue-50 border-blue-200 text-blue-600')}
          >
            <Filter size={13} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="bg-blue-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Table Columns (only in Table view) */}
          {viewMode === 'table' && (
            <div className="relative" ref={colMenuRef}>
              <button
                onClick={() => setColMenuOpen(!colMenuOpen)}
                className="btn-secondary h-9 py-0 px-3 text-xs flex items-center gap-1.5 font-bold cursor-pointer rounded-lg"
              >
                <Columns size={13} /> <span>Columns</span>
              </button>
              {colMenuOpen && (
                <div className="absolute right-0 mt-1.5 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 min-w-[180px] space-y-1.5">
                  {ALL_TABLE_COLUMNS.filter(c => c.key !== 'actions').map(col => (
                    <label key={col.key} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:text-gray-900">
                      <input
                        type="checkbox"
                        checked={visibleColumns[col.key]}
                        onChange={() => setVisibleColumns(prev => ({ ...prev, [col.key]: !prev[col.key] }))}
                        className="rounded accent-blue-600"
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Filter Buttons */}
      <div className="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5 py-1">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mr-2 select-none">
            Quick Filter ({viewMode === 'board' ? 'Products' : 'Statuses'}):
          </span>
          {viewMode === 'board' ? (
            <>
              <button
                onClick={() => setFilterPlans([])}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer select-none',
                  filterPlans.length === 0
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/10'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                )}
              >
                All Products
              </button>
              {PLAN_CATEGORIES.map(opt => {
                const isSelected = filterPlans.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setFilterPlans(prev =>
                        prev.includes(opt.value)
                          ? prev.filter(v => v !== opt.value)
                          : [...prev, opt.value]
                      );
                    }}
                    className={clsx(
                      'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer select-none flex items-center gap-1.5',
                      isSelected
                        ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </>
          ) : (
            <>
              <button
                onClick={() => setFilterStatuses([])}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer select-none',
                  filterStatuses.length === 0
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/10'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                )}
              >
                All Statuses
              </button>
              {ALL_BACKEND_STAGES.map(opt => {
                const isSelected = filterStatuses.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setFilterStatuses(prev =>
                        prev.includes(opt.value)
                          ? prev.filter(v => v !== opt.value)
                          : [...prev, opt.value]
                      );
                    }}
                    className={clsx(
                      'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer select-none flex items-center gap-1.5',
                      isSelected
                        ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    <span className={clsx('h-1.5 w-1.5 rounded-full',
                      opt.value === 'OPEN' && 'bg-blue-500',
                      opt.value === 'CONTACTED' && 'bg-indigo-500',
                      opt.value === 'PROPOSAL_SENT' && 'bg-purple-500',
                      opt.value === 'IN_DISCUSSION' && 'bg-amber-500',
                      opt.value === 'LOGIN_PROGRESS' && 'bg-orange-500',
                      opt.value === 'PAYMENT_DONE' && 'bg-emerald-500',
                      opt.value === 'LOST' && 'bg-rose-500'
                    )} />
                    {opt.label}
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="card-panel grid grid-cols-2 lg:grid-cols-4 gap-4 bg-gray-50/50 p-4 border rounded-xl">
          <div>
            <label className="label text-[11px] font-bold text-gray-700">Product Category (Multi-Select)</label>
            <div className="relative" ref={planFilterRef}>
              <button type="button" onClick={() => setPlanFilterOpen(!planFilterOpen)}
                className="input text-xs flex items-center justify-between w-full text-left bg-white font-medium">
                <span className="truncate">{filterPlans.length === 0 ? 'All Products' : `${filterPlans.length} selected`}</span>
                <ChevronDown size={12} className="text-gray-400 shrink-0" />
              </button>
              {planFilterOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg p-2 space-y-1 max-h-48 overflow-y-auto">
                  {PLAN_CATEGORIES.map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={filterPlans.includes(opt.value)}
                        onChange={() => setFilterPlans(prev => prev.includes(opt.value) ? prev.filter(v => v !== opt.value) : [...prev, opt.value])}
                        className="rounded accent-blue-600" />
                      {opt.label}
                    </label>
                  ))}
                  {filterPlans.length > 0 && (
                    <button onClick={() => setFilterPlans([])} className="w-full text-xs text-red-500 hover:text-red-700 py-1 text-center font-bold">Clear Selected</button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="label text-[11px] font-bold text-gray-700">
              Lead Status (Multi-Select)
            </label>
            <div className="relative" ref={statusFilterRef}>
              <button type="button" onClick={() => setStatusFilterOpen(!statusFilterOpen)}
                className="input text-xs flex items-center justify-between w-full text-left bg-white font-medium">
                <span className="truncate">{filterStatuses.length === 0 ? 'All Statuses / Stages' : `${filterStatuses.length} selected`}</span>
                <ChevronDown size={12} className="text-gray-400 shrink-0" />
              </button>
              {statusFilterOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg p-2 space-y-1 max-h-48 overflow-y-auto">
                  {ALL_BACKEND_STAGES.map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={filterStatuses.includes(opt.value)}
                        onChange={() => setFilterStatuses(prev => prev.includes(opt.value) ? prev.filter(v => v !== opt.value) : [...prev, opt.value])}
                        className="rounded accent-blue-600" />
                      {opt.label}
                    </label>
                  ))}
                  {filterStatuses.length > 0 && (
                    <button onClick={() => setFilterStatuses([])} className="w-full text-xs text-red-500 hover:text-red-700 py-1 text-center font-bold">Clear Selected</button>
                  )}
                </div>
              )}
            </div>
          </div>

          {isOwner ? (
            <div>
              <label className="label text-[11px]">Assigned Employee</label>
              <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)} className="input text-xs">
                <option value="">All Employees</option>
                {employees.map((emp: any) => (
                  <option key={emp.id} value={emp.userId}>{emp.firstName} {emp.lastName}</option>
                ))}
              </select>
            </div>
          ) : <div />}

          <div className="space-y-2">
            <label className="label text-[11px]">Next Follow-up Date</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="input text-xs" />
              <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="input text-xs" />
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="col-span-2 lg:col-span-4 flex justify-end">
              <button
                onClick={() => { setFilterPlans([]); setFilterStatuses([]); setFilterEmployee(''); setFilterDateFrom(''); setFilterDateTo(''); }}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
              >
                <X size={11} /> Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main View */}
      {viewMode === 'board' ? (
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1 custom-scrollbar" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {UI_STAGES.map(stage => {
            const cards = filteredBoard[stage] ?? [];
            const totalBudget = expectedBusiness(stage);
            const backendStage = STAGE_MAPPINGS[stage];
            return (
              <div
                key={stage}
                className="flex-shrink-0 w-72 flex flex-col"
                onDragEnter={e => {
                  e.preventDefault();
                  if (draggedOverStage !== stage) setDraggedOverStage(stage);
                }}
                onDragOver={e => {
                  e.preventDefault();
                }}
                onDragLeave={() => {
                  if (draggedOverStage === stage) setDraggedOverStage(null);
                }}
                onDrop={e => {
                  e.preventDefault();
                  setDraggedOverStage(null);
                  const cardId = e.dataTransfer.getData('cardId');
                  if (cardId && backendStage) moveStage.mutate({ id: cardId, stage: backendStage });
                }}
              >
                <div className="flex items-center justify-between mb-3 px-2 py-1 select-none">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={clsx('h-2 w-2 rounded-full shrink-0',
                      stage === 'New' && 'bg-blue-500',
                      stage === 'Contacted' && 'bg-indigo-500',
                      stage === 'Proposal Sent' && 'bg-purple-500',
                      stage === 'In Discussion' && 'bg-amber-500',
                      stage === 'Login Progress' && 'bg-orange-500',
                      stage === 'Payment Done' && 'bg-emerald-500',
                      stage === 'Lost' && 'bg-rose-500'
                    )} />
                    <span className="text-sm font-bold text-slate-800 truncate">{stage}</span>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200/50 px-1.5 py-0.5 rounded-md shrink-0">{cards.length}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 font-bold shrink-0">
                      ₹{totalBudget >= 100000 ? `${(totalBudget / 100000).toFixed(1)}L` : `${(totalBudget / 1000).toFixed(1)}K`}
                    </span>
                    <button
                      onClick={() => openCreate(backendStage)}
                      className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
                      title={`Add lead in ${stage}`}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>

                <div className={clsx(
                  'flex-1 min-h-[400px] rounded-xl border p-2 space-y-2 transition-all duration-200 overflow-y-auto custom-scrollbar',
                  STAGE_COLORS[stage],
                  draggedOverStage === stage ? 'ring-2 ring-blue-500 scale-[1.01] bg-slate-100' : 'bg-slate-50/50'
                )}>
                  {cards.map(card => (
                    <KanbanCard
                      key={card.id}
                      card={card}
                      onEdit={openEdit}
                      onDelete={c => setDeleteTarget(c)}
                      onOpen={openDetail}
                      onCall={handleCall}
                      onWhatsApp={handleWhatsApp}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <LeadsTable
          data={sortedLeads}
          loading={isLoading}
          visibleColumns={visibleColumns}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          onRowClick={openDetail}
          onEdit={openEdit}
          onDelete={c => setDeleteTarget(c)}
          onCall={handleCall}
          onWhatsApp={handleWhatsApp}
          onCreate={() => openCreate('OPEN')}
        />
      )}

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editTarget ? 'Edit Lead' : 'Add Lead'} size="xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!editTarget && (
            <div className="space-y-4">
              <div className="flex bg-gray-100 rounded-lg p-0.5 border border-gray-200 w-fit">
                <button type="button" onClick={() => setIsNewContact(false)}
                  className={clsx('px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all',
                    !isNewContact ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900')}>
                  Existing Contact
                </button>
                <button type="button" onClick={() => setIsNewContact(true)}
                  className={clsx('px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all',
                    isNewContact ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900')}>
                  <span className="flex items-center gap-1"><UserPlus size={11} /> New Contact</span>
                </button>
              </div>

              {!isNewContact ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label className="label">Contact *</label>
                  {selectedContact ? (
                    <div className="flex items-center justify-between rounded-lg border border-blue-300 bg-blue-50 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{selectedContact.name}</p>
                        <p className="text-xs text-gray-500">{selectedContact.phone}</p>
                      </div>
                      <button type="button" className="text-xs text-red-500 hover:underline"
                        onClick={() => { setSelectedContact(null); setContactSearch(''); setValue('contactId', ''); }}>
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="relative" ref={dropdownRef}>
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input className="input pl-8" placeholder="Search by name or phone…" value={contactSearch}
                        onChange={e => { setContactSearch(e.target.value); setDropdownOpen(true); }}
                        onFocus={() => setDropdownOpen(true)} autoComplete="off" />
                      {dropdownOpen && contactsList.length > 0 && (
                        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                          {contactsList.map((c: any) => (
                            <button key={c.id} type="button"
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 flex justify-between items-center"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => {
                                setSelectedContact({ id: c.id, name: `${c.firstName} ${c.lastName}`, phone: c.phone });
                                setValue('contactId', c.id);
                                setDropdownOpen(false);
                                setContactSearch('');
                              }}>
                              <span className="text-sm font-medium text-gray-900">{c.firstName} {c.lastName}</span>
                              <span className="text-xs text-gray-400">{c.phone}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <input type="hidden" {...register('contactId')} />
                </div>
              ) : (
                <div className="space-y-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Contact Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { field: 'firstName', label: 'First Name *', placeholder: 'First name' },
                      { field: 'lastName',  label: 'Last Name *',  placeholder: 'Last name' },
                      { field: 'phone',     label: 'Phone *',      placeholder: 'Phone number' },
                      { field: 'email',     label: 'Email',        placeholder: 'Email address' },
                    ].map(({ field, label, placeholder }) => (
                      <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label className="label">{label}</label>
                        <input
                          value={newContactFields[field as keyof typeof newContactFields]}
                          onChange={e => setNewContactFields(prev => ({ ...prev, [field]: e.target.value }))}
                          className="input" placeholder={placeholder}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="label">Insurance Plan / Interest</label>
            {selectedPlan ? (
              <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
                <span>{selectedPlan.name}</span>
                <button type="button" className="text-xs text-red-500 hover:underline"
                  onClick={() => { setSelectedPlan(null); setPlanSearch(''); setValue('planId', ''); }}>
                  Clear
                </button>
              </div>
            ) : (
              <div className="relative">
                <input className="input" placeholder="Search insurance product…" value={planSearch}
                  onChange={e => { setPlanSearch(e.target.value); setPlanDropdown(true); }}
                  onFocus={() => setPlanDropdown(true)} />
                {planDropdown && plans.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                    {plans.map((p: any) => (
                      <button key={p.id} type="button" className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                        onClick={() => { setSelectedPlan({ id: p.id, name: p.name }); setValue('planId', p.id); setPlanDropdown(false); setPlanSearch(''); }}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <input type="hidden" {...register('planId')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Sum Assured Required (₹)</label>
              <input {...register('sumAssuredRequired')} type="number" className="input" placeholder="e.g. 500000" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Premium Budget (₹)</label>
              <input {...register('premiumBudget')} type="number" className="input" placeholder="e.g. 15000" />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="label">Follow-up Date</label>
            <input {...register('followUpDate')} type="date" className="input" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="label">Notes / Timeline Remarks</label>
            <textarea {...register('notes')} className="input" rows={2} placeholder="Lead requirements, consultation remarks…" />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 mt-6">
            <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createLead.isPending || updateLead.isPending}>Save</button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Lead" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Delete Lead for <strong>{deleteTarget?.contact?.firstName} {deleteTarget?.contact?.lastName}</strong>?
        </p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="btn-danger" onClick={executeDelete} disabled={deleteLead.isPending}>Delete</button>
        </div>
      </Modal>

      {/* Detail Popup */}
      <Modal
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailTarget(null); }}
        title={detailTarget ? `${detailTarget.contact?.firstName ?? ''} ${detailTarget.contact?.lastName ?? ''}` : 'Lead Details'}
        size="xl"
      >
        {detailTarget && (
          <LeadDetailPopup
            lead={detailTarget}
            tab={detailTab}
            onTabChange={setDetailTab}
            employees={employees}
            isOwner={isOwner}
            onEdit={() => { setDetailOpen(false); openEdit(detailTarget); }}
          />
        )}
      </Modal>
    </div>
  );
}

// ── Kanban Card ───────────────────────────────────────────────────────────────
function KanbanCard({ card, onEdit, onDelete, onOpen, onCall, onWhatsApp }: {
  card: any;
  onEdit: (c: any) => void;
  onDelete: (c: any) => void;
  onOpen: (c: any) => void;
  onCall: (phone?: string) => void;
  onWhatsApp: (phone?: string) => void;
}) {
  const formattedDate = card.createdAt ? format(new Date(card.createdAt), 'dd MMM') : '';
  const followUp = card.followUpDate ? format(new Date(card.followUpDate), 'dd/MMM/yyyy') : null;
  const assigneeName = card.assignedEmployee?.employeeProfile
    ? `${card.assignedEmployee.employeeProfile.firstName} ${card.assignedEmployee.employeeProfile.lastName}`
    : card.assignedEmployee?.name || 'Unassigned';
  const initials = `${card.contact?.firstName?.[0] ?? ''}${card.contact?.lastName?.[0] ?? ''}`.toUpperCase() || 'LD';
  const hotness = deriveHotness(card);
  const hotnessConf = HOTNESS_CONFIG[hotness];

  const AVATAR_BG: Record<string, string> = {
    OPEN: 'bg-blue-500', CONTACTED: 'bg-indigo-500', PROPOSAL_SENT: 'bg-purple-500',
    IN_DISCUSSION: 'bg-amber-500', LOGIN_PROGRESS: 'bg-orange-500',
    PAYMENT_DONE: 'bg-emerald-500', LOST: 'bg-rose-500',
  };
  const BORDER_TOP: Record<string, string> = {
    OPEN: 'border-t-4 border-t-blue-500', CONTACTED: 'border-t-4 border-t-indigo-500',
    PROPOSAL_SENT: 'border-t-4 border-t-purple-500', IN_DISCUSSION: 'border-t-4 border-t-amber-500',
    LOGIN_PROGRESS: 'border-t-4 border-t-orange-500', PAYMENT_DONE: 'border-t-4 border-t-emerald-500',
    LOST: 'border-t-4 border-t-rose-500',
  };
  const SHADOW_HOVER: Record<string, string> = {
    OPEN: 'hover:shadow-md hover:shadow-blue-500/10 hover:border-blue-400',
    CONTACTED: 'hover:shadow-md hover:shadow-indigo-500/10 hover:border-indigo-400',
    PROPOSAL_SENT: 'hover:shadow-md hover:shadow-purple-500/10 hover:border-purple-400',
    IN_DISCUSSION: 'hover:shadow-md hover:shadow-amber-500/10 hover:border-amber-400',
    LOGIN_PROGRESS: 'hover:shadow-md hover:shadow-orange-500/10 hover:border-orange-400',
    PAYMENT_DONE: 'hover:shadow-md hover:shadow-emerald-500/10 hover:border-emerald-400',
    LOST: 'hover:shadow-md hover:shadow-rose-500/10 hover:border-rose-400',
  };
  const RING_COLOR: Record<string, string> = {
    OPEN: 'ring-blue-500/20', CONTACTED: 'ring-indigo-500/20', PROPOSAL_SENT: 'ring-purple-500/20',
    IN_DISCUSSION: 'ring-amber-500/20', LOGIN_PROGRESS: 'ring-orange-500/20',
    PAYMENT_DONE: 'ring-emerald-500/20', LOST: 'ring-rose-500/20',
  };

  return (
    <div
      draggable
      onDragStart={e => e.dataTransfer.setData('cardId', card.id)}
      onClick={() => onOpen(card)}
      className={clsx(
        'bg-white rounded-2xl p-4 shadow-sm border border-slate-100 cursor-grab active:cursor-grabbing hover:-translate-y-0.5 transition-[transform,box-shadow,border-color] duration-150 flex flex-col gap-3 group relative overflow-hidden',
        BORDER_TOP[card.stage] ?? 'border-t-4 border-t-slate-300',
        SHADOW_HOVER[card.stage] ?? 'hover:shadow-slate-500/10'
      )}
    >
      <div className="flex items-center justify-between min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className={clsx('h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm ring-4',
            AVATAR_BG[card.stage] ?? 'bg-slate-500', RING_COLOR[card.stage] ?? 'ring-slate-500/20')}>
            {initials}
          </div>
          <span className={clsx('flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[9px] font-bold', hotnessConf.cls)}>
            <HotnessIcon level={hotness} /> {hotnessConf.label}
          </span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white pl-1.5" onClick={e => e.stopPropagation()}>
          <button onClick={() => onEdit(card)} className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-slate-50 transition-colors">
            <Pencil size={11} />
          </button>
          <button onClick={() => onDelete(card)} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-slate-50 transition-colors">
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      <div className="min-w-0">
        <h4 className="text-[13px] font-bold text-slate-900 leading-snug hover:text-blue-600 transition-colors truncate">
          {card.contact?.firstName} {card.contact?.lastName}
        </h4>
        <p className="text-[10px] text-slate-500 font-medium mt-0.5">Created {formattedDate}</p>
      </div>

      <div className="border-t border-slate-100/80 my-0.5" />

      <div className="space-y-1.5 text-xs text-slate-700 font-medium">
        {card.contact?.phone && (
          <div className="flex items-center gap-2">
            <Phone size={12} className="text-slate-500 shrink-0" />
            <span className="truncate">{card.contact.phone}</span>
          </div>
        )}
        {card.contact?.email && (
          <div className="flex items-center gap-2">
            <Mail size={12} className="text-slate-500 shrink-0" />
            <span className="truncate">{card.contact.email}</span>
          </div>
        )}
        <div className="flex items-center gap-2 min-w-0">
          <Shield size={12} className="text-slate-500 shrink-0" />
          <span className="truncate font-semibold text-slate-800">{card.plan?.name || 'No Product'}</span>
        </div>

        {/* Expected Premium in Card View */}
        <div className="flex items-center justify-between bg-emerald-50/80 border border-emerald-200/80 rounded-lg px-2.5 py-1 text-xs font-semibold text-emerald-900 mt-1">
          <span className="text-[11px] text-emerald-700 font-medium">Expected Premium</span>
          <span className="font-bold text-emerald-800 text-xs">
            ₹{Number(card.premiumBudget || card.expectedPremium || 0).toLocaleString('en-IN')}
          </span>
        </div>

        {followUp && (
          <div className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200/60 rounded px-2 py-0.5 w-fit font-bold mt-1">
            <Calendar size={10} className="shrink-0 text-amber-600" />
            <span>Follow-up: {followUp}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-0.5 gap-2" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1 text-slate-500 text-[9px] font-semibold truncate">
          <UserCircle2 size={10} className="text-slate-400 shrink-0" />
          <span className="truncate">{assigneeName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => onCall(card.contact?.phone)}
            className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer" title="Call">
            <Phone size={11} />
          </button>
          <button onClick={() => onWhatsApp(card.contact?.phone)}
            className="p-1.5 rounded-lg bg-green-50 border border-green-200 hover:bg-green-100 text-green-600 cursor-pointer" title="WhatsApp">
            <MessageCircle size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Table Component ───────────────────────────────────────────────────────────
function LeadsTable({ data, loading, visibleColumns, sortKey, sortDir, onSort, onRowClick, onEdit, onDelete, onCall, onWhatsApp, onCreate }: {
  data: any[];
  loading: boolean;
  visibleColumns: Record<string, boolean>;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  onSort: (key: string) => void;
  onRowClick: (r: any) => void;
  onEdit: (r: any) => void;
  onDelete: (r: any) => void;
  onCall: (phone?: string) => void;
  onWhatsApp: (phone?: string) => void;
  onCreate?: () => void;
}) {
  const sortableKeys = ['name', 'plan', 'premiumBudget', 'followUpDate', 'stage'];

  const colDefs = [
    {
      key: 'name', label: 'Client Name',
      render: (r: any) => (
        <div>
          <p className="font-semibold text-gray-900 text-[13px]">{r.contact?.firstName} {r.contact?.lastName}</p>
          <p className="text-[11px] text-gray-400">{r.contact?.phone}</p>
        </div>
      ),
    },
    {
      key: 'plan', label: 'Product',
      render: (r: any) => (
        <div>
          <p className="text-[13px] font-medium text-gray-800">{r.plan?.name ?? '—'}</p>
          {r.plan?.category && <p className="text-[11px] text-gray-400">{r.plan.category}</p>}
        </div>
      ),
    },
    {
      key: 'hotness', label: 'Hotness',
      render: (r: any) => {
        const h = deriveHotness(r);
        const conf = HOTNESS_CONFIG[h];
        return (
          <span className={clsx('flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold w-fit', conf.cls)}>
            <HotnessIcon level={h} /> {conf.label}
          </span>
        );
      },
    },
    {
      key: 'employee', label: 'Assigned To',
      render: (r: any) => {
        const name = r.assignedEmployee?.employeeProfile
          ? `${r.assignedEmployee.employeeProfile.firstName} ${r.assignedEmployee.employeeProfile.lastName}`
          : r.assignedEmployee?.name || '—';
        return (
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
              {name !== '—' ? name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : '—'}
            </div>
            <span className="text-[12px] text-gray-700">{name}</span>
          </div>
        );
      },
    },
    {
      key: 'premiumBudget', label: 'Exp. Premium',
      render: (r: any) => r.premiumBudget
        ? <span className="font-semibold text-slate-800">₹{Number(r.premiumBudget).toLocaleString('en-IN')}</span>
        : <span className="text-gray-400">—</span>,
    },
    {
      key: 'followUpDate', label: 'Next Follow-up',
      render: (r: any) => r.followUpDate ? (
        <div className={clsx('flex items-center gap-1 text-[11px] font-semibold',
          new Date(r.followUpDate) < new Date() ? 'text-red-600' : 'text-amber-700')}>
          <Calendar size={11} />
          {format(new Date(r.followUpDate), 'dd/MMM/yyyy')}
        </div>
      ) : <span className="text-gray-400">—</span>,
    },
    {
      key: 'stage', label: 'Stage',
      render: (r: any) => (
        <span className={clsx('inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-semibold border uppercase tracking-wider', BADGE_STYLES[r.stage])}>
          {STAGE_LABELS[r.stage]}
        </span>
      ),
    },
    {
      key: 'actions', label: '',
      render: (r: any) => (
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <button title="Call" className="p-1 rounded hover:bg-gray-100 text-gray-500" onClick={() => onCall(r.contact?.phone)}><Phone size={13} /></button>
          <button title="WhatsApp" className="p-1 rounded hover:bg-green-50 text-green-500" onClick={() => onWhatsApp(r.contact?.phone)}><MessageCircle size={13} /></button>
          <button title="Edit" className="p-1.5 rounded hover:bg-gray-100 text-gray-500" onClick={() => onEdit(r)}><Pencil size={13} /></button>
          <button title="Delete" className="p-1.5 rounded hover:bg-red-50 text-red-400" onClick={() => onDelete(r)}><Trash2 size={13} /></button>
        </div>
      ),
    },
  ];

  const activeCols = colDefs.filter(c => visibleColumns[c.key] !== false);

  return (
    <div className="overflow-hidden bg-white rounded-2xl border border-slate-100 shadow-sm flex-1">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-100/60 border-b border-slate-200/80">
              {activeCols.map(col => (
                <th key={col.key}
                  onClick={() => sortableKeys.includes(col.key) && onSort(col.key)}
                  className={clsx('px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap select-none',
                    sortableKeys.includes(col.key) && 'cursor-pointer hover:text-slate-900')}>
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortableKeys.includes(col.key) && (
                      <span className="text-slate-400">
                        {sortKey === col.key
                          ? sortDir === 'asc' ? <ChevronUp size={11} className="text-blue-500" /> : <ChevronDown size={11} className="text-blue-500" />
                          : <ArrowUpDown size={11} className="opacity-25" />}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/60">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {activeCols.map(col => (
                    <td key={col.key} className="px-5 py-4">
                      <div className="h-3.5 rounded-full animate-pulse bg-gray-100" style={{ width: `${55 + (i * 13 + col.label.length * 7) % 35}%` }} />
                    </td>
                  ))}
                </tr>
              ))
              : data.length === 0
                ? (
                  <tr>
                    <td colSpan={activeCols.length} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <div className="h-12 w-12 rounded-xl bg-gray-50 flex items-center justify-center border border-slate-100">
                          <Shield size={20} className="text-gray-300" />
                        </div>
                        <p className="text-sm font-medium">No leads found</p>
                        <button onClick={() => onCreate?.()} className="btn-primary py-1 px-3 text-xs mt-1">
                          Create Lead
                        </button>
                      </div>
                    </td>
                  </tr>
                )
                : data.map(row => (
                  <tr key={row.id} onClick={() => onRowClick(row)}
                    className="cursor-pointer hover:bg-blue-50/30 transition-colors duration-150">
                    {activeCols.map(col => (
                      <td key={col.key} className="px-5 py-3.5 text-gray-700 align-middle text-[13px] font-medium">
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Lead Detail Popup ─────────────────────────────────────────────────────────
function LeadDetailPopup({ lead, tab, onTabChange, employees, isOwner, onEdit }: {
  lead: any;
  tab: 'overview' | 'comments' | 'stage';
  onTabChange: (t: 'overview' | 'comments' | 'stage') => void;
  employees: any[];
  isOwner: boolean;
  onEdit: () => void;
}) {
  const qc = useQueryClient();
  const moveStage = useMoveLeadStage();
  const [commentText, setCommentText] = useState('');
  const [followUpEdit, setFollowUpEdit] = useState(lead.followUpDate ? lead.followUpDate.slice(0, 10) : '');
  const [assigneeEdit, setAssigneeEdit] = useState(lead.assignedEmployeeId ?? '');
  const [savingFollowup, setSavingFollowup] = useState(false);

  const { data: fullLeadData, refetch } = useQuery({
    queryKey: ['lead-detail-popup', lead.id],
    queryFn: () => leadsService.get(lead.id),
    staleTime: 0,
  });
  const fullLead = fullLeadData?.data ?? lead;
  const consultations: any[] = fullLead.consultations ?? [];

  const addConsultationMutation = useMutation({
    mutationFn: (notes: string) => leadsService.addConsultation(lead.id, { notes }),
    onSuccess: () => {
      setCommentText('');
      refetch();
      qc.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Comment added');
    },
    onError: () => toast.error('Failed to add comment'),
  });

  const updateAssigneeMutation = useMutation({
    mutationFn: (empId: string | null) => leadsService.updateAssignee(lead.id, empId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Assignee updated');
    },
    onError: () => toast.error('Failed to update assignee'),
  });

  const handleStageChange = async (newStage: string) => {
    await moveStage.mutateAsync({ id: lead.id, stage: newStage });
    toast.success('Stage updated');
    qc.invalidateQueries();
  };

  const handleFollowUpSave = async () => {
    setSavingFollowup(true);
    try {
      await leadsService.update(lead.id, { followUpDate: followUpEdit || null });
      qc.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Follow-up date updated');
    } catch {
      toast.error('Failed to update follow-up date');
    } finally {
      setSavingFollowup(false);
    }
  };

  const c = fullLead.contact;
  const hotness = deriveHotness(fullLead);
  const hotnessConf = HOTNESS_CONFIG[hotness];
  const assigneeName = fullLead.assignedEmployee?.employeeProfile
    ? `${fullLead.assignedEmployee.employeeProfile.firstName} ${fullLead.assignedEmployee.employeeProfile.lastName}`
    : fullLead.assignedEmployee?.name || 'Unassigned';

  const tabs: { id: 'overview' | 'comments' | 'stage'; label: string }[] = [
    { id: 'overview',  label: 'Overview' },
    { id: 'comments',  label: `Comments (${consultations.length})` },
    { id: 'stage',     label: 'Stage & Actions' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-xl p-4 border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-bold">
            {c?.firstName?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">{c?.firstName} {c?.lastName}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={clsx('text-[9px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider', BADGE_STYLES[fullLead.stage] ?? 'bg-gray-100 text-gray-700 border-gray-200')}>
                {STAGE_LABELS[fullLead.stage] ?? fullLead.stage}
              </span>
              <span className={clsx('flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded border font-bold', hotnessConf.cls)}>
                <HotnessIcon level={hotness} /> {hotnessConf.label}
              </span>
              {fullLead.plan && <span className="text-[10px] text-slate-500">• {fullLead.plan.name}</span>}
            </div>
          </div>
        </div>
        <button onClick={onEdit} className="btn-secondary text-xs flex items-center gap-1">
          <Pencil size={12} /> Edit
        </button>
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.id} onClick={() => onTabChange(t.id)}
            className={clsx('px-4 py-2 text-xs font-semibold border-b-2 transition-colors',
              tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-slate-100 rounded-xl p-3 space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Contact</p>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Phone size={13} className="text-slate-400" />
                <span>{c?.phone || '—'}</span>
              </div>
              {c?.email && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Mail size={13} className="text-slate-400" />
                  <span className="truncate">{c.email}</span>
                </div>
              )}
            </div>
            <div className="bg-white border border-slate-100 rounded-xl p-3 space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Lead Info</p>
              {fullLead.premiumBudget && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Expected Premium</span>
                  <span className="font-semibold text-slate-800">₹{Number(fullLead.premiumBudget).toLocaleString('en-IN')}</span>
                </div>
              )}
              {fullLead.sumAssuredRequired && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Sum Assured</span>
                  <span className="font-semibold">₹{Number(fullLead.sumAssuredRequired).toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Assigned To</span>
                <span className="font-medium text-slate-700">{assigneeName}</span>
              </div>
            </div>
          </div>

          {/* Follow-up date editor */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
              <Calendar size={11} /> Next Follow-up Date
            </p>
            <div className="flex items-center gap-2">
              <input type="date" value={followUpEdit} onChange={e => setFollowUpEdit(e.target.value)}
                className="input text-xs flex-1 border-amber-200 bg-white" />
              <button onClick={handleFollowUpSave} disabled={savingFollowup}
                className="btn-primary text-xs px-3 py-1.5 h-auto flex items-center gap-1">
                {savingFollowup ? <RefreshCw size={11} className="animate-spin" /> : 'Update'}
              </button>
            </div>
          </div>

          {/* Reassign (owner only) */}
          {isOwner && (
            <div className="bg-white border border-slate-100 rounded-xl p-3 space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <UserCircle2 size={11} /> Assigned Employee
              </p>
              <div className="flex items-center gap-2">
                <select value={assigneeEdit} onChange={e => setAssigneeEdit(e.target.value)} className="input text-xs flex-1">
                  <option value="">Unassigned</option>
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.userId}>{emp.firstName} {emp.lastName}</option>
                  ))}
                </select>
                <button onClick={() => updateAssigneeMutation.mutate(assigneeEdit || null)}
                  disabled={updateAssigneeMutation.isPending}
                  className="btn-secondary text-xs px-3 py-1.5 h-auto flex items-center gap-1">
                  {updateAssigneeMutation.isPending ? <RefreshCw size={11} className="animate-spin" /> : 'Reassign'}
                </button>
              </div>
            </div>
          )}

          {fullLead.notes && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Notes</p>
              <div className="text-sm bg-gray-50 border border-gray-200 rounded-xl p-3 text-gray-700">{fullLead.notes}</div>
            </div>
          )}
        </div>
      )}

      {/* Comments */}
      {tab === 'comments' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Add a communication note or follow-up remark... (Ctrl+Enter to send)"
              className="input text-xs flex-1 resize-none"
              rows={2}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && commentText.trim()) {
                  addConsultationMutation.mutate(commentText.trim());
                }
              }}
            />
            <button
              onClick={() => commentText.trim() && addConsultationMutation.mutate(commentText.trim())}
              disabled={!commentText.trim() || addConsultationMutation.isPending}
              className="btn-primary px-3 self-end h-8 text-xs flex items-center gap-1"
            >
              {addConsultationMutation.isPending ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
            {consultations.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <MessageCircle size={24} className="mx-auto mb-2 opacity-40" />
                <p className="text-xs">No comments yet. Add one above.</p>
              </div>
            ) : (
              [...consultations].reverse().map((c: any) => (
                <div key={c.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <p className="text-[13px] text-gray-800">{c.notes}</p>
                  {c.scheduledAt && (
                    <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                      <Calendar size={10} /> Scheduled: {format(new Date(c.scheduledAt), 'dd/MMM/yyyy')}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">
                    {c.createdAt ? format(new Date(c.createdAt), 'dd MMM yyyy, hh:mm a') : ''}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Stage */}
      {tab === 'stage' && (
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Move to Stage</p>
            <div className="flex flex-wrap gap-2">
              {UI_STAGES.map(s => {
                const backendStage = STAGE_MAPPINGS[s];
                const isCurrent = BACKEND_TO_UI[fullLead.stage] === s;
                return (
                  <button key={s}
                    onClick={() => !isCurrent && backendStage && handleStageChange(backendStage)}
                    disabled={isCurrent || moveStage.isPending}
                    className={clsx('flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer border',
                      isCurrent ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100 hover:text-gray-700')}>
                    {isCurrent && <ChevronRight size={10} />}
                    {s}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-400 mt-2">Click any stage to move this lead there.</p>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Mark as Lost</p>
            <button
              onClick={() => handleStageChange('LOST')}
              disabled={fullLead.stage === 'LOST' || moveStage.isPending}
              className="text-xs px-3 py-1.5 rounded-full font-medium border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Mark as Lost
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Utility export ─────────────────────────────────────────────────────────────
export function cleanLeadPayload(body: any) {
  const payload: any = { ...body };
  if (payload.sumAssuredRequired === '' || payload.sumAssuredRequired == null) {
    delete payload.sumAssuredRequired;
  } else {
    payload.sumAssuredRequired = Number(payload.sumAssuredRequired);
  }
  if (payload.premiumBudget === '' || payload.premiumBudget == null) {
    delete payload.premiumBudget;
  } else {
    payload.premiumBudget = Number(payload.premiumBudget);
  }
  if (payload.followUpDate === '') {
    payload.followUpDate = null;
  } else if (payload.followUpDate) {
    payload.followUpDate = new Date(payload.followUpDate).toISOString();
  }
  return payload;
}
