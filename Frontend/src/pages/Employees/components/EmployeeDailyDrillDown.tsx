import React from 'react';
import { 
  Clock, X, CheckCircle2, User, Calendar, 
  TrendingUp, CreditCard, HeartPulse, FileCheck2, RefreshCw, IndianRupee, ShieldCheck 
} from 'lucide-react';
import { format } from 'date-fns';

export interface DailyDrillDownRecord {
  date: string;
  employeeId: string;
  employeeName: string;
  designation: string;
  department: string;
  attendanceStatus: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'LEAVE';
  clockInTime: string;
  clockOutTime: string;
  breakDuration: string;
  netWorkingHours: string;
  tasksCompleted: number;
  leadMovements: number;
  installmentsClosed: number;
  phcsCompleted: number;
  claimsHandled: number;
  renewalsClosed: number;
  premiumGenerated: number;
  eodNotes?: string;
  nextDayPlan?: string;
  timelineEvents: {
    id: string;
    time: string;
    duration?: string;
    title: string;
    category: string;
    outcome?: string;
    isAutoCaptured?: boolean;
    isBreak?: boolean;
  }[];
}

interface EmployeeDailyDrillDownProps {
  isOpen: boolean;
  onClose: () => void;
  record: DailyDrillDownRecord | null;
}

export default function EmployeeDailyDrillDown({ isOpen, onClose, record }: EmployeeDailyDrillDownProps) {
  if (!isOpen || !record) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-scale-in">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              {record.employeeName[0] || 'E'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  {record.employeeName}
                </h3>
                <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.2 rounded-md">
                  {record.designation}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Date: <span className="font-bold text-slate-700">{record.date}</span>
                <span>•</span>
                <span>Dept: {record.department}</span>
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 custom-scrollbar">
          
          {/* Shift Time & Break Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Clock-In / Out</span>
              <span className="text-xs font-black text-slate-800 font-mono">
                {record.clockInTime} – {record.clockOutTime}
              </span>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Breaks (Deducted)</span>
              <span className="text-xs font-black text-amber-700 font-mono">
                {record.breakDuration}
              </span>
            </div>

            <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-200">
              <span className="text-[10px] font-bold text-emerald-600 block uppercase">Net Productive Time</span>
              <span className="text-xs font-black text-emerald-900 font-mono">
                {record.netWorkingHours}
              </span>
            </div>

            <div className="bg-blue-50/60 p-2.5 rounded-xl border border-blue-200">
              <span className="text-[10px] font-bold text-blue-600 block uppercase">Attendance Status</span>
              <span className="text-xs font-black text-blue-900">
                {record.attendanceStatus}
              </span>
            </div>
          </div>

          {/* Daily Deliverables Counter Strip */}
          <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80">
            <h4 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-2">
              Deliverables Completed on {record.date}
            </h4>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
              <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                <span className="text-base font-black text-slate-800 block">{record.tasksCompleted}</span>
                <span className="text-[10px] text-slate-500 font-semibold">Tasks Done</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                <span className="text-base font-black text-blue-800 block">{record.leadMovements}</span>
                <span className="text-[10px] text-slate-500 font-semibold">Leads Moved</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                <span className="text-base font-black text-purple-800 block">{record.installmentsClosed}</span>
                <span className="text-[10px] text-slate-500 font-semibold">EMIs Closed</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                <span className="text-base font-black text-rose-800 block">{record.phcsCompleted}</span>
                <span className="text-[10px] text-slate-500 font-semibold">PHC Checkups</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                <span className="text-base font-black text-amber-800 block">{record.claimsHandled}</span>
                <span className="text-[10px] text-slate-500 font-semibold">Claims Handled</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                <span className="text-base font-black text-emerald-800 block">₹{(record.premiumGenerated / 1000).toFixed(0)}k</span>
                <span className="text-[10px] text-slate-500 font-semibold">Premium (₹)</span>
              </div>
            </div>
          </div>

          {/* Activity Event Timeline */}
          <div>
            <h4 className="text-xs font-extrabold text-slate-800 mb-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" /> Chronological Daily Audit Trail
            </h4>

            <div className="relative pl-5 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 text-xs">
              {record.timelineEvents && record.timelineEvents.length > 0 ? (
                record.timelineEvents.map((ev) => (
                  <div key={ev.id} className="relative">
                    <div className={`absolute -left-5 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs ${
                      ev.isBreak ? 'bg-amber-400' :
                      ev.isAutoCaptured ? 'bg-emerald-500' : 'bg-blue-600'
                    }`} />
                    
                    <div className={`p-2.5 rounded-xl border ${
                      ev.isBreak ? 'bg-amber-50/40 border-amber-200/80' : 'bg-slate-50 border-slate-200/80'
                    }`}>
                      <div className="flex items-center justify-between text-[11px] mb-0.5">
                        <span className="font-bold text-slate-800 font-mono">{ev.time}</span>
                        <div className="flex items-center gap-1">
                          {ev.isAutoCaptured && (
                            <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                              ⚡ CRM Auto-Event
                            </span>
                          )}
                          <span className="text-[9px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded">
                            {ev.category}
                          </span>
                        </div>
                      </div>
                      <p className="font-semibold text-slate-900">{ev.title}</p>
                      {ev.outcome && (
                        <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
                          ✓ {ev.outcome}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">No detailed events logged for this date.</p>
              )}
            </div>
          </div>

          {/* EOD Remarks & Next Day Plan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 block uppercase mb-1">
                EOD Accomplishments &amp; Remarks
              </span>
              <p className="text-xs text-slate-700 whitespace-pre-wrap font-medium">
                {record.eodNotes || 'No notes submitted for this shift.'}
              </p>
            </div>

            <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200/80">
              <span className="text-[10px] font-bold text-purple-700 block uppercase mb-1">
                Next Day Working Plan
              </span>
              <p className="text-xs text-purple-900 whitespace-pre-wrap font-medium">
                {record.nextDayPlan || 'No next-day plan recorded.'}
              </p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-medium">
            Record ID: <span className="font-mono text-slate-700">{record.employeeId}-{record.date}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Close Drill-Down
          </button>
        </div>

      </div>
    </div>
  );
}
