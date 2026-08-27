import React, { useState } from 'react';
import { 
  AlertTriangle, Clock, CheckCircle, ChevronDown, 
  ChevronUp, ArrowRight, ShieldAlert, HeartPulse, CreditCard, ListTodo, Phone, MessageSquare 
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface OverdueItem {
  id: string;
  type: 'TASK' | 'RENEWAL' | 'INSTALLMENT' | 'PHC';
  title: string;
  entityName: string;
  contactPhone?: string;
  dueText: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

const DEFAULT_OVERDUE_ITEMS: OverdueItem[] = [
  {
    id: 'ov-1',
    type: 'TASK',
    title: 'Customer Verification & Document Upload for Policy #POL-8902',
    entityName: 'Sunita Patil',
    contactPhone: '+91 98230 11223',
    dueText: 'Overdue by 1 day',
    severity: 'CRITICAL'
  },
  {
    id: 'ov-2',
    type: 'RENEWAL',
    title: 'Care Supreme Health Policy Renewal (₹24,500)',
    entityName: 'Mehta Family (Care Health)',
    contactPhone: '+91 99887 76655',
    dueText: 'Grace period ends in 24 hrs',
    severity: 'CRITICAL'
  },
  {
    id: 'ov-3',
    type: 'INSTALLMENT',
    title: 'Quarterly EMI Collection (Installment 3/4 — ₹18,000)',
    entityName: 'Dr. Anand Joshi (HDFC Ergo)',
    contactPhone: '+91 98765 43210',
    dueText: 'Overdue by 2 days',
    severity: 'HIGH'
  },
  {
    id: 'ov-4',
    type: 'PHC',
    title: 'Annual Preventive Health Checkup Scheduling',
    entityName: 'Kavita Verma (Star Health Optima)',
    contactPhone: '+91 91234 56789',
    dueText: 'Pending for 3 days',
    severity: 'MEDIUM'
  }
];

export default function OverdueWorkPanel({ items = DEFAULT_OVERDUE_ITEMS }: { items?: OverdueItem[] }) {
  const [isOpen, setIsOpen] = useState(true);

  if (!items || items.length === 0) return null;

  const criticalCount = items.filter(i => i.severity === 'CRITICAL').length;

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
                Action Required — Overdue &amp; Critical Items
              </h4>
              <span className="text-[10px] font-black bg-rose-600 text-white px-2 py-0.2 rounded-full shadow-2xs">
                {items.length} Items ({criticalCount} Critical)
              </span>
            </div>
            <p className="text-[11px] text-rose-700 font-medium">
              Immediate follow-up required to protect policy grace periods and SLA commitments
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-rose-800 hidden sm:inline">
            {isOpen ? 'Collapse' : 'View Overdue Items'}
          </span>
          <button type="button" className="p-1 rounded-lg text-rose-700 hover:bg-rose-200/50 transition-colors">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="p-3 sm:p-4 pt-1 divide-y divide-rose-100 space-y-2">
          {items.map((item) => (
            <div 
              key={item.id}
              className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 group"
            >
              <div className="flex items-start gap-2.5">
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider mt-0.5 shrink-0 ${
                  item.type === 'TASK' ? 'bg-slate-800 text-white' :
                  item.type === 'RENEWAL' ? 'bg-rose-600 text-white' :
                  item.type === 'INSTALLMENT' ? 'bg-purple-700 text-white' :
                  'bg-teal-700 text-white'
                }`}>
                  {item.type}
                </span>

                <div>
                  <p className="text-xs font-bold text-slate-900 group-hover:text-rose-900 transition-colors">
                    {item.title}
                  </p>
                  <p className="text-[11px] text-slate-600 font-medium mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-800">👤 {item.entityName}</span>
                    <span className="text-rose-700 font-bold bg-rose-100/80 px-1.5 py-0.2 rounded text-[10px]">
                      ⏱ {item.dueText}
                    </span>
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                {item.contactPhone && (
                  <>
                    <button
                      type="button"
                      onClick={() => toast.success(`Calling ${item.entityName} (${item.contactPhone})...`)}
                      className="p-1.5 rounded-lg bg-white border border-rose-200 text-rose-700 hover:bg-rose-100/70 transition-colors cursor-pointer text-xs font-bold flex items-center gap-1"
                      title="Direct Call"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(`https://wa.me/${item.contactPhone?.replace(/[^0-9]/g, '')}?text=Hi%20${encodeURIComponent(item.entityName)},%20urgent%20follow-up%20regarding%20${encodeURIComponent(item.title)}...`, '_blank')}
                      className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer text-xs font-bold flex items-center gap-1"
                      title="WhatsApp Urgent Reminder"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => toast.success(`Marked "${item.title}" resolved!`)}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Resolve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
