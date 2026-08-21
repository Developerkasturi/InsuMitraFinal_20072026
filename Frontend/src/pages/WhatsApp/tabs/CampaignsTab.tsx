import React, { useState } from 'react';
import {
  Rocket, Plus, Search, Filter, Play, Pause, CheckCircle2,
  Clock, AlertCircle, Sparkles, TrendingUp, Send, Users,
  BarChart2, Wallet, Database, ArrowRight, Check, AlertTriangle,
  Zap, Calendar, ChevronRight
} from 'lucide-react';
import { MOCK_WHATSAPP_DATA } from '../mockData';
import CampaignWizardModal from '../components/CampaignWizardModal';
import AudienceManagementModal from '../components/AudienceManagementModal';
import CampaignAnalyticsModal from '../components/CampaignAnalyticsModal';
import { WhatsAppLeadContext } from '../components/WhatsAppLeadModal';
import toast from 'react-hot-toast';

interface Props {
  onOpenWizard: () => void;
  onOpenLeadModal?: (ctx: WhatsAppLeadContext) => void;
}

export default function CampaignsTab({ onOpenWizard, onOpenLeadModal }: Props) {
  const [campaigns, setCampaigns] = useState<any[]>(MOCK_WHATSAPP_DATA.campaigns);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Audience modal state
  const [audienceModalOpen, setAudienceModalOpen] = useState(false);
  const [audienceTarget, setAudienceTarget] = useState<any>(null);

  // Campaign Analytics modal state
  const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false);
  const [analyticsCampaign, setAnalyticsCampaign] = useState<any>(null);

  const filteredCampaigns = campaigns.filter(c => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = c.name.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      c.template.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const matchesCategory = categoryFilter === 'ALL' || c.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const handleLaunched = (newCamp: any) => {
    setCampaigns(prev => [newCamp, ...prev]);
  };

  const handleLaunchNow = (id: string, name: string) => {
    setCampaigns(prev => prev.map(c => {
      if (c.id === id) {
        toast.success(`Campaign "${name}" launched! Enqueued to BullMQ whatsapp-campaigns queue.`);
        return { ...c, status: 'RUNNING', progress: 5, sent: 50, delivered: 48 };
      }
      return c;
    }));
  };

  const handleTogglePause = (id: string) => {
    setCampaigns(prev => prev.map(c => {
      if (c.id === id) {
        const next = c.status === 'RUNNING' ? 'PAUSED' : 'RUNNING';
        toast.success(`Campaign is now ${next}`);
        return { ...c, status: next };
      }
      return c;
    }));
  };

  const handleOpenAudience = (c: any) => {
    setAudienceTarget({
      id: c.id,
      name: c.name,
      category: c.category,
      type: 'CAMPAIGN',
    });
    setAudienceModalOpen(true);
  };

  const handleOpenAnalytics = (c: any) => {
    setAnalyticsCampaign(c);
    setAnalyticsModalOpen(true);
  };

  const handleSaveAudience = (res: any) => {
    setCampaigns(prev => prev.map(c => {
      if (c.id === res.targetId) {
        return { ...c, audience: res.totalCount, totalCost: res.totalCount * (c.costPerMsg || 1) };
      }
      return c;
    }));
  };

  // KPIs
  const totalAudience = campaigns.reduce((s, c) => s + (c.audience || 0), 0);
  const totalSent = campaigns.reduce((s, c) => s + (c.sent || 0), 0);
  const totalLeads = campaigns.reduce((s, c) => s + (c.leadsGenerated || 0), 0);
  const totalCost = campaigns.reduce((s, c) => s + (c.totalCost || 0), 0);

  return (
    <div className="space-y-6">

      {/* ── Header Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <Rocket size={18} className="text-purple-600" />
            WhatsApp Broadcast Campaigns
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Backend-backed message dispatch via BullMQ queues, Meta Cloud templates &amp; direct CRM lead generation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWizardOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-purple-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus size={15} /> Create Campaign Wizard
          </button>
        </div>
      </div>

      {/* ── Summary KPI Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Campaigns', value: campaigns.length, icon: Rocket, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Messages Sent', value: totalSent.toLocaleString(), icon: Send, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'CRM Leads Captured', value: `${totalLeads} 🎯`, icon: Sparkles, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Total Campaign Budget', value: `₹${totalCost.toLocaleString()}`, icon: Wallet, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white border border-slate-200/80 shadow-xs p-3.5 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center`}>
              <s.icon size={16} className={s.color} />
            </div>
            <div>
              <div className="text-base font-extrabold text-slate-800">{s.value}</div>
              <div className="text-[11px] text-slate-500 font-medium">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Spotlight Banner: Live Performance Funnel ── */}
      <div
        onClick={() => handleOpenAnalytics(campaigns[1] || campaigns[0])}
        className="rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 shadow-xl relative overflow-hidden cursor-pointer group hover:border-purple-500/50 border border-transparent transition-all"
        title="Click to view detailed campaign analytics"
      >
        <div className="pointer-events-none absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />

        <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-purple-300">Campaign Spotlight · Funnel &amp; ROI</span>
            <span className="text-xs text-white/60 font-medium">· Claim Awareness H1 2026</span>
          </div>
          <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30 group-hover:bg-emerald-500/20 transition-all">
            ✓ View Full Analytics ↗
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 group-hover:bg-white/10 transition-all">
            <div className="text-xl font-black text-white">2,890</div>
            <div className="text-[10px] uppercase font-bold text-white/50 mt-1">Audience Enrolled</div>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 group-hover:bg-white/10 transition-all">
            <div className="text-xl font-black text-white">2,856</div>
            <div className="text-[10px] uppercase font-bold text-white/50 mt-1">Dispatched</div>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 group-hover:bg-white/10 transition-all">
            <div className="text-xl font-black text-emerald-400">2,801</div>
            <div className="text-[10px] uppercase font-bold text-emerald-300 mt-1">98.1% Delivered</div>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 group-hover:bg-white/10 transition-all">
            <div className="text-xl font-black text-sky-400">2,190</div>
            <div className="text-[10px] uppercase font-bold text-sky-300 mt-1">76.7% Read</div>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 group-hover:bg-white/10 transition-all">
            <div className="text-xl font-black text-purple-400">185</div>
            <div className="text-[10px] uppercase font-bold text-purple-300 mt-1">6.5% Replied</div>
          </div>
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-400/40 group-hover:from-emerald-500/30 group-hover:to-teal-500/30 transition-all">
            <div className="text-xl font-black text-emerald-300">42 🎯</div>
            <div className="text-[10px] uppercase font-bold text-emerald-200 mt-1">Leads Created</div>
          </div>
        </div>
      </div>

      {/* ── Filters & Search ── */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {[
            { key: 'ALL', label: 'All Campaigns' },
            { key: 'RUNNING', label: 'Running ⚡' },
            { key: 'SCHEDULED', label: 'Scheduled 🕐' },
            { key: 'COMPLETED', label: 'Completed ✓' },
            { key: 'PAUSED', label: 'Paused ⏸' },
            { key: 'DRAFT', label: 'Drafts ✏' },
          ].map((st) => (
            <button
              key={st.key}
              onClick={() => setStatusFilter(st.key)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${statusFilter === st.key
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search campaigns, templates..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
          />
        </div>
      </div>

      {/* ── Campaigns Cards Grid ── */}
      <div className="space-y-3">
        {filteredCampaigns.map((c: any) => {
          const isRunning = c.status === 'RUNNING';
          const isCompleted = c.status === 'COMPLETED';
          const isScheduled = c.status === 'SCHEDULED';
          const isPaused = c.status === 'PAUSED';
          const isDraft = c.status === 'DRAFT';

          const deliveryRate = c.sent > 0 ? ((c.delivered / c.sent) * 100).toFixed(1) : '0';
          const readRate = c.delivered > 0 ? ((c.read / c.delivered) * 100).toFixed(1) : '0';

          return (
            <div
              key={c.id}
              className={`rounded-2xl bg-white border shadow-xs p-4 transition-all hover:border-purple-200 ${isRunning ? 'border-blue-300 ring-2 ring-blue-50' : 'border-slate-200/80'
                }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

                {/* Left Section: Info & Meta */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="pt-1">
                    <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-blue-500 animate-pulse' :
                        isCompleted ? 'bg-emerald-500' :
                          isScheduled ? 'bg-purple-500' :
                            isPaused ? 'bg-amber-500' : 'bg-slate-400'
                      }`} />
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-extrabold text-slate-800">{c.name}</h4>

                      {/* Status Badges */}
                      {isRunning && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                          Running ({c.progress || 0}%)
                        </span>
                      )}
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Check size={11} /> Completed
                        </span>
                      )}
                      {isScheduled && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                          <Clock size={11} /> Scheduled
                        </span>
                      )}
                      {isPaused && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          ⏸ Paused
                        </span>
                      )}
                      {isDraft && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600">
                          ✏ Draft
                        </span>
                      )}

                      {c.autoCaptureLeads && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                          <Sparkles size={9} /> Auto-Lead Capture
                        </span>
                      )}
                    </div>

                    {/* Metadata chips */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-700">
                        {c.category} · {c.type}
                      </span>
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Calendar size={11} />
                        {c.scheduledDate}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Template: <strong className="text-slate-700">{c.template}</strong>
                      </span>
                      {c.media && (
                        <span className="text-[11px] text-indigo-600 font-medium">
                          📎 {c.media}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono rounded bg-slate-100 text-slate-600 border border-slate-200">
                        <Database size={9} />
                        {c.backendQueue}
                      </span>
                    </div>

                    {/* Running Progress Bar */}
                    {isRunning && (
                      <div className="pt-1.5 space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-500">
                          <span>Dispatching via BullMQ: {c.sent?.toLocaleString()} / {c.audience?.toLocaleString()} messages</span>
                          <span className="font-bold text-blue-700">{c.progress || 0}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500" style={{ width: `${c.progress || 0}%` }} />
                        </div>
                      </div>
                    )}

                    {c.pauseReason && (
                      <div className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 inline-flex items-center gap-1.5 mt-1">
                        <AlertTriangle size={11} className="text-amber-600" />
                        <span>{c.pauseReason}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Middle Section: Metrics & Cost Pill */}
                <div className="flex items-center gap-4 py-2 px-3.5 rounded-xl bg-slate-50/80 border border-slate-100 shrink-0">
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Target Audience</div>
                    <button
                      onClick={() => handleOpenAudience(c)}
                      className="inline-flex items-center gap-1 mt-0.5 text-xs font-bold text-purple-700 hover:text-purple-900 cursor-pointer"
                    >
                      <Users size={12} />
                      {c.audience?.toLocaleString()} Contacts
                    </button>
                  </div>

                  <div className="h-6 w-px bg-slate-200" />

                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Delivered / Read</div>
                    <div className="text-xs font-extrabold text-slate-800">
                      {c.delivered?.toLocaleString() || 0} <span className="text-[10px] text-slate-400 font-normal">({deliveryRate}%)</span>
                    </div>
                  </div>

                  <div className="h-6 w-px bg-slate-200" />

                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Leads 🎯</div>
                    <div className="text-xs font-extrabold text-emerald-700">
                      {c.leadsGenerated || 0}
                    </div>
                  </div>

                  <div className="h-6 w-px bg-slate-200" />

                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Est. Cost</div>
                    <div className="text-xs font-bold text-slate-700">
                      ₹{(c.totalCost || c.audience || 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Right Section: Actions */}
                <div className="flex items-center gap-1.5 shrink-0 justify-end">
                  <button
                    onClick={() => handleOpenAudience(c)}
                    className="px-2.5 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-50 rounded-xl flex items-center gap-1 transition-all cursor-pointer border border-purple-200/60"
                    title="Inspect and edit enrolled audience"
                  >
                    <Users size={13} /> Audience
                  </button>

                  <button
                    onClick={() => handleOpenAnalytics(c)}
                    className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                    title="View detailed campaign analytics & funnel"
                  >
                    <BarChart2 size={13} /> Analytics
                  </button>

                  {(isDraft || isScheduled) && (
                    <button
                      onClick={() => handleLaunchNow(c.id, c.name)}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                      title="Dispatch campaign now"
                    >
                      <Play size={12} /> Launch Now
                    </button>
                  )}

                  {isRunning && (
                    <button
                      onClick={() => handleTogglePause(c.id)}
                      className="p-1.5 text-amber-700 hover:bg-amber-50 rounded-xl border border-amber-200 transition-all cursor-pointer"
                      title="Pause Campaign"
                    >
                      <Pause size={14} />
                    </button>
                  )}

                  {isPaused && (
                    <button
                      onClick={() => handleTogglePause(c.id)}
                      className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-xl border border-emerald-200 transition-all cursor-pointer"
                      title="Resume Campaign"
                    >
                      <Play size={14} />
                    </button>
                  )}
                </div>

              </div>
            </div>
          );
        })}

        {filteredCampaigns.length === 0 && (
          <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs p-12 text-center">
            <Rocket size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-600">No campaigns found</p>
            <p className="text-xs text-slate-400 mt-1">Try another filter or create a new campaign wizard.</p>
          </div>
        )}
      </div>

      {/* Campaign Wizard Modal */}
      <CampaignWizardModal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onLaunched={handleLaunched}
      />

      {/* Audience Inspector & Editor Modal */}
      <AudienceManagementModal
        open={audienceModalOpen}
        onClose={() => setAudienceModalOpen(false)}
        target={audienceTarget}
        mode="CAMPAIGN"
        onSave={handleSaveAudience}
        onOpenLeadModal={onOpenLeadModal}
      />

      {/* Campaign Analytics Modal */}
      <CampaignAnalyticsModal
        open={analyticsModalOpen}
        onClose={() => setAnalyticsModalOpen(false)}
        campaign={analyticsCampaign}
        onOpenLeadModal={onOpenLeadModal}
      />

    </div>
  );
}

