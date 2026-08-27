import React, { useState } from 'react';
import { format } from 'date-fns';
import { Clock, Eye, Play, Square, Lock, Save, Target, LogOut } from 'lucide-react';
import { useAuthStore } from '@store/auth.store';
import toast from 'react-hot-toast';
import { useClockIn, useClockOut, useUpsertDailyLog } from '@hooks/useWorkspace';
import ShiftCheckoutModal from '@comps/layout/ShiftCheckoutModal';

function formatTotalDuration(checkIn: string | Date, checkOut: string | Date) {
  const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  if (diffMs <= 0) return '0m';
  const totalMins = Math.floor(diffMs / (1000 * 60));
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

interface WorkspaceHeaderProps {
  selectedEmployeeUserId?: string | null;
  selectedEmployeeObj?: any;
  activeLogToday?: any;
  refetch: () => void;
}

export default function WorkspaceHeader({
  selectedEmployeeUserId,
  selectedEmployeeObj,
  activeLogToday,
  refetch
}: WorkspaceHeaderProps) {
  const user = useAuthStore(s => s.user);
  const clockInMutation = useClockIn();
  const clockOutMutation = useClockOut();
  const saveLogMutation = useUpsertDailyLog();

  const [nextDayPlan, setNextDayPlan] = useState(activeLogToday?.nextDayPlan || '');
  const [notes, setNotes] = useState(activeLogToday?.notes || '');
  const [showPlan, setShowPlan] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  // Sync state if activeLogToday changes
  React.useEffect(() => {
    if (activeLogToday) {
      setNextDayPlan(activeLogToday.nextDayPlan || '');
      setNotes(activeLogToday.notes || '');
    }
  }, [activeLogToday]);

  const isClockedIn = !!activeLogToday?.checkIn && !activeLogToday?.checkOut;
  const isClockedOut = !!activeLogToday?.checkIn && !!activeLogToday?.checkOut;
  const isViewOnly = !!selectedEmployeeUserId;

  const handleClockIn = () => {
    if (isClockedOut) {
      toast.error('Attendance is locked after check-out for today');
      return;
    }
    clockInMutation.mutate(undefined, {
      onSuccess: () => refetch()
    });
  };

  const handleClockOut = () => {
    if (isClockedOut) {
      toast.error('Attendance already ended and locked for today');
      return;
    }
    // Open mandatory checkout handover modal
    setShowCheckoutModal(true);
  };

  const handleSaveNotes = (e: React.FormEvent) => {
    e.preventDefault();
    saveLogMutation.mutate({ nextDayPlan, notes }, {
      onSuccess: () => {
        toast.success('Notes saved');
        setShowPlan(false);
        refetch();
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* View Only Banner (when inspecting another employee's workspace) */}
      {isViewOnly && selectedEmployeeObj && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl p-3.5 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">
                Viewing {selectedEmployeeObj.firstName} {selectedEmployeeObj.lastName}'s Workspace (Read Only)
              </h4>
              <p className="text-[11px] text-amber-700">
                Shift status: {isClockedOut ? 'Shift Ended' : isClockedIn ? 'Active Now' : 'Not Clocked In'}
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-amber-200 text-amber-900 text-[10px] font-extrabold uppercase tracking-wider">
            Supervisor View
          </span>
        </div>
      )}

      {/* STRATEGIC DAILY WORK & PLANNING HUB */}
      {!isViewOnly && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Daily Work Execution & Planning Hub
                </h3>
                <p className="text-[11px] text-gray-500">
                  Track today's fixed committed agenda, log live progress notes, and plan tomorrow's major tasks.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveNotes}
              disabled={saveLogMutation.isPending}
              className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {saveLogMutation.isPending ? 'Saving...' : 'Save Notes/Plan'}
            </button>
          </div>

          {/* 3-Part Strategic Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* 1. Today's Plan (Uneditable / Fixed Reference) */}
            <div className="bg-gradient-to-br from-amber-50/70 to-orange-50/40 rounded-2xl border border-amber-200/80 p-4 space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5 uppercase tracking-wider">
                    <Lock className="w-3 h-3 text-amber-700" />
                    Today's Plan (Reference)
                  </span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900">
                    Uneditable
                  </span>
                </div>
                <p className="text-xs text-amber-950 font-medium leading-relaxed bg-white/60 p-3 rounded-xl border border-amber-100/80 min-h-[90px]">
                  {activeLogToday?.yesterdayPlan || activeLogToday?.nextDayPlan || '1) Follow up on Star Health ₹10L Comprehensive quote with Amit Sharma (+91 98765 43210), 2) Upload KYC documents for Policy #POL-8902, 3) 10:30 AM proposal meeting with Apex Technologies.'}
                </p>
              </div>
              <p className="text-[10px] text-amber-700/80 font-medium">
                Committed at the end of previous working day as baseline agenda.
              </p>
            </div>

            {/* 2. Live Work In Progress & Shift Notes (Continuously Editable) */}
            <div className="bg-slate-50/90 rounded-2xl border border-slate-200/90 p-4 space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <Save className="w-3 h-3 text-primary-600" />
                    Live Work Notes & Updates
                  </span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    Editable Live
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record customer updates, active tasks in progress, key discussion outcomes..."
                  className="input w-full p-2.5 text-xs border border-slate-200 rounded-xl bg-white focus:border-primary-500 font-medium min-h-[90px]"
                />
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                Continuously updated throughout the day as work happens.
              </p>
            </div>

            {/* 3. Next Working Day Plan (Editable) */}
            <div className="bg-indigo-50/40 rounded-2xl border border-indigo-100 p-4 space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1.5 uppercase tracking-wider">
                    <Target className="w-3 h-3 text-indigo-600" />
                    Next Working Day Plan
                  </span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    Next Shift Agenda
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={nextDayPlan}
                  onChange={(e) => setNextDayPlan(e.target.value)}
                  placeholder="e.g. 1) Collect premium from Mehta Family (10 AM), 2) Follow up with 8 motor leads, 3) Dispatch issued policy..."
                  className="input w-full p-2.5 text-xs border border-indigo-200/80 rounded-xl bg-white focus:border-indigo-500 font-medium min-h-[90px]"
                />
              </div>
              <p className="text-[10px] text-indigo-600/80 font-medium">
                Committed plan for next working day (accounting for holidays/weekends).
              </p>
            </div>

          </div>
        </div>
      )}

      {/* Mandatory Handover Checkout Modal */}
      <ShiftCheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        initialNotes={notes}
        initialNextDayPlan={nextDayPlan}
        isLogoutAction={false}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
