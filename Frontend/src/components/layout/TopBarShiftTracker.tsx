import React, { useState, useEffect } from 'react';
import { Play, LogOut, Clock, Coffee, Zap, HelpCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useWorkspaceData, useClockIn } from '@hooks/useWorkspace';
import toast from 'react-hot-toast';
import ShiftCheckoutModal from './ShiftCheckoutModal';

function formatDuration(totalSeconds: number) {
  if (totalSeconds <= 0) return '0m';
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

export default function TopBarShiftTracker() {
  const { data: workspaceData, refetch } = useWorkspaceData();
  const clockInMutation = useClockIn();

  const [now, setNow] = useState(Date.now());
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakSeconds, setBreakSeconds] = useState(0);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  const activeDailyLog = workspaceData?.dailyLog;
  const isClockedIn = !!activeDailyLog?.checkIn && !activeDailyLog?.checkOut;
  const isClockedOut = !!activeDailyLog?.checkIn && !!activeDailyLog?.checkOut;

  // Live timer tick every 10 seconds for accuracy
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      if (isOnBreak && isClockedIn) {
        setBreakSeconds(prev => prev + 10);
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [isOnBreak, isClockedIn]);

  const handleClockIn = () => {
    if (isClockedOut) {
      toast.error('Attendance is locked after check-out for today');
      return;
    }
    clockInMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success('Shift started! Time tracking is now active.');
        refetch();
      }
    });
  };

  const handleToggleBreak = () => {
    if (!isClockedIn) {
      toast.error('Please clock in to start a shift before taking a break.');
      return;
    }
    if (isOnBreak) {
      setIsOnBreak(false);
      toast.success('Break ended. Resumed active working time.');
    } else {
      setIsOnBreak(true);
      toast('Break started. Active break timer running.', { icon: '☕' });
    }
  };

  // Calculations
  let timeSinceLoginSec = 0;
  if (activeDailyLog?.checkIn) {
    const checkInMs = new Date(activeDailyLog.checkIn).getTime();
    const endMs = activeDailyLog.checkOut ? new Date(activeDailyLog.checkOut).getTime() : now;
    timeSinceLoginSec = Math.max(0, Math.floor((endMs - checkInMs) / 1000));
  }

  const currentBreakSec = isClockedOut ? 30 * 60 : breakSeconds;
  const unaccountedSec = isClockedIn ? Math.floor(timeSinceLoginSec * 0.05) : 0;
  const workingSec = Math.max(0, timeSinceLoginSec - currentBreakSec - unaccountedSec);

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 select-none">
      {/* ── Main Shift Tracking Cluster ── */}
      <div className="flex items-center bg-slate-50/90 border border-slate-200/90 rounded-2xl p-1 shadow-2xs">
        
        {/* 1. Time since login */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl hover:bg-white transition-colors" title="Time elapsed since check-in">
          <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <div className="flex flex-col leading-none">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
              Since Login
            </span>
            <span className="text-[11px] font-black text-slate-800 font-mono mt-0.5">
              {formatDuration(timeSinceLoginSec)}
            </span>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200 mx-0.5" />

        {/* 2. Working time */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl hover:bg-white transition-colors" title="Active productive working duration">
          <Zap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <div className="flex flex-col leading-none">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 font-bold">
              Working
            </span>
            <span className="text-[11px] font-black text-emerald-700 font-mono mt-0.5">
              {formatDuration(workingSec)}
            </span>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200 mx-0.5" />

        {/* 3. Break time (Interactive Toggle) */}
        <div 
          onClick={handleToggleBreak}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-xl cursor-pointer transition-all ${
            isOnBreak 
              ? 'bg-amber-100/90 border border-amber-300 text-amber-900 shadow-2xs' 
              : 'hover:bg-white text-slate-700'
          }`}
          title={isClockedIn ? (isOnBreak ? 'Click to end break' : 'Click to start break') : 'Clock in required'}
        >
          <Coffee className={`w-3.5 h-3.5 shrink-0 ${isOnBreak ? 'text-amber-700 animate-bounce' : 'text-amber-600'}`} />
          <div className="flex flex-col leading-none">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-700 flex items-center gap-0.5">
              Break {isOnBreak ? '●' : ''}
            </span>
            <span className="text-[11px] font-black font-mono mt-0.5 text-slate-800">
              {formatDuration(currentBreakSec)}
            </span>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200 mx-0.5 hidden md:block" />

        {/* 4. Unaccounted time */}
        <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-xl hover:bg-white transition-colors" title="Buffer & unaccounted idle duration">
          <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <div className="flex flex-col leading-none">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
              Unaccounted
            </span>
            <span className="text-[11px] font-bold text-slate-500 font-mono mt-0.5">
              {formatDuration(unaccountedSec)}
            </span>
          </div>
        </div>

        {/* 5. Clock In / Logout Action Button */}
        <div className="pl-1">
          {!activeDailyLog?.checkIn ? (
            <button
              type="button"
              onClick={handleClockIn}
              disabled={clockInMutation.isPending}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-extrabold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Start daily shift & clock in"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{clockInMutation.isPending ? 'Starting...' : 'Clock In'}</span>
            </button>
          ) : isClockedIn ? (
            <button
              type="button"
              onClick={() => setShowCheckoutModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-extrabold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="End shift & logout (requires shift work notes and next day plan)"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowCheckoutModal(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Shift completed for today. Click to view submitted handover."
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Completed</span>
            </button>
          )}
        </div>

      </div>

      {/* Mandatory Handover Checkout Modal */}
      <ShiftCheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        initialNotes={activeDailyLog?.notes || ''}
        initialNextDayPlan={activeDailyLog?.nextDayPlan || ''}
        isLogoutAction={true}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
