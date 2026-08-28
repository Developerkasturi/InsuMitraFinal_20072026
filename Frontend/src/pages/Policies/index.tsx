import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Plus, X, User, Shield, Pencil, Trash2, Upload, Filter, Search, Info, Save, ChevronDown, Settings, CreditCard, Building, CheckCircle2, AlertTriangle, Users, Activity, FileText, FileCheck2, Clock, Download, MessageCircle, History } from 'lucide-react';
import EmiTrackingView, { MonthPickerDropdown } from './EmiTrackingView';
import PhcTrackingView from './PhcTrackingView';
import { usePolicies, useCreatePolicy, useUpdatePolicy, useDeletePolicy, useBulkAssignPolicies } from '@hooks/usePolicies';
import { useClaims, useCreateClaim } from '@hooks/useClaims';
import { sortData } from '../../utils/sortUtils';
import { formatIndianNumber, numberToIndianWords } from '../../utils/numberUtils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { contactsService, policiesService, employeesService, claimsService, documentsService, agencyDetailsService, insuranceService } from '@api/index';
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

export const policyFormSchema = z.object({
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
  firstYearPremium: z.coerce.number().optional(),
  secondYearPremium: z.coerce.number().optional(),
});



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

export const policyEditFormSchema = z.object({
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


const ExpandableComment = ({ text }: { text: string }) => {
  if (!text || text.trim() === '') return <span className="text-slate-400">—</span>;
  if (text.length <= 60) return <span className="whitespace-normal break-words leading-relaxed block min-w-[150px] max-w-[250px]">{text}</span>;
  
  return (
    <div className="relative group flex flex-col items-start min-w-[150px] max-w-[250px]">
      <span className="line-clamp-2 whitespace-normal break-words leading-relaxed cursor-help border-b border-dashed border-slate-300">
        {text}
      </span>
      
      {/* Custom Hover Tooltip */}
      <div className="absolute z-[100] left-0 top-full mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-[300px] bg-slate-900 text-white text-xs rounded-xl p-3.5 shadow-2xl break-words whitespace-normal pointer-events-none border border-slate-700">
        <div className="absolute -top-1.5 left-4 w-3 h-3 bg-slate-900 rotate-45 border-l border-t border-slate-700" />
        <span className="relative z-10 leading-relaxed block">{text}</span>
      </div>
    </div>
  );
};

const schema = policyFormSchema;
const editSchema = policyEditFormSchema;
type Form = z.infer<typeof schema>;
type EditForm = z.infer<typeof editSchema>;

const SUM_INSURED_OPTIONS = [
  { value: '50000', label: '₹50,000' },
  { value: '100000', label: '₹1,000,000 (1 Lakh)' },
  { value: '200000', label: '₹2,000,000 (2 Lakh)' },
  { value: '300000', label: '₹3,000,000 (3 Lakh)' },
  { value: '500000', label: '₹5,000,000 (5 Lakh)' },
  { value: '750000', label: '₹7,50,000 (7.5 Lakh)' },
  { value: '1000000', label: '₹10,000,000 (10 Lakh)' },
  { value: '1500000', label: '₹15,000,000 (15 Lakh)' },
  { value: '2000000', label: '₹20,000,000 (20 Lakh)' },
  { value: '2500000', label: '₹25,000,000 (25 Lakh)' },
  { value: '5000000', label: '₹50,000,000 (50 Lakh)' },
  { value: '10000000', label: '₹100,000,000 (1 Crore)' },
];


export default function Policies() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [emiSelectedMonth, setEmiSelectedMonth] = useState('August 2026');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [keepCreateOpen, setKeepCreateOpen] = useState(false);
  const [activePolicyTab, setActivePolicyTab] = useState<'policyPlan' | 'premium' | 'paymentGst' | 'connectedPersons' | 'phcDetails' | 'policyDocs' | 'policyClaims'>('policyPlan');
  const [isPolicyDetailsCollapsed, setIsPolicyDetailsCollapsed] = useState(true);
  const [isPlanDetailsCollapsed, setIsPlanDetailsCollapsed] = useState(true);
  const [isPremiumBreakdownCollapsed, setIsPremiumBreakdownCollapsed] = useState(true);
  const [isTenureDatesCollapsed, setIsTenureDatesCollapsed] = useState(true);
  const [isEmiDetailsCollapsed, setIsEmiDetailsCollapsed] = useState(true);
  const [isPaymentModeLoanCollapsed, setIsPaymentModeLoanCollapsed] = useState(true);
  const [isPaymentAccountCollapsed, setIsPaymentAccountCollapsed] = useState(true);
  const [isGstDetailsCollapsed, setIsGstDetailsCollapsed] = useState(true);
  const [isPhcCollapsed, setIsPhcCollapsed] = useState(true);
  const [isPhcBookingCollapsed, setIsPhcBookingCollapsed] = useState(true);
  const [isPhcSettlementCollapsed, setIsPhcSettlementCollapsed] = useState(true);
  const [isDocCollapsed, setIsDocCollapsed] = useState(true);
  const [isEndorsementDocCollapsed, setIsEndorsementDocCollapsed] = useState(true);
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

  const [isDocUploadModalOpen, setIsDocUploadModalOpen] = useState(false);
  const [docUploadFields, setDocUploadFields] = useState<{ type: string; title: string; description: string; file: File | null }>({
    type: 'POLICY',
    title: '',
    description: '',
    file: null,
  });
  const [pendingDocs, setPendingDocs] = useState<{ type: string; title: string; description: string; file: File }[]>([]);

  const handleDocUploadAdd = () => {
    if (!docUploadFields.file) return toast.error('Please select a file to upload.');
    if (!docUploadFields.title) return toast.error('Please provide a document title.');
    setPendingDocs(prev => [...prev, docUploadFields as any]);
    setIsDocUploadModalOpen(false);
    setDocUploadFields({ type: 'POLICY', title: '', description: '', file: null });
  };

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

  const defaultFilters = {
    companyCategory: '',
    company: '',
    planCategory: '',
    plan: '',
    businessCategory: '',
    policyType: '',
    agency: '',
    agentName: '',
    familySize: '',
    city: '',
    zoneTier: '',
    sumInsuredMin: '',
    sumInsuredMax: '',
    deductible: '',
    riders: '',
    policyTenure: '',
    policyTerm: '',
    ageAtEntryMin: '',
    ageAtEntryMax: '',
    ageAtLastPremiumMin: '',
    ageAtLastPremiumMax: '',
    ageAtMaturityMin: '',
    ageAtMaturityMax: '',
    startDateFrom: '',
    startDateTo: '',
    endDateFrom: '',
    endDateTo: '',
    firstInceptionFrom: '',
    firstInceptionTo: '',
    status: '',
    assignedTo: '',
    installmentCase: '',
    loanProvider: '',
    installmentFrequency: '',
    noOfInstallments: '',
    firstInstallmentFrom: '',
    firstInstallmentTo: '',
    lastInstallmentFrom: '',
    lastInstallmentTo: '',
    bankName: '',
    premiumMin: '',
    premiumMax: '',
  };
  const [tempFilters, setTempFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);

  const activePoliciesFilterCount = useMemo(() => {
    let count = 0;
    Object.entries(appliedFilters).forEach(([_k, v]) => {
      if (v !== '' && v !== 'ALL') count++;
    });
    return count;
  }, [appliedFilters]);

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

  const { data: agencyRes } = useQuery({
    queryKey: ['agency-details'],
    queryFn: () => agencyDetailsService.findAll(),
    enabled: !!user,
  });

  const exportPoliciesToExcel = () => {
    const headers = ['Client Name', 'Policy Number', 'Type', 'Company', 'Plan', 'Premium', 'Sum Assured', 'Start Date', 'End Date', 'Status'];
    const rows = sortedPolicies.map((p: any) => [
      `"${((p.contact?.firstName || '') + ' ' + (p.contact?.lastName || '')).trim().replace(/"/g, '""')}"`,
      `"${(p.policyNumber || '').replace(/"/g, '""')}"`,
      `"${(p.plan?.category || '').replace(/"/g, '""')}"`,
      `"${(p.plan?.company?.name || '').replace(/"/g, '""')}"`,
      `"${(p.plan?.name || '').replace(/"/g, '""')}"`,
      p.premiumAmount ?? '',
      p.sumAssured ?? '',
      p.startDate ? new Date(p.startDate).toLocaleDateString() : '',
      p.endDate ? new Date(p.endDate).toLocaleDateString() : '',
      p.isActive ? 'Active' : 'Inactive'
    ].join(',')).join('\n');
    
    const content = headers.join(',') + '\n' + rows;
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `policies_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    import('react-hot-toast').then(({ default: toast }) => toast.success('Policies exported to Excel successfully'));
  };

  const exportPoliciesToPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      import('react-hot-toast').then(({ default: toast }) => toast.error('Pop-up blocked. Please allow pop-ups to print PDF'));
      return;
    }
    
    const rowsHtml = sortedPolicies.map((p: any) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 8px;">${((p.contact?.firstName || '') + ' ' + (p.contact?.lastName || '')).trim() || 'N/A'}</td>
        <td style="padding: 8px; font-weight: 600;">${p.policyNumber || 'N/A'}</td>
        <td style="padding: 8px;">${p.plan?.category || 'N/A'}</td>
        <td style="padding: 8px;">${p.plan?.company?.name || 'N/A'}</td>
        <td style="padding: 8px;">${p.plan?.name || 'N/A'}</td>
        <td style="padding: 8px; text-align: right;">₹${p.premiumAmount?.toLocaleString() || 0}</td>
        <td style="padding: 8px; text-align: right;">₹${p.sumAssured?.toLocaleString() || 0}</td>
        <td style="padding: 8px; text-align: center;">${p.startDate ? new Date(p.startDate).toLocaleDateString() : 'N/A'}</td>
        <td style="padding: 8px; text-align: center;"><span style="padding: 2px 6px; border-radius: 4px; background: ${p.isActive ? '#def7ec; color: #03543f;' : '#fde8e8; color: #9b1c1c;'} font-size: 10px; font-weight: bold;">${p.isActive ? 'Active' : 'Inactive'}</span></td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Policies Report</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; padding: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 10px 8px; text-align: left; font-size: 11px; font-weight: bold; text-transform: uppercase; color: #64748b; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 12px; }
            .title { font-size: 20px; font-weight: 800; color: #1e3a8a; }
            .meta { font-size: 11px; color: #64748b; text-align: right; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">INSU-MITRA</div>
              <div style="font-size: 12px; color: #475569; font-weight: 600;">Policies Export Report</div>
            </div>
            <div class="meta">
              <div>Date: ${new Date().toLocaleString()}</div>
              <div>Record Count: ${sortedPolicies.length}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 15%;">Client Name</th>
                <th style="width: 15%;">Policy No</th>
                <th style="width: 10%;">Type</th>
                <th style="width: 15%;">Company</th>
                <th style="width: 15%;">Plan</th>
                <th style="width: 10%; text-align: right;">Premium</th>
                <th style="width: 10%; text-align: right;">Sum Insured</th>
                <th style="width: 10%; text-align: center;">Start Date</th>
                <th style="width: 10%; text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

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
    let list: Policy[] = data?.data ?? [];

    // Quick Select filters
    if (selectedQuickFilter !== 'ALL') {
      if (['FRESH', 'PORT', 'RENEWAL'].includes(selectedQuickFilter)) {
        list = list.filter((p: any) => p.policyType === selectedQuickFilter);
      } else {
        list = list.filter((p: any) => p.plan?.category === selectedQuickFilter);
      }
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

    // Agency Filter
    if (appliedFilters.agency) {
      list = list.filter((p: any) => p.agentCode === appliedFilters.agency);
    }

    // Company Filter
    if (appliedFilters.company) {
      list = list.filter((p: any) => {
        const comp = (p.plan?.company?.name || '').toLowerCase();
        return comp.includes(appliedFilters.company.toLowerCase());
      });
    }

    // Company Category Filter
    if (appliedFilters.companyCategory) {
      list = list.filter((p: any) => {
        const cat = (p.plan?.company?.category || p.plan?.category || '').toUpperCase();
        return cat.includes(appliedFilters.companyCategory.toUpperCase());
      });
    }

    // Plan Category Filter
    if (appliedFilters.planCategory) {
      list = list.filter((p: any) => {
        const cat = (p.plan?.category || '').toUpperCase();
        return cat.includes(appliedFilters.planCategory.toUpperCase());
      });
    }

    // Plan Filter
    if (appliedFilters.plan) {
      list = list.filter((p: any) => {
        const pId = p.plan?.id || p.planId || '';
        const pName = (p.plan?.name || '').toLowerCase();
        return pId === appliedFilters.plan || pName.includes(appliedFilters.plan.toLowerCase());
      });
    }

    // Business Category Filter
    if (appliedFilters.businessCategory) {
      list = list.filter((p: any) => {
        const bCat = (p.policyType || p.type || '').toUpperCase();
        return bCat === appliedFilters.businessCategory.toUpperCase();
      });
    }

    // Status Filter
    if (appliedFilters.status) {
      list = list.filter((p: any) => p.status === appliedFilters.status);
    }

    // Policy Type Filter
    if (appliedFilters.policyType) {
      list = list.filter((p: any) => {
        const pType = (p.policyCategory || p.type || p.policyType || '').toLowerCase();
        return pType.includes(appliedFilters.policyType.toLowerCase());
      });
    }

    // Agency / Agent Name Filter
    if (appliedFilters.agency || appliedFilters.agentName) {
      const term = (appliedFilters.agency || appliedFilters.agentName).toLowerCase();
      list = list.filter((p: any) => {
        const code = (p.agentCode || '').toLowerCase();
        const empName = (p.assignedEmployee?.employeeProfile?.firstName || '').toLowerCase();
        return code.includes(term) || empName.includes(term);
      });
    }

    // Family Size Filter
    if (appliedFilters.familySize) {
      const targetSize = Number(appliedFilters.familySize);
      list = list.filter((p: any) => {
        const size = p.connectedPersons?.length ? p.connectedPersons.length + 1 : 1;
        return targetSize >= 5 ? size >= 5 : size === targetSize;
      });
    }

    // City Filter
    if (appliedFilters.city) {
      list = list.filter((p: any) => {
        const city = (p.contact?.address?.city || p.contact?.city || '').toLowerCase();
        return city.includes(appliedFilters.city.toLowerCase());
      });
    }

    // Zone Location Tier Filter
    if (appliedFilters.zoneTier) {
      list = list.filter((p: any) => {
        const tier = (p.zoneTier || p.notes || '').toLowerCase();
        return tier.includes(appliedFilters.zoneTier.toLowerCase());
      });
    }

    // Sum Insured filter
    if (appliedFilters.sumInsuredMin) {
      list = list.filter((p: any) => (p.sumAssured ?? 0) >= Number(appliedFilters.sumInsuredMin));
    }
    if (appliedFilters.sumInsuredMax) {
      list = list.filter((p: any) => (p.sumAssured ?? 0) <= Number(appliedFilters.sumInsuredMax));
    }

    // Deductible Filter
    if (appliedFilters.deductible) {
      list = list.filter((p: any) => {
        const extra = parseExtraNotes(p.notes);
        const ded = (extra.deductible || p.deductible || '').toLowerCase();
        return ded.includes(appliedFilters.deductible.toLowerCase());
      });
    }

    // Riders / Addons Filter
    if (appliedFilters.riders) {
      list = list.filter((p: any) => {
        const extra = parseExtraNotes(p.notes);
        const ridersStr = JSON.stringify(extra.riders || p.riders || '').toLowerCase();
        return ridersStr.includes(appliedFilters.riders.toLowerCase());
      });
    }

    // Policy Tenure Filter
    if (appliedFilters.policyTenure) {
      list = list.filter((p: any) => {
        const tenure = String(p.tenure || p.duration || '1 Year').toLowerCase();
        return tenure.includes(appliedFilters.policyTenure.toLowerCase());
      });
    }

    // Policy Term Filter
    if (appliedFilters.policyTerm) {
      list = list.filter((p: any) => {
        const extra = parseExtraNotes(p.notes);
        const termVal = String(extra.premiumPaymentPeriod || p.policyTerm || '');
        return termVal.includes(appliedFilters.policyTerm);
      });
    }

    // Premium filter
    if (appliedFilters.premiumMin) {
      list = list.filter((p: any) => (p.premiumAmount ?? 0) >= Number(appliedFilters.premiumMin));
    }
    if (appliedFilters.premiumMax) {
      list = list.filter((p: any) => (p.premiumAmount ?? 0) <= Number(appliedFilters.premiumMax));
    }

    // Age at Entry Filter
    if (appliedFilters.ageAtEntryMin || appliedFilters.ageAtEntryMax) {
      list = list.filter((p: any) => {
        if (!p.startDate || !p.contact?.dateOfBirth) return true;
        const entryAge = new Date(p.startDate).getFullYear() - new Date(p.contact.dateOfBirth).getFullYear();
        if (appliedFilters.ageAtEntryMin && entryAge < Number(appliedFilters.ageAtEntryMin)) return false;
        if (appliedFilters.ageAtEntryMax && entryAge > Number(appliedFilters.ageAtEntryMax)) return false;
        return true;
      });
    }

    // Age at Last Premium Filter
    if (appliedFilters.ageAtLastPremiumMin || appliedFilters.ageAtLastPremiumMax) {
      list = list.filter((p: any) => {
        const extra = parseExtraNotes(p.notes);
        const lpDate = extra.lastPremiumDate || p.lastPremiumDate || p.endDate;
        if (!lpDate || !p.contact?.dateOfBirth) return true;
        const lpAge = new Date(lpDate).getFullYear() - new Date(p.contact.dateOfBirth).getFullYear();
        if (appliedFilters.ageAtLastPremiumMin && lpAge < Number(appliedFilters.ageAtLastPremiumMin)) return false;
        if (appliedFilters.ageAtLastPremiumMax && lpAge > Number(appliedFilters.ageAtLastPremiumMax)) return false;
        return true;
      });
    }

    // Age at Maturity Filter
    if (appliedFilters.ageAtMaturityMin || appliedFilters.ageAtMaturityMax) {
      list = list.filter((p: any) => {
        const matDate = p.maturityDate || p.endDate;
        if (!matDate || !p.contact?.dateOfBirth) return true;
        const matAge = new Date(matDate).getFullYear() - new Date(p.contact.dateOfBirth).getFullYear();
        if (appliedFilters.ageAtMaturityMin && matAge < Number(appliedFilters.ageAtMaturityMin)) return false;
        if (appliedFilters.ageAtMaturityMax && matAge > Number(appliedFilters.ageAtMaturityMax)) return false;
        return true;
      });
    }

    // Policy Duration Date Range
    if (appliedFilters.startDateFrom) {
      list = list.filter((p: any) => p.startDate && new Date(p.startDate) >= new Date(appliedFilters.startDateFrom));
    }
    if (appliedFilters.startDateTo) {
      list = list.filter((p: any) => p.startDate && new Date(p.startDate) <= new Date(appliedFilters.startDateTo));
    }
    if (appliedFilters.endDateFrom) {
      list = list.filter((p: any) => p.endDate && new Date(p.endDate) >= new Date(appliedFilters.endDateFrom));
    }
    if (appliedFilters.endDateTo) {
      list = list.filter((p: any) => p.endDate && new Date(p.endDate) <= new Date(appliedFilters.endDateTo));
    }

    // Policy 1st Inception Date Filter
    if (appliedFilters.firstInceptionFrom) {
      list = list.filter((p: any) => {
        const extra = parseExtraNotes(p.notes);
        const fDate = extra.firstPremiumDate || p.startDate;
        return fDate && new Date(fDate) >= new Date(appliedFilters.firstInceptionFrom);
      });
    }
    if (appliedFilters.firstInceptionTo) {
      list = list.filter((p: any) => {
        const extra = parseExtraNotes(p.notes);
        const fDate = extra.firstPremiumDate || p.startDate;
        return fDate && new Date(fDate) <= new Date(appliedFilters.firstInceptionTo);
      });
    }

    // Assigned To Filter
    if (appliedFilters.assignedTo) {
      list = list.filter((p: any) => p.assignedEmployeeId === appliedFilters.assignedTo);
    }

    // Installment Case Filter
    if (appliedFilters.installmentCase && appliedFilters.installmentCase !== 'ALL') {
      list = list.filter((p: any) => {
        const extra = parseExtraNotes(p.notes);
        const isEmi = !!(extra.emiCase || p.emiCase);
        return appliedFilters.installmentCase === 'YES' ? isEmi : !isEmi;
      });
    }

    // Loan Provider Filter
    if (appliedFilters.loanProvider) {
      list = list.filter((p: any) => {
        const extra = parseExtraNotes(p.notes);
        const lp = (extra.emiGateway || p.loanProvider || '').toLowerCase();
        return lp.includes(appliedFilters.loanProvider.toLowerCase());
      });
    }

    // Installment Frequency Filter
    if (appliedFilters.installmentFrequency && appliedFilters.installmentFrequency !== 'ALL') {
      list = list.filter((p: any) => p.paymentFrequency === appliedFilters.installmentFrequency);
    }

    // No of Installments Filter
    if (appliedFilters.noOfInstallments) {
      list = list.filter((p: any) => {
        const count = String(p.noOfInstallments || '');
        return count.includes(appliedFilters.noOfInstallments);
      });
    }

    // 1st Installment Date Range Filter
    if (appliedFilters.firstInstallmentFrom) {
      list = list.filter((p: any) => {
        const extra = parseExtraNotes(p.notes);
        const d = extra.firstPremiumDate || p.startDate;
        return d && new Date(d) >= new Date(appliedFilters.firstInstallmentFrom);
      });
    }
    if (appliedFilters.firstInstallmentTo) {
      list = list.filter((p: any) => {
        const extra = parseExtraNotes(p.notes);
        const d = extra.firstPremiumDate || p.startDate;
        return d && new Date(d) <= new Date(appliedFilters.firstInstallmentTo);
      });
    }

    // Last Installment Date Range Filter
    if (appliedFilters.lastInstallmentFrom) {
      list = list.filter((p: any) => {
        const extra = parseExtraNotes(p.notes);
        const d = extra.lastPremiumDate || p.endDate;
        return d && new Date(d) >= new Date(appliedFilters.lastInstallmentFrom);
      });
    }
    if (appliedFilters.lastInstallmentTo) {
      list = list.filter((p: any) => {
        const extra = parseExtraNotes(p.notes);
        const d = extra.lastPremiumDate || p.endDate;
        return d && new Date(d) <= new Date(appliedFilters.lastInstallmentTo);
      });
    }

    // Bank Name Filter
    if (appliedFilters.bankName) {
      list = list.filter((p: any) => {
        const bk = (p.bankName || p.contact?.bankAccounts?.[0]?.bankName || '').toLowerCase();
        return bk.includes(appliedFilters.bankName.toLowerCase());
      });
    }

    return list;
  }, [data, selectedQuickFilter, search, appliedFilters]);

  // Client-side Sorting Logic
  const sortedPolicies = useMemo(() => {
    let key = sortBy;
    // Map specific table column keys to object paths for sorting
    if (key === 'renewAssign') key = 'assignedEmployee.employeeProfile.firstName';
    if (key === 'clientName') key = 'contact.firstName';
    if (key === 'proposerName') key = 'contact.firstName';
    if (key === 'proposerContact') key = 'contact.phone';
    if (key === 'city') key = 'contact.address.city';
    if (key === 'companyCategory') key = 'plan.company.category';
    return sortData(filteredPolicies, key, sortOrder);
  }, [filteredPolicies, sortBy, sortOrder]);

  // Client-side Pagination
  const paginatedPolicies = useMemo(() => {
    const start = (page - 1) * 20;
    return sortedPolicies.slice(start, start + 20);
  }, [sortedPolicies, page]);

  const createPolicy = useCreatePolicy();
  const updatePolicy = useUpdatePolicy();
  const deletePolicy = useDeletePolicy();
  const { data: compulsoryRulesRes, isLoading: isLoadingRules } = useQuery({
    queryKey: ['compulsory-rules'],
    queryFn: () => insuranceService.getCompulsoryRules(),
  });
  const compulsoryRules = useMemo(() => compulsoryRulesRes?.data ?? [], [compulsoryRulesRes]);

  const isFieldRequired = (key: string, defaultRequired: boolean) => {
    if (['contactId', 'planId', 'policyNumber', 'startDate', 'endDate'].includes(key)) return true; // System protected
    const rule = compulsoryRules.find((r: any) => r.module === 'Policy' && r.fieldKey === key);
    if (rule) return rule.required;
    return defaultRequired;
  };

  const activeSchema = useMemo(() => {
    return z.object({
      contactId: isFieldRequired('contactId', true) ? z.string().regex(/^[0-9a-fA-F]{24}$/, 'Select a contact') : z.string().optional().or(z.literal('')),
      planId: isFieldRequired('planId', true) ? z.string().regex(/^[0-9a-fA-F]{24}$/, 'Select a plan') : z.string().optional().or(z.literal('')),
      policyNumber: isFieldRequired('policyNumber', true) ? z.string().min(1, 'Policy number required') : z.string().optional().or(z.literal('')),
      sumAssured: isFieldRequired('sumAssured', true) ? z.coerce.number().positive('Enter a valid sum assured') : z.coerce.number().optional().or(z.literal('')),
      premiumAmount: isFieldRequired('premiumAmount', true) ? z.coerce.number().positive('Enter a valid premium') : z.coerce.number().optional().or(z.literal('')),
      startDate: isFieldRequired('startDate', true) ? z.string().min(1, 'Start date required') : z.string().optional().or(z.literal('')),
      endDate: isFieldRequired('endDate', true) ? z.string().min(1, 'End date required') : z.string().optional().or(z.literal('')),
      paymentFrequency: z.enum(['YEARLY', 'HALF_YEARLY', 'QUARTERLY', 'MONTHLY', 'SINGLE']),
      riders: z.array(z.string()).optional(),
      deductible: isFieldRequired('deductible', false) ? z.string().min(1, 'Required') : z.string().optional(),
      status: z.enum(['ACTIVE', 'EXPIRED', 'LAPSED', 'CANCELLED', 'SURRENDERED']).optional(),
      assignedEmployeeId: isFieldRequired('assignedEmployeeId', false) ? z.string().min(1, 'Required') : z.string().optional(),
      nextDueDate: isFieldRequired('nextDueDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      maturityDate: isFieldRequired('maturityDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      agentCode: isFieldRequired('agentCode', false) ? z.string().min(1, 'Required') : z.string().optional(),
      notes: isFieldRequired('notes', false) ? z.string().min(1, 'Required') : z.string().optional(),
      firstPremiumDate: isFieldRequired('firstPremiumDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      premiumPaymentPeriod: isFieldRequired('premiumPaymentPeriod', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional(),
      lastPremiumDate: isFieldRequired('lastPremiumDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      emiCase: z.boolean().optional(),
      emiGateway: isFieldRequired('emiGateway', false) ? z.string().min(1, 'Required') : z.string().optional(),
      emiDate: isFieldRequired('emiDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      emiPremium: isFieldRequired('emiPremium', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional(),
      phcRequired: z.boolean().optional(),
      phcAmount: isFieldRequired('phcAmount', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional(),
      phcStatus: isFieldRequired('phcStatus', false) ? z.string().min(1, 'Required') : z.string().optional(),
      phcClaimSettled: z.boolean().optional(),
      firstYearPremium: isFieldRequired('firstYearPremium', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional(),
      secondYearPremium: isFieldRequired('secondYearPremium', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional(),
    });
  }, [compulsoryRules]);

  const activeEditSchema = useMemo(() => {
    return z.object({
      status: z.enum(['ACTIVE', 'EXPIRED', 'LAPSED', 'CANCELLED', 'SURRENDERED']),
      premiumAmount: isFieldRequired('premiumAmount', true) ? z.coerce.number().positive('Enter a valid premium') : z.coerce.number().optional().or(z.literal('')),
      sumAssured: isFieldRequired('sumAssured', true) ? z.coerce.number().positive() : z.coerce.number().optional(),
      endDate: isFieldRequired('endDate', true) ? z.string().min(1, 'End date required') : z.string().optional().or(z.literal('')),
      nextDueDate: isFieldRequired('nextDueDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      maturityDate: isFieldRequired('maturityDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      paymentFrequency: z.enum(['YEARLY', 'HALF_YEARLY', 'QUARTERLY', 'MONTHLY', 'SINGLE']),
      agentCode: isFieldRequired('agentCode', false) ? z.string().min(1, 'Required') : z.string().optional(),
      notes: isFieldRequired('notes', false) ? z.string().min(1, 'Required') : z.string().optional(),
      riders: z.array(z.string()).optional(),
      deductible: isFieldRequired('deductible', false) ? z.string().min(1, 'Required') : z.string().optional(),
      assignedEmployeeId: isFieldRequired('assignedEmployeeId', false) ? z.string().min(1, 'Required') : z.string().optional(),
      firstPremiumDate: isFieldRequired('firstPremiumDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      premiumPaymentPeriod: isFieldRequired('premiumPaymentPeriod', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional(),
      lastPremiumDate: isFieldRequired('lastPremiumDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      emiCase: z.boolean().optional(),
      emiGateway: isFieldRequired('emiGateway', false) ? z.string().min(1, 'Required') : z.string().optional(),
      emiDate: isFieldRequired('emiDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      emiPremium: isFieldRequired('emiPremium', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional(),
      phcRequired: z.boolean().optional(),
      phcAmount: isFieldRequired('phcAmount', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional(),
      phcStatus: isFieldRequired('phcStatus', false) ? z.string().min(1, 'Required') : z.string().optional(),
      phcClaimSettled: z.boolean().optional(),
      firstYearPremium: isFieldRequired('firstYearPremium', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional(),
      secondYearPremium: isFieldRequired('secondYearPremium', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional(),
    });
  }, [compulsoryRules]);

  const { register, handleSubmit, reset, setValue, watch } = useForm<Form>({
    resolver: zodResolver(activeSchema),
    defaultValues: { paymentFrequency: 'YEARLY' },
  });
  const { register: regEdit, handleSubmit: handleEdit, reset: resetEdit, setValue: setEditValue, watch: watchEdit } = useForm<EditForm>({
    resolver: zodResolver(activeEditSchema),
  });
  const watchEditEmiCase = watchEdit('emiCase');
  const watchEditPhcRequired = watchEdit('phcRequired');
  const watchEditEndDate = watchEdit('endDate');
  const watchEditNextDueDate = watchEdit('nextDueDate');
  const watchEditMaturityDate = watchEdit('maturityDate');

  const watchPremiumAmount = watch('premiumAmount');
  const watchSumAssured = watch('sumAssured');
  const watchFirstYearPremium = watch('firstYearPremium');
  const watchSecondYearPremium = watch('secondYearPremium');
  const watchStartDate = watch('startDate');
  const watchEndDate = watch('endDate');
  const watchEmiCase = watch('emiCase');
  const watchPhcRequired = watch('phcRequired');
  const [durationYears, setDurationYears] = useState<number>(1);

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
    setIsViewMode(false);
    reset();
    setSelectedContact(null);
    setContactSearch('');
    setSelectedType('');
    setSelectedCompany('');
    setSelectedPlan(null);
    setPendingDocs([]);
    setKeepCreateOpen(false);
    if (returnRoute) {
      navigate(returnRoute, {
        replace: true,
        state: returnPayload,
      });
    }
  };

  const openView = (p: Policy) => {
    setIsViewMode(true);
    openEdit(p);
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

  const handleShareWhatsApp = async (policy: Policy) => {
    try {
      if (policy.contactId) {
        await contactsService.logInteraction(policy.contactId, {
          type: 'WHATSAPP_MESSAGE',
          notes: `Sent Policy Document (Policy #${policy.policyNumber}) via WhatsApp`,
          date: new Date().toISOString()
        });
        toast.success('Interaction logged for WhatsApp share');
      }
      const phone = policy.contact?.phone;
      if (phone) {
        const text = encodeURIComponent(`Hello ${policy.contact?.firstName || 'Customer'},\n\nHere are the details for your Policy #${policy.policyNumber}.`);
        window.open(`https://wa.me/91${phone}?text=${text}`, '_blank');
      } else {
        toast.error('No phone number available for this contact');
      }
    } catch (e) {
      toast.error('Failed to log WhatsApp interaction');
    }
  };

  const handleDownloadPD = async (policy: Policy) => {
    try {
      if (policy.contactId) {
        await contactsService.logInteraction(policy.contactId, {
          type: 'NOTE',
          notes: `Downloaded Policy Document (Policy #${policy.policyNumber})`,
          date: new Date().toISOString()
        });
        toast.success('PD Download logged');
      }
      toast('Downloading Policy Document...', { icon: '⬇️' });
    } catch (e) {
      toast.error('Failed to log PD download');
    }
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
        key: 'proposerName',
        label: 'Proposer Name',
        sortable: true,
        render: r => r.contact ? `${r.contact.firstName} ${r.contact.lastName || ''}`.trim() : '—'
      },
      {
        key: 'proposerContact',
        label: 'Proposer Contact No.',
        sortable: true,
        render: r => r.contact?.phone || '—'
      },
      {
        key: 'city',
        label: 'City',
        sortable: true,
        render: r => (r.contact as any)?.address?.city || (r.contact as any)?.city || '—'
      },
      {
        key: 'companyCategory',
        label: 'Insurance Company Category',
        sortable: true,
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
        render: r => <ExpandableComment text={r.notes ? (parseExtraNotes(r.notes).cleanNotes || r.notes) : ''} />
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
        <div className="flex flex-nowrap items-center gap-1.5 w-max" onClick={e => e.stopPropagation()}>
          <button
            title="Download Policy Document"
            className="p-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-blue-500/20 hover:shadow-lg hover:scale-105 transition-all"
            onClick={() => handleDownloadPD(r)}
          >
            <Download size={14} />
          </button>
          <button
            title="Share on WhatsApp"
            className="p-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-green-500/20 hover:shadow-lg hover:scale-105 transition-all"
            onClick={() => handleShareWhatsApp(r)}
          >
            <MessageCircle size={14} />
          </button>
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
        for (const doc of pendingDocs) {
          try {
            await documentsService.upload(doc.file, {
              policyId: editTarget.id,
              tag: doc.type,
              title: doc.title,
              description: doc.description
            });
          } catch (uploadErr) {
            console.error(`[Document Upload Error] ${doc.title}`, uploadErr);
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
      for (const doc of pendingDocs) {
        if (createdPolicy?.id) {
          try {
            await documentsService.upload(doc.file, {
              policyId: createdPolicy.id,
              tag: doc.type,
              title: doc.title,
              description: doc.description
            });
          } catch (uploadErr) {
            console.error(`[Document Upload Error] ${doc.title}`, uploadErr);
          }
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
          setPendingDocs([]);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-3">
        <div className="flex flex-wrap items-center gap-2">
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
            Installments Tracking
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

        {/* Month Selector Calendar - Rendered inline with tabs when on Installment Tracker */}
        {currentTab === 'emi' && (
          <MonthPickerDropdown selectedMonth={emiSelectedMonth} onChange={setEmiSelectedMonth} />
        )}

        {/* PHC History Button - Rendered inline with tabs when on PHC Tracker */}
        {currentTab === 'phc' && (
          <button type="button" className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold text-[10px] sm:text-xs cursor-pointer transition-colors whitespace-nowrap">
            <History size={14} /> PHC History (All Policies)
          </button>
        )}
      </div>

      {currentTab === 'phc' ? (
        <PhcTrackingView />
      ) : currentTab === 'emi' ? (
        <EmiTrackingView selectedMonth={emiSelectedMonth} />
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

          {/* Main Control Hub Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm mb-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Left Side: Search Bar ONLY */}
              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                <div className="page-search-wrapper">
                  <Search className="page-search-icon" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search policy#, client name, phone..."
                    className="page-search-input"
                  />
                </div>
              </div>

              {/* Right Side: Quick Select Category Filters, Column Picker & Filters Toggle */}
              <div className="flex flex-wrap items-center gap-2.5 flex-wrap justify-end">
                {/* Quick Type Filters */}
                <button
                  onClick={() => { setSelectedQuickFilter('ALL'); setPage(1); }}
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs',
                    selectedQuickFilter === 'ALL'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  )}
                >
                  All Types
                </button>
                {['HEALTH', 'LIFE', 'GENERAL', 'ACCIDENT', 'FRESH', 'PORT', 'RENEWAL'].map(cat => {
                  const isSel = selectedQuickFilter === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => { setSelectedQuickFilter(cat); setPage(1); }}
                      className={clsx(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs',
                        isSel
                          ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      )}
                    >
                      {cat === 'HEALTH' ? 'Health' : cat === 'LIFE' ? 'Life' : cat === 'ACCIDENT' ? 'Accident' : cat.charAt(0) + cat.slice(1).toLowerCase()}
                    </button>
                  );
                })}

                {/* Column Visibility Selector */}
                <div className="relative" ref={colPickerRef}>
                  <button
                    onClick={() => setColPickerOpen(!colPickerOpen)}
                    className={clsx(
                      "p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 cursor-pointer shadow-2xs transition-all",
                      colPickerOpen && "bg-blue-50 border-blue-200 text-blue-600"
                    )}
                    title="Toggle columns"
                  >
                    <Settings size={14} />
                  </button>
                  {colPickerOpen && (
                    <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200/90 rounded-2xl shadow-2xl p-3 z-50 text-xs space-y-2 animate-fadeIn">
                      <p className="font-extrabold text-slate-400 uppercase tracking-wider mb-1 text-[10px]">Show Columns</p>
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
                        <label key={col.key} className="flex flex-wrap items-center gap-2 cursor-pointer font-bold text-slate-700 hover:text-blue-600 transition-colors">
                          <input
                            type="checkbox"
                            checked={visibleColumns[col.key] !== false}
                            onChange={() => setVisibleColumns(prev => ({ ...prev, [col.key]: !prev[col.key] }))}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                          />
                          <span>{col.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Advanced Filters Toggle Button */}
                <button
                  onClick={() => setFiltersOpen(!filtersOpen)}
                  className={clsx(
                    "p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 cursor-pointer shadow-2xs transition-all flex items-center gap-1.5 text-xs font-bold bg-white",
                    filtersOpen && "bg-blue-50 border-blue-200 text-blue-600"
                  )}
                  title="Advanced Filters"
                >
                  <Filter size={14} className={filtersOpen || activePoliciesFilterCount > 0 ? "text-blue-600" : "text-slate-500"} />
                  <span className="hidden sm:inline">Filters</span>
                  {activePoliciesFilterCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-blue-600 text-white rounded-full font-black leading-none">
                      {activePoliciesFilterCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Active Filter Badges Bar */}
          {activePoliciesFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 bg-blue-50/60 p-2.5 rounded-2xl border border-blue-100/90 shadow-2xs mb-4 animate-fadeIn">
              <span className="text-[11px] font-extrabold text-blue-800 mr-1 flex items-center gap-1">
                <Filter size={13} className="text-blue-600" /> Active Filters ({activePoliciesFilterCount}):
              </span>

              {Object.entries(appliedFilters).map(([k, v]) => {
                if (!v || v === 'ALL') return null;
                const labelMap: Record<string, string> = {
                  companyCategory: 'Comp Category',
                  company: 'Company',
                  planCategory: 'Plan Category',
                  plan: 'Plan',
                  businessCategory: 'Business Cat',
                  policyType: 'Policy Type',
                  agentName: 'Agent',
                  familySize: 'Family Size',
                  city: 'City',
                  zoneTier: 'Zone Tier',
                  sumInsuredMin: 'Min SI',
                  sumInsuredMax: 'Max SI',
                  deductible: 'Deductible',
                  riders: 'Riders',
                  policyTenure: 'Tenure',
                  policyTerm: 'Term',
                  startDateFrom: 'Start From',
                  startDateTo: 'Start To',
                  endDateFrom: 'End From',
                  endDateTo: 'End To',
                  status: 'Status',
                  installmentCase: 'Installment Case',
                  loanProvider: 'Loan Provider',
                  installmentFrequency: 'Frequency',
                  bankName: 'Bank',
                };
                const displayKey = labelMap[k] || k;
                return (
                  <span key={k} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-blue-900 text-xs font-bold rounded-xl border border-blue-200 shadow-2xs">
                    {displayKey}: {String(v)}
                    <span
                      className="cursor-pointer hover:text-red-500 font-bold ml-1"
                      onClick={() => {
                        const updated = { ...appliedFilters, [k]: '' };
                        setAppliedFilters(updated);
                        setTempFilters(updated);
                      }}
                    >
                      ×
                    </span>
                  </span>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setAppliedFilters(defaultFilters);
                  setTempFilters(defaultFilters);
                }}
                className="text-[11px] font-extrabold text-red-600 hover:text-red-800 hover:underline cursor-pointer ml-auto px-2 py-0.5 rounded-lg bg-red-50 hover:bg-red-100 transition-colors"
              >
                Clear All
              </button>
            </div>
          )}

          {selectedIds.length > 0 && user?.role === 'OWNER' && (
            <div className="flex items-center justify-between p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-sm transition-all animate-fadeIn">
              <span className="font-medium text-blue-800">
                {selectedIds.length} policies selected
              </span>
              <div className="flex flex-wrap items-center gap-2">
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
                  className="btn-primary py-1.5 px-3 text-[10px] sm:text-xs cursor-pointer disabled:opacity-50"
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
            <div className="card bg-gray-50/50 p-5 rounded-2xl border border-slate-200 shadow-sm mt-2 mb-4 animate-fadeIn">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/70">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Filter size={16} className="text-blue-600" />
                  Advanced Filters
                </h3>
                {activePoliciesFilterCount > 0 && (
                  <span className="text-xs font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                    {activePoliciesFilterCount} {activePoliciesFilterCount === 1 ? 'Filter' : 'Filters'} Active
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4 text-xs">

                {/* 1. Insurance Company Category */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Company Category</label>
                  <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={tempFilters.companyCategory} onChange={e => setTempFilters({ ...tempFilters, companyCategory: e.target.value })}>
                    <option value="">All Categories</option>
                    <option value="HEALTH">Health Insurance</option>
                    <option value="LIFE">Life Insurance</option>
                    <option value="GENERAL">General Insurance</option>
                    <option value="MOTOR">Motor Insurance</option>
                    <option value="OTHER">Other Category</option>
                  </select>
                </div>

                {/* 2. Insurance Company Name */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Company Name</label>
                  <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={tempFilters.company} onChange={e => setTempFilters({ ...tempFilters, company: e.target.value })}>
                    <option value="">All Companies</option>
                    {filterCompaniesOptions.map(comp => (
                      <option key={comp} value={comp}>{comp}</option>
                    ))}
                  </select>
                </div>

                {/* 3. Insurance Plan Category */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Plan Category</label>
                  <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={tempFilters.planCategory} onChange={e => setTempFilters({ ...tempFilters, planCategory: e.target.value })}>
                    <option value="">All Plan Categories</option>
                    <option value="HEALTH">Health</option>
                    <option value="LIFE">Life</option>
                    <option value="ACCIDENT">Accident</option>
                    <option value="MOTOR">Motor</option>
                    <option value="MF">Mutual Funds</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                {/* 4. Plan Name */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Plan Name</label>
                  <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={tempFilters.plan} onChange={e => setTempFilters({ ...tempFilters, plan: e.target.value })}>
                    <option value="">All Plans</option>
                    {filterPlansOptions.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* 5. Business Category */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Business Category</label>
                  <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={tempFilters.businessCategory} onChange={e => setTempFilters({ ...tempFilters, businessCategory: e.target.value })}>
                    <option value="">All Business Categories</option>
                    <option value="FRESH">Fresh</option>
                    <option value="PORT">Porting</option>
                    <option value="RENEWAL">Renewal</option>
                    <option value="ROLLOVER">Rollover</option>
                  </select>
                </div>

                {/* 6. Policy Type */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Policy Type</label>
                  <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={tempFilters.policyType} onChange={e => setTempFilters({ ...tempFilters, policyType: e.target.value })}>
                    <option value="">All Types</option>
                    <option value="INDIVIDUAL">Individual</option>
                    <option value="FLOATER">Family Floater</option>
                    <option value="MULTI_INDIVIDUAL">Multi Individual</option>
                    <option value="GROUP">Group</option>
                  </select>
                </div>

                {/* 7. Agent Name / Agency */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Agent Name / Agency</label>
                  <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={tempFilters.agency} onChange={e => setTempFilters({ ...tempFilters, agency: e.target.value })}>
                    <option value="">All Agents</option>
                    {agencyRes?.data?.map((ag: any) => (
                      <option key={ag.id} value={ag.agentCode}>{ag.name} ({ag.agentCode || 'N/A'})</option>
                    ))}
                  </select>
                </div>

                {/* 8. Family Size */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Family Size</label>
                  <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={tempFilters.familySize} onChange={e => setTempFilters({ ...tempFilters, familySize: e.target.value })}>
                    <option value="">All Sizes</option>
                    <option value="1">1 Person (Individual)</option>
                    <option value="2">2 Persons (1+1)</option>
                    <option value="3">3 Persons (2+1)</option>
                    <option value="4">4 Persons (2+2)</option>
                    <option value="5">5+ Persons</option>
                  </select>
                </div>

                {/* 9. Policy Zone Location City */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Policy City</label>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai, Delhi..."
                    className="input text-xs w-full bg-white shadow-2xs mt-1"
                    value={tempFilters.city}
                    onChange={e => setTempFilters({ ...tempFilters, city: e.target.value })}
                  />
                </div>

                {/* 10. Policy Zone Location Tier */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Location Tier</label>
                  <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={tempFilters.zoneTier} onChange={e => setTempFilters({ ...tempFilters, zoneTier: e.target.value })}>
                    <option value="">All Tiers</option>
                    <option value="Tier 1">Tier 1 (Metro)</option>
                    <option value="Tier 2">Tier 2</option>
                    <option value="Tier 3">Tier 3 / Semi-Urban</option>
                  </select>
                </div>

                {/* 11. Sum Insured Range */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Sum Insured Range</label>
                  <div className="flex gap-2 items-center mt-1">
                    <input type="number" placeholder="Min ₹" className="input text-xs w-full bg-white shadow-2xs" value={tempFilters.sumInsuredMin} onChange={e => setTempFilters({ ...tempFilters, sumInsuredMin: e.target.value })} />
                    <span className="text-gray-400 font-bold">-</span>
                    <input type="number" placeholder="Max ₹" className="input text-xs w-full bg-white shadow-2xs" value={tempFilters.sumInsuredMax} onChange={e => setTempFilters({ ...tempFilters, sumInsuredMax: e.target.value })} />
                  </div>
                </div>

                {/* 12. Deductible */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Deductible</label>
                  <input
                    type="text"
                    placeholder="e.g. ₹25,000, None..."
                    className="input text-xs w-full bg-white shadow-2xs mt-1"
                    value={tempFilters.deductible}
                    onChange={e => setTempFilters({ ...tempFilters, deductible: e.target.value })}
                  />
                </div>

                {/* 13. Riders / Addons */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Riders / Addons</label>
                  <input
                    type="text"
                    placeholder="e.g. Critical Illness, NCB Protect..."
                    className="input text-xs w-full bg-white shadow-2xs mt-1"
                    value={tempFilters.riders}
                    onChange={e => setTempFilters({ ...tempFilters, riders: e.target.value })}
                  />
                </div>

                {/* 14. Policy Tenure */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Policy Tenure</label>
                  <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={tempFilters.policyTenure} onChange={e => setTempFilters({ ...tempFilters, policyTenure: e.target.value })}>
                    <option value="">All Tenures</option>
                    <option value="1 Year">1 Year</option>
                    <option value="2 Years">2 Years</option>
                    <option value="3 Years">3 Years</option>
                    <option value="5 Years">5 Years</option>
                  </select>
                </div>

                {/* 15. Policy Term */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Policy Term (Years)</label>
                  <input
                    type="number"
                    placeholder="Coverage Period in Years..."
                    className="input text-xs w-full bg-white shadow-2xs mt-1"
                    value={tempFilters.policyTerm}
                    onChange={e => setTempFilters({ ...tempFilters, policyTerm: e.target.value })}
                  />
                </div>

                {/* 16. Age at Entry */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Age at Entry</label>
                  <div className="flex gap-2 items-center mt-1">
                    <input type="number" placeholder="Min" className="input text-xs w-full bg-white shadow-2xs" value={tempFilters.ageAtEntryMin} onChange={e => setTempFilters({ ...tempFilters, ageAtEntryMin: e.target.value })} />
                    <span className="text-gray-400 font-bold">-</span>
                    <input type="number" placeholder="Max" className="input text-xs w-full bg-white shadow-2xs" value={tempFilters.ageAtEntryMax} onChange={e => setTempFilters({ ...tempFilters, ageAtEntryMax: e.target.value })} />
                  </div>
                </div>

                {/* 17. Age at Last Premium */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Age at Last Premium</label>
                  <div className="flex gap-2 items-center mt-1">
                    <input type="number" placeholder="Min" className="input text-xs w-full bg-white shadow-2xs" value={tempFilters.ageAtLastPremiumMin} onChange={e => setTempFilters({ ...tempFilters, ageAtLastPremiumMin: e.target.value })} />
                    <span className="text-gray-400 font-bold">-</span>
                    <input type="number" placeholder="Max" className="input text-xs w-full bg-white shadow-2xs" value={tempFilters.ageAtLastPremiumMax} onChange={e => setTempFilters({ ...tempFilters, ageAtLastPremiumMax: e.target.value })} />
                  </div>
                </div>

                {/* 18. Age at Maturity */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Age at Maturity</label>
                  <div className="flex gap-2 items-center mt-1">
                    <input type="number" placeholder="Min" className="input text-xs w-full bg-white shadow-2xs" value={tempFilters.ageAtMaturityMin} onChange={e => setTempFilters({ ...tempFilters, ageAtMaturityMin: e.target.value })} />
                    <span className="text-gray-400 font-bold">-</span>
                    <input type="number" placeholder="Max" className="input text-xs w-full bg-white shadow-2xs" value={tempFilters.ageAtMaturityMax} onChange={e => setTempFilters({ ...tempFilters, ageAtMaturityMax: e.target.value })} />
                  </div>
                </div>

                {/* 19. Policy Start Date */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Policy Start Date</label>
                  <div className="flex gap-2 items-center mt-1">
                    <DatePicker className="input text-xs w-full shadow-2xs" value={tempFilters.startDateFrom} onChange={val => setTempFilters({ ...tempFilters, startDateFrom: val })} title="From" />
                    <span className="text-gray-400 font-bold">-</span>
                    <DatePicker className="input text-xs w-full shadow-2xs" value={tempFilters.startDateTo} onChange={val => setTempFilters({ ...tempFilters, startDateTo: val })} title="To" />
                  </div>
                </div>

                {/* 20. Policy End Date */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Policy End Date</label>
                  <div className="flex gap-2 items-center mt-1">
                    <DatePicker className="input text-xs w-full shadow-2xs" value={tempFilters.endDateFrom} onChange={val => setTempFilters({ ...tempFilters, endDateFrom: val })} title="From" />
                    <span className="text-gray-400 font-bold">-</span>
                    <DatePicker className="input text-xs w-full shadow-2xs" value={tempFilters.endDateTo} onChange={val => setTempFilters({ ...tempFilters, endDateTo: val })} title="To" />
                  </div>
                </div>

                {/* 21. Policy 1st Inception Date */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Policy 1st Inception Date</label>
                  <div className="flex gap-2 items-center mt-1">
                    <DatePicker className="input text-xs w-full shadow-2xs" value={tempFilters.firstInceptionFrom} onChange={val => setTempFilters({ ...tempFilters, firstInceptionFrom: val })} title="From" />
                    <span className="text-gray-400 font-bold">-</span>
                    <DatePicker className="input text-xs w-full shadow-2xs" value={tempFilters.firstInceptionTo} onChange={val => setTempFilters({ ...tempFilters, firstInceptionTo: val })} title="To" />
                  </div>
                </div>

                {/* 22. Policy Status */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Policy Status</label>
                  <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={tempFilters.status} onChange={e => setTempFilters({ ...tempFilters, status: e.target.value })}>
                    <option value="">All Statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="EXPIRED">Expired</option>
                    <option value="LAPSED">Lapsed</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="PENDING">Pending</option>
                    <option value="SURRENDERED">Surrendered</option>
                  </select>
                </div>

                {/* 23. Assigned To */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Assigned To</label>
                  <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={tempFilters.assignedTo} onChange={e => setTempFilters({ ...tempFilters, assignedTo: e.target.value })}>
                    <option value="">All Assignees</option>
                    {employeeResults?.data?.map((emp: any) => (
                      <option key={emp.id} value={emp.userId}>
                        {emp.firstName || emp.employeeProfile?.firstName || 'Unknown'} {emp.lastName || emp.employeeProfile?.lastName || ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 24. Installment Case? */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Installment Case?</label>
                  <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={tempFilters.installmentCase} onChange={e => setTempFilters({ ...tempFilters, installmentCase: e.target.value })}>
                    <option value="">All Cases</option>
                    <option value="YES">Yes (EMI / Installment)</option>
                    <option value="NO">No (Single Payment)</option>
                  </select>
                </div>

                {/* 25. Loan Provider */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Loan Provider</label>
                  <input
                    type="text"
                    placeholder="e.g. Bajaj Finance, HDFC..."
                    className="input text-xs w-full bg-white shadow-2xs mt-1"
                    value={tempFilters.loanProvider}
                    onChange={e => setTempFilters({ ...tempFilters, loanProvider: e.target.value })}
                  />
                </div>

                {/* 26. Installment Frequency */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Installment Frequency</label>
                  <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={tempFilters.installmentFrequency} onChange={e => setTempFilters({ ...tempFilters, installmentFrequency: e.target.value })}>
                    <option value="">All Frequencies</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="HALF_YEARLY">Half Yearly</option>
                    <option value="YEARLY">Yearly</option>
                    <option value="SINGLE">Single</option>
                  </select>
                </div>

                {/* 27. No. of Installments */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">No. of Installments</label>
                  <input
                    type="number"
                    placeholder="e.g. 12, 4, 2..."
                    className="input text-xs w-full bg-white shadow-2xs mt-1"
                    value={tempFilters.noOfInstallments}
                    onChange={e => setTempFilters({ ...tempFilters, noOfInstallments: e.target.value })}
                  />
                </div>

                {/* 28. 1st Installment Date */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">1st Installment Date</label>
                  <div className="flex gap-2 items-center mt-1">
                    <DatePicker className="input text-xs w-full shadow-2xs" value={tempFilters.firstInstallmentFrom} onChange={val => setTempFilters({ ...tempFilters, firstInstallmentFrom: val })} title="From" />
                    <span className="text-gray-400 font-bold">-</span>
                    <DatePicker className="input text-xs w-full shadow-2xs" value={tempFilters.firstInstallmentTo} onChange={val => setTempFilters({ ...tempFilters, firstInstallmentTo: val })} title="To" />
                  </div>
                </div>

                {/* 29. Last Installment Date */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Last Installment Date</label>
                  <div className="flex gap-2 items-center mt-1">
                    <DatePicker className="input text-xs w-full shadow-2xs" value={tempFilters.lastInstallmentFrom} onChange={val => setTempFilters({ ...tempFilters, lastInstallmentFrom: val })} title="From" />
                    <span className="text-gray-400 font-bold">-</span>
                    <DatePicker className="input text-xs w-full shadow-2xs" value={tempFilters.lastInstallmentTo} onChange={val => setTempFilters({ ...tempFilters, lastInstallmentTo: val })} title="To" />
                  </div>
                </div>

                {/* 30. Bank Name */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Bank Name</label>
                  <input
                    type="text"
                    placeholder="e.g. ICICI, HDFC, SBI..."
                    className="input text-xs w-full bg-white shadow-2xs mt-1"
                    value={tempFilters.bankName}
                    onChange={e => setTempFilters({ ...tempFilters, bankName: e.target.value })}
                  />
                </div>

              </div>

              {/* Actions */}
              <div className="flex flex-wrap justify-between items-center gap-3 mt-6 pt-4 border-t border-slate-200/70">
                {/* Export Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 mr-1">Export Data:</span>
                  <button
                    type="button"
                    onClick={exportPoliciesToExcel}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer shadow-2xs transition-all flex items-center gap-1.5 text-xs font-bold bg-white"
                    title="Export to Excel"
                  >
                    <Download size={14} className="text-emerald-600" />
                    <span>Export Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={exportPoliciesToPdf}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer shadow-2xs transition-all flex items-center gap-1.5 text-xs font-bold bg-white"
                    title="Export to PDF"
                  >
                    <FileText size={14} className="text-red-500" />
                    <span>Export PDF</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => { setTempFilters(defaultFilters); setAppliedFilters(defaultFilters); setPage(1); }}
                    className="px-6 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                  >
                    Reset Filters
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAppliedFilters(tempFilters); setPage(1); }}
                    className="px-6 py-2 text-xs font-extrabold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl transition-all shadow-md shadow-blue-500/20 hover:scale-105 cursor-pointer"
                  >
                    Apply Filters {activePoliciesFilterCount > 0 ? `(${activePoliciesFilterCount})` : ''}
                  </button>
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
              onRowClick={r => openView(r)}
              onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); setPage(1); }}
            />
          </div>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          if (isDocUploadModalOpen) return;
          closeModal();
        }}
        title={isViewMode ? "View Policy Profile" : (editTarget ? "Edit Policy Profile" : "Add New Policy")}
        subtitle={isViewMode ? "View policy details and plan information." : (editTarget ? "Update policy details and plan information." : "Enter policy details matching client profile standards.")}
        size="2xl"
        actions={
          <div className="flex flex-wrap items-center gap-2.5 mr-1">
            {isViewMode ? (
              <button
                type="button"
                className="px-3 sm:px-5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl cursor-pointer shadow-md shadow-blue-500/20 transition-all hover:scale-105"
                onClick={() => setIsViewMode(false)}
              >
                Edit
              </button>
            ) : (
              <button
                type="button"
                className="px-3 sm:px-5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl cursor-pointer shadow-md shadow-blue-500/20 transition-all hover:scale-105"
                onClick={handleSubmit(onSubmit)}
              >
                {editTarget ? 'Update Policy' : 'Save Policy'}
              </button>
            )}
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
              Premium & Payment Details
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
            <fieldset disabled={isViewMode} className="min-w-0 border-0 p-0 m-0 w-full">
              {/* ════════════════ TAB 1: Policy Details + Plan Details ════════════════ */}
              {activePolicyTab === 'policyPlan' && (
                <div className="space-y-4 animate-fadeIn">
                  {/* Section 1: Policy Details */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                      onClick={() => setIsPolicyDetailsCollapsed(prev => !prev)}
                    >
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">1</span>
                        Policy Details
                      </h4>
                      <div className="flex flex-wrap items-center gap-2">
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
                                }} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer">
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
                            Insurance Company Category <span className="text-red-500">*</span>
                          </label>
                          <select
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            value={selectedType || ''}
                            onChange={e => {
                              setSelectedType(e.target.value);
                              setSelectedCompany('');
                              setSelectedPlan(null);
                              setValue('planId', '');
                            }}
                            required
                          >
                            <option value="">Select Insurance Company Category *</option>
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
                            required
                          >
                            <option value="">Select Insurance Company *</option>
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
                            Insurance Plan Category <span className="text-red-500">*</span>
                          </label>
                          <select
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            value={selectedType || ''}
                            onChange={e => {
                              setSelectedType(e.target.value);
                              setSelectedCompany('');
                              setSelectedPlan(null);
                              setValue('planId', '');
                            }}
                            required
                          >
                            <option value="">Select Insurance Plan Category *</option>
                            {availableTypes.map(t => (
                              <option key={t} value={t}>
                                {t === 'HEALTH' ? 'Health Plan Category' : t === 'LIFE' ? 'Life Plan Category' : `${t} Plan Category`}
                              </option>
                            ))}
                          </select>
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
                            Comment <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            rows={2}
                            {...register('notes', { required: true })}
                            required
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
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">2</span>
                        Plan Details
                      </h4>
                      <div className="flex flex-wrap items-center gap-2">
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
                            <select
                              className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              value={watchSumAssured || ''}
                              onChange={(e) => {
                                const num = Number(e.target.value);
                                setValue('sumAssured', num, { shouldValidate: true, shouldDirty: true });
                              }}
                              required
                            >
                              <option value="">Select Sum Insured *</option>
                              {SUM_INSURED_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
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
                          <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                            {[
                              { id: 'CRITICAL_ILLNESS', label: 'Critical Illness' },
                              { id: 'ACCIDENTAL_DEATH', label: 'Accidental Death Rider' },
                              { id: 'ROOM_RENT_WAIVER', label: 'Room Rent Limit Waiver' },
                              { id: 'MATERNITY_COVER', label: 'Maternity Cover Option' },
                              { id: 'OPD_BENEFIT', label: 'OPD Benefit Rider' },
                              { id: 'WAIVER_OF_PREMIUM', label: 'Waiver of Premium' },
                            ].map(rider => (
                              <label key={rider.id} className="flex flex-wrap items-center gap-2 cursor-pointer text-gray-700 hover:text-blue-600 transition-colors">
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
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">1</span>
                        Premium Breakdown & Instalments
                      </h4>
                      <div className="flex flex-wrap items-center gap-2">
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
                              type="text"
                              value={formatIndianNumber(watchPremiumAmount)}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/,/g, '');
                                const num = Number(raw);
                                if (!isNaN(num)) {
                                  setValue('premiumAmount', num, { shouldValidate: true, shouldDirty: true });
                                } else if (raw === '') {
                                  setValue('premiumAmount', 0 as any, { shouldValidate: true, shouldDirty: true });
                                }
                              }}
                              className="input pl-9 w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              placeholder="Enter premium amount"
                            />
                          </div>
                          {watchPremiumAmount ? (
                            <div className="text-[10.5px] text-orange-600 mt-1.5 font-bold tracking-wide bg-orange-50/50 inline-block px-2 py-0.5 rounded-md border border-orange-100/50">{numberToIndianWords(watchPremiumAmount)}</div>
                          ) : null}
                        </div>

                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            1st Year Premium Amount (₹)
                          </label>
                          <input
                            type="text"
                            value={formatIndianNumber(watchFirstYearPremium || 0)}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/,/g, '');
                              const num = Number(raw);
                              if (!isNaN(num)) {
                                setValue('firstYearPremium', num, { shouldValidate: true, shouldDirty: true });
                              } else if (raw === '') {
                                setValue('firstYearPremium', 0 as any, { shouldValidate: true, shouldDirty: true });
                              }
                            }}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="1st Year Premium"
                          />
                          {watchFirstYearPremium ? (
                            <div className="text-[10.5px] text-orange-600 mt-1.5 font-bold tracking-wide bg-orange-50/50 inline-block px-2 py-0.5 rounded-md border border-orange-100/50">{numberToIndianWords(watchFirstYearPremium)}</div>
                          ) : null}
                        </div>

                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                            2nd Year Onwards Premium Amount (₹)
                          </label>
                          <input
                            type="text"
                            value={formatIndianNumber(watchSecondYearPremium || 0)}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/,/g, '');
                              const num = Number(raw);
                              if (!isNaN(num)) {
                                setValue('secondYearPremium', num, { shouldValidate: true, shouldDirty: true });
                              } else if (raw === '') {
                                setValue('secondYearPremium', 0 as any, { shouldValidate: true, shouldDirty: true });
                              }
                            }}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="2nd Year Onwards Premium"
                          />
                          {watchSecondYearPremium ? (
                            <div className="text-[10.5px] text-orange-600 mt-1.5 font-bold tracking-wide bg-orange-50/50 inline-block px-2 py-0.5 rounded-md border border-orange-100/50">{numberToIndianWords(watchSecondYearPremium)}</div>
                          ) : null}
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
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">2</span>
                        Tenure, Maturity & Term Dates
                      </h4>
                      <div className="flex flex-wrap items-center gap-2">
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
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-600 to-blue-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">3</span>
                        Installment / EMI Gateway Details
                      </h4>
                      <div className="flex flex-wrap items-center gap-2">
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
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">4</span>
                        Payment Mode & Loan Details
                      </h4>
                      <div className="flex flex-wrap items-center gap-2">
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

                  {/* Section 5: Payment Account Details */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                      onClick={() => setIsPaymentAccountCollapsed(prev => !prev)}
                    >
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">5</span>
                        Payment Account Details
                      </h4>
                      <div className="flex flex-wrap items-center gap-2">
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

                  {/* Section 6: GST No Details */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-emerald-50/80 via-slate-50 to-teal-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                      onClick={() => setIsGstDetailsCollapsed(prev => !prev)}
                    >
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">6</span>
                        GST No Details
                      </h4>
                      <div className="flex flex-wrap items-center gap-2">
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

                  {/* Section 7: Conditional PHC Details */}
                  {(selectedType?.toUpperCase() === 'HEALTH' || selectedPlan?.category?.toUpperCase() === 'HEALTH') && (
                    <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-teal-50/80 via-slate-50 to-emerald-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                        onClick={() => setIsPhcCollapsed(prev => !prev)}
                      >
                        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-gradient-to-br from-teal-600 to-emerald-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">7</span>
                          Preventive Health Checkup Details
                        </h4>
                        <div className="flex flex-wrap items-center gap-2">
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

              {/* ════════════════ TAB 3: Connected Person Details ════════════════ */}
              {activePolicyTab === 'connectedPersons' && (
                <div className="space-y-4 animate-fadeIn">
                  {/* Header & Add Button */}
                  <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-blue-50/90 to-indigo-50/50 rounded-2xl border border-blue-100 shadow-2xs">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <Users size={16} className="text-blue-600" />
                        Connected Persons & Nominee Details
                      </h4>
                      <p className="text-[11px] text-slate-500">Add dependents, covered persons, and allocate nominee percentage.</p>
                    </div>
                    <button
                      type="button"
                      onClick={addConnectedPerson}
                      className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-[10px] sm:text-xs rounded-xl flex flex-wrap items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all hover:scale-105 cursor-pointer"
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
                      <div className="flex flex-wrap items-center gap-2">
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
                        className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] sm:text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer inline-flex flex-wrap items-center gap-1.5"
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
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-extrabold text-xs flex items-center justify-center border border-slate-200">
                                {idx + 1}
                              </span>
                              <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wide">
                                {person.name || `Connected Person #${idx + 1}`}
                              </span>
                              {person.isCovered && (
                                <span className="inline-flex flex-wrap items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  Covered under policy
                                </span>
                              )}
                              {person.isNominee && (
                                <span className="inline-flex flex-wrap items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
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
                          <div className="flex flex-wrap items-center gap-6 pt-1 border-t border-slate-100">
                            <label className="flex flex-wrap items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={person.isCovered}
                                onChange={e => updateConnectedPerson(person.id, { isCovered: e.target.checked })}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="text-xs font-bold text-slate-700">Covered under this policy</span>
                            </label>

                            <label className="flex flex-wrap items-center gap-2 cursor-pointer select-none">
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
                              <h6 className="text-[11px] font-extrabold text-purple-800 uppercase tracking-wider flex flex-wrap items-center gap-1.5">
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
                          <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-gradient-to-br from-teal-600 to-emerald-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">1</span>
                            PHC Configuration & Eligibility
                          </h4>
                          <div className="flex flex-wrap items-center gap-2">
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
                            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">2</span>
                              PHC Booking & Centre Details
                            </h4>
                            <div className="flex flex-wrap items-center gap-2">
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
                            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">3</span>
                              PHC Claim & Settlement Details
                            </h4>
                            <div className="flex flex-wrap items-center gap-2">
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
                  <div className="flex items-center justify-between bg-gradient-to-r from-slate-100/80 via-slate-50 to-slate-100/50 p-4 border border-slate-200/90 rounded-2xl shadow-2xs">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <FileText size={16} className="text-blue-600" />
                        Policy Documents Upload
                      </h4>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">Upload files related to this policy</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDocUploadModalOpen(true);
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-xl flex flex-wrap items-center gap-2 shadow-md shadow-blue-500/20 transition-all hover:scale-105 cursor-pointer"
                    >
                      <Upload size={14} /> Upload Document
                    </button>
                  </div>

                  {pendingDocs.length > 0 ? (
                    <div className="space-y-3">
                      {pendingDocs.map((doc, i) => (
                        <div key={i} className="p-3 bg-white border border-slate-200/90 rounded-xl flex items-center justify-between shadow-2xs">
                          <div>
                            <p className="text-xs font-extrabold text-slate-800">{doc.title}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{doc.type} • {doc.file.name}</p>
                            {doc.description && <p className="text-[10px] text-slate-400 mt-0.5">{doc.description}</p>}
                          </div>
                          <button type="button" onClick={() => setPendingDocs(p => p.filter((_, idx) => idx !== i))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer" title="Remove Document">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 bg-slate-50 border border-slate-200/90 rounded-2xl text-center space-y-2">
                      <FileText size={28} className="text-slate-400 mx-auto" />
                      <p className="text-xs font-bold text-slate-700">No documents added yet.</p>
                      <p className="text-[11px] text-slate-400">Click the button above to add documents to this policy.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ════════════════ TAB 7: Claims ════════════════ */}
              {activePolicyTab === 'policyClaims' && (
                <div className="space-y-4 animate-fadeIn">
                  {/* Header Banner */}
                  <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 via-indigo-50/50 to-slate-50 p-3.5 rounded-2xl border border-blue-100/80">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
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
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-extrabold text-xs text-slate-900">{c.claimNumber}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${statusStyle}`}>
                                    {c.status}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                  <span className="text-xs font-black text-emerald-700">₹{Number(c.claimAmount || 0).toLocaleString('en-IN')}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      closeModal();
                                      navigate(`/claims`);
                                    }}
                                    className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex flex-wrap items-center gap-1 cursor-pointer"
                                    title="Edit on Claims page"
                                  >
                                    <Pencil size={12} />
                                    Edit
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
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
            </fieldset>
          </div>

          {/* Info Banner */}
          <div className="bg-blue-50/40 border border-blue-100/50 p-3 rounded-xl flex flex-wrap items-center gap-2.5 text-xs text-blue-700 mt-2">
            <Info size={16} className="text-blue-500 shrink-0" />
            <span>Make sure all details are accurate before saving the policy.</span>
          </div>

        </form>
      </Modal>


      {/* Document Upload Modal */}
      <Modal
        open={isDocUploadModalOpen}
        onClose={() => {
          setIsDocUploadModalOpen(false);
          setDocUploadFields({ type: 'POLICY', title: '', description: '', file: null });
        }}
        title="Upload Document"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Document Type <span className="text-red-500">*</span></label>
            <select
              value={docUploadFields.type}
              onChange={e => setDocUploadFields(p => ({ ...p, type: e.target.value }))}
              className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
            >
              <option value="POLICY">Main Policy</option>
              <option value="ENDORSEMENT">Endorsement</option>
              <option value="KYC">KYC Document</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Document Title <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={docUploadFields.title}
              onChange={e => setDocUploadFields(p => ({ ...p, title: e.target.value }))}
              className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
              placeholder="e.g. Policy Schedule 2024"
            />
          </div>
          <div>
            <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Description</label>
            <textarea
              rows={2}
              value={docUploadFields.description}
              onChange={e => setDocUploadFields(p => ({ ...p, description: e.target.value }))}
              className="input w-full p-2.5 text-xs rounded-xl bg-white border border-slate-200"
              placeholder="Optional notes about this document"
            />
          </div>
          <div>
            <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Choose File <span className="text-red-500">*</span></label>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-blue-500 hover:bg-blue-50/30 transition-colors">
              <input
                type="file"
                onChange={e => setDocUploadFields(p => ({ ...p, file: e.target.files?.[0] || null }))}
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
              />
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              className="btn-secondary px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDocUploadModalOpen(false);
                setDocUploadFields({ type: 'POLICY', title: '', description: '', file: null });
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDocUploadAdd();
              }}
            >
              Upload
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Policy" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Delete policy <strong>{deleteTarget?.policyNumber}</strong>? This cannot be undone.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="btn-danger" onClick={confirmDelete} disabled={deletePolicy.isPending}>
            {deletePolicy.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
