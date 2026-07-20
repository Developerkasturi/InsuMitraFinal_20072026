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
import { LineChartWidget, PieChartWidget, BarChartWidget } from '@comps/common/Charts';
import { SkeletonCard, SkeletonChart, SkeletonTable } from '@comps/common/Skeleton';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@store/auth.store';
import { claimsService, employeesService } from '@api/index';
import clsx from 'clsx';

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
          className="text-xs text-blue-600 hover:text-blue-700 font-bold transition-colors cursor-pointer"
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
      <div className="flex items-center gap-1 text-[11px] mt-2 font-medium">
        <span className={clsx(trendUp ? 'text-green-600' : 'text-red-500')}>
          {trendUp ? '▲' : '▼'} {trend}
        </span>
        <span className="text-gray-400">vs last month</span>
      </div>
    </div>
  );
}

// ── Leads Progress Indicator Card ────────────────────────────────────────────
function LeadsProgressIndicator({ pipelineData }: { pipelineData: any[] }) {
  const stagesOrder = ['OPEN', 'CONTACTED', 'PROPOSAL_SENT', 'IN_DISCUSSION', 'LOGIN_PROGRESS', 'PAYMENT_DONE'];
  const stageColors: Record<string, string> = {
    OPEN: 'bg-blue-500',
    CONTACTED: 'bg-indigo-500',
    PROPOSAL_SENT: 'bg-amber-500',
    IN_DISCUSSION: 'bg-orange-500',
    LOGIN_PROGRESS: 'bg-purple-500',
    PAYMENT_DONE: 'bg-emerald-500',
  };
  const stageLabels: Record<string, string> = {
    OPEN: 'Open',
    CONTACTED: 'Contacted',
    PROPOSAL_SENT: 'Proposal Sent',
    IN_DISCUSSION: 'In Discussion',
    LOGIN_PROGRESS: 'Login Progress',
    PAYMENT_DONE: 'Won / Payment Done',
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
    return Array.from(map.values()).slice(0, 10);
  }, [filteredClaims]);

  // Graph Data 2: Cashless vs Reimburse
  const typeGraphData = useMemo(() => {
    const map = new Map<string, number>();
    filteredClaims.forEach((c: any) => {
      const type = c.claimType || 'Unknown';
      map.set(type, (map.get(type) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
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
        <BarChartWidget
          title="Claimed vs Settled Amount by Company (₹)"
          data={companyGraphData}
          xKey="company"
          bars={[
            { key: 'claimed', label: 'Claimed (₹)', color: '#3b82f6' },
            { key: 'settled', label: 'Settled (₹)', color: '#10b981' }
          ]}
        />
        
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

        <PieChartWidget
          title="Claims by Cashless / Reimbursement"
          data={typeGraphData}
          nameKey="name"
          valueKey="value"
        />
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
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshAll}
            className="btn-secondary h-9 py-0 px-3 text-xs flex items-center gap-1.5 font-bold"
          >
            <RefreshCw size={13} className={kpiLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => navigate('/policies?action=new')}
            className="btn-primary h-9 py-0 px-3 text-xs flex items-center gap-1.5 font-bold"
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

          {/* ── Mid-section: Chart + Portfolio Donut ─────────────────────────── */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Line Chart */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm relative">
              <div className="absolute right-5 top-5 z-10 flex items-center gap-2">
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
              <div className="absolute right-5 top-5 z-10 flex items-center gap-1.5">
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
                    <li key={a.id} className="flex items-center gap-3 p-1 rounded-xl">
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

          {/* ── Footer KPI summary widgets ─────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                <CheckCircle size={22} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Claim Settlement Ratio</p>
                <p className="text-xl font-black text-gray-900 mt-1">92.4%</p>
                <span className="text-[10px] font-bold text-green-600">▲ +4.6% <span className="text-gray-400 font-medium">vs last month</span></span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                <RefreshCw size={22} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Renewal Rate</p>
                <p className="text-xl font-black text-gray-900 mt-1">87.6%</p>
                <span className="text-[10px] font-bold text-green-600">▲ +3.7% <span className="text-gray-400 font-medium">vs last month</span></span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition">
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
