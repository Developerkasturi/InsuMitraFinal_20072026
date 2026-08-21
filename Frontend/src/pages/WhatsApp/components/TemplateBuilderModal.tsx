import React, { useState, useEffect } from 'react';
import Modal from '@comps/common/Modal';
import {
  FileText, Sparkles, CheckCircle2, AlertTriangle, Eye, Send,
  Image, Video, File, Plus, Trash2, Smartphone, HelpCircle,
  ExternalLink, Phone, ArrowRight, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (template: any) => void;
  editTarget?: any;
}

export default function TemplateBuilderModal({ open, onClose, onSaved, editTarget }: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('UTILITY');
  const [language, setLanguage] = useState('English (en_US)');
  const [headerType, setHeaderType] = useState<'NONE' | 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'VIDEO'>('TEXT');
  const [headerText, setHeaderText] = useState('IMPORTANT: POLICY RENEWAL');
  const [headerMediaName, setHeaderMediaName] = useState('');
  const [body, setBody] = useState(
    'Hello {{1}},\n\nYour {{2}} policy *{{3}}* is due for renewal on *{{4}}*.\n\nPremium Amount: ₹{{5}}\n\nPlease renew before expiry to maintain continuous coverage.'
  );
  const [footer, setFooter] = useState('InfoYashonanada Insurance · Reply STOP to opt out');
  
  // Dynamic Variables Mapping
  const [variableMappings, setVariableMappings] = useState<Array<{ num: string; label: string; crmField: string; sampleVal: string }>>([
    { num: '1', label: 'Customer Name', crmField: 'Contact.firstName', sampleVal: 'Rajesh Kumar' },
    { num: '2', label: 'Insurer Name', crmField: 'Policy.insurerName', sampleVal: 'Star Health' },
    { num: '3', label: 'Policy Number', crmField: 'Policy.policyNumber', sampleVal: 'SH-2024-88821' },
    { num: '4', label: 'Due Date', crmField: 'Policy.endDate', sampleVal: '20-Oct-2026' },
    { num: '5', label: 'Premium Amount', crmField: 'Policy.premiumAmount', sampleVal: '24,500' },
  ]);

  // Interactive Buttons
  const [buttons, setButtons] = useState<Array<{ type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'; text: string; url?: string; phone?: string }>>([
    { type: 'QUICK_REPLY', text: '💳 Pay Online Link' },
    { type: 'QUICK_REPLY', text: '👤 Talk to Advisor' },
  ]);

  useEffect(() => {
    if (editTarget) {
      setName(editTarget.name?.toLowerCase().replace(/\s+/g, '_') || '');
      setCategory(editTarget.category || 'UTILITY');
      setLanguage(editTarget.language || 'English (en_US)');
      setHeaderType(editTarget.headerType || 'NONE');
      setHeaderText(editTarget.headerText || editTarget.header || '');
      setHeaderMediaName(editTarget.headerMediaName || '');
      setBody(editTarget.body || '');
      setFooter(editTarget.footer || 'InfoYashonanada Insurance');
      if (editTarget.buttons) setButtons(editTarget.buttons);
    } else {
      setName('policy_renewal_reminder');
      setCategory('UTILITY');
      setLanguage('English (en_US)');
      setHeaderType('TEXT');
      setHeaderText('IMPORTANT: POLICY RENEWAL');
      setHeaderMediaName('');
      setBody('Hello {{1}},\n\nYour {{2}} health policy *{{3}}* is due on *{{4}}*.\n\nPremium Amount: ₹{{5}}\n\nPlease renew to avoid coverage gaps.');
      setFooter('InfoYashonanada Insurance · Reply STOP to opt out');
      setButtons([
        { type: 'QUICK_REPLY', text: '💳 Pay Online Link' },
        { type: 'QUICK_REPLY', text: '👤 Talk to Advisor' },
      ]);
    }
  }, [editTarget, open]);

  // Synchronize detected {{n}} variables from body
  useEffect(() => {
    const matches = body.match(/\{\{(\d+)\}\}/g) || [];
    const uniqueNums = Array.from(new Set(matches.map(m => m.replace(/[{}]/g, '')))).sort((a, b) => +a - +b);

    const defaultFieldMap: Record<string, { label: string; crmField: string; sample: string }> = {
      '1': { label: 'Customer Name', crmField: 'Contact.firstName', sample: 'Rajesh Kumar' },
      '2': { label: 'Insurer / Plan', crmField: 'Policy.insurerName', sample: 'Star Health' },
      '3': { label: 'Policy Number', crmField: 'Policy.policyNumber', sample: 'SH-2024-88821' },
      '4': { label: 'Due Date', crmField: 'Policy.endDate', sample: '20-Oct-2026' },
      '5': { label: 'Amount', crmField: 'Policy.premiumAmount', sample: '24,500' },
      '6': { label: 'Agent Name', crmField: 'Agent.name', sample: 'Padmanabha Das' },
    };

    setVariableMappings(prev => {
      return uniqueNums.map(num => {
        const existing = prev.find(p => p.num === num);
        if (existing) return existing;
        const def = defaultFieldMap[num] || { label: `Variable {{${num}}}`, crmField: 'Custom Field', sample: `Value_${num}` };
        return { num, label: def.label, crmField: def.crmField, sampleVal: def.sample };
      });
    });
  }, [body]);

  const handleAddButton = () => {
    if (buttons.length >= 3) {
      toast.error('WhatsApp allows maximum 3 quick reply buttons or 2 CTA buttons.');
      return;
    }
    setButtons(prev => [...prev, { type: 'QUICK_REPLY', text: 'Custom Response' }]);
  };

  const handleRemoveButton = (idx: number) => {
    setButtons(prev => prev.filter((_, i) => i !== idx));
  };

  // Render resolved preview body
  const resolvedPreviewText = () => {
    let text = body;
    variableMappings.forEach(v => {
      const reg = new RegExp(`\\{\\{${v.num}\\}\\}`, 'g');
      text = text.replace(reg, `*${v.sampleVal}*`);
    });
    return text;
  };

  // Policy check warning
  const hasPromissoryPhasing = /guaranteed|100% claim|free money|assured/i.test(body);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !body.trim()) {
      toast.error('Template name and message body are required');
      return;
    }

    const payload = {
      id: editTarget?.id || `T00${Math.floor(Math.random() * 900 + 100)}`,
      name,
      metaTemplateId: editTarget?.metaTemplateId || `waba_tpl_${Math.floor(10000000 + Math.random() * 90000000)}`,
      category,
      language,
      headerType,
      headerText: headerType === 'TEXT' ? headerText : null,
      headerMediaName: headerType !== 'NONE' && headerType !== 'TEXT' ? (headerMediaName || 'Attached Asset') : null,
      body,
      footer,
      buttons,
      status: 'PENDING',
      variables: variableMappings.length,
      variables_map: variableMappings.map(v => [v.num, v.label, v.crmField, v.sampleVal]),
      sent: editTarget?.sent || 0,
      usageCount: editTarget?.usageCount || 1,
      lastUsed: 'Just now',
    };

    onSaved(payload);
    toast.success('Template submitted to Meta Business API for verification! ⏳');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="WhatsApp Template Builder & Variable Mapper"
      subtitle="Configure Meta Cloud API verified broadcast templates with dynamic CRM data bindings"
      size="2xl"
      icon={<FileText className="text-emerald-600" size={20} />}
    >
      <form onSubmit={handleSubmit} className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6 max-h-[80vh] overflow-y-auto">
        
        {/* Left 7 cols: Form & Variable Bindings */}
        <div className="lg:col-span-7 space-y-4 text-xs">
          
          {/* Row 1: Name & Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Template Name (Meta slug) *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                placeholder="e.g. policy_renewal_v2"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 focus:border-emerald-500 font-mono outline-none"
              />
              <span className="text-[10px] text-slate-400">Lowercase letters, numbers and underscores only</span>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white focus:border-emerald-500 outline-none"
              >
                <option value="UTILITY">UTILITY (Transactional / Reminders)</option>
                <option value="MARKETING">MARKETING (Promotions / Greetings)</option>
                <option value="AUTHENTICATION">AUTHENTICATION (OTP / Security)</option>
              </select>
            </div>
          </div>

          {/* Row 2: Language & Header Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white focus:border-emerald-500 outline-none"
              >
                <option value="English (en_US)">English (en_US)</option>
                <option value="Hindi (hi)">Hindi (hi)</option>
                <option value="Marathi (mr)">Marathi (mr)</option>
                <option value="Gujarati (gu)">Gujarati (gu)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Header Format</label>
              <select
                value={headerType}
                onChange={(e) => setHeaderType(e.target.value as any)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white focus:border-emerald-500 outline-none"
              >
                <option value="NONE">None (No Header)</option>
                <option value="TEXT">Text Header</option>
                <option value="IMAGE">Image Header (JPG / PNG)</option>
                <option value="DOCUMENT">Document Header (PDF)</option>
                <option value="VIDEO">Video Header (MP4)</option>
              </select>
            </div>
          </div>

          {/* Dynamic Header Input */}
          {headerType === 'TEXT' && (
            <div>
              <label className="font-bold text-slate-700 block mb-1">Header Text</label>
              <input
                type="text"
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                placeholder="e.g. IMPORTANT: POLICY EXPIRY ALERT"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none uppercase font-bold"
              />
            </div>
          )}

          {headerType !== 'NONE' && headerType !== 'TEXT' && (
            <div>
              <label className="font-bold text-slate-700 block mb-1">Attach Media from Media Library</label>
              <input
                type="text"
                value={headerMediaName}
                onChange={(e) => setHeaderMediaName(e.target.value)}
                placeholder="e.g. Diwali Flyer 2026 / Claim Guide PDF"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none"
              />
            </div>
          )}

          {/* Body Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700">
                Body Text * <span className="text-slate-400 font-normal">(Use &#123;&#123;1&#125;&#125;, &#123;&#123;2&#125;&#125; for CRM tokens)</span>
              </label>
              <span className="text-[10px] font-mono text-slate-400">{body.length} / 1024 chars</span>
            </div>
            <textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none resize-none leading-relaxed font-sans"
            />
            {hasPromissoryPhasing && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-2 mt-1.5 text-[11px]">
                <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                <span>
                  <strong>Meta Policy Warning:</strong> Promissory phrases like "guaranteed" or "assured" frequently cause Meta rejection.
                </span>
              </div>
            )}
          </div>

          {/* Variable Mapping Table */}
          {variableMappings.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                <span className="font-extrabold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1">
                  <Sparkles size={12} className="text-purple-600" />
                  Dynamic CRM Variable Bindings ({variableMappings.length})
                </span>
                <span className="text-[10px] text-slate-400">Resolved at runtime per recipient</span>
              </div>

              <div className="space-y-2">
                {variableMappings.map((v, i) => (
                  <div key={v.num} className="grid grid-cols-12 gap-2 items-center">
                    <span className="col-span-1 font-mono font-bold text-purple-700 bg-purple-100 text-center py-1 rounded-md text-[10px]">
                      &#123;&#123;{v.num}&#125;&#125;
                    </span>
                    <div className="col-span-6">
                      <select
                        value={v.crmField}
                        onChange={(e) => {
                          const val = e.target.value;
                          setVariableMappings(prev => prev.map((item, idx) => idx === i ? { ...item, crmField: val, label: val.split('.')[1] || val } : item));
                        }}
                        className="w-full px-2 py-1 text-[11px] rounded-lg border border-slate-200 bg-white font-medium"
                      >
                        <option value="Contact.firstName">Contact.firstName (e.g. Rajesh)</option>
                        <option value="Contact.fullName">Contact.fullName (e.g. Rajesh Kumar)</option>
                        <option value="Contact.city">Contact.city (e.g. Pune)</option>
                        <option value="Policy.policyNumber">Policy.policyNumber (e.g. SH-2024-88821)</option>
                        <option value="Policy.insurerName">Policy.insurerName (e.g. Star Health)</option>
                        <option value="Policy.endDate">Policy.endDate (e.g. 20-Oct-2026)</option>
                        <option value="Policy.premiumAmount">Policy.premiumAmount (e.g. 24,500)</option>
                        <option value="Policy.phcBalance">Policy.phcBalance (e.g. 10,000)</option>
                        <option value="Agent.name">Agent.name (Padmanabha Das)</option>
                        <option value="Custom Text">Custom Text / Campaign Payload</option>
                      </select>
                    </div>
                    <div className="col-span-5">
                      <input
                        type="text"
                        value={v.sampleVal}
                        onChange={(e) => {
                          const val = e.target.value;
                          setVariableMappings(prev => prev.map((item, idx) => idx === i ? { ...item, sampleVal: val } : item));
                        }}
                        placeholder="Sample preview value"
                        className="w-full px-2 py-1 text-[11px] rounded-lg border border-slate-200 bg-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interactive Buttons Config */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <span className="font-extrabold text-slate-700 uppercase tracking-wider text-[10px]">
                Interactive Buttons (Optional)
              </span>
              <button
                type="button"
                onClick={handleAddButton}
                className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5"
              >
                <Plus size={11} /> Add Button
              </button>
            </div>

            <div className="space-y-1.5">
              {buttons.map((btn, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 px-2 py-1 rounded-md">
                    {btn.type === 'QUICK_REPLY' ? 'Quick Reply' : btn.type}
                  </span>
                  <input
                    type="text"
                    value={btn.text}
                    onChange={(e) => {
                      const val = e.target.value;
                      setButtons(prev => prev.map((b, i) => i === idx ? { ...b, text: val } : b));
                    }}
                    placeholder="Button Title (e.g. Renew Now)"
                    className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveButton(idx)}
                    className="text-slate-400 hover:text-rose-600 p-1"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Input */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">Footer Disclaimer</label>
            <input
              type="text"
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              placeholder="e.g. InfoYashonanada Insurance | Unsubscribe"
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none"
            />
          </div>

        </div>

        {/* Right 5 cols: Live Smartphone Simulator */}
        <div className="lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
              <Smartphone size={14} className="text-emerald-600" />
              <span>Interactive Phone Simulator</span>
            </div>

            {/* Phone Frame */}
            <div className="rounded-3xl bg-slate-900 p-3 shadow-2xl border-4 border-slate-800">
              
              {/* Phone Top Notch Bar */}
              <div className="flex items-center justify-between px-2 py-1 text-[9px] text-white/60 font-mono border-b border-white/10 mb-2">
                <span>WhatsApp Business</span>
                <span className="text-emerald-400 font-bold">● Verified</span>
              </div>

              {/* Chat Bubble Canvas */}
              <div className="rounded-2xl bg-[#efeae2] p-3 space-y-2 min-h-[300px] flex flex-col justify-end text-xs">
                
                {/* Received Bubble */}
                <div className="rounded-2xl bg-white p-3.5 shadow-sm border border-slate-200/80 text-slate-800 space-y-2.5 rounded-tl-none">
                  
                  {/* Header Preview */}
                  {headerType === 'TEXT' && headerText && (
                    <div className="font-extrabold text-slate-800 uppercase text-[11px] tracking-wider pb-1.5 border-b border-slate-100">
                      {headerText}
                    </div>
                  )}

                  {headerType === 'IMAGE' && (
                    <div className="h-28 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex flex-col items-center justify-center text-emerald-800 border border-emerald-200">
                      <Image size={24} className="text-emerald-600 mb-1" />
                      <span className="text-[10px] font-bold">{headerMediaName || 'Attached Image Flyer'}</span>
                    </div>
                  )}

                  {headerType === 'DOCUMENT' && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-900">
                      <File size={20} className="text-rose-600 shrink-0" />
                      <div className="truncate">
                        <div className="font-bold text-[11px] truncate">{headerMediaName || 'Policy Document.pdf'}</div>
                        <div className="text-[9px] text-rose-600">PDF Document • 1.2 MB</div>
                      </div>
                    </div>
                  )}

                  {/* Body Preview with Resolved Tokens */}
                  <p className="whitespace-pre-line leading-relaxed text-slate-700 text-[11px]">
                    {resolvedPreviewText()}
                  </p>

                  {/* Footer & Timestamp */}
                  <div className="flex items-center justify-between text-[9px] text-slate-400 pt-1.5 border-t border-slate-100">
                    <span className="truncate pr-2">{footer}</span>
                    <span className="shrink-0 font-mono">10:00 AM</span>
                  </div>

                  {/* Interactive Button Pills */}
                  {buttons.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-1">
                      {buttons.map((btn, i) => (
                        <div
                          key={i}
                          className="py-1.5 text-center text-blue-600 font-bold text-[11px] bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer flex items-center justify-center gap-1"
                        >
                          {btn.type === 'URL' && <ExternalLink size={11} />}
                          {btn.type === 'PHONE_NUMBER' && <Phone size={11} />}
                          <span>{btn.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                </div>

              </div>

            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Send size={13} />
              <span>Submit to Meta for Approval</span>
            </button>
          </div>

        </div>

      </form>
    </Modal>
  );
}
