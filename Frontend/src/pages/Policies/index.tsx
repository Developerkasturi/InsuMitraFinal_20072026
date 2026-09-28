import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Plus, X, User, Shield, Pencil, Trash2, Upload, Filter, Search, Info, Save, ChevronDown, Settings, CreditCard, Building, CheckCircle2, AlertTriangle, Users, Activity, FileText, FileCheck2, Clock, Download, MessageCircle, History } from 'lucide-react';
import EmiTrackingView, { MonthPickerDropdown } from './EmiTrackingView';
import PhcTrackingView from './PhcTrackingView';
import { usePolicies, useCreatePolicy, useUpdatePolicy, useDeletePolicy, useBulkAssignPolicies } from '@hooks/usePolicies';
import { useClaims, useCreateClaim } from '@hooks/useClaims';
import { sortData } from '../../utils/sortUtils';
import { formatIndianNumber } from '../../utils/numberUtils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsService, policiesService, employeesService, claimsService, documentsService, agencyDetailsService, insuranceService } from '@api/index';
import { deletionRequestsService } from '@api/deletionRequestsService';
import DataTable, { Column } from '@comps/common/DataTable';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, addYears } from 'date-fns';
import { DatePicker } from '@comps/common/DatePicker';
import CustomSelect from '@comps/common/CustomSelect';

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
import { getPolicyStatusDisplay, calculateLastInstallmentDate } from '../../utils/policyStatusUtils';

const DEFAULT_COMPANIES_BY_TYPE: Record<string, string[]> = {
  HEALTH: [
    'Star Health',
    'Niva Bupa',
    'Care',
    'Manipal Cigna',
    'HDFC Ergo',
    'ICICI Lombard',
    'Bajaj General',
    'TATA AIG',
    'HDFC ERGO General Insurance',
    'Star Health and Allied Insurance',
    'Star Health Insurance',
    'Care Health Insurance',
    'Niva Bupa Health Insurance',
    'ICICI Lombard General Insurance',
    'Manipal Cigna Health Insurance',
    'Bajaj Allianz General Insurance',
    'Tata AIG General Insurance',
    'Aditya Birla Health Insurance',
    'New India Assurance',
    'Oriental Insurance',
    'National Insurance',
    'United India Insurance',
  ],
  LIFE: [
    'HDFC Life',
    'ICICI Pru Life',
    'Bajaj Life',
    'TATA AIA',
    'Life Insurance Corporation of India (LIC)',
    'LIC of India',
    'HDFC Life Insurance',
    'ICICI Prudential Life Insurance',
    'SBI Life Insurance',
    'Tata AIA Life Insurance',
    'Max Life Insurance',
    'Bajaj Allianz Life Insurance',
    'Kotak Mahindra Life Insurance',
    'PNB MetLife India Insurance',
    'Aditya Birla Sun Life Insurance',
  ],
  TERM: [
    'HDFC Life',
    'ICICI Pru Life',
    'Bajaj Life',
    'TATA AIA',
    'Life Insurance Corporation of India (LIC)',
    'LIC of India',
    'HDFC Life Insurance',
    'ICICI Prudential Life Insurance',
    'Tata AIA Life Insurance',
    'SBI Life Insurance',
    'Max Life Insurance',
    'Bajaj Allianz Life Insurance',
  ],
  MOTOR: [
    'HDFC Ergo',
    'ICICI Lombard',
    'Bajaj General',
    'TATA AIG',
    'HDFC ERGO General Insurance',
    'ICICI Lombard General Insurance',
    'Bajaj Allianz General Insurance',
    'Tata AIG General Insurance',
    'Go Digit General Insurance',
    'Acko General Insurance',
    'Reliance General Insurance',
    'SBI General Insurance',
    'New India Assurance',
  ],
  TRAVEL: [
    'Star Health',
    'Niva Bupa',
    'Care',
    'Manipal Cigna',
    'HDFC Ergo',
    'ICICI Lombard',
    'Bajaj General',
    'TATA AIG',
    'HDFC ERGO General Insurance',
    'Star Health and Allied Insurance',
    'ICICI Lombard General Insurance',
    'Tata AIG General Insurance',
    'Bajaj Allianz General Insurance',
    'Care Health Insurance',
    'Reliance General Insurance',
  ],
  GENERAL: [
    'HDFC Ergo',
    'ICICI Lombard',
    'Bajaj General',
    'TATA AIG',
    'Star Health',
    'Niva Bupa',
    'Care',
    'Manipal Cigna',
    'HDFC ERGO General Insurance',
    'ICICI Lombard General Insurance',
    'Bajaj Allianz General Insurance',
    'Tata AIG General Insurance',
    'New India Assurance',
    'Oriental Insurance',
    'National Insurance',
    'United India Insurance',
  ],
  'CRITICAL ILLNESS': [
    'Star Health',
    'Niva Bupa',
    'Care',
    'Manipal Cigna',
    'HDFC Ergo',
    'ICICI Lombard',
    'HDFC Life',
    'ICICI Pru Life',
    'Star Health and Allied Insurance',
    'HDFC ERGO General Insurance',
    'Care Health Insurance',
    'HDFC Life Insurance',
    'ICICI Prudential Life Insurance',
  ],
};

export const PRIMARY_DEFAULT_COMPANIES = [
  'Star Health',
  'Niva Bupa',
  'Care',
  'Manipal Cigna',
  'HDFC Ergo',
  'ICICI Lombard',
  'Bajaj General',
  'TATA AIG',
  'HDFC Life',
  'ICICI Pru Life',
  'Bajaj Life',
  'TATA AIA',
];

const COMPANY_PRIMARY_CATEGORY: Record<string, string> = {
  'Star Health': 'Health',
  'Niva Bupa': 'Health',
  'Care': 'Health',
  'Manipal Cigna': 'Health',
  'HDFC Ergo': 'General',
  'ICICI Lombard': 'General',
  'Bajaj General': 'General',
  'TATA AIG': 'General',
  'HDFC Life': 'Life',
  'ICICI Pru Life': 'Life',
  'Bajaj Life': 'Life',
  'TATA AIA': 'Life',
};

const isCompanyMatch = (dbName: string, selected: string) => {
  if (!dbName || !selected) return false;
  const a = dbName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const b = selected.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  const aliases: Record<string, string[]> = {
    'star health': ['star health', 'star health and allied insurance', 'star health insurance'],
    'niva bupa': ['niva bupa', 'niva bupa health insurance', 'max bupa'],
    'care': ['care', 'care health insurance', 'religare'],
    'manipal cigna': ['manipal cigna', 'manipal cigna health insurance'],
    'hdfc ergo': ['hdfc ergo', 'hdfc ergo general insurance'],
    'icici lombard': ['icici lombard', 'icici lombard general insurance'],
    'bajaj general': ['bajaj general', 'bajaj allianz general insurance', 'bajaj allianz general'],
    'tata aig': ['tata aig', 'tata aig general insurance'],
    'hdfc life': ['hdfc life', 'hdfc life insurance', 'hdfc standard life'],
    'icici pru life': ['icici pru life', 'icici prudential life insurance', 'icici pru', 'icici prudential'],
    'bajaj life': ['bajaj life', 'bajaj allianz life insurance', 'bajaj allianz life'],
    'tata aia': ['tata aia', 'tata aia life insurance'],
  };

  const sLower = selected.toLowerCase().trim();
  if (aliases[sLower]) {
    const dbLower = dbName.toLowerCase().trim();
    return aliases[sLower].some(alias => dbLower.includes(alias) || alias.includes(dbLower));
  }
  return false;
};

const formatTypeLabel = (t: string) => {
  switch (t.toUpperCase()) {
    case 'HEALTH': return 'Health';
    case 'LIFE': return 'Life';
    case 'MOTOR': return 'Motor';
    case 'TRAVEL': return 'Travel';
    case 'TERM': return 'Term';
    case 'GENERAL': return 'General';
    case 'CRITICAL ILLNESS': return 'Critical Illness';
    default: return t.charAt(0) + t.slice(1).toLowerCase();
  }
};

export const POLICY_TYPE_OPTIONS = [
  { value: 'Retail Individual', label: 'Retail Individual' },
  { value: 'Retail Floater', label: 'Retail Floater' },
  { value: 'Corporate Individual', label: 'Corporate Individual' },
  { value: 'Corporate Floater', label: 'Corporate Floater' },
];

export const CUSTOMER_CATEGORY_OPTIONS = [
  { value: 'Fresh', label: 'Fresh' },
  { value: 'Port', label: 'Port' },
  { value: 'Renewal', label: 'Renewal' },
];

export const INSURANCE_COMPANY_CATEGORY_OPTIONS = [
  { value: 'Health', label: 'Health' },
  { value: 'Life', label: 'Life' },
  { value: 'General', label: 'General' },
  { value: 'Other', label: 'Other' },
];

export const INSURANCE_PLAN_CATEGORY_OPTIONS = [
  { value: 'Health', label: 'Health' },
  { value: 'Accident', label: 'Accident' },
  { value: 'Life Term', label: 'Life Term' },
  { value: 'Life Other', label: 'Life Other' },
  { value: 'Group PA', label: 'Group PA' },
  { value: 'Group Health', label: 'Group Health' },
  { value: 'SME', label: 'SME' },
  { value: 'Travel', label: 'Travel' },
  { value: 'Other', label: 'Other' },
];

export const POLICY_STATUS_OPTIONS = [
  { value: 'INFORCE', label: 'Inforce' },
  { value: 'RENEWAL_DUE', label: 'Renewal Due' },
  { value: 'GRACE_PERIOD', label: 'Grace Period' },
  { value: 'LAPSED', label: 'Lapsed' },
  { value: 'INACTIVE_OLD', label: 'Inactive(Old)' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const INSTALLMENT_DATE_OPTIONS = Array.from({ length: 31 }, (_, i) => {
  const day = i + 1;
  const padDay = String(day).padStart(2, '0');
  const suffix = (day === 1 || day === 21 || day === 31) ? 'st' : (day === 2 || day === 22) ? 'nd' : (day === 3 || day === 23) ? 'rd' : 'th';
  return {
    value: padDay,
    label: `${padDay}${suffix}`,
  };
});

export const PHC_STAGE_OPTIONS = [
  { value: 'TO_CONTACT', label: 'To Contact' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'Test Booked', label: 'Test Booked' },
  { value: 'Test Done', label: 'Test Done' },
  { value: 'Reports Received - Customer', label: 'Reports Received - Customer' },
  { value: 'Reports Received - Our Office', label: 'Reports Received - Our Office' },
  { value: 'Reports Submitted to Company', label: 'Reports Submitted to Company' },
  { value: 'Bill Approved', label: 'Bill Approved' },
  { value: 'PROCESS_COMPLETED', label: 'Process Completed' },
];

export const POLICY_DOCUMENT_TYPE_OPTIONS = [
  { value: 'POLICY_DOCUMENT', label: 'Policy Document' },
  { value: 'POLICY_DOCUMENT_ENDORSEMENT', label: 'Policy Document - Endorsement' },
  { value: 'PROPOSAL_FORM', label: 'Proposal Form' },
  { value: 'KYC', label: 'KYC Document' },
  { value: 'RENEWAL_RECEIPT', label: 'Renewal Receipt' },
  { value: 'OTHER', label: 'Other Document' },
];

interface Policy {
  id: string; policyNumber: string; status: string;
  premiumAmount: number; sumAssured?: number; startDate?: string; endDate: string;
  paymentFrequency?: string; agentCode?: string; notes?: string;
  nextDueDate?: string; maturityDate?: string;
  lastPremiumDate?: string; lastInstallmentDate?: string; noOfInstallments?: number;
  insuredPerson?: string;
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
  businessType?: string | null;
  policyType?: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'badge-green',
  INFORCE: 'badge-green',
  RENEWAL_DUE: 'badge-yellow',
  GRACE_PERIOD: 'badge-orange',
  LAPSED: 'badge-red',
  EXPIRED: 'badge-gray',
  CANCELLED: 'badge-red',
  PENDING: 'badge-yellow',
  INACTIVE_OLD: 'badge-gray',
};

export const policyFormSchema = z.object({
  contactId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Select a contact'),
  planId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Select a plan'),
  policyNumber: z.string().min(1, 'Policy number required'),
  sumAssured: z.coerce.number().positive('Enter a valid sum assured').optional(),
  premiumAmount: z.coerce.number().positive('Enter a valid premium'),
  startDate: z.string().min(1, 'Start date required'),
  endDate: z.string().min(1, 'End date required'),
  paymentFrequency: z.enum(['YEARLY', 'HALF_YEARLY', 'QUARTERLY', 'MONTHLY', 'SINGLE']),
  riders: z.preprocess((v) => {
    if (Array.isArray(v)) return v.filter(Boolean).map(String);
    if (typeof v === 'string' && v.trim()) return [v.trim()];
    return [];
  }, z.array(z.string()).default([])),
  deductible: z.string().optional(),
  status: z.string().optional(),
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
  downpaymentAmount: z.coerce.number().optional(),
  processingFee: z.coerce.number().optional(),
  installmentAmount: z.coerce.number().optional(),
  noOfInstallments: z.coerce.number().optional(),
  lastInstallmentDate: z.string().optional(),
  insuredPerson: z.string().optional(),
});



function parseExtraNotes(notesText?: string | null) {
  const res = {
    policyType: '',
    customerCategory: '',
    companyCategory: '',
    companyName: '',
    planCategory: '',
    agentName: '',
    policyZoneLocationCity: '',
    policyZoneLocationPincode: '',
    policyZoneLocationTier: '',
    deductible: '',
    riders: [] as string[],
    firstPremiumDate: '',
    premiumPaymentPeriod: undefined as number | undefined,
    lastPremiumDate: '',
    emiCase: false,
    emiGateway: '',
    emiDate: '',
    emiPremium: undefined as number | undefined,
    downpaymentAmount: undefined as number | undefined,
    processingFee: undefined as number | undefined,
    installmentAmount: undefined as number | undefined,
    noOfInstallments: undefined as number | undefined,
    lastInstallmentDate: '',
    phcRequired: false,
    phcAmount: undefined as number | undefined,
    phcStatus: '',
    phcClaimSettled: false,
    policyTenure: '',
    policyTerm: '',
    insuredPerson: '',
    phcInsuredPerson: '',
    phcStage: 'TO_CONTACT',
    nominees: [] as { name: string; relationship: string; contact: string; dob: string; sharePercent: number }[],
    connectedPersons: [] as { name: string; relationship: string; contact: string; dob: string; gender: string }[],
    cleanNotes: '',
  };
  if (!notesText) return res;

  const lines = notesText.split('\n');
  const cleanLines: string[] = [];

  lines.forEach(line => {
    if (line.startsWith('Policy Type: ')) {
      res.policyType = line.replace('Policy Type: ', '').trim();
    } else if (line.startsWith('Customer Category: ')) {
      res.customerCategory = line.replace('Customer Category: ', '').trim();
    } else if (line.startsWith('Company Category: ')) {
      res.companyCategory = line.replace('Company Category: ', '').trim();
    } else if (line.startsWith('Insurance Company Category: ')) {
      res.companyCategory = line.replace('Insurance Company Category: ', '').trim();
    } else if (line.startsWith('Insurance Company: ')) {
      res.companyName = line.replace('Insurance Company: ', '').trim();
    } else if (line.startsWith('Company Name: ')) {
      res.companyName = line.replace('Company Name: ', '').trim();
    } else if (line.startsWith('Plan Category: ')) {
      res.planCategory = line.replace('Plan Category: ', '').trim();
    } else if (line.startsWith('Insurance Plan Category: ')) {
      res.planCategory = line.replace('Insurance Plan Category: ', '').trim();
    } else if (line.startsWith('Agent Name: ')) {
      res.agentName = line.replace('Agent Name: ', '').trim();
    } else if (line.startsWith('Insured Person: ')) {
      res.insuredPerson = line.replace('Insured Person: ', '').trim();
    } else if (line.startsWith('Policy Zone City: ')) {
      res.policyZoneLocationCity = line.replace('Policy Zone City: ', '').trim();
    } else if (line.startsWith('Policy Zone Location City: ')) {
      res.policyZoneLocationCity = line.replace('Policy Zone Location City: ', '').trim();
    } else if (line.startsWith('Policy Zone Location Pincode: ')) {
      res.policyZoneLocationPincode = line.replace('Policy Zone Location Pincode: ', '').trim();
    } else if (line.startsWith('Policy Zone Location Tier: ')) {
      res.policyZoneLocationTier = line.replace('Policy Zone Location Tier: ', '').trim();
    } else if (line.startsWith('Policy Tenure: ')) {
      res.policyTenure = line.replace('Policy Tenure: ', '').trim();
    } else if (line.startsWith('Policy Term: ')) {
      res.policyTerm = line.replace('Policy Term: ', '').trim();
    } else if (line.startsWith('Deductible: ')) {
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
      if (premiumMatch) {
        res.emiPremium = Number(premiumMatch[1]) || undefined;
        if (!res.installmentAmount) res.installmentAmount = Number(premiumMatch[1]) || undefined;
      }
      const downpaymentMatch = line.match(/Downpayment:\s*₹?([0-9.]+)/);
      const processingMatch = line.match(/Processing Fee:\s*₹?([0-9.]+)/);
      if (downpaymentMatch) res.downpaymentAmount = Number(downpaymentMatch[1]) || undefined;
      if (processingMatch) res.processingFee = Number(processingMatch[1]) || undefined;
    } else if (line.startsWith('Downpayment Amount: ')) {
      res.downpaymentAmount = Number(line.replace('Downpayment Amount: ', '').replace('₹', '').replace(/,/g, '').trim()) || undefined;
    } else if (line.startsWith('Processing Fee: ')) {
      res.processingFee = Number(line.replace('Processing Fee: ', '').replace('₹', '').replace(/,/g, '').trim()) || undefined;
    } else if (line.startsWith('Processing Fee (incl. GST): ')) {
      res.processingFee = Number(line.replace('Processing Fee (incl. GST): ', '').replace('₹', '').replace(/,/g, '').trim()) || undefined;
    } else if (line.startsWith('Installment Amount: ')) {
      res.installmentAmount = Number(line.replace('Installment Amount: ', '').replace('₹', '').replace(/,/g, '').trim()) || undefined;
    } else if (line.startsWith('No. of Installments: ')) {
      res.noOfInstallments = Number(line.replace('No. of Installments: ', '').trim()) || undefined;
    } else if (line.startsWith('Installment Date: ')) {
      res.emiDate = line.replace('Installment Date: ', '').trim();
    } else if (line.startsWith('Last Installment Date: ')) {
      res.lastInstallmentDate = line.replace('Last Installment Date: ', '').trim();
      if (!res.lastPremiumDate) res.lastPremiumDate = res.lastInstallmentDate;
    } else if (line.startsWith('PHC Insured Person: ')) {
      res.phcInsuredPerson = line.replace('PHC Insured Person: ', '').trim();
    } else if (line.startsWith('Insured Person for PHC: ')) {
      res.phcInsuredPerson = line.replace('Insured Person for PHC: ', '').trim();
    } else if (line.startsWith('PHC Stage: ')) {
      res.phcStage = line.replace('PHC Stage: ', '').trim();
    } else if (line.startsWith('Preventive Health Checkup: ')) {
      res.phcRequired = true;
      const amountMatch = line.match(/Amount:\s*₹([0-9.]+)/);
      const statusMatch = line.match(/Status:\s*([^,)]+)/);
      const settledMatch = line.match(/Claim Settled:\s*([^,)]+)/);
      const personMatch = line.match(/Insured Person:\s*([^,)]+)/);
      if (amountMatch) res.phcAmount = Number(amountMatch[1]) || undefined;
      if (statusMatch) res.phcStatus = statusMatch[1].trim();
      if (settledMatch) res.phcClaimSettled = settledMatch[1].trim().toLowerCase() === 'yes';
      if (personMatch) res.phcInsuredPerson = personMatch[1].trim();
    } else if (line.startsWith('Nominee Details')) {
      const nameM = line.match(/Name:\s*([^,]+)/);
      const relM = line.match(/Relationship:\s*([^,]+)/);
      const contactM = line.match(/Contact:\s*([^,]+)/);
      const dobM = line.match(/DoB:\s*([^,]+)/);
      const shareM = line.match(/Share:\s*([0-9.]+)%/);
      res.nominees.push({
        name: nameM ? nameM[1].trim() : '',
        relationship: relM ? relM[1].trim() : '',
        contact: contactM ? contactM[1].trim() : '',
        dob: dobM && dobM[1].trim() !== 'N/A' ? dobM[1].trim() : '',
        sharePercent: shareM ? Number(shareM[1]) : 100,
      });
    } else if (line.startsWith('Connected Person')) {
      const nameM = line.match(/Name:\s*([^,]+)/);
      const relM = line.match(/Relationship:\s*([^,]+)/);
      const contactM = line.match(/Contact:\s*([^,]+)/);
      const dobM = line.match(/DoB:\s*([^,]+)/);
      const genderM = line.match(/Gender:\s*([^,]+)/);
      res.connectedPersons.push({
        name: nameM ? nameM[1].trim() : '',
        relationship: relM ? relM[1].trim() : '',
        contact: contactM ? contactM[1].trim() : '',
        dob: dobM && dobM[1].trim() !== 'N/A' ? dobM[1].trim() : '',
        gender: genderM ? genderM[1].trim() : 'MALE',
      });
    } else {
      cleanLines.push(line);
    }
  });

  res.cleanNotes = cleanLines.join('\n').trim();
  return res;
}

export const policyEditFormSchema = z.object({
  status: z.string().optional(),
  premiumAmount: z.coerce.number().positive('Enter a valid premium'),
  sumAssured: z.coerce.number().positive().optional(),
  endDate: z.string().min(1, 'End date required'),
  nextDueDate: z.string().optional(),
  maturityDate: z.string().optional(),
  paymentFrequency: z.enum(['YEARLY', 'HALF_YEARLY', 'QUARTERLY', 'MONTHLY', 'SINGLE']),
  agentCode: z.string().optional(),
  notes: z.string().optional(),
  riders: z.preprocess((v) => {
    if (Array.isArray(v)) return v.filter(Boolean).map(String);
    if (typeof v === 'string' && v.trim()) return [v.trim()];
    return [];
  }, z.array(z.string()).default([])),
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
  downpaymentAmount: z.coerce.number().optional(),
  processingFee: z.coerce.number().optional(),
  installmentAmount: z.coerce.number().optional(),
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
  const [isPolicyDetailsCollapsed, setIsPolicyDetailsCollapsed] = useState(false);
  const [isPlanDetailsCollapsed, setIsPlanDetailsCollapsed] = useState(false);
  const [isPremiumBreakdownCollapsed, setIsPremiumBreakdownCollapsed] = useState(false);
  const [isTenureDatesCollapsed, setIsTenureDatesCollapsed] = useState(false);
  const [isEmiDetailsCollapsed, setIsEmiDetailsCollapsed] = useState(true);
  const [isPaymentModeLoanCollapsed, setIsPaymentModeLoanCollapsed] = useState(true);
  const [isPaymentAccountCollapsed, setIsPaymentAccountCollapsed] = useState(true);
  const [isGstDetailsCollapsed, setIsGstDetailsCollapsed] = useState(true);
  const [isPhcCollapsed, setIsPhcCollapsed] = useState(false);
  const [isPhcBookingCollapsed, setIsPhcBookingCollapsed] = useState(false);
  const [isPhcSettlementCollapsed, setIsPhcSettlementCollapsed] = useState(false);
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
    phcStage: 'TO_CONTACT',
  });
  const [isCustomPhcPersonManual, setIsCustomPhcPersonManual] = useState(false);

  const [isDocUploadModalOpen, setIsDocUploadModalOpen] = useState(false);
  const [docUploadFields, setDocUploadFields] = useState<{ type: string; title: string; description: string; file: File | null }>({
    type: 'POLICY_DOCUMENT',
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
    setDocUploadFields({ type: 'POLICY_DOCUMENT', title: '', description: '', file: null });
  };

  const viewDoc = async (docId: string) => {
    try {
      const res = await documentsService.url(docId);
      const url = (res as any)?.url || (res as any)?.data?.url;
      if (url) window.open(url, '_blank');
      else toast.error('Document URL not found');
    } catch {
      toast.error('Could not load document URL');
    }
  };

  const deleteExistingDocMutation = useMutation({
    mutationFn: (docId: string) => documentsService.remove(docId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policy-docs', editTarget?.id] });
      toast.success('Document deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete document');
    },
  });

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
    insuredPerson: '',
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
  const [sortBy, setSortBy] = useState('createdAt');
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
    status: true,
    sumAssured: true,
    policyTenure: true,
    policyTerm: true,
    assignedTo: true,
    comment: true,
    firstYearPremium: true,
    secondYearPremium: true,
    premiumAmount: true,
    installmentCase: true,
    downpaymentAmount: true,
    processingFee: true,
    installmentAmount: true,
    noOfInstallments: true,
    lastInstallmentDate: true,
    insuredPerson: true,
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
      `"${getPolicyStatusDisplay(p).label.replace(/"/g, '""')}"`
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
    
    const rowsHtml = sortedPolicies.map((p: any) => {
      const stDisplay = getPolicyStatusDisplay(p);
      return `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 8px;">${((p.contact?.firstName || '') + ' ' + (p.contact?.lastName || '')).trim() || 'N/A'}</td>
        <td style="padding: 8px; font-weight: 600;">${p.policyNumber || 'N/A'}</td>
        <td style="padding: 8px;">${p.plan?.category || 'N/A'}</td>
        <td style="padding: 8px;">${p.plan?.company?.name || 'N/A'}</td>
        <td style="padding: 8px;">${p.plan?.name || 'N/A'}</td>
        <td style="padding: 8px; text-align: right;">₹${p.premiumAmount?.toLocaleString() || 0}</td>
        <td style="padding: 8px; text-align: right;">₹${p.sumAssured?.toLocaleString() || 0}</td>
        <td style="padding: 8px; text-align: center;">${p.startDate ? new Date(p.startDate).toLocaleDateString() : 'N/A'}</td>
        <td style="padding: 8px; text-align: center;"><span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;" class="${stDisplay.badgeClass}">${stDisplay.label}</span></td>
      </tr>
    `;
    }).join('');

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
  const [selectedPolicyType, setSelectedPolicyType] = useState('');
  const [selectedCompanyCategory, setSelectedCompanyCategory] = useState('');
  const [selectedPlanCategory, setSelectedPlanCategory] = useState('');
  const [customerCategory, setCustomerCategory] = useState('Fresh');
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
    const fromPlans = plansList.map((p: any) => (p.category || '').toUpperCase()).filter(Boolean);
    const standard = ['HEALTH', 'LIFE', 'MOTOR', 'TRAVEL', 'TERM', 'GENERAL', 'CRITICAL ILLNESS'];
    return Array.from(new Set([...standard, ...fromPlans]));
  }, [plansList]);

  const availableCompanies = useMemo(() => {
    const filterCat = (selectedCompanyCategory || selectedType || '').toUpperCase();

    const listFromPlans = filterCat && filterCat !== 'OTHER'
      ? plansList
          .filter((p: any) => {
            const compCat = (p.company?.category || '').toUpperCase();
            const planCat = (p.category || '').toUpperCase();
            return compCat.includes(filterCat) || planCat.includes(filterCat);
          })
          .map((p: any) => p.company?.name)
          .filter(Boolean)
      : plansList.map((p: any) => p.company?.name).filter(Boolean);

    const defaultsForType = filterCat && DEFAULT_COMPANIES_BY_TYPE[filterCat]
      ? DEFAULT_COMPANIES_BY_TYPE[filterCat]
      : PRIMARY_DEFAULT_COMPANIES;

    const allDbCompanies = Array.from(new Set(plansList.map((p: any) => p.company?.name).filter(Boolean)));

    return Array.from(
      new Set([
        ...defaultsForType,
        ...listFromPlans,
        ...(!filterCat || filterCat === 'OTHER' ? allDbCompanies : []),
      ])
    ).filter(Boolean) as string[];
  }, [plansList, selectedCompanyCategory, selectedType]);

  const availablePlans = useMemo(() => {
    if (!selectedCompany) return [];
    const directMatches = plansList.filter((p: any) => {
      const coName = p.company?.name || '';
      const coMatch = (coName || '').toLowerCase() === selectedCompany.toLowerCase() ||
                      (p.company?.shortCode || '').toLowerCase() === selectedCompany.toLowerCase() ||
                      isCompanyMatch(coName, selectedCompany);
      const filterCat = (selectedPlanCategory || selectedCompanyCategory || selectedType || '').toUpperCase();
      const typeMatch = !filterCat || filterCat === 'OTHER' || (p.category || '').toUpperCase().includes(filterCat) || filterCat.includes((p.category || '').toUpperCase());
      return coMatch && typeMatch;
    });

    if (directMatches.length > 0) return directMatches;

    const companyMatches = plansList.filter((p: any) => {
      const coName = p.company?.name || '';
      return (coName || '').toLowerCase() === selectedCompany.toLowerCase() ||
             (p.company?.shortCode || '').toLowerCase() === selectedCompany.toLowerCase() ||
             isCompanyMatch(coName, selectedCompany);
    });
    if (companyMatches.length > 0) return companyMatches;

    if (selectedPlanCategory || selectedType) {
      const targetCat = (selectedPlanCategory || selectedType).toUpperCase();
      const catMatches = plansList.filter((p: any) => (p.category || '').toUpperCase().includes(targetCat) || targetCat.includes((p.category || '').toUpperCase()));
      if (catMatches.length > 0) return catMatches;
    }

    return plansList;
  }, [plansList, selectedPlanCategory, selectedCompanyCategory, selectedType, selectedCompany]);

  // Derived filter options
  const filterPlansOptions = useMemo(() => {
    return plansList;
  }, [plansList]);

  const filterCompaniesOptions = useMemo(() => {
    const fromPlans = plansList.map((p: any) => p.company?.name).filter(Boolean);
    return Array.from(new Set([...PRIMARY_DEFAULT_COMPANIES, ...fromPlans])).filter(Boolean) as string[];
  }, [plansList]);

  const { data: claimsResults } = useQuery({
    queryKey: ['claims', 'all-for-policies-list'],
    queryFn: () => claimsService.list({ limit: 1000 }),
  });
  const allClaims = claimsResults?.data ?? [];

  // Fetch policies: get all in 1 query for client-side filtering (0 ops)
  const { data, isLoading } = usePolicies({ limit: 2000 });

  const getArrayData = (obj: any): any[] => {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj;
    if (obj.data && Array.isArray(obj.data)) return obj.data;
    if (obj.data?.data && Array.isArray(obj.data.data)) return obj.data.data;
    if (obj.items && Array.isArray(obj.items)) return obj.items;
    if (obj.data?.items && Array.isArray(obj.data.items)) return obj.data.items;
    if (obj.data?.data?.data && Array.isArray(obj.data.data.data)) return obj.data.data.data;
    
    // Safely search for the first array in the object properties
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (Array.isArray(obj[key])) return obj[key];
        if (obj[key] && typeof obj[key] === 'object' && Array.isArray(obj[key].data)) return obj[key].data;
      }
    }
    return [];
  };

  const rawPolicies = useMemo(() => getArrayData(data), [data]);

  // Client-side Filter Logic
  const filteredPolicies = useMemo(() => {
    let list: Policy[] = rawPolicies;

    // Quick Select filters
    if (selectedQuickFilter !== 'ALL') {
      if (['FRESH', 'PORT', 'RENEWAL'].includes(selectedQuickFilter)) {
        list = list.filter((p: any) => {
          const extra = parseExtraNotes(p.notes);
          const cat = (extra.customerCategory || (p.businessType ? (p.businessType === 'FRESH' ? 'Fresh' : p.businessType === 'PORT' ? 'Port' : p.businessType === 'RENEWAL' ? 'Renewal' : p.businessType) : '') || p.policyType || '').toUpperCase();
          return cat === selectedQuickFilter;
        });
      } else {
        list = list.filter((p: any) => {
          const extra = parseExtraNotes(p.notes);
          const cat = (extra.planCategory || extra.companyCategory || p.plan?.category || '').toUpperCase();
          return cat.includes(selectedQuickFilter);
        });
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
        const extra = parseExtraNotes(p.notes);
        const cat = (extra.companyCategory || p.plan?.company?.category || p.plan?.category || '').toUpperCase();
        return cat.includes(appliedFilters.companyCategory.toUpperCase());
      });
    }

    // Plan Category Filter
    if (appliedFilters.planCategory) {
      list = list.filter((p: any) => {
        const extra = parseExtraNotes(p.notes);
        const cat = (extra.planCategory || p.plan?.category || '').toUpperCase();
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
        const extra = parseExtraNotes(p.notes);
        const bCat = (extra.customerCategory || (p.businessType ? (p.businessType === 'FRESH' ? 'Fresh' : p.businessType === 'PORT' ? 'Port' : p.businessType === 'RENEWAL' ? 'Renewal' : p.businessType) : '') || p.policyType || p.type || '').toUpperCase();
        return bCat === appliedFilters.businessCategory.toUpperCase();
      });
    }

    // Status Filter
    if (appliedFilters.status) {
      list = list.filter((p: any) => {
        const targetStatus = appliedFilters.status.toUpperCase();
        const rawStatus = String(p.status || '').toUpperCase();
        if (rawStatus === targetStatus) return true;
        const disp = getPolicyStatusDisplay(p);
        const dispLabel = disp.label.toUpperCase();
        if (targetStatus === 'INFORCE' && (dispLabel === 'INFORCE' || rawStatus === 'ACTIVE')) return true;
        if (targetStatus === 'RENEWAL_DUE' && dispLabel.includes('RENEWAL DUE')) return true;
        if (targetStatus === 'GRACE_PERIOD' && dispLabel.includes('GRACE PERIOD')) return true;
        if (targetStatus === 'LAPSED' && dispLabel.includes('LAPSED')) return true;
        if (targetStatus === 'INACTIVE_OLD' && (dispLabel.includes('INACTIVE') || rawStatus === 'INACTIVE_OLD')) return true;
        if (targetStatus === 'CANCELLED' && (dispLabel.includes('CANCELLED') || rawStatus === 'CANCELLED')) return true;
        return false;
      });
    }

    // Policy Type Filter
    if (appliedFilters.policyType) {
      list = list.filter((p: any) => {
        const extra = parseExtraNotes(p.notes);
        const pType = (extra.policyType || p.policyCategory || p.type || p.policyType || '').toLowerCase();
        return pType.includes(appliedFilters.policyType.toLowerCase());
      });
    }

    // Agency / Agent Name Filter
    if (appliedFilters.agency || appliedFilters.agentName) {
      const term = (appliedFilters.agency || appliedFilters.agentName).toLowerCase();
      list = list.filter((p: any) => {
        const extra = parseExtraNotes(p.notes);
        const code = (p.agentCode || '').toLowerCase();
        const empName = (p.assignedEmployee?.employeeProfile?.firstName || '').toLowerCase();
        const extraAgent = (extra.agentName || '').toLowerCase();
        return code.includes(term) || empName.includes(term) || extraAgent.includes(term);
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

    // Insured Person Filter
    if (appliedFilters.insuredPerson) {
      const q = appliedFilters.insuredPerson.toLowerCase();
      list = list.filter((p: any) => {
        const extra = parseExtraNotes(p.notes);
        const name = (extra.insuredPerson || `${p.contact?.firstName || ''} ${p.contact?.lastName || ''}`).toLowerCase();
        return name.includes(q);
      });
    }

    // City Filter
    if (appliedFilters.city) {
      list = list.filter((p: any) => {
        const extra = parseExtraNotes(p.notes);
        const city = (extra.policyZoneLocationCity || p.contact?.address?.city || p.contact?.city || '').toLowerCase();
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

    // Policy Tenure Filter (Supports typing 1 to 99 Yr or raw numbers)
    if (appliedFilters.policyTenure) {
      const rawFilter = appliedFilters.policyTenure.trim();
      const filterNum = parseInt(rawFilter.replace(/\D/g, ''), 10);
      list = list.filter((p: any) => {
        const extra = parseExtraNotes(p.notes);
        const calcYears = (p.startDate && p.endDate)
          ? Math.max(1, Math.round((new Date(p.endDate).getTime() - new Date(p.startDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)))
          : null;
        const notesTenure = (extra.policyTenure || '').toLowerCase();
        const propTenure = String(p.tenure || p.duration || '').toLowerCase();

        if (!isNaN(filterNum) && filterNum > 0) {
          if (calcYears === filterNum) return true;
          const numStr = String(filterNum);
          if (notesTenure.includes(numStr)) return true;
          if (propTenure.includes(numStr)) return true;
        }

        return notesTenure.includes(rawFilter.toLowerCase()) || propTenure.includes(rawFilter.toLowerCase());
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
        const extra = parseExtraNotes(p.notes);
        const count = String(extra.noOfInstallments || p.noOfInstallments || '');
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
    let key = sortBy || 'createdAt';
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
    const rule = compulsoryRules.find((r: any) => r.module === 'Policy' && r.fieldKey === key);
    if (rule !== undefined) return rule.required;
    return defaultRequired;
  };

  const activeSchema = useMemo(() => {
    return z.object({
      contactId: isFieldRequired('contactId', true) ? z.string().min(1, 'Please select a Customer in Tab 1') : z.string().optional().or(z.literal('')),
      planId: isFieldRequired('planId', true) ? z.string().min(1, 'Please select an Insurance Plan in Tab 1') : z.string().optional().or(z.literal('')),
      policyNumber: isFieldRequired('policyNumber', true) ? z.string().min(1, 'Policy number is required in Tab 1') : z.string().optional().or(z.literal('')),
      sumAssured: isFieldRequired('sumAssured', false) ? z.coerce.number().min(0, 'Enter a valid sum assured') : z.coerce.number().optional().or(z.literal('')),
      premiumAmount: isFieldRequired('premiumAmount', true) ? z.coerce.number().min(0, 'Enter a valid premium amount') : z.coerce.number().optional().or(z.literal('')),
      startDate: z.string().optional().or(z.literal('')),
      endDate: z.string().optional().or(z.literal('')),
      paymentFrequency: z.enum(['YEARLY', 'HALF_YEARLY', 'QUARTERLY', 'MONTHLY', 'SINGLE']),
      riders: z.preprocess((v) => {
        if (Array.isArray(v)) return v.filter(Boolean).map(String);
        if (typeof v === 'string' && v.trim()) return [v.trim()];
        return [];
      }, z.array(z.string()).default([])),
      deductible: isFieldRequired('deductible', false) ? z.string().min(1, 'Required') : z.string().optional(),
      status: z.string().optional(),
      assignedEmployeeId: isFieldRequired('assignedEmployeeId', false) ? z.string().min(1, 'Required') : z.string().optional(),
      nextDueDate: isFieldRequired('nextDueDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      maturityDate: isFieldRequired('maturityDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      agentCode: isFieldRequired('agentCode', false) ? z.string().min(1, 'Required') : z.string().optional(),
      notes: isFieldRequired('notes', false) ? z.string().min(1, 'Required') : z.string().optional(),
      firstPremiumDate: isFieldRequired('firstPremiumDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      premiumPaymentPeriod: isFieldRequired('premiumPaymentPeriod', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional().or(z.literal('')),
      lastPremiumDate: isFieldRequired('lastPremiumDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      emiCase: z.boolean().optional(),
      emiGateway: isFieldRequired('emiGateway', false) ? z.string().min(1, 'Required') : z.string().optional(),
      emiDate: isFieldRequired('emiDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      emiPremium: isFieldRequired('emiPremium', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional().or(z.literal('')),
      phcRequired: z.boolean().optional(),
      phcAmount: isFieldRequired('phcAmount', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional().or(z.literal('')),
      phcStatus: isFieldRequired('phcStatus', false) ? z.string().min(1, 'Required') : z.string().optional(),
      phcClaimSettled: z.boolean().optional(),
      firstYearPremium: isFieldRequired('firstYearPremium', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional().or(z.literal('')),
      secondYearPremium: isFieldRequired('secondYearPremium', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional().or(z.literal('')),
      downpaymentAmount: isFieldRequired('downpaymentAmount', false) ? z.coerce.number().min(0, 'Required') : z.coerce.number().optional().or(z.literal('')),
      processingFee: isFieldRequired('processingFee', false) ? z.coerce.number().min(0, 'Required') : z.coerce.number().optional().or(z.literal('')),
      installmentAmount: isFieldRequired('installmentAmount', false) ? z.coerce.number().min(0, 'Required') : z.coerce.number().optional().or(z.literal('')),
      noOfInstallments: isFieldRequired('noOfInstallments', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional().or(z.literal('')),
      lastInstallmentDate: isFieldRequired('lastInstallmentDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      insuredPerson: isFieldRequired('insuredPerson', false) ? z.string().min(1, 'Required') : z.string().optional(),
    });
  }, [compulsoryRules]);

  const activeEditSchema = useMemo(() => {
    return z.object({
      status: z.string().optional(),
      premiumAmount: isFieldRequired('premiumAmount', true) ? z.coerce.number().min(0, 'Enter a valid premium') : z.coerce.number().optional().or(z.literal('')),
      sumAssured: isFieldRequired('sumAssured', false) ? z.coerce.number().min(0, 'Enter a valid sum assured') : z.coerce.number().optional().or(z.literal('')),
      endDate: z.string().optional().or(z.literal('')),
      nextDueDate: isFieldRequired('nextDueDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      maturityDate: isFieldRequired('maturityDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      paymentFrequency: z.enum(['YEARLY', 'HALF_YEARLY', 'QUARTERLY', 'MONTHLY', 'SINGLE']),
      agentCode: isFieldRequired('agentCode', false) ? z.string().min(1, 'Required') : z.string().optional(),
      notes: isFieldRequired('notes', false) ? z.string().min(1, 'Required') : z.string().optional(),
      riders: z.preprocess((v) => {
        if (Array.isArray(v)) return v.filter(Boolean).map(String);
        if (typeof v === 'string' && v.trim()) return [v.trim()];
        return [];
      }, z.array(z.string()).default([])),
      deductible: isFieldRequired('deductible', false) ? z.string().min(1, 'Required') : z.string().optional(),
      assignedEmployeeId: isFieldRequired('assignedEmployeeId', false) ? z.string().min(1, 'Required') : z.string().optional(),
      firstPremiumDate: isFieldRequired('firstPremiumDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      premiumPaymentPeriod: isFieldRequired('premiumPaymentPeriod', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional().or(z.literal('')),
      lastPremiumDate: isFieldRequired('lastPremiumDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      emiCase: z.boolean().optional(),
      emiGateway: isFieldRequired('emiGateway', false) ? z.string().min(1, 'Required') : z.string().optional(),
      emiDate: isFieldRequired('emiDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      emiPremium: isFieldRequired('emiPremium', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional().or(z.literal('')),
      phcRequired: z.boolean().optional(),
      phcAmount: isFieldRequired('phcAmount', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional().or(z.literal('')),
      phcStatus: isFieldRequired('phcStatus', false) ? z.string().min(1, 'Required') : z.string().optional(),
      phcClaimSettled: z.boolean().optional(),
      firstYearPremium: isFieldRequired('firstYearPremium', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional().or(z.literal('')),
      secondYearPremium: isFieldRequired('secondYearPremium', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional().or(z.literal('')),
      downpaymentAmount: isFieldRequired('downpaymentAmount', false) ? z.coerce.number().min(0, 'Required') : z.coerce.number().optional().or(z.literal('')),
      processingFee: isFieldRequired('processingFee', false) ? z.coerce.number().min(0, 'Required') : z.coerce.number().optional().or(z.literal('')),
      installmentAmount: isFieldRequired('installmentAmount', false) ? z.coerce.number().min(0, 'Required') : z.coerce.number().optional().or(z.literal('')),
      noOfInstallments: isFieldRequired('noOfInstallments', false) ? z.coerce.number().min(1, 'Required') : z.coerce.number().optional().or(z.literal('')),
      lastInstallmentDate: isFieldRequired('lastInstallmentDate', false) ? z.string().min(1, 'Required') : z.string().optional(),
      insuredPerson: isFieldRequired('insuredPerson', false) ? z.string().min(1, 'Required') : z.string().optional(),
    });
  }, [compulsoryRules]);

  const { register, handleSubmit, reset, setValue, watch } = useForm<Form>({
    resolver: zodResolver(activeSchema),
    defaultValues: { paymentFrequency: 'YEARLY', status: 'INFORCE', riders: [] },
  });
  const { register: regEdit, handleSubmit: handleEdit, reset: resetEdit, setValue: setEditValue, watch: watchEdit } = useForm<EditForm>({
    resolver: zodResolver(activeEditSchema),
  });

  const handleCompanyCategoryChange = (newCat: string) => {
    setSelectedCompanyCategory(newCat);
    setSelectedType(newCat);

    if (selectedCompany && newCat) {
      const catKey = newCat.toUpperCase();
      const isCompanyInType = plansList.some(
        (p: any) => (p.company?.name || '').toLowerCase() === selectedCompany.toLowerCase() &&
                    ((p.company?.category || '').toUpperCase().includes(catKey) || 
                     (p.category || '').toUpperCase().includes(catKey))
      ) || (DEFAULT_COMPANIES_BY_TYPE[catKey] || []).some(
        c => c.toLowerCase() === selectedCompany.toLowerCase()
      );
      if (!isCompanyInType && catKey !== 'OTHER') {
        setSelectedCompany('');
        setSelectedPlan(null);
        setValue('planId', '');
      }
    }
  };

  const handlePlanCategoryChange = (newCat: string) => {
    setSelectedPlanCategory(newCat);
    if (selectedPlan && newCat && newCat !== 'Other') {
      const pCat = (selectedPlan.category || '').toLowerCase();
      if (!pCat.includes(newCat.toLowerCase()) && !newCat.toLowerCase().includes(pCat)) {
        setSelectedPlan(null);
        setValue('planId', '');
      }
    }
  };

  const handleTypeChange = (newType: string) => {
    setSelectedType(newType);
    setSelectedPlan(null);
    setValue('planId', '');

    if (selectedCompany && newType) {
      const isCompanyInType = plansList.some(
        (p: any) => (p.company?.name || '').toLowerCase() === selectedCompany.toLowerCase() &&
                    (p.category || '').toUpperCase() === newType.toUpperCase()
      ) || (DEFAULT_COMPANIES_BY_TYPE[newType.toUpperCase()] || []).some(
        c => c.toLowerCase() === selectedCompany.toLowerCase()
      );
      if (!isCompanyInType) {
        setSelectedCompany('');
      }
    }
  };

  const handleCompanyChange = (compName: string) => {
    setSelectedCompany(compName);
    setSelectedPlan(null);
    setValue('planId', '');

    if (compName && !selectedCompanyCategory) {
      if (COMPANY_PRIMARY_CATEGORY[compName]) {
        const cat = COMPANY_PRIMARY_CATEGORY[compName];
        setSelectedCompanyCategory(cat);
        setSelectedType(cat);
      } else {
        const plan = plansList.find((p: any) => (p.company?.name || '').toLowerCase() === compName.toLowerCase() || isCompanyMatch(p.company?.name || '', compName));
        if (plan?.company?.category) {
          const cat = plan.company.category;
          const matchingCat = INSURANCE_COMPANY_CATEGORY_OPTIONS.find(o => o.value.toLowerCase() === cat.toLowerCase());
          if (matchingCat) {
            setSelectedCompanyCategory(matchingCat.value);
            setSelectedType(matchingCat.value);
          }
        } else {
          for (const [type, companies] of Object.entries(DEFAULT_COMPANIES_BY_TYPE)) {
            if (companies.some(c => c.toLowerCase() === compName.toLowerCase() || isCompanyMatch(c, compName))) {
              const matchingCat = INSURANCE_COMPANY_CATEGORY_OPTIONS.find(o => o.value.toUpperCase() === type.toUpperCase());
              if (matchingCat) {
                setSelectedCompanyCategory(matchingCat.value);
                setSelectedType(matchingCat.value);
              }
              break;
            }
          }
        }
      }
    }
  };

  useEffect(() => {
    if (selectedCompany && availablePlans.length > 0 && !selectedPlan) {
      const first = availablePlans[0];
      setSelectedPlan(first);
      setValue('planId', first.id, { shouldValidate: true });
    }
  }, [selectedCompany, availablePlans, selectedPlan, setValue]);
  const watchEditEmiCase = watchEdit('emiCase');
  const watchEditPhcRequired = watchEdit('phcRequired');
  const watchEditEndDate = watchEdit('endDate');
  const watchEditNextDueDate = watchEdit('nextDueDate');
  const watchEditMaturityDate = watchEdit('maturityDate');

  const watchPremiumAmount = watch('premiumAmount');
  const watchSumAssured = watch('sumAssured');
  const watchFirstYearPremium = watch('firstYearPremium');
  const watchSecondYearPremium = watch('secondYearPremium');
  const watchDownpaymentAmount = watch('downpaymentAmount');
  const watchProcessingFee = watch('processingFee');
  const watchInstallmentAmount = watch('installmentAmount');
  const watchNoOfInstallments = watch('noOfInstallments');
  const watchFirstPremiumDate = watch('firstPremiumDate');
  const watchPaymentFrequency = watch('paymentFrequency');
  const watchEmiDate = watch('emiDate');
  const watchStartDate = watch('startDate');
  const watchEndDate = watch('endDate');
  const watchLastInstallmentDate = watch('lastInstallmentDate');
  const watchLastPremiumDate = watch('lastPremiumDate');
  const watchEmiCase = watch('emiCase');
  const watchPhcRequired = watch('phcRequired');
  const [durationYears, setDurationYears] = useState<number>(1);
  const [policyTerm, setPolicyTerm] = useState<string>('1 Year');
  const [insuredPerson, setInsuredPerson] = useState<string>('');

  const recalculateLastInstallment = (overrides?: {
    baseDate?: string;
    noOfInst?: number | string;
    freq?: string;
    day?: string | number;
  }) => {
    const freq = overrides?.freq ?? watchPaymentFrequency ?? 'YEARLY';
    let numInst = overrides?.noOfInst !== undefined ? overrides.noOfInst : watchNoOfInstallments;
    const isSingle = freq === 'SINGLE' || String(freq).toUpperCase().includes('ONE');

    if (isSingle) {
      numInst = 1;
      setValue('noOfInstallments', 1, { shouldDirty: true });
    } else if (numInst === undefined || numInst === null || numInst === '' || Number(numInst) <= 0) {
      numInst = freq === 'MONTHLY' ? 12 : freq === 'QUARTERLY' ? 4 : freq === 'HALF_YEARLY' ? 2 : 1;
      setValue('noOfInstallments', numInst, { shouldDirty: true });
    }

    const base = overrides?.baseDate || watchFirstPremiumDate || watchStartDate || format(new Date(), 'yyyy-MM-dd');
    const day = overrides?.day !== undefined ? overrides.day : watchEmiDate;
    const calculated = calculateLastInstallmentDate(base, numInst, freq, day);
    if (calculated) {
      setValue('lastInstallmentDate', calculated, { shouldValidate: true, shouldDirty: true });
      setValue('lastPremiumDate', calculated, { shouldValidate: true, shouldDirty: true });
    }
  };

  useEffect(() => {
    if (durationYears) {
      setPolicyTerm(`${durationYears} ${Number(durationYears) === 1 ? 'Year' : 'Years'}`);
    }
  }, [durationYears]);
  const [selectedFamilySize, setSelectedFamilySize] = useState<string>('1');
  const [selectedZoneTier, setSelectedZoneTier] = useState<string>('ZONE_1');
  const [policyZoneLocationCity, setPolicyZoneLocationCity] = useState<string>('');
  const [policyZoneLocationPincode, setPolicyZoneLocationPincode] = useState<string>('');
  const [selectedAgentName, setSelectedAgentName] = useState<string>(
    user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Rahul Mehta' : 'Rahul Mehta'
  );

  const agentOptions = useMemo(() => {
    const list: { value: string; label: string; empId?: string; agentCode?: string }[] = [];

    // 1. Current logged in user
    if (user) {
      const selfName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Current User';
      list.push({ value: selfName, label: `${selfName} (Current User)`, empId: user.id });
    }

    // 2. Employees from employeeResults
    (employeeResults?.data || []).forEach((emp: any) => {
      const name = `${emp.firstName || emp.employeeProfile?.firstName || ''} ${emp.lastName || emp.employeeProfile?.lastName || ''}`.trim();
      if (name && !list.some(x => x.value.toLowerCase() === name.toLowerCase())) {
        list.push({ value: name, label: name, empId: emp.userId || emp.id });
      }
    });

    // 3. Agencies / Agents from agencyRes
    (agencyRes?.data || []).forEach((ag: any) => {
      const agName = ag.name?.trim();
      if (agName && !list.some(x => x.value.toLowerCase() === agName.toLowerCase())) {
        list.push({ value: agName, label: `${agName}${ag.agentCode ? ` (${ag.agentCode})` : ''}`, agentCode: ag.agentCode });
      }
    });

    // 4. Default / common agents
    const defaultAgents = ['Rahul Mehta', 'Priya Sharma', 'Amit Patel', 'Sneha Kulkarni'];
    defaultAgents.forEach(name => {
      if (!list.some(x => x.value.toLowerCase() === name.toLowerCase())) {
        list.push({ value: name, label: name });
      }
    });

    return list;
  }, [user, employeeResults, agencyRes]);

  useEffect(() => {
    if (watchStartDate) {
      const start = new Date(watchStartDate);
      if (!isNaN(start.getTime())) {
        const numYears = Number(durationYears) || 1;
        const end = new Date(start);
        end.setFullYear(start.getFullYear() + numYears);
        setValue('endDate', end.toISOString().split('T')[0]);
        setValue('maturityDate', end.toISOString().split('T')[0]);
      }
    }
  }, [watchStartDate, durationYears, setValue]);

  useEffect(() => {
    const baseDate = watchFirstPremiumDate || watchStartDate || format(new Date(), 'yyyy-MM-dd');
    let numInst = watchNoOfInstallments;
    const freq = watchPaymentFrequency || 'YEARLY';
    if (freq === 'SINGLE' || String(freq).toUpperCase().includes('ONE')) {
      numInst = 1;
    }
    const calculatedLastDate = calculateLastInstallmentDate(
      baseDate,
      numInst || 1,
      freq,
      watchEmiDate
    );
    if (calculatedLastDate) {
      setValue('lastPremiumDate', calculatedLastDate, { shouldValidate: true, shouldDirty: true });
      setValue('lastInstallmentDate', calculatedLastDate, { shouldValidate: true, shouldDirty: true });
    }
  }, [watchFirstPremiumDate, watchStartDate, watchNoOfInstallments, watchPaymentFrequency, watchEmiDate, setValue]);

  // Fetch existing policy documents when in edit mode
  const { data: existingPolicyDocsRes } = useQuery({
    queryKey: ['policy-docs', editTarget?.id],
    queryFn: () => documentsService.list({ policyId: editTarget!.id }),
    enabled: !!editTarget?.id && modalOpen,
  });
  const existingPolicyDocs: any[] = existingPolicyDocsRes?.data ?? [];

  const phcInsuredPersonOptions = useMemo(() => {
    const list: { value: string; label: string; sublabel?: string }[] = [];
    const seen = new Set<string>();

    const primary = (insuredPerson || (selectedContact ? `${selectedContact.firstName || ''} ${selectedContact.lastName || ''}`.trim() : '')).trim();
    if (primary) {
      list.push({
        value: primary,
        label: `${primary} (Self / Primary)`,
        sublabel: 'Primary Insured Person',
      });
      seen.add(primary.toLowerCase());
    }

    connectedPersons.forEach((cp) => {
      const name = (cp.name || '').trim();
      if (name && !seen.has(name.toLowerCase())) {
        list.push({
          value: name,
          label: `${name} (${cp.relationship || 'Member'})`,
          sublabel: cp.relationship ? `Relationship: ${cp.relationship}` : 'Family Member',
        });
        seen.add(name.toLowerCase());
      }
    });

    const current = (phcExtraDetails.insuredPersonName || '').trim();
    if (current && !seen.has(current.toLowerCase())) {
      list.push({
        value: current,
        label: current,
        sublabel: 'Custom Name',
      });
    }

    return list;
  }, [insuredPerson, selectedContact, connectedPersons, phcExtraDetails.insuredPersonName]);

  const closeModal = () => {
    const returnState = location.state as any;
    const returnRoute = returnState?.returnRoute;
    const returnPayload = returnState?.returnPayload;
    setModalOpen(false);
    setIsViewMode(false);
    reset();
    setSelectedContact(null);
    setContactSearch('');
    setSelectedPolicyType('');
    setSelectedCompanyCategory('');
    setSelectedPlanCategory('');
    setCustomerCategory('Fresh');
    setSelectedAgentName(user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Rahul Mehta' : 'Rahul Mehta');
    setPolicyZoneLocationCity('');
    setPolicyZoneLocationPincode('');
    setDurationYears(1);
    setPolicyTerm('1 Year');
    setInsuredPerson('');
    setSelectedZoneTier('ZONE_1');
    setSelectedType('');
    setSelectedCompany('');
    setSelectedPlan(null);
    setPendingDocs([]);
    setConnectedPersons([]);
    setPhcExtraDetails({
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
      phcStage: 'TO_CONTACT',
    });
    setIsCustomPhcPersonManual(false);
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

    // Set Policy Type
    setSelectedPolicyType(extra.policyType || (p as any).policyType || '');

    // Set Customer Category
    const custCat = extra.customerCategory || (p.businessType ? (p.businessType === 'FRESH' ? 'Fresh' : p.businessType === 'PORT' ? 'Port' : p.businessType === 'RENEWAL' ? 'Renewal' : p.businessType) : '');
    setCustomerCategory(custCat || 'Fresh');
    setValue('customerCategory' as any, custCat || 'Fresh');

    // Set Company Category
    const compCat = extra.companyCategory || p.plan?.company?.category || '';
    const matchCompCat = INSURANCE_COMPANY_CATEGORY_OPTIONS.find(o => o.value.toLowerCase() === compCat.toLowerCase());
    setSelectedCompanyCategory(matchCompCat ? matchCompCat.value : compCat);

    // Set Plan Category
    const planCat = extra.planCategory || p.plan?.category || '';
    const matchPlanCat = INSURANCE_PLAN_CATEGORY_OPTIONS.find(o => o.value.toLowerCase() === planCat.toLowerCase());
    setSelectedPlanCategory(matchPlanCat ? matchPlanCat.value : planCat);

    // Set Agent Name
    if (extra.agentName) {
      setSelectedAgentName(extra.agentName);
    } else if (p.assignedEmployee?.employeeProfile) {
      const name = `${p.assignedEmployee.employeeProfile.firstName || ''} ${p.assignedEmployee.employeeProfile.lastName || ''}`.trim();
      setSelectedAgentName(name || (user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Rahul Mehta' : 'Rahul Mehta'));
    } else if (p.agentCode) {
      const match = agentOptions.find(o => o.agentCode === p.agentCode);
      setSelectedAgentName(match ? match.value : p.agentCode);
    } else {
      setSelectedAgentName(user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Rahul Mehta' : 'Rahul Mehta');
    }

    // Set Policy Zone Location City, Pincode, Tier
    if (extra.policyZoneLocationCity) {
      setPolicyZoneLocationCity(extra.policyZoneLocationCity);
    } else {
      setPolicyZoneLocationCity('');
    }

    if (extra.policyZoneLocationPincode) {
      setPolicyZoneLocationPincode(extra.policyZoneLocationPincode);
    } else {
      setPolicyZoneLocationPincode('');
    }

    if (extra.policyZoneLocationTier) {
      setSelectedZoneTier(extra.policyZoneLocationTier);
    }

    setSelectedType(compCat || planCat || '');

    setValue('contactId', p.contactId || '');
    if (p.contact) {
      setSelectedContact({
        id: p.contactId || p.contact.id,
        firstName: p.contact.firstName || '',
        lastName: p.contact.lastName || '',
        phone: p.contact.phone || '',
      });
    }

    if (extra.companyName) {
      setSelectedCompany(extra.companyName);
    } else if (p.plan?.company) {
      setSelectedCompany(p.plan.company?.name || '');
    }

    if (p.plan) {
      setSelectedPlan(p.plan);
      if (p.plan.category) {
        setSelectedType(p.plan.category);
      }
      setValue('planId', p.planId || p.plan?.id || '');
    }

    setValue('policyNumber', p.policyNumber || '');
    setValue('status', (p.status === 'ACTIVE' ? 'INFORCE' : p.status) || 'INFORCE');
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
    setValue('downpaymentAmount', extra.downpaymentAmount || undefined);
    setValue('processingFee', extra.processingFee || undefined);
    setValue('installmentAmount', extra.installmentAmount || extra.emiPremium || undefined);
    setValue('noOfInstallments', extra.noOfInstallments || (p as any).noOfInstallments || undefined);
    setValue('lastInstallmentDate', extra.lastInstallmentDate || extra.lastPremiumDate || p.lastPremiumDate || '');
    setValue('lastPremiumDate', extra.lastPremiumDate || extra.lastInstallmentDate || p.lastPremiumDate || '');
    setValue('emiDate', extra.emiDate || '');

    if (extra.phcAmount || extra.phcStatus || extra.phcInsuredPerson || extra.phcStage) {
      setPhcExtraDetails(prev => ({
        ...prev,
        balanceAmount: '1500',
        frequency: 'ANNUAL',
        insuredPersonName: extra.phcInsuredPerson || prev.insuredPersonName || '',
        phcStage: extra.phcStage || prev.phcStage || 'TO_CONTACT',
      }));
    }

    const parsedTenureNum = parseInt((extra.policyTenure || '').replace(/\D/g, ''), 10);
    if (!isNaN(parsedTenureNum) && parsedTenureNum > 0) {
      setDurationYears(parsedTenureNum);
    } else if (p.startDate && p.endDate) {
      const years = Math.max(1, Math.round((new Date(p.endDate).getTime() - new Date(p.startDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
      setDurationYears(years);
    } else {
      setDurationYears(1);
    }
    setPolicyTerm(extra.policyTerm || (extra.policyTenure ? extra.policyTenure : '1 Year'));
    setInsuredPerson(extra.insuredPerson || (p.contact ? `${p.contact.firstName} ${p.contact.lastName || ''}`.trim() : ''));

    let initialPersons: ConnectedPersonItem[] = [];
    if ((p as any).members && (p as any).members.length > 0) {
      initialPersons = (p as any).members.map((m: any) => ({
        id: m.id || String(Math.random()),
        name: m.name || `${m.firstName || ''} ${m.lastName || ''}`.trim(),
        relationship: m.relationship || 'Spouse',
        contactNo: m.contactNo || m.phone || '',
        dob: m.dateOfBirth ? m.dateOfBirth.slice(0, 10) : (m.dob || ''),
        gender: m.gender || 'MALE',
        isCovered: true,
        isNominee: false,
        nomineeName: '',
        nomineeRelation: 'Spouse',
        nomineeContact: '',
        nomineeDob: '',
        nomineePercentage: 100,
      }));
    } else if (extra.connectedPersons && extra.connectedPersons.length > 0) {
      initialPersons = extra.connectedPersons.map((cp: any) => ({
        id: String(Math.random()),
        name: cp.name,
        relationship: cp.relationship || 'Spouse',
        contactNo: cp.contact || '',
        dob: cp.dob || '',
        gender: cp.gender || 'MALE',
        isCovered: true,
        isNominee: false,
        nomineeName: '',
        nomineeRelation: 'Spouse',
        nomineeContact: '',
        nomineeDob: '',
        nomineePercentage: 100,
      }));
    }

    if ((p as any).nominees && (p as any).nominees.length > 0) {
      const nomList = (p as any).nominees;
      if (initialPersons.length === 0) {
        initialPersons = nomList.map((n: any) => ({
          id: n.id || String(Math.random()),
          name: n.name || '',
          relationship: n.relationship || 'Nominee',
          contactNo: n.phone || '',
          dob: n.dateOfBirth ? n.dateOfBirth.slice(0, 10) : '',
          gender: 'MALE',
          isCovered: false,
          isNominee: true,
          nomineeName: n.name || '',
          nomineeRelation: n.relationship || '',
          nomineeContact: n.phone || '',
          nomineeDob: n.dateOfBirth ? n.dateOfBirth.slice(0, 10) : '',
          nomineePercentage: n.sharePercent ?? 100,
        }));
      } else {
        initialPersons = initialPersons.map(person => {
          const match = nomList.find((n: any) => n.name?.toLowerCase() === person.name?.toLowerCase());
          if (match) {
            return {
              ...person,
              isNominee: true,
              nomineeName: match.name || person.nomineeName || person.name,
              nomineeRelation: match.relationship || person.nomineeRelation || person.relationship,
              nomineeContact: match.phone || person.nomineeContact || person.contactNo,
              nomineeDob: match.dateOfBirth ? match.dateOfBirth.slice(0, 10) : (person.nomineeDob || person.dob),
              nomineePercentage: match.sharePercent ?? person.nomineePercentage,
            };
          }
          return person;
        });
      }
    } else if (extra.nominees && extra.nominees.length > 0) {
      if (initialPersons.length === 0) {
        initialPersons = extra.nominees.map((n: any) => ({
          id: String(Math.random()),
          name: n.name || '',
          relationship: n.relationship || 'Nominee',
          contactNo: n.contact || '',
          dob: n.dob || '',
          gender: 'MALE',
          isCovered: false,
          isNominee: true,
          nomineeName: n.name || '',
          nomineeRelation: n.relationship || '',
          nomineeContact: n.contact || '',
          nomineeDob: n.dob || '',
          nomineePercentage: n.sharePercent ?? 100,
        }));
      } else {
        initialPersons = initialPersons.map(person => {
          const match = extra.nominees.find((n: any) => n.name?.toLowerCase() === person.name?.toLowerCase());
          if (match) {
            return {
              ...person,
              isNominee: true,
              nomineeName: match.name || person.nomineeName || person.name,
              nomineeRelation: match.relationship || person.nomineeRelation || person.relationship,
              nomineeContact: match.contact || person.nomineeContact || person.contactNo,
              nomineeDob: match.dob || person.nomineeDob || person.dob,
              nomineePercentage: match.sharePercent ?? person.nomineePercentage,
            };
          }
          return person;
        });
      }
    }

    setConnectedPersons(initialPersons);

    setModalOpen(true);
  };

  const openCreatePolicy = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const nextYearStr = format(addYears(new Date(), 1), 'yyyy-MM-dd');
    reset({
      paymentFrequency: 'YEARLY',
      status: 'INFORCE',
      startDate: todayStr,
      endDate: nextYearStr,
      maturityDate: nextYearStr,
      firstPremiumDate: todayStr,
      noOfInstallments: 1,
      downpaymentAmount: 0,
      processingFee: 0,
      installmentAmount: 0,
      lastInstallmentDate: todayStr,
      lastPremiumDate: todayStr,
      notes: '',
      policyNumber: '',
      sumAssured: undefined,
      premiumAmount: undefined,
      contactId: '',
      planId: '',
      riders: [],
    } as any);
    setSelectedContact(null);
    setContactSearch('');
    setSelectedPlan(null);
    setSelectedCompany('');
    setSelectedPolicyType('');
    setSelectedCompanyCategory('');
    setSelectedPlanCategory('');
    setDurationYears(1);
    setPolicyTerm('1 Year');
    setInsuredPerson('');
    setConnectedPersons([]);
    setPendingDocs([]);
    setEditTarget(null);
    setIsViewMode(false);
    setIsPremiumBreakdownCollapsed(false);
    setIsTenureDatesCollapsed(false);
    setIsPolicyDetailsCollapsed(false);
    setIsPlanDetailsCollapsed(false);
    setActivePolicyTab('policyPlan');
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
            checked={rawPolicies.length > 0 && selectedIds.length === rawPolicies.length}
            onChange={e => {
              if (e.target.checked) {
                setSelectedIds(rawPolicies.map((p: any) => p.id));
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
        render: r => {
          const name = r.contact ? `${r.contact.firstName} ${r.contact.lastName || ''}`.trim() : '—';
          return (
            <span className="font-extrabold text-slate-900 text-xs hover:text-blue-600 transition-colors">
              {name}
            </span>
          );
        }
      },
      {
        key: 'proposerContact',
        label: 'Proposer Contact No.',
        sortable: true,
        render: r => <span className="font-bold text-slate-800 text-xs">{r.contact?.phone || '—'}</span>
      },
      {
        key: 'insuredPerson',
        label: 'Insured Person',
        sortable: true,
        render: r => {
          const extra = parseExtraNotes(r.notes);
          const name = extra.insuredPerson || (r.contact ? `${r.contact.firstName} ${r.contact.lastName || ''}`.trim() : '—');
          return <span className="font-extrabold text-slate-900 text-xs">{name}</span>;
        }
      },
      {
        key: 'city',
        label: 'City',
        sortable: true,
        render: r => {
          const extra = parseExtraNotes(r.notes);
          return <span className="font-bold text-slate-800 text-xs">{extra.policyZoneLocationCity || (r.contact as any)?.address?.city || (r.contact as any)?.city || '—'}</span>;
        }
      },
      {
        key: 'companyCategory',
        label: 'Insurance Company Category',
        sortable: true,
        render: r => {
          const extra = parseExtraNotes(r.notes);
          const val = extra.companyCategory || r.plan?.company?.category || (r as any).insuranceCompanyCategory || '—';
          return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-slate-100 text-slate-800 border border-slate-200">{val}</span>;
        }
      },
      {
        key: 'plan.company.name',
        label: 'Insurance Company',
        sortable: true,
        render: r => {
          const extra = parseExtraNotes(r.notes);
          return <span className="font-extrabold text-slate-900 text-xs">{extra.companyName || (r.plan?.company ? r.plan.company.name : '—')}</span>;
        }
      },
      {
        key: 'plan.category',
        label: 'Insurance Plan Category',
        sortable: true,
        render: r => {
          const extra = parseExtraNotes(r.notes);
          return <span className="font-bold text-slate-800 text-xs">{extra.planCategory || r.plan?.category || '—'}</span>;
        }
      },
      {
        key: 'plan.name',
        label: 'Plan Name',
        sortable: true,
        render: r => <span className="font-extrabold text-blue-900 text-xs">{r.plan?.name ? r.plan.name : '—'}</span>
      },
      {
        key: 'customerCategory',
        label: 'Customer Category',
        render: r => {
          const extra = parseExtraNotes(r.notes);
          return <span className="font-bold text-slate-800 text-xs">{extra.customerCategory || (r.businessType ? (r.businessType === 'FRESH' ? 'Fresh' : r.businessType === 'PORT' ? 'Port' : r.businessType === 'RENEWAL' ? 'Renewal' : r.businessType) : '') || (r.contact as any)?.category || (r as any).customerCategory || '—'}</span>;
        }
      },
      {
        key: 'policyType',
        label: 'Policy Type',
        render: r => {
          const extra = parseExtraNotes(r.notes);
          return <span className="font-bold text-slate-800 text-xs">{extra.policyType || (r as any).policyType || r.plan?.category || '—'}</span>;
        }
      },
      {
        key: 'policyNumber',
        label: 'Policy Number',
        sortable: true,
        render: r => <span className="font-black text-slate-900 text-xs tracking-tight bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">{r.policyNumber || '—'}</span>
      },
      {
        key: 'status',
        label: 'Policy Status',
        sortable: true,
        render: r => {
          const { label, badgeClass } = getPolicyStatusDisplay(r);
          return (
            <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-extrabold uppercase tracking-wide border', badgeClass)}>
              {label}
            </span>
          );
        }
      },
      {
        key: 'sumAssured',
        label: 'Sum Insured',
        sortable: true,
        render: r => <span className="font-extrabold text-slate-900 text-xs">{r.sumAssured ? `₹${Number(r.sumAssured).toLocaleString('en-IN')}` : '—'}</span>
      },
      {
        key: 'policyTenure',
        label: 'Policy Tenure',
        render: r => {
          const extra = parseExtraNotes(r.notes);
          if (extra.policyTenure) return <span className="font-bold text-slate-800 text-xs">{extra.policyTenure}</span>;
          if (r.startDate && r.endDate) {
            const years = Math.max(1, Math.round((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
            return <span className="font-bold text-slate-800 text-xs">{`${years} ${years === 1 ? 'Year' : 'Years'}`}</span>;
          }
          return <span className="font-bold text-slate-800 text-xs">{(r as any).tenure || (r as any).duration || '—'}</span>;
        }
      },
      {
        key: 'policyTerm',
        label: 'Policy Term (Period of Coverage in Years)',
        render: r => {
          if (!r.startDate || !r.endDate) return <span className="font-bold text-slate-800 text-xs">{(r as any).policyTerm ? `${(r as any).policyTerm} Years` : '—'}</span>;
          const years = Math.max(1, Math.round((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
          return <span className="font-bold text-slate-800 text-xs">{`${years} ${years === 1 ? 'Year' : 'Years'}`}</span>;
        }
      },
      {
        key: 'assignedTo',
        label: 'Assigned To',
        render: r => {
          const empName = r.assignedEmployee?.employeeProfile
            ? `${r.assignedEmployee.employeeProfile.firstName} ${r.assignedEmployee.employeeProfile.lastName}`
            : ((r.assignedEmployee as any)?.firstName ? `${(r.assignedEmployee as any).firstName} ${(r.assignedEmployee as any).lastName || ''}` : '—');
          return <span className="font-bold text-slate-800 text-xs">{empName}</span>;
        }
      },
      {
        key: 'comment',
        label: 'Comment',
        render: r => <ExpandableComment text={r.notes ? (parseExtraNotes(r.notes).cleanNotes || r.notes) : ''} />
      },
      {
        key: 'firstYearPremium',
        label: '1st Year Premium Amount',
        render: r => {
          const val = (r as any).firstYearPremium ? `₹${Number((r as any).firstYearPremium).toLocaleString('en-IN')}` : (r.premiumAmount ? `₹${Number(r.premiumAmount).toLocaleString('en-IN')}` : '—');
          return <span className="font-extrabold text-slate-900 text-xs">{val}</span>;
        }
      },
      {
        key: 'secondYearPremium',
        label: '2nd Year Onwards Premium Amount',
        render: r => {
          const val = (r as any).secondYearPremium ? `₹${Number((r as any).secondYearPremium).toLocaleString('en-IN')}` : (r.premiumAmount ? `₹${Number(r.premiumAmount).toLocaleString('en-IN')}` : '—');
          return <span className="font-extrabold text-slate-900 text-xs">{val}</span>;
        }
      },
      {
        key: 'premiumAmount',
        label: 'Premium Amount',
        sortable: true,
        render: r => <span className="font-extrabold text-slate-900 text-xs">{r.premiumAmount ? `₹${Number(r.premiumAmount).toLocaleString('en-IN')}` : '—'}</span>
      },
      {
        key: 'installmentCase',
        label: 'Installment Case?',
        render: r => {
          const isEmi = parseExtraNotes(r.notes).emiCase;
          return (
            <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase', isEmi ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-50 text-slate-600 border border-slate-200')}>
              {isEmi ? 'Yes' : 'No'}
            </span>
          );
        }
      },
      {
        key: 'downpaymentAmount',
        label: 'Downpayment Amount',
        render: r => {
          const extra = parseExtraNotes(r.notes);
          return <span className="font-bold text-slate-800 text-xs">{extra.downpaymentAmount ? `₹${Number(extra.downpaymentAmount).toLocaleString('en-IN')}` : '—'}</span>;
        }
      },
      {
        key: 'processingFee',
        label: 'Processing Fee (incl. GST)',
        render: r => {
          const extra = parseExtraNotes(r.notes);
          return <span className="font-bold text-slate-800 text-xs">{extra.processingFee ? `₹${Number(extra.processingFee).toLocaleString('en-IN')}` : '—'}</span>;
        }
      },
      {
        key: 'installmentAmount',
        label: 'Installment Amount',
        render: r => {
          const extra = parseExtraNotes(r.notes);
          const amt = extra.installmentAmount || extra.emiPremium;
          return <span className="font-bold text-slate-800 text-xs">{amt ? `₹${Number(amt).toLocaleString('en-IN')}` : '—'}</span>;
        }
      },
      {
        key: 'noOfInstallments',
        label: 'No. of Installments',
        render: r => {
          const extra = parseExtraNotes(r.notes);
          return <span className="font-bold text-slate-800 text-xs">{extra.noOfInstallments || (r as any).noOfInstallments || '—'}</span>;
        }
      },
      {
        key: 'lastInstallmentDate',
        label: 'Last Installment Date',
        render: r => {
          const extra = parseExtraNotes(r.notes);
          const d = extra.lastInstallmentDate || extra.lastPremiumDate || r.lastPremiumDate;
          return <span className="font-bold text-slate-800 text-xs">{d ? d.slice(0, 10) : '—'}</span>;
        }
      },
      {
        key: 'nomineeDetails',
        label: 'Nominee Details',
        render: r => {
          const extra = parseExtraNotes(r.notes);
          if (extra.nominees && extra.nominees.length > 0) {
            const nom = extra.nominees[0];
            return (
              <div className="text-xs">
                <span className="font-extrabold text-purple-900">{nom.name}</span>
                <span className="text-slate-500 font-medium ml-1">({nom.relationship})</span>
                {nom.dob && <span className="block text-[10px] text-slate-500 font-medium">DoB: {nom.dob}</span>}
              </div>
            );
          }
          if ((r as any).nominees && (r as any).nominees.length > 0) {
            const nom = (r as any).nominees[0];
            return (
              <div className="text-xs">
                <span className="font-extrabold text-purple-900">{nom.name}</span>
                <span className="text-slate-500 font-medium ml-1">({nom.relationship})</span>
                {nom.dateOfBirth && <span className="block text-[10px] text-slate-500 font-medium">DoB: {nom.dateOfBirth.slice(0, 10)}</span>}
              </div>
            );
          }
          return <span className="text-slate-400 text-xs">—</span>;
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
    if (body.phcRequired || watchPhcRequired) {
      extraNotes += `\nPreventive Health Checkup: Yes (Amount: ₹${body.phcAmount || '0'}, Status: ${body.phcStatus || 'N/A'}, Claim Settled: ${body.phcClaimSettled ? 'Yes' : 'No'}${phcExtraDetails.insuredPersonName ? `, Insured Person: ${phcExtraDetails.insuredPersonName}` : ''})`;
      if (phcExtraDetails.insuredPersonName) {
        extraNotes += `\nPHC Insured Person: ${phcExtraDetails.insuredPersonName}`;
      }
      if (phcExtraDetails.phcStage) {
        extraNotes += `\nPHC Stage: ${phcExtraDetails.phcStage}`;
      }
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

  const onInvalid = (errors: any) => {
    console.warn('[Policy Form Validation Error]', errors);
    const errKeys = Object.keys(errors);
    if (errKeys.length === 0) return;
    const firstKey = errKeys[0];
    const fieldLabelMap: Record<string, string> = {
      contactId: 'Customer / Client Name',
      planId: 'Insurance Plan',
      policyNumber: 'Policy Number',
      sumAssured: 'Sum Assured',
      premiumAmount: 'Premium Amount',
      startDate: 'Policy Start Date',
      endDate: 'Policy End Date',
      paymentFrequency: 'Payment Frequency',
      riders: 'Riders / Addons',
      firstPremiumDate: '1st Instalment Date',
      noOfInstallments: 'No. of Installments',
      lastInstallmentDate: 'Last Installment Date',
      insuredPerson: 'Insured Person',
    };
    const fieldName = fieldLabelMap[firstKey] || firstKey;
    const rawMsg = errors[firstKey]?.message;
    const errMsg = rawMsg ? `${fieldName}: ${rawMsg}` : `Please check ${fieldName}`;
    toast.error(errMsg);

    if (['contactId', 'planId', 'policyNumber', 'sumAssured', 'notes'].includes(firstKey)) {
      setActivePolicyTab('policyPlan');
    } else if (['premiumAmount', 'startDate', 'endDate', 'paymentFrequency', 'noOfInstallments', 'installmentAmount', 'firstYearPremium', 'secondYearPremium'].includes(firstKey)) {
      setActivePolicyTab('premium');
    }
  };

  const onSubmit = async (body: Form) => {
    try {
      // 1. Resolve contact & plan
      const finalContactId = body.contactId || selectedContact?.id;
      if (!finalContactId) {
        toast.error('Please select a Customer in Tab 1 (Policy & Plan Details)');
        setActivePolicyTab('policyPlan');
        return;
      }

      let finalPlanId = body.planId;
      if (!finalPlanId && selectedPlan?.id) finalPlanId = selectedPlan.id;
      if (!finalPlanId && availablePlans.length > 0) finalPlanId = availablePlans[0].id;
      if (!finalPlanId && plansList.length > 0) finalPlanId = plansList[0].id;

      if (!finalPlanId) {
        toast.error('Please select an Insurance Plan in Tab 1 (Policy & Plan Details)');
        setActivePolicyTab('policyPlan');
        return;
      }

      if (!body.policyNumber?.trim()) {
        toast.error('Please enter Policy Number in Tab 1 (Policy & Plan Details)');
        setActivePolicyTab('policyPlan');
        return;
      }

      // Validate Connected Persons if any are added
      if (connectedPersons.length > 0) {
        for (let i = 0; i < connectedPersons.length; i++) {
          const p = connectedPersons[i];
          if (!p.name.trim()) {
            toast.error(`Please enter Full Name for Person ${i + 1} in Connected Persons tab`);
            setActivePolicyTab('connectedPersons');
            return;
          }
          if (p.contactNo && p.contactNo.trim().length > 0 && p.contactNo.trim().length !== 10) {
            toast.error(`Contact number for "${p.name.trim()}" must be 10 digits`);
            setActivePolicyTab('connectedPersons');
            return;
          }
          if (p.isNominee) {
            const nomName = p.nomineeName?.trim() || p.name.trim();
            if (!nomName) {
              toast.error(`Please enter Nominee Name for Person ${i + 1} in Connected Persons tab`);
              setActivePolicyTab('connectedPersons');
              return;
            }
            const nomContact = p.nomineeContact || p.contactNo;
            if (nomContact && nomContact.trim().length > 0 && nomContact.trim().length !== 10) {
              toast.error(`Nominee contact number for "${nomName}" must be 10 digits`);
              setActivePolicyTab('connectedPersons');
              return;
            }
          }
        }
      }

      const assignedEmployeeId = body.assignedEmployeeId?.trim() ? body.assignedEmployeeId : undefined;

      const finalStartDate = body.startDate || format(new Date(), 'yyyy-MM-dd');
      const finalEndDate = body.endDate || format(addYears(new Date(finalStartDate), Number(durationYears) || 1), 'yyyy-MM-dd');
      const finalMaturityDate = body.maturityDate || finalEndDate;
      const finalLastInstDate = body.lastInstallmentDate || body.lastPremiumDate || watch('lastInstallmentDate') || watch('lastPremiumDate') || '';
      const finalNoOfInst = body.noOfInstallments || watch('noOfInstallments') || (body.paymentFrequency === 'SINGLE' ? 1 : undefined);

      // 2. Format notes to include extra Excel fields
      let extraNotes = '';
      if (selectedPolicyType) extraNotes += `\nPolicy Type: ${selectedPolicyType}`;
      const custCat = customerCategory || watch('customerCategory' as any) || 'Fresh';
      if (custCat) extraNotes += `\nCustomer Category: ${custCat}`;
      if (selectedCompanyCategory) extraNotes += `\nInsurance Company Category: ${selectedCompanyCategory}`;
      if (selectedCompany) extraNotes += `\nInsurance Company: ${selectedCompany}`;
      if (selectedPlanCategory) extraNotes += `\nInsurance Plan Category: ${selectedPlanCategory}`;
      if (selectedAgentName) extraNotes += `\nAgent Name: ${selectedAgentName}`;
      if (policyZoneLocationCity) {
        extraNotes += `\nPolicy Zone City: ${policyZoneLocationCity}`;
        extraNotes += `\nPolicy Zone Location City: ${policyZoneLocationCity}`;
      }
      if (policyZoneLocationPincode) extraNotes += `\nPolicy Zone Location Pincode: ${policyZoneLocationPincode}`;
      if (selectedZoneTier) extraNotes += `\nPolicy Zone Location Tier: ${selectedZoneTier}`;
      if (durationYears) {
        extraNotes += `\nPolicy Tenure: ${durationYears} ${Number(durationYears) === 1 ? 'Year' : 'Years'}`;
      }
      if (policyTerm) {
        extraNotes += `\nPolicy Term: ${policyTerm}`;
      }
      if (insuredPerson) {
        extraNotes += `\nInsured Person: ${insuredPerson}`;
      }
      if (body.deductible) extraNotes += `\nDeductible: ${body.deductible}`;
      if (body.riders && body.riders.length > 0) extraNotes += `\nRiders/Addons: ${body.riders.join(', ')}`;
      if (body.firstPremiumDate) extraNotes += `\nFirst Premium Date: ${body.firstPremiumDate}`;
      if (body.premiumPaymentPeriod) extraNotes += `\nPremium Payment Period: ${body.premiumPaymentPeriod} Years`;
      if (finalLastInstDate) extraNotes += `\nLast Premium Date: ${finalLastInstDate}`;
      if (body.downpaymentAmount) extraNotes += `\nDownpayment Amount: ₹${body.downpaymentAmount}`;
      if (body.processingFee) extraNotes += `\nProcessing Fee (incl. GST): ₹${body.processingFee}`;
      if (body.installmentAmount || body.emiPremium) {
        const amt = body.installmentAmount || body.emiPremium;
        extraNotes += `\nInstallment Amount: ₹${amt}`;
      }
      if (finalNoOfInst) extraNotes += `\nNo. of Installments: ${finalNoOfInst}`;
      if (finalLastInstDate) {
        extraNotes += `\nLast Installment Date: ${finalLastInstDate}`;
      }
      if (body.emiCase) {
        extraNotes += `\nEMI Case: Yes (Gateway: ${body.emiGateway || 'N/A'}, Date: ${body.emiDate || 'N/A'}, Premium: ₹${body.emiPremium || body.installmentAmount || '0'}, Downpayment: ₹${body.downpaymentAmount || '0'}, Processing Fee: ₹${body.processingFee || '0'}, No of Installments: ${finalNoOfInst || 'N/A'}, Last Installment Date: ${finalLastInstDate || 'N/A'})`;
      }
      if (body.phcRequired || watchPhcRequired) {
        extraNotes += `\nPreventive Health Checkup: Yes (Amount: ₹${body.phcAmount || '0'}, Status: ${body.phcStatus || 'N/A'}, Claim Settled: ${body.phcClaimSettled ? 'Yes' : 'No'}${phcExtraDetails.insuredPersonName ? `, Insured Person: ${phcExtraDetails.insuredPersonName}` : ''})`;
        if (phcExtraDetails.insuredPersonName) {
          extraNotes += `\nPHC Insured Person: ${phcExtraDetails.insuredPersonName}`;
        }
        if (phcExtraDetails.phcStage) {
          extraNotes += `\nPHC Stage: ${phcExtraDetails.phcStage}`;
        }
      }
      if (connectedPersons.length > 0) {
        connectedPersons.forEach((p, idx) => {
          if (p.name.trim()) {
            extraNotes += `\nConnected Person ${idx + 1}: Name: ${p.name.trim()}, Relationship: ${p.relationship}, Contact: ${p.contactNo || 'N/A'}, DoB: ${p.dob || 'N/A'}, Gender: ${p.gender || 'MALE'}`;
          }
          if (p.isNominee) {
            extraNotes += `\nNominee Details ${idx + 1}: Name: ${p.nomineeName?.trim() || p.name.trim()}, Relationship: ${p.nomineeRelation || p.relationship}, Contact: ${p.nomineeContact || p.contactNo || 'N/A'}, DoB: ${p.nomineeDob || p.dob || 'N/A'}, Share: ${p.nomineePercentage}%`;
          }
        });
      }
      if (body.notes) extraNotes += `\n${body.notes}`;

      // 3. Assemble clean DTO
      const cleanedBody = {
        policyNumber: body.policyNumber.trim(),
        contactId: finalContactId,
        planId: finalPlanId,
        assignedEmployeeId,
        status: body.status || 'INFORCE',
        sumAssured: Number(body.sumAssured || 0),
        premiumAmount: Number(body.premiumAmount || 0),
        paymentFrequency: body.paymentFrequency || 'YEARLY',
        startDate: finalStartDate,
        endDate: finalEndDate,
        maturityDate: finalMaturityDate,
        businessType: (custCat || 'Fresh').toUpperCase(),
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
        for (const person of connectedPersons) {
          if (person.name.trim()) {
            try {
              await policiesService.addMember(editTarget.id, {
                name: person.name.trim(),
                relationship: person.relationship || 'Spouse',
                dateOfBirth: person.dob ? new Date(person.dob).toISOString() : undefined,
                gender: person.gender || 'MALE',
              });
            } catch { /* ignore */ }
            if (person.isNominee) {
              try {
                await policiesService.addNominee(editTarget.id, {
                  name: person.nomineeName?.trim() || person.name.trim(),
                  relationship: person.nomineeRelation || person.relationship || 'Other',
                  sharePercent: Number(person.nomineePercentage) || 100,
                  dateOfBirth: (person.nomineeDob || person.dob) ? new Date(person.nomineeDob || person.dob).toISOString() : undefined,
                  phone: person.nomineeContact || person.contactNo || undefined,
                });
              } catch { /* ignore */ }
            }
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
      if (createdPolicy?.id) {
        for (const person of connectedPersons) {
          if (person.name.trim()) {
            try {
              await policiesService.addMember(createdPolicy.id, {
                name: person.name.trim(),
                relationship: person.relationship || 'Spouse',
                dateOfBirth: person.dob ? new Date(person.dob).toISOString() : undefined,
                gender: person.gender || 'MALE',
              });
            } catch { /* ignore */ }
            if (person.isNominee) {
              try {
                await policiesService.addNominee(createdPolicy.id, {
                  name: person.nomineeName?.trim() || person.name.trim(),
                  relationship: person.nomineeRelation || person.relationship || 'Other',
                  sharePercent: Number(person.nomineePercentage) || 100,
                  dateOfBirth: (person.nomineeDob || person.dob) ? new Date(person.nomineeDob || person.dob).toISOString() : undefined,
                  phone: person.nomineeContact || person.contactNo || undefined,
                });
              } catch { /* ignore */ }
            }
          }
        }
      }
      await qc.invalidateQueries({ queryKey: ['policies'] });
      await qc.refetchQueries({ queryKey: ['policies'] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
      setSelectedQuickFilter('ALL');
      setSearch('');
      setSortBy('createdAt');
      setSortOrder('desc');
      setPage(1);
      toast.success('Policy created successfully');
      if (createdPolicy?.id) {
        if (keepCreateOpen) {
          reset({
            contactId: body.contactId,
            paymentFrequency: 'YEARLY',
            customerCategory: 'Fresh',
          } as any);
          setSelectedPlan(null);
          setSelectedPolicyType('');
          setSelectedCompanyCategory('');
          setSelectedPlanCategory('');
          setCustomerCategory('Fresh');
          setSelectedAgentName(user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Rahul Mehta' : 'Rahul Mehta');
          setPolicyZoneLocationCity('');
          setPolicyZoneLocationPincode('');
          setSelectedZoneTier('ZONE_1');
          setSelectedType('');
          setSelectedCompany('');
          setPendingDocs([]);
          setConnectedPersons([]);
          setDurationYears(1);
          setPolicyTerm('1 Year');
          setInsuredPerson('');
          return;
        }
        setPage(1);
        closeModal();
        if ((location.state as any)?.returnRoute) {
          navigate((location.state as any).returnRoute, {
            replace: true,
            state: (location.state as any).returnPayload,
          });
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
    <div className="space-y-4 text-sm sm:text-base">
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
            >
              <Upload size={18} strokeWidth={2.2} />
              <span className="absolute right-full mr-3 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl border border-slate-800">
                Import Policy CSV
              </span>
            </button>

            {/* Add New Policy */}
            <button
              type="button"
              onClick={openCreatePolicy}
              className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center justify-center transition-all hover:scale-105 shadow-lg shadow-blue-500/30 cursor-pointer group relative"
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
              {/* Left Side: Search Bar & Inline Quick Filters (matching Claims & Installments UI) */}
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
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

                <div className="h-6 w-px bg-slate-200 hidden md:block shrink-0" />

                {/* Quick Filters Inline Pills */}
                <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5 min-w-0">
                  <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mr-0.5 flex items-center gap-1 shrink-0">
                    <Filter size={13} className="text-blue-500" /> Quick:
                  </span>
                  {[
                    { key: 'ALL', label: 'All Types' },
                    { key: 'HEALTH', label: 'Health', icon: '🩺' },
                    { key: 'LIFE', label: 'Life', icon: '🛡️' },
                    { key: 'MOTOR', label: 'Motor', icon: '🚗' },
                    { key: 'GENERAL', label: 'General', icon: '🏢' },
                    { key: 'ACCIDENT', label: 'Accident', icon: '🚑' },
                    { key: 'FRESH', label: 'Fresh', icon: '🌟' },
                    { key: 'PORT', label: 'Port', icon: '🔄' },
                    { key: 'RENEWAL', label: 'Renewal', icon: '📅' },
                  ].map(q => {
                    const isSel = selectedQuickFilter === q.key;
                    return (
                      <button
                        key={q.key}
                        onClick={() => { setSelectedQuickFilter(q.key); setPage(1); }}
                        className={clsx(
                          'inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs whitespace-nowrap shrink-0',
                          isSel
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm scale-105'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                        )}
                      >
                        {q.icon && <span>{q.icon}</span>}
                        <span>{q.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Side: Column Picker & Filters Toggle */}
              <div className="flex flex-wrap items-center gap-2.5 justify-end shrink-0">

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
                    {INSURANCE_COMPANY_CATEGORY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
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
                    {INSURANCE_PLAN_CATEGORY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
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
                  <label className="label text-[11px] font-bold text-slate-600">Business / Customer Category</label>
                  <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={tempFilters.businessCategory} onChange={e => setTempFilters({ ...tempFilters, businessCategory: e.target.value })}>
                    <option value="">All Categories</option>
                    {CUSTOMER_CATEGORY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* 6. Policy Type */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Policy Type</label>
                  <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={tempFilters.policyType} onChange={e => setTempFilters({ ...tempFilters, policyType: e.target.value })}>
                    <option value="">All Types</option>
                    {POLICY_TYPE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
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

                {/* Insured Person Filter */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Insured Person</label>
                  <input
                    type="text"
                    placeholder="Search insured person..."
                    className="input text-xs w-full bg-white shadow-2xs mt-1"
                    value={tempFilters.insuredPerson}
                    onChange={e => setTempFilters({ ...tempFilters, insuredPerson: e.target.value })}
                  />
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
                  <label className="label text-[11px] font-bold text-slate-600">Policy Tenure (1 to 99 Yr)</label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      placeholder="Type tenure (1-99)..."
                      className="input text-xs w-full bg-white shadow-2xs pr-10"
                      value={tempFilters.policyTenure}
                      onChange={e => setTempFilters({ ...tempFilters, policyTenure: e.target.value })}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 pointer-events-none">
                      Yr
                    </span>
                  </div>
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
                    <DatePicker className="input text-xs w-full shadow-2xs" value={tempFilters.startDateFrom} onDateChange={val => setTempFilters({ ...tempFilters, startDateFrom: val })} title="From" />
                    <span className="text-gray-400 font-bold">-</span>
                    <DatePicker className="input text-xs w-full shadow-2xs" value={tempFilters.startDateTo} onDateChange={val => setTempFilters({ ...tempFilters, startDateTo: val })} title="To" />
                  </div>
                </div>

                {/* 20. Policy End Date */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Policy End Date</label>
                  <div className="flex gap-2 items-center mt-1">
                    <DatePicker className="input text-xs w-full shadow-2xs" value={tempFilters.endDateFrom} onDateChange={val => setTempFilters({ ...tempFilters, endDateFrom: val })} title="From" />
                    <span className="text-gray-400 font-bold">-</span>
                    <DatePicker className="input text-xs w-full shadow-2xs" value={tempFilters.endDateTo} onDateChange={val => setTempFilters({ ...tempFilters, endDateTo: val })} title="To" />
                  </div>
                </div>

                {/* 21. Policy 1st Inception Date */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Policy 1st Inception Date</label>
                  <div className="flex gap-2 items-center mt-1">
                    <DatePicker className="input text-xs w-full shadow-2xs" value={tempFilters.firstInceptionFrom} onDateChange={val => setTempFilters({ ...tempFilters, firstInceptionFrom: val })} title="From" />
                    <span className="text-gray-400 font-bold">-</span>
                    <DatePicker className="input text-xs w-full shadow-2xs" value={tempFilters.firstInceptionTo} onDateChange={val => setTempFilters({ ...tempFilters, firstInceptionTo: val })} title="To" />
                  </div>
                </div>

                {/* 22. Policy Status */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Policy Status</label>
                  <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={tempFilters.status} onChange={e => setTempFilters({ ...tempFilters, status: e.target.value })}>
                    <option value="">All Statuses</option>
                    <option value="INFORCE">Inforce</option>
                    <option value="RENEWAL_DUE">Renewal Due</option>
                    <option value="GRACE_PERIOD">Grace Period</option>
                    <option value="LAPSED">Lapsed</option>
                    <option value="INACTIVE_OLD">Inactive(Old)</option>
                    <option value="CANCELLED">Cancelled</option>
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
                    <DatePicker className="input text-xs w-full shadow-2xs" value={tempFilters.firstInstallmentFrom} onDateChange={val => setTempFilters({ ...tempFilters, firstInstallmentFrom: val })} title="From" />
                    <span className="text-gray-400 font-bold">-</span>
                    <DatePicker className="input text-xs w-full shadow-2xs" value={tempFilters.firstInstallmentTo} onDateChange={val => setTempFilters({ ...tempFilters, firstInstallmentTo: val })} title="To" />
                  </div>
                </div>

                {/* 29. Last Installment Date */}
                <div>
                  <label className="label text-[11px] font-bold text-slate-600">Last Installment Date</label>
                  <div className="flex gap-2 items-center mt-1">
                    <DatePicker className="input text-xs w-full shadow-2xs" value={tempFilters.lastInstallmentFrom} onDateChange={val => setTempFilters({ ...tempFilters, lastInstallmentFrom: val })} title="From" />
                    <span className="text-gray-400 font-bold">-</span>
                    <DatePicker className="input text-xs w-full shadow-2xs" value={tempFilters.lastInstallmentTo} onDateChange={val => setTempFilters({ ...tempFilters, lastInstallmentTo: val })} title="To" />
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
                onClick={handleSubmit(onSubmit, onInvalid)}
              >
                {editTarget ? 'Update Policy' : 'Save Policy'}
              </button>
            )}
          </div>
        }
      >
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-3">
          {/* Sub-navigation Tabs Header */}
          <div className="flex flex-wrap bg-slate-200/60 p-1.5 rounded-2xl mb-3 gap-1.5 sm:gap-2 border border-slate-200/80 shadow-2xs">
            <button
              type="button"
              onClick={() => setActivePolicyTab('policyPlan')}
              className={clsx(
                'px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 sm:gap-2',
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
                'px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 sm:gap-2',
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
                'px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 sm:gap-2',
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
              onClick={() => {
                setActivePolicyTab('phcDetails');
                if (watchPhcRequired === undefined) {
                  setValue('phcRequired', true);
                  if (!selectedCompanyCategory) {
                    handleCompanyCategoryChange('Health');
                  }
                }
              }}
              className={clsx(
                'px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 sm:gap-2',
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
                'px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 sm:gap-2',
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
                'px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 sm:gap-2',
                activePolicyTab === 'policyClaims'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              )}
            >
              <FileCheck2 size={14} />
              Claims
            </button>
          </div>

          <div className="space-y-4">
            <fieldset disabled={isViewMode} className="min-w-0 border-0 p-0 m-0 w-full">
              {/* ════════════════ TAB 1: Policy Details + Plan Details ════════════════ */}
              {activePolicyTab === 'policyPlan' && (
                <div className="space-y-4 animate-fadeIn">
                  {/* Section 1: Policy Details */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
                    <div
                      className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none rounded-t-2xl"
                      onClick={() => setIsPolicyDetailsCollapsed(prev => !prev)}
                    >
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">1</span>
                        Policy Details
                      </h4>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] text-slate-700 font-bold">Base Policy Configuration</span>
                        <ChevronDown
                          size={16}
                          className={`text-slate-500 transition-transform duration-200 ${isPolicyDetailsCollapsed ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </div>

                    {!isPolicyDetailsCollapsed && (
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {/* Customer Picker */}
                        <div className="relative flex flex-col gap-1">
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-0.5">
                            Customer <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
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
                                  if (!insuredPerson) {
                                    setInsuredPerson(`${c.firstName || ''} ${c.lastName || ''}`.trim());
                                  }
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

                        {/* Insured Person */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Insured Person
                          </label>
                          <input
                            type="text"
                            value={insuredPerson}
                            onChange={e => setInsuredPerson(e.target.value)}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-800"
                            placeholder="e.g. Self / Name of Insured Person"
                          />
                        </div>

                        {/* Policy Type */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Policy Type <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                          </label>
                          <CustomSelect
                            value={selectedPolicyType}
                            onChange={val => setSelectedPolicyType(val)}
                            placeholder="Select Policy Type"
                            options={[
                              { value: '', label: 'Select Policy Type' },
                              ...POLICY_TYPE_OPTIONS
                            ]}
                          />
                        </div>

                        {/* Insurance Company Category */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Insurance Company Category <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                          </label>
                          <CustomSelect
                            value={selectedCompanyCategory}
                            onChange={val => handleCompanyCategoryChange(val)}
                            placeholder="Select Insurance Company Category *"
                            options={[
                              { value: '', label: 'Select Insurance Company Category *' },
                              ...INSURANCE_COMPANY_CATEGORY_OPTIONS
                            ]}
                          />
                        </div>

                        {/* Insurance Company */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Insurance Company <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                          </label>
                          <CustomSelect
                            value={selectedCompany}
                            onChange={val => handleCompanyChange(val)}
                            placeholder="Select Insurance Company *"
                            searchable
                            options={[
                              { value: '', label: 'Select Insurance Company *' },
                              ...availableCompanies.map(c => ({ value: c, label: c }))
                            ]}
                          />
                        </div>

                        {/* Insurance Plan Category */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Insurance Plan Category <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                          </label>
                          <CustomSelect
                            value={selectedPlanCategory}
                            onChange={val => handlePlanCategoryChange(val)}
                            placeholder="Select Insurance Plan Category *"
                            options={[
                              { value: '', label: 'Select Insurance Plan Category *' },
                              ...INSURANCE_PLAN_CATEGORY_OPTIONS
                            ]}
                          />
                        </div>

                        {/* Plan Name */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Plan Name <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                          </label>
                          <CustomSelect
                            value={selectedPlan?.id || ''}
                            onChange={val => {
                              const p = plansList.find((x: any) => x.id === val);
                              setSelectedPlan(p || null);
                              setValue('planId', p?.id || '', { shouldValidate: true });
                            }}
                            disabled={!selectedCompany}
                            placeholder={selectedCompany ? 'Select Plan Name' : 'Select Company First'}
                            searchable
                            options={[
                              { value: '', label: selectedCompany ? 'Select Plan Name' : 'Select Company First' },
                              ...availablePlans.map((p: any) => ({ value: p.id, label: p.name }))
                            ]}
                          />
                        </div>

                        {/* Customer Category */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Customer Category
                          </label>
                          <CustomSelect
                            value={customerCategory}
                            onChange={val => {
                              setCustomerCategory(val);
                              setValue('customerCategory' as any, val);
                            }}
                            placeholder="Select Customer Category"
                            options={[
                              { value: '', label: 'Select Customer Category' },
                              ...CUSTOMER_CATEGORY_OPTIONS
                            ]}
                          />
                        </div>

                        {/* Agent Name */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Agent Name
                          </label>
                          <CustomSelect
                            value={selectedAgentName}
                            onChange={val => {
                              setSelectedAgentName(val);
                              const match = agentOptions.find(o => o.value === val);
                              if (match?.empId) setValue('assignedEmployeeId', match.empId, { shouldDirty: true });
                              if (match?.agentCode) setValue('agentCode', match.agentCode, { shouldDirty: true });
                            }}
                            placeholder="Select Agent Name"
                            searchable
                            options={[
                              { value: '', label: 'Select Agent Name' },
                              ...agentOptions.map(o => ({ value: o.value, label: o.label }))
                            ]}
                          />
                        </div>

                        {/* Comment */}
                        <div className="col-span-1 md:col-span-2">
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Comment <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
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
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
                    <div
                      className="bg-gradient-to-r from-indigo-50/80 via-slate-50 to-purple-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none rounded-t-2xl"
                      onClick={() => setIsPlanDetailsCollapsed(prev => !prev)}
                    >
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">2</span>
                        Plan Details
                      </h4>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] text-slate-700 font-bold">Coverage & Plan Options</span>
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
                            <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                              Policy Number <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                            </label>
                            <input
                              {...register('policyNumber')}
                              className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              placeholder="Enter policy number"
                            />
                          </div>

                          {/* Insured Person */}
                          <div>
                            <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                              Insured Person
                            </label>
                            <input
                              type="text"
                              value={insuredPerson}
                              onChange={e => setInsuredPerson(e.target.value)}
                              className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-800"
                              placeholder="e.g. Self / Name of Insured Person"
                            />
                          </div>

                          {/* Family Size */}
                          <div>
                            <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                              Family Size
                            </label>
                            <CustomSelect
                              value={selectedFamilySize}
                              onChange={val => setSelectedFamilySize(val)}
                              options={[
                                { value: '1', label: '1 Adult (Individual)' },
                                { value: '2', label: '2 Adults (1A + 1A)' },
                                { value: '2_1', label: '2 Adults + 1 Child' },
                                { value: '2_2', label: '2 Adults + 2 Children' },
                                { value: '2_3', label: '2 Adults + 3 Children' },
                                { value: '1_1', label: '1 Adult + 1 Child' },
                                { value: '1_2', label: '1 Adult + 2 Children' },
                              ]}
                            />
                          </div>

                          {/* Policy Zone Location Tier */}
                          <div>
                            <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                              Policy Zone Location Tier
                            </label>
                            <CustomSelect
                              value={selectedZoneTier}
                              onChange={val => setSelectedZoneTier(val)}
                              options={[
                                { value: 'ZONE_1', label: 'Zone 1 (Metro / Tier 1)' },
                                { value: 'ZONE_2', label: 'Zone 2 (Tier 2)' },
                                { value: 'ZONE_3', label: 'Zone 3 (Rest of India)' },
                              ]}
                            />
                          </div>

                          {/* Policy Zone City */}
                          <div>
                            <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                              Policy Zone City
                            </label>
                            <input
                              type="text"
                              value={policyZoneLocationCity}
                              onChange={e => setPolicyZoneLocationCity(e.target.value)}
                              className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              placeholder="Type policy zone city manually..."
                            />
                          </div>

                          {/* Policy Zone Location Pincode */}
                          <div>
                            <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                              Policy Zone Location Pincode
                            </label>
                            <input
                              type="text"
                              value={policyZoneLocationPincode}
                              onChange={e => setPolicyZoneLocationPincode(e.target.value)}
                              maxLength={6}
                              className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              placeholder="e.g. 400001"
                            />
                          </div>

                          {/* Sum Insured */}
                          <div>
                            <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                              Sum Insured (₹) {isFieldRequired('sumAssured', true) && <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>}
                            </label>
                            <CustomSelect
                              value={watchSumAssured ? String(watchSumAssured) : ''}
                              onChange={val => {
                                const num = val ? Number(val) : undefined;
                                setValue('sumAssured', num as any, { shouldValidate: true, shouldDirty: true });
                              }}
                              placeholder={`Select Sum Insured ${isFieldRequired('sumAssured', true) ? '*' : '(Optional)'}`}
                              options={[
                                { value: '', label: `Select Sum Insured ${isFieldRequired('sumAssured', true) ? '*' : '(Optional)'}` },
                                ...SUM_INSURED_OPTIONS.map(opt => ({ value: String(opt.value), label: opt.label }))
                              ]}
                            />
                          </div>

                          {/* Deductible */}
                          <div>
                            <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
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
                            <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
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
                            <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
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
                            <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                              Policy Status <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                            </label>
                            <CustomSelect
                              value={watch('status') === 'ACTIVE' ? 'INFORCE' : (watch('status') || 'INFORCE')}
                              onChange={val => setValue('status', val as any, { shouldValidate: true, shouldDirty: true })}
                              options={POLICY_STATUS_OPTIONS}
                            />
                          </div>

                          {/* Assigned To */}
                          {user?.role !== 'EMPLOYEE' && (
                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                                Assigned To
                              </label>
                              <CustomSelect
                                value={watch('assignedEmployeeId') || ''}
                                onChange={val => setValue('assignedEmployeeId', val, { shouldValidate: true, shouldDirty: true })}
                                placeholder="Select Employee"
                                options={[
                                  { value: '', label: 'Select Employee' },
                                  ...(employeeResults?.data || []).map((emp: any) => ({
                                    value: emp.userId,
                                    label: `${emp.firstName || emp.employeeProfile?.firstName || ''} ${emp.lastName || emp.employeeProfile?.lastName || ''}`.trim()
                                  }))
                                ]}
                              />
                            </div>
                          )}
                        </div>

                        {/* Riders / Addons */}
                        <div className="flex flex-col gap-1 pt-2">
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
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
                            ].map(rider => {
                              const currentRiders = Array.isArray(watch('riders')) ? (watch('riders') as string[]) : [];
                              const isChecked = currentRiders.includes(rider.id);
                              return (
                                <label key={rider.id} className="flex flex-wrap items-center gap-2 cursor-pointer text-gray-700 hover:text-blue-600 transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={e => {
                                      const nextRiders = e.target.checked
                                        ? [...currentRiders.filter(id => id !== rider.id), rider.id]
                                        : currentRiders.filter(id => id !== rider.id);
                                      setValue('riders', nextRiders, { shouldValidate: true, shouldDirty: true });
                                    }}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                  <span className="text-[11px] font-medium">{rider.label}</span>
                                </label>
                              );
                            })}
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
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
                    <div
                      className="bg-gradient-to-r from-emerald-50/80 via-slate-50 to-teal-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none rounded-t-2xl"
                      onClick={() => setIsPremiumBreakdownCollapsed(prev => !prev)}
                    >
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">1</span>
                        Premium Breakdown & Instalments
                      </h4>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] text-slate-700 font-bold">Premium Amounts & Frequency</span>
                        <ChevronDown
                          size={16}
                          className={`text-slate-500 transition-transform duration-200 ${isPremiumBreakdownCollapsed ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </div>

                    {!isPremiumBreakdownCollapsed && (
                      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3.5 animate-fadeIn">
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Premium Amount (₹) <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
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
                        </div>

                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
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
                        </div>

                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
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
                        </div>

                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Installment Frequency <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                          </label>
                          <CustomSelect
                            value={watchPaymentFrequency || 'YEARLY'}
                            onChange={val => {
                              setValue('paymentFrequency', val as any, { shouldValidate: true, shouldDirty: true });
                              if (val === 'SINGLE') {
                                setValue('noOfInstallments', 1, { shouldValidate: true, shouldDirty: true });
                                recalculateLastInstallment({ freq: 'SINGLE', noOfInst: 1 });
                              } else {
                                recalculateLastInstallment({ freq: val });
                              }
                            }}
                            options={[
                              { value: 'YEARLY', label: 'Yearly' },
                              { value: 'HALF_YEARLY', label: 'Half Yearly' },
                              { value: 'QUARTERLY', label: 'Quarterly' },
                              { value: 'MONTHLY', label: 'Monthly' },
                              { value: 'SINGLE', label: 'One Time' },
                            ]}
                          />
                        </div>

                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Premium Payment Period (Years)
                          </label>
                          <input
                            type="number"
                            {...register('premiumPaymentPeriod')}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="e.g. 10"
                          />
                        </div>

                        {/* Downpayment Amount */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Downpayment Amount (₹)
                          </label>
                          <input
                            type="text"
                            value={formatIndianNumber(watchDownpaymentAmount || 0)}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/,/g, '');
                              const num = Number(raw);
                              if (!isNaN(num)) {
                                setValue('downpaymentAmount', num, { shouldValidate: true, shouldDirty: true });
                              } else if (raw === '') {
                                setValue('downpaymentAmount', 0 as any, { shouldValidate: true, shouldDirty: true });
                              }
                            }}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="Enter downpayment amount"
                          />
                        </div>

                        {/* Processing Fee (incl. GST) */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Processing Fee (incl. GST) (₹)
                          </label>
                          <input
                            type="text"
                            value={formatIndianNumber(watchProcessingFee || 0)}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/,/g, '');
                              const num = Number(raw);
                              if (!isNaN(num)) {
                                setValue('processingFee', num, { shouldValidate: true, shouldDirty: true });
                              } else if (raw === '') {
                                setValue('processingFee', 0 as any, { shouldValidate: true, shouldDirty: true });
                              }
                            }}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="e.g. 500"
                          />
                        </div>

                        {/* Installment Amount */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Installment Amount (₹)
                          </label>
                          <input
                            type="text"
                            value={formatIndianNumber(watchInstallmentAmount || 0)}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/,/g, '');
                              const num = Number(raw);
                              if (!isNaN(num)) {
                                setValue('installmentAmount', num, { shouldValidate: true, shouldDirty: true });
                                setValue('emiPremium', num, { shouldValidate: true, shouldDirty: true });
                              } else if (raw === '') {
                                setValue('installmentAmount', 0 as any, { shouldValidate: true, shouldDirty: true });
                                setValue('emiPremium', 0 as any, { shouldValidate: true, shouldDirty: true });
                              }
                            }}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="Enter installment amount"
                          />
                        </div>

                        {/* No. of Installments */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            No. of Installments
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={120}
                            value={watchNoOfInstallments !== undefined && watchNoOfInstallments !== null ? watchNoOfInstallments : ''}
                            onChange={e => {
                              const valStr = e.target.value;
                              const val = valStr === '' ? '' : parseInt(valStr, 10);
                              setValue('noOfInstallments', val as any, { shouldValidate: true, shouldDirty: true });
                              recalculateLastInstallment({ noOfInst: val || 1 });
                            }}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-800"
                            placeholder="e.g. 12"
                          />
                        </div>

                        {/* Installment Date (Day: 01 to 31st) */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Installment Date (01 to 31st)
                          </label>
                          <CustomSelect
                            value={watchEmiDate ? String(watchEmiDate).padStart(2, '0') : ''}
                            onChange={val => {
                              setValue('emiDate', val, { shouldValidate: true, shouldDirty: true });
                              recalculateLastInstallment({ day: val });
                            }}
                            placeholder="Select Day (01 to 31st)"
                            options={[
                              { value: '', label: 'Select Day' },
                              ...INSTALLMENT_DATE_OPTIONS
                            ]}
                          />
                        </div>

                        {/* Last Installment Date */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Last Installment Date
                          </label>
                          <DatePicker
                            value={watchLastInstallmentDate || watchLastPremiumDate}
                            onDateChange={val => {
                              setValue('lastPremiumDate', val, { shouldValidate: true, shouldDirty: true });
                              setValue('lastInstallmentDate', val, { shouldValidate: true, shouldDirty: true });
                            }}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 font-semibold"
                            placeholder="DD/MM/YYYY"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section 2: Policy Tenure & Term Dates */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
                    <div
                      className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none rounded-t-2xl"
                      onClick={() => setIsTenureDatesCollapsed(prev => !prev)}
                    >
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">2</span>
                        Tenure, Maturity & Term Dates
                      </h4>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] text-slate-700 font-bold">Tenure & Policy Dates</span>
                        <ChevronDown
                          size={16}
                          className={`text-slate-500 transition-transform duration-200 ${isTenureDatesCollapsed ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </div>

                    {!isTenureDatesCollapsed && (
                      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3.5 animate-fadeIn">
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Policy Tenure (Years)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min={1}
                              max={99}
                              value={durationYears || ''}
                              onChange={e => {
                                const valStr = e.target.value;
                                if (valStr === '') {
                                  setDurationYears('' as any);
                                  return;
                                }
                                const val = parseInt(valStr, 10);
                                if (!isNaN(val)) {
                                  setDurationYears(Math.min(99, Math.max(1, val)));
                                }
                              }}
                              className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 pr-10 font-bold text-slate-800"
                              placeholder="1 to 99"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 pointer-events-none">
                              Yr
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Policy Term
                          </label>
                          <input
                            type="text"
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 font-bold"
                            value={policyTerm}
                            onChange={e => setPolicyTerm(e.target.value)}
                            placeholder="e.g. 1 Year"
                          />
                        </div>
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Policy Start Date <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                          </label>
                          <DatePicker
                            value={watchStartDate}
                            onDateChange={val => {
                              setValue('startDate', val, { shouldValidate: true, shouldDirty: true });
                              recalculateLastInstallment({ baseDate: val });
                            }}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                            placeholder="DD/MM/YYYY"
                          />
                        </div>

                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Policy End Date
                          </label>
                          <DatePicker
                            value={watchEndDate}
                            onDateChange={val => setValue('endDate', val, { shouldValidate: true, shouldDirty: true })}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                            placeholder="DD/MM/YYYY"
                          />
                        </div>

                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Date of Maturity
                          </label>
                          <DatePicker
                            value={watch('maturityDate') || watchEndDate}
                            onDateChange={val => setValue('maturityDate', val, { shouldValidate: true, shouldDirty: true })}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                            placeholder="DD/MM/YYYY"
                          />
                        </div>

                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Policy 1st Instalment Date
                          </label>
                          <DatePicker
                            value={watchFirstPremiumDate}
                            onDateChange={val => {
                              setValue('firstPremiumDate', val, { shouldValidate: true, shouldDirty: true });
                              recalculateLastInstallment({ baseDate: val });
                            }}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                            placeholder="DD/MM/YYYY"
                          />
                        </div>

                        {/* No. of Installments */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            No. of Installments
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={120}
                            value={watchNoOfInstallments !== undefined && watchNoOfInstallments !== null ? watchNoOfInstallments : ''}
                            onChange={e => {
                              const valStr = e.target.value;
                              const val = valStr === '' ? '' : parseInt(valStr, 10);
                              setValue('noOfInstallments', val as any, { shouldValidate: true, shouldDirty: true });
                              recalculateLastInstallment({ noOfInst: val || 1 });
                            }}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-800"
                            placeholder="e.g. 12"
                          />
                        </div>

                        {/* Installment Date (Day: 01 to 31st) */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Installment Date (01 to 31st)
                          </label>
                          <CustomSelect
                            value={watchEmiDate ? String(watchEmiDate).padStart(2, '0') : ''}
                            onChange={val => {
                              setValue('emiDate', val, { shouldValidate: true, shouldDirty: true });
                              recalculateLastInstallment({ day: val });
                            }}
                            placeholder="Select Day (01 to 31st)"
                            options={[
                              { value: '', label: 'Select Day' },
                              ...INSTALLMENT_DATE_OPTIONS
                            ]}
                          />
                        </div>

                        {/* Last Installment Date */}
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Last Installment Date
                          </label>
                          <DatePicker
                            value={watchLastInstallmentDate || watchLastPremiumDate}
                            onDateChange={val => {
                              setValue('lastPremiumDate', val, { shouldValidate: true, shouldDirty: true });
                              setValue('lastInstallmentDate', val, { shouldValidate: true, shouldDirty: true });
                            }}
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 font-semibold"
                            placeholder="DD/MM/YYYY"
                          />
                        </div>

                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Age at Entry
                          </label>
                          <input
                            type="number"
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="e.g. 30"
                          />
                        </div>

                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Age at Last Premium
                          </label>
                          <input
                            type="number"
                            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="e.g. 45"
                          />
                        </div>

                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
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
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
                    <div
                      className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none rounded-t-2xl"
                      onClick={() => setIsEmiDetailsCollapsed(prev => !prev)}
                    >
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-600 to-blue-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">3</span>
                        Installment / EMI Gateway Details
                      </h4>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] text-slate-700 font-bold">Gateway & Installment Case</span>
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
                            <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                              Installment Case?
                            </label>
                            <CustomSelect
                              value={watchEmiCase ? 'yes' : 'no'}
                              onChange={val => setValue('emiCase', val === 'yes')}
                              options={[
                                { value: 'no', label: 'No' },
                                { value: 'yes', label: 'Yes' },
                              ]}
                            />
                          </div>
                        </div>

                        {watchEmiCase && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 p-3.5 bg-blue-50/40 rounded-xl border border-blue-100 animate-fadeIn">
                            <div>
                              <label className="label text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block mb-1">
                                Installment Gateway
                              </label>
                              <CustomSelect
                                value={watch('emiGateway') || ''}
                                onChange={val => setValue('emiGateway', val)}
                                placeholder="Select Gateway"
                                options={[
                                  { value: '', label: 'Select Gateway' },
                                  { value: 'FIBE', label: 'FIBE' },
                                  { value: 'Shopse', label: 'Shopse' },
                                  { value: 'BimaPay', label: 'BimaPay' },
                                ]}
                              />
                            </div>
                            <div>
                              <label className="label text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block mb-1">
                                Installment Date (01 to 31st)
                              </label>
                              <CustomSelect
                                value={watch('emiDate') ? String(watch('emiDate')).padStart(2, '0') : ''}
                                onChange={val => setValue('emiDate', val)}
                                placeholder="Select Date"
                                options={[
                                  { value: '', label: 'Select Date' },
                                  ...INSTALLMENT_DATE_OPTIONS
                                ]}
                              />
                            </div>
                            <div>
                              <label className="label text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block mb-1">
                                No. of Installments
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={120}
                                {...register('noOfInstallments')}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-blue-200 font-bold text-slate-800"
                                placeholder="e.g. 12"
                              />
                            </div>
                            <div>
                              <label className="label text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block mb-1">
                                Last Installment Date
                              </label>
                              <DatePicker
                                value={watch('lastPremiumDate')}
                                onDateChange={val => {
                                  setValue('lastPremiumDate', val, { shouldValidate: true, shouldDirty: true });
                                  setValue('lastInstallmentDate', val, { shouldValidate: true, shouldDirty: true });
                                }}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-blue-200 font-semibold"
                                placeholder="Calculated automatically"
                              />
                            </div>
                            <div>
                              <label className="label text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block mb-1">
                                Installment Amount (₹)
                              </label>
                              <input
                                type="text"
                                value={formatIndianNumber(watchInstallmentAmount || 0)}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/,/g, '');
                                  const num = Number(raw);
                                  if (!isNaN(num)) {
                                    setValue('installmentAmount', num, { shouldValidate: true, shouldDirty: true });
                                    setValue('emiPremium', num, { shouldValidate: true, shouldDirty: true });
                                  } else if (raw === '') {
                                    setValue('installmentAmount', 0 as any, { shouldValidate: true, shouldDirty: true });
                                    setValue('emiPremium', 0 as any, { shouldValidate: true, shouldDirty: true });
                                  }
                                }}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-blue-200"
                                placeholder="Installment Amount"
                              />
                            </div>
                            <div>
                              <label className="label text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block mb-1">
                                Downpayment Amount (₹)
                              </label>
                              <input
                                type="text"
                                value={formatIndianNumber(watchDownpaymentAmount || 0)}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/,/g, '');
                                  const num = Number(raw);
                                  if (!isNaN(num)) {
                                    setValue('downpaymentAmount', num, { shouldValidate: true, shouldDirty: true });
                                  } else if (raw === '') {
                                    setValue('downpaymentAmount', 0 as any, { shouldValidate: true, shouldDirty: true });
                                  }
                                }}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-blue-200"
                                placeholder="Downpayment Amount"
                              />
                            </div>
                            <div>
                              <label className="label text-[10px] font-extrabold text-blue-700 uppercase tracking-wider block mb-1">
                                Processing Fee (incl. GST) (₹)
                              </label>
                              <input
                                type="text"
                                value={formatIndianNumber(watchProcessingFee || 0)}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/,/g, '');
                                  const num = Number(raw);
                                  if (!isNaN(num)) {
                                    setValue('processingFee', num, { shouldValidate: true, shouldDirty: true });
                                  } else if (raw === '') {
                                    setValue('processingFee', 0 as any, { shouldValidate: true, shouldDirty: true });
                                  }
                                }}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-blue-200"
                                placeholder="e.g. 500"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Section 4: Payment Mode & Loan Details */}
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
                    <div
                      className="bg-gradient-to-r from-purple-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none rounded-t-2xl"
                      onClick={() => setIsPaymentModeLoanCollapsed(prev => !prev)}
                    >
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">4</span>
                        Payment Mode & Loan Details
                      </h4>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] text-slate-700 font-bold">Payment Method & Financed Loan</span>
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
                            <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                              Payment Mode
                            </label>
                            <CustomSelect
                              value={paymentModeDetails.paymentMode}
                              onChange={val => setPaymentModeDetails(p => ({ ...p, paymentMode: val }))}
                              options={[
                                { value: 'ONLINE', label: 'UPI / NetBanking / Online' },
                                { value: 'CHEQUE', label: 'Cheque' },
                                { value: 'NEFT_RTGS', label: 'NEFT / RTGS' },
                                { value: 'CREDIT_CARD', label: 'Credit Card' },
                                { value: 'AUTO_DEBIT', label: 'Auto Debit / NACH' },
                                { value: 'CASH', label: 'Cash' },
                              ]}
                            />
                          </div>

                          <div>
                            <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                              Payment Transaction / Cheque Date
                            </label>
                            <DatePicker
                              value={paymentModeDetails.paymentDate}
                              onDateChange={(val: string) => setPaymentModeDetails(p => ({ ...p, paymentDate: val }))}
                              className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                            />
                          </div>

                          <div>
                            <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
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
                            <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                              Loan Case / Financed Policy?
                            </label>
                            <CustomSelect
                              value={paymentModeDetails.isLoanCase ? 'yes' : 'no'}
                              onChange={val => setPaymentModeDetails(p => ({ ...p, isLoanCase: val === 'yes' }))}
                              options={[
                                { value: 'no', label: 'No' },
                                { value: 'yes', label: 'Yes' },
                              ]}
                            />
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
                  <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
                    <div
                      className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none rounded-t-2xl"
                      onClick={() => setIsPaymentAccountCollapsed(prev => !prev)}
                    >
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">5</span>
                        Payment Account Details
                      </h4>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] text-slate-700 font-bold">Bank & Account Specifications</span>
                        <ChevronDown
                          size={16}
                          className={`text-slate-500 transition-transform duration-200 ${isPaymentAccountCollapsed ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </div>

                    {!isPaymentAccountCollapsed && (
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5 animate-fadeIn">
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
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
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
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
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
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
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
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
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                            Account Type
                          </label>
                          <CustomSelect
                            value={paymentAccount.accountType}
                            onChange={val => setPaymentAccount(p => ({ ...p, accountType: val }))}
                            placeholder="Select Account Type"
                            options={[
                              { value: 'SAVINGS', label: 'Savings Account' },
                              { value: 'CURRENT', label: 'Current Account' },
                              { value: 'OVERDRAFT', label: 'Overdraft Account (OD)' },
                              { value: 'NRE_NRO', label: 'NRE / NRO Account' },
                            ]}
                          />
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
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">6</span>
                        GST No Details
                      </h4>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] text-slate-700 font-bold">Firm Name, PAN & GST Registration</span>
                        <ChevronDown
                          size={16}
                          className={`text-slate-500 transition-transform duration-200 ${isGstDetailsCollapsed ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </div>

                    {!isGstDetailsCollapsed && (
                      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3.5 animate-fadeIn">
                        <div>
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
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
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
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
                          <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
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
                  {(selectedCompanyCategory?.toUpperCase() === 'HEALTH' || selectedPlanCategory?.toUpperCase() === 'HEALTH' || selectedType?.toUpperCase() === 'HEALTH' || selectedPlan?.category?.toUpperCase() === 'HEALTH' || watchPhcRequired) && (
                    <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
                      <div
                        className="bg-gradient-to-r from-teal-50/80 via-slate-50 to-emerald-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none rounded-t-2xl"
                        onClick={() => setIsPhcCollapsed(prev => !prev)}
                      >
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex flex-wrap items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-gradient-to-br from-teal-600 to-emerald-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">7</span>
                          Preventive Health Checkup Details
                        </h4>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] text-slate-700 font-bold">PHC Benefits & Status</span>
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
                              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                                Preventive Health Checkup?
                              </label>
                              <CustomSelect
                                value={watchPhcRequired ? 'yes' : 'no'}
                                onChange={val => setValue('phcRequired', val === 'yes')}
                                placeholder="Select Option"
                                options={[
                                  { value: 'no', label: 'No' },
                                  { value: 'yes', label: 'Yes' },
                                ]}
                              />
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
                                <CustomSelect
                                  value={watch('phcStatus') || ''}
                                  onChange={val => setValue('phcStatus', val)}
                                  placeholder="Select Status"
                                  options={[
                                    { value: '', label: 'Select Status' },
                                    { value: 'SCHEDULED', label: 'Scheduled' },
                                    { value: 'COMPLETED', label: 'Completed' },
                                    { value: 'CANCELLED', label: 'Cancelled' },
                                  ]}
                                />
                              </div>
                              <div>
                                <label className="label text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block mb-1">PHC Claim Settled?</label>
                                <CustomSelect
                                  value={watch('phcClaimSettled') ? 'yes' : 'no'}
                                  onChange={val => setValue('phcClaimSettled', val === 'yes')}
                                  placeholder="Select Option"
                                  options={[
                                    { value: 'no', label: 'No' },
                                    { value: 'yes', label: 'Yes' },
                                  ]}
                                />
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
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                                Full Name <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
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
                              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                                Relationship
                              </label>
                              <CustomSelect
                                value={person.relationship}
                                onChange={val => updateConnectedPerson(person.id, { relationship: val })}
                                placeholder="Select Relationship"
                                options={[
                                  { value: 'Spouse', label: 'Spouse' },
                                  { value: 'Son', label: 'Son' },
                                  { value: 'Daughter', label: 'Daughter' },
                                  { value: 'Father', label: 'Father' },
                                  { value: 'Mother', label: 'Mother' },
                                  { value: 'Brother', label: 'Brother' },
                                  { value: 'Sister', label: 'Sister' },
                                  { value: 'Dependent', label: 'Dependent' },
                                  { value: 'Other', label: 'Other' },
                                ]}
                              />
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                                Contact No.
                              </label>
                              <input
                                type="tel"
                                maxLength={10}
                                value={person.contactNo}
                                onChange={e => updateConnectedPerson(person.id, { contactNo: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                className="input w-full h-9 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="10-digit Phone"
                              />
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                                Date of Birth (DoB)
                              </label>
                              <DatePicker
                                value={person.dob}
                                onDateChange={val => updateConnectedPerson(person.id, { dob: val })}
                                className="input w-full h-9 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="DD/MM/YYYY"
                              />
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                                Gender
                              </label>
                              <CustomSelect
                                value={person.gender}
                                onChange={val => updateConnectedPerson(person.id, { gender: val })}
                                placeholder="Select Gender"
                                options={[
                                  { value: 'MALE', label: 'Male' },
                                  { value: 'FEMALE', label: 'Female' },
                                  { value: 'OTHER', label: 'Other' },
                                ]}
                              />
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
                                onChange={e => {
                                  const isNom = e.target.checked;
                                  updateConnectedPerson(person.id, {
                                    isNominee: isNom,
                                    ...(isNom ? {
                                      nomineeName: person.nomineeName || person.name,
                                      nomineeRelation: person.nomineeRelation || person.relationship,
                                      nomineeContact: person.nomineeContact || person.contactNo,
                                      nomineeDob: person.nomineeDob || person.dob,
                                    } : {})
                                  });
                                }}
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
                              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
                                    maxLength={10}
                                    value={person.nomineeContact || person.contactNo}
                                    onChange={e => updateConnectedPerson(person.id, { nomineeContact: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                    className="input w-full h-9 text-xs rounded-xl bg-white border border-purple-200"
                                    placeholder="10-digit Phone"
                                  />
                                </div>

                                <div>
                                  <label className="label text-[10px] font-extrabold text-purple-700 uppercase tracking-wider block mb-1">Nominee DoB</label>
                                  <DatePicker
                                    value={person.nomineeDob || person.dob}
                                    onDateChange={val => updateConnectedPerson(person.id, { nomineeDob: val })}
                                    className="input w-full h-9 text-xs rounded-xl bg-white border border-purple-200"
                                    placeholder="DD/MM/YYYY"
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
                  {/* PHC Info Header Banner */}
                  <div className="bg-gradient-to-r from-teal-50 via-slate-50 to-blue-50 border border-teal-200/80 rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-600 to-emerald-600 text-white flex items-center justify-center shadow-2xs shrink-0">
                        <Activity size={18} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                          Preventive Health Checkup (PHC)
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">Health Benefit</span>
                        </h4>
                        <p className="text-[11px] text-slate-500">Configure health checkup allowance, lab booking, appointments and claim settlements.</p>
                      </div>
                    </div>
                    {selectedCompanyCategory?.toUpperCase() !== 'HEALTH' && (
                      <button
                        type="button"
                        onClick={() => {
                          handleCompanyCategoryChange('Health');
                          setValue('phcRequired', true);
                          toast.success('Insurance Company Category set to Health');
                        }}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
                      >
                        <CheckCircle2 size={13} />
                        <span>Set Policy as Health</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {/* Card 1A: PHC Configuration & Eligibility */}
                    <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
                      <div
                        className="bg-gradient-to-r from-teal-50/80 via-slate-50 to-emerald-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none rounded-t-2xl"
                        onClick={() => setIsPhcCollapsed(prev => !prev)}
                      >
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex flex-wrap items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-gradient-to-br from-teal-600 to-emerald-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">1</span>
                          PHC Configuration & Eligibility
                        </h4>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] text-slate-700 font-bold">PHC Benefits & Eligibility</span>
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
                              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                                Preventive Health Checkup?
                              </label>
                              <CustomSelect
                                value={(watchPhcRequired ?? true) ? 'yes' : 'no'}
                                onChange={val => {
                                  setValue('phcRequired', val === 'yes');
                                  if (val === 'yes' && !selectedCompanyCategory) {
                                    handleCompanyCategoryChange('Health');
                                  }
                                }}
                                placeholder="Select Option"
                                options={[
                                  { value: 'yes', label: 'Yes' },
                                  { value: 'no', label: 'No' },
                                ]}
                              />
                            </div>

                            {(watchPhcRequired ?? true) && (
                              <>
                                <div>
                                  <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">PHC Amount (₹)</label>
                                  <input
                                    type="number"
                                    {...register('phcAmount')}
                                    className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    placeholder="e.g. 5000"
                                  />
                                </div>

                                <div>
                                  <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">PHC Balance Amount (₹)</label>
                                  <input
                                    type="text"
                                    value={phcExtraDetails.balanceAmount ? `₹${phcExtraDetails.balanceAmount}` : '₹1,500'}
                                    onChange={e => setPhcExtraDetails(p => ({ ...p, balanceAmount: e.target.value.replace(/[^0-9]/g, '') }))}
                                    className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-800"
                                    placeholder="₹1,500"
                                  />
                                </div>

                                <div>
                                  <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">PHC Eligibility Start Date</label>
                                  <DatePicker
                                    value={phcExtraDetails.eligibilityStartDate}
                                    onDateChange={(val: string) => setPhcExtraDetails(p => ({ ...p, eligibilityStartDate: val }))}
                                    className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  />
                                </div>

                                <div>
                                  <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">PHC Frequency</label>
                                  <CustomSelect
                                    value={phcExtraDetails.frequency || 'ANNUAL'}
                                    onChange={val => setPhcExtraDetails(p => ({ ...p, frequency: val }))}
                                    placeholder="Select Frequency"
                                    options={[
                                      { value: 'ANNUAL', label: 'Annual' },
                                      { value: 'BI_ANNUAL', label: 'Bi-Annual' },
                                      { value: 'ONCE_TENURE', label: 'Once Per Tenure' },
                                    ]}
                                  />
                                </div>

                                <div>
                                  <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">PHC Status</label>
                                  <CustomSelect
                                    value={watch('phcStatus') || ''}
                                    onChange={val => setValue('phcStatus', val)}
                                    placeholder="Select Status"
                                    options={[
                                      { value: '', label: 'Select Status' },
                                      { value: 'NOT_INTERESTED', label: 'Not Interested' },
                                      { value: 'INTERESTED', label: 'Interested' },
                                      { value: 'REMIND_LATER', label: 'Remind Later' },
                                      { value: 'FULLY_UTILISED', label: 'Fully Utilised' },
                                      { value: 'PARTIAL_UTILISED', label: 'Partial Utilised' },
                                    ]}
                                  />
                                </div>

                                <div>
                                  <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">Follow-up Date</label>
                                  <DatePicker
                                    value={phcExtraDetails.followUpDate}
                                    onDateChange={(val: string) => setPhcExtraDetails(p => ({ ...p, followUpDate: val }))}
                                    className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  />
                                </div>

                                <div className="col-span-1 md:col-span-3">
                                  <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">Comment</label>
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
                    {(watchPhcRequired ?? true) && (
                      <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
                        <div
                          className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none rounded-t-2xl"
                          onClick={() => setIsPhcBookingCollapsed(prev => !prev)}
                        >
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex flex-wrap items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">2</span>
                            PHC Booking & Centre Details
                          </h4>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] text-slate-700 font-bold">Appointment & Lab Information</span>
                            <ChevronDown
                              size={16}
                              className={`text-slate-500 transition-transform duration-200 ${isPhcBookingCollapsed ? 'rotate-180' : ''}`}
                            />
                          </div>
                        </div>

                        {!isPhcBookingCollapsed && (
                          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3.5 animate-fadeIn">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block">
                                  Insured Person Name for PHC
                                </label>
                                <button
                                  type="button"
                                  onClick={() => setIsCustomPhcPersonManual(prev => !prev)}
                                  className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                                >
                                  {isCustomPhcPersonManual ? 'Select from list' : '+ Enter other name'}
                                </button>
                              </div>
                              {isCustomPhcPersonManual ? (
                                <input
                                  type="text"
                                  value={phcExtraDetails.insuredPersonName}
                                  onChange={e => setPhcExtraDetails(p => ({ ...p, insuredPersonName: e.target.value }))}
                                  className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                                  placeholder="Type insured person name"
                                />
                              ) : (
                                <CustomSelect
                                  value={phcExtraDetails.insuredPersonName}
                                  onChange={val => setPhcExtraDetails(p => ({ ...p, insuredPersonName: val }))}
                                  placeholder="Select Insured Person..."
                                  options={phcInsuredPersonOptions.length > 0 ? phcInsuredPersonOptions : [{ value: '', label: 'No persons added yet' }]}
                                  searchable
                                />
                              )}
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">PHC Booking Date</label>
                              <DatePicker
                                value={phcExtraDetails.bookingDate}
                                onDateChange={(val: string) => setPhcExtraDetails(p => ({ ...p, bookingDate: val }))}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                              />
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">PHC Appointment Date</label>
                              <DatePicker
                                value={phcExtraDetails.appointmentDate}
                                onDateChange={(val: string) => setPhcExtraDetails(p => ({ ...p, appointmentDate: val }))}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                              />
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">PHC Centre / Lab Name</label>
                              <input
                                type="text"
                                value={phcExtraDetails.centreName}
                                onChange={e => setPhcExtraDetails(p => ({ ...p, centreName: e.target.value }))}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                                placeholder="e.g. Dr. Lal PathLabs / SRL Diagnostic"
                              />
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">PHC Centre / Lab City</label>
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
                    {(watchPhcRequired ?? true) && (
                      <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
                        <div
                          className="bg-gradient-to-r from-emerald-50/80 via-slate-50 to-teal-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none rounded-t-2xl"
                          onClick={() => setIsPhcSettlementCollapsed(prev => !prev)}
                        >
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex flex-wrap items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">3</span>
                            PHC Claim & Settlement Details
                          </h4>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] text-slate-700 font-bold">Reports, Submissions & Stage</span>
                            <ChevronDown
                              size={16}
                              className={`text-slate-500 transition-transform duration-200 ${isPhcSettlementCollapsed ? 'rotate-180' : ''}`}
                            />
                          </div>
                        </div>

                        {!isPhcSettlementCollapsed && (
                          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3.5 animate-fadeIn">
                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">PHC Utilized Amount (₹)</label>
                              <input
                                type="number"
                                value={phcExtraDetails.utilizedAmount}
                                onChange={e => setPhcExtraDetails(p => ({ ...p, utilizedAmount: e.target.value }))}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                                placeholder="Utilized Amount"
                              />
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">Reimbursement / Cashless</label>
                              <CustomSelect
                                value={phcExtraDetails.reimbursementCashless || 'CASHLESS'}
                                onChange={val => setPhcExtraDetails(p => ({ ...p, reimbursementCashless: val }))}
                                placeholder="Select Reimbursement / Cashless"
                                options={[
                                  { value: 'CASHLESS', label: 'Cashless Checkup' },
                                  { value: 'REIMBURSEMENT', label: 'Reimbursement Claim' },
                                ]}
                              />
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">Report Received Date</label>
                              <DatePicker
                                value={phcExtraDetails.reportReceivedDate}
                                onDateChange={(val: string) => setPhcExtraDetails(p => ({ ...p, reportReceivedDate: val }))}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                              />
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">Report & Bill Received Date</label>
                              <DatePicker
                                value={phcExtraDetails.reportBillReceivedDate}
                                onDateChange={(val: string) => setPhcExtraDetails(p => ({ ...p, reportBillReceivedDate: val }))}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                              />
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">Report & Bill Submitted Date</label>
                              <DatePicker
                                value={phcExtraDetails.reportBillSubmittedDate}
                                onDateChange={(val: string) => setPhcExtraDetails(p => ({ ...p, reportBillSubmittedDate: val }))}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                              />
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">Settlement Date</label>
                              <DatePicker
                                value={phcExtraDetails.settlementDate}
                                onDateChange={(val: string) => setPhcExtraDetails(p => ({ ...p, settlementDate: val }))}
                                className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
                              />
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">PHC Stage</label>
                              <CustomSelect
                                value={phcExtraDetails.phcStage || 'TO_CONTACT'}
                                onChange={val => setPhcExtraDetails(p => ({ ...p, phcStage: val }))}
                                placeholder="Select Stage"
                                options={PHC_STAGE_OPTIONS}
                              />
                            </div>

                            <div>
                              <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">PHC Claim Settled?</label>
                              <CustomSelect
                                value={watch('phcClaimSettled') ? 'yes' : 'no'}
                                onChange={val => setValue('phcClaimSettled', val === 'yes')}
                                placeholder="Select Option"
                                options={[
                                  { value: 'no', label: 'No' },
                                  { value: 'yes', label: 'Yes' },
                                ]}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ════════════════ TAB 6: Policy Documents ════════════════ */}
              {activePolicyTab === 'policyDocs' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between bg-gradient-to-r from-slate-100/80 via-slate-50 to-slate-100/50 p-4 border border-slate-200/90 rounded-2xl shadow-2xs">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex flex-wrap items-center gap-2">
                        <FileText size={16} className="text-blue-600" />
                        Policy Documents Upload
                      </h4>
                      <p className="text-[10px] text-slate-700 font-bold mt-1">Upload and view documents for this policy (Policy Document, Endorsements, etc.)</p>
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

                  {/* Existing Uploaded Policy Documents */}
                  {existingPolicyDocs.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-700">Existing Uploaded Documents ({existingPolicyDocs.length})</span>
                      </div>
                      <div className="space-y-2.5">
                        {existingPolicyDocs.map((doc: any) => {
                          const isEndorsement = doc.tag === 'POLICY_DOCUMENT_ENDORSEMENT' || doc.type === 'POLICY_DOCUMENT_ENDORSEMENT' || (doc.title && doc.title.toLowerCase().includes('endorsement'));
                          const isPolicyDoc = !isEndorsement && (doc.tag === 'POLICY_DOCUMENT' || doc.type === 'POLICY_DOCUMENT' || doc.tag === 'POLICY' || (doc.title && doc.title.toLowerCase().includes('policy')));

                          return (
                            <div key={doc.id} className="p-3 bg-white border border-slate-200/90 rounded-xl flex items-center justify-between shadow-2xs hover:border-slate-300 transition-all">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isEndorsement ? 'bg-amber-50 text-amber-600 border border-amber-200' : isPolicyDoc ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-slate-100 text-slate-600'}`}>
                                  <FileText size={18} />
                                </div>
                                <div className="truncate">
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-black text-slate-800 truncate">{doc.title || doc.fileName || 'Untitled Document'}</p>
                                    {isEndorsement ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                                        Policy Document - Endorsement
                                      </span>
                                    ) : isPolicyDoc ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                                        Policy Document
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                                        {doc.tag || doc.type || 'Document'}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                                    {doc.fileName ? `${doc.fileName} • ` : ''}{doc.createdAt ? format(new Date(doc.createdAt), 'dd/MMM/yyyy') : ''}
                                    {doc.description ? ` • ${doc.description}` : ''}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 ml-3">
                                <button
                                  type="button"
                                  onClick={() => viewDoc(doc.id)}
                                  className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                  title="View / Download"
                                >
                                  <Download size={12} /> View
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`Delete document "${doc.title || doc.fileName}"?`)) {
                                      deleteExistingDocMutation.mutate(doc.id);
                                    }
                                  }}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete Document"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Pending New Uploads */}
                  {pendingDocs.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">New Documents To Be Uploaded ({pendingDocs.length})</span>
                      </div>
                      <div className="space-y-2.5">
                        {pendingDocs.map((doc, i) => {
                          const isEndorsement = doc.type === 'POLICY_DOCUMENT_ENDORSEMENT';
                          const isPolicyDoc = doc.type === 'POLICY_DOCUMENT';
                          const typeLabel = POLICY_DOCUMENT_TYPE_OPTIONS.find(o => o.value === doc.type)?.label || doc.type;

                          return (
                            <div key={i} className="p-3 bg-emerald-50/40 border border-emerald-200/80 rounded-xl flex items-center justify-between shadow-2xs">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isEndorsement ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                  <FileText size={18} />
                                </div>
                                <div className="truncate">
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-black text-slate-800 truncate">{doc.title}</p>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${isEndorsement ? 'bg-amber-50 text-amber-700 border-amber-200' : isPolicyDoc ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                      {typeLabel}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">{doc.file.name}{doc.description ? ` • ${doc.description}` : ''}</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setPendingDocs(p => p.filter((_, idx) => idx !== i))}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Remove Document"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {existingPolicyDocs.length === 0 && pendingDocs.length === 0 && (
                    <div className="p-8 bg-slate-50 border border-slate-200/90 rounded-2xl text-center space-y-2">
                      <FileText size={28} className="text-slate-400 mx-auto" />
                      <p className="text-xs font-bold text-slate-700">No documents added yet.</p>
                      <p className="text-[11px] text-slate-400">Click "Upload Document" above to attach Policy Document, Endorsement, or other files.</p>
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
            <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">Document Type <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span></label>
            <CustomSelect
              value={docUploadFields.type}
              onChange={val => setDocUploadFields(p => ({ ...p, type: val }))}
              placeholder="Select Document Type"
              options={POLICY_DOCUMENT_TYPE_OPTIONS}
            />
          </div>
          <div>
            <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">Document Title <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span></label>
            <input
              type="text"
              value={docUploadFields.title}
              onChange={e => setDocUploadFields(p => ({ ...p, title: e.target.value }))}
              className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
              placeholder="e.g. Policy Schedule 2024"
            />
          </div>
          <div>
            <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">Description</label>
            <textarea
              rows={2}
              value={docUploadFields.description}
              onChange={e => setDocUploadFields(p => ({ ...p, description: e.target.value }))}
              className="input w-full p-2.5 text-xs rounded-xl bg-white border border-slate-200"
              placeholder="Optional notes about this document"
            />
          </div>
          <div>
            <label className="label text-[10px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">Choose File <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span></label>
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
