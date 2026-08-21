import React, { useState } from 'react';
import {
  Upload, Search, Image as ImageIcon, FileText, Video, Trash2,
  Eye, CheckCircle2, Clock, Sparkles, Plus, Download,
  ExternalLink, File, AlertCircle, ShieldCheck, X
} from 'lucide-react';
import { MOCK_WHATSAPP_DATA } from '../mockData';
import Modal from '@comps/common/Modal';
import toast from 'react-hot-toast';

export default function MediaLibraryTab() {
  const [mediaList, setMediaList] = useState<any[]>(MOCK_WHATSAPP_DATA.media as any[]);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IMAGE' | 'DOCUMENT' | 'VIDEO'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [newMediaName, setNewMediaName] = useState('');
  const [newMediaType, setNewMediaType] = useState<'IMAGE' | 'DOCUMENT' | 'VIDEO'>('IMAGE');
  const [newMediaTag, setNewMediaTag] = useState('');

  // Preview modal state
  const [previewTarget, setPreviewTarget] = useState<any>(null);

  const filteredMedia = mediaList.filter((m: any) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = m.name.toLowerCase().includes(q) ||
      (m.tags && m.tags.some((t: string) => t.toLowerCase().includes(q))) ||
      (m.metaMediaId && m.metaMediaId.toLowerCase().includes(q));
    const matchesType = typeFilter === 'ALL' || m.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMediaName.trim()) {
      toast.error('Please enter an asset name');
      return;
    }

    const newAsset = {
      id: `M00${Math.floor(Math.random() * 900 + 100)}`,
      name: newMediaName,
      type: newMediaType,
      size: newMediaType === 'DOCUMENT' ? '1.8 MB' : newMediaType === 'VIDEO' ? '8.4 MB' : '480 KB',
      metaMediaId: `meta_asset_${Math.floor(1000000 + Math.random() * 9000000)}`,
      emoji: newMediaType === 'DOCUMENT' ? '📄' : newMediaType === 'VIDEO' ? '🎬' : '🖼️',
      added: 'Just now',
      cacheStatus: 'ACTIVE',
      expiresIn: '30 days left',
      tags: newMediaTag ? newMediaTag.split(',').map(t => t.trim()) : ['Custom Upload'],
    };

    setMediaList(prev => [newAsset, ...prev]);
    toast.success(`Asset "${newMediaName}" uploaded and cached in Meta Cloud API!`);
    setUploadModalOpen(false);
    setNewMediaName('');
    setNewMediaTag('');
  };

  const handleDelete = (id: string, name: string) => {
    setMediaList(prev => prev.filter(m => m.id !== id));
    toast.success(`Removed asset "${name}" from Media Library`);
  };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header & Upload Trigger ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-slate-800">WhatsApp Media &amp; Document Assets</h3>
            <span className="text-[11px] font-bold text-slate-400 font-mono">
              ({mediaList.length} Cached Assets)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Meta Cloud API verified media handles for broadcast templates, policy booklets, brochures &amp; claim infographics
          </p>
        </div>
        <button
          onClick={() => setUploadModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <Plus size={15} /> Upload Media Asset
        </button>
      </div>

      {/* ── Meta Media Guidelines Banner ── */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="font-extrabold text-emerald-300">Meta WhatsApp Cloud Media Storage Guidelines</div>
            <p className="text-white/70 text-[11px] mt-0.5">
              Media handles are cached for 30 days. Max size: Documents (PDF) &lt; 100MB · Images (JPG/PNG) &lt; 5MB · Video (MP4) &lt; 16MB.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2.5 py-1 rounded-lg bg-white/10 text-white font-mono text-[10px]">
            100% Cloud API Verified
          </span>
        </div>
      </div>

      {/* ── Filter Tabs & Search ── */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">

        {/* Type Filter Buttons */}
        <div className="flex items-center gap-1">
          {[
            { key: 'ALL', label: 'All Formats' },
            { key: 'IMAGE', label: '🖼️ Images' },
            { key: 'DOCUMENT', label: '📄 PDFs & Docs' },
            { key: 'VIDEO', label: '🎬 Videos' },
          ].map(tf => (
            <button
              key={tf.key}
              onClick={() => setTypeFilter(tf.key as any)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${typeFilter === tf.key
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search media by name, tag, or Meta ID..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
          />
        </div>

      </div>

      {/* ── Media Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredMedia.map((m: any) => (
          <div
            key={m.id}
            className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden flex flex-col justify-between group hover:shadow-md hover:border-emerald-300 transition-all"
          >
            {/* Visual Header */}
            <div className="h-32 bg-gradient-to-br from-slate-100 to-slate-200/70 flex items-center justify-center text-4xl relative">
              <span>{m.emoji}</span>
              <span className="absolute top-2 right-2 text-[9px] font-bold uppercase bg-white/90 px-2 py-0.5 rounded-full shadow-xs border border-slate-200">
                {m.type}
              </span>
              <span className="absolute bottom-2 left-2 text-[9px] font-mono font-bold bg-slate-900/80 text-white px-2 py-0.5 rounded-md">
                {m.size}
              </span>
            </div>

            {/* Content Details */}
            <div className="p-4 space-y-2">
              <div>
                <h4 className="text-xs font-bold text-slate-800 truncate" title={m.name}>{m.name}</h4>
                <div className="text-[10px] text-purple-700 font-mono mt-0.5 truncate">
                  {m.metaMediaId || `meta_asset_${m.id}`}
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Uploaded: {m.added}</span>
                <span className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded">
                  ✓ Cached
                </span>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1 pt-1">
                {(m.tags || []).map((t: string, i: number) => (
                  <span key={i} className="text-[9px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                    #{t}
                  </span>
                ))}
              </div>
            </div>

            {/* Card Action Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <button
                onClick={() => {
                  toast.success(`Attached "${m.name}" to active broadcast clipboard!`);
                }}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
              >
                <Sparkles size={11} /> Use in Broadcast
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPreviewTarget(m)}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                  title="Preview Asset"
                >
                  <Eye size={14} />
                </button>
                <button
                  onClick={() => handleDelete(m.id, m.name)}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                  title="Delete Media"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

          </div>
        ))}
      </div>

      {/* ── Upload New Media Modal ── */}
      {uploadModalOpen && (
        <Modal
          open={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          title="Upload WhatsApp Media Asset"
          subtitle="Upload document or visual asset to Meta Cloud Media Store"
          size="lg"
          icon={<Upload className="text-emerald-600" size={20} />}
        >
          <form onSubmit={handleUploadSubmit} className="p-6 space-y-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Asset Title / Campaign Label *</label>
              <input
                type="text"
                value={newMediaName}
                onChange={(e) => setNewMediaName(e.target.value)}
                placeholder="e.g. Diwali Family Health Flyer 2026 / Claim Form PDF"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Media Format</label>
                <select
                  value={newMediaType}
                  onChange={(e) => setNewMediaType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:border-emerald-500 outline-none"
                >
                  <option value="IMAGE">Image (JPG / PNG - Max 5MB)</option>
                  <option value="DOCUMENT">Document (PDF - Max 100MB)</option>
                  <option value="VIDEO">Video (MP4 - Max 16MB)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Tags (Comma-separated)</label>
                <input
                  type="text"
                  value={newMediaTag}
                  onChange={(e) => setNewMediaTag(e.target.value)}
                  placeholder="e.g. Diwali, Health, Brochure"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none"
                />
              </div>
            </div>

            {/* Drop Zone Box */}
            <div className="p-8 rounded-2xl border-2 border-dashed border-slate-200 hover:border-emerald-400 bg-slate-50 flex flex-col items-center justify-center text-center cursor-pointer transition-all">
              <Upload size={28} className="text-slate-400 mb-2" />
              <div className="font-bold text-slate-700">Click to select or drag and drop file here</div>
              <div className="text-[11px] text-slate-400 mt-1">
                Supports JPG, PNG, PDF, MP4 files up to Meta API limits
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setUploadModalOpen(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
              >
                Upload &amp; Cache in Meta
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Asset Preview Modal ── */}
      {previewTarget && (
        <Modal
          open={!!previewTarget}
          onClose={() => setPreviewTarget(null)}
          title={previewTarget.name}
          subtitle={`Meta Media ID: ${previewTarget.metaMediaId || 'waba_media_asset'}`}
          size="md"
          icon={<Eye className="text-emerald-600" size={20} />}
        >
          <div className="p-6 space-y-4 text-xs text-center">
            <div className="h-44 rounded-2xl bg-slate-100 flex items-center justify-center text-6xl shadow-inner">
              <span>{previewTarget.emoji}</span>
            </div>

            <div className="space-y-1 text-left bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="flex justify-between font-medium">
                <span className="text-slate-500">File Type:</span>
                <span className="font-bold text-slate-800">{previewTarget.type}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-slate-500">File Size:</span>
                <span className="font-bold text-slate-800">{previewTarget.size}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-slate-500">Meta Caching:</span>
                <span className="font-bold text-emerald-700">Active (28 days left)</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setPreviewTarget(null)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Close Preview
              </button>
              <button
                onClick={() => {
                  toast.success(`Media "${previewTarget.name}" copied to broadcast composer.`);
                  setPreviewTarget(null);
                }}
                className="px-5 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Attach to Campaign
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
