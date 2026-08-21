import React, { useState } from 'react';
import {
  X, ListFilter, Users, Plus, CheckCircle2, Search,
  Tag, MapPin, CheckSquare, Square, Sparkles, Filter
} from 'lucide-react';
import { MOCK_WHATSAPP_DATA } from '../mockData';
import toast from 'react-hot-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (newList: any) => void;
}

export default function CreateContactListModal({ open, onClose, onCreated }: Props) {
  if (!open) return null;

  const allContacts = MOCK_WHATSAPP_DATA.contacts;

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('⭐');
  const [colorTheme, setColorTheme] = useState('text-blue-600 bg-blue-50');
  const [listType, setListType] = useState<'STATIC' | 'DYNAMIC'>('STATIC');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(['C001', 'C003']);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('ALL');

  const ICON_OPTIONS = ['⭐', '👨‍⚕️', '👷', '🤝', '🏥', '📈', '🌐', '💼', '🚗', '🛡️', '💰', '🏢', '🎯'];
  
  const COLOR_OPTIONS = [
    { label: 'Blue', value: 'text-blue-600 bg-blue-50', bg: 'bg-blue-500' },
    { label: 'Purple', value: 'text-purple-600 bg-purple-50', bg: 'bg-purple-500' },
    { label: 'Emerald', value: 'text-emerald-600 bg-emerald-50', bg: 'bg-emerald-500' },
    { label: 'Amber', value: 'text-amber-600 bg-amber-50', bg: 'bg-amber-500' },
    { label: 'Rose', value: 'text-rose-600 bg-rose-50', bg: 'bg-rose-500' },
    { label: 'Cyan', value: 'text-cyan-600 bg-cyan-50', bg: 'bg-cyan-500' },
    { label: 'Indigo', value: 'text-indigo-600 bg-indigo-50', bg: 'bg-indigo-500' },
  ];

  const filteredContacts = allContacts.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.phone.includes(searchQuery) ||
                          c.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCity = cityFilter === 'ALL' || c.city === cityFilter;
    return matchesSearch && matchesCity;
  });

  const handleToggleContact = (id: string) => {
    setSelectedContactIds(prev =>
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedContactIds.length === filteredContacts.length) {
      setSelectedContactIds([]);
    } else {
      setSelectedContactIds(filteredContacts.map(c => c.id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter a list name');
      return;
    }

    const nextId = `L00${MOCK_WHATSAPP_DATA.contactLists.length + 1}`;
    const newList = {
      id: nextId,
      name: name.trim(),
      count: selectedContactIds.length,
      icon,
      color: colorTheme,
      lastUsed: 'Just now',
      memberContactIds: selectedContactIds,
    };

    onCreated(newList);
    toast.success(`Contact List "${newList.name}" created with ${newList.count} contacts!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-blue-700 to-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              <ListFilter size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Create New Contact List</h2>
              <p className="text-xs text-blue-100">Create a segmented audience for campaigns &amp; automations</p>
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* List Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              List Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. VIP Doctors, Pune HNIs, Term Insurance Prospects"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-medium text-slate-800"
            />
          </div>

          {/* Icon & Theme Color */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Choose Icon
              </label>
              <div className="flex items-center gap-1.5 flex-wrap p-2 rounded-xl bg-slate-50 border border-slate-200">
                {ICON_OPTIONS.map((ico) => (
                  <button
                    key={ico}
                    type="button"
                    onClick={() => setIcon(ico)}
                    className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all ${
                      icon === ico ? 'bg-white shadow-md ring-2 ring-blue-500' : 'hover:bg-slate-200/60'
                    }`}
                  >
                    {ico}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Color Theme
              </label>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => setColorTheme(c.value)}
                    className={`w-6 h-6 rounded-full ${c.bg} transition-all ${
                      colorTheme === c.value ? 'ring-3 ring-offset-2 ring-blue-500 scale-110' : 'opacity-70 hover:opacity-100'
                    }`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Contact Selection Section */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Members ({selectedContactIds.length} Selected)
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                {selectedContactIds.length === filteredContacts.length ? 'Deselect All' : 'Select All Filtered'}
              </button>
            </div>

            {/* Filter controls */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search contacts by name, phone..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:bg-white outline-none"
                />
              </div>

              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 text-slate-700 outline-none"
              >
                <option value="ALL">All Cities</option>
                <option value="Pune">Pune</option>
                <option value="Mumbai">Mumbai</option>
                <option value="Nashik">Nashik</option>
                <option value="Bangalore">Bangalore</option>
              </select>
            </div>

            {/* Contact Checkbox List */}
            <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white">
              {filteredContacts.map((contact) => {
                const isSelected = selectedContactIds.includes(contact.id);
                return (
                  <div
                    key={contact.id}
                    onClick={() => handleToggleContact(contact.id)}
                    className={`p-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                      isSelected ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full ${contact.color} text-white font-bold text-[10px] flex items-center justify-center`}>
                        {contact.avatar}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-800">{contact.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{contact.phone} · {contact.city}</div>
                      </div>
                    </div>

                    <div className={`w-4 h-4 rounded flex items-center justify-center transition-all ${
                      isSelected ? 'bg-blue-600 text-white' : 'border border-slate-300'
                    }`}>
                      {isSelected && <CheckSquare size={12} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Submit */}
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
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <CheckCircle2 size={14} /> Create Contact List
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
