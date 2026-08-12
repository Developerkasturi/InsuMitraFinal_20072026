import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Plus, X, User, Shield, Pencil, Trash2, Upload, Filter, Search, Info, Save, ChevronDown, Settings, CreditCard, Building, CheckCircle2, AlertTriangle, Users, Activity, FileText, FileCheck2, Clock } from 'lucide-react';
import EmiTrackingView from './EmiTrackingView';
import PhcTrackingView from './PhcTrackingView';
import { usePolicies, useCreatePolicy, useUpdatePolicy, useDeletePolicy, useBulkAssignPolicies } from '@hooks/usePolicies';
import { useClaims, useCreateClaim } from '@hooks/useClaims';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { contactsService, policiesService, employeesService, claimsService, documentsService } from '@api/index';
import { deletionRequestsService } from '@api/deletionRequestsService';
import DataTable, { Column } from '@comps/common/DataTable';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { DatePicker } from '@comps/common/DatePicker';

const formatPreview = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return format(d, 'dd/MMM/yyyy');
  } catch {
    return '';
  }
};
import toast from 'react-hot-toast';
import { useAuthStore } from '@store/auth.store';
import clsx from 'clsx';


interface Policy {
  id: string; policyNumber: string; status: string;
  premiumAmount: number; sumAssured?: number; startDate?: string; endDate: string;
  paymentFrequency?: string; agentCode?: string; notes?: string;
  nextDueDate?: string; maturityDate?: string;
  contactId?: string;
  contact?: { id: string; firstName: string; lastName: string; phone?: string };
  planId?: string;
  plan?: {
    id: string;
    name: string;
    category: string;
    categoryId?: string;
    companyId?: string;
    company?: { id: string; name: string; category?: string };
  };
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
  nextDueDate: z.string().optional(),
  maturityDate: z.string().optional(),
  agentCode: z.string().optional(),
  notes: z.string().optional(),
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
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [keepCreateOpen, setKeepCreateOpen] = useState(false);
  const [activePolicyTab, setActivePolicyTab] = useState<'policyPlan' | 'premium' | 'paymentGst' | 'connectedPersons' | 'phcDetails' | 'policyDocs' | 'policyClaims'>('policyPlan');
  const [isPolicyDetailsCollapsed, setIsPolicyDetailsCollapsed] = useState(false);
  const [isPlanDetailsCollapsed, setIsPlanDetailsCollapsed] = useState(false);
  const [isPremiumBreakdownCollapsed, setIsPremiumBreakdownCollapsed] = useState(false);
  const [isTenureDatesCollapsed, setIsTenureDatesCollapsed] = useState(false);
  const [isEmiDetailsCollapsed, setIsEmiDetailsCollapsed] = useState(false);
  const [isPaymentModeLoanCollapsed, setIsPaymentModeLoanCollapsed] = useState(false);
  const [isPaymentAccountCollapsed, setIsPaymentAccountCollapsed] = useState(false);
  const [isGstDetailsCollapsed, setIsGstDetailsCollapsed] = useState(false);
  const [isPhcCollapsed, setIsPhcCollapsed] = useState(false);
  const [isPhcBookingCollapsed, setIsPhcBookingCollapsed] = useState(false);
  const [isPhcSettlementCollapsed, setIsPhcSettlementCollapsed] = useState(false);
  const [isDocCollapsed, setIsDocCollapsed] = useState(false);
  const [isEndorsementDocCollapsed, setIsEndorsementDocCollapsed] = useState(false);
  const [isAddPolicyClaimOpen, setIsAddPolicyClaimOpen] = useState(false);
  const [policyClaimFields, setPolicyClaimFields] = useState({
    claimNumber: '',
    claimType: 'HEALTH',
    claimAmount: '',
    intimatedAt: format(new Date(), 'yyyy-MM-dd'),
    diagnosis: '',
    hospital: '',
    notes: '',
  });

  const createClaimMutation = useCreateClaim();
  const { data: allClaimsData } = useClaims({ page: 1, limit: 500 });
  const allClaimsList = allClaimsData?.data ?? [];

  // Tab 5: Preventive Health Checkup Extra Details State
  const [phcExtraDetails, setPhcExtraDetails] = useState({
    balanceAmount: '1500',
    eligibilityStartDate: '',
    frequency: 'ANNUAL',
    followUpDate: '',
    insuredPersonName: '',
    bookingDate: '',
    appointmentDate: '',
    centreName: '',
    centreCity: '',
    utilizedAmount: '',
    reimbursementCashless: 'CASHLESS',
    reportReceivedDate: '',
    reportBillReceivedDate: '',
    reportBillSubmittedDate: '',
    settlementDate: '',
    phcStage: 'INTIMATIONS',
  });

  const [endorsementFile, setEndorsementFile] = useState<File | null>(null);

  // Payment Account Details
  const [paymentAccount, setPaymentAccount] = useState({
    bankName: '',
    ifscCode: '',
    branch: '',
    accountNo: '',
    accountType: 'SAVINGS',
  });

  // GST No Details
  const [gstDetails, setGstDetails] = useState({
    firmName: '',
    firmPan: '',
    firmGst: '',
  });

  // Payment Mode & Loan Details
  const [paymentModeDetails, setPaymentModeDetails] = useState({
    paymentMode: 'ONLINE',
    paymentDate: '',
    transactionRef: '',
    isLoanCase: false,
    loanAmount: '',
    loanProvider: '',
    loanSanctionNo: '',
    loanEmi: '',
  });

  // Connected Persons State
  interface ConnectedPersonItem {
    id: string;
    name: string;
    relationship: string;
    contactNo: string;
    dob: string;
    gender: string;
    isCovered: boolean;
    isNominee: boolean;
    nomineeName: string;
    nomineeRelation: string;
    nomineeContact: string;
    nomineeDob: string;
    nomineePercentage: number;
  }

  const [connectedPersons, setConnectedPersons] = useState<ConnectedPersonItem[]>([]);

  const addConnectedPerson = () => {
    setConnectedPersons(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        name: '',
        relationship: 'Spouse',
        contactNo: '',
        dob: '',
        gender: 'MALE',
        isCovered: true,
        isNominee: false,
        nomineeName: '',
        nomineeRelation: 'Spouse',
        nomineeContact: '',
        nomineeDob: '',
        nomineePercentage: 100,
      },
    ]);
  };

  const removeConnectedPerson = (id: string) => {
    setConnectedPersons(prev => prev.filter(p => p.id !== id));
  };

  const updateConnectedPerson = (id: string, updates: Partial<ConnectedPersonItem>) => {
    setConnectedPersons(prev =>
      prev.map(p => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const totalNomineePercentage = useMemo(() => {
    return connectedPersons
      .filter(p => p.isNominee)
      .reduce((sum, p) => sum + (Number(p.nomineePercentage) || 0), 0);
  }, [connectedPersons]);

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      const contactId = searchParams.get('contactId');
      const keepOpen = searchParams.get('keepOpen') === '1';
      setKeepCreateOpen(keepOpen);
      setModalOpen(true);

      if (contactId) {
        contactsService.get(contactId)
          .then((res: any) => {
            const contact = res?.data ?? res;
            if (!contact?.id) return;
            setSelectedContact({
              id: contact.id,
              firstName: contact.firstName || '',
              lastName: contact.lastName || '',
              phone: contact.phone || '',
            });
            setValue('contactId', contact.id, { shouldValidate: true });
            setContactSearch('');
          })
          .catch((err: any) => console.error('Failed to preload contact for policy create', err));
      }
    }
  }, [searchParams]);
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
    companyCategory: true,
    'plan.company.name': true,
    'plan.category': true,
    'plan.name': true,
    customerCategory: true,
    policyType: true,
    policyNumber: true,
    sumAssured: true,
    policyTenure: true,
    policyTerm: true,
    assignedTo: true,
    comment: true,
    firstYearPremium: true,
    secondYearPremium: true,
    premiumAmount: true,
    installmentCase: true,
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
      setKeepCreateOpen(params.get('keepOpen') === '1');
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
  const watchEditEndDate = watchEdit('endDate');
  const watchEditNextDueDate = watchEdit('nextDueDate');
  const watchEditMaturityDate = watchEdit('maturityDate');

  const watchStartDate = watch('startDate');
  const watchEndDate = watch('endDate');
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
    const returnState = location.state as any;
    const returnRoute = returnState?.returnRoute;
    const returnPayload = returnState?.returnPayload;
    setModalOpen(false);
    reset();
    setSelectedContact(null);
    setContactSearch('');
    setSelectedType('');
    setSelectedCompany('');
    setSelectedPlan(null);
    setPolicyFile(null);
    setKeepCreateOpen(false);
    if (returnRoute) {
      navigate(returnRoute, {
        replace: true,
        state: returnPayload,
      });
    }
  };

  const openEdit = (p: Policy) => {
    setEditTarget(p);
    const extra = parseExtraNotes(p.notes);

    setValue('contactId', p.contactId || '');
    if (p.contact) {
      setSelectedContact({
        id: p.contactId || p.contact.id,
        firstName: p.contact.firstName || '',
        lastName: p.contact.lastName || '',
        phone: p.contact.phone || '',
      });
    }

    if (p.plan) {
      setSelectedPlan(p.plan);
      if (p.plan.company) {
        setSelectedCompany(p.plan.company?.name || '');
      }
      if (p.plan.category) {
        setSelectedType(p.plan.category);
      }
      setValue('planId', p.planId || p.plan?.id || '');
    }

    setValue('policyNumber', p.policyNumber || '');
    setValue('status', (p.status as any) || 'ACTIVE');
    setValue('premiumAmount', p.premiumAmount || 0);
    setValue('sumAssured', (p.sumAssured as any) || undefined);
    setValue('startDate', p.startDate ? p.startDate.slice(0, 10) : '');
    setValue('endDate', p.endDate ? p.endDate.slice(0, 10) : '');
    setValue('nextDueDate', p.nextDueDate ? p.nextDueDate.slice(0, 10) : '');
    setValue('maturityDate', p.maturityDate ? p.maturityDate.slice(0, 10) : '');
    setValue('paymentFrequency', (p.paymentFrequency as any) ?? 'YEARLY');
    setValue('agentCode', p.agentCode ?? '');
    setValue('notes', extra.cleanNotes || '');
    setValue('deductible', extra.deductible || '');
    setValue('riders', extra.riders || []);
    setValue('assignedEmployeeId', p.assignedEmployeeId ?? '');
    setValue('firstPremiumDate', extra.firstPremiumDate || '');
    setValue('premiumPaymentPeriod', extra.premiumPaymentPeriod || undefined);
    setValue('lastPremiumDate', extra.lastPremiumDate || '');
    setValue('emiCase', extra.emiCase || false);
    setValue('emiGateway', extra.emiGateway || '');
    setValue('emiDate', extra.emiDate || '');
    setValue('emiPremium', extra.emiPremium || undefined);
    setValue('phcRequired', extra.phcRequired || false);
    setValue('phcAmount', extra.phcAmount || undefined);
    setValue('phcStatus', extra.phcStatus || '');
    setValue('phcClaimSettled', extra.phcClaimSettled || false);

    if (extra.phcAmount || extra.phcStatus) {
      setPhcExtraDetails(prev => ({
        ...prev,
        balanceAmount: '1500',
        frequency: 'ANNUAL',
      }));
    }

    if ((p as any).members && (p as any).members.length > 0) {
      setConnectedPersons((p as any).members.map((m: any) => ({
        id: m.id || String(Math.random()),
        name: m.name || `${m.firstName || ''} ${m.lastName || ''}`.trim(),
        relationship: m.relationship || 'Spouse',
        contactNo: m.contactNo || m.phone || '',
        dob: m.dateOfBirth ? m.dateOfBirth.slice(0, 10) : '',
        gender: m.gender || 'MALE',
        isCovered: true,
        isNominee: false,
        nomineeName: '',
        nomineeRelation: 'Spouse',
        nomineeContact: '',
        nomineeDob: '',
        nomineePercentage: 100,
      })));
    }

    setModalOpen(true);
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
        key: 'companyCategory',
        label: 'Insurance Company Category',
        render: r => r.plan?.company?.category || (r as any).insuranceCompanyCategory || '—'
      },
      {
        key: 'plan.company.name',
        label: 'Insurance Company',
        sortable: true,
        render: r => r.plan?.company ? r.plan.company.name : '—'
      },
      {
        key: 'plan.category',
        label: 'Insurance Plan Category',
        sortable: true,
        render: r => r.plan?.category ? r.plan.category : '—'
      },
      {
        key: 'plan.name',
        label: 'Plan Name',
        sortable: true,
        render: r => r.plan?.name ? r.plan.name : '—'
      },
      {
        key: 'customerCategory',
        label: 'Customer Category',
        render: r => (r.contact as any)?.category || (r as any).customerCategory || '—'
      },
      {
        key: 'policyType',
        label: 'Policy Type',
        render: r => r.plan?.category || '—'
      },
      {
        key: 'policyNumber',
        label: 'Policy Number',
        sortable: true
      },
      {
        key: 'sumAssured',
        label: 'Sum Insured',
        sortable: true,
        render: r => r.sumAssured ? `₹${Number(r.sumAssured).toLocaleString('en-IN')}` : '—'
      },
      {
        key: 'policyTenure',
        label: 'Policy Tenure',
        render: r => (r.startDate && r.endDate) ? `${format(new Date(r.startDate), 'dd/MMM/yyyy')} - ${format(new Date(r.endDate), 'dd/MMM/yyyy')}` : '—'
      },
      {
        key: 'policyTerm',
        label: 'Policy Term (Period of Coverage in Years)',
        render: r => {
          if (!r.startDate || !r.endDate) return (r as any).policyTerm ? `${(r as any).policyTerm} Years` : '—';
          const years = Math.max(1, Math.round((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
          return `${years} ${years === 1 ? 'Year' : 'Years'}`;
        }
      },
      {
        key: 'assignedTo',
        label: 'Assigned To',
        render: r => r.assignedEmployee?.employeeProfile 
          ? `${r.assignedEmployee.employeeProfile.firstName} ${r.assignedEmployee.employeeProfile.lastName}` 
          : ((r.assignedEmployee as any)?.firstName ? `${(r.assignedEmployee as any).firstName} ${(r.assignedEmployee as any).lastName || ''}` : '—')
      },
      {
        key: 'comment',
        label: 'Comment',
        render: r => r.notes ? (parseExtraNotes(r.notes).cleanNotes || r.notes) : '—'
      },
      {
        key: 'firstYearPremium',
        label: '1st Year Premium Amount',
        render: r => (r as any).firstYearPremium ? `₹${Number((r as any).firstYearPremium).toLocaleString('en-IN')}` : (r.premiumAmount ? `₹${Number(r.premiumAmount).toLocaleString('en-IN')}` : '—')
      },
      {
        key: 'secondYearPremium',
        label: '2nd Year Onwards Premium Amount',
        render: r => (r as any).secondYearPremium ? `₹${Number((r as any).secondYearPremium).toLocaleString('en-IN')}` : (r.premiumAmount ? `₹${Number(r.premiumAmount).toLocaleString('en-IN')}` : '—')
      },
      {
        key: 'premiumAmount',
        label: 'Premium Amount',
        sortable: true,
        render: r => r.premiumAmount ? `₹${Number(r.premiumAmount).toLocaleString('en-IN')}` : '—'
      },
      {
        key: 'installmentCase',
        label: 'Installment Case?',
        render: r => parseExtraNotes(r.notes).emiCase ? 'Yes' : 'No'
      }
    ];

    colConfigs.forEach(col => {
      if (visibleColumns[col.key] !== false) {
        cols.push(col as any);
      }
    });

    // Append action column
    cols.push({
      key: 'actions' as any, label: 'ACTIONS',
      render: r => (
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <button
            title="Edit Policy"
            className="p-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-purple-500/20 hover:shadow-lg hover:scale-105 transition-all"
            onClick={() => openEdit(r)}
          >
            <Pencil size={14} />
          </button>
          <button
            title="Delete Policy"
            className="p-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-rose-500/20 hover:shadow-lg hover:scale-105 transition-all"
            onClick={() => setDeleteTarget(r)}
          >
            <Trash2 size={14} />
          </button>
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
      const res = await updatePolicy.mutateAsync({ id: editTarget.id, body: cleanedBody });
      const updatedPolicy = res?.data ?? res;
      if (updatedPolicy?.id) {
        setEditTarget(prev => prev ? { ...prev, ...updatedPolicy } : prev);
      }
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

      if (editTarget?.id) {
        await updatePolicy.mutateAsync({ id: editTarget.id, body: cleanedBody as any });
        if (policyFile) {
          try {
            await documentsService.upload(policyFile, { policyId: editTarget.id, tag: 'POLICY' });
          } catch (uploadErr) {
            console.error('[Document Upload Error]', uploadErr);
          }
        }
        if (endorsementFile) {
          try {
            await documentsService.upload(endorsementFile, { policyId: editTarget.id, tag: 'ENDORSEMENT' });
          } catch (uploadErr) {
            console.error('[Endorsement Upload Error]', uploadErr);
          }
        }
        qc.invalidateQueries({ queryKey: ['contacts'] });
        qc.invalidateQueries({ queryKey: ['policies'] });
        qc.invalidateQueries({ queryKey: ['policy', editTarget.id] });
        toast.success('Policy updated successfully');
        closeModal();
        return;
      }

      const res = await createPolicy.mutateAsync(cleanedBody as any);
      const createdPolicy = res?.data ?? res;
      if (policyFile && createdPolicy?.id) {
        try {
          await documentsService.upload(policyFile, { policyId: createdPolicy.id, tag: 'POLICY' });
        } catch (uploadErr) {
          console.error('[Document Upload Error]', uploadErr);
        }
      }
      if (endorsementFile && createdPolicy?.id) {
        try {
          await documentsService.upload(endorsementFile, { policyId: createdPolicy.id, tag: 'ENDORSEMENT' });
        } catch (uploadErr) {
          console.error('[Endorsement Upload Error]', uploadErr);
        }
      }
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['policies'] });
      toast.success('Policy created successfully');
      if (createdPolicy?.id) {
        if (keepCreateOpen) {
          reset({
            contactId: body.contactId,
            paymentFrequency: 'YEARLY',
          } as any);
          setSelectedPlan(null);
          setSelectedType('');
          setSelectedCompany('');
          setPolicyFile(null);
          setDurationYears(1);
          return;
        }
        closeModal();
        if (!(location.state as any)?.returnRoute) {
          openEdit(createdPolicy as Policy);
        }
      }
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

  const currentTab = searchParams.get('tab') || searchParams.get('view') || (location.pathname.includes('emi') ? 'emi' : 'list');

  return (
    <div className="space-y-4">
      {/* Top View Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
        <button
          type="button"
          onClick={() => navigate('/policies?tab=list')}
          className={clsx(
            'px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2',
            currentTab !== 'emi' && currentTab !== 'phc' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          <Shield size={14} />
          Policies List
        </button>
        <button
          type="button"
          onClick={() => navigate('/policies?tab=emi')}
          className={clsx(
            'px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2',
            currentTab === 'emi' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          <CreditCard size={14} />
          Monthly Installments Tracking
        </button>
        <button
          type="button"
          onClick={() => navigate('/policies?tab=phc')}
          className={clsx(
            'px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2',
            currentTab === 'phc' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          <Activity size={14} />
          PHC Tracking
        </button>
      </div>

      {currentTab === 'phc' ? (
        <PhcTrackingView />
      ) : currentTab === 'emi' ? (
        <EmiTrackingView />
      ) : (
        <>
          {/* Floating Right Action Panel */}
      <input type="file" ref={fileInputRef} onChange={handleImport} accept=".csv" className="hidden" />
      <div className="fixed right-5 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-3 bg-white/90 backdrop-blur-xl p-2 rounded-2xl shadow-2xl border border-slate-200/80 animate-fadeIn">
        {/* Import CSV */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white flex items-center justify-center transition-all hover:scale-105 shadow-md shadow-emerald-500/25 cursor-pointer group relative"
          title="Import Policy CSV"
        >
          <Upload size={18} strokeWidth={2.2} />
          <span className="absolute right-full mr-3 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl border border-slate-800">
            Import Policy CSV
          </span>
        </button>

        {/* Add New Policy */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center justify-center transition-all hover:scale-105 shadow-lg shadow-blue-500/30 cursor-pointer group relative"
          title="Add New Policy"
        >
          <Plus size={18} strokeWidth={2.2} />
          <span className="absolute right-full mr-3 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl border border-slate-800">
            Add New Policy
          </span>
        </button>
      </div>

      {/* Actions Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-2">
        {/* Left Side: Search Bar ONLY */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search policy#, client name, phone..."
              className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50/50 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all font-semibold text-slate-800 shadow-2xs"
            />
          </div>
        </div>

        {/* Right Side: Column Picker & Filters Toggle */}
        <div className="flex items-center gap-2.5 flex-wrap justify-end">
          {/* Column Visibility Selector */}
          <div className="relative" ref={colPickerRef}>
            <button
              onClick={() => setColPickerOpen(!colPickerOpen)}
              className={clsx(
                "p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-600 cursor-pointer shadow-2xs",
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

          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={clsx(
              'btn-secondary h-9 py-0 px-3 text-xs flex items-center gap-1.5 font-bold cursor-pointer rounded-lg',
              filtersOpen && 'bg-blue-50 border-blue-200 text-blue-600'
            )}
          >
            <Filter size={13} className={filtersOpen ? 'text-blue-600' : 'text-slate-500'} /> <span>Filters</span>
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
          {['HEALTH', 'LIFE', 'ACCIDENT', 'TRAVEL'].map(cat => {
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
            <DatePicker
              className="input text-xs"
              value={durationFrom}
              onChange={val => { setDurationFrom(val); setPage(1); }}
            />
          </div>
          <div>
            <label className="label">Duration End Date</label>
            <DatePicker
              className="input text-xs"
              value={durationTo}
              onChange={val => { setDurationTo(val); setPage(1); }}
            />
          </div>

          <div className="col-span-1 sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Renewal Due</label>
              <div className="flex items-center gap-2">
                <DatePicker className="input text-xs min-w-[130px]" value={renewalFrom} onChange={val => { setRenewalFrom(val); setPage(1); }} title="From" />
                <span className="text-gray-400 shrink-0">-</span>
                <DatePicker className="input text-xs min-w-[130px]" value={renewalTo} onChange={val => { setRenewalTo(val); setPage(1); }} title="To" />
              </div>
            </div>
            <div>
              <label className="label">Payment Due</label>
              <div className="flex items-center gap-2">
                <DatePicker className="input text-xs min-w-[130px]" value={paymentDueFrom} onChange={val => { setPaymentDueFrom(val); setPage(1); }} title="From" />
                <span className="text-gray-400 shrink-0">-</span>
                <DatePicker className="input text-xs min-w-[130px]" value={paymentDueTo} onChange={val => { setPaymentDueTo(val); setPage(1); }} title="To" />
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
      </>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editTarget ? "Edit Policy Profile" : "Add New Policy"}
        subtitle={editTarget ? "Update policy details and plan information." : "Enter policy details matching client profile standards."}
        size="2xl"
        actions={
          <div className="flex items-center gap-2.5 mr-1">
            <button
              type="button"
              className="px-5 py-2 text-xs font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl cursor-pointer shadow-md shadow-blue-500/20 transition-all hover:scale-105"
              onClick={handleSubmit(onSubmit)}
            >
              {editTarget ? 'Update Policy' : 'Save Policy'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {/* Sub-navigation 4 Tabs Header matching Add New Contact style */}
          <div className="flex bg-slate-200/60 p-1.5 rounded-2xl mb-3 gap-2 border border-slate-200/80 overflow-x-auto shadow-2xs">
            <button
              type="button"
              onClick={() => setActivePolicyTab('policyPlan')}
              className={clsx(
                'px-4 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-2',
                activePolicyTab === 'policyPlan'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              )}
            >
              <Shield size={14} />
              Policy & Plan Details
            </button>
            <button
              type="button"
              onClick={() => setActivePolicyTab('premium')}
              className={clsx(
                'px-4 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-2',
                activePolicyTab === 'premium'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              )}
            >
              <CreditCard size={14} />
              Premium Details
            </button>
            <button
              type="button"
              onClick={() => setActivePolicyTab('paymentGst')}
              className={clsx(
                'px-4 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-2',
                activePolicyTab === 'paymentGst'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              )}
            >
              <Building size={14} />
              Payment & GST Details
            </button>
            <button
              type="button"
              onClick={() => setActivePolicyTab('connectedPersons')}
              className={clsx(
                'px-4 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-2',
                activePolicyTab === 'connectedPersons'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              )}
            >
              <Users size={14} />
              Connected Persons ({connectedPersons.length})
            </button>
            <button
              type="button"
              onClick={() => setActivePolicyTab('phcDetails')}
              className={clsx(
                'px-4 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-2',
                activePolicyTab === 'phcDetails'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              )}
            >
              <Activity size={14} />
              Preventive Health Checkup
            </button>
            <button
              type="button"
              onClick={() => setActivePolicyTab('policyDocs')}
              className={clsx(
                'px-4 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-2',
                activePolicyTab === 'policyDocs'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              )}
            >
              <FileText size={14} />
              Policy Documents
            </button>
            <button
              type="button"
              onClick={() => setActivePolicyTab('policyClaims')}
              className={clsx(
                'px-4 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-2',
                activePolicyTab === 'policyClaims'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              )}
            >
              <FileCheck2 size={14} />
              Claims
            </button>
          </div>

          <div className="h-[520px] overflow-y-auto pr-2 custom-scrollbar space-y-4">
            {/* ════════════════ TAB 1: Policy Details + Plan Details ════════════════ */}
            {activePolicyTab === 'policyPlan' && (
              <div className="space-y-4 animate-fadeIn">
                {/* Section 1: Policy Details */}
                <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => setIsPolicyDetailsCollapsed(prev => !prev)}
                  >
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">1</span>
                      Policy Details
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Base Policy Configuration</span>
                      <ChevronDown
                        size={16}
                        className={`text-slate-500 transition-transform duration-200 ${isPolicyDetailsCollapsed ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>

                  {!isPolicyDetailsCollapsed && (
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {/* Customer Picker */}
                      <div className="col-span-1 md:col-span-2 relative flex flex-col gap-1">
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-0.5">
                          Customer <span className="text-red-500">*</span>
                        </label>
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
                            className="input w-full pr-10 h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                          <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>
                        {contactDropdown && !selectedContact && (
                          <ul className="absolute z-50 mt-12 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
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

                      {/* Policy Type */}
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Policy Type <span className="text-red-500">*</span>
                        </label>
                        <select
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          value={selectedType}
                          onChange={e => {
                            setSelectedType(e.target.value);
                            setSelectedCompany('');
                            setSelectedPlan(null);
                            setValue('planId', '');
                          }}
                        >
                          <option value="">Select Policy Type</option>
                          {availableTypes.map(t => (
                            <option key={t} value={t}>
                              {t === 'HEALTH' ? 'Health' : t === 'LIFE' ? 'Life' : t.charAt(0) + t.slice(1).toLowerCase()}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Insurance Company Category */}
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Insurance Company Category
                        </label>
                        <select
                          className="input w-full h-10 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-600 cursor-not-allowed"
                          value={selectedType || ''}
                          disabled
                        >
                          <option value="">Auto-selected based on Policy Type</option>
                          {availableTypes.map(t => (
                            <option key={t} value={t}>
                              {t === 'HEALTH' ? 'Health Insurance Category' : t === 'LIFE' ? 'Life Insurance Category' : `${t} Category`}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Insurance Company */}
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Insurance Company <span className="text-red-500">*</span>
                        </label>
                        <select
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          value={selectedCompany}
                          onChange={e => {
                            setSelectedCompany(e.target.value);
                            setSelectedPlan(null);
                            setValue('planId', '');
                          }}
                          disabled={!selectedType}
                        >
                          <option value="">Select Insurance Company</option>
                          {availableCompanies.map(c => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Insurance Plan Category */}
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Insurance Plan Category
                        </label>
                        <input
                          type="text"
                          readOnly
                          className="input w-full h-10 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-600 cursor-not-allowed"
                          value={selectedPlan?.category || (selectedType ? `${selectedType} Plan` : '')}
                          placeholder="Insurance Plan Category"
                        />
                      </div>

                      {/* Plan Name */}
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Plan Name <span className="text-red-500">*</span>
                        </label>
                        <select
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          value={selectedPlan?.id || ''}
                          onChange={e => {
                            const p = plansList.find((x: any) => x.id === e.target.value);
                            setSelectedPlan(p || null);
                            setValue('planId', p?.id || '', { shouldValidate: true });
                          }}
                          disabled={!selectedCompany}
                        >
                          <option value="">Select Plan Name</option>
                          {availablePlans.map((p: any) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Customer Category */}
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Customer Category
                        </label>
                        <select className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                          <option value="INDIVIDUAL">Individual</option>
                          <option value="FAMILY_FLOATER">Family Floater</option>
                          <option value="CORPORATE_GROUP">Corporate / Group</option>
                          <option value="SENIOR_CITIZEN">Senior Citizen</option>
                        </select>
                      </div>

                      {/* Agent Name */}
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Agent Name
                        </label>
                        <input
                          type="text"
                          readOnly
                          className="input w-full h-10 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-600"
                          value={user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Agent'}
                        />
                      </div>

                      {/* Comment */}
                      <div className="col-span-1 md:col-span-2">
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Comment
                        </label>
                        <textarea
                          rows={2}
                          className="input w-full p-2.5 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="Add any internal comments or notes regarding this policy..."
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 2: Plan Details */}
                <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-50/80 via-slate-50 to-purple-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => setIsPlanDetailsCollapsed(prev => !prev)}
                  >
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">2</span>
                      Plan Details
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Coverage & Plan Options</span>
                      <ChevronDown
                        size={16}
                        className={`text-slate-500 transition-transform duration-200 ${isPlanDetailsCollapsed ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>

                  {!isPlanDetailsCollapsed && (
                    <div className="p-4 space-y-4 animate-fadeIn">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                        {/* Policy Number */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            Policy Number <span className="text-red-500">*</span>
                          </label>
                          <input
                            {...register('policyNumber')}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="Enter policy number"
                          />
                        </div>

                        {/* Family Size */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            Family Size
                          </label>
                          <select className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                            <option value="1">1 Adult (Individual)</option>
                            <option value="2">2 Adults (1A + 1A)</option>
                            <option value="2_1">2 Adults + 1 Child</option>
                            <option value="2_2">2 Adults + 2 Children</option>
                            <option value="2_3">2 Adults + 3 Children</option>
                            <option value="1_1">1 Adult + 1 Child</option>
                            <option value="1_2">1 Adult + 2 Children</option>
                          </select>
                        </div>

                        {/* Policy Zone Location Tier */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            Policy Zone Location Tier
                          </label>
                          <select className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                            <option value="ZONE_1">Zone 1 (Metro / Tier 1)</option>
                            <option value="ZONE_2">Zone 2 (Tier 2)</option>
                            <option value="ZONE_3">Zone 3 (Rest of India)</option>
                          </select>
                        </div>

                        {/* Policy Zone Location Pincode */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            Policy Zone Location Pincode
                          </label>
                          <input
                            type="text"
                            maxLength={6}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="e.g. 400001"
                          />
                        </div>

                        {/* Sum Insured */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            Sum Insured (₹) <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <Shield size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500/80" />
                            <input
                              {...register('sumAssured')}
                              type="number"
                              className="input pl-9 w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              placeholder="Enter sum insured"
                            />
                          </div>
                        </div>

                        {/* Deductible */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            Deductible
                          </label>
                          <input
                            {...register('deductible')}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="Enter deductible if any"
                          />
                        </div>

                        {/* Bonus 1 */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            Bonus 1 (No Claim Bonus)
                          </label>
                          <input
                            type="text"
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="e.g. 50% NCB Bonus"
                          />
                        </div>

                        {/* Bonus 2 */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            Bonus 2 (Super / Cumulative)
                          </label>
                          <input
                            type="text"
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="e.g. Cumulative Super Bonus"
                          />
                        </div>

                        {/* Policy Status */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            Policy Status <span className="text-red-500">*</span>
                          </label>
                          <select
                            {...register('status')}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          >
                            <option value="ACTIVE">Active (Inforce)</option>
                            <option value="EXPIRED">Expired</option>
                            <option value="LAPSED">Lapsed</option>
                            <option value="CANCELLED">Cancelled</option>
                            <option value="SURRENDERED">Surrendered</option>
                          </select>
                        </div>

                        {/* Assigned To */}
                        {user?.role !== 'EMPLOYEE' && (
                          <div>
                            <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                              Assigned To
                            </label>
                            <select
                              {...register('assignedEmployeeId')}
                              className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                      </div>

                      {/* Riders / Addons */}
                      <div className="flex flex-col gap-1 pt-2">
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Riders / Addons
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
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
                              <span className="text-[11px] font-medium">{rider.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ════════════════ TAB 2: Premium Details ════════════════ */}
            {activePolicyTab === 'premium' && (
              <div className="space-y-4 animate-fadeIn">
                {/* Section 1: Premium Breakdown & Instalments */}
                <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-50/80 via-slate-50 to-teal-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => setIsPremiumBreakdownCollapsed(prev => !prev)}
                  >
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">1</span>
                      Premium Breakdown & Instalments
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Premium Amounts & Frequency</span>
                      <ChevronDown
                        size={16}
                        className={`text-slate-500 transition-transform duration-200 ${isPremiumBreakdownCollapsed ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>

                  {!isPremiumBreakdownCollapsed && (
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3.5 animate-fadeIn">
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Premium Amount (₹) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Shield size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500/80" />
                          <input
                            {...register('premiumAmount')}
                            type="number"
                            className="input pl-9 w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="Enter premium amount"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          1st Year Premium Amount (₹)
                        </label>
                        <input
                          type="number"
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="1st Year Premium"
                        />
                      </div>

                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          2nd Year Onwards Premium Amount (₹)
                        </label>
                        <input
                          type="number"
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="2nd Year Onwards Premium"
                        />
                      </div>

                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Installment Frequency <span className="text-red-500">*</span>
                        </label>
                        <select
                          {...register('paymentFrequency')}
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <option value="YEARLY">Yearly</option>
                          <option value="HALF_YEARLY">Half Yearly</option>
                          <option value="QUARTERLY">Quarterly</option>
                          <option value="MONTHLY">Monthly</option>
                          <option value="SINGLE">One Time</option>
                        </select>
                      </div>

                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Premium Payment Period (Years)
                        </label>
                        <input
                          type="number"
                          {...register('premiumPaymentPeriod')}
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="e.g. 10"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 2: Policy Tenure & Term Dates */}
                <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => setIsTenureDatesCollapsed(prev => !prev)}
                  >
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">2</span>
                      Tenure, Maturity & Term Dates
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Tenure & Policy Dates</span>
                      <ChevronDown
                        size={16}
                        className={`text-slate-500 transition-transform duration-200 ${isTenureDatesCollapsed ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>

                  {!isTenureDatesCollapsed && (
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3.5 animate-fadeIn">
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Policy Tenure (Years)
                        </label>
                        <select
                          value={durationYears}
                          onChange={e => setDurationYears(Number(e.target.value))}
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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

                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Policy Term
                        </label>
                        <input
                          type="text"
                          className="input w-full h-10 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-600"
                          value={`${durationYears} Years`}
                          readOnly
                        />
                      </div>

                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Policy Start Date <span className="text-red-500">*</span>
                        </label>
                        <DatePicker {...register('startDate')} className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200" />
                      </div>

                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Policy End Date
                        </label>
                        <DatePicker {...register('endDate')} className="input w-full h-10 text-xs rounded-xl bg-slate-50 border border-slate-200" disabled />
                      </div>

                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Date of Maturity
                        </label>
                        <DatePicker
                          {...register('endDate')}
                          className="input w-full h-10 text-xs rounded-xl bg-slate-50 border border-slate-200"
                          disabled
                        />
                      </div>

                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Policy 1st Instalment Date
                        </label>
                        <DatePicker
                          {...register('firstPremiumDate')}
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                        />
                      </div>

                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Last Premium Date
                        </label>
                        <DatePicker
                          {...register('lastPremiumDate')}
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                        />
                      </div>

                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Age at Entry
                        </label>
                        <input
                          type="number"
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="e.g. 30"
                        />
                      </div>

                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Age at Last Premium
                        </label>
                        <input
                          type="number"
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="e.g. 45"
                        />
                      </div>

                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Age at Maturity
                        </label>
                        <input
                          type="number"
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="e.g. 50"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 3: Installment / EMI Gateway Details */}
                <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => setIsEmiDetailsCollapsed(prev => !prev)}
                  >
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-600 to-blue-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">3</span>
                      Installment / EMI Gateway Details
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Gateway & Installment Case</span>
                      <ChevronDown
                        size={16}
                        className={`text-slate-500 transition-transform duration-200 ${isEmiDetailsCollapsed ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>

                  {!isEmiDetailsCollapsed && (
                    <div className="p-4 space-y-3 animate-fadeIn">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            Installment Case?
                          </label>
                          <select
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            onChange={e => setValue('emiCase', e.target.value === 'yes')}
                          >
                            <option value="no">No</option>
                            <option value="yes">Yes</option>
                          </select>
                        </div>
                      </div>

                      {watchEmiCase && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 p-3.5 bg-blue-50/40 rounded-xl border border-blue-100 animate-fadeIn">
                          <div>
                            <label className="label text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block mb-1">
                              Installment Gateway
                            </label>
                            <select
                              {...register('emiGateway')}
                              className="input w-full h-10 text-xs rounded-xl bg-white border border-blue-200"
                            >
                              <option value="">Select Gateway</option>
                              <option value="FIBE">FIBE</option>
                              <option value="Shopse">Shopse</option>
                              <option value="BimaPay">BimaPay</option>
                            </select>
                          </div>
                          <div>
                            <label className="label text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block mb-1">
                              Installment Date
                            </label>
                            <select
                              {...register('emiDate')}
                              className="input w-full h-10 text-xs rounded-xl bg-white border border-blue-200"
                            >
                              <option value="">Select Date</option>
                              {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                                <option key={d} value={String(d)}>{d}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="label text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block mb-1">
                              Installment Amount (₹)
                            </label>
                            <input
                              type="number"
                              {...register('emiPremium')}
                              className="input w-full h-10 text-xs rounded-xl bg-white border border-blue-200"
                              placeholder="Installment Amount"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Section 4: Payment Mode & Loan Details */}
                <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => setIsPaymentModeLoanCollapsed(prev => !prev)}
                  >
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">4</span>
                      Payment Mode & Loan Details
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Payment Method & Financed Loan</span>
                      <ChevronDown
                        size={16}
                        className={`text-slate-500 transition-transform duration-200 ${isPaymentModeLoanCollapsed ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>

                  {!isPaymentModeLoanCollapsed && (
                    <div className="p-4 space-y-4 animate-fadeIn">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            Payment Mode
                          </label>
                          <select
                            value={paymentModeDetails.paymentMode}
                            onChange={e => setPaymentModeDetails(p => ({ ...p, paymentMode: e.target.value }))}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          >
                            <option value="ONLINE">UPI / NetBanking / Online</option>
                            <option value="CHEQUE">Cheque</option>
                            <option value="NEFT_RTGS">NEFT / RTGS</option>
                            <option value="CREDIT_CARD">Credit Card</option>
                            <option value="AUTO_DEBIT">Auto Debit / NACH</option>
                            <option value="CASH">Cash</option>
                          </select>
                        </div>

                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            Payment Transaction / Cheque Date
                          </label>
                          <DatePicker
                            value={paymentModeDetails.paymentDate}
                            onDateChange={(val: string) => setPaymentModeDetails(p => ({ ...p, paymentDate: val }))}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                          />
                        </div>

                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            Transaction Ref / Cheque No.
                          </label>
                          <input
                            type="text"
                            value={paymentModeDetails.transactionRef}
                            onChange={e => setPaymentModeDetails(p => ({ ...p, transactionRef: e.target.value }))}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="e.g. TXN987654321 / CHQ0012"
                          />
                        </div>

                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            Loan Case / Financed Policy?
                          </label>
                          <select
                            value={paymentModeDetails.isLoanCase ? 'yes' : 'no'}
                            onChange={e => setPaymentModeDetails(p => ({ ...p, isLoanCase: e.target.value === 'yes' }))}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          >
                            <option value="no">No</option>
                            <option value="yes">Yes</option>
                          </select>
                        </div>
                      </div>

                      {paymentModeDetails.isLoanCase && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 p-3.5 bg-purple-50/40 rounded-xl border border-purple-100 animate-fadeIn">
                          <div>
                            <label className="label text-[10px] font-extrabold text-purple-800 uppercase tracking-wider block mb-1">Loan Amount (₹)</label>
                            <input
                              type="number"
                              value={paymentModeDetails.loanAmount}
                              onChange={e => setPaymentModeDetails(p => ({ ...p, loanAmount: e.target.value }))}
                              className="input w-full h-10 text-xs rounded-xl bg-white border border-purple-200"
                              placeholder="Loan Amount"
                            />
                          </div>
                          <div>
                            <label className="label text-[10px] font-extrabold text-purple-800 uppercase tracking-wider block mb-1">Loan Provider (Bank / NBFC)</label>
                            <input
                              type="text"
                              value={paymentModeDetails.loanProvider}
                              onChange={e => setPaymentModeDetails(p => ({ ...p, loanProvider: e.target.value }))}
                              className="input w-full h-10 text-xs rounded-xl bg-white border border-purple-200"
                              placeholder="e.g. Bajaj Finserv"
                            />
                          </div>
                          <div>
                            <label className="label text-[10px] font-extrabold text-purple-800 uppercase tracking-wider block mb-1">Loan Sanction No.</label>
                            <input
                              type="text"
                              value={paymentModeDetails.loanSanctionNo}
                              onChange={e => setPaymentModeDetails(p => ({ ...p, loanSanctionNo: e.target.value }))}
                              className="input w-full h-10 text-xs rounded-xl bg-white border border-purple-200"
                              placeholder="Sanction No."
                            />
                          </div>
                          <div>
                            <label className="label text-[10px] font-extrabold text-purple-800 uppercase tracking-wider block mb-1">Loan EMI Amount (₹)</label>
                            <input
                              type="number"
                              value={paymentModeDetails.loanEmi}
                              onChange={e => setPaymentModeDetails(p => ({ ...p, loanEmi: e.target.value }))}
                              className="input w-full h-10 text-xs rounded-xl bg-white border border-purple-200"
                              placeholder="EMI Amount"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Section 5: Conditional PHC Details */}
                {(selectedType?.toUpperCase() === 'HEALTH' || selectedPlan?.category?.toUpperCase() === 'HEALTH') && (
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-teal-50/80 via-slate-50 to-emerald-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                      onClick={() => setIsPhcCollapsed(prev => !prev)}
                    >
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-teal-600 to-emerald-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">5</span>
                        Preventive Health Checkup Details
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-semibold">PHC Benefits & Status</span>
                        <ChevronDown
                          size={16}
                          className={`text-slate-500 transition-transform duration-200 ${isPhcCollapsed ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </div>

                    {!isPhcCollapsed && (
                      <div className="p-4 space-y-3 animate-fadeIn">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          <div>
                            <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                              Preventive Health Checkup?
                            </label>
                            <select
                              className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                              onChange={e => setValue('phcRequired', e.target.value === 'yes')}
                            >
                              <option value="no">No</option>
                              <option value="yes">Yes</option>
                            </select>
                          </div>
                        </div>
                        {watchPhcRequired && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 p-3.5 bg-emerald-50/40 rounded-xl border border-emerald-100">
                            <div>
                              <label className="label text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block mb-1">PHC Amount (₹)</label>
                              <input
                                type="number"
                                {...register('phcAmount')}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-emerald-200"
                                placeholder="Amount"
                              />
                            </div>
                            <div>
                              <label className="label text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block mb-1">PHC Status</label>
                              <select
                                {...register('phcStatus')}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-emerald-200"
                              >
                                <option value="">Select Status</option>
                                <option value="SCHEDULED">Scheduled</option>
                                <option value="COMPLETED">Completed</option>
                                <option value="CANCELLED">Cancelled</option>
                              </select>
                            </div>
                            <div>
                              <label className="label text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block mb-1">PHC Claim Settled?</label>
                              <select
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-emerald-200"
                                onChange={e => setValue('phcClaimSettled', e.target.value === 'yes')}
                              >
                                <option value="no">No</option>
                                <option value="yes">Yes</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}

            {/* ════════════════ TAB 3: Payment Account Details + GST No Details ════════════════ */}
            {activePolicyTab === 'paymentGst' && (
              <div className="space-y-4 animate-fadeIn">
                {/* Section 1: Payment Account Details */}
                <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => setIsPaymentAccountCollapsed(prev => !prev)}
                  >
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">1</span>
                      Payment Account Details
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Bank & Account Specifications</span>
                      <ChevronDown
                        size={16}
                        className={`text-slate-500 transition-transform duration-200 ${isPaymentAccountCollapsed ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>

                  {!isPaymentAccountCollapsed && (
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5 animate-fadeIn">
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Bank Name
                        </label>
                        <input
                          type="text"
                          value={paymentAccount.bankName}
                          onChange={e => setPaymentAccount(p => ({ ...p, bankName: e.target.value }))}
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="e.g. HDFC Bank / State Bank of India"
                        />
                      </div>

                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          IFSC Code
                        </label>
                        <input
                          type="text"
                          value={paymentAccount.ifscCode}
                          onChange={e => setPaymentAccount(p => ({ ...p, ifscCode: e.target.value.toUpperCase() }))}
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase"
                          placeholder="e.g. HDFC0001234"
                        />
                      </div>

                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Branch Name
                        </label>
                        <input
                          type="text"
                          value={paymentAccount.branch}
                          onChange={e => setPaymentAccount(p => ({ ...p, branch: e.target.value }))}
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="e.g. Connaught Place Branch"
                        />
                      </div>

                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          A/c No. (Account Number)
                        </label>
                        <input
                          type="text"
                          value={paymentAccount.accountNo}
                          onChange={e => setPaymentAccount(p => ({ ...p, accountNo: e.target.value }))}
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="e.g. 50100234567890"
                        />
                      </div>

                      <div className="col-span-1 md:col-span-2">
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Account Type
                        </label>
                        <select
                          value={paymentAccount.accountType}
                          onChange={e => setPaymentAccount(p => ({ ...p, accountType: e.target.value }))}
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <option value="SAVINGS">Savings Account</option>
                          <option value="CURRENT">Current Account</option>
                          <option value="OVERDRAFT">Overdraft Account (OD)</option>
                          <option value="NRE_NRO">NRE / NRO Account</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 2: GST No Details */}
                <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-50/80 via-slate-50 to-teal-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => setIsGstDetailsCollapsed(prev => !prev)}
                  >
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">2</span>
                      GST No Details
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Firm Name, PAN & GST Registration</span>
                      <ChevronDown
                        size={16}
                        className={`text-slate-500 transition-transform duration-200 ${isGstDetailsCollapsed ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>

                  {!isGstDetailsCollapsed && (
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3.5 animate-fadeIn">
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Firm Name
                        </label>
                        <input
                          type="text"
                          value={gstDetails.firmName}
                          onChange={e => setGstDetails(p => ({ ...p, firmName: e.target.value }))}
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="Registered Company / Firm Name"
                        />
                      </div>

                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Firm PAN No.
                        </label>
                        <input
                          type="text"
                          maxLength={10}
                          value={gstDetails.firmPan}
                          onChange={e => setGstDetails(p => ({ ...p, firmPan: e.target.value.toUpperCase() }))}
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase"
                          placeholder="e.g. ABCDE1234F"
                        />
                      </div>

                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Firm GST No.
                        </label>
                        <input
                          type="text"
                          maxLength={15}
                          value={gstDetails.firmGst}
                          onChange={e => setGstDetails(p => ({ ...p, firmGst: e.target.value.toUpperCase() }))}
                          className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase"
                          placeholder="e.g. 27ABCDE1234F1Z5"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ════════════════ TAB 4: Connected Person Details ════════════════ */}
            {activePolicyTab === 'connectedPersons' && (
              <div className="space-y-4 animate-fadeIn">
                {/* Header & Add Button */}
                <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-blue-50/90 to-indigo-50/50 rounded-2xl border border-blue-100 shadow-2xs">
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Users size={16} className="text-blue-600" />
                      Connected Persons & Nominee Details
                    </h4>
                    <p className="text-[11px] text-slate-500">Add dependents, covered persons, and allocate nominee percentage.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addConnectedPerson}
                    className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all hover:scale-105 cursor-pointer"
                  >
                    <Plus size={14} /> Add Connected Person
                  </button>
                </div>

                {/* Nominee Allocation Percentage Summary Bar */}
                {connectedPersons.some(p => p.isNominee) && (
                  <div
                    className={clsx(
                      'p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all',
                      totalNomineePercentage === 100
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {totalNomineePercentage === 100 ? (
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                      )}
                      <span>
                        {totalNomineePercentage === 100
                          ? 'Nominee percentage allocation complete (100% total).'
                          : `Nominee percentage total must equal 100%. Currently allocated: ${totalNomineePercentage}%.`}
                      </span>
                    </div>
                    <span
                      className={clsx(
                        'px-2.5 py-1 rounded-lg text-xs font-black',
                        totalNomineePercentage === 100 ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                      )}
                    >
                      {totalNomineePercentage}%
                    </span>
                  </div>
                )}

                {/* Connected Persons List */}
                {connectedPersons.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
                      <Users size={20} />
                    </div>
                    <h5 className="text-xs font-extrabold text-slate-700">No Connected Persons Added Yet</h5>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Add family members, dependents, or nominees associated with this policy.
                    </p>
                    <button
                      type="button"
                      onClick={addConnectedPerson}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus size={14} /> Add First Connected Person
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {connectedPersons.map((person, idx) => (
                      <div
                        key={person.id}
                        className="border border-slate-200 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all p-4 space-y-3.5"
                      >
                        {/* Header Bar per Person */}
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-extrabold text-xs flex items-center justify-center border border-slate-200">
                              {idx + 1}
                            </span>
                            <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wide">
                              {person.name || `Connected Person #${idx + 1}`}
                            </span>
                            {person.isCovered && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Covered under policy
                              </span>
                            )}
                            {person.isNominee && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
                                Nominee ({person.nomineePercentage}%)
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeConnectedPerson(person.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Remove Person"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {/* Person Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div>
                            <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                              Full Name
                            </label>
                            <input
                              type="text"
                              value={person.name}
                              onChange={e => updateConnectedPerson(person.id, { name: e.target.value })}
                              className="input w-full h-9 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              placeholder="e.g. Sunita Sharma"
                            />
                          </div>

                          <div>
                            <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                              Relationship
                            </label>
                            <select
                              value={person.relationship}
                              onChange={e => updateConnectedPerson(person.id, { relationship: e.target.value })}
                              className="input w-full h-9 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            >
                              <option value="Spouse">Spouse</option>
                              <option value="Son">Son</option>
                              <option value="Daughter">Daughter</option>
                              <option value="Father">Father</option>
                              <option value="Mother">Mother</option>
                              <option value="Brother">Brother</option>
                              <option value="Sister">Sister</option>
                              <option value="Dependent">Dependent</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>

                          <div>
                            <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                              Contact No.
                            </label>
                            <input
                              type="tel"
                              value={person.contactNo}
                              onChange={e => updateConnectedPerson(person.id, { contactNo: e.target.value })}
                              className="input w-full h-9 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              placeholder="e.g. +91 9876543210"
                            />
                          </div>

                          <div>
                            <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                              Gender
                            </label>
                            <select
                              value={person.gender}
                              onChange={e => updateConnectedPerson(person.id, { gender: e.target.value })}
                              className="input w-full h-9 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            >
                              <option value="MALE">Male</option>
                              <option value="FEMALE">Female</option>
                              <option value="OTHER">Other</option>
                            </select>
                          </div>
                        </div>

                        {/* Covered & Nominee Toggles */}
                        <div className="flex items-center gap-6 pt-1 border-t border-slate-100">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={person.isCovered}
                              onChange={e => updateConnectedPerson(person.id, { isCovered: e.target.checked })}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-xs font-bold text-slate-700">Covered under this policy</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={person.isNominee}
                              onChange={e => updateConnectedPerson(person.id, { isNominee: e.target.checked })}
                              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                            />
                            <span className="text-xs font-bold text-slate-700">Set as Nominee</span>
                          </label>
                        </div>

                        {/* Dynamic Nominee Fields Box */}
                        {person.isNominee && (
                          <div className="p-3 bg-purple-50/40 rounded-xl border border-purple-100 space-y-2.5 animate-fadeIn">
                            <h6 className="text-[11px] font-extrabold text-purple-800 uppercase tracking-wider flex items-center gap-1.5">
                              Nominee Specification
                            </h6>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                              <div>
                                <label className="label text-[10px] font-extrabold text-purple-700 uppercase tracking-wider block mb-1">Nominee Name</label>
                                <input
                                  type="text"
                                  value={person.nomineeName || person.name}
                                  onChange={e => updateConnectedPerson(person.id, { nomineeName: e.target.value })}
                                  className="input w-full h-9 text-xs rounded-xl bg-white border border-purple-200"
                                  placeholder="Nominee Full Name"
                                />
                              </div>

                              <div>
                                <label className="label text-[10px] font-extrabold text-purple-700 uppercase tracking-wider block mb-1">Relationship</label>
                                <input
                                  type="text"
                                  value={person.nomineeRelation || person.relationship}
                                  onChange={e => updateConnectedPerson(person.id, { nomineeRelation: e.target.value })}
                                  className="input w-full h-9 text-xs rounded-xl bg-white border border-purple-200"
                                  placeholder="e.g. Wife / Son"
                                />
                              </div>

                              <div>
                                <label className="label text-[10px] font-extrabold text-purple-700 uppercase tracking-wider block mb-1">Contact No.</label>
                                <input
                                  type="tel"
                                  value={person.nomineeContact || person.contactNo}
                                  onChange={e => updateConnectedPerson(person.id, { nomineeContact: e.target.value })}
                                  className="input w-full h-9 text-xs rounded-xl bg-white border border-purple-200"
                                  placeholder="Nominee Phone"
                                />
                              </div>

                              <div>
                                <label className="label text-[10px] font-extrabold text-purple-700 uppercase tracking-wider block mb-1">Nominee Share (%)</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={100}
                                  value={person.nomineePercentage}
                                  onChange={e => updateConnectedPerson(person.id, { nomineePercentage: Number(e.target.value) })}
                                  className="input w-full h-9 text-xs rounded-xl bg-white border border-purple-200 font-bold text-purple-900"
                                  placeholder="100"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ════════════════ TAB 5: Preventive Health Checkup ════════════════ */}
            {activePolicyTab === 'phcDetails' && (
              <div className="space-y-4 animate-fadeIn">
                {/* Section 1: Preventive Health Checkup Details (Health policies only) */}
                {(selectedType?.toUpperCase() === 'HEALTH' || selectedPlan?.category?.toUpperCase() === 'HEALTH') ? (
                  <div className="space-y-4">
                    {/* Card 1A: PHC Configuration & Eligibility */}
                    <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-teal-50/80 via-slate-50 to-emerald-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                        onClick={() => setIsPhcCollapsed(prev => !prev)}
                      >
                        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-gradient-to-br from-teal-600 to-emerald-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">1</span>
                          PHC Configuration & Eligibility
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-semibold">PHC Benefits & Eligibility</span>
                          <ChevronDown
                            size={16}
                            className={`text-slate-500 transition-transform duration-200 ${isPhcCollapsed ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </div>

                      {!isPhcCollapsed && (
                        <div className="p-4 space-y-3.5 animate-fadeIn">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                                Preventive Health Checkup?
                              </label>
                              <select
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                value={watchPhcRequired ? 'yes' : 'no'}
                                onChange={e => setValue('phcRequired', e.target.value === 'yes')}
                              >
                                <option value="no">No</option>
                                <option value="yes">Yes</option>
                              </select>
                            </div>

                            {watchPhcRequired && (
                              <>
                                <div>
                                  <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">PHC Amount (₹)</label>
                                  <input
                                    type="number"
                                    {...register('phcAmount')}
                                    className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    placeholder="e.g. 5000"
                                  />
                                </div>

                                <div>
                                  <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">PHC Balance Amount (₹)</label>
                                  <input
                                    type="text"
                                    value={phcExtraDetails.balanceAmount ? `₹${phcExtraDetails.balanceAmount}` : '₹1,500'}
                                    onChange={e => setPhcExtraDetails(p => ({ ...p, balanceAmount: e.target.value.replace(/[^0-9]/g, '') }))}
                                    className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-800"
                                    placeholder="₹1,500"
                                  />
                                </div>

                                <div>
                                  <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">PHC Eligibility Start Date</label>
                                  <DatePicker
                                    value={phcExtraDetails.eligibilityStartDate}
                                    onDateChange={(val: string) => setPhcExtraDetails(p => ({ ...p, eligibilityStartDate: val }))}
                                    className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  />
                                </div>

                                <div>
                                  <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">PHC Frequency</label>
                                  <select
                                    value={phcExtraDetails.frequency || 'ANNUAL'}
                                    onChange={e => setPhcExtraDetails(p => ({ ...p, frequency: e.target.value }))}
                                    className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                                  >
                                    <option value="ANNUAL">Annual</option>
                                    <option value="BI_ANNUAL">Bi-Annual</option>
                                    <option value="ONCE_TENURE">Once Per Tenure</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">PHC Status</label>
                                  <select
                                    {...register('phcStatus')}
                                    className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  >
                                    <option value="">Select Status</option>
                                    <option value="NOT_INTERESTED">Not Interested</option>
                                    <option value="INTERESTED">Interested</option>
                                    <option value="REMIND_LATER">Remind Later</option>
                                    <option value="FULLY_UTILISED">Fully Utilised</option>
                                    <option value="PARTIAL_UTILISED">Partial Utilised</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Follow-up Date</label>
                                  <DatePicker
                                    value={phcExtraDetails.followUpDate}
                                    onDateChange={(val: string) => setPhcExtraDetails(p => ({ ...p, followUpDate: val }))}
                                    className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  />
                                </div>

                                <div className="col-span-1 md:col-span-3">
                                  <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Comment</label>
                                  <textarea
                                    rows={2}
                                    className="input w-full p-2.5 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    placeholder="Add any comment regarding preventive health checkup..."
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card 1B: PHC Booking & Centre Details */}
                    {watchPhcRequired && (
                      <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                          onClick={() => setIsPhcBookingCollapsed(prev => !prev)}
                        >
                          <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">2</span>
                            PHC Booking & Centre Details
                          </h4>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-semibold">Appointment & Lab Information</span>
                            <ChevronDown
                              size={16}
                              className={`text-slate-500 transition-transform duration-200 ${isPhcBookingCollapsed ? 'rotate-180' : ''}`}
                            />
                          </div>
                        </div>

                        {!isPhcBookingCollapsed && (
                          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3.5 animate-fadeIn">
                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Insured Person Name</label>
                              <input
                                type="text"
                                value={phcExtraDetails.insuredPersonName}
                                onChange={e => setPhcExtraDetails(p => ({ ...p, insuredPersonName: e.target.value }))}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                                placeholder="e.g. Ramesh Kumar"
                              />
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">PHC Booking Date</label>
                              <DatePicker
                                value={phcExtraDetails.bookingDate}
                                onDateChange={(val: string) => setPhcExtraDetails(p => ({ ...p, bookingDate: val }))}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                              />
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">PHC Appointment Date</label>
                              <DatePicker
                                value={phcExtraDetails.appointmentDate}
                                onDateChange={(val: string) => setPhcExtraDetails(p => ({ ...p, appointmentDate: val }))}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                              />
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">PHC Centre / Lab Name</label>
                              <input
                                type="text"
                                value={phcExtraDetails.centreName}
                                onChange={e => setPhcExtraDetails(p => ({ ...p, centreName: e.target.value }))}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                                placeholder="e.g. Dr. Lal PathLabs / SRL Diagnostic"
                              />
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">PHC Centre / Lab City</label>
                              <input
                                type="text"
                                value={phcExtraDetails.centreCity}
                                onChange={e => setPhcExtraDetails(p => ({ ...p, centreCity: e.target.value }))}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                                placeholder="e.g. Mumbai / Delhi"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Card 1C: PHC Claim & Settlement Details */}
                    {watchPhcRequired && (
                      <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-emerald-50/80 via-slate-50 to-teal-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                          onClick={() => setIsPhcSettlementCollapsed(prev => !prev)}
                        >
                          <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">3</span>
                            PHC Claim & Settlement Details
                          </h4>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-semibold">Reports, Submissions & Stage</span>
                            <ChevronDown
                              size={16}
                              className={`text-slate-500 transition-transform duration-200 ${isPhcSettlementCollapsed ? 'rotate-180' : ''}`}
                            />
                          </div>
                        </div>

                        {!isPhcSettlementCollapsed && (
                          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3.5 animate-fadeIn">
                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">PHC Utilized Amount (₹)</label>
                              <input
                                type="number"
                                value={phcExtraDetails.utilizedAmount}
                                onChange={e => setPhcExtraDetails(p => ({ ...p, utilizedAmount: e.target.value }))}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                                placeholder="Utilized Amount"
                              />
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Reimbursement / Cashless</label>
                              <select
                                value={phcExtraDetails.reimbursementCashless}
                                onChange={e => setPhcExtraDetails(p => ({ ...p, reimbursementCashless: e.target.value }))}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                              >
                                <option value="CASHLESS">Cashless Checkup</option>
                                <option value="REIMBURSEMENT">Reimbursement Claim</option>
                              </select>
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Report Received Date</label>
                              <DatePicker
                                value={phcExtraDetails.reportReceivedDate}
                                onDateChange={(val: string) => setPhcExtraDetails(p => ({ ...p, reportReceivedDate: val }))}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                              />
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Report & Bill Received Date</label>
                              <DatePicker
                                value={phcExtraDetails.reportBillReceivedDate}
                                onDateChange={(val: string) => setPhcExtraDetails(p => ({ ...p, reportBillReceivedDate: val }))}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                              />
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Report & Bill Submitted Date</label>
                              <DatePicker
                                value={phcExtraDetails.reportBillSubmittedDate}
                                onDateChange={(val: string) => setPhcExtraDetails(p => ({ ...p, reportBillSubmittedDate: val }))}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                              />
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Settlement Date</label>
                              <DatePicker
                                value={phcExtraDetails.settlementDate}
                                onDateChange={(val: string) => setPhcExtraDetails(p => ({ ...p, settlementDate: val }))}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                              />
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">PHC Stage</label>
                              <select
                                value={phcExtraDetails.phcStage}
                                onChange={e => setPhcExtraDetails(p => ({ ...p, phcStage: e.target.value }))}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                              >
                                <option value="INTIMATIONS">Intimations Issued</option>
                                <option value="APPOINTMENT_FIXED">Appointment Fixed</option>
                                <option value="CHECKUP_DONE">Checkup Done</option>
                                <option value="REPORT_UPLOADED">Report Uploaded</option>
                                <option value="BILL_SUBMITTED">Bill Submitted</option>
                                <option value="CLAIM_SETTLED">Claim Settled</option>
                                <option value="CLOSED">Closed</option>
                              </select>
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">PHC Claim Settled?</label>
                              <select
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                                onChange={e => setValue('phcClaimSettled', e.target.value === 'yes')}
                              >
                                <option value="no">No</option>
                                <option value="yes">Yes</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-1">
                    <p className="text-xs font-bold text-slate-600">Preventive Health Checkup is applicable for Health Policies only.</p>
                    <p className="text-[11px] text-slate-400">Select "Health" as the Policy Type in Tab 1 to enable PHC fields.</p>
                  </div>
                )}
              </div>
            )}

            {/* ════════════════ TAB 6: Policy Documents ════════════════ */}
            {activePolicyTab === 'policyDocs' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden space-y-3">
                  <div
                    className="bg-gradient-to-r from-slate-100/80 via-slate-50 to-slate-100/50 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => setIsDocCollapsed(prev => !prev)}
                  >
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <FileText size={16} className="text-blue-600" />
                      Policy Documents Upload
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">PDF Files Attachment</span>
                      <ChevronDown
                        size={16}
                        className={`text-slate-500 transition-transform duration-200 ${isDocCollapsed ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>

                  {!isDocCollapsed && (
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
                      <div className="p-3.5 bg-blue-50/30 rounded-xl border border-blue-100 space-y-1.5">
                        <label className="label text-[10px] font-extrabold text-blue-900 uppercase tracking-wider block">Policy Document (Main PDF)</label>
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={e => setPolicyFile(e.target.files?.[0] || null)}
                          className="file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 text-xs text-slate-500 cursor-pointer w-full"
                        />
                      </div>

                      <div className="p-3.5 bg-indigo-50/30 rounded-xl border border-indigo-100 space-y-1.5">
                        <label className="label text-[10px] font-extrabold text-indigo-900 uppercase tracking-wider block">Policy Document – Endorsement</label>
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={e => setEndorsementFile(e.target.files?.[0] || null)}
                          className="file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 text-xs text-slate-500 cursor-pointer w-full"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ════════════════ TAB 7: Claims ════════════════ */}
            {activePolicyTab === 'policyClaims' && (
              <div className="space-y-4 animate-fadeIn">
                {/* Header Banner */}
                <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 via-indigo-50/50 to-slate-50 p-3.5 rounded-2xl border border-blue-100/80">
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <FileCheck2 size={16} className="text-blue-600" />
                      Policy Claims History
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Claims registered against this policy (managed via Claims page).
                    </p>
                  </div>
                </div>

                {/* Claims List / Blank State */}
                {(() => {
                  const targetPolicyId = editTarget?.id;
                  const targetPolicyNo = watch('policyNumber') || editTarget?.policyNumber;
                  const matchingClaims = (targetPolicyId || targetPolicyNo)
                    ? allClaimsList.filter((c: any) => 
                        (targetPolicyId && c.policy?.id === targetPolicyId) || 
                        (targetPolicyNo && c.policy?.policyNumber === targetPolicyNo)
                      )
                    : [];

                  if (matchingClaims.length === 0) {
                    return (
                      <div className="p-8 bg-slate-50 border border-slate-200/90 rounded-2xl text-center space-y-2">
                        <FileCheck2 size={28} className="text-slate-400 mx-auto" />
                        <p className="text-xs font-bold text-slate-700">No claims registered against this policy yet.</p>
                        <p className="text-[11px] text-slate-400">Claims can be created from the Claims page and linked to this policy.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {matchingClaims.map((c: any) => {
                        const statusStyle = (({
                          INTIMATED: 'bg-blue-50 text-blue-700 border-blue-200',
                          DOC_COLLECTION: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                          FILED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                          IN_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
                          APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                          SETTLED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                          REJECTED: 'bg-red-50 text-red-700 border-red-200',
                        } as any)[c.status]) || 'bg-slate-50 text-slate-700 border-slate-200';

                        return (
                          <div key={c.id} className="p-3.5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs hover:shadow-xs transition-all space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-xs text-slate-900">{c.claimNumber}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${statusStyle}`}>
                                  {c.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-black text-emerald-700">₹{Number(c.claimAmount || 0).toLocaleString('en-IN')}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    closeModal();
                                    navigate(`/claims`);
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                  title="Edit on Claims page"
                                >
                                  <Pencil size={12} />
                                  Edit
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                              <div><span className="font-semibold text-slate-700">Type:</span> {c.claimType}</div>
                              <div><span className="font-semibold text-slate-700">Intimated:</span> {c.intimatedAt ? format(new Date(c.intimatedAt), 'dd/MMM/yyyy') : '—'}</div>
                              <div><span className="font-semibold text-slate-700">Client:</span> {c.contact?.firstName} {c.contact?.lastName}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

    {/* Info Banner */}
    <div className="bg-blue-50/40 border border-blue-100/50 p-3 rounded-xl flex items-center gap-2.5 text-xs text-blue-700 mt-2">
      <Info size={16} className="text-blue-500 shrink-0" />
      <span>Make sure all details are accurate before saving the policy.</span>
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
