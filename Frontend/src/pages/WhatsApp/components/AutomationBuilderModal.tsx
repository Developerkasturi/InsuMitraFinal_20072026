import React, { useState, useEffect } from 'react';
import Modal from '@comps/common/Modal';
import {
  Sparkles, CheckCircle2, ChevronDown, ChevronUp, Plus,
  Trash2, Play, Calendar, ShieldCheck, AlertCircle, TrendingUp,
  Shield, Heart, Zap, Clock, Database, ArrowRight, Filter,
  FileText, Target, Check, RefreshCw, Smartphone
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (automation: any) => void;
  editTarget?: any;
}

// Preset blueprints mapped to backend queues and Prisma data models
const BLUEPRINTS = [
  {
    id: 'POLICY_RENEWAL',
    name: 'Policy Renewal Series',
    category: 'Policy',
    group: 'policy-lifecycle',
    backendQueue: 'policy-renewal',
    backendJob: 'scan-renewals → notify-renewal',
    cronSchedule: '07:00 IST daily',
    dataSource: 'Policy.endDate',
    trigger: 'POLICY_RENEWAL_DATE',
    description: 'Scans expiring policies daily and sends tiered WhatsApp reminders before policy expiry.',
    template: 'Renewal Reminder',
    leadInterest: 'Health Insurance (Renewal/Upgrade)',
    autoLead: true,
    schedules: [
      { offset: 45, unit: 'Days', relation: 'BEFORE_EVENT', time: '10:00' },
      { offset: 30, unit: 'Days', relation: 'BEFORE_EVENT', time: '10:00' },
      { offset: 15, unit: 'Days', relation: 'BEFORE_EVENT', time: '10:00' },
      { offset: 7,  unit: 'Days', relation: 'BEFORE_EVENT', time: '10:00' },
      { offset: 3,  unit: 'Days', relation: 'BEFORE_EVENT', time: '10:00' },
      { offset: 1,  unit: 'Days', relation: 'BEFORE_EVENT', time: '10:00' },
    ],
    conditions: [
      { field: 'Policy Status', operator: '=', value: 'ACTIVE' },
      { field: 'WhatsApp Opt-in', operator: '=', value: 'TRUE' },
    ],
    stopConditions: ['Policy Renewed', 'Policy Cancelled', 'Contact Opted Out'],
    pipelineSteps: [
      { icon: 'clock', label: 'Daily Scan', detail: '07:00 IST' },
      { icon: 'filter', label: 'Filter', detail: 'Expiring in 1–45d' },
      { icon: 'template', label: 'Send Template', detail: 'Renewal Reminder' },
      { icon: 'lead', label: 'Lead Capture', detail: 'On reply' },
    ],
  },
  {
    id: 'PAYMENT_REMINDER',
    name: 'Installment & Premium Due',
    category: 'Policy',
    group: 'policy-lifecycle',
    backendQueue: 'payment-reminder',
    backendJob: 'scan-payments → notify-payment',
    cronSchedule: '08:00 IST daily',
    dataSource: 'PolicyPayment.dueDate',
    trigger: 'INSTALLMENT_DATE',
    description: 'Alerts policyholders about monthly, quarterly, or half-yearly premium installments.',
    template: 'Installment Reminder',
    leadInterest: 'Payment Inquiry',
    autoLead: false,
    schedules: [
      { offset: 6, unit: 'Days', relation: 'BEFORE_EVENT', time: '09:00' },
      { offset: 3, unit: 'Days', relation: 'BEFORE_EVENT', time: '09:00' },
      { offset: 3, unit: 'Days', relation: 'AFTER_EVENT', time: '09:00' },
    ],
    conditions: [
      { field: 'Policy Status', operator: '=', value: 'ACTIVE' },
      { field: 'Payment Frequency', operator: '!=', value: 'YEARLY' },
      { field: 'Payment Status', operator: '=', value: 'UNPAID' },
    ],
    stopConditions: ['Installment Paid', 'Policy Lapsed'],
    pipelineSteps: [
      { icon: 'clock', label: 'Daily Scan', detail: '08:00 IST' },
      { icon: 'filter', label: 'Filter', detail: 'Unpaid installments' },
      { icon: 'template', label: 'Send Template', detail: 'Installment Reminder' },
      { icon: 'stop', label: 'Auto-Stop', detail: 'When paid' },
    ],
  },
  {
    id: 'GRACE_PERIOD',
    name: 'Grace Period Urgent Alert',
    category: 'Policy',
    group: 'policy-lifecycle',
    backendQueue: 'policy-renewal',
    backendJob: 'scan-renewals → notify-renewal',
    cronSchedule: '07:00 IST daily',
    dataSource: 'Policy.endDate (post-expiry)',
    trigger: 'POLICY_END_DATE',
    description: 'Escalating urgency reminders during the 30-day grace window for lapsed policies.',
    template: 'Renewal Reminder',
    leadInterest: 'Lapsed Policy Revival',
    autoLead: true,
    schedules: [
      { offset: 1,  unit: 'Days', relation: 'AFTER_EVENT', time: '11:00' },
      { offset: 5,  unit: 'Days', relation: 'AFTER_EVENT', time: '11:00' },
      { offset: 10, unit: 'Days', relation: 'AFTER_EVENT', time: '11:00' },
      { offset: 15, unit: 'Days', relation: 'AFTER_EVENT', time: '11:00' },
      { offset: 20, unit: 'Days', relation: 'AFTER_EVENT', time: '11:00' },
      { offset: 25, unit: 'Days', relation: 'AFTER_EVENT', time: '11:00' },
      { offset: 28, unit: 'Days', relation: 'AFTER_EVENT', time: '11:00' },
    ],
    conditions: [
      { field: 'Policy Expired', operator: '=', value: 'TRUE' },
      { field: 'Policy Renewed', operator: '=', value: 'FALSE' },
    ],
    stopConditions: ['Policy Renewed', 'Policy Surrendered'],
    pipelineSteps: [
      { icon: 'clock', label: 'Daily Scan', detail: '07:00 IST' },
      { icon: 'filter', label: 'Filter', detail: 'Expired 1–28d' },
      { icon: 'template', label: 'Send Urgent Nudge', detail: 'Renewal Notice' },
      { icon: 'lead', label: 'Lead Capture', detail: 'On reply' },
    ],
  },
  {
    id: 'PHC_CHECKUP',
    name: 'Preventive Health Checkup (PHC)',
    category: 'PHC',
    group: 'customer-events',
    backendQueue: 'reminders',
    backendJob: 'scan-health-checkups → health-checkup',
    cronSchedule: '09:00 IST daily',
    dataSource: 'PreventiveHealthCheckup.scheduledAt',
    trigger: 'PHC_CYCLE_START',
    description: 'Notifies health insurance customers to claim their complimentary annual health checkup.',
    template: 'PHC Reminder',
    leadInterest: 'Preventive Health Checkup (PHC)',
    autoLead: true,
    schedules: [
      { offset: 120, unit: 'Days', relation: 'AFTER_EVENT', time: '10:00' },
      { offset: 180, unit: 'Days', relation: 'AFTER_EVENT', time: '10:00' },
      { offset: 240, unit: 'Days', relation: 'AFTER_EVENT', time: '10:00' },
      { offset: 270, unit: 'Days', relation: 'AFTER_EVENT', time: '10:00' },
      { offset: 300, unit: 'Days', relation: 'AFTER_EVENT', time: '10:00' },
      { offset: 330, unit: 'Days', relation: 'AFTER_EVENT', time: '10:00' },
      { offset: 350, unit: 'Days', relation: 'AFTER_EVENT', time: '10:00' },
    ],
    conditions: [
      { field: 'Policy Type', operator: '=', value: 'HEALTH' },
      { field: 'Policy Status', operator: '=', value: 'ACTIVE' },
      { field: 'PHC Availed', operator: '=', value: 'FALSE' },
    ],
    stopConditions: ['PHC Completed = TRUE', 'Policy Lapsed'],
    pipelineSteps: [
      { icon: 'clock', label: 'Daily Scan', detail: '09:00 IST' },
      { icon: 'filter', label: 'Filter', detail: 'PHC Unclaimed' },
      { icon: 'template', label: 'Send Template', detail: 'PHC Benefit' },
      { icon: 'lead', label: 'Lead Capture', detail: 'On reply' },
    ],
  },
  {
    id: 'BIRTHDAY_WISHES',
    name: 'Customer Birthday Greetings',
    category: 'Customer',
    group: 'customer-events',
    backendQueue: 'reminders',
    backendJob: 'scan-birthdays → birthday-wish',
    cronSchedule: '07:30 IST daily',
    dataSource: 'Contact.dateOfBirth',
    trigger: 'CUSTOMER_BIRTHDAY',
    description: 'Sends warm, personalized birthday greeting cards automatically every year.',
    template: 'Birthday Wishes',
    leadInterest: 'Birthday Relationship Building',
    autoLead: false,
    schedules: [
      { offset: 0, unit: 'Days', relation: 'ON_EVENT', time: '08:00' },
    ],
    conditions: [
      { field: 'Date of Birth', operator: '=', value: 'TODAY' },
      { field: 'WhatsApp Opt-in', operator: '=', value: 'TRUE' },
    ],
    stopConditions: ['Already Sent This Year'],
    pipelineSteps: [
      { icon: 'clock', label: 'Daily Scan', detail: '07:30 IST' },
      { icon: 'filter', label: 'Filter', detail: 'Birthday = Today' },
      { icon: 'template', label: 'Send Card', detail: 'Birthday Wishes' },
    ],
  },
  {
    id: 'POLICY_THANK_YOU',
    name: 'Instant Policy Welcome & Kit',
    category: 'Events',
    group: 'smart-triggers',
    backendQueue: 'whatsapp-campaigns',
    backendJob: 'triggerEventCampaign(POLICY_CREATED)',
    cronSchedule: 'Real-time event',
    dataSource: 'WhatsappCampaign.targetFilters.eventTrigger',
    trigger: 'POLICY_CREATED',
    description: 'Instant event webhook dispatch when a new policy is issued in CRM.',
    template: 'Policy Thank You',
    leadInterest: 'New Policy Onboarding',
    autoLead: false,
    schedules: [
      { offset: 0, unit: 'Hours', relation: 'ON_EVENT', time: 'Immediate' },
    ],
    conditions: [
      { field: 'Policy Event', operator: '=', value: 'CREATED' },
      { field: 'WhatsApp Opt-in', operator: '=', value: 'TRUE' },
    ],
    stopConditions: ['Already Sent For Policy'],
    pipelineSteps: [
      { icon: 'event', label: 'Event Webhook', detail: 'Policy Created' },
      { icon: 'template', label: 'Send Welcome PDF', detail: 'Welcome Kit' },
    ],
  },
];

export default function AutomationBuilderModal({ open, onClose, onSaved, editTarget }: Props) {
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string>('POLICY_RENEWAL');
  const [openSection, setOpenSection] = useState<number>(1);

  // Form State
  const [name, setName] = useState('Policy Renewal Series');
  const [category, setCategory] = useState('Policy');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [trigger, setTrigger] = useState('POLICY_RENEWAL_DATE');
  const [backendQueue, setBackendQueue] = useState('policy-renewal');
  const [backendJob, setBackendJob] = useState('scan-renewals → notify-renewal');
  const [cronSchedule, setCronSchedule] = useState('07:00 IST daily');
  const [dataSource, setDataSource] = useState('Policy.endDate');
  const [group, setGroup] = useState('policy-lifecycle');
  
  // Conditions & Schedules
  const [conditions, setConditions] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [stopConditions, setStopConditions] = useState<string[]>([]);
  
  // Message & Template
  const [selectedTemplate, setSelectedTemplate] = useState('Renewal Reminder');
  const [autoGenerateLeadOnReply, setAutoGenerateLeadOnReply] = useState(true);
  const [leadProductInterest, setLeadProductInterest] = useState('Health Insurance (Renewal/Upgrade)');
  const [pipelineSteps, setPipelineSteps] = useState<any[]>([]);

  // Simulation test contact
  const [testContact, setTestContact] = useState('Rajesh Kumar (SH-2024-88821, Exp: 20-Oct-2026)');

  // Load preset or editTarget
  useEffect(() => {
    if (editTarget) {
      setName(editTarget.name || '');
      setCategory(editTarget.category || 'Policy');
      setDescription(editTarget.description || '');
      setIsActive(editTarget.status === 'ACTIVE');
      setTrigger(editTarget.trigger || 'POLICY_RENEWAL_DATE');
      setBackendQueue(editTarget.backendQueue || 'policy-renewal');
      setBackendJob(editTarget.backendJob || 'scan-renewals → notify-renewal');
      setCronSchedule(editTarget.cronSchedule || '07:00 IST daily');
      setDataSource(editTarget.dataSource || 'Policy.endDate');
      setGroup(editTarget.group || 'policy-lifecycle');
      setSelectedTemplate(editTarget.template || 'Renewal Reminder');
      setAutoGenerateLeadOnReply(editTarget.autoGenerateLeadOnReply ?? true);
      setLeadProductInterest(editTarget.leadProductInterest || 'Health Insurance');
      setPipelineSteps(editTarget.pipelineSteps || []);
      setStopConditions(editTarget.stopConditions || ['Policy Renewed']);

      if (Array.isArray(editTarget.schedules)) {
        setSchedules(editTarget.schedules.map((s: string, idx: number) => ({
          offset: parseInt(s) || idx + 1,
          unit: s.includes('d') ? 'Days' : 'Hours',
          relation: s.includes('+') || s.includes('after') ? 'AFTER_EVENT' : 'BEFORE_EVENT',
          time: '10:00',
        })));
      }
    } else {
      applyBlueprint('POLICY_RENEWAL');
    }
  }, [editTarget, open]);

  const applyBlueprint = (bpId: string) => {
    setSelectedBlueprintId(bpId);
    const bp = BLUEPRINTS.find(b => b.id === bpId);
    if (!bp) return;

    setName(bp.name);
    setCategory(bp.category);
    setGroup(bp.group);
    setDescription(bp.description);
    setTrigger(bp.trigger);
    setBackendQueue(bp.backendQueue);
    setBackendJob(bp.backendJob);
    setCronSchedule(bp.cronSchedule);
    setDataSource(bp.dataSource);
    setSelectedTemplate(bp.template);
    setAutoGenerateLeadOnReply(bp.autoLead);
    setLeadProductInterest(bp.leadInterest);
    setSchedules([...bp.schedules]);
    setConditions([...bp.conditions]);
    setStopConditions([...bp.stopConditions]);
    setPipelineSteps([...bp.pipelineSteps]);
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Please enter an automation name');
      return;
    }
    const payload = {
      id: editTarget?.id || `A00${Math.floor(Math.random() * 900 + 100)}`,
      name,
      category,
      group,
      trigger,
      backendQueue,
      backendJob,
      cronSchedule,
      dataSource,
      description,
      status: isActive ? 'ACTIVE' : 'PAUSED',
      schedules: schedules.map(s => {
        if (s.relation === 'ON_EVENT') return 'Same day ' + s.time;
        const prefix = s.relation === 'AFTER_EVENT' ? '+' : '';
        const suffix = s.relation === 'BEFORE_EVENT' ? ' before' : ' after';
        return `${prefix}${s.offset}${s.unit[0].toLowerCase()}${suffix}`;
      }),
      conditions: conditions.map(c => `${c.field} ${c.operator} ${c.value}`),
      stopConditions,
      autoGenerateLeadOnReply,
      leadProductInterest,
      template: selectedTemplate,
      pipelineSteps,
      nextRun: 'Today, 10:00 AM',
      sent: editTarget?.sent || 0,
      delivered: editTarget?.delivered || 0,
      read: editTarget?.read || 0,
      replied: editTarget?.replied || 0,
      leadsGenerated: editTarget?.leadsGenerated || 0,
    };
    onSaved(payload);
    toast.success('Automation rule successfully saved & registered!');
    onClose();
  };

  const toggleSection = (id: number) => {
    setOpenSection(curr => curr === id ? 0 : id);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Precise Automation Rule Engine"
      subtitle="Configure queue-backed schedules, Prisma triggers, templates & direct CRM lead generation"
      size="3xl"
      icon={<Sparkles className="text-blue-600" size={20} />}
    >
      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 max-h-[78vh] overflow-y-auto">
        
        {/* ── Left 2 Columns: Config Panels ── */}
        <div className="lg:col-span-2 space-y-3.5">

          {/* Blueprint Selector (Quick Presets) */}
          {!editTarget && (
            <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-blue-900 flex items-center gap-1.5">
                  <Zap size={14} className="text-blue-600" />
                  Select Automation Blueprint
                </span>
                <span className="text-[10px] font-bold text-blue-600 uppercase">Pre-configured Queues</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {BLUEPRINTS.map((bp) => {
                  const isSelected = selectedBlueprintId === bp.id;
                  return (
                    <button
                      key={bp.id}
                      type="button"
                      onClick={() => applyBlueprint(bp.id)}
                      className={`p-2 rounded-xl text-left transition-all border text-xs cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-700 shadow-xs font-bold'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="truncate">{bp.name}</div>
                      <div className={`text-[10px] truncate mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                        {bp.backendQueue}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 1: Basic & Backend Queue Mapping */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection(1)}
              className="w-full p-3.5 flex items-center justify-between bg-slate-50/70 hover:bg-slate-100/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center">1</span>
                <span className="text-xs font-extrabold text-slate-800">Rule Identity & Worker Queue</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded">{backendQueue}</span>
                {openSection === 1 ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </button>
            {openSection === 1 && (
              <div className="p-4 space-y-3 border-t border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700">Automation Name *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700">Category & Group</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:border-blue-500 outline-none"
                    >
                      <option>Policy</option>
                      <option>PHC</option>
                      <option>Customer</option>
                      <option>Events</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Worker Queue</span>
                    <div className="font-mono font-bold text-slate-800 text-[11px]">{backendQueue}</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Prisma Source</span>
                    <div className="font-mono font-bold text-slate-800 text-[11px]">{dataSource}</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Cron Scan</span>
                    <div className="font-mono font-bold text-blue-700 text-[11px]">{cronSchedule}</div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">Execution Description</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:border-blue-500 outline-none resize-none leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-semibold text-slate-700">Automation Active Status</span>
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isActive ? '● Active' : '⏸ Paused'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Trigger Engine */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection(2)}
              className="w-full p-3.5 flex items-center justify-between bg-slate-50/70 hover:bg-slate-100/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center">2</span>
                <span className="text-xs font-extrabold text-slate-800">Trigger Mechanism & Entry Filters</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-bold">{trigger}</span>
                {openSection === 2 ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </button>
            {openSection === 2 && (
              <div className="p-4 space-y-3 border-t border-slate-100">
                <div>
                  <label className="text-xs font-bold text-slate-700">Select Date/Event Trigger</label>
                  <select
                    value={trigger}
                    onChange={(e) => setTrigger(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:border-blue-500 outline-none font-medium"
                  >
                    <option value="POLICY_RENEWAL_DATE">POLICY_RENEWAL_DATE (Calculated from Policy.endDate)</option>
                    <option value="POLICY_END_DATE">POLICY_END_DATE (For post-expiry &amp; grace period alerts)</option>
                    <option value="INSTALLMENT_DATE">INSTALLMENT_DATE (From PolicyPayment.dueDate)</option>
                    <option value="PHC_CYCLE_START">PHC_CYCLE_START (Preventive Health Checkup annual cycle)</option>
                    <option value="CUSTOMER_BIRTHDAY">CUSTOMER_BIRTHDAY (From Contact.dateOfBirth)</option>
                    <option value="POLICY_CREATED">POLICY_CREATED (Real-time CRM policy creation event)</option>
                    <option value="FOLLOW_UP_DATE">FOLLOW_UP_DATE (From ProductInterest.followUpDate)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">Qualification Entry Filters</label>
                  <div className="space-y-1.5 mt-1">
                    {conditions.map((c, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                        <span className="font-bold text-slate-700">{c.field}</span>
                        <span className="font-mono text-blue-600">{c.operator}</span>
                        <span className="font-semibold text-emerald-700">{c.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Multi-Stage Schedules */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection(3)}
              className="w-full p-3.5 flex items-center justify-between bg-slate-50/70 hover:bg-slate-100/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center">3</span>
                <span className="text-xs font-extrabold text-slate-800">Multi-Stage Schedule Rules ({schedules.length} steps)</span>
              </div>
              <div className="flex items-center gap-2">
                {openSection === 3 ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </button>
            {openSection === 3 && (
              <div className="p-4 space-y-2 border-t border-slate-100">
                <p className="text-[11px] text-slate-500 mb-1">
                  Each step calculates relative to the event date and automatically sends the template at the scheduled time.
                </p>
                {schedules.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex-wrap">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <select
                      value={s.relation}
                      onChange={(e) => {
                        const copy = [...schedules];
                        copy[idx].relation = e.target.value;
                        setSchedules(copy);
                      }}
                      className="px-2 py-1 rounded-lg border border-slate-200 text-xs bg-white"
                    >
                      <option value="BEFORE_EVENT">BEFORE_EVENT</option>
                      <option value="AFTER_EVENT">AFTER_EVENT</option>
                      <option value="ON_EVENT">ON_EVENT</option>
                    </select>
                    <input
                      type="number"
                      value={s.offset}
                      onChange={(e) => {
                        const copy = [...schedules];
                        copy[idx].offset = Number(e.target.value);
                        setSchedules(copy);
                      }}
                      className="w-14 px-2 py-1 rounded-lg border border-slate-200 text-xs text-center"
                    />
                    <select
                      value={s.unit}
                      onChange={(e) => {
                        const copy = [...schedules];
                        copy[idx].unit = e.target.value;
                        setSchedules(copy);
                      }}
                      className="px-2 py-1 rounded-lg border border-slate-200 text-xs bg-white"
                    >
                      <option>Days</option>
                      <option>Hours</option>
                    </select>
                    <span className="text-slate-400 text-xs">at</span>
                    <input
                      type="time"
                      value={s.time}
                      onChange={(e) => {
                        const copy = [...schedules];
                        copy[idx].time = e.target.value;
                        setSchedules(copy);
                      }}
                      className="px-2 py-1 rounded-lg border border-slate-200 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setSchedules(schedules.filter((_, i) => i !== idx))}
                      className="p-1 text-slate-400 hover:text-rose-500 ml-auto cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setSchedules([...schedules, { offset: 1, unit: 'Days', relation: 'BEFORE_EVENT', time: '10:00' }])}
                  className="w-full py-1.5 text-xs font-bold text-blue-600 border border-dashed border-blue-300 rounded-xl hover:bg-blue-50/50 flex items-center justify-center gap-1 mt-2 cursor-pointer"
                >
                  <Plus size={13} /> Add Schedule Step
                </button>
              </div>
            )}
          </div>

          {/* Section 4: Direct Lead Generation & Stop Rules */}
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50/30 overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => toggleSection(4)}
              className="w-full p-3.5 flex items-center justify-between bg-emerald-100/50 hover:bg-emerald-100/80 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center">4</span>
                <span className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-emerald-600" />
                  Direct CRM Lead Capture &amp; Stop Rules
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-200 px-2 py-0.5 rounded-full">
                  {autoGenerateLeadOnReply ? 'Auto-Lead Enabled ✓' : 'Disabled'}
                </span>
                {openSection === 4 ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </button>
            {openSection === 4 && (
              <div className="p-4 space-y-3 border-t border-emerald-200/60 bg-white">
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div>
                    <div className="text-xs font-bold text-emerald-900">Auto-Create Lead on Customer Response</div>
                    <div className="text-[11px] text-emerald-700">
                      When customer replies or inquires, immediately record a ProductInterest in CRM.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoGenerateLeadOnReply}
                    onChange={(e) => setAutoGenerateLeadOnReply(e.target.checked)}
                    className="w-5 h-5 accent-emerald-600 cursor-pointer"
                  />
                </div>

                {autoGenerateLeadOnReply && (
                  <div>
                    <label className="text-xs font-bold text-slate-700">Default CRM Interest Tag</label>
                    <input
                      type="text"
                      value={leadProductInterest}
                      onChange={(e) => setLeadProductInterest(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:border-emerald-500 outline-none font-medium"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-700">Auto-Stop Conditions (Cancel remaining steps)</label>
                  <div className="space-y-1 mt-1.5">
                    {stopConditions.map((sc, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                        <span className="font-semibold text-slate-700">{sc}</span>
                        <button
                          type="button"
                          onClick={() => setStopConditions(stopConditions.filter((_, idx) => idx !== i))}
                          className="text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ── Right Column: Dry Run / Live Execution Simulation ── */}
        <div className="rounded-2xl bg-slate-900 text-white p-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Play size={14} className="text-emerald-400" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">Execution Simulator</h4>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                Live Test
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400">Select Test Contact</label>
              <select
                value={testContact}
                onChange={(e) => setTestContact(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-slate-800 border border-slate-700 text-white outline-none"
              >
                <option>Rajesh Kumar (SH-2024-88821, Exp: 20-Oct-2026)</option>
                <option>Priya Singh (NIA-2023-55421, Exp: 15-Mar-2027)</option>
                <option>Amit Sharma (ICICI-2024-33142, Exp: 01-Sep-2026)</option>
              </select>
            </div>

            {/* Calculated Timeline */}
            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-2 text-[11px]">
              <div className="font-bold text-slate-300 pb-1 border-b border-slate-700 flex items-center justify-between">
                <span>Calculated Send Schedule</span>
                <span className="text-emerald-400 font-mono">20-Oct-2026</span>
              </div>
              <div className="space-y-1 text-slate-400">
                {schedules.slice(0, 4).map((s, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{s.offset}{s.unit[0]} {s.relation.toLowerCase().replace('_event','')}:</span>
                    <span className="text-white font-mono">{s.time} IST</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Template WhatsApp Mock Preview */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                <Smartphone size={12} className="text-emerald-400" />
                <span>Resolved WhatsApp Bubble:</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 leading-relaxed whitespace-pre-line font-sans shadow-inner">
                Hello <strong className="text-emerald-400">Rajesh</strong>,
                <br /><br />
                Your <strong className="text-emerald-400">Star Health</strong> policy *SH-2024-88821* is due on *20-Oct-2026*.
                <br /><br />
                Premium: ₹<strong className="text-emerald-400">24,500</strong>
                <br /><br />
                Please renew before expiry. Reply to pay or upgrade.
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 mt-4">
            <button
              type="button"
              onClick={handleSave}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <CheckCircle2 size={15} /> Save &amp; Activate Rule
            </button>
          </div>
        </div>

      </div>
    </Modal>
  );
}

