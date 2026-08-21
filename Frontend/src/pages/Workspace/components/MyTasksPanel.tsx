import React, { useState } from 'react';
import { 
  ListTodo, Kanban, Plus, Search, Filter, Calendar, 
  Clock, CheckCircle2, AlertCircle, Ban, RefreshCw, 
  Pencil, ChevronDown, Check, User, Shield, MessageSquare, 
  Sparkles, ArrowRight, MoreVertical 
} from 'lucide-react';
import { format } from 'date-fns';
import ExhaustiveTaskActivityModal, { STATUS_CONFIG } from './ExhaustiveTaskActivityModal';
import TaskActionModal, { TaskActionType } from './TaskActionModal';
import toast from 'react-hot-toast';

interface MyTasksPanelProps {
  tasks: any[];
  employeesList: any[];
  onToggleTask?: (taskId: string, currentStatus: string) => void;
  onAddTask?: (taskPayload: any) => void;
  isViewOnly?: boolean;
}

const DEFAULT_MY_TASKS = [
  {
    id: 't-101',
    title: 'Follow up with Amit Sharma on Star Comprehensive ₹10L floater',
    category: 'Sales & Lead Generation',
    entityType: 'LEAD',
    entityName: 'Amit Sharma (Lead #LD-4091)',
    priority: 'CRITICAL',
    status: 'IN_PROGRESS',
    dueDate: new Date().toISOString(),
    timeRequired: '30m',
    assignedToName: 'Rahul Sharma',
    comments: [
      { id: 'c-1', authorId: 'u-1', authorName: 'Rahul Mehta', content: 'Offered 10% multi-year discount', createdAt: new Date().toISOString() }
    ]
  },
  {
    id: 't-102',
    title: 'Upload medical examination reports for Policy #POL-8902',
    category: 'Document Collection & KYC',
    entityType: 'POLICY',
    entityName: 'Sunita Patil (#POL-8902)',
    priority: 'HIGH',
    status: 'UPCOMING',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    timeRequired: '45m',
    assignedToName: 'Anjali Nair',
    comments: []
  },
  {
    id: 't-103',
    title: 'Mehta Family Care Supreme Renewal Reminder & Payment Collection',
    category: 'Renewal Preparation & Follow-up',
    entityType: 'POLICY',
    entityName: 'Rajesh Mehta (#POL-4512)',
    priority: 'HIGH',
    status: 'PENDING',
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
    timeRequired: '20m',
    assignedToName: 'Rahul Sharma',
    comments: []
  },
  {
    id: 't-104',
    title: 'Client proposal meeting with Apex Technologies HR Director',
    category: 'Customer Meeting / Field Visit',
    entityType: 'CONTACT',
    entityName: 'Apex Technologies (CON-902)',
    priority: 'MEDIUM',
    status: 'ON_HOLD',
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString(),
    timeRequired: '60m',
    assignedToName: 'Vikram Singhania',
    comments: []
  },
  {
    id: 't-105',
    title: 'Vehicle damage inspection for Bajaj Allianz Motor Claim #CLM-1029',
    category: 'Claims Assistance & Survey',
    entityType: 'CLAIM',
    entityName: 'Vikrant Desai (#CLM-1029)',
    priority: 'MEDIUM',
    status: 'DONE',
    dueDate: new Date(Date.now() - 86400000).toISOString(),
    timeRequired: '40m',
    assignedToName: 'Sneha Deshmukh',
    outcome: 'Survey report approved by surveyor',
    comments: []
  },
  {
    id: 't-106',
    title: 'Submit monthly agency GST invoice & compliance paperwork',
    category: 'Administrative & Back Office',
    entityType: 'GENERAL',
    entityName: 'Internal Agency Operations',
    priority: 'LOW',
    status: 'DONE',
    dueDate: new Date(Date.now() - 86400000 * 2).toISOString(),
    timeRequired: '30m',
    assignedToName: 'Anjali Nair',
    comments: []
  },
  {
    id: 't-107',
    title: 'Follow up on inactive lead duplicate inquiry',
    category: 'Sales & Lead Generation',
    entityType: 'LEAD',
    entityName: 'Rohan Joshi (Lead #LD-302)',
    priority: 'LOW',
    status: 'CANCELLED',
    dueDate: new Date().toISOString(),
    timeRequired: '15m',
    assignedToName: 'Rahul Sharma',
    cancelReason: 'Duplicate Lead Record',
    comments: []
  }
];

export default function MyTasksPanel({
  tasks,
  employeesList,
  onToggleTask,
  onAddTask,
  isViewOnly = false
}: MyTasksPanelProps) {
  const [viewMode, setViewMode] = useState<'TABLE' | 'KANBAN'>('TABLE');
  const [taskList, setTaskList] = useState<any[]>(
    tasks && tasks.length > 0 ? tasks : DEFAULT_MY_TASKS
  );

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [showFilters, setShowFilters] = useState(false);

  const activeFilterCount = (statusFilter !== 'ALL' ? 1 : 0) + (priorityFilter !== 'ALL' ? 1 : 0);

  // Modal States
  const [editingTask, setEditingTask] = useState<any>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [actionModalState, setActionModalState] = useState<{
    isOpen: boolean;
    type: TaskActionType;
    task: any;
  }>({
    isOpen: false,
    type: 'CANCEL',
    task: null
  });

  // Filtered List
  const filteredTasks = taskList.filter(t => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title?.toLowerCase().includes(q);
      const matchEntity = t.entityName?.toLowerCase().includes(q);
      const matchCategory = t.category?.toLowerCase().includes(q);
      if (!matchTitle && !matchEntity && !matchCategory) return false;
    }
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'ALL' && (t.priority || 'MEDIUM') !== priorityFilter) return false;
    return true;
  });

  // Handlers
  const handleQuickStatusChange = (taskId: string, newStatus: string) => {
    if (isViewOnly) return;
    setTaskList(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    toast.success(`Task status updated to ${newStatus}`);
  };

  const handleQuickPriorityChange = (taskId: string, newPriority: string) => {
    if (isViewOnly) return;
    setTaskList(prev => prev.map(t => t.id === taskId ? { ...t, priority: newPriority } : t));
    toast.success(`Priority set to ${newPriority}`);
  };

  const handleOpenActionModal = (task: any, type: TaskActionType) => {
    setActionModalState({ isOpen: true, type, task });
  };

  const handleActionConfirm = (payload: {
    taskId: string;
    action: TaskActionType;
    reason: string;
    newDueDate?: string;
    notes?: string;
  }) => {
    setTaskList(prev => prev.map(t => {
      if (t.id === payload.taskId) {
        return {
          ...t,
          status: payload.action === 'CANCEL' ? 'CANCELLED' : 'RESCHEDULED',
          dueDate: payload.newDueDate || t.dueDate,
          cancelReason: payload.action === 'CANCEL' ? payload.reason : t.cancelReason,
          rescheduleReason: payload.action === 'RESCHEDULE' ? payload.reason : t.rescheduleReason,
          description: payload.notes ? `${t.description || ''}\n[${payload.action} NOTE]: ${payload.notes}` : t.description
        };
      }
      return t;
    }));
  };

  const handleSaveTask = (taskPayload: any) => {
    if (editingTask) {
      setTaskList(prev => prev.map(t => t.id === taskPayload.id ? { ...t, ...taskPayload } : t));
    } else {
      const newTask = {
        ...taskPayload,
        id: `t-${Date.now()}`,
        assignedToName: 'Self'
      };
      setTaskList(prev => [newTask, ...prev]);
    }
    if (onAddTask) onAddTask(taskPayload);
  };

  // Kanban Columns
  const KANBAN_LANES = [
    { key: 'UPCOMING', title: 'Upcoming', color: 'border-t-blue-500 bg-blue-50/20' },
    { key: 'IN_PROGRESS', title: 'In Progress', color: 'border-t-indigo-600 bg-indigo-50/20' },
    { key: 'PENDING', title: 'Pending / On Hold', color: 'border-t-amber-500 bg-amber-50/20', altMatch: ['PENDING', 'ON_HOLD'] },
    { key: 'DONE', title: 'Done / Completed', color: 'border-t-emerald-500 bg-emerald-50/20' },
    { key: 'CANCELLED', title: 'Cancelled / Rescheduled', color: 'border-t-rose-500 bg-rose-50/20', altMatch: ['CANCELLED', 'RESCHEDULED'] }
  ];

  return (
    <div className="space-y-4">
      
      {/* Top Action & Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search tasks, contacts, policies, categories..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input w-full pl-9 p-2 text-xs border border-gray-200 rounded-xl bg-slate-50 focus:bg-white"
          />
        </div>

        {/* View Switcher, Filter Toggle & Action */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Filters Toggle Button */}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`h-9 py-0 px-3 text-xs flex items-center gap-1.5 font-bold cursor-pointer rounded-xl border transition-all ${
              showFilters 
                ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-xs' 
                : 'bg-slate-50 border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Filter size={13} className={showFilters ? 'text-blue-600' : 'text-gray-500'} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="bg-primary-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* View Switcher: Table vs Kanban */}
          <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'TABLE'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <ListTodo className="w-3.5 h-3.5" /> Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('KANBAN')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'KANBAN'
                  ? 'bg-white text-primary-700 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" /> Kanban
            </button>
          </div>

          {!isViewOnly && (
            <button
              type="button"
              onClick={() => { setEditingTask(null); setIsTaskModalOpen(true); }}
              className="btn-primary flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Schedule Task
            </button>
          )}
        </div>
      </div>

      {/* Expandable Filter Panel (Shown when Filters button is clicked) */}
      {showFilters && (
        <div className="bg-slate-50/80 p-4 border border-slate-200 rounded-2xl shadow-xs space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-primary-600" /> Filter Tasks
            </span>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => { setStatusFilter('ALL'); setPriorityFilter('ALL'); }}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {/* Status Filter */}
            <div>
              <label className="text-[11px] font-bold text-gray-600 block mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="input w-full p-2 text-xs border border-gray-200 rounded-xl bg-white font-semibold"
              >
                <option value="ALL">All Statuses ({taskList.length})</option>
                <option value="UPCOMING">Upcoming</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="PENDING">Pending</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="DONE">Done</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="RESCHEDULED">Rescheduled</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="text-[11px] font-bold text-gray-600 block mb-1">Priority</label>
              <select
                value={priorityFilter}
                onChange={e => setPriorityFilter(e.target.value)}
                className="input w-full p-2 text-xs border border-gray-200 rounded-xl bg-white font-semibold"
              >
                <option value="ALL">All Priorities</option>
                <option value="CRITICAL">🔴 Critical</option>
                <option value="HIGH">🟠 High</option>
                <option value="MEDIUM">🟡 Medium</option>
                <option value="LOW">⚪ Low</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW 1: TABLE VIEW ────────────────────────────────────── */}
      {viewMode === 'TABLE' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-slate-50/80 text-gray-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Task & Linked CRM Entity</th>
                  <th className="py-3.5 px-3">Category</th>
                  <th className="py-3.5 px-3">Priority</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-3">Due Date</th>
                  <th className="py-3.5 px-3">Assignee</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-gray-400">
                      No matching tasks found. Adjust your search or filters.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map(task => {
                    const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.IN_PROGRESS;
                    const isDone = task.status === 'DONE';
                    const isCancelled = task.status === 'CANCELLED';

                    return (
                      <tr
                        key={task.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isDone ? 'bg-slate-50/30 opacity-70' : isCancelled ? 'bg-rose-50/20 opacity-60' : ''
                        }`}
                      >
                        {/* Title & Entity */}
                        <td className="py-3 px-4 max-w-xs">
                          <div className="space-y-0.5">
                            <p className={`font-bold text-gray-900 ${isDone ? 'line-through text-gray-500' : ''}`}>
                              {task.title}
                            </p>
                            {task.entityName && (
                              <p className="text-[11px] text-primary-700 font-semibold flex items-center gap-1">
                                🔗 {task.entityName}
                              </p>
                            )}
                            {task.cancelReason && (
                              <p className="text-[10px] text-rose-600 font-medium">
                                ❌ Cancelled: {task.cancelReason}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3 px-3">
                          <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                            {task.category || 'General'}
                          </span>
                        </td>

                        {/* Priority with Quick Change dropdown */}
                        <td className="py-3 px-3">
                          <select
                            disabled={isViewOnly}
                            value={task.priority || 'MEDIUM'}
                            onChange={e => handleQuickPriorityChange(task.id, e.target.value)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-pointer ${
                              task.priority === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              task.priority === 'HIGH' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              task.priority === 'MEDIUM' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            <option value="CRITICAL">🔴 Critical</option>
                            <option value="HIGH">🟠 High</option>
                            <option value="MEDIUM">🟡 Medium</option>
                            <option value="LOW">⚪ Low</option>
                          </select>
                        </td>

                        {/* Status with Quick Change dropdown */}
                        <td className="py-3 px-3">
                          <select
                            disabled={isViewOnly}
                            value={task.status}
                            onChange={e => handleQuickStatusChange(task.id, e.target.value)}
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border cursor-pointer ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                          >
                            <option value="UPCOMING">Upcoming</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="PENDING">Pending</option>
                            <option value="ON_HOLD">On Hold</option>
                            <option value="DONE">Done</option>
                            <option value="CANCELLED">Cancelled</option>
                            <option value="RESCHEDULED">Rescheduled</option>
                          </select>
                        </td>

                        {/* Due Date */}
                        <td className="py-3 px-3">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-semibold text-gray-800">
                              {task.dueDate ? format(new Date(task.dueDate), 'dd MMM yyyy') : '—'}
                            </span>
                            {task.timeRequired && (
                              <span className="text-[10px] text-gray-400">⏱ {task.timeRequired}</span>
                            )}
                          </div>
                        </td>

                        {/* Assignee */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 font-bold text-[10px] flex items-center justify-center">
                              {task.assignedToName?.[0] || 'U'}
                            </div>
                            <span className="text-xs text-gray-700">{task.assignedToName || 'Self'}</span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!isViewOnly && !isDone && (
                              <button
                                type="button"
                                title="Mark as Done"
                                onClick={() => handleQuickStatusChange(task.id, 'DONE')}
                                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {!isViewOnly && (
                              <>
                                <button
                                  type="button"
                                  title="Reschedule Task"
                                  onClick={() => handleOpenActionModal(task, 'RESCHEDULE')}
                                  className="p-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors cursor-pointer"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  title="Cancel Task"
                                  onClick={() => handleOpenActionModal(task, 'CANCEL')}
                                  className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              title="Edit Details / Discussion"
                              onClick={() => { setEditingTask(task); setIsTaskModalOpen(true); }}
                              className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── VIEW 2: KANBAN BOARD ──────────────────────────────────── */}
      {viewMode === 'KANBAN' && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {KANBAN_LANES.map(lane => {
            const laneTasks = filteredTasks.filter(t => {
              if (lane.altMatch) {
                return lane.altMatch.includes(t.status);
              }
              return t.status === lane.key;
            });

            return (
              <div
                key={lane.key}
                className={`bg-slate-50/90 rounded-2xl border border-slate-200 p-3 space-y-3 flex flex-col min-h-[550px] border-t-4 ${lane.color}`}
              >
                {/* Lane Header */}
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                    {lane.title}
                  </h3>
                  <span className="text-[10px] font-bold text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                    {laneTasks.length}
                  </span>
                </div>

                {/* Lane Task Cards */}
                <div className="space-y-2.5 flex-1 overflow-y-auto custom-scrollbar">
                  {laneTasks.length === 0 ? (
                    <div className="h-32 flex items-center justify-center border border-dashed border-gray-200 rounded-xl text-[11px] text-gray-400">
                      No tasks in this lane
                    </div>
                  ) : (
                    laneTasks.map(task => (
                      <div
                        key={task.id}
                        className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs hover:shadow-sm transition-all space-y-2 group"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            task.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-700' :
                            task.priority === 'HIGH' ? 'bg-amber-100 text-amber-700' :
                            task.priority === 'MEDIUM' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {task.priority || 'MEDIUM'}
                          </span>

                          <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {task.timeRequired || '30m'}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-gray-900 leading-snug">
                          {task.title}
                        </h4>

                        {task.entityName && (
                          <p className="text-[11px] text-primary-700 font-semibold truncate">
                            🔗 {task.entityName}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[10px] text-gray-400">
                          <span className="flex items-center gap-1 font-medium">
                            <Calendar className="w-3 h-3" />
                            {task.dueDate ? format(new Date(task.dueDate), 'dd MMM') : '—'}
                          </span>

                          <div className="flex items-center gap-1">
                            {task.comments && task.comments.length > 0 && (
                              <span className="flex items-center gap-0.5 text-primary-700 font-bold">
                                <MessageSquare className="w-3 h-3" /> {task.comments.length}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => { setEditingTask(task); setIsTaskModalOpen(true); }}
                              className="p-1 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Exhaustive Task / Activity Modal */}
      <ExhaustiveTaskActivityModal
        isOpen={isTaskModalOpen}
        onClose={() => { setIsTaskModalOpen(false); setEditingTask(null); }}
        onSave={handleSaveTask}
        employeesList={employeesList}
        initialTask={editingTask}
      />

      {/* Task Action Modal (Cancel / Reschedule) */}
      <TaskActionModal
        isOpen={actionModalState.isOpen}
        onClose={() => setActionModalState(prev => ({ ...prev, isOpen: false }))}
        actionType={actionModalState.type}
        task={actionModalState.task}
        onConfirm={handleActionConfirm}
      />

    </div>
  );
}
