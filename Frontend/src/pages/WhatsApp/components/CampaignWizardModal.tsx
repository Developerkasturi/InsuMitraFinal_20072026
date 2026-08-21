import React, { useState } from 'react';
import Modal from '@comps/common/Modal';
import {
  Rocket, CheckCircle2, ChevronRight, ChevronLeft,
  Users, MessageSquare, Calendar, ShieldCheck, Sparkles,
  AlertTriangle, Filter, Wallet, Database, Clock, Zap,
  Play, Smartphone, Check, Split, Gauge, Shield, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onLaunched: (campaign: any) => void;
}

export default function CampaignWizardModal({ open, onClose, onLaunched }: Props) {
  const [step, setStep] = useState(1);

  // Step 1: Strategy & Target
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'UTILITY' | 'MARKETING' | 'AUTHENTICATION'>('MARKETING');
  const [campaignType, setCampaignType] = useState('Scheduled');
  const [dispatchMode, setDispatchMode] = useState<'NOW' | 'SCHEDULED'>('SCHEDULED');

  // Step 2: Audience & Filter Criteria
  const [selectedLists, setSelectedLists] = useState<string[]>(['Existing Customers', 'Doctors']);
  const [optInOnly, setOptInOnly] = useState(true);
  const [excludeInvalid, setExcludeInvalid] = useState(true);
  const [autoCaptureLeads, setAutoCaptureLeads] = useState(true);
  const [leadStage, setLeadStage] = useState('TO_CONTACT');
  const [leadProductInterest, setLeadProductInterest] = useState('Festival Promotion Inquiry');

  // Step 3: Template, A/B Test & Media
  const [enableABTest, setEnableABTest] = useState(false);
  const [selectedTemplateA, setSelectedTemplateA] = useState('Festival Greeting (T002)');
  const [selectedTemplateB, setSelectedTemplateB] = useState('Family Health Cover Special (T003)');
  const [selectedMedia, setSelectedMedia] = useState('Diwali Flyer 2026');

  // Step 4: Schedule, Throttling & Wallet
  const [throttleRate, setThrottleRate] = useState<'SAFE' | 'STANDARD' | 'FAST'>('SAFE');
  const [scheduledDate, setScheduledDate] = useState(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  );

  const availableLists = [
    { name: 'Doctors', count: 145 },
    { name: 'Engineers', count: 89 },
    { name: 'BNI Members', count: 62 },
    { name: 'Health Leads', count: 234 },
    { name: 'MF Leads', count: 178 },
    { name: 'Existing Customers', count: 412 },
    { name: 'Rotary', count: 48 },
  ];

  const totalRaw = selectedLists.reduce((sum, listName) => {
    const found = availableLists.find(l => l.name === listName);
    return sum + (found?.count || 0);
  }, 2800);

  const invalidExcluded = excludeInvalid ? 18 : 0;
  const optOutExcluded = optInOnly ? 34 : 0;
  const netRecipients = Math.max(0, totalRaw - invalidExcluded - optOutExcluded);

  // Meta cost calculation based on Category
  const metaRatePerMsg = category === 'UTILITY' ? 0.12 : category === 'MARKETING' ? 0.78 : 0.15;
  const estimatedCost = +(netRecipients * metaRatePerMsg).toFixed(2);
  const walletBalance = 1450;

  const toggleList = (listName: string) => {
    setSelectedLists(prev =>
      prev.includes(listName) ? prev.filter(l => l !== listName) : [...prev, listName]
    );
  };

  const handleFinish = () => {
    if (!name.trim()) {
      toast.error('Please enter a campaign name');
      setStep(1);
      return;
    }
    const isLaunchNow = dispatchMode === 'NOW';
    const newCampaign = {
      id: `CAM00${Math.floor(Math.random() * 900 + 100)}`,
      name,
      type: isLaunchNow ? 'One-time (Live)' : 'Scheduled',
      category,
      audience: netRecipients,
      template: enableABTest ? `A/B: ${selectedTemplateA} vs ${selectedTemplateB}` : selectedTemplateA,
      templateId: 'T002',
      media: selectedMedia,
      scheduledDate: isLaunchNow ? 'Just Now' : new Date(scheduledDate).toLocaleString(),
      status: isLaunchNow ? 'RUNNING' : 'SCHEDULED',
      sent: isLaunchNow ? 25 : 0,
      delivered: isLaunchNow ? 24 : 0,
      read: 0,
      failed: 0,
      replied: 0,
      leadsGenerated: 0,
      progress: isLaunchNow ? 5 : 0,
      autoCaptureLeads,
      throttleRate: throttleRate === 'SAFE' ? '50 msgs/min' : throttleRate === 'STANDARD' ? '200 msgs/min' : '500 msgs/min',
      isABTest: enableABTest,
      costPerMsg: metaRatePerMsg,
      totalCost: estimatedCost,
      backendQueue: 'whatsapp-campaigns',
      backendJob: isLaunchNow ? 'send-campaign (active dispatch)' : 'send-campaign (scheduled)',
      targetFilters: {
        lists: selectedLists,
        optInOnly,
        excludeInvalid,
        triggerType: isLaunchNow ? 'manual' : 'scheduled',
      },
    };
    onLaunched(newCampaign);
    toast.success(
      isLaunchNow
        ? 'Campaign launched immediately! Dispatched with throttle control.'
        : 'Campaign scheduled successfully! 🚀'
    );
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create WhatsApp Broadcast Campaign"
      subtitle="4-step wizard with audience sizing, Meta pricing, A/B template split & rate throttling"
      size="2xl"
      icon={<Rocket className="text-purple-600" size={20} />}
    >
      <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">

        {/* Step Indicator */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          {[
            { num: 1, label: 'Strategy' },
            { num: 2, label: 'Audience Sizing' },
            { num: 3, label: 'Template & A/B' },
            { num: 4, label: 'Throttling & Launch' },
          ].map((s, idx) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step > s.num
                    ? 'bg-emerald-600 text-white'
                    : step === s.num
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20 ring-4 ring-purple-100'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {step > s.num ? '✓' : s.num}
              </div>
              <span className={`text-xs font-bold hidden sm:inline ${step === s.num ? 'text-slate-800' : 'text-slate-400'}`}>
                {s.label}
              </span>
              {idx < 3 && <div className="w-8 h-0.5 bg-slate-200 hidden md:block" />}
            </div>
          ))}
        </div>

        {/* Step 1: Strategy & Identity */}
        {step === 1 && (
          <div className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Campaign Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Diwali Greetings 2026 or Health Awareness Drive"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:border-purple-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Meta Message Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white focus:border-purple-500 outline-none font-medium"
                >
                  <option value="MARKETING">MARKETING (Offers &amp; Greetings · ₹0.78/msg)</option>
                  <option value="UTILITY">UTILITY (Renewal Reminders · ₹0.12/msg)</option>
                  <option value="AUTHENTICATION">AUTHENTICATION (OTP · ₹0.15/msg)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Dispatch Timing</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDispatchMode('SCHEDULED')}
                    className={`py-2 px-3 font-bold rounded-xl border transition-all cursor-pointer ${
                      dispatchMode === 'SCHEDULED'
                        ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-2xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    🕐 Schedule Later
                  </button>
                  <button
                    type="button"
                    onClick={() => setDispatchMode('NOW')}
                    className={`py-2 px-3 font-bold rounded-xl border transition-all cursor-pointer ${
                      dispatchMode === 'NOW'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-2xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    ⚡ Launch Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Target Audience Sizing */}
        {step === 2 && (
          <div className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">Select Target Segments / Lists</label>
              <div className="flex flex-wrap gap-2">
                {availableLists.map((l) => {
                  const isSel = selectedLists.includes(l.name);
                  return (
                    <button
                      key={l.name}
                      type="button"
                      onClick={() => toggleList(l.name)}
                      className={`px-3 py-1.5 rounded-xl border font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSel
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-purple-300'
                      }`}
                    >
                      <span>{l.name}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isSel ? 'bg-purple-700 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {l.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filter checkboxes */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={optInOnly}
                  onChange={(e) => setOptInOnly(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <span className="font-bold text-slate-800">
                  Strict Consent Filter: Exclude opted-out &amp; unsubscribed contacts (-{optOutExcluded})
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={excludeInvalid}
                  onChange={(e) => setExcludeInvalid(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <span className="font-bold text-slate-800">
                  Phone Validation: Exclude landlines &amp; malformed WhatsApp numbers (-{invalidExcluded})
                </span>
              </label>
            </div>

            {/* Live Audience Sizing Calculation Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Total in Lists</div>
                <div className="text-lg font-black text-slate-700 mt-0.5">{totalRaw.toLocaleString()}</div>
              </div>
              <div className="border-x border-purple-200/60">
                <div className="text-[10px] uppercase font-bold text-slate-400">Exclusions</div>
                <div className="text-lg font-black text-rose-600 mt-0.5">-{invalidExcluded + optOutExcluded}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-purple-700">Qualified Audience</div>
                <div className="text-xl font-black text-purple-800 mt-0.5">{netRecipients.toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Template & A/B Variant Split */}
        {step === 3 && (
          <div className="space-y-4 text-xs">
            {/* A/B Split Toggle */}
            <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Split size={16} className="text-purple-600" />
                <div>
                  <span className="font-bold text-purple-900">Enable 50/50 A/B Variant Testing</span>
                  <p className="text-[11px] text-purple-700">Split broadcast across 2 Meta templates to benchmark open &amp; reply rates</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={enableABTest}
                onChange={(e) => setEnableABTest(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {enableABTest ? 'Variant A Template *' : 'Primary Approved Template *'}
                </label>
                <select
                  value={selectedTemplateA}
                  onChange={(e) => setSelectedTemplateA(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:border-purple-500 outline-none font-medium"
                >
                  <option>Festival Greeting (T002 - Approved ✓)</option>
                  <option>Renewal Reminder (T001 - Approved ✓)</option>
                  <option>Health Awareness (T003 - Approved ✓)</option>
                </select>
              </div>

              {enableABTest ? (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Variant B Template *</label>
                  <select
                    value={selectedTemplateB}
                    onChange={(e) => setSelectedTemplateB(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:border-purple-500 outline-none font-medium"
                  >
                    <option>Family Health Cover Special (T003 - Approved ✓)</option>
                    <option>Free PHC Booking Voucher (T003 - Approved ✓)</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Header Media Flyer</label>
                  <select
                    value={selectedMedia}
                    onChange={(e) => setSelectedMedia(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:border-purple-500 outline-none font-medium"
                  >
                    <option>Diwali Flyer 2026 (🪔 Image)</option>
                    <option>PHC Benefit Card (🏥 Image)</option>
                    <option>Claim Process Guide (📄 PDF)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Smartphone Live Preview */}
            <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2 shadow-inner">
              <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-white/10 pb-2">
                <span className="flex items-center gap-1">
                  <Smartphone size={12} className="text-emerald-400" />
                  Live Preview: {enableABTest ? 'Variant A (50% Traffic)' : selectedTemplateA}
                </span>
                <span className="text-emerald-400 font-mono">Meta Verified</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 leading-relaxed whitespace-pre-line">
                Dear <strong className="text-emerald-400">Rajesh Kumar</strong>,
                {'\n\n'}Warm wishes to you and your family on this festive season! 🎉
                {'\n\n'}Attachment: 📎 {selectedMedia}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Throttling & Launch */}
        {step === 4 && (
          <div className="space-y-4 text-xs">
            {/* Throttle Rate Selector */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 flex items-center gap-1">
                <Gauge size={14} className="text-indigo-600" />
                <span>Delivery Throttle Speed (Quality Score Protection)</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'SAFE', title: '🟢 Safe (50/min)', desc: 'Protects phone quality' },
                  { key: 'STANDARD', title: '🔵 Standard (200/min)', desc: 'Balanced broadcast' },
                  { key: 'FAST', title: '⚡ Fast (500/min)', desc: 'High Tier accounts' },
                ].map(th => (
                  <button
                    key={th.key}
                    type="button"
                    onClick={() => setThrottleRate(th.key as any)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      throttleRate === th.key
                        ? 'border-purple-600 bg-purple-50/70 ring-1 ring-purple-600'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="font-bold text-slate-800">{th.title}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{th.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Schedule input if scheduled */}
            {dispatchMode === 'SCHEDULED' && (
              <div>
                <label className="font-bold text-slate-700 block mb-1">Scheduled Dispatch Time (IST)</label>
                <input
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:border-purple-500 outline-none font-medium"
                />
              </div>
            )}

            {/* Wallet & Meta Cost Summary */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 font-bold">
                <span className="text-slate-700 flex items-center gap-1.5">
                  <Wallet size={14} className="text-purple-600" />
                  Estimated Meta Cloud API Deduction
                </span>
                <span className="text-purple-700 font-mono">₹{metaRatePerMsg.toFixed(2)} / msg</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-white border border-slate-200">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Estimated Spend</div>
                  <div className="text-sm font-extrabold text-purple-700 mt-0.5">₹{estimatedCost}</div>
                </div>
                <div className="p-2 rounded-lg bg-white border border-slate-200">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Wallet Balance</div>
                  <div className="text-sm font-extrabold text-slate-800 mt-0.5">₹{walletBalance.toLocaleString()}</div>
                </div>
                <div className="p-2 rounded-lg bg-white border border-slate-200">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Est. Leads</div>
                  <div className="text-sm font-extrabold text-emerald-600 mt-0.5">~{Math.round(netRecipients * 0.04)} 🎯</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Navigation Buttons */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl flex items-center gap-1 transition-all cursor-pointer"
            >
              <ChevronLeft size={14} /> Back
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            {step < 4 ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 1 && !name.trim()) {
                    toast.error('Campaign name is required');
                    return;
                  }
                  setStep(step + 1);
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-md shadow-purple-500/20 flex items-center gap-1 transition-all cursor-pointer"
              >
                Next <ChevronRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl shadow-md shadow-purple-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Rocket size={14} /> Confirm &amp; {dispatchMode === 'NOW' ? 'Launch Now' : 'Schedule Broadcast'}
              </button>
            )}
          </div>
        </div>

      </div>
    </Modal>
  );
}
