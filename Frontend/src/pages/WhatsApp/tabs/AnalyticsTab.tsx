import React, { useState } from 'react';
import {
  TrendingUp, Sparkles, Send, CheckCheck, Eye, Reply,
  PieChart as PieIcon, BarChart2, ShieldCheck, ArrowUpRight,
  ArrowDownRight, DollarSign, Clock, HelpCircle, Download,
  Layers, ChevronRight, CheckCircle2, Zap, Calendar, Filter
} from 'lucide-react';
import { MOCK_WHATSAPP_DATA } from '../mockData';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import toast from 'react-hot-toast';

export default function AnalyticsTab() {
  const [timeRange, setTimeRange] = useState<'7D' | '30D' | '90D'>('30D');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'UTILITY' | 'MARKETING' | 'AUTHENTICATION'>('ALL');
  const d = MOCK_WHATSAPP_DATA.dashboard;

  const funnelSteps = [
    { label: 'Target Audience Identified', count: 4104, pct: '100%', sub: 'CRM Opted-in recipients', color: 'bg-indigo-600' },
    { label: 'Dispatched via Meta Cloud API', count: 4050, pct: '98.7%', sub: '54 excluded by Throttle/Opt-Out', color: 'bg-blue-600' },
    { label: 'Delivered to Recipient Handset', count: 3975, pct: '98.1%', sub: '75 network / invalid failures', color: 'bg-teal-600' },
    { label: 'Read / Opened (Blue Ticks)', count: 3090, pct: '77.7%', sub: '3.7x higher than email open rate', color: 'bg-sky-600' },
    { label: 'Customer Replied / Interactive Click', count: 520, pct: '13.1%', sub: 'Quick Reply CTAs + Inquiries', color: 'bg-purple-600' },
    { label: 'Converted to CRM Leads 🎯', count: 142, pct: '3.6%', sub: 'Auto-synced to Sales Pipeline', color: 'bg-emerald-600' },
  ];

  const templateLeaderboard = [
    { name: 'Policy Renewal Reminder (T001)', category: 'UTILITY', sent: 1240, deliveredPct: '98.4%', readPct: '82.1%', replyPct: '16.4%', leads: 58, cost: '₹148.80' },
    { name: 'Preventive Health Checkup Voucher (T003)', category: 'MARKETING', sent: 890, deliveredPct: '97.2%', readPct: '74.5%', replyPct: '12.8%', leads: 34, cost: '₹694.20' },
    { name: 'Diwali Festive Greeting & Family Offer (T002)', category: 'MARKETING', sent: 650, deliveredPct: '96.8%', readPct: '71.2%', replyPct: '8.4%', leads: 22, cost: '₹507.00' },
    { name: 'Lead Welcome & Brochure PDF (T005)', category: 'UTILITY', sent: 480, deliveredPct: '99.1%', readPct: '88.3%', replyPct: '24.2%', leads: 28, cost: '₹57.60' },
  ];

  const monthlyTrendData = [
    { day: 'Day 1', sent: 120, delivered: 118, read: 92, replies: 14, leads: 4 },
    { day: 'Day 5', sent: 180, delivered: 176, read: 142, replies: 22, leads: 7 },
    { day: 'Day 10', sent: 260, delivered: 254, read: 202, replies: 38, leads: 11 },
    { day: 'Day 15', sent: 310, delivered: 304, read: 245, replies: 44, leads: 14 },
    { day: 'Day 20', sent: 420, delivered: 412, read: 330, replies: 56, leads: 18 },
    { day: 'Day 25', sent: 380, delivered: 374, read: 298, replies: 48, leads: 15 },
    { day: 'Day 30', sent: 490, delivered: 482, read: 395, replies: 64, leads: 21 },
  ];

  const costData = [
    { category: 'Utility (Transactional)', count: 2450, rate: '₹0.12', total: '₹294.00', color: '#3b82f6' },
    { category: 'Marketing (Broadcasts)', count: 1540, rate: '₹0.78', total: '₹1,201.20', color: '#8b5cf6' },
    { category: 'Authentication (OTP)', count: 320, rate: '₹0.15', total: '₹48.00', color: '#10b981' },
    { category: 'Service (24h Window)', count: 890, rate: '₹0.00 (Free)', total: '₹0.00', color: '#6b7280' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Top Bar & Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-slate-800">WhatsApp ROI, Funnel &amp; Cost Analytics</h3>
            <span className="px-2 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              Meta Cloud API
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            End-to-end conversation economics, template performance, drop-off waterfall &amp; direct CRM lead pipeline
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Time Range Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {(['7D', '30D', '90D'] as const).map(tr => (
              <button
                key={tr}
                onClick={() => setTimeRange(tr)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${timeRange === tr
                    ? 'bg-white text-slate-800 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                  }`}
              >
                {tr === '7D' ? 'Last 7 Days' : tr === '30D' ? 'Last 30 Days' : 'Quarter'}
              </button>
            ))}
          </div>

          <button
            onClick={() => toast.success('Exporting detailed Analytics report PDF...')}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Download size={14} /> Export Report
          </button>
        </div>
      </div>

      {/* ── KPI Row: High-Impact ROI Metrics ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">

        {/* Total Pipeline Generated */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-white border border-emerald-300 shadow-xs relative overflow-hidden">
          <div className="pointer-events-none absolute -right-3 -bottom-3 w-16 h-16 rounded-full bg-emerald-500/10 blur-md" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Direct CRM Pipeline</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <TrendingUp size={14} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-800 mt-2">₹4,80,000</div>
          <div className="text-xs font-bold text-emerald-700 mt-0.5 flex items-center gap-1">
            <Sparkles size={11} /> 142 Qualified Leads Generated
          </div>
        </div>

        {/* Total Meta Spend & ROI */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Meta API Cost</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <DollarSign size={14} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 mt-2">₹1,543.20</div>
          <div className="text-xs font-bold text-purple-700 mt-0.5">
            311x Return on Ad Spend (ROAS)
          </div>
        </div>

        {/* Read Rate Benchmark */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Average Open / Read</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Eye size={14} />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-600 mt-2">{d.readRate}%</div>
          <div className="text-xs text-blue-500 font-semibold mt-0.5">
            3.7x higher engagement than email
          </div>
        </div>

        {/* Avg Response Time */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Bot Avg Response Time</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock size={14} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 mt-2">1.8 seconds</div>
          <div className="text-xs text-emerald-600 font-semibold mt-0.5">
            84% queries auto-resolved by AI
          </div>
        </div>

      </div>

      {/* ── Grid 2: Conversion Funnel Waterfall + Meta Cost Calculator ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Conversion Funnel (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl bg-white border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-extrabold text-slate-800">End-to-End Audience Conversion Waterfall</h4>
              <p className="text-xs text-slate-400">Step-by-step engagement from opt-in dispatch to pipeline lead</p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              3.6% End-to-End Conv.
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {funnelSteps.map((step, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-700">{step.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-normal text-[11px]">{step.sub}</span>
                    <span className="text-slate-800 font-mono">{step.count.toLocaleString()} ({step.pct})</span>
                  </div>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full ${step.color} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.max(6, 100 - idx * 16)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Meta Cost Breakdown by Category (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-slate-800">Meta Conversation Cost Calculator</h4>
              <span className="text-[10px] font-mono text-slate-400">Per 24h Window</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Categorized pricing billed by Meta Cloud API</p>

            <div className="divide-y divide-slate-100 mt-3">
              {costData.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <div>
                      <div className="font-bold text-slate-800">{item.category}</div>
                      <div className="text-[10px] text-slate-400">{item.count.toLocaleString()} msgs @ {item.rate}</div>
                    </div>
                  </div>
                  <div className="font-extrabold font-mono text-slate-800">{item.total}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs flex justify-between items-center font-bold">
            <span className="text-slate-600">Total Meta Invoiced Cost:</span>
            <span className="text-purple-700 font-mono text-sm">₹1,543.20</span>
          </div>
        </div>

      </div>

      {/* ── Chart: 30-Day Volume & Lead Acquisition Trajectory ── */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-extrabold text-slate-800">30-Day Message Velocity &amp; Lead Trajectory</h4>
            <p className="text-xs text-slate-400">Correlating broadcast dispatches with real-time incoming CRM leads</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500" /> Dispatched</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-teal-500" /> Read</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500" /> Leads Captured</span>
          </div>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyTrendData}>
              <defs>
                <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorRead" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="sent" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorSent)" />
              <Area type="monotone" dataKey="read" stroke="#14b8a6" strokeWidth={2} fillOpacity={1} fill="url(#colorRead)" />
              <Area type="monotone" dataKey="leads" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorLeads)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Template Performance Leaderboard Table ── */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-extrabold text-slate-800">Template Conversion Leaderboard</h4>
            <p className="text-xs text-slate-400">Compare delivery rates, read rates, and pipeline generation per Meta template</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Template Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Dispatched</th>
                <th className="py-3 px-4">Delivered</th>
                <th className="py-3 px-4">Read Rate</th>
                <th className="py-3 px-4">Reply Rate</th>
                <th className="py-3 px-4">Leads Won</th>
                <th className="py-3 px-4 text-right">Meta Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {templateLeaderboard.map((tpl, i) => (
                <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-800">{tpl.name}</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      {tpl.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono">{tpl.sent.toLocaleString()}</td>
                  <td className="py-3.5 px-4 text-teal-700 font-semibold">{tpl.deliveredPct}</td>
                  <td className="py-3.5 px-4 text-blue-700 font-semibold">{tpl.readPct}</td>
                  <td className="py-3.5 px-4 text-purple-700 font-semibold">{tpl.replyPct}</td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <Sparkles size={11} className="text-emerald-600" />
                      {tpl.leads} Leads
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800">{tpl.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
