import React, { useState, useMemo } from 'react';
import { 
  Phone, MessageSquare, CheckCircle2, Clock, 
  ListTodo, CheckSquare, Sparkles, Filter 
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export interface QueueItem {
  id: string;
  title: string;
  subtitle?: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  dueText: string;
  contactName?: string;
  contactPhone?: string;
  isCompleted?: boolean;
  status?: string;
  timeRequired?: string;
}

const DEFAULT_QUEUE_MOCK: QueueItem[] = [
  {
    id: 'q-1',
    title: 'Follow up on Star Health ₹10L Comprehensive Quotation',
    subtitle: 'Amit Sharma (+91 98765 43210) — Lead follow-up closing today',
    priority: 'CRITICAL',
    category: 'Sales',
    dueText: 'Closing by 2:00 PM Today',
    contactName: 'Amit Sharma (Lead #LD-4091)',
    contactPhone: '+91 98765 43210',
    timeRequired: '30m'
  },
  {
    id: 'q-2',
    title: 'Submit KYC & Medical Verification for Policy #POL-8902',
    subtitle: 'Sunita Patil — HDFC Ergo Optima Secure medical test report submission',
    priority: 'HIGH',
    category: 'Operations',
    dueText: 'Closing by 4:30 PM Today',
    contactName: 'Sunita Patil (Policy #POL-8902)',
    contactPhone: '+91 98230 11223',
    timeRequired: '45m'
  },
  {
    id: 'q-3',
    title: 'Collect Care Supreme Renewal Premium (₹24,500)',
    subtitle: 'Rajesh Mehta — Grace period policy renewal payment link confirmation',
    priority: 'HIGH',
    category: 'Renewals',
    dueText: 'Closing Today',
    contactName: 'Rajesh Mehta (Care Supreme)',
    contactPhone: '+91 99887 76655',
    timeRequired: '20m'
  },
  {
    id: 'q-4',
    title: 'In-person meeting: Corporate Group Health Pitch',
    subtitle: 'Apex Technologies HR Director — 50 lives group insurance quote',
    priority: 'MEDIUM',
    category: 'Client Visit',
    dueText: 'Scheduled 11:30 AM Today',
    contactName: 'Apex Technologies (CON-902)',
    contactPhone: '+91 97654 32109',
    timeRequired: '60m'
  },
  {
    id: 'q-5',
    title: 'Verify Bajaj Allianz Motor Damage Survey Estimate',
    subtitle: 'Garage estimate ₹38,000 for vehicle MH-12-AB-4321 survey approval',
    priority: 'MEDIUM',
    category: 'Claims',
    dueText: 'Closing by 5:00 PM Today',
    contactName: 'Vikrant Desai (Claim #CLM-1029)',
    contactPhone: '+91 91234 56789',
    timeRequired: '40m'
  }
];

interface TodaysQueueProps {
  tasks?: any[];
  onToggleTask?: (taskId: string, currentStatus: string) => void;
  isViewOnly?: boolean;
}

export default function TodaysPriorities({ tasks = [], onToggleTask, isViewOnly = false }: TodaysQueueProps) {
  const [localCompletedMap, setLocalCompletedMap] = useState<Record<string, boolean>>({});

  // Merge live tasks closing today with mock items if empty
  const closingTodayList = useMemo(() => {
    if (tasks && tasks.length > 0) {
      return tasks.map(t => {
        const isDone = t.status === 'COMPLETED' || t.status === 'DONE' || !!localCompletedMap[t.id];
        let dueLabel = 'Closing Today';
        if (t.dueDate) {
          try {
            const d = new Date(t.dueDate);
            dueLabel = `Due ${format(d, 'hh:mm a')}`;
          } catch {
            dueLabel = 'Closing Today';
          }
        }
        return {
          id: t.id,
          title: t.title,
          subtitle: t.description || t.entityName || '',
          priority: t.priority || 'MEDIUM',
          category: t.category || 'Task',
          dueText: dueLabel,
          contactName: t.entityName || t.contactName || '',
          contactPhone: t.contactPhone || '+91 98765 43210',
          isCompleted: isDone,
          status: t.status,
          timeRequired: t.timeRequired || '30m'
        };
      });
    }
    return DEFAULT_QUEUE_MOCK.map(m => ({
      ...m,
      isCompleted: !!localCompletedMap[m.id]
    }));
  }, [tasks, localCompletedMap]);

  const handleComplete = (id: string, currentStatus?: string) => {
    if (isViewOnly) return;
    if (onToggleTask) {
      onToggleTask(id, currentStatus || 'PENDING');
    }
    setLocalCompletedMap(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
    toast.success('Task status updated');
  };

  const handleAction = (type: string, item: QueueItem) => {
    if (type === 'call') {
      toast.success(`Initiating dialer for ${item.contactName || 'Customer'} (${item.contactPhone})...`);
    } else if (type === 'whatsapp') {
      window.open(`https://wa.me/${item.contactPhone?.replace(/[^0-9]/g, '')}?text=Hi%20${encodeURIComponent(item.contactName || '')},%20regarding%20your%20insurance%20task...`, '_blank');
    } else {
      toast.success(`Action "${type}" triggered`);
    }
  };

  const pendingCount = closingTodayList.filter(p => !p.isCompleted).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden space-y-0">
      {/* Table Header / Summary Bar */}
      <div className="p-4 bg-slate-50/70 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <ListTodo className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
              Today's Queue — Tasks Closing Today
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200">
                {pendingCount} Pending
              </span>
            </h3>
            <p className="text-[11px] text-gray-500">
              Tabular overview of committed deliverables and client actions closing today
            </p>
          </div>
        </div>
      </div>

      {/* Tabular List of Tasks */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-slate-50/50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              <th className="py-3 px-4 w-12 text-center">Status</th>
              <th className="py-3 px-4 w-28">Priority</th>
              <th className="py-3 px-4">Task & Linked Entity</th>
              <th className="py-3 px-4 w-36">Category</th>
              <th className="py-3 px-4 w-36">Closing / Due</th>
              <th className="py-3 px-4 w-24">Est. Time</th>
              <th className="py-3 px-4 w-36 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {closingTodayList.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-gray-400 font-medium">
                  No tasks or deliverables closing today.
                </td>
              </tr>
            ) : (
              closingTodayList.map((item) => (
                <tr
                  key={item.id}
                  className={`transition-colors hover:bg-slate-50/80 ${
                    item.isCompleted ? 'bg-slate-50/40 opacity-60' : ''
                  }`}
                >
                  {/* Status Checkbox */}
                  <td className="py-3 px-4 text-center">
                    {!isViewOnly ? (
                      <button
                        type="button"
                        onClick={() => handleComplete(item.id, item.status)}
                        className={`transition-colors cursor-pointer ${
                          item.isCompleted ? 'text-emerald-600' : 'text-gray-300 hover:text-primary-600'
                        }`}
                        title={item.isCompleted ? 'Mark Pending' : 'Mark Done'}
                      >
                        <CheckSquare className="w-4 h-4" />
                      </button>
                    ) : (
                      <CheckSquare className={`w-4 h-4 mx-auto ${item.isCompleted ? 'text-emerald-600' : 'text-gray-300'}`} />
                    )}
                  </td>

                  {/* Priority */}
                  <td className="py-3 px-4">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      item.priority === 'CRITICAL' ? 'bg-rose-600 text-white' :
                      item.priority === 'HIGH' ? 'bg-amber-500 text-white' :
                      item.priority === 'LOW' ? 'bg-slate-500 text-white' :
                      'bg-blue-600 text-white'
                    }`}>
                      {item.priority}
                    </span>
                  </td>

                  {/* Task & Linked Entity */}
                  <td className="py-3 px-4 max-w-xs md:max-w-md">
                    <p className={`font-bold ${item.isCompleted ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                      {item.title}
                    </p>
                    {item.contactName && (
                      <p className="text-[11px] text-primary-700 font-semibold mt-0.5 flex items-center gap-1">
                        <span>🔗</span> {item.contactName}
                      </p>
                    )}
                    {item.subtitle && item.subtitle !== item.contactName && (
                      <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">
                        {item.subtitle}
                      </p>
                    )}
                  </td>

                  {/* Category */}
                  <td className="py-3 px-4">
                    {item.category && (
                      <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
                        {item.category}
                      </span>
                    )}
                  </td>

                  {/* Closing / Due */}
                  <td className="py-3 px-4">
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-1 rounded-md border border-amber-200 flex items-center gap-1 w-fit">
                      <Clock className="w-3 h-3 text-amber-600" />
                      {item.dueText}
                    </span>
                  </td>

                  {/* Est. Time */}
                  <td className="py-3 px-4 text-gray-500 font-semibold">
                    {item.timeRequired || '30m'}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {item.contactPhone && !item.isCompleted && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleAction('call', item)}
                            title={`Call ${item.contactName}`}
                            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors cursor-pointer"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAction('whatsapp', item)}
                            title={`WhatsApp ${item.contactName}`}
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      {!isViewOnly && (
                        <button
                          type="button"
                          onClick={() => handleComplete(item.id, item.status)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            item.isCompleted 
                              ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' 
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {item.isCompleted ? 'Done' : 'Mark Done'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
