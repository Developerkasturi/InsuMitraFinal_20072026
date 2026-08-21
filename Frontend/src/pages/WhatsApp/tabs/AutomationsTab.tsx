import React, { useState } from 'react';
import {
  Plus, Search, Play, Pause, Trash2, Edit3,
  CheckCircle2, AlertTriangle, Sparkles, TrendingUp,
  Clock, ShieldAlert, ArrowUpRight, Users, Eye,
  Zap, Database, ArrowRight, Shield, Filter,
  FileText, Target, ChevronDown, ChevronUp, Calendar,
  RefreshCw, Heart, Gift, UserCheck, Bell
} from 'lucide-react';
import { MOCK_WHATSAPP_DATA } from '../mockData';
import AutomationBuilderModal from '../components/AutomationBuilderModal';
import AudienceManagementModal from '../components/AudienceManagementModal';
import { WhatsAppLeadContext } from '../components/WhatsAppLeadModal';
import toast from 'react-hot-toast';

interface Props {
  onOpenBuilder: () => void;
  onOpenLeadModal?: (ctx: WhatsAppLeadContext) => void;
}

// Group config matching backend queues
const GROUPS = [
  {
    key: 'policy-lifecycle',
    label: 'Policy Lifecycle Automations',
    subtitle: 'Driven by policy-renewal & payment-reminder BullMQ queues',
    icon: Shield,
    color: 'blue',
    bgGradient: 'from-blue-50/80 to-indigo-50/80',
    borderColor: 'border-blue-200/80',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    badgeColor: 'bg-blue-600',
  },
  {
    key: 'customer-events',
    label: 'Customer Event Automations',
    subtitle: 'Driven by the reminders BullMQ queue — birthdays, PHC, follow-ups',
    icon: Heart,
    color: 'purple',
    bgGradient: 'from-purple-50/80 to-fuchsia-50/80',
    borderColor: 'border-purple-200/80',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    badgeColor: 'bg-purple-600',
  },
  {
    key: 'smart-triggers',
    label: 'Smart Campaign Triggers',
    subtitle: 'Real-time event triggers via triggerEventCampaign() service',
    icon: Zap,
    color: 'amber',
    bgGradient: 'from-amber-50/80 to-orange-50/80',
    borderColor: 'border-amber-200/80',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    badgeColor: 'bg-amber-600',
  },
];

const PIPELINE_ICONS: Record<string, React.ElementType> = {
  clock: Clock,
  filter: Filter,
  template: FileText,
  lead: Target,
  stop: Shield,
  event: Zap,
};

export default function AutomationsTab({ onOpenBuilder, onOpenLeadModal }: Props) {
  const [automations, setAutomations] = useState(MOCK_WHATSAPP_DATA.automations);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [editTarget, setEditTarget] = useState<any>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set(['A001']));

  // Audience Modal state
  const [audienceModalOpen, setAudienceModalOpen] = useState(false);
  const [audienceTarget, setAudienceTarget] = useState<any>(null);

  // Simulation Modal state
  const [simulationModalOpen, setSimulationModalOpen] = useState(false);
  const [simulationTarget, setSimulationTarget] = useState<any>(null);

  const handleSimulate = (a: any) => {
    setSimulationTarget(a);
    setSimulationModalOpen(true);
  };

  const toggleCardExpand = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredAutomations = automations.filter((a: any) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = a.name.toLowerCase().includes(q) ||
      a.trigger.toLowerCase().includes(q) ||
      a.description?.toLowerCase().includes(q);
    const matchesCat = categoryFilter === 'ALL' || a.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const getGroupAutomations = (groupKey: string) =>
    filteredAutomations.filter((a: any) => a.group === groupKey);

  const handleToggleActive = (id: string) => {
    setAutomations(prev => prev.map(a => {
      if (a.id === id) {
        const nextStatus = a.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
        toast.success(`Automation ${a.name} is now ${nextStatus}`);
        return { ...a, status: nextStatus };
      }
      return a;
    }));
  };

  const handleSaveAutomation = (updated: any) => {
    setAutomations(prev => {
      const idx = prev.findIndex(a => a.id === updated.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...updated };
        return copy;
      }
      return [updated, ...prev];
    });
  };

  const handleOpenAudience = (a: any) => {
    setAudienceTarget({
      id: a.id,
      name: a.name,
      category: a.category,
      trigger: a.trigger,
      type: 'AUTOMATION',
    });
    setAudienceModalOpen(true);
  };

  const handleSaveAudience = (res: any) => {
    setAutomations(prev => prev.map(a => {
      if (a.id === res.targetId) {
        return { ...a, audienceCount: res.totalCount };
      }
      return a;
    }));
  };

  const getAudienceCount = (a: any) => {
    const autoAud = (MOCK_WHATSAPP_DATA.automationAudiences as any)[a.id];
    return a.audienceCount !== undefined ? a.audienceCount : (autoAud?.contactIds?.length || 4);
  };

  // Summary stats
  const totalActive = automations.filter(a => a.status === 'ACTIVE').length;
  const totalSent = automations.reduce((s, a) => s + a.sent, 0);
  const totalLeads = automations.reduce((s, a) => s + a.leadsGenerated, 0);
  const totalReplied = automations.reduce((s, a) => s + a.replied, 0);

  return (
    <div className="space-y-6">

      {/* ── Header Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <Zap size={18} className="text-blue-600" />
            Precise Automation Engine
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Event-driven triggers with auto-computed policy renewal, installment schedules & CRM integration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditTarget(null);
              setBuilderOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus size={15} /> Create Automation Rule
          </button>
        </div>
      </div>

      {/* ── Summary Stats Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Rules', value: `${totalActive}/${automations.length}`, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Messages Sent', value: totalSent.toLocaleString(), icon: ArrowUpRight, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Total Replies', value: totalReplied.toLocaleString(), icon: Bell, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Leads Generated', value: totalLeads.toLocaleString(), icon: Target, color: 'text-amber-600', bg: 'bg-amber-50' },
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

      {/* ── Filter Tabs & Search ── */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'Policy', 'PHC', 'Customer', 'Events'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${categoryFilter === cat
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              {cat === 'ALL' ? 'All Automations' : cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search triggers, queues, or rules..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
          />
        </div>
      </div>

      {/* ── Grouped Automation Cards ── */}
      {GROUPS.map((group) => {
        const groupItems = getGroupAutomations(group.key);
        if (groupItems.length === 0 && (searchQuery || categoryFilter !== 'ALL')) return null;
        const GroupIcon = group.icon;

        return (
          <div key={group.key} className="space-y-3">
            {/* Group Header */}
            <div className={`flex items-center gap-3 p-3.5 rounded-2xl bg-gradient-to-r ${group.bgGradient} border ${group.borderColor}`}>
              <div className={`w-8 h-8 rounded-xl ${group.iconBg} flex items-center justify-center`}>
                <GroupIcon size={16} className={group.iconColor} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-extrabold text-slate-800">{group.label}</div>
                <div className="text-[11px] text-slate-500">{group.subtitle}</div>
              </div>
              <span className={`${group.badgeColor} text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full`}>
                {groupItems.length} rules
              </span>
            </div>

            {/* Automation Cards */}
            <div className="grid grid-cols-1 gap-3">
              {groupItems.map((a: any) => {
                const isActive = a.status === 'ACTIVE';
                const isExpanded = expandedCards.has(a.id);
                const audCount = getAudienceCount(a);
                const deliveryRate = a.sent > 0 ? ((a.delivered / a.sent) * 100).toFixed(1) : '0';
                const readRate = a.delivered > 0 ? ((a.read / a.delivered) * 100).toFixed(1) : '0';
                const replyRate = a.sent > 0 ? ((a.replied / a.sent) * 100).toFixed(1) : '0';

                return (
                  <div
                    key={a.id}
                    className={`rounded-2xl bg-white border shadow-xs overflow-hidden transition-all ${isActive ? 'border-slate-200/80' : 'border-amber-200/80 bg-amber-50/10'
                      }`}
                  >
                    {/* ── Card Main Row ── */}
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">

                      {/* Left: Info & Badges */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="pt-1">
                          <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-amber-400'}`} />
                        </div>

                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-extrabold text-slate-800">{a.name}</h4>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                              {isActive ? 'Active' : 'Paused'}
                            </span>
                            {a.autoGenerateLeadOnReply && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                                <Sparkles size={9} /> Auto-Lead Capture
                              </span>
                            )}
                          </div>

                          {/* Trigger + Backend mapping tags */}
                          <div className="flex items-center gap-1.5 flex-wrap text-xs">
                            <span className="inline-block px-2 py-0.5 font-mono text-[10px] font-bold rounded bg-blue-50 text-blue-700 border border-blue-100">
                              {a.trigger}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-600 border border-slate-200">
                              <Database size={9} />
                              {a.dataSource}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-600 border border-slate-200">
                              <Clock size={9} />
                              {a.cronSchedule}
                            </span>
                            <span className="text-[11px] text-slate-400">· Template: {a.template}</span>
                          </div>

                          {/* Pipeline Step Pills */}
                          {a.pipelineSteps && (
                            <div className="flex items-center gap-1 pt-1 flex-wrap">
                              {a.pipelineSteps.map((step: any, idx: number) => {
                                const StepIcon = PIPELINE_ICONS[step.icon] || Zap;
                                return (
                                  <React.Fragment key={idx}>
                                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[10px]">
                                      <StepIcon size={10} className="text-slate-500" />
                                      <span className="font-bold text-slate-700">{step.label}</span>
                                      <span className="text-slate-400 hidden sm:inline">({step.detail})</span>
                                    </div>
                                    {idx < a.pipelineSteps.length - 1 && (
                                      <ArrowRight size={9} className="text-slate-300 shrink-0" />
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Middle: Metrics */}
                      <div className="flex items-center gap-4 py-2 px-3 rounded-xl bg-slate-50/70 border border-slate-100 shrink-0">
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Audience</div>
                          <button
                            onClick={() => handleOpenAudience(a)}
                            className="inline-flex items-center gap-1 mt-0.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer"
                          >
                            <Users size={12} />
                            {audCount} Enrolled
                          </button>
                        </div>
                        <div className="h-6 w-px bg-slate-200" />
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Sent</div>
                          <div className="text-xs font-extrabold text-slate-800">{a.sent.toLocaleString()}</div>
                        </div>
                        <div className="h-6 w-px bg-slate-200" />
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Leads 🎯</div>
                          <div className="text-xs font-extrabold text-emerald-700">{a.leadsGenerated || 0}</div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5 shrink-0 justify-end">
                        <button
                          onClick={() => handleSimulate(a)}
                          className="px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
                          title="Simulate Pipeline Trigger"
                        >
                          <Zap size={13} /> Simulate
                        </button>
                        <button
                          onClick={() => handleOpenAudience(a)}
                          className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
                          title="Manage Audience"
                        >
                          <Users size={13} /> Audience
                        </button>
                        <button
                          onClick={() => {
                            setEditTarget(a);
                            setBuilderOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                          title="Edit Blueprint"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleToggleActive(a.id)}
                          className={`p-1.5 rounded-xl transition-all cursor-pointer ${isActive
                              ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                          title={isActive ? 'Pause' : 'Activate'}
                        >
                          {isActive ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                        <button
                          onClick={() => toggleCardExpand(a.id)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                          title={isExpanded ? 'Collapse' : 'Expand Execution Plan'}
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* ── Expanded Execution Plan & Precision Blueprint ── */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-3">
                        {a.description && (
                          <p className="text-xs text-slate-600 leading-relaxed font-medium bg-white p-3 rounded-xl border border-slate-200/80">
                            {a.description}
                          </p>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Schedule Steps Timeline */}
                          <div className="rounded-xl bg-white border border-slate-200/80 p-3">
                            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <Calendar size={12} className="text-blue-600" />
                              Calculated Schedule ({a.schedules.length} steps)
                            </div>
                            <div className="space-y-1.5">
                              {a.schedules.map((s: string, i: number) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold flex items-center justify-center shrink-0">
                                    {i + 1}
                                  </div>
                                  <span className="font-mono font-medium text-slate-700">{s}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Conditions & Stop Rules */}
                          <div className="rounded-xl bg-white border border-slate-200/80 p-3">
                            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <Filter size={12} className="text-emerald-600" />
                              Entry Conditions
                            </div>
                            <div className="space-y-1 text-xs">
                              {a.conditions.map((c: string, i: number) => (
                                <div key={i} className="text-slate-600 flex items-center gap-1.5">
                                  <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                                  <span>{c}</span>
                                </div>
                              ))}
                            </div>

                            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-3 mb-1.5 flex items-center gap-1.5">
                              <Shield size={12} className="text-rose-600" />
                              Auto-Stop Rules
                            </div>
                            <div className="space-y-1 text-xs">
                              {a.stopConditions.map((sc: string, i: number) => (
                                <div key={i} className="text-rose-600 flex items-center gap-1.5">
                                  <AlertTriangle size={11} className="text-rose-400 shrink-0" />
                                  <span>{sc}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Backend & Performance Execution */}
                          <div className="rounded-xl bg-white border border-slate-200/80 p-3">
                            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <TrendingUp size={12} className="text-purple-600" />
                              Execution Performance
                            </div>
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between"><span className="text-slate-500">Delivered:</span> <span className="font-bold text-slate-800">{a.delivered?.toLocaleString()} ({deliveryRate}%)</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Read:</span> <span className="font-bold text-slate-800">{a.read?.toLocaleString()} ({readRate}%)</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Replies:</span> <span className="font-bold text-slate-800">{a.replied?.toLocaleString()} ({replyRate}%)</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Leads Generated:</span> <span className="font-bold text-emerald-700">{a.leadsGenerated || 0}</span></div>
                            </div>

                            <div className="mt-3 pt-2 border-t border-slate-100">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Worker Queue Execution</div>
                              <div className="flex items-center gap-1.5">
                                <span className="inline-block px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-slate-800 text-slate-100">
                                  {a.backendQueue}
                                </span>
                                <ArrowRight size={9} className="text-slate-300" />
                                <span className="text-[10px] font-mono text-slate-600">{a.backendJob}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Pause reason if present */}
                        {a.pauseReason && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium">
                            <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                            <span>Notice: {a.pauseReason}</span>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Empty state */}
      {filteredAutomations.length === 0 && (
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs p-12 text-center">
          <Zap size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">No automations match your criteria</p>
          <p className="text-xs text-slate-400 mt-1">Try another search or filter, or create a new automation rule.</p>
        </div>
      )}

      {/* Automation Builder Modal */}
      <AutomationBuilderModal
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onSaved={handleSaveAutomation}
        editTarget={editTarget}
      />

      {/* Audience Inspector & Editor Modal */}
      <AudienceManagementModal
        open={audienceModalOpen}
        onClose={() => setAudienceModalOpen(false)}
        target={audienceTarget}
        mode="AUTOMATION"
        onSave={handleSaveAudience}
        onOpenLeadModal={onOpenLeadModal}
      />

      {/* Pipeline Trigger Dry-Run Simulation Modal */}
      {simulationModalOpen && simulationTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-scale-up">

            <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <Zap size={18} className="text-purple-300" />
                <div>
                  <h3 className="text-base font-extrabold text-white">Simulate Automation Pipeline Trigger</h3>
                  <p className="text-xs text-white/60">Testing rule: {simulationTarget.name}</p>
                </div>
              </div>
              <button
                onClick={() => setSimulationModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs overflow-y-auto">

              {/* Step 1: Input evaluation */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px] text-indigo-700">
                  1. Sample Recipient Context
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div><strong>Customer:</strong> Rajesh Kumar</div>
                  <div><strong>Phone:</strong> +91 98220 12345</div>
                  <div><strong>Policy:</strong> Star Health SH-2024-88821</div>
                  <div><strong>Expiry Date:</strong> 20-Oct-2026 (Due in 15d)</div>
                </div>
              </div>

              {/* Step 2: Conditions Check */}
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1.5 text-emerald-900">
                <div className="font-bold uppercase tracking-wider text-[10px] text-emerald-800">
                  2. Rule &amp; Auto-Stop Criteria Check
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  <span>Entry Condition: <code>Policy Status === ACTIVE</code> → <strong>PASSED</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  <span>Consent Condition: <code>WhatsApp Opt-in === TRUE</code> → <strong>PASSED</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  <span>Stop Rule: <code>Policy Renewed === FALSE</code> → <strong>Dispatches Trigger</strong></span>
                </div>
              </div>

              {/* Step 3: Payload Preview */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2">
                <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-white/10 pb-1.5">
                  <span>Rendered Message Payload</span>
                  <span className="text-emerald-400 font-mono">Meta Template: {simulationTarget.template}</span>
                </div>
                <p className="text-slate-200 leading-relaxed whitespace-pre-line text-xs">
                  Hello <strong>Rajesh</strong>, your Star Health policy <strong>SH-2024-88821</strong> is due for renewal in <strong>15 days</strong> (20-Oct-2026). Premium: ₹24,500. Reply to pay online or speak with your advisor.
                </p>
              </div>

            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => setSimulationModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Close Simulator
              </button>
              <button
                onClick={() => {
                  toast.success(`Dry-run test message dispatched to test handset!`);
                  setSimulationModalOpen(false);
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Play size={13} />
                <span>Send Test Handset Dispatch</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

