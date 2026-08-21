import React, { useState } from 'react';
import { 
  X, CheckSquare, Clock, Calendar, Users, Shield, 
  FileText, TrendingUp, AlertCircle, Sparkles, Check, 
  DollarSign, Phone, Eye, Repeat, MessageSquare, Tag, 
  Layers, ArrowRight, Bookmark 
} from 'lucide-react';
import { DatePicker } from '@comps/common/DatePicker';
import { useAuthStore } from '@store/auth.store';
import TaskCommentThread, { TaskComment } from './TaskCommentThread';
import toast from 'react-hot-toast';

interface ExhaustiveTaskActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  employeesList: any[];
  initialMode?: 'TASK' | 'ACTIVITY';
  initialTask?: any;
}

const QUICK_SUGGESTIONS = [
  'Lead Follow-up Call',
  'Client Proposal Meeting',
  'Policy Documentation Upload',
  'Renewal Premium Reminder',
  'Health Claim Inspection',
  'Motor Inspection Follow-up',
  'Customer Servicing Call'
];

const CATEGORIES = [
  'Sales & Lead Generation',
  'Customer Meeting / Field Visit',
  'Policy Processing & Issuance',
  'Document Collection & KYC',
  'Renewal Preparation & Follow-up',
  'Claims Assistance & Survey',
  'Customer Service & Query Resolution',
  'Administrative & Back Office'
];

const ENTITY_TYPES = [
  { value: 'LEAD', label: 'Lead Pipeline' },
  { value: 'POLICY', label: 'Policy Record' },
  { value: 'CONTACT', label: 'Customer / Contact' },
  { value: 'CLAIM', label: 'Claim Record' },
  { value: 'GENERAL', label: 'General / Internal Task' }
];

const OUTCOMES = [
  'Quotation Sent & Under Review',
  'Interested — Callback Scheduled',
  'Documents Collected / Verified',
  'Deal Won — Premium Collected',
  'Policy Dispatched to Client',
  'Claim Query Resolved',
  'Not Reachable — Will Retry',
  'Customer Not Interested'
];

const RECURRENCE_OPTIONS = [
  { value: 'NONE', label: 'Does not repeat (Single Task)' },
  { value: 'DAILY', label: 'Daily (Every Working Day)' },
  { value: 'WEEKLY', label: 'Weekly (Every Monday)' },
  { value: 'BIWEEKLY', label: 'Every 2 Weeks' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly (Renewal Schedule)' }
];

export const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  UPCOMING: { label: 'Upcoming', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  PENDING: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  ON_HOLD: { label: 'On Hold', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  DONE: { label: 'Done', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  RESCHEDULED: { label: 'Rescheduled', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' }
};

export default function ExhaustiveTaskActivityModal({
  isOpen,
  onClose,
  onSave,
  employeesList,
  initialMode = 'TASK',
  initialTask = null
}: ExhaustiveTaskActivityModalProps) {
  const user = useAuthStore(s => s.user);

  const [mode, setMode] = useState<'TASK' | 'ACTIVITY'>(initialMode);
  const [activeFormTab, setActiveFormTab] = useState<'DETAILS' | 'COMMENTS'>('DETAILS');

  // Core Form State
  const [title, setTitle] = useState(initialTask?.title || '');
  const [category, setCategory] = useState(initialTask?.category || CATEGORIES[0]);
  const [description, setDescription] = useState(initialTask?.description || '');
  
  // Entity Link
  const [entityType, setEntityType] = useState(initialTask?.entityType || 'LEAD');
  const [entityName, setEntityName] = useState(initialTask?.entityName || '');
  
  // Assignment, Priority & Extended Status
  const [assignedToId, setAssignedToId] = useState(initialTask?.assignedToId || user?.id || '');
  const [priority, setPriority] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>(
    initialTask?.priority || 'MEDIUM'
  );
  const [status, setStatus] = useState<string>(
    initialTask?.status || (mode === 'ACTIVITY' ? 'DONE' : 'IN_PROGRESS')
  );

  // Recurrence / Event Schedule
  const [recurrence, setRecurrence] = useState(initialTask?.recurrence || 'NONE');

  // Timings
  const [startDate, setStartDate] = useState(
    initialTask?.startDate ? initialTask.startDate.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState(
    initialTask?.dueDate ? initialTask.dueDate.slice(0, 10) : new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  );
  const [estimatedDuration, setEstimatedDuration] = useState(initialTask?.timeRequired || '30m');
  const [actualDuration, setActualDuration] = useState(initialTask?.actualDuration || (mode === 'ACTIVITY' ? '30m' : ''));

  // Metrics & Outcomes
  const [outcome, setOutcome] = useState(initialTask?.outcome || OUTCOMES[0]);
  const [callsMade, setCallsMade] = useState(initialTask?.metrics?.callsMade || (mode === 'ACTIVITY' ? 1 : 0));
  const [visitsDone, setVisitsDone] = useState(initialTask?.metrics?.visitsDone || 0);
  const [premiumCollected, setPremiumCollected] = useState(initialTask?.metrics?.premiumCollected || 0);

  // Comments
  const [comments, setComments] = useState<TaskComment[]>(initialTask?.comments || []);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a title or task summary');
      return;
    }

    const payload = {
      id: initialTask?.id || undefined,
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      entityType,
      entityName: entityName.trim() || undefined,
      assignedToId: assignedToId || user?.id,
      priority,
      status: mode === 'ACTIVITY' ? 'DONE' : status,
      recurrence,
      isRecurring: recurrence !== 'NONE',
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      dueDate: dueDate ? new Date(dueDate).toISOString() : new Date().toISOString(),
      timeRequired: estimatedDuration || undefined,
      actualDuration: actualDuration || undefined,
      outcome: (mode === 'ACTIVITY' || status === 'DONE') ? outcome : undefined,
      metrics: {
        callsMade: Number(callsMade) || 0,
        visitsDone: Number(visitsDone) || 0,
        premiumCollected: Number(premiumCollected) || 0
      },
      comments
    };

    onSave(payload);
    toast.success(
      initialTask 
        ? 'Task updated successfully!' 
        : mode === 'ACTIVITY' ? 'Activity logged successfully!' : 'Task scheduled successfully!'
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-50 w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[90vh]">
        
        {/* Top Sticky Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${
              mode === 'ACTIVITY' ? 'bg-emerald-100 text-emerald-700' : 'bg-primary-100 text-primary-700'
            }`}>
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                {initialTask 
                  ? 'Edit Task & Activity Record' 
                  : mode === 'ACTIVITY' ? 'Log Completed Activity' : 'Schedule & Assign New Task'}
              </h2>
              <p className="text-xs text-gray-500">Capture work details, link CRM entities, configure recurrence, and track outcomes</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab & Mode Switcher Bar */}
        <div className="px-6 py-3 bg-white border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          {/* Mode Switcher */}
          {!initialTask && (
            <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => { setMode('TASK'); setStatus('IN_PROGRESS'); }}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  mode === 'TASK' 
                    ? 'bg-white text-primary-700 shadow-xs' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                📅 Plan Task
              </button>
              <button
                type="button"
                onClick={() => { setMode('ACTIVITY'); setStatus('DONE'); }}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  mode === 'ACTIVITY' 
                    ? 'bg-white text-emerald-700 shadow-xs' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                ✅ Log Activity
              </button>
            </div>
          )}

          {/* Form Tabs: Details vs Comments */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveFormTab('DETAILS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeFormTab === 'DETAILS'
                  ? 'bg-slate-200 text-gray-900'
                  : 'text-gray-500 hover:bg-slate-100'
              }`}
            >
              📝 Task Fields
            </button>
            <button
              type="button"
              onClick={() => setActiveFormTab('COMMENTS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeFormTab === 'COMMENTS'
                  ? 'bg-primary-100 text-primary-800'
                  : 'text-gray-500 hover:bg-slate-100'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Comments & Notes ({comments.length})
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar flex-1">
          
          {activeFormTab === 'COMMENTS' ? (
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
              <TaskCommentThread
                comments={comments}
                onAddComment={(newComment) => setComments(prev => [...prev, newComment])}
              />
            </div>
          ) : (
            <form id="task-form" onSubmit={handleSubmit} className="space-y-4">
              
              {/* Quick Suggestion Chips */}
              {!initialTask && (
                <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Quick Fill Templates:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_SUGGESTIONS.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setTitle(sug)}
                        className="px-2.5 py-1 text-[11px] font-medium bg-slate-50 hover:bg-primary-50 hover:text-primary-700 text-gray-700 border border-gray-200 rounded-lg transition-colors cursor-pointer"
                      >
                        + {sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* CARD 1: Core Information */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2">
                  <FileText className="w-4 h-4 text-primary-600" />
                  1. Task Overview & Categorization
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Task Title / Action Item *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={mode === 'ACTIVITY' ? 'e.g. Conducted 45 min product demonstration' : 'e.g. Follow up on Star Health Comprehensive Quotation'}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Work Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white font-medium"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Description / Agenda / Instructions
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Provide specific notes, customer questions or next action instructions..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white"
                  />
                </div>
              </div>

              {/* CARD 2: Linked CRM Entity */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  2. Linked CRM Entity & Customer Reference
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Entity Module
                    </label>
                    <select
                      value={entityType}
                      onChange={(e) => setEntityType(e.target.value)}
                      className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white font-medium"
                    >
                      {ENTITY_TYPES.map(e => (
                        <option key={e.value} value={e.value}>{e.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Customer / Policy / Record Reference
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Amit Sharma (Lead #LD-4091) or Policy #POL-8902"
                      value={entityName}
                      onChange={(e) => setEntityName(e.target.value)}
                      className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* CARD 3: Assignment, Priority & 7 Extended Statuses */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  3. Assignment, Priority & Workflow Status
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Assigned To
                    </label>
                    <select
                      value={assignedToId}
                      onChange={(e) => setAssignedToId(e.target.value)}
                      className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white font-medium"
                    >
                      <option value={user?.id || ''}>Self ({user?.firstName} {user?.lastName || ''})</option>
                      {employeesList.map((emp: any) => (
                        <option key={emp.userId || emp.id} value={emp.userId || emp.id}>
                          {emp.firstName} {emp.lastName} ({emp.designation || 'Agent'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Priority Level *
                    </label>
                    <select
                      value={priority}
                      onChange={(e: any) => setPriority(e.target.value)}
                      className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white font-bold"
                    >
                      <option value="CRITICAL">🔴 Critical (Immediate)</option>
                      <option value="HIGH">🟠 High Priority</option>
                      <option value="MEDIUM">🟡 Medium Priority</option>
                      <option value="LOW">⚪ Low Priority</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Workflow Status *
                    </label>
                    <select
                      value={status}
                      onChange={(e: any) => setStatus(e.target.value)}
                      className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white font-bold"
                    >
                      <option value="UPCOMING">🔵 Upcoming</option>
                      <option value="IN_PROGRESS">🟢 In Progress</option>
                      <option value="PENDING">🟡 Pending</option>
                      <option value="ON_HOLD">🟠 On Hold</option>
                      <option value="DONE">✅ Done (Completed)</option>
                      <option value="CANCELLED">🔴 Cancelled</option>
                      <option value="RESCHEDULED">🟣 Rescheduled</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* CARD 4: Schedule, Timings & Calendar Event Merge */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 pb-2">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  4. Schedule, Timings & Calendar Recurrence (Event Merge)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Start Date
                    </label>
                    <DatePicker
                      value={startDate}
                      onDateChange={setStartDate}
                      className="input w-full p-2 text-xs border border-gray-200 rounded-xl bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Target / Due Date *
                    </label>
                    <DatePicker
                      value={dueDate}
                      onDateChange={setDueDate}
                      className="input w-full p-2 text-xs border border-gray-200 rounded-xl bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Est. Duration
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 30m, 1h"
                      value={estimatedDuration}
                      onChange={(e) => setEstimatedDuration(e.target.value)}
                      className="input w-full p-2 text-xs border border-gray-200 rounded-xl bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Actual Spent
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 42m"
                      value={actualDuration}
                      onChange={(e) => setActualDuration(e.target.value)}
                      className="input w-full p-2 text-xs border border-gray-200 rounded-xl bg-white"
                    />
                  </div>
                </div>

                {/* Recurrence Selector (Event = Scheduled Task) */}
                <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Repeat className="w-4 h-4 text-purple-600 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-gray-800">Recurrence / Repetitive Schedule</span>
                      <p className="text-[11px] text-gray-400">Repeated tasks automatically pin to the monthly employee calendar</p>
                    </div>
                  </div>

                  <select
                    value={recurrence}
                    onChange={(e) => setRecurrence(e.target.value)}
                    className="input sm:w-64 p-2 text-xs border border-purple-200 bg-purple-50/50 rounded-xl font-semibold text-purple-900"
                  >
                    {RECURRENCE_OPTIONS.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* CARD 5: Outcome & Metrics (For Activity or Done Tasks) */}
              {(mode === 'ACTIVITY' || status === 'DONE') && (
                <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-200 shadow-xs space-y-3">
                  <h3 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-2 border-b border-emerald-200/80 pb-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    5. Work Outcome & Performance Output
                  </h3>

                  <div>
                    <label className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">
                      Customer Interaction Outcome
                    </label>
                    <select
                      value={outcome}
                      onChange={(e) => setOutcome(e.target.value)}
                      className="input w-full p-2.5 text-xs border border-emerald-200 rounded-xl bg-white font-medium text-gray-800"
                    >
                      {OUTCOMES.map(out => (
                        <option key={out} value={out}>{out}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">
                        Calls Made (+Count)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={callsMade}
                        onChange={(e) => setCallsMade(Number(e.target.value))}
                        className="input w-full p-2 text-xs border border-emerald-200 rounded-xl bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">
                        Meetings / Visits (+Count)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={visitsDone}
                        onChange={(e) => setVisitsDone(Number(e.target.value))}
                        className="input w-full p-2 text-xs border border-emerald-200 rounded-xl bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">
                        Premium Collected (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={premiumCollected}
                        onChange={(e) => setPremiumCollected(Number(e.target.value))}
                        className="input w-full p-2 text-xs border border-emerald-200 rounded-xl bg-white font-bold text-emerald-700"
                      />
                    </div>
                  </div>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Sticky Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 bg-white sticky bottom-0 z-10">
          <span className="text-[11px] text-gray-400">
            {activeFormTab === 'COMMENTS' ? 'Comments are saved with task updates' : 'All critical changes are logged to the audit feed'}
          </span>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="task-form"
              className={`px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all cursor-pointer ${
                mode === 'ACTIVITY'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                  : 'bg-primary-600 hover:bg-primary-700 shadow-primary-600/20'
              }`}
            >
              {initialTask ? '✓ Update Task' : mode === 'ACTIVITY' ? '✓ Save Activity Log' : '📅 Schedule Task'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
