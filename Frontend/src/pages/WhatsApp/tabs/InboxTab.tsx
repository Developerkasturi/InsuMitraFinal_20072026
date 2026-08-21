import React, { useState } from 'react';
import {
  Search, MessageSquare, Send, Paperclip, CheckCheck,
  Check, Clock, User, Phone, Mail, MapPin, Shield,
  TrendingUp, Sparkles, Plus, AlertCircle, FileText,
  Calendar, ChevronRight, CheckCircle2, UserCheck,
  Bot, Zap, RefreshCw, AlertTriangle, ShieldCheck, X,
  ArrowRight, Filter
} from 'lucide-react';
import { MOCK_WHATSAPP_DATA } from '../mockData';
import { WhatsAppLeadContext } from '../components/WhatsAppLeadModal';
import toast from 'react-hot-toast';

interface Props {
  onOpenLeadModal: (ctx: WhatsAppLeadContext) => void;
}

export default function InboxTab({ onOpenLeadModal }: Props) {
  const [conversations, setConversations] = useState(MOCK_WHATSAPP_DATA.conversations);
  const [activeConvId, setActiveConvId] = useState(conversations[0]?.id || '');
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [windowFilter, setWindowFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRED'>('ALL');

  // Quick Template Modal in Inbox
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [selectedTemplateForSend, setSelectedTemplateForSend] = useState<any>(null);

  // Bot Auto-Pilot state per conversation
  const [botAutoPilot, setBotAutoPilot] = useState<Record<string, boolean>>({
    CONV001: true,
    CONV002: false,
    CONV003: true,
  });

  const activeConv = conversations.find(c => c.id === activeConvId) || conversations[0];
  const isBotActive = !!botAutoPilot[activeConvId];
  const isWindowActive = activeConv ? activeConv.isServiceWindowActive : true;

  const approvedTemplates = MOCK_WHATSAPP_DATA.templates.filter(t => t.status === 'APPROVED');

  const filteredConversations = conversations.filter(c => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = c.name.toLowerCase().includes(q) || c.phone.includes(q);
    const matchesWindow =
      windowFilter === 'ALL' ||
      (windowFilter === 'ACTIVE' && c.isServiceWindowActive) ||
      (windowFilter === 'EXPIRED' && !c.isServiceWindowActive);
    return matchesSearch && matchesWindow;
  });

  const handleToggleAutoPilot = () => {
    setBotAutoPilot(prev => {
      const next = !prev[activeConvId];
      toast.success(`Bot Auto-Pilot ${next ? 'Activated' : 'Paused'} for ${activeConv.name}`);
      return { ...prev, [activeConvId]: next };
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    if (!isWindowActive) {
      toast.error('24-Hour window expired. Please send an approved template message to re-engage.');
      return;
    }

    const newMsg = {
      id: Date.now(),
      from: 'out' as const,
      type: 'text' as const,
      body: inputText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'DELIVERED',
    };

    setConversations(prev => prev.map(c => {
      if (c.id === activeConvId) {
        return {
          ...c,
          messages: [...c.messages, newMsg],
          lastMsg: inputText,
          lastMsgTime: 'Just now',
        };
      }
      return c;
    }));

    setInputText('');
    toast.success('Message sent via WhatsApp');
  };

  const handleSendTemplateFromPicker = (tpl: any) => {
    // Resolve variables with active contact data
    let renderedBody = tpl.body;
    if (activeConv) {
      renderedBody = renderedBody
        .replace('{{1}}', activeConv.name)
        .replace('{{2}}', activeConv.crm?.policies?.[0]?.name || 'Health')
        .replace('{{3}}', activeConv.crm?.policies?.[0]?.no || 'POL-8812')
        .replace('{{4}}', activeConv.crm?.policies?.[0]?.renewal || '20-Oct-2026')
        .replace('{{5}}', activeConv.crm?.policies?.[0]?.premium || '24,500');
    }

    const templateMsg = {
      id: Date.now(),
      from: 'out' as const,
      type: 'template' as const,
      templateName: tpl.name,
      body: renderedBody,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'DELIVERED',
    };

    setConversations(prev => prev.map(c => {
      if (c.id === activeConvId) {
        return {
          ...c,
          messages: [...c.messages, templateMsg],
          lastMsg: `[Template] ${tpl.name}`,
          lastMsgTime: 'Just now',
          // Reopen 24h window
          isServiceWindowActive: true,
          serviceWindowTimeText: '24h 00m remaining',
        };
      }
      return c;
    }));

    setTemplatePickerOpen(false);
    toast.success(`Template "${tpl.name}" sent! 24h Window renewed.`);
  };

  const handleTriggerBotFlow = (flowType: string) => {
    const flowMessages: Record<string, string> = {
      RENEWAL: `🤖 *Renewal Assistant*: Hello ${activeConv.name}, your Star Health policy SH-2024-88821 is due on 20-Oct-2026. Shall I share the instant UPI payment link or discuss sum insured upgrade?`,
      QUOTE: `🤖 *Instant Quote Advisor*: Hi ${activeConv.name}, we have special 1 Cr Term Life plans starting @ ₹650/month with 100% payout claim guarantee. Would you like a personalized quote?`,
      PHC: `🤖 *PHC Health Checkup*: Hi ${activeConv.name}, you have an unused ₹10,000 complimentary preventive checkup balance for this policy year! Reply YES to book your appointment in ${activeConv.crm?.city || 'Pune'}.`,
    };

    const msgBody = flowMessages[flowType] || flowMessages.RENEWAL;
    const botMsg = {
      id: Date.now(),
      from: 'out' as const,
      type: 'text' as const,
      body: msgBody,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'DELIVERED',
    };

    setConversations(prev => prev.map(c => {
      if (c.id === activeConvId) {
        return {
          ...c,
          messages: [...c.messages, botMsg],
          lastMsg: msgBody.slice(0, 45) + '...',
          lastMsgTime: 'Just now',
        };
      }
      return c;
    }));

    toast.success(`Triggered ${flowType} Bot Flow!`);
  };

  const handleTriggerLeadModal = () => {
    if (!activeConv) return;
    const lastIncoming = [...activeConv.messages].reverse().find(m => m.from === 'in')?.body;
    
    const leadCtx: WhatsAppLeadContext = {
      contactId: activeConv.contactId,
      contactName: activeConv.name,
      phone: activeConv.phone,
      email: activeConv.crm?.email,
      city: activeConv.crm?.city,
      conversationId: activeConv.id,
      sourceAutomationId: activeConv.origin?.id,
      sourceAutomationName: activeConv.origin?.name,
      suggestedInterest: activeConv.crm?.suggestedInterest || 'Health Insurance',
      chatSnippet: lastIncoming || activeConv.lastMsg,
    };
    onOpenLeadModal(leadCtx);
  };

  return (
    <div className="h-[calc(100vh-210px)] min-h-[600px] rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden flex flex-col md:flex-row animate-fade-in">
      
      {/* ── Panel 1: Conversation List (Left) ── */}
      <div className="w-full md:w-80 lg:w-96 border-r border-slate-200 flex flex-col shrink-0 bg-slate-50/40">
        
        {/* Search & Header */}
        <div className="p-3.5 border-b border-slate-200 bg-white space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-emerald-600" />
              <h3 className="text-sm font-extrabold text-slate-800">Inbox Conversations</h3>
            </div>
            <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800">
              {conversations.reduce((acc, c) => acc + c.unread, 0)} New
            </span>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats by name, phone..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
            />
          </div>

          {/* 24h Window Filter Tabs */}
          <div className="flex items-center gap-1 pt-1">
            {[
              { key: 'ALL', label: 'All' },
              { key: 'ACTIVE', label: '🟢 24h Active' },
              { key: 'EXPIRED', label: '🔴 Expired' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setWindowFilter(tab.key as any)}
                className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                  windowFilter === tab.key
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* List items */}
        <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
          {filteredConversations.map((conv) => {
            const isActive = conv.id === activeConvId;
            const hasAutoPilot = botAutoPilot[conv.id];

            return (
              <div
                key={conv.id}
                onClick={() => {
                  setActiveConvId(conv.id);
                  setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread: 0 } : c));
                }}
                className={`p-3.5 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isActive
                    ? 'bg-emerald-50/70 border-l-4 border-emerald-600'
                    : 'hover:bg-slate-100/70 border-l-4 border-transparent'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-full ${conv.color} text-white font-bold text-xs flex items-center justify-center shrink-0 relative shadow-xs`}>
                    {conv.avatar}
                    {conv.online && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-slate-800 truncate">{conv.name}</span>
                      {hasAutoPilot && (
                        <span className="text-[9px] font-extrabold bg-blue-100 text-blue-800 px-1 py-0.2 rounded">
                          AI
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{conv.lastMsg}</p>
                    
                    {/* 24h Window Badge on Conversation Item */}
                    <div className="flex items-center gap-1 mt-1">
                      {conv.isServiceWindowActive ? (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          <Clock size={9} /> {conv.serviceWindowTimeText}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                          <AlertTriangle size={9} /> Expired
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[10px] text-slate-400 font-medium">{conv.lastMsgTime}</span>
                  {conv.unread > 0 && (
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center">
                      {conv.unread}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Panel 2: Active Chat Window (Center) ── */}
      <div className="flex-1 flex flex-col justify-between bg-slate-50/50">
        
        {/* Chat Header with 24h Service Window Status Bar */}
        <div className="p-3.5 bg-white border-b border-slate-200 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full ${activeConv?.color} text-white font-bold text-xs flex items-center justify-center shadow-xs`}>
                {activeConv?.avatar}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-xs text-slate-800">{activeConv?.name}</h3>
                  <span className="text-[10px] text-slate-400 font-mono">{activeConv?.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="font-semibold text-emerald-600">Active WA Session</span>
                  <span>•</span>
                  <span>Origin: {activeConv?.origin?.name}</span>
                </div>
              </div>
            </div>

            {/* Top Right Action Bar */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleAutoPilot}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isBotActive
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Bot size={13} className={isBotActive ? 'text-blue-600' : 'text-slate-400'} />
                <span>{isBotActive ? 'Bot Active' : 'Bot Paused'}</span>
              </button>

              <button
                onClick={() => setTemplatePickerOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs border border-purple-200 flex items-center gap-1 transition-all cursor-pointer"
              >
                <FileText size={13} />
                <span>Send Template</span>
              </button>
            </div>
          </div>

          {/* ── 24h Meta Service Window Live Banner ── */}
          <div className={`px-3 py-1.5 rounded-xl text-xs flex items-center justify-between border ${
            isWindowActive
              ? 'bg-emerald-50/80 border-emerald-200/80 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            <div className="flex items-center gap-2">
              <Clock size={14} className={isWindowActive ? 'text-emerald-600' : 'text-amber-600'} />
              <span className="font-bold">
                {isWindowActive ? '24-Hour Customer Service Window Active:' : '24-Hour Service Window Expired:'}
              </span>
              <span className="text-[11px] font-medium">
                {isWindowActive
                  ? `${activeConv?.serviceWindowTimeText} — Free-form agent messaging is permitted`
                  : 'Meta policy requires an approved template to re-engage with this recipient'}
              </span>
            </div>
            {!isWindowActive && (
              <button
                onClick={() => setTemplatePickerOpen(true)}
                className="px-2.5 py-0.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
              >
                <FileText size={11} /> Re-engage with Template
              </button>
            )}
          </div>
        </div>

        {/* Message Thread History */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {activeConv?.messages.map((m: any) => {
            const isOut = m.from === 'out';
            const isTemplate = m.type === 'template';

            if (isTemplate) {
              return (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-md p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-slate-800 text-xs shadow-xs space-y-2 rounded-br-none">
                    <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200/60 text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        <FileText size={11} /> Meta Template: {m.templateName}
                      </span>
                      <span>{m.time}</span>
                    </div>
                    <p className="whitespace-pre-line text-slate-700 leading-relaxed font-sans">{m.body}</p>
                    <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-700 font-semibold">
                      <span>Delivered via Meta Cloud API</span>
                      <CheckCheck size={12} className="text-emerald-600" />
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={m.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-md px-4 py-2.5 rounded-2xl shadow-xs text-xs leading-relaxed ${
                    isOut
                      ? 'bg-emerald-600 text-white rounded-br-none'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-line">{m.body}</p>
                  <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isOut ? 'text-emerald-200' : 'text-slate-400'}`}>
                    <span>{m.time}</span>
                    {isOut && <CheckCheck size={12} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Chat Composer with 24h Lockout Protection ── */}
        <div className="p-3 bg-white border-t border-slate-200">
          {!isWindowActive ? (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-600 shrink-0" />
                <span>
                  <strong>Free-text messaging is locked.</strong> Send an approved Meta template to reopen the 24h service window.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTemplatePickerOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
              >
                <FileText size={13} /> Select Template
              </button>
            </div>
          ) : (
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <button
                type="button"
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                title="Attach Document/Media"
              >
                <Paperclip size={18} />
              </button>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type WhatsApp reply... (active within 24h customer service window)"
                className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
              />
              <button
                type="submit"
                className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <Send size={16} />
              </button>
            </form>
          )}
        </div>

      </div>

      {/* ── Panel 3: CRM Context & Lead Quick Panel (Right) ── */}
      <div className="w-full md:w-72 lg:w-80 border-t md:border-t-0 md:border-l border-slate-200 p-4 bg-white flex flex-col justify-between shrink-0 overflow-y-auto">
        
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">CRM Context</h4>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              Opted In ✓
            </span>
          </div>

          {/* Contact Details Card */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
            <div className="font-bold text-slate-800">{activeConv?.name}</div>
            <div className="flex items-center gap-2 text-slate-500 text-[11px]">
              <Phone size={12} /> {activeConv?.phone}
            </div>
            <div className="flex items-center gap-2 text-slate-500 text-[11px]">
              <MapPin size={12} /> {activeConv?.crm?.city || 'Pune'}
            </div>
            {activeConv?.crm?.email && (
              <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                <Mail size={12} /> {activeConv.crm.email}
              </div>
            )}
          </div>

          {/* Lead Generation CTA Card */}
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-800">
              <TrendingUp size={14} className="text-emerald-600" />
              Direct Lead Capture
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Convert this chat inquiry directly into a CRM sales pipeline lead with tracked origin and product interest.
            </p>
            <button
              onClick={handleTriggerLeadModal}
              className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Sparkles size={13} />
              Create Lead from Chat
            </button>
          </div>

        </div>

        {/* Footer Quick Links */}
        <div className="pt-4 border-t border-slate-100 space-y-1.5">
          <button className="w-full py-1.5 px-2.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-lg flex items-center justify-between cursor-pointer">
            <span>View Full Customer Profile</span>
            <ChevronRight size={13} />
          </button>
        </div>

      </div>

      {/* ── Inline Quick Template Picker Modal ── */}
      {templatePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-scale-up">
            
            <div className="p-5 bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <FileText size={18} className="text-purple-300" />
                <div>
                  <h3 className="text-base font-extrabold text-white">Send Approved WhatsApp Template</h3>
                  <p className="text-xs text-white/60">Select a Meta-verified template to broadcast or re-open 24h service window</p>
                </div>
              </div>
              <button
                onClick={() => setTemplatePickerOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto">
              {approvedTemplates.map(tpl => (
                <div
                  key={tpl.id}
                  onClick={() => setSelectedTemplateForSend(tpl)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                    selectedTemplateForSend?.id === tpl.id
                      ? 'border-purple-600 bg-purple-50/60 shadow-xs ring-1 ring-purple-600'
                      : 'border-slate-200 hover:border-purple-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800">{tpl.name}</span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      APPROVED ✓
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {tpl.body}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                    <span>{tpl.category}</span>
                    <span>•</span>
                    <span>{tpl.language}</span>
                    <span>•</span>
                    <span>{tpl.variables} Dynamic Variables</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => setTemplatePickerOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={!selectedTemplateForSend}
                onClick={() => handleSendTemplateFromPicker(selectedTemplateForSend)}
                className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Send size={13} />
                <span>Send Template to {activeConv?.name}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
