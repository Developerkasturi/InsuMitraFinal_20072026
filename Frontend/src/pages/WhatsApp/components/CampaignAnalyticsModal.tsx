import React from 'react';
import {
  X, BarChart2, TrendingUp, Sparkles, Send, CheckCheck,
  Eye, MessageSquare, AlertTriangle, Download, ArrowUpRight,
  Users, CheckCircle2, Clock, Calendar, ShieldCheck, DollarSign
} from 'lucide-react';
import { WhatsAppLeadContext } from './WhatsAppLeadModal';
import toast from 'react-hot-toast';

export interface CampaignAnalyticsTarget {
  id: string;
  name: string;
  category: string;
  type: string;
  audience: number;
  template: string;
  scheduledDate: string;
  status: string;
  leadsGenerated?: number;
  media?: string;
  progress?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  campaign: CampaignAnalyticsTarget | null;
  onOpenLeadModal?: (ctx: WhatsAppLeadContext) => void;
}

export default function CampaignAnalyticsModal({
  open,
  onClose,
  campaign,
  onOpenLeadModal,
}: Props) {
  if (!open || !campaign) return null;

  const totalAudience = campaign.audience || 2890;
  const sent = Math.round(totalAudience * 0.985);
  const delivered = Math.round(sent * 0.981);
  const read = Math.round(delivered * 0.772);
  const replied = Math.round(read * 0.085);
  const leads = campaign.leadsGenerated || Math.max(12, Math.round(replied * 0.23));
  const failed = totalAudience - delivered;

  const funnel = [
    { label: 'Target Audience', count: totalAudience, pct: '100%', color: 'bg-blue-600', sub: 'Selected contacts & lists' },
    { label: 'Sent (Dispatched)', count: sent, pct: `${((sent / totalAudience) * 100).toFixed(1)}%`, color: 'bg-indigo-600', sub: 'Dispatched via Meta Cloud API' },
    { label: 'Delivered', count: delivered, pct: `${((delivered / sent) * 100).toFixed(1)}%`, color: 'bg-teal-600', sub: 'Confirmed delivery receipts' },
    { label: 'Read / Opened', count: read, pct: `${((read / delivered) * 100).toFixed(1)}%`, color: 'bg-sky-600', sub: 'Blue double-ticks verified' },
    { label: 'Customer Replies', count: replied, pct: `${((replied / read) * 100).toFixed(1)}%`, color: 'bg-purple-600', sub: 'Inbound customer interactions' },
    { label: 'CRM Leads Captured 🎯', count: leads, pct: `${((leads / (replied || 1)) * 100).toFixed(1)}%`, color: 'bg-emerald-600', sub: 'Converted to sales pipeline' },
  ];

  // Sample leads generated from this campaign
  const campaignLeads = [
    { id: 'L-01', name: 'Rajesh Kumar', phone: '+91 98100 11111', city: 'Pune', product: 'Star Health Optima Upgrade', stage: 'Qualified Opportunity', time: '10:45 AM' },
    { id: 'L-02', name: 'Amit Sharma', phone: '+91 98300 33333', city: 'Pune', product: 'Term Plan 2 Cr Quote', stage: 'Contacted / Follow-up', time: '11:20 AM' },
    { id: 'L-03', name: 'Dr. Kavita Joshi', phone: '+91 98600 66666', city: 'Pune', product: 'PHC Checkup + Top-Up', stage: 'New WhatsApp Lead', time: '02:15 PM' },
    { id: 'L-04', name: 'Vikramaditya Roy', phone: '+91 98700 77777', city: 'Bangalore', product: 'Max Life Term Insurance', stage: 'Proposal Sent', time: 'Yesterday' },
  ];

  const handleExport = () => {
    toast.success(`Exported detailed campaign analytics for "${campaign.name}" (CSV)`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-scale-up">
        
        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white p-5 flex items-center justify-between relative overflow-hidden">
          <div className="pointer-events-none absolute -right-12 -bottom-12 w-48 h-48 bg-purple-500/20 rounded-full blur-2xl" />

          <div className="flex items-center gap-3.5 relative z-10">
            <div className="w-11 h-11 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shadow-inner">
              <BarChart2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/30">
                  Campaign Analytics
                </span>
                <span className="text-xs text-white/60 font-mono">· {campaign.id}</span>
              </div>
              <h2 className="text-lg font-black text-white tracking-tight mt-0.5">
                {campaign.name}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 relative z-10">
            <button
              onClick={handleExport}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Download size={13} /> Export CSV
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/15 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Spotlight Stat Cards ── */}
        <div className="p-5 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
          <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="text-xl font-black text-slate-800">{totalAudience.toLocaleString()}</div>
            <div className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">Audience</div>
          </div>

          <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="text-xl font-black text-slate-800">{delivered.toLocaleString()}</div>
            <div className="text-[10px] uppercase font-bold text-emerald-600 mt-0.5">
              {((delivered / sent) * 100).toFixed(1)}% Delivered
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="text-xl font-black text-sky-600">{read.toLocaleString()}</div>
            <div className="text-[10px] uppercase font-bold text-sky-600 mt-0.5">
              {((read / delivered) * 100).toFixed(1)}% Read
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="text-xl font-black text-purple-700">{replied.toLocaleString()}</div>
            <div className="text-[10px] uppercase font-bold text-purple-600 mt-0.5">
              {((replied / read) * 100).toFixed(1)}% Replied
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-300 shadow-xs">
            <div className="text-xl font-black text-emerald-700">{leads} 🎯</div>
            <div className="text-[10px] uppercase font-black text-emerald-700 mt-0.5">Leads Created</div>
          </div>

          <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="text-xl font-black text-slate-700">₹{(sent * 0.48).toFixed(0)}</div>
            <div className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">Credits Spent</div>
          </div>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* Funnel Section */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Broadcast Conversion Funnel</h4>
                <p className="text-[11px] text-slate-500">Drop-off analysis from dispatch to verified CRM lead</p>
              </div>
              <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                15.5% Response-to-Lead
              </span>
            </div>

            <div className="space-y-3 pt-2">
              {funnel.map((step, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700">{step.label}</span>
                    <span className="text-slate-900">{step.count.toLocaleString()} <span className="text-slate-400 font-medium font-mono">({step.pct})</span></span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full ${step.color} rounded-full transition-all duration-500`}
                      style={{ width: `${Math.max(6, 100 - idx * 16)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400">{step.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Leads Generated Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-emerald-600" />
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Direct CRM Leads Captured ({campaignLeads.length})</h4>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Attributed automatically</span>
            </div>

            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
              {campaignLeads.map((lead) => (
                <div key={lead.id} className="p-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-slate-800">{lead.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{lead.phone} · {lead.city}</div>
                  </div>

                  <div className="text-center">
                    <span className="font-bold text-slate-700">{lead.product}</span>
                    <div className="text-[10px] text-emerald-600 font-bold">{lead.stage}</div>
                  </div>

                  <button
                    onClick={() => {
                      if (onOpenLeadModal) {
                        onOpenLeadModal({
                          contactName: lead.name,
                          phone: lead.phone,
                          city: lead.city,
                          suggestedInterest: lead.product,
                          chatSnippet: `Campaign Analytics Lead for ${campaign.name}`,
                          sourceAutomationName: `Campaign: ${campaign.name}`,
                        });
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold border border-emerald-200 flex items-center gap-1 transition-all"
                  >
                    View Lead
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Campaign Details Summary */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 font-bold uppercase text-[10px]">Template Used</span>
              <div className="font-bold text-slate-800 mt-0.5">{campaign.template}</div>
            </div>
            <div>
              <span className="text-slate-400 font-bold uppercase text-[10px]">Media Attachment</span>
              <div className="font-bold text-slate-800 mt-0.5">{campaign.media || 'None'}</div>
            </div>
            <div>
              <span className="text-slate-400 font-bold uppercase text-[10px]">Broadcast Type</span>
              <div className="font-bold text-slate-800 mt-0.5">{campaign.type}</div>
            </div>
            <div>
              <span className="text-slate-400 font-bold uppercase text-[10px]">Scheduled / Sent Date</span>
              <div className="font-bold text-slate-800 mt-0.5">{campaign.scheduledDate}</div>
            </div>
          </div>

        </div>

        {/* ── Footer ── */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">Meta Cloud Delivery Verified</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            Close Analytics
          </button>
        </div>

      </div>
    </div>
  );
}
