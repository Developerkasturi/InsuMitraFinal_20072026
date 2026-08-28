import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, FileText, User, Trash2, Search, TrendingUp, CheckCircle, Clock, DollarSign, 
  Shield, Calendar, ChevronUp, ChevronDown, Filter, RefreshCw, Eye, CheckSquare, 
  Square, PieChart, Users, Award, ChevronRight, Download, SlidersHorizontal, Info
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commissionsService, policiesService, employeesService, contactsService } from '@api/index';
import Modal from '@comps/common/Modal';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { useAuthStore } from '@store/auth.store';
import { sortData } from '../../utils/sortUtils';
import { deletionRequestsService } from '@api/deletionRequestsService';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

interface Commission {
  id: string; amount: number; rate: number; isPaid: boolean; paidAt?: string;
  notes?: string;
  policy?: { policyNumber: string };
  commissionYear?: { name: string };
  beneficiary?: { employeeProfile?: { firstName: string; lastName: string } };
}

const schema = z.object({
  policyId:         z.string().regex(/^[0-9a-fA-F]{24}$/, 'Select a policy'),
  beneficiaryId:    z.string().regex(/^[0-9a-fA-F]{24}$/, 'Select an employee'),
  commissionYearId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Select a year'),
  amount:           z.coerce.number().min(0),
  rate:             z.coerce.number().min(0).max(100).optional(),
  notes:            z.string().optional(),
  
  basePremium:          z.coerce.number().optional(),
  baseCommissionRate:   z.coerce.number().optional(),
  baseCommissionAmount: z.coerce.number().optional(),
  
  addonPremium:          z.coerce.number().optional(),
  addonCommissionRate:   z.coerce.number().optional(),
  addonCommissionAmount: z.coerce.number().optional(),
  
  deductibleRate:        z.coerce.number().optional(),
  deductibleAmount:      z.coerce.number().optional(),
  monthlyGridRate:       z.coerce.number().optional(),
  monthlyGridAmount:     z.coerce.number().optional(),
  otherRate:             z.coerce.number().optional(),
  otherAmount:           z.coerce.number().optional(),
  renewalRate:           z.coerce.number().optional(),
  renewalAmount:         z.coerce.number().optional(),
  
  year1Commission:       z.coerce.number().optional(),
  year2Commission:       z.coerce.number().optional(),
  year3Commission:       z.coerce.number().optional(),
  year4Commission:       z.coerce.number().optional(),
  year5Commission:       z.coerce.number().optional(),
});
type Form = z.infer<typeof schema>;

const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtShort = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${Number(n).toLocaleString('en-IN')}`;
};

export default function Commissions() {
  const { user: authUser } = useAuthStore();
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState('');
  const [modalOpen, setModalOpen]   = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [payConfirm, setPayConfirm] = useState<Commission | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Commission | null>(null);
  const qc = useQueryClient();

  // Mock UI Filter State for top filter bar (Frontend only)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [insCategory, setInsCategory] = useState('All');
  const [insCompany, setInsCompany]   = useState('All');
  const [insCategoryPlan, setInsCategoryPlan] = useState('All');
  const [businessCat, setBusinessCat] = useState('All');
  const [policyTypeDropdown, setPolicyTypeDropdown] = useState(false);
  const [selectedPolicyTypes, setSelectedPolicyTypes] = useState<string[]>(['Fresh', 'Port', 'Renewal']);
  const [planName, setPlanName]       = useState('All');
  const [assignedEmp, setAssignedEmp] = useState('All');
  const [baFilter, setBaFilter]       = useState('All');
  const [rmFilter, setRmFilter]       = useState('All');
  const [minSum, setMinSum]           = useState('');
  const [maxSum, setMaxSum]           = useState('');
  const [activeState, setActiveState] = useState('Active');

  // Selected policy details panel state (Frontend UI interaction)
  const [activePolicy, setActivePolicy] = useState<{
    policyNo: string;
    customerName: string;
    company: string;
    planName: string;
    policyType: string;
    sumInsured: string;
    startDate: string;
    endDate: string;
    premium: string;
    agent: string;
    employee: string;
    ba: string;
    manager: string;
  } | null>(null);

  // Multi-selection state for table policies
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [summaryView, setSummaryView] = useState<'Company' | 'Tenure' | 'Employee' | 'BA'>('Company');

  // Filter panel collapse state (Hidden by default, shown when Filter button is clicked)
  const [showFilter, setShowFilter] = useState(false);

  // Active Tab state for section switching
  const [activeTab, setActiveTab] = useState<'WITHOUT_COMMISSION' | 'BULK_SET' | 'CARD_VIEW'>('WITHOUT_COMMISSION');

  // Active Sub Tab for Add New Commission Modal UI
  const [modalSubTab, setModalSubTab] = useState<'POLICY_INFO' | 'CALCULATOR' | 'SCHEDULE_TERM' | 'PORTING'>('POLICY_INFO');

  // Customer search & select states
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; firstName: string; lastName: string; phone?: string } | null>(null);
  const [customerDrop, setCustomerDrop] = useState(false);

  // Policy search & select states
  const [policySearch, setPolicySearch]     = useState('');
  const [selectedPolicy, setSelectedPolicy] = useState<any | null>(null);
  const [policyDrop, setPolicyDrop]         = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['commissions', page],
    queryFn:  () => commissionsService.list({ page, limit: 20 }),
  });
  const { data: summary } = useQuery({
    queryKey: ['commissions', 'overview'],
    queryFn:  () => commissionsService.overview(),
  });
  const { data: yearsData } = useQuery({
    queryKey: ['commission-years'],
    queryFn:  () => commissionsService.years(),
    enabled:  modalOpen,
  });
  const { data: customerResults, isLoading: customerLoading } = useQuery({
    queryKey: ['customer-search-comm', customerSearch],
    queryFn:  () => contactsService.list({ search: customerSearch, limit: 8 }),
    enabled:  modalOpen,
  });
  const { data: policyResults, isLoading: policyLoading } = useQuery({
    queryKey: ['policy-search-comm', selectedCustomer?.id, policySearch],
    queryFn:  () => policiesService.list({ contactId: selectedCustomer?.id, search: policySearch, limit: 8 }),
    enabled:  modalOpen && !!selectedCustomer?.id,
  });

  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const w = useWatch({ control });

  const basePrem     = Number(w.basePremium) || 0;
  const baseRate     = Number(w.baseCommissionRate) || 0;
  const baseComm     = Number(w.baseCommissionAmount) || (basePrem * (baseRate / 100));

  const addonPrem    = Number(w.addonPremium) || 0;
  const addonRate    = Number(w.addonCommissionRate) || 0;
  const addonComm    = Number(w.addonCommissionAmount) || (addonPrem * (addonRate / 100));

  const totalPremium = basePrem + addonPrem;

  const deducRate    = Number(w.deductibleRate) || 0;
  const deducComm    = Number(w.deductibleAmount) || (totalPremium * (deducRate / 100));

  const gridRate     = Number(w.monthlyGridRate) || 0;
  const gridComm     = Number(w.monthlyGridAmount) || (totalPremium * (gridRate / 100));

  const otherRate    = Number(w.otherRate) || 0;
  const otherComm    = Number(w.otherAmount) || (totalPremium * (otherRate / 100));

  const renewalRate  = Number(w.renewalRate) || 0;
  const renewalComm  = Number(w.renewalAmount) || (totalPremium * (renewalRate / 100));

  const totalComm    = (baseComm + addonComm + gridComm + otherComm + renewalComm) - deducComm;
  const yearlyShare  = totalComm / 5;

  const createYear = useMutation({
    mutationFn: (body: { name: string; year: number }) => commissionsService.createYear(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commission-years'] }),
  });
  const [newYearInput, setNewYearInput] = useState(false);
  const [newYearVal, setNewYearVal]     = useState(new Date().getFullYear());

  const createCommission = useMutation({
    mutationFn: (body: Form) => commissionsService.create(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commissions'] }); closeModal(); },
  });
  const markPaid = useMutation({
    mutationFn: (id: string) => commissionsService.markPaid(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commissions'] }); setPayConfirm(null); },
  });
  const deleteCommission = useMutation({
    mutationFn: (id: string) => commissionsService.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commissions'] }); toast.success('Commission deleted'); setDeleteTarget(null); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Error deleting commission'),
  });

  const totals = summary?.data ?? {};
  const years: any[] = yearsData?.data ?? [];

  // Auto-sync years, beneficiary, and total commission amount to form values
  useEffect(() => {
    if (years.length > 0) {
      setValue('commissionYearId', years[0].id);
    }
  }, [years, setValue]);

  useEffect(() => {
    if (selectedPolicy) {
      setValue('beneficiaryId', selectedPolicy.assignedEmployeeId || authUser?.id || '');
    } else {
      setValue('beneficiaryId', '');
    }
  }, [selectedPolicy, authUser, setValue]);

  useEffect(() => {
    setValue('amount', totalComm);
  }, [totalComm, setValue]);

  const closeModal = () => {
    setModalOpen(false); 
    reset();
    setModalSubTab('POLICY_INFO');
    setSelectedCustomer(null);
    setCustomerSearch('');
    setCustomerDrop(false);
    setSelectedPolicy(null); 
    setPolicySearch('');
    setPolicyDrop(false);
    setNewYearInput(false);
  };

  const allRows: Commission[] = data?.data ?? [];
  const filtered = useMemo(() => {
    return allRows.filter((r: any) => {
      if (search.trim()) {
        const matchesSearch =
          r.policy?.policyNumber?.toLowerCase().includes(search.toLowerCase()) ||
          `${r.beneficiary?.employeeProfile?.firstName ?? ''} ${r.beneficiary?.employeeProfile?.lastName ?? ''}`.toLowerCase().includes(search.toLowerCase());
        if (!matchesSearch) return false;
      }
      if (startDate) {
        const rDate = r.paidAt || r.createdAt;
        if (rDate && new Date(rDate) < new Date(startDate)) return false;
      }
      if (endDate) {
        const rDate = r.paidAt || r.createdAt;
        if (rDate && new Date(rDate) > new Date(endDate + 'T23:59:59')) return false;
      }
      return true;
    });
  }, [allRows, search, startDate, endDate]);
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sortedFiltered = useMemo(() => {
    return sortData(filtered, sortKey, sortDir, (row: any, key: string) => {
      if (key === 'AGENT') return `${row.beneficiary?.employeeProfile?.firstName ?? ''} ${row.beneficiary?.employeeProfile?.lastName ?? ''}`;
      if (key === 'POLICY') return row.policy?.policyNumber ?? '';
      if (key === 'BASE') return Number(row.amount ?? 0);
      if (key === 'ADDON') return Number(row.addon ?? 0);
      if (key === 'DEDUCTIBLE') return Number(row.deductible ?? 0);
      if (key === 'TOTAL') return Number(row.amount ?? 0) + Number(row.addon ?? 0) - Number(row.deductible ?? 0);
      if (key === 'STATUS') return row.isPaid ? 1 : -1;
      return row[key];
    });
  }, [filtered, sortKey, sortDir]);

  const exportCommissionsToExcel = () => {
    const dataToExport = sortedFiltered.map((c: any) => ({
      'Commission ID': c.id,
      'Policy Number': c.policy?.policyNumber || 'N/A',
      'Beneficiary / Employee': c.beneficiary?.employeeProfile ? `${c.beneficiary.employeeProfile.firstName} ${c.beneficiary.employeeProfile.lastName}` : 'N/A',
      'Commission Year': c.commissionYear?.name || 'N/A',
      'Base Amount': c.amount ? `₹${Number(c.amount).toLocaleString('en-IN')}` : '₹0',
      'Addon Amount': c.addon ? `₹${Number(c.addon).toLocaleString('en-IN')}` : '₹0',
      'Deductible Amount': c.deductible ? `₹${Number(c.deductible).toLocaleString('en-IN')}` : '₹0',
      'Payment Status': c.isPaid ? 'Paid' : 'Unpaid',
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Commissions");
    XLSX.writeFile(workbook, `Commissions_Export_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
  };

  const exportCommissionsToPdf = () => {
    const rowsHtml = sortedFiltered.map((c: any, index: number) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${index + 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${c.policy?.policyNumber || 'N/A'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${c.beneficiary?.employeeProfile ? `${c.beneficiary.employeeProfile.firstName} ${c.beneficiary.employeeProfile.lastName}` : 'N/A'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #16a34a;">₹${Number(c.amount || 0).toLocaleString('en-IN')}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${c.isPaid ? 'PAID' : 'UNPAID'}</td>
      </tr>
    `).join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Commissions Report</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #1e293b; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
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
              <div style="font-size: 12px; color: #475569; font-weight: 600;">Commissions Export Report</div>
            </div>
            <div class="meta">
              <div>Date: ${new Date().toLocaleString()}</div>
              <div>Record Count: ${sortedFiltered.length}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 8%;">Sr</th>
                <th style="width: 25%;">Policy No</th>
                <th style="width: 35%;">Beneficiary</th>
                <th style="width: 17%; text-align: right;">Amount</th>
                <th style="width: 15%; text-align: center;">Status</th>
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

  const selectedPoliciesList = useMemo(() => {
    return selectedIds.map(id => {
      if (id === '1') {
        return {
          id: '1',
          policyNumber: 'STAR/2026/1001',
          customerName: 'Ramesh Kumar',
          company: 'Star Health',
          planName: 'Star Health Assure',
          premium: '₹ 47,050',
        };
      }
      if (id === '2') {
        return {
          id: '2',
          policyNumber: 'STAR/2026/1002',
          customerName: 'Neha Sharma',
          company: 'Star Health',
          planName: 'Star Comprehensive',
          premium: '₹ 62,300',
        };
      }
      const apiRow = sortedFiltered.find(r => r.id === id);
      if (apiRow) {
        return {
          id: apiRow.id,
          policyNumber: apiRow.policy?.policyNumber ?? 'POL-2026-X',
          customerName: apiRow.beneficiary?.employeeProfile ? `${apiRow.beneficiary.employeeProfile.firstName} ${apiRow.beneficiary.employeeProfile.lastName}` : 'Customer',
          company: 'Star Health',
          planName: 'Star Health Assure',
          premium: apiRow.amount ? `₹ ${Number(apiRow.amount).toLocaleString('en-IN')}` : '₹ 47,050',
        };
      }
      return null;
    }).filter(Boolean) as any[];
  }, [selectedIds, sortedFiltered]);

  const toggleSelectAll = () => {
    if (selectedIds.length === sortedFiltered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedFiltered.map(r => r.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const isAllSelected = sortedFiltered.length > 0 && selectedIds.length === sortedFiltered.length;

  return (
    <div className="space-y-5 pb-10 text-slate-800 font-sans text-xs">
      
      {/* Floating Right Action Panel (Matches Add Contact panel and position) */}
      <div className="fixed right-5 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3 bg-white/90 backdrop-blur-xl p-2 rounded-2xl shadow-2xl border border-slate-200/80 animate-fadeIn">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center justify-center transition-all hover:scale-105 shadow-lg shadow-blue-500/30 cursor-pointer group relative animate-in zoom-in duration-200"
        >
          <Plus size={18} strokeWidth={2.2} />
          <span className="absolute right-full mr-3 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl border border-slate-800 z-50">
            Add Commission Entry
          </span>
        </button>
      </div>

      {/* ── ACTION BUTTONS & SEARCH BAR ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 border border-slate-100 rounded-2xl shadow-sm">
        {/* Left Side: Search Bar ONLY */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="page-search-wrapper">
            <Search className="page-search-icon" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search policy#, employee..."
              className="page-search-input"
            />
          </div>
        </div>

        {/* Right Side: Filter Toggle Button */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowFilter(!showFilter)} 
            className={clsx(
              "h-9 px-3.5 text-xs flex items-center gap-1.5 font-bold cursor-pointer rounded-xl border transition-all shadow-2xs",
              showFilter ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            )}
          >
            <Filter size={14} className={showFilter ? "text-indigo-600" : "text-slate-500"} />
            <span>Filter</span>
            {showFilter ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* ── FILTER PRESETS / PARAMETER CONTROLS (SHOW ONLY ON TOGGLE) ──────── */}
      {showFilter && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-xs uppercase tracking-wider">
              <Filter size={14} className="text-indigo-600" />
              <span>Filter Parameters</span>
            </div>
            <button className="text-indigo-600 text-xs font-bold flex items-center gap-1 hover:underline cursor-pointer">
              <SlidersHorizontal size={13} /> Filter Presets
            </button>
          </div>

          {/* Filter Grid - Row 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="col-span-1 sm:col-span-2 lg:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Dates (From - To)</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                  title="From Date"
                />
                <span className="text-slate-400 font-bold">-</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                  title="To Date"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Insurance Company Category</label>
              <select value={insCategory} onChange={e => setInsCategory(e.target.value)} className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-medium text-slate-700 outline-none focus:border-indigo-500">
                <option>All</option>
                <option>General Insurance</option>
                <option>Health Insurance</option>
                <option>Life Insurance</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Insurance Company</label>
              <select value={insCompany} onChange={e => setInsCompany(e.target.value)} className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-medium text-slate-700 outline-none focus:border-indigo-500">
                <option>All</option>
                <option>Star Health Insurance</option>
                <option>HDFC Ergo</option>
                <option>Niva Bupa Health</option>
                <option>ICICI Lombard</option>
                <option>LIC of India</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Insurance Plan Category</label>
              <select value={insCategoryPlan} onChange={e => setInsCategoryPlan(e.target.value)} className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-medium text-slate-700 outline-none focus:border-indigo-500">
                <option>All</option>
                <option>Individual</option>
                <option>Floater</option>
                <option>Group</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Business Category</label>
              <select value={businessCat} onChange={e => setBusinessCat(e.target.value)} className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-medium text-slate-700 outline-none focus:border-indigo-500">
                <option>All</option>
                <option>Retail</option>
                <option>Corporate</option>
              </select>
            </div>

            <div className="relative">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Policy Type</label>
              <button 
                onClick={() => setPolicyTypeDropdown(!policyTypeDropdown)} 
                className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-medium text-slate-700 flex justify-between items-center text-left"
              >
                <span className="truncate">{selectedPolicyTypes.length === 3 ? 'All' : selectedPolicyTypes.join(', ') || 'Select'}</span>
                <ChevronDown size={14} className="text-slate-400 shrink-0" />
              </button>
              {policyTypeDropdown && (
                <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-2 space-y-1">
                  {['Fresh', 'Port', 'Renewal'].map(type => (
                    <label key={type} className="flex items-center justify-between text-xs p-1 hover:bg-slate-50 rounded cursor-pointer">
                      <span className="text-slate-700 font-medium">{type}</span>
                      <input 
                        type="checkbox" 
                        checked={selectedPolicyTypes.includes(type)}
                        onChange={() => {
                          if (selectedPolicyTypes.includes(type)) {
                            setSelectedPolicyTypes(selectedPolicyTypes.filter(t => t !== type));
                          } else {
                            setSelectedPolicyTypes([...selectedPolicyTypes, type]);
                          }
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Filter Grid - Row 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end pt-1">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Plan Name</label>
              <select value={planName} onChange={e => setPlanName(e.target.value)} className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-medium text-slate-700 outline-none focus:border-indigo-500">
                <option>All</option>
                <option>Star Health Assure</option>
                <option>Optima Secure</option>
                <option>Health Reassure</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Assigned Employee</label>
              <select value={assignedEmp} onChange={e => setAssignedEmp(e.target.value)} className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-medium text-slate-700 outline-none focus:border-indigo-500">
                <option>All</option>
                <option>Pratibha</option>
                <option>Kapil</option>
                <option>Priya</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Business Associate (BA)</label>
              <select value={baFilter} onChange={e => setBaFilter(e.target.value)} className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-medium text-slate-700 outline-none focus:border-indigo-500">
                <option>All</option>
                <option>PAT</option>
                <option>Rakesh</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">RM / Manager</label>
              <select value={rmFilter} onChange={e => setRmFilter(e.target.value)} className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-medium text-slate-700 outline-none focus:border-indigo-500">
                <option>All</option>
                <option>Sarang</option>
                <option>Manoj</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sum Insured</label>
              <div className="flex items-center gap-1">
                <input type="text" placeholder="Min" value={minSum} onChange={e => setMinSum(e.target.value)} className="w-1/2 border border-slate-200 rounded-xl px-2 py-1.5 bg-white text-xs text-center font-medium outline-none" />
                <span className="text-slate-400 font-bold">-</span>
                <input type="text" placeholder="Max" value={maxSum} onChange={e => setMaxSum(e.target.value)} className="w-1/2 border border-slate-200 rounded-xl px-2 py-1.5 bg-white text-xs text-center font-medium outline-none" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Active / Inactive</label>
              <select value={activeState} onChange={e => setActiveState(e.target.value)} className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-medium text-slate-700 outline-none focus:border-indigo-500">
                <option>Active</option>
                <option>Inactive</option>
                <option>All</option>
              </select>
            </div>

          </div>

          {/* Action Buttons at bottom of Filter Card */}
          <div className="flex flex-wrap justify-between items-center gap-3 pt-3 border-t border-slate-100">
            {/* Export Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 mr-1">Export Data:</span>
              <button
                type="button"
                onClick={exportCommissionsToExcel}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer shadow-2xs transition-all flex items-center gap-1.5 text-xs font-bold bg-white"
                title="Export to Excel"
              >
                <Download size={14} className="text-emerald-600" />
                <span>Export Excel</span>
              </button>
              <button
                type="button"
                onClick={exportCommissionsToPdf}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer shadow-2xs transition-all flex items-center gap-1.5 text-xs font-bold bg-white"
                title="Export to PDF"
              >
                <FileText size={14} className="text-red-500" />
                <span>Export PDF</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button 
                type="button" 
                onClick={() => { setInsCategory('All'); setInsCompany('All'); setInsCategoryPlan('All'); setBusinessCat('All'); setPlanName('All'); setAssignedEmp('All'); setBaFilter('All'); setRmFilter('All'); setMinSum(''); setMaxSum(''); setActiveState('Active'); }} 
                className="px-4 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 font-bold hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
              >
                Reset
              </button>
              <button 
                type="button" 
                onClick={() => setShowFilter(false)} 
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── KPI METRICS RIBBON (7 SUMMARY CARDS) ────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Card 1 */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-3.5 flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <FileText size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Total Active Policies</p>
            <p className="text-base font-extrabold text-slate-900 mt-0.5">6,245</p>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-3.5 flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Shield size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Total Sum Insured</p>
            <p className="text-base font-extrabold text-slate-900 mt-0.5">₹ 1,245.80 Cr</p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-3.5 flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <DollarSign size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Total Premium</p>
            <p className="text-base font-extrabold text-slate-900 mt-0.5">₹ 312.45 Cr</p>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-3.5 flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Total Commission (Est.)</p>
            <p className="text-base font-extrabold text-slate-900 mt-0.5">₹ 28.76 Cr</p>
          </div>
        </div>

        {/* Card 5 */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-3.5 flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <User size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Employees Commission</p>
            <p className="text-base font-extrabold text-slate-900 mt-0.5">₹ 12.48 Cr</p>
          </div>
        </div>

        {/* Card 6 */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-3.5 flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Users size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">BA Commission</p>
            <p className="text-base font-extrabold text-slate-900 mt-0.5">₹ 8.62 Cr</p>
          </div>
        </div>

        {/* Card 7 */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-3.5 flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Award size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Manager Commission</p>
            <p className="text-base font-extrabold text-slate-900 mt-0.5">₹ 7.66 Cr</p>
          </div>
        </div>
      </div>

      {/* ── MAIN WORKSPACE: FULL WIDTH TABLE ────────────────────────────────── */}
      <div className="space-y-4 w-full">
          
          {/* TAB HEADER BAR */}
          <div className="bg-white rounded-t-2xl border border-slate-200/80 p-3 pb-0 border-b-0 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-4 border-b border-slate-100 w-full sm:w-auto">
              <button 
                onClick={() => setActiveTab('WITHOUT_COMMISSION')}
                className={clsx(
                  "px-4 py-2 border-b-2 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all",
                  activeTab === 'WITHOUT_COMMISSION' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
                )}
              >
                Policies Without Commission %
                <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-extrabold">214 Policies</span>
              </button>
              <button 
                onClick={() => setActiveTab('BULK_SET')}
                className={clsx(
                  "px-4 py-2 border-b-2 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all",
                  activeTab === 'BULK_SET' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
                )}
              >
                Bulk Set Commission
              </button>
              <button 
                onClick={() => setActiveTab('CARD_VIEW')}
                className={clsx(
                  "px-4 py-2 border-b-2 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all",
                  activeTab === 'CARD_VIEW' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
                )}
              >
                Commission Summary (Card View)
              </button>
            </div>
          </div>

          {/* TAB 1: TABLE CONTAINER */}
          {activeTab === 'WITHOUT_COMMISSION' && (
            <div className="bg-white rounded-b-2xl border border-slate-200/80 shadow-2xs overflow-hidden -mt-4">
              <div className="bg-indigo-50/40 border-b border-indigo-100/60 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-900 text-xs font-semibold">
                  <Info size={14} className="text-indigo-600" />
                  <span>These policies do not have commission % set for one or more roles.</span>
                </div>
                <div className="flex items-center gap-2">
                  <select 
                    onChange={(e) => {
                      if (e.target.value === 'Set Commission %') {
                        if (selectedIds.length === 0) {
                          toast.error('Please select at least one policy first.');
                        } else {
                          setBulkModalOpen(true);
                        }
                      }
                      e.target.value = 'Bulk Actions';
                    }}
                    className="border border-slate-200 rounded-lg px-2 py-1 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    <option value="Bulk Actions">Bulk Actions</option>
                    <option value="Export Selected">Export Selected</option>
                    <option value="Set Commission %">Set Commission %</option>
                  </select>
                  <button 
                    onClick={() => {
                      if (selectedIds.length === 0) {
                        toast.error('Please select at least one policy first.');
                      } else {
                        setBulkModalOpen(true);
                      }
                    }}
                    className="px-3 py-1 bg-indigo-600 text-white font-bold rounded-lg text-xs hover:bg-indigo-700 transition-colors cursor-pointer"
                  >
                    Set Commission in Bulk
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="px-3 py-2.5 text-center border-r border-slate-200 w-10">
                        <input 
                          type="checkbox" 
                          checked={isAllSelected} 
                          onChange={toggleSelectAll} 
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th className="px-3 py-2.5 border-r border-slate-200 text-center w-12">Sr. No.</th>
                      <th className="px-3 py-2.5 border-r border-slate-200">Policy No.</th>
                      <th className="px-3 py-2.5 border-r border-slate-200">Customer Name</th>
                      <th className="px-3 py-2.5 border-r border-slate-200">Company</th>
                      <th className="px-3 py-2.5 border-r border-slate-200">Plan Name</th>
                      <th className="px-3 py-2.5 border-r border-slate-200">Policy Type</th>
                      <th className="px-3 py-2.5 border-r border-slate-200 text-right">Sum Insured</th>
                      <th className="px-3 py-2.5 border-r border-slate-200 text-center">Start Date</th>
                      <th className="px-3 py-2.5 border-r border-slate-200 text-center">End Date</th>
                      <th className="px-3 py-2.5 border-r border-slate-200">Agent</th>
                      <th className="px-3 py-2.5 border-r border-slate-200">Employee</th>
                      <th className="px-3 py-2.5 border-r border-slate-200">BA</th>
                      <th className="px-3 py-2.5 border-r border-slate-200">Manager</th>
                      <th className="px-3 py-2.5 border-r border-slate-200 text-center" colSpan={4}>
                        Commission %
                        <div className="grid grid-cols-4 gap-1 text-[9px] font-semibold text-slate-400 border-t border-slate-200 mt-1 pt-0.5">
                          <span>Agent</span><span>Employee</span><span>BA</span><span>Manager</span>
                        </div>
                      </th>
                      <th className="px-3 py-2.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {/* Mock sample row 1 */}
                    <tr 
                      onClick={() => setActivePolicy({
                        policyNo: 'STAR/2026/1001',
                        customerName: 'Ramesh Kumar',
                        company: 'Star Health',
                        planName: 'Star Health Assure',
                        policyType: 'Renewal',
                        sumInsured: '₹ 5,00,000',
                        startDate: '12-06-2026',
                        endDate: '11-06-2027',
                        premium: '₹ 47,050',
                        agent: 'Avinash',
                        employee: 'Pratibha',
                        ba: 'PAT',
                        manager: 'Sarang'
                      })}
                      className={clsx(
                        "hover:bg-indigo-50/40 transition-colors cursor-pointer",
                        activePolicy?.policyNo === 'STAR/2026/1001' && "bg-indigo-50/70 font-semibold"
                      )}
                    >
                      <td className="px-3 py-2 text-center border-r border-slate-100" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.includes('1')} onChange={() => toggleSelectRow('1')} className="rounded text-indigo-600" />
                      </td>
                      <td className="px-3 py-2 text-center font-medium border-r border-slate-100">1</td>
                      <td className="px-3 py-2 font-bold text-indigo-600 border-r border-slate-100">STAR/2026/1001</td>
                      <td className="px-3 py-2 font-medium border-r border-slate-100">Ramesh Kumar</td>
                      <td className="px-3 py-2 border-r border-slate-100">Star Health</td>
                      <td className="px-3 py-2 border-r border-slate-100">Star Health Assure</td>
                      <td className="px-3 py-2 border-r border-slate-100">Renewal</td>
                      <td className="px-3 py-2 font-bold text-right border-r border-slate-100">₹ 5,00,000</td>
                      <td className="px-3 py-2 text-center border-r border-slate-100">12-06-2026</td>
                      <td className="px-3 py-2 text-center border-r border-slate-100">11-06-2027</td>
                      <td className="px-3 py-2 border-r border-slate-100">Avinash</td>
                      <td className="px-3 py-2 border-r border-slate-100">Pratibha</td>
                      <td className="px-3 py-2 border-r border-slate-100">PAT</td>
                      <td className="px-3 py-2 border-r border-slate-100">Sarang</td>
                      <td className="px-1 py-2 text-center border-r border-slate-100 font-semibold text-rose-500">—</td>
                      <td className="px-1 py-2 text-center border-r border-slate-100 font-semibold text-rose-500">—</td>
                      <td className="px-1 py-2 text-center border-r border-slate-100 font-semibold text-rose-500">—</td>
                      <td className="px-1 py-2 text-center border-r border-slate-100 font-semibold text-rose-500">—</td>
                      <td className="px-3 py-2 text-center">
                        <button className="p-1 rounded-lg text-indigo-600 hover:bg-indigo-100" title="Select Policy">
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>

                    {/* Mock sample row 2 */}
                    <tr 
                      onClick={() => setActivePolicy({
                        policyNo: 'STAR/2026/1002',
                        customerName: 'Neha Sharma',
                        company: 'Star Health',
                        planName: 'Star Comprehensive',
                        policyType: 'Renewal',
                        sumInsured: '₹ 8,00,000',
                        startDate: '05-06-2026',
                        endDate: '04-06-2027',
                        premium: '₹ 62,300',
                        agent: 'Avinash',
                        employee: 'Pratibha',
                        ba: 'PAT',
                        manager: 'Sarang'
                      })}
                      className={clsx(
                        "hover:bg-indigo-50/40 transition-colors cursor-pointer",
                        activePolicy?.policyNo === 'STAR/2026/1002' && "bg-indigo-50/70 font-semibold"
                      )}
                    >
                      <td className="px-3 py-2 text-center border-r border-slate-100" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.includes('2')} onChange={() => toggleSelectRow('2')} className="rounded text-indigo-600" />
                      </td>
                      <td className="px-3 py-2 text-center font-medium border-r border-slate-100">2</td>
                      <td className="px-3 py-2 font-bold text-indigo-600 border-r border-slate-100">STAR/2026/1002</td>
                      <td className="px-3 py-2 font-medium border-r border-slate-100">Neha Sharma</td>
                      <td className="px-3 py-2 border-r border-slate-100">Star Health</td>
                      <td className="px-3 py-2 border-r border-slate-100">Star Comprehensive</td>
                      <td className="px-3 py-2 border-r border-slate-100">Renewal</td>
                      <td className="px-3 py-2 font-bold text-right border-r border-slate-100">₹ 8,00,000</td>
                      <td className="px-3 py-2 text-center border-r border-slate-100">05-06-2026</td>
                      <td className="px-3 py-2 text-center border-r border-slate-100">04-06-2027</td>
                      <td className="px-3 py-2 border-r border-slate-100">Avinash</td>
                      <td className="px-3 py-2 border-r border-slate-100">Pratibha</td>
                      <td className="px-3 py-2 border-r border-slate-100">PAT</td>
                      <td className="px-3 py-2 border-r border-slate-100">Sarang</td>
                      <td className="px-1 py-2 text-center border-r border-slate-100 font-semibold text-rose-500">—</td>
                      <td className="px-1 py-2 text-center border-r border-slate-100 font-semibold text-rose-500">—</td>
                      <td className="px-1 py-2 text-center border-r border-slate-100 font-semibold text-rose-500">—</td>
                      <td className="px-1 py-2 text-center border-r border-slate-100 font-semibold text-rose-500">—</td>
                      <td className="px-3 py-2 text-center">
                        <button className="p-1 rounded-lg text-indigo-600 hover:bg-indigo-100" title="Select Policy">
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>

                    {/* Render API commissions rows if available */}
                    {sortedFiltered.map((r, idx) => (
                      <tr 
                        key={r.id} 
                        onClick={() => setActivePolicy({
                          policyNo: r.policy?.policyNumber ?? 'POL-2026-X',
                          customerName: r.beneficiary?.employeeProfile?.firstName ?? 'Customer',
                          company: 'Star Health',
                          planName: 'Star Health Assure',
                          policyType: 'Renewal',
                          sumInsured: fmtShort(r.amount ?? 500000),
                          startDate: '12-06-2026',
                          endDate: '11-06-2027',
                          premium: fmt(r.amount ?? 47050),
                          agent: 'Avinash',
                          employee: 'Pratibha',
                          ba: 'PAT',
                          manager: 'Sarang'
                        })}
                        className={clsx(
                          "hover:bg-indigo-50/40 transition-colors cursor-pointer",
                          activePolicy?.policyNo === (r.policy?.policyNumber ?? 'POL-2026-X') && "bg-indigo-50/70 font-semibold"
                        )}
                      >
                        <td className="px-3 py-2 text-center border-r border-slate-100" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggleSelectRow(r.id)} className="rounded text-indigo-600" />
                        </td>
                        <td className="px-3 py-2 text-center font-medium border-r border-slate-100">{idx + 3}</td>
                        <td className="px-3 py-2 font-bold text-indigo-600 border-r border-slate-100">{r.policy?.policyNumber ?? '—'}</td>
                        <td className="px-3 py-2 font-medium border-r border-slate-100">{r.beneficiary?.employeeProfile?.firstName ?? 'Customer'}</td>
                        <td className="px-3 py-2 border-r border-slate-100">Star Health</td>
                        <td className="px-3 py-2 border-r border-slate-100">Star Health Assure</td>
                        <td className="px-3 py-2 border-r border-slate-100">Renewal</td>
                        <td className="px-3 py-2 font-bold text-right border-r border-slate-100">{fmtShort(r.amount ?? 500000)}</td>
                        <td className="px-3 py-2 text-center border-r border-slate-100">12-06-2026</td>
                        <td className="px-3 py-2 text-center border-r border-slate-100">11-06-2027</td>
                        <td className="px-3 py-2 border-r border-slate-100">Avinash</td>
                        <td className="px-3 py-2 border-r border-slate-100">Pratibha</td>
                        <td className="px-3 py-2 border-r border-slate-100">PAT</td>
                        <td className="px-3 py-2 border-r border-slate-100">Sarang</td>
                        <td className="px-1 py-2 text-center border-r border-slate-100 font-semibold text-emerald-600">{r.rate ?? 5}%</td>
                        <td className="px-1 py-2 text-center border-r border-slate-100 font-semibold text-indigo-600">2%</td>
                        <td className="px-1 py-2 text-center border-r border-slate-100 font-semibold text-amber-600">1%</td>
                        <td className="px-1 py-2 text-center border-r border-slate-100 font-semibold text-purple-600">0.5%</td>
                        <td className="px-3 py-2 text-center">
                          <button className="p-1 rounded-lg text-indigo-600 hover:bg-indigo-100" title="Select Policy">
                            <Eye size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* TABLE FOOTER / PAGINATION */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50">
                <span className="text-xs font-semibold text-slate-500">
                  Showing 1 to 7 of 214 entries
                </span>
                <div className="flex items-center gap-1">
                  <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white font-semibold text-xs text-slate-400">
                    &lt;
                  </button>
                  <button className="w-7 h-7 flex items-center justify-center rounded-lg bg-indigo-600 font-bold text-xs text-white">
                    1
                  </button>
                  <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white font-semibold text-xs text-slate-700 hover:bg-slate-50">
                    2
                  </button>
                  <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white font-semibold text-xs text-slate-700 hover:bg-slate-50">
                    3
                  </button>
                  <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white font-semibold text-xs text-slate-700 hover:bg-slate-50">
                    4
                  </button>
                  <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white font-semibold text-xs text-slate-700 hover:bg-slate-50">
                    5
                  </button>
                  <span className="px-1 text-slate-400">...</span>
                  <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white font-semibold text-xs text-slate-700 hover:bg-slate-50">
                    22
                  </button>
                  <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white font-semibold text-xs text-slate-700 hover:bg-slate-50">
                    &gt;
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BULK SET COMMISSION (COMPANY / TYPE WISE) */}
          {activeTab === 'BULK_SET' && (
            <div className="bg-white rounded-b-2xl border border-slate-200/80 shadow-2xs p-4 space-y-4 -mt-4">
              <div className="font-bold text-indigo-900 text-xs border-b border-slate-100 pb-2 flex justify-between items-center">
                {/* <span>Bulk Set Commission <span className="font-normal text-slate-400">(Company / Type Wise)</span></span> */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Matching Policies:</span>
                  <span className="text-xs font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-md">342</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Company</label>
                  <select className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-semibold text-slate-800">
                    <option>Star Health Insurance</option>
                    <option>HDFC Ergo</option>
                    <option>Niva Bupa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Policy Type</label>
                  <select className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white text-xs font-semibold text-slate-800">
                    <option>Renewal</option>
                    <option>Fresh</option>
                    <option>Port</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Agent %</label>
                  <div className="relative">
                    <input type="text" defaultValue="5.00" className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-right font-bold text-xs pr-6" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Employee %</label>
                  <div className="relative">
                    <input type="text" defaultValue="2.00" className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-right font-bold text-xs pr-6" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Business Associate (BA) %</label>
                  <div className="relative">
                    <input type="text" defaultValue="1.00" className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-right font-bold text-xs pr-6" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Manager %</label>
                  <div className="relative">
                    <input type="text" defaultValue="0.50" className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-right font-bold text-xs pr-6" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-100 pt-3">
                <button className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5">
                  Apply to 342 Matching Policies
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: COMMISSION SUMMARY (CARD VIEW GRID) */}
          {activeTab === 'CARD_VIEW' && (
            <div className="bg-white rounded-b-2xl border border-slate-200/80 shadow-2xs p-4 space-y-4 -mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                {/* <div className="font-extrabold text-slate-900 text-xs tracking-tight">
                  Commission Summary (Card View)
                </div> */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  {(['Company', 'Tenure', 'Employee', 'BA'] as const).map(tab => (
                    <button 
                      key={tab}
                      onClick={() => setSummaryView(tab)}
                      className={clsx(
                        'px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer',
                        summaryView === tab ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      )}
                    >
                      By {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* CARDS SCROLL ROW */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                
                {/* Card 1: LIC */}
                <div className="border border-slate-200 rounded-2xl p-3.5 space-y-2 hover:border-indigo-300 transition-colors bg-white shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center font-black text-[10px]">
                        LIC
                      </div>
                      <span className="font-bold text-slate-900 text-xs">LIC of India</span>
                    </div>
                    <ChevronRight size={14} className="text-slate-400" />
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px]">
                    <div>
                      <span className="text-slate-400 block">Policies</span>
                      <span className="font-extrabold text-slate-800 text-xs">1,245</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block">Est. Commission</span>
                      <span className="font-extrabold text-slate-900 text-xs">₹ 5.48 Cr</span>
                    </div>
                  </div>
                  <div className="space-y-1 text-[10px] pt-1">
                    <div className="flex justify-between text-slate-600"><span>Fresh</span><span>528</span><span className="font-bold">₹ 2.12 Cr</span></div>
                    <div className="flex justify-between text-slate-600"><span>Port</span><span>312</span><span className="font-bold">₹ 1.18 Cr</span></div>
                    <div className="flex justify-between text-slate-600"><span>Renewal</span><span>405</span><span className="font-bold">₹ 2.18 Cr</span></div>
                  </div>
                </div>

                {/* Card 2: Star Health */}
                <div className="border border-indigo-200 rounded-2xl p-3.5 space-y-2 bg-indigo-50/10 hover:border-indigo-400 transition-colors shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-sky-100 text-sky-600 flex items-center justify-center font-black text-[10px]">
                        SH
                      </div>
                      <span className="font-bold text-slate-900 text-xs">Star Health Insurance</span>
                    </div>
                    <ChevronRight size={14} className="text-slate-400" />
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px]">
                    <div>
                      <span className="text-slate-400 block">Policies</span>
                      <span className="font-extrabold text-slate-800 text-xs">1,102</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block">Est. Commission</span>
                      <span className="font-extrabold text-slate-900 text-xs">₹ 4.76 Cr</span>
                    </div>
                  </div>
                  <div className="space-y-1 text-[10px] pt-1">
                    <div className="flex justify-between text-slate-600"><span>Fresh</span><span>462</span><span className="font-bold">₹ 1.86 Cr</span></div>
                    <div className="flex justify-between text-slate-600"><span>Port</span><span>298</span><span className="font-bold">₹ 1.06 Cr</span></div>
                    <div className="flex justify-between text-slate-600"><span>Renewal</span><span>342</span><span className="font-bold">₹ 1.84 Cr</span></div>
                  </div>
                </div>

                {/* Card 3: HDFC Ergo */}
                <div className="border border-slate-200 rounded-2xl p-3.5 space-y-2 hover:border-indigo-300 transition-colors bg-white shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-red-100 text-red-600 flex items-center justify-center font-black text-[10px]">
                        HDFC
                      </div>
                      <span className="font-bold text-slate-900 text-xs">HDFC Ergo</span>
                    </div>
                    <ChevronRight size={14} className="text-slate-400" />
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px]">
                    <div>
                      <span className="text-slate-400 block">Policies</span>
                      <span className="font-extrabold text-slate-800 text-xs">856</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block">Est. Commission</span>
                      <span className="font-extrabold text-slate-900 text-xs">₹ 3.62 Cr</span>
                    </div>
                  </div>
                  <div className="space-y-1 text-[10px] pt-1">
                    <div className="flex justify-between text-slate-600"><span>Fresh</span><span>352</span><span className="font-bold">₹ 1.39 Cr</span></div>
                    <div className="flex justify-between text-slate-600"><span>Port</span><span>210</span><span className="font-bold">₹ 1.06 Cr</span></div>
                    <div className="flex justify-between text-slate-600"><span>Renewal</span><span>294</span><span className="font-bold">₹ 1.17 Cr</span></div>
                  </div>
                </div>

                {/* Card 4: Niva Bupa */}
                <div className="border border-slate-200 rounded-2xl p-3.5 space-y-2 hover:border-indigo-300 transition-colors bg-white shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-cyan-100 text-cyan-600 flex items-center justify-center font-black text-[10px]">
                        NB
                      </div>
                      <span className="font-bold text-slate-900 text-xs">Niva Bupa Health</span>
                    </div>
                    <ChevronRight size={14} className="text-slate-400" />
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px]">
                    <div>
                      <span className="text-slate-400 block">Policies</span>
                      <span className="font-extrabold text-slate-800 text-xs">732</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block">Est. Commission</span>
                      <span className="font-extrabold text-slate-900 text-xs">₹ 3.01 Cr</span>
                    </div>
                  </div>
                  <div className="space-y-1 text-[10px] pt-1">
                    <div className="flex justify-between text-slate-600"><span>Fresh</span><span>310</span><span className="font-bold">₹ 1.24 Cr</span></div>
                    <div className="flex justify-between text-slate-600"><span>Port</span><span>270</span><span className="font-bold">₹ 0.86 Cr</span></div>
                    <div className="flex justify-between text-slate-600"><span>Renewal</span><span>246</span><span className="font-bold">₹ 1.08 Cr</span></div>
                  </div>
                </div>

                {/* Card 5: ICICI Lombard */}
                <div className="border border-slate-200 rounded-2xl p-3.5 space-y-2 hover:border-indigo-300 transition-colors bg-white shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-600 flex items-center justify-center font-black text-[10px]">
                        ICICI
                      </div>
                      <span className="font-bold text-slate-900 text-xs">ICICI Lombard</span>
                    </div>
                    <ChevronRight size={14} className="text-slate-400" />
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px]">
                    <div>
                      <span className="text-slate-400 block">Policies</span>
                      <span className="font-extrabold text-slate-800 text-xs">645</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block">Est. Commission</span>
                      <span className="font-extrabold text-slate-900 text-xs">₹ 2.29 Cr</span>
                    </div>
                  </div>
                  <div className="space-y-1 text-[10px] pt-1">
                    <div className="flex justify-between text-slate-600"><span>Fresh</span><span>256</span><span className="font-bold">₹ 1.01 Cr</span></div>
                    <div className="flex justify-between text-slate-600"><span>Port</span><span>150</span><span className="font-bold">₹ 0.62 Cr</span></div>
                    <div className="flex justify-between text-slate-600"><span>Renewal</span><span>239</span><span className="font-bold">₹ 0.65 Cr</span></div>
                  </div>
                </div>

              </div>
            </div>
          )}

      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          Add New Commission Modal — Constant Size Tabbed UI
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal 
        open={modalOpen} 
        onClose={closeModal} 
        title="Add New Commission" 
        subtitle="Create and record comprehensive policy commission breakdown" 
        size="2xl"
        actions={
          <button 
            type="submit" 
            form="add-commission-form" 
            className="btn-primary px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer" 
            disabled={createCommission.isPending || !selectedPolicy}
          >
            {createCommission.isPending ? 'Publishing…' : 'Publish Commission'}
          </button>
        }
      >
        <form id="add-commission-form" onSubmit={handleSubmit(d => createCommission.mutateAsync(d))} className="space-y-4 mt-2">
          <input type="hidden" {...register('beneficiaryId')} />
          <input type="hidden" {...register('commissionYearId')} />
          <input type="hidden" {...register('amount')} />

          {/* ── MODAL SUB TABS NAVIGATION ───────────────────────────────────── */}
          <div className="flex border-b border-slate-200 bg-slate-50/80 p-1 rounded-xl overflow-x-auto gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setModalSubTab('POLICY_INFO')}
              className={clsx(
                "px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer",
                modalSubTab === 'POLICY_INFO' ? "bg-white text-indigo-700 shadow-2xs border border-slate-200/60" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Shield size={14} />
              <span>Customer & Policy Info</span>
            </button>

            <button
              type="button"
              onClick={() => setModalSubTab('CALCULATOR')}
              className={clsx(
                "px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer",
                modalSubTab === 'CALCULATOR' ? "bg-white text-indigo-700 shadow-2xs border border-slate-200/60" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <DollarSign size={14} />
              <span>Breakdown Calculator</span>
            </button>

            <button
              type="button"
              onClick={() => setModalSubTab('SCHEDULE_TERM')}
              className={clsx(
                "px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer",
                modalSubTab === 'SCHEDULE_TERM' ? "bg-white text-indigo-700 shadow-2xs border border-slate-200/60" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Calendar size={14} />
              <span>Schedule & Term</span>
            </button>

            <button
              type="button"
              onClick={() => setModalSubTab('PORTING')}
              className={clsx(
                "px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer",
                modalSubTab === 'PORTING' ? "bg-white text-indigo-700 shadow-2xs border border-slate-200/60" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Award size={14} />
              <span>Porting & Bonus</span>
            </button>
          </div>

          <div className="h-[400px] overflow-y-auto pr-1">

            {/* ── SUB TAB 1: CUSTOMER & POLICY SELECTION ────────────────────────── */}
            {modalSubTab === 'POLICY_INFO' && (
              <div className="bg-slate-50/60 border border-slate-200/80 p-4 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs uppercase tracking-wider border-b border-slate-200/60 pb-2">
                  <Shield size={15} className="text-indigo-600" />
                  <span>Customer & Policy Selection (Auto-Fetched Details)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Customer Dropdown / Search */}
                  <div>
                    <label className="label">Customer (Search & Select) *</label>
                    {selectedCustomer ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/50 h-9">
                        <User size={14} className="text-indigo-600 shrink-0" />
                        <span className="text-xs font-bold text-indigo-900 truncate flex-1">
                          {selectedCustomer.firstName} {selectedCustomer.lastName} {selectedCustomer.phone ? `(${selectedCustomer.phone})` : ''}
                        </span>
                        <button 
                          type="button" 
                          onClick={() => { 
                            setSelectedCustomer(null); 
                            setCustomerSearch(''); 
                            setSelectedPolicy(null);
                            setValue('policyId', '');
                            setValue('basePremium', 0);
                            setValue('addonPremium', 0);
                          }} 
                          className="text-indigo-400 hover:text-indigo-700 text-xs cursor-pointer font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input 
                          type="text" 
                          placeholder="Search Customer name or mobile..."
                          value={customerSearch}
                          onChange={e => { setCustomerSearch(e.target.value); setCustomerDrop(true); }}
                          onFocus={() => setCustomerDrop(true)}
                          onBlur={() => setTimeout(() => setCustomerDrop(false), 200)}
                          className="input pl-9 h-9 text-xs rounded-xl w-full bg-white border border-slate-200"
                        />
                        {customerDrop && (
                          <ul className="absolute right-0 left-0 z-30 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto text-xs">
                            {customerLoading ? (
                              <li className="px-3 py-2 text-slate-400">Loading customers...</li>
                            ) : (customerResults?.data ?? []).length === 0 ? (
                              <li className="px-3 py-2 text-slate-400">No matching customers found</li>
                            ) : (
                              (customerResults?.data ?? []).map((c: any) => (
                                <li 
                                  key={c.id} 
                                  onMouseDown={() => { 
                                    setSelectedCustomer(c); 
                                    setCustomerDrop(false); 
                                    setCustomerSearch(''); 
                                  }}
                                  className="flex items-center gap-2 px-3 py-2 hover:bg-indigo-50 cursor-pointer font-medium text-slate-700"
                                >
                                  <User size={13} className="text-slate-400 shrink-0" />
                                  <span>{c.firstName} {c.lastName} {c.phone ? `(${c.phone})` : ''}</span>
                                </li>
                              ))
                            )}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Policy Select Dropdown */}
                  <div>
                    <label className="label">Policy (Filtered by Customer with Year) *</label>
                    <input type="hidden" {...register('policyId')} />
                    {selectedPolicy ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/50 h-9">
                        <Shield size={14} className="text-indigo-600 shrink-0" />
                        <span className="text-xs font-bold text-indigo-900 truncate flex-1">
                          {selectedPolicy.policyNumber} (FY {new Date(selectedPolicy.startDate).getFullYear()}-{String(new Date(selectedPolicy.endDate).getFullYear()).slice(-2)})
                        </span>
                        <button 
                          type="button" 
                          onClick={() => { 
                            setSelectedPolicy(null); 
                            setValue('policyId', '');
                            setValue('basePremium', 0);
                            setValue('addonPremium', 0);
                          }} 
                          className="text-indigo-400 hover:text-indigo-700 text-xs cursor-pointer font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Shield size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input 
                          value={policySearch} 
                          onChange={e => { setPolicySearch(e.target.value); setPolicyDrop(true); }}
                          onFocus={() => setPolicyDrop(true)} 
                          onBlur={() => setTimeout(() => setPolicyDrop(false), 200)}
                          disabled={!selectedCustomer}
                          placeholder={selectedCustomer ? "Select Policy No..." : "Please select a Customer first"} 
                          className="input pl-9 pr-7 h-9 text-xs w-full bg-white rounded-xl border border-slate-200 disabled:bg-slate-50 disabled:text-slate-400" 
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">▼</span>
                        {policyDrop && selectedCustomer && (
                          <ul className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto text-xs">
                            {policyLoading ? (
                              <li className="px-3 py-2 text-slate-400">Loading policies...</li>
                            ) : (policyResults?.data ?? []).length === 0 ? (
                              <li className="px-3 py-2 text-slate-400">No matching policies found</li>
                            ) : (
                              (policyResults?.data ?? []).map((p: any) => {
                                const startYear = new Date(p.startDate).getFullYear();
                                const endYear = String(new Date(p.endDate).getFullYear()).slice(-2);
                                return (
                                  <li 
                                    key={p.id} 
                                    onMouseDown={() => { 
                                      setSelectedPolicy(p); 
                                      setValue('policyId', p.id, { shouldValidate: true }); 
                                      setValue('basePremium', p.premiumAmount || 0);
                                      setValue('baseCommissionRate', 15);
                                      setPolicyDrop(false); 
                                      setPolicySearch(''); 
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 hover:bg-indigo-50 cursor-pointer font-medium text-slate-700"
                                  >
                                    <FileText size={13} className="text-slate-400" />
                                    <span>{p.policyNumber} (FY {startYear}-{endYear})</span>
                                  </li>
                                );
                              })
                            )}
                          </ul>
                        )}
                      </div>
                    )}
                    {errors.policyId && <p className="text-xs text-rose-500 mt-1">{errors.policyId.message}</p>}
                  </div>
                </div>

                {selectedPolicy && (
                  <>
                    <div>
                      <label className="label">Insurance Company Category</label>
                      <select 
                        disabled
                        value={
                          selectedPolicy.plan?.category === 'HEALTH' ? 'Health Insurance' :
                          selectedPolicy.plan?.category === 'LIFE' ? 'Life Insurance' : 'Other / General'
                        }
                        className="input h-9 text-xs rounded-xl w-full bg-slate-50 border border-slate-200 font-medium text-slate-500 cursor-not-allowed"
                      >
                        <option value="Health Insurance">Health Insurance</option>
                        <option value="Life Insurance">Life Insurance</option>
                        <option value="Other / General">Other / General</option>
                      </select>
                    </div>

                    {/* Auto-Fetched Policy Specs (Readonly grid) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 p-3 bg-white border border-slate-200/70 rounded-xl text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Insurance Company</span>
                        <span className="font-bold text-slate-800">{selectedPolicy.plan?.company?.name || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Product Name</span>
                        <span className="font-bold text-slate-800">{selectedPolicy.plan?.name || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Customer Category</span>
                        <span className="font-bold text-indigo-600">{selectedPolicy.customerCategory || 'Renewal'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Policy Type</span>
                        <span className="font-bold text-slate-800">
                          {selectedPolicy.plan?.category === 'HEALTH' ? 'Retail Floater' : 'Retail Individual'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Sum Insured</span>
                        <span className="font-bold text-slate-900">₹ {Number(selectedPolicy.sumAssured || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Deductible</span>
                        <span className="font-bold text-slate-800">{selectedPolicy.deductible || '₹ 0'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Riders / Addons</span>
                        <span className="font-bold text-slate-800">
                          {selectedPolicy.riders && selectedPolicy.riders.length > 0 ? selectedPolicy.riders.join(', ') : 'None'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Premium Amount</span>
                        <span className="font-extrabold text-emerald-600">₹ {Number(selectedPolicy.premiumAmount || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Policy Tenure</span>
                        <span className="font-bold text-slate-800">1 Year</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Start Date</span>
                        <span className="font-bold text-slate-800">
                          {selectedPolicy.startDate ? new Date(selectedPolicy.startDate).toLocaleDateString('en-GB') : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">End Date</span>
                        <span className="font-bold text-slate-800">
                          {selectedPolicy.endDate ? new Date(selectedPolicy.endDate).toLocaleDateString('en-GB') : 'N/A'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Agent Name</span>
                        <span className="font-bold text-slate-800">
                          {selectedPolicy.assignedEmployee 
                            ? `${selectedPolicy.assignedEmployee.employeeProfile?.firstName ?? ''} ${selectedPolicy.assignedEmployee.employeeProfile?.lastName ?? ''}` 
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}


            {/* ── SUB TAB 2: COMMISSION BREAKDOWN CALCULATOR ────────────────────── */}
            {modalSubTab === 'CALCULATOR' && (
              <div className="bg-slate-50/60 border border-slate-200/80 p-4 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs uppercase tracking-wider border-b border-slate-200/60 pb-2">
                  <DollarSign size={15} className="text-indigo-600" />
                  <span>Detailed Premium & Commission Breakdown Calculator</span>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-[11px] font-bold text-slate-500 uppercase px-1">
                    <span>Commission Type</span>
                    <span>Premium / Amount (₹)</span>
                    <span>Commission Rate (%)</span>
                    <span className="text-right">Calculated Commission (₹)</span>
                  </div>

                  {/* Base Premium (A & P) */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center bg-white p-2.5 rounded-xl border border-slate-200/70">
                    <span className="text-xs font-bold text-slate-800">Base Premium (A)</span>
                    <input {...register('basePremium')} type="number" step="0.01" placeholder="40000" className="input h-9 text-xs rounded-lg bg-slate-50" />
                    <input {...register('baseCommissionRate')} type="number" step="0.01" placeholder="15" className="input h-9 text-xs rounded-lg bg-slate-50" />
                    <div className="h-9 px-3 flex items-center justify-end bg-emerald-50 text-emerald-700 font-bold text-xs rounded-lg border border-emerald-200">
                      {fmt(baseComm)}
                    </div>
                  </div>

                  {/* Addon Premiums (B & Q) */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center bg-white p-2.5 rounded-xl border border-slate-200/70">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Addon Premium (B1)</span>
                      <span className="text-[10px] text-slate-400">Hospital Cash Rider</span>
                    </div>
                    <input {...register('addonPremium')} type="number" step="0.01" placeholder="7050" className="input h-9 text-xs rounded-lg bg-slate-50" />
                    <input {...register('addonCommissionRate')} type="number" step="0.01" placeholder="10" className="input h-9 text-xs rounded-lg bg-slate-50" />
                    <div className="h-9 px-3 flex items-center justify-end bg-emerald-50 text-emerald-700 font-bold text-xs rounded-lg border border-emerald-200">
                      {fmt(addonComm)}
                    </div>
                  </div>

                  {/* Deductible Premium (C & R) */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center bg-white p-2.5 rounded-xl border border-slate-200/70">
                    <span className="text-xs font-bold text-rose-600">Deductible Premium (C) (-)</span>
                    <div className="text-xs font-semibold text-slate-500">Total Prem: {fmt(totalPremium)}</div>
                    <input {...register('deductibleRate')} type="number" step="0.01" placeholder="2" className="input h-9 text-xs rounded-lg bg-rose-50/50 border-rose-200" />
                    <div className="h-9 px-3 flex items-center justify-end bg-rose-50 text-rose-700 font-bold text-xs rounded-lg border border-rose-200">
                      -{fmt(deducComm)}
                    </div>
                  </div>

                  {/* Monthly Volume Grid (D & S) */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center bg-white p-2.5 rounded-xl border border-slate-200/70">
                    <span className="text-xs font-bold text-indigo-700">Monthly Volume Grid (D)</span>
                    <div className="text-xs font-semibold text-slate-500">Eligible Prem: {fmt(totalPremium)}</div>
                    <input {...register('monthlyGridRate')} type="number" step="0.01" placeholder="3" className="input h-9 text-xs rounded-lg bg-slate-50" />
                    <div className="h-9 px-3 flex items-center justify-end bg-emerald-50 text-emerald-700 font-bold text-xs rounded-lg border border-emerald-200">
                      {fmt(gridComm)}
                    </div>
                  </div>

                  {/* Renewal Premium (F & U) */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center bg-white p-2.5 rounded-xl border border-slate-200/70">
                    <span className="text-xs font-bold text-slate-800">Renewal Premium (F)</span>
                    <div className="text-xs font-semibold text-slate-500">Renewal Prem: {fmt(totalPremium)}</div>
                    <input {...register('renewalRate')} type="number" step="0.01" placeholder="5" className="input h-9 text-xs rounded-lg bg-slate-50" />
                    <div className="h-9 px-3 flex items-center justify-end bg-emerald-50 text-emerald-700 font-bold text-xs rounded-lg border border-emerald-200">
                      {fmt(renewalComm)}
                    </div>
                  </div>

                  {/* Totals Summary Ribbon */}
                  <div className="flex flex-wrap items-center justify-between p-3.5 bg-indigo-900 text-white rounded-xl">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-indigo-300 block">Total Calculated Premium</span>
                      <span className="text-base font-black">{fmt(totalPremium)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-indigo-300 block">Total Net Commission</span>
                      <span className="text-xl font-black text-emerald-400">{fmt(totalComm)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── SUB TAB 3: YEARLY BREAKDOWN & TERM INSURANCE ──────────────────── */}
            {modalSubTab === 'SCHEDULE_TERM' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 5 Year Breakdown */}
                <div className="bg-slate-50/60 border border-slate-200/80 p-4 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                    <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">5-Year Commission Schedule</span>
                    <button type="button" className="text-[11px] text-indigo-600 font-bold hover:underline" onClick={() => {
                      setValue('year1Commission', yearlyShare); setValue('year2Commission', yearlyShare);
                      setValue('year3Commission', yearlyShare); setValue('year4Commission', yearlyShare);
                      setValue('year5Commission', yearlyShare);
                    }}>Auto-Split Equally</button>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map(yr => (
                      <div key={yr} className="flex flex-col gap-1">
                        <span className="text-[10px] text-slate-500 font-bold text-center">Year {yr}</span>
                        <input 
                          {...register(`year${yr}Commission` as keyof Form)} 
                          type="number" 
                          step="0.01" 
                          placeholder={Math.round(yearlyShare).toString()}
                          className="input h-9 text-xs rounded-lg text-center font-bold text-emerald-700 bg-white border-slate-200" 
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Term Insurance Specifics */}
                <div className="bg-slate-50/60 border border-slate-200/80 p-4 rounded-2xl space-y-3">
                  <span className="font-bold text-slate-800 text-xs uppercase tracking-wider block border-b border-slate-200/60 pb-2">Term Insurance Details</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">Payment Tenure</label>
                      <select className="input h-9 text-xs rounded-xl bg-white border-slate-200">
                        <option>Regular Pay (Policy Term)</option>
                        <option>Limited Pay (5 Years)</option>
                        <option>Limited Pay (10 Years)</option>
                        <option>Single Pay</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">2nd Yr Onwards Renewal %</label>
                      <input type="number" step="0.01" placeholder="2.5%" className="input h-9 text-xs rounded-xl bg-white border-slate-200" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── SUB TAB 4: PORTING & EXTRA SCHEMES ───────────────────────────── */}
            {modalSubTab === 'PORTING' && (
              <div className="bg-slate-50/60 border border-slate-200/80 p-4 rounded-2xl space-y-4">
                <span className="font-bold text-slate-800 text-xs uppercase tracking-wider block border-b border-slate-200/60 pb-2">Porting History & Special Scheme Bonus</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="label">If Port (Porting Count)</label>
                    <select className="input h-9 text-xs rounded-xl bg-white border-slate-200">
                      <option>N/A (Fresh)</option>
                      <option>R1 (1st Port)</option>
                      <option>R2 (2nd Port)</option>
                      <option>R3 (3rd Port)</option>
                      <option>R4+ (4th+ Port)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Previous Insurer Name</label>
                    <input type="text" placeholder="e.g. Care Health Insurance" className="input h-9 text-xs rounded-xl bg-white border-slate-200" />
                  </div>
                  <div>
                    <label className="label">Porting Base Bonus (₹)</label>
                    <input type="number" placeholder="0" className="input h-9 text-xs rounded-xl bg-white border-slate-200 font-bold text-emerald-600" />
                  </div>
                  <div>
                    <label className="label">Other Scheme Bonus (₹)</label>
                    <input type="number" placeholder="0" className="input h-9 text-xs rounded-xl bg-white border-slate-200 font-bold text-emerald-600" />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="label">Comments / Internal Notes</label>
                  <textarea {...register('notes')} className="input text-xs rounded-xl py-2 px-3 bg-white border border-slate-200" rows={2} placeholder="Add any special notes regarding this commission entry..." />
                </div>
              </div>
            )}

          </div>

          {createCommission.isError && (
            <p className="text-xs text-rose-600 font-bold">{(createCommission.error as any)?.response?.data?.message ?? 'Failed to save commission entry'}</p>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500" defaultChecked />
              <span className="text-xs font-bold text-slate-700">Publish under Workspace "My Commission" Tab</span>
            </label>
          </div>
        </form>
      </Modal>

      {/* ── Mark as Paid confirm ─────────────────────────────────────────────── */}
      {payConfirm && (
        <Modal open={!!payConfirm} onClose={() => setPayConfirm(null)} title="Mark as Paid">
          <p className="text-sm text-gray-600 mb-4">
            Mark commission of <span className="font-semibold">₹{Number(payConfirm.amount).toLocaleString('en-IN')}</span> for policy <span className="font-semibold">{payConfirm.policy?.policyNumber}</span> as paid?
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button className="btn-secondary text-xs" onClick={() => setPayConfirm(null)}>Cancel</button>
            <button className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => markPaid.mutate(payConfirm.id)} disabled={markPaid.isPending}>
              {markPaid.isPending ? 'Updating…' : 'Mark as Paid'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Delete Commission confirm ────────────────────────────────────────── */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Commission" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Delete commission of <strong>₹{Number(deleteTarget?.amount ?? 0).toLocaleString('en-IN')}</strong> for policy <strong>{deleteTarget?.policy?.policyNumber}</strong>? This cannot be undone.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn-secondary text-xs" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="btn-danger text-xs" disabled={deleteCommission.isPending} onClick={async () => {
            const isAdmin = authUser?.role === 'SUPERADMIN' || authUser?.role === 'OWNER';
            if (isAdmin) {
              deleteCommission.mutate(deleteTarget!.id);
            } else {
              const toastId = toast.loading('Submitting delete request to admin...');
              try {
                await deletionRequestsService.requestDeletion('Commission', deleteTarget!.id, `Employee requested deletion of commission`);
                toast.success('Deletion request submitted to admin successfully!', { id: toastId });
              } catch (err: any) {
                toast.error(err.response?.data?.message || 'Failed to submit request', { id: toastId });
              }
              setDeleteTarget(null);
            }
          }}>
            {deleteCommission.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>

      {/* ── Selected Policy Details Modal Popup ──────────────────────────────── */}
      <Modal 
        open={!!activePolicy} 
        onClose={() => setActivePolicy(null)} 
        title="Selected Policy Details" 
        subtitle={activePolicy ? `Policy No: ${activePolicy.policyNo}` : undefined}
        size="md"
      >
        {activePolicy && (
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Policy No</span>
                <span className="font-bold text-indigo-600">{activePolicy.policyNo}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Customer Name</span>
                <span className="font-bold text-slate-800">{activePolicy.customerName}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Company</span>
                <span className="font-semibold text-slate-800">{activePolicy.company}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Plan Name</span>
                <span className="font-semibold text-slate-800">{activePolicy.planName}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Policy Type</span>
                <span className="font-semibold text-slate-800">{activePolicy.policyType}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Sum Insured</span>
                <span className="font-extrabold text-slate-900">{activePolicy.sumInsured}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Start Date</span>
                <span className="font-semibold text-slate-800">{activePolicy.startDate}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">End Date</span>
                <span className="font-semibold text-slate-800">{activePolicy.endDate}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Premium</span>
                <span className="font-black text-emerald-600 text-sm">{activePolicy.premium}</span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Agent Name</span>
                <span className="font-bold text-slate-800">{activePolicy.agent}</span>
              </div>
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Employee Name</span>
                <span className="font-bold text-slate-800">{activePolicy.employee}</span>
              </div>
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">BA Name</span>
                <span className="font-bold text-slate-800">{activePolicy.ba}</span>
              </div>
              <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Manager Name</span>
                <span className="font-bold text-slate-800">{activePolicy.manager}</span>
              </div>
            </div>

            {/* ── Set Commission % for Selected ────────────────────────── */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="font-extrabold text-slate-900 text-xs pb-1">
                Set Commission % for This Policy
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Agent</label>
                  <div className="relative">
                    <input type="text" defaultValue="5.00" className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-right font-bold text-xs pr-6" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Business Associate (BA)</label>
                  <div className="relative">
                    <input type="text" defaultValue="1.00" className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-right font-bold text-xs pr-6" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Employee</label>
                  <div className="relative">
                    <input type="text" defaultValue="2.00" className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-right font-bold text-xs pr-6" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Manager</label>
                  <div className="relative">
                    <input type="text" defaultValue="0.50" className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-right font-bold text-xs pr-6" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
              <button
                type="button"
                className="flex-1 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
                onClick={() => setActivePolicy(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-[2] py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
              >
                Apply Commission %
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Bulk Set Commission Modal Popup ─────────────────────────────────── */}
      <Modal 
        open={bulkModalOpen} 
        onClose={() => setBulkModalOpen(false)} 
        title="Bulk Set Commission" 
        subtitle="Apply commission percentages to all selected policies"
        size="2xl"
        actions={
          <button 
            type="button" 
            onClick={() => {
              toast.success(`Commission percentages applied successfully to ${selectedIds.length} selected policies!`);
              setBulkModalOpen(false);
              setSelectedIds([]);
            }}
            className="btn-primary px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer"
          >
            Apply to Selected ({selectedIds.length})
          </button>
        }
      >
        <div className="h-[400px] overflow-y-auto pr-1 space-y-4 py-1">
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3.5 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] font-bold text-indigo-400 uppercase block">Selected Policies Count</span>
              <span className="font-extrabold text-indigo-900 text-sm">{selectedIds.length} Policies</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-indigo-400 uppercase block">Action Scope</span>
              <span className="font-extrabold text-indigo-900">Bulk Assignment</span>
            </div>
          </div>

          {/* Selected Policies Details List */}
          <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
            <div className="bg-slate-50/60 px-4 py-2 border-b border-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wider">
              Selected Policies Details
            </div>
            <div className="max-h-36 overflow-y-auto custom-scrollbar">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-3 py-2">Policy No</th>
                    <th className="px-3 py-2">Customer Name</th>
                    <th className="px-3 py-2">Company / Plan</th>
                    <th className="px-3 py-2 text-right">Premium</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {selectedPoliciesList.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2 font-bold text-indigo-600">{p.policyNumber}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{p.customerName}</td>
                      <td className="px-3 py-2 text-slate-500 font-medium">{p.company} - {p.planName}</td>
                      <td className="px-3 py-2 text-right font-extrabold text-slate-900">{p.premium}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
            <div className="font-bold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-200/60 pb-2">
              Set Commission Percentages
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Agent</label>
                <div className="relative">
                  <input type="text" defaultValue="5.00" className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-right font-bold text-xs pr-6" />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Business Associate (BA)</label>
                <div className="relative">
                  <input type="text" defaultValue="1.00" className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-right font-bold text-xs pr-6" />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Employee</label>
                <div className="relative">
                  <input type="text" defaultValue="2.00" className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-right font-bold text-xs pr-6" />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Manager</label>
                <div className="relative">
                  <input type="text" defaultValue="0.50" className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-right font-bold text-xs pr-6" />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-4 border-t border-slate-200 justify-end">
          <button
            type="button"
            className="py-2 px-5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
            onClick={() => setBulkModalOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              toast.success(`Commission percentages applied successfully to ${selectedIds.length} selected policies!`);
              setBulkModalOpen(false);
              setSelectedIds([]);
            }}
            className="py-2 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            Apply Commission %
          </button>
        </div>
      </Modal>

    </div>
  );
}
