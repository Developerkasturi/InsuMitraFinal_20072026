import React, { useState } from 'react';
import {
  Plus, Users, Search, MoreVertical, Edit3, Trash2,
  CheckCircle2, ArrowRight, X, Phone, MapPin, Tag
} from 'lucide-react';
import { MOCK_WHATSAPP_DATA } from '../mockData';
import CreateContactListModal from '../components/CreateContactListModal';
import toast from 'react-hot-toast';

export default function ContactListsTab() {
  const [lists, setLists] = useState(MOCK_WHATSAPP_DATA.contactLists);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected list details modal
  const [viewList, setViewList] = useState<any>(null);

  const filteredLists = lists.filter(l =>
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreated = (newList: any) => {
    setLists(prev => [newList, ...prev]);
    // Also push to mock data
    MOCK_WHATSAPP_DATA.contactLists.unshift(newList);
  };

  const handleDeleteList = (id: string, name: string) => {
    setLists(prev => prev.filter(l => l.id !== id));
    toast.success(`Deleted contact list "${name}"`);
    if (viewList?.id === id) setViewList(null);
  };

  // Contacts belonging to viewList
  const viewListMembers = viewList
    ? MOCK_WHATSAPP_DATA.contacts.filter(c =>
        c.lists.includes(viewList.name) ||
        (viewList.memberContactIds && viewList.memberContactIds.includes(c.id))
      )
    : [];

  return (
    <div className="space-y-6">

      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-800">Target Contact Lists &amp; Segments</h3>
          <p className="text-xs text-slate-500">
            Create and organize customer segments for targeted WhatsApp broadcast campaigns &amp; automations
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus size={15} /> Create Contact List
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search lists by name or ID..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Showing <strong>{filteredLists.length}</strong> active contact lists
        </div>
      </div>

      {/* Lists Grid */}
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

      {/* ── View List Members Modal ── */}
      {viewList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-scale-up">
            
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-blue-700 to-indigo-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{viewList.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-white">{viewList.name}</h2>
                    <span className="text-[10px] font-mono bg-white/20 px-2 py-0.2 rounded-full">{viewList.id}</span>
                  </div>
                  <p className="text-xs text-blue-100">{viewList.count} Contacts Enrolled</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDeleteList(viewList.id, viewList.name)}
                  className="p-1.5 rounded-xl bg-rose-500/30 hover:bg-rose-500/50 text-rose-100 hover:text-white transition-all cursor-pointer"
                  title="Delete this list"
                >
                  <Trash2 size={16} />
                </button>
                <button
                  onClick={() => setViewList(null)}
                  className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/15 transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body: Members list */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs text-slate-500 font-medium">
                <span>Enrolled Contacts List</span>
                <span>{viewListMembers.length} active matching members</span>
              </div>

              {viewListMembers.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400">
                  No contacts explicitly tagged yet. Contacts matching this list will appear here.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden bg-white">
                  {viewListMembers.map((member) => (
                    <div key={member.id} className="p-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full ${member.color} text-white font-bold text-xs flex items-center justify-center`}>
                          {member.avatar}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{member.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{member.phone} · {member.city}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {member.optIn && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Opted In ✓
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Last Used: {viewList.lastUsed}</span>
              <button
                onClick={() => setViewList(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Create Contact List Modal ── */}
      <CreateContactListModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleCreated}
      />

    </div>
  );
}
