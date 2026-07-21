import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, X, User, Shield, Pencil, Trash2, Upload, Filter, Search, Info, Save, ChevronDown, Settings } from 'lucide-react';
import { usePolicies, useCreatePolicy, useUpdatePolicy, useDeletePolicy, useBulkAssignPolicies } from '@hooks/usePolicies';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { contactsService, policiesService, employeesService, claimsService, documentsService } from '@api/index';
import { deletionRequestsService } from '@api/deletionRequestsService';
import DataTable, { Column } from '@comps/common/DataTable';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuthStore } from '@store/auth.store';
import clsx from 'clsx';


interface Policy {
  id: string; policyNumber: string; status: string;
  premiumAmount: number; sumAssured?: number; startDate?: string; endDate: string;
  paymentFrequency?: string; agentCode?: string; notes?: string;
  nextDueDate?: string; maturityDate?: string;
  contact?: { firstName: string; lastName: string; phone?: string };
  plan?: { name: string; category: string; company?: { name: string } };
  assignedEmployee?: { employeeProfile?: { firstName: string; lastName: string } };
  assignedEmployeeId?: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'badge-green',
  EXPIRED: 'badge-gray',
  LAPSED: 'badge-red',
  CANCELLED: 'badge-red',
  PENDING: 'badge-yellow',
};

const schema = z.object({
  contactId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Select a contact'),
  planId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Select a plan'),
  policyNumber: z.string().min(1, 'Policy number required'),
  sumAssured: z.coerce.number().positive('Enter a valid sum assured'),
  premiumAmount: z.coerce.number().positive('Enter a valid premium'),
  startDate: z.string().min(1, 'Start date required'),
  endDate: z.string().min(1, 'End date required'),
  paymentFrequency: z.enum(['YEARLY', 'HALF_YEARLY', 'QUARTERLY', 'MONTHLY', 'SINGLE']),
  riders: z.array(z.string()).optional(),
  deductible: z.string().optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'LAPSED', 'CANCELLED', 'SURRENDERED']).optional(),
  assignedEmployeeId: z.string().optional(),
  firstPremiumDate: z.string().optional(),
  premiumPaymentPeriod: z.coerce.number().optional(),
  lastPremiumDate: z.string().optional(),
  emiCase: z.boolean().optional(),
  emiGateway: z.string().optional(),
  emiDate: z.string().optional(),
  emiPremium: z.coerce.number().optional(),
  phcRequired: z.boolean().optional(),
  phcAmount: z.coerce.number().optional(),
  phcStatus: z.string().optional(),
  phcClaimSettled: z.boolean().optional(),
});
type Form = z.infer<typeof schema>;

function parseExtraNotes(notesText?: string | null) {
  const res = {
    deductible: '',
    riders: [] as string[],
    firstPremiumDate: '',
    premiumPaymentPeriod: undefined as number | undefined,
    lastPremiumDate: '',
    emiCase: false,
    emiGateway: '',
    emiDate: '',
    emiPremium: undefined as number | undefined,
    phcRequired: false,
    phcAmount: undefined as number | undefined,
    phcStatus: '',
    phcClaimSettled: false,
    cleanNotes: '',
  };
  if (!notesText) return res;

  const lines = notesText.split('\n');
  const cleanLines: string[] = [];

  lines.forEach(line => {
    if (line.startsWith('Deductible: ')) {
      res.deductible = line.replace('Deductible: ', '').trim();
    } else if (line.startsWith('Riders/Addons: ')) {
      res.riders = line.replace('Riders/Addons: ', '').split(',').map(s => s.trim());
    } else if (line.startsWith('First Premium Date: ')) {
      res.firstPremiumDate = line.replace('First Premium Date: ', '').trim();
    } else if (line.startsWith('Premium Payment Period: ')) {
      res.premiumPaymentPeriod = Number(line.replace('Premium Payment Period: ', '').replace(' Years', '').trim()) || undefined;
    } else if (line.startsWith('Last Premium Date: ')) {
      res.lastPremiumDate = line.replace('Last Premium Date: ', '').trim();
    } else if (line.startsWith('EMI Case: ')) {
      res.emiCase = true;
      const gatewayMatch = line.match(/Gateway:\s*([^,)]+)/);
      const dateMatch = line.match(/Date:\s*([^,)]+)/);
      const premiumMatch = line.match(/Premium:\s*₹([0-9.]+)/);
      if (gatewayMatch) res.emiGateway = gatewayMatch[1].trim();
      if (dateMatch) res.emiDate = dateMatch[1].trim();
      if (premiumMatch) res.emiPremium = Number(premiumMatch[1]) || undefined;
    } else if (line.startsWith('Preventive Health Checkup: ')) {
      res.phcRequired = true;
      const amountMatch = line.match(/Amount:\s*₹([0-9.]+)/);
      const statusMatch = line.match(/Status:\s*([^,)]+)/);
      const settledMatch = line.match(/Claim Settled:\s*([^,)]+)/);
      if (amountMatch) res.phcAmount = Number(amountMatch[1]) || undefined;
      if (statusMatch) res.phcStatus = statusMatch[1].trim();
      if (settledMatch) res.phcClaimSettled = settledMatch[1].trim().toLowerCase() === 'yes';
    } else {
      cleanLines.push(line);
    }
  });

  res.cleanNotes = cleanLines.join('\n').trim();
  return res;
}

const editSchema = z.object({
  status: z.enum(['ACTIVE', 'EXPIRED', 'LAPSED', 'CANCELLED', 'SURRENDERED']),
  premiumAmount: z.coerce.number().positive('Enter a valid premium'),
  sumAssured: z.coerce.number().positive().optional(),
  endDate: z.string().min(1, 'End date required'),
  nextDueDate: z.string().optional(),
  maturityDate: z.string().optional(),
  paymentFrequency: z.enum(['YEARLY', 'HALF_YEARLY', 'QUARTERLY', 'MONTHLY', 'SINGLE']),
  agentCode: z.string().optional(),
  notes: z.string().optional(),
  riders: z.array(z.string()).optional(),
  deductible: z.string().optional(),
  assignedEmployeeId: z.string().optional(),
  firstPremiumDate: z.string().optional(),
  premiumPaymentPeriod: z.coerce.number().optional(),
  lastPremiumDate: z.string().optional(),
  emiCase: z.boolean().optional(),
  emiGateway: z.string().optional(),
  emiDate: z.string().optional(),
  emiPremium: z.coerce.number().optional(),
  phcRequired: z.boolean().optional(),
  phcAmount: z.coerce.number().optional(),
  phcStatus: z.string().optional(),
  phcClaimSettled: z.boolean().optional(),
});
type EditForm = z.infer<typeof editSchema>;

export default function Policies() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Policy | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Policy | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search & Filter States
  const [search, setSearch] = useState('');
  const [selectedQuickFilter, setSelectedQuickFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('');
  const [filterProducts, setFilterProducts] = useState<string[]>([]);
  const [filterCompanies, setFilterCompanies] = useState<string[]>([]);
  const [sumInsuredMin, setSumInsuredMin] = useState('');
  const [sumInsuredMax, setSumInsuredMax] = useState('');
  const [durationFrom, setDurationFrom] = useState('');
  const [durationTo, setDurationTo] = useState('');
  const [renewalFrom, setRenewalFrom] = useState('');
  const [renewalTo, setRenewalTo] = useState('');
  const [paymentDueFrom, setPaymentDueFrom] = useState('');
  const [paymentDueTo, setPaymentDueTo] = useState('');

  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const productFilterRef = useRef<HTMLDivElement>(null);
  const companyFilterRef = useRef<HTMLDivElement>(null);

  // Sorting
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Column Visibility Selection
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    'contact.firstName': true,
    policyNumber: true,
    premiumAmount: true,
    endDate: true,
    'plan.category': true,
    'plan.company.name': true,
    renewStatus: true,
    renewAssign: true,
    claimStatus: true,
    claimAssign: true,
  });
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);

  // Bulk assignment state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assignTarget, setAssignTarget] = useState('');
  const bulkAssignMutation = useBulkAssignPolicies();

  const { data: employeeResults } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => employeesService.list({ limit: 100 }),
    enabled: !!user,
  });

  const handleBulkAssign = async () => {
    if (!assignTarget) return;
    const assignedEmployeeId = assignTarget === 'unassigned' ? null : assignTarget;
    try {
      await bulkAssignMutation.mutateAsync({
        ids: selectedIds,
        assignedEmployeeId,
      });
      setSelectedIds([]);
      setAssignTarget('');
    } catch (e) {
      console.error('[Bulk assign failed]', e);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'add') {
      reset();
      setSelectedContact(null);
      setContactSearch('');
      setSelectedPlan(null);
      setModalOpen(true);
      navigate('/policies', { replace: true });
    }
  }, [location.search]);

  // Click outside handlers for filters
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (productFilterRef.current && !productFilterRef.current.contains(e.target as Node)) {
        setProductDropdownOpen(false);
      }
      if (companyFilterRef.current && !companyFilterRef.current.contains(e.target as Node)) {
        setCompanyDropdownOpen(false);
      }
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setColPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const toastId = toast.loading('Importing policies...');
    try {
      const res = await policiesService.importCsv(file);
      toast.success(res.message || `Successfully imported policies!`, { id: toastId });
      qc.invalidateQueries({ queryKey: ['policies'] });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to import policies', { id: toastId });
    }
  };

  // Contact picker state
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<{ id: string; firstName: string; lastName: string; phone: string } | null>(null);
  const [contactDropdown, setContactDropdown] = useState(false);

  // Plan picker cascade states
  const [selectedType, setSelectedType] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  const { data: contactResults } = useQuery({
    queryKey: ['contact-search', contactSearch],
    queryFn: () => contactsService.list({ search: contactSearch || undefined, limit: 8 }),
    enabled: contactDropdown,
  }) as any;

  const { data: allPlansRes } = useQuery({
    queryKey: ['all-plans-list-picker'],
    queryFn: () => policiesService.plans(),
  });
  const plansList = allPlansRes?.data ?? [];

  const availableTypes = useMemo(() => {
    return Array.from(new Set(plansList.map((p: any) => p.category))).filter(Boolean) as string[];
  }, [plansList]);

  const availableCompanies = useMemo(() => {
    if (!selectedType) return [];
    return Array.from(
      new Set(
        plansList
          .filter((p: any) => p.category === selectedType)
          .map((p: any) => p.company?.name)
          .filter(Boolean)
      )
    ) as string[];
  }, [plansList, selectedType]);

  const availablePlans = useMemo(() => {
    if (!selectedType || !selectedCompany) return [];
    return plansList.filter(
      (p: any) => p.category === selectedType && p.company?.name === selectedCompany
    );
  }, [plansList, selectedType, selectedCompany]);

  // Derived filter options
  const filterPlansOptions = useMemo(() => {
    return plansList;
  }, [plansList]);

  const filterCompaniesOptions = useMemo(() => {
    return Array.from(new Set(plansList.map((p: any) => p.company?.name))).filter(Boolean) as string[];
  }, [plansList]);

  const { data: claimsResults } = useQuery({
    queryKey: ['claims', 'all-for-policies-list'],
    queryFn: () => claimsService.list({ limit: 1000 }),
  });
  const allClaims = claimsResults?.data ?? [];

  // Fetch policies: get all in 1 query for client-side filtering (0 ops)
  const { data, isLoading } = usePolicies({ limit: 2000 });

  // Client-side Filter Logic
  const filteredPolicies = useMemo(() => {
    let list = data?.data ?? [];

    // Quick Select filters: Health / Life / Accident / Other
    if (selectedQuickFilter !== 'ALL') {
      list = list.filter((p: any) => p.plan?.category === selectedQuickFilter);
    }

    // Local Search: Name, Mobile, Policy No
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter((p: any) => {
        const clientName = `${p.contact?.firstName || ''} ${p.contact?.lastName || ''}`.toLowerCase();
        const clientPhone = (p.contact?.phone || '').toLowerCase();
        const policyNo = (p.policyNumber || '').toLowerCase();
        return clientName.includes(term) || clientPhone.includes(term) || policyNo.includes(term);
      });
    }

    // Status Filter
    if (statusFilter) {
      list = list.filter((p: any) => p.status === statusFilter);
    }

    // Sum Insured filter
    if (sumInsuredMin) {
      list = list.filter((p: any) => (p.sumAssured ?? 0) >= Number(sumInsuredMin));
    }
    if (sumInsuredMax) {
      list = list.filter((p: any) => (p.sumAssured ?? 0) <= Number(sumInsuredMax));
    }

    // Product multiple selection
    if (filterProducts.length > 0) {
      list = list.filter((p: any) => filterProducts.includes(p.plan?.id || p.planId));
    }

    // Company multiple selection
    if (filterCompanies.length > 0) {
      list = list.filter((p: any) => filterCompanies.includes(p.plan?.company?.name));
    }

    // Policy Duration Date Range
    if (durationFrom) {
      list = list.filter((p: any) => p.startDate && new Date(p.startDate) >= new Date(durationFrom));
    }
    if (durationTo) {
      list = list.filter((p: any) => p.endDate && new Date(p.endDate) <= new Date(durationTo));
    }

    // Renewal Due Date Range
    if (renewalFrom) {
      list = list.filter((p: any) => p.endDate && new Date(p.endDate) >= new Date(renewalFrom));
    }
    if (renewalTo) {
      list = list.filter((p: any) => p.endDate && new Date(p.endDate) <= new Date(renewalTo));
    }

    // Payment Due Date Range
    if (paymentDueFrom) {
      list = list.filter((p: any) => p.nextDueDate && new Date(p.nextDueDate) >= new Date(paymentDueFrom));
    }
    if (paymentDueTo) {
      list = list.filter((p: any) => p.nextDueDate && new Date(p.nextDueDate) <= new Date(paymentDueTo));
    }

    return list;
  }, [data, selectedQuickFilter, search, statusFilter, sumInsuredMin, sumInsuredMax, filterProducts, filterCompanies, durationFrom, durationTo, renewalFrom, renewalTo, paymentDueFrom, paymentDueTo]);

  // Client-side Sorting Logic
  const sortedPolicies = useMemo(() => {
    const list = [...filteredPolicies];
    if (sortBy) {
      list.sort((a: any, b: any) => {
        let av: any = '';
        let bv: any = '';
        if (sortBy === 'contact.firstName') {
          av = `${a.contact?.firstName ?? ''} ${a.contact?.lastName ?? ''}`.toLowerCase();
          bv = `${b.contact?.firstName ?? ''} ${b.contact?.lastName ?? ''}`.toLowerCase();
        } else if (sortBy === 'plan.name') {
          av = (a.plan?.name ?? '').toLowerCase();
          bv = (b.plan?.name ?? '').toLowerCase();
        } else if (sortBy === 'plan.company.name') {
          av = (a.plan?.company?.name ?? '').toLowerCase();
          bv = (b.plan?.company?.name ?? '').toLowerCase();
        } else if (sortBy === 'plan.category') {
          av = (a.plan?.category ?? '').toLowerCase();
          bv = (b.plan?.category ?? '').toLowerCase();
        } else if (sortBy === 'renewAssign') {
          av = `${a.assignedEmployee?.employeeProfile?.firstName ?? ''} ${a.assignedEmployee?.employeeProfile?.lastName ?? ''}`.toLowerCase();
          bv = `${b.assignedEmployee?.employeeProfile?.firstName ?? ''} ${b.assignedEmployee?.employeeProfile?.lastName ?? ''}`.toLowerCase();
        } else {
          av = a[sortBy];
          bv = b[sortBy];
        }

        if (av === undefined || av === null) return 1;
        if (bv === undefined || bv === null) return -1;

        if (typeof av === 'string') {
          return sortOrder === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        }
        return sortOrder === 'asc' ? av - bv : bv - av;
      });
    }
    return list;
  }, [filteredPolicies, sortBy, sortOrder]);

  // Client-side Pagination
  const paginatedPolicies = useMemo(() => {
    const start = (page - 1) * 20;
    return sortedPolicies.slice(start, start + 20);
  }, [sortedPolicies, page]);

  const createPolicy = useCreatePolicy();
  const updatePolicy = useUpdatePolicy();
  const deletePolicy = useDeletePolicy();
  const { register, handleSubmit, reset, setValue, watch } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { paymentFrequency: 'YEARLY' },
  });
  const { register: regEdit, handleSubmit: handleEdit, reset: resetEdit, setValue: setEditValue, watch: watchEdit } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  });
  const watchEditEmiCase = watchEdit('emiCase');
  const watchEditPhcRequired = watchEdit('phcRequired');

  const watchStartDate = watch('startDate');
  const watchEmiCase = watch('emiCase');
  const watchPhcRequired = watch('phcRequired');
  const [durationYears, setDurationYears] = useState<number>(1);
  const [policyFile, setPolicyFile] = useState<File | null>(null);

  useEffect(() => {
    if (watchStartDate) {
      const start = new Date(watchStartDate);
      if (!isNaN(start.getTime())) {
        const end = new Date(start);
        end.setFullYear(start.getFullYear() + durationYears);
        setValue('endDate', end.toISOString().split('T')[0]);
      }
    }
  }, [watchStartDate, durationYears, setValue]);

  const closeModal = () => {
    setModalOpen(false);
    reset();
    setSelectedContact(null);
    setContactSearch('');
    setSelectedType('');
    setSelectedCompany('');
    setSelectedPlan(null);
    setPolicyFile(null);
  };

  const openEdit = (p: Policy) => {
    setEditTarget(p);
    const extra = parseExtraNotes(p.notes);

    setEditValue('status', p.status as any);
    setEditValue('premiumAmount', p.premiumAmount);
    setEditValue('sumAssured', p.sumAssured as any);
    setEditValue('endDate', p.endDate ? p.endDate.slice(0, 10) : '');
    setEditValue('nextDueDate', p.nextDueDate ? p.nextDueDate.slice(0, 10) : '');
    setEditValue('maturityDate', p.maturityDate ? p.maturityDate.slice(0, 10) : '');
    setEditValue('paymentFrequency', p.paymentFrequency as any ?? 'YEARLY');
    setEditValue('agentCode', p.agentCode ?? '');
    setEditValue('notes', extra.cleanNotes);

    // Set parsed extra fields
    setEditValue('deductible', extra.deductible);
    setEditValue('riders', extra.riders);
    setEditValue('firstPremiumDate', extra.firstPremiumDate);
    setEditValue('premiumPaymentPeriod', extra.premiumPaymentPeriod);
    setEditValue('lastPremiumDate', extra.lastPremiumDate);
    setEditValue('emiCase', extra.emiCase);
    setEditValue('emiGateway', extra.emiGateway);
    setEditValue('emiDate', extra.emiDate);
    setEditValue('emiPremium', extra.emiPremium);
    setEditValue('phcRequired', extra.phcRequired);
    setEditValue('phcAmount', extra.phcAmount);
    setEditValue('phcStatus', extra.phcStatus);
    setEditValue('phcClaimSettled', extra.phcClaimSettled);
    setEditValue('assignedEmployeeId', p.assignedEmployeeId ?? '');
  };

  const COLS: Column<Policy>[] = useMemo(() => {
    const cols: Column<Policy>[] = [];

    // Prepend checkbox selection column for OWNER
    if (user?.role === 'OWNER') {
      cols.push({
        key: 'select',
        label: (
          <input
            type="checkbox"
            checked={data?.data?.length > 0 && selectedIds.length === data.data.length}
            onChange={e => {
              if (e.target.checked) {
                setSelectedIds(data?.data?.map((p: any) => p.id) ?? []);
              } else {
                setSelectedIds([]);
              }
            }}
            onClick={e => e.stopPropagation()}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
          />
        ) as any,
        render: r => (
          <input
            type="checkbox"
            checked={selectedIds.includes(r.id)}
            onChange={e => {
              e.stopPropagation();
              if (e.target.checked) {
                setSelectedIds(prev => [...prev, r.id]);
              } else {
                setSelectedIds(prev => prev.filter(id => id !== r.id));
              }
            }}
            onClick={e => e.stopPropagation()}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
          />
        ),
      });
    }

    const colConfigs: { key: string; label: string; sortable?: boolean; render?: (r: Policy) => React.ReactNode }[] = [
      {
        key: 'contact.firstName',
        label: 'Client Name',
        sortable: true,
        render: r => (
          <div className="flex flex-col">
            <span className="font-bold text-gray-900">{r.contact ? `${r.contact.firstName} ${r.contact.lastName}` : '—'}</span>
            <span className="text-xs text-gray-500">{r.contact?.phone}</span>
          </div>
        )
      },
      { key: 'policyNumber', label: 'Policy No', sortable: true },
      { key: 'plan.category', label: 'Type', sortable: true, render: r => r.plan?.category ? r.plan.category : '—' },
      { key: 'plan.company.name', label: 'Company', sortable: true, render: r => r.plan?.company ? r.plan.company.name : '—' },
      { key: 'plan.name', label: 'Plan', sortable: true, render: r => r.plan?.name ? r.plan.name : '—' },
      { key: 'premiumAmount', label: 'Premium', sortable: true, render: r => `₹${Number(r.premiumAmount).toLocaleString('en-IN')}` },
      { key: 'sumAssured', label: 'Sum Insured', sortable: true, render: r => r.sumAssured ? `₹${Number(r.sumAssured).toLocaleString('en-IN')}` : '—' },
      {
        key: 'renewStatus',
        label: 'Renew Status',
        render: r => {
          if (!r.endDate) return '—';
          if (r.status === 'LAPSED' || r.status === 'EXPIRED') return <span className="font-semibold text-red-600">Expired</span>;
          const diff = (new Date(r.endDate).getTime() - Date.now()) / 86400000;
          if (diff < 0) return <span className="font-semibold text-red-600">Expired</span>;
          if (diff <= 30) return <span className="font-semibold text-amber-600">Due Soon</span>;
          return <span className="font-semibold text-green-600">OK</span>;
        }
      },
      {
        key: 'renewAssign',
        label: 'Renew Assign',
        render: r => r.assignedEmployee?.employeeProfile ? `${r.assignedEmployee.employeeProfile.firstName} ${r.assignedEmployee.employeeProfile.lastName}` : '—'
      },
      {
        key: 'claimStatus',
        label: 'Claim Status',
        render: r => {
          const pClaims = allClaims.filter((c: any) => c.policyId === r.id);
          const pendingClaim = pClaims.find((c: any) =>
            ['PENDING', 'IN_REVIEW', 'INTIMATED', 'FILED'].includes(c.status)
          );
          if (pendingClaim) return <span className="font-semibold text-red-600">Pending</span>;
          const settledClaim = pClaims.find((c: any) => ['SETTLED', 'APPROVED'].includes(c.status));
          if (settledClaim) return <span className="font-semibold text-green-600">Settled</span>;
          return <span className="text-gray-400">No Claims</span>;
        }
      },
      {
        key: 'claimAssign',
        label: 'Claim Assign',
        render: r => {
          const pClaims = allClaims.filter((c: any) => c.policyId === r.id);
          const pendingClaim = pClaims.find((c: any) =>
            ['PENDING', 'IN_REVIEW', 'INTIMATED', 'FILED'].includes(c.status)
          );
          return pendingClaim?.assignedEmployee?.name || '—';
        }
      }
    ];

    colConfigs.forEach(col => {
      if (visibleColumns[col.key] !== false) {
        cols.push(col as any);
      }
    });

    // Append action column
    cols.push({
      key: 'actions' as any, label: '',
      render: r => (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button title="Edit" className="p-1.5 rounded hover:bg-gray-100 text-gray-500" onClick={() => openEdit(r)}><Pencil size={14} /></button>
          <button title="Delete" className="p-1.5 rounded hover:bg-red-50 text-red-400" onClick={() => setDeleteTarget(r)}><Trash2 size={14} /></button>
        </div>
      ),
    });

    return cols;
  }, [user?.role, data, selectedIds, allClaims, visibleColumns]);

  const submitEdit = async (body: EditForm) => {
    if (!editTarget) return;
    const assignedEmployeeId = body.assignedEmployeeId?.trim() ? body.assignedEmployeeId : undefined;

    // Format notes to include extra Excel fields
    let extraNotes = body.notes ? body.notes.trim() : '';
    if (body.deductible) extraNotes += `\nDeductible: ${body.deductible}`;
    if (body.riders && body.riders.length > 0) extraNotes += `\nRiders/Addons: ${body.riders.join(', ')}`;
    if (body.firstPremiumDate) extraNotes += `\nFirst Premium Date: ${body.firstPremiumDate}`;
    if (body.premiumPaymentPeriod) extraNotes += `\nPremium Payment Period: ${body.premiumPaymentPeriod} Years`;
    if (body.lastPremiumDate) extraNotes += `\nLast Premium Date: ${body.lastPremiumDate}`;
    if (body.emiCase) {
      extraNotes += `\nEMI Case: Yes (Gateway: ${body.emiGateway || 'N/A'}, Date: ${body.emiDate || 'N/A'}, Premium: ₹${body.emiPremium || '0'})`;
    }
    if (body.phcRequired) {
      extraNotes += `\nPreventive Health Checkup: Yes (Amount: ₹${body.phcAmount || '0'}, Status: ${body.phcStatus || 'N/A'}, Claim Settled: ${body.phcClaimSettled ? 'Yes' : 'No'})`;
    }

    const cleanedBody = {
      status: body.status,
      premiumAmount: Number(body.premiumAmount),
      sumAssured: body.sumAssured ? Number(body.sumAssured) : undefined,
      endDate: body.endDate,
      nextDueDate: body.nextDueDate || undefined,
      maturityDate: body.maturityDate || undefined,
      paymentFrequency: body.paymentFrequency,
      agentCode: body.agentCode || undefined,
      assignedEmployeeId,
      notes: extraNotes.trim(),
    };

    try {
      await updatePolicy.mutateAsync({ id: editTarget.id, body: cleanedBody });
      setEditTarget(null);
    } catch (e) {
      // error already shown by useUpdatePolicy onError
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const isAdmin = user?.role === 'SUPERADMIN' || user?.role === 'OWNER';
    if (isAdmin) {
      await deletePolicy.mutateAsync(deleteTarget.id);
    } else {
      const toastId = toast.loading('Submitting delete request to admin...');
      try {
        await deletionRequestsService.requestDeletion('Policy', deleteTarget.id, `Employee requested deletion of policy ${deleteTarget.policyNumber}`);
        toast.success('Deletion request submitted to admin successfully!', { id: toastId });
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Failed to submit request', { id: toastId });
      }
    }
    setDeleteTarget(null);
  };

  const onSubmit = async (body: Form) => {
    try {
      // 1. Clean assignedEmployeeId
      const assignedEmployeeId = body.assignedEmployeeId?.trim() ? body.assignedEmployeeId : undefined;

      // 2. Format notes to include extra Excel fields
      let extraNotes = '';
      if (body.deductible) extraNotes += `\nDeductible: ${body.deductible}`;
      if (body.riders && body.riders.length > 0) extraNotes += `\nRiders/Addons: ${body.riders.join(', ')}`;
      if (body.firstPremiumDate) extraNotes += `\nFirst Premium Date: ${body.firstPremiumDate}`;
      if (body.premiumPaymentPeriod) extraNotes += `\nPremium Payment Period: ${body.premiumPaymentPeriod} Years`;
      if (body.lastPremiumDate) extraNotes += `\nLast Premium Date: ${body.lastPremiumDate}`;
      if (body.emiCase) {
        extraNotes += `\nEMI Case: Yes (Gateway: ${body.emiGateway || 'N/A'}, Date: ${body.emiDate || 'N/A'}, Premium: ₹${body.emiPremium || '0'})`;
      }
      if (body.phcRequired) {
        extraNotes += `\nPreventive Health Checkup: Yes (Amount: ₹${body.phcAmount || '0'}, Status: ${body.phcStatus || 'N/A'}, Claim Settled: ${body.phcClaimSettled ? 'Yes' : 'No'})`;
      }

      // 3. Assemble clean DTO
      const cleanedBody = {
        policyNumber: body.policyNumber,
        contactId: body.contactId,
        planId: body.planId,
        assignedEmployeeId,
        status: body.status || 'ACTIVE',
        sumAssured: Number(body.sumAssured),
        premiumAmount: Number(body.premiumAmount),
        paymentFrequency: body.paymentFrequency,
        startDate: body.startDate,
        endDate: body.endDate,
        notes: extraNotes.trim(),
      };

      const res = await createPolicy.mutateAsync(cleanedBody as any);
      const createdPolicy = res?.data ?? res;
      if (policyFile && createdPolicy?.id) {
        try {
          await documentsService.upload(policyFile, { policyId: createdPolicy.id, tag: 'POLICY' });
        } catch (uploadErr) {
          console.error('[Document Upload Error]', uploadErr);
        }
      }
      closeModal();
    } catch (e: any) {
      const errs: string[] = e?.response?.data?.errors ?? [];
      const msg = errs.length ? errs.join(' | ') : (e?.response?.data?.message ?? 'Error creating policy');
      console.error('[Policy create]', e?.response?.data);
      // toast is already shown by useCreatePolicy onError — show detail if different
      if (errs.length) {
        import('react-hot-toast').then(({ default: toast }) => toast.error(msg, { duration: 6000 }));
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Actions Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-2">
        <div className="flex flex-wrap items-center gap-3 w-full justify-end">
            {/* Local Search input */}
            <div className="relative w-60">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search policy#, client name, phone..."
                className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/50 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-slate-800"
              />
            </div>

            {/* Column Visibility Selector */}
            <div className="relative" ref={colPickerRef}>
              <button
                onClick={() => setColPickerOpen(!colPickerOpen)}
                className={clsx(
                  "p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-600 cursor-pointer shadow-xs",
                  colPickerOpen && "bg-blue-50 border-blue-200 text-blue-600"
                )}
                title="Toggle columns"
              >
                <Settings size={13} />
              </button>
              {colPickerOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-50 text-xs space-y-2">
                  <p className="font-bold text-gray-500 uppercase tracking-wider mb-1 text-[10px]">Show Columns</p>
                  {[
                    { key: 'contact.firstName', label: 'Client Name' },
                    { key: 'policyNumber', label: 'Policy No' },
                    { key: 'plan.category', label: 'Type' },
                    { key: 'plan.company.name', label: 'Company' },
                    { key: 'plan.name', label: 'Plan' },
                    { key: 'premiumAmount', label: 'Premium' },
                    { key: 'sumAssured', label: 'Sum Insured' },
                    { key: 'renewStatus', label: 'Renew Status' },
                    { key: 'renewAssign', label: 'Renew Assign' },
                    { key: 'claimStatus', label: 'Claim Status' },
                    { key: 'claimAssign', label: 'Claim Assign' },
                  ].map(col => (
                    <label key={col.key} className="flex items-center gap-2 cursor-pointer font-medium text-gray-700 hover:text-blue-600 transition-colors">
                      <input
                        type="checkbox"
                        checked={visibleColumns[col.key] !== false}
                        onChange={() => setVisibleColumns(prev => ({ ...prev, [col.key]: !prev[col.key] }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImport}
              accept=".csv"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary h-9 py-0 px-3 text-xs flex items-center gap-1.5 font-bold cursor-pointer rounded-lg"
            >
              <Upload size={13} /> <span>Import</span>
            </button>
            
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={clsx(
                'btn-secondary h-9 py-0 px-3 text-xs flex items-center gap-1.5 font-bold cursor-pointer rounded-lg',
                filtersOpen && 'bg-blue-50 border-blue-200 text-blue-600'
              )}
            >
              <Filter size={13} className={filtersOpen ? 'text-blue-600' : 'text-slate-500'} /> <span>Filters</span>
            </button>

            <button
              className="btn-primary h-9 py-0 px-3 text-xs flex items-center gap-1.5 font-bold cursor-pointer rounded-lg"
              onClick={() => setModalOpen(true)}
            >
              <Plus size={13} /> <span>New Policy</span>
            </button>
          </div>
        </div>

      {/* Quick Select Category Filters */}
      <div className="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5 select-none py-1">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mr-2">Quick Type Filter:</span>
          <button
            onClick={() => { setSelectedQuickFilter('ALL'); setPage(1); }}
            className={clsx(
              'px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer',
              selectedQuickFilter === 'ALL'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            )}
          >
            All Types
          </button>
          {['HEALTH', 'LIFE', 'ACCIDENT', 'MOTOR', 'TRAVEL', 'GENERAL'].map(cat => {
            const isSel = selectedQuickFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => { setSelectedQuickFilter(cat); setPage(1); }}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer',
                  isSel
                    ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                )}
              >
                {cat === 'HEALTH' ? 'Health' : cat === 'LIFE' ? 'Life' : cat === 'ACCIDENT' ? 'Accident' : cat.charAt(0) + cat.slice(1).toLowerCase()}
              </button>
            );
          })}
        </div>
      </div>

      {selectedIds.length > 0 && user?.role === 'OWNER' && (
        <div className="flex items-center justify-between p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-sm transition-all animate-fadeIn">
          <span className="font-medium text-blue-800">
            {selectedIds.length} policies selected
          </span>
          <div className="flex items-center gap-2">
            <select
              value={assignTarget}
              onChange={e => setAssignTarget(e.target.value)}
              className="input py-1.5 px-3 text-xs w-48 bg-white border-gray-300"
            >
              <option value="">Select Assignee...</option>
              <option value="unassigned">Unassign</option>
              {employeeResults?.data?.map((emp: any) => (
                <option key={emp.id} value={emp.userId}>
                  {emp.firstName || emp.employeeProfile?.firstName || 'Unknown'} {emp.lastName || emp.employeeProfile?.lastName || ''}
                </option>
              ))}
            </select>
            <button
              onClick={handleBulkAssign}
              disabled={!assignTarget || bulkAssignMutation.isPending}
              className="btn-primary py-1.5 px-3 text-xs cursor-pointer disabled:opacity-50"
            >
              {bulkAssignMutation.isPending ? 'Assigning...' : 'Assign'}
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="p-1 rounded hover:bg-blue-100 text-blue-600"
              title="Clear selection"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {filtersOpen && (
        <div className="card grid grid-cols-1 sm:grid-cols-4 gap-4 bg-gray-50/50 p-4 rounded-xl border border-slate-100">
          <div>
            <label className="label">Status</label>
            <select className="input text-xs" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRED">Expired</option>
              <option value="LAPSED">Lapsed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>

          {/* Product Category Checklist (multi-select) */}
          <div ref={productFilterRef} className="relative">
            <label className="label">Product (Multiple)</label>
            <button
              type="button"
              onClick={() => setProductDropdownOpen(!productDropdownOpen)}
              className="input text-xs flex items-center justify-between w-full text-left bg-white"
            >
              <span className="truncate">{filterProducts.length === 0 ? 'All Products' : `${filterProducts.length} selected`}</span>
              <ChevronDown size={12} className="text-gray-400 shrink-0" />
            </button>
            {productDropdownOpen && (
              <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg p-2 space-y-1 max-h-48 overflow-y-auto">
                {filterPlansOptions.map((p: any) => (
                  <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterProducts.includes(p.id)}
                      onChange={() => {
                        setFilterProducts(prev =>
                          prev.includes(p.id) ? prev.filter(v => v !== p.id) : [...prev, p.id]
                        );
                        setPage(1);
                      }}
                      className="rounded accent-blue-600"
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Company Checklist (multi-select) */}
          <div ref={companyFilterRef} className="relative">
            <label className="label">Company (Multiple)</label>
            <button
              type="button"
              onClick={() => setCompanyDropdownOpen(!companyDropdownOpen)}
              className="input text-xs flex items-center justify-between w-full text-left bg-white"
            >
              <span className="truncate">{filterCompanies.length === 0 ? 'All Companies' : `${filterCompanies.length} selected`}</span>
              <ChevronDown size={12} className="text-gray-400 shrink-0" />
            </button>
            {companyDropdownOpen && (
              <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg p-2 space-y-1 max-h-48 overflow-y-auto">
                {filterCompaniesOptions.map(comp => (
                  <label key={comp} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterCompanies.includes(comp)}
                      onChange={() => {
                        setFilterCompanies(prev =>
                          prev.includes(comp) ? prev.filter(v => v !== comp) : [...prev, comp]
                        );
                        setPage(1);
                      }}
                      className="rounded accent-blue-600"
                    />
                    {comp}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Sum Insured range */}
          <div>
            <label className="label">Sum Insured Range</label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Min"
                className="input text-xs w-full bg-white"
                value={sumInsuredMin}
                onChange={e => { setSumInsuredMin(e.target.value); setPage(1); }}
              />
              <input
                type="number"
                placeholder="Max"
                className="input text-xs w-full bg-white"
                value={sumInsuredMax}
                onChange={e => { setSumInsuredMax(e.target.value); setPage(1); }}
              />
            </div>
          </div>

          {/* Policy Duration Date range */}
          <div>
            <label className="label">Duration Start Date</label>
            <input
              type="date"
              className="input text-xs"
              value={durationFrom}
              onChange={e => { setDurationFrom(e.target.value); setPage(1); }}
            />
          </div>
          <div>
            <label className="label">Duration End Date</label>
            <input
              type="date"
              className="input text-xs"
              value={durationTo}
              onChange={e => { setDurationTo(e.target.value); setPage(1); }}
            />
          </div>

          <div className="col-span-1 sm:col-span-2 grid grid-cols-2 gap-4">
            <div>
              <label className="label">Renewal Due</label>
              <div className="flex items-center gap-2">
                <input type="date" className="input text-xs" value={renewalFrom} onChange={e => { setRenewalFrom(e.target.value); setPage(1); }} title="From" />
                <span className="text-gray-400">-</span>
                <input type="date" className="input text-xs" value={renewalTo} onChange={e => { setRenewalTo(e.target.value); setPage(1); }} title="To" />
              </div>
            </div>
            <div>
              <label className="label">Payment Due</label>
              <div className="flex items-center gap-2">
                <input type="date" className="input text-xs" value={paymentDueFrom} onChange={e => { setPaymentDueFrom(e.target.value); setPage(1); }} title="From" />
                <span className="text-gray-400">-</span>
                <input type="date" className="input text-xs" value={paymentDueTo} onChange={e => { setPaymentDueTo(e.target.value); setPage(1); }} title="To" />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <DataTable
          columns={COLS}
          data={paginatedPolicies}
          total={filteredPolicies.length}
          page={page}
          pageSize={20}
          loading={isLoading}
          rowKey={r => r.id}
          onPageChange={setPage}
          onRowClick={r => navigate(`/policies/${r.id}`)}
          onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); setPage(1); }}
        />
      </div>

      <Modal open={modalOpen} onClose={closeModal} title="Issue New Policy" subtitle="Enter policy details matching client profile standards." size="xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">

            {/* ── Customer Picker ── */}
            <div className="col-span-2 relative flex flex-col gap-1">
              <label className="label">Customer *</label>
              <input type="hidden" {...register('contactId')} />
              <div className="relative">
                <input
                  value={selectedContact ? `${selectedContact.firstName} ${selectedContact.lastName} (${selectedContact.phone})` : contactSearch}
                  onChange={e => {
                    if (selectedContact) {
                      setSelectedContact(null);
                      setValue('contactId', '');
                    }
                    setContactSearch(e.target.value);
                    setContactDropdown(true);
                  }}
                  onFocus={() => setContactDropdown(true)}
                  onBlur={() => setTimeout(() => setContactDropdown(false), 200)}
                  placeholder="Search and select a customer..."
                  className="input w-full pr-10 h-10 text-xs rounded-xl bg-white border border-slate-200"
                />
                <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
               {contactDropdown && !selectedContact && (
                <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                  {(contactResults?.data ?? []).length === 0 && (
                    <li className="px-3 py-2 text-sm text-gray-400">No contacts found</li>
                  )}
                  {(contactResults?.data ?? []).map((c: any) => (
                    <li key={c.id} onMouseDown={() => {
                      setSelectedContact(c);
                      setValue('contactId', c.id, { shouldValidate: true });
                      setContactDropdown(false);
                      setContactSearch('');
                    }} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer">
                      <User size={13} className="text-gray-400" />
                      <span className="font-medium">{c.firstName} {c.lastName}</span>
                      <span className="text-gray-400 text-xs ml-auto">{c.phone}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* ── Policy Type (Select) ── */}
            <div className="flex flex-col gap-1">
              <label className="label">Policy Type *</label>
              <select
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                value={selectedType}
                onChange={e => {
                  setSelectedType(e.target.value);
                  setSelectedCompany('');
                  setSelectedPlan(null);
                  setValue('planId', '');
                }}
              >
                <option value="">Select Type</option>
                {availableTypes.map(t => (
                  <option key={t} value={t}>
                    {t === 'HEALTH' ? 'Health' : t === 'LIFE' ? 'Life' : t.charAt(0) + t.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* ── Company (Select) ── */}
            <div className="flex flex-col gap-1">
              <label className="label">Company *</label>
              <select
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                value={selectedCompany}
                onChange={e => {
                  setSelectedCompany(e.target.value);
                  setSelectedPlan(null);
                  setValue('planId', '');
                }}
                disabled={!selectedType}
              >
                <option value="">Select Company</option>
                {availableCompanies.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* ── Plan Name (Select) ── */}
            <div className="flex flex-col gap-1">
              <label className="label">Plan Name *</label>
              <select
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                value={selectedPlan?.id || ''}
                onChange={e => {
                  const p = plansList.find((x: any) => x.id === e.target.value);
                  setSelectedPlan(p || null);
                  setValue('planId', p?.id || '', { shouldValidate: true });
                }}
                disabled={!selectedCompany}
              >
                <option value="">Select Plan</option>
                {availablePlans.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* ── Policy Number ── */}
            <div className="flex flex-col gap-1">
              <label className="label">Policy No. *</label>
              <input
                {...register('policyNumber')}
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                placeholder="Enter policy number"
              />
            </div>

            {/* ── Start Date, Duration & Calculated End Date ── */}
            <div className="col-span-2 grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <label className="label">Start Date *</label>
                <input {...register('startDate')} type="date" className="input h-10 text-xs rounded-xl bg-white border border-slate-200" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="label">Policy Term (Years)</label>
                <select
                  value={durationYears}
                  onChange={e => setDurationYears(Number(e.target.value))}
                  className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                >
                  <option value={1}>1 Year</option>
                  <option value={2}>2 Years</option>
                  <option value={3}>3 Years</option>
                  <option value={5}>5 Years</option>
                  <option value={10}>10 Years</option>
                  <option value={15}>15 Years</option>
                  <option value={20}>20 Years</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="label">End Date</label>
                <input {...register('endDate')} type="date" className="input h-10 text-xs rounded-xl bg-slate-50 border border-slate-200" disabled />
              </div>
            </div>

            {/* ── Sum Insured, Deductible, Status & Assigned To ── */}
            <div className="flex flex-col gap-1">
              <label className="label">Sum Insured (₹) *</label>
              <div className="relative">
                <Shield size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500/80" />
                <input
                  {...register('sumAssured')}
                  type="number"
                  className="input pl-9 h-10 text-xs rounded-xl bg-white border border-slate-200"
                  placeholder="Enter sum insured"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="label">Deductible (Optional)</label>
              <input
                {...register('deductible')}
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                placeholder="Enter deductible if any"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="label">Policy Status *</label>
              <select
                {...register('status')}
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
              >
                <option value="ACTIVE">Active (Inforce)</option>
                <option value="EXPIRED">Expired</option>
                <option value="LAPSED">Lapsed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="SURRENDERED">Surrendered</option>
              </select>
            </div>

            {user?.role !== 'EMPLOYEE' && (
              <div className="flex flex-col gap-1">
                <label className="label">Assigned To</label>
                <select
                  {...register('assignedEmployeeId')}
                  className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                >
                  <option value="">Select Employee</option>
                  {employeeResults?.data?.map((emp: any) => (
                    <option key={emp.id} value={emp.userId}>
                      {emp.firstName || emp.employeeProfile?.firstName || ''} {emp.lastName || emp.employeeProfile?.lastName || ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* ── Riders / Addons Multi-Select ── */}
            <div className="col-span-2 flex flex-col gap-1">
              <label className="label">Riders / Addons *</label>
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                {[
                  { id: 'CRITICAL_ILLNESS', label: 'Critical Illness' },
                  { id: 'ACCIDENTAL_DEATH', label: 'Accidental Death Rider' },
                  { id: 'ROOM_RENT_WAIVER', label: 'Room Rent Limit Waiver' },
                  { id: 'MATERNITY_COVER', label: 'Maternity Cover Option' },
                  { id: 'OPD_BENEFIT', label: 'OPD Benefit Rider' },
                  { id: 'WAIVER_OF_PREMIUM', label: 'Waiver of Premium' },
                ].map(rider => (
                  <label key={rider.id} className="flex items-center gap-2 cursor-pointer text-gray-700 hover:text-blue-600 transition-colors">
                    <input
                      type="checkbox"
                      value={rider.id}
                      {...register('riders')}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{rider.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* ── Premium Details Subheader ── */}
            <div className="col-span-2 mt-4 border-t border-slate-100 pt-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Premium Details</h3>
            </div>

            <div className="flex flex-col gap-1">
              <label className="label">Premium / Instalment Amount (₹) *</label>
              <div className="relative">
                <Shield size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500/80" />
                <input
                  {...register('premiumAmount')}
                  type="number"
                  className="input pl-9 h-10 text-xs rounded-xl bg-white border border-slate-200"
                  placeholder="Enter premium amount"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="label">Installment Frequency *</label>
              <select
                {...register('paymentFrequency')}
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
              >
                <option value="YEARLY">Yearly</option>
                <option value="HALF_YEARLY">Half Yearly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="SINGLE">One Time</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="label">First Premium Date</label>
              <input
                type="date"
                {...register('firstPremiumDate')}
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="label">Premium Payment Period (Years)</label>
              <input
                type="number"
                {...register('premiumPaymentPeriod')}
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                placeholder="e.g. 10"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="label">Last Premium Date</label>
              <input
                type="date"
                {...register('lastPremiumDate')}
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="label">EMI Case?</label>
              <select
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                onChange={e => setValue('emiCase', e.target.value === 'yes')}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            {/* ── Conditional EMI Details ── */}
            {watchEmiCase && (
              <div className="col-span-2 grid grid-cols-3 gap-4 p-4 bg-blue-50/20 rounded-xl border border-blue-100/50 mt-2">
                <div className="flex flex-col gap-1">
                  <label className="label">EMI Gateway</label>
                  <select
                    {...register('emiGateway')}
                    className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                  >
                    <option value="">Select Gateway</option>
                    <option value="FIBE">FIBE</option>
                    <option value="Shopse">Shopse</option>
                    <option value="BimaPay">BimaPay</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="label">EMI Date</label>
                  <select
                    {...register('emiDate')}
                    className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                  >
                    <option value="">Select Date</option>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={String(d)}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="label">EMI Premium (₹)</label>
                  <input
                    type="number"
                    {...register('emiPremium')}
                    className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                    placeholder="EMI Premium"
                  />
                </div>
              </div>
            )}

            {/* ── Preventive Health Checkup Details Subheader ── */}
            <div className="col-span-2 mt-4 border-t border-slate-100 pt-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Preventive Health Checkup Details</h3>
            </div>

            <div className="col-span-2 flex flex-col gap-1">
              <label className="label">Preventive Health Checkup?</label>
              <select
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                onChange={e => setValue('phcRequired', e.target.value === 'yes')}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            {/* ── Conditional PHC Details ── */}
            {watchPhcRequired && (
              <div className="col-span-2 grid grid-cols-3 gap-4 p-4 bg-emerald-50/20 rounded-xl border border-emerald-100/50 mt-2">
                <div className="flex flex-col gap-1">
                  <label className="label">PHC Amount (₹)</label>
                  <input
                    type="number"
                    {...register('phcAmount')}
                    className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                    placeholder="Amount"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="label">PHC Status</label>
                  <select
                    {...register('phcStatus')}
                    className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                  >
                    <option value="">Select Status</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="label">PHC Claim Settled?</label>
                  <select
                    className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                    onChange={e => setValue('phcClaimSettled', e.target.value === 'yes')}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
              </div>
            )}

            {/* ── Policy Document Subheader ── */}
            <div className="col-span-2 mt-4 border-t border-slate-100 pt-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Policy Document</h3>
            </div>

            <div className="col-span-2 flex flex-col gap-1">
              <label className="label">Policy PDF Document</label>
              <input
                type="file"
                accept=".pdf"
                onChange={e => setPolicyFile(e.target.files?.[0] || null)}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 text-xs text-slate-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-blue-50/40 border border-blue-100/50 p-4 rounded-xl flex items-center gap-2.5 text-xs text-blue-700 mt-2">
            <Info size={16} className="text-blue-500 shrink-0" />
            <span>Make sure all details are accurate before saving the policy.</span>
          </div>

          <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-100 mt-5">
            <button
              type="button"
              className="btn-secondary px-6 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              onClick={closeModal}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-sm shadow-blue-500/10"
              disabled={createPolicy.isPending || !selectedContact || !selectedPlan}
            >
              <Save size={14} />
              {createPolicy.isPending ? 'Saving…' : 'Save Policy'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Policy Modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Policy" size="xl">
        <form onSubmit={handleEdit(submitEdit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="label">Policy Status *</label>
              <select
                {...regEdit('status')}
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
              >
                <option value="ACTIVE">Active (Inforce)</option>
                <option value="EXPIRED">Expired</option>
                <option value="LAPSED">Lapsed</option>
                <option value="SURRENDERED">Surrendered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {user?.role !== 'EMPLOYEE' && (
              <div className="flex flex-col gap-1">
                <label className="label">Assigned To</label>
                <select
                  {...regEdit('assignedEmployeeId')}
                  className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                >
                  <option value="">Select Employee</option>
                  {employeeResults?.data?.map((emp: any) => (
                    <option key={emp.id} value={emp.userId}>
                      {emp.firstName || emp.employeeProfile?.firstName || ''} {emp.lastName || emp.employeeProfile?.lastName || ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="label">Sum Insured (₹) *</label>
              <input
                {...regEdit('sumAssured')}
                type="number"
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="label">Deductible (Optional)</label>
              <input
                {...regEdit('deductible')}
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="label">End / Expiry Date *</label>
              <input {...regEdit('endDate')} type="date" className="input h-10 text-xs rounded-xl bg-white border border-slate-200" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="label">Next Due Date</label>
              <input {...regEdit('nextDueDate')} type="date" className="input h-10 text-xs rounded-xl bg-white border border-slate-200" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="label">Maturity Date</label>
              <input {...regEdit('maturityDate')} type="date" className="input h-10 text-xs rounded-xl bg-white border border-slate-200" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="label">Agent Code</label>
              <input {...regEdit('agentCode')} className="input h-10 text-xs rounded-xl bg-white border border-slate-200" placeholder="Agent Code" />
            </div>

            {/* ── Riders / Addons Multi-Select ── */}
            <div className="col-span-2 flex flex-col gap-1">
              <label className="label">Riders / Addons</label>
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                {[
                  { id: 'CRITICAL_ILLNESS', label: 'Critical Illness' },
                  { id: 'ACCIDENTAL_DEATH', label: 'Accidental Death Rider' },
                  { id: 'ROOM_RENT_WAIVER', label: 'Room Rent Limit Waiver' },
                  { id: 'MATERNITY_COVER', label: 'Maternity Cover Option' },
                  { id: 'OPD_BENEFIT', label: 'OPD Benefit Rider' },
                  { id: 'WAIVER_OF_PREMIUM', label: 'Waiver of Premium' },
                ].map(rider => (
                  <label key={rider.id} className="flex items-center gap-2 cursor-pointer text-gray-700 hover:text-blue-600 transition-colors">
                    <input
                      type="checkbox"
                      value={rider.id}
                      {...regEdit('riders')}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{rider.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* ── Premium Details Subheader ── */}
            <div className="col-span-2 mt-4 border-t border-slate-100 pt-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Premium Details</h3>
            </div>

            <div className="flex flex-col gap-1">
              <label className="label">Premium / Instalment Amount (₹) *</label>
              <input
                {...regEdit('premiumAmount')}
                type="number"
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="label">Installment Frequency *</label>
              <select
                {...regEdit('paymentFrequency')}
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
              >
                <option value="YEARLY">Yearly</option>
                <option value="HALF_YEARLY">Half Yearly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="SINGLE">One Time</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="label">First Premium Date</label>
              <input
                type="date"
                {...regEdit('firstPremiumDate')}
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="label">Premium Payment Period (Years)</label>
              <input
                type="number"
                {...regEdit('premiumPaymentPeriod')}
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="label">Last Premium Date</label>
              <input
                type="date"
                {...regEdit('lastPremiumDate')}
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="label">EMI Case?</label>
              <select
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                value={watchEditEmiCase ? 'yes' : 'no'}
                onChange={e => setEditValue('emiCase', e.target.value === 'yes')}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            {/* ── Conditional EMI Details ── */}
            {watchEditEmiCase && (
              <div className="col-span-2 grid grid-cols-3 gap-4 p-4 bg-blue-50/20 rounded-xl border border-blue-100/50 mt-2">
                <div className="flex flex-col gap-1">
                  <label className="label">EMI Gateway</label>
                  <select
                    {...regEdit('emiGateway')}
                    className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                  >
                    <option value="">Select Gateway</option>
                    <option value="FIBE">FIBE</option>
                    <option value="Shopse">Shopse</option>
                    <option value="BimaPay">BimaPay</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="label">EMI Date</label>
                  <select
                    {...regEdit('emiDate')}
                    className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                  >
                    <option value="">Select Date</option>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={String(d)}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="label">EMI Premium (₹)</label>
                  <input
                    type="number"
                    {...regEdit('emiPremium')}
                    className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                  />
                </div>
              </div>
            )}

            {/* ── Preventive Health Checkup Details Subheader ── */}
            <div className="col-span-2 mt-4 border-t border-slate-100 pt-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Preventive Health Checkup Details</h3>
            </div>

            <div className="col-span-2 flex flex-col gap-1">
              <label className="label">Preventive Health Checkup?</label>
              <select
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                value={watchEditPhcRequired ? 'yes' : 'no'}
                onChange={e => setEditValue('phcRequired', e.target.value === 'yes')}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            {/* ── Conditional PHC Details ── */}
            {watchEditPhcRequired && (
              <div className="col-span-2 grid grid-cols-3 gap-4 p-4 bg-emerald-50/20 rounded-xl border border-emerald-100/50 mt-2">
                <div className="flex flex-col gap-1">
                  <label className="label">PHC Amount (₹)</label>
                  <input
                    type="number"
                    {...regEdit('phcAmount')}
                    className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="label">PHC Status</label>
                  <select
                    {...regEdit('phcStatus')}
                    className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                  >
                    <option value="">Select Status</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="label">PHC Claim Settled?</label>
                  <select
                    className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                    value={watchEdit('phcClaimSettled') ? 'yes' : 'no'}
                    onChange={e => setEditValue('phcClaimSettled', e.target.value === 'yes')}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
              </div>
            )}

            <div className="col-span-2 mt-4 border-t border-slate-100 pt-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Additional Information</h3>
            </div>

            <div className="col-span-2 flex flex-col gap-1">
              <label className="label">Notes</label>
              <textarea {...regEdit('notes')} className="input" rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setEditTarget(null)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={updatePolicy.isPending}>
              {updatePolicy.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Policy" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Delete policy <strong>{deleteTarget?.policyNumber}</strong>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="btn-danger" onClick={confirmDelete} disabled={deletePolicy.isPending}>
            {deletePolicy.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
