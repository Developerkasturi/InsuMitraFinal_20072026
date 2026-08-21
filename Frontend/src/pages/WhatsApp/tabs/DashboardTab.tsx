import React, { useState } from 'react';
import {
  MessageSquare, Send, CheckCheck, Eye, AlertCircle,
  Reply, Sparkles, TrendingUp, Clock, AlertTriangle,
  Play, Pause, ArrowUpRight, ArrowDownRight, Calendar,
  ChevronRight, Users, ShieldAlert, CheckCircle2, X,
  ShieldCheck, Smartphone, Zap, RefreshCw, Layers
} from 'lucide-react';
import { MOCK_WHATSAPP_DATA } from '../mockData';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

interface Props {
  onNavigateTab: (tab: string) => void;
  onOpenNewAutomation: () => void;
  onOpenNewCampaign: () => void;
}

export default function DashboardTab({ onNavigateTab, onOpenNewAutomation, onOpenNewCampaign }: Props) {
  const [upcomingFilter, setUpcomingFilter] = useState<'today' | 'tomorrow' | 'week'>('today');
  const d = MOCK_WHATSAPP_DATA.dashboard;
  const quality = MOCK_WHATSAPP_DATA.quality;

  const donutData = [
    { name: 'Delivered', value: d.deliveryRate, color: '#10b981' },
    { name: 'Failed', value: +(100 - d.deliveryRate).toFixed(1), color: '#ef4444' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Top Quality & Operational Tier Bar ── */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">

        {/* Left: Quality Rating & Status */}
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold">
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">Meta Quality Rating: HIGH</span>
              <span className="px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                Score {quality.qualityScore}/100
              </span>
            </div>
            <p className="text-xs text-white/70 mt-0.5">
              Phone: <strong>{MOCK_WHATSAPP_DATA.agent.waNumber}</strong> · Block Rate: <strong>{quality.blockReportRate}</strong> (Threshold &lt;0.50%)
            </p>
          </div>
        </div>

        {/* Center: Daily Tier Limit Progress */}
        <div className="flex-1 max-w-xs space-y-1">
          <div className="flex justify-between text-[11px] font-bold">
            <span className="text-white/80">Daily Limit: {quality.tier}</span>
            <span className="text-emerald-400">{quality.dailyUsed.toLocaleString()} / {quality.dailyLimit.toLocaleString()}</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full"
              style={{ width: `${(quality.dailyUsed / quality.dailyLimit) * 100}%` }}
            />
          </div>
          <div className="text-[10px] text-white/50 text-right">
            {quality.limitRemaining.toLocaleString()} messages remaining today
          </div>
        </div>

        {/* Right Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenNewCampaign}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Send size={13} />
            <span>Launch Campaign</span>
          </button>
          <button
            onClick={onOpenNewAutomation}
            className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/15 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Zap size={13} />
            <span>New Automation</span>
          </button>
        </div>

      </div>

      {/* ── Needs Attention Operational Center ── */}
      {quality.attentionAlerts && quality.attentionAlerts.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-extrabold text-amber-900 uppercase tracking-wider">
              <AlertTriangle size={15} className="text-amber-600" />
              <span>Needs Immediate Attention ({quality.attentionAlerts.length} Action Items)</span>
            </div>
            <span className="text-[11px] text-amber-800 font-semibold">Proactive resolution prevents broadcast disruptions</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
            {quality.attentionAlerts.map((alt) => (
              <div
                key={alt.id}
                className="p-3 rounded-xl bg-white border border-amber-200 shadow-2xs flex flex-col justify-between gap-2"
              >
                <div className="text-xs font-bold text-slate-800 leading-snug">
                  {alt.title}
                </div>
                <button
                  onClick={() => onNavigateTab(alt.tabTarget)}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] transition-all flex items-center justify-between cursor-pointer"
                >
                  <span>{alt.action}</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── KPI Row 1: Primary Metrics ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3.5">

        {/* Total Today */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Today</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <MessageSquare size={14} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-800 tracking-tight">{d.today.total.toLocaleString()}</div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 mt-0.5">
              <ArrowUpRight size={12} /> +12% vs y'day
            </div>
          </div>
        </div>

        {/* Sent */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Sent</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Send size={14} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-800 tracking-tight">{d.today.sent.toLocaleString()}</div>
            <div className="text-[11px] font-semibold text-slate-500 mt-0.5">95.3% processed</div>
          </div>
        </div>

        {/* Delivered */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Delivered</span>
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <CheckCheck size={14} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-teal-700 tracking-tight">{d.today.delivered.toLocaleString()}</div>
            <div className="text-[11px] font-semibold text-emerald-600 mt-0.5">97.2% rate</div>
          </div>
        </div>

        {/* Read */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Read</span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Eye size={14} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-sky-700 tracking-tight">{d.today.read.toLocaleString()}</div>
            <div className="text-[11px] font-semibold text-sky-600 mt-0.5">77.1% open rate</div>
          </div>
        </div>

        {/* Replies */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Replies</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Reply size={14} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-purple-700 tracking-tight">{d.today.replies.toLocaleString()}</div>
            <div className="text-[11px] font-semibold text-purple-600 mt-0.5">12.4% reply rate</div>
          </div>
        </div>

        {/* Leads Generated */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-white border border-emerald-500/30 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="pointer-events-none absolute -right-4 -bottom-4 w-16 h-16 rounded-full bg-emerald-500/10 blur-lg" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
              <Sparkles size={11} className="text-emerald-600" />
              Leads Created
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <TrendingUp size={14} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-emerald-800 tracking-tight">{d.today.leadsGenerated}</div>
            <div className="text-[11px] font-bold text-emerald-700 mt-0.5">Direct to CRM 🎯</div>
          </div>
        </div>

        {/* Failed */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Failed</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle size={14} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-rose-600 tracking-tight">{d.today.failed}</div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-500 mt-0.5">
              <ArrowDownRight size={12} /> 2.8% error rate
            </div>
          </div>
        </div>

      </div>

      {/* ── KPI Row 2: Module Status ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">

        <div
          onClick={() => onNavigateTab('history')}
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Upcoming Messages</span>
            <Clock size={16} className="text-blue-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl font-black text-slate-800 mt-2">{d.active.upcomingMessages}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Scheduled for today &amp; next 7 days</div>
        </div>

        <div
          onClick={() => onNavigateTab('automations')}
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Active Automations</span>
            <Play size={16} className="text-emerald-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl font-black text-slate-800 mt-2">{d.active.automations}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-0.5">6 Active · 1 Paused</div>
        </div>

        <div
          onClick={() => onNavigateTab('campaigns')}
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-purple-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Active Campaigns</span>
            <Send size={16} className="text-purple-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl font-black text-slate-800 mt-2">{d.active.campaigns}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">1 Running · 1 Scheduled · 1 Draft</div>
        </div>

        <div
          onClick={() => onNavigateTab('templates')}
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Meta Approvals</span>
            <AlertTriangle size={16} className="text-amber-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl font-black text-slate-800 mt-2">{d.active.pendingApprovals}</div>
          <div className="text-[11px] text-amber-600 font-medium mt-0.5">1 Pending · 1 Rejected by Meta</div>
        </div>

      </div>

      {/* ── Grid 2: Upcoming Schedules & Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Upcoming Messages List */}
        <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">Upcoming Scheduled Messages</h3>
              <p className="text-xs text-slate-400">Automated triggers firing automatically</p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {(['today', 'tomorrow', 'week'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setUpcomingFilter(tab)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg capitalize transition-all ${upcomingFilter === tab
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  {tab === 'week' ? 'Next 7 Days' : tab}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {MOCK_WHATSAPP_DATA.upcoming.map((item) => (
              <div key={item.id} className="p-3.5 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${item.color} text-white font-bold text-xs flex items-center justify-center shadow-sm`}>
                    {item.avatar}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">{item.contact}</div>
                    <div className="text-[11px] text-slate-500">{item.type} · <span className="text-slate-400">{item.detail}</span></div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="inline-block px-2.5 py-0.5 text-[11px] font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                      {item.time} ({item.date})
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg transition-all">
                      View
                    </button>
                    <button className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs text-slate-500">Showing scheduled automated jobs</span>
            <button
              onClick={() => onNavigateTab('history')}
              className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
            >
              View Full Schedule Logs <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* Attention Required Card */}
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert size={16} className="text-amber-500" />
                <h3 className="text-sm font-extrabold text-slate-800">Attention Required</h3>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-700">
                5 Action Items
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <div className="p-3 rounded-xl bg-rose-50/80 border border-rose-100 text-center">
                <div className="text-lg font-black text-rose-600">{d.attention.failed}</div>
                <div className="text-[10px] font-bold text-rose-700 mt-0.5">Failed Messages</div>
                <div className="text-[9px] text-slate-400">Last 24 hours</div>
              </div>
              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-100 text-center">
                <div className="text-lg font-black text-amber-600">{d.attention.invalidNumbers}</div>
                <div className="text-[10px] font-bold text-amber-700 mt-0.5">Invalid WA No.</div>
                <div className="text-[9px] text-slate-400">Requires correction</div>
              </div>
              <div className="p-3 rounded-xl bg-rose-50/80 border border-rose-100 text-center">
                <div className="text-lg font-black text-rose-600">{d.attention.templateRejected}</div>
                <div className="text-[10px] font-bold text-rose-700 mt-0.5">Rejected Template</div>
                <div className="text-[9px] text-slate-400">Claim Awareness</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <div className="text-lg font-black text-slate-600">{d.attention.optedOut}</div>
                <div className="text-[10px] font-bold text-slate-700 mt-0.5">Opted Out</div>
                <div className="text-[9px] text-slate-400">Excluded automatically</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle size={13} className="text-amber-600" />
                Campaign Notice
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                60 messages failed in <strong>Health Awareness Aug</strong> due to unverified recipient numbers.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('templates')}
            className="w-full mt-4 py-2 px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all"
          >
            Review &amp; Resolve Alerts
          </button>
        </div>

      </div>

      {/* ── Chart Row: Weekly Volume + Rates ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Weekly Bar Chart */}
        <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">Weekly Message Volume &amp; Leads</h3>
              <p className="text-xs text-slate-400">Daily message throughput vs. CRM leads generated</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block" /> Sent
              </span>
              <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Leads Generated
              </span>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', color: '#fff', border: 'none', fontSize: '12px' }}
                />
                <Bar dataKey="sent" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Sent Messages" />
                <Bar dataKey="leads" fill="#10b981" radius={[4, 4, 0, 0]} name="Leads Generated" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rate Doughnut & Progress */}
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 mb-1">Performance Benchmarks</h3>
            <p className="text-xs text-slate-400 mb-4">30-day aggregate quality scores</p>

            <div className="space-y-3.5">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-600">Delivery Success</span>
                  <span className="text-emerald-600">97.2%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '97.2%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-600">Read / Open Rate</span>
                  <span className="text-blue-600">77.1%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: '77.1%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-600">Response / Reply Rate</span>
                  <span className="text-purple-600">12.4%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: '12.4%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-600">Lead Conversion Rate</span>
                  <span className="text-emerald-700 font-extrabold">4.8% 🎯</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full" style={{ width: '48%' }} />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Meta API v19.0 Cloud</span>
            <span className="font-semibold text-emerald-600">● 100% SLA Uptime</span>
          </div>
        </div>

      </div>

    </div>
  );
}
