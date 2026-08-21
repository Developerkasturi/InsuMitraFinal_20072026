import React, { useState } from 'react';
import {
  X, Bot, Sparkles, Plus, Trash2, CheckCircle2,
  Zap, MessageSquare, Tag, ShieldCheck, ChevronRight,
  Layers, UserCheck
} from 'lucide-react';
import { MOCK_WHATSAPP_DATA } from '../mockData';
import toast from 'react-hot-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (newBot: any) => void;
  editTarget?: any;
}

export default function ChatbotBuilderModal({
  open,
  onClose,
  onSaved,
  editTarget,
}: Props) {
  if (!open) return null;

  const [name, setName] = useState(editTarget?.name || '');
  const [description, setDescription] = useState(editTarget?.description || '');
  const [category, setCategory] = useState(editTarget?.category || 'Sales & Acquisition');
  const [welcomeMessage, setWelcomeMessage] = useState(
    editTarget?.welcomeMessage ||
    '👋 Hello! Welcome to *InfoYashonanada Insurance*. How can I help you today? Please tap an option below:'
  );
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>(
    editTarget?.triggerKeywords || ['motor', 'car', 'bike', 'insurance', 'quote', 'renew']
  );
  const [quickReplies, setQuickReplies] = useState<string[]>(
    editTarget?.quickReplies?.map((q: any) => q.label) || [
      '🚗 Instant Car / Bike Quote',
      '🔄 Policy Renewal',
      '🚨 Claim Assistance',
      '👤 Speak to Insurance Advisor',
    ]
  );
  const [newOptionInput, setNewOptionInput] = useState('');
  const [leadStage, setLeadStage] = useState(editTarget?.leadStage || 'New WhatsApp Lead');
  const [suggestedInterest, setSuggestedInterest] = useState(
    editTarget?.suggestedInterest || 'Motor / General Insurance'
  );
  const [autoLeadCapture, setAutoLeadCapture] = useState(true);

  // Add keyword tag
  const handleAddKeyword = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter' && e.key !== ',') return;
    e.preventDefault();
    const val = keywordInput.trim().toLowerCase().replace(/,/g, '');
    if (val && !keywords.includes(val)) {
      setKeywords(prev => [...prev, val]);
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (kw: string) => {
    setKeywords(prev => prev.filter(k => k !== kw));
  };

  // Add quick reply option
  const handleAddOption = () => {
    if (!newOptionInput.trim()) return;
    if (quickReplies.length >= 5) {
      toast.error('Maximum 5 quick reply buttons supported by WhatsApp');
      return;
    }
    setQuickReplies(prev => [...prev, newOptionInput.trim()]);
    setNewOptionInput('');
  };

  const handleRemoveOption = (idx: number) => {
    setQuickReplies(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter a chatbot name');
      return;
    }

    const botId = editTarget?.id || `BOT00${MOCK_WHATSAPP_DATA.chatbotConfigs.length + 1}`;
    const formattedBot = {
      id: botId,
      name: name.trim(),
      description: description.trim() || 'Custom automated WhatsApp conversational flow with instant lead qualification.',
      active: true,
      category,
      triggerKeywords: keywords.length > 0 ? keywords : ['help', 'quote'],
      leadStage,
      assignedTo: 'Padmanabha Das',
      autoLeadCapture,
      suggestedInterest,
      stats: editTarget?.stats || { triggered: 0, resolved: 0, leadsCaptured: 0, satisfaction: '100%' },
      welcomeMessage: welcomeMessage.trim(),
      quickReplies: quickReplies.map((label, idx) => ({
        id: `qr_${idx}`,
        label,
        action: `NODE_${idx}`,
      })),
      nodes: {
        NODE_0: {
          title: quickReplies[0] || 'Inquiry',
          botMessage: `Thank you for your interest in ${quickReplies[0] || 'our service'}! Please share your vehicle number or age to get an instant quote.`,
          options: ['Share Details via WhatsApp', 'Request Advisor Callback'],
          leadTriggerOn: 'ALL',
          suggestedInterest,
        },
        NODE_1: {
          title: quickReplies[1] || 'Renewal',
          botMessage: 'Please reply with your policy number or registered mobile number to fetch instant renewal discounts.',
          options: ['Send Policy Number', 'Pay via UPI', 'Speak to Agent'],
          leadTriggerOn: 'ALL',
          suggestedInterest,
        },
      },
    };

    onSaved(formattedBot);
    toast.success(`Chatbot "${formattedBot.name}" created and activated!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-scale-up">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              <Bot size={22} />
            </div>
            <div>
              <h2 className="text-base font-black text-white">
                {editTarget ? 'Edit Chatbot Flow' : 'Create New WhatsApp Chatbot Flow'}
              </h2>
              <p className="text-xs text-emerald-100">
                Setup conversational bot dialogues, triggers &amp; automated CRM lead conversion
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/15 transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          
          {/* Bot Name & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Chatbot Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Motor Insurance Assistant"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all font-semibold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 outline-none focus:border-emerald-500"
              >
                <option value="Sales & Acquisition">Sales &amp; Acquisition</option>
                <option value="Customer Support & Renewal">Customer Support &amp; Renewal</option>
                <option value="Claims Desk">Claims Desk</option>
                <option value="PHC & Wellness">PHC &amp; Wellness</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Short Description / Purpose
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Automatically generates instant motor insurance quotes and captures leads."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none text-slate-700"
            />
          </div>

          {/* Trigger Keywords */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Trigger Keywords (Press Enter or Comma to add)
            </label>
            <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-wrap items-center gap-1.5 min-h-[46px]">
              {keywords.map((kw) => (
                <span
                  key={kw}
                  className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-mono font-bold flex items-center gap-1 shadow-2xs"
                >
                  #{kw}
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(kw)}
                    className="hover:text-rose-600 ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleAddKeyword}
                placeholder="Type keyword (e.g. quote, car, renew)..."
                className="flex-1 min-w-[140px] bg-transparent text-xs outline-none text-slate-700 font-medium"
              />
            </div>
          </div>

          {/* Welcome Message Textarea */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Welcome Prompt Message *
            </label>
            <textarea
              rows={3}
              required
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder="Enter greeting message shown when customer sends a trigger word..."
              className="w-full p-3 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none leading-relaxed"
            />
          </div>

          {/* Quick Reply Action Buttons */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Quick Reply Option Buttons ({quickReplies.length}/5)
              </label>
            </div>

            <div className="space-y-1.5">
              {quickReplies.map((btn, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold shrink-0">
                    {idx + 1}
                  </span>
                  <span className="flex-1 font-bold text-slate-800 text-xs truncate">{btn}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}

              {/* Add option input */}
              {quickReplies.length < 5 && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newOptionInput}
                    onChange={(e) => setNewOptionInput(e.target.value)}
                    placeholder="Enter button label (e.g. 🚗 Instant Quote)..."
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 transition-all"
                  >
                    <Plus size={13} /> Add Button
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Lead Capture Automation Section */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black text-emerald-900">
                <Sparkles size={14} className="text-emerald-600" />
                Automatic CRM Lead Generation Hook
              </div>
              <input
                type="checkbox"
                checked={autoLeadCapture}
                onChange={(e) => setAutoLeadCapture(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                  Target Pipeline Stage
                </label>
                <select
                  value={leadStage}
                  onChange={(e) => setLeadStage(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 outline-none"
                >
                  <option value="New WhatsApp Lead">New WhatsApp Lead</option>
                  <option value="Qualified Opportunity">Qualified Opportunity</option>
                  <option value="Contacted">Contacted</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                  Default Product Interest Tag
                </label>
                <input
                  type="text"
                  value={suggestedInterest}
                  onChange={(e) => setSuggestedInterest(e.target.value)}
                  placeholder="e.g. Motor Comprehensive"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <CheckCircle2 size={14} /> Save &amp; Activate Bot Flow
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
