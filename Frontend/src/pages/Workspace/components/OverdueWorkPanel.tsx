import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, CheckCircle, ChevronDown, 
  ChevronUp, Phone, MessageSquare, ListTodo, User, Calendar, Pencil
} from 'lucide-react';
import toast from 'react-hot-toast';
import { isPast, differenceInDays, format } from 'date-fns';
import ExhaustiveTaskActivityModal, { STATUS_CONFIG } from './ExhaustiveTaskActivityModal';
import clsx from 'clsx';

export interface OverdueTaskItem {
  id: string;
  taskId?: string;
  title: string;
  category?: string;
  assignedToName?: string;
  entityName?: string;
  contactPhone?: string;
  dueText?: string;
  dueDate?: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status?: string;
}

const DEFAULT_OVERDUE_TASKS: OverdueTaskItem[] = [
  {
    id: 'T1',
    taskId: 'T1',
    title: 'Customer Verification & KYC Document Upload for Policy #POL-8902',
    category: 'Document Collection & KYC',
    assignedToName: 'Rahul Sharma',
    entityName: 'Sunita Patil (#POL-8902)',
    contactPhone: '+91 98230 11223',
    dueText: 'Overdue by 1 day',
    dueDate: new Date(Date.now() - 86400000).toISOString(),
    priority: 'CRITICAL',
    status: 'IN_PROGRESS'
  },
  {
    id: 'T2',
    taskId: 'T2',
    title: 'Client proposal meeting with Apex Technologies HR Director',
    category: 'Customer Meeting / Field Visit',
    assignedToName: 'Vikram Singhania',
    entityName: 'Apex Technologies (CON-902)',
    contactPhone: '+91 98765 43210',
    dueText: 'Overdue by 2 days',
    dueDate: new Date(Date.now() - 86400000 * 2).toISOString(),
    priority: 'HIGH',
    status: 'PENDING'
  },
  {
    id: 'T3',
    taskId: 'T3',
    title: 'Submit physical claim discharge voucher to Star Health branch',
    category: 'Claims Assistance & Survey',
    assignedToName: 'Anjali Nair',
    entityName: 'Vikrant Desai (#CLM-1029)',
    contactPhone: '+91 91234 56789',
    dueText: 'Overdue by 3 days',
    dueDate: new Date(Date.now() - 86400000 * 3).toISOString(),
    priority: 'HIGH',
    status: 'IN_PROGRESS'
  },
  {
    id: 'T4',
    taskId: 'T4',
    title: 'Cross-sell super top-up floater presentation to High Net-worth Client',
    category: 'Sales & Lead Generation',
    assignedToName: 'Sneha Deshmukh',
    entityName: 'Dr. Anand Joshi',
    contactPhone: '+91 99887 76655',
    dueText: 'Overdue by 4 days',
    dueDate: new Date(Date.now() - 86400000 * 4).toISOString(),
    priority: 'MEDIUM',
    status: 'PENDING'
  }
];

interface OverdueWorkPanelProps {
  tasks?: any[];
  employeesList?: any[];
  onToggleTask?: (taskId: string, currentStatus: string) => void;
  onAddTask?: (taskPayload: any) => void;
  isViewOnly?: boolean;
}

export default function OverdueWorkPanel({
  tasks,
  employeesList = [],
  onToggleTask,
  onAddTask,
  isViewOnly = false
}: OverdueWorkPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);

  // Compute overdue tasks from provided tasks array or fallback to default sample tasks
  const overdueTasks: OverdueTaskItem[] = useMemo(() => {
    if (tasks && tasks.length > 0) {
      const filtered = tasks.filter((t: any) => {
        const isNotDone = t.status !== 'COMPLETED' && t.status !== 'DONE';
        if (!isNotDone) return false;
        
        if (t.dueDate) {
          const d = new Date(t.dueDate);
          if (!isNaN(d.getTime())) {
            return isPast(d);
          }
        }
        return t.priority === 'CRITICAL' || t.status === 'OVERDUE';
      }).map((t: any, idx: number) => {
        let dueText = 'Overdue';
        if (t.dueDate) {
          const d = new Date(t.dueDate);
          if (!isNaN(d.getTime())) {
            const diff = differenceInDays(new Date(), d);
            dueText = diff > 0 ? `Overdue by ${diff} day${diff > 1 ? 's' : ''}` : 'Due past deadline';
          }
        }
        const cleanId = (t.taskId && /^T\d+$/i.test(String(t.taskId).trim()))
          ? String(t.taskId).trim().toUpperCase()
          : (t.taskNumber && /^T\d+$/i.test(String(t.taskNumber).trim()))
            ? String(t.taskNumber).trim().toUpperCase()
            : `T${idx + 1}`;

        return {
          id: t.id || `t-overdue-${idx + 1}`,
          taskId: cleanId,
          title: t.title,
          category: t.category || 'General Task',
          assignedToName: t.assignedToName || t.assignedTo?.name || 'Assigned Agent',
          entityName: t.entityName || t.lead?.name || t.contact?.name || t.policy?.policyNumber,
          contactPhone: t.contactPhone || t.lead?.phone || t.contact?.phone || '+91 98230 11223',
          dueText,
          dueDate: t.dueDate,
          priority: t.priority || 'HIGH',
          status: t.status || 'PENDING'
        };
      });

      if (filtered.length > 0) return filtered;
    }
    return DEFAULT_OVERDUE_TASKS;
  }, [tasks]);

  const criticalCount = overdueTasks.filter(i => i.priority === 'CRITICAL').length;

  return (
    <div className="bg-white border border-rose-200/80 rounded-2xl overflow-hidden shadow-sm transition-all space-y-0">
      {/* Header Banner */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="p-3.5 sm:p-4 flex items-center justify-between cursor-pointer select-none bg-gradient-to-r from-rose-50 via-rose-50/70 to-white hover:bg-rose-100/60 transition-colors border-b border-rose-200/60"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shadow-xs">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-extrabold text-rose-900">
                Action Required — Overdue Tasks
              </h4>
              <span className="text-[10px] font-black bg-rose-600 text-white px-2.5 py-0.5 rounded-full shadow-2xs">
                {overdueTasks.length} Tasks ({criticalCount} Critical)
              </span>
            </div>
            <p className="text-[11px] text-rose-700 font-medium">
              Tasks past their scheduled deadline requiring immediate completion or rescheduling
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-rose-800 hidden sm:inline">
            {isOpen ? 'Collapse' : 'View Overdue Tasks'}
          </span>
          <button type="button" className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-200/50 transition-colors">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Table View (Similar to Today's Tasks Table) */}
      {isOpen && (
        <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1 max-h-[calc(100vh-280px)] bg-white">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 shadow-2xs">
              <tr className="bg-rose-100/70 border-b border-rose-200">
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-rose-900 whitespace-nowrap select-none border border-rose-200 w-24">
                  Task ID
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-rose-900 whitespace-nowrap select-none border border-rose-200">
                  Task Title
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-rose-900 whitespace-nowrap select-none border border-rose-200">
                  Linked CRM Entity
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-rose-900 whitespace-nowrap select-none border border-rose-200">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-rose-900 whitespace-nowrap select-none border border-rose-200">
                  Priority
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-rose-900 whitespace-nowrap select-none border border-rose-200">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-rose-900 whitespace-nowrap select-none border border-rose-200">
                  Due Date
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-rose-900 whitespace-nowrap select-none border border-rose-200">
                  Assignee
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-rose-900 whitespace-nowrap select-none border border-rose-200">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-100/60 font-medium text-gray-700 bg-white">
              {overdueTasks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center border border-rose-200">
                    <div className="flex flex-col items-center gap-2 text-rose-600">
                      <CheckCircle size={28} className="text-emerald-500" />
                      <p className="text-sm font-bold">No overdue tasks! All tasks are on schedule.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                overdueTasks.map((task, idx) => {
                  const taskIdDisplay = (task.taskId && /^T\d+$/i.test(String(task.taskId).trim()))
                    ? String(task.taskId).trim().toUpperCase()
                    : `T${idx + 1}`;
                  const statusCfg = STATUS_CONFIG[task.status || ''] || STATUS_CONFIG.PENDING;

                  return (
                    <tr
                      key={task.id}
                      onClick={() => {
                        setSelectedTask(task);
                        setIsViewMode(true);
                        setIsModalOpen(true);
                      }}
                      className={clsx(
                        "transition-colors duration-150 hover:bg-rose-50/70 cursor-pointer group",
                        idx % 2 === 1 ? 'bg-rose-50/25' : 'bg-white'
                      )}
                    >
                      {/* 1. Task ID */}
                      <td className="px-4 py-3 text-gray-700 align-middle text-[13px] font-medium border border-rose-100 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded border border-blue-100/80 inline-block shadow-2xs">
                          {taskIdDisplay}
                        </span>
                      </td>

                      {/* 2. Task Title */}
                      <td className="px-4 py-3 text-gray-700 align-middle text-[13px] font-medium border border-rose-100 max-w-sm">
                        <p className="font-bold text-slate-900 leading-snug group-hover:text-rose-900 transition-colors">
                          {task.title}
                        </p>
                      </td>

                      {/* 3. Linked CRM Entity */}
                      <td className="px-4 py-3 text-gray-700 align-middle text-xs border border-rose-100 whitespace-nowrap">
                        {task.entityName ? (
                          <span className="font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
                            {task.entityName}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium italic">General</span>
                        )}
                      </td>

                      {/* 4. Category */}
                      <td className="px-4 py-3 text-gray-600 align-middle text-xs border border-rose-100 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-200">
                          {task.category || 'General'}
                        </span>
                      </td>

                      {/* 5. Priority */}
                      <td className="px-4 py-3 align-middle text-xs border border-rose-100 whitespace-nowrap">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          task.priority === 'CRITICAL' ? 'bg-red-600 text-white' :
                          task.priority === 'HIGH' ? 'bg-amber-500 text-white' :
                          task.priority === 'MEDIUM' ? 'bg-blue-600 text-white' :
                          'bg-slate-600 text-white'
                        }`}>
                          {task.priority}
                        </span>
                      </td>

                      {/* 6. Status */}
                      <td className="px-4 py-3 align-middle text-xs border border-rose-100 whitespace-nowrap">
                        <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border", statusCfg?.badge || 'bg-amber-50 text-amber-700 border-amber-200')}>
                          <span className={clsx("w-1.5 h-1.5 rounded-full", statusCfg?.dot || 'bg-amber-500')} />
                          {task.status?.replace(/_/g, ' ') || 'OVERDUE'}
                        </span>
                      </td>

                      {/* 7. Due Date / Overdue Text */}
                      <td className="px-4 py-3 text-gray-700 align-middle text-xs border border-rose-100 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          {task.dueDate && (
                            <span className="text-slate-600 font-semibold text-[11px]">
                              {format(new Date(task.dueDate), 'dd MMM yyyy')}
                            </span>
                          )}
                          <span className="text-rose-700 font-bold bg-rose-100/90 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 border border-rose-200 w-fit">
                            ⏱ {task.dueText || 'Overdue'}
                          </span>
                        </div>
                      </td>

                      {/* 8. Assignee */}
                      <td className="px-4 py-3 text-gray-700 align-middle text-xs border border-rose-100 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                          <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                            {task.assignedToName ? task.assignedToName[0] : 'U'}
                          </div>
                          <span>{task.assignedToName || 'Unassigned'}</span>
                        </div>
                      </td>

                      {/* 9. Actions */}
                      <td className="px-4 py-3 text-right align-middle text-xs border border-rose-100 whitespace-nowrap">
                        {!isViewOnly ? (
                          <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                            {task.contactPhone && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => toast.success(`Calling ${task.entityName || task.assignedToName} (${task.contactPhone})...`)}
                                  className="p-1.5 rounded-lg bg-white border border-rose-200 text-rose-700 hover:bg-rose-100/70 transition-colors cursor-pointer text-xs font-bold flex items-center gap-1"
                                  title="Direct Call"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => window.open(`https://wa.me/${task.contactPhone?.replace(/[^0-9]/g, '')}?text=Hi%20${encodeURIComponent(task.entityName || 'there')},%20urgent%20follow-up%20regarding%20task%20${encodeURIComponent(task.title)}...`, '_blank')}
                                  className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer text-xs font-bold flex items-center gap-1"
                                  title="WhatsApp Urgent Reminder"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              title="View & Edit Task Details"
                              onClick={() => {
                                setSelectedTask(task);
                                setIsViewMode(false);
                                setIsModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-white border border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer text-xs font-bold flex items-center gap-1"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (onToggleTask) {
                                  onToggleTask(task.id, task.status || 'PENDING');
                                } else {
                                  toast.success(`Task [${taskIdDisplay}] marked as resolved!`);
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> Complete
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">View Only</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Exhaustive Task / Activity Modal for Overdue Task View & Edit */}
      <ExhaustiveTaskActivityModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedTask(null); }}
        onSave={(updatedTask) => {
          if (onAddTask) onAddTask(updatedTask);
        }}
        employeesList={employeesList || []}
        initialTask={selectedTask}
        initialIsViewMode={isViewMode}
      />
    </div>
  );
}
