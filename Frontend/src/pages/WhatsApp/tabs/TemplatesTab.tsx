import React, { useState } from 'react';
import {
  FileText, Plus, Search, CheckCircle2, Clock,
  XCircle, AlertTriangle, Send, Eye, Edit3, Image,
  File, Smartphone, Copy, Sparkles, HelpCircle, ArrowRight
} from 'lucide-react';
import { MOCK_WHATSAPP_DATA } from '../mockData';
import TemplateBuilderModal from '../components/TemplateBuilderModal';
import toast from 'react-hot-toast';

interface Props {
  onOpenBuilder: () => void;
}

export default function TemplatesTab({ onOpenBuilder }: Props) {
  const [templates, setTemplates] = useState(MOCK_WHATSAPP_DATA.templates);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);

  const filteredTemplates = templates.filter(t => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = t.name.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      (t.metaTemplateId && t.metaTemplateId.toLowerCase().includes(q));
    const matchesCategory = categoryFilter === 'ALL' || t.category === categoryFilter;
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleSave = (newTpl: any) => {
    setTemplates(prev => {
      const idx = prev.findIndex(t => t.id === newTpl.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = newTpl;
        return next;
      }
      return [newTpl, ...prev];
    });
  };

  const handleDuplicate = (t: any) => {
    const duplicated = {
      ...t,
      id: `T00${Math.floor(Math.random() * 900 + 100)}`,
      name: `${t.name}_copy`,
      metaTemplateId: `waba_tpl_${Math.floor(10000000 + Math.random() * 90000000)}`,
      status: 'PENDING',
      sent: 0,
      delivered: 0,
      read: 0,
      replied: 0,
      lastUsed: 'Just now',
    };
    setTemplates(prev => [duplicated, ...prev]);
    toast.success(`Duplicated template "${t.name}" as "${duplicated.name}"`);
  };

  const rejectedTemplate = templates.find(t => t.status === 'REJECTED');

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-slate-800">WhatsApp Message Templates</h3>
            <span className="text-[11px] font-bold text-slate-400 font-mono">
              ({templates.length} Templates · Meta Cloud API)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Meta Cloud API verified broadcast templates with dynamic CRM token interpolation &amp; rich media headers
          </p>
        </div>
        <button
          onClick={() => {
            setEditTarget(null);
            setBuilderOpen(true);
          }}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <Plus size={15} /> Create New Template
        </button>
      </div>

      {/* Rejection Alert Banner with Actionable Resolution */}
      {rejectedTemplate && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-900 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold flex items-center gap-2">
                <span>Meta Template Rejection: {rejectedTemplate.name} ({rejectedTemplate.id})</span>
                <span className="text-[10px] font-mono bg-rose-200/80 text-rose-800 px-1.5 py-0.2 rounded font-bold">
                  {rejectedTemplate.metaTemplateId}
                </span>
              </div>
              <p className="text-[11px] text-rose-700 leading-relaxed">
                {rejectedTemplate.rejectReason || 'Promissory phrasing violated WhatsApp Business guidelines.'}
              </p>
              {rejectedTemplate.rejectSuggestion && (
                <p className="text-[11px] text-emerald-800 font-semibold mt-1">
                  💡 Recommendation: {rejectedTemplate.rejectSuggestion}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              setEditTarget(rejectedTemplate);
              setBuilderOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all shrink-0 cursor-pointer"
          >
            Fix Phrasing &amp; Resubmit
          </button>
        </div>
      )}

      {/* Filters & Search */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">

        {/* Category & Status Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {['ALL', 'UTILITY', 'MARKETING', 'AUTHENTICATION'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${categoryFilter === cat
                    ? 'bg-white text-slate-800 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                  }`}
              >
                {cat === 'ALL' ? 'All Categories' : cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { key: 'ALL', label: 'All Statuses' },
              { key: 'APPROVED', label: '✓ Approved' },
              { key: 'PENDING', label: '⏳ Pending' },
              { key: 'REJECTED', label: '✕ Rejected' },
            ].map((st) => (
              <button
                key={st.key}
                onClick={() => setStatusFilter(st.key)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${statusFilter === st.key
                    ? 'bg-white text-slate-800 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                  }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full lg:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates, ID, categories..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
          />
        </div>

      </div>

      {/* Templates Table */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Template &amp; Meta Slug</th>
                <th className="py-3.5 px-4">Header / Media</th>
                <th className="py-3.5 px-4">Category &amp; Lang</th>
                <th className="py-3.5 px-4">Meta Status</th>
                <th className="py-3.5 px-4">CRM Variables</th>
                <th className="py-3.5 px-4">Broadcast Stats</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredTemplates.map((t) => {
                const isApproved = t.status === 'APPROVED';
                const isPending = t.status === 'PENDING';
                const isRejected = t.status === 'REJECTED';

                return (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">

                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-slate-800">{t.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                        <span>{t.id}</span>
                        <span>•</span>
                        <span className="text-purple-600">{t.metaTemplateId || 'waba_tpl_auto'}</span>
                      </div>
                    </td>

                    {/* Header / Media Type */}
                    <td className="py-3.5 px-4">
                      {t.headerType === 'TEXT' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 text-slate-700">
                          <FileText size={10} /> Text Header
                        </span>
                      )}
                      {t.headerType === 'IMAGE' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                          <Image size={10} /> Image Attached
                        </span>
                      )}
                      {t.headerType === 'DOCUMENT' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                          <File size={10} /> PDF Attached
                        </span>
                      )}
                      {(!t.headerType || t.headerType === 'NONE') && (
                        <span className="text-[10px] text-slate-400 font-medium">None</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-700">{t.category}</div>
                      <div className="text-[10px] text-slate-400">{t.language}</div>
                    </td>

                    {/* Meta Status */}
                    <td className="py-3.5 px-4">
                      {isApproved && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={11} className="text-emerald-500" /> Approved
                        </span>
                      )}
                      {isPending && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock size={11} className="text-amber-500" /> Pending Review
                        </span>
                      )}
                      {isRejected && (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200 cursor-help"
                          title={t.rejectReason}
                        >
                          <XCircle size={11} className="text-rose-500" /> Rejected
                        </span>
                      )}
                    </td>

                    {/* CRM Variables summary */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1 flex-wrap">
                        {t.variables_map ? (
                          t.variables_map.map((v: any, idx: number) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.2 bg-purple-50 text-purple-700 font-mono text-[9px] font-bold rounded border border-purple-200"
                              title={`${v[0]}: ${v[1]} (${v[2]})`}
                            >
                              &#123;&#123;{v[0]}&#125;&#125;
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400">{t.variables} params</span>
                        )}
                      </div>
                    </td>

                    {/* Broadcast Stats */}
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-slate-800 font-mono">{t.sent.toLocaleString()} sent</div>
                      {t.usageCount && (
                        <div className="text-[10px] text-slate-400">Used in {t.usageCount} campaigns</div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditTarget(t);
                            setBuilderOpen(true);
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer border border-emerald-200/80"
                        >
                          Preview / Edit
                        </button>
                        <button
                          onClick={() => handleDuplicate(t)}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                          title="Duplicate Template"
                        >
                          <Copy size={13} />
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

      <TemplateBuilderModal
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onSaved={handleSave}
        editTarget={editTarget}
      />

    </div>
  );
}
