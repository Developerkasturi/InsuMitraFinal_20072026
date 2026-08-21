import React, { useState } from 'react';
import {
  Users, Search, Plus, Upload, CheckCircle2,
  XCircle, AlertTriangle, Phone, MapPin, Tag, Sparkles,
  ListFilter, ArrowRight, X, Trash2, ShieldCheck, Settings,
  HelpCircle, Clock, Check, RefreshCw
} from 'lucide-react';
import { MOCK_WHATSAPP_DATA } from '../mockData';
import { WhatsAppLeadContext } from '../components/WhatsAppLeadModal';
import CreateContactListModal from '../components/CreateContactListModal';
import toast from 'react-hot-toast';

interface Props {
  onOpenLeadModal: (ctx: WhatsAppLeadContext) => void;
}

export default function ContactsTab({ onOpenLeadModal }: Props) {
  // Sub-view toggle: 'CONTACTS' vs 'LISTS'
  const [subView, setSubView] = useState<'CONTACTS' | 'LISTS'>('CONTACTS');

  // Contacts state
  const [contacts, setContacts] = useState(MOCK_WHATSAPP_DATA.contacts);
  const [searchQuery, setSearchQuery] = useState('');
  const [optInFilter, setOptInFilter] = useState<'ALL' | 'OPTED_IN' | 'OPTED_OUT' | 'PENDING_CONSENT'>('ALL');

  // Contact Lists state
  const [lists, setLists] = useState(MOCK_WHATSAPP_DATA.contactLists);
  const [createListModalOpen, setCreateListModalOpen] = useState(false);
  const [viewList, setViewList] = useState<any>(null);

  // Opt-in Rules Modal state
  const [optInRulesModalOpen, setOptInRulesModalOpen] = useState(false);
  const [optInSettings, setOptInSettings] = useState(MOCK_WHATSAPP_DATA.optIn.settings);

  const optInStats = MOCK_WHATSAPP_DATA.optIn.stats;

  const filteredContacts = contacts.filter(c => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.city.toLowerCase().includes(q);
    const matchesOptIn = optInFilter === 'ALL' || c.optInStatus === optInFilter;
    return matchesSearch && matchesOptIn;
  });

  const filteredLists = lists.filter(l =>
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleOptIn = (contactId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'OPTED_IN' ? 'OPTED_OUT' : 'OPTED_IN';
    setContacts(prev => prev.map(c => {
      if (c.id === contactId) {
        return {
          ...c,
          optIn: nextStatus === 'OPTED_IN',
          optInStatus: nextStatus as any,
          optInSource: nextStatus === 'OPTED_IN' ? 'Direct Consent Override' : 'Manual Opt-Out',
          optInTimestamp: 'Just now',
        };
      }
      return c;
    }));
    toast.success(
      nextStatus === 'OPTED_IN'
        ? 'Contact marked as Verified WhatsApp Opt-in ✓'
        : 'Contact opted out from WhatsApp broadcasts'
    );
  };

  const handleCreatedList = (newList: any) => {
    setLists(prev => [newList, ...prev]);
    MOCK_WHATSAPP_DATA.contactLists.unshift(newList);
  };

  const handleDeleteList = (id: string, name: string) => {
    setLists(prev => prev.filter(l => l.id !== id));
    toast.success(`Deleted contact list "${name}"`);
    if (viewList?.id === id) setViewList(null);
  };

  // Members belonging to viewList
  const viewListMembers = viewList
    ? contacts.filter(c =>
      c.lists.includes(viewList.name) ||
      (viewList.memberContactIds && viewList.memberContactIds.includes(c.id))
    )
    : [];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Sub-view Switcher & Actions Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-slate-800">WhatsApp Contacts &amp; Consent Management</h3>
            <span className="text-[11px] font-bold text-slate-400 font-mono">
              ({contacts.length} Contacts · {lists.length} Lists)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Meta compliance consent registry, opt-in/opt-out keyword rules &amp; segmented audience lists
          </p>
        </div>

        {/* Sub-view switcher pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="p-1 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center gap-1">
            <button
              onClick={() => setSubView('CONTACTS')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${subView === 'CONTACTS'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <Users size={13} className={subView === 'CONTACTS' ? 'text-emerald-600' : 'text-slate-400'} />
              <span>All Contacts ({contacts.length})</span>
            </button>

            <button
              onClick={() => setSubView('LISTS')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${subView === 'LISTS'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <ListFilter size={13} className={subView === 'LISTS' ? 'text-blue-600' : 'text-slate-400'} />
              <span>Contact Lists ({lists.length})</span>
            </button>
          </div>

          <button
            onClick={() => setOptInRulesModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs border border-purple-200/80 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            title="Configure Opt-In Policy & Keyword Rules"
          >
            <ShieldCheck size={14} className="text-purple-600" />
            <span>Opt-In Rules &amp; Keywords</span>
          </button>

          {subView === 'CONTACTS' ? (
            <button
              onClick={() => toast('CSV Contact Import Wizard will open in Phase 3', { icon: '📁' })}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Upload size={13} /> Import CSV
            </button>
          ) : (
            <button
              onClick={() => setCreateListModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus size={14} /> Create Contact List
            </button>
          )}
        </div>
      </div>

      {/* ── Opt-In / Consent Summary KPI Banner ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div className="text-base font-extrabold text-slate-800">{optInStats.optedIn.toLocaleString()}</div>
            <div className="text-[11px] text-emerald-700 font-bold">Verified Opted-In ({optInStats.optInRate})</div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <XCircle size={18} />
          </div>
          <div>
            <div className="text-base font-extrabold text-slate-800">{optInStats.optedOut}</div>
            <div className="text-[11px] text-rose-700 font-bold">Opted Out via "STOP"</div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock size={18} />
          </div>
          <div>
            <div className="text-base font-extrabold text-slate-800">{optInStats.pendingConsent}</div>
            <div className="text-[11px] text-amber-700 font-bold">Pending Verification</div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="text-base font-extrabold text-purple-700">100% Meta Compliant</div>
            <div className="text-[11px] text-slate-500 font-medium">Safe Broadcast Rating</div>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {subView === 'CONTACTS' && (
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {[
              { key: 'ALL', label: 'All Contacts' },
              { key: 'OPTED_IN', label: '✓ Opted-In (3,890)' },
              { key: 'OPTED_OUT', label: '✕ Opted-Out (34)' },
              { key: 'PENDING_CONSENT', label: '⏳ Pending (180)' },
            ].map((st) => (
              <button
                key={st.key}
                onClick={() => setOptInFilter(st.key as any)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${optInFilter === st.key
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                  }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        )}

        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={subView === 'CONTACTS' ? 'Search contacts by name, phone, city...' : 'Search lists by name or ID...'}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
          />
        </div>
      </div>

      {/* ── VIEW 1: CONTACTS TABLE WITH OPT-IN CONTROLS ── */}
      {subView === 'CONTACTS' && (
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Phone / WhatsApp</th>
                  <th className="py-3.5 px-4">Opt-In Consent &amp; Source</th>
                  <th className="py-3.5 px-4">Consent Action</th>
                  <th className="py-3.5 px-4">City</th>
                  <th className="py-3.5 px-4">Enrolled Lists</th>
                  <th className="py-3.5 px-4 text-right">Lead Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredContacts.map((c) => {
                  const isOptedIn = c.optInStatus === 'OPTED_IN';
                  const isOptedOut = c.optInStatus === 'OPTED_OUT';
                  const isPending = c.optInStatus === 'PENDING_CONSENT';

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50/80 transition-colors ${c.invalid ? 'bg-rose-50/40' : isOptedOut ? 'bg-slate-50/60' : ''
                        }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${c.color} text-white font-bold text-xs flex items-center justify-center shrink-0`}>
                            {c.avatar}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                              {c.name}
                              {c.isBirthday && <span title="Birthday Today">🎂</span>}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">{c.id}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-mono text-slate-700 flex items-center gap-1.5">
                          <Phone size={11} className="text-slate-400" />
                          {c.phone}
                        </div>
                        {c.invalid && (
                          <div className="text-[10px] text-rose-600 font-bold flex items-center gap-1 mt-0.5">
                            <AlertTriangle size={11} /> Invalid WhatsApp Number
                          </div>
                        )}
                      </td>

                      {/* Opt-In Status & Timestamp */}
                      <td className="py-3.5 px-4">
                        {isOptedIn && (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 size={11} /> Verified Opt-In
                            </span>
                            <div className="text-[10px] text-slate-400">
                              {c.optInSource} · {c.optInTimestamp}
                            </div>
                          </div>
                        )}
                        {isOptedOut && (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle size={11} /> Opted Out (STOP)
                            </span>
                            <div className="text-[10px] text-slate-400">
                              {c.optInTimestamp}
                            </div>
                          </div>
                        )}
                        {isPending && (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock size={11} /> Consent Pending
                            </span>
                            <div className="text-[10px] text-slate-400">
                              {c.optInSource}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* One-click Consent Toggle */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleOptIn(c.id, c.optInStatus)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${isOptedIn
                              ? 'bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border-slate-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                            }`}
                          title={isOptedIn ? 'Revoke Opt-In consent' : 'Grant Verified Opt-In consent'}
                        >
                          {isOptedIn ? 'Revoke Consent' : 'Grant Opt-In ✓'}
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        {c.city}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 flex-wrap">
                          {c.lists.map((l: string) => (
                            <span
                              key={l}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200"
                            >
                              {l}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => onOpenLeadModal({
                            contactName: c.name,
                            phone: c.phone,
                            city: c.city,
                            suggestedInterest: 'Health Insurance Upgrade',
                            chatSnippet: `Direct Lead Created from WhatsApp Contacts: ${c.name} (${c.city})`,
                            sourceAutomationName: 'Contacts Directory',
                          })}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] border border-emerald-200 flex items-center gap-1 transition-all cursor-pointer ml-auto shadow-2xs"
                        >
                          <Sparkles size={11} /> Lead 🎯
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── VIEW 2: CONTACT LISTS GRID ── */}
      {subView === 'LISTS' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredLists.map((l) => (
            <div
              key={l.id}
              onClick={() => setViewList(l)}
              className="p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{l.icon}</span>
                  <span className="text-[10px] font-bold text-slate-400 font-mono bg-slate-50 px-2 py-0.5 rounded-md">
                    {l.id}
                  </span>
                </div>
                <div className="mt-3">
                  <h4 className="text-sm font-extrabold text-slate-800 group-hover:text-blue-600 transition-colors">
                    {l.name}
                  </h4>
                  <div className="text-2xl font-black text-blue-600 mt-1">{l.count}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">enrolled contacts</div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="text-[11px]">Last Used: {l.lastUsed}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewList(l);
                  }}
                  className="text-blue-600 font-bold hover:underline flex items-center gap-0.5"
                >
                  <span>View</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── View List Members Modal ── */}
      {viewList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-scale-up">

            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-xl">
                  {viewList.icon}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">{viewList.name}</h3>
                  <p className="text-xs text-white/60 font-mono">
                    {viewList.id} · {viewListMembers.length} active contacts enrolled
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewList(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Members List */}
            <div className="p-4 overflow-y-auto flex-1 divide-y divide-slate-100 text-xs">
              {viewListMembers.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400">
                  No contacts explicitly tagged yet. Contacts matching this list will appear here.
                </div>
              ) : (
                viewListMembers.map((m) => (
                  <div key={m.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${m.color} text-white font-bold text-xs flex items-center justify-center shrink-0`}>
                        {m.avatar}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{m.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{m.phone} · {m.city}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.optIn ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Opt-In ✓
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          Opted Out
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => handleDeleteList(viewList.id, viewList.name)}
                className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-1 transition-all cursor-pointer border border-rose-200"
              >
                <Trash2 size={13} /> Delete List
              </button>
              <button
                onClick={() => setViewList(null)}
                className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Create Contact List Modal ── */}
      <CreateContactListModal
        open={createListModalOpen}
        onClose={() => setCreateListModalOpen(false)}
        onCreated={handleCreatedList}
      />

    </div>
  );
}
