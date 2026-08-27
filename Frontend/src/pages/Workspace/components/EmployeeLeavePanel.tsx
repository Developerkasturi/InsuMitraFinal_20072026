import React, { useState, useEffect, useMemo } from 'react';
import { 
  Palmtree, Calendar, Clock, CheckCircle2, XCircle, AlertCircle, 
  Plus, Send, RefreshCw, Sun, Umbrella, HeartPulse, Sparkles, 
  User, Check, Trash2, CalendarDays, ArrowRight, ShieldCheck, 
  HelpCircle, Coffee, FileText, Ban
} from 'lucide-react';
import { format, differenceInDays, addDays, parseISO, isToday, isFuture, isPast } from 'date-fns';
import { useAuthStore } from '@store/auth.store';
import toast from 'react-hot-toast';
import { DatePicker } from '@comps/common/DatePicker';
import clsx from 'clsx';

export interface LeaveRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail?: string;
  leaveType: 'CASUAL' | 'SICK' | 'EARNED' | 'HALF_DAY' | 'UNPLANNED_ABSENCE';
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  daysCount: number;
  reason: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'CANCELLED';
  appliedAt: string;
  approvedBy?: string;
  adminRemarks?: string;
}

export const LEAVE_TYPE_CONFIG = {
  CASUAL: {
    label: 'Casual Leave (CL)',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: Sun,
    description: 'Personal errands, family events & general time-off',
    yearlyQuota: 12
  },
  SICK: {
    label: 'Sick / Medical Leave (SL)',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: HeartPulse,
    description: 'Medical appointments, illness & recovery',
    yearlyQuota: 8
  },
  EARNED: {
    label: 'Earned / Vacation Leave (EL)',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: Palmtree,
    description: 'Planned holidays, travel & annual vacations',
    yearlyQuota: 15
  },
  HALF_DAY: {
    label: 'Half Day Leave',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: Coffee,
    description: 'First half (9am-1pm) or Second half (2pm-6pm)',
    yearlyQuota: 6
  },
  UNPLANNED_ABSENCE: {
    label: 'Unplanned Absence',
    color: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: AlertCircle,
    description: 'Same-day urgent absence / emergency notification',
    yearlyQuota: 0
  }
};

const INITIAL_MOCK_LEAVES: LeaveRecord[] = [
  {
    id: 'leave-001',
    employeeId: 'emp-001',
    employeeName: 'Rahul Sharma',
    leaveType: 'CASUAL',
    startDate: '2026-08-14',
    endDate: '2026-08-15',
    daysCount: 2,
    reason: 'Family wedding ceremony in Pune',
    status: 'APPROVED',
    appliedAt: '2026-08-10',
    approvedBy: 'Agency Owner'
  },
  {
    id: 'leave-002',
    employeeId: 'emp-001',
    employeeName: 'Rahul Sharma',
    leaveType: 'SICK',
    startDate: '2026-08-02',
    endDate: '2026-08-02',
    daysCount: 1,
    reason: 'Viral fever and doctor rest recommendation',
    status: 'APPROVED',
    appliedAt: '2026-08-02',
    approvedBy: 'Agency Owner'
  },
  {
    id: 'leave-003',
    employeeId: 'emp-001',
    employeeName: 'Rahul Sharma',
    leaveType: 'EARNED',
    startDate: '2026-09-10',
    endDate: '2026-09-12',
    daysCount: 3,
    reason: 'Annual family festival visit',
    status: 'PENDING',
    appliedAt: '2026-08-25'
  }
];

interface EmployeeLeavePanelProps {
  employeeId?: string | null;
  employeeName?: string;
  isViewOnly?: boolean;
}

export default function EmployeeLeavePanel({
  employeeId,
  employeeName,
  isViewOnly = false
}: EmployeeLeavePanelProps) {
  const user = useAuthStore(s => s.user);
  const currentUserId = employeeId || user?.id || 'default_user';
  const displayName = employeeName || `${user?.firstName || 'User'} ${user?.lastName || ''}`.trim();

  const todayIso = format(new Date(), 'yyyy-MM-dd');
  const tomorrowIso = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  // Active form view: 'APPLY' (full leave) or 'MARK_ABSENCE' (fast 1-click absence)
  const [formMode, setFormMode] = useState<'MARK_ABSENCE' | 'APPLY_LEAVE'>('MARK_ABSENCE');

  // Quick Absence State
  const [absenceDateOption, setAbsenceDateOption] = useState<'TODAY' | 'TOMORROW' | 'CUSTOM'>('TODAY');
  const [customAbsenceDate, setCustomAbsenceDate] = useState(todayIso);
  const [absenceReasonCategory, setAbsenceReasonCategory] = useState('Feeling Unwell / Sick');
  const [absenceNote, setAbsenceNote] = useState('');

  // Full Leave Form State
  const [leaveType, setLeaveType] = useState<'CASUAL' | 'SICK' | 'EARNED' | 'HALF_DAY'>('CASUAL');
  const [startDate, setStartDate] = useState(todayIso);
  const [endDate, setEndDate] = useState(todayIso);
  const [halfDayShift, setHalfDayShift] = useState<'FIRST_HALF' | 'SECOND_HALF'>('FIRST_HALF');
  const [leaveReason, setLeaveReason] = useState('');

  // Leaves database stored in localStorage for instant synchronization across tabs
  const [leavesList, setLeavesList] = useState<LeaveRecord[]>(() => {
    try {
      const saved = localStorage.getItem('insumitra_employee_leaves');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_MOCK_LEAVES;
  });

  // Filter leaves for this specific employee
  const myLeaves = useMemo(() => {
    return leavesList.filter(l => l.employeeId === currentUserId || l.employeeName === displayName);
  }, [leavesList, currentUserId, displayName]);

  // Sync with cross-tab events
  useEffect(() => {
    const handleStorage = () => {
      try {
        const saved = localStorage.getItem('insumitra_employee_leaves');
        if (saved) setLeavesList(JSON.parse(saved));
      } catch (e) {}
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const saveLeaves = (updated: LeaveRecord[]) => {
    setLeavesList(updated);
    try {
      localStorage.setItem('insumitra_employee_leaves', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
  };

  // Calculate used leaves by type
  const usedStats = useMemo(() => {
    const approved = myLeaves.filter(l => l.status === 'APPROVED');
    return {
      casual: approved.filter(l => l.leaveType === 'CASUAL').reduce((acc, l) => acc + l.daysCount, 0),
      sick: approved.filter(l => l.leaveType === 'SICK' || l.leaveType === 'UNPLANNED_ABSENCE').reduce((acc, l) => acc + l.daysCount, 0),
      earned: approved.filter(l => l.leaveType === 'EARNED').reduce((acc, l) => acc + l.daysCount, 0),
      totalApprovedDays: approved.reduce((acc, l) => acc + l.daysCount, 0),
      pendingRequests: myLeaves.filter(l => l.status === 'PENDING').length
    };
  }, [myLeaves]);

  // Calculate number of leave days for full leave application
  const calculatedDays = useMemo(() => {
    if (leaveType === 'HALF_DAY') return 0.5;
    if (!startDate || !endDate) return 1;
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diff = differenceInDays(end, start) + 1;
      return diff > 0 ? diff : 1;
    } catch (e) {
      return 1;
    }
  }, [startDate, endDate, leaveType]);

  // 1. Submit Quick Mark Absence
  const handleMarkAbsence = (e: React.FormEvent) => {
    e.preventDefault();
    const targetDate = absenceDateOption === 'TODAY' ? todayIso : absenceDateOption === 'TOMORROW' ? tomorrowIso : customAbsenceDate;

    // Check if already applied for this date
    const existing = myLeaves.find(l => l.startDate === targetDate && l.status !== 'CANCELLED' && l.status !== 'REJECTED');
    if (existing) {
      toast.error(`You have already marked absence/leave for ${targetDate}`);
      return;
    }

    const fullReason = `${absenceReasonCategory}${absenceNote.trim() ? `: ${absenceNote.trim()}` : ''}`;
    const newRecord: LeaveRecord = {
      id: `leave-${Date.now()}`,
      employeeId: currentUserId,
      employeeName: displayName,
      employeeEmail: user?.email,
      leaveType: 'UNPLANNED_ABSENCE',
      startDate: targetDate,
      endDate: targetDate,
      daysCount: 1,
      reason: fullReason,
      status: 'APPROVED', // Quick absence auto-notifies and records
      appliedAt: todayIso,
      approvedBy: 'System Auto-Ack'
    };

    const updated = [newRecord, ...leavesList];
    saveLeaves(updated);

    // If absence is for Today, also update today's attendance log to ON_LEAVE / ABSENT
    if (targetDate === todayIso) {
      try {
        const savedAtt = localStorage.getItem('insumitra_attendance_logs');
        if (savedAtt) {
          const parsed = JSON.parse(savedAtt);
          const updatedAtt = parsed.map((item: any) => {
            if (item.name === displayName || item.employeeId === currentUserId) {
              return {
                ...item,
                status: 'ON_LEAVE',
                checkIn: null,
                checkOut: null,
                duration: '—',
                comments: `Absence marked by employee: ${fullReason}`
              };
            }
            return item;
          });
          localStorage.setItem('insumitra_attendance_logs', JSON.stringify(updatedAtt));
          window.dispatchEvent(new Event('storage'));
        }
      } catch (e) {}
    }

    setAbsenceNote('');
    toast.success(`Absence marked for ${targetDate === todayIso ? 'Today' : targetDate === tomorrowIso ? 'Tomorrow' : targetDate}! Your team is notified.`, {
      icon: '🌴',
      duration: 5000
    });
  };

  // 2. Submit Planned Leave Application
  const handleApplyLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveReason.trim()) {
      toast.error('Please enter a short reason for your leave application.');
      return;
    }

    if (startDate > endDate && leaveType !== 'HALF_DAY') {
      toast.error('End date cannot be earlier than start date.');
      return;
    }

    const newRecord: LeaveRecord = {
      id: `leave-${Date.now()}`,
      employeeId: currentUserId,
      employeeName: displayName,
      employeeEmail: user?.email,
      leaveType,
      startDate,
      endDate: leaveType === 'HALF_DAY' ? startDate : endDate,
      daysCount: calculatedDays,
      reason: leaveType === 'HALF_DAY' ? `[${halfDayShift === 'FIRST_HALF' ? '1st Half' : '2nd Half'}] ${leaveReason.trim()}` : leaveReason.trim(),
      status: 'PENDING',
      appliedAt: todayIso
    };

    const updated = [newRecord, ...leavesList];
    saveLeaves(updated);

    setLeaveReason('');
    toast.success(`Leave application submitted for ${calculatedDays} day(s)! Sent for manager approval.`, {
      icon: '🏖️',
      duration: 5000
    });
  };

  // Cancel pending leave
  const handleCancelLeave = (leaveId: string) => {
    const updated = leavesList.map(l => {
      if (l.id === leaveId) return { ...l, status: 'CANCELLED' as const };
      return l;
    });
    saveLeaves(updated);
    toast.success('Leave application cancelled.');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ── Top Leave Balances Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Casual Leave */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-emerald-800 tracking-wider">
              Casual Leave (CL)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Sun size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">
              {Math.max(0, 12 - usedStats.casual)}
            </span>
            <span className="text-xs text-slate-400 font-bold">/ 12 Available</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, (Math.max(0, 12 - usedStats.casual) / 12) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400 font-medium block">
            {usedStats.casual} day(s) utilized this year
          </span>
        </div>

        {/* Sick Leave */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-blue-800 tracking-wider">
              Sick Leave (SL)
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <HeartPulse size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">
              {Math.max(0, 8 - usedStats.sick)}
            </span>
            <span className="text-xs text-slate-400 font-bold">/ 8 Available</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-blue-500 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, (Math.max(0, 8 - usedStats.sick) / 8) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400 font-medium block">
            {usedStats.sick} day(s) utilized this year
          </span>
        </div>

        {/* Earned / Vacation Leave */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-purple-800 tracking-wider">
              Earned / Vacation
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <Palmtree size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">
              {Math.max(0, 15 - usedStats.earned)}
            </span>
            <span className="text-xs text-slate-400 font-bold">/ 15 Available</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-purple-500 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, (Math.max(0, 15 - usedStats.earned) / 15) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400 font-medium block">
            {usedStats.earned} day(s) utilized this year
          </span>
        </div>

        {/* Total Time-Off Summary */}
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-4 rounded-3xl shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-indigo-300 tracking-wider">
              Approved Time-Off
            </span>
            <div className="w-8 h-8 rounded-xl bg-white/10 text-white flex items-center justify-center font-bold">
              <CalendarDays size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-white">
              {usedStats.totalApprovedDays}
            </span>
            <span className="text-xs text-indigo-200 font-bold">Days Taken</span>
          </div>
          <p className="text-[10px] text-indigo-200 font-medium">
            {usedStats.pendingRequests > 0 
              ? `⏳ ${usedStats.pendingRequests} request(s) awaiting approval`
              : '✅ No pending leave applications'}
          </p>
        </div>
      </div>

      {/* ── Main Two-Column Layout: Simple Form on Left, History on Right ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (5 cols): Clean Simple Action Form */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-4">
            
            {/* Form Toggle: Mark Absence vs Apply Leave */}
            <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200/70">
              <button
                type="button"
                onClick={() => setFormMode('MARK_ABSENCE')}
                className={clsx(
                  "flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                  formMode === 'MARK_ABSENCE'
                    ? "bg-white text-rose-700 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                <AlertCircle size={14} className={formMode === 'MARK_ABSENCE' ? "text-rose-600" : ""} />
                <span>Mark Absence</span>
              </button>

              <button
                type="button"
                onClick={() => setFormMode('APPLY_LEAVE')}
                className={clsx(
                  "flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                  formMode === 'APPLY_LEAVE'
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                <Palmtree size={14} className={formMode === 'APPLY_LEAVE' ? "text-indigo-600" : ""} />
                <span>Apply Leave</span>
              </button>
            </div>

            {/* ── FORM 1: QUICK MARK ABSENCE ── */}
            {formMode === 'MARK_ABSENCE' && (
              <form onSubmit={handleMarkAbsence} className="space-y-4 animate-fadeIn">
                <div className="p-3 bg-rose-50/70 rounded-2xl border border-rose-200/60 flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-900 font-medium leading-relaxed">
                    Quickly notify your team if you cannot report to work. This auto-updates your daily shift status.
                  </p>
                </div>

                {/* Date Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block">
                    Select Date of Absence:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setAbsenceDateOption('TODAY')}
                      className={clsx(
                        "p-2.5 rounded-xl border text-xs font-bold text-center cursor-pointer transition-all",
                        absenceDateOption === 'TODAY'
                          ? "bg-rose-50 border-rose-400 text-rose-900 shadow-2xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      Today
                      <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
                        {format(new Date(), 'dd MMM')}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAbsenceDateOption('TOMORROW')}
                      className={clsx(
                        "p-2.5 rounded-xl border text-xs font-bold text-center cursor-pointer transition-all",
                        absenceDateOption === 'TOMORROW'
                          ? "bg-rose-50 border-rose-400 text-rose-900 shadow-2xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      Tomorrow
                      <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
                        {format(addDays(new Date(), 1), 'dd MMM')}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAbsenceDateOption('CUSTOM')}
                      className={clsx(
                        "p-2.5 rounded-xl border text-xs font-bold text-center cursor-pointer transition-all",
                        absenceDateOption === 'CUSTOM'
                          ? "bg-rose-50 border-rose-400 text-rose-900 shadow-2xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      Custom Date
                      <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
                        Pick date
                      </span>
                    </button>
                  </div>

                  {absenceDateOption === 'CUSTOM' && (
                    <div className="pt-2">
                      <DatePicker
                        value={customAbsenceDate}
                        onDateChange={setCustomAbsenceDate}
                        className="w-full text-xs font-bold"
                      />
                    </div>
                  )}
                </div>

                {/* Reason Category */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block">
                    Reason:
                  </label>
                  <select
                    value={absenceReasonCategory}
                    onChange={(e) => setAbsenceReasonCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  >
                    <option value="Feeling Unwell / Sick">🤒 Feeling Unwell / Medical Sickness</option>
                    <option value="Family / Personal Emergency">🚨 Family / Personal Emergency</option>
                    <option value="Urgent Domestic Work">🏠 Urgent Domestic Work</option>
                    <option value="Commute / Transport Disruption">🚗 Commute / Transport Issue</option>
                    <option value="Other Reason">📝 Other Reason</option>
                  </select>
                </div>

                {/* Optional Note */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block">
                    Note / Handover (Optional):
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Will attend emergency calls via phone"
                    value={absenceNote}
                    onChange={(e) => setAbsenceNote(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 placeholder-slate-400"
                  />
                </div>

                {/* Submit Absence Button */}
                <button
                  type="submit"
                  disabled={isViewOnly}
                  className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer transition-all shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Ban size={16} />
                  <span>Confirm &amp; Mark Absence</span>
                </button>
              </form>
            )}

            {/* ── FORM 2: APPLY FOR LEAVE ── */}
            {formMode === 'APPLY_LEAVE' && (
              <form onSubmit={handleApplyLeave} className="space-y-4 animate-fadeIn">
                {/* Leave Type Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block">
                    Leave Type:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { type: 'CASUAL', label: 'Casual (CL)', desc: '12/yr' },
                      { type: 'SICK', label: 'Sick (SL)', desc: '8/yr' },
                      { type: 'EARNED', label: 'Vacation (EL)', desc: '15/yr' },
                      { type: 'HALF_DAY', label: 'Half Day', desc: '0.5 day' },
                    ].map(item => (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => setLeaveType(item.type as any)}
                        className={clsx(
                          "p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between",
                          leaveType === item.type
                            ? "bg-indigo-50/90 border-indigo-400 text-indigo-950 shadow-2xs"
                            : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                        )}
                      >
                        <span className="text-xs font-bold">{item.label}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{item.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Half-Day Shift Selection */}
                {leaveType === 'HALF_DAY' ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block">
                      Date &amp; Shift:
                    </label>
                    <DatePicker
                      value={startDate}
                      onDateChange={setStartDate}
                      className="w-full text-xs font-bold"
                    />
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setHalfDayShift('FIRST_HALF')}
                        className={clsx(
                          "py-2 px-3 rounded-xl border text-xs font-bold text-center cursor-pointer transition-all",
                          halfDayShift === 'FIRST_HALF'
                            ? "bg-amber-50 border-amber-400 text-amber-900"
                            : "bg-white border-slate-200 text-slate-600"
                        )}
                      >
                        First Half (Morning)
                      </button>
                      <button
                        type="button"
                        onClick={() => setHalfDayShift('SECOND_HALF')}
                        className={clsx(
                          "py-2 px-3 rounded-xl border text-xs font-bold text-center cursor-pointer transition-all",
                          halfDayShift === 'SECOND_HALF'
                            ? "bg-amber-50 border-amber-400 text-amber-900"
                            : "bg-white border-slate-200 text-slate-600"
                        )}
                      >
                        Second Half (Afternoon)
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Date Range */
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                        Date Range:
                      </label>
                      <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                        {calculatedDays} {calculatedDays === 1 ? 'Day' : 'Days'} Total
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">From Date</span>
                        <DatePicker
                          value={startDate}
                          onDateChange={setStartDate}
                          className="w-full text-xs font-bold"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">To Date</span>
                        <DatePicker
                          value={endDate}
                          onDateChange={setEndDate}
                          className="w-full text-xs font-bold"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Reason */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block">
                    Reason / Purpose *:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Brief reason for your leave request..."
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder-slate-400"
                  />
                </div>

                {/* Submit Leave Application */}
                <button
                  type="submit"
                  disabled={isViewOnly}
                  className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black cursor-pointer transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send size={15} />
                  <span>Submit Leave Application ({calculatedDays}d)</span>
                </button>
              </form>
            )}

          </div>
        </div>

        {/* Right Column (7 cols): Clean Leave & Absence History */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Clock size={16} className="text-indigo-600" />
                  My Leave &amp; Absence History ({myLeaves.length})
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Record of all absence declarations and leave requests.
                </p>
              </div>
            </div>

            {myLeaves.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Palmtree size={24} />
                </div>
                <p className="text-xs font-bold text-slate-600">No leave or absence records found</p>
                <p className="text-[11px] text-slate-400">Apply a leave using the form on the left</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
                {myLeaves.map(item => {
                  const cfg = LEAVE_TYPE_CONFIG[item.leaveType] || LEAVE_TYPE_CONFIG.CASUAL;
                  const Icon = cfg.icon;

                  const isSingleDay = item.startDate === item.endDate;
                  const isFutureDate = isFuture(parseISO(item.startDate));

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl border border-slate-200/80 hover:border-slate-300 bg-slate-50/50 transition-all space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={clsx("px-2.5 py-0.5 rounded-full text-[10px] font-black border flex items-center gap-1", cfg.color)}>
                            <Icon size={12} />
                            {cfg.label}
                          </span>
                          <span className="text-xs font-black text-slate-800">
                            {item.daysCount} {item.daysCount === 1 ? 'Day' : 'Days'}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                          {item.status === 'APPROVED' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                              <CheckCircle2 size={12} /> Approved
                            </span>
                          )}
                          {item.status === 'PENDING' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                              <Clock size={12} /> Pending Approval
                            </span>
                          )}
                          {item.status === 'REJECTED' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                              <XCircle size={12} /> Rejected
                            </span>
                          )}
                          {item.status === 'CANCELLED' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200">
                              Cancelled
                            </span>
                          )}

                          {/* Cancel button if pending */}
                          {item.status === 'PENDING' && !isViewOnly && (
                            <button
                              type="button"
                              onClick={() => handleCancelLeave(item.id)}
                              className="text-[11px] font-bold text-rose-500 hover:text-rose-700 hover:underline cursor-pointer ml-1"
                              title="Cancel leave request"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          <Calendar size={14} className="text-slate-400" />
                          <span>
                            {isSingleDay
                              ? format(parseISO(item.startDate), 'dd MMMM yyyy')
                              : `${format(parseISO(item.startDate), 'dd MMM')} – ${format(parseISO(item.endDate), 'dd MMM yyyy')}`}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          Applied: {item.appliedAt}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 font-medium bg-white p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                        {item.reason}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
