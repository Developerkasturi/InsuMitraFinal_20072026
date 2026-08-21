import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsService, employeesService } from '@api/index';
import Modal from '@comps/common/Modal';
import {
  TrendingUp, User, Phone, Mail, MapPin, Tag,
  FileText, Calendar, IndianRupee, ShieldCheck,
  CheckCircle2, Sparkles, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface WhatsAppLeadContext {
  contactId?: string;
  contactName: string;
  phone: string;
  email?: string;
  city?: string;
  conversationId?: string;
  sourceAutomationId?: string;
  sourceAutomationName?: string;
  sourceCampaignId?: string;
  sourceCampaignName?: string;
  suggestedInterest?: string;
  chatSnippet?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  context: WhatsAppLeadContext | null;
}

const PRODUCT_INTERESTS = [
  'Health Insurance',
  'Term Life Insurance',
  'Motor Insurance',
  'Preventive Health Checkup (PHC)',
  'Mutual Funds / SIP',
  'Family Floater',
  'Critical Illness',
  'Retirement Plan',
  'Other',
];

const LEAD_STAGES = [
  { value: 'TO_CONTACT', label: 'To Contact (Fresh)' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'INTERESTED', label: 'Interested / Hot' },
  { value: 'MEETING_SCHEDULED', label: 'Meeting Scheduled' },
  { value: 'PROPOSAL_SENT', label: 'Proposal Sent' },
];

export default function WhatsAppLeadModal({ open, onClose, context }: Props) {
  const qc = useQueryClient();

  const [contactName, setContactName] = useState(context?.contactName || '');
  const [phone, setPhone] = useState(context?.phone || '');
  const [email, setEmail] = useState(context?.email || '');
  const [city, setCity] = useState(context?.city || '');
  const [interest, setInterest] = useState(context?.suggestedInterest || 'Health Insurance');
  const [customInterest, setCustomInterest] = useState('');
  const [stage, setStage] = useState('TO_CONTACT');
  const [premiumBudget, setPremiumBudget] = useState<string>('');
  const [followUpDate, setFollowUpDate] = useState<string>(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [assignedEmployeeId, setAssignedEmployeeId] = useState<string>('');
  const [notes, setNotes] = useState(
    context?.chatSnippet
      ? `[WhatsApp Lead Generated] From ${context.sourceAutomationName || context.sourceCampaignName || 'Conversation'}:\n"${context.chatSnippet}"`
      : `Lead generated via WhatsApp interaction`
  );

  // Sync state when context changes
  React.useEffect(() => {
    if (context) {
      setContactName(context.contactName || '');
      setPhone(context.phone || '');
      setEmail(context.email || '');
      setCity(context.city || '');
      setInterest(context.suggestedInterest || 'Health Insurance');
      setNotes(
        context.chatSnippet
          ? `[WhatsApp Automation Lead] Origin: ${context.sourceAutomationName || context.sourceCampaignName || 'Direct Message'}\n"${context.chatSnippet}"`
          : `Lead captured via WhatsApp Automation`
      );
    }
  }, [context]);

  // Fetch employees for assignment
  const { data: employeesRes } = useQuery({
    queryKey: ['employees', 'active-list'],
    queryFn: () => employeesService.list({ limit: 50 }),
    enabled: open,
  });
  const employees = employeesRes?.data ?? [];

  // Create lead mutation
  const createLeadMutation = useMutation({
    mutationFn: async () => {
      const selectedInterest = interest === 'Other' && customInterest.trim() ? customInterest.trim() : interest;
      const body = {
        name: contactName,
        phone,
        email: email || undefined,
        city: city || undefined,
        contactId: context?.contactId,
        source: 'WHATSAPP_AUTOMATION',
        interests: [selectedInterest],
        stage,
        premiumBudget: premiumBudget ? Number(premiumBudget) : undefined,
        followUpDate: followUpDate ? new Date(followUpDate).toISOString() : undefined,
        assignedEmployeeId: assignedEmployeeId || undefined,
        notes,
        metadata: {
          whatsappConversion: true,
          conversationId: context?.conversationId,
          sourceAutomationId: context?.sourceAutomationId,
          sourceAutomationName: context?.sourceAutomationName,
          sourceCampaignId: context?.sourceCampaignId,
          sourceCampaignName: context?.sourceCampaignName,
        },
      };
      return leadsService.create(body);
    },
    onSuccess: () => {
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-bold">Lead Generated Successfully! 🎯</span>
          <span className="text-xs text-slate-500">
            {contactName} added to CRM Lead Pipeline from WhatsApp
          </span>
        </div>,
        { duration: 4500 }
      );
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['whatsapp'] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create lead');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !phone.trim()) {
      toast.error('Contact name and phone number are required');
      return;
    }
    createLeadMutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate Lead from WhatsApp"
      subtitle="Directly capture and route prospects from WhatsApp automation & chats into your sales pipeline"
      size="xl"
      icon={<TrendingUp className="text-emerald-600" size={20} />}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        
        {/* Source Badge & Origin Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                  Source: WhatsApp Automation
                </span>
                {context?.sourceAutomationName && (
                  <span className="text-xs font-semibold text-slate-600">
                    via {context.sourceAutomationName}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically attaches conversation context &amp; conversion metrics
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-white/80 px-3 py-1.5 rounded-xl border border-emerald-200 shadow-sm">
            <ShieldCheck size={14} className="text-emerald-600" />
            CRM Direct Sync
          </div>
        </div>

        {/* Form Fields Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Contact Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <User size={13} className="text-slate-400" />
              Contact Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
              placeholder="Full Name"
            />
          </div>

          {/* Phone Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Phone size={13} className="text-slate-400" />
              WhatsApp / Mobile Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
              placeholder="+91 98765 43210"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Mail size={13} className="text-slate-400" />
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
              placeholder="customer@example.com"
            />
          </div>

          {/* City */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <MapPin size={13} className="text-slate-400" />
              City / Location
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
              placeholder="e.g. Mumbai, Pune"
            />
          </div>

          {/* Product Interest */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Tag size={13} className="text-slate-400" />
              Product Interest <span className="text-rose-500">*</span>
            </label>
            <select
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all bg-white"
            >
              {PRODUCT_INTERESTS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            {interest === 'Other' && (
              <input
                type="text"
                value={customInterest}
                onChange={(e) => setCustomInterest(e.target.value)}
                placeholder="Specify insurance/financial product"
                className="mt-2 w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-500 outline-none"
              />
            )}
          </div>

          {/* Initial Stage */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <TrendingUp size={13} className="text-slate-400" />
              Pipeline Stage
            </label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all bg-white"
            >
              {LEAD_STAGES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Premium Budget */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <IndianRupee size={13} className="text-slate-400" />
              Estimated Premium / Budget (₹)
            </label>
            <input
              type="number"
              value={premiumBudget}
              onChange={(e) => setPremiumBudget(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
              placeholder="e.g. 25000"
            />
          </div>

          {/* Follow-up Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-400" />
              Next Follow-Up Date
            </label>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
            />
          </div>

          {/* Assigned Employee */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <User size={13} className="text-slate-400" />
              Assign To Advisor / Employee
            </label>
            <select
              value={assignedEmployeeId}
              onChange={(e) => setAssignedEmployeeId(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all bg-white"
            >
              <option value="">Unassigned (Claim by any advisor)</option>
              {employees.map((emp: any) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} {emp.designation ? `(${emp.designation})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Notes / Chat Context */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FileText size={13} className="text-slate-400" />
              Conversation Context &amp; Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all resize-none"
              placeholder="Enter notes, key requirements, or customer requests..."
            />
          </div>

        </div>

        {/* Modal Actions */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center gap-1">
            <AlertCircle size={13} />
            Lead will instantly appear in CRM Pipeline with WhatsApp tag
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLeadMutation.isPending}
              className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {createLeadMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle2 size={15} />
              )}
              Create &amp; Route Lead
            </button>
          </div>
        </div>

      </form>
    </Modal>
  );
}
