import React, { useState } from 'react';
import {
  Sparkles, TrendingUp, Search, Plus, Filter,
  Phone, Mail, MapPin, CheckCircle2, Clock,
  ArrowUpRight, MessageSquare, Bot, Zap, Rocket,
  ChevronRight, UserCheck, ShieldCheck, Tag, ExternalLink
} from 'lucide-react';
import { MOCK_WHATSAPP_DATA } from '../mockData';
import { WhatsAppLeadContext } from '../components/WhatsAppLeadModal';
import toast from 'react-hot-toast';

interface Props {
  onOpenLeadModal: (ctx: WhatsAppLeadContext) => void;
  onNavigateTab?: (tabKey: string) => void;
}

export default function WhatsAppLeadsTab({ onOpenLeadModal, onNavigateTab }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');

  const [leads, setLeads] = useState([
    {
      id: 'WAL-101',
      name: 'Rajesh Kumar',
      phone: '+91 98100 11111',
      email: 'rajesh.kumar@example.com',
      city: 'Pune',
      interest: 'Star Health Optima (Sum Insured Upgrade)',
      sourceType: 'AUTOMATION',
      sourceName: 'Renewal Reminder Series',
      stage: 'Qualified Opportunity',
      value: '₹24,500',
      capturedAt: 'Today, 10:45 AM',
      snippet: 'When will my policy expire exactly? Can I increase my sum insured to 25 Lakhs?',
      avatar: 'RK',
      color: 'bg-blue-500',
    },
    {
      id: 'WAL-102',
      name: 'Amit Sharma',
      phone: '+91 98300 33333',
      email: 'amit.sharma@example.com',
      city: 'Pune',
      interest: 'Term Life Insurance (2 Crore Cover)',
      sourceType: 'CAMPAIGN',
      sourceName: 'Term Insurance Awareness',
      stage: 'Contacted',
      value: '₹18,200',
      capturedAt: 'Today, 11:20 AM',
      snippet: 'Hi, I am interested. Can I get a quote for a 35-year-old non-smoker for 2 Crore cover?',
      avatar: 'AS',
      color: 'bg-emerald-500',
    },
    {
      id: 'WAL-103',
      name: 'Dr. Kavita Joshi',
      phone: '+91 98600 66666',
      email: 'dr.kavita@example.com',
      city: 'Pune',
      interest: 'Preventive Health Checkup + Top-Up',
      sourceType: 'CHATBOT',
      sourceName: '24/7 Smart Insurance Assistant',
      stage: 'New WhatsApp Lead',
      value: '₹14,000',
      capturedAt: 'Today, 02:15 PM',
      snippet: 'Book my complimentary PHC in Pune. Also share Top-up plan options.',
      avatar: 'KJ',
      color: 'bg-cyan-500',
    },
    {
      id: 'WAL-104',
      name: 'Vikramaditya Roy',
      phone: '+91 98700 77777',
      email: 'v.roy@example.com',
      city: 'Bangalore',
      interest: 'Max Life Smart Term Cover',
      sourceType: 'CHATBOT',
      sourceName: 'Instant Term Life Quote Bot',
      stage: 'Proposal Sent',
      value: '₹22,800',
      capturedAt: 'Yesterday, 04:30 PM',
      snippet: 'Selected ₹2 Crore Cover (~₹990/mo) for age 32. Requested comparative sheet.',
      avatar: 'VR',
      color: 'bg-indigo-500',
    },
    {
      id: 'WAL-105',
      name: 'Priya Singh',
      phone: '+91 98200 22222',
      email: 'priya.singh@example.com',
      city: 'Mumbai',
      interest: 'Family Floater Health Upgrade',
      sourceType: 'AUTOMATION',
      sourceName: 'PHC Cycle Reminder',
      stage: 'Qualified Opportunity',
      value: '₹31,000',
      capturedAt: 'Yesterday, 11:40 AM',
      snippet: 'Where can I find the partner hospitals list? Want to add parents to policy.',
      avatar: 'PS',
      color: 'bg-purple-500',
    },
    {
      id: 'WAL-106',
      name: 'Ananya Deshmukh',
      phone: '+91 98800 88888',
      email: 'ananya.d@example.com',
      city: 'Mumbai',
      interest: 'Care Super Top-up 50 Lakhs',
      sourceType: 'CAMPAIGN',
      sourceName: 'Health Check-up (PHC) Drive',
      stage: 'Converted',
      value: '₹14,200',
      capturedAt: '16 Aug 2026',
      snippet: 'Issued policy with 50 Lakhs super top-up deductible 5 Lakhs.',
      avatar: 'AD',
      color: 'bg-teal-500',
    },
  ]);

  const STAGES = ['ALL', 'New WhatsApp Lead', 'Contacted', 'Proposal Sent', 'Qualified Opportunity', 'Converted'];
  const SOURCES = ['ALL', 'CHATBOT', 'AUTOMATION', 'CAMPAIGN'];

  const filteredLeads = leads.filter(l => {
    const matchesSearch = l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.phone.includes(searchQuery) ||
      l.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.interest.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage = stageFilter === 'ALL' || l.stage === stageFilter;
    const matchesSource = sourceFilter === 'ALL' || l.sourceType === sourceFilter;
    return matchesSearch && matchesStage && matchesSource;
  });

  const handleOpenNewLead = () => {
    onOpenLeadModal({
      contactName: '',
      phone: '',
      suggestedInterest: 'Health Insurance',
      chatSnippet: 'Manual WhatsApp Direct Lead Creation',
      sourceAutomationName: 'Direct WhatsApp Capture',
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Top Header & Stats ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-slate-800">WhatsApp Generated Leads</h3>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold flex items-center gap-1">
              <Sparkles size={11} className="text-emerald-600" />
              18 New Today
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time leads converted from automated WhatsApp workflows, chatbot interactions &amp; broadcast replies
          </p>
        </div>

        <button
          onClick={handleOpenNewLead}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <Plus size={15} /> Capture Direct Lead
        </button>
      </div>

      {/* ── Summary KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="text-xl font-black text-slate-800">194 🎯</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase">Total WA Leads</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Bot size={20} />
          </div>
          <div>
            <div className="text-xl font-black text-slate-800">142</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase">Via AI Chatbot</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Zap size={20} />
          </div>
          <div>
            <div className="text-xl font-black text-purple-700">52</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase">Via Automations</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <TrendingUp size={20} />
          </div>
          <div>
            <div className="text-xl font-black text-amber-700">₹12.4 L</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase">Pipeline Value</div>
          </div>
        </div>
      </div>

      {/* ── Filters & Search ── */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search leads by customer name, phone, city, or insurance interest..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Stage Filter */}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-700 outline-none focus:border-emerald-500"
          >
            {STAGES.map(s => (
              <option key={s} value={s}>{s === 'ALL' ? 'All Stages' : s}</option>
            ))}
          </select>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-700 outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Sources</option>
            <option value="CHATBOT">🤖 AI Chatbot</option>
            <option value="AUTOMATION">⚡ Automations</option>
            <option value="CAMPAIGN">🚀 Campaigns</option>
          </select>
        </div>
      </div>

      {/* ── Leads Table ── */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Lead Contact</th>
                <th className="py-3.5 px-4">Insurance Product Interest</th>
                <th className="py-3.5 px-4">Source Origin</th>
                <th className="py-3.5 px-4">Est. Premium</th>
                <th className="py-3.5 px-4">Pipeline Stage</th>
                <th className="py-3.5 px-4">Captured At</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredLeads.map((lead) => {
                return (
                  <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">

                    {/* Contact Info */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full ${lead.color} text-white font-bold text-xs flex items-center justify-center shrink-0`}>
                          {lead.avatar}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{lead.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">{lead.phone} · {lead.city}</div>
                        </div>
                      </div>
                    </td>

                    {/* Product & snippet */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-800">{lead.interest}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 max-w-xs truncate italic">
                        "{lead.snippet}"
                      </div>
                    </td>

                    {/* Source */}
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${lead.sourceType === 'CHATBOT' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          lead.sourceType === 'AUTOMATION' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}>
                        {lead.sourceType === 'CHATBOT' && <Bot size={11} />}
                        {lead.sourceType === 'AUTOMATION' && <Zap size={11} />}
                        {lead.sourceType === 'CAMPAIGN' && <Rocket size={11} />}
                        {lead.sourceName}
                      </span>
                    </td>

                    {/* Value */}
                    <td className="py-3.5 px-4 font-black text-slate-900">
                      {lead.value}
                    </td>

                    {/* Stage */}
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${lead.stage === 'Converted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          lead.stage === 'Qualified Opportunity' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                            lead.stage === 'Proposal Sent' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                              'bg-slate-100 text-slate-700'
                        }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {lead.stage}
                      </span>
                    </td>

                    {/* Captured Date */}
                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {lead.capturedAt}
                    </td>

                    {/* Action buttons */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenLeadModal({
                            contactName: lead.name,
                            phone: lead.phone,
                            email: lead.email,
                            city: lead.city,
                            suggestedInterest: lead.interest,
                            chatSnippet: lead.snippet,
                            sourceAutomationName: lead.sourceName,
                          })}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] border border-emerald-200/80 flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                        >
                          <Sparkles size={11} /> View / Edit
                        </button>
                        <button
                          onClick={() => {
                            if (onNavigateTab) onNavigateTab('inbox');
                            else toast.success(`Opened WhatsApp conversation with ${lead.name}`);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-slate-100 transition-all"
                          title="Open WhatsApp Chat"
                        >
                          <MessageSquare size={13} />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
