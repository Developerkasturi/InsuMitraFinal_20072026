import React, { useState, useMemo, useEffect } from 'react';
import { policiesService } from '../../services';
import {
  Activity, Calendar, CheckCircle2, Clock, Search, Download, FileText,
  ChevronLeft, ChevronRight, Eye, X, User, Shield,
  Heart, TrendingUp, Wallet, BarChart2,
  ChevronDown, Users, Layers, ArrowRight,
  RotateCcw, SlidersHorizontal, History, ChevronUp, Plus, Filter
} from 'lucide-react';
import clsx from 'clsx';
import { sortData } from '../../utils/sortUtils';
import Modal from '@comps/common/Modal';

// ── Types ───────────────────────────────────────────────────────────────────────
type PhcStatus = 'Interested' | 'Partial Utilized' | 'Fully Utilized' | 'Not Interested' | 'Upcoming' | 'Completed';

interface InsuredPerson {
  name: string;
  relationship: string;
  utilizedAmount: number;
  phcCount: number;
}

interface PhcYearRecord {
  yearNo: number;
  label: string;
  isCurrent: boolean;
  startDate: string;
  endDate: string;
  status: PhcStatus;
  eligibleAmount: number;
  utilizedAmount: number;
  balanceAmount: number;
  phcCount: number;
  daysRemaining?: number;
  insuredPersons: InsuredPerson[];
  allCheckups?: any[];
}

interface PhcPolicyRecord {
  id: string;
  policyNo: string;
  customerName: string;
  customerPhone: string;
  planName: string;
  companyInitials: string;
  companyName: string;
  companyType: 'Health' | 'General';
  companyColor: string;
  policyStartDate: string;
  policyEndDate: string;
  sumInsured: number;
  phcFrequency: string;
  currentPhcYear: string;
  phcYearStartDate: string;
  phcYearEndDate: string;
  phcStatus: PhcStatus;
  phcCount: number;
  eligibleAmount: number;
  utilizedAmount: number;
  balanceAmount: number;
  daysRemaining: number;
  totalYears: number;
  years: PhcYearRecord[];
  allCheckups?: any[];
}



// ── Helpers ──────────────────────────────────────────────────────────────────────
const fmtCurr = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;

const STATUS_CFG: Record<PhcStatus, { bg: string; text: string; border: string; dot: string }> = {
  'Interested':       { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500' },
  'Partial Utilized': { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-500' },
  'Fully Utilized':   { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  'Not Interested':   { bg: 'bg-slate-100',  text: 'text-slate-600',   border: 'border-slate-200',   dot: 'bg-slate-400' },
  'Upcoming':         { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200',     dot: 'bg-sky-500' },
  'Completed':        { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200',  dot: 'bg-violet-500' },
};

function StatusBadge({ status }: { status: PhcStatus }) {
  const c = STATUS_CFG[status];
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide border', c.bg, c.text, c.border)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', c.dot)} />
      {status}
    </span>
  );
}

// ── PHC Year Card ────────────────────────────────────────────────────────────────
type PhcEntryState = { id: number; status: string };

function PhcYearCard({ yr }: { yr: PhcYearRecord }) {
  const [selPerson, setSelPerson] = useState('All Family Members');
  const [entries, setEntries] = useState<PhcEntryState[]>([{ id: Date.now(), status: 'Unutilised' }]);
  const pct = yr.eligibleAmount > 0 ? Math.round((yr.utilizedAmount / yr.eligibleAmount) * 100) : 0;
  const persons = selPerson === 'All Family Members' ? yr.insuredPersons : yr.insuredPersons.filter(p => p.name === selPerson);

  const YEAR_STATUS_COLOR: Record<string, string> = {
    'Completed': 'bg-violet-100 text-violet-700 border-violet-300',
    'Interested': 'bg-amber-100 text-amber-700 border-amber-300',
    'Partial Utilized': 'bg-blue-100 text-blue-700 border-blue-300',
    'Fully Utilized': 'bg-emerald-100 text-emerald-700 border-emerald-300',
    'Not Interested': 'bg-slate-100 text-slate-600 border-slate-300',
    'Upcoming': 'bg-sky-100 text-sky-700 border-sky-300',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden hover:shadow-md transition-all">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80 border-b border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-extrabold text-sm text-slate-900">{yr.label}</span>
          {yr.isCurrent && <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[9px] font-black rounded-md uppercase tracking-wide">Current</span>}
        </div>
        <span className={clsx('px-2.5 py-0.5 rounded-full text-[10px] font-black border', YEAR_STATUS_COLOR[yr.status] ?? 'bg-slate-100 text-slate-600 border-slate-200')}>
          {yr.status}
        </span>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-[11px] text-slate-500 font-semibold">{yr.startDate} – {yr.endDate}</p>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-bold text-slate-500">
            <span>Utilization</span><span className="text-slate-700">{pct}%</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className={clsx('h-full rounded-full transition-all duration-500', pct >= 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-blue-500' : 'bg-amber-500')} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
        </div>

        {/* Amounts Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-center">
          <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Eligible</p>
            <p className="text-[11px] font-extrabold text-slate-800 mt-0.5">{fmtCurr(yr.eligibleAmount)}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
            <p className="text-[9px] font-bold text-blue-500 uppercase tracking-wide">Utilized</p>
            <p className="text-[11px] font-extrabold text-blue-800 mt-0.5">{fmtCurr(yr.utilizedAmount)}</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-100">
            <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-wide">Balance</p>
            <p className="text-[11px] font-extrabold text-emerald-800 mt-0.5">{fmtCurr(yr.balanceAmount)}</p>
          </div>
          <div className="bg-violet-50 rounded-lg p-2 border border-violet-100">
            <p className="text-[9px] font-bold text-violet-500 uppercase tracking-wide">Count</p>
            <p className="text-[11px] font-extrabold text-violet-800 mt-0.5">{yr.phcCount}</p>
          </div>
        </div>

        {/* Insured Person Dropdown */}
        {yr.insuredPersons.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Users size={12} className="text-slate-400 shrink-0" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Insured Person</span>
            </div>
            <div className="relative">
              <select value={selPerson} onChange={e => setSelPerson(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer appearance-none pr-8">
                <option value="All Family Members">All Family Members</option>
                {yr.insuredPersons.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Breakdown Table */}
            <div className="border border-slate-100 rounded-lg overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-3 bg-slate-50/80 border-b border-slate-100 px-3 py-1.5 text-[9px] font-extrabold text-slate-500 uppercase tracking-wide">
                <span>Family Member</span><span className="text-center">Utilized</span><span className="text-center">PHC Count</span>
              </div>
              {persons.map(p => (
                <div key={p.name} className="grid grid-cols-1 sm:grid-cols-3 px-3 py-2 text-xs border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                  <span className="font-semibold text-slate-700 text-[11px] truncate pr-1">{p.name}</span>
                  <span className="text-center font-bold text-blue-700 text-[11px]">{fmtCurr(p.utilizedAmount)}</span>
                  <span className="text-center font-bold text-violet-700 text-[11px]">{p.phcCount}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transactions Section */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-wide">PHC Transaction History</h4>
          </div>

          {['PENDING', 'BOOKED', 'COMPLETED', 'CANCELLED'].map(groupStatus => {
            const groupEntries = (yr.allCheckups || []).filter((e: any) => e.status === groupStatus);
            if (groupEntries.length === 0) return null;
            return (
              <div key={groupStatus} className="bg-white border border-slate-200/60 rounded-xl p-3 shadow-xs">
                <div className="flex flex-wrap items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                  <span className={clsx('w-2 h-2 rounded-full', 
                    groupStatus === 'COMPLETED' ? 'bg-emerald-500' :
                    groupStatus === 'CANCELLED' ? 'bg-slate-400' :
                    groupStatus === 'PENDING' ? 'bg-amber-500' : 'bg-blue-500'
                  )} />
                  <h5 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">{groupStatus}</h5>
                  <span className="bg-slate-100 text-slate-500 text-[9px] font-bold px-1.5 py-0.5 rounded-md">{groupEntries.length}</span>
                </div>
                
                <div className="space-y-3">
                  {groupEntries.map((entry: any, index: number) => {
                    const globalIdx = index + 1;
                    return (
                      <div key={entry.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-3 relative group shadow-sm transition-all hover:border-blue-200">
                        <div className="flex items-center justify-between mb-1 pr-6">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                              Entry #{globalIdx}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Insured Person</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.member ? entry.member.name : 'Self'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">PHC Stage</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.status}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Booking Date</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.bookingDate ? new Date(entry.bookingDate).toLocaleDateString('en-GB') : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Appointment Date</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.scheduledAt ? new Date(entry.scheduledAt).toLocaleDateString('en-GB') : 'N/A'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Centre/Lab Name</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.centreName || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Centre/Lab City</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.centreCity || 'N/A'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Utilized Amount</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.utilizedAmount ? ('₹' + entry.utilizedAmount.toLocaleString('en-IN')) : '₹0'}
                            </p>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Report Received</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.completedAt ? new Date(entry.completedAt).toLocaleDateString('en-GB') : 'N/A'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Reimbursement or Cashless</label>
                            <p className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700">
                              {entry.reimbursementType || 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button type="button" className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-[10px] sm:text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg cursor-pointer transition-colors">
            <Eye size={12} /> View Details <ArrowRight size={11} className="ml-auto" />
          </button>
          <button type="button" className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-[10px] sm:text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition-colors">
            <History size={12} /> View History
          </button>
        </div>
      </div>
    </div>
  );
}



// ── PHC Details Modal UI (matching Installment Details form UI) ──────────────────
interface PhcModalProps {
  record: PhcPolicyRecord;
  onClose: () => void;
}

function PhcDrawer({ record, onClose }: PhcModalProps) {
  const currentYr = record.years.find(y => y.isCurrent)?.yearNo ?? (record.years[0]?.yearNo || 1);
  const [selectedYearTab, setSelectedYearTab] = useState<number>(currentYr);

  return (
    <Modal
      open={Boolean(record)}
      onClose={onClose}
      title="Policy PHC Details"
      subtitle={`View year-wise preventive health checkups, eligible amounts, and family member breakdown for ${record.customerName}`}
      size="2xl"
      actions={
        <button type="button" onClick={onClose} className="bg-blue-600 text-white px-4 py-1.5 rounded-xl text-[10px] sm:text-xs font-bold shadow-xs hover:bg-blue-700 transition-colors cursor-pointer">
          Save
        </button>
      }
    >
      <div className="space-y-3">
        {/* Policy Summary Banner */}
        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2.5 shadow-2xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className={clsx('w-8 h-8 rounded-lg text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs', record.companyColor)}>
              {record.companyInitials.slice(0, 4)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-xs text-slate-900 truncate">{record.policyNo}</h3>
              </div>
              <p className="text-[11px] font-semibold text-slate-500">{record.planName}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"><User size={12} /></div>
            <div>
              <p className="text-xs font-bold text-slate-800">{record.customerName}</p>
              <p className="text-[11px] text-slate-400 font-semibold">{record.customerPhone}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-slate-200/60 pt-2.5 text-[11px]">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Policy Start Date</span>
              <span className="font-bold text-slate-800 block mt-0.5">{record.policyStartDate}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">PHC Frequency</span>
              <span className="font-bold text-slate-800 block mt-0.5">{record.phcFrequency}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total PHC Amount</span>
              <span className="font-bold text-emerald-700 block mt-0.5">{fmtCurr(record.eligibleAmount * record.totalYears)}</span>
            </div>
          </div>
        </div>

        {/* Modal sub-navigation tabs (matching Emi tracking tab sub-navigation design) */}
        <div className="grid grid-flow-col auto-cols-max bg-slate-200/60 p-1.5 rounded-xl gap-2 border border-slate-200/80 shadow-2xs overflow-x-auto">
          {record.years.map(yr => (
            <button
              key={yr.yearNo}
              type="button"
              onClick={() => setSelectedYearTab(yr.yearNo)}
              className={clsx(
                'py-1.5 px-4 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer whitespace-nowrap text-center select-none',
                selectedYearTab === yr.yearNo
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              )}
            >
              {yr.label} {yr.isCurrent && '(Current)'}
            </button>
          ))}
        </div>

        {/* Selected Year Card Scroll Area */}
        <div className="h-[360px] overflow-y-auto pr-1.5 custom-scrollbar">
          {record.years
            .filter(yr => yr.yearNo === selectedYearTab)
            .map(yr => <PhcYearCard key={yr.yearNo} yr={yr} />)}
        </div>
      </div>
    </Modal>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────────
export default function PhcTrackingView() {
  const [activeTab, setActiveTab] = useState<'all' | 'dependencies' | 'due-this-month' | 'upcoming' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [policyTypeFilter, setPolicyTypeFilter] = useState('All');
  const [phcStatusFilter, setPhcStatusFilter] = useState('All');
  const [phcYearFilter, setPhcYearFilter] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dateFilterType, setDateFilterType] = useState('PHC Year End Date');
  const [companyFilter, setCompanyFilter] = useState('All');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [quickFilter, setQuickFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [drawerRecord, setDrawerRecord] = useState<PhcPolicyRecord | null>(null);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const activePhcFilterCount = (policyTypeFilter !== 'All' ? 1 : 0) + (phcStatusFilter !== 'All' ? 1 : 0) + (phcYearFilter !== 'All' ? 1 : 0) + (companyFilter !== 'All' ? 1 : 0) + (fromDate || toDate ? 1 : 0);

  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [phcData, setPhcData] = useState<PhcPolicyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    policiesService.getPhcTracking()
      .then(res => setPhcData(res?.data || []))
      .catch(err => console.error('Error fetching PHC data:', err))
      .finally(() => setIsLoading(false));
  }, []);

  const filteredData = useMemo(() => {
    let list = [...phcData];

    const parseDateStr = (d: string) => {
      const m: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
      const parts = d.split(' ');
      if (parts.length === 3) return new Date(parseInt(parts[2]), m[parts[1]], parseInt(parts[0]));
      return new Date(d);
    };

    const parseInputDate = (d: string) => {
      if (!d) return null;
      const p = d.split('/');
      if (p.length === 3) return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
      return null;
    };

    const fDate = parseInputDate(fromDate);
    const tDate = parseInputDate(toDate);

    if (fDate && tDate) {
      list = list.filter(p => {
        let dateStr = p.phcYearEndDate;
        if (dateFilterType === 'PHC Start Date') dateStr = p.phcYearStartDate;
        else if (dateFilterType === 'Policy End Date') dateStr = p.policyEndDate;
        
        const filterDate = parseDateStr(dateStr);
        return filterDate >= fDate && filterDate <= tDate;
      });
    }

    if (activeTab === 'due-this-month') list = list.filter(p => p.daysRemaining <= 30 && p.daysRemaining > 0);
    else if (activeTab === 'upcoming') list = list.filter(p => p.phcStatus === 'Upcoming' || p.daysRemaining > 30);
    else if (activeTab === 'completed') list = list.filter(p => p.phcStatus === 'Completed' || p.phcStatus === 'Fully Utilized');
    
    if (phcStatusFilter !== 'All') list = list.filter(p => p.phcStatus === phcStatusFilter);
    if (companyFilter !== 'All') list = list.filter(p => p.companyName === companyFilter || p.companyInitials === companyFilter);
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.policyNo.toLowerCase().includes(q) || p.customerName.toLowerCase().includes(q) || p.planName.toLowerCase().includes(q) || p.customerPhone.includes(q));
    }
    return list;
  }, [activeTab, phcStatusFilter, searchQuery, fromDate, toDate]);

  const sortedFilteredData = useMemo(() => {
    return sortData(filteredData, sortKey, sortDir, (row: any, key: string) => {
      return row[key];
    });
  }, [filteredData, sortKey, sortDir]);

  const exportPhcToExcel = () => {
    const isDeps = activeTab === 'dependencies';
    let headers: string[];
    let rows: string;
    
    if (isDeps) {
      headers = ['Insured Person', 'Relationship', 'Eligible Amount', 'Utilized Amount', 'Balance Amount', 'Policy Number', 'Insurer', 'Plan Name'];
      rows = dependenciesData.map((d: any) => [
        `"${(d.name || '').replace(/"/g, '""')}"`,
        `"${(d.relationship || '').replace(/"/g, '""')}"`,
        d.eligibleAmount ?? '',
        d.utilizedAmount ?? '',
        d.balanceAmount ?? '',
        `"${(d.policyNo || '').replace(/"/g, '""')}"`,
        `"${(d.insurer || '').replace(/"/g, '""')}"`,
        `"${(d.planName || '').replace(/"/g, '""')}"`
      ].join(',')).join('\n');
    } else {
      headers = ['Customer Name', 'Policy Number', 'Product', 'Insurer', 'PHC Year', 'Status', 'Eligible Amount', 'Utilized Amount', 'Balance Amount', 'Days Remaining'];
      rows = sortedFilteredData.map((p: any) => [
        `"${(p.customerName || '').replace(/"/g, '""')}"`,
        `"${(p.policyNo || '').replace(/"/g, '""')}"`,
        `"${(p.planName || '').replace(/"/g, '""')}"`,
        `"${(p.companyName || '').replace(/"/g, '""')}"`,
        `"${(p.currentPhcYear || '').replace(/"/g, '""')}"`,
        `"${(p.phcStatus || '').replace(/"/g, '""')}"`,
        p.eligibleAmount ?? '',
        p.utilizedAmount ?? '',
        p.balanceAmount ?? '',
        p.daysRemaining ?? ''
      ].join(',')).join('\n');
    }
    
    const content = headers.join(',') + '\n' + rows;
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `phc_tracking_export_&{new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    // Since toast is imported from policies index or globally, let's use global import dynamically
    import('react-hot-toast').then(({ default: toast }) => toast.success('PHC data exported to Excel successfully'));
  };

  const exportPhcToPdf = () => {
    const isDeps = activeTab === 'dependencies';
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      import('react-hot-toast').then(({ default: toast }) => toast.error('Pop-up blocked. Please allow pop-ups to print PDF'));
      return;
    }
    
    let headersHtml = '';
    let rowsHtml = '';
    
    if (isDeps) {
      headersHtml = `
        <tr>
          <th style="width: 20%;">Insured Person</th>
          <th style="width: 15%;">Relationship</th>
          <th style="width: 15%; text-align: right;">Eligible Amount</th>
          <th style="width: 15%; text-align: right;">Utilized Amount</th>
          <th style="width: 15%; text-align: right;">Balance Amount</th>
          <th style="width: 20%;">Policy No</th>
        </tr>
      `;
      rowsHtml = dependenciesData.map((d: any) => `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 8px;">${d.name || 'N/A'}</td>
          <td style="padding: 8px;">${d.relationship || 'N/A'}</td>
          <td style="padding: 8px; text-align: right;">₹${d.eligibleAmount?.toLocaleString() || 0}</td>
          <td style="padding: 8px; text-align: right;">₹${d.utilizedAmount?.toLocaleString() || 0}</td>
          <td style="padding: 8px; text-align: right;">₹${d.balanceAmount?.toLocaleString() || 0}</td>
          <td style="padding: 8px; font-weight: 600;">${d.policyNo || 'N/A'}</td>
        </tr>
      `).join('');
    } else {
      headersHtml = `
        <tr>
          <th style="width: 20%;">Customer Name</th>
          <th style="width: 15%;">Policy No</th>
          <th style="width: 20%;">Product</th>
          <th style="width: 15%; text-align: center;">PHC Year</th>
          <th style="width: 10%; text-align: right;">Balance</th>
          <th style="width: 10%; text-align: center;">Status</th>
          <th style="width: 10%; text-align: center;">Days Left</th>
        </tr>
      `;
      rowsHtml = sortedFilteredData.map((p: any) => `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 8px;">${p.customerName || 'N/A'}</td>
          <td style="padding: 8px; font-weight: 600;">${p.policyNo || 'N/A'}</td>
          <td style="padding: 8px;">${p.planName || 'N/A'}</td>
          <td style="padding: 8px; text-align: center;">${p.currentPhcYear || 'N/A'}</td>
          <td style="padding: 8px; text-align: right;">₹${p.balanceAmount?.toLocaleString() || 0}</td>
          <td style="padding: 8px; text-align: center;"><span style="padding: 2px 6px; border-radius: 4px; background: ${p.phcStatus === 'Completed' ? '#def7ec; color: #03543f;' : '#feecdc; color: #b43c08;'} font-size: 10px; font-weight: bold;">${p.phcStatus}</span></td>
          <td style="padding: 8px; text-align: center;">${p.daysRemaining || 'N/A'}</td>
        </tr>
      `).join('');
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>PHC Tracking Report</title>
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
              <div style="font-size: 12px; color: #475569; font-weight: 600;">PHC Tracking Export Report — ${isDeps ? 'Insured Persons' : 'Policies'}</div>
            </div>
            <div class="meta">
              <div>Date: ${new Date().toLocaleString()}</div>
              <div>Record Count: ${isDeps ? dependenciesData.length : sortedFilteredData.length}</div>
            </div>
          </div>
          <table>
            <thead>
              ${headersHtml}
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

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedFilteredData.slice(start, start + rowsPerPage);
  }, [sortedFilteredData, currentPage, rowsPerPage]);

  const dependenciesData = useMemo(() => {
    const depsMap = new Map<string, any>();
    
    filteredData.forEach(policy => {
      policy.years.forEach(yr => {
        yr.insuredPersons.forEach(person => {
          if (person.relationship === 'Self') return;
          
          const key = `${policy.id}-${person.name}`;
          if (!depsMap.has(key)) {
            depsMap.set(key, {
              id: key,
              policyRecord: policy,
              name: person.name,
              relationship: person.relationship,
              utilizedAmount: 0,
              phcCount: 0,
            });
          }
          const dep = depsMap.get(key)!;
          dep.utilizedAmount += person.utilizedAmount;
          dep.phcCount += person.phcCount;
        });
      });
    });

    let depsList = Array.from(depsMap.values());
    return sortData(depsList, sortKey, sortDir, (row: any, key: string) => {
      if (key === 'policyNo' || key === 'customerName' || key === 'planName') return row.policyRecord[key];
      return row[key];
    });
  }, [filteredData, sortKey, sortDir]);

  const paginatedDependencies = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return dependenciesData.slice(start, start + rowsPerPage);
  }, [dependenciesData, currentPage, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil((activeTab === 'dependencies' ? dependenciesData.length : filteredData.length) / rowsPerPage));

  const handleQuickFilter = (key: string) => {
    setQuickFilter(key);
    if (key === 'this-month') { setFromDate('01/08/2026'); setToDate('31/08/2026'); }
    else if (key === 'last-month') { setFromDate('01/07/2026'); setToDate('31/07/2026'); }
    else if (key === 'this-quarter') { setFromDate('01/04/2025'); setToDate('30/06/2025'); }
    else if (key === 'this-year') { setFromDate('01/01/2026'); setToDate('31/12/2026'); }
  };

  const TABS = [
    { key: 'all', label: 'All PHC Policies' },
    { key: 'dependencies', label: 'Dependencies' },
    { key: 'due-this-month', label: 'Due this Month' },
    { key: 'upcoming', label: 'Under Process PHC' },
    { key: 'completed', label: 'Completed PHC' },
  ] as const;

  const SUMMARY_CARDS = [
    { label: 'Total Active Policies with PHC', value: filteredData.length, sub: 'Filtered Policies', icon: Shield, color: 'border-teal-100', iconBg: 'bg-teal-50 text-teal-600 border-teal-100', isAmount: false },
    { label: 'Policies with Full Utilisation', value: filteredData.filter(p => p.phcStatus === 'Fully Utilized' || p.phcStatus === 'Completed').length, sub: 'Filtered Policies', icon: CheckCircle2, color: 'border-emerald-100', iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100', isAmount: false },
    { label: 'Total PHC Amount', value: filteredData.reduce((s, p) => s + p.eligibleAmount, 0), sub: 'Filtered Policies', icon: Wallet, color: 'border-violet-100', iconBg: 'bg-violet-50 text-violet-600 border-violet-100', isAmount: true },
    { label: 'Total Utilised Amount', value: filteredData.reduce((s, p) => s + p.utilizedAmount, 0), sub: 'Filtered Policies', icon: TrendingUp, color: 'border-blue-100', iconBg: 'bg-blue-50 text-blue-600 border-blue-100', isAmount: true },
  ];

  return (
    <div className="space-y-4 pb-10 font-sans">

      {/* ── Summary Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {SUMMARY_CARDS.map(card => (
          <div key={card.label} className={clsx('bg-white rounded-2xl p-3.5 border shadow-xs flex items-center gap-2.5 hover:shadow-md transition-all', card.color)}>
            <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border', card.iconBg)}>
              <card.icon size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-tight">{card.label}</p>
              <p className={clsx('font-black text-slate-900 mt-0.5', card.isAmount ? 'text-sm' : 'text-xl')}>
                {card.isAmount ? fmtCurr(card.value as number) : card.value}
              </p>
              <p className="text-[10px] font-bold text-slate-400">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main Table Card ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center border-b border-slate-100 px-4 pt-2">
          {TABS.map(tab => (
            <button key={tab.key} type="button" onClick={() => { setActiveTab(tab.key); setCurrentPage(1); }}
              className={clsx('px-5 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap mr-1',
                activeTab === tab.key ? 'border-blue-600 text-blue-600 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-700')}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter Row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/30">
          <div className="page-search-wrapper">
            <Search className="page-search-icon" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search by policy no., customer, plan name..."
              className="page-search-input"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-wrap">
            {[
              { val: policyTypeFilter, setter: setPolicyTypeFilter, label: 'Policy Type', opts: [['All', 'Policy Type'], ['HEALTH', 'Health'], ['LIFE', 'Life'], ['TERM', 'Term']] },
              { val: phcStatusFilter, setter: setPhcStatusFilter, label: 'PHC Status', opts: [['All', 'PHC Status'], ['Interested', 'Interested'], ['Partial Utilized', 'Partial Utilized'], ['Fully Utilized', 'Fully Utilized'], ['Not Interested', 'Not Interested'], ['Upcoming', 'Upcoming'], ['Completed', 'Completed']] },
              { val: phcYearFilter, setter: setPhcYearFilter, label: 'PHC Year', opts: [['All', 'PHC Year'], ['Year 1', 'Year 1'], ['Year 2', 'Year 2'], ['Year 3', 'Year 3']] },
              { val: companyFilter, setter: setCompanyFilter, label: 'Company', opts: [['All', 'Company'], ...Array.from(new Set(phcData.map((p: any) => p.companyName))).map(c => [c as string, c as string] as [string, string])] },
            ].map(({ val, setter, opts }) => (
              <div key={opts[0][1]} className="relative">
                <select value={val} onChange={e => setter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl pl-3 pr-7 py-2 text-xs font-semibold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer appearance-none">
                  {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <button type="button" onClick={() => { setSearchQuery(''); setPolicyTypeFilter('All'); setPhcStatusFilter('All'); setPhcYearFilter('All'); setFromDate(''); setToDate(''); setActiveTab('all'); setCurrentPage(1); }}
              className="flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
              <RotateCcw size={12} /> Reset
            </button>
            <button
              type="button"
              onClick={() => setShowDateFilter(prev => !prev)}
              className={clsx(
                "p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 cursor-pointer shadow-2xs transition-all flex items-center gap-1.5 text-xs font-bold bg-white",
                showDateFilter && "bg-blue-50 border-blue-200 text-blue-600"
              )}
              title="Advanced Filters"
            >
              <Filter size={14} className={showDateFilter || activePhcFilterCount > 0 ? "text-blue-600" : "text-slate-500"} />
              <span className="hidden sm:inline">Filters</span>
              {activePhcFilterCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] bg-blue-600 text-white rounded-full font-black leading-none">
                  {activePhcFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Collapsible Date Wise Filter ──────────────────────────────────────── */}
        {showDateFilter && (
          <div className="bg-slate-50/50 border-b border-slate-200/80 p-4 space-y-3 animate-fadeIn">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-extrabold text-blue-700 flex flex-wrap items-center gap-1.5">
                <Calendar size={13} className="text-blue-500" />
                Advanced Filters & Export
              </p>
              {/* Export Buttons inside Filter Form */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Export PHC:</span>
                <button
                  type="button"
                  onClick={exportPhcToExcel}
                  className="px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 cursor-pointer shadow-2xs transition-all flex items-center gap-1.5 text-xs font-bold"
                  title="Export to Excel"
                >
                  <Download size={13} className="text-emerald-600" />
                  <span>Export Excel</span>
                </button>
                <button
                  type="button"
                  onClick={exportPhcToPdf}
                  className="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer shadow-2xs transition-all flex items-center gap-1.5 text-xs font-bold"
                  title="Export to PDF"
                >
                  <FileText size={13} className="text-red-500" />
                  <span>Export PDF</span>
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Filter By</label>
                <div className="relative">
                  <select value={dateFilterType} onChange={e => setDateFilterType(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl pl-3 pr-7 py-2 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer appearance-none">
                    {['PHC Year End Date', 'PHC Start Date', 'Policy End Date'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">From Date</label>
                <div className="relative">
                  <input type="text" value={fromDate} onChange={e => { setFromDate(e.target.value); setQuickFilter(null); }}
                    className="bg-white border border-slate-200 rounded-xl pl-3 pr-9 py-2 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 w-36" placeholder="DD/MM/YYYY" />
                  <Calendar size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">To Date</label>
                <div className="relative">
                  <input type="text" value={toDate} onChange={e => { setToDate(e.target.value); setQuickFilter(null); }}
                    className="bg-white border border-slate-200 rounded-xl pl-3 pr-9 py-2 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 w-36" placeholder="DD/MM/YYYY" />
                  <Calendar size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 flex-wrap">
                {[{ key: 'this-month', label: 'This Month' }, { key: 'last-month', label: 'Last Month' }, { key: 'this-quarter', label: 'This Quarter' }, { key: 'this-year', label: 'This Year' }].map(qf => (
                  <button key={qf.key} type="button" onClick={() => handleQuickFilter(qf.key)}
                    className={clsx('px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all border', quickFilter === qf.key ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}>
                    {qf.label}
                  </button>
                ))}
                <button type="button" onClick={() => { setFromDate(''); setToDate(''); setQuickFilter(null); }}
                  className="px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">Clear</button>
              </div>
            </div>
            {fromDate && toDate && (
              <p className="text-[11px] font-medium text-slate-500 italic">
                Showing policies whose {dateFilterType} is between {fromDate} and {toDate}
              </p>
            )}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          {activeTab === 'dependencies' ? (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-3 py-3 border border-slate-200 text-center w-10">Sr No.</th>
                  {[
                    { key: 'customerName', label: 'Customer Name' },
                    { key: 'policyNo', label: 'Policy no.' },
                    { key: 'planName', label: 'Product name' },
                    { key: 'name', label: 'Dependent Name' },
                    { key: 'relationship', label: 'Relationship' },
                    { key: 'utilizedAmount', label: 'Total Utilised' },
                    { key: 'phcCount', label: 'Total PHC Count' },
                    { key: 'Actions', label: 'Action', align: 'right' },
                  ].map(h => (
                    <th key={h.key} 
                      className={clsx(`px-3 py-3 border border-slate-200 whitespace-nowrap select-none ${h.align === 'right' ? 'text-right' : ''}`, h.key !== 'Actions' && 'cursor-pointer hover:text-slate-900')}
                      onClick={() => {
                        if (h.key === 'Actions') return;
                        if (sortKey === h.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                        else { setSortKey(h.key); setSortDir('asc'); }
                      }}
                    >
                      <span className={clsx("inline-flex items-center gap-1", h.align === 'right' && "justify-end w-full")}>
                        {h.label}
                        {h.key !== 'Actions' && (
                          <span className="text-slate-400">
                            {sortKey === h.key
                              ? sortDir === 'asc' ? <ChevronUp size={13} className="text-slate-900 stroke-[3]" /> : <ChevronDown size={13} className="text-slate-900 stroke-[3]" />
                              : <ChevronUp size={13} className="text-slate-500 stroke-[2.5]" />}
                          </span>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80 font-medium">
                {paginatedDependencies.length === 0 ? (
                  <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-400 font-semibold">No dependents match the selected filters.</td></tr>
                ) : paginatedDependencies.map((r, idx) => (
                  <tr key={r.id} onClick={() => setDrawerRecord(r.policyRecord)} className={clsx("transition-colors cursor-pointer", idx % 2 === 1 ? 'bg-slate-50/80' : 'bg-white', 'hover:bg-blue-50/50')}>
                    <td className="px-3 py-3 border border-slate-200 text-center font-bold text-slate-500">{(currentPage - 1) * rowsPerPage + idx + 1}</td>
                    <td className="px-3 py-3 border border-slate-200 font-bold text-slate-900 whitespace-nowrap">{r.policyRecord.customerName}</td>
                    <td className="px-3 py-3 border border-slate-200 whitespace-nowrap"><span className="font-bold text-slate-800 text-[11px]">{r.policyRecord.policyNo}</span></td>
                    <td className="px-3 py-3 border border-slate-200"><p className="font-semibold text-slate-700 text-[11px] max-w-[130px] truncate">{r.policyRecord.planName}</p></td>
                    <td className="px-3 py-3 border border-slate-200 font-extrabold text-slate-900 text-xs whitespace-nowrap">
                      <span className="hover:text-blue-600 transition-colors">{r.name}</span>
                    </td>
                    <td className="px-3 py-3 border border-slate-200 whitespace-nowrap font-bold text-slate-800 text-xs">{r.relationship}</td>
                    <td className="px-3 py-3 border border-slate-200 whitespace-nowrap font-extrabold text-slate-900 text-xs">{fmtCurr(r.utilizedAmount)}</td>
                    <td className="px-3 py-3 border border-slate-200 whitespace-nowrap font-extrabold text-slate-900 text-xs">{r.phcCount}</td>
                    <td className="px-3 py-3 border border-slate-200 whitespace-nowrap text-right" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setDrawerRecord(r.policyRecord)} className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 cursor-pointer transition-colors" title="View Policy Details">
                        <Eye size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-3 py-3 border border-slate-200 text-center w-10">
                  <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                    checked={selectedRows.size === paginatedData.length && paginatedData.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedRows(new Set(paginatedData.map(r => r.id)));
                      else setSelectedRows(new Set());
                    }} />
                </th>
                {[
                  { key: 'srNo', label: 'Sr. No.' },
                  { key: 'customerName', label: 'Customer Name' },
                  { key: 'customerPhone', label: 'Customer contact no' },
                  { key: 'companyType', label: 'Insurance company type' },
                  { key: 'companyName', label: 'Insurance company name' },
                  { key: 'planName', label: 'Product name' },
                  { key: 'sumInsured', label: 'Sum Insured' },
                  { key: 'policyNo', label: 'Policy no.' },
                  { key: 'policyEndDate', label: 'Policy End date' },
                  { key: 'currentPhcYear', label: 'Current PHC Year' },
                  { key: 'phcYearStartDate', label: 'PHC Year Start Date' },
                  { key: 'phcYearEndDate', label: 'PHC Year End Date' },
                  { key: 'phcStatus', label: 'PHC Status' },
                  { key: 'eligibleAmount', label: 'PHC Amount' },
                  { key: 'utilizedAmount', label: 'Utilised Amount' },
                  { key: 'balanceAmount', label: 'Balance amount' },
                  { key: 'Actions', label: 'Action', align: 'right' },
                ].map(h => (
                  <th key={h.key} 
                    className={clsx(`px-3 py-3 border border-slate-200 whitespace-nowrap select-none ${h.align === 'right' ? 'text-right' : ''}`, h.key !== 'Actions' && h.key !== 'srNo' && 'cursor-pointer hover:text-slate-900')}
                    onClick={() => {
                      if (h.key === 'Actions' || h.key === 'srNo') return;
                      if (sortKey === h.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                      else { setSortKey(h.key); setSortDir('asc'); }
                    }}
                  >
                    <span className={clsx("inline-flex items-center gap-1", h.align === 'right' && "justify-end w-full")}>
                      {h.label}
                      {h.key !== 'Actions' && h.key !== 'srNo' && (
                        <span className="text-slate-400">
                          {sortKey === h.key
                            ? sortDir === 'asc' ? <ChevronUp size={13} className="text-slate-900 stroke-[3]" /> : <ChevronDown size={13} className="text-slate-900 stroke-[3]" />
                            : <ChevronUp size={13} className="text-slate-500 stroke-[2.5]" />}
                        </span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80 font-medium">
              {paginatedData.length === 0 ? (
                <tr><td colSpan={18} className="px-5 py-12 text-center text-slate-400 font-semibold">No PHC policies match the selected filters.</td></tr>
              ) : paginatedData.map((r, idx) => (
                <tr key={r.id} onClick={() => setDrawerRecord(r)} className={clsx("transition-colors cursor-pointer", idx % 2 === 1 ? 'bg-slate-50/80' : 'bg-white', selectedRows.has(r.id) && 'bg-blue-50/50')}>
                  <td className="px-3 py-3 border border-slate-200 text-center" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                      checked={selectedRows.has(r.id)}
                      onChange={(e) => {
                        const newSet = new Set(selectedRows);
                        if (e.target.checked) newSet.add(r.id);
                        else newSet.delete(r.id);
                        setSelectedRows(newSet);
                      }} />
                  </td>
                  <td className="px-3 py-3 border border-slate-200 text-center font-bold text-slate-500">{(currentPage - 1) * rowsPerPage + idx + 1}</td>
                  <td className="px-3 py-3 border border-slate-200">
                    <span className="font-extrabold text-slate-900 text-xs hover:text-blue-600 transition-colors whitespace-nowrap">
                      {r.customerName}
                    </span>
                  </td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap font-bold text-slate-800 text-xs">{r.customerPhone}</td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                      {r.companyType}
                    </span>
                  </td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap font-extrabold text-slate-900 text-xs">{r.companyName}</td>
                  <td className="px-3 py-3 border border-slate-200">
                    <p className="font-extrabold text-blue-900 text-xs max-w-[130px] truncate" title={r.planName}>{r.planName}</p>
                  </td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap font-extrabold text-slate-900 text-xs">{fmtCurr(r.sumInsured)}</td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap">
                    <span className="font-black text-slate-900 text-xs tracking-tight bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">{r.policyNo}</span>
                  </td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap font-bold text-slate-800 text-xs">{r.policyEndDate}</td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap">
                    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold border',
                      r.currentPhcYear.includes('1') ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      r.currentPhcYear.includes('2') ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      'bg-violet-50 text-violet-700 border-violet-200')}>
                      {r.currentPhcYear.replace(' (Current)', '')} <span className="ml-1 text-[9px] opacity-70">(Current)</span>
                    </span>
                  </td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap font-bold text-slate-800 text-xs">{r.phcYearStartDate}</td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap">
                    <p className="text-slate-800 font-bold text-xs">{r.phcYearEndDate}</p>
                    {r.daysRemaining > 0 && <p className={clsx('text-[10px] font-bold', r.daysRemaining <= 30 ? 'text-rose-500' : 'text-slate-400')}>{r.daysRemaining} Days Remaining</p>}
                  </td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap"><StatusBadge status={r.phcStatus} /></td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap font-black text-slate-900 text-xs">{fmtCurr(r.eligibleAmount)}</td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap font-extrabold text-slate-900 text-xs">{fmtCurr(r.utilizedAmount)}</td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap font-black text-emerald-700 text-xs">{fmtCurr(r.balanceAmount)}</td>
                  <td className="px-3 py-3 border border-slate-200 whitespace-nowrap text-right" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setDrawerRecord(r)} className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 cursor-pointer transition-colors" title="View PHC Details">
                      <Eye size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/30 flex-wrap gap-2">
          <span className="text-xs text-slate-400 font-semibold">
            Showing {Math.min(1, activeTab === 'dependencies' ? dependenciesData.length : filteredData.length)} to {Math.min(currentPage * rowsPerPage, activeTab === 'dependencies' ? dependenciesData.length : filteredData.length)} of {activeTab === 'dependencies' ? dependenciesData.length : filteredData.length} entries
          </span>
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"><ChevronLeft size={13} /></button>
            {Array.from({ length: Math.min(4, totalPages) }, (_, i) => i + 1).map(p => (
              <button key={p} type="button" onClick={() => setCurrentPage(p)}
                className={clsx('px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all', currentPage === p ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-600')}>{p}</button>
            ))}
            {totalPages > 4 && <span className="text-xs text-slate-400 px-1">...</span>}
            <button type="button" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-40"><ChevronRight size={13} /></button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold">Rows per page</span>
            <div className="relative">
              <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="bg-white border border-slate-200 rounded-lg pl-2 pr-6 py-1 text-xs font-bold text-slate-700 outline-none cursor-pointer appearance-none">
                {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Drawer */}
      {drawerRecord && <PhcDrawer record={drawerRecord} onClose={() => setDrawerRecord(null)} />}
    </div>
  );
}
