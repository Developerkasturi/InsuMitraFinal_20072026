import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, CheckCircle, ChevronDown, 
  ChevronUp, Phone, MessageSquare, ListTodo, User, Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';
import { isPast, differenceInDays } from 'date-fns';

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
    priority: 'CRITICAL',
    status: 'IN_PROGRESS'
  },
  {
    id: 'T4',
    taskId: 'T4',
    title: 'Client proposal meeting with Apex Technologies HR Director',
    category: 'Customer Meeting / Field Visit',
    assignedToName: 'Vikram Singhania',
    entityName: 'Apex Technologies (CON-902)',
    contactPhone: '+91 98765 43210',
    dueText: 'Overdue by 2 days',
    priority: 'HIGH',
    status: 'PENDING'
  },
  {
    id: 'T6',
    taskId: 'T6',
    title: 'Submit physical claim discharge voucher to Star Health branch',
    category: 'Claims Assistance & Survey',
    assignedToName: 'Anjali Nair',
    entityName: 'Vikrant Desai (#CLM-1029)',
    contactPhone: '+91 91234 56789',
    dueText: 'Overdue by 3 days',
    priority: 'HIGH',
    status: 'IN_PROGRESS'
  },
  {
    id: 'T7',
    taskId: 'T7',
    title: 'Cross-sell super top-up floater presentation to High Net-worth Client',
    category: 'Sales & Lead Generation',
    assignedToName: 'Sneha Deshmukh',
    entityName: 'Dr. Anand Joshi',
    contactPhone: '+91 99887 76655',
    dueText: 'Overdue by 4 days',
    priority: 'MEDIUM',
    status: 'PENDING'
  }
];

interface OverdueWorkPanelProps {
  tasks?: any[];
  onToggleTask?: (taskId: string, currentStatus: string) => void;
  isViewOnly?: boolean;
}

export default function OverdueWorkPanel({
  tasks,
  onToggleTask,
  isViewOnly = false
}: OverdueWorkPanelProps) {
  const [isOpen, setIsOpen] = useState(true);

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
        return {
          id: t.id || `T${idx + 1}`,
          taskId: t.taskId || t.taskNumber || `T${idx + 1}`,
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
    <div className="bg-rose-50/50 border border-rose-200/80 rounded-2xl overflow-hidden shadow-xs transition-all">
      {/* Header Banner */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 sm:p-4 flex items-center justify-between cursor-pointer select-none bg-rose-100/40 hover:bg-rose-100/60 transition-colors"
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
              <span className="text-[10px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-full shadow-2xs">
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
          <button type="button" className="p-1 rounded-lg text-rose-700 hover:bg-rose-200/50 transition-colors">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="p-3 sm:p-4 pt-1 divide-y divide-rose-100 space-y-2">
          {overdueTasks.length === 0 ? (
            <div className="py-6 text-center text-xs font-bold text-rose-600">
              No overdue tasks! All tasks are on schedule.
            </div>
          ) : (
            overdueTasks.map((task) => {
              const taskIdDisplay = task.taskId || task.id;
              return (
                <div 
                  key={task.id}
                  className="pt-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    {/* Task ID Badge */}
                    <span className="font-mono text-xs font-black text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md mt-0.5 shrink-0 shadow-2xs">
                      {taskIdDisplay}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-bold text-slate-900 group-hover:text-rose-900 transition-colors">
                          {task.title}
                        </p>
                        <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider ${
                          task.priority === 'CRITICAL' ? 'bg-red-600 text-white' :
                          task.priority === 'HIGH' ? 'bg-amber-500 text-white' :
                          'bg-slate-600 text-white'
                        }`}>
                          {task.priority}
                        </span>
                        {task.category && (
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                            {task.category}
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-600 font-medium mt-1 flex flex-wrap items-center gap-2.5">
                        {task.entityName && (
                          <span className="font-bold text-slate-800 flex items-center gap-1">
                            <span className="text-slate-400 font-normal">Related:</span> {task.entityName}
                          </span>
                        )}
                        {task.assignedToName && (
                          <span className="text-slate-600 flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" /> {task.assignedToName}
                          </span>
                        )}
                        <span className="text-rose-700 font-bold bg-rose-100/90 px-1.5 py-0.2 rounded text-[10px] flex items-center gap-1 border border-rose-200">
                          ⏱ {task.dueText || 'Overdue'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  {!isViewOnly && (
                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
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
                        onClick={() => {
                          if (onToggleTask) {
                            onToggleTask(task.id, task.status || 'PENDING');
                          } else {
                            toast.success(`Task [${taskIdDisplay}] marked as resolved!`);
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Complete Task
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
