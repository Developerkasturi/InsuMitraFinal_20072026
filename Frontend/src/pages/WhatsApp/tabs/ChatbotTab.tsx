import React, { useState } from 'react';
import {
  Bot, Sparkles, Plus, Play, Pause, Edit3, Trash2,
  CheckCircle2, MessageSquare, ArrowRight, Send,
  RefreshCw, Smartphone, Phone, User, Shield, Zap,
  Layers, Settings, ChevronRight, CornerDownRight,
  TrendingUp, Award, UserCheck
} from 'lucide-react';
import { MOCK_WHATSAPP_DATA } from '../mockData';
import { WhatsAppLeadContext } from '../components/WhatsAppLeadModal';
import ChatbotBuilderModal from '../components/ChatbotBuilderModal';
import toast from 'react-hot-toast';

interface Props {
  onOpenLeadModal: (ctx: WhatsAppLeadContext) => void;
}

export default function ChatbotTab({ onOpenLeadModal }: Props) {
  const [bots, setBots] = useState(MOCK_WHATSAPP_DATA.chatbotConfigs);
  const [activeBotId, setActiveBotId] = useState(bots[0]?.id || 'BOT001');
  const activeBot = bots.find(b => b.id === activeBotId) || bots[0];

  // Builder Modal State
  const [builderModalOpen, setBuilderModalOpen] = useState(false);
  const [editTargetBot, setEditTargetBot] = useState<any>(null);

  // Simulator State
  const [simMessages, setSimMessages] = useState<Array<{ id: number; from: 'bot' | 'user'; text: string; time: string; options?: string[] }>>([
    {
      id: 1,
      from: 'bot',
      text: activeBot?.welcomeMessage || 'Hello! How can I help you today?',
      time: '10:00 AM',
      options: activeBot?.quickReplies?.map(q => q.label) || [],
    },
  ]);
  const [simInput, setSimInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [qualifiedLeadContext, setQualifiedLeadContext] = useState<any>(null);

  const handleSelectBot = (bot: any) => {
    setActiveBotId(bot.id);
    setSimMessages([
      {
        id: 1,
        from: 'bot',
        text: bot.welcomeMessage,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        options: bot.quickReplies?.map((q: any) => q.label) || [],
      },
    ]);
    setQualifiedLeadContext(null);
  };

  const handleOpenCreateBuilder = () => {
    setEditTargetBot(null);
    setBuilderModalOpen(true);
  };

  const handleOpenEditBuilder = (bot: any) => {
    setEditTargetBot(bot);
    setBuilderModalOpen(true);
  };

  const handleBotSaved = (savedBot: any) => {
    setBots(prev => {
      const idx = prev.findIndex(b => b.id === savedBot.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = savedBot;
        return copy;
      }
      return [savedBot, ...prev];
    });

    // Automatically select the new bot in simulator
    handleSelectBot(savedBot);
  };

  const handleSimSend = (textToSend?: string) => {
    const text = (textToSend || simInput).trim();
    if (!text) return;

    const userMsg = {
      id: Date.now(),
      from: 'user' as const,
      text: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setSimMessages(prev => [...prev, userMsg]);
    if (!textToSend) setSimInput('');
    setIsTyping(true);

    // Simulate smart bot response based on active bot flow
    setTimeout(() => {
      setIsTyping(false);
      let replyText = 'Thank you for your response! An agent will connect with you shortly.';
      let replyOptions: string[] = [];
      let qualInterest = 'General Insurance Inquiry';

      const lower = text.toLowerCase();
      if (lower.includes('renew') || lower.includes('policy')) {
        const node = (activeBot as any)?.nodes?.FLOW_RENEWAL;
        replyText = node?.botMessage || 'Your renewal is due soon. Would you like to proceed with payment?';
        replyOptions = node?.options || ['Pay via UPI', 'Upgrade Cover', 'Speak to Agent'];
        qualInterest = 'Policy Renewal & Upgrade';
      } else if (lower.includes('quote') || lower.includes('term') || lower.includes('cover') || lower.includes('car') || lower.includes('motor') || lower.includes('bike')) {
        const node = (activeBot as any)?.nodes?.FLOW_QUOTE || (activeBot as any)?.nodes?.TERM_COVER || (activeBot as any)?.nodes?.NODE_0;
        replyText = node?.botMessage || 'For comprehensive cover, quotes start at ₹590/month with leading insurers. Shall I prepare a detailed quote comparison?';
        replyOptions = node?.options || ['Prepare Comparison Sheet', 'Calculate for Non-Smoker', 'Speak to Agent'];
        qualInterest = (activeBot as any)?.suggestedInterest || 'Comprehensive Insurance Quote';
      } else if (lower.includes('phc') || lower.includes('checkup') || lower.includes('health')) {
        const node = (activeBot as any)?.nodes?.FLOW_PHC;
        replyText = node?.botMessage || 'You have ₹10,000 complimentary checkup available in Pune / Mumbai!';
        replyOptions = node?.options || ['Book in Pune', 'Book in Mumbai', 'Speak to Agent'];
        qualInterest = 'Preventive Health Checkup (PHC)';
      } else if (lower.includes('claim')) {
        const node = activeBot?.nodes?.FLOW_CLAIM;
        replyText = node?.botMessage || 'Please intimate cashless claims within 24-48 hours. Our emergency desk is ready.';
        replyOptions = node?.options || ['Intimate New Claim', 'Track Claim Status'];
        qualInterest = 'Emergency Claim Assistance';
      } else if (lower.includes('agent') || lower.includes('call') || lower.includes('speak')) {
        const node = activeBot?.nodes?.FLOW_AGENT;
        replyText = node?.botMessage || 'Connecting with Mr. Padmanabha Das. When would you prefer a callback?';
        replyOptions = ['Call Immediately', 'Morning (10 AM - 1 PM)', 'Evening (6 PM - 8 PM)'];
        qualInterest = 'Priority Callback Lead';
      } else {
        replyText = `Understood! I've noted your query regarding "${text}". Our expert insurance advisor will reach out to you with personalized solutions.`;
        replyOptions = ['Request Instant Callback', 'Explore Other Policies'];
      }

      const botReply = {
        id: Date.now() + 1,
        from: 'bot' as const,
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        options: replyOptions,
      };

      setSimMessages(prev => [...prev, botReply]);

      // Set lead qualification trigger
      setQualifiedLeadContext({
        contactName: 'WhatsApp Prospect (' + text.slice(0, 15) + ')',
        phone: '+91 98765 00000',
        city: 'Pune',
        suggestedInterest: qualInterest,
        chatSnippet: `User interacted with ${activeBot.name}: "${text}" -> Bot replied: "${replyText.slice(0, 60)}..."`,
        sourceAutomationName: `Chatbot: ${activeBot.name}`,
      });

    }, 600);
  };

  const handleResetSimulator = () => {
    handleSelectBot(activeBot);
    toast.success('Simulator reset');
  };

  const handleToggleBotActive = (botId: string) => {
    setBots(prev => prev.map(b => {
      if (b.id === botId) {
        const next = !b.active;
        toast.success(`Chatbot ${b.name} is now ${next ? 'Active' : 'Paused'}`);
        return { ...b, active: next };
      }
      return b;
    }));
  };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Top Header & Stats ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-slate-800">Engaging WhatsApp Chatbots</h3>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Auto-Lead Capture Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Interactive conversational bots with keyword triggers, smart branching, and instant CRM lead generation
          </p>
        </div>

        <button
          onClick={handleOpenCreateBuilder}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <Plus size={15} /> Create New Bot Flow
        </button>
      </div>

      {/* ── Metrics Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Bot size={20} />
          </div>
          <div>
            <div className="text-xl font-black text-slate-800">{bots.filter(b => b.active).length} Active</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase">Automated Chatbots</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <MessageSquare size={20} />
          </div>
          <div>
            <div className="text-xl font-black text-slate-800">2,320</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase">Bot Conversations</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="text-xl font-black text-purple-700">336 🎯</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase">Direct CRM Leads</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <TrendingUp size={20} />
          </div>
          <div>
            <div className="text-xl font-black text-amber-700">14.5%</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase">Lead Conversion Rate</div>
          </div>
        </div>
      </div>

      {/* ── Main Two-Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN: Bot List & Flow Inspector (7 cols) */}
        <div className="lg:col-span-7 space-y-5">

          {/* Bot Selection Cards */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Configured Chatbot Flows</h4>

            <div className="grid grid-cols-1 gap-3">
              {bots.map((bot) => {
                const isSelected = bot.id === activeBotId;
                return (
                  <div
                    key={bot.id}
                    onClick={() => handleSelectBot(bot)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${isSelected
                        ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${isSelected ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                          <Bot size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-sm text-slate-800">{bot.name}</h4>
                            <span className={`px-2 py-0.2 rounded-full text-[9px] font-extrabold ${bot.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                              }`}>
                              {bot.active ? 'Active' : 'Paused'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{bot.description}</p>

                          {/* Trigger Keywords */}
                          <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Triggers:</span>
                            {bot.triggerKeywords?.map((k: string) => (
                              <span key={k} className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-semibold border border-slate-200">
                                #{k}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditBuilder(bot);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-all"
                          title="Edit Bot Flow"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleBotActive(bot.id);
                          }}
                          className={`p-1.5 rounded-lg transition-all ${bot.active ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                          title={bot.active ? 'Pause Bot' : 'Activate Bot'}
                        >
                          {bot.active ? <Pause size={15} /> : <Play size={15} />}
                        </button>
                      </div>
                    </div>

                    {/* Stats strip */}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span><strong>{bot.stats?.triggered || 0}</strong> Triggered</span>
                      <span><strong>{bot.stats?.leadsCaptured || 0}</strong> Leads Captured 🎯</span>
                      <span className="text-emerald-600 font-bold">{bot.stats?.satisfaction || '100%'} CSAT</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Bot Flow Visualizer */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap size={14} className="text-amber-500" />
                  Flow Structure: {activeBot?.name}
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Automated node progression and CRM capture hooks</p>
              </div>
              <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                Pipeline: {activeBot?.leadStage}
              </span>
            </div>

            {/* Visual Node Chain */}
            <div className="space-y-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-1">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-black">1</span>
                  Welcome Prompt &amp; Interactive Buttons
                </div>
                <p className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 font-mono text-[11px] whitespace-pre-line">
                  {activeBot?.welcomeMessage}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  {activeBot?.quickReplies?.map((qr: any) => (
                    <span key={qr.id} className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                      {qr.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] flex items-center justify-center font-black">2</span>
                    Branching Logic &amp; Instant Lead Generation
                  </div>
                  <span className="text-[10px] text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded">
                    Auto-Capture on Qualified Response
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {Object.entries(activeBot?.nodes || {}).map(([key, node]: [string, any]) => (
                    <div key={key} className="p-2.5 rounded-lg bg-white border border-slate-200">
                      <div className="font-bold text-slate-800 text-[11px]">{node.title}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate">{node.botMessage}</div>
                      <div className="mt-1.5 text-[9px] font-bold text-emerald-600 flex items-center gap-1">
                        <Sparkles size={10} /> Triggers CRM Lead: <strong>{node.suggestedInterest}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN: Interactive Smartphone WhatsApp Simulator (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center">

          <div className="w-full max-w-sm">

            {/* Phone Bezel */}
            <div className="rounded-[40px] bg-slate-900 p-3 shadow-2xl border-4 border-slate-800 relative">

              {/* Camera Notch */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-900 rounded-full z-20" />

              {/* Screen Container */}
              <div className="rounded-[32px] bg-[#EFEAE2] overflow-hidden flex flex-col h-[560px] relative">

                {/* WhatsApp Chat Header */}
                <div className="bg-[#075E54] text-white p-3 pt-6 flex items-center justify-between shrink-0 shadow-md">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-400 text-slate-900 font-black text-xs flex items-center justify-center">
                      🤖
                    </div>
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1">
                        InsuMitra AI Bot
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      </div>
                      <div className="text-[9px] text-emerald-200">Online · 24/7 Verified Assistant</div>
                    </div>
                  </div>

                  <button
                    onClick={handleResetSimulator}
                    className="p-1 text-emerald-200 hover:text-white rounded-lg transition-all cursor-pointer"
                    title="Reset Simulator"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>

                {/* WhatsApp Messages Scroll Body */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">

                  {/* Encrypted Notice */}
                  <div className="text-center my-1">
                    <span className="bg-amber-100/90 text-amber-900 text-[9px] font-semibold px-2 py-0.5 rounded shadow-2xs">
                      🔒 Messages are end-to-end encrypted
                    </span>
                  </div>

                  {simMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.from === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] p-2.5 rounded-2xl shadow-xs leading-relaxed whitespace-pre-line ${msg.from === 'user'
                            ? 'bg-[#E7FFDB] text-slate-800 rounded-tr-none'
                            : 'bg-white text-slate-800 rounded-tl-none border border-slate-200/60'
                          }`}
                      >
                        <p>{msg.text}</p>
                        <div className="text-[8px] text-slate-400 text-right mt-1 font-mono">
                          {msg.time} {msg.from === 'user' && '✓✓'}
                        </div>
                      </div>

                      {/* Interactive Quick Reply Buttons if present */}
                      {msg.options && msg.options.length > 0 && (
                        <div className="mt-2 space-y-1.5 w-full">
                          {msg.options.map((opt, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleSimSend(opt)}
                              className="w-full text-left px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-500/30 text-emerald-800 text-[11px] font-bold shadow-2xs transition-all flex items-center justify-between cursor-pointer"
                            >
                              <span>{opt}</span>
                              <ChevronRight size={12} className="text-emerald-500" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {isTyping && (
                    <div className="bg-white p-2 rounded-xl rounded-tl-none inline-flex items-center gap-1 shadow-xs border border-slate-200/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
                    </div>
                  )}

                </div>

                {/* Lead Qualified Sticky Floating Banner */}
                {qualifiedLeadContext && (
                  <div className="p-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between gap-2 shadow-lg animate-slide-up">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                        <Sparkles size={11} className="text-yellow-300" /> Lead Qualified!
                      </div>
                      <div className="text-[11px] font-bold truncate">{qualifiedLeadContext.suggestedInterest}</div>
                    </div>

                    <button
                      onClick={() => onOpenLeadModal(qualifiedLeadContext)}
                      className="px-2.5 py-1 rounded-lg bg-white text-emerald-800 text-[11px] font-black shadow-sm shrink-0 hover:bg-emerald-50 transition-all cursor-pointer"
                    >
                      Capture Lead 🎯
                    </button>
                  </div>
                )}

                {/* Chat Input Bar */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSimSend();
                  }}
                  className="p-2 bg-[#F0F2F5] border-t border-slate-200 flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    value={simInput}
                    onChange={(e) => setSimInput(e.target.value)}
                    placeholder="Type a message (e.g. quote, renew)..."
                    className="flex-1 px-3 py-1.5 text-xs bg-white rounded-full border border-slate-200 focus:outline-none focus:border-emerald-600 text-slate-800"
                  />
                  <button
                    type="submit"
                    className="w-8 h-8 rounded-full bg-[#00A884] text-white flex items-center justify-center hover:bg-[#008f70] transition-all shrink-0 cursor-pointer"
                  >
                    <Send size={13} />
                  </button>
                </form>

              </div>
            </div>

            <p className="text-center text-[10px] text-slate-400 mt-2 font-medium">
              💡 Live Interactive Preview — Type or tap buttons to test conversation flows
            </p>

          </div>

        </div>

      </div>

      {/* ── Chatbot Builder / Edit Modal ── */}
      <ChatbotBuilderModal
        open={builderModalOpen}
        onClose={() => setBuilderModalOpen(false)}
        onSaved={handleBotSaved}
        editTarget={editTargetBot}
      />

    </div>
  );
}
