import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Modal from '@comps/common/Modal';
import CustomSelect from '@comps/common/CustomSelect';
import { DatePicker } from '@comps/common/DatePicker';
import { insuranceService, policiesService, documentsService, contactsService } from '@api/index';
import toast from 'react-hot-toast';
import { Shield, CreditCard, Users, Activity, FileText, Plus, Trash2, ChevronDown, UserCircle2, Pencil, RotateCw } from 'lucide-react';
import clsx from 'clsx';
import { useLookupStore } from '@store/lookup.store';
import { getPolicyStatusDisplay, calculateLastInstallmentDate } from '../../utils/policyStatusUtils';
import { INSTALLMENT_DATE_OPTIONS, PHC_STAGE_OPTIONS, POLICY_DOCUMENT_TYPE_OPTIONS } from './index';

interface Props {
  open: boolean;
  onClose: () => void;
  contactId?: string;
  contactName?: string;
  policyToEdit?: any;
  onSuccess?: () => void;
}

const CATEGORIES = ['HEALTH', 'LIFE', 'TERM', 'MOTOR', 'MUTUAL_FUNDS', 'PORTING', 'ACCIDENT', 'OTHER'];
const STATUS_OPTIONS = [
  { value: 'INFORCE', label: 'Inforce' },
  { value: 'RENEWAL_DUE', label: 'Renewal Due' },
  { value: 'GRACE_PERIOD', label: 'Grace Period' },
  { value: 'LAPSED', label: 'Lapsed' },
  { value: 'INACTIVE_OLD', label: 'Inactive(Old)' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function CreatePolicyModal({ open, onClose, contactId, contactName, policyToEdit, onSuccess }: Props) {
  const qc = useQueryClient();
  const { employees, loadEmployees } = useLookupStore();
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState(contactId || policyToEdit?.contactId || '');

  // Fetch contacts list for Target Contact / Client Name selector
  const { data: contactsRes } = useQuery({
    queryKey: ['contacts-list-picker'],
    queryFn: () => contactsService.list({ limit: 500 }),
    enabled: open,
  });
  const contactsList: any[] = Array.isArray(contactsRes?.data) ? contactsRes.data : Array.isArray(contactsRes) ? contactsRes : [];

  const { data: compulsoryRulesRes } = useQuery({
    queryKey: ['compulsory-rules'],
    queryFn: () => insuranceService.getCompulsoryRules(),
    enabled: open,
  });
  const compulsoryRules = useMemo(() => compulsoryRulesRes?.data ?? [], [compulsoryRulesRes]);
  const isFieldRequired = (key: string, defaultRequired: boolean) => {
    const rule = compulsoryRules.find((r: any) => r.module === 'Policy' && r.fieldKey === key);
    if (rule !== undefined) return rule.required;
    return defaultRequired;
  };

  useEffect(() => {
    if (open) {
      loadEmployees();
      if (policyToEdit) {
        setIsViewOnly(false);
        setSelectedContactId(policyToEdit.contactId || policyToEdit.contact?.id || contactId || '');
        setSelectedCategory((policyToEdit.plan?.category || 'HEALTH').toUpperCase());
        setSelectedCompanyId(policyToEdit.plan?.companyId || policyToEdit.plan?.company?.id || policyToEdit.plan?.company?.name || '');
        setSelectedPlanId(policyToEdit.planId || policyToEdit.plan?.id || '');
        setPolicyNumber(policyToEdit.policyNumber || '');
        setAgentCode(policyToEdit.agentCode || '');
        setStatus((policyToEdit.status === 'ACTIVE' ? 'INFORCE' : policyToEdit.status) || 'INFORCE');
        setAssignedEmployeeId(policyToEdit.assignedEmployeeId || '');
        setSumAssured(policyToEdit.sumAssured != null ? String(policyToEdit.sumAssured) : '');
        setPremiumAmount(policyToEdit.premiumAmount != null ? String(policyToEdit.premiumAmount) : '');
        setPaymentFrequency(policyToEdit.paymentFrequency || 'YEARLY');
        setStartDate(policyToEdit.startDate ? String(policyToEdit.startDate).split('T')[0] : '');
        setEndDate(policyToEdit.endDate ? String(policyToEdit.endDate).split('T')[0] : '');
        setNextDueDate(policyToEdit.nextDueDate ? String(policyToEdit.nextDueDate).split('T')[0] : '');
        setMaturityDate(policyToEdit.maturityDate ? String(policyToEdit.maturityDate).split('T')[0] : '');
        setNotes(policyToEdit.notes || '');
        const matchCity = (policyToEdit.notes || '').match(/Policy Zone(?: Location)? City:\s*(.*)/i);
        setPolicyZoneCity(matchCity ? matchCity[1].trim() : '');
        const matchDownpayment = (policyToEdit.notes || '').match(/Downpayment(?: Amount)?:\s*₹?\s*([0-9.]+)/i);
        setDownpaymentAmount(matchDownpayment ? matchDownpayment[1].trim() : '');
        const matchProcessing = (policyToEdit.notes || '').match(/Processing Fee(?:\s*\(incl\.\s*GST\))?:\s*₹?\s*([0-9.]+)/i);
        setProcessingFee(matchProcessing ? matchProcessing[1].trim() : '');
        const matchInstallment = (policyToEdit.notes || '').match(/Installment Amount:\s*₹?\s*([0-9.]+)/i) || (policyToEdit.notes || '').match(/Premium:\s*₹\s*([0-9.]+)/i);
        setInstallmentAmount(matchInstallment ? matchInstallment[1].trim() : '');
        if (matchInstallment && !emiPremium) setEmiPremium(matchInstallment[1].trim());
        const matchNoOfInst = (policyToEdit.notes || '').match(/No\.\s*of Installments:\s*([0-9]+)/i);
        setNoOfInstallments(matchNoOfInst ? matchNoOfInst[1].trim() : '');
        const matchLastInst = (policyToEdit.notes || '').match(/Last Installment Date:\s*(.*)/i);
        setLastInstallmentDate(matchLastInst ? matchLastInst[1].trim() : (policyToEdit.lastPremiumDate ? String(policyToEdit.lastPremiumDate).split('T')[0] : ''));
        const matchInstDate = (policyToEdit.notes || '').match(/Installment Date:\s*(.*)/i);
        if (matchInstDate) setEmiDate(matchInstDate[1].trim());
        const matchInsured = (policyToEdit.notes || '').match(/Insured Person:\s*(.*)/i);
        setInsuredPerson(matchInsured ? matchInsured[1].trim() : (policyToEdit.contact ? `${policyToEdit.contact.firstName || ''} ${policyToEdit.contact.lastName || ''}`.trim() : ''));
        if (policyToEdit.members && Array.isArray(policyToEdit.members) && policyToEdit.members.length > 0) {
          setMembers(policyToEdit.members.map((m: any) => ({
            name: m.name || `${m.firstName || ''} ${m.lastName || ''}`.trim(),
            relationship: m.relationship || 'Spouse',
            dob: m.dateOfBirth ? m.dateOfBirth.slice(0, 10) : (m.dob || ''),
          })));
        } else if (policyToEdit.nominees && Array.isArray(policyToEdit.nominees) && policyToEdit.nominees.length > 0) {
          setMembers(policyToEdit.nominees.map((n: any) => ({
            name: n.name,
            relationship: n.relationship || 'Nominee',
            dob: n.dateOfBirth ? n.dateOfBirth.slice(0, 10) : (n.dob || ''),
            isNominee: true,
          })));
        } else {
          const parsedMembers: any[] = [];
          (policyToEdit.notes || '').split('\n').forEach((line: string) => {
            if (line.startsWith('Nominee Details')) {
              const nameM = line.match(/Name:\s*([^,]+)/);
              const relM = line.match(/Relationship:\s*([^,]+)/);
              const dobM = line.match(/DoB:\s*([^,]+)/);
              if (nameM) {
                parsedMembers.push({
                  name: nameM[1].trim(),
                  relationship: relM ? relM[1].trim() : 'Nominee',
                  dob: dobM && dobM[1].trim() !== 'N/A' ? dobM[1].trim() : '',
                  isNominee: true,
                });
              }
            } else if (line.startsWith('Connected Person')) {
              const nameM = line.match(/Name:\s*([^,]+)/);
              const relM = line.match(/Relationship:\s*([^,]+)/);
              const dobM = line.match(/DoB:\s*([^,]+)/);
              if (nameM) {
                parsedMembers.push({
                  name: nameM[1].trim(),
                  relationship: relM ? relM[1].trim() : 'Spouse',
                  dob: dobM && dobM[1].trim() !== 'N/A' ? dobM[1].trim() : '',
                });
              }
            }
          });
          setMembers(parsedMembers);
        }
        const matchPhcPerson = (policyToEdit.notes || '').match(/PHC Insured Person:\s*(.*)/i) || (policyToEdit.notes || '').match(/Preventive Health Checkup:.*Insured Person:\s*([^,)\n]+)/i);
        setPhcInsuredPerson(matchPhcPerson ? matchPhcPerson[1].trim() : '');
        const matchPhcStage = (policyToEdit.notes || '').match(/PHC Stage:\s*(.*)/i);
        setPhcStage(matchPhcStage ? matchPhcStage[1].trim() : 'TO_CONTACT');
      } else {
        setIsViewOnly(false);
        setSelectedContactId(contactId || '');
        setSelectedCategory('HEALTH');
        setSelectedCompanyId('');
        setSelectedPlanId('');
        setPolicyNumber('');
        setAgentCode('');
        setStatus('ACTIVE');
        setAssignedEmployeeId('');
        setSumAssured('');
        setPremiumAmount('');
        setPaymentFrequency('YEARLY');
        setStartDate('');
        setEndDate('');
        setNextDueDate('');
        setMaturityDate('');
        setNotes('');
        setPolicyZoneCity('');
        setDownpaymentAmount('');
        setProcessingFee('');
        setInstallmentAmount('');
        setNoOfInstallments('');
        setLastInstallmentDate('');
        setInsuredPerson('');
        setPhcInsuredPerson('');
        setPhcStage('TO_CONTACT');
        setIsManualPhcPerson(false);
        setMembers([]);
        setMemberName('');
        setMemberDob('');
        setPendingDocs([]);
      }
    }
  }, [open, policyToEdit, contactId]);

  const [activeTab, setActiveTab] = useState<'policyPlan' | 'premium' | 'connectedPersons' | 'phcDetails' | 'policyDocs'>('policyPlan');

  // Collapsible Section Header States (false = expanded by default)
  const [isPolicyDetailsCollapsed, setIsPolicyDetailsCollapsed] = useState(false);
  const [isPlanDetailsCollapsed, setIsPlanDetailsCollapsed] = useState(false);
  const [isPremiumBreakdownCollapsed, setIsPremiumBreakdownCollapsed] = useState(false);
  const [isTenureDatesCollapsed, setIsTenureDatesCollapsed] = useState(false);
  const [isEmiDetailsCollapsed, setIsEmiDetailsCollapsed] = useState(false);

  // Tab 1: Policy & Plan Details
  const [insuredPerson, setInsuredPerson] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('HEALTH');
  const [businessType, setBusinessType] = useState<'FRESH' | 'PORT' | 'RENEWAL'>('FRESH');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [policyPeriod, setPolicyPeriod] = useState('1 Yr');
  const [policyNumber, setPolicyNumber] = useState('');
  const [agentCode, setAgentCode] = useState('');
  const [status, setStatus] = useState('INFORCE');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState('');
  const [customerCategory, setCustomerCategory] = useState('Fresh');
  const [policyZoneCity, setPolicyZoneCity] = useState('');
  const [previousPolicyId, setPreviousPolicyId] = useState('');
  const [copyPreviousDetails, setCopyPreviousDetails] = useState(false);
  const [loadingCopy, setLoadingCopy] = useState(false);

  // Fetch list of existing policies for Renewal Previous Policy dropdown
  const { data: previousPoliciesRes } = useQuery({
    queryKey: ['existing-policies-picker', contactId],
    queryFn: () => policiesService.list({ ...(contactId ? { contactId } : {}), limit: 100 }),
    enabled: open && businessType === 'RENEWAL',
  });
  const previousPolicies: any[] = Array.isArray(previousPoliciesRes?.data)
    ? previousPoliciesRes.data
    : Array.isArray(previousPoliciesRes)
    ? previousPoliciesRes
    : [];

  const handleCopyFromPreviousPolicy = async (polId: string) => {
    if (!polId) return;
    try {
      setLoadingCopy(true);
      const res = await policiesService.getCopyDetails(polId);
      const data = res?.data || res;
      if (data) {
        if (data.policyType) setSelectedCategory(data.policyType.toUpperCase());
        if (data.companyId) setSelectedCompanyId(data.companyId);
        if (data.planId) setSelectedPlanId(data.planId);
        if (data.sumAssured != null) setSumAssured(String(data.sumAssured));
        if (data.premiumAmount != null) setPremiumAmount(String(data.premiumAmount));
        if (data.paymentFrequency) setPaymentFrequency(data.paymentFrequency);
        if (data.agentCode) setAgentCode(data.agentCode);
        if (data.assignedEmployeeId) setAssignedEmployeeId(data.assignedEmployeeId);
        if (data.customerCategory) setCustomerCategory(data.customerCategory);
        if (data.notes) {
          setNotes(data.notes);
          const matchDownpayment = (data.notes || '').match(/Downpayment(?: Amount)?:\s*₹?\s*([0-9.]+)/i);
          if (matchDownpayment) setDownpaymentAmount(matchDownpayment[1].trim());
          const matchProcessing = (data.notes || '').match(/Processing Fee(?:\s*\(incl\.\s*GST\))?:\s*₹?\s*([0-9.]+)/i);
          if (matchProcessing) setProcessingFee(matchProcessing[1].trim());
          const matchInstallment = (data.notes || '').match(/Installment Amount:\s*₹?\s*([0-9.]+)/i) || (data.notes || '').match(/Premium:\s*₹\s*([0-9.]+)/i);
          if (matchInstallment) {
            setInstallmentAmount(matchInstallment[1].trim());
            setEmiPremium(matchInstallment[1].trim());
          }
          const matchNoOfInst = (data.notes || '').match(/No\.\s*of Installments:\s*([0-9]+)/i);
          if (matchNoOfInst) setNoOfInstallments(matchNoOfInst[1].trim());
          const matchLastInst = (data.notes || '').match(/Last Installment Date:\s*(.*)/i);
          if (matchLastInst) setLastInstallmentDate(matchLastInst[1].trim());
          const matchInstDate = (data.notes || '').match(/Installment Date:\s*(.*)/i);
          if (matchInstDate) setEmiDate(matchInstDate[1].trim());
          const matchInsured = (data.notes || '').match(/Insured Person:\s*(.*)/i);
          if (matchInsured) setInsuredPerson(matchInsured[1].trim());
        }
        if (Array.isArray(data.members) && data.members.length > 0) {
          setMembers(data.members.map((m: any) => ({
            name: m.name || `${m.firstName || ''} ${m.lastName || ''}`.trim(),
            relationship: m.relationship || 'Spouse',
            dob: m.dateOfBirth ? m.dateOfBirth.slice(0, 10) : (m.dob || ''),
          })));
        }
        toast.success('Pre-filled details from previous policy. All fields remain editable.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to copy previous policy details');
    } finally {
      setLoadingCopy(false);
    }
  };

  // Tab 2: Premium & Payment Details
  const [sumAssured, setSumAssured] = useState('');
  const [premiumAmount, setPremiumAmount] = useState('');
  const [paymentFrequency, setPaymentFrequency] = useState('YEARLY');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [firstPremiumDate, setFirstPremiumDate] = useState('');
  const [premiumPaymentPeriod, setPremiumPaymentPeriod] = useState('');
  const [lastPremiumDate, setLastPremiumDate] = useState('');
  const [noOfInstallments, setNoOfInstallments] = useState('');
  const [lastInstallmentDate, setLastInstallmentDate] = useState('');

  // Auto-calculate End Date and Maturity Date based on Start Date & Policy Period
  const autoCalculateDates = useCallback((startIso: string, periodStr: string) => {
    if (!startIso) return;
    const start = new Date(startIso);
    if (isNaN(start.getTime())) return;

    const match = periodStr.match(/(\d+)/);
    if (!match) return;

    const years = parseInt(match[1], 10);
    if (isNaN(years) || years <= 0) return;

    // End Date = startDate + X years - 1 day
    const end = new Date(start.getFullYear() + years, start.getMonth(), start.getDate() - 1);
    // Maturity Date = startDate + X years
    const maturity = new Date(start.getFullYear() + years, start.getMonth(), start.getDate());

    setEndDate(end.toISOString().split('T')[0]);
    setMaturityDate(maturity.toISOString().split('T')[0]);
  }, []);

  // ── Backend Policy Scenario Rule Lookup ───────────────────────────────────
  const { data: activeScenarioRes } = useQuery({
    queryKey: ['active-policy-scenario', selectedCategory, businessType, selectedCompanyId, selectedPlanId],
    queryFn: () => policiesService.lookupScenario({
      policyType: selectedCategory,
      businessType,
      companyId: selectedCompanyId,
      planId: selectedPlanId,
    }),
    enabled: open && !!selectedCompanyId && !!selectedPlanId,
  });
  const activeScenario = activeScenarioRes?.data || null;

  // Dynamically derived options from backend scenario configuration
  const dynamicPolicyPeriods = useMemo(() => {
    if (activeScenario && Array.isArray(activeScenario.policyPeriods) && activeScenario.policyPeriods.length > 0) {
      return activeScenario.policyPeriods;
    }
    return ['1 Yr', '2 Yr', '3 Yr', '4 Yr', '5 Yr', '10 Yr', '15 Yr', '20 Yr', '25 Yr', '30 Yr', '99 Yr'];
  }, [activeScenario]);

  const dynamicPaymentOptions = useMemo(() => {
    if (activeScenario && Array.isArray(activeScenario.paymentOptions) && activeScenario.paymentOptions.length > 0) {
      return activeScenario.paymentOptions;
    }
    return ['Full Payment', 'EMI', 'Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'];
  }, [activeScenario]);

  const dynamicEmiMonths = useMemo(() => {
    if (activeScenario && Array.isArray(activeScenario.emiMonths) && activeScenario.emiMonths.length > 0) {
      return activeScenario.emiMonths;
    }
    return ['3 Months', '6 Months', '9 Months', '12 Months', '18 Months', '24 Months', '36 Months'];
  }, [activeScenario]);

  const dynamicPaymentTerms = useMemo(() => {
    if (activeScenario && Array.isArray(activeScenario.paymentTerms)) {
      return activeScenario.paymentTerms;
    }
    return [];
  }, [activeScenario]);

  // EMI Case
  const [emiCase, setEmiCase] = useState(false);
  const [emiGateway, setEmiGateway] = useState('');
  const [emiDate, setEmiDate] = useState('');
  const [emiPremium, setEmiPremium] = useState('');
  const [downpaymentAmount, setDownpaymentAmount] = useState('');
  const [processingFee, setProcessingFee] = useState('');
  const [installmentAmount, setInstallmentAmount] = useState('');

  // Auto-calculate Last Installment Date based on First Premium / Start Date, No. of Installments, Frequency, and Day
  useEffect(() => {
    const baseDate = firstPremiumDate || startDate;
    if (baseDate && noOfInstallments) {
      const calculated = calculateLastInstallmentDate(
        baseDate,
        noOfInstallments,
        paymentFrequency || 'MONTHLY',
        emiDate
      );
      if (calculated) {
        setLastPremiumDate(calculated);
        setLastInstallmentDate(calculated);
      }
    }
  }, [firstPremiumDate, startDate, noOfInstallments, paymentFrequency, emiDate]);

  // Card 4: Payment Mode & Loan Details
  const [paymentMode, setPaymentMode] = useState('ONLINE');
  const [paymentDate, setPaymentDate] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [isLoanCase, setIsLoanCase] = useState(false);
  const [loanAmount, setLoanAmount] = useState('');
  const [loanProvider, setLoanProvider] = useState('');
  const [loanSanctionNo, setLoanSanctionNo] = useState('');
  const [loanEmi, setLoanEmi] = useState('');

  // Card 5: Payment Account Details
  const [bankName, setBankName] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');

  // Card 6: GST & Tax Details
  const [gstApplicable, setGstApplicable] = useState(true);
  const [gstPercentage, setGstPercentage] = useState('18');
  const [gstAmount, setGstAmount] = useState('');

  // Collapse Section States
  const [isPaymentModeLoanCollapsed, setIsPaymentModeLoanCollapsed] = useState(false);
  const [isPaymentAccountCollapsed, setIsPaymentAccountCollapsed] = useState(false);
  const [isGstDetailsCollapsed, setIsGstDetailsCollapsed] = useState(false);

  // Tab 3: Connected Persons
  const [members, setMembers] = useState<any[]>([]);
  const [memberName, setMemberName] = useState('');
  const [memberRel, setMemberRel] = useState('Spouse');
  const [memberDob, setMemberDob] = useState('');

  // Tab 4: PHC Details
  const [phcRequired, setPhcRequired] = useState(false);
  const [phcInsuredPerson, setPhcInsuredPerson] = useState('');
  const [isManualPhcPerson, setIsManualPhcPerson] = useState(false);
  const [phcAmount, setPhcAmount] = useState('');
  const [phcStatus, setPhcStatus] = useState('PENDING');
  const [phcStage, setPhcStage] = useState('TO_CONTACT');
  const [phcClaimSettled, setPhcClaimSettled] = useState(false);
  const [notes, setNotes] = useState('');

  // Tab 5: Documents
  const [pendingDocs, setPendingDocs] = useState<{ file: File; tag: string; title: string }[]>([]);
  const [docTag, setDocTag] = useState('POLICY_DOCUMENT');
  const [docTitle, setDocTitle] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const phcInsuredPersonOptions = useMemo(() => {
    const list: { value: string; label: string; sublabel?: string }[] = [];
    const seen = new Set<string>();

    const primary = (insuredPerson || contactName || '').trim();
    if (primary) {
      list.push({
        value: primary,
        label: `${primary} (Self / Primary)`,
        sublabel: 'Primary Insured Person',
      });
      seen.add(primary.toLowerCase());
    }

    members.forEach((m: any) => {
      const name = (m.name || '').trim();
      if (name && !seen.has(name.toLowerCase())) {
        list.push({
          value: name,
          label: `${name} (${m.relationship || 'Member'})`,
          sublabel: m.relationship ? `Relationship: ${m.relationship}` : 'Family Member',
        });
        seen.add(name.toLowerCase());
      }
    });

    const current = (phcInsuredPerson || '').trim();
    if (current && !seen.has(current.toLowerCase())) {
      list.push({
        value: current,
        label: current,
        sublabel: 'Custom Name',
      });
    }

    return list;
  }, [insuredPerson, contactName, members, phcInsuredPerson]);

  // Fetch All Plans via policiesService.plans()
  const { data: allPlansRes } = useQuery({
    queryKey: ['all-plans-list-picker'],
    queryFn: () => policiesService.plans(),
    enabled: open,
  });
  const plansList: any[] = Array.isArray(allPlansRes?.data) ? allPlansRes.data : Array.isArray(allPlansRes) ? allPlansRes : [];

  const DEFAULT_COMPANIES_FOR_MODAL: Record<string, string[]> = {
    HEALTH: ['Star Health', 'Niva Bupa', 'Care', 'Manipal Cigna', 'HDFC Ergo', 'ICICI Lombard', 'Bajaj General', 'TATA AIG'],
    GENERAL: ['HDFC Ergo', 'ICICI Lombard', 'Bajaj General', 'TATA AIG', 'Star Health', 'Niva Bupa', 'Care', 'Manipal Cigna'],
    LIFE: ['HDFC Life', 'ICICI Pru Life', 'Bajaj Life', 'TATA AIA'],
    TERM: ['HDFC Life', 'ICICI Pru Life', 'Bajaj Life', 'TATA AIA'],
  };
  const ALL_DEFAULT_COMPANIES = [
    'Star Health', 'Niva Bupa', 'Care', 'Manipal Cigna',
    'HDFC Ergo', 'ICICI Lombard', 'Bajaj General', 'TATA AIG',
    'HDFC Life', 'ICICI Pru Life', 'Bajaj Life', 'TATA AIA',
  ];

  // Filter unique companies for selected Category
  const availableCompanies = useMemo(() => {
    const categoryPlans = selectedCategory
      ? plansList.filter((p: any) => (p.category || 'OTHER').toUpperCase() === selectedCategory.toUpperCase())
      : plansList;

    const map = new Map<string, { id: string; name: string }>();

    const catKey = (selectedCategory || '').toUpperCase();
    const defaults = catKey && DEFAULT_COMPANIES_FOR_MODAL[catKey]
      ? DEFAULT_COMPANIES_FOR_MODAL[catKey]
      : ALL_DEFAULT_COMPANIES;

    defaults.forEach(d => {
      const matchingPlan = plansList.find((p: any) => (p.company?.name || '').toLowerCase() === d.toLowerCase());
      const idKey = matchingPlan?.company?.id || d;
      map.set(idKey, { id: idKey, name: d });
    });

    categoryPlans.forEach((p: any) => {
      const co = p.company;
      if (co && (co.id || co.name)) {
        const idKey = co.id || co.name;
        if (!map.has(idKey)) {
          map.set(idKey, { id: idKey, name: co.name });
        }
      }
    });
    return Array.from(map.values());
  }, [plansList, selectedCategory]);

  // Filter plans for selected Category and selected Company
  const availablePlans = useMemo(() => {
    return plansList.filter((p: any) => {
      const catMatch = !selectedCategory || (p.category || 'OTHER').toUpperCase() === selectedCategory.toUpperCase();
      const coName = p.company?.name || '';
      const coMatch = !selectedCompanyId ||
        p.companyId === selectedCompanyId ||
        p.company?.id === selectedCompanyId ||
        coName.toLowerCase() === selectedCompanyId.toLowerCase() ||
        coName.toLowerCase().includes(selectedCompanyId.toLowerCase()) ||
        selectedCompanyId.toLowerCase().includes(coName.toLowerCase());
      return catMatch && coMatch;
    });
  }, [plansList, selectedCategory, selectedCompanyId]);

  const handleAddMember = () => {
    if (!memberName.trim()) return;
    setMembers(prev => [...prev, {
      name: memberName.trim(),
      relationship: memberRel,
      dob: memberDob,
      isNominee: memberRel === 'Nominee',
    }]);
    setMemberName('');
    setMemberDob('');
  };

  const handleRemoveMember = (idx: number) => {
    setMembers(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddDoc = (file: File) => {
    if (!file) return;
    setPendingDocs(prev => [...prev, { file, tag: docTag, title: docTitle.trim() || file.name }]);
    setDocTitle('');
  };

  const handleRemoveDoc = (idx: number) => {
    setPendingDocs(prev => prev.filter((_, i) => i !== idx));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalContactId = selectedContactId || contactId || policyToEdit?.contactId;
    if (!finalContactId) {
      toast.error('Target Contact / Client Name is required');
      setActiveTab('policyPlan');
      return;
    }
    if (!selectedPlanId) {
      toast.error('Please select an Insurance Plan');
      setActiveTab('policyPlan');
      return;
    }
    if (!policyNumber.trim()) {
      toast.error('Policy Number is required');
      setActiveTab('policyPlan');
      return;
    }
    const safeIsoDate = (val?: any) => {
      if (!val) return undefined;
      if (val instanceof Date) return val.toISOString();
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (!trimmed) return undefined;
        try {
          const d = new Date(trimmed);
          if (!isNaN(d.getTime())) return d.toISOString();
        } catch { /* ignore */ }
        return trimmed;
      }
      try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d.toISOString();
      } catch { /* ignore */ }
      return undefined;
    };

    const isoStart = safeIsoDate(startDate);
    const isoEnd = safeIsoDate(endDate);

    if (!isoStart) {
      toast.error('Valid Start Date is required');
      setActiveTab('premium');
      return;
    }
    if (!isoEnd) {
      toast.error('Valid End Date is required');
      setActiveTab('premium');
      return;
    }

    setSubmitting(true);
    try {
      // Build notes text combining extras if present
      let cleanNotes = notes.trim();
      if (policyZoneCity) {
        cleanNotes += `\nPolicy Zone City: ${policyZoneCity}`;
        cleanNotes += `\nPolicy Zone Location City: ${policyZoneCity}`;
      }
      if (insuredPerson) cleanNotes += `\nInsured Person: ${insuredPerson}`;
      if (firstPremiumDate) cleanNotes += `\nFirst Premium Date: ${firstPremiumDate}`;
      if (premiumPaymentPeriod) cleanNotes += `\nPremium Payment Period: ${premiumPaymentPeriod} Years`;
      if (lastPremiumDate) cleanNotes += `\nLast Premium Date: ${lastPremiumDate}`;
      if (downpaymentAmount) cleanNotes += `\nDownpayment Amount: ₹${downpaymentAmount}`;
      if (processingFee) cleanNotes += `\nProcessing Fee (incl. GST): ₹${processingFee}`;
      if (installmentAmount || emiPremium) {
        cleanNotes += `\nInstallment Amount: ₹${installmentAmount || emiPremium}`;
      }
      if (noOfInstallments) cleanNotes += `\nNo. of Installments: ${noOfInstallments}`;
      if (emiDate) cleanNotes += `\nInstallment Date: ${emiDate}`;
      if (lastInstallmentDate || lastPremiumDate) {
        cleanNotes += `\nLast Installment Date: ${lastInstallmentDate || lastPremiumDate}`;
      }
      if (emiCase) {
        cleanNotes += `\nEMI Case: Gateway: ${emiGateway || 'N/A'}, Date: ${emiDate || 'N/A'}, Premium: ₹${emiPremium || installmentAmount || '0'}, Downpayment: ₹${downpaymentAmount || '0'}, Processing Fee: ₹${processingFee || '0'}, No of Installments: ${noOfInstallments || 'N/A'}, Last Installment Date: ${lastInstallmentDate || lastPremiumDate || 'N/A'}`;
      }
      if (paymentMode) cleanNotes += `\nPayment Mode: ${paymentMode}, Date: ${paymentDate || 'N/A'}, Ref: ${transactionRef || 'N/A'}`;
      if (isLoanCase) cleanNotes += `\nLoan Case: Amount: ₹${loanAmount || '0'}, Provider: ${loanProvider || 'N/A'}, Sanction No: ${loanSanctionNo || 'N/A'}, EMI: ₹${loanEmi || '0'}`;
      if (bankName) cleanNotes += `\nBank Details: Bank: ${bankName}, IFSC: ${ifscCode || 'N/A'}, A/C: ${accountNumber || 'N/A'}, Holder: ${accountHolderName || 'N/A'}`;
      if (gstApplicable) cleanNotes += `\nGST Details: Applicable: Yes (${gstPercentage}%), GST Amount: ₹${gstAmount || '0'}`;
      if (phcRequired) {
        cleanNotes += `\nPreventive Health Checkup: Amount: ₹${phcAmount || '0'}, Status: ${phcStatus}, Settled: ${phcClaimSettled ? 'Yes' : 'No'}${phcInsuredPerson ? `, Insured Person: ${phcInsuredPerson}` : ''}`;
        if (phcInsuredPerson) cleanNotes += `\nPHC Insured Person: ${phcInsuredPerson}`;
        cleanNotes += `\nPHC Stage: ${phcStage || 'TO_CONTACT'}`;
      }
      if (members.length > 0) {
        members.forEach((m, idx) => {
          if (m.relationship === 'Nominee' || m.isNominee) {
            cleanNotes += `\nNominee Details ${idx + 1}: Name: ${m.name}, Relationship: ${m.relationship}, DoB: ${m.dob || m.dateOfBirth || 'N/A'}`;
          } else {
            cleanNotes += `\nConnected Person ${idx + 1}: Name: ${m.name}, Relationship: ${m.relationship}, DoB: ${m.dob || m.dateOfBirth || 'N/A'}`;
          }
        });
      }

      const payload: any = {
        contactId: finalContactId,
        planId: selectedPlanId,
        policyNumber: policyNumber.trim(),
        sumAssured: sumAssured ? Number(sumAssured) : 0,
        premiumAmount: premiumAmount ? Number(premiumAmount) : 0,
        paymentFrequency,
        startDate: isoStart,
        endDate: isoEnd,
        nextDueDate: safeIsoDate(nextDueDate),
        maturityDate: safeIsoDate(maturityDate),
        businessType,
        renewedFromPolicyId: (businessType === 'RENEWAL' && previousPolicyId) ? previousPolicyId : undefined,
        assignedEmployeeId: assignedEmployeeId || undefined,
        status: status as any,
        notes: cleanNotes || undefined,
      };

      let res;
      if (policyToEdit && policyToEdit.id) {
        res = await policiesService.update(policyToEdit.id, payload);
      } else {
        res = await policiesService.create(payload);
      }

      const savedPolicy = res?.data ?? res;

      // Upload pending documents
      if (savedPolicy?.id && pendingDocs.length > 0) {
        for (const doc of pendingDocs) {
          try {
            await documentsService.upload(doc.file, {
              policyId: savedPolicy.id,
              type: doc.tag,
              title: doc.title,
            });
          } catch (uploadErr) {
            console.error('Document upload error:', uploadErr);
          }
        }
      }

      const targetPolicyId = policyToEdit?.id || savedPolicy?.id;
      if (targetPolicyId && members.length > 0) {
        for (const m of members) {
          try {
            if (m.relationship === 'Nominee' || m.isNominee) {
              await policiesService.addNominee(targetPolicyId, {
                name: m.name,
                relationship: 'Other',
                sharePercent: 100,
                dateOfBirth: (m.dob || m.dateOfBirth) ? new Date(m.dob || m.dateOfBirth).toISOString() : undefined,
              });
            } else {
              await policiesService.addMember(targetPolicyId, {
                name: m.name,
                relationship: m.relationship || 'Spouse',
                dateOfBirth: (m.dob || m.dateOfBirth) ? new Date(m.dob || m.dateOfBirth).toISOString() : undefined,
              });
            }
          } catch { /* ignore */ }
        }
      }

      qc.invalidateQueries({ queryKey: ['policies'] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
      if (contactId) qc.invalidateQueries({ queryKey: ['contact', contactId] });
      toast.success(policyToEdit ? 'Policy updated successfully' : 'Policy created successfully');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || (policyToEdit ? 'Failed to update policy' : 'Failed to create policy');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={policyToEdit ? (isViewOnly ? 'Policy Details' : 'Edit Policy') : 'Add New Policy'}
      subtitle={contactName ? (policyToEdit ? (isViewOnly ? `Policy details for ${contactName}` : `Update policy profile for ${contactName}`) : `Attach policy profile for ${contactName}`) : (policyToEdit ? (isViewOnly ? 'View policy details matching client standards.' : 'Update policy details matching client standards.') : 'Enter policy details matching client standards.')}
      size="2xl"
      icon={<Shield className="text-blue-600" size={20} />}
      actions={
        <div className="flex flex-wrap items-center gap-2.5 mr-1">
          {policyToEdit && isViewOnly ? (
            <button
              type="button"
              onClick={() => setIsViewOnly(false)}
              className="flex items-center gap-1.5 px-3 sm:px-5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl cursor-pointer shadow-md shadow-blue-500/20 transition-all hover:scale-105"
            >
              <Pencil size={13} />
              <span>Edit Policy</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={(e) => handleFormSubmit(e as any)}
              className="px-3 sm:px-5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl cursor-pointer shadow-md shadow-blue-500/20 transition-all hover:scale-105 disabled:opacity-50"
            >
              {submitting ? (policyToEdit ? 'Updating Policy…' : 'Saving Policy…') : (policyToEdit ? 'Update Policy' : 'Save Policy')}
            </button>
          )}
        </div>
      }
    >
      <form onSubmit={handleFormSubmit} className="space-y-3 py-1">
        {/* ── Sub-navigation 5 Tabs Header (Matches main Policies page) ────────────── */}
        <div className="flex flex-wrap bg-slate-200/60 p-1.5 rounded-2xl mb-3 gap-1.5 sm:gap-2 border border-slate-200/80 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('policyPlan')}
            className={clsx(
              'px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 sm:gap-2',
              activeTab === 'policyPlan'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            )}
          >
            <Shield size={14} />
            Policy & Plan Details
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('premium')}
            className={clsx(
              'px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 sm:gap-2',
              activeTab === 'premium'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            )}
          >
            <CreditCard size={14} />
            Premium & Payment Details
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('connectedPersons')}
            className={clsx(
              'px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 sm:gap-2',
              activeTab === 'connectedPersons'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            )}
          >
            <Users size={14} />
            Connected Persons ({members.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('phcDetails')}
            className={clsx(
              'px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 sm:gap-2',
              activeTab === 'phcDetails'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            )}
          >
            <Activity size={14} />
            Health Check
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('policyDocs')}
            className={clsx(
              'px-3 sm:px-4 py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 sm:gap-2',
              activeTab === 'policyDocs'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            )}
          >
            <FileText size={14} />
            Documents ({pendingDocs.length})
          </button>
        </div>

        {/* ── Form Content Container ───────────────────────────────────────── */}
        <div className="space-y-4">
          <fieldset disabled={isViewOnly} className="contents">

          {/* ════════ TAB 1: Policy & Plan Details ════════ */}
          {activeTab === 'policyPlan' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Target Contact / Client Name Selection & Banner */}
              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCircle2 className="text-blue-600" size={18} />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Target Contact / Client Name <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span></p>
                      <p className="text-xs font-extrabold text-blue-950">
                        {contactName || (contactsList.find(c => c.id === selectedContactId)?.firstName
                          ? `${contactsList.find(c => c.id === selectedContactId)?.firstName} ${contactsList.find(c => c.id === selectedContactId)?.lastName || ''}`
                          : 'Select Target Contact')}
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white font-mono text-[10px] font-bold">Attached</span>
                </div>

                <div>
                  <CustomSelect
                    value={selectedContactId}
                    onChange={val => {
                      setSelectedContactId(val);
                      if (!insuredPerson) {
                        const c = contactsList.find((x: any) => x.id === val);
                        if (c) setInsuredPerson(`${c.firstName || c.name || ''} ${c.lastName || ''}`.trim());
                      }
                    }}
                    placeholder="-- Select Target Contact / Client Name --"
                    searchable
                    options={[
                      { value: '', label: '-- Select Target Contact / Client Name --' },
                      ...contactsList.map((c: any) => ({
                        value: c.id,
                        label: `${c.firstName || c.name || ''} ${c.lastName || ''} ${c.phone ? `(${c.phone})` : ''}`.trim()
                      }))
                    ]}
                  />
                </div>
              </div>

              {/* Section 1 Card: Policy Details */}
              <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
                <div
                  className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none rounded-t-2xl"
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
                    {/* Product Category */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                        Product Category <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <CustomSelect
                        value={selectedCategory}
                        onChange={val => setSelectedCategory(val)}
                        placeholder="Select Product Category"
                        options={CATEGORIES.map(cat => ({ value: cat, label: cat.replace('_', ' ') }))}
                      />
                    </div>

                    {/* Business Type */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                        Business Type <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <CustomSelect
                        value={businessType}
                        onChange={val => setBusinessType(val as any)}
                        placeholder="Select Business Type"
                        options={[
                          { value: 'FRESH', label: 'Fresh' },
                          { value: 'PORT', label: 'Port' },
                          { value: 'RENEWAL', label: 'Renewal' },
                        ]}
                      />
                    </div>

                    {/* Renewal Selection & Copy Details */}
                    {businessType === 'RENEWAL' && (
                      <div className="col-span-1 md:col-span-2 border border-amber-200 bg-amber-50/70 rounded-xl p-3 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <label className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                            <RotateCw size={13} className="text-amber-600" />
                            Select Previous Policy to Renew <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={copyPreviousDetails}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setCopyPreviousDetails(checked);
                                if (checked && previousPolicyId) {
                                  handleCopyFromPreviousPolicy(previousPolicyId);
                                }
                              }}
                              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-amber-950">
                              ☐ Copy details from previous policy
                            </span>
                          </label>
                        </div>

                        <CustomSelect
                          value={previousPolicyId}
                          onChange={val => {
                            setPreviousPolicyId(val);
                            if (copyPreviousDetails && val) {
                              handleCopyFromPreviousPolicy(val);
                            }
                          }}
                          placeholder={`-- Select Previous Policy (${previousPolicies.length} available) --`}
                          searchable
                          options={[
                            { value: '', label: `-- Select Previous Policy (${previousPolicies.length} available) --` },
                            ...previousPolicies.map((pol: any) => {
                              const stDisplay = getPolicyStatusDisplay(pol);
                              return {
                                value: pol.id,
                                label: `Policy #${pol.policyNumber} — ${pol.plan?.name || 'Plan'} (${stDisplay.label}) — Ends: ${pol.endDate ? String(pol.endDate).split('T')[0] : 'N/A'}`
                              };
                            })
                          ]}
                        />

                        {loadingCopy && (
                          <p className="text-[10px] text-amber-800 font-medium italic animate-pulse">
                            Fetching and pre-filling previous policy details...
                          </p>
                        )}
                      </div>
                    )}

                    {/* Insurance Company */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                        Insurance Company <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <CustomSelect
                        value={selectedCompanyId}
                        onChange={val => {
                          setSelectedCompanyId(val);
                          setSelectedPlanId('');
                        }}
                        placeholder="All Insurance Companies"
                        searchable
                        options={[
                          { value: '', label: 'All Insurance Companies' },
                          ...availableCompanies.map((c: any) => ({ value: c.id, label: c.name }))
                        ]}
                      />
                    </div>

                    {/* Insurance Plan */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                        Insurance Plan <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <CustomSelect
                        value={selectedPlanId}
                        onChange={val => setSelectedPlanId(val)}
                        placeholder={`Select Plan (${availablePlans.length} available)`}
                        searchable
                        options={[
                          { value: '', label: `Select Plan (${availablePlans.length} available)` },
                          ...availablePlans.map((p: any) => ({
                            value: p.id,
                            label: `${p.name} ${p.company?.name ? `(${p.company.name})` : ''}`.trim()
                          }))
                        ]}
                      />
                    </div>

                    {/* Policy Period (Driven dynamically by backend scenario) */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1 mb-1">
                        Policy Period <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                        {activeScenario && <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">✓ Dynamic</span>}
                      </label>
                      <CustomSelect
                        value={policyPeriod}
                        onChange={val => {
                          setPolicyPeriod(val);
                          if (startDate) {
                            autoCalculateDates(startDate, val);
                          }
                        }}
                        placeholder="Select Policy Period"
                        options={dynamicPolicyPeriods.map((period: string) => ({ value: period, label: period }))}
                      />
                    </div>

                    {/* Customer Category */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">Customer Category</label>
                      <CustomSelect
                        value={customerCategory}
                        onChange={val => setCustomerCategory(val)}
                        placeholder="Select Customer Category"
                        options={[
                          { value: 'Fresh', label: 'Fresh' },
                          { value: 'Port', label: 'Port' },
                          { value: 'Renewal', label: 'Renewal' },
                        ]}
                      />
                    </div>

                    {/* Insured Person */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                        Insured Person
                      </label>
                      <input
                        type="text"
                        className="input text-xs w-full mt-1 font-bold text-slate-800"
                        placeholder="e.g. Self / Name of Insured Person"
                        value={insuredPerson}
                        onChange={(e) => setInsuredPerson(e.target.value)}
                      />
                    </div>

                    {/* Active Scenario Indicator Banner */}
                    {activeScenario && (
                      <div className="col-span-1 md:col-span-2 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity size={16} className="text-emerald-600 shrink-0" />
                          <div>
                            <p className="font-bold text-[11px]">Backend Scenario Rule Applied</p>
                            <p className="text-[10px] text-emerald-700 font-medium">
                              Configured for {activeScenario.company?.name || 'Company'} — {activeScenario.plan?.name || 'Plan'} ({activeScenario.businessType}). Valid periods & payment modes loaded from DB.
                            </p>
                          </div>
                        </div>
                        <span className="bg-emerald-600 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0">
                          Active Rule
                        </span>
                      </div>
                    )}

                    {/* Policy Remarks / Comment */}
                    <div className="col-span-1 md:col-span-2">
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">Comment / Notes</label>
                      <textarea
                        rows={2}
                        className="input text-xs w-full mt-1 min-h-[50px]"
                        placeholder="Add any internal comments or notes regarding this policy..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2 Card: Plan Details */}
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
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* Policy Number */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">
                        Policy Number <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="input text-xs w-full mt-1"
                        placeholder="e.g. POL-1002938"
                        value={policyNumber}
                        onChange={(e) => setPolicyNumber(e.target.value)}
                        required
                      />
                    </div>

                    {/* Insured Person */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">
                        Insured Person
                      </label>
                      <input
                        type="text"
                        className="input text-xs w-full mt-1 font-bold text-slate-800"
                        placeholder="e.g. Self / Name of Insured Person"
                        value={insuredPerson}
                        onChange={(e) => setInsuredPerson(e.target.value)}
                      />
                    </div>

                    {/* Agent Code */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">Agent Code</label>
                      <input
                        type="text"
                        className="input text-xs w-full mt-1"
                        placeholder="e.g. AG-8821"
                        value={agentCode}
                        onChange={(e) => setAgentCode(e.target.value)}
                      />
                    </div>

                    {/* Policy Zone City */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">Policy Zone City</label>
                      <input
                        type="text"
                        className="input text-xs w-full mt-1"
                        placeholder="Type policy zone city manually..."
                        value={policyZoneCity}
                        onChange={(e) => setPolicyZoneCity(e.target.value)}
                      />
                    </div>

                    {/* Policy Status */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">Policy Status</label>
                      <CustomSelect
                        value={status === 'ACTIVE' ? 'INFORCE' : (status || 'INFORCE')}
                        onChange={val => setStatus(val)}
                        placeholder="Select Policy Status"
                        options={STATUS_OPTIONS}
                      />
                    </div>

                    {/* Assigned Employee */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">Assigned Employee</label>
                      <CustomSelect
                        value={assignedEmployeeId}
                        onChange={val => setAssignedEmployeeId(val)}
                        placeholder="Unassigned"
                        options={[
                          { value: '', label: 'Unassigned' },
                          ...(employees || []).map((emp: any) => ({
                            value: emp.id,
                            label: `${emp.firstName || emp.name} ${emp.lastName || ''}`.trim()
                          }))
                        ]}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════ TAB 2: Premium & Payment Details ════════ */}
          {activeTab === 'premium' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Section 1 Card: Premium Breakdown & Coverage */}
              <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
                <div
                  className="bg-gradient-to-r from-emerald-50/80 via-slate-50 to-teal-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none rounded-t-2xl"
                  onClick={() => setIsPremiumBreakdownCollapsed(prev => !prev)}
                >
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">1</span>
                    Premium Breakdown & Coverage
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-semibold">Sum Assured & Payment Terms</span>
                    <ChevronDown
                      size={16}
                      className={`text-slate-500 transition-transform duration-200 ${isPremiumBreakdownCollapsed ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {!isPremiumBreakdownCollapsed && (
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {/* Sum Assured */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">
                        Sum Assured (₹) {isFieldRequired('sumAssured', false) && <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>}
                      </label>
                      <input
                        type="number"
                        className="input text-xs w-full mt-1"
                        placeholder="e.g. 500000"
                        value={sumAssured}
                        onChange={(e) => setSumAssured(e.target.value)}
                        required={isFieldRequired('sumAssured', false)}
                      />
                    </div>

                    {/* Premium Amount */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">
                        Premium Amount (₹) <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input
                        type="number"
                        className="input text-xs w-full mt-1"
                        placeholder="e.g. 15000"
                        value={premiumAmount}
                        onChange={(e) => setPremiumAmount(e.target.value)}
                      />
                    </div>

                    {/* Payment Option / Frequency (Driven dynamically by backend scenario) */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1 mb-1">
                        Premium Payment <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                        {activeScenario && <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1 rounded">✓ Dynamic</span>}
                      </label>
                      <CustomSelect
                        value={paymentFrequency}
                        onChange={val => setPaymentFrequency(val)}
                        placeholder="Select Payment Frequency"
                        options={dynamicPaymentOptions.map((opt: string) => {
                          const valKey = opt.toUpperCase().replace(/\s+/g, '_');
                          return { value: valKey, label: opt };
                        })}
                      />
                    </div>

                    {/* Downpayment Amount */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">
                        Downpayment Amount (₹)
                      </label>
                      <input
                        type="number"
                        className="input text-xs w-full mt-1"
                        placeholder="e.g. 5000"
                        value={downpaymentAmount}
                        onChange={(e) => setDownpaymentAmount(e.target.value)}
                      />
                    </div>

                    {/* Processing Fee (incl. GST) */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">
                        Processing Fee (incl. GST) (₹)
                      </label>
                      <input
                        type="number"
                        className="input text-xs w-full mt-1"
                        placeholder="e.g. 500"
                        value={processingFee}
                        onChange={(e) => setProcessingFee(e.target.value)}
                      />
                    </div>

                    {/* Installment Amount */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">
                        Installment Amount (₹)
                      </label>
                      <input
                        type="number"
                        className="input text-xs w-full mt-1"
                        placeholder="e.g. 2500"
                        value={installmentAmount}
                        onChange={(e) => {
                          setInstallmentAmount(e.target.value);
                          setEmiPremium(e.target.value);
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2 Card: Tenure & Key Dates */}
              <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
                <div
                  className="bg-gradient-to-r from-cyan-50/80 via-slate-50 to-blue-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none rounded-t-2xl"
                  onClick={() => setIsTenureDatesCollapsed(prev => !prev)}
                >
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">2</span>
                    Tenure & Key Dates
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-semibold">Policy Schedule & Due Dates</span>
                    <ChevronDown
                      size={16}
                      className={`text-slate-500 transition-transform duration-200 ${isTenureDatesCollapsed ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {!isTenureDatesCollapsed && (
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                    {/* Start Date */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">
                        Start Date <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <DatePicker
                        value={startDate}
                        onChange={(val: any) => {
                          const newStart = typeof val === 'string' ? val : (val?.target?.value || '');
                          setStartDate(newStart);
                          if (newStart && policyPeriod) {
                            autoCalculateDates(newStart, policyPeriod);
                          }
                        }}
                        className="input text-xs w-full mt-1"
                      />
                    </div>

                    {/* End Date */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">
                        End Date <span className="text-red-600 font-black text-sm ml-0.5" style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <DatePicker
                        value={endDate}
                        onChange={(val: any) => setEndDate(typeof val === 'string' ? val : (val?.target?.value || ''))}
                        className="input text-xs w-full mt-1"
                      />
                    </div>

                    {/* Next Due Date */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">Next Due Date</label>
                      <DatePicker
                        value={nextDueDate}
                        onChange={(val: any) => setNextDueDate(typeof val === 'string' ? val : (val?.target?.value || ''))}
                        className="input text-xs w-full mt-1"
                      />
                    </div>

                    {/* Maturity Date */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">Maturity Date</label>
                      <DatePicker
                        value={maturityDate}
                        onChange={(val: any) => setMaturityDate(typeof val === 'string' ? val : (val?.target?.value || ''))}
                        className="input text-xs w-full mt-1"
                      />
                    </div>

                    {/* First Premium Date / Policy 1st Instalment Date */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">
                        Policy 1st Instalment Date
                      </label>
                      <DatePicker
                        value={firstPremiumDate}
                        onChange={(val: any) => setFirstPremiumDate(typeof val === 'string' ? val : (val?.target?.value || ''))}
                        className="input text-xs w-full mt-1"
                        placeholder="DD/MM/YYYY"
                      />
                    </div>

                    {/* No. of Installments */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider block">
                        No. of Installments
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        className="input text-xs w-full mt-1 font-bold text-slate-800"
                        placeholder="e.g. 12"
                        value={noOfInstallments}
                        onChange={(e) => setNoOfInstallments(e.target.value)}
                      />
                    </div>

                    {/* Installment Date (01 to 31st) */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                        Installment Date (01 to 31st)
                      </label>
                      <CustomSelect
                        value={emiDate ? String(emiDate).padStart(2, '0') : ''}
                        onChange={val => setEmiDate(val)}
                        placeholder="Select Day (01 to 31st)"
                        options={[
                          { value: '', label: 'Select Day' },
                          ...INSTALLMENT_DATE_OPTIONS
                        ]}
                      />
                    </div>

                    {/* Last Installment Date */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">
                        Last Installment Date
                      </label>
                      <DatePicker
                        value={lastInstallmentDate || lastPremiumDate}
                        onChange={(val: any) => {
                          const v = typeof val === 'string' ? val : (val?.target?.value || '');
                          setLastInstallmentDate(v);
                          setLastPremiumDate(v);
                        }}
                        className="input text-xs w-full mt-1 bg-white border border-slate-200 font-semibold"
                        placeholder="Calculated automatically"
                      />
                    </div>

                    {/* Premium Payment Term (PPT) - Shown dynamically when applicable */}
                    {(dynamicPaymentTerms.length > 0 || ['TERM', 'LIFE'].includes(selectedCategory.toUpperCase())) && (
                      <div>
                        <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1">
                          Premium Payment Term (PPT)
                          {activeScenario && <span className="text-[9px] text-teal-600 font-bold bg-teal-50 px-1 rounded">Applicable</span>}
                        </label>
                        {dynamicPaymentTerms.length > 0 ? (
                          <CustomSelect
                            value={premiumPaymentPeriod}
                            onChange={val => setPremiumPaymentPeriod(val)}
                            placeholder="Select Payment Term"
                            options={[
                              { value: '', label: 'Select Payment Term' },
                              ...dynamicPaymentTerms.map((term: string) => ({ value: term, label: term }))
                            ]}
                          />
                        ) : (
                          <input
                            type="text"
                            className="input text-xs w-full mt-1"
                            placeholder="e.g. 10 Yr or 1 to 99 Yr"
                            value={premiumPaymentPeriod}
                            onChange={(e) => setPremiumPaymentPeriod(e.target.value)}
                          />
                        )}
                      </div>
                    )}

                    {/* Last Premium Date */}
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">Last Premium Date</label>
                      <DatePicker
                        value={lastPremiumDate}
                        onChange={(val: any) => {
                          const v = typeof val === 'string' ? val : (val?.target?.value || '');
                          setLastPremiumDate(v);
                          if (!lastInstallmentDate) setLastInstallmentDate(v);
                        }}
                        className="input text-xs w-full mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3 Card: EMI Payment Details */}
              <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-50/80 via-slate-50 to-orange-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                  onClick={() => setIsEmiDetailsCollapsed(prev => !prev)}
                >
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-600 to-orange-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">3</span>
                    EMI Payment Details
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-semibold">Gateway & Installments</span>
                    <ChevronDown
                      size={16}
                      className={`text-slate-500 transition-transform duration-200 ${isEmiDetailsCollapsed ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {!isEmiDetailsCollapsed && (
                  <div className="p-4 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={emiCase}
                        onChange={(e) => setEmiCase(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-bold text-slate-700">EMI Payment Case</span>
                    </label>

                    {emiCase && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                        <div>
                          <label className="label text-[10px] font-bold text-slate-500">EMI Gateway</label>
                          <input
                            type="text"
                            className="input text-xs w-full mt-0.5"
                            placeholder="e.g. Razorpay / HDFC"
                            value={emiGateway}
                            onChange={(e) => setEmiGateway(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="label text-[10px] font-bold text-slate-500">Installment Date (01 to 31st)</label>
                          <CustomSelect
                            value={emiDate ? String(emiDate).padStart(2, '0') : ''}
                            onChange={(val) => setEmiDate(val)}
                            placeholder="Select Day (01 to 31st)"
                            options={[
                              { value: '', label: 'Select Day' },
                              ...INSTALLMENT_DATE_OPTIONS
                            ]}
                          />
                        </div>
                        <div>
                          <label className="label text-[10px] font-bold text-slate-500">No. of Installments</label>
                          <input
                            type="number"
                            min={1}
                            max={120}
                            className="input text-xs w-full mt-0.5 font-bold"
                            placeholder="e.g. 12"
                            value={noOfInstallments}
                            onChange={(e) => setNoOfInstallments(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="label text-[10px] font-bold text-slate-500 block mb-1">
                            Last Installment Date
                          </label>
                          <DatePicker
                            value={lastInstallmentDate || lastPremiumDate}
                            onChange={(val: any) => {
                              const v = typeof val === 'string' ? val : (val?.target?.value || '');
                              setLastInstallmentDate(v);
                              setLastPremiumDate(v);
                            }}
                            className="input text-xs w-full mt-0.5 bg-white border border-slate-200 font-semibold"
                            placeholder="Calculated automatically"
                          />
                        </div>
                        <div>
                          <label className="label text-[10px] font-bold text-slate-500">EMI Monthly Premium / Installment Amount (₹)</label>
                          <input
                            type="number"
                            className="input text-xs w-full mt-0.5"
                            placeholder="e.g. 1250"
                            value={installmentAmount || emiPremium}
                            onChange={(e) => {
                              setEmiPremium(e.target.value);
                              setInstallmentAmount(e.target.value);
                            }}
                          />
                        </div>
                        <div>
                          <label className="label text-[10px] font-bold text-slate-500">Downpayment Amount (₹)</label>
                          <input
                            type="number"
                            className="input text-xs w-full mt-0.5"
                            placeholder="e.g. 5000"
                            value={downpaymentAmount}
                            onChange={(e) => setDownpaymentAmount(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="label text-[10px] font-bold text-slate-500">Processing Fee (incl. GST) (₹)</label>
                          <input
                            type="number"
                            className="input text-xs w-full mt-0.5"
                            placeholder="e.g. 500"
                            value={processingFee}
                            onChange={(e) => setProcessingFee(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Section 4 Card: Payment Mode & Loan Details */}
              <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
                <div
                  className="bg-gradient-to-r from-purple-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none rounded-t-2xl"
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
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div>
                        <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">Payment Mode</label>
                        <CustomSelect
                          value={paymentMode}
                          onChange={val => setPaymentMode(val)}
                          placeholder="Select Payment Mode"
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
                        <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">Transaction / Cheque Date</label>
                        <DatePicker
                          value={paymentDate}
                          onChange={(val) => setPaymentDate(val)}
                          className="input text-xs w-full mt-1"
                        />
                      </div>

                      <div>
                        <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">Transaction Ref / Cheque No.</label>
                        <input
                          type="text"
                          className="input text-xs w-full mt-1"
                          placeholder="e.g. TXN-998811"
                          value={transactionRef}
                          onChange={(e) => setTransactionRef(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isLoanCase}
                          onChange={(e) => setIsLoanCase(e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-bold text-slate-700">Loan Case / Financed Policy</span>
                      </label>

                      {isLoanCase && (
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-2 p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                          <div>
                            <label className="label text-[10px] font-bold text-purple-700">Loan Amount (₹)</label>
                            <input
                              type="number"
                              className="input text-xs w-full mt-0.5"
                              placeholder="e.g. 50000"
                              value={loanAmount}
                              onChange={(e) => setLoanAmount(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="label text-[10px] font-bold text-purple-700">Loan Provider</label>
                            <input
                              type="text"
                              className="input text-xs w-full mt-0.5"
                              placeholder="e.g. Bajaj Finserv"
                              value={loanProvider}
                              onChange={(e) => setLoanProvider(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="label text-[10px] font-bold text-purple-700">Sanction No.</label>
                            <input
                              type="text"
                              className="input text-xs w-full mt-0.5"
                              placeholder="e.g. SANC-1002"
                              value={loanSanctionNo}
                              onChange={(e) => setLoanSanctionNo(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="label text-[10px] font-bold text-purple-700">Loan EMI (₹)</label>
                            <input
                              type="number"
                              className="input text-xs w-full mt-0.5"
                              placeholder="e.g. 4500"
                              value={loanEmi}
                              onChange={(e) => setLoanEmi(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 5 Card: Payment Account Details */}
              <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                  onClick={() => setIsPaymentAccountCollapsed(prev => !prev)}
                >
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">5</span>
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
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">Bank Name</label>
                      <input
                        type="text"
                        className="input text-xs w-full mt-1"
                        placeholder="e.g. HDFC Bank / State Bank of India"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">IFSC Code</label>
                      <input
                        type="text"
                        className="input text-xs w-full mt-1 uppercase"
                        placeholder="e.g. HDFC0001234"
                        value={ifscCode}
                        onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                      />
                    </div>
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">Account Number</label>
                      <input
                        type="text"
                        className="input text-xs w-full mt-1"
                        placeholder="e.g. 501002938491"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">Account Holder Name</label>
                      <input
                        type="text"
                        className="input text-xs w-full mt-1"
                        placeholder="Full Name as in Bank"
                        value={accountHolderName}
                        onChange={(e) => setAccountHolderName(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section 6 Card: GST & Tax Details */}
              <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
                <div
                  className="bg-gradient-to-r from-teal-50/80 via-slate-50 to-emerald-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none rounded-t-2xl"
                  onClick={() => setIsGstDetailsCollapsed(prev => !prev)}
                >
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-teal-600 to-emerald-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">6</span>
                    GST & Tax Details
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-semibold">Tax & GST Breakdown</span>
                    <ChevronDown
                      size={16}
                      className={`text-slate-500 transition-transform duration-200 ${isGstDetailsCollapsed ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {!isGstDetailsCollapsed && (
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider block mb-1">GST Applicable?</label>
                      <CustomSelect
                        value={gstApplicable ? 'yes' : 'no'}
                        onChange={val => setGstApplicable(val === 'yes')}
                        placeholder="Select Option"
                        options={[
                          { value: 'yes', label: 'Yes' },
                          { value: 'no', label: 'No' },
                        ]}
                      />
                    </div>

                    {gstApplicable && (
                      <>
                        <div>
                          <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">GST Percentage (%)</label>
                          <input
                            type="number"
                            className="input text-xs w-full mt-1"
                            placeholder="e.g. 18"
                            value={gstPercentage}
                            onChange={(e) => setGstPercentage(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">GST Amount (₹)</label>
                          <input
                            type="number"
                            className="input text-xs w-full mt-1"
                            placeholder="e.g. 2700"
                            value={gstAmount}
                            onChange={(e) => setGstAmount(e.target.value)}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════ TAB 3: Connected Persons ════════ */}
          {activeTab === 'connectedPersons' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 border border-slate-200/90 rounded-2xl bg-white shadow-2xs space-y-3.5">
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">3</span>
                  Nominees & Family Members
                </h4>

                <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Full Name"
                    className="input text-xs flex-1 min-w-[140px]"
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                  />
                  <div className="w-36">
                    <CustomSelect
                      value={memberRel}
                      onChange={val => setMemberRel(val)}
                      placeholder="Relationship"
                      options={[
                        { value: 'Spouse', label: 'Spouse' },
                        { value: 'Child', label: 'Child' },
                        { value: 'Father', label: 'Father' },
                        { value: 'Mother', label: 'Mother' },
                        { value: 'Nominee', label: 'Nominee' },
                        { value: 'Other', label: 'Other' },
                      ]}
                    />
                  </div>
                  <div className="w-36">
                    <DatePicker
                      value={memberDob}
                      onDateChange={val => setMemberDob(val)}
                      placeholder="DoB (DD/MM/YYYY)"
                      className="input text-xs w-full"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMember}
                    className="px-3.5 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>

                <div className="space-y-2 pt-2">
                  {members.length === 0 && <p className="text-xs text-slate-400">No connected persons added yet.</p>}
                  {members.map((m, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800">{m.name}</span>
                        <span className="text-slate-500 font-medium">({m.relationship})</span>
                        {(m.dob || m.dateOfBirth) && (
                          <span className="text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                            DoB: {m.dob || m.dateOfBirth}
                          </span>
                        )}
                      </div>
                      <button type="button" onClick={() => handleRemoveMember(i)} className="text-red-500 hover:text-red-700">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ════════ TAB 4: Health Check & Notes ════════ */}
          {activeTab === 'phcDetails' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 border border-slate-200/90 rounded-2xl bg-white shadow-2xs space-y-3.5">
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">4</span>
                  Preventive Health Checkup & Notes
                </h4>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={phcRequired}
                    onChange={(e) => setPhcRequired(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-slate-700">Preventive Health Checkup Required</span>
                </label>

                {phcRequired && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="label text-[10px] font-bold text-slate-600">Insured Person Name for PHC</label>
                        <button
                          type="button"
                          onClick={() => setIsManualPhcPerson(prev => !prev)}
                          className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                        >
                          {isManualPhcPerson ? 'Select list' : '+ Other'}
                        </button>
                      </div>
                      {isManualPhcPerson ? (
                        <input
                          type="text"
                          className="input text-xs w-full mt-0.5"
                          placeholder={insuredPerson ? `e.g. ${insuredPerson}` : 'e.g. Ramesh Kumar'}
                          value={phcInsuredPerson}
                          onChange={(e) => setPhcInsuredPerson(e.target.value)}
                        />
                      ) : (
                        <CustomSelect
                          value={phcInsuredPerson}
                          onChange={(val) => setPhcInsuredPerson(val)}
                          placeholder="Select Insured Person..."
                          options={phcInsuredPersonOptions.length > 0 ? phcInsuredPersonOptions : [{ value: '', label: 'No persons added yet' }]}
                          searchable
                        />
                      )}
                    </div>
                    <div>
                      <label className="label text-[10px] font-bold text-slate-600 mb-0.5 block">PHC Stage</label>
                      <CustomSelect
                        value={phcStage || 'TO_CONTACT'}
                        onChange={val => setPhcStage(val)}
                        placeholder="Select PHC Stage"
                        options={PHC_STAGE_OPTIONS}
                      />
                    </div>
                    <div>
                      <label className="label text-[10px] font-bold text-slate-500">PHC Amount (₹)</label>
                      <input
                        type="number"
                        className="input text-xs w-full mt-0.5"
                        placeholder="e.g. 2500"
                        value={phcAmount}
                        onChange={(e) => setPhcAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label text-[10px] font-bold text-slate-500 mb-0.5 block">Status</label>
                      <CustomSelect
                        value={phcStatus}
                        onChange={val => setPhcStatus(val)}
                        placeholder="Select Status"
                        options={[
                          { value: 'PENDING', label: 'Pending' },
                          { value: 'COMPLETED', label: 'Completed' },
                          { value: 'CLAIMED', label: 'Claimed' },
                        ]}
                      />
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={phcClaimSettled}
                          onChange={(e) => setPhcClaimSettled(e.target.checked)}
                          className="rounded text-blue-600"
                        />
                        <span className="text-xs font-bold text-slate-700">Claim Settled</span>
                      </label>
                    </div>
                  </div>
                )}

                <div>
                  <label className="label text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">Policy Notes / Remarks</label>
                  <textarea
                    className="input text-xs w-full mt-1 min-h-[80px]"
                    placeholder="Enter additional policy details or terms..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ════════ TAB 5: Policy Documents ════════ */}
          {activeTab === 'policyDocs' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 border border-slate-200/90 rounded-2xl bg-white shadow-2xs space-y-3.5">
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">5</span>
                  Policy Documents & Attachments
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label text-[10px] font-bold text-slate-500 mb-1 block">Document Type</label>
                    <CustomSelect
                      value={docTag}
                      onChange={val => setDocTag(val)}
                      placeholder="Select Document Type"
                      options={POLICY_DOCUMENT_TYPE_OPTIONS}
                    />
                  </div>
                  <div>
                    <label className="label text-[10px] font-bold text-slate-500">Document Title</label>
                    <input
                      type="text"
                      className="input text-xs w-full mt-1"
                      placeholder="e.g. Policy Schedule PDF"
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label text-[10px] font-bold text-slate-500">Select File</label>
                    <input
                      type="file"
                      className="input text-xs w-full mt-1 p-1 bg-white"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAddDoc(file);
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  {pendingDocs.length === 0 && <p className="text-xs text-slate-400">No documents attached yet.</p>}
                  {pendingDocs.map((doc, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{doc.title}</span>
                        <span className="text-blue-600 font-bold ml-2">
                          [{POLICY_DOCUMENT_TYPE_OPTIONS.find(o => o.value === doc.tag)?.label || doc.tag}]
                        </span>
                      </div>
                      <button type="button" onClick={() => handleRemoveDoc(i)} className="text-red-500 hover:text-red-700">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </fieldset>
      </div>
    </form>
    </Modal>
  );
}
