import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Shield, FileText, TrendingUp, DollarSign, AlertCircle,
  RefreshCw, Plus, Calendar, ChevronRight, CheckCircle,
  Clock, UserPlus, Briefcase, PhoneCall, Star, Award, Settings,
  BarChart2, Activity, RotateCcw
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

const MOCK_CONTACTS = { total: 2090, male: 1150, female: 940, under18: 380, above60: 420 };

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
  { key: 'health', label: 'Health', color: '#1e40af' }, // Blue 800
  { key: 'accident', label: 'Accident', color: '#2563eb' }, // Blue 600
  { key: 'critical', label: 'Critical Illness', color: '#60a5fa' }, // Blue 400
  { key: 'groupHealth', label: 'Group Health', color: '#0f766e' }, // Teal 700
  { key: 'groupPa', label: 'Group PA', color: '#0d9488' }, // Teal 600
  { key: 'sme', label: 'SME Health', color: '#2dd4bf' }, // Teal 400
  { key: 'termLife', label: 'Term Life', color: '#4338ca' }, // Indigo 700
  { key: 'tulip', label: 'TULIP', color: '#6366f1' }, // Indigo 500
  { key: 'ulip', label: 'ULIP', color: '#818cf8' }, // Indigo 400
  { key: 'endowment', label: 'Endowment', color: '#0f172a' }, // Slate 900
  { key: 'moneyback', label: 'Moneyback', color: '#334155' }, // Slate 700
  { key: 'business', label: 'Business', color: '#64748b' }, // Slate 500
  { key: 'mf', label: 'MF', color: '#0369a1' }, // Sky 700
  { key: 'other', label: 'Other', color: '#0ea5e9' }, // Sky 500
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
  { month: 'Apr', year1: 105, year2: 40, year3: 20, year4: 8, year5: 3 },
  { month: 'May', year1: 115, year2: 48, year3: 28, year4: 11, year5: 6 },
  { month: 'Jun', year1: 125, year2: 55, year3: 32, year4: 14, year5: 7 },
  { month: 'Jul', year1: 95, year2: 38, year3: 18, year4: 7, year5: 2 },
  { month: 'Aug', year1: 108, year2: 42, year3: 22, year4: 9, year5: 4 },
  { month: 'Sep', year1: 130, year2: 58, year3: 34, year4: 16, year5: 9 },
  { month: 'Oct', year1: 145, year2: 65, year3: 40, year4: 18, year5: 10 },
  { month: 'Nov', year1: 118, year2: 52, year3: 29, year4: 13, year5: 5 },
  { month: 'Dec', year1: 160, year2: 75, year3: 45, year4: 22, year5: 12 },
];

const TENURE_BARS = [
  { key: 'year1', label: '1 Year', color: '#3b82f6' }, // blue-500
  { key: 'year2', label: '2 Years', color: '#10b981' }, // emerald-500
  { key: 'year3', label: '3 Years', color: '#f59e0b' }, // amber-500
  { key: 'year4', label: '4 Years', color: '#8b5cf6' }, // violet-500
  { key: 'year5', label: '5 Years', color: '#ec4899' }, // pink-500
];

const MOCK_LEADS_STATUS_WISE = [
  { stage: 'To Contact', hot: 25, warm: 40, cold: 60, dropped: 10, converted: 0 },
  { stage: 'Contacted', hot: 35, warm: 50, cold: 40, dropped: 15, converted: 0 },
  { stage: 'Proposal Sent', hot: 45, warm: 30, cold: 20, dropped: 5, converted: 0 },
  { stage: 'Login Progress', hot: 55, warm: 20, cold: 10, dropped: 2, converted: 0 },
  { stage: 'Payment Done', hot: 60, warm: 10, cold: 5, dropped: 1, converted: 80 },
  { stage: 'Process Completed', hot: 20, warm: 5, cold: 2, dropped: 0, converted: 95 },
];

const LEAD_STATUS_BARS = [
  { key: 'hot', label: 'Hot', color: '#ef4444' }, // red
  { key: 'warm', label: 'Warm', color: '#f59e0b' }, // amber
  { key: 'cold', label: 'Cold', color: '#3b82f6' }, // blue
  { key: 'converted', label: 'Converted', color: '#10b981' }, // emerald
  { key: 'dropped', label: 'Dropped', color: '#64748b' }, // slate
];

// ── Comprehensive Dummy Fallback Data ─────────────────────────────────────────
const FALLBACK_KPIS = {
  activePolicies: 1248,
  openLeads: 86,
  monthlyPremium: 3840000,
  openClaims: 14,
  pendingTasks: 22,
};

const FALLBACK_REVENUE_12 = [
  { month: 'Jan', revenue: 2450000, target: 2200000 },
  { month: 'Feb', revenue: 2800000, target: 2500000 },
  { month: 'Mar', revenue: 3950000, target: 3200000 },
  { month: 'Apr', revenue: 3100000, target: 3000000 },
  { month: 'May', revenue: 3400000, target: 3200000 },
  { month: 'Jun', revenue: 3650000, target: 3400000 },
  { month: 'Jul', revenue: 3200000, target: 3100000 },
  { month: 'Aug', revenue: 3500000, target: 3300000 },
  { month: 'Sep', revenue: 4100000, target: 3600000 },
  { month: 'Oct', revenue: 4350000, target: 3800000 },
  { month: 'Nov', revenue: 3900000, target: 3700000 },
  { month: 'Dec', revenue: 4800000, target: 4200000 },
];

const FALLBACK_PORTFOLIO_PRODUCT = [
  { name: 'Health Insurance', value: 450 },
  { name: 'Term Life', value: 380 },
  { name: 'Motor Insurance', value: 240 },
  { name: 'Investment / ULIP', value: 180 },
  { name: 'General / SME', value: 120 },
];

const FALLBACK_PORTFOLIO_COMPANY = [
  { name: 'HDFC Life', value: 420 },
  { name: 'Star Health', value: 340 },
  { name: 'LIC of India', value: 290 },
  { name: 'ICICI Lombard', value: 210 },
  { name: 'Tata AIG', value: 160 },
];

const FALLBACK_PIPELINE_STAGES = [
  { stage: 'TO_CONTACT', count: 28 },
  { stage: 'CONTACTED', count: 22 },
  { stage: 'PROPOSAL_SENT', count: 16 },
  { stage: 'LOGIN_PROGRESS', count: 11 },
  { stage: 'PAYMENT_DONE', count: 9 },
  { stage: 'PROCESS_COMPLETED', count: 14 },
];

const FALLBACK_RECENT_CLAIMS = [
  { id: 'clm-001', claimNumber: 'CLM-8492', policy: { contact: { firstName: 'Amit', lastName: 'Sharma' }, plan: { category: 'Health Insurance' } }, claimAmount: 185000, status: 'APPROVED' },
  { id: 'clm-002', claimNumber: 'CLM-7321', policy: { contact: { firstName: 'Priya', lastName: 'Patel' }, plan: { category: 'Critical Illness' } }, claimAmount: 350000, status: 'PENDING' },
  { id: 'clm-003', claimNumber: 'CLM-9104', policy: { contact: { firstName: 'Vikram', lastName: 'Singh' }, plan: { category: 'Motor Insurance' } }, claimAmount: 48000, status: 'APPROVED' },
  { id: 'clm-004', claimNumber: 'CLM-6540', policy: { contact: { firstName: 'Sunita', lastName: 'Verma' }, plan: { category: 'Group Health' } }, claimAmount: 92000, status: 'UNDER_PROCESS' },
  { id: 'clm-005', claimNumber: 'CLM-4819', policy: { contact: { firstName: 'Rajesh', lastName: 'Gupta' }, plan: { category: 'Term Life' } }, claimAmount: 1500000, status: 'PENDING' },
];

const FALLBACK_TOP_AGENTS = [
  { id: 'agt-001', firstName: 'Kavita', lastName: 'Deshmukh', designation: 'Senior Insurance Specialist', policiesCount: 38, premiumTotal: 4250000 },
  { id: 'agt-002', firstName: 'Rohit', lastName: 'Kashyap', designation: 'Field Relationship Officer', policiesCount: 31, premiumTotal: 3400000 },
  { id: 'agt-003', firstName: 'Ananya', lastName: 'Roy', designation: 'Inbound Tele-Calling Executive', policiesCount: 26, premiumTotal: 2850000 },
  { id: 'agt-004', firstName: 'Siddharth', lastName: 'Nair', designation: 'Corporate Agency Associate', policiesCount: 22, premiumTotal: 2400000 },
];

const FALLBACK_CLAIMS_FOR_REPORTS = [
  { id: 'clm-101', claimNumber: 'CLM-4910', claimType: 'CASHLESS', policy: { plan: { company: { name: 'Star Health' } } }, notes: JSON.stringify({ hospital: 'Apollo Hospitals', diagnosis: 'Dengue Treatment' }), claimAmount: 68000, approvedAmount: 64000, intimatedAt: new Date(Date.now() - 5 * 86400000).toISOString(), createdAt: new Date(Date.now() - 5 * 86400000).toISOString(), status: 'SETTLED' },
  { id: 'clm-102', claimNumber: 'CLM-5821', claimType: 'REIMBURSEMENT', policy: { plan: { company: { name: 'HDFC ERGO' } } }, notes: JSON.stringify({ hospital: 'Fortis Healthcare', diagnosis: 'Knee Arthroscopy' }), claimAmount: 145000, approvedAmount: 138000, intimatedAt: new Date(Date.now() - 12 * 86400000).toISOString(), createdAt: new Date(Date.now() - 12 * 86400000).toISOString(), status: 'SETTLED' },
  { id: 'clm-103', claimNumber: 'CLM-6194', claimType: 'CASHLESS', policy: { plan: { company: { name: 'Care Insurance' } } }, notes: JSON.stringify({ hospital: 'Manipal Hospital', diagnosis: 'Cardiac Angioplasty' }), claimAmount: 320000, approvedAmount: 0, intimatedAt: new Date(Date.now() - 2 * 86400000).toISOString(), createdAt: new Date(Date.now() - 2 * 86400000).toISOString(), status: 'PENDING' },
  { id: 'clm-104', claimNumber: 'CLM-7012', claimType: 'CASHLESS', policy: { plan: { company: { name: 'Niva Bupa' } } }, notes: JSON.stringify({ hospital: 'Max Super Speciality', diagnosis: 'Cataract Surgery' }), claimAmount: 52000, approvedAmount: 50000, intimatedAt: new Date(Date.now() - 18 * 86400000).toISOString(), createdAt: new Date(Date.now() - 18 * 86400000).toISOString(), status: 'SETTLED' },
  { id: 'clm-105', claimNumber: 'CLM-8145', claimType: 'REIMBURSEMENT', policy: { plan: { company: { name: 'ICICI Lombard' } } }, notes: JSON.stringify({ hospital: 'Narayana Health', diagnosis: 'Accidental Fracture' }), claimAmount: 95000, approvedAmount: 0, intimatedAt: new Date(Date.now() - 4 * 86400000).toISOString(), createdAt: new Date(Date.now() - 4 * 86400000).toISOString(), status: 'IN_PROGRESS' },
  { id: 'clm-106', claimNumber: 'CLM-9230', claimType: 'CASHLESS', policy: { plan: { company: { name: 'Tata AIG' } } }, notes: JSON.stringify({ hospital: 'Kokilaben Hospital', diagnosis: 'Gallbladder Removal' }), claimAmount: 110000, approvedAmount: 105000, intimatedAt: new Date(Date.now() - 25 * 86400000).toISOString(), createdAt: new Date(Date.now() - 25 * 86400000).toISOString(), status: 'SETTLED' },
  { id: 'clm-107', claimNumber: 'CLM-9411', claimType: 'REIMBURSEMENT', policy: { plan: { company: { name: 'Star Health' } } }, notes: JSON.stringify({ hospital: 'Ruby Hall Clinic', diagnosis: 'Pre-existing Exclusion' }), claimAmount: 42000, approvedAmount: 0, intimatedAt: new Date(Date.now() - 30 * 86400000).toISOString(), createdAt: new Date(Date.now() - 30 * 86400000).toISOString(), status: 'REJECTED' },
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
function ContactsBreakdownCard({ data }: { data: { total: number; male: number; female: number; under18: number; above60: number } }) {
  const malePct = ((data.male / data.total) * 100).toFixed(0);
  const femalePct = ((data.female / data.total) * 100).toFixed(0);
  const under18Pct = ((data.under18 / data.total) * 100).toFixed(0);
  const above60Pct = ((data.above60 / data.total) * 100).toFixed(0);

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

        <div className="space-y-3.5">
          {/* Male */}
          <div>
            <div className="flex justify-between text-[11px] font-bold text-gray-700 mb-1.5">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block shadow-xs" />
                Male
              </span>
              <span>{fmt(data.male)} ({malePct}%)</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${malePct}%` }} />
            </div>
          </div>

          {/* Female */}
          <div>
            <div className="flex justify-between text-[11px] font-bold text-gray-700 mb-1.5">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-pink-500 inline-block shadow-xs" />
                Female
              </span>
              <span>{fmt(data.female)} ({femalePct}%)</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-pink-500 rounded-full transition-all duration-500" style={{ width: `${femalePct}%` }} />
            </div>
          </div>

          {/* Under 18 */}
          <div>
            <div className="flex justify-between text-[11px] font-bold text-gray-700 mb-1.5">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-xs" />
                Under 18
              </span>
              <span>{fmt(data.under18)} ({under18Pct}%)</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${under18Pct}%` }} />
            </div>
          </div>

          {/* Above 60 */}
          <div>
            <div className="flex justify-between text-[11px] font-bold text-gray-700 mb-1.5">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shadow-xs" />
                Above 60
              </span>
              <span>{fmt(data.above60)} ({above60Pct}%)</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${above60Pct}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MF Leads Business Summary Card ──────────────────────────────────────────
function MfLeadsSummaryCard({ data }: { data: any }) {
  const totalAum = (data?.activeSipAmount || 0) + (data?.lumpsumAmount || 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm h-full flex flex-col justify-between group hover:shadow-md transition-all">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-600 text-white flex items-center justify-center shadow-xs shadow-teal-500/20">
              <TrendingUp size={16} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-900 tracking-wider uppercase">MF Leads Business</h3>
              <p className="text-[10px] text-gray-400 font-semibold">SIP, Lumpsum & Investor Pool</p>
            </div>
          </div>
          <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
            ● Active
          </span>
        </div>

        {/* 4 Attractive Metric Tiles */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          {/* Active SIP Amt */}
          <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/40 rounded-2xl p-3.5 border border-emerald-100/80 hover:border-emerald-300 transition-all shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">Active SIP Amt</p>
              <span className="text-[9px] font-black text-emerald-600 bg-emerald-100/70 px-1.5 py-0.5 rounded">Monthly</span>
            </div>
            <p className="text-base font-black text-emerald-950 mt-1.5 tracking-tight">{fmtINR(data.activeSipAmount)}</p>
            <p className="text-[9px] font-bold text-emerald-700 mt-1 flex items-center gap-1">
              <span>▲ +14.2%</span>
              <span className="text-gray-400 font-normal">vs last mo</span>
            </p>
          </div>

          {/* Lumpsum Amt */}
          <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/40 rounded-2xl p-3.5 border border-blue-100/80 hover:border-blue-300 transition-all shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wide">Lumpsum Amt</p>
              <span className="text-[9px] font-black text-blue-600 bg-blue-100/70 px-1.5 py-0.5 rounded">Total</span>
            </div>
            <p className="text-base font-black text-blue-950 mt-1.5 tracking-tight">{fmtINR(data.lumpsumAmount)}</p>
            <p className="text-[9px] font-bold text-blue-700 mt-1 flex items-center gap-1">
              <span>▲ +8.5%</span>
              <span className="text-gray-400 font-normal">inflows</span>
            </p>
          </div>

          {/* No. of Investors */}
          <div className="bg-gradient-to-br from-purple-50/80 to-fuchsia-50/40 rounded-2xl p-3.5 border border-purple-100/80 hover:border-purple-300 transition-all shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-purple-800 uppercase tracking-wide">No. of Investors</p>
              <Users size={12} className="text-purple-600" />
            </div>
            <p className="text-base font-black text-purple-950 mt-1.5 tracking-tight">{data.investors}</p>
            <p className="text-[9px] font-bold text-purple-700 mt-1 flex items-center gap-1">
              <span>+12 New</span>
              <span className="text-gray-400 font-normal">this mo</span>
            </p>
          </div>

          {/* No. of Active SIPs */}
          <div className="bg-gradient-to-br from-amber-50/80 to-orange-50/40 rounded-2xl p-3.5 border border-amber-100/80 hover:border-amber-300 transition-all shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">Active SIPs</p>
              <CheckCircle size={12} className="text-amber-600" />
            </div>
            <p className="text-base font-black text-amber-950 mt-1.5 tracking-tight">{data.activeSips}</p>
            <p className="text-[9px] font-bold text-amber-700 mt-1 flex items-center gap-1">
              <span>96.5%</span>
              <span className="text-gray-400 font-normal">active</span>
            </p>
          </div>
        </div>
      </div>

      {/* Footer Banner */}
      <div className="mt-4 pt-3 border-t border-gray-100/80 flex items-center justify-between text-xs">
        <span className="text-[11px] font-semibold text-gray-500">Total MF Book Value (AUM)</span>
        <span className="text-xs font-black text-gray-900 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">
          {fmtINR(totalAum)}
        </span>
      </div>
    </div>
  );
}

// ── Leads Progress Indicator Card ────────────────────────────────────────────
function LeadsProgressIndicator({ pipelineData }: { pipelineData: any[] }) {
  const effectivePipeline = (pipelineData && pipelineData.length > 0) ? pipelineData : FALLBACK_PIPELINE_STAGES;
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

  const totalActiveLeads = effectivePipeline
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
            const data = effectivePipeline.find(p => p.stage === stage);
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
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-blue-600 text-white flex items-center justify-center shadow-xs shadow-indigo-500/20">
              <Shield size={16} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-900 tracking-wider uppercase">Avg Sum Insured (Gen + Health)</h3>
              <p className="text-[10px] text-gray-400 font-semibold">Total basic sum insured divided by insured persons</p>
            </div>
          </div>
          <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-full">
            ● Optimal Cover
          </span>
        </div>

        {/* 3 Interactive Category Tiles */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {/* Fresh */}
          <div className="bg-gradient-to-br from-indigo-50/90 to-blue-50/40 rounded-2xl p-3.5 border border-indigo-100/80 hover:border-indigo-300 transition-all shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide">Fresh</p>
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
            </div>
            <p className="text-lg font-black text-indigo-950 mt-1.5 tracking-tight">₹8.5L</p>
            <p className="text-[9px] font-medium text-indigo-600 mt-0.5">Base entry cover</p>
          </div>

          {/* Port */}
          <div className="bg-gradient-to-br from-teal-50/90 to-emerald-50/40 rounded-2xl p-3.5 border border-teal-100/80 hover:border-teal-300 transition-all shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-teal-800 uppercase tracking-wide">Port</p>
              <span className="w-2 h-2 rounded-full bg-teal-500" />
            </div>
            <p className="text-lg font-black text-teal-950 mt-1.5 tracking-tight">₹10.2L</p>
            <p className="text-[9px] font-medium text-teal-600 mt-0.5">Enhanced porting</p>
          </div>

          {/* Renewal */}
          <div className="bg-gradient-to-br from-amber-50/90 to-orange-50/40 rounded-2xl p-3.5 border border-amber-100/80 hover:border-amber-300 transition-all shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">Renewal</p>
              <span className="w-2 h-2 rounded-full bg-amber-500" />
            </div>
            <p className="text-lg font-black text-amber-950 mt-1.5 tracking-tight">₹12.5L</p>
            <p className="text-[9px] font-medium text-amber-600 mt-0.5">With bonus added</p>
          </div>
        </div>
      </div>

      {/* Footer Benchmark Bar */}
      <div className="mt-4 pt-3 border-t border-gray-100/80 flex items-center justify-between text-xs">
        <span className="text-[11px] font-semibold text-gray-500">Overall Weighted Portfolio Average</span>
        <span className="text-xs font-black text-indigo-900 bg-indigo-50/80 px-2.5 py-1 rounded-lg border border-indigo-100">
          ₹10.4 Lakhs / Person
        </span>
      </div>
    </div>
  );
}

// ── Avg Sum Insured Card (Term) ─────────────────────────────────────────────
function AvgSumInsuredTermCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm h-full flex flex-col justify-between group hover:shadow-md transition-all">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-600 text-white flex items-center justify-center shadow-xs shadow-rose-500/20">
              <Shield size={16} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-900 tracking-wider uppercase">Avg Sum Insured (Term Life)</h3>
              <p className="text-[10px] text-gray-400 font-semibold">Total life sum insured divided by active insured persons</p>
            </div>
          </div>
          <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full flex items-center gap-1">
            ✓ High Coverage
          </span>
        </div>

        {/* Hero Value Display with Benchmarks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          {/* Main Hero Card */}
          <div className="bg-gradient-to-br from-rose-50/90 to-pink-50/40 rounded-2xl p-3.5 border border-rose-100/80 shadow-2xs flex flex-col justify-between">
            <p className="text-[10px] font-bold text-rose-800 uppercase tracking-wide">Average Life Cover</p>
            <div className="my-1">
              <span className="text-2xl font-black text-rose-950 tracking-tight">₹1.50 Cr</span>
              <p className="text-[10px] font-semibold text-rose-600 mt-0.5">Per insured breadwinner</p>
            </div>
            <div className="w-full bg-rose-200/60 rounded-full h-1.5 mt-1 overflow-hidden">
              <div className="bg-rose-600 h-full rounded-full" style={{ width: '85%' }} />
            </div>
          </div>

          {/* Sub Benchmarks Card */}
          <div className="bg-gradient-to-br from-slate-50/90 to-gray-50/50 rounded-2xl p-3.5 border border-gray-100 shadow-2xs flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Coverage Tier Benchmark</p>
              <div className="mt-2 space-y-1.5">
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-gray-600">≥ ₹1.0 Cr Share</span>
                  <span className="text-emerald-600 font-extrabold">78%</span>
                </div>
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-gray-600">Avg Income Multiplier</span>
                  <span className="text-blue-600 font-extrabold">18.5x</span>
                </div>
              </div>
            </div>
            <p className="text-[9px] font-bold text-gray-400 mt-2">Recommended: 15x - 20x annual income</p>
          </div>
        </div>
      </div>

      {/* Footer Benchmark Bar */}
      <div className="mt-4 pt-3 border-t border-gray-100/80 flex items-center justify-between text-xs">
        <span className="text-[11px] font-semibold text-gray-500">Benchmark Protection Index</span>
        <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
          Tier 1 Strong (94/100)
        </span>
      </div>
    </div>
  );
}

// ── Database Summary Status Table Card ───────────────────────────────────────
function DatabaseSummary({ summaryData }: { summaryData: any }) {
  const { policies = [], contacts = 0, claims = [], leads = 0, tasks = [] } = summaryData || {};

  // Policies: Active and Expired
  const rawPolicyActive = policies.find((p: any) => p.status === 'ACTIVE')?.count || 0;
  const rawPolicyExpired = policies.filter((p: any) => ['EXPIRED', 'LAPSED', 'CANCELLED'].includes(p.status)).reduce((acc: number, curr: any) => acc + (curr.count || 0), 0);
  const rawPolicyTotal = policies.reduce((acc: number, curr: any) => acc + (curr.count || 0), 0);

  const policyTotal = rawPolicyTotal > 0 ? rawPolicyTotal : 1248;
  const policyActive = rawPolicyActive > 0 ? rawPolicyActive : 1180;
  const policyExpired = rawPolicyExpired > 0 ? rawPolicyExpired : 68;

  // Contacts: Active and Inactive
  const totalContacts = contacts > 0 ? contacts : 2090;
  const contactsActive = Math.round(totalContacts * 0.88);
  const contactsInactive = totalContacts - contactsActive;

  // Leads: Hopeful (Interested, Hot, Very Hot) and Hopeless (Lost, Not Interested)
  const totalLeads = leads > 0 ? leads : 186;
  const leadsHopeful = Math.round(totalLeads * 0.76);
  const leadsHopeless = totalLeads - leadsHopeful;

  // Claims: Active, Settled, Inprogress
  const rawClaimActive = claims.filter((c: any) => ['INTIMATED', 'DOC_COLLECTION', 'FILED'].includes(c.status)).reduce((acc: number, curr: any) => acc + (curr.count || 0), 0);
  const rawClaimInProgress = claims.filter((c: any) => c.status === 'IN_REVIEW' || c.status === 'IN_PROGRESS').reduce((acc: number, curr: any) => acc + (curr.count || 0), 0);
  const rawClaimSettled = claims.filter((c: any) => c.status === 'SETTLED' || c.status === 'APPROVED').reduce((acc: number, curr: any) => acc + (curr.count || 0), 0);
  const rawClaimTotal = claims.reduce((acc: number, curr: any) => acc + (curr.count || 0), 0);

  const claimTotal = rawClaimTotal > 0 ? rawClaimTotal : 42;
  const claimActive = rawClaimActive > 0 ? rawClaimActive : 14;
  const claimSettled = rawClaimSettled > 0 ? rawClaimSettled : 18;
  const claimInProgress = rawClaimInProgress > 0 ? rawClaimInProgress : 10;

  // Tasks: Completed, In-Progress, Not Started
  const rawTaskCompleted = tasks.find((t: any) => t.status === 'COMPLETED')?.count || 0;
  const rawTaskInProgress = tasks.find((t: any) => t.status === 'IN_PROGRESS')?.count || 0;
  const rawTaskNotStarted = tasks.filter((t: any) => ['PENDING', 'NOT_STARTED', 'TODO'].includes(t.status)).reduce((acc: number, curr: any) => acc + (curr.count || 0), 0);
  const rawTaskTotal = tasks.reduce((acc: number, curr: any) => acc + (curr.count || 0), 0);

  const taskTotal = rawTaskTotal > 0 ? rawTaskTotal : 64;
  const taskCompleted = rawTaskCompleted > 0 ? rawTaskCompleted : 27;
  const taskInProgress = rawTaskInProgress > 0 ? rawTaskInProgress : 15;
  const taskNotStarted = rawTaskNotStarted > 0 ? rawTaskNotStarted : 22;

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
              {/* Contacts: Active & Inactive */}
              <tr className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-semibold text-gray-950">Contacts</td>
                <td className="px-4 py-3 font-bold text-blue-600">{totalContacts}</td>
                <td className="px-4 py-3 text-gray-500">
                  <span className="text-emerald-600 font-semibold">{contactsActive} Active</span> •{' '}
                  <span className="text-gray-400 font-medium">{contactsInactive} Inactive</span>
                </td>
              </tr>
              {/* Leads: Hopeful & Hopeless */}
              <tr className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-semibold text-gray-950">Leads</td>
                <td className="px-4 py-3 font-bold text-indigo-600">{totalLeads}</td>
                <td className="px-4 py-3 text-gray-500">
                  <span className="text-emerald-600 font-semibold">{leadsHopeful} Hopeful</span>{' '}
                  <span className="text-gray-400 text-[10px]">(Interested & above)</span> •{' '}
                  <span className="text-rose-500 font-semibold">{leadsHopeless} Hopeless</span>{' '}
                  <span className="text-gray-400 text-[10px]">(Lost / Not interested)</span>
                </td>
              </tr>
              {/* Policies: Active & Expired */}
              <tr className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-semibold text-gray-950">Policies</td>
                <td className="px-4 py-3 font-bold text-blue-600">{policyTotal}</td>
                <td className="px-4 py-3 text-gray-500">
                  <span className="text-emerald-600 font-semibold">{policyActive} Active</span> •{' '}
                  <span className="text-amber-500 font-medium">{policyExpired} Expired</span>
                </td>
              </tr>
              {/* Claims: Active, Settled, Inprogress */}
              <tr className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-semibold text-gray-950">Claims</td>
                <td className="px-4 py-3 font-bold text-red-500">{claimTotal}</td>
                <td className="px-4 py-3 text-gray-500">
                  <span className="text-blue-500 font-semibold">{claimActive} Active</span> •{' '}
                  <span className="text-emerald-600 font-semibold">{claimSettled} Settled</span> •{' '}
                  <span className="text-amber-500 font-medium">{claimInProgress} In-Progress</span>
                </td>
              </tr>
              {/* Tasks: Completed, Inprogress, Not started */}
              <tr className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-semibold text-gray-950">Tasks</td>
                <td className="px-4 py-3 font-bold text-purple-600">{taskTotal}</td>
                <td className="px-4 py-3 text-gray-500">
                  <span className="text-emerald-600 font-semibold">{taskCompleted} Completed</span> •{' '}
                  <span className="text-amber-500 font-medium">{taskInProgress} In-Progress</span> •{' '}
                  <span className="text-blue-500 font-medium">{taskNotStarted} Not Started</span>
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
  const navigate = useNavigate();
  const { data: claimsRes, isLoading: claimsLoading } = useClaims({ page: 1, limit: 1000 });
  const rawClaims = claimsRes?.data ?? [];
  const claims = (rawClaims && rawClaims.length > 0) ? rawClaims : FALLBACK_CLAIMS_FOR_REPORTS;

  const [duration, setDuration] = useState('ALL');
  const [selectedCompany, setSelectedCompany] = useState('ALL');
  const [hospitalQuery, setHospitalQuery] = useState('');
  const [claimType, setClaimType] = useState('ALL');
  const [graphCompanySelect, setGraphCompanySelect] = useState('ALL');
  const [pieChartMetric, setPieChartMetric] = useState<'count' | 'claimed' | 'settled'>('count');
  const [timeGraphMonths, setTimeGraphMonths] = useState<string>('12');

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
    let pendingCount = 0;
    let rejectedCount = 0;

    filteredClaims.forEach((c: any) => {
      claimedSum += Number(c.claimAmount || 0);
      // APPROVED & SETTLED count as payouts
      if (c.status === 'SETTLED' || c.status === 'APPROVED') {
        settledSum += Number(c.approvedAmount || c.claimAmount || 0);
      } else if (c.status === 'PENDING' || c.status === 'IN_PROGRESS') {
        pendingCount += 1;
      } else if (c.status === 'REJECTED') {
        rejectedCount += 1;
      }
    });

    const ratio = claimedSum > 0 ? (settledSum / claimedSum) * 100 : 0;

    return {
      totalCount,
      claimedSum,
      settledSum,
      pendingCount,
      rejectedCount,
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

    const values = Array.from(map.values());
    if (timeGraphMonths === 'ALL') return values;
    const num = parseInt(timeGraphMonths, 10) || 12;
    return values.slice(-num);
  }, [filteredClaims, timeGraphMonths]);

  if (claimsLoading) {
    return (
      <div className="space-y-6">
        <SkeletonTable rows={4} cols={4} />
      </div>
    );
  }

  const hasActiveFilters = duration !== 'ALL' || selectedCompany !== 'ALL' || claimType !== 'ALL' || hospitalQuery.trim() !== '';

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Filters Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Filter Claims & Analytics</span>
            {hasActiveFilters && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">Active Filters</span>
            )}
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setDuration('ALL');
                setSelectedCompany('ALL');
                setClaimType('ALL');
                setHospitalQuery('');
              }}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Reset All Filters
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col justify-between min-h-[112px]">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Total Claims</span>
          <span className="text-2xl font-black text-gray-900 mt-1">{stats.totalCount}</span>
          <span className="text-[10px] text-gray-400 font-semibold truncate">Matching filtered criteria</span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col justify-between min-h-[112px]">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Claimed Amount</span>
          <span className="text-2xl font-black text-blue-600 mt-1">₹{stats.claimedSum.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-gray-400 font-semibold truncate">Sum of total claims</span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col justify-between min-h-[112px]">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Settled Amount</span>
          <span className="text-2xl font-black text-emerald-600 mt-1">₹{stats.settledSum.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-gray-400 font-semibold truncate">Total paid out amount</span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col justify-between min-h-[112px]">
          <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wide">Pending Claims</span>
          <span className="text-2xl font-black text-amber-600 mt-1">{stats.pendingCount}</span>
          <span className="text-[10px] text-amber-600/70 font-semibold truncate">In progress & pending</span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col justify-between min-h-[112px]">
          <span className="text-[11px] font-bold text-red-500 uppercase tracking-wide">Rejected Claims</span>
          <span className="text-2xl font-black text-red-600 mt-1">{stats.rejectedCount}</span>
          <span className="text-[10px] text-red-600/70 font-semibold truncate">Exclusions & repudiated</span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col justify-between min-h-[112px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Settlement Ratio</span>
            <span className={`text-[10px] font-bold ${stats.ratio >= 85 ? 'text-emerald-600' : stats.ratio >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
              {stats.ratio >= 85 ? '▲ High' : stats.ratio >= 70 ? '▲ Moderate' : '▼ Low'}
            </span>
          </div>
          <span className={`text-2xl font-black mt-1 ${stats.ratio >= 85 ? 'text-emerald-600' : stats.ratio >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
            {stats.claimedSum > 0 ? `${stats.ratio.toFixed(1)}%` : '0%'}
          </span>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${
                stats.ratio >= 85 ? 'bg-emerald-500' : stats.ratio >= 70 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, stats.ratio))}%` }}
            />
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

        <div className="relative">
          <div className="absolute top-4 right-5 z-10 flex items-center gap-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Months:</label>
            <select
              value={timeGraphMonths}
              onChange={e => setTimeGraphMonths(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold rounded-lg px-2 py-1 outline-none cursor-pointer"
            >
              <option value="3">Last 3 Months</option>
              <option value="6">Last 6 Months</option>
              <option value="12">Last 12 Months</option>
              <option value="ALL">All Months</option>
            </select>
          </div>
          <LineChartWidget
            title="Claimed vs Settled Amount Trend over Time (₹)"
            data={timeGraphData}
            xKey="month"
            lines={[
              { key: 'claimed', label: 'Claimed (₹)', color: '#2563eb' },
              { key: 'settled', label: 'Settled (₹)', color: '#10b981' }
            ]}
          />
        </div>

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

      {/* ── Claims Detailed History Table ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-bold text-gray-900 tracking-wider uppercase">Filtered Claims History & Settlements</h3>
            <p className="text-[10px] text-gray-400 font-semibold mt-0.5">Live tracking of cashless intimations and reimbursement payouts</p>
          </div>
          <button
            onClick={() => navigate('/claims')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
          >
            Open Claims Module →
          </button>
        </div>

        <div className="overflow-x-auto -mx-5 -mb-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100">
                {['Claim ID', 'Intimation Date', 'Policy Holder', 'Insurance Company', 'Type', 'Hospital / Diagnosis', 'Claim Amount', 'Settled Amount', 'Status'].map(h => (
                  <th key={h} className="px-5 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-medium">
              {filteredClaims.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-xs text-gray-400">No claims match the filter</td>
                </tr>
              ) : (
                filteredClaims.map((c: any) => {
                  const client = c.policy?.contact ? `${c.policy.contact.firstName} ${c.policy.contact.lastName}` : (c.contactName || 'Amit Sharma');
                  const compName = c.policy?.plan?.company?.name || 'Star Health';
                  const notesData = getClaimNotesData(c.notes);
                  const amount = Number(c.claimAmount ?? c.amount ?? 0);
                  const approved = Number(c.approvedAmount ?? (c.status === 'SETTLED' ? amount : 0));

                  return (
                    <tr key={c.id} className="hover:bg-blue-50/30 transition-colors text-xs">
                      <td className="px-5 py-3.5 font-bold text-gray-900">{c.claimNumber ?? `CLM-${c.id.slice(-4).toUpperCase()}`}</td>
                      <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">
                        {c.intimatedAt
                          ? format(new Date(c.intimatedAt), 'dd MMM yyyy')
                          : c.createdAt
                          ? format(new Date(c.createdAt), 'dd MMM yyyy')
                          : '—'}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-gray-800">{client}</td>
                      <td className="px-5 py-3.5 text-gray-600">{compName}</td>
                      <td className="px-5 py-3.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {c.claimType || 'CASHLESS'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 max-w-[200px] truncate">
                        {notesData.hospital ? `${notesData.hospital} • ${notesData.diagnosis}` : (notesData.diagnosis || 'Hospitalization')}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-gray-900">₹{amount.toLocaleString('en-IN')}</td>
                      <td className="px-5 py-3.5 font-bold text-emerald-600">{approved > 0 ? `₹${approved.toLocaleString('en-IN')}` : '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className={clsx(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                          c.status === 'SETTLED' || c.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                            c.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                              c.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                                c.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                  'bg-gray-100 text-gray-700'
                        )}>
                          {c.status || 'PENDING'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
  const [selectedProductCategoryFilter, setSelectedProductCategoryFilter] = useState('ALL');
  const [leadsDateRange, setLeadsDateRange] = useState('ALL');
  const [premiumPlanPeriod, setPremiumPlanPeriod] = useState<'this_month' | 'this_quarter' | 'this_year' | 'all_time'>('this_year');
  const user = useAuthStore(s => s.user);

  const filteredBusinessCategoryBars = useMemo(() => {
    if (selectedProductCategoryFilter === 'ALL') {
      return BUSINESS_CATEGORY_BARS;
    }
    if (selectedProductCategoryFilter === 'GRP_HEALTH') {
      return BUSINESS_CATEGORY_BARS.filter(b => ['health', 'accident', 'critical', 'groupHealth', 'groupPa', 'sme'].includes(b.key));
    }
    if (selectedProductCategoryFilter === 'GRP_LIFE') {
      return BUSINESS_CATEGORY_BARS.filter(b => ['termLife', 'tulip', 'ulip', 'endowment', 'moneyback'].includes(b.key));
    }
    if (selectedProductCategoryFilter === 'GRP_BUSINESS') {
      return BUSINESS_CATEGORY_BARS.filter(b => ['groupHealth', 'groupPa', 'sme', 'business'].includes(b.key));
    }
    return BUSINESS_CATEGORY_BARS.filter(b => b.key === selectedProductCategoryFilter);
  }, [selectedProductCategoryFilter]);

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

  // Normalise KPIs with realistic dummy fallback
  const kpis = kpiRes?.data ?? FALLBACK_KPIS;
  const revenue = (revenueRes?.data && revenueRes.data.length > 0) ? revenueRes.data : FALLBACK_REVENUE_12.slice(-revenueMonths);

  // Filtered Premium by Plan based on selected time period
  const filteredPremiumByPlan = useMemo(() => {
    let multiplier = 1;
    if (premiumPlanPeriod === 'this_month') multiplier = 0.12;
    else if (premiumPlanPeriod === 'this_quarter') multiplier = 0.32;
    else if (premiumPlanPeriod === 'all_time') multiplier = 2.4;
    else multiplier = 1;

    return MOCK_PREMIUM_BY_PLAN.map(item => ({
      ...item,
      value: Math.round(item.value * multiplier)
    }));
  }, [premiumPlanPeriod]);

  // Normalize Portfolio to support both product (category) and company toggles
  const portfolio = useMemo(() => {
    const raw = portfolioRes?.data;
    if (raw) {
      if (Array.isArray(raw) && raw.length > 0) {
        return raw.map((r: any) => ({
          name: r.category ?? r.name,
          value: r.count ?? r.value,
        }));
      }
      if (portfolioView === 'product' && raw.byProduct?.length) {
        return raw.byProduct.map((r: any) => ({ name: r.name, value: r.value }));
      }
      if (portfolioView === 'company' && raw.byCompany?.length) {
        return raw.byCompany.map((r: any) => ({ name: r.name, value: r.value }));
      }
    }
    return portfolioView === 'product' ? FALLBACK_PORTFOLIO_PRODUCT : FALLBACK_PORTFOLIO_COMPANY;
  }, [portfolioRes, portfolioView]);

  const pipelineData = (pipelineRes?.data && pipelineRes.data.length > 0) ? pipelineRes.data : FALLBACK_PIPELINE_STAGES;
  const summaryData = (summaryRes?.data ?? summaryRes) || {};
  const claims = (claimsListRes?.data && claimsListRes.data.length > 0) ? claimsListRes.data : FALLBACK_RECENT_CLAIMS;
  const agents = (agentsRes?.data && agentsRes.data.length > 0) ? agentsRes.data : FALLBACK_TOP_AGENTS;

  const handleRefreshAll = () => {
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['claims'] });
    qc.invalidateQueries({ queryKey: ['employees'] });
  };

  return (
    <div className="space-y-6">
      {/* ── Tab Switcher & Action Bar ────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-gray-200">
        <div className="flex items-center">
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

        <button
          onClick={handleRefreshAll}
          className="h-7 px-3 text-[11px] font-bold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1.5 transition-all cursor-pointer mb-1 shadow-2xs"
        >
          <RefreshCw size={12} className={kpiLoading ? 'animate-spin' : ''} />
          Refresh
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
                  label="Total Contacts"
                  value={fmt(MOCK_CONTACTS.total)}
                  trend="7.8%"
                  trendUp={true}
                  icon={<Users size={18} className="text-teal-600" />}
                  color="bg-teal-50"
                  onClick={() => navigate('/contacts')}
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
            <div className="lg:col-span-2 relative">
              <div className="absolute right-5 top-3.5 z-10 flex items-center gap-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Time Period:</label>
                <select
                  value={premiumPlanPeriod}
                  onChange={e => setPremiumPlanPeriod(e.target.value as any)}
                  className="bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold rounded-lg px-2.5 py-1 outline-none cursor-pointer hover:border-gray-300 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-2xs"
                >
                  <option value="this_month">This Month</option>
                  <option value="this_quarter">This Quarter</option>
                  <option value="this_year">This Year (FY)</option>
                  <option value="all_time">All Time</option>
                </select>
              </div>
              <BarChartWidget
                title="Premium by Insurance Plan Category"
                data={filteredPremiumByPlan}
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

          {/* ── Bottom-section: Top Performing Agents ────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <SectionHeader
              title="Top Performing Sales Agents"
              action="View All Employees"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                {agents.slice(0, 4).map((a: any, idx: number) => (
                  <div key={a.id} className="flex items-center gap-3 p-3.5 rounded-2xl bg-gray-50/70 border border-gray-100 hover:border-blue-200 hover:bg-white hover:shadow-xs transition-all">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-sm shadow-blue-500/20">
                      {a.firstName?.[0] || ''}{a.lastName?.[0] || ''}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-gray-900 truncate">
                          {a.firstName} {a.lastName}
                        </p>
                        <span className="text-[10px] font-extrabold text-blue-600">#{idx + 1}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 font-semibold truncate">{a.designation || 'Specialist'}</p>
                      <p className="text-[10px] font-bold text-emerald-600 mt-0.5">{a.policiesCount || (30 - idx * 4)} Policies Sold</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Total Business Graph Category Wise ────────────────────────────── */}
          <div className="grid grid-cols-1 gap-6 mb-6">
            <div className="card relative p-0 bg-transparent shadow-none border-none">
              <div className="absolute top-4 right-5 z-10 flex items-center gap-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Select Product:</label>
                <select
                  value={selectedProductCategoryFilter}
                  onChange={e => setSelectedProductCategoryFilter(e.target.value)}
                  className="bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold rounded-lg px-2.5 py-1 outline-none cursor-pointer hover:border-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs"
                >
                  <option value="ALL">All Products (14 Categories)</option>
                  <optgroup label="Product Groups">
                    <option value="GRP_HEALTH">Health & Accident Plans</option>
                    <option value="GRP_LIFE">Life & Savings Plans</option>
                    <option value="GRP_BUSINESS">Group & SME Plans</option>
                  </optgroup>
                  <optgroup label="Individual Products">
                    {BUSINESS_CATEGORY_BARS.map(b => (
                      <option key={b.key} value={b.key}>{b.label}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <BarChartWidget
                title="Total Business Graph Category Wise (Jan to Dec)"
                data={MOCK_BUSINESS_CATEGORY_WISE}
                xKey="month"
                bars={filteredBusinessCategoryBars}
              />
            </div>
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

          {/* ── New Leads Created (Stage Wise & Status Wise) ──────────────── */}
          <div className="grid grid-cols-1 gap-6 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <h3 className="text-sm font-semibold text-gray-700">New Leads Created (Stage Wise & Status Wise)</h3>
                <div className="flex items-center gap-2">
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
              </div>
              <BarChartWidget
                data={MOCK_LEADS_STATUS_WISE}
                xKey="stage"
                bars={LEAD_STATUS_BARS}
                height={300}
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
                <Shield size={22} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Policy Retention Rate</p>
                <p className="text-xl font-black text-gray-900 mt-1">94.2%</p>
                <span className="text-[10px] font-bold text-green-600">▲ +2.4% <span className="text-gray-400 font-medium">vs last month</span></span>
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
