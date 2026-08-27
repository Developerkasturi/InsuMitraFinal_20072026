import React, { useState } from 'react';
import { 
  Clock, CheckCircle, Coffee, Phone, Users, Shield, 
  FileText, ArrowRight, Play, Check, Plus, Sparkles, MessageSquare, X 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export interface TimelineEvent {
  id: string;
  timeRange: string;
  duration: string;
  title: string;
  category: 'Sales' | 'Operations' | 'Renewals' | 'Claims' | 'Client Visit' | 'Break' | 'Attendance';
  entityName?: string;
  outcome?: string;
  type: 'WORK' | 'BREAK' | 'ATTENDANCE';
  isAutoCaptured?: boolean;
}

const DEFAULT_TIMELINE: TimelineEvent[] = [
  {
    id: 't-1',
    timeRange: '09:04 AM',
    duration: '—',
    title: 'Clocked In — Shift Started',
    category: 'Attendance',
    type: 'ATTENDANCE',
    isAutoCaptured: true
  },
  {
    id: 't-2',
    timeRange: '09:20 AM – 09:45 AM',
    duration: '25m',
    title: 'Lead Follow-up Calls (5 Leads)',
    category: 'Sales',
    entityName: 'Amit Sharma & 4 others',
    outcome: 'Quotation sent for Star Comprehensive ₹10L',
    type: 'WORK',
    isAutoCaptured: true
  },
  {
    id: 't-3',
    timeRange: '10:00 AM – 10:40 AM',
    duration: '40m',
    title: 'Customer In-Person Proposal Discussion',
    category: 'Client Visit',
    entityName: 'Dr. Vikrant Kulkarni',
    outcome: 'Agreed on HDFC Life Click 2 Protect ₹1.5 Cr',
    type: 'WORK',
    isAutoCaptured: false
  },
  {
    id: 't-4',
    timeRange: '10:50 AM – 11:30 AM',
    duration: '40m',
    title: 'Policy Processing & Documentation Upload',
    category: 'Operations',
    entityName: 'Policy #POL-8902 (Sunita Patil)',
    outcome: 'KYC & Medical test reports submitted to insurer',
    type: 'WORK',
    isAutoCaptured: true
  },
  {
    id: 't-5',
    timeRange: '11:45 AM – 12:20 PM',
    duration: '35m',
    title: 'Renewal Follow-up & Payment Link Sharing',
    category: 'Renewals',
    entityName: 'Mehta Family Care Supreme',
    outcome: 'Shared direct payment link (₹24,500)',
    type: 'WORK',
    isAutoCaptured: true
  },
  {
    id: 't-6',
    timeRange: '01:00 PM – 01:45 PM',
    duration: '45m',
    title: 'Lunch & Rest Break (Non-billable time)',
    category: 'Break',
    type: 'BREAK',
    isAutoCaptured: false
  },
  {
    id: 't-7',
    timeRange: '02:00 PM – 03:00 PM',
    duration: '60m',
    title: 'Motor Accident Claim Survey Assistance',
    category: 'Claims',
    entityName: 'Bajaj Allianz Claim #CLM-1029',
    outcome: 'Garage estimate verified and approved',
    type: 'WORK',
    isAutoCaptured: true
  }
];

export default function DailyActivityTimeline({ 
  events = DEFAULT_TIMELINE,
  isViewOnly = false
}: { 
  events?: TimelineEvent[];
  isViewOnly?: boolean;
}) {
  const [timelineList, setTimelineList] = useState<TimelineEvent[]>(events);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'Sales' | 'Operations' | 'Renewals' | 'Claims' | 'Client Visit' | 'Break'>('Sales');
  const [newDuration, setNewDuration] = useState('30m');
  const [newEntity, setNewEntity] = useState('');
  const [newOutcome, setNewOutcome] = useState('');

  const handleAddManualActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const isBreak = newCategory === 'Break';
    const currentTimeStr = format(new Date(), 'hh:mm a');
    const newEntry: TimelineEvent = {
      id: `t-${Date.now()}`,
      timeRange: currentTimeStr,
      duration: newDuration || '20m',
      title: newTitle,
      category: newCategory,
      entityName: newEntity || undefined,
      outcome: newOutcome || undefined,
      type: isBreak ? 'BREAK' : 'WORK',
      isAutoCaptured: false
    };

    setTimelineList(prev => [newEntry, ...prev]);
    toast.success('Activity entry recorded in your timeline!');
    setNewTitle('');
    setNewEntity('');
    setNewOutcome('');
    setIsModalOpen(false);
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary-600" /> Today's Activity &amp; Execution Timeline
          </h3>
          <p className="text-[11px] text-slate-500">
            Chronological audit trail of automatic CRM event captures and manual work logs
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Legend Badges */}
          <div className="hidden sm:flex items-center gap-2 text-[10px] font-bold text-slate-600 mr-2">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-600"></span> Work (Active)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Break (Deducted)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Auto-Captured</span>
          </div>

          {!isViewOnly && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Log Activity Note
            </button>
          )}
        </div>
      </div>

      {/* Timeline List */}
      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {timelineList.map((ev) => (
          <div key={ev.id} className="relative group">
            {/* Timeline Dot */}
            <div className={`absolute -left-6 top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-xs flex items-center justify-center ${
              ev.type === 'ATTENDANCE' ? 'bg-emerald-500' :
              ev.type === 'BREAK' ? 'bg-amber-400' :
              'bg-blue-600'
            }`}>
              <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
            </div>

            {/* Content Card */}
            <div className={`p-3.5 rounded-xl border transition-all ${
              ev.type === 'BREAK' 
                ? 'bg-amber-50/40 border-amber-200/80' 
                : 'bg-slate-50/80 border-slate-200/80 hover:bg-slate-50 hover:shadow-xs'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 font-mono">
                    {ev.timeRange}
                  </span>
                  {ev.isAutoCaptured && (
                    <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded-md border border-emerald-200">
                      ⚡ Auto-Captured
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {ev.duration !== '—' && (
                    <span className="text-[10px] font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-md border border-primary-200/60 font-mono">
                      ⏱ {ev.duration}
                    </span>
                  )}
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                    ev.category === 'Break' ? 'bg-amber-100 text-amber-900 border border-amber-200' :
                    ev.category === 'Sales' ? 'bg-blue-100 text-blue-900 border border-blue-200' :
                    ev.category === 'Operations' ? 'bg-purple-100 text-purple-900 border border-purple-200' :
                    ev.category === 'Renewals' ? 'bg-teal-100 text-teal-900 border border-teal-200' :
                    ev.category === 'Claims' ? 'bg-rose-100 text-rose-900 border border-rose-200' :
                    ev.category === 'Attendance' ? 'bg-emerald-100 text-emerald-900 border border-emerald-200' :
                    'bg-slate-200 text-slate-800 border border-slate-300'
                  }`}>
                    {ev.category}
                  </span>
                </div>
              </div>

              <p className="text-xs font-bold text-slate-900">{ev.title}</p>

              {ev.entityName && (
                <p className="text-[11px] text-primary-700 font-semibold mt-0.5">
                  🔗 Linked: <span className="font-bold">{ev.entityName}</span>
                </p>
              )}

              {ev.outcome && (
                <p className="text-[11px] text-emerald-800 font-medium mt-1 bg-emerald-50/70 p-1.5 rounded-lg border border-emerald-100 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600" /> Outcome: {ev.outcome}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal to Log Manual Activity Note */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary-600" /> Log Activity or Work Note
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddManualActivity} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Activity Title / Action *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Visited customer office for group health quote"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e: any) => setNewCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="Sales">Sales</option>
                    <option value="Operations">Operations</option>
                    <option value="Renewals">Renewals</option>
                    <option value="Claims">Claims</option>
                    <option value="Client Visit">Client Visit</option>
                    <option value="Break">Break / Lunch</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Duration</label>
                  <select
                    value={newDuration}
                    onChange={(e) => setNewDuration(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-mono"
                  >
                    <option value="15m">15 mins</option>
                    <option value="30m">30 mins</option>
                    <option value="45m">45 mins</option>
                    <option value="60m">1 hour</option>
                    <option value="90m">1.5 hours</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Linked Entity / Customer (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Amit Sharma (Lead #LD-4091)"
                  value={newEntity}
                  onChange={(e) => setNewEntity(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Outcome / Next Steps</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Customer agreed to proposal, requested payment link"
                  value={newOutcome}
                  onChange={(e) => setNewOutcome(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-xs"
                >
                  Record Activity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
