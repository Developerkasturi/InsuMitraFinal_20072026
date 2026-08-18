import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Shield, FileText, TrendingUp, DollarSign, AlertCircle,
  RefreshCw, Plus, Calendar, ChevronRight, CheckCircle,
  Clock, UserPlus, Briefcase, PhoneCall, Star, Award, Settings,
  BarChart2, Activity
} from 'lucide-react';
import { format, isToday, isTomorrow, differenceInDays } from 'date-fns';
import {
  useDashboardKpis, useDashboardRevenue, useDashboardPortfolio,
  useDashboardPipeline, useDashboardDbSummary
} from '@hooks/useDashboard';
import { useClaims } from '@hooks/useClaims';
import { LineChartWidget, PieChartWidget, BarChartWidget, CoverageBarChartWidget } from '@comps/common/Charts';
import { SkeletonCard, SkeletonChart, SkeletonTable } from '@comps/common/Skeleton';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@store/auth.store';
import { claimsService, employeesService } from '@api/index';
import clsx from 'clsx';

// ── Dashboard Mock Data ──────────────────────────────────────────────────────
const MOCK_ACTIVE_POLICIES = [
  { name: 'Health Insurance', value: 450 },
  { name: 'Life Insurance', value: 310 },
  { name: 'General Insurance', value: 240 },
];

const MOCK_CONTACTS = { head: 850, dependent: 1240, total: 2090 };

const MOCK_PREMIUM_BY_PLAN = [
  { name: 'Health', value: 4500000 },
  { name: 'Accident', value: 850000 },
  { name: 'Critical Illness', value: 1200000 },
  { name: 'Group Health', value: 3500000 },
  { name: 'Group PA', value: 950000 },
  { name: 'SME Health', value: 2800000 },
  { name: 'Term Life', value: 5200000 },
  { name: 'TULIP', value: 1800000 },
  { name: 'ULIP', value: 3200000 },
  { name: 'Endowment', value: 4100000 },
  { name: 'Moneyback', value: 2100000 },
  { name: 'Business', value: 1500000 },
  { name: 'MF', value: 2900000 },
  { name: 'Other', value: 650000 },
];

const MOCK_PERSONS_COVERED = [
  { name: 'Health', value: 80, total: 100 },
  { name: 'Term', value: 40, total: 100 },
  { name: 'Life', value: 65, total: 100 },
  { name: 'General', value: 45, total: 100 },
  { name: 'Other', value: 20, total: 100 },
];

const MOCK_MF_LEADS = {
  activeSipAmount: 150000,
  lumpsumAmount: 500000,
  investors: 120,
  activeSips: 85
};

const MOCK_BUSINESS_CATEGORY_WISE = [
  { month: 'Jan', health: 420000, accident: 120000, critical: 180000, groupHealth: 300000, groupPa: 150000, sme: 200000, termLife: 250000, tulip: 100000, ulip: 220000, endowment: 310000, moneyback: 190000, business: 140000, mf: 280000, other: 90000 },
  { month: 'Feb', health: 380000, accident: 140000, critical: 200000, groupHealth: 320000, groupPa: 160000, sme: 210000, termLife: 270000, tulip: 110000, ulip: 240000, endowment: 330000, moneyback: 200000, business: 150000, mf: 290000, other: 80000 },
  { month: 'Mar', health: 510000, accident: 160000, critical: 230000, groupHealth: 350000, groupPa: 180000, sme: 240000, termLife: 320000, tulip: 140000, ulip: 280000, endowment: 380000, moneyback: 230000, business: 180000, mf: 320000, other: 110000 },
  { month: 'Apr', health: 450000, accident: 150000, critical: 210000, groupHealth: 330000, groupPa: 170000, sme: 220000, termLife: 290000, tulip: 120000, ulip: 260000, endowment: 350000, moneyback: 210000, business: 160000, mf: 300000, other: 100000 },
  { month: 'May', health: 470000, accident: 155000, critical: 220000, groupHealth: 340000, groupPa: 175000, sme: 230000, termLife: 300000, tulip: 130000, ulip: 270000, endowment: 360000, moneyback: 220000, business: 170000, mf: 310000, other: 105000 },
  { month: 'Jun', health: 490000, accident: 165000, critical: 240000, groupHealth: 360000, groupPa: 185000, sme: 250000, termLife: 330000, tulip: 150000, ulip: 290000, endowment: 390000, moneyback: 240000, business: 190000, mf: 330000, other: 115000 },
  { month: 'Jul', health: 430000, accident: 145000, critical: 190000, groupHealth: 310000, groupPa: 155000, sme: 205000, termLife: 260000, tulip: 105000, ulip: 230000, endowment: 320000, moneyback: 195000, business: 145000, mf: 285000, other: 85000 },
  { month: 'Aug', health: 460000, accident: 150000, critical: 215000, groupHealth: 335000, groupPa: 170000, sme: 225000, termLife: 295000, tulip: 125000, ulip: 265000, endowment: 355000, moneyback: 215000, business: 165000, mf: 305000, other: 100000 },
  { month: 'Sep', health: 500000, accident: 170000, critical: 250000, groupHealth: 370000, groupPa: 190000, sme: 260000, termLife: 340000, tulip: 160000, ulip: 300000, endowment: 400000, moneyback: 250000, business: 200000, mf: 340000, other: 120000 },
  { month: 'Oct', health: 530000, accident: 180000, critical: 270000, groupHealth: 390000, groupPa: 200000, sme: 280000, termLife: 370000, tulip: 170000, ulip: 320000, endowment: 430000, moneyback: 270000, business: 220000, mf: 360000, other: 130000 },
  { month: 'Nov', health: 480000, accident: 160000, critical: 230000, groupHealth: 350000, groupPa: 180000, sme: 240000, termLife: 310000, tulip: 140000, ulip: 280000, endowment: 370000, moneyback: 230000, business: 180000, mf: 320000, other: 110000 },
  { month: 'Dec', health: 580000, accident: 200000, critical: 300000, groupHealth: 420000, groupPa: 220000, sme: 310000, termLife: 420000, tulip: 200000, ulip: 360000, endowment: 480000, moneyback: 300000, business: 250000, mf: 400000, other: 150000 },
];

const BUSINESS_CATEGORY_BARS = [
  { key: 'health', label: 'Health', stackId: 'a', color: '#1e40af' }, // Blue 800
  { key: 'accident', label: 'Accident', stackId: 'a', color: '#2563eb' }, // Blue 600
  { key: 'critical', label: 'Critical Illness', stackId: 'a', color: '#60a5fa' }, // Blue 400
  { key: 'groupHealth', label: 'Group Health', stackId: 'a', color: '#0f766e' }, // Teal 700
  { key: 'groupPa', label: 'Group PA', stackId: 'a', color: '#0d9488' }, // Teal 600
  { key: 'sme', label: 'SME Health', stackId: 'a', color: '#2dd4bf' }, // Teal 400
  { key: 'termLife', label: 'Term Life', stackId: 'a', color: '#4338ca' }, // Indigo 700
  { key: 'tulip', label: 'TULIP', stackId: 'a', color: '#6366f1' }, // Indigo 500
  { key: 'ulip', label: 'ULIP', stackId: 'a', color: '#818cf8' }, // Indigo 400
  { key: 'endowment', label: 'Endowment', stackId: 'a', color: '#0f172a' }, // Slate 900
  { key: 'moneyback', label: 'Moneyback', stackId: 'a', color: '#334155' }, // Slate 700
  { key: 'business', label: 'Business', stackId: 'a', color: '#64748b' }, // Slate 500
  { key: 'mf', label: 'MF', stackId: 'a', color: '#0369a1' }, // Sky 700
  { key: 'other', label: 'Other', stackId: 'a', color: '#0ea5e9' }, // Sky 500
];

const MOCK_BUSINESS_COMPANY_WISE = [
  { month: 'Jan', 'HDFC Life': 320000, 'LIC': 450000, 'Star Health': 180000, 'SBI Life': 280000, 'Max Life': 150000 },
  { month: 'Feb', 'HDFC Life': 340000, 'LIC': 470000, 'Star Health': 190000, 'SBI Life': 290000, 'Max Life': 160000 },
  { month: 'Mar', 'HDFC Life': 420000, 'LIC': 550000, 'Star Health': 250000, 'SBI Life': 380000, 'Max Life': 220000 },
  { month: 'Apr', 'HDFC Life': 310000, 'LIC': 430000, 'Star Health': 170000, 'SBI Life': 260000, 'Max Life': 140000 },
  { month: 'May', 'HDFC Life': 330000, 'LIC': 460000, 'Star Health': 185000, 'SBI Life': 275000, 'Max Life': 155000 },
  { month: 'Jun', 'HDFC Life': 350000, 'LIC': 480000, 'Star Health': 195000, 'SBI Life': 295000, 'Max Life': 165000 },
  { month: 'Jul', 'HDFC Life': 300000, 'LIC': 410000, 'Star Health': 160000, 'SBI Life': 250000, 'Max Life': 135000 },
  { month: 'Aug', 'HDFC Life': 340000, 'LIC': 465000, 'Star Health': 180000, 'SBI Life': 285000, 'Max Life': 150000 },
  { month: 'Sep', 'HDFC Life': 380000, 'LIC': 500000, 'Star Health': 210000, 'SBI Life': 320000, 'Max Life': 180000 },
  { month: 'Oct', 'HDFC Life': 410000, 'LIC': 540000, 'Star Health': 240000, 'SBI Life': 360000, 'Max Life': 200000 },
  { month: 'Nov', 'HDFC Life': 390000, 'LIC': 510000, 'Star Health': 220000, 'SBI Life': 340000, 'Max Life': 190000 },
  { month: 'Dec', 'HDFC Life': 500000, 'LIC': 650000, 'Star Health': 300000, 'SBI Life': 450000, 'Max Life': 280000 },
];

const COMPANY_LINES = [
  { key: 'HDFC Life', label: 'HDFC Life', color: '#1e40af' }, // Blue 800
  { key: 'LIC', label: 'LIC', color: '#0f766e' }, // Teal 700
  { key: 'Star Health', label: 'Star Health', color: '#4338ca' }, // Indigo 700
  { key: 'SBI Life', label: 'SBI Life', color: '#0369a1' }, // Sky 700
  { key: 'Max Life', label: 'Max Life', color: '#0f172a' }, // Slate 900
];

const MOCK_TENURE_WISE = [
  { month: 'Jan', year1: 120, year2: 45, year3: 30, year4: 10, year5: 5 },
  { month: 'Feb', year1: 110, year2: 50, year3: 25, year4: 12, year5: 4 },
  { month: 'Mar', year1: 140, year2: 60, year3: 35, year4: 15, year5: 8 },
  { month: 'Apr', year1: 105, year2: 40, year3: 20, year4: 8,  year5: 3 },
  { month: 'May', year1: 115, year2: 48, year3: 28, year4: 11, year5: 6 },
  { month: 'Jun', year1: 125, year2: 55, year3: 32, year4: 14, year5: 7 },
  { month: 'Jul', year1: 95,  year2: 38, year3: 18, year4: 7,  year5: 2 },
  { month: 'Aug', year1: 108, year2: 42, year3: 22, year4: 9,  year5: 4 },
  { month: 'Sep', year1: 130, year2: 58, year3: 34, year4: 16, year5: 9 },
  { month: 'Oct', year1: 145, year2: 65, year3: 40, year4: 18, year5: 10 },
  { month: 'Nov', year1: 118, year2: 52, year3: 29, year4: 13, year5: 5 },
  { month: 'Dec', year1: 160, year2: 75, year3: 45, year4: 22, year5: 12 },
];

const TENURE_BARS = [
  { key: 'year1', label: '1 Year', stackId: 'a', color: '#3b82f6' }, // blue-500
  { key: 'year2', label: '2 Years', stackId: 'a', color: '#10b981' }, // emerald-500
  { key: 'year3', label: '3 Years', stackId: 'a', color: '#f59e0b' }, // amber-500
  { key: 'year4', label: '4 Years', stackId: 'a', color: '#8b5cf6' }, // violet-500
  { key: 'year5', label: '5 Years', stackId: 'a', color: '#ec4899' }, // pink-500
];

const MOCK_LEADS_STATUS_WISE = [
  { stage: 'To Contact', hot: 25, warm: 40, cold: 60, dropped: 10, converted: 0 },
  { stage: 'Contacted', hot: 35, warm: 50, cold: 40, dropped: 15, converted: 0 },
  { stage: 'Proposal Sent', hot: 45, warm: 30, cold: 20, dropped: 5, converted: 0 },
  { stage: 'Login Progress', hot: 55, warm: 20, cold: 10, dropped: 2, converted: 0 },
  { stage: 'Payment Done', hot: 60, warm: 10, cold: 5, dropped: 1, converted: 80 },
];

const LEAD_STATUS_BARS = [
  { key: 'hot', label: 'Hot', stackId: 'status', color: '#ef4444' }, // red
  { key: 'warm', label: 'Warm', stackId: 'status', color: '#f59e0b' }, // amber
  { key: 'cold', label: 'Cold', stackId: 'status', color: '#3b82f6' }, // blue
  { key: 'converted', label: 'Converted', stackId: 'status', color: '#10b981' }, // emerald
  { key: 'dropped', label: 'Dropped', stackId: 'status', color: '#64748b' }, // slate
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n?: number) {
  if (n === undefined || n === null) return '—';
  return n.toLocaleString('en-IN');
}

function fmtINR(n?: number) {
  if (n === undefined || n === null) return '—';
  return `₹${n.toLocaleString('en-IN')}`;
}

function getClaimNotesData(notesField?: string | null) {
  if (!notesField) return { hospital: '', diagnosis: '' };
  try {
    if (notesField.trim().startsWith('{')) {
      const parsed = JSON.parse(notesField);
      return {
        hospital: parsed.hospital || '',
        diagnosis: parsed.diagnosis || '',
      };
    }
  } catch (e) {
    // ignore
  }
  return { hospital: '', diagnosis: notesField || '' };
}

// ── Section header inside cards ──────────────────────────────────────────────
function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-xs font-bold text-gray-900 tracking-wider uppercase">{title}</h3>
      {action && (
        <button
          onClick={onAction}
          className="text-[10px] sm:text-xs text-blue-600 hover:text-blue-700 font-bold transition-colors cursor-pointer"
        >
          {action}
        </button>
      )}
    </div>
  );
}

// ── New Premium KPI Card to match the mockup ─────────────────────────────────
interface KpiCardProps {
  label: string;
  value: string | number;
  trend: string;
  trendUp?: boolean;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
}

function PremiumKpiCard({ label, value, trend, trendUp = true, icon, color, onClick }: KpiCardProps) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        "bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between h-32 relative overflow-hidden group",
        onClick && "cursor-pointer hover:border-blue-200 hover:shadow-lg active:scale-[0.98]"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-gray-400 tracking-wide">{label}</span>
          <span className="text-2xl font-extrabold text-gray-900 tracking-tight mt-1">{value}</span>
        </div>
        <div className={clsx('h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-110', color)}>
          {icon}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1 text-[11px] mt-2 font-medium">
        <span className={clsx(trendUp ? 'text-green-600' : 'text-red-500')}>
          {trendUp ? '▲' : '▼'} {trend}
        </span>
        <span className="text-gray-400">vs last month</span>
      </div>
    </div>
  );
}

// ── Contacts Breakdown Indicator Card ─────────────────────────────────────────
function ContactsBreakdownCard({ data }: { data: { head: number, dependent: number, total: number } }) {
  const headPct = ((data.head / data.total) * 100).toFixed(0);
  const depPct = ((data.dependent / data.total) * 100).toFixed(0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm h-full flex flex-col justify-between group hover:shadow-md transition-all">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-gray-900 tracking-wider uppercase">Total Contacts</h3>
          <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users size={16} />
          </div>
        </div>
        
        <div className="mb-4">
          <span className="text-3xl font-extrabold text-gray-900">{fmt(data.total)}</span>
          <p className="text-[10px] font-semibold text-gray-400 mt-1 uppercase tracking-wide">Total registered contacts</p>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-[11px] font-bold text-gray-700 mb-1.5">
              <span className="flex flex-wrap items-center gap-1.5"><UserPlus size={13} className="text-blue-500"/> Head of Family</span>
              <span>{fmt(data.head)} ({headPct}%)</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${headPct}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[11px] font-bold text-gray-700 mb-1.5">
              <span className="flex flex-wrap items-center gap-1.5"><Users size={13} className="text-amber-500"/> Dependents</span>
              <span>{fmt(data.dependent)} ({depPct}%)</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${depPct}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MF Leads Business Summary Card ──────────────────────────────────────────
function MfLeadsSummaryCard({ data }: { data: any }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm h-full flex flex-col justify-between group hover:shadow-md transition-all">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-gray-900 tracking-wider uppercase">MF Leads Business</h3>
          <div className="h-8 w-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
            <TrendingUp size={16} />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Active SIP Amt</p>
            <p className="text-base font-extrabold text-slate-900 mt-1">{fmtINR(data.activeSipAmount)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Lumpsum Amt</p>
            <p className="text-base font-extrabold text-slate-900 mt-1">{fmtINR(data.lumpsumAmount)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">No. of Investors</p>
            <p className="text-base font-extrabold text-slate-900 mt-1">{data.investors}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">No. of Active SIPs</p>
            <p className="text-base font-extrabold text-slate-900 mt-1">{data.activeSips}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Leads Progress Indicator Card ────────────────────────────────────────────
function LeadsProgressIndicator({ pipelineData }: { pipelineData: any[] }) {
  const stagesOrder = ['TO_CONTACT', 'CONTACTED', 'PROPOSAL_SENT', 'LOGIN_PROGRESS', 'PAYMENT_DONE', 'PROCESS_COMPLETED'];
  const stageColors: Record<string, string> = {
    TO_CONTACT: 'bg-blue-500',
    CONTACTED: 'bg-indigo-500',
    PROPOSAL_SENT: 'bg-purple-500',
    LOGIN_PROGRESS: 'bg-orange-500',
    PAYMENT_DONE: 'bg-green-500',
    PROCESS_COMPLETED: 'bg-emerald-500',
  };
  const stageLabels: Record<string, string> = {
    TO_CONTACT: 'To Contact',
    CONTACTED: 'Contacted',
    PROPOSAL_SENT: 'Proposal Sent',
    LOGIN_PROGRESS: 'Login Progress',
    PAYMENT_DONE: 'Payment Done',
    PROCESS_COMPLETED: 'Process Completed',
  };

  const totalActiveLeads = pipelineData
    .filter(p => stagesOrder.includes(p.stage))
    .reduce((acc, curr) => acc + (curr.count || 0), 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-gray-900 tracking-wider uppercase">Leads Progress Indicator</h3>
          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
            {totalActiveLeads} Active Leads
          </span>
        </div>
        <div className="space-y-3.5">
          {stagesOrder.map(stage => {
            const data = pipelineData.find(p => p.stage === stage);
            const count = data?.count || 0;
            const percentage = totalActiveLeads > 0 ? (count / totalActiveLeads) * 100 : 0;
            return (
              <div key={stage} className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold text-gray-700">
                  <span>{stageLabels[stage]}</span>
                  <span className="font-bold">{count} ({percentage.toFixed(0)}%)</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className={clsx("h-1.5 rounded-full transition-all duration-500", stageColors[stage] || 'bg-blue-500')}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Avg Sum Insured Card (Gen + Health) ──────────────────────────────────────
function AvgSumInsuredGenHealthCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm h-full flex flex-col justify-between group hover:shadow-md transition-all">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-gray-900 tracking-wider uppercase">Avg Sum Insured (Gen + Health)</h3>
          <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Shield size={16} />
          </div>
        </div>
        <p className="text-[10px] text-gray-400 font-semibold mb-4">Total basic sum insured divided by insured persons.</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-50">
            <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-wide">Fresh</p>
            <p className="text-sm font-black text-indigo-900 mt-1">₹8.5L</p>
          </div>
          <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-50">
            <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-wide">Port</p>
            <p className="text-sm font-black text-emerald-900 mt-1">₹10.2L</p>
          </div>
          <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-50">
            <p className="text-[9px] font-bold text-amber-500 uppercase tracking-wide">Renewal</p>
            <p className="text-sm font-black text-amber-900 mt-1">₹12.5L</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Avg Sum Insured Card (Term) ─────────────────────────────────────────────
function AvgSumInsuredTermCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm h-full flex flex-col justify-between group hover:shadow-md transition-all">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-gray-900 tracking-wider uppercase">Avg Sum Insured (Term)</h3>
          <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <Shield size={16} />
          </div>
        </div>
        <p className="text-[10px] text-gray-400 font-semibold mb-4">Total sum insured divided by insured persons.</p>
        <div className="mt-2">
          <span className="text-3xl font-black text-gray-900">₹1.5 Cr</span>
          <p className="text-[10px] font-bold text-emerald-600 mt-2 bg-emerald-50 inline-block px-2 py-0.5 rounded border border-emerald-100">
            High coverage maintained
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Database Summary Status Table Card ───────────────────────────────────────
function DatabaseSummary({ summaryData }: { summaryData: any }) {
  if (!summaryData) return null;

  const { policies = [], contacts = 0, claims = [], leads = 0, tasks = [] } = summaryData;

  const policyActive = policies.find((p: any) => p.status === 'ACTIVE')?.count || 0;
  const policyLapsed = policies.find((p: any) => p.status === 'LAPSED')?.count || 0;
  const policyExpired = policies.find((p: any) => p.status === 'EXPIRED')?.count || 0;
  const policyCancelled = policies.find((p: any) => p.status === 'CANCELLED')?.count || 0;
  const policyTotal = policies.reduce((acc: number, curr: any) => acc + (curr.count || 0), 0);

  const claimPending = claims.filter((c: any) => ['INTIMATED', 'DOC_COLLECTION', 'FILED'].includes(c.status)).reduce((acc: number, curr: any) => acc + (curr.count || 0), 0);
  const claimInProgress = claims.filter((c: any) => c.status === 'IN_REVIEW').reduce((acc: number, curr: any) => acc + (curr.count || 0), 0);
  const claimSettled = claims.filter((c: any) => c.status === 'SETTLED').reduce((acc: number, curr: any) => acc + (curr.count || 0), 0);
  const claimRejected = claims.filter((c: any) => c.status === 'REJECTED').reduce((acc: number, curr: any) => acc + (curr.count || 0), 0);
  const claimTotal = claims.reduce((acc: number, curr: any) => acc + (curr.count || 0), 0);

  const taskPending = tasks.find((t: any) => t.status === 'PENDING')?.count || 0;
  const taskInProgress = tasks.find((t: any) => t.status === 'IN_PROGRESS')?.count || 0;
  const taskCompleted = tasks.find((t: any) => t.status === 'COMPLETED')?.count || 0;
  const taskTotal = tasks.reduce((acc: number, curr: any) => acc + (curr.count || 0), 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-gray-900 tracking-wider uppercase">Database Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-gray-700">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100 text-gray-500 font-bold uppercase tracking-wider">
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Total Count</th>
                <th className="px-4 py-2">Breakdown status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-medium">
              <tr className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-semibold text-gray-950">Policies</td>
                <td className="px-4 py-3 font-bold text-blue-600">{policyTotal}</td>
                <td className="px-4 py-3 text-gray-500">
                  <span className="text-emerald-600 font-semibold">{policyActive} Active</span> •{' '}
                  <span className="text-amber-500">{policyLapsed} Lapsed</span> •{' '}
                  <span>{policyExpired} Expired</span> •{' '}
                  <span className="text-red-500">{policyCancelled} Cancelled</span>
                </td>
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-semibold text-gray-950">Contacts / Leads</td>
                <td className="px-4 py-3 font-bold text-indigo-600">{contacts}</td>
                <td className="px-4 py-3 text-gray-500">
                  <span className="text-indigo-600 font-semibold">{leads} Interest Leads</span> •{' '}
                  <span>{contacts - leads > 0 ? contacts - leads : 0} General Contacts</span>
                </td>
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-semibold text-gray-950">Claims</td>
                <td className="px-4 py-3 font-bold text-red-500">{claimTotal}</td>
                <td className="px-4 py-3 text-gray-500">
                  <span className="text-blue-500 font-semibold">{claimPending} Pending</span> •{' '}
                  <span className="text-amber-500">{claimInProgress} In-Progress</span> •{' '}
                  <span className="text-emerald-600 font-semibold">{claimSettled} Settled</span> •{' '}
                  <span className="text-red-500">{claimRejected} Rejected</span>
                </td>
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-semibold text-gray-950">Tasks</td>
                <td className="px-4 py-3 font-bold text-purple-600">{taskTotal}</td>
                <td className="px-4 py-3 text-gray-500">
                  <span className="text-blue-500">{taskPending} Pending</span> •{' '}
                  <span className="text-amber-500">{taskInProgress} In-Progress</span> •{' '}
                  <span className="text-emerald-600 font-semibold">{taskCompleted} Completed</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Claims Reports Panel Component ───────────────────────────────────────────
function ClaimsReportsTab() {
  const { data: claimsRes, isLoading: claimsLoading } = useClaims({ page: 1, limit: 1000 });
  const claims = claimsRes?.data ?? [];

  const [duration, setDuration] = useState('ALL');
  const [selectedCompany, setSelectedCompany] = useState('ALL');
  const [hospitalQuery, setHospitalQuery] = useState('');
  const [claimType, setClaimType] = useState('ALL');
  const [graphCompanySelect, setGraphCompanySelect] = useState('ALL');
  const [pieChartMetric, setPieChartMetric] = useState<'count' | 'claimed' | 'settled'>('count');

  // Extract unique companies for filter dropdown
  const companies = useMemo(() => {
    const set = new Set<string>();
    claims.forEach((c: any) => {
      const name = c.policy?.plan?.company?.name;
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [claims]);

  // Filter claims
  const filteredClaims = useMemo(() => {
    return claims.filter((c: any) => {
      // Filter by Type (Cashless vs Reimbursement vs others)
      if (claimType !== 'ALL') {
        const typeMatch = (c.claimType || '').toUpperCase() === claimType.toUpperCase();
        if (!typeMatch) return false;
      }
      
      // Filter by Company
      if (selectedCompany !== 'ALL') {
        const comp = c.policy?.plan?.company?.name;
        if (comp !== selectedCompany) return false;
      }

      // Filter by Hospital
      if (hospitalQuery.trim()) {
        const notesData = getClaimNotesData(c.notes);
        const hospName = (notesData.hospital || '').toLowerCase();
        if (!hospName.includes(hospitalQuery.toLowerCase())) return false;
      }

      // Filter by Duration
      if (duration !== 'ALL') {
        const date = c.intimatedAt ? new Date(c.intimatedAt) : new Date(c.createdAt);
        const daysDiff = differenceInDays(new Date(), date);
        if (duration === '30' && daysDiff > 30) return false;
        if (duration === '90' && daysDiff > 90) return false;
        if (duration === '365' && daysDiff > 365) return false;
      }

      return true;
    });
  }, [claims, claimType, selectedCompany, hospitalQuery, duration]);

  // Compute stats
  const stats = useMemo(() => {
    let totalCount = filteredClaims.length;
    let claimedSum = 0;
    let settledSum = 0;

    filteredClaims.forEach((c: any) => {
      claimedSum += Number(c.claimAmount || 0);
      // APPROVED & SETTLED count as payouts
      if (c.status === 'SETTLED' || c.status === 'APPROVED') {
        settledSum += Number(c.approvedAmount || c.claimAmount || 0);
      }
    });

    const ratio = claimedSum > 0 ? (settledSum / claimedSum) * 100 : 0;

    return {
      totalCount,
      claimedSum,
      settledSum,
      ratio
    };
  }, [filteredClaims]);

  // Graph Data 1: Company wise (Claimed vs Settled)
  const companyGraphData = useMemo(() => {
    const map = new Map<string, { company: string; claimed: number; settled: number }>();
    filteredClaims.forEach((c: any) => {
      const comp = c.policy?.plan?.company?.name || 'Other';
      const entry = map.get(comp) || { company: comp, claimed: 0, settled: 0 };
      entry.claimed += Number(c.claimAmount || 0);
      if (c.status === 'SETTLED' || c.status === 'APPROVED') {
        entry.settled += Number(c.approvedAmount || c.claimAmount || 0);
      }
      map.set(comp, entry);
    });
    
    const sorted = Array.from(map.values()).sort((a, b) => b.claimed - a.claimed);
    if (graphCompanySelect === 'ALL') {
      return sorted.slice(0, 5); // Default top 5
    }
    return sorted.filter(c => c.company === graphCompanySelect);
  }, [filteredClaims, graphCompanySelect]);

  // Graph Data 2: Cashless vs Reimburse
  const typeGraphData = useMemo(() => {
    const map = new Map<string, { count: number; claimed: number; settled: number }>();
    filteredClaims.forEach((c: any) => {
      const type = c.claimType || 'Unknown';
      const entry = map.get(type) || { count: 0, claimed: 0, settled: 0 };
      entry.count += 1;
      entry.claimed += Number(c.claimAmount || 0);
      if (c.status === 'SETTLED' || c.status === 'APPROVED') {
        entry.settled += Number(c.approvedAmount || c.claimAmount || 0);
      }
      map.set(type, entry);
    });
    return Array.from(map.entries()).map(([name, data]) => ({ name, ...data }));
  }, [filteredClaims]);

  // Graph Data 3: Hospital wise (Claims count)
  const hospitalGraphData = useMemo(() => {
    const map = new Map<string, number>();
    filteredClaims.forEach((c: any) => {
      const notesData = getClaimNotesData(c.notes);
      const hosp = notesData.hospital || 'Direct Clinic/Other';
      map.set(hosp, (map.get(hosp) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 hospitals
  }, [filteredClaims]);

  // Graph Data 4: Duration / Timeline (Claimed vs Settled)
  const timeGraphData = useMemo(() => {
    const map = new Map<string, { month: string; claimed: number; settled: number }>();
    const sorted = [...filteredClaims].sort((a: any, b: any) => {
      const da = a.intimatedAt ? new Date(a.intimatedAt) : new Date(a.createdAt);
      const db = b.intimatedAt ? new Date(b.intimatedAt) : new Date(b.createdAt);
      return da.getTime() - db.getTime();
    });

    sorted.forEach((c: any) => {
      const date = c.intimatedAt ? new Date(c.intimatedAt) : new Date(c.createdAt);
      const key = format(date, 'MMM yyyy');
      const entry = map.get(key) || { month: key, claimed: 0, settled: 0 };
      entry.claimed += Number(c.claimAmount || 0);
      if (c.status === 'SETTLED' || c.status === 'APPROVED') {
        entry.settled += Number(c.approvedAmount || c.claimAmount || 0);
      }
      map.set(key, entry);
    });

    return Array.from(map.values()).slice(-12); // Last 12 months
  }, [filteredClaims]);

  if (claimsLoading) {
    return (
      <div className="space-y-6">
        <SkeletonTable rows={4} cols={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Filters Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Duration</label>
          <select
            value={duration}
            onChange={e => setDuration(e.target.value)}
            className="w-full mt-1.5 py-1.5 px-3 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none font-bold text-gray-600"
          >
            <option value="ALL">All Time</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="365">This Year</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Insurance Company</label>
          <select
            value={selectedCompany}
            onChange={e => setSelectedCompany(e.target.value)}
            className="w-full mt-1.5 py-1.5 px-3 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none font-bold text-gray-600"
          >
            <option value="ALL">All Companies</option>
            {companies.map(comp => (
              <option key={comp} value={comp}>{comp}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Claim Type</label>
          <select
            value={claimType}
            onChange={e => setClaimType(e.target.value)}
            className="w-full mt-1.5 py-1.5 px-3 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none font-bold text-gray-600"
          >
            <option value="ALL">All Types</option>
            <option value="CASHLESS">Cashless</option>
            <option value="REIMBURSEMENT">Reimbursement</option>
            <option value="DEATH">Death</option>
            <option value="ACCIDENTAL">Accidental</option>
            <option value="MATURITY">Maturity</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Hospital Name</label>
          <input
            type="text"
            placeholder="Search hospital..."
            value={hospitalQuery}
            onChange={e => setHospitalQuery(e.target.value)}
            className="w-full mt-1.5 py-1.5 px-3 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none font-bold text-gray-600 placeholder-gray-400"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col justify-between h-28">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Total Claims</span>
          <span className="text-2xl font-black text-gray-900 mt-1">{stats.totalCount}</span>
          <span className="text-[10px] text-gray-400 font-semibold">Matching filtered criteria</span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col justify-between h-28">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Claimed Amount</span>
          <span className="text-2xl font-black text-gray-900 mt-1">₹{stats.claimedSum.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-gray-400 font-semibold">Sum of total claims</span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col justify-between h-28">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Settled Amount</span>
          <span className="text-2xl font-black text-emerald-600 mt-1">₹{stats.settledSum.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-gray-400 font-semibold">Total paid out amount</span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col justify-between h-28">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Settlement Ratio</span>
          <span className="text-2xl font-black text-blue-600 mt-1">{stats.ratio.toFixed(1)}%</span>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
            <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${Math.min(100, stats.ratio)}%` }} />
          </div>
        </div>
      </div>

      {/* Graphs Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="relative">
          <div className="absolute top-4 right-5 z-10 flex items-center gap-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Company:</label>
            <select
              value={graphCompanySelect}
              onChange={e => setGraphCompanySelect(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold rounded-lg px-2 py-1 outline-none cursor-pointer"
            >
              <option value="ALL">Top 5 Companies</option>
              {companies.map(comp => (
                <option key={comp} value={comp}>{comp}</option>
              ))}
            </select>
          </div>
          <BarChartWidget
            title="Claimed vs Settled Amount by Company (₹)"
            data={companyGraphData}
            xKey="company"
            bars={[
              { key: 'claimed', label: 'Claimed (₹)', color: '#3b82f6' },
              { key: 'settled', label: 'Settled (₹)', color: '#10b981' }
            ]}
          />
        </div>
        
        <LineChartWidget
          title="Claims Collection Trend over Time (₹)"
          data={timeGraphData}
          xKey="month"
          lines={[
            { key: 'claimed', label: 'Claimed (₹)', color: '#2563eb' },
            { key: 'settled', label: 'Settled (₹)', color: '#10b981' }
          ]}
        />

        <BarChartWidget
          title="Top Hospitals by Claim Count"
          data={hospitalGraphData}
          xKey="name"
          bars={[
            { key: 'value', label: 'Claims Count', color: '#f59e0b' }
          ]}
        />

        <div className="relative">
          <div className="absolute top-4 right-5 z-10 flex items-center gap-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Metric:</label>
            <select
              value={pieChartMetric}
              onChange={e => setPieChartMetric(e.target.value as any)}
              className="bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold rounded-lg px-2 py-1 outline-none cursor-pointer"
            >
              <option value="count">No. of Claims</option>
              <option value="claimed">Claimed Amount (₹)</option>
              <option value="settled">Settled Amount (₹)</option>
            </select>
          </div>
          <PieChartWidget
            title="Claims by Cashless / Reimbursement"
            data={typeGraphData}
            nameKey="name"
            valueKey={pieChartMetric}
          />
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard Page ──────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [revenueMonths, setRevenueMonths] = useState(12);
  const [portfolioView, setPortfolioView] = useState<'product' | 'company'>('product');
  const [activeTab, setActiveTab] = useState<'overview' | 'claims-reports'>('overview');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('ALL');
  const [leadsDateRange, setLeadsDateRange] = useState('ALL');
  const user = useAuthStore(s => s.user);

  // Queries
  const { data: kpiRes, isLoading: kpiLoading } = useDashboardKpis();
  const { data: revenueRes, isLoading: revenueLoading } = useDashboardRevenue(revenueMonths);
  const { data: portfolioRes, isLoading: portfolioLoading } = useDashboardPortfolio();
  const { data: pipelineRes, isLoading: pipelineLoading } = useDashboardPipeline();
  const { data: summaryRes, isLoading: summaryLoading } = useDashboardDbSummary();

  // Load claims and agents directly for the Overview sections
  const { data: claimsListRes, isLoading: claimsListLoading } = useQuery({
    queryKey: ['dashboard', 'recent-claims'],
    queryFn: () => claimsService.list({ limit: 5 }),
    staleTime: 5 * 60_000,
  });

  const { data: agentsRes, isLoading: agentsLoading } = useQuery({
    queryKey: ['dashboard', 'top-agents'],
    queryFn: () => employeesService.list({ limit: 5 }),
    staleTime: 5 * 60_000,
  });

  // Normalise KPIs
  const kpis = kpiRes?.data;
  const revenue = revenueRes?.data ?? [];

  // Normalize Portfolio to support both product (category) and company toggles
  const portfolio = useMemo(() => {
    const raw = portfolioRes?.data;
    if (!raw) return [];
    if (Array.isArray(raw)) {
      // Old backend array fallback
      return raw.map((r: any) => ({
        name: r.category ?? r.name,
        value: r.count ?? r.value,
      }));
    }
    // New backend object format
    if (portfolioView === 'product') {
      return (raw.byProduct ?? []).map((r: any) => ({ name: r.name, value: r.value }));
    } else {
      return (raw.byCompany ?? []).map((r: any) => ({ name: r.name, value: r.value }));
    }
  }, [portfolioRes, portfolioView]);

  const pipelineData = pipelineRes?.data ?? [];
  const summaryData = summaryRes?.data ?? summaryRes;
  const claims = claimsListRes?.data ?? [];
  const agents = agentsRes?.data ?? [];

  const handleRefreshAll = () => {
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['claims'] });
    qc.invalidateQueries({ queryKey: ['employees'] });
  };

  return (
    <div className="space-y-6">
      {/* ── Welcome Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            Good morning, {user?.firstName ?? 'User'}! 👋
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Here's what's happening with your insurance business today.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefreshAll}
            className="btn-secondary h-9 py-0 px-3 text-[10px] sm:text-xs flex flex-wrap items-center gap-1.5 font-bold"
          >
            <RefreshCw size={13} className={kpiLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => navigate('/policies?action=new')}
            className="btn-primary h-9 py-0 px-3 text-xs flex flex-wrap items-center gap-1.5 font-bold"
          >
            <Plus size={13} />
            New Policy
          </button>
        </div>
      </div>

      {/* ── Tab Switcher ────────────────────────────────────────────────────── */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={clsx(
            "py-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer",
            activeTab === 'overview'
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200"
          )}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('claims-reports')}
          className={clsx(
            "py-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer",
            activeTab === 'claims-reports'
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200"
          )}
        >
          Claims Reports & Analytics
        </button>
      </div>

      {activeTab === 'claims-reports' ? (
        <ClaimsReportsTab />
      ) : (
        <div className="space-y-6 animate-fadeIn">
          {/* ── Top KPI Cards Grid ───────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {kpiLoading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              <>
                <PremiumKpiCard
                  label="Total Policies"
                  value={fmt(kpis?.activePolicies)}
                  trend="12.5%"
                  trendUp={true}
                  icon={<Shield size={18} className="text-blue-600" />}
                  color="bg-blue-50"
                  onClick={() => navigate('/policies')}
                />
                <PremiumKpiCard
                  label="Active Leads"
                  value={fmt(kpis?.openLeads)}
                  trend="10.2%"
                  trendUp={true}
                  icon={<TrendingUp size={18} className="text-amber-600" />}
                  color="bg-amber-50"
                  onClick={() => navigate('/leads')}
                />
                <PremiumKpiCard
                  label="Total Premium"
                  value={fmtINR(kpis?.monthlyPremium)}
                  trend="15.6%"
                  trendUp={true}
                  icon={<DollarSign size={18} className="text-indigo-600" />}
                  color="bg-indigo-50"
                  onClick={() => navigate('/policies')}
                />
                <PremiumKpiCard
                  label="Open Claims"
                  value={fmt(kpis?.openClaims)}
                  trend="4.3%"
                  trendUp={false}
                  icon={<FileText size={18} className="text-red-500" />}
                  color="bg-red-50"
                  onClick={() => navigate('/claims')}
                />
                <PremiumKpiCard
                  label="Pending Tasks"
                  value={fmt(kpis?.pendingTasks)}
                  trend="8.3%"
                  trendUp={true}
                  icon={<CheckCircle size={18} className="text-purple-600" />}
                  color="bg-purple-50"
                  onClick={() => navigate('/workspace')}
                />
              </>
            )}
          </div>

          {/* ── Info Charts (Mocked) ─────────────────────────────────────────── */}
          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2">
              <BarChartWidget
                title="Premium by Insurance Plan Category"
                data={MOCK_PREMIUM_BY_PLAN}
                xKey="name"
                bars={[{ key: 'value', label: 'Premium (₹)', color: '#10b981' }]}
                className="h-full flex flex-col justify-center"
                height={350}
              />
            </div>
            <div className="lg:col-span-1 flex flex-col gap-6">
              <div className="flex-1">
                <ContactsBreakdownCard data={MOCK_CONTACTS} />
              </div>
              <div className="flex-1">
                <PieChartWidget
                  title="Active Policies by Category"
                  data={MOCK_ACTIVE_POLICIES}
                  nameKey="name"
                  valueKey="value"
                />
              </div>
            </div>
          </div>

          {/* ── Mid-section: Chart + Portfolio Donut ─────────────────────────── */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Line Chart */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm relative">
              <div className="absolute right-5 top-5 z-10 flex flex-wrap items-center gap-2">
                <select
                  value={revenueMonths}
                  onChange={e => setRevenueMonths(Number(e.target.value))}
                  className="py-1 px-2.5 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none font-bold text-gray-600"
                >
                  <option value={3}>This Quarter</option>
                  <option value={6}>Last 6 Months</option>
                  <option value={12}>This Year</option>
                </select>
              </div>
              {revenueLoading ? (
                <SkeletonChart height={240} />
              ) : (
                <LineChartWidget
                  title="Premium Collection"
                  data={revenue}
                  xKey="month"
                  lines={[{ key: 'revenue', label: 'Premium (₹)', color: '#2563eb' }]}
                />
              )}
            </div>

            {/* Pie Chart with Product/Company view toggle */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm relative">
              <div className="absolute right-5 top-5 z-10 flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setPortfolioView('product')}
                  className={clsx(
                    "px-2 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer",
                    portfolioView === 'product'
                      ? "bg-blue-50 text-blue-600 border border-blue-200"
                      : "text-gray-400 bg-gray-50 hover:bg-gray-100 border border-transparent"
                  )}
                >
                  Product
                </button>
                <button
                  onClick={() => setPortfolioView('company')}
                  className={clsx(
                    "px-2 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer",
                    portfolioView === 'company'
                      ? "bg-blue-50 text-blue-600 border border-blue-200"
                      : "text-gray-400 bg-gray-50 hover:bg-gray-100 border border-transparent"
                  )}
                >
                  Company
                </button>
              </div>
              {portfolioLoading ? (
                <SkeletonChart height={240} />
              ) : (
                <PieChartWidget
                  title={`Portfolio by ${portfolioView === 'product' ? 'Product Type' : 'Insurance Company'}`}
                  data={portfolio}
                  nameKey="name"
                  valueKey="value"
                />
              )}
            </div>
          </div>

          {/* ── Mid-section 2: Leads Progress Indicator + Database Summary ────── */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              {pipelineLoading ? (
                <SkeletonCard />
              ) : (
                <LeadsProgressIndicator pipelineData={pipelineData} />
              )}
            </div>
            <div className="lg:col-span-2">
              {summaryLoading ? (
                <SkeletonCard />
              ) : (
                <DatabaseSummary summaryData={summaryData} />
              )}
            </div>
          </div>

          {/* ── Bottom-section: Recent Claims + Top Performing Agents ────────── */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Recent Claims Table */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm overflow-hidden flex flex-col justify-between">
              <SectionHeader
                title="Recent Claims"
                action="View All"
                onAction={() => navigate('/claims')}
              />
              {claimsListLoading ? (
                <SkeletonTable rows={5} cols={5} />
              ) : claims.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <CheckCircle size={36} className="mb-2 opacity-35" />
                  <p className="text-sm font-medium">No recent claims found</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-5 -mb-5 mt-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/70 border-b border-gray-100">
                        {['Claim ID', 'Policy Holder', 'Policy Type', 'Amount', 'Status'].map(h => (
                          <th key={h} className="px-5 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {claims.slice(0, 5).map((c: any) => {
                        const client = c.policy?.contact ? `${c.policy.contact.firstName} ${c.policy.contact.lastName}` : 'Unknown';
                        const amount = Number(c.claimAmount ?? c.amount ?? 0);
                        return (
                          <tr key={c.id} className="hover:bg-blue-50/30 transition-colors">
                            <td className="px-5 py-3.5 font-semibold text-gray-950">{c.claimNumber ?? `CLM-${c.id.slice(-4).toUpperCase()}`}</td>
                            <td className="px-5 py-3.5 font-medium text-gray-700">{client}</td>
                            <td className="px-5 py-3.5 text-gray-600">{c.policy?.plan?.category ?? c.type ?? 'Insurance'}</td>
                            <td className="px-5 py-3.5 font-bold text-gray-800">₹{amount.toLocaleString('en-IN')}</td>
                            <td className="px-5 py-3.5">
                              <span className={clsx(
                                'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                                c.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                  c.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                                    'bg-blue-100 text-blue-700'
                              )}>
                                {c.status || 'PENDING'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Top Performing Agents */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col justify-between">
              <SectionHeader
                title="Top Performing Agents"
                action="View All"
                onAction={() => navigate('/employees')}
              />
              {agentsLoading ? (
                <SkeletonCard />
              ) : agents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Users size={32} className="mb-2 opacity-35" />
                  <p className="text-sm font-medium">No agents found</p>
                </div>
              ) : (
                <ul className="space-y-3.5 mt-2 flex-1">
                  {agents.slice(0, 4).map((a: any, idx: number) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-3 p-1 rounded-xl">
                      <span className="text-xs font-bold text-gray-400 w-4">{idx + 1}</span>
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">
                        {a.firstName?.[0] || ''}{a.lastName?.[0] || ''}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {a.firstName} {a.lastName}
                        </p>
                        <p className="text-[11px] text-gray-400 font-semibold">{a.designation || 'Sales Agent'}</p>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                        Active
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* ── Total Business Graph Category Wise ────────────────────────────── */}
          <div className="grid grid-cols-1 gap-6 mb-6">
            <BarChartWidget
              title="Total Business Graph Category Wise (Jan to Dec)"
              data={MOCK_BUSINESS_CATEGORY_WISE}
              xKey="month"
              bars={BUSINESS_CATEGORY_BARS}
            />
          </div>

          {/* ── Total Business Graph Company Wise ─────────────────────────────── */}
          <div className="grid grid-cols-1 gap-6 mb-6">
            <div className="card relative p-0 bg-transparent shadow-none border-none">
              <div className="absolute top-1 right-5 z-10 flex items-center gap-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Filter:</label>
                <select
                  value={selectedCompanyFilter}
                  onChange={e => setSelectedCompanyFilter(e.target.value)}
                  className="bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold rounded-lg px-2 py-1 outline-none cursor-pointer"
                >
                  <option value="ALL">All Companies</option>
                  {COMPANY_LINES.map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>
              <LineChartWidget
                title="Total Business Graph by Company (Jan to Dec)"
                data={MOCK_BUSINESS_COMPANY_WISE}
                xKey="month"
                lines={selectedCompanyFilter === 'ALL' ? COMPANY_LINES : COMPANY_LINES.filter(l => l.key === selectedCompanyFilter)}
              />
            </div>
          </div>

          {/* ── Total Business Graph Tenure Wise (Gen + Health) ──────────────── */}
          <div className="grid grid-cols-1 gap-6 mb-6">
            <BarChartWidget
              title="Insurance Company Category Gen + Health Total Business (Tenure Wise 1-5 Years)"
              data={MOCK_TENURE_WISE}
              xKey="month"
              bars={TENURE_BARS}
            />
          </div>

          {/* ── Avg Sum Insured Cards ────────────────────────────────────────── */}
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <AvgSumInsuredGenHealthCard />
            <AvgSumInsuredTermCard />
          </div>

          {/* ── New Leads Stacked Bar Graph ────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-6 mb-6">
            <div className="card relative p-0 bg-transparent shadow-none border-none">
              <div className="absolute top-1 right-5 z-10 flex items-center gap-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Date Range:</label>
                <select
                  value={leadsDateRange}
                  onChange={e => setLeadsDateRange(e.target.value)}
                  className="bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold rounded-lg px-2 py-1 outline-none cursor-pointer"
                >
                  <option value="ALL">All Time</option>
                  <option value="30">Last 30 Days</option>
                  <option value="90">Last 90 Days</option>
                  <option value="365">This Year</option>
                </select>
              </div>
              <BarChartWidget
                title="New Leads Created (Stage Wise & Status Wise)"
                data={MOCK_LEADS_STATUS_WISE}
                xKey="stage"
                bars={LEAD_STATUS_BARS}
              />
            </div>
          </div>

          {/* ── Additional Charts: Persons Covered & MF Leads ─────────────── */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <CoverageBarChartWidget
                title="Total No. of Persons Covered Under Product Category"
                data={MOCK_PERSONS_COVERED}
                xKey="name"
                valueKey="value"
                totalKey="total"
              />
            </div>
            <div className="lg:col-span-1">
              <MfLeadsSummaryCard data={MOCK_MF_LEADS} />
            </div>
          </div>

          {/* ── Footer KPI summary widgets ─────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-wrap items-center gap-4 hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                <CheckCircle size={22} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Claim Settlement Ratio</p>
                <p className="text-xl font-black text-gray-900 mt-1">92.4%</p>
                <span className="text-[10px] font-bold text-green-600">▲ +4.6% <span className="text-gray-400 font-medium">vs last month</span></span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-wrap items-center gap-4 hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                <RefreshCw size={22} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Renewal Rate</p>
                <p className="text-xl font-black text-gray-900 mt-1">87.6%</p>
                <span className="text-[10px] font-bold text-green-600">▲ +3.7% <span className="text-gray-400 font-medium">vs last month</span></span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-wrap items-center gap-4 hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                <Star size={22} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Customer Satisfaction</p>
                <p className="text-xl font-black text-gray-900 mt-1">4.8/5</p>
                <span className="text-[10px] font-bold text-green-600">▲ +0.8% <span className="text-gray-400 font-medium">vs last month</span></span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
