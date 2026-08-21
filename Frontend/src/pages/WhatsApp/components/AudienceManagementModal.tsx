import React, { useState, useEffect } from 'react';
import {
  X, Users, Search, Plus, Trash2, CheckCircle2,
  AlertTriangle, Filter, Sparkles, Shield, UserCheck,
  CheckSquare, Square, RefreshCw, Zap, Rocket, ChevronRight,
  Phone, MapPin, Tag, ArrowRight
} from 'lucide-react';
import { MOCK_WHATSAPP_DATA } from '../mockData';
import { WhatsAppLeadContext } from './WhatsAppLeadModal';
import toast from 'react-hot-toast';

export interface AudienceModalTarget {
  id: string;
  name: string;
  category?: string;
  type?: 'CAMPAIGN' | 'AUTOMATION';
  trigger?: string;
  template?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  target: AudienceModalTarget | null;
  mode: 'CAMPAIGN' | 'AUTOMATION';
  onSave?: (result: { targetId: string; totalCount: number; contactIds: string[]; selectedLists?: string[] }) => void;
  onOpenLeadModal?: (ctx: WhatsAppLeadContext) => void;
}

export default function AudienceManagementModal({
  open,
  onClose,
  target,
  mode,
  onSave,
  onOpenLeadModal,
}: Props) {
  if (!open || !target) return null;

  // Master contact lists & all contacts
  const allMasterContacts = MOCK_WHATSAPP_DATA.contacts;
  const masterLists = MOCK_WHATSAPP_DATA.contactLists;

  // Initial audience data based on mode and target id
  const initialAudienceData = () => {
    if (mode === 'AUTOMATION') {
      const autoData = (MOCK_WHATSAPP_DATA.automationAudiences as any)[target.id] || {
        automationId: target.id,
        name: target.name,
        targetCriteria: 'Active Policy holders matching automation rules',
        totalCount: 3,
        contactIds: ['C001', 'C003', 'C005'],
        excludedContactIds: [],
        qualificationDetails: {},
      };
      return {
        contactIds: autoData.contactIds || ['C001', 'C003'],
        excludedContactIds: autoData.excludedContactIds || [],
        selectedLists: ['Existing Customers', 'Doctors'],
        targetCriteria: autoData.targetCriteria,
        qualificationDetails: autoData.qualificationDetails || {},
      };
    } else {
      const campData = (MOCK_WHATSAPP_DATA.campaignAudiences as any)[target.id] || {
        campaignId: target.id,
        name: target.name,
        selectedLists: ['Existing Customers', 'Doctors'],
        contactIds: ['C001', 'C003', 'C005', 'C006'],
        excludedContactIds: [],
        filterRules: { optInOnly: true, excludeInvalid: true, cities: ['All'] },
      };
      return {
        contactIds: campData.contactIds || ['C001', 'C003', 'C005', 'C006'],
        excludedContactIds: campData.excludedContactIds || [],
        selectedLists: campData.selectedLists || ['Existing Customers', 'Doctors'],
        targetCriteria: 'Broadcast campaign targeting selected segments and contact lists',
        qualificationDetails: {},
      };
    }
  };

  const [activeTab, setActiveTab] = useState<'CONTACTS' | 'LISTS' | 'FILTERS' | 'ADD_NEW'>('CONTACTS');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(initialAudienceData().contactIds);
  const [excludedContactIds, setExcludedContactIds] = useState<string[]>(initialAudienceData().excludedContactIds);
  const [selectedLists, setSelectedLists] = useState<string[]>(initialAudienceData().selectedLists);
  const [qualificationDetails, setQualificationDetails] = useState<any>(initialAudienceData().qualificationDetails);
  
  // Search & Filter within audience
  const [searchQuery, setSearchQuery] = useState('');
  const [listFilter, setListFilter] = useState('ALL');
  
  // Add new contact search
  const [addSearchQuery, setAddSearchQuery] = useState('');

  // Segmentation filters state
  const [optInOnly, setOptInOnly] = useState(true);
  const [excludeInvalid, setExcludeInvalid] = useState(true);
  const [cityFilter, setCityFilter] = useState('ALL');
  const [policyTypeFilter, setPolicyTypeFilter] = useState('ALL');

  useEffect(() => {
    const init = initialAudienceData();
    setSelectedContactIds(init.contactIds);
    setExcludedContactIds(init.excludedContactIds);
    setSelectedLists(init.selectedLists);
    setQualificationDetails(init.qualificationDetails);
    setSearchQuery('');
  }, [target, mode]);

  // Current contacts in audience
  const audienceContacts = allMasterContacts.filter(c => {
    const isIncluded = selectedContactIds.includes(c.id);
    if (!isIncluded) return false;
    if (optInOnly && !c.optIn) return false;
    if (excludeInvalid && c.invalid) return false;
    if (cityFilter !== 'ALL' && c.city !== cityFilter) return false;
    if (policyTypeFilter !== 'ALL' && c.policyType !== policyTypeFilter) return false;
    return true;
  });

  const filteredAudienceContacts = audienceContacts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery) ||
    c.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Available contacts to add
  const availableToAddContacts = allMasterContacts.filter(c =>
    !selectedContactIds.includes(c.id) &&
    (c.name.toLowerCase().includes(addSearchQuery.toLowerCase()) ||
     c.phone.includes(addSearchQuery) ||
     c.city.toLowerCase().includes(addSearchQuery.toLowerCase()))
  );

  const handleRemoveContact = (id: string, name: string) => {
    setSelectedContactIds(prev => prev.filter(cId => cId !== id));
    toast.success(`Removed ${name} from this audience`);
  };

  const handleAddContact = (id: string, name: string) => {
    setSelectedContactIds(prev => [...prev, id]);
    toast.success(`Added ${name} to audience!`);
  };

  const handleToggleList = (listName: string) => {
    if (selectedLists.includes(listName)) {
      setSelectedLists(prev => prev.filter(l => l !== listName));
    } else {
      setSelectedLists(prev => [...prev, listName]);
      // Also automatically include contacts having this list tag
      const listContacts = allMasterContacts.filter(c => c.lists.includes(listName)).map(c => c.id);
      setSelectedContactIds(prev => Array.from(new Set([...prev, ...listContacts])));
    }
  };

  const handleSave = () => {
    if (onSave) {
      onSave({
        targetId: target.id,
        totalCount: audienceContacts.length,
        contactIds: selectedContactIds,
        selectedLists,
      });
    }
    toast.success(`Audience updated for ${target.name} (${audienceContacts.length} contacts)`);
    onClose();
  };

  const handleDirectLeadCapture = (c: any) => {
    if (onOpenLeadModal) {
      onOpenLeadModal({
        contactId: c.id,
        contactName: c.name,
        phone: c.phone,
        city: c.city,
        suggestedInterest: c.policyType ? `${c.policyType} Insurance` : 'Health Insurance',
        chatSnippet: `Audience Inspector Lead Capture for ${mode === 'AUTOMATION' ? 'Automation' : 'Campaign'}: ${target.name}`,
        sourceAutomationId: target.id,
        sourceAutomationName: target.name,
      });
    }
  };

  const isAuto = mode === 'AUTOMATION';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-scale-up">
        
        {/* ── Header ── */}
        <div className={`p-5 text-white flex items-center justify-between relative overflow-hidden ${
          isAuto 
            ? 'bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800'
            : 'bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800'
        }`}>
          <div className="pointer-events-none absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-2xl" />

          <div className="flex items-center gap-3.5 relative z-10">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              {isAuto ? <Zap size={22} className="text-amber-300" /> : <Rocket size={22} className="text-purple-300" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white">
                  {isAuto ? 'Automation Audience' : 'Campaign Audience'}
                </span>
                <span className="text-xs text-white/80 font-medium">· ID: {target.id}</span>
              </div>
              <h2 className="text-lg font-black text-white tracking-tight mt-0.5">
                {target.name}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/15 transition-all cursor-pointer relative z-10"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Metrics Summary Bar ── */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Total Audience:</span>
              <span className="font-black text-slate-800 text-sm">{audienceContacts.length} Contacts</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-bold uppercase text-[10px]">WhatsApp Opt-In:</span>
              <span className="font-extrabold text-emerald-600">
                {Math.round((audienceContacts.filter(c => c.optIn).length / (audienceContacts.length || 1)) * 100)}%
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Estimated Credits:</span>
              <span className="font-bold text-slate-700">₹{(audienceContacts.length * 0.48).toFixed(2)}</span>
            </div>
          </div>

          {/* Tab Switcher Pills */}
          <div className="inline-flex p-1 rounded-xl bg-slate-200/80 text-[11px] font-bold text-slate-600">
            <button
              onClick={() => setActiveTab('CONTACTS')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeTab === 'CONTACTS' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
              }`}
            >
              Audience ({audienceContacts.length})
            </button>
            <button
              onClick={() => setActiveTab('LISTS')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeTab === 'LISTS' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
              }`}
            >
              Contact Lists ({selectedLists.length})
            </button>
            <button
              onClick={() => setActiveTab('FILTERS')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeTab === 'FILTERS' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
              }`}
            >
              Filters &amp; Rules
            </button>
            <button
              onClick={() => setActiveTab('ADD_NEW')}
              className={`px-3 py-1 rounded-lg flex items-center gap-1 transition-all ${
                activeTab === 'ADD_NEW' ? 'bg-emerald-600 text-white shadow-sm' : 'hover:text-emerald-700'
              }`}
            >
              <Plus size={12} /> Add Contact
            </button>
          </div>
        </div>

        {/* ── Main Content Area ── */}
        <div className="flex-1 overflow-y-auto p-5">
          
          {/* TAB 1: Contacts in Audience */}
          {activeTab === 'CONTACTS' && (
            <div className="space-y-4">
              
              {/* Filter / Search Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/70">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search in audience by name, phone, city, or tag..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-white rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                  />
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Showing <strong>{filteredAudienceContacts.length}</strong> of {audienceContacts.length} contacts
                </div>
              </div>

              {/* Contacts Table / List */}
              {filteredAudienceContacts.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6">
                  <Users size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-bold text-slate-600">No contacts found in this audience</p>
                  <p className="text-[11px] text-slate-400 mt-1">Try relaxing filters or click "+ Add Contact" to add recipients</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
                  {filteredAudienceContacts.map((contact) => {
                    const qual = qualificationDetails[contact.id];
                    return (
                      <div key={contact.id} className="p-3.5 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        
                        {/* Contact Info */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-full ${contact.color} text-white font-bold text-xs flex items-center justify-center shrink-0`}>
                            {contact.avatar}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-800">{contact.name}</span>
                              {contact.optIn ? (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200">
                                  <CheckCircle2 size={10} /> Opted-in
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded-full">
                                  Not Opted-in
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-2">
                              <span>{contact.phone}</span>
                              <span>·</span>
                              <span>{contact.city}</span>
                              {contact.policyType && (
                                <>
                                  <span>·</span>
                                  <span className="text-slate-600 font-sans font-semibold">{contact.policyType} ({contact.sumInsured})</span>
                                </>
                              )}
                            </div>
                            {qual && (
                              <div className="mt-1 text-[10px] text-indigo-700 font-medium bg-indigo-50/80 px-2 py-0.5 rounded inline-block">
                                🎯 Rule match: <strong>{qual.reason}</strong>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          {/* Direct Lead Button */}
                          <button
                            type="button"
                            onClick={() => handleDirectLeadCapture(contact)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold border border-emerald-200/80 flex items-center gap-1 transition-all"
                            title="Generate CRM Lead from this contact"
                          >
                            <Sparkles size={12} className="text-emerald-600" />
                            Lead Capture
                          </button>

                          {/* Remove from audience */}
                          <button
                            type="button"
                            onClick={() => handleRemoveContact(contact.id, contact.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Remove from this audience"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {/* TAB 2: Contact Lists Selection */}
          {activeTab === 'LISTS' && (
            <div className="space-y-4">
              <div className="bg-purple-50/70 border border-purple-200/70 p-3.5 rounded-2xl text-xs text-purple-900">
                <p className="font-bold">🎯 Targeted Segment Lists</p>
                <p className="text-[11px] text-purple-700 mt-0.5">
                  Select which customer lists this {isAuto ? 'automation checks' : 'campaign sends to'}. Contacts in selected lists will be automatically enrolled.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {masterLists.map((list) => {
                  const isSelected = selectedLists.includes(list.name);
                  const listMemberCount = allMasterContacts.filter(c => c.lists.includes(list.name)).length;
                  return (
                    <div
                      key={list.id}
                      onClick={() => handleToggleList(list.name)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-purple-50/50 border-purple-500 ring-2 ring-purple-500/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{list.icon}</span>
                        <div>
                          <div className="font-bold text-xs text-slate-800">{list.name}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{list.count} master records · {listMemberCount} loaded</div>
                        </div>
                      </div>

                      <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                        isSelected ? 'bg-purple-600 text-white' : 'border border-slate-300 bg-white'
                      }`}>
                        {isSelected && <CheckSquare size={14} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Segmentation Filters & Rules */}
          {activeTab === 'FILTERS' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-4">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Demographic &amp; Policy Filters</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* City Filter */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Target City</label>
                    <select
                      value={cityFilter}
                      onChange={(e) => setCityFilter(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 font-medium text-slate-700 outline-none focus:border-indigo-500"
                    >
                      <option value="ALL">All Cities</option>
                      <option value="Pune">Pune</option>
                      <option value="Mumbai">Mumbai</option>
                      <option value="Nashik">Nashik</option>
                      <option value="Bangalore">Bangalore</option>
                    </select>
                  </div>

                  {/* Policy Type Filter */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Policy Category</label>
                    <select
                      value={policyTypeFilter}
                      onChange={(e) => setPolicyTypeFilter(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 font-medium text-slate-700 outline-none focus:border-indigo-500"
                    >
                      <option value="ALL">All Policy Types</option>
                      <option value="Health">Health Insurance</option>
                      <option value="Term Life">Term Life Insurance</option>
                      <option value="Motor">Motor Insurance</option>
                    </select>
                  </div>
                </div>

                {/* Toggles */}
                <div className="pt-2 border-t border-slate-200 space-y-2.5">
                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
                    <div>
                      <div className="text-xs font-bold text-slate-800">Only WhatsApp Opted-In Contacts</div>
                      <div className="text-[10px] text-slate-400">Strict compliance with Meta Business terms</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={optInOnly}
                      onChange={(e) => setOptInOnly(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
                    <div>
                      <div className="text-xs font-bold text-slate-800">Exclude Invalid or Unverified Numbers</div>
                      <div className="text-[10px] text-slate-400">Prevent wallet credit loss on failed dispatches</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={excludeInvalid}
                      onChange={(e) => setExcludeInvalid(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Add New Contacts to Audience */}
          {activeTab === 'ADD_NEW' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/70">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={addSearchQuery}
                    onChange={(e) => setAddSearchQuery(e.target.value)}
                    placeholder="Search master contacts to add to this audience..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-white rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                  />
                </div>
              </div>

              {availableToAddContacts.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-2xl text-xs text-slate-500">
                  All eligible contacts are already in this audience!
                </div>
              ) : (
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden bg-white">
                  {availableToAddContacts.map((contact) => (
                    <div key={contact.id} className="p-3.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full ${contact.color} text-white font-bold text-xs flex items-center justify-center`}>
                          {contact.avatar}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-slate-800">{contact.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{contact.phone} · {contact.city}</div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddContact(contact.id, contact.name)}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-xs flex items-center gap-1 transition-all"
                      >
                        <Plus size={13} /> Add to Audience
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            Effective Audience: <strong className="text-slate-800">{audienceContacts.length} Contacts</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all ${
                isAuto
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/20'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-500/20'
              }`}
            >
              <CheckCircle2 size={14} /> Save Audience Changes
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
