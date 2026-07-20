import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus, X, User, FileText, Pencil, Trash2, Upload, Search, Filter,
  MessageCircle, Calendar, Shield, Heart, MapPin, Briefcase, UserCircle2,
  FileCheck2, ShieldCheck, Clock
} from 'lucide-react';
import { useClaims, useCreateClaim, useUpdateClaimStatus, useDeleteClaim } from '@hooks/useClaims';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsService, policiesService, claimsService, documentsService } from '@api/index';
import DataTable, { Column } from '@comps/common/DataTable';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useLookupStore } from '@store/lookup.store';
import clsx from 'clsx';

interface Claim {
  id: string; claimNumber: string; status: string; claimType: string;
  claimAmount: number; intimatedAt: string;
  approvedAmount?: number; rejectionReason?: string;
  contact?: { id: string; firstName: string; lastName: string; phone: string; email?: string };
  policy?: { id: string; policyNumber: string; plan?: { name: string } };
  assignedEmployeeId?: string | null;
  notes?: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  INTIMATED: 'bg-blue-50 text-blue-700 border-blue-200',
  DOC_COLLECTION: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  FILED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  IN_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SETTLED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
};

const UI_STATUSES = ["Pending", "In Progress", "Approved", "Rejected", "Settled"];

const BACKEND_TO_UI: Record<string, string> = {
  INTIMATED: 'Pending',
  DOC_COLLECTION: 'Pending',
  FILED: 'Pending',
  IN_REVIEW: 'In Progress',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  SETTLED: 'Settled',
};

const UI_TO_BACKEND: Record<string, string> = {
  Pending: 'FILED',
  'In Progress': 'IN_REVIEW',
  Approved: 'APPROVED',
  Rejected: 'REJECTED',
  Settled: 'SETTLED',
};

export function getClaimNotesData(notesField?: string | null) {
  if (!notesField) return { diagnosis: '', hospital: '', hospitalAddress: '', patientName: '', deductionsNotes: '', admissionAt: '', dischargeAt: '', notes: '', statusOverride: '', amtHospital: 0, amtMedicine: 0, amtLab: 0, amtPreHosp: 0, amtPostHosp: 0, amtOthers: 0 };
  try {
    if (notesField.trim().startsWith('{')) {
      const parsed = JSON.parse(notesField);
      return {
        diagnosis: parsed.diagnosis || '',
        hospital: parsed.hospital || '',
        hospitalAddress: parsed.hospitalAddress || '',
        patientName: parsed.patientName || '',
        deductionsNotes: parsed.deductionsNotes || '',
        admissionAt: parsed.admissionAt || '',
        dischargeAt: parsed.dischargeAt || '',
        notes: parsed.notes || '',
        statusOverride: parsed.statusOverride || '',
        amtHospital: Number(parsed.amtHospital || 0),
        amtMedicine: Number(parsed.amtMedicine || 0),
        amtLab: Number(parsed.amtLab || 0),
        amtPreHosp: Number(parsed.amtPreHosp || 0),
        amtPostHosp: Number(parsed.amtPostHosp || 0),
        amtOthers: Number(parsed.amtOthers || 0),
      };
    }
  } catch (e) {
    // ignore
  }
  return { diagnosis: '', hospital: '', hospitalAddress: '', patientName: '', deductionsNotes: '', admissionAt: '', dischargeAt: '', notes: notesField, statusOverride: '', amtHospital: 0, amtMedicine: 0, amtLab: 0, amtPreHosp: 0, amtPostHosp: 0, amtOthers: 0 };
}

export function serializeNotes(data: any) {
  return JSON.stringify(data);
}

const schema = z.object({
  policyId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Select a policy'),
  contactId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Select a contact'),
  claimNumber: z.string().min(1, 'Claim number required'),
  claimType: z.string().min(1, 'Select a claim type'),
  claimAmount: z.coerce.number().min(0),
  intimatedAt: z.string().min(1, 'Intimation date required'),
  assignedEmployeeId: z.string().optional().or(z.literal('')),
  diagnosis: z.string().optional(),
  hospital: z.string().optional(),
  hospitalAddress: z.string().optional(),
  patientName: z.string().optional(),
  admissionAt: z.string().optional(),
  dischargeAt: z.string().optional(),
  amtHospital: z.coerce.number().default(0),
  amtMedicine: z.coerce.number().default(0),
  amtLab: z.coerce.number().default(0),
  amtPreHosp: z.coerce.number().default(0),
  amtPostHosp: z.coerce.number().default(0),
  amtOthers: z.coerce.number().default(0),
  notes: z.string().optional(),
  approvedAmount: z.coerce.number().optional().default(0),
  deductionsNotes: z.string().optional(),
});
type Form = z.infer<typeof schema>;

// Aligned edit form with automatic calculations
function ClaimEditForm({ initial, isPending, onSave, onCancel, employees }: {
  initial: Claim; isPending: boolean;
  onSave: (body: any) => void; onCancel: () => void;
  employees: any[];
}) {
  const notesData = getClaimNotesData(initial.notes);
  const [claimType, setClaimType] = useState((initial as any).claimType ?? 'HEALTH');
  const [claimAmount, setClaimAmount] = useState(String((initial as any).claimAmount ?? ''));
  const [approvedAmount, setApprovedAmount] = useState(String((initial as any).approvedAmount ?? ''));
  const [rejectionReason, setRejectionReason] = useState((initial as any).rejectionReason ?? '');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState((initial as any).assignedEmployeeId ?? '');

  // Split expense charges
  const [amtHospital, setAmtHospital] = useState(notesData.amtHospital || 0);
  const [amtMedicine, setAmtMedicine] = useState(notesData.amtMedicine || 0);
  const [amtLab, setAmtLab] = useState(notesData.amtLab || 0);
  const [amtPreHosp, setAmtPreHosp] = useState(notesData.amtPreHosp || 0);
  const [amtPostHosp, setAmtPostHosp] = useState(notesData.amtPostHosp || 0);
  const [amtOthers, setAmtOthers] = useState(notesData.amtOthers || 0);

  const [diagnosis, setDiagnosis] = useState(notesData.diagnosis);
  const [hospital, setHospital] = useState(notesData.hospital);
  const [admissionAt, setAdmissionAt] = useState(notesData.admissionAt ? notesData.admissionAt.slice(0, 10) : '');
  const [dischargeAt, setDischargeAt] = useState(notesData.dischargeAt ? notesData.dischargeAt.slice(0, 10) : '');
  const [notesText, setNotesText] = useState(notesData.notes);

  // Auto calculate sum
  useEffect(() => {
    const total = Number(amtHospital) + Number(amtMedicine) + Number(amtLab) + Number(amtPreHosp) + Number(amtPostHosp) + Number(amtOthers);
    setClaimAmount(String(total));
  }, [amtHospital, amtMedicine, amtLab, amtPreHosp, amtPostHosp, amtOthers]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Claim Type</label>
          <select className="input" value={claimType} onChange={e => setClaimType(e.target.value)}>
            <option value="HEALTH">Health</option>
            <option value="DEATH">Death</option>
            <option value="ACCIDENTAL">Accidental</option>
            <option value="MATURITY">Maturity</option>
          </select>
        </div>
        <div>
          <label className="label">Assignee</label>
          <select className="input" value={assignedEmployeeId} onChange={e => setAssignedEmployeeId(e.target.value)}>
            <option value="">Unassigned</option>
            {employees.map((emp: any) => (
              <option key={emp.id} value={emp.userId}>
                {emp.firstName} {emp.lastName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Diagnosis</label>
          <input className="input" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
        </div>
        <div>
          <label className="label">Hospital / Clinic</label>
          <input className="input" value={hospital} onChange={e => setHospital(e.target.value)} />
        </div>
      </div>

      {/* Hospitalization split costs */}
      <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Expense Split Calculator (Auto-Sum)</span>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <label className="label text-[10px]">Hospital Room (₹)</label>
            <input type="number" className="input py-1" value={amtHospital} onChange={e => setAmtHospital(Number(e.target.value))} />
          </div>
          <div>
            <label className="label text-[10px]">Medicines (₹)</label>
            <input type="number" className="input py-1" value={amtMedicine} onChange={e => setAmtMedicine(Number(e.target.value))} />
          </div>
          <div>
            <label className="label text-[10px]">Lab Tests (₹)</label>
            <input type="number" className="input py-1" value={amtLab} onChange={e => setAmtLab(Number(e.target.value))} />
          </div>
          <div>
            <label className="label text-[10px]">Pre-Hosp (₹)</label>
            <input type="number" className="input py-1" value={amtPreHosp} onChange={e => setAmtPreHosp(Number(e.target.value))} />
          </div>
          <div>
            <label className="label text-[10px]">Post-Hosp (₹)</label>
            <input type="number" className="input py-1" value={amtPostHosp} onChange={e => setAmtPostHosp(Number(e.target.value))} />
          </div>
          <div>
            <label className="label text-[10px]">Others (₹)</label>
            <input type="number" className="input py-1" value={amtOthers} onChange={e => setAmtOthers(Number(e.target.value))} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <label className="label">Admission Date</label>
          <input type="date" className="input" value={admissionAt} onChange={e => setAdmissionAt(e.target.value)} />
        </div>
        <div>
          <label className="label">Discharge Date</label>
          <input type="date" className="input" value={dischargeAt} onChange={e => setDischargeAt(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Claimed Amount (₹)</label>
          <input type="text" className="input bg-slate-50 font-bold" value={claimAmount} readOnly />
        </div>
        <div>
          <label className="label">Approved Amount (₹)</label>
          <input type="number" className="input" value={approvedAmount} onChange={e => setApprovedAmount(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Rejection Reason</label>
        <input className="input border-red-200" value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="If applicable" />
      </div>

      <div>
        <label className="label">Remarks / Notes</label>
        <textarea className="input" rows={2} value={notesText} onChange={e => setNotesText(e.target.value)} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn-primary" disabled={isPending}
          onClick={() => onSave({
            claimType,
            claimAmount: Number(claimAmount),
            approvedAmount: approvedAmount ? Number(approvedAmount) : undefined,
            rejectionReason: rejectionReason || undefined,
            assignedEmployeeId: assignedEmployeeId || null,
            notes: serializeNotes({
              diagnosis,
              hospital,
              admissionAt,
              dischargeAt,
              amtHospital,
              amtMedicine,
              amtLab,
              amtPreHosp,
              amtPostHosp,
              amtOthers,
              notes: notesText
            })
          })}>
          Save
        </button>
      </div>
    </div>
  );
}

export default function Claims() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Claim | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Claim | null>(null);
  
  // Claim Detail sheet
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const employees = useLookupStore(s => s.employees);

  // Fetch all claims for client side filtering matching reference app
  const { data: claimsRes, isLoading } = useClaims({ page: 1, limit: 500 });
  const rawClaims = claimsRes?.data ?? [];

  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'In Progress' | 'Approved' | 'Rejected' | 'Settled'>('All');

  // Advanced Filters
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterHospital, setFilterHospital] = useState('');
  const [filterClaimType, setFilterClaimType] = useState('ALL');
  const [analyticsDuration, setAnalyticsDuration] = useState('ALL');
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Unified Filtered Claims Selector
  const filteredClaims = useMemo(() => {
    const sTerm = search.toLowerCase();
    return rawClaims.filter((c: any) => {
      const notes = getClaimNotesData(c.notes);

      // 1. Text Search (Client Name or Claim Number)
      const clientName = `${c.contact?.firstName || ''} ${c.contact?.lastName || ''}`.toLowerCase();
      const claimNo = (c.claimNumber || '').toLowerCase();
      if (search && !clientName.includes(sTerm) && !claimNo.includes(sTerm)) return false;

      // 2. Status Filter
      if (filterStatus !== 'All') {
        const uStatus = BACKEND_TO_UI[c.status] || 'Pending';
        if (uStatus !== filterStatus) return false;
      }

      // 3. Claim Type Filter
      if (filterClaimType !== 'ALL') {
        if (c.claimType?.toLowerCase() !== filterClaimType.toLowerCase()) return false;
      }

      // 4. Company Filter
      if (filterCompany) {
        const companyName = (c.policy?.plan?.company?.name || '').toLowerCase();
        if (!companyName.includes(filterCompany.toLowerCase())) return false;
      }

      // 5. Hospital Filter
      if (filterHospital) {
        const hospitalName = (notes.hospital || '').toLowerCase();
        if (!hospitalName.includes(filterHospital.toLowerCase())) return false;
      }

      // 6. Date range Filter
      if (filterStartDate) {
        const start = new Date(filterStartDate).getTime();
        const date = new Date(c.intimatedAt).getTime();
        if (date < start) return false;
      }
      if (filterEndDate) {
        const end = new Date(filterEndDate).getTime() + 86400000;
        const date = new Date(c.intimatedAt).getTime();
        if (date > end) return false;
      }

      // 7. Duration shortcut filter
      if (analyticsDuration === '30_DAYS') {
        const diff = (Date.now() - new Date(c.intimatedAt).getTime()) / 86400000;
        if (diff > 30) return false;
      } else if (analyticsDuration === '90_DAYS') {
        const diff = (Date.now() - new Date(c.intimatedAt).getTime()) / 86400000;
        if (diff > 90) return false;
      } else if (analyticsDuration === 'THIS_YEAR') {
        const year = new Date(c.intimatedAt).getFullYear();
        if (year !== new Date().getFullYear()) return false;
      }

      return true;
    });
  }, [rawClaims, search, filterStatus, filterStartDate, filterEndDate, filterCompany, filterHospital, filterClaimType, analyticsDuration]);

  // Calculations for Advanced Analytics Dashboard
  const stats = useMemo(() => {
    let totalClaimed = 0;
    let totalSettled = 0;
    const companyMap: Record<string, { count: number; claimed: number; settled: number }> = {};
    const hospitalMap: Record<string, { count: number; claimed: number; settled: number }> = {};
    const typeMap: Record<string, { count: number; claimed: number; settled: number }> = {};
    const statusMap: Record<string, { count: number; claimed: number; settled: number }> = {};

    filteredClaims.forEach((c: any) => {
      const notes = getClaimNotesData(c.notes);
      const claimed = Number(c.claimAmount || 0);
      const settled = Number(c.approvedAmount || 0);
      const company = c.policy?.plan?.company?.name || 'Unknown Company';
      const hospital = notes.hospital || 'Outpatient / Other';
      const type = c.claimType || 'Other';
      const statusStr = BACKEND_TO_UI[c.status] || 'Pending';

      totalClaimed += claimed;
      totalSettled += settled;

      // Company
      if (!companyMap[company]) companyMap[company] = { count: 0, claimed: 0, settled: 0 };
      companyMap[company].count++;
      companyMap[company].claimed += claimed;
      companyMap[company].settled += settled;

      // Hospital
      if (!hospitalMap[hospital]) hospitalMap[hospital] = { count: 0, claimed: 0, settled: 0 };
      hospitalMap[hospital].count++;
      hospitalMap[hospital].claimed += claimed;
      hospitalMap[hospital].settled += settled;

      // Type
      if (!typeMap[type]) typeMap[type] = { count: 0, claimed: 0, settled: 0 };
      typeMap[type].count++;
      typeMap[type].claimed += claimed;
      typeMap[type].settled += settled;

      // Status
      if (!statusMap[statusStr]) statusMap[statusStr] = { count: 0, claimed: 0, settled: 0 };
      statusMap[statusStr].count++;
      statusMap[statusStr].claimed += claimed;
      statusMap[statusStr].settled += settled;
    });

    const pendingClaimed = totalClaimed - totalSettled;
    const settlementRatio = totalClaimed > 0 ? (totalSettled / totalClaimed) * 100 : 0;
    const avgClaim = filteredClaims.length > 0 ? totalClaimed / filteredClaims.length : 0;

    return {
      totalClaims: filteredClaims.length,
      totalClaimed,
      totalSettled,
      pendingClaimed,
      settlementRatio,
      avgClaim,
      companies: Object.entries(companyMap).map(([name, v]) => ({ name, ...v })),
      hospitals: Object.entries(hospitalMap).map(([name, v]) => ({ name, ...v })),
      types: Object.entries(typeMap).map(([name, v]) => ({ name, ...v })),
      statuses: Object.entries(statusMap).map(([name, v]) => ({ name, ...v })),
    };
  }, [filteredClaims]);

  // Group claims by Month for Visual Line Chart
  const monthlyData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const values = months.map(() => 0);
    filteredClaims.forEach((c: any) => {
      const m = new Date(c.intimatedAt).getMonth();
      if (m >= 0 && m < 12) {
        values[m] += Number(c.claimAmount || 0);
      }
    });
    return { months, values };
  }, [filteredClaims]);

  // Export Analytics function
  const exportAnalytics = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Category,Name,Total Claims,Claimed Amount,Settled Amount\n";

    // Summary
    csvContent += `Summary,All Filtered Claims,${stats.totalClaims},${stats.totalClaimed},${stats.totalSettled}\n\n`;

    // Company wise
    csvContent += "Company-wise Breakdown,,,\n";
    stats.companies.forEach(item => {
      csvContent += `Company,${item.name},${item.count},${item.claimed},${item.settled}\n`;
    });
    csvContent += "\n";

    // Hospital wise
    csvContent += "Hospital-wise Breakdown,,,\n";
    stats.hospitals.forEach(item => {
      csvContent += `Hospital,${item.name},${item.count},${item.claimed},${item.settled}\n`;
    });
    csvContent += "\n";

    // Type wise
    csvContent += "Type Breakdown,,,\n";
    stats.types.forEach(item => {
      csvContent += `Claim Type,${item.name},${item.count},${item.claimed},${item.settled}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `claims_analytics_report_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Contact picker state
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<{ id: string; firstName: string; lastName: string; phone: string } | null>(null);
  const [contactDropdown, setContactDropdown] = useState(false);

  // Policy picker
  const [selectedPolicy, setSelectedPolicy] = useState<{ id: string; policyNumber: string; plan?: { name: string } } | null>(null);
  const [policyDropdown, setPolicyDropdown] = useState(false);

  // Selected document files
  const [claimFormFile, setClaimFormFile] = useState<File | null>(null);
  const [dischargeSummaryFile, setDischargeSummaryFile] = useState<File | null>(null);
  const [medicalReportsFile, setMedicalReportsFile] = useState<File | null>(null);
  const [billsFile, setBillsFile] = useState<File | null>(null);
  const [otherImpDocsFile, setOtherImpDocsFile] = useState<File | null>(null);
  const [queryLetterFile, setQueryLetterFile] = useState<File | null>(null);
  const [replyDocsFile, setReplyDocsFile] = useState<File | null>(null);
  const [settlementLetterFile, setSettlementLetterFile] = useState<File | null>(null);

  const { data: contactResults } = useQuery({
    queryKey: ['contact-search-claim', contactSearch],
    queryFn: () => contactsService.list({ search: contactSearch || undefined, limit: 8 }),
    enabled: contactDropdown,
  });

  const { data: contactDetail } = useQuery({
    queryKey: ['contact-detail-claims-picker', selectedContact?.id],
    queryFn: () => contactsService.get(selectedContact!.id),
    enabled: !!selectedContact,
  });

  const activeContactPolicies = contactDetail?.data?.policies ?? [];



  const createClaim = useCreateClaim();
  const deleteClaim = useDeleteClaim();
  const qcClaims = useQueryClient();
  const updateClaim = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => claimsService.update(id, body),
    onSuccess: () => { qcClaims.invalidateQueries({ queryKey: ['claims'] }); setEditTarget(null); },
  });

  const { register, handleSubmit, reset, setValue, watch } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { claimType: 'Cashless', intimatedAt: new Date().toISOString().split('T')[0] },
  });

  // Watch calculations for create form
  const amtHospital = watch('amtHospital');
  const amtMedicine = watch('amtMedicine');
  const amtLab = watch('amtLab');
  const amtPreHosp = watch('amtPreHosp');
  const amtPostHosp = watch('amtPostHosp');
  const amtOthers = watch('amtOthers');

  const watchClaimNumber = watch('claimNumber');
  const watchPolicyId = watch('policyId');

  useEffect(() => {
    const tot = Number(amtHospital || 0) + Number(amtMedicine || 0) + Number(amtLab || 0) + Number(amtPreHosp || 0) + Number(amtPostHosp || 0) + Number(amtOthers || 0);
    setValue('claimAmount', tot);
  }, [amtHospital, amtMedicine, amtLab, amtPreHosp, amtPostHosp, amtOthers]);

  // Auto-fill from existing claim entries with same claim number
  useEffect(() => {
    if (watchClaimNumber && rawClaims) {
      const match = rawClaims.find((c: any) => c.claimNumber?.trim().toLowerCase() === watchClaimNumber.trim().toLowerCase());
      if (match) {
        const extra = getClaimNotesData(match.notes);
        if (extra.patientName) setValue('patientName', extra.patientName);
        if (extra.diagnosis) setValue('diagnosis', extra.diagnosis);
        if (extra.hospital) setValue('hospital', extra.hospital);
        if (extra.hospitalAddress) setValue('hospitalAddress', extra.hospitalAddress);
        if (extra.admissionAt) setValue('admissionAt', extra.admissionAt);
        if (extra.dischargeAt) setValue('dischargeAt', extra.dischargeAt);
        if (match.intimatedAt) setValue('intimatedAt', match.intimatedAt.slice(0, 10));
      }
    }
  }, [watchClaimNumber, rawClaims, setValue]);

  // Auto-fill patient name when policy is selected
  useEffect(() => {
    if (watchPolicyId && selectedContact) {
      setValue('patientName', `${selectedContact.firstName} ${selectedContact.lastName}`);
    }
  }, [watchPolicyId, selectedContact, setValue]);

  const closeModal = () => {
    setModalOpen(false);
    reset();
    setSelectedContact(null); setContactSearch('');
    setSelectedPolicy(null);
    setClaimFormFile(null);
    setDischargeSummaryFile(null);
    setMedicalReportsFile(null);
    setBillsFile(null);
    setOtherImpDocsFile(null);
    setQueryLetterFile(null);
    setReplyDocsFile(null);
    setSettlementLetterFile(null);
  };

  const onSubmit = async (body: Form) => {
    try {
      const { diagnosis, hospital, hospitalAddress, patientName, deductionsNotes, admissionAt, dischargeAt, notes, assignedEmployeeId, amtHospital, amtMedicine, amtLab, amtPreHosp, amtPostHosp, amtOthers, ...rest } = body;
      const notesJson = serializeNotes({
        diagnosis, hospital, hospitalAddress, patientName, deductionsNotes, admissionAt, dischargeAt, notes,
        amtHospital, amtMedicine, amtLab, amtPreHosp, amtPostHosp, amtOthers
      });
      const res = await createClaim.mutateAsync({
        ...rest,
        assignedEmployeeId: assignedEmployeeId || undefined,
        notes: notesJson,
      });
      const claimId = res.data?.id;

      if (claimId) {
        const uploadPromises: Promise<any>[] = [];
        if (claimFormFile) {
          uploadPromises.push(documentsService.upload(claimFormFile, {
            claimId,
            contactId: rest.contactId,
            policyId: rest.policyId,
            type: 'CLAIM_FORM',
          }).catch(err => console.error('Failed to upload Claim Form:', err)));
        }
        if (dischargeSummaryFile) {
          uploadPromises.push(documentsService.upload(dischargeSummaryFile, {
            claimId,
            contactId: rest.contactId,
            policyId: rest.policyId,
            type: 'DISCHARGE_SUMMARY',
          }).catch(err => console.error('Failed to upload Discharge Summary:', err)));
        }
        if (medicalReportsFile) {
          uploadPromises.push(documentsService.upload(medicalReportsFile, {
            claimId,
            contactId: rest.contactId,
            policyId: rest.policyId,
            type: 'MEDICAL_REPORTS',
          }).catch(err => console.error('Failed to upload Medical Reports:', err)));
        }
        if (billsFile) {
          uploadPromises.push(documentsService.upload(billsFile, {
            claimId,
            contactId: rest.contactId,
            policyId: rest.policyId,
            type: 'BILLS',
          }).catch(err => console.error('Failed to upload Bills:', err)));
        }
        if (otherImpDocsFile) {
          uploadPromises.push(documentsService.upload(otherImpDocsFile, {
            claimId,
            contactId: rest.contactId,
            policyId: rest.policyId,
            type: 'OTHER_IMP_DOCUMENTS',
          }).catch(err => console.error('Failed to upload Other IMP Documents:', err)));
        }
        if (queryLetterFile) {
          uploadPromises.push(documentsService.upload(queryLetterFile, {
            claimId,
            contactId: rest.contactId,
            policyId: rest.policyId,
            type: 'CLAIM_QUERY_LETTER',
          }).catch(err => console.error('Failed to upload Query Letter:', err)));
        }
        if (replyDocsFile) {
          uploadPromises.push(documentsService.upload(replyDocsFile, {
            claimId,
            contactId: rest.contactId,
            policyId: rest.policyId,
            type: 'REPLY_DOCUMENTS',
          }).catch(err => console.error('Failed to upload Reply Documents:', err)));
        }
        if (settlementLetterFile) {
          uploadPromises.push(documentsService.upload(settlementLetterFile, {
            claimId,
            contactId: rest.contactId,
            policyId: rest.policyId,
            type: 'CLAIM_SETTLEMENT_LETTER',
          }).catch(err => console.error('Failed to upload Settlement Letter:', err)));
        }
        if (uploadPromises.length > 0) {
          await Promise.all(uploadPromises);
        }
      }

      closeModal();
      qcClaims.invalidateQueries();
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const toastId = toast.loading('Importing claims...');
    try {
      const res = await claimsService.importCsv(file);
      toast.success(res.message || `Successfully imported claims!`, { id: toastId });
      qcClaims.invalidateQueries();
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to import claims', { id: toastId });
    }
  };



  const COLS: Column<Claim>[] = [
    {
      key: 'claimNumber',
      label: 'Claim ID',
      render: r => <span className="font-bold text-gray-900">{r.claimNumber}</span>
    },
    {
      key: 'contact',
      label: 'Client & Policy',
      render: r => (
        <div className="flex flex-col">
          <span className="font-bold text-gray-900">{r.contact ? `${r.contact.firstName} ${r.contact.lastName}` : '—'}</span>
          <span className="text-xs text-gray-500">Policy: {r.policy?.policyNumber ?? '—'}</span>
        </div>
      )
    },
    {
      key: 'claimAmount',
      label: 'Claimed Amt',
      render: r => <span className="font-semibold text-gray-900">₹{Number(r.claimAmount).toLocaleString('en-IN')}</span>
    },
    {
      key: 'approvedAmount',
      label: 'Settled Amt',
      render: r => r.approvedAmount ? <span className="font-semibold text-emerald-600">₹{Number(r.approvedAmount).toLocaleString('en-IN')}</span> : <span className="text-gray-400">—</span>
    },
    {
      key: 'intimatedAt',
      label: 'Date Filed',
      render: r => r.intimatedAt ? format(new Date(r.intimatedAt), 'dd/MMM/yyyy') : '—'
    },
    {
      key: 'status',
      label: 'Status',
      render: r => {
        const display = BACKEND_TO_UI[r.status] || 'Pending';
        return (
          <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border uppercase tracking-wider', STATUS_BADGE[r.status] || 'bg-gray-100 text-gray-600')}>
            {display}
          </span>
        );
      }
    },
    {
      key: 'actions' as any,
      label: '',
      render: r => (
        <div className="flex items-center gap-2 justify-end" onClick={e => e.stopPropagation()}>
          <button title="Edit" className="p-1 rounded hover:bg-gray-100 text-gray-500" onClick={() => setEditTarget(r)}><Pencil size={13} /></button>
          <button title="Delete" className="p-1 rounded hover:bg-red-50 text-red-500" onClick={() => setDeleteTarget(r)}><Trash2 size={13} /></button>
        </div>
      ),
    },
  ];

  const genClaimNumber = () => `CLM-${Date.now().toString().slice(-8)}`;

  return (
    <div className="space-y-4">
      {/* Actions Toolbar */}
      <div className="flex justify-end items-center gap-3 pb-2">
        <input type="file" ref={fileInputRef} onChange={handleImport} accept=".csv" className="hidden" />
        <button
          onClick={() => setShowAnalytics(!showAnalytics)}
          className="btn-secondary h-9 py-0 px-3 text-xs flex items-center gap-1.5 font-bold cursor-pointer bg-white text-slate-700 hover:bg-slate-50"
        >
          {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn-secondary h-9 py-0 px-3 text-xs flex items-center gap-1.5 font-bold cursor-pointer"
        >
          <Upload size={14} /> Import CSV
        </button>
        
        <button
          className="btn-primary h-9 py-0 px-3 text-xs flex items-center gap-1.5 font-bold cursor-pointer"
          onClick={() => { setModalOpen(true); setValue('claimNumber', genClaimNumber()); }}
        >
          <Plus size={14} /> New Claim
        </button>
      </div>

      {/* Analytics & Reports Collapsible Card */}
      {showAnalytics && (
        <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6 mb-4 animate-in fade-in slide-in-from-top-2 duration-200">
          
          {/* Header & Main Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                <FileCheck2 size={16} className="text-blue-600" />
                Claims Analytics Dashboard
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Real-time statistics, graphs, and filtered reports</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={exportAnalytics}
                className="btn-primary h-8 py-0 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 font-bold flex items-center gap-1.5 shadow-sm rounded-lg"
              >
                <FileCheck2 size={13} /> Export Report (CSV)
              </button>
            </div>
          </div>

          {/* Advanced Filters Panel */}
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start Date</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={e => setFilterStartDate(e.target.value)}
                className="input h-8 text-xs py-0 px-2 rounded-lg bg-slate-50 border border-slate-200 w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">End Date</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={e => setFilterEndDate(e.target.value)}
                className="input h-8 text-xs py-0 px-2 rounded-lg bg-slate-50 border border-slate-200 w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Company</label>
              <input
                type="text"
                placeholder="Search company..."
                value={filterCompany}
                onChange={e => setFilterCompany(e.target.value)}
                className="input h-8 text-xs py-0 px-2 rounded-lg bg-slate-50 border border-slate-200 w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hospital</label>
              <input
                type="text"
                placeholder="Search hospital..."
                value={filterHospital}
                onChange={e => setFilterHospital(e.target.value)}
                className="input h-8 text-xs py-0 px-2 rounded-lg bg-slate-50 border border-slate-200 w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Claim Type</label>
              <select
                value={filterClaimType}
                onChange={e => setFilterClaimType(e.target.value)}
                className="input h-8 text-xs py-0 px-2 rounded-lg bg-slate-50 border border-slate-200 w-full"
              >
                <option value="ALL">All Types</option>
                <option value="Cashless">Cashless</option>
                <option value="Reimbursement">Reimbursement</option>
                <option value="DEATH">Death</option>
                <option value="ACCIDENTAL">Accidental</option>
              </select>
            </div>
          </div>

          {/* 6 KPI Cards Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Claims</span>
              <span className="text-xl font-bold text-slate-800 mt-1">{stats.totalClaims}</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Claimed Amt</span>
              <span className="text-xl font-bold text-slate-800 mt-1">₹{Math.round(stats.totalClaimed).toLocaleString('en-IN')}</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Settled Amt</span>
              <span className="text-xl font-bold text-emerald-600 mt-1">₹{Math.round(stats.totalSettled).toLocaleString('en-IN')}</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Amt</span>
              <span className="text-xl font-bold text-amber-600 mt-1">₹{Math.round(stats.pendingClaimed).toLocaleString('en-IN')}</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Settlement %</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xl font-bold text-slate-800">{stats.settlementRatio.toFixed(1)}%</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Claim</span>
              <span className="text-xl font-bold text-slate-800 mt-1">₹{Math.round(stats.avgClaim).toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Interactive SVG Charts Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Chart 1: Claims Trend (SVG Line Chart) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Claims Trend (Monthly)</h4>
                <p className="text-[10px] text-slate-400">Total claimed amount in ₹</p>
              </div>
              <div className="relative h-44 flex items-end justify-center">
                <svg viewBox="0 0 240 120" className="w-full h-full">
                  {/* Grid Lines */}
                  <line x1="10" y1="20" x2="230" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="10" y1="60" x2="230" y2="60" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="10" y1="100" x2="230" y2="100" stroke="#e2e8f0" strokeWidth="1" />
                  
                  {/* Polyline */}
                  {(() => {
                    const maxVal = Math.max(...monthlyData.values, 1);
                    const points = monthlyData.values.map((val, idx) => {
                      const x = 10 + idx * 20;
                      const y = 100 - (val / maxVal) * 80;
                      return `${x},${y}`;
                    }).join(' ');
                    return (
                      <>
                        <polyline fill="none" stroke="#3b82f6" strokeWidth="2.5" points={points} />
                        {monthlyData.values.map((val, idx) => {
                          const x = 10 + idx * 20;
                          const y = 100 - (val / maxVal) * 80;
                          if (val === 0) return null;
                          return (
                            <circle key={idx} cx={x} cy={y} r="3.5" fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
                          );
                        })}
                      </>
                    );
                  })()}
                  
                  {/* X Axis Labels */}
                  {monthlyData.months.map((m, idx) => (
                    <text key={m} x={10 + idx * 20} y="115" fontSize="6.5" fill="#94a3b8" textAnchor="middle">{m}</text>
                  ))}
                </svg>
              </div>
            </div>

            {/* Chart 2: Claim Type Share (SVG Doughnut Chart) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Claim Type Share</h4>
                <p className="text-[10px] text-slate-400">Cashless vs Reimbursement distribution</p>
              </div>
              <div className="h-44 flex items-center justify-between gap-2">
                <div className="w-1/2 relative flex items-center justify-center">
                  <svg width="100" height="100" viewBox="0 0 36 36" className="w-24 h-24">
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                    {(() => {
                      let accumulatedPercent = 0;
                      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];
                      return stats.types.map((type, idx) => {
                        const pct = stats.totalClaims > 0 ? (type.count / stats.totalClaims) * 100 : 0;
                        const dashArray = `${pct} ${100 - pct}`;
                        const dashOffset = 100 - accumulatedPercent + 25;
                        accumulatedPercent += pct;
                        return (
                          <circle
                            key={type.name}
                            cx="18"
                            cy="18"
                            r="15.915"
                            fill="none"
                            stroke={colors[idx % colors.length]}
                            strokeWidth="3.5"
                            strokeDasharray={dashArray}
                            strokeDashoffset={dashOffset}
                          />
                        );
                      });
                    })()}
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Total</span>
                    <span className="text-base font-bold text-slate-800">{stats.totalClaims}</span>
                  </div>
                </div>
                <div className="w-1/2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {stats.types.map((t, idx) => {
                    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-pink-500', 'bg-indigo-500'];
                    const pct = stats.totalClaims > 0 ? (t.count / stats.totalClaims) * 100 : 0;
                    return (
                      <div key={t.name} className="flex items-center gap-1.5 text-[9px] text-slate-600">
                        <span className={`w-2 h-2 rounded-full ${colors[idx % colors.length]}`} />
                        <span className="truncate font-medium flex-1">{t.name}</span>
                        <span className="font-bold text-slate-800">{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Chart 3: Status Distribution (SVG Bar Chart) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Status Distribution</h4>
                <p className="text-[10px] text-slate-400">Total claims per status stage</p>
              </div>
              <div className="relative h-44 flex items-end justify-center">
                <svg viewBox="0 0 200 120" className="w-full h-full">
                  <line x1="10" y1="20" x2="190" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="10" y1="60" x2="190" y2="60" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="10" y1="100" x2="190" y2="100" stroke="#e2e8f0" strokeWidth="1" />

                  {(() => {
                    const counts = stats.statuses.map(s => s.count);
                    const maxCount = Math.max(...counts, 1);
                    const colors: Record<string, string> = {
                      Pending: '#3b82f6',
                      'In Progress': '#f59e0b',
                      Approved: '#10b981',
                      Rejected: '#ef4444',
                      Settled: '#059669',
                    };
                    return stats.statuses.map((s, idx) => {
                      const barWidth = 18;
                      const x = 20 + idx * 35;
                      const barHeight = (s.count / maxCount) * 80;
                      const y = 100 - barHeight;
                      return (
                        <g key={s.name}>
                          <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            rx="2"
                            fill={colors[s.name] || '#64748b'}
                          />
                          <text x={x + 9} y={y - 4} fontSize="7" fontWeight="bold" fill="#475569" textAnchor="middle">{s.count}</text>
                          <text x={x + 9} y="113" fontSize="6" fill="#64748b" textAnchor="middle" transform={`rotate(0, ${x + 9}, 113)`}>{s.name}</text>
                        </g>
                      );
                    });
                  })()}
                </svg>
              </div>
            </div>

          </div>

          {/* Breakdown Tables Grid (2x2) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Company wise */}
            <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Company-wise Breakdown & Share</h4>
              <div className="border border-slate-100 rounded-xl overflow-hidden bg-white max-h-48 overflow-y-auto">
                <table className="min-w-full divide-y divide-slate-100 text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Company</th>
                      <th className="px-3 py-2 text-center">Claims</th>
                      <th className="px-3 py-2 text-right">Claimed</th>
                      <th className="px-3 py-2 text-right">Settled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {stats.companies.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-4 text-slate-400">No data found</td></tr>
                    ) : (
                      stats.companies.map(c => {
                        const pct = stats.totalClaimed > 0 ? (c.claimed / stats.totalClaimed) * 100 : 0;
                        return (
                          <tr key={c.name} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2">
                              <span className="font-medium block">{c.name}</span>
                              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                <div className="bg-blue-600 h-full rounded-full" style={{ width: `${Math.max(3, pct)}%` }} />
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center font-semibold">{c.count}</td>
                            <td className="px-3 py-2 text-right">₹{c.claimed.toLocaleString('en-IN')}</td>
                            <td className="px-3 py-2 text-right text-emerald-600 font-semibold">₹{c.settled.toLocaleString('en-IN')}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Hospital wise */}
            <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hospital-wise Breakdown & Share</h4>
              <div className="border border-slate-100 rounded-xl overflow-hidden bg-white max-h-48 overflow-y-auto">
                <table className="min-w-full divide-y divide-slate-100 text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Hospital</th>
                      <th className="px-3 py-2 text-center">Claims</th>
                      <th className="px-3 py-2 text-right">Claimed</th>
                      <th className="px-3 py-2 text-right">Settled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {stats.hospitals.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-4 text-slate-400">No data found</td></tr>
                    ) : (
                      stats.hospitals.map(h => {
                        const pct = stats.totalClaimed > 0 ? (h.claimed / stats.totalClaimed) * 100 : 0;
                        return (
                          <tr key={h.name} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2">
                              <span className="font-medium block truncate max-w-[150px]" title={h.name}>{h.name}</span>
                              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${Math.max(3, pct)}%` }} />
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center font-semibold">{h.count}</td>
                            <td className="px-3 py-2 text-right">₹{h.claimed.toLocaleString('en-IN')}</td>
                            <td className="px-3 py-2 text-right text-emerald-600 font-semibold">₹{h.settled.toLocaleString('en-IN')}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Claim Type Breakdown (Cashless/Reimburse) */}
            <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Claim Type Breakdown (Cashless / Reimbursement)</h4>
              <div className="border border-slate-100 rounded-xl overflow-hidden bg-white max-h-48 overflow-y-auto">
                <table className="min-w-full divide-y divide-slate-100 text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-center">Claims</th>
                      <th className="px-3 py-2 text-right">Claimed</th>
                      <th className="px-3 py-2 text-right">Settled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {stats.types.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-4 text-slate-400">No data found</td></tr>
                    ) : (
                      stats.types.map(t => {
                        const pct = stats.totalClaimed > 0 ? (t.claimed / stats.totalClaimed) * 100 : 0;
                        return (
                          <tr key={t.name} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2">
                              <span className="font-medium block">{t.name}</span>
                              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${Math.max(3, pct)}%` }} />
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center font-semibold">{t.count}</td>
                            <td className="px-3 py-2 text-right">₹{t.claimed.toLocaleString('en-IN')}</td>
                            <td className="px-3 py-2 text-right text-emerald-600 font-semibold">₹{t.settled.toLocaleString('en-IN')}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Duration Breakdown */}
            <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Duration-wise Breakdown</h4>
              <div className="border border-slate-100 rounded-xl overflow-hidden bg-white max-h-48 overflow-y-auto">
                <table className="min-w-full divide-y divide-slate-100 text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Time Range</th>
                      <th className="px-3 py-2 text-center">Claims</th>
                      <th className="px-3 py-2 text-right">Claimed</th>
                      <th className="px-3 py-2 text-right">Settled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {[
                      { name: 'Last 30 Days', filter: (c: any) => (Date.now() - new Date(c.intimatedAt).getTime()) / 86400000 <= 30 },
                      { name: '31 to 90 Days', filter: (c: any) => { const diff = (Date.now() - new Date(c.intimatedAt).getTime()) / 86400000; return diff > 30 && diff <= 90; } },
                      { name: 'Older (90+ Days)', filter: (c: any) => (Date.now() - new Date(c.intimatedAt).getTime()) / 86400000 > 90 },
                    ].map(range => {
                      const matched = filteredClaims.filter(range.filter);
                      const claimed = matched.reduce((sum: number, c: any) => sum + Number(c.claimAmount || 0), 0);
                      const settled = matched.reduce((sum: number, c: any) => sum + Number(c.approvedAmount || 0), 0);
                      const pct = stats.totalClaimed > 0 ? (claimed / stats.totalClaimed) * 100 : 0;
                      return (
                        <tr key={range.name} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2">
                            <span className="font-medium block">{range.name}</span>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                              <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.max(3, pct)}%` }} />
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center font-semibold">{matched.length}</td>
                          <td className="px-3 py-2 text-right">₹{claimed.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-right text-emerald-600 font-semibold">₹{settled.toLocaleString('en-IN')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Tabs Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Tab buttons */}
          <div className="bg-slate-100/80 p-1 rounded-xl flex gap-1 border border-slate-200/50">
            <button
              type="button"
              onClick={() => setFilterStatus('All')}
              className={clsx(
                'px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                filterStatus === 'All' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
              )}
            >
              All
            </button>
            {UI_STATUSES.map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st as any)}
                className={clsx(
                  'px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  filterStatus === st ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                )}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full md:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            placeholder="Search claims by ID or customer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <DataTable
          columns={COLS}
          data={filteredClaims}
          total={filteredClaims.length}
          page={page}
          pageSize={20}
          loading={isLoading}
          rowKey={r => r.id}
          onPageChange={setPage}
          onRowClick={r => {
            setSelectedClaim(r);
            setDetailOpen(true);
          }}
        />
      </div>

      {/* Create Modal */}
      <Modal open={modalOpen} onClose={closeModal} title="Add New Claim" size="xl">
        <div className="pb-3 text-xs text-slate-400 font-semibold -mt-1 mb-4 border-b border-slate-100">
          Enter details for the new insurance claim.
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          
          {/* CUSTOMER DETAILS Card */}
          <div className="bg-slate-50/70 border border-slate-100 p-5 rounded-2xl space-y-3.5">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Customer Details</span>
            
            {/* Select Customer */}
            <div className="relative">
              <label className="label">Select Customer</label>
              <input type="hidden" {...register('contactId')} />
              <div className="relative mt-1">
                <input
                  value={selectedContact ? `${selectedContact.firstName} ${selectedContact.lastName} (${selectedContact.phone})` : contactSearch}
                  onChange={e => {
                    if (selectedContact) {
                      setSelectedContact(null);
                      setValue('contactId', '');
                      setSelectedPolicy(null);
                      setValue('policyId', '');
                      setContactSearch('');
                    }
                    setContactSearch(e.target.value);
                    setContactDropdown(true);
                  }}
                  onFocus={() => setContactDropdown(true)}
                  onBlur={() => setTimeout(() => setContactDropdown(false), 200)}
                  placeholder="Choose a customer..."
                  className="input w-full pl-10 pr-10 bg-white"
                />
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">▼</span>
              </div>
              {contactDropdown && !selectedContact && (
                <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                  {(contactResults?.data ?? []).length === 0 ? (
                    <li className="px-3 py-2 text-sm text-gray-400">No contacts found</li>
                  ) : (
                    (contactResults?.data ?? []).map((c: any) => (
                      <li key={c.id} onMouseDown={() => {
                        setSelectedContact(c);
                        setValue('contactId', c.id, { shouldValidate: true });
                        setContactDropdown(false);
                        setContactSearch('');
                      }} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer">
                        <span className="font-semibold">{c.firstName} {c.lastName}</span>
                        <span className="text-gray-400 text-xs ml-auto">{c.phone}</span>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>

            {/* Select Policy & Patient / Insured Person */}
            <div className="grid grid-cols-2 gap-4">
              {/* Select Policy */}
              <div className="relative">
                <label className="label">Select Policy</label>
                <input type="hidden" {...register('policyId')} />
                <button
                  type="button"
                  onClick={() => setPolicyDropdown(v => !v)}
                  className="input w-full text-left text-gray-700 bg-white mt-1 flex justify-between items-center"
                >
                  <span className={!selectedPolicy ? "text-gray-400" : ""}>
                    {selectedPolicy ? selectedPolicy.policyNumber : 'Select Policy'}
                  </span>
                  <span className="text-gray-400">▼</span>
                </button>
                {policyDropdown && (
                  <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                    {activeContactPolicies.length === 0 ? (
                      <li className="px-3 py-2 text-sm text-gray-400">No active policies</li>
                    ) : (
                      activeContactPolicies.map((p: any) => (
                        <li key={p.id} onMouseDown={() => {
                          setSelectedPolicy(p);
                          setValue('policyId', p.id, { shouldValidate: true });
                          setPolicyDropdown(false);
                        }} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer">
                          <span className="font-medium">{p.policyNumber}</span>
                          {p.plan && <span className="text-gray-400 text-xs ml-auto">{p.plan.name}</span>}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>

              {/* Patient / Insured Person */}
              <div>
                <label className="label">Patient / Insured Person</label>
                <select
                  disabled={!selectedContact}
                  className="input w-full bg-white mt-1"
                  {...register('patientName')}
                >
                  <option value="">Select Patient</option>
                  {selectedContact && (
                    <>
                      <option value={`${selectedContact.firstName} ${selectedContact.lastName}`}>
                        SELF - {selectedContact.firstName} {selectedContact.lastName}
                      </option>
                      {(contactDetail?.data?.relationships || []).map((r: any) => {
                        const c = r.relatedContact;
                        if (!c) return null;
                        const fullName = `${c.firstName} ${c.lastName}`;
                        return (
                          <option key={c.id} value={fullName}>
                            {r.relationshipType} - {fullName}
                          </option>
                        );
                      })}
                    </>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Row: Claim Type | Diagnosis / Ailment */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Claim Type</label>
              <select {...register('claimType')} className="input mt-1">
                <option value="Cashless">Cashless</option>
                <option value="Reimbursement">Reimbursement</option>
                <option value="DEATH">Death</option>
                <option value="ACCIDENTAL">Accidental</option>
                <option value="MATURITY">Maturity</option>
              </select>
            </div>
            <div>
              <label className="label">Diagnosis / Ailment</label>
              <input {...register('diagnosis')} className="input mt-1" placeholder="e.g. Dengue Fever" />
            </div>
          </div>

          {/* Row: Hospital Name | Hospital Address */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Hospital Name</label>
              <input {...register('hospital')} className="input mt-1" placeholder="Hospital Name" />
            </div>
            <div>
              <label className="label">Hospital Address</label>
              <input {...register('hospitalAddress')} className="input mt-1" placeholder="Location" />
            </div>
          </div>

          {/* Row: Date of Admission | Date of Discharge */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date of Admission</label>
              <input {...register('admissionAt')} type="date" className="input mt-1" />
            </div>
            <div>
              <label className="label">Date of Discharge</label>
              <input {...register('dischargeAt')} type="date" className="input mt-1" />
            </div>
          </div>

          {/* Row: Claim Number | Intimation Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Claim Number *</label>
              <input {...register('claimNumber')} className="input mt-1" placeholder="CLM-XXXXXXXX" />
            </div>
            <div>
              <label className="label">Intimation Date *</label>
              <input {...register('intimatedAt')} type="date" className="input mt-1" />
            </div>
          </div>

          {/* CLAIMED AMOUNT BREAKDOWN Card */}
          <div className="bg-emerald-50/20 border border-emerald-100/50 p-5 rounded-2xl space-y-4">
            <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-widest block">Claimed Amount Breakdown</span>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Hospital Amount</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                  <input {...register('amtHospital')} type="number" className="input pl-7 w-full bg-white" placeholder="0" />
                </div>
              </div>
              <div>
                <label className="label">Medicine Amount</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                  <input {...register('amtMedicine')} type="number" className="input pl-7 w-full bg-white" placeholder="0" />
                </div>
              </div>
              <div>
                <label className="label">Lab Amount</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                  <input {...register('amtLab')} type="number" className="input pl-7 w-full bg-white" placeholder="0" />
                </div>
              </div>
              <div>
                <label className="label">Pre Hospitalisation Bill</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                  <input {...register('amtPreHosp')} type="number" className="input pl-7 w-full bg-white" placeholder="0" />
                </div>
              </div>
              <div>
                <label className="label">Post Hospitalisation Bill</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                  <input {...register('amtPostHosp')} type="number" className="input pl-7 w-full bg-white" placeholder="0" />
                </div>
              </div>
              <div>
                <label className="label">Others</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                  <input {...register('amtOthers')} type="number" className="input pl-7 w-full bg-white" placeholder="0" />
                </div>
              </div>
            </div>

            {/* Total Amount Green Banner */}
            <div className="bg-emerald-50 border border-emerald-100 px-4 py-3 rounded-lg flex items-center justify-between text-sm font-bold text-emerald-800">
              <span>Total Amount</span>
              <span>₹{Number(watch('claimAmount') || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Approved Amount & Other/Deductions */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Approved Amount</label>
              <input {...register('approvedAmount')} type="number" className="input mt-1" placeholder="0" />
            </div>
            <div>
              <label className="label">Other/Deductions</label>
              <input {...register('deductionsNotes')} className="input mt-1" placeholder="Notes on deductions..." />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes / Remarks</label>
            <textarea {...register('notes')} className="input mt-1" rows={2} placeholder="Timeline logs details..." />
          </div>

          {/* DOCUMENTS Card */}
          <div className="bg-slate-50/70 border border-slate-100 p-5 rounded-2xl space-y-3.5">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Documents</span>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Claim Form</label>
                <input
                  type="file"
                  onChange={e => setClaimFormFile(e.target.files?.[0] || null)}
                  className="input w-full bg-white mt-1 text-xs py-1.5"
                />
              </div>
              <div>
                <label className="label">Discharge Summary</label>
                <input
                  type="file"
                  onChange={e => setDischargeSummaryFile(e.target.files?.[0] || null)}
                  className="input w-full bg-white mt-1 text-xs py-1.5"
                />
              </div>
              <div>
                <label className="label">Imp Medical Reports</label>
                <input
                  type="file"
                  onChange={e => setMedicalReportsFile(e.target.files?.[0] || null)}
                  className="input w-full bg-white mt-1 text-xs py-1.5"
                />
              </div>
              <div>
                <label className="label">Imp Bills</label>
                <input
                  type="file"
                  onChange={e => setBillsFile(e.target.files?.[0] || null)}
                  className="input w-full bg-white mt-1 text-xs py-1.5"
                />
              </div>
              <div>
                <label className="label">Other IMP Documents</label>
                <input
                  type="file"
                  onChange={e => setOtherImpDocsFile(e.target.files?.[0] || null)}
                  className="input w-full bg-white mt-1 text-xs py-1.5"
                />
              </div>
              <div>
                <label className="label">Claim Query Letter</label>
                <input
                  type="file"
                  onChange={e => setQueryLetterFile(e.target.files?.[0] || null)}
                  className="input w-full bg-white mt-1 text-xs py-1.5"
                />
              </div>
              <div>
                <label className="label">Reply Documents</label>
                <input
                  type="file"
                  onChange={e => setReplyDocsFile(e.target.files?.[0] || null)}
                  className="input w-full bg-white mt-1 text-xs py-1.5"
                />
              </div>
              <div>
                <label className="label">Claim Settlement Letter</label>
                <input
                  type="file"
                  onChange={e => setSettlementLetterFile(e.target.files?.[0] || null)}
                  className="input w-full bg-white mt-1 text-xs py-1.5"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" className="btn-secondary px-8 py-2.5" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn-primary px-12 py-2.5 bg-blue-600 hover:bg-blue-700 font-bold rounded-lg shadow-sm" disabled={createClaim.isPending || !selectedContact || !selectedPolicy}>
              {createClaim.isPending ? 'Saving...' : 'Save Claim'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Claim */}
      {editTarget && (
        <Modal open onClose={() => setEditTarget(null)} title="Edit Claim">
          <ClaimEditForm
            key={editTarget.id}
            initial={editTarget}
            isPending={updateClaim.isPending}
            onSave={body => updateClaim.mutate({ id: editTarget.id, body })}
            onCancel={() => setEditTarget(null)}
            employees={employees}
          />
        </Modal>
      )}

      {/* Delete Confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Claim" size="sm">
        <p className="text-sm text-gray-600 mb-4">Delete claim <strong>{deleteTarget?.claimNumber}</strong>?</p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="btn-danger" onClick={async () => { await deleteClaim.mutateAsync(deleteTarget!.id); setDeleteTarget(null); }}>
            Delete
          </button>
        </div>
      </Modal>

      {/* Claim Detail Sheet */}
      <Modal open={detailOpen} onClose={() => { setDetailOpen(false); setSelectedClaim(null); }} title="Claim Details" size="xl">
        {selectedClaim ? (
          <ClaimDetailView claim={selectedClaim} onEdit={() => { setDetailOpen(false); setEditTarget(selectedClaim); }} />
        ) : null}
      </Modal>

    </div>
  );
}

// Subcomponent showing custom Claim Detail View (Jh details layout)
export function ClaimDetailView({ claim, onEdit }: { claim: any; onEdit?: () => void }) {
  const notesData = getClaimNotesData(claim.notes);
  const displayStatus = BACKEND_TO_UI[claim.status] || 'Pending';

  const statusIcons: Record<string, any> = {
    Settled: <ShieldCheck className="text-green-600" />,
    Approved: <FileCheck2 className="text-emerald-600" />,
    Rejected: <X className="text-red-600" />,
    'In Progress': <Clock className="text-amber-600" />,
    Pending: <Clock className="text-blue-600" />,
  };

  const statusColors: Record<string, string> = {
    Settled: 'bg-green-100 text-green-800 border-green-200',
    Approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    Rejected: 'bg-red-100 text-red-800 border-red-200',
    'In Progress': 'bg-amber-100 text-amber-800 border-amber-200',
    Pending: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  return (
    <div className="space-y-6">
      {/* Header card matching Jh details card */}
      <div className="flex justify-between items-start bg-gray-50 p-4 rounded-xl border border-gray-100">
        <div className="flex gap-4">
          <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center border shadow-sm">
            {statusIcons[displayStatus] || <Clock/>}
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">₹{Number(claim.claimAmount).toLocaleString('en-IN')}</h2>
            <div className="flex gap-2 items-center mt-1">
              <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border', statusColors[displayStatus])}>
                {displayStatus}
              </span>
              <span className="text-xs text-gray-500">• {claim.claimType}</span>
            </div>
          </div>
        </div>
        {onEdit && (
          <button onClick={onEdit} className="btn-secondary text-xs flex items-center gap-1">
            <Pencil size={12}/> Update Claim
          </button>
        )}
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-4 text-sm bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Patient / Client</label>
          <div className="flex items-center gap-1.5 font-semibold text-gray-800">
            <UserCircle2 size={14} className="text-gray-400" />
            <span>{claim.contact ? `${claim.contact.firstName} ${claim.contact.lastName}` : 'Unknown'}</span>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Policy Reference</label>
          <div className="flex items-center gap-1.5 font-semibold text-gray-800">
            <FileText size={14} className="text-gray-400" />
            <span>{claim.policy?.policyNumber || 'N/A'}</span>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Hospital / Location</label>
          <div className="flex items-center gap-1.5 font-semibold text-gray-800">
            <MapPin size={14} className="text-gray-400" />
            <span>{notesData.hospital || 'N/A'}</span>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Date Filed</label>
          <div className="flex items-center gap-1.5 font-semibold text-gray-800">
            <Calendar size={14} className="text-gray-400" />
            <span>{claim.intimatedAt ? format(new Date(claim.intimatedAt), 'dd/MMM/yyyy') : '—'}</span>
          </div>
        </div>
      </div>

      {/* Expense breakdown calculator sums */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Expense Breakdown Calculator Sums</label>
        <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50/50 border border-gray-100 rounded-xl p-4 shadow-sm">
          <div className="flex justify-between border-b pb-1">
            <span className="text-gray-500">Hospital Room / Bed:</span>
            <span className="font-bold text-gray-800">₹{(notesData.amtHospital || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between border-b pb-1">
            <span className="text-gray-500">Medicines / Consumables:</span>
            <span className="font-bold text-gray-800">₹{(notesData.amtMedicine || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between border-b pb-1">
            <span className="text-gray-500">Lab tests / Radiology:</span>
            <span className="font-bold text-gray-800">₹{(notesData.amtLab || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between border-b pb-1">
            <span className="text-gray-500">Pre-hospitalization:</span>
            <span className="font-bold text-gray-800">₹{(notesData.amtPreHosp || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between border-b pb-1">
            <span className="text-gray-500">Post-hospitalization:</span>
            <span className="font-bold text-gray-800">₹{(notesData.amtPostHosp || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between border-b pb-1">
            <span className="text-gray-500">Others / Misc:</span>
            <span className="font-bold text-gray-800">₹{(notesData.amtOthers || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between col-span-2 pt-2 border-t font-semibold text-sm text-blue-800">
            <span>Total Claim Amount:</span>
            <span>₹{Number(claim.claimAmount).toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Claim Summary notes */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Diagnosis & Summary</label>
        <div className="text-sm bg-gray-50 border border-gray-100 rounded-xl p-4 text-gray-700">
          <div className="font-semibold text-gray-900 mb-1">Diagnosis: {notesData.diagnosis || 'General Treatment'}</div>
          <div>{notesData.notes || 'No treatment summary or claims details recorded.'}</div>
        </div>
      </div>
    </div>
  );
}
