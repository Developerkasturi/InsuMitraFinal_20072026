import React, { useState, useEffect } from 'react';
import { 
  X, CheckSquare, Clock, Calendar, Users, Shield, 
  FileText, TrendingUp, AlertCircle, Sparkles, Check, 
  DollarSign, Phone, Eye, Repeat, MessageSquare, Tag, 
  Layers, ArrowRight, Bookmark, PlayCircle, StopCircle, Zap, 
  UserCheck, Briefcase, Hash, ChevronDown, Trash2, History, Activity,
  Paperclip, Upload, Download, File, User, Link as LinkIcon
} from 'lucide-react';
import clsx from 'clsx';
import { DatePicker } from '@comps/common/DatePicker';
import { TimePicker } from '@comps/common/TimePicker';
import { useAuthStore } from '@store/auth.store';
import TaskCommentThread, { TaskComment } from './TaskCommentThread';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface TaskAttachment {
  id: string;
  name: string;
  size: string;
  type: string;
  uploadedAt: string;
  uploadedBy: string;
}

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
  'Motor Survey Follow-up',
  'Customer Servicing Call',
  'Cheque / Payment Collection',
  'KYC Verification Follow-up'
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
  { value: 'LEAD', label: 'Lead Pipeline', icon: '🎯', color: 'from-blue-500 to-indigo-600' },
  { value: 'POLICY', label: 'Policy Record', icon: '📄', color: 'from-purple-500 to-indigo-600' },
  { value: 'CONTACT', label: 'Customer / Contact', icon: '👤', color: 'from-emerald-500 to-teal-600' },
  { value: 'CLAIM', label: 'Claim Record', icon: '🛡️', color: 'from-rose-500 to-pink-600' },
  { value: 'GENERAL', label: 'General / Internal', icon: '🏢', color: 'from-slate-500 to-gray-600' }
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

/** Automatically compute duration string from Start Time and End Time */
function computeDuration(startStr: string, endStr: string): string {
  if (!startStr || !endStr) return '';
  const parseTimeToMinutes = (t: string): number | null => {
    const trimmed = t.trim().toUpperCase();
    const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
    if (!match) return null;
    let hours = parseInt(match[1], 10);
    const mins = parseInt(match[2], 10);
    const ampm = match[3];
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return hours * 60 + mins;
  };

  const startMin = parseTimeToMinutes(startStr);
  const endMin = parseTimeToMinutes(endStr);
  if (startMin === null || endMin === null) return '';
  let diff = endMin - startMin;
  if (diff < 0) diff += 24 * 60; // Next day wrap
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

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
  const [activeTab, setActiveTab] = useState<'Details' | 'Timeline' | 'CRM' | 'Outcome' | 'Attachments' | 'Comments' | 'Logs'>('Details');

  // Task Number
  const [taskNumber, setTaskNumber] = useState<string>(() => {
    if (initialTask?.taskId) return initialTask.taskId;
    if (initialTask?.taskNumber) return initialTask.taskNumber;
    if (initialTask?.id) return initialTask.id.startsWith('T') ? initialTask.id : `T-${initialTask.id}`;
    return '';
  });

  // Created By Info
  const createdBy = initialTask?.createdBy || {
    name: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Advisory Agent',
    role: user?.role || 'Insurance Advisor',
    date: initialTask?.createdAt ? format(new Date(initialTask.createdAt), 'dd MMM yyyy, hh:mm a') : format(new Date(), 'dd MMM yyyy, hh:mm a')
  };

  // Core Form State
  const [title, setTitle] = useState(initialTask?.title || '');
  const [category, setCategory] = useState(initialTask?.category || CATEGORIES[0]);
  const [description, setDescription] = useState(initialTask?.description || '');
  
  // Related To / Entity Link
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

  // Planned Timings
  const [dueDate, setDueDate] = useState(
    initialTask?.dueDate ? initialTask.dueDate.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [plannedStartTime, setPlannedStartTime] = useState(initialTask?.plannedStartTime || '10:00 AM');
  const [plannedEndTime, setPlannedEndTime] = useState(initialTask?.plannedEndTime || '10:45 AM');
  const [estimatedDuration, setEstimatedDuration] = useState(initialTask?.timeRequired || '45m');

  // Actual Live Execution Timings (for Daily Timeline Tracking)
  const [actualDate, setActualDate] = useState(
    initialTask?.actualDate 
      ? initialTask.actualDate.slice(0, 10) 
      : (initialTask?.dueDate ? initialTask.dueDate.slice(0, 10) : new Date().toISOString().slice(0, 10))
  );
  const [actualStartTime, setActualStartTime] = useState(initialTask?.actualStartTime || (mode === 'ACTIVITY' ? '10:05 AM' : ''));
  const [actualEndTime, setActualEndTime] = useState(initialTask?.actualEndTime || (mode === 'ACTIVITY' ? '10:45 AM' : ''));
  const [actualDuration, setActualDuration] = useState(initialTask?.actualDuration || (mode === 'ACTIVITY' ? '40m' : ''));

  // Metrics & Outcomes
  const [outcome, setOutcome] = useState(initialTask?.outcome || OUTCOMES[0]);
  const [callsMade, setCallsMade] = useState(initialTask?.metrics?.callsMade || (mode === 'ACTIVITY' ? 1 : 0));
  const [visitsDone, setVisitsDone] = useState(initialTask?.metrics?.visitsDone || 0);
  const [premiumCollected, setPremiumCollected] = useState(initialTask?.metrics?.premiumCollected || 0);

  // Attachments
  const [attachments, setAttachments] = useState<TaskAttachment[]>(initialTask?.attachments || [
    {
      id: 'att-1',
      name: 'Star_Comprehensive_Quotation_v2.pdf',
      size: '1.4 MB',
      type: 'PDF Document',
      uploadedAt: 'Today, 10:15 AM',
      uploadedBy: createdBy.name
    }
  ]);

  // Comments
  const [comments, setComments] = useState<TaskComment[]>(initialTask?.comments || []);

  // History Change Logs
  const historyLogs = initialTask?.historyLogs || [
    {
      id: 'log-1',
      action: 'CREATED',
      title: 'Task Created & Scheduled',
      author: createdBy.name,
      timestamp: createdBy.date,
      details: `${taskNumber} scheduled for ${dueDate} (${plannedStartTime} - ${plannedEndTime}) with priority ${priority}`
    },
    {
      id: 'log-2',
      action: 'STATUS_UPDATE',
      title: 'Workflow Status Updated to In Progress',
      author: 'CRM Automated Workflow',
      timestamp: '24 Aug 2026, 10:05 AM',
      details: `Execution started. Assigned to ${employeesList.find(e => e.id === assignedToId || e.userId === assignedToId)?.firstName || 'Assigned Agent'}.`
    }
  ];

  // Auto calculate actual duration when actual start/end time changes
  useEffect(() => {
    if (actualStartTime && actualEndTime) {
      const dur = computeDuration(actualStartTime, actualEndTime);
      if (dur) setActualDuration(dur);
    }
  }, [actualStartTime, actualEndTime]);

  // Auto calculate planned duration when planned start/end time changes
  useEffect(() => {
    if (plannedStartTime && plannedEndTime) {
      const dur = computeDuration(plannedStartTime, plannedEndTime);
      if (dur) setEstimatedDuration(dur);
    }
  }, [plannedStartTime, plannedEndTime]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newFiles: TaskAttachment[] = Array.from(files).map((f, i) => ({
      id: `att-${Date.now()}-${i}`,
      name: f.name,
      size: `${(f.size / (1024 * 1024)).toFixed(2)} MB`,
      type: f.type || 'Document File',
      uploadedAt: 'Just now',
      uploadedBy: createdBy.name
    }));
    setAttachments(prev => [...prev, ...newFiles]);
    toast.success(`${files.length} file(s) attached successfully!`);
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
    toast.success('Attachment removed');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a task title or activity name');
      return;
    }

    const payload = {
      id: initialTask?.id || undefined,
      taskId: taskNumber || undefined,
      taskNumber: taskNumber || undefined,
      createdBy,
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
      dueDate: dueDate ? new Date(dueDate).toISOString() : new Date().toISOString(),
      plannedStartTime,
      plannedEndTime,
      timeRequired: estimatedDuration || undefined,
      actualDate: actualDate ? new Date(actualDate).toISOString() : undefined,
      actualStartTime: actualStartTime || undefined,
      actualEndTime: actualEndTime || undefined,
      actualDuration: actualDuration || undefined,
      outcome: (mode === 'ACTIVITY' || status === 'DONE') ? outcome : undefined,
      metrics: {
        callsMade: Number(callsMade) || 0,
        visitsDone: Number(visitsDone) || 0,
        premiumCollected: Number(premiumCollected) || 0
      },
      attachments,
      comments
    };

    onSave(payload);
    toast.success(
      initialTask 
        ? `${taskNumber || 'Task'} updated successfully!` 
        : mode === 'ACTIVITY' ? `${taskNumber || 'Activity'} logged!` : `${taskNumber || 'Task'} scheduled successfully!`
    );
    onClose();
  };

  const AVAILABLE_TABS = mode === 'TASK'
    ? (['Details', 'Timeline', 'CRM', 'Attachments', 'Comments', 'Logs'] as const)
    : (['Details', 'Timeline', 'CRM', 'Outcome', 'Attachments', 'Comments', 'Logs'] as const);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto animate-fadeIn">
      {/* Modal Container with intact stable fixed height */}
      <div className="bg-white w-full max-w-4xl h-[630px] max-h-[92vh] rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden my-auto flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-md ${
              mode === 'ACTIVITY' 
                ? 'bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-emerald-500/20' 
                : 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-blue-500/20'
            }`}>
              <CheckSquare size={20} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  {initialTask 
                    ? 'Edit Task & Execution Record' 
                    : mode === 'ACTIVITY' ? 'Log Completed Activity' : 'Schedule & Assign New Task'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-mono font-extrabold text-xs">
                  {taskNumber || (initialTask ? 'Task' : 'Auto (T1, T2...)')}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 mt-0.5">
                <span>👤 Created by: <strong className="text-slate-700">{createdBy.name}</strong></span>
                <span>•</span>
                <span>{createdBy.date}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleSubmit}
              className="px-5 py-2 text-xs font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl cursor-pointer shadow-md shadow-blue-500/20 transition-all hover:scale-105"
            >
              {initialTask ? '✓ Update' : mode === 'ACTIVITY' ? '✓ Save Log' : '📅 Schedule'}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Sub-Navigation Pill Tabs */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex bg-slate-200/60 p-1 rounded-2xl gap-1.5 border border-slate-200/80 overflow-x-auto shadow-2xs">
            {AVAILABLE_TABS.map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab as any)}
                className={clsx(
                  'px-3.5 py-1.5 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap select-none',
                  activeTab === tab
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                )}
              >
                {tab === 'Details' && (mode === 'ACTIVITY' ? '📝 Activity Details' : '📝 Task Details')}
                {tab === 'Timeline' && (mode === 'ACTIVITY' ? '⏱️ Timings & Duration' : '⏱️ Timeline & Agenda')}
                {tab === 'CRM' && '🔗 Related To'}
                {tab === 'Outcome' && '🎯 Outcomes & KPI'}
                {tab === 'Attachments' && `📎 Attachments (${attachments.length})`}
                {tab === 'Comments' && `💬 Notes (${comments.length})`}
                {tab === 'Logs' && '📜 Change Logs'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-bold text-slate-700 font-mono">{taskNumber || 'Auto T#'}</span>
          </div>
        </div>

        {/* Scrollable Form Body with fixed height container */}
        <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar flex-1 bg-slate-50/50">
          
          {/* TAB 1: TASK DETAILS */}
          {activeTab === 'Details' && (
            <div className="space-y-4 animate-fadeIn">

              {/* Main Card: Task Information & Category */}
              <div className="rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm bg-white">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-black text-xs">
                      1
                    </div>
                    <span className="text-white font-extrabold text-xs">Task Information &amp; Category</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white font-mono font-bold text-[10px]">
                    {taskNumber || 'Auto T#'}
                  </span>
                </div>

                <div className="p-4 space-y-3.5">
                  
                  {/* Mode Toggle Switcher */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50/90 rounded-2xl border border-slate-200/90 shadow-2xs">
                    <div>
                      <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider block">
                        Action Type &amp; Workflow Mode
                      </span>
                      <p className="text-[10px] text-slate-500 font-medium">
                        Select whether you are scheduling upcoming work or logging a completed activity
                      </p>
                    </div>

                    <div className="flex p-1 bg-slate-200/80 rounded-xl border border-slate-300/80 text-xs shrink-0 select-none">
                      <button
                        type="button"
                        onClick={() => { 
                          setMode('TASK'); 
                          setStatus('IN_PROGRESS'); 
                          if ((activeTab as string) === 'Outcome') setActiveTab('Details');
                        }}
                        className={clsx(
                          'px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5',
                          mode === 'TASK' 
                            ? 'bg-blue-600 text-white shadow-xs' 
                            : 'text-slate-600 hover:text-slate-900'
                        )}
                      >
                        📅 Plan Task
                      </button>
                      <button
                        type="button"
                        onClick={() => { setMode('ACTIVITY'); setStatus('DONE'); }}
                        className={clsx(
                          'px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5',
                          mode === 'ACTIVITY' 
                            ? 'bg-emerald-600 text-white shadow-xs' 
                            : 'text-slate-600 hover:text-slate-900'
                        )}
                      >
                        ✅ Log Activity
                      </button>
                    </div>
                  </div>

                  {/* Task Number, Title & Category Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-3">
                      <label className="label text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                        Task Number
                      </label>
                      <div className="relative">
                        <Hash size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Auto (T1, T2...)"
                          value={taskNumber}
                          onChange={(e) => setTaskNumber(e.target.value)}
                          className="w-full text-xs pl-8 pr-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-900 font-mono font-extrabold outline-none"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-5">
                      <label className="label text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                        Task Title / Action Item *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          list="task-title-templates"
                          placeholder={mode === 'ACTIVITY' ? 'e.g. Conducted product demo with client' : 'e.g. Follow up on Comprehensive Quotation'}
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-2xs"
                        />
                        <datalist id="task-title-templates">
                          {QUICK_SUGGESTIONS.map((sug) => (
                            <option key={sug} value={sug} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    <div className="md:col-span-4">
                      <label className="label text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                        Work Category
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-2xs"
                      >
                        {CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      Action Description &amp; Specific Notes
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Provide specific notes, customer questions or next action instructions..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* Assignment & Priority Card with Created By Audit */}
              <div className="rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm bg-white">
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-black text-xs">
                      2
                    </div>
                    <span className="text-white font-extrabold text-xs">Assignment &amp; Ownership</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-white/90 font-bold bg-white/10 px-2.5 py-0.5 rounded-full">
                    <User size={12} />
                    <span>Created by: {createdBy.name}</span>
                  </div>
                </div>

                <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      Assigned To Employee
                    </label>
                    <select
                      value={assignedToId}
                      onChange={(e) => setAssignedToId(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-2xs"
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
                    <label className="label text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      Priority Level *
                    </label>
                    <select
                      value={priority}
                      onChange={(e: any) => setPriority(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-extrabold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-2xs"
                    >
                      <option value="CRITICAL">🔴 Critical (Immediate)</option>
                      <option value="HIGH">🟠 High Priority</option>
                      <option value="MEDIUM">🟡 Medium Priority</option>
                      <option value="LOW">⚪ Low Priority</option>
                    </select>
                  </div>

                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      Workflow Status *
                    </label>
                    <select
                      value={status}
                      onChange={(e: any) => setStatus(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-extrabold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-2xs"
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

            </div>
          )}

          {/* TAB 2: TIMELINE & TIMINGS (Attractive Grid Row matching screenshot) */}
          {activeTab === 'Timeline' && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* Planned Schedule Block */}
              <div className="rounded-2xl border border-slate-200/90 overflow-hidden shadow-sm bg-white">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-black text-xs">
                      ⏱️
                    </div>
                    <span className="text-white font-extrabold text-xs">Target Planned Agenda</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white font-bold text-[10px] uppercase">
                    Slot Allocation
                  </span>
                </div>

                <div className="p-5 grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50/40">
                  
                  {/* Scheduled Date */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block">
                      Scheduled Date *
                    </label>
                    <DatePicker
                      value={dueDate}
                      onDateChange={setDueDate}
                      className="w-full !bg-white !border-slate-300 !rounded-xl !py-2.5 shadow-2xs text-xs font-bold text-slate-800"
                    />
                  </div>

                  {/* Planned Start Time */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block">
                      Planned Start Time (Watch)
                    </label>
                    <TimePicker
                      value={plannedStartTime}
                      onTimeChange={setPlannedStartTime}
                      placeholder="10:00 AM"
                      className="w-full !bg-white !border-slate-300 !rounded-xl !py-2.5 shadow-2xs text-xs font-bold text-slate-800"
                    />
                  </div>

                  {/* Planned End Time */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block">
                      Planned End Time (Watch)
                    </label>
                    <TimePicker
                      value={plannedEndTime}
                      onTimeChange={setPlannedEndTime}
                      placeholder="10:45 AM"
                      className="w-full !bg-white !border-slate-300 !rounded-xl !py-2.5 shadow-2xs text-xs font-bold text-slate-800"
                    />
                  </div>

                  {/* Estimated Duration */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block">
                      Estimated Duration (Auto)
                    </label>
                    <input
                      type="text"
                      readOnly
                      placeholder="Auto-calculated"
                      value={estimatedDuration}
                      className="w-full text-xs px-3.5 py-2.5 bg-blue-50/80 border border-blue-200 rounded-xl text-blue-900 font-extrabold outline-none shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* Actual Live Execution Block (Matching 4-Grid Column Structure) */}
              <div className="rounded-2xl border border-emerald-200/90 overflow-hidden shadow-sm bg-white">
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-black text-xs">
                      ⚡
                    </div>
                    <span className="text-white font-extrabold text-xs">Actual Completed Execution</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white font-bold text-[10px] uppercase">
                    Verified Execution
                  </span>
                </div>

                <div className="p-5 grid grid-cols-1 sm:grid-cols-4 gap-4 bg-emerald-50/20">
                  
                  {/* Actual Execution Date */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-emerald-950 uppercase tracking-wider block">
                      Actual Date *
                    </label>
                    <DatePicker
                      value={actualDate}
                      onDateChange={setActualDate}
                      className="w-full !bg-white !border-emerald-300 !rounded-xl !py-2.5 shadow-2xs text-xs font-bold text-emerald-950"
                    />
                  </div>

                  {/* Actual Start Time */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-emerald-950 uppercase tracking-wider block">
                      Actual Start Time (Watch)
                    </label>
                    <TimePicker
                      value={actualStartTime}
                      onTimeChange={setActualStartTime}
                      placeholder="10:05 AM"
                      className="w-full !bg-white !border-emerald-300 !rounded-xl !py-2.5 shadow-2xs text-xs font-bold text-emerald-950"
                    />
                  </div>

                  {/* Actual End Time */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-emerald-950 uppercase tracking-wider block">
                      Actual End Time (Watch)
                    </label>
                    <TimePicker
                      value={actualEndTime}
                      onTimeChange={setActualEndTime}
                      placeholder="10:45 AM"
                      className="w-full !bg-white !border-emerald-300 !rounded-xl !py-2.5 shadow-2xs text-xs font-bold text-emerald-950"
                    />
                  </div>

                  {/* Actual Duration */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-emerald-950 uppercase tracking-wider block">
                      Actual Duration (Auto)
                    </label>
                    <input
                      type="text"
                      readOnly
                      placeholder="Auto-calculated"
                      value={actualDuration}
                      className="w-full text-xs px-3.5 py-2.5 bg-emerald-100/70 border border-emerald-300 rounded-xl text-emerald-950 font-black outline-none shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* Recurrence & Repetitive Schedule */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                    <Repeat size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-extrabold text-slate-800">Recurrence &amp; Calendar Event Schedule</span>
                    <p className="text-[11px] text-slate-400">Repeated events automatically synchronize across the monthly employee timeline</p>
                  </div>
                </div>

                <select
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value)}
                  className="px-3.5 py-2 text-xs font-bold border border-purple-200 bg-purple-50/60 rounded-xl text-purple-900 outline-none cursor-pointer"
                >
                  {RECURRENCE_OPTIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

            </div>
          )}

          {/* TAB 3: RELATED TO (CRM Record Linkage) */}
          {activeTab === 'CRM' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm bg-white">
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-black text-xs">
                      🔗
                    </div>
                    <span className="text-white font-extrabold text-xs">Related To (CRM Record Linkage)</span>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block mb-2">
                      Related Module Type *
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {ENTITY_TYPES.map(mod => {
                        const isSel = entityType === mod.value;
                        return (
                          <button
                            key={mod.value}
                            type="button"
                            onClick={() => setEntityType(mod.value)}
                            className={clsx(
                              'p-3 rounded-2xl border text-left transition-all cursor-pointer select-none flex flex-col justify-between gap-2',
                              isSel 
                                ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white border-blue-600 shadow-md shadow-blue-500/25 scale-[1.02]' 
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            )}
                          >
                            <span className="text-lg">{mod.icon}</span>
                            <div>
                              <span className="text-xs font-extrabold block">{mod.label}</span>
                              <span className={clsx('text-[10px] font-medium block', isSel ? 'text-white/80' : 'text-slate-400')}>
                                {isSel ? '✓ Selected' : 'Click to link'}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      Customer / Policy / Lead Reference *
                    </label>
                    <div className="relative">
                      <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="e.g. Rajesh Sharma (#LD-4091) or HDFC Life Policy #POL-8902"
                        value={entityName}
                        onChange={(e) => setEntityName(e.target.value)}
                        className="w-full text-xs pl-8 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-2xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: OUTCOME & PERFORMANCE METRICS (Only in Activity mode) */}
          {activeTab === 'Outcome' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="rounded-2xl border border-emerald-200 overflow-hidden shadow-sm bg-white">
                <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-black text-xs">
                      🎯
                    </div>
                    <span className="text-white font-extrabold text-xs">Work Output &amp; Conversion Results</span>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <label className="label text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                      Interaction / Call Outcome
                    </label>
                    <select
                      value={outcome}
                      onChange={(e) => setOutcome(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500/20 outline-none shadow-2xs"
                    >
                      {OUTCOMES.map(out => (
                        <option key={out} value={out}>{out}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                      <label className="label text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                        Calls Made (+Count)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={callsMade}
                        onChange={(e) => setCallsMade(Number(e.target.value))}
                        className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold outline-none"
                      />
                    </div>

                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                      <label className="label text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block mb-1">
                        Meetings / Visits (+Count)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={visitsDone}
                        onChange={(e) => setVisitsDone(Number(e.target.value))}
                        className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold outline-none"
                      />
                    </div>

                    <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200">
                      <label className="label text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block mb-1">
                        Premium Collected (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={premiumCollected}
                        onChange={(e) => setPremiumCollected(Number(e.target.value))}
                        className="w-full text-xs px-3 py-2 bg-white border border-emerald-300 rounded-xl text-emerald-700 font-black outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ATTACHMENTS */}
          {activeTab === 'Attachments' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                
                {/* Upload Zone */}
                <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all bg-slate-50 hover:bg-blue-50/50 group">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Upload size={22} />
                  </div>
                  <span className="text-xs font-extrabold text-slate-800">
                    Click to upload or drag and drop
                  </span>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    Quotation PDFs, Policy Documents, Photos, Voice Notes, Inspection Copies (Max 25MB)
                  </p>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                {/* Attachments List */}
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    Attached Files ({attachments.length})
                  </h4>

                  {attachments.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 font-medium bg-slate-50 rounded-xl">
                      No attachments added yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {attachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-2xl transition-all"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                              <FileText size={18} />
                            </div>
                            <div className="overflow-hidden">
                              <span className="text-xs font-bold text-slate-900 truncate block">
                                {att.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {att.size} • {att.uploadedAt}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <button
                              type="button"
                              onClick={() => toast.success(`Downloading ${att.name}`)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-white transition-colors cursor-pointer"
                              title="Download"
                            >
                              <Download size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveAttachment(att.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white transition-colors cursor-pointer"
                              title="Remove"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 6: COMMENTS & DISCUSSION */}
          {activeTab === 'Comments' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs animate-fadeIn">
              <TaskCommentThread
                comments={comments}
                onAddComment={(newComment) => setComments(prev => [...prev, newComment])}
              />
            </div>
          )}

          {/* TAB 7: CHANGE LOGS & AUDIT TRAIL */}
          {activeTab === 'Logs' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <History size={16} className="text-blue-600" />
                    <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                      Audit Trail &amp; Activity History
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">
                    {historyLogs.length} Events Recorded
                  </span>
                </div>

                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {historyLogs.map((log: any) => (
                    <div key={log.id} className="relative group">
                      <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white border-2 border-blue-600 flex items-center justify-center shadow-xs">
                        <Activity size={10} className="text-blue-600" />
                      </div>
                      <div className="bg-slate-50 hover:bg-slate-100/80 p-3 rounded-2xl border border-slate-200/80 transition-colors space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-slate-900">{log.title}</span>
                          <span className="text-[10px] font-bold text-slate-400 font-mono">{log.timestamp}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 font-medium">{log.details}</p>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md inline-block border border-blue-100">
                          👤 By {log.author}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
