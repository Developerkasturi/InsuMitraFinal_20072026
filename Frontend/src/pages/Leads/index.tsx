import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useLeadKanban, useMoveLeadStage, useCreateLead, useUpdateLead, useDeleteLead } from '@hooks/useLeads';
import Modal from '@comps/common/Modal';
import {
  Plus, Search, Pencil, Trash2, Shield, Upload, Phone, Calendar,
  MessageCircle, LayoutGrid, List, Filter, X, UserPlus, Users,
  UserCircle2, Mail, ChevronDown, Flame, Thermometer, Snowflake,
  Columns, ArrowUpDown, ChevronUp, ChevronRight, Send, RefreshCw, Save, FileText, History, Lock, Download
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import clsx from 'clsx';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { contactsService, policiesService, leadsService, employeesService, insuranceService } from '@api/index';
import toast from 'react-hot-toast';
import { useAuthStore } from '@store/auth.store';
import { useLookupStore } from '@store/lookup.store';
import { format } from 'date-fns';
import { DatePicker } from '@comps/common/DatePicker';
import { CountryPhoneInput } from '@comps/common/CountryPhoneInput';
import { DatalistInput } from '@comps/common/DatalistInput';
import { sortData } from '../../utils/sortUtils';

const EDUCATION_OPTIONS = [
  'Metric',
  'Intermediate',
  'Graduate',
  'Post Graduate',
  'Up to 9th class passed',
  '10th class passed',
  'Post Graduate (Gen)',
  'Med Graduate',
  'Post Graduate, Eng',
  'Law Graduate / Post Graduate',
  'CA/ICWA/MBA/CFA',
  'Computer degree other',
  'Other',
];

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

const RIDER_OPTIONS = [
  'None',
  'Zero Depreciation',
  'Engine Protect',
  'NCB Protector',
  'Consumables Cover',
  'Personal Accident',
  'Hospital Daily Cash',
  'Critical Illness Rider',
  'Waiver of Premium',
];

const MAX_REALISTIC_TENURE_YEARS = 50;

function parseTenureYears(tenureStr: string): number {
  if (!tenureStr) return 0;
  const tLower = tenureStr.trim().toLowerCase();
  const yearMatch = tLower.match(/(\d+)\s*(year|years|yr|yrs|y)/);
  const numOnlyMatch = tLower.match(/^(\d+)$/);
  if (yearMatch) return parseInt(yearMatch[1], 10);
  if (numOnlyMatch) return parseInt(numOnlyMatch[1], 10);
  return 0;
}

function calculateTenureFromDates(startDateStr: string, endDateStr: string): string {
  if (!startDateStr || !endDateStr) return '';
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return '';

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthDays = new Date(end.getFullYear(), end.getMonth(), 0).getDate();
    days += prevMonthDays;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years > MAX_REALISTIC_TENURE_YEARS) {
    years = MAX_REALISTIC_TENURE_YEARS;
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'Year' : 'Years'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'Month' : 'Months'}`);
  if (days > 0) parts.push(`${days} ${days === 1 ? 'Day' : 'Days'}`);

  return parts.length > 0 ? parts.join(' ') : '1 Year';
}

function calculateEndDateFromTenure(startDateStr: string, tenureStr: string): string | null {
  if (!startDateStr || !tenureStr) return null;
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return null;

  const tLower = tenureStr.trim().toLowerCase();
  let yearsToAdd = 0;
  let monthsToAdd = 0;
  let daysToAdd = 0;

  const yearMatch = tLower.match(/(\d+)\s*(year|years|yr|yrs|y)/);
  const monthMatch = tLower.match(/(\d+)\s*(month|months|m)/);
  const dayMatch = tLower.match(/(\d+)\s*(day|days|d)/);
  const numOnlyMatch = tLower.match(/^(\d+)$/);

  if (yearMatch) yearsToAdd = parseInt(yearMatch[1], 10);
  if (monthMatch) monthsToAdd = parseInt(monthMatch[1], 10);
  if (dayMatch) daysToAdd = parseInt(dayMatch[1], 10);
  if (!yearMatch && !monthMatch && !dayMatch && numOnlyMatch) {
    yearsToAdd = parseInt(numOnlyMatch[1], 10);
  }

  if (yearsToAdd > MAX_REALISTIC_TENURE_YEARS) {
    toast.error(`Premium payment period cannot exceed ${MAX_REALISTIC_TENURE_YEARS} years.`);
    yearsToAdd = MAX_REALISTIC_TENURE_YEARS;
  }

  if (yearsToAdd === 0 && monthsToAdd === 0 && daysToAdd === 0) return null;

  const end = new Date(start);
  if (yearsToAdd > 0) end.setFullYear(end.getFullYear() + yearsToAdd);
  if (monthsToAdd > 0) end.setMonth(end.getMonth() + monthsToAdd);
  if (daysToAdd > 0) end.setDate(end.getDate() + daysToAdd);

  return end.toISOString().split('T')[0];
}

const OCCUPATION_TYPE_OPTIONS = [
  'Salaried Private',
  'Salaried Gov',
  'Salaried/Service',
  'Business Owner',
  'Business',
  'Industrialist',
  'Self Employed Professional',
  'Agriculture',
  'Student',
  'Retired',
  'Homemaker',
  'Other',
];

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

// ── Stage Mappings ────────────────────────────────────────────────────────────

export const STAGE_LABELS: Record<string, string> = {
  TO_CONTACT: 'To Contact',
  CONTACTED: 'Contacted',
  PROPOSAL_SENT: 'Proposal Sent',
  LOGIN_PROGRESS: 'Login Progress',
  PAYMENT_DONE: 'Payment Done',
  PROCESS_COMPLETED: 'Process Completed',
};

const UI_STAGES = ['To Contact', 'Contacted', 'Proposal Sent', 'Login Progress', 'Payment Done', 'Process Completed'];

const STAGE_MAPPINGS: Record<string, string> = {
  'To Contact': 'TO_CONTACT',
  'Contacted': 'CONTACTED',
  'Proposal Sent': 'PROPOSAL_SENT',
  'Login Progress': 'LOGIN_PROGRESS',
  'Payment Done': 'PAYMENT_DONE',
  'Process Completed': 'PROCESS_COMPLETED',
};

const BACKEND_TO_UI: Record<string, string> = {
  TO_CONTACT: 'To Contact',
  CONTACTED: 'Contacted',
  PROPOSAL_SENT: 'Proposal Sent',
  LOGIN_PROGRESS: 'Login Progress',
  PAYMENT_DONE: 'Payment Done',
  PROCESS_COMPLETED: 'Process Completed',
};

const STAGE_COLORS: Record<string, string> = {
  'To Contact': 'bg-blue-50/20 border-blue-100',
  'Contacted': 'bg-indigo-50/20 border-indigo-100',
  'Proposal Sent': 'bg-purple-50/20 border-purple-100',
  'Login Progress': 'bg-orange-50/20 border-orange-100',
  'Payment Done': 'bg-green-50/20 border-green-100',
  'Process Completed': 'bg-emerald-50/20 border-emerald-100',
};

const BADGE_STYLES: Record<string, string> = {
  TO_CONTACT: 'bg-blue-50 text-blue-700 border-blue-200',
  CONTACTED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  PROPOSAL_SENT: 'bg-purple-50 text-purple-700 border-purple-200',
  LOGIN_PROGRESS: 'bg-orange-50 text-orange-700 border-orange-200',
  PAYMENT_DONE: 'bg-green-50 text-green-700 border-green-200',
  PROCESS_COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
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
  HOT: { label: 'Hot', cls: 'text-red-600 bg-red-50 border-red-200', iconName: 'Flame' },
  WARM: { label: 'Warm', cls: 'text-amber-600 bg-amber-50 border-amber-200', iconName: 'Thermometer' },
  COLD: { label: 'Cold', cls: 'text-blue-500 bg-blue-50 border-blue-200', iconName: 'Snowflake' },
};

function HotnessIcon({ level }: { level: HotnessLevel }) {
  if (level === 'HOT') return <Flame size={10} />;
  if (level === 'WARM') return <Thermometer size={10} />;
  return <Snowflake size={10} />;
}

function parseLeadNotes(notes?: string | null): Record<string, any> {
  if (!notes) return {};
  try {
    const parsed = JSON.parse(notes);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

// ── Form schema ───────────────────────────────────────────────────────────────
export const leadFormSchema = z.object({
  // System fields mapping
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  phone: z.string().min(10, 'Min 10 digits'),
  alternatePhone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', '']).optional(),
  dateOfBirth: z.string().optional(),
  height: z.coerce.number().optional().or(z.literal('')),
  weight: z.coerce.number().optional().or(z.literal('')),
  panNumber: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  annualIncome: z.coerce.number().min(0).optional().or(z.literal('')),
  notes: z.string().optional(),
  tags: z.string().optional(),
  isActive: z.string().optional(),
  city: z.string().optional(),
  source: z.string().optional(),
  assignedEmployeeId: z.string().optional(),
  leadStage: z.string().optional(),
  leadStatus: z.string().optional(),
  leadType: z.string().optional(),
  followUpDate: z.string().optional(),
});
const schema = leadFormSchema;
type Form = z.infer<typeof schema>;

// ── Column definitions ────────────────────────────────────────────────────────
const ALL_TABLE_COLUMNS = [
  { key: 'name', label: 'Client Name', defaultVisible: true },
  { key: 'plan', label: 'Product', defaultVisible: true },
  { key: 'hotness', label: 'Hotness', defaultVisible: true },
  { key: 'employee', label: 'Assigned To', defaultVisible: true },
  { key: 'premiumBudget', label: 'Exp. Premium', defaultVisible: true },
  { key: 'followUpDate', label: 'Next Follow-up', defaultVisible: true },
  { key: 'stage', label: 'Stage', defaultVisible: true },
  { key: 'actions', label: '', defaultVisible: true },
];

const PLAN_CATEGORIES = [
  { value: 'LIFE', label: 'Life Insurance' },
  { value: 'HEALTH', label: 'Health Insurance' },
  { value: 'MOTOR', label: 'Motor Insurance' },
  { value: 'TRAVEL', label: 'Travel Insurance' },
  { value: 'GENERAL', label: 'General Insurance' },
];

const FILTER_STAGE_OPTIONS = [
  { value: 'TO_CONTACT', label: 'To Contact' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'PROPOSAL_SENT', label: 'Proposal Sent' },
  { value: 'LOGIN_PROGRESS', label: 'Login Progress' },
  { value: 'PAYMENT_DONE', label: 'Payment Done' },
  { value: 'PROCESS_COMPLETED', label: 'Process Completed' },
];

const LEAD_STATUS_OPTIONS = [
  { value: 'NOT_INTERESTED', label: 'Not Interested' },
  { value: 'LEAD_LOST', label: 'Lead Lost' },
  { value: 'INTERESTED', label: 'Interested' },
  { value: 'HOT', label: 'Hot' },
  { value: 'VERY_HOT', label: 'Very Hot' },
];

const MEDICAL_CONDITIONS_LIST = [
  'Diabetes Mellitus',
  'High BP / Cholesterol',
  'Heart Disease',
  'Tuberculosis',
  'Asthma',
  'Other Respiratory Infection',
  'Disease of bones/joints',
  'Slip disc',
  'Spinal Disorder',
  'Ligament Injury',
  'Cancer',
  'Gynecological disorder (DUB, Fibroid Uterus, Ovarian cyst)',
  'Undergone Cesarean / Hysterectomy',
  'Disease of Stomach / Intestine',
  'Liver / Gall Bladder / Pancreas',
  'Kidney / Urinary Bladder / Urinary Tract Disease',
  'Disease of Prostate / Fistula / Piles / Genital Disease',
  'Cataract or Other Disease of Eye and ENT',
  'Thyroid',
  'Others'
];

function MultiSelectBox({
  label,
  selectedValues,
  onChange,
  badgeColor = 'blue',
  placeholder = 'Select Conditions...'
}: {
  label: string;
  selectedValues: string[];
  onChange: (vals: string[]) => void;
  badgeColor?: 'blue' | 'orange';
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = MEDICAL_CONDITIONS_LIST.filter(opt =>
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleOption = (opt: string) => {
    if (selectedValues.includes(opt)) {
      onChange(selectedValues.filter(o => o !== opt));
    } else {
      onChange([...selectedValues, opt]);
    }
  };

  return (
    <div className="relative">
      <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">{label}</label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="input min-h-[40px] w-full cursor-pointer flex items-center justify-between gap-2 flex-wrap py-1.5 px-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all"
      >
        {selectedValues.length === 0 ? (
          <span className="text-slate-400 text-xs font-normal">{placeholder}</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {selectedValues.map((val, idx) => (
              <span
                key={idx}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                  badgeColor === 'orange'
                    ? 'bg-orange-50 text-orange-700 border-orange-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}
              >
                {val}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(selectedValues.filter(v => v !== val));
                  }}
                  className="hover:text-red-600 font-bold cursor-pointer ml-0.5"
                >
                  ×
                </span>
              </span>
            ))}
          </div>
        )}
        <span className="text-slate-400 text-[10px] ml-auto">▼</span>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl p-2.5 max-h-60 overflow-y-auto">
            <input
              type="text"
              className="input w-full text-xs py-1.5 px-2.5 mb-2 border border-slate-200 rounded-lg"
              placeholder="Type to search condition..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="space-y-0.5">
              {filteredOptions.map((opt) => {
                const isChecked = selectedValues.includes(opt);
                return (
                  <label
                    key={opt}
                    className="flex flex-wrap items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-xs select-none"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className={`w-3.5 h-3.5 rounded cursor-pointer ${badgeColor === 'orange' ? 'accent-orange-500' : 'accent-blue-600'}`}
                      checked={isChecked}
                      onChange={() => toggleOption(opt)}
                    />
                    <span className={`font-medium ${isChecked ? 'text-slate-900 font-bold' : 'text-slate-600'}`}>
                      {opt}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Leads() {
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [showFilters, setShowFilters] = useState(false);
  const [createInitialStage, setCreateInitialStage] = useState<string>('TO_CONTACT');

  // Filters
  const [filterPlans, setFilterPlans] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterStages, setFilterStages] = useState<string[]>([]);
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterEnquiryDateFrom, setFilterEnquiryDateFrom] = useState('');
  const [filterEnquiryDateTo, setFilterEnquiryDateTo] = useState('');
  const [filterFinalSellsFrom, setFilterFinalSellsFrom] = useState('');
  const [filterFinalSellsTo, setFilterFinalSellsTo] = useState('');
  const [filterExpectedPremiumMin, setFilterExpectedPremiumMin] = useState('');
  const [filterExpectedPremiumMax, setFilterExpectedPremiumMax] = useState('');
  const [filterLeadSource, setFilterLeadSource] = useState('');
  const [selectedQuickFilter, setSelectedQuickFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const [planFilterOpen, setPlanFilterOpen] = useState(false);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [stageFilterOpen, setStageFilterOpen] = useState(false);
  const [typeFilterOpen, setTypeFilterOpen] = useState(false);
  const planFilterRef = useRef<HTMLDivElement>(null);
  const statusFilterRef = useRef<HTMLDivElement>(null);
  const stageFilterRef = useRef<HTMLDivElement>(null);
  const typeFilterRef = useRef<HTMLDivElement>(null);

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
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      openCreate();
    }
  }, [searchParams]);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  // Detail popup
  const [detailTarget, setDetailTarget] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<'overview' | 'comments' | 'history'>('overview');
  const detailSaveHandlerRef = useRef<(() => void) | null>(null);
  const detailIsSavingRef = useRef<boolean>(false);

  const [activeLeadTab, setActiveLeadTab] = useState('Product Interest');
  const [editContactId, setEditContactId] = useState<string | null>(null);
  const [loadedContact, setLoadedContact] = useState<any | null>(null);
  const [duplicateContactMatched, setDuplicateContactMatched] = useState<any | null>(null);
  const [maxRenewalWindow, setMaxRenewalWindow] = useState<number>(45);

  useEffect(() => {
    leadsService.getRenewalWindow()
      .then((res: any) => {
        if (res?.data?.maxWindow) {
          setMaxRenewalWindow(res.data.maxWindow);
        }
      })
      .catch((err: any) => console.error(err));
  }, []);

  // Policy Modal States for PAYMENT_DONE -> PROCESS_COMPLETED transition
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [policyLead, setPolicyLead] = useState<any>(null);
  const [policySelectedType, setPolicySelectedType] = useState('');
  const [policySelectedCompany, setPolicySelectedCompany] = useState('');
  const [policySelectedPlanId, setPolicySelectedPlanId] = useState('');

  const { register: registerPolicy, handleSubmit: handleSubmitPolicy, reset: resetPolicy, setValue: setPolicyValue, watch: watchPolicy } = useForm<any>({
    defaultValues: {
      policyNumber: '',
      sumAssured: '',
      premiumAmount: '',
      deductible: '',
      riders: '',
      startDate: '',
      endDate: '',
      paymentFrequency: 'YEARLY',
      downpaymentAmount: '',
      processingFee: '',
      installmentAmount: '',
      isInstallment: false,
      installmentDate: '',
      policyTenure: '',
      loanProvider: '',
      accountType: '',
      comment: '',
    }
  });

  const { data: allPlansRes } = useQuery({
    queryKey: ['all-plans-list-picker'],
    queryFn: () => policiesService.plans(),
  });
  const plansList = allPlansRes?.data ?? [];

  const availableTypes = useMemo(() => {
    return Array.from(new Set(plansList.map((p: any) => p.category))).filter(Boolean) as string[];
  }, [plansList]);

  const availableCompanies = useMemo(() => {
    if (!policySelectedType) return [];
    return Array.from(
      new Set(
        plansList
          .filter((p: any) => p.category === policySelectedType)
          .map((p: any) => p.company?.name)
          .filter(Boolean)
      )
    ) as string[];
  }, [plansList, policySelectedType]);

  const availablePlans = useMemo(() => {
    if (!policySelectedType || !policySelectedCompany) return [];
    return plansList.filter(
      (p: any) => p.category === policySelectedType && p.company?.name === policySelectedCompany
    );
  }, [plansList, policySelectedType, policySelectedCompany]);

  const watchPolicyStartDate = watchPolicy('startDate');
  const watchPolicyEndDate = watchPolicy('endDate');
  const watchPolicyTenure = watchPolicy('policyTenure');
  const watchPolicyIsInstallment = watchPolicy('isInstallment');



  // Sync Policy Tenure automatically whenever Start Date & End Date change with strict Start Date < End Date validation
  useEffect(() => {
    if (watchPolicyStartDate && watchPolicyEndDate) {
      const start = new Date(watchPolicyStartDate);
      const end = new Date(watchPolicyEndDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        if (end <= start) {
          toast.error('Policy Start Date must be before End Date');
          const newEnd = new Date(start);
          newEnd.setFullYear(start.getFullYear() + 1);
          setPolicyValue('endDate', newEnd.toISOString().split('T')[0]);
          return;
        }
        const calcTenure = calculateTenureFromDates(watchPolicyStartDate, watchPolicyEndDate);
        if (calcTenure && calcTenure !== watchPolicyTenure) {
          setPolicyValue('policyTenure', calcTenure);
        }
      }
    }
  }, [watchPolicyStartDate, watchPolicyEndDate, setPolicyValue]);

  const triggerPolicyCreationForLead = (leadObj: any) => {
    setDetailOpen(false); // Close the detail popup
    setPolicyLead(leadObj);
    const plan = leadObj.plan || {};

    if (plan.id) {
      setPolicySelectedType(plan.category || '');
      setPolicySelectedCompany(plan.company?.name || '');
      setPolicySelectedPlanId(plan.id);
    } else {
      setPolicySelectedType('');
      setPolicySelectedCompany('');
      setPolicySelectedPlanId('');
    }

    resetPolicy({
      policyNumber: '',
      sumAssured: leadObj.sumAssuredRequired ? String(leadObj.sumAssuredRequired) : '',
      premiumAmount: leadObj.premiumBudget ? String(leadObj.premiumBudget) : '',
      deductible: '',
      riders: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
      paymentFrequency: 'YEARLY',
      downpaymentAmount: '',
      processingFee: '',
      installmentAmount: '',
      isInstallment: false,
      installmentDate: '',
      policyTenure: '',
      loanProvider: '',
      accountType: '',
      comment: '',
    });

    setPolicyModalOpen(true);
  };

  const handlePolicyFormSubmit = async (data: any) => {
    if (!policyLead) return;
    if (!policySelectedType) {
      toast.error('Please select a policy type');
      return;
    }
    if (!policySelectedCompany) {
      toast.error('Please select Insurance Company Category');
      return;
    }

    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        toast.error('Invalid date format for Start or End Date');
        return;
      }
      if (end <= start) {
        toast.error('Policy Start Date must be before End Date');
        return;
      }
      const yearsDiff = end.getFullYear() - start.getFullYear();
      if (yearsDiff > MAX_REALISTIC_TENURE_YEARS) {
        toast.error(`Premium payment period / policy tenure cannot exceed ${MAX_REALISTIC_TENURE_YEARS} years.`);
        return;
      }
    }

    if (data.policyTenure) {
      const parsedYrs = parseTenureYears(data.policyTenure);
      if (parsedYrs > MAX_REALISTIC_TENURE_YEARS) {
        toast.error(`Premium payment period cannot exceed ${MAX_REALISTIC_TENURE_YEARS} years.`);
        return;
      }
    }

    const toastId = toast.loading('Creating policy and updating lead status...');
    try {
      const calculatedTenure = (data.startDate && data.endDate)
        ? calculateTenureFromDates(data.startDate, data.endDate)
        : data.policyTenure;

      const payload: any = {
        policyNumber: data.policyNumber,
        contactId: policyLead.contactId,
        sumAssured: Number(data.sumAssured),
        premiumAmount: Number(data.premiumAmount),
        ...(data.deductible ? { deductible: Number(data.deductible) } : {}),
        ...(data.riders ? { riders: data.riders } : {}),
        paymentFrequency: data.paymentFrequency,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
        ...(data.downpaymentAmount ? { downpaymentAmount: Number(data.downpaymentAmount) } : {}),
        ...(data.processingFee ? { processingFee: Number(data.processingFee) } : {}),
        ...(data.installmentAmount ? { installmentAmount: Number(data.installmentAmount) } : {}),
        ...(data.installmentDate ? { installmentDate: data.installmentDate } : {}),
        ...(calculatedTenure ? { policyTenure: calculatedTenure } : {}),
        ...(data.loanProvider ? { loanProvider: data.loanProvider } : {}),
        ...(data.accountType ? { accountType: data.accountType } : {}),
        ...(data.comment ? { comment: data.comment } : {}),
      };

      if (policySelectedPlanId) {
        payload.planId = policySelectedPlanId;
      }

      await policiesService.create(payload);

      await moveStage.mutateAsync({ id: policyLead.id, stage: 'PROCESS_COMPLETED' });

      toast.success('Policy created and lead moved to Process Completed!', { id: toastId });
      setPolicyModalOpen(false);

      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['policies'] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to complete process', { id: toastId });
    }
  };

  type PersonalFields = Record<string, any>;

  const [personalFields, setPersonalFields] = useState<PersonalFields>({
    firstName: '',
    middleName: '',
    lastName: '',
    fullName: '',
    gender: '',
    maritalStatus: '',
    dateOfBirth: '',
    age: '',
    height: '',
    weight: '',
    email: '',
    aadhaarNumber: '',
    panNumber: '',
    pan: '',
    whatsappNumber: '',
    sameAsWhatsapp: false,
    callingNumber: '',
    education: '',
    annualIncome: '',
    occupationType: '',
    companyName: '',
    state: '',
    district: '',
    city: '',
    pincode: '',
    streetAddress: '',
    declaredMedicalHistory: [] as string[],
    notDeclaredMedicalHistory: [] as string[],
    medicalHistoryDetails: '',
    bankName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    bankBranch: '',
    chewTobacco: false,
    smoke: false,
    consumeAlcohol: false,
    surgeryDetails: '',
    prescriptionDetails: ''
  });

  const [leadInfoFields, setLeadInfoFields] = useState({
    profileType: 'Lead Profile',
    leadStatus: 'TO_CONTACT',
    leadStage: '',
    leadType: '',
    interestedIn: ['Health'],
    leadSource: 'By Agent',
    assignedEmployeeId: '',
    followUpDate: '',
  });

  const [leadComments, setLeadComments] = useState<string[]>([]);
  const [newComment, setNewComment] = useState('');

  type ProductComment = { text: string; author: string; datetime: string };
  type ProductInterestCard = {
    id: string;
    collapsed: boolean;
    interestedIn: string[];
    otherProduct: string;
    descriptionDetails?: string;
    leadStage: string;
    leadStatus: string;
    dependencyType?: string;
    dependentDetails?: string;
    leadType: string;
    leadSource: string;
    assignedEmployeeId: string;
    followUpDate: string;
    expectedPremium: string;
    comments: ProductComment[];
    newComment: string;
    showAllComments?: boolean;
  };

  function parseLeadNotes(notesText?: string | null) {
    const res = {
      leadStatus: 'INTERESTED',
      leadType: 'FRESH',
      cleanNotes: '',
      dependencyType: 'SELF',
      dependentDetails: '',
      descriptionDetails: '',
    };
    if (!notesText) return res;
    if (notesText.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(notesText);
        res.leadStatus = parsed.leadStatus || 'INTERESTED';
        res.leadType = parsed.leadType || 'FRESH';
        res.cleanNotes = parsed.cleanNotes || '';
        res.dependencyType = parsed.dependencyType || 'SELF';
        res.dependentDetails = parsed.dependentDetails || '';
        res.descriptionDetails = parsed.descriptionDetails || '';
        return res;
      } catch (e) { }
    }
    const lines = notesText.split('\n');
    const cleanLines: string[] = [];
    lines.forEach(line => {
      if (line.startsWith('Status: ')) {
        res.leadStatus = line.replace('Status: ', '').trim();
      } else if (line.startsWith('Type: ')) {
        res.leadType = line.replace('Type: ', '').trim();
      } else if (line.startsWith('Dependency: ')) {
        res.dependencyType = line.replace('Dependency: ', '').trim();
      } else if (line.startsWith('Dependent Details: ')) {
        res.dependentDetails = line.replace('Dependent Details: ', '').trim();
      } else if (line.startsWith('Description Details: ')) {
        res.descriptionDetails = line.replace('Description Details: ', '').trim();
      } else {
        cleanLines.push(line);
      }
    });
    res.cleanNotes = cleanLines.join('\n').trim();
    return res;
  }

  function serializeLeadNotes(card: ProductInterestCard) {
    return JSON.stringify({
      leadStatus: card.leadStatus,
      leadType: card.leadType,
      dependencyType: card.dependencyType || 'SELF',
      dependentDetails: card.dependencyType === 'DEPENDENT' ? (card.dependentDetails || '') : '',
      descriptionDetails: card.descriptionDetails || '',
      cleanNotes: card.otherProduct ? `Other Product: ${card.otherProduct}` : '',
    });
  }

  const newProductInterestCard = (): ProductInterestCard => ({
    id: 'temp-' + Math.random().toString(36).slice(2),
    collapsed: false,
    interestedIn: [],
    otherProduct: '',
    descriptionDetails: '',
    leadStage: 'TO_CONTACT',
    leadStatus: 'INTERESTED',
    dependencyType: 'SELF',
    dependentDetails: '',
    leadType: 'FRESH',
    leadSource: 'Social Media',
    assignedEmployeeId: '',
    followUpDate: '',
    expectedPremium: '',
    comments: [],
    newComment: '',
    showAllComments: false,
  });

  const [productInterests, setProductInterests] = useState<ProductInterestCard[]>([]);

  const addProductInterest = () =>
    setProductInterests(prev => [...prev, newProductInterestCard()]);

  const removeProductInterest = async (id: string) => {
    const isExisting = id.length === 24 || /^[0-9a-fA-F]{24}$/.test(id);
    if (isExisting) {
      if (!confirm('Are you sure you want to delete this product interest from the server?')) return;
      const toastId = toast.loading('Deleting product interest...');
      try {
        await leadsService.remove(id);
        toast.success('Product interest deleted from server successfully!', { id: toastId });
        qc.invalidateQueries({ queryKey: ['contacts'] });
        qc.invalidateQueries({ queryKey: ['leads'] });
      } catch (err: any) {
        toast.error('Failed to delete product interest from server', { id: toastId });
        return;
      }
    }
    setProductInterests(prev => prev.filter(c => c.id !== id));
  };

  const updateProductInterest = (id: string, field: keyof ProductInterestCard, value: any) =>
    setProductInterests(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));

  const toggleProductCollapse = (id: string) =>
    setProductInterests(prev => prev.map(c => c.id === id ? { ...c, collapsed: !c.collapsed } : c));

  const addProductComment = async (id: string) => {
    const card = productInterests.find(c => c.id === id);
    if (!card || !card.newComment.trim()) return;

    const user = useAuthStore.getState().user;
    const author = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'User' : 'User';
    const commentText = card.newComment.trim();

    const isExisting = id.length === 24 || /^[0-9a-fA-F]{24}$/.test(id);
    if (isExisting) {
      const toastId = toast.loading('Adding comment...');
      try {
        await leadsService.addConsultation(id, { notes: commentText });
        toast.success('Comment added successfully!', { id: toastId });
        qc.invalidateQueries({ queryKey: ['contacts'] });
        qc.invalidateQueries({ queryKey: ['leads'] });
      } catch (err: any) {
        toast.error('Failed to save comment to server', { id: toastId });
      }
    }

    const comment = {
      text: commentText,
      author,
      datetime: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    };

    setProductInterests(prev => prev.map(c => {
      if (c.id !== id) return c;
      return { ...c, comments: [...c.comments, comment], newComment: '' };
    }));
  };

  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: kanbanRes, isLoading } = useLeadKanban();
  const moveStage = useMoveLeadStage();
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const isOwner = user?.role === 'OWNER';

  const [draggedOverStage, setDraggedOverStage] = useState<string | null>(null);

  const { data: empRes } = useQuery({
    queryKey: ['employees-list-leads'],
    queryFn: () => employeesService.list({ limit: 100 }),
    staleTime: 5 * 60_000,
  });
  const employeesList = useMemo(() => {
    const raw = empRes?.data?.data || empRes?.data || [];
    return Array.isArray(raw) ? raw : [];
  }, [empRes]);

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
      // Employee role data isolation safeguard: only see self-assigned or unassigned
      if (user?.role === 'EMPLOYEE') {
        const currentUserId = user.id;
        const assignedEmpId = lead.assignedEmployeeId || lead.assignedEmployee?.id || lead.assignedEmployee?.userId;
        if (assignedEmpId) {
          const myEmp = employeesList.find((e: any) => e.userId === currentUserId || e.user?.id === currentUserId || e.id === currentUserId);
          const validMyIds = [currentUserId];
          if (myEmp?.id) validMyIds.push(myEmp.id);
          if (myEmp?.userId) validMyIds.push(myEmp.userId);
          if (myEmp?.user?.id) validMyIds.push(myEmp.user.id);
          if (!validMyIds.includes(assignedEmpId)) {
            return false;
          }
        }
      }
      const fullName = `${lead.contact?.firstName || ''} ${lead.contact?.lastName || ''}`.toLowerCase();
      if (search && !fullName.includes(sTerm) && !(lead.contact?.phone || '').includes(sTerm)) return false;
      if (filterPlans.length > 0 && !filterPlans.includes(lead.plan?.category ?? '')) return false;
      if (filterEmployee && lead.assignedEmployeeId !== filterEmployee) return false;
      if (filterStages.length > 0 && !filterStages.includes(lead.stage ?? '')) return false;
      
      const extra = parseLeadNotes(lead.notes);
      if (filterStatuses.length > 0) {
        const status = extra.leadStatus || 'INTERESTED';
        if (!filterStatuses.includes(status)) return false;
      }
      if (filterTypes.length > 0) {
        const lType = extra.leadType || 'FRESH';
        if (!filterTypes.includes(lType)) return false;
      }

      if (filterDateFrom) {
        const fromDate = new Date(filterDateFrom); fromDate.setHours(0, 0, 0, 0);
        if (!lead.followUpDate || new Date(lead.followUpDate) < fromDate) return false;
      }
      if (filterDateTo) {
        const toDate = new Date(filterDateTo); toDate.setHours(23, 59, 59, 999);
        if (!lead.followUpDate || new Date(lead.followUpDate) > toDate) return false;
      }

      // Date of First Enquiry (Lead Creation Date)
      if (filterEnquiryDateFrom) {
        const fromDate = new Date(filterEnquiryDateFrom); fromDate.setHours(0, 0, 0, 0);
        if (!lead.createdAt || new Date(lead.createdAt) < fromDate) return false;
      }
      if (filterEnquiryDateTo) {
        const toDate = new Date(filterEnquiryDateTo); toDate.setHours(23, 59, 59, 999);
        if (!lead.createdAt || new Date(lead.createdAt) > toDate) return false;
      }

      // Date of Final Sells (Completed / Payment Done stage date)
      if (filterFinalSellsFrom) {
        const fromDate = new Date(filterFinalSellsFrom); fromDate.setHours(0, 0, 0, 0);
        const isClosed = lead.stage === 'PAYMENT_DONE' || lead.stage === 'PROCESS_COMPLETED';
        const sellDate = lead.updatedAt || lead.createdAt;
        if (!isClosed || !sellDate || new Date(sellDate) < fromDate) return false;
      }
      if (filterFinalSellsTo) {
        const toDate = new Date(filterFinalSellsTo); toDate.setHours(23, 59, 59, 999);
        const isClosed = lead.stage === 'PAYMENT_DONE' || lead.stage === 'PROCESS_COMPLETED';
        const sellDate = lead.updatedAt || lead.createdAt;
        if (!isClosed || !sellDate || new Date(sellDate) > toDate) return false;
      }

      // Expected Premium Range Filter
      if (filterExpectedPremiumMin) {
        if ((lead.premiumBudget ?? 0) < Number(filterExpectedPremiumMin)) return false;
      }
      if (filterExpectedPremiumMax) {
        if ((lead.premiumBudget ?? 0) > Number(filterExpectedPremiumMax)) return false;
      }

      // Lead Source Filter
      if (filterLeadSource) {
        const lSource = (lead.source || '').toLowerCase();
        if (!lSource.includes(filterLeadSource.toLowerCase())) return false;
      }

      // Quick Select Filter
      if (selectedQuickFilter !== 'ALL') {
        if (selectedQuickFilter === 'HOT') {
          const isHotStatus = extra.leadStatus === 'HOT';
          const isHotDerived = deriveHotness(lead) === 'HOT';
          if (!isHotStatus && !isHotDerived) return false;
        } else if (selectedQuickFilter === 'VERY_HOT') {
          if (extra.leadStatus !== 'VERY_HOT') return false;
        } else if (selectedQuickFilter === 'HEALTH') {
          const cat = (lead.plan?.category || '').toUpperCase();
          const hasHealthInterest = (lead.interests || []).some((i: string) => i.toLowerCase().includes('health'));
          if (cat !== 'HEALTH' && !hasHealthInterest) return false;
        } else if (selectedQuickFilter === 'LIFE') {
          const cat = (lead.plan?.category || '').toUpperCase();
          const hasLifeInterest = (lead.interests || []).some((i: string) => i.toLowerCase().includes('life'));
          if (cat !== 'LIFE' && !hasLifeInterest) return false;
        } else if (selectedQuickFilter === 'MF') {
          const cat = (lead.plan?.category || '').toUpperCase();
          const hasMfInterest = (lead.interests || []).some((i: string) => i.toLowerCase().includes('mutual') || i.toLowerCase().includes('fund') || i.toLowerCase() === 'mf');
          if (cat !== 'MF' && !hasMfInterest) return false;
        } else if (selectedQuickFilter === 'THIS_WEEK') {
          if (!lead.followUpDate) return false;
          const fDate = new Date(lead.followUpDate);
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          const weekFromNow = new Date(now.getTime() + 7 * 86400000);
          weekFromNow.setHours(23, 59, 59, 999);
          if (fDate < now || fDate > weekFromNow) return false;
        }
      }

      return true;
    });
  }, [leadsFlat, search, filterPlans, filterEmployee, filterStatuses, filterStages, filterTypes, filterDateFrom, filterDateTo, filterEnquiryDateFrom, filterEnquiryDateTo, filterFinalSellsFrom, filterFinalSellsTo, filterExpectedPremiumMin, filterExpectedPremiumMax, filterLeadSource, selectedQuickFilter]);

  // Sorted leads for table
  const sortedLeads = useMemo(() => {
    return sortData(filteredLeads, sortKey, sortDir as 'asc' | 'desc', (row: any, key: string) => {
      if (key === 'name') return `${row.contact?.firstName ?? ''} ${row.contact?.lastName ?? ''}`;
      if (key === 'plan') return row.plan?.name || (row.interests && row.interests.length > 0 ? row.interests.join(', ') : '');
      if (key === 'premiumBudget') return row.premiumBudget ?? 0;
      if (key === 'followUpDate') return row.followUpDate ? new Date(row.followUpDate).getTime() : 0;
      if (key === 'stage') return row.stage ?? '';
      
      const parts = key.split('.');
      let val = row;
      for (const part of parts) {
        if (val == null) break;
        val = val[part];
      }
      return val !== undefined ? val : row[key];
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

  const exportLeadsToExcel = () => {
    const headers = ['Client Name', 'Phone', 'Email', 'Product Category', 'Expected Premium', 'Hotness', 'Assigned To', 'Stage', 'Next Follow-up'];
    const rows = sortedLeads.map((l: any) => [
      `"${((l.contact?.firstName || '') + ' ' + (l.contact?.lastName || '')).trim().replace(/"/g, '""')}"`,
      `"${(l.contact?.phone || '').replace(/"/g, '""')}"`,
      `"${(l.contact?.email || '').replace(/"/g, '""')}"`,
      `"${(l.planCategory || '').replace(/"/g, '""')}"`,
      l.premiumBudget ?? '',
      `"${(l.hotness || '').replace(/"/g, '""')}"`,
      `"${((l.assignedEmployee?.firstName || '') + ' ' + (l.assignedEmployee?.lastName || '')).trim().replace(/"/g, '""')}"`,
      `"${(l.uiStage || '').replace(/"/g, '""')}"`,
      l.followUpDate ? new Date(l.followUpDate).toLocaleDateString() : ''
    ].join(',')).join('\n');
    
    const content = headers.join(',') + '\n' + rows;
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Leads exported to Excel successfully');
  };

  const exportLeadsToPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups to print PDF');
      return;
    }
    
    const rowsHtml = sortedLeads.map((l: any) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 8px;">${((l.contact?.firstName || '') + ' ' + (l.contact?.lastName || '')).trim() || 'N/A'}</td>
        <td style="padding: 8px;">${l.contact?.phone || 'N/A'}</td>
        <td style="padding: 8px;">${l.planCategory || 'N/A'}</td>
        <td style="padding: 8px; text-align: right;">₹${l.premiumBudget?.toLocaleString() || 0}</td>
        <td style="padding: 8px; text-align: center;"><span style="padding: 2px 6px; border-radius: 4px; background: ${l.hotness === 'HOT' ? '#fde8e8; color: #9b1c1c;' : l.hotness === 'WARM' ? '#feecdc; color: #b43c08;' : '#f3f4f6; color: #374151;'} font-size: 10px; font-weight: bold;">${l.hotness || 'COLD'}</span></td>
        <td style="padding: 8px;">${((l.assignedEmployee?.firstName || '') + ' ' + (l.assignedEmployee?.lastName || '')).trim() || 'Unassigned'}</td>
        <td style="padding: 8px; text-align: center;">${l.uiStage || 'N/A'}</td>
        <td style="padding: 8px; text-align: center;">${l.followUpDate ? new Date(l.followUpDate).toLocaleDateString() : 'N/A'}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Leads Report</title>
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
              <div style="font-size: 12px; color: #475569; font-weight: 600;">Leads Export Report</div>
            </div>
            <div class="meta">
              <div>Date: ${new Date().toLocaleString()}</div>
              <div>Record Count: ${sortedLeads.length}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 20%;">Client Name</th>
                <th style="width: 15%;">Phone</th>
                <th style="width: 15%;">Product</th>
                <th style="width: 10%; text-align: right;">Exp. Premium</th>
                <th style="width: 10%; text-align: center;">Hotness</th>
                <th style="width: 15%;">Assigned To</th>
                <th style="width: 15%; text-align: center;">Stage</th>
                <th style="width: 10%; text-align: center;">Follow-up</th>
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

  // Click-outside
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (planFilterRef.current && !planFilterRef.current.contains(e.target as Node)) setPlanFilterOpen(false);
      if (statusFilterRef.current && !statusFilterRef.current.contains(e.target as Node)) setStatusFilterOpen(false);
      if (stageFilterRef.current && !stageFilterRef.current.contains(e.target as Node)) setStageFilterOpen(false);
      if (typeFilterRef.current && !typeFilterRef.current.contains(e.target as Node)) setTypeFilterOpen(false);
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

  const { data: compulsoryRulesRes, isLoading: isLoadingRules } = useQuery({
    queryKey: ['compulsory-rules'],
    queryFn: () => insuranceService.getCompulsoryRules(),
  });
  const compulsoryRules = useMemo(() => compulsoryRulesRes?.data ?? [], [compulsoryRulesRes]);

  const isFieldRequired = (key: string, defaultRequired: boolean) => {
    if (['firstName', 'phone'].includes(key)) return true; // System protected
    const rule = compulsoryRules.find((r: any) => (r.module === 'Lead' || r.module === 'Leads') && r.fieldKey === key);
    if (rule) return rule.required;
    return defaultRequired;
  };

  const activeSchema = useMemo(() => {
    return z.object({
      firstName: isFieldRequired('firstName', true) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      lastName: isFieldRequired('lastName', true) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      phone: isFieldRequired('phone', true) ? z.string().min(10, 'Min 10 digits') : z.string().optional().or(z.literal('')),
      alternatePhone: isFieldRequired('alternatePhone', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      email: isFieldRequired('email', false) ? z.string().email('Invalid email') : z.string().email('Invalid email').optional().or(z.literal('')),
      gender: isFieldRequired('gender', false) ? z.enum(['MALE', 'FEMALE', 'OTHER']).refine(val => !!val, { message: 'Required' }) : z.enum(['MALE', 'FEMALE', 'OTHER', '']).optional(),
      dateOfBirth: isFieldRequired('dateOfBirth', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      height: isFieldRequired('height', false) ? z.coerce.number() : z.coerce.number().optional().or(z.literal('')),
      weight: isFieldRequired('weight', false) ? z.coerce.number() : z.coerce.number().optional().or(z.literal('')),
      panNumber: isFieldRequired('panNumber', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      aadhaarNumber: isFieldRequired('aadhaarNumber', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      annualIncome: isFieldRequired('annualIncome', false) ? z.coerce.number().min(0) : z.coerce.number().min(0).optional().or(z.literal('')),
      notes: isFieldRequired('notes', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      tags: isFieldRequired('tags', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      isActive: z.string().optional(),
      city: isFieldRequired('city', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      source: isFieldRequired('source', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      assignedEmployeeId: isFieldRequired('assignedEmployeeId', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      leadStage: isFieldRequired('leadStage', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      leadStatus: isFieldRequired('leadStatus', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      leadType: isFieldRequired('leadType', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      followUpDate: isFieldRequired('followUpDate', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
    });
  }, [compulsoryRules]);

  const { register, handleSubmit, reset, setValue, watch } = useForm<Form>({ resolver: zodResolver(activeSchema) });

  const calculateAge = (dob: string): number => {
    if (!dob) return 0;
    try {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age > 0 ? age : 0;
    } catch {
      return 0;
    }
  };

  const handleDOBChange = (val: string) => {
    const age = calculateAge(val);
    setPersonalFields(p => ({ ...p, dateOfBirth: val, age: String(age) }));
  };

  const handleLeadSubmit = async (e: React.FormEvent, shouldClose: boolean = false) => {
    if (e) e.preventDefault();
    if (!personalFields.firstName.trim()) {
      toast.error('First Name is required');
      return;
    }
    if (isFieldRequired('lastName', true) && !personalFields.lastName.trim()) {
      toast.error('Last Name is required');
      return;
    }
    if (isFieldRequired('phone', true) && !personalFields.whatsappNumber.trim()) {
      toast.error('WhatsApp Number is required');
      return;
    }
    // Strip known country code prefix before validating (CountryPhoneInput stores code+number together)
    const KNOWN_CODES = ['971','966','974','968','965','973','880','977','234','254','353','91','44','49','33','81','86','94','60','62','63','66','84','27','55','52','39','34','31','41','46','47','45','64','65','61','86','1','7'];
    const rawWaDigits = personalFields.whatsappNumber.trim().replace(/\D/g, '');
    const sortedCodes = [...KNOWN_CODES].sort((a, b) => b.length - a.length);
    const matchedCode = sortedCodes.find(c => rawWaDigits.startsWith(c));
    const waLocalDigits = matchedCode ? rawWaDigits.slice(matchedCode.length) : rawWaDigits;
    if (personalFields.whatsappNumber.trim() && !/^\d{10}$/.test(waLocalDigits) && !/^\d{10}$/.test(rawWaDigits)) {
      toast.error('WhatsApp Number must be exactly 10 digits');
      return;
    }

    const hasAadhaar = !!personalFields.aadhaarNumber.trim();
    if (isFieldRequired('aadhaarNumber', false) && !hasAadhaar) {
      toast.error('Aadhaar Number is required');
      return;
    }
    if (hasAadhaar && !/^\d{12}$/.test(personalFields.aadhaarNumber.trim())) {
      toast.error('Aadhaar Number must be exactly 12 digits');
      return;
    }

    if (!personalFields?.occupationType?.trim()) {
      toast.error('Occupation Type is required');
      setActiveLeadTab('Personal');
      return;
    }

    if (!personalFields?.state?.trim()) {
      toast.error('State is required');
      setActiveLeadTab('Personal');
      return;
    }
    if (!personalFields?.district?.trim()) {
      toast.error('District is required');
      setActiveLeadTab('Personal');
      return;
    }
    if (!personalFields?.city?.trim()) {
      toast.error('City is required');
      setActiveLeadTab('Personal');
      return;
    }

    // Programmatic dynamic compulsory checks
    const fieldsToCheck = [
      { key: 'alternatePhone', label: 'Alternate Phone', value: personalFields.callingNumber, defaultRequired: false },
      { key: 'email', label: 'Email Address', value: personalFields.email, defaultRequired: false },
      { key: 'gender', label: 'Gender', value: personalFields.gender, defaultRequired: false },
      { key: 'dateOfBirth', label: 'Date of Birth', value: personalFields.dateOfBirth, defaultRequired: false },
      { key: 'panNumber', label: 'PAN Number', value: personalFields.panNumber || personalFields.pan, defaultRequired: false },
      { key: 'annualIncome', label: 'Annual Income', value: personalFields.annualIncome, defaultRequired: false },
      { key: 'city', label: 'City', value: personalFields.city, defaultRequired: false },
      { key: 'source', label: 'Source', value: personalFields.source, defaultRequired: false },
      { key: 'assignedEmployeeId', label: 'Assigned Employee', value: leadInfoFields.assignedEmployeeId, defaultRequired: false },
      { key: 'leadStage', label: 'Lead Stage', value: leadInfoFields.leadStage, defaultRequired: false },
      { key: 'leadStatus', label: 'Lead Status', value: leadInfoFields.leadStatus, defaultRequired: false },
      { key: 'leadType', label: 'Lead Type', value: leadInfoFields.leadType, defaultRequired: false },
      { key: 'followUpDate', label: 'Follow-up Date', value: leadInfoFields.followUpDate, defaultRequired: false }
    ];

    for (const f of fieldsToCheck) {
      if (isFieldRequired(f.key, f.defaultRequired) && (!f.value || String(f.value).trim() === '')) {
        toast.error(f.label + ' is required');
        return;
      }
    }
    // Validate renewal policy rule & required fields for new cards
    for (let i = 0; i < productInterests.length; i++) {
      const card = productInterests[i];
      const isExisting = card.id.length === 24 || /^[0-9a-fA-F]{24}$/.test(card.id);

      if (!isExisting) {
        if (card.interestedIn.includes('Other') && !card.otherProduct?.trim()) {
          toast.error(`Product Interest #${i + 1}: Please specify the Other Product Name`);
          setActiveLeadTab('Product Interest');
          return;
        }
        if (card.dependencyType === 'DEPENDENT' && !card.dependentDetails?.trim()) {
          toast.error(`Product Interest #${i + 1}: Please enter dependent details`);
          setActiveLeadTab('Product Interest');
          return;
        }
        if (!card.leadSource?.trim()) {
          toast.error(`Product Interest #${i + 1}: Please select or enter a Lead Source`);
          setActiveLeadTab('Product Interest');
          return;
        }
        if (!String(card.followUpDate ?? '').trim()) {
          toast.error(`Product Interest #${i + 1}: Please select a Follow-up Date`);
          setActiveLeadTab('Product Interest');
          return;
        }
        if (!card.expectedPremium || Number(card.expectedPremium) <= 0) {
          toast.error(`Product Interest #${i + 1}: Please enter a valid Expected Premium / Budget (> 0)`);
          setActiveLeadTab('Product Interest');
          return;
        }
      }

      if (hasActiveRenewalLeadForCard(card) && card.leadType === 'RENEWAL') {
        toast.error("An active Renewal lead already exists for this product.");
        return;
      }
      if (hasActivePolicyForCard(card) && card.leadType === 'RENEWAL' && isPolicyOutsideRenewalWindowForCard(card)) {
        toast.error("Renewal cannot be created yet. The policy is outside the renewal period.");
        return;
      }
      if (hasActivePolicyForCard(card) && card.leadType !== 'RENEWAL') {
        toast.error("An active policy already exists for this product. Only a Renewal lead can be created.");
        return;
      }
    }

    const toastId = toast.loading(editContactId ? 'Updating lead...' : 'Creating lead...');
    try {
      const firstName = personalFields.firstName.trim();
      const lastName = personalFields.lastName.trim();

      const mergedTags = [...selectedCampaigns];
      if (!mergedTags.includes('contact')) {
        mergedTags.push('contact');
      }

      let contactId = editContactId;
      if (editContactId) {
        // Do not update existing Contact profile or sub-resources from within the Leads module
      } else {
        const contactRes = await contactsService.createFull({
          contact: {
            firstName,
            middleName: personalFields.middleName || undefined,
            lastName,
            phone: waLocalDigits || rawWaDigits,
            height: personalFields.height ? Number(personalFields.height) : undefined,
            weight: personalFields.weight ? Number(personalFields.weight) : undefined,
            panNumber: personalFields.panNumber || personalFields.pan || undefined,
            alternatePhone: personalFields.callingNumber || undefined,
            email: personalFields.email || undefined,
            gender: personalFields.gender || undefined,
            maritalStatus: personalFields.maritalStatus || undefined,
            dateOfBirth: personalFields.dateOfBirth?.trim() ? new Date(personalFields.dateOfBirth).toISOString() : undefined,
            aadhaarNumber: personalFields.aadhaarNumber || undefined,
            education: personalFields.education || undefined,
            annualIncome: personalFields.annualIncome ? Number(personalFields.annualIncome) : undefined,
            tags: mergedTags,
            notes: personalFields.streetAddress || undefined,
          },
          address: (personalFields.state || personalFields.city || personalFields.pincode || personalFields.streetAddress) ? {
            type: 'HOME',
            line1: personalFields.streetAddress || 'N/A',
            city: personalFields.city || 'N/A',
            state: personalFields.state || 'N/A',
            pincode: personalFields.pincode || 'N/A',
            country: 'India',
            isPrimary: true,
          } : undefined,
          occupation: (personalFields.occupationType || personalFields.companyName || personalFields.annualIncome) ? {
            type: personalFields.occupationType || 'SALARIED',
            companyName: personalFields.companyName || undefined,
            isPrimary: true,
          } : undefined,
        });
        const createdContactObj = contactRes?.data?.contact || contactRes?.data?.data || contactRes?.data || contactRes;
        contactId = createdContactObj?.id || createdContactObj?._id || contactRes?.data?.contact?.id;
        if (contactId) {
          setEditContactId(contactId);
        }
      }

      const subResourcePromises: Promise<any>[] = [];

      // Save Family Members and Policies ONLY for newly created Contacts
      if (!editContactId) {
        // Save Family Members if any
        for (const fam of familyMembers) {
          const famFirst = (fam.firstName || fam.name || '').trim();
          if (!famFirst) continue;
          const famLast = (fam.lastName || '').trim() || 'N/A';

          const saveFamilyFlow = async () => {
            try {
              const famContactRes = await contactsService.create({
                firstName: famFirst,
                middleName: fam.middleName || undefined,
                lastName: famLast,
                phone: fam.whatsapp || '0000000000',
                dateOfBirth: fam.dob?.trim() ? new Date(fam.dob).toISOString() : undefined,
                declaredMedicalHistory: fam.declaredMedicalHistory || [],
                notDeclaredMedicalHistory: fam.notDeclaredMedicalHistory || [],
                medicalHistoryDetails: fam.medicalHistoryDetails || undefined,
              });
              const famContactId = famContactRes.id || famContactRes.data?.id;

              await contactsService.addRelationship(contactId!, {
                relatedContactId: famContactId,
                relationshipType: fam.relation || 'OTHER',
              });
            } catch (famErr) {
              console.error('Failed to save family member:', famErr);
            }
          };
          subResourcePromises.push(saveFamilyFlow());
        }

        // Save Policies if any
        const dbPlans = useLookupStore.getState().plans || [];
        for (const portfolio of policies) {
          const isHealth = portfolio.policyType === 'Health';
          const category = isHealth ? 'HEALTH' : 'LIFE';

          for (const entry of portfolio.entries) {
            if (!entry.policyNo.trim()) continue;

            const matchedPlan = dbPlans.find((p: any) => {
              const planCompany = p.company?.name || '';
              const planCategory = p.category || '';
              return planCategory === category &&
                planCompany.toLowerCase() === entry.company.toLowerCase() &&
                p.name.toLowerCase() === entry.planName.toLowerCase();
            }) || dbPlans.find((p: any) => p.category === category) || dbPlans[0];

            subResourcePromises.push(
              policiesService.create({
                policyNumber: entry.policyNo,
                contactId: contactId!,
                planId: matchedPlan?.id || '6a3d0584d431b55e6b6e74fe',
                sumAssured: Number(entry.sumAssured || entry.sumInsured || 100000),
                premiumAmount: Number(entry.premium || 1000),
                paymentFrequency: 'YEARLY',
                startDate: entry.startDate?.trim() ? new Date(entry.startDate).toISOString() : new Date().toISOString(),
                endDate: entry.endDate?.trim() ? new Date(entry.endDate).toISOString() : new Date(Date.now() + 365 * 86400000).toISOString(),
              }).catch(polErr => console.error('Failed to save policy:', polErr))
            );
          }
        }
      }

      // Save Product Interests (Leads)
      for (const card of productInterests) {
        const isUntouchedDefaultPlaceholder = card.id.startsWith('temp-') &&
          (card.interestedIn.length === 1 && card.interestedIn[0] === 'Health') &&
          !card.expectedPremium &&
          !card.followUpDate &&
          !card.descriptionDetails &&
          !card.otherProduct;

        if (isUntouchedDefaultPlaceholder) {
          continue;
        }

        const product = card.interestedIn[0];
        const interests = [product === 'Other' && card.otherProduct ? card.otherProduct : product];

        const stage = card.leadStage && card.leadStage !== 'OPEN' ? card.leadStage : 'TO_CONTACT';

        const serializedNotes = serializeLeadNotes(card);

        const validEmpId = (id?: string) => (id && /^[0-9a-fA-F]{24}$/.test(id.trim())) ? id.trim() : undefined;
        const body = {
          contactId: contactId!,
          interests,
          stage,
          source: card.leadSource,
          assignedEmployeeId: validEmpId(card.assignedEmployeeId),
          followUpDate: String(card.followUpDate ?? '').trim() ? new Date(card.followUpDate).toISOString() : undefined,
          premiumBudget: Number(card.expectedPremium) || undefined,
          notes: serializedNotes,
        };

        const isExisting = card.id.length === 24 || /^[0-9a-fA-F]{24}$/.test(card.id);
        const saveLeadFlow = async () => {
          try {
            if (isExisting) {
              if (editTarget) {
                await leadsService.update(card.id, body);
              }
            } else {
              const res = await leadsService.create(body);
              const savedLead = res.data ?? res;
              for (const cmt of card.comments) {
                await leadsService.addConsultation(savedLead.id, { notes: cmt.text });
              }
            }
          } catch (leadErr: any) {
            console.error('Failed to save product interest:', leadErr);
            toast.error(`Failed to save Product Interest (${interests.join(', ')}): ${leadErr.response?.data?.message || 'Error occurred'}`);
          }
        };
        subResourcePromises.push(saveLeadFlow());
      }

      await Promise.all(subResourcePromises);

      toast.success(editContactId ? 'Lead successfully updated!' : 'Lead successfully created!', { id: toastId });
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['leads'] });

      if (shouldClose) {
        closeModal();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to save lead', { id: toastId });
    }
  };

  const openCreate = (stage?: string) => {
    setEditTarget(null);
    setEditContactId(null);
    setLoadedContact(null);
    setPersonalFields({
      fullName: '',
      gender: '',
      maritalStatus: '',
      dateOfBirth: '',
      email: '',
      aadhaarNumber: '',
      whatsappNumber: '',
      sameAsWhatsapp: false,
      callingNumber: '',
      education: '',
      annualIncome: '',
      occupationType: '',
      companyName: '',
      state: '',
      district: '',
      city: '',
      pincode: '',
      streetAddress: '',
      declaredMedicalHistory: [],
      notDeclaredMedicalHistory: [],
      medicalHistoryDetails: ''
    });

    const currentUser = useAuthStore.getState().user;
    const curEmp = employeesList.find((e: any) => e.userId === currentUser?.id || e.id === currentUser?.id);

    setLeadInfoFields({
      profileType: 'Lead Profile',
      leadStatus: stage || 'TO_CONTACT',
      leadStage: stage || 'TO_CONTACT',
      leadType: 'FRESH',
      interestedIn: ['Health'],
      leadSource: 'Social Media',
      assignedEmployeeId: curEmp?.userId || currentUser?.id || '',
      followUpDate: '',
    });
    setLeadComments([]);
    setNewComment('');
    setProductInterests([]);
    setFamilyMembers([]);
    setPolicies([]);
    setSelectedCampaigns([]);
    setActiveLeadTab('Product Interest');
    setModalOpen(true);
  };

  const openEdit = async (card: any) => {
    setEditTarget(card);
    const contactId = card.contactId || card.contact?.id;
    if (!contactId) {
      toast.error('Associated contact not found for this lead');
      return;
    }
    const toastId = toast.loading('Loading contact details...');
    try {
      const res = await contactsService.get(contactId);
      const contact = res.data;
      setLoadedContact(contact);

      const primaryAddr = contact.addresses?.find((a: any) => a.isPrimary) || contact.addresses?.[0];
      const primaryOcc = contact.occupations?.find((o: any) => o.isPrimary) || contact.occupations?.[0];

      setPersonalFields({
        fullName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
        gender: contact.gender || '',
        maritalStatus: contact.maritalStatus || '',
        dateOfBirth: contact.dateOfBirth ? contact.dateOfBirth.split('T')[0] : '',
        email: contact.email || '',
        aadhaarNumber: contact.aadhaarNumber || '',
        whatsappNumber: contact.phone || '',
        sameAsWhatsapp: contact.phone === contact.alternatePhone,
        callingNumber: contact.alternatePhone || '',
        education: contact.education || '',
        annualIncome: contact.annualIncome ? String(contact.annualIncome) : '',
        occupationType: primaryOcc?.type || '',
        companyName: primaryOcc?.companyName || '',
        state: primaryAddr?.state || '',
        district: primaryAddr?.district || '',
        city: primaryAddr?.city || '',
        pincode: primaryAddr?.pincode || '',
        streetAddress: primaryAddr?.line1 || contact.notes || '',
        declaredMedicalHistory: contact.declaredMedicalHistory || [],
        notDeclaredMedicalHistory: contact.notDeclaredMedicalHistory || [],
        medicalHistoryDetails: contact.medicalHistoryDetails || ''
      });

      setLeadInfoFields({
        profileType: 'Lead Profile',
        leadStatus: card.stage || 'TO_CONTACT',
        leadStage: card.leadStage || 'TO_CONTACT',
        leadType: card.leadType || 'FRESH',
        interestedIn: card.interests || ['Health'],
        leadSource: card.source || 'Social Media',
        assignedEmployeeId: card.assignedEmployeeId || '',
        followUpDate: card.followUpDate ? card.followUpDate.split('T')[0] : '',
      });

      const campaignsList = [
        'Health Awareness', 'New Year Offer', 'Pension Plan',
        'Monsoon Safety', 'Term Insurance Promo', 'Family Health Package'
      ];
      const campaigns = contact.tags?.filter((t: string) => campaignsList.includes(t)) || [];
      setSelectedCampaigns(campaigns);

      const fams = (contact.relationships || []).map((r: any) => {
        const c = r.relatedContact || r.contact || {};
        const primaryOcc = c?.occupations?.find((o: any) => o.isPrimary) || c?.occupations?.[0];
        const medTags = (c?.tags || [])
          .filter((t: string) => t.startsWith('med:'))
          .map((t: string) => t.replace('med:', ''));

        const relRaw = r.relationshipType || '';
        const relLower = relRaw.toLowerCase();
        let formattedRel = relRaw ? relRaw.charAt(0).toUpperCase() + relRaw.slice(1).toLowerCase() : 'Other';
        if (relLower === 'spouse') formattedRel = 'Spouse';
        else if (relLower === 'son') formattedRel = 'Son';
        else if (relLower === 'daughter') formattedRel = 'Daughter';
        else if (relLower === 'father') formattedRel = 'Father';
        else if (relLower === 'mother') formattedRel = 'Mother';
        else if (relLower === 'brother') formattedRel = 'Brother';
        else if (relLower === 'sister') formattedRel = 'Sister';
        else if (relLower === 'child') formattedRel = 'Child';

        return {
          name: `${c?.firstName || ''} ${c?.lastName || ''}`.trim(),
          dob: c?.dateOfBirth ? c.dateOfBirth.split('T')[0] : '',
          relation: formattedRel,
          whatsapp: c?.phone || '',
          occupation: primaryOcc?.type || '',
          education: c?.education || '',
          medicalHistory: medTags
        };
      });
      setFamilyMembers(fams);

      const healthEntries: any[] = [];
      const lifeEntries: any[] = [];
      (contact.policies || []).forEach((p: any) => {
        const entry = {
          company: p.plan?.company?.name || 'Other',
          planName: p.plan?.name || 'Other',
          policyNo: p.policyNumber,
          startDate: p.startDate ? p.startDate.split('T')[0] : '',
          duration: (p.startDate && p.endDate) ? (calculateTenureFromDates(p.startDate.split('T')[0], p.endDate.split('T')[0]) || '1 Year') : '1 Year',
          endDate: p.endDate ? p.endDate.split('T')[0] : '',
          premium: String(p.premiumAmount),
          sumInsured: String(p.sumAssured),
          deductible: '',
          sumAssured: String(p.sumAssured),
          maturityDate: p.maturityDate ? p.maturityDate.split('T')[0] : '',
          paymentTerm: '',
          entryType: p.status === 'ACTIVE' ? 'New' : 'Renewal'
        };
        if (p.plan?.category === 'HEALTH') {
          healthEntries.push(entry);
        } else {
          lifeEntries.push(entry);
        }
      });
const medicalOptions = [
  "BP",
  "Sugar",
  "Heart",
  "Thyroid",
  "Others",
];
      const parsedPolicies: any[] = [];
      if (healthEntries.length > 0) parsedPolicies.push({ policyType: 'Health', entries: healthEntries });
      if (lifeEntries.length > 0) parsedPolicies.push({ policyType: 'Life', entries: lifeEntries });
      setPolicies(parsedPolicies);

      // Load & map product interests/leads
      const backendInterests = contact.productInterests || [];
      const mappedInterests = backendInterests.map((lead: any) => {
        const extra = parseLeadNotes(lead.notes);
        const comments = (lead.consultations || []).map((c: any) => ({
          text: c.notes || '',
          author: c.author || 'System',
          datetime: c.createdAt ? new Date(c.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
        }));

        const parseBackendInterests = (list: string[] = []): { interestedIn: string[]; otherProduct: string } => {
          const STANDARD_PRODUCTS = ['Health', 'Life', 'Term', 'Accident Policy', 'Motor', 'Mutual Funds', 'Porting'];
          const interestedIn: string[] = [];
          const otherParts: string[] = [];
          for (const raw of list) {
            if (!raw || !raw.trim()) continue;
            const trimmed = raw.trim();
            const lower = trimmed.toLowerCase();
            if (lower.includes('health')) {
              if (!interestedIn.includes('Health')) interestedIn.push('Health');
            } else if (lower.includes('life') && !lower.includes('term')) {
              if (!interestedIn.includes('Life')) interestedIn.push('Life');
            } else if (lower.includes('term')) {
              if (!interestedIn.includes('Term')) interestedIn.push('Term');
            } else if (lower.includes('accident')) {
              if (!interestedIn.includes('Accident Policy')) interestedIn.push('Accident Policy');
            } else if (lower.includes('motor') || lower.includes('car') || lower.includes('vehicle') || lower.includes('bike')) {
              if (!interestedIn.includes('Motor')) interestedIn.push('Motor');
            } else if (lower.includes('mutual') || lower.includes('fund')) {
              if (!interestedIn.includes('Mutual Funds')) interestedIn.push('Mutual Funds');
            } else if (lower.includes('port')) {
              if (!interestedIn.includes('Porting')) interestedIn.push('Porting');
            } else if (STANDARD_PRODUCTS.includes(trimmed)) {
              if (!interestedIn.includes(trimmed)) interestedIn.push(trimmed);
            } else {
              otherParts.push(trimmed);
            }
          }
          if (otherParts.length > 0 && !interestedIn.includes('Other')) {
            interestedIn.push('Other');
          }
          if (interestedIn.length === 0) {
            interestedIn.push('Health');
          }
          return { interestedIn, otherProduct: otherParts.join(', ') };
        };

        const { interestedIn, otherProduct } = parseBackendInterests(lead.interests || []);

        const expectedPremium = lead.premiumBudget ? String(lead.premiumBudget) : '';
        const leadStage = lead.stage || 'TO_CONTACT';

        return {
          id: lead.id,
          collapsed: true,
          interestedIn,
          otherProduct,
          descriptionDetails: extra.descriptionDetails || '',
          leadStage,
          leadStatus: extra.leadStatus,
          dependencyType: extra.dependencyType || 'SELF',
          dependentDetails: extra.dependentDetails || '',
          leadType: extra.leadType,
          leadSource: lead.source || 'Social Media',
          assignedEmployeeId: lead.assignedEmployeeId || '',
          followUpDate: lead.followUpDate ? lead.followUpDate.split('T')[0] : '',
          expectedPremium,
          comments,
          newComment: '',
        };
      });

      setProductInterests(mappedInterests);

      setEditContactId(contactId);
      setActiveLeadTab('Product Interest');
      setModalOpen(true);
      toast.dismiss(toastId);
    } catch (err) {
      toast.error('Failed to load contact details', { id: toastId });
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditTarget(null);
    setEditContactId(null);
    setLoadedContact(null);
    setDuplicateContactMatched(null);
    setProductInterests([]);
    setFamilyMembers([]);
    setPolicies([]);
    setSelectedCampaigns([]);
  };

  const checkForDuplicateContact = async (phone: string, aadhaar: string) => {
    // Only search when BOTH fields are fully entered
    if (!phone || !aadhaar) return;
    try {
      const searchPhone = phone.slice(-10);
      const res = await contactsService.list({ search: searchPhone, limit: 100 });
      const list = res.data || [];
      // Require BOTH mobile/altMobile AND aadhaar to match the same contact record
      const match = list.find((c: any) => {
        const contactPhone = c.phone ? c.phone.replace(/\D/g, '') : '';
        const cleanContactPhone = contactPhone.length > 10 ? contactPhone.slice(-10) : contactPhone;

        const contactAltPhone = c.alternatePhone ? c.alternatePhone.replace(/\D/g, '') : '';
        const cleanContactAltPhone = contactAltPhone.length > 10 ? contactAltPhone.slice(-10) : contactAltPhone;

        const matchPhone = (cleanContactPhone && cleanContactPhone === searchPhone) ||
          (cleanContactAltPhone && cleanContactAltPhone === searchPhone);

        const contactAadhaar = c.aadhaarNumber ? c.aadhaarNumber.replace(/\D/g, '') : '';
        const cleanContactAadhaar = contactAadhaar.length > 12 ? contactAadhaar.slice(-12) : contactAadhaar;
        const searchAadhaar = aadhaar.slice(-12);
        const matchAadhaar = cleanContactAadhaar && cleanContactAadhaar === searchAadhaar;

        return matchPhone && matchAadhaar;
      });

      if (match) {
        const fullRes = await contactsService.get(match.id);
        const contact = fullRes.data;

        // Load address & occupation for personal fields
        const primaryAddr = contact.addresses?.find((a: any) => a.isPrimary) || contact.addresses?.[0];
        const primaryOcc = contact.occupations?.find((o: any) => o.isPrimary) || contact.occupations?.[0];

        setPersonalFields({
          fullName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
          gender: contact.gender || '',
          maritalStatus: contact.maritalStatus || '',
          dateOfBirth: contact.dateOfBirth ? contact.dateOfBirth.split('T')[0] : '',
          email: contact.email || '',
          height: "",
          weight: "",
          aadhaarNumber: contact.aadhaarNumber || '',
          whatsappNumber: contact.phone || '',
          sameAsWhatsapp: contact.phone === contact.alternatePhone,
          callingNumber: contact.alternatePhone || '',
          education: contact.education || '',
          annualIncome: contact.annualIncome ? String(contact.annualIncome) : '',
          occupationType: primaryOcc?.type || '',
          companyName: primaryOcc?.companyName || '',
          state: primaryAddr?.state || '',
          district: primaryAddr?.district || '',
          city: primaryAddr?.city || '',
          pincode: primaryAddr?.pincode || '',
          streetAddress: primaryAddr?.line1 || contact.notes || '',
          declaredMedicalHistory: contact.declaredMedicalHistory || [],
          notDeclaredMedicalHistory: contact.notDeclaredMedicalHistory || [],
          medicalHistoryDetails: contact.medicalHistoryDetails || ''
        });

        const fams = (contact.relationships || []).map((r: any) => {
          const c = r.relatedContact;
          return {
            name: `${c?.firstName || ''} ${c?.lastName || ''}`.trim(),
            dob: c?.dateOfBirth ? c.dateOfBirth.split('T')[0] : '',
            relation: r.relationshipType,
            whatsapp: c?.phone || '',
            occupation: '',
            education: '',
            medicalHistory: []
          };
        });
        setFamilyMembers(fams);

        const healthEntries: any[] = [];
        const lifeEntries: any[] = [];
        (contact.policies || []).forEach((p: any) => {
          const entry = {
            company: p.plan?.company?.name || 'Other',
            planName: p.plan?.name || 'Other',
            policyNo: p.policyNumber,
            startDate: p.startDate ? p.startDate.split('T')[0] : '',
            duration: (p.startDate && p.endDate) ? (calculateTenureFromDates(p.startDate.split('T')[0], p.endDate.split('T')[0]) || '1 Year') : '1 Year',
            endDate: p.endDate ? p.endDate.split('T')[0] : '',
            premium: String(p.premiumAmount),
            sumInsured: String(p.sumAssured),
            deductible: '',
            sumAssured: String(p.sumAssured),
            maturityDate: p.maturityDate ? p.maturityDate.split('T')[0] : '',
            paymentTerm: '',
            entryType: p.status === 'ACTIVE' ? 'New' : 'Renewal'
          };
          if (p.plan?.category === 'HEALTH') healthEntries.push(entry);
          else lifeEntries.push(entry);
        });

        const parsedPolicies: any[] = [];
        if (healthEntries.length > 0) parsedPolicies.push({ policyType: 'Health', entries: healthEntries });
        if (lifeEntries.length > 0) parsedPolicies.push({ policyType: 'Life', entries: lifeEntries });
        setPolicies(parsedPolicies);

        // WhatsApp Campaigns — populate from contact tags
        const campaignsList = [
          'Health Awareness', 'New Year Offer', 'Pension Plan',
          'Monsoon Safety', 'Term Insurance Promo', 'Family Health Package'
        ];
        const campaigns = contact.tags?.filter((t: string) => campaignsList.includes(t)) || [];
        setSelectedCampaigns(campaigns);

        // Product Interests — map existing leads for the Product Interest tab
        const backendInterests = contact.productInterests || [];
        const mappedInterests = backendInterests.map((lead: any) => {
          const extra = parseLeadNotes(lead.notes);
          const comments = (lead.consultations || []).map((c: any) => ({
            text: c.notes || '',
            author: c.author || 'System',
            datetime: c.createdAt ? new Date(c.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
          }));

          const interestsList = lead.interests || [];
          const isStandard = (p: string) => ['Health', 'Life', 'Term', 'Accident Policy', 'Motor', 'Mutual Funds', 'Porting'].includes(p);
          const standardInterests = interestsList.filter((p: string) => isStandard(p));
          const otherInterests = interestsList.filter((p: string) => !isStandard(p));

          const interestedIn = [...standardInterests];
          let otherProduct = '';
          if (otherInterests.length > 0) {
            interestedIn.push('Other');
            otherProduct = otherInterests.join(', ');
          }

          const expectedPremium = lead.premiumBudget ? String(lead.premiumBudget) : '';
          const leadStage = lead.stage || 'TO_CONTACT';

          return {
            id: lead.id,
            collapsed: true,
            interestedIn,
            otherProduct,
            descriptionDetails: extra.descriptionDetails || '',
            leadStage,
            leadStatus: extra.leadStatus,
            dependencyType: extra.dependencyType || 'SELF',
            dependentDetails: extra.dependentDetails || '',
            leadType: extra.leadType,
            leadSource: lead.source || 'Social Media',
            assignedEmployeeId: lead.assignedEmployeeId || '',
            followUpDate: lead.followUpDate ? lead.followUpDate.split('T')[0] : '',
            expectedPremium,
            comments,
            newComment: '',
          };
        });
        setProductInterests(mappedInterests);

        // All data loaded — now mark contact as matched and show banner
        setLoadedContact(contact);
        setEditContactId(contact.id);
        setDuplicateContactMatched(contact);
        toast.success("Existing Contact Found – Details Loaded.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!editTarget && !duplicateContactMatched) {
      const cleanPhone = (personalFields.whatsappNumber || '').replace(/\D/g, '');
      const cleanAltPhone = (personalFields.callingNumber || '').replace(/\D/g, '');
      const cleanAadhaar = (personalFields.aadhaarNumber || '').replace(/\D/g, '');

      const phoneToSearch = cleanPhone.length === 10 ? cleanPhone : (cleanAltPhone.length === 10 ? cleanAltPhone : '');

      if (phoneToSearch && cleanAadhaar.length === 12) {
        checkForDuplicateContact(phoneToSearch, cleanAadhaar);
      }
    }
  }, [personalFields.whatsappNumber, personalFields.callingNumber, personalFields.aadhaarNumber, editTarget, duplicateContactMatched]);

  const hasActivePolicyForCard = (card: any): boolean => {
    if (!loadedContact) return false;
    const activePolicies = (loadedContact.policies || []).filter((p: any) => p.status === 'ACTIVE' || !p.status);
    return card.interestedIn.some((prod: string) => {
      return activePolicies.some((p: any) => {
        const cat = (p.plan?.category || p.category || '').toUpperCase();
        const prodUpper = prod.toUpperCase();
        if (prodUpper === 'HEALTH' && cat === 'HEALTH') return true;
        if (prodUpper === 'LIFE' && cat === 'LIFE') return true;
        if (prodUpper === 'MOTOR' && cat === 'MOTOR') return true;
        return false;
      });
    });
  };

  const isPolicyOutsideRenewalWindowForCard = (card: any): boolean => {
    if (!loadedContact) return false;
    const activePolicies = (loadedContact.policies || []).filter((p: any) => p.status === 'ACTIVE' || !p.status);
    return card.interestedIn.some((prod: string) => {
      return activePolicies.some((p: any) => {
        const cat = (p.plan?.category || p.category || '').toUpperCase();
        const prodUpper = prod.toUpperCase();

        let match = false;
        if (prodUpper === 'HEALTH' && cat === 'HEALTH') match = true;
        if (prodUpper === 'LIFE' && cat === 'LIFE') match = true;
        if (prodUpper === 'MOTOR' && cat === 'MOTOR') match = true;

        if (match && p.endDate) {
          const expiryDate = new Date(p.endDate);
          const now = new Date();
          expiryDate.setHours(0, 0, 0, 0);
          now.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > maxRenewalWindow) {
            return true;
          }
        }
        return false;
      });
    });
  };

  const hasActiveRenewalLeadForCard = (card: any): boolean => {
    if (!loadedContact) return false;
    const backendInterests = loadedContact.productInterests || [];
    return card.interestedIn.some((prod: string) => {
      return backendInterests.some((lead: any) => {
        const extra = parseLeadNotes(lead.notes);
        const leadStatus = extra.leadStatus || '';
        const stage = lead.stage || '';
        const leadType = extra.leadType || 'FRESH';

        if (leadStatus === 'LEAD_LOST' || leadStatus === 'NOT_INTERESTED' || stage === 'PROCESS_COMPLETED' || stage === 'PAYMENT_DONE') {
          return false;
        }
        if (leadType !== 'RENEWAL') return false;
        return (lead.interests || []).some((i: string) => i.toLowerCase() === prod.toLowerCase());
      });
    });
  };

  const isProductAlreadyExistsForContact = (prod: string, cardLeadType?: string): boolean => {
    if (!loadedContact) return false;
    const backendInterests = loadedContact.productInterests || [];

    const activeLead = backendInterests.find((lead: any) => {
      const extra = parseLeadNotes(lead.notes);
      const leadStatus = extra.leadStatus || '';
      const stage = lead.stage || '';

      if (leadStatus === 'LEAD_LOST' || leadStatus === 'NOT_INTERESTED' || stage === 'PROCESS_COMPLETED' || stage === 'PAYMENT_DONE') {
        return false;
      }
      return (lead.interests || []).some((i: string) => i.toLowerCase() === prod.toLowerCase());
    });

    if (activeLead) {
      const activeLeadExtra = parseLeadNotes(activeLead.notes);
      const activeLeadType = activeLeadExtra.leadType || 'FRESH';

      if (cardLeadType === 'RENEWAL') {
        if (activeLeadType === 'RENEWAL') return true;
      } else {
        return true;
      }
    }

    const hasInPolicies = (loadedContact.policies || []).some((p: any) => {
      if (p.status && p.status !== 'ACTIVE') return false;

      const cat = (p.plan?.category || p.category || '').toUpperCase();
      const prodUpper = prod.toUpperCase();

      let match = false;
      if (prodUpper === 'HEALTH' && cat === 'HEALTH') match = true;
      if (prodUpper === 'LIFE' && cat === 'LIFE') match = true;
      if (prodUpper === 'MOTOR' && cat === 'MOTOR') match = true;

      if (match) {
        if (cardLeadType !== 'RENEWAL') return true;
        if (p.endDate) {
          const expiryDate = new Date(p.endDate);
          const now = new Date();
          expiryDate.setHours(0, 0, 0, 0);
          now.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > maxRenewalWindow) return true;
        }
      }
      return false;
    });
    if (hasInPolicies) return true;

    return false;
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
    filterPlans.length + filterStatuses.length + filterStages.length + filterTypes.length +
    (filterEmployee ? 1 : 0) + (filterDateFrom ? 1 : 0) + (filterDateTo ? 1 : 0) +
    (filterEnquiryDateFrom ? 1 : 0) + (filterEnquiryDateTo ? 1 : 0) +
    (filterFinalSellsFrom ? 1 : 0) + (filterFinalSellsTo ? 1 : 0) +
    (filterExpectedPremiumMin ? 1 : 0) + (filterExpectedPremiumMax ? 1 : 0) +
    (filterLeadSource ? 1 : 0);

  if (isLoading) return <div className="flex h-48 items-center justify-center text-gray-400">Loading pipeline…</div>;

  return (
    <div className="h-full flex flex-col gap-4">

      {/* Floating Right Action Panel */}
      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
      <div className="fixed right-5 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-3 bg-white/90 backdrop-blur-xl p-2 rounded-2xl shadow-2xl border border-slate-200/80 animate-fadeIn">
        {/* Import CSV */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white flex items-center justify-center transition-all hover:scale-105 shadow-md shadow-emerald-500/25 cursor-pointer group relative"
          title="Import Leads CSV"
        >
          <Upload size={18} strokeWidth={2.2} />
          <span className="absolute right-full mr-3 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl border border-slate-800">
            Import Leads CSV
          </span>
        </button>

        {/* New Lead */}
        <button
          type="button"
          onClick={() => openCreate('TO_CONTACT')}
          className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center justify-center transition-all hover:scale-105 shadow-lg shadow-blue-500/30 cursor-pointer group relative"
          title="New Lead"
        >
          <UserPlus size={18} strokeWidth={2.2} />
          <span className="absolute right-full mr-3 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl border border-slate-800">
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
          {/* Export Buttons */}
          <button
            type="button"
            onClick={exportLeadsToExcel}
            className="btn-secondary h-9 py-0 px-3 text-xs flex items-center gap-1.5 font-bold cursor-pointer rounded-lg bg-white shadow-2xs"
            title="Export to Excel"
          >
            <Download size={13} className="text-emerald-600" />
            <span className="hidden sm:inline">Excel</span>
          </button>
          <button
            type="button"
            onClick={exportLeadsToPdf}
            className="btn-secondary h-9 py-0 px-3 text-xs flex items-center gap-1.5 font-bold cursor-pointer rounded-lg bg-white shadow-2xs"
            title="Export to PDF"
          >
            <FileText size={13} className="text-red-500" />
            <span className="hidden sm:inline">PDF</span>
          </button>
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
                className="btn-secondary h-9 py-0 px-3 text-xs flex flex-wrap items-center gap-1.5 font-bold cursor-pointer rounded-lg"
              >
                <Columns size={13} /> <span>Columns</span>
              </button>
              {colMenuOpen && (
                <div className="absolute right-0 mt-1.5 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 min-w-[180px] space-y-1.5">
                  {ALL_TABLE_COLUMNS.filter(c => c.key !== 'actions').map(col => (
                    <label key={col.key} className="flex flex-wrap items-center gap-2 text-xs text-gray-700 cursor-pointer hover:text-gray-900">
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

      {/* Quick Filters Pill Bar */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2.5 rounded-2xl border border-slate-100 shadow-2xs animate-fadeIn">
        <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1">
          <Flame size={13} className="text-amber-500" /> Quick Filters:
        </span>
        {[
          { key: 'ALL', label: 'All Leads' },
          { key: 'HOT', label: 'Hot', icon: '🔥' },
          { key: 'VERY_HOT', label: 'Very Hot', icon: '💥' },
          { key: 'HEALTH', label: 'Health', icon: '🏥' },
          { key: 'LIFE', label: 'Life', icon: '🛡️' },
          { key: 'MF', label: 'Mutual Funds (MF)', icon: '📈' },
          { key: 'THIS_WEEK', label: 'Followup: This Week', icon: '📅' },
        ].map(q => {
          const isSelected = selectedQuickFilter === q.key;
          return (
            <button
              key={q.key}
              type="button"
              onClick={() => setSelectedQuickFilter(q.key)}
              className={clsx(
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs',
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm scale-105'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              {q.icon && <span>{q.icon}</span>}
              <span>{q.label}</span>
            </button>
          );
        })}
        {selectedQuickFilter !== 'ALL' && (
          <button
            type="button"
            onClick={() => setSelectedQuickFilter('ALL')}
            className="text-[11px] font-extrabold text-red-500 hover:text-red-700 ml-auto cursor-pointer px-2 py-0.5 rounded-lg bg-red-50 hover:bg-red-100 transition-colors"
          >
            Reset Quick Filter
          </button>
        )}
      </div>



      {/* Filter panel */}
      {showFilters && (
        <div className="card-panel grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-gray-50/50 p-4 border rounded-xl animate-fadeIn text-xs">
          {/* Lead Stage Filter */}
          <div>
            <label className="label text-[11px] font-bold text-gray-700">Lead Stage (Multi-Select)</label>
            <div className="relative" ref={stageFilterRef}>
              <button type="button" onClick={() => setStageFilterOpen(!stageFilterOpen)}
                className="input text-xs flex items-center justify-between w-full text-left bg-white font-medium">
                <span className="truncate">{filterStages.length === 0 ? 'All Stages' : `${filterStages.length} selected`}</span>
                <ChevronDown size={12} className="text-gray-400 shrink-0" />
              </button>
              {stageFilterOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg p-2 space-y-1 max-h-48 overflow-y-auto">
                  {[
                    { value: 'TO_CONTACT', label: 'To Contact' },
                    { value: 'CONTACTED', label: 'Contacted' },
                    { value: 'PROPOSAL_SENT', label: 'Proposal Sent' },
                    { value: 'LOGIN_PROGRESS', label: 'Login Progress' },
                    { value: 'PAYMENT_DONE', label: 'Payment Done' },
                    { value: 'PROCESS_COMPLETED', label: 'Process Completed' },
                  ].map(opt => (
                    <label key={opt.value} className="flex flex-wrap items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={filterStages.includes(opt.value)}
                        onChange={() => setFilterStages(prev => prev.includes(opt.value) ? prev.filter(v => v !== opt.value) : [...prev, opt.value])}
                        className="rounded accent-blue-600" />
                      {opt.label}
                    </label>
                  ))}
                  {filterStages.length > 0 && (
                    <button onClick={() => setFilterStages([])} className="w-full text-xs text-red-500 hover:text-red-700 py-1 text-center font-bold">Clear Selected</button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Lead Type Filter */}
          <div>
            <label className="label text-[11px] font-bold text-gray-700">Lead Type (Multi-Select)</label>
            <div className="relative" ref={typeFilterRef}>
              <button type="button" onClick={() => setTypeFilterOpen(!typeFilterOpen)}
                className="input text-xs flex items-center justify-between w-full text-left bg-white font-medium">
                <span className="truncate">{filterTypes.length === 0 ? 'All Lead Types' : `${filterTypes.length} selected`}</span>
                <ChevronDown size={12} className="text-gray-400 shrink-0" />
              </button>
              {typeFilterOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg p-2 space-y-1 max-h-48 overflow-y-auto">
                  {[
                    { value: 'FRESH', label: 'Fresh' },
                    { value: 'RENEWAL', label: 'Renewal' },
                    { value: 'PORTING', label: 'Porting' },
                  ].map(opt => (
                    <label key={opt.value} className="flex flex-wrap items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={filterTypes.includes(opt.value)}
                        onChange={() => setFilterTypes(prev => prev.includes(opt.value) ? prev.filter(v => v !== opt.value) : [...prev, opt.value])}
                        className="rounded accent-blue-600" />
                      {opt.label}
                    </label>
                  ))}
                  {filterTypes.length > 0 && (
                    <button onClick={() => setFilterTypes([])} className="w-full text-xs text-red-500 hover:text-red-700 py-1 text-center font-bold">Clear Selected</button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Product Category Filter */}
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
                    <label key={opt.value} className="flex flex-wrap items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 text-xs text-gray-700 cursor-pointer">
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

          {/* Lead Status Filter */}
          <div>
            <label className="label text-[11px] font-bold text-gray-700">
              Lead Status (Multi-Select)
            </label>
            <div className="relative" ref={statusFilterRef}>
              <button type="button" onClick={() => setStatusFilterOpen(!statusFilterOpen)}
                className="input text-xs flex items-center justify-between w-full text-left bg-white font-medium">
                <span className="truncate">{filterStatuses.length === 0 ? 'All Statuses' : `${filterStatuses.length} selected`}</span>
                <ChevronDown size={12} className="text-gray-400 shrink-0" />
              </button>
              {statusFilterOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg p-2 space-y-1 max-h-48 overflow-y-auto">
                  {LEAD_STATUS_OPTIONS.map(opt => (
                    <label key={opt.value} className="flex flex-wrap items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 text-xs text-gray-700 cursor-pointer">
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

          {/* Assigned Employee */}
          <div>
            <label className="label text-[11px] font-bold text-gray-700">Assigned Employee</label>
            <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)} className="input text-xs font-semibold w-full bg-white shadow-2xs">
              <option value="">All Employees</option>
              {employeesList.map((emp: any) => {
                const empUserId = emp.userId || emp.user?.id || emp.id;
                const empName = `${emp.firstName || emp.user?.firstName || ''} ${emp.lastName || emp.user?.lastName || ''}`.trim() || emp.email || 'Employee';
                return (
                  <option key={emp.id || empUserId} value={empUserId}>
                    {empName}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Next Follow-up Date */}
          <div className="space-y-1">
            <label className="label text-[11px] font-bold text-gray-700">Next Follow-up Date</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <DatePicker value={filterDateFrom} onChange={setFilterDateFrom} className="input text-xs" title="From" />
              <DatePicker value={filterDateTo} onChange={setFilterDateTo} className="input text-xs" title="To" />
            </div>
          </div>

          {/* Date of 1st Enquiry (Lead Creation Date) */}
          <div className="space-y-1">
            <label className="label text-[11px] font-bold text-gray-700">Date of 1st Enquiry (Creation Date)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <DatePicker value={filterEnquiryDateFrom} onChange={setFilterEnquiryDateFrom} className="input text-xs" title="From" />
              <DatePicker value={filterEnquiryDateTo} onChange={setFilterEnquiryDateTo} className="input text-xs" title="To" />
            </div>
          </div>

          {/* Date of Final Sells */}
          <div className="space-y-1">
            <label className="label text-[11px] font-bold text-gray-700">Date of Final Sells</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <DatePicker value={filterFinalSellsFrom} onChange={setFilterFinalSellsFrom} className="input text-xs" title="From" />
              <DatePicker value={filterFinalSellsTo} onChange={setFilterFinalSellsTo} className="input text-xs" title="To" />
            </div>
          </div>

          {/* Expected Premium Range */}
          <div className="space-y-1">
            <label className="label text-[11px] font-bold text-gray-700">Expected Premium Range</label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                placeholder="Min ₹"
                className="input text-xs w-full bg-white shadow-2xs"
                value={filterExpectedPremiumMin}
                onChange={e => setFilterExpectedPremiumMin(e.target.value)}
              />
              <span className="text-gray-400 font-bold">-</span>
              <input
                type="number"
                placeholder="Max ₹"
                className="input text-xs w-full bg-white shadow-2xs"
                value={filterExpectedPremiumMax}
                onChange={e => setFilterExpectedPremiumMax(e.target.value)}
              />
            </div>
          </div>

          {/* Lead Source */}
          <div>
            <label className="label text-[11px] font-bold text-gray-700">Lead Source</label>
            <select
              value={filterLeadSource}
              onChange={e => setFilterLeadSource(e.target.value)}
              className="input text-xs font-semibold w-full bg-white shadow-2xs"
            >
              <option value="">All Sources</option>
              <option value="Social Media">Social Media</option>
              <option value="Referral">Referral</option>
              <option value="Website">Website</option>
              <option value="Cold Call">Cold Call</option>
              <option value="Walk-in">Walk-in</option>
              <option value="Campaign">Campaign</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {activeFilterCount > 0 && (
            <div className="col-span-1 sm:col-span-2 lg:col-span-3 flex justify-end pt-2 border-t border-slate-200">
              <button
                onClick={() => {
                  setFilterPlans([]); setFilterStatuses([]); setFilterStages([]); setFilterTypes([]);
                  setFilterEmployee(''); setFilterDateFrom(''); setFilterDateTo('');
                  setFilterEnquiryDateFrom(''); setFilterEnquiryDateTo('');
                  setFilterFinalSellsFrom(''); setFilterFinalSellsTo('');
                  setFilterExpectedPremiumMin(''); setFilterExpectedPremiumMax('');
                  setFilterLeadSource('');
                }}
                className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 font-extrabold cursor-pointer px-3 py-1 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
              >
                <X size={13} /> Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main View */}
      {viewMode === 'board' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 pb-4 flex-1 overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          {UI_STAGES.map(stage => {
            const cards = filteredBoard[stage] ?? [];
            const totalBudget = expectedBusiness(stage);
            const backendStage = STAGE_MAPPINGS[stage];
            return (
              <div
                key={stage}
                className="flex flex-col min-w-0"
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
                  if (cardId && backendStage) {
                    const draggedLead = filteredLeads.find(l => l.id === cardId);
                    if (backendStage === 'PROCESS_COMPLETED') {
                      if (draggedLead) {
                        triggerPolicyCreationForLead(draggedLead);
                        return;
                      }
                    }
                    if (draggedLead && draggedLead.stage !== backendStage) {
                      return;
                    }
                  }
                }}
              >
                <div className="flex items-center justify-between mb-2 px-1.5 py-1 select-none">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className={clsx('h-2 w-2 rounded-full shrink-0',
                      stage === 'New' && 'bg-blue-500',
                      stage === 'Contacted' && 'bg-indigo-500',
                      stage === 'Proposal Sent' && 'bg-purple-500',
                      stage === 'In Discussion' && 'bg-amber-500',
                      stage === 'Login Progress' && 'bg-orange-500',
                      stage === 'Payment Done' && 'bg-emerald-500',
                      stage === 'Lost' && 'bg-rose-500'
                    )} />
                    <span className="text-xs font-bold text-slate-800 truncate">{stage}</span>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200/50 px-1 py-0.5 rounded-md shrink-0">{cards.length}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[9px] text-slate-400 font-bold shrink-0">
                      ₹{totalBudget >= 100000 ? `${(totalBudget / 100000).toFixed(1)}L` : `${(totalBudget / 1000).toFixed(1)}K`}
                    </span>
                    <button
                      onClick={() => openCreate(backendStage)}
                      className="p-0.5 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
                      title={`Add lead in ${stage}`}
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                </div>

                <div className={clsx(
                  'flex-1 min-h-[350px] rounded-xl border p-1.5 space-y-1.5 transition-all duration-200 overflow-y-auto custom-scrollbar',
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
          onCreate={() => openCreate('TO_CONTACT')}
        />
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={
          activeLeadTab === 'Policy'
            ? (editTarget ? "Edit Policy" : "Add Policy")
            : (editTarget ? "Edit Lead" : "Add New Lead")
        }
        subtitle={
          activeLeadTab === 'Policy'
            ? "Add or update policy details, company, plan name, and coverage."
            : (editTarget ? "Update lead profile, family details, and policies." : "Manage lead profile, family details, and address.")
        }
        size="2xl"
        actions={
          <div className="flex gap-2.5 mr-1">
            <button
              type="button"
              className="px-3 sm:px-5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl cursor-pointer shadow-md shadow-blue-500/20 transition-all hover:scale-105"
              onClick={(e) => handleLeadSubmit(e, false)}
            >
              {activeLeadTab === 'Policy'
                ? (editTarget || editContactId ? 'Update Policy' : 'Add Policy')
                : (editTarget || editContactId ? 'Update Profile' : 'Save')}
            </button>
          </div>
        }
      >
        <form className="space-y-3">

          {/* Modal sub-navigation tabs */}
          <div className="flex bg-slate-200/60 p-1.5 rounded-2xl mt-0 mb-3 gap-2 border border-slate-200/80 overflow-x-auto shadow-2xs">
            {['Product Interest', 'Personal', 'Family', 'Policy', 'WA Campaign', 'History'].map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveLeadTab(tab)}
                className={clsx(
                  'px-5 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap',
                  activeLeadTab === tab
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {editContactId && !editTarget && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl text-xs font-bold mb-3 flex items-center justify-between shadow-2xs animate-fadeIn">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="h-2 w-2 bg-emerald-500 rounded-full animate-ping shrink-0" />
                Existing Contact Found – Details Loaded.
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditContactId(null);
                  setLoadedContact(null);
                  setDuplicateContactMatched(null);
                  setPersonalFields({
                    fullName: '',
                    gender: '',
                    maritalStatus: '',
                    dateOfBirth: '',
                    email: '',
                    aadhaarNumber: '',
                    whatsappNumber: '',
                    sameAsWhatsapp: false,
                    callingNumber: '',
                    education: '',
                    annualIncome: '',
                    occupationType: '',
                    companyName: '',
                    state: '',
                    district: '',
                    city: '',
                    pincode: '',
                    streetAddress: ''
                  });
                  setFamilyMembers([]);
                  setPolicies([]);
                }}
                className="text-[10px] text-emerald-600 hover:text-emerald-800 underline uppercase tracking-wider font-extrabold cursor-pointer"
              >
                Clear / Reset
              </button>
            </div>
          )}

          {/* Tab contents */}
          <div className="h-[430px] overflow-y-auto pr-2 custom-scrollbar">
            {activeLeadTab === 'Product Interest' && (
              <div className="space-y-3 animate-fadeIn pb-2">

                {/* Cards List */}
                {productInterests.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-xs gap-2">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center mb-1">
                      <Shield size={24} className="text-blue-300" />
                    </div>
                    <p className="font-semibold text-slate-500">No product interests added yet.</p>
                    <p className="text-[11px] text-slate-400">Click "+ Add Product Interest" below to get started.</p>
                  </div>
                )}

                {productInterests.map((card, idx) => {
                  const displayName = card.interestedIn.length > 0
                    ? card.interestedIn.map(p => p === 'Other' && card.otherProduct ? card.otherProduct : p).join(', ')
                    : 'New Product Interest';

                  const PRODUCT_COLORS: Record<string, string> = {
                    Health: 'from-emerald-500 to-teal-600',
                    Life: 'from-blue-500 to-indigo-600',
                    Term: 'from-violet-500 to-purple-600',
                    'Accident Policy': 'from-orange-500 to-amber-600',
                    Motor: 'from-rose-500 to-pink-600',
                    'Mutual Funds': 'from-cyan-500 to-sky-600',
                    Porting: 'from-yellow-500 to-orange-500',
                    Other: 'from-slate-500 to-gray-600',
                  };
                  const firstProduct = card.interestedIn[0] || 'Other';
                  const headerGradient = PRODUCT_COLORS[firstProduct] || 'from-blue-500 to-indigo-600';

                  const isExisting = Boolean(card.id && !card.id.startsWith('temp-'));

                  return (
                    <div
                      key={card.id}
                      className="rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-md transition-all"
                    >
                      {/* Card Header — always visible */}
                      <div
                        className={`bg-gradient-to-r ${headerGradient} px-4 py-3 flex items-center justify-between cursor-pointer select-none`}
                        onClick={() => toggleProductCollapse(card.id)}
                      >
                        <div className="flex flex-wrap items-center gap-3 min-w-0">
                          <div className="w-6 h-6 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                            <span className="text-white font-black text-[11px]">{idx + 1}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-white font-extrabold text-xs truncate">
                              {displayName}
                              {isExisting && (
                                <span className="ml-2 px-1.5 py-0.5 rounded bg-white/20 text-white font-bold text-[9px] uppercase tracking-wider">
                                  Existing
                                </span>
                              )}
                            </p>
                            {card.collapsed && card.leadStage && (
                              <p className="text-white/70 text-[10px] font-semibold truncate">
                                {card.leadStage.replace(/_/g, ' ')} · {card.leadStatus.replace(/_/g, ' ')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {!isExisting && (
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); removeProductInterest(card.id); }}
                              className="p-1 rounded-lg bg-white/10 hover:bg-red-500/80 text-white transition-all"
                              title="Remove"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                          <ChevronDown
                            size={16}
                            className={`text-white transition-transform duration-200 ${card.collapsed ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </div>

                      {/* Card Body — collapse/expand */}
                      {!card.collapsed && (
                        <div className="p-4 space-y-4 bg-white">

                          {/* Interested In — toggle buttons */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Interested In</label>
                              {isExisting && (
                                <span className="text-[10px] text-slate-400 font-medium italic">
                                  Category fixed for existing records. Change status below or click "+ Add Product Interest" for a new product.
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {['Health', 'Life', 'Term', 'Accident Policy', 'Motor', 'Mutual Funds', 'Porting', 'Other'].map(prod => {
                                const isSel = card.interestedIn.includes(prod);
                                const isAlreadySelected = false;
                                const PILL_COLORS: Record<string, string> = {
                                  Health: isSel ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
                                  Life: isSel ? 'bg-blue-600 border-blue-600 text-white' : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
                                  Term: isSel ? 'bg-violet-600 border-violet-600 text-white' : 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100',
                                  'Accident Policy': isSel ? 'bg-orange-600 border-orange-600 text-white' : 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100',
                                  Motor: isSel ? 'bg-rose-600 border-rose-600 text-white' : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100',
                                  'Mutual Funds': isSel ? 'bg-cyan-600 border-cyan-600 text-white' : 'bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100',
                                  Porting: isSel ? 'bg-yellow-500 border-yellow-500 text-white' : 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100',
                                  Other: isSel ? 'bg-slate-700 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100',
                                };
                                let btnStyle = PILL_COLORS[prod] || (isSel ? 'bg-slate-700 text-white border-slate-700' : 'bg-white border-slate-200 text-slate-600');
                                return (
                                  <button
                                    key={prod}
                                    type="button"
                                    disabled={isExisting}
                                    onClick={() => {
                                      const next = isSel ? [] : [prod];
                                      updateProductInterest(card.id, 'interestedIn', next);
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all select-none ${btnStyle} ${isExisting ? 'opacity-70 cursor-not-allowed' : ''}`}
                                  >
                                    {isSel ? '✓ ' : '+ '}{prod}
                                  </button>
                                );
                              })}
                            </div>
                            {hasActiveRenewalLeadForCard(card) && card.leadType === 'RENEWAL' && (
                              <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-xl text-[11px] font-bold mt-2 animate-fadeIn">
                                An active Renewal lead already exists for this product.
                              </div>
                            )}
                            {hasActivePolicyForCard(card) && card.leadType === 'RENEWAL' && isPolicyOutsideRenewalWindowForCard(card) && (
                              <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-xl text-[11px] font-bold mt-2 animate-fadeIn">
                                Renewal cannot be created yet. The policy is outside the renewal period.
                              </div>
                            )}
                            {hasActivePolicyForCard(card) && card.leadType !== 'RENEWAL' && (
                              <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-xl text-[11px] font-bold mt-2 animate-fadeIn">
                                An active policy already exists for this product. Only a Renewal lead can be created.
                              </div>
                            )}
                            {card.interestedIn.includes('Other') && (
                              <div className="bg-slate-100/90 border-2 border-slate-300 rounded-xl p-3 space-y-1.5 animate-fadeIn mt-2.5">
                                <label className="label text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block">
                                  Specify Other Product Name *
                                </label>
                                <input
                                  type="text"
                                  disabled={isExisting}
                                  className={`w-full text-xs px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 font-medium focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none shadow-xs ${isExisting ? 'opacity-75 bg-slate-100 cursor-not-allowed' : ''}`}
                                  placeholder="Specify product name..."
                                  value={card.otherProduct}
                                  onChange={e => updateProductInterest(card.id, 'otherProduct', e.target.value)}
                                />
                              </div>
                            )}
                          </div>
                          {/* Description Details Box */}
                          <div className="bg-slate-50/90 rounded-2xl border border-slate-200/70 p-4 space-y-2 shadow-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                <FileText size={13} />
                              </div>
                              <h4 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                                Description Details
                              </h4>
                            </div>
                            <textarea
                              rows={2}
                              className="w-full text-xs p-3 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl text-slate-800 placeholder-slate-400 font-medium outline-none resize-y transition-all shadow-2xs"
                              placeholder="Enter details for whom they are interested, specific coverage requirements, family member preferences, or notes..."
                              value={card.descriptionDetails || ''}
                              onChange={e => updateProductInterest(card.id, 'descriptionDetails', e.target.value)}
                            />
                          </div>
                          {/* Row 1: Stage, Status, Dependency, Type */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Lead Stage <span className="text-red-500">*</span></label>
                              <select
                                className="input w-full text-xs"
                                value={card.leadStage}
                                onChange={e => updateProductInterest(card.id, 'leadStage', e.target.value)}
                              >
                                <option value="TO_CONTACT">To Contact</option>
                                <option value="CONTACTED">Contacted</option>
                                <option value="PROPOSAL_SENT">Proposal Sent</option>
                                <option value="LOGIN_PROGRESS">Login in Progress</option>
                                <option value="PAYMENT_DONE">Payment Done</option>
                                <option value="PROCESS_COMPLETED">Process Completed</option>
                              </select>
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Lead Status <span className="text-red-500">*</span>{isExisting ? ' (Editable)' : ''}
                              </label>
                              <select
                                className="input w-full text-xs"
                                value={card.leadStatus}
                                onChange={e => updateProductInterest(card.id, 'leadStatus', e.target.value)}
                              >
                                <option value="INTERESTED">Interested</option>
                                <option value="HOT">Hot 🔥</option>
                                <option value="VERY_HOT">Very Hot 🔥🔥</option>
                                <option value="NOT_INTERESTED">Not Interested</option>
                                <option value="LEAD_LOST">Lead Lost</option>
                              </select>
                            </div>
                            {/* <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Dependency *</label>
                              <select
                                disabled={isExisting}
                                className={`input w-full text-xs ${isExisting ? 'opacity-75 bg-slate-100 cursor-not-allowed' : ''}`}
                                value={card.dependencyType || 'SELF'}
                                onChange={e => updateProductInterest(card.id, 'dependencyType', e.target.value)}
                              >
                                <option value="SELF">Self</option>
                                <option value="DEPENDENT">Depend</option>
                              </select>
                            </div> */}
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Lead Type <span className="text-red-500">*</span></label>
                              <select
                                disabled={isExisting}
                                className={`input w-full text-xs ${isExisting ? 'opacity-75 bg-slate-100 cursor-not-allowed' : ''}`}
                                value={card.leadType}
                                onChange={e => updateProductInterest(card.id, 'leadType', e.target.value)}
                              >
                                <option value="FRESH">Fresh</option>
                                <option value="RENEWAL">Renewal</option>
                                <option value="PORTING">Porting</option>
                              </select>
                            </div>
                          </div>

                          {/* Members Included Multi-Select Box */}


                          {/* Row 2: Source, Assigned Employee, Follow-up Date, Expected Premium */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Lead Source <span className="text-red-500">*</span></label>
                              <input
                                type="text"
                                disabled={isExisting}
                                list={`lead-source-list-${card.id}`}
                                className={`input w-full text-xs ${isExisting ? 'opacity-75 bg-slate-100 cursor-not-allowed' : ''}`}
                                placeholder="e.g. Social Media"
                                value={card.leadSource}
                                onChange={e => updateProductInterest(card.id, 'leadSource', e.target.value)}
                              />
                              <datalist id={`lead-source-list-${card.id}`}>
                                <option value="Social Media" />
                                <option value="Our Customer Self" />
                                <option value="Referred by Customer" />
                                <option value="Walk-in" />
                                <option value="BNI" />
                              </datalist>
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Assigned Employee</label>
                              <select
                                className="input w-full text-xs bg-white"
                                value={card.assignedEmployeeId}
                                onChange={e => updateProductInterest(card.id, 'assignedEmployeeId', e.target.value)}
                              >
                                <option value="">Unassigned</option>
                                {employeesList.map((emp: any) => {
                                  const empUserId = emp.userId || emp.user?.id || emp.id;
                                  const empName = `${emp.firstName || emp.user?.firstName || ''} ${emp.lastName || emp.user?.lastName || ''}`.trim() || emp.email || 'Employee';
                                  return (
                                    <option key={emp.id || empUserId} value={empUserId}>
                                      {empName}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Follow-up Date <span className="text-red-500">*</span></label>
                              <DatePicker
                                disabled={isExisting}
                                className={`input w-full text-xs ${isExisting ? 'opacity-75 bg-slate-100 cursor-not-allowed' : ''}`}
                                value={card.followUpDate}
                                onChange={val => updateProductInterest(card.id, 'followUpDate', val)}
                              />
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Expected Premium / Budget (₹) <span className="text-red-500">*</span></label>
                              <input
                                type="number"
                                disabled={isExisting}
                                className={`input w-full text-xs ${isExisting ? 'opacity-75 bg-slate-100 cursor-not-allowed' : ''}`}
                                placeholder="e.g. 12000"
                                min={0}
                                value={card.expectedPremium}
                                onChange={e => updateProductInterest(card.id, 'expectedPremium', e.target.value)}
                              />
                            </div>
                          </div>

                          {/* Consultation Comments Section */}
                          <div className="bg-slate-50/90 rounded-2xl border border-slate-200/70 p-4 space-y-3 shadow-xs">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                  <MessageCircle size={13} />
                                </div>
                                <h4 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                                  Consultation Comments
                                </h4>
                              </div>
                              {card.comments.length > 0 && (
                                <span className="text-[10px] font-extrabold bg-slate-200/70 text-slate-600 px-2 py-0.5 rounded-full">
                                  {card.comments.length} {card.comments.length === 1 ? 'Comment' : 'Comments'}
                                </span>
                              )}
                            </div>

                            {/* Timeline List */}
                            <div className="max-h-56 overflow-y-auto space-y-2.5 custom-scrollbar pr-0.5">
                              {card.comments.length === 0 ? (
                                <div className="bg-white/60 rounded-xl border border-dashed border-slate-200 p-4 text-center">
                                  <p className="text-xs text-slate-400 font-medium italic">No comments yet. Add the first summary below.</p>
                                </div>
                              ) : (
                                (card.showAllComments ? card.comments : card.comments.slice(0, 2)).map((cmt, ci) => (
                                  <div key={ci} className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs hover:shadow-xs hover:border-blue-200 transition-all space-y-1.5 relative overflow-hidden group">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="inline-flex flex-wrap items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg shadow-2xs">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                        {cmt.author}
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-semibold flex flex-wrap items-center gap-1">
                                        {cmt.datetime}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap pl-0.5">
                                      {cmt.text}
                                    </p>
                                  </div>
                                ))
                              )}
                            </div>

                            {/* Know More / Show Less Toggle Button */}
                            {card.comments.length > 2 && (
                              <div className="pt-0.5 flex justify-start">
                                <button
                                  type="button"
                                  onClick={() => updateProductInterest(card.id, 'showAllComments', !card.showAllComments)}
                                  className="inline-flex flex-wrap items-center gap-1 text-xs font-extrabold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-all"
                                >
                                  {card.showAllComments ? (
                                    <>
                                      Show Less <ChevronUp size={13} />
                                    </>
                                  ) : (
                                    <>
                                      Know More ({card.comments.length - 2} more history) <ChevronDown size={13} />
                                    </>
                                  )}
                                </button>
                              </div>
                            )}

                            {/* Add Call Summary & Consultation Comment Box */}
                            <div className="bg-white rounded-xl border-2 border-blue-200/90 p-3 space-y-2 shadow-2xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all mt-1">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider flex flex-wrap items-center gap-1.5">
                                  <MessageCircle size={12} className="text-blue-600" />
                                  Add Call Summary / Comment
                                </label>
                                <span className="text-[9px] text-slate-400 font-semibold italic">Press Ctrl+Enter to save</span>
                              </div>
                              <textarea
                                rows={2}
                                className="w-full text-xs p-2.5 bg-slate-50/70 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 font-medium focus:bg-white focus:border-blue-400 outline-none resize-y transition-all"
                                placeholder="Type call summary, client discussion details, or follow-up notes..."
                                value={card.newComment}
                                onChange={e => updateProductInterest(card.id, 'newComment', e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    e.preventDefault();
                                    addProductComment(card.id);
                                  }
                                }}
                              />
                              <div className="flex justify-end pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => addProductComment(card.id)}
                                  disabled={!card.newComment.trim()}
                                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs cursor-pointer transition-all shadow-xs flex flex-wrap items-center gap-1.5"
                                >
                                  <Send size={12} />
                                  Save Call Summary
                                </button>
                              </div>
                            </div>


                          </div>

                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add Product Interest Button */}
                {(() => {
                  const standardProds = ['Health', 'Life', 'Term', 'Accident Policy', 'Motor', 'Mutual Funds', 'Porting'];
                  const allProductsAdded = false;

                  return (
                    <>
                      {allProductsAdded && (
                        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-2.5 rounded-xl text-xs font-bold mb-3 shadow-2xs animate-fadeIn">
                          All available products have already been added for this contact.
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={allProductsAdded}
                        onClick={addProductInterest}
                        className={clsx(
                          "w-full mt-1 py-3 rounded-2xl border-2 border-dashed text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer group",
                          allProductsAdded
                            ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                            : "border-blue-300 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50 text-blue-600 hover:text-blue-700"
                        )}
                      >
                        <Plus size={15} className="group-hover:scale-110 transition-transform" />
                        + Add Product Interest
                      </button>
                    </>
                  );
                })()}

              </div>
            )}
            {activeLeadTab === 'Personal' && (
              <fieldset disabled={!!editContactId} className="w-full">
                {editContactId && (
                  <div className="bg-slate-50 border border-slate-200 text-slate-500 px-3.5 py-2.5 rounded-xl text-xs font-bold mb-4 flex items-center justify-between shadow-2xs">
                    <span>Contact details are read-only. Edit them in the Contacts module.</span>
                  </div>
                )}
                <div className="space-y-4 max-h-[62vh] overflow-y-auto pr-1">
                  {/* 1. Personal Details */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">1</span>
                        Personal Details
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold">Basic Demographics</span>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">First Name <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="e.g. Rahul"
                          value={personalFields.firstName}
                          onChange={e => setPersonalFields(p => ({ ...p, firstName: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Middle Name</label>
                        <input
                          type="text"
                          className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="e.g. Kumar"
                          value={personalFields.middleName}
                          onChange={e => setPersonalFields(p => ({ ...p, middleName: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Last Name <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="e.g. Sharma"
                          value={personalFields.lastName}
                          onChange={e => setPersonalFields(p => ({ ...p, lastName: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Mother's Name</label>
                        <input
                          type="text"
                          className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="e.g. Sunita Sharma"
                          value={personalFields.motherName || ''}
                          onChange={e => setPersonalFields(p => ({ ...p, motherName: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Gender</label>
                        <select
                          className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                          value={['MALE', 'FEMALE', ''].includes(personalFields.gender) ? personalFields.gender : 'OTHER'}
                          onChange={e => setPersonalFields(p => ({ ...p, gender: e.target.value }))}
                        >
                          <option value="">Select Gender</option>
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Marital Status</label>
                        <select
                          className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                          value={personalFields.maritalStatus}
                          onChange={e => setPersonalFields(p => ({ ...p, maritalStatus: e.target.value }))}
                        >
                          <option value="">Select Status</option>
                          <option value="SINGLE">Single</option>
                          <option value="MARRIED">Married</option>
                          <option value="DIVORCED">Divorced</option>
                          <option value="WIDOWED">Widowed</option>
                        </select>
                      </div>
                      {personalFields.maritalStatus === 'MARRIED' && (
                        <div className="animate-fadeIn">
                          <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Wedding Anniversary Date</label>
                          <DatePicker
                            className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                            value={personalFields.weddingAnniversaryDate || ''}
                            onDateChange={(val) => setPersonalFields(p => ({ ...p, weddingAnniversaryDate: val }))}
                          />
                        </div>
                      )}
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Date of Birth {isFieldRequired('dateOfBirth', false) && <span className="text-red-500">*</span>}</label>
                        <DatePicker
                          className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                          value={personalFields.dateOfBirth}
                          onDateChange={handleDOBChange}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Age</label>
                        <input
                          type="text"
                          className="input w-full bg-slate-50 font-semibold text-slate-600 cursor-not-allowed rounded-xl"
                          value={personalFields.age}
                          disabled
                          placeholder="Auto-calculated"
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Height (cm)</label>
                        <input
                          type="number"
                          className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="e.g. 170"
                          value={personalFields.height}
                          onChange={(e) => setPersonalFields((p) => ({ ...p, height: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Weight (kg)</label>
                        <input
                          type="number"
                          className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="e.g. 65"
                          value={personalFields.weight}
                          onChange={(e) => setPersonalFields((p) => ({ ...p, weight: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">PAN Number {isFieldRequired('panNumber', false) && <span className="text-red-500">*</span>}</label>
                        <input
                          type="text"
                          className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all uppercase"
                          placeholder="ABCDE1234F"
                          maxLength={10}
                          value={personalFields.panNumber || personalFields.pan || ''}
                          onChange={(e) =>
                            setPersonalFields((p) => ({
                              ...p,
                              panNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                              pan: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. Contact Details */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">2</span>
                        Contact Details
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold">Communication Info</span>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Email Address {isFieldRequired('email', false) && <span className="text-red-500">*</span>}</label>
                        <input
                          type="email"
                          className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="client@example.com"
                          value={personalFields.email}
                          onChange={e => setPersonalFields(p => ({ ...p, email: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Aadhaar Number <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="12-digit Aadhaar No"
                          maxLength={12}
                          value={personalFields.aadhaarNumber}
                          onChange={e => setPersonalFields(p => ({ ...p, aadhaarNumber: e.target.value.replace(/\D/g, '') }))}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Whatsapp Number <span className="text-red-500">*</span></label>
                        <CountryPhoneInput
                          value={personalFields.whatsappNumber}
                          onChange={(value: string) =>
                            setPersonalFields((p) => ({
                              ...p,
                              whatsappNumber: value,
                              callingNumber: p.sameAsWhatsapp ? value : p.callingNumber,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Calling Number</label>
                          <label className="flex flex-wrap items-center gap-1 text-[10px] text-blue-600 font-semibold cursor-pointer select-none">
                            <input
                              type="checkbox"
                              className="accent-blue-600 w-3 h-3 rounded"
                              checked={personalFields.sameAsWhatsapp}
                              onChange={e => {
                                const checked = e.target.checked;
                                setPersonalFields(p => ({
                                  ...p,
                                  sameAsWhatsapp: checked,
                                  callingNumber: checked ? p.whatsappNumber : p.callingNumber
                                }));
                              }}
                            />
                            Same as Whatsapp
                          </label>
                        </div>
                        <CountryPhoneInput
                          disabled={personalFields.sameAsWhatsapp}
                          value={personalFields.callingNumber}
                          onChange={(value: string) =>
                            setPersonalFields((p) => ({
                              ...p,
                              callingNumber: value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. Education & Occupation */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
                    <div className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">3</span>
                        Education &amp; Occupation
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold">Professional Profile</span>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Education</label>
                        <DatalistInput
                          className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="Select or enter Education"
                          value={personalFields.education || ''}
                          options={EDUCATION_OPTIONS}
                          onChange={val => setPersonalFields(p => ({ ...p, education: val }))}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Annual Income {isFieldRequired('annualIncome', false) && <span className="text-red-500">*</span>}</label>
                        <select
                          className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                          value={personalFields.annualIncome}
                          onChange={e => setPersonalFields(p => ({ ...p, annualIncome: e.target.value }))}
                        >
                          <option value="">Select Income Bracket</option>
                          <option value="200000">Below 2 Lakhs</option>
                          <option value="500000">2 - 5 Lakhs</option>
                          <option value="1000000">5 - 10 Lakhs</option>
                          <option value="2000000">10 - 20 Lakhs</option>
                          <option value="5000000">20+ Lakhs</option>
                        </select>
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Occupation Type <span className="text-red-500">*</span></label>
                        <DatalistInput
                          className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="Select or enter Occupation Type"
                          value={personalFields.occupationType || ''}
                          options={OCCUPATION_TYPE_OPTIONS}
                          onChange={val => setPersonalFields(p => ({ ...p, occupationType: val }))}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Company / Business Name</label>
                        <input
                          type="text"
                          className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="e.g. Infosys / Traders"
                          value={personalFields.companyName}
                          onChange={e => setPersonalFields(p => ({ ...p, companyName: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. Address Details */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">4</span>
                        Address Details
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold">Location &amp; Residence</span>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">State <span className="text-red-500">*</span></label>
                        <select
                          className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                          value={personalFields.state}
                          onChange={e => setPersonalFields(p => ({ ...p, state: e.target.value }))}
                        >
                          <option value="">Select State</option>
                          <option value="Maharashtra">Maharashtra</option>
                          <option value="Delhi">Delhi</option>
                          <option value="Karnataka">Karnataka</option>
                          <option value="Gujarat">Gujarat</option>
                        </select>
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">District <span className="text-red-500">*</span></label>
                        <select
                          className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                          value={personalFields.district}
                          onChange={e => setPersonalFields(p => ({ ...p, district: e.target.value }))}
                        >
                          <option value="">Select District</option>
                          <option value="Pune">Pune</option>
                          <option value="Mumbai">Mumbai</option>
                          <option value="Bangalore">Bangalore</option>
                          <option value="Ahmedabad">Ahmedabad</option>
                        </select>
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">City / Town <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="e.g. Pune"
                          value={personalFields.city}
                          onChange={e => setPersonalFields(p => ({ ...p, city: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Pincode</label>
                        <input
                          type="text"
                          className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="000000"
                          value={personalFields.pincode}
                          onChange={e => setPersonalFields(p => ({ ...p, pincode: e.target.value }))}
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Street Address / House No</label>
                        <textarea
                          className="input w-full text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                          rows={2}
                          placeholder="Flat No, Street, Landmark..."
                          value={personalFields.streetAddress}
                          onChange={e => setPersonalFields(p => ({ ...p, streetAddress: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 5. Bank Details */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">5</span>
                        Bank Details
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold">Banking Information</span>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Bank Name</label>
                        <input
                          type="text"
                          className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="e.g. HDFC Bank"
                          value={personalFields.bankName || ''}
                          onChange={e => setPersonalFields(p => ({ ...p, bankName: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Account Number</label>
                        <input
                          type="text"
                          className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="e.g. 50100012345678"
                          value={personalFields.bankAccountNumber || ''}
                          onChange={e => setPersonalFields(p => ({ ...p, bankAccountNumber: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">IFSC Code</label>
                        <input
                          type="text"
                          className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all uppercase"
                          placeholder="e.g. HDFC0001234"
                          value={personalFields.bankIfsc || ''}
                          onChange={e => setPersonalFields(p => ({ ...p, bankIfsc: e.target.value.toUpperCase() }))}
                        />
                      </div>
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Branch Name</label>
                        <input
                          type="text"
                          className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                          placeholder="e.g. Shivajinagar Branch"
                          value={personalFields.bankBranch || ''}
                          onChange={e => setPersonalFields(p => ({ ...p, bankBranch: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 6. Lifestyle Habits */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">6</span>
                        Lifestyle Habits
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold">Personal Habits</span>
                    </div>
                    <div className="p-4 flex flex-wrap gap-4">
                      <label className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all cursor-pointer select-none ${personalFields.chewTobacco ? 'bg-blue-50/80 border-blue-300 text-blue-800 font-bold shadow-2xs' : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        <input
                          type="checkbox"
                          className="accent-blue-600 w-4 h-4 rounded"
                          checked={!!personalFields.chewTobacco}
                          onChange={e => setPersonalFields(p => ({ ...p, chewTobacco: e.target.checked }))}
                        />
                        <span className="text-xs font-semibold">Chew Tobacco</span>
                      </label>
                      <label className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all cursor-pointer select-none ${personalFields.smoke ? 'bg-blue-50/80 border-blue-300 text-blue-800 font-bold shadow-2xs' : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        <input
                          type="checkbox"
                          className="accent-blue-600 w-4 h-4 rounded"
                          checked={!!personalFields.smoke}
                          onChange={e => setPersonalFields(p => ({ ...p, smoke: e.target.checked }))}
                        />
                        <span className="text-xs font-semibold">Smoke</span>
                      </label>
                      <label className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all cursor-pointer select-none ${personalFields.consumeAlcohol ? 'bg-blue-50/80 border-blue-300 text-blue-800 font-bold shadow-2xs' : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        <input
                          type="checkbox"
                          className="accent-blue-600 w-4 h-4 rounded"
                          checked={!!personalFields.consumeAlcohol}
                          onChange={e => setPersonalFields(p => ({ ...p, consumeAlcohol: e.target.checked }))}
                        />
                        <span className="text-xs font-semibold">Consume Alcohol</span>
                      </label>
                    </div>
                  </div>

                  {/* 7. Health History / Medical History */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">7</span>
                        Health History / Medical History
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold">Medical Records</span>
                    </div>
                    <div className="p-4 space-y-4">
                      {/* Declared Medical History Multi-Select */}
                      <MultiSelectBox
                        label="Declared Medical History (Multi-Select)"
                        selectedValues={(personalFields.declaredMedicalHistory || []) as string[]}
                        onChange={(vals) => setPersonalFields(p => ({ ...p, declaredMedicalHistory: vals }))}
                        badgeColor="blue"
                        placeholder="Click to select medical conditions..."
                      />

                      {/* NOT Declared Medical History Multi-Select */}
                      <MultiSelectBox
                        label="NOT Declared Medical History (Multi-Select)"
                        selectedValues={(personalFields.notDeclaredMedicalHistory || []) as string[]}
                        onChange={(vals) => setPersonalFields(p => ({ ...p, notDeclaredMedicalHistory: vals }))}
                        badgeColor="orange"
                        placeholder="Click to select NOT declared conditions..."
                      />

                      {/* Details of Medical History */}
                      <div>
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Details of Medical History</label>
                        <textarea
                          className="input w-full resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                          rows={2}
                          placeholder="Add any additional medical history details..."
                          value={personalFields.medicalHistoryDetails}
                          onChange={e => setPersonalFields(p => ({ ...p, medicalHistoryDetails: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 8. Any Surgery Done / Advised */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">8</span>
                        Any Surgery Done / Advised
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold">Surgical History</span>
                    </div>
                    <div className="p-4">
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Surgery Details / History</label>
                      <textarea
                        className="input w-full text-xs resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                        rows={2}
                        placeholder="Specify any surgeries done or advised..."
                        value={personalFields.surgeryDetails || ''}
                        onChange={e => setPersonalFields(p => ({ ...p, surgeryDetails: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* 9. Current Medicines / Prescription */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">9</span>
                        Current Medicines / Prescription
                      </h4>
                      <span className="text-[10px] text-slate-400 font-semibold">Ongoing Medications</span>
                    </div>
                    <div className="p-4">
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Prescription &amp; Medication Details</label>
                      <textarea
                        className="input w-full text-xs resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                        rows={2}
                        placeholder="List current ongoing medicines or prescriptions..."
                        value={personalFields.prescriptionDetails || ''}
                        onChange={e => setPersonalFields(p => ({ ...p, prescriptionDetails: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </fieldset>
            )}


            {activeLeadTab === 'Family' && (
              <div className="h-full flex flex-col gap-0">
                {editContactId && (
                  <div className="bg-slate-50 border border-slate-200 text-slate-500 px-3.5 py-2.5 rounded-xl text-xs font-bold mb-4 flex items-center justify-between shadow-2xs flex-shrink-0">
                    <span>Contact details are read-only. Edit them in the Contacts module.</span>
                  </div>
                )}
                {/* Header */}
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                  <h3 className="text-base font-bold text-gray-800">Dependents &amp; Beneficiaries</h3>
                  {!editContactId && (
                    <button
                      type="button"
                      onClick={() => setFamilyMembers(prev => [...prev, { firstName: '', middleName: '', lastName: '', dob: '', relation: '', whatsapp: '', occupation: '', education: '', medicalHistory: [], declaredMedicalHistory: [], notDeclaredMedicalHistory: [], medicalHistoryDetails: '' }])}
                      className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                    >
                      + Add Member
                    </button>
                  )}
                </div>

                {/* Members */}
                <fieldset disabled={!!editContactId} className="flex-1 overflow-y-auto pr-0.5 min-h-0">
                  <div className="space-y-3">
                    {familyMembers.length === 0 ? (
                      <div className="flex items-center justify-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50" style={{ minHeight: '120px' }}>
                        <p className="text-xs text-gray-400 font-medium">No family details added yet.</p>
                      </div>
                    ) : (
                      familyMembers.map((member, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-xl bg-white shadow-sm">
                          {/* Card header */}
                          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Member #{idx + 1}</span>
                            {!editContactId && (
                              <button
                                type="button"
                                onClick={() => setFamilyMembers(prev => prev.filter((_, i) => i !== idx))}
                                className="w-5 h-5 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors cursor-pointer text-xs font-bold"
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          {/* Row 1: First Name | Middle Name | Last Name */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 pt-3">
                            <div>
                              <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">First Name {isFieldRequired('firstName', true) && <span className="text-red-500">*</span>}</label>
                              <input
                                type="text"
                                className="input w-full mt-1"
                                placeholder="First name"
                                value={member.firstName || ''}
                                onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, firstName: e.target.value } : m))}
                              />
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Middle Name</label>
                              <input
                                type="text"
                                className="input w-full mt-1"
                                placeholder="Middle name"
                                value={member.middleName || ''}
                                onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, middleName: e.target.value } : m))}
                              />
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Last Name {isFieldRequired('lastName', true) && <span className="text-red-500">*</span>}</label>
                              <input
                                type="text"
                                className="input w-full mt-1"
                                placeholder="Last name"
                                value={member.lastName || ''}
                                onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, lastName: e.target.value } : m))}
                              />
                            </div>
                          </div>

                          {/* Row 2: DOB | Relation */}
                          {/* Row 2: DOB | Relation | Occupation */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 pt-3">
                            <div>
                              <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">DOB</label>
                              <DatePicker
                                className="input w-full mt-1"
                                value={member.dob}
                                onChange={val => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, dob: val } : m))}
                              />
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Relation</label>
                              <select
                                className="input w-full mt-1"
                                value={['SPOUSE', 'SON', 'DAUGHTER', 'FATHER', 'MOTHER', 'Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Child', ''].includes(member.relation) ? member.relation : 'OTHER'}
                                onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, relation: e.target.value } : m))}
                              >
                                <option value="">Select</option>
                                <option value="SPOUSE">Spouse</option>
                                <option value="SON">Son</option>
                                <option value="DAUGHTER">Daughter</option>
                                <option value="FATHER">Father</option>
                                <option value="MOTHER">Mother</option>
                                <option value="OTHER">Other</option>
                              </select>
                              {(member.relation === 'OTHER' || member.relation === 'Other' || (member.relation && !['SPOUSE', 'SON', 'DAUGHTER', 'FATHER', 'MOTHER', 'Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Child', ''].includes(member.relation))) && (
                                <div className="mt-1.5 animate-fadeIn">
                                  <input
                                    type="text"
                                    className="input w-full text-xs"
                                    placeholder="Specify Relation..."
                                    value={['OTHER', 'Other'].includes(member.relation) ? '' : member.relation}
                                    onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, relation: e.target.value || 'OTHER' } : m))}
                                  />
                                </div>
                              )}
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Occupation</label>
                              <select
                                className="input w-full mt-1"
                                value={['SALARIED', 'SELF_EMPLOYED', 'BUSINESS', 'STUDENT', 'HOMEMAKER', 'RETIRED', 'Salaried', 'Self Employed', 'Business', 'Student', 'Homemaker', 'Retired', ''].includes(member.occupation) ? member.occupation : 'OTHER'}
                                onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, occupation: e.target.value } : m))}
                              >
                                <option value="">Select Type</option>
                                <option value="SALARIED">Salaried</option>
                                <option value="SELF_EMPLOYED">Self Employed</option>
                                <option value="BUSINESS">Business</option>
                                <option value="STUDENT">Student</option>
                                <option value="HOMEMAKER">Homemaker</option>
                                <option value="RETIRED">Retired</option>
                                <option value="OTHER">Other</option>
                              </select>
                              {(member.occupation === 'OTHER' || member.occupation === 'Other' || (member.occupation && !['SALARIED', 'SELF_EMPLOYED', 'BUSINESS', 'STUDENT', 'HOMEMAKER', 'RETIRED', 'Salaried', 'Self Employed', 'Business', 'Student', 'Homemaker', 'Retired', ''].includes(member.occupation))) && (
                                <div className="mt-1.5 animate-fadeIn">
                                  <input
                                    type="text"
                                    className="input w-full text-xs"
                                    placeholder="Specify Occupation..."
                                    value={['OTHER', 'Other'].includes(member.occupation) ? '' : member.occupation}
                                    onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, occupation: e.target.value || 'OTHER' } : m))}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Row 3: Whatsapp | Calling Number | Education */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 pt-3">
                            <div>
                              <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Whatsapp</label>
                              <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-500/10 focus-within:border-blue-500 transition-all mt-1">
                                <span className="bg-slate-50 px-2.5 py-1.5 text-xs border-r border-slate-200 text-slate-500 font-bold">+91</span>
                                <input
                                  type="tel"
                                  className="px-3 py-1.5 text-xs w-full outline-none bg-transparent"
                                  placeholder="Number"
                                  maxLength={10}
                                  value={member.whatsapp}
                                  onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, whatsapp: e.target.value.replace(/\D/g, '') } : m))}
                                />
                              </div>
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Calling Number</label>
                              <div className="mt-1">
                                <CountryPhoneInput
                                  value={member.callingNumber || ''}
                                  onChange={(value: string) => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, callingNumber: value } : m))}
                                />
                              </div>
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Education</label>
                              <select
                                className="input w-full mt-1"
                                value={['HighSchool', 'Graduate', 'PostGraduate', 'Professional', 'Below 10th', '10th Pass', '12th Pass', ''].includes(member.education) ? member.education : 'OTHER'}
                                onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, education: e.target.value } : m))}
                              >
                                <option value="">Select Type</option>
                                <option value="HighSchool">High School</option>
                                <option value="Graduate">Graduate</option>
                                <option value="PostGraduate">Post Graduate</option>
                                <option value="Professional">Professional</option>
                                <option value="OTHER">Other</option>
                              </select>
                              {(member.education === 'OTHER' || member.education === 'Other' || (member.education && !['HighSchool', 'Graduate', 'PostGraduate', 'Professional', 'Below 10th', '10th Pass', '12th Pass', ''].includes(member.education))) && (
                                <div className="mt-1.5 animate-fadeIn">
                                  <input
                                    type="text"
                                    className="input w-full text-xs"
                                    placeholder="Specify Education..."
                                    value={['OTHER', 'Other'].includes(member.education) ? '' : member.education}
                                    onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, education: e.target.value || 'OTHER' } : m))}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Row 4: Medical History */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 pt-3 pb-3">
                            {/* Generic Medical History */}
                            <div className="col-span-3">
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Medical History (Select if applicable)</label>
                              <div className="flex flex-wrap gap-x-6 gap-y-2">
                                {['BP', 'Sugar', 'Heart', 'Thyroid', 'Others'].map((condition) => {
                                  const isOthers = condition === 'Others';
                                  const current = member.medicalHistory || [];
                                  const isSelected = isOthers
                                    ? current.some((c: string) => !['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c))
                                    : current.includes(condition);
                                  return (
                                    <label key={condition} className="flex flex-wrap items-center gap-1.5 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        className="accent-blue-600 w-3.5 h-3.5"
                                        checked={isSelected}
                                        onChange={() => {
                                          setFamilyMembers(prev => prev.map((m, i) => {
                                            if (i !== idx) return m;
                                            const list: string[] = m.medicalHistory || [];
                                            if (isOthers) {
                                              if (isSelected) {
                                                return {
                                                  ...m,
                                                  medicalHistory: list.filter((c: string) => ['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c))
                                                };
                                              } else {
                                                return {
                                                  ...m,
                                                  medicalHistory: [...list, '']
                                                };
                                              }
                                            } else {
                                              return {
                                                ...m,
                                                medicalHistory: isSelected
                                                  ? list.filter((c: string) => c !== condition)
                                                  : [...list, condition]
                                              };
                                            }
                                          }));
                                        }}
                                      />
                                      <span className="text-xs text-slate-600 font-medium">{condition}</span>
                                    </label>
                                  );
                                })}
                              </div>
                              {(member.medicalHistory || []).some((c: string) => !['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c)) && (
                                <div className="mt-2 animate-fadeIn">
                                  <input
                                    type="text"
                                    className="input w-full text-xs py-1 px-2.5"
                                    placeholder="Type medical conditions..."
                                    value={(member.medicalHistory || []).find((c: string) => !['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c)) || ''}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setFamilyMembers(prev => prev.map((m, i) => {
                                        if (i !== idx) return m;
                                        const current: string[] = m.medicalHistory || [];
                                        const baseVal = current.filter((c: string) => ['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c));
                                        return {
                                          ...m,
                                          medicalHistory: [...baseVal, val]
                                        };
                                      }));
                                    }}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Declared Medical History */}
                            <div className="col-span-3">
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Declared Medical History</label>
                              <div className="flex flex-wrap gap-x-6 gap-y-2">
                                {['BP', 'Sugar', 'Heart', 'Thyroid', 'Others'].map((condition) => {
                                  const isOthers = condition === 'Others';
                                  const current = member.declaredMedicalHistory || [];
                                  const isSelected = isOthers
                                    ? current.some((c: string) => !['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c))
                                    : current.includes(condition);
                                  return (
                                    <label key={condition} className="flex flex-wrap items-center gap-1.5 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        className="accent-blue-600 w-3.5 h-3.5"
                                        checked={isSelected}
                                        onChange={() => {
                                          setFamilyMembers(prev => prev.map((m, i) => {
                                            if (i !== idx) return m;
                                            const list: string[] = m.declaredMedicalHistory || [];
                                            if (isOthers) {
                                              if (isSelected) {
                                                return {
                                                  ...m,
                                                  declaredMedicalHistory: list.filter((c: string) => ['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c))
                                                };
                                              } else {
                                                return {
                                                  ...m,
                                                  declaredMedicalHistory: [...list, '']
                                                };
                                              }
                                            } else {
                                              return {
                                                ...m,
                                                declaredMedicalHistory: isSelected
                                                  ? list.filter((c: string) => c !== condition)
                                                  : [...list, condition]
                                              };
                                            }
                                          }));
                                        }}
                                      />
                                      <span className="text-xs text-slate-600 font-medium">{condition}</span>
                                    </label>
                                  );
                                })}
                              </div>
                              {(member.declaredMedicalHistory || []).some((c: string) => !['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c)) && (
                                <div className="mt-2 animate-fadeIn">
                                  <input
                                    type="text"
                                    className="input w-full text-xs py-1 px-2.5"
                                    placeholder="Type medical conditions..."
                                    value={(member.declaredMedicalHistory || []).find((c: string) => !['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c)) || ''}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setFamilyMembers(prev => prev.map((m, i) => {
                                        if (i !== idx) return m;
                                        const current: string[] = m.declaredMedicalHistory || [];
                                        const baseVal = current.filter((c: string) => ['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c));
                                        return {
                                          ...m,
                                          declaredMedicalHistory: [...baseVal, val]
                                        };
                                      }));
                                    }}
                                  />
                                </div>
                              )}
                            </div>

                            {/* NOT Declared Medical History */}
                            <div className="col-span-3">
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">NOT Declared Medical History</label>
                              <div className="flex flex-wrap gap-x-6 gap-y-2">
                                {['BP', 'Sugar', 'Heart', 'Thyroid', 'Others'].map((condition) => {
                                  const isOthers = condition === 'Others';
                                  const current = member.notDeclaredMedicalHistory || [];
                                  const isSelected = isOthers
                                    ? current.some((c: string) => !['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c))
                                    : current.includes(condition);
                                  return (
                                    <label key={condition} className="flex flex-wrap items-center gap-1.5 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        className="accent-orange-500 w-3.5 h-3.5"
                                        checked={isSelected}
                                        onChange={() => {
                                          setFamilyMembers(prev => prev.map((m, i) => {
                                            if (i !== idx) return m;
                                            const list: string[] = m.notDeclaredMedicalHistory || [];
                                            if (isOthers) {
                                              if (isSelected) {
                                                return {
                                                  ...m,
                                                  notDeclaredMedicalHistory: list.filter((c: string) => ['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c))
                                                };
                                              } else {
                                                return {
                                                  ...m,
                                                  notDeclaredMedicalHistory: [...list, '']
                                                };
                                              }
                                            } else {
                                              return {
                                                ...m,
                                                notDeclaredMedicalHistory: isSelected
                                                  ? list.filter((c: string) => c !== condition)
                                                  : [...list, condition]
                                              };
                                            }
                                          }));
                                        }}
                                      />
                                      <span className="text-xs text-slate-600 font-medium">{condition}</span>
                                    </label>
                                  );
                                })}
                              </div>
                              {(member.notDeclaredMedicalHistory || []).some((c: string) => !['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c)) && (
                                <div className="mt-2 animate-fadeIn">
                                  <input
                                    type="text"
                                    className="input w-full text-xs py-1 px-2.5"
                                    placeholder="Type medical conditions..."
                                    value={(member.notDeclaredMedicalHistory || []).find((c: string) => !['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c)) || ''}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setFamilyMembers(prev => prev.map((m, i) => {
                                        if (i !== idx) return m;
                                        const current: string[] = m.notDeclaredMedicalHistory || [];
                                        const baseVal = current.filter((c: string) => ['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c));
                                        return {
                                          ...m,
                                          notDeclaredMedicalHistory: [...baseVal, val]
                                        };
                                      }));
                                    }}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Details of Medical History */}
                            <div className="col-span-3">
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Details of Medical History</label>
                              <textarea
                                className="input w-full resize-none"
                                rows={2}
                                placeholder="Add any additional medical history details..."
                                value={member.medicalHistoryDetails || ''}
                                onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, medicalHistoryDetails: e.target.value } : m))}
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </fieldset>
              </div>
            )}

            {activeLeadTab === 'Policy' && (
              <div className="h-full flex flex-col gap-3">
                {editContactId && (
                  <div className="bg-slate-50 border border-slate-200 text-slate-500 px-3.5 py-2.5 rounded-xl text-xs font-bold flex-shrink-0 shadow-2xs">
                    <span>Contact details are read-only. Edit them in the Contacts module.</span>
                  </div>
                )}
                <div className="flex items-center justify-between flex-shrink-0">
                  <h3 className="text-base font-bold text-gray-800 text-sm">Policy Details</h3>
                  {!editContactId && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveLeadTab('Policy');
                        setPolicies(prev => [...prev, { policyType: 'Health', entries: [{ company: '', planName: '', policyNo: '', startDate: '', duration: '1 Year', endDate: '', premium: '', sumInsured: '', deductible: '', sumAssured: '', maturityDate: '', paymentTerm: '', entryType: 'New' }] }]);
                      }}
                      className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                    >
                      + Add Policy
                    </button>
                  )}
                </div>

                <fieldset disabled={!!editContactId} className="flex-1 overflow-y-auto pr-0.5 min-h-0">
                  <div className="space-y-4">
                    {policies.length === 0 ? (
                      <div className="flex items-center justify-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50" style={{ minHeight: '120px' }}>
                        <p className="text-xs text-gray-400 font-medium">No policies found for this contact.</p>
                      </div>
                    ) : (
                      policies.map((pGroup, gIdx) => (
                        <div key={gIdx} className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-gray-100">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-extrabold text-slate-600">Type:</span>
                              <select
                                value={pGroup.policyType}
                                onChange={e => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, policyType: e.target.value } : pg))}
                                className="bg-transparent border-none text-xs font-extrabold text-blue-600 focus:ring-0 cursor-pointer p-0"
                              >
                                <option value="Health">Health</option>
                                <option value="Life">Life</option>
                              </select>
                            </div>
                            {!editContactId && (
                              <button
                                type="button"
                                onClick={() => setPolicies(prev => prev.filter((_, gi) => gi !== gIdx))}
                                className="text-xs text-red-500 hover:text-red-700 font-bold"
                              >
                                Remove Card
                              </button>
                            )}
                          </div>

                          <div className="p-3 space-y-3">
                            {pGroup.entries.map((entry: any, eIdx: number) => (
                              <div key={eIdx} className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-slate-400">Entry #{eIdx + 1}</span>
                                  {pGroup.entries.length > 1 && !editContactId && (
                                    <button
                                      type="button"
                                      onClick={() => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: pg.entries.filter((_: any, ei: number) => ei !== eIdx) } : pg))}
                                      className="text-[10px] text-red-500 hover:underline"
                                    >
                                      Remove Entry
                                    </button>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div>
                                    <label className="label text-[10px]">Company</label>
                                    <input
                                      type="text"
                                      className="input w-full mt-1 text-xs"
                                      placeholder="Company name"
                                      value={entry.company}
                                      onChange={e => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: pg.entries.map((en: any, ei: number) => ei === eIdx ? { ...en, company: e.target.value } : en) } : pg))}
                                    />
                                  </div>
                                  <div>
                                    <label className="label text-[10px]">Plan Name</label>
                                    <input
                                      type="text"
                                      className="input w-full mt-1 text-xs"
                                      placeholder="Plan name"
                                      value={entry.planName}
                                      onChange={e => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: pg.entries.map((en: any, ei: number) => ei === eIdx ? { ...en, planName: e.target.value } : en) } : pg))}
                                    />
                                  </div>
                                  <div>
                                    <label className="label text-[10px]">Policy Number</label>
                                    <input
                                      type="text"
                                      className="input w-full mt-1 text-xs"
                                      placeholder="Policy No"
                                      value={entry.policyNo}
                                      onChange={e => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: pg.entries.map((en: any, ei: number) => ei === eIdx ? { ...en, policyNo: e.target.value } : en) } : pg))}
                                    />
                                  </div>
                                  <div>
                                    <label className="label text-[10px]">Start Date</label>
                                    <DatePicker
                                      className="input w-full mt-1 text-xs"
                                      value={entry.startDate}
                                      onChange={val => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? {
                                        ...pg,
                                        entries: pg.entries.map((en: any, ei: number) => {
                                          if (ei !== eIdx) return en;
                                          const updatedTenure = calculateTenureFromDates(val, en.endDate) || en.duration;
                                          return { ...en, startDate: val, duration: updatedTenure };
                                        })
                                      } : pg))}
                                    />
                                  </div>
                                  <div>
                                    <label className="label text-[10px]">End Date</label>
                                    <DatePicker
                                      className="input w-full mt-1 text-xs"
                                      value={entry.endDate}
                                      onChange={val => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? {
                                        ...pg,
                                        entries: pg.entries.map((en: any, ei: number) => {
                                          if (ei !== eIdx) return en;
                                          const updatedTenure = calculateTenureFromDates(en.startDate, val) || en.duration;
                                          return { ...en, endDate: val, duration: updatedTenure };
                                        })
                                      } : pg))}
                                    />
                                  </div>
                                  <div>
                                    <label className="label text-[10px]">{pGroup.policyType === 'Health' ? 'Premium (₹)' : 'Premium (₹)'}</label>
                                    <input
                                      type="number"
                                      className="input w-full mt-1 text-xs"
                                      placeholder="Premium"
                                      value={entry.premium}
                                      onChange={e => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: pg.entries.map((en: any, ei: number) => ei === eIdx ? { ...en, premium: e.target.value } : en) } : pg))}
                                    />
                                  </div>
                                  <div>
                                    <label className="label text-[10px]">{pGroup.policyType === 'Health' ? 'Sum Insured (₹)' : 'Sum Assured (₹)'}</label>
                                    <select
                                      className="input w-full mt-1 text-xs bg-white"
                                      value={pGroup.policyType === 'Health' ? entry.sumInsured : entry.sumAssured}
                                      onChange={e => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: pg.entries.map((en: any, ei: number) => ei === eIdx ? { ...en, [pGroup.policyType === 'Health' ? 'sumInsured' : 'sumAssured']: e.target.value } : en) } : pg))}
                                    >
                                      <option value="">Select Sum Insured</option>
                                      {SUM_INSURED_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="label text-[10px]">Deductible (₹) <span className="text-red-500">*</span></label>
                                    <input
                                      type="number"
                                      step="any"
                                      required
                                      className="input w-full mt-1 text-xs"
                                      placeholder="Enter deductible"
                                      value={entry.deductible || ''}
                                      onChange={e => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: pg.entries.map((en: any, ei: number) => ei === eIdx ? { ...en, deductible: e.target.value } : en) } : pg))}
                                    />
                                  </div>
                                  <div>
                                    <label className="label text-[10px]">Riders / Add-ons</label>
                                    <select
                                      className="input w-full mt-1 text-xs bg-white"
                                      value={entry.riders || ''}
                                      onChange={e => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: pg.entries.map((en: any, ei: number) => ei === eIdx ? { ...en, riders: e.target.value } : en) } : pg))}
                                    >
                                      <option value="">Select Rider / Add-on</option>
                                      {RIDER_OPTIONS.map(r => (
                                        <option key={r} value={r}>{r}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="label text-[10px]">Policy Tenure</label>
                                    <input
                                      type="text"
                                      className="input w-full mt-1 text-xs"
                                      placeholder="e.g. 1 Year"
                                      value={entry.duration || ''}
                                      onChange={e => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: pg.entries.map((en: any, ei: number) => ei === eIdx ? { ...en, duration: e.target.value } : en) } : pg))}
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                            {!editContactId && (
                              <button
                                type="button"
                                onClick={() => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: [...pg.entries, { company: '', planName: '', policyNo: '', startDate: '', duration: '1 Year', endDate: '', premium: '', sumInsured: '', deductible: '', sumAssured: '', maturityDate: '', paymentTerm: '', entryType: 'New' }] } : pg))}
                                className="w-full py-2 border border-dashed border-slate-300 hover:border-slate-400 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-700 bg-white"
                              >
                                + Add Entry
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </fieldset>
              </div>
            )}

            {activeLeadTab === 'WA Campaign' && (
              <div className="space-y-4">
                {editContactId && (
                  <div className="bg-slate-50 border border-slate-200 text-slate-500 px-3.5 py-2.5 rounded-xl text-xs font-bold mb-4 shadow-2xs">
                    <span>Contact campaigns are read-only. Edit them in the Contacts module.</span>
                  </div>
                )}
                <div>
                  <h3 className="text-xs font-semibold text-gray-800">Select Campaigns</h3>
                  <p className="text-[11px] text-gray-500 mt-1">Choose which WhatsApp campaigns this lead should be part of:</p>
                </div>
                <fieldset disabled={!!editContactId} className="space-y-2 mt-3">
                  {[
                    'Health Awareness',
                    'New Year Offer',
                    'Pension Plan',
                    'Monsoon Safety',
                    'Term Insurance Promo',
                    'Family Health Package'
                  ].map((campaign) => (
                    <label
                      key={campaign}
                      className="flex flex-wrap items-center gap-3 p-3 bg-gray-50/50 border border-gray-150 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedCampaigns.includes(campaign)}
                        onChange={() => {
                          setSelectedCampaigns(prev =>
                            prev.includes(campaign) ? prev.filter(c => c !== campaign) : [...prev, campaign]
                          );
                        }}
                      />
                      <span className="text-xs font-semibold text-gray-700">{campaign}</span>
                    </label>
                  ))}
                </fieldset>
              </div>
            )}

            {activeLeadTab === 'History' && (
              <div className="space-y-4">
                {/* Tab Header */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      <History size={13} />
                    </div>
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      Contact & Family History Log
                    </h3>
                  </div>
                  <span className="text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-0.5 rounded-full">
                    {familyMembers.length} Family {familyMembers.length === 1 ? 'Member' : 'Members'}
                  </span>
                </div>

                <div className="max-h-[420px] overflow-y-auto pr-1 custom-scrollbar space-y-4">
                  {/* 1. Personal Details Log Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          <UserCircle2 size={13} />
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          Personal Information Log
                        </h4>
                      </div>
                      <span className="text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-md">
                        Active Contact
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100/80 space-y-0.5">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Name</span>
                        <p className="font-bold text-slate-800">
                          {(personalFields.firstName || personalFields.middleName || personalFields.lastName) ? `${personalFields.firstName} ${personalFields.middleName} ${personalFields.lastName}`.trim() : (loadedContact ? `${loadedContact.firstName || ''} ${loadedContact.middleName || ''} ${loadedContact.lastName || ''}`.trim() : 'Not provided')}
                        </p>
                      </div>

                      <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100/80 space-y-0.5">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Mobile & Email</span>
                        <p className="font-semibold text-slate-700">
                          {watch('phone') || (loadedContact?.phone) || 'No phone'}
                          {(watch('email') || loadedContact?.email) ? ` · ${watch('email') || loadedContact?.email}` : ''}
                        </p>
                      </div>

                      <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100/80 space-y-0.5">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Date of Birth & Gender</span>
                        <p className="font-semibold text-slate-700">
                          {(watch as any)('dob') || loadedContact?.dob || 'DOB not set'}
                          {(watch('gender') || loadedContact?.gender) ? ` · ${watch('gender') || loadedContact?.gender}` : ''}
                        </p>
                      </div>

                      <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100/80 space-y-0.5">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Occupation & Marital Status</span>
                        <p className="font-semibold text-slate-700">
                          {(watch as any)('occupation') || loadedContact?.occupation || 'Not specified'}
                          {((watch as any)('maritalStatus') || loadedContact?.maritalStatus) ? ` · ${watch('maritalStatus' as any) || loadedContact?.maritalStatus}` : ''}
                        </p>
                      </div>
                    </div>

                    {((watch as any)('address') || loadedContact?.address) && (
                      <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100/80 text-xs space-y-0.5">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Address Details</span>
                        <p className="text-slate-700 font-medium">{(watch as any)('address') || loadedContact?.address}</p>
                      </div>
                    )}
                  </div>

                  {/* 2. Family Members Created & Linked Log Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <Users size={13} />
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          Family Members Created ({familyMembers.length})
                        </h4>
                      </div>
                      {familyMembers.length > 0 && (
                        <span className="text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-md">
                          {familyMembers.length} {familyMembers.length === 1 ? 'Member Created' : 'Members Created'}
                        </span>
                      )}
                    </div>

                    {familyMembers.length === 0 ? (
                      <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                        <p className="text-xs text-slate-400 font-medium italic">No family members created for this contact yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {familyMembers.map((member, idx) => (
                          <div key={idx} className="bg-slate-50/80 rounded-xl border border-slate-200/70 p-3 space-y-2 text-xs hover:border-blue-200 transition-all">
                            <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-extrabold flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <span className="font-extrabold text-slate-800 text-xs">
                                  {member.name || `Family Member #${idx + 1}`}
                                </span>
                              </div>
                              {member.relation && (
                                <span className="text-[10px] font-extrabold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">
                                  {member.relation}
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                              <div>
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase block">Date of Birth / Phone</span>
                                <p className="font-semibold text-slate-700">
                                  {member.dob || 'DOB not set'} {member.whatsapp ? ` · ${member.whatsapp}` : ''}
                                </p>
                              </div>
                              <div>
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase block">Occupation & Education</span>
                                <p className="font-semibold text-slate-700">
                                  {member.occupation || 'Not set'} {member.education ? ` · ${member.education}` : ''}
                                </p>
                              </div>
                            </div>

                            {member.medicalHistory && member.medicalHistory.length > 0 && (
                              <div className="pt-1">
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase block mb-1">Medical History Tags</span>
                                <div className="flex flex-wrap gap-1">
                                  {member.medicalHistory.map((tag: any, ti: number) => (
                                    <span key={ti} className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3. Particular Contact Audit Log Card */}
                  {loadedContact && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2">
                        <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                          <Calendar size={13} />
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          Contact Record Audit Log
                        </h4>
                      </div>
                      <div className="space-y-1.5 pt-1 text-[11px]">
                        {loadedContact.createdAt && (
                          <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="text-slate-500 font-medium">Record Created Date</span>
                            <span className="font-bold text-slate-700">
                              {new Date(loadedContact.createdAt).toLocaleString()}
                            </span>
                          </div>
                        )}
                        {loadedContact.updatedAt && (
                          <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="text-slate-500 font-medium">Last Modified Date</span>
                            <span className="font-bold text-slate-700">
                              {new Date(loadedContact.updatedAt).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Lead" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Delete Lead for <strong>{deleteTarget?.contact?.firstName} {deleteTarget?.contact?.lastName}</strong>?
        </p>
        <div className="flex flex-wrap justify-end gap-2">
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
        actions={
          detailOpen ? (
            <button
              onClick={() => detailSaveHandlerRef.current?.()}
              disabled={detailIsSavingRef.current}
              className="btn-primary text-xs px-3 py-1.5 h-auto flex flex-nowrap items-center gap-1.5 font-bold shadow-2xs shrink-0"
            >
              {detailIsSavingRef.current ? <RefreshCw size={12} className="animate-spin shrink-0" /> : <Save size={12} className="shrink-0" />}
              Save Lead Details
            </button>
          ) : undefined
        }
      >
        {detailTarget && (
          <LeadDetailPopup
            lead={detailTarget}
            tab={detailTab}
            onTabChange={setDetailTab}
            employees={employeesList}
            isOwner={isOwner}
            onEdit={() => { setDetailOpen(false); openEdit(detailTarget); }}
            onTriggerPolicyCreation={triggerPolicyCreationForLead}
            saveHandlerRef={detailSaveHandlerRef}
            isSavingRef={detailIsSavingRef}
          />
        )}
      </Modal>

      {/* Issue Policy on Move to Process Completed Modal */}
      <Modal
        open={policyModalOpen}
        onClose={() => setPolicyModalOpen(false)}
        title="Add New Policy"
        subtitle="Pre-fill details from lead to create a new policy."
        size="xl"
      >
        <form onSubmit={handleSubmitPolicy(handlePolicyFormSubmit)} className="space-y-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Customer (Read-only display) */}
            <div className="col-span-2 flex flex-col gap-1 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-extrabold">Customer Details</label>
              <div className="flex flex-wrap items-center gap-3 mt-1.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                  {policyLead?.contact?.firstName?.[0] || 'C'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {policyLead?.contact?.firstName} {policyLead?.contact?.lastName}
                  </p>
                  <p className="text-xs text-slate-500 font-medium font-medium">
                    {policyLead?.contact?.email || 'No email'} · {policyLead?.contact?.phone || 'No phone'}
                  </p>
                </div>
              </div>
            </div>

            {/* Policy Number */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Policy Number *</label>
              <input
                type="text"
                {...registerPolicy('policyNumber', { required: true })}
                placeholder="Enter policy number..."
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                required
              />
            </div>

            {/* Policy Type (Select category) */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Policy Type *</label>
              <select
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                value={policySelectedType}
                onChange={e => {
                  setPolicySelectedType(e.target.value);
                  setPolicySelectedCompany('');
                  setPolicySelectedPlanId('');
                }}
                required
              >
                <option value="">Select Type</option>
                {availableTypes.map(t => (
                  <option key={t} value={t}>{t === 'HEALTH' ? 'Health Insurance' : t === 'LIFE' ? 'Life Insurance' : t}</option>
                ))}
              </select>
            </div>

            {/* Insurance Company Category */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Insurance Company Category *</label>
              <select
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                value={policySelectedCompany}
                onChange={e => {
                  setPolicySelectedCompany(e.target.value);
                  setPolicySelectedPlanId('');
                }}
                required
              >
                <option value="">Select Insurance Company Category *</option>
                {availableCompanies.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Insurance Plan */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Insurance Plan Category *</label>
              <select
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                value={policySelectedPlanId}
                onChange={e => setPolicySelectedPlanId(e.target.value)}
                required
              >
                <option value="">Select Plan Category *</option>
                {availablePlans.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Sum Assured */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Sum Assured *</label>
              <select
                {...registerPolicy('sumAssured', { required: true })}
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                required
              >
                <option value="">Select Sum Assured</option>
                {SUM_INSURED_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Deductible */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Deductible *</label>
              <input
                type="number"
                step="any"
                {...registerPolicy('deductible', { required: true })}
                placeholder="Enter deductible amount..."
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                required
              />
            </div>

            {/* Riders / Add-ons */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Riders / Add-ons</label>
              <select
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                {...registerPolicy('riders')}
              >
                <option value="">Select Rider / Add-on</option>
                {RIDER_OPTIONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Premium Amount */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Premium Amount *</label>
              <input
                type="number"
                step="any"
                {...registerPolicy('premiumAmount', { required: true })}
                placeholder="Enter premium amount..."
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                required
              />
            </div>

            {/* Start Date */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Start Date *</label>
              <DatePicker
                {...registerPolicy('startDate', { required: true })}
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                required
              />
            </div>

            {/* End Date */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">End Date *</label>
              <DatePicker
                {...registerPolicy('endDate', { required: true })}
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                required
              />
            </div>

            {/* Payment Frequency */}
            <div className="flex flex-col gap-1 col-span-2">
              <label className="label">Payment Frequency *</label>
              <select
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                {...registerPolicy('paymentFrequency', { required: true })}
                required
              >
                <option value="YEARLY">Yearly</option>
                <option value="HALF_YEARLY">Half Yearly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="SINGLE">Single</option>
              </select>
            </div>

            {/* Downpayment Amount */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Downpayment Amount</label>
              <input
                type="number"
                step="any"
                {...registerPolicy('downpaymentAmount')}
                placeholder="Enter downpayment amount..."
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
              />
            </div>

            {/* Processing Fee */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Processing Fee</label>
              <input
                type="number"
                step="any"
                {...registerPolicy('processingFee')}
                placeholder="Enter processing fee..."
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
              />
            </div>

            {/* Policy Tenure */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Policy Tenure</label>
              <input
                type="text"
                {...registerPolicy('policyTenure', {
                  onChange: (e: any) => {
                    const val = e.target.value;
                    if (watchPolicyStartDate && val) {
                      const newEnd = calculateEndDateFromTenure(watchPolicyStartDate, val);
                      if (newEnd) setPolicyValue('endDate', newEnd);
                    }
                  }
                })}
                placeholder="e.g. 1 Year, 11 Months..."
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
              />
            </div>

            {/* Installment Case Toggle */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Installment Case?</label>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setPolicyValue('isInstallment', true)}
                  className={clsx(
                    'px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer',
                    watchPolicyIsInstallment
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  )}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setPolicyValue('isInstallment', false)}
                  className={clsx(
                    'px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer',
                    !watchPolicyIsInstallment
                      ? 'bg-slate-700 text-white border-slate-700 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  )}
                >
                  No
                </button>
              </div>
            </div>

            {watchPolicyIsInstallment && (
              <>
                {/* Installment Amount */}
                <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
                  <label className="label">Installment Amount</label>
                  <input
                    type="number"
                    step="any"
                    {...registerPolicy('installmentAmount')}
                    placeholder="Enter installment amount..."
                    className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                  />
                </div>

                {/* Installment Date */}
                <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
                  <label className="label">Installment Date</label>
                  <DatePicker
                    {...registerPolicy('installmentDate')}
                    className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                  />
                </div>
              </>
            )}

            {/* Loan Provider */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Loan Provider</label>
              <input
                type="text"
                {...registerPolicy('loanProvider')}
                placeholder="Enter loan provider name..."
                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
              />
            </div>

            {/* Account Type */}
            <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
              <label className="label">Account Type</label>
              <select
                className="input h-10 text-xs rounded-xl bg-white border border-slate-200"
                {...registerPolicy('accountType')}
              >
                <option value="">Select Account Type</option>
                <option value="Saving">Saving</option>
                <option value="Current">Current</option>
                <option value="NRE">NRE</option>
                <option value="NRI">NRI</option>
              </select>
            </div>

            {/* Comment */}
            <div className="flex flex-col gap-1 col-span-2">
              <label className="label">Comment *</label>
              <textarea
                {...registerPolicy('comment', { required: true })}
                rows={3}
                placeholder="Add any comments or notes about this policy..."
                className="input w-full text-xs rounded-xl bg-white border border-slate-200 resize-none py-2.5"
                required
              />
            </div>

          </div>

          <div className="flex flex-wrap justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer transition-all"
              onClick={() => setPolicyModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 sm:px-5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl cursor-pointer shadow-md shadow-blue-500/20 transition-all hover:scale-105"
            >
              Add Policy
            </button>
          </div>
        </form>
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
  const formattedDate = card.createdAt ? format(new Date(card.createdAt), 'dd/MMM/yyyy') : '';
  const followUp = card.followUpDate ? format(new Date(card.followUpDate), 'dd/MMM/yyyy') : null;
  const assigneeName = card.assignedEmployee?.employeeProfile
    ? `${card.assignedEmployee.employeeProfile.firstName} ${card.assignedEmployee.employeeProfile.lastName}`
    : card.assignedEmployee?.name || 'Unassigned';
  const initials = `${card.contact?.firstName?.[0] ?? ''}${card.contact?.lastName?.[0] ?? ''}`.toUpperCase() || 'LD';
  const hotness = deriveHotness(card);
  const hotnessConf = HOTNESS_CONFIG[hotness];

  const AVATAR_BG: Record<string, string> = {
    TO_CONTACT: 'bg-blue-500', CONTACTED: 'bg-indigo-500', PROPOSAL_SENT: 'bg-purple-500',
    LOGIN_PROGRESS: 'bg-orange-500', PAYMENT_DONE: 'bg-green-500', PROCESS_COMPLETED: 'bg-emerald-500',
  };
  const BORDER_TOP: Record<string, string> = {
    TO_CONTACT: 'border-t-4 border-t-blue-500', CONTACTED: 'border-t-4 border-t-indigo-500',
    PROPOSAL_SENT: 'border-t-4 border-t-purple-500', LOGIN_PROGRESS: 'border-t-4 border-t-orange-500',
    PAYMENT_DONE: 'border-t-4 border-t-green-500', PROCESS_COMPLETED: 'border-t-4 border-t-emerald-500',
  };
  const SHADOW_HOVER: Record<string, string> = {
    TO_CONTACT: 'hover:shadow-md hover:shadow-blue-500/10 hover:border-blue-400',
    CONTACTED: 'hover:shadow-md hover:shadow-indigo-500/10 hover:border-indigo-400',
    PROPOSAL_SENT: 'hover:shadow-md hover:shadow-purple-500/10 hover:border-purple-400',
    LOGIN_PROGRESS: 'hover:shadow-md hover:shadow-orange-500/10 hover:border-orange-400',
    PAYMENT_DONE: 'hover:shadow-md hover:shadow-green-500/10 hover:border-green-400',
    PROCESS_COMPLETED: 'hover:shadow-md hover:shadow-emerald-500/10 hover:border-emerald-400',
  };
  const RING_COLOR: Record<string, string> = {
    TO_CONTACT: 'ring-blue-500/20', CONTACTED: 'ring-indigo-500/20', PROPOSAL_SENT: 'ring-purple-500/20',
    LOGIN_PROGRESS: 'ring-orange-500/20', PAYMENT_DONE: 'ring-green-500/20', PROCESS_COMPLETED: 'ring-emerald-500/20',
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
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className={clsx('h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm ring-4',
            AVATAR_BG[card.stage] ?? 'bg-slate-500', RING_COLOR[card.stage] ?? 'ring-slate-500/20')}>
            {initials}
          </div>
          <span className={clsx('flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[9px] font-bold', hotnessConf.cls)}>
            <HotnessIcon level={hotness} /> {hotnessConf.label}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white pl-1.5" onClick={e => e.stopPropagation()}>
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
          <div className="flex flex-wrap items-center gap-2">
            <Phone size={12} className="text-slate-500 shrink-0" />
            <span className="truncate">{card.contact.phone}</span>
          </div>
        )}
        {card.contact?.email && (
          <div className="flex flex-wrap items-center gap-2">
            <Mail size={12} className="text-slate-500 shrink-0" />
            <span className="truncate">{card.contact.email}</span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <Shield size={12} className="text-slate-500 shrink-0" />
          <span className="truncate font-semibold text-slate-800">{card.plan?.name || (card.interests && card.interests.length > 0 ? card.interests.join(', ') : 'No Product')}</span>
        </div>

        {/* Expected Premium in Card View */}
        <div className="flex items-center justify-between bg-emerald-50/80 border border-emerald-200/80 rounded-lg px-2.5 py-1 text-xs font-semibold text-emerald-900 mt-1">
          <span className="text-[11px] text-emerald-700 font-medium">Expected Premium</span>
          <span className="font-bold text-emerald-800 text-xs">
            ₹{Number(card.premiumBudget || card.expectedPremium || 0).toLocaleString('en-IN')}
          </span>
        </div>

        {followUp && (
          <div className="flex flex-wrap items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200/60 rounded px-2 py-0.5 w-fit font-bold mt-1">
            <Calendar size={10} className="shrink-0 text-amber-600" />
            <span>Follow-up: {followUp}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-0.5 gap-2" onClick={e => e.stopPropagation()}>
        <div className="flex flex-wrap items-center gap-1 text-slate-500 text-[9px] font-semibold truncate">
          <UserCircle2 size={10} className="text-slate-400 shrink-0" />
          <span className="truncate">{assigneeName}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
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
      render: (r: any) => {
        const prodName = r.plan?.name || (r.interests && r.interests.length > 0 ? r.interests.join(', ') : '—');
        const prodCat = r.plan?.category || '';
        return (
          <div>
            <p className="text-[13px] font-medium text-gray-800">{prodName}</p>
            {prodCat && <p className="text-[11px] text-gray-400">{prodCat}</p>}
          </div>
        );
      },
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
          <div className="flex flex-wrap items-center gap-1.5">
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
        <div className="flex flex-wrap items-center gap-1.5" onClick={e => e.stopPropagation()}>
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
                  className={clsx('px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap select-none border border-slate-200',
                    sortableKeys.includes(col.key) && 'cursor-pointer hover:text-slate-900')}>
                  <span className="inline-flex flex-wrap items-center gap-1">
                    {col.label}
                    {sortableKeys.includes(col.key) && (
                      <span className="text-slate-400">
                        {sortKey === col.key
                          ? sortDir === 'asc' ? <ChevronUp size={13} className="text-slate-900 stroke-[3]" /> : <ChevronDown size={13} className="text-slate-900 stroke-[3]" />
                          : <ChevronUp size={13} className="text-slate-500 stroke-[2.5]" />}
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
                    <td key={col.key} className="px-5 py-4 border border-slate-200">
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
                : data.map((row, idx) => (
                  <tr key={row.id} onClick={() => onRowClick(row)}
                    className={clsx("cursor-pointer transition-colors duration-150", idx % 2 === 1 ? 'bg-slate-50/80' : 'bg-white')}>
                    {activeCols.map(col => (
                      <td key={col.key} className="px-5 py-3.5 text-gray-700 align-middle text-[13px] font-medium border border-slate-200">
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
function LeadDetailPopup({ lead, tab, onTabChange, employees, isOwner, onEdit, onTriggerPolicyCreation, saveHandlerRef, isSavingRef }: {
  lead: any;
  tab: 'overview' | 'comments' | 'history';
  onTabChange: (t: 'overview' | 'comments' | 'history') => void;
  employees: any[];
  isOwner: boolean;
  onEdit: () => void;
  onTriggerPolicyCreation?: (lead: any) => void;
  saveHandlerRef?: React.MutableRefObject<(() => void) | null>;
  isSavingRef?: React.MutableRefObject<boolean>;
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
  const contactId = fullLead?.contact?.id || lead?.contact?.id || lead?.contactId;
  const { data: contactData } = useQuery({
    queryKey: ['contact-lead-popup', contactId],
    queryFn: () => contactsService.get(contactId!),
    enabled: !!contactId,
  });
  const consultations: any[] = fullLead.consultations ?? [];

  const initialNotes = parseLeadNotes(fullLead.notes);
  const [editStage, setEditStage] = useState(fullLead.stage || 'TO_CONTACT');
  const [editStatus, setEditStatus] = useState(initialNotes.leadStatus || fullLead.status || 'Interested');
  const [editType, setEditType] = useState(initialNotes.leadType || fullLead.type || 'Fresh');
  const [editSource, setEditSource] = useState(fullLead.source || 'Walk-in');
  const [editAssignee, setEditAssignee] = useState(fullLead.assignedEmployeeId ?? '');
  const [editFollowUp, setEditFollowUp] = useState(fullLead.followUpDate ? fullLead.followUpDate.slice(0, 10) : '');
  const [editPremium, setEditPremium] = useState<string | number>(fullLead.premiumBudget || fullLead.expectedPremium || '');
  const [savingLeadDetails, setSavingLeadDetails] = useState(false);

  useEffect(() => {
    if (fullLead) {
      const parsed = parseLeadNotes(fullLead.notes);
      setEditStage(fullLead.stage || 'TO_CONTACT');
      setEditStatus(parsed.leadStatus || fullLead.status || 'Interested');
      setEditType(parsed.leadType || fullLead.type || 'Fresh');
      setEditSource(fullLead.source || 'Walk-in');
      setEditAssignee(fullLead.assignedEmployeeId ?? '');
      setEditFollowUp(fullLead.followUpDate ? fullLead.followUpDate.slice(0, 10) : '');
      setEditPremium(fullLead.premiumBudget || fullLead.expectedPremium || '');
    }
  }, [fullLead]);

  // Expose save handler to parent so it can render the button in the modal header
  useEffect(() => {
    if (saveHandlerRef) saveHandlerRef.current = () => handleUpdateLeadDetails();
    if (isSavingRef) isSavingRef.current = savingLeadDetails;
  });

  const handleUpdateLeadDetails = async (overrides?: Record<string, any>) => {
    setSavingLeadDetails(true);
    try {
      const currentParsed = parseLeadNotes(fullLead.notes);
      const newParsedNotes = {
        ...currentParsed,
        leadStatus: overrides?.status ?? editStatus,
        leadType: overrides?.type ?? editType,
      };

      const payload: any = {
        stage: overrides?.stage ?? editStage,
        source: overrides?.source ?? editSource,
        assignedEmployeeId: (overrides?.assignee !== undefined ? overrides.assignee : editAssignee) || null,
        followUpDate: (overrides?.followUp !== undefined ? overrides.followUp : editFollowUp) || null,
        premiumBudget: Number(overrides?.premium ?? editPremium) || 0,
        notes: JSON.stringify(newParsedNotes),
      };

      await leadsService.update(lead.id, payload);
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead-detail-popup', lead.id] });
      toast.success('Lead details updated');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update lead details');
    } finally {
      setSavingLeadDetails(false);
    }
  };

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
    if (newStage === 'PROCESS_COMPLETED') {
      if (onTriggerPolicyCreation) {
        onTriggerPolicyCreation(fullLead || lead);
        return;
      }
    }
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

  const tabs: { id: 'overview' | 'comments' | 'history'; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'comments', label: `Consultation Comments (${consultations.length})` },
    { id: 'history', label: 'History' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-xl p-4 border border-slate-100">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-bold">
            {c?.firstName?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">{c?.firstName} {c?.lastName}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1 flex-wrap">
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
        <button onClick={onEdit} className="btn-secondary text-[10px] sm:text-xs flex flex-wrap items-center gap-1">
          <Pencil size={12} /> Contact
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

      {/* Fixed height tab content container so popup size remains constant when switching tabs */}
      <div className="h-[400px] min-h-[400px] max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
        {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Non-Editable Product Interest Data Cards */}
          {(() => {
            const backendInterests: any[] = contactData?.data?.productInterests || [];
            
            // Find specific matching backend product interest for this lead (by ID or plan category/interest match), fallback to fullLead
            const leadInterests = fullLead.interests && fullLead.interests.length > 0
              ? fullLead.interests
              : [fullLead.plan?.name || fullLead.plan?.category].filter(Boolean);

            const matchedBackendInterest = backendInterests.find((pi: any) => {
              if (pi.id && fullLead.id && pi.id === fullLead.id) return true;
              if (pi.productInterestId && fullLead.id && pi.productInterestId === fullLead.id) return true;
              if (pi.planId && fullLead.planId && pi.planId === fullLead.planId) return true;
              const piInterests: string[] = pi.interests && pi.interests.length > 0
                ? pi.interests
                : [pi.plan?.name || pi.plan?.category].filter(Boolean);
              return piInterests.some(i => leadInterests.includes(i));
            });

            const allProductInterestsList = matchedBackendInterest ? [matchedBackendInterest] : [fullLead];

            return (
              <div className="space-y-3">
                {allProductInterestsList.map((pi: any, idx: number) => {
                  const parsedNotes = parseLeadNotes(pi.notes);
                  const interestsList: string[] = pi.interests && pi.interests.length > 0
                    ? pi.interests
                    : [pi.plan?.name || pi.plan?.category || 'Health'];
                  const premium = pi.premiumBudget || pi.expectedPremium || 0;
                  const sumAssured = pi.sumAssuredRequired || pi.sumAssured || 0;
                  const planName = pi.plan?.name;
                  const companyName = pi.plan?.company?.name;

                  return (
                    <div key={pi.id || idx} className="bg-gradient-to-br from-blue-50/90 via-slate-50 to-indigo-50/50 border border-blue-200/80 rounded-2xl p-4 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-blue-100/80 pb-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-2xs text-xs">
                            <Shield size={15} />
                          </div>
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">Product Interest {allProductInterestsList.length > 1 ? `#${idx + 1}` : ''}</span>
                            <h4 className="text-xs font-extrabold text-slate-800">Selected Product Interest Details</h4>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {pi.stage && (
                            <span className={clsx('text-[9px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider', BADGE_STYLES[pi.stage] ?? 'bg-gray-100 text-gray-700 border-gray-200')}>
                              {STAGE_LABELS[pi.stage] ?? pi.stage}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-slate-200/80 text-slate-600 border border-slate-300/60 flex flex-wrap items-center gap-1">
                            <Lock size={9} className="text-slate-500" /> Non-Editable
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        <div className="bg-white/90 rounded-xl p-3 border border-slate-200/80 shadow-2xs">
                          <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Selected Product(s)</span>
                          <div className="flex flex-wrap gap-1.5 mt-0.5">
                            {interestsList.map((prod: string, i: number) => (
                              <span key={i} className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-blue-600 text-white shadow-2xs">
                                ✓ {prod}
                              </span>
                            ))}
                          </div>
                        </div>


                        <div className="bg-white/90 rounded-xl p-3 border border-slate-200/80 shadow-2xs">
                          <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Lead Source</span>
                          <p className="font-bold text-slate-700 mt-0.5">
                            {pi.source || fullLead.source || 'Walk-in'}
                          </p>
                        </div>
                      </div>

                      {parsedNotes.descriptionDetails && (
                        <div className="bg-white/90 rounded-xl p-3 border border-slate-200/80 shadow-2xs text-xs space-y-1">
                          <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider block">Requirements / Description Notes</span>
                          <p className="text-slate-700 font-medium text-[11px] leading-relaxed whitespace-pre-wrap">
                            {parsedNotes.descriptionDetails}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
          {(() => {
            const parsedLeadNotes = parseLeadNotes(fullLead.notes);
            const connectedPolicyData = fullLead.connectedPolicy;
            const isRenewalLead = parsedLeadNotes.leadType === 'RENEWAL' || fullLead.source === 'Renewal';
            if (!isRenewalLead) return null;

            const policyType = connectedPolicyData?.plan?.category || fullLead.plan?.category || (fullLead.interests && fullLead.interests.length > 0 ? fullLead.interests.join(', ') : '—');

            return (
              <div className="bg-gradient-to-br from-amber-50/90 to-orange-50/70 border border-amber-200/90 rounded-2xl p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                      <Shield size={16} />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 block">Renewal Created Against</span>
                      <h4 className="text-sm font-extrabold text-slate-800">
                        Policy #{connectedPolicyData?.policyNumber || parsedLeadNotes.policyNumber || 'N/A'}
                      </h4>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-purple-700 border border-purple-200">
                    Renewal Lead
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/80 rounded-xl p-2.5 border border-amber-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Policy Type</span>
                    <p className="font-bold text-slate-700 mt-0.5 uppercase tracking-wide">
                      {policyType}
                    </p>
                  </div>

                  <div className="bg-white/80 rounded-xl p-2.5 border border-amber-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Expiry / End Date</span>
                    <p className="font-bold text-rose-600 mt-0.5 flex flex-wrap items-center gap-1">
                      <Calendar size={12} />
                      {connectedPolicyData?.endDate ? new Date(connectedPolicyData.endDate).toLocaleDateString('en-IN') : (parsedLeadNotes.endDate ? new Date(parsedLeadNotes.endDate).toLocaleDateString('en-IN') : '—')}
                    </p>
                  </div>

                  <div className="bg-white/80 rounded-xl p-2.5 border border-amber-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Company & Plan Name</span>
                    <p className="font-bold text-slate-700 mt-0.5 truncate">
                      {connectedPolicyData?.plan?.company?.name || parsedLeadNotes.companyName || '—'}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500 truncate">
                      {connectedPolicyData?.plan?.name || parsedLeadNotes.planName || '—'}
                    </p>
                  </div>

                  <div className="bg-white/80 rounded-xl p-2.5 border border-amber-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Premium & Sum Insured</span>
                    <p className="font-bold text-emerald-700 mt-0.5">
                      Premium: ₹{Number(connectedPolicyData?.premiumAmount || parsedLeadNotes.premiumAmount || fullLead.premiumBudget || 0).toLocaleString('en-IN')}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-600">
                      Sum Insured: ₹{Number(connectedPolicyData?.sumAssured || parsedLeadNotes.sumAssured || fullLead.sumAssuredRequired || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
          {/* Directly Editable Lead Management Details */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-3.5 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2">
                <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs shrink-0">
                  <Pencil size={14} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Lead Information & Status</h4>
                  <p className="text-[10px] text-slate-400">Directly editable fields for this lead</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Lead Stage */}
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Lead Stage <span className="text-red-500">*</span></label>
                <select
                  value={editStage}
                  onChange={e => setEditStage(e.target.value)}
                  className="input text-xs font-semibold bg-slate-50/50 border-slate-200 focus:bg-white"
                >
                  {UI_STAGES.map(s => {
                    const key = STAGE_MAPPINGS[s];
                    return <option key={key} value={key}>{s}</option>;
                  })}
                </select>
              </div>

              {/* Lead Status */}
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Lead Status <span className="text-red-500">*</span></label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  className="input text-xs font-semibold bg-slate-50/50 border-slate-200 focus:bg-white"
                >
                  <option value="Interested">Interested</option>
                  <option value="Hot">Hot</option>
                  <option value="Warm">Warm</option>
                  <option value="Cold">Cold</option>
                  <option value="Follow Up">Follow Up</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

              {/* Lead Type */}
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Lead Type <span className="text-red-500">*</span></label>
                <select
                  value={editType}
                  onChange={e => setEditType(e.target.value)}
                  className="input text-xs font-semibold bg-slate-50/50 border-slate-200 focus:bg-white"
                >
                  <option value="Fresh">Fresh</option>
                  <option value="Renewal">Renewal</option>
                  <option value="Porting">Porting</option>
                </select>
              </div>

              {/* Lead Source */}
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Lead Source <span className="text-red-500">*</span></label>
                <select
                  value={editSource}
                  onChange={e => setEditSource(e.target.value)}
                  className="input text-xs font-semibold bg-slate-50/50 border-slate-200 focus:bg-white"
                >
                  <option value="Walk-in">Walk-in</option>
                  <option value="Referral">Referral</option>
                  <option value="Website">Website</option>
                  <option value="Cold Call">Cold Call</option>
                  <option value="Campaign">Campaign</option>
                  <option value="Social Media">Social Media</option>
                  <option value="Partner">Partner</option>
                  <option value="Existing Client">Existing Client</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Assigned Employee */}
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Assigned Employee</label>
                <select
                  value={editAssignee}
                  onChange={e => setEditAssignee(e.target.value)}
                  className="input text-xs font-semibold bg-slate-50/50 border-slate-200 focus:bg-white"
                >
                  <option value="">Unassigned</option>
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.userId || emp.id}>
                      {emp.firstName || emp.employeeProfile?.firstName} {emp.lastName || emp.employeeProfile?.lastName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Follow-up Date */}
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Follow-up Date *</label>
                <DatePicker
                  value={editFollowUp}
                  onChange={setEditFollowUp}
                  className="input text-xs bg-slate-50/50 border-slate-200 focus:bg-white"
                />
              </div>

              {/* Expected Premium / Budget */}
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Expected Premium / Budget (₹) *</label>
                <input
                  type="number"
                  value={editPremium}
                  onChange={e => setEditPremium(e.target.value)}
                  placeholder="e.g. 12000"
                  className="input text-xs font-bold text-emerald-700 bg-slate-50/50 border-slate-200 focus:bg-white"
                />
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Consultation Comments */}
      {tab === 'comments' && (
        <div className="space-y-3">
          <div className="bg-white border border-slate-200/80 rounded-xl p-3 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 block">Add Call Summary / Comment</label>
              <span className="text-[10px] text-slate-400 font-medium">Press Ctrl+Enter to save</span>
            </div>
            <div className="flex gap-2">
              <textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Add Call Summary / Comment..."
                className="input text-xs flex-1 resize-none bg-slate-50/50 border-slate-200 focus:bg-white"
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
                className="btn-primary px-3.5 self-end h-8 text-xs flex flex-wrap items-center gap-1 font-bold shadow-2xs"
              >
                {addConsultationMutation.isPending ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />} Save
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
            {consultations.length === 0 ? (
              <div className="text-center py-8 text-slate-400 bg-slate-50/60 border border-slate-200/60 rounded-xl p-4">
                <MessageCircle size={24} className="mx-auto mb-2 opacity-40 text-slate-400" />
                <p className="text-xs font-medium text-slate-500">No comments yet. Add the first summary below.</p>
              </div>
            ) : (
              [...consultations].reverse().map((c: any) => {
                const authorName = c.authorName || (c.author?.employeeProfile ? `${c.author.employeeProfile.firstName || ''} ${c.author.employeeProfile.lastName || ''}`.trim() : (c.author?.email || 'System'));
                return (
                  <div key={c.id} className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex flex-wrap items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                        {authorName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {c.createdAt ? format(new Date(c.createdAt), 'dd/MMM/yyyy, hh:mm a') : ''}
                      </span>
                    </div>
                    <p className="text-xs text-slate-800 leading-relaxed font-medium">{c.notes}</p>
                    {c.scheduledAt && (
                      <p className="text-[10px] text-amber-600 mt-1 flex flex-wrap items-center gap-1">
                        <Calendar size={10} /> Scheduled: {format(new Date(c.scheduledAt), 'dd/MMM/yyyy')}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Stage */}
      {tab === 'history' && (
        <div className="space-y-3 py-1">
          {/* Lead Audit Log */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2.5">
              <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <History size={13} />
              </div>
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Lead Activity Log</h4>
            </div>
            <div className="space-y-2 text-[11px]">
              {fullLead.createdAt && (
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-500 font-semibold flex items-center gap-1.5"><Calendar size={11} /> Lead Created</span>
                  <span className="font-bold text-slate-700">{new Date(fullLead.createdAt).toLocaleString('en-IN')}</span>
                </div>
              )}
              {fullLead.updatedAt && (
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-500 font-semibold flex items-center gap-1.5"><RefreshCw size={11} /> Last Updated</span>
                  <span className="font-bold text-slate-700">{new Date(fullLead.updatedAt).toLocaleString('en-IN')}</span>
                </div>
              )}
              {fullLead.stage && (
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-500 font-semibold">Current Stage</span>
                  <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider', BADGE_STYLES[fullLead.stage] ?? 'bg-gray-100 text-gray-700 border-gray-200')}>
                    {STAGE_LABELS[fullLead.stage] ?? fullLead.stage}
                  </span>
                </div>
              )}
              {fullLead.source && (
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-500 font-semibold">Lead Source</span>
                  <span className="font-bold text-slate-700">{fullLead.source}</span>
                </div>
              )}
              {(() => {
                const parsed = parseLeadNotes(fullLead.notes);
                return parsed.leadType ? (
                  <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-slate-500 font-semibold">Lead Type</span>
                    <span className="font-bold text-slate-700">{parsed.leadType}</span>
                  </div>
                ) : null;
              })()}
              {fullLead.followUpDate && (
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-500 font-semibold flex items-center gap-1.5"><Calendar size={11} /> Follow-up Date</span>
                  <span className="font-bold text-blue-700">{new Date(fullLead.followUpDate).toLocaleDateString('en-IN')}</span>
                </div>
              )}
              {assigneeName && assigneeName !== 'Unassigned' && (
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-500 font-semibold">Assigned To</span>
                  <span className="font-bold text-slate-700">{assigneeName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Consultation History */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <MessageCircle size={13} />
                </div>
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Consultation History</h4>
              </div>
              <span className="text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">
                {consultations.length} {consultations.length === 1 ? 'Entry' : 'Entries'}
              </span>
            </div>
            {consultations.length === 0 ? (
              <div className="py-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <MessageCircle size={20} className="mx-auto mb-1.5 text-slate-300" />
                <p className="text-xs text-slate-400 font-medium italic">No consultation entries yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {consultations.map((c: any, i: number) => (
                  <div key={c.id || i} className="bg-slate-50/80 rounded-xl border border-slate-200/70 p-3 text-[11px] space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-800 text-xs">{c.author || c.createdBy || 'Agent'}</span>
                      {c.createdAt && (
                        <span className="text-[10px] text-slate-400 font-medium shrink-0">
                          {new Date(c.createdAt).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                    {c.text && <p className="text-slate-600 font-medium leading-relaxed">{c.text}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
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
