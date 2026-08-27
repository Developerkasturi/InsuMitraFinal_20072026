import React, { useState, useEffect } from 'react';
import { LogOut, Save, AlertCircle, Calendar, FileText, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useClockOut, useUpsertDailyLog } from '@hooks/useWorkspace';
import { authService } from '@api/auth.service';
import { useNavigate } from 'react-router-dom';

interface ShiftCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialNotes?: string;
  initialNextDayPlan?: string;
  isLogoutAction?: boolean;
  onSuccess?: () => void;
}

export default function ShiftCheckoutModal({
  isOpen,
  onClose,
  initialNotes = '',
  initialNextDayPlan = '',
  isLogoutAction = true,
  onSuccess
}: ShiftCheckoutModalProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [nextDayPlan, setNextDayPlan] = useState(initialNextDayPlan);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const clockOutMutation = useClockOut();
  const saveLogMutation = useUpsertDailyLog();

  useEffect(() => {
    if (isOpen) {
      setNotes(initialNotes || '');
      setNextDayPlan(initialNextDayPlan || '');
    }
  }, [isOpen, initialNotes, initialNextDayPlan]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!notes.trim()) {
      toast.error("Please enter today's work notes before checking out.");
      return;
    }

    if (!nextDayPlan.trim()) {
      toast.error("Please enter your next working day plan before checking out.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Save work notes and next day plan
      await saveLogMutation.mutateAsync({
        notes: notes.trim(),
        nextDayPlan: nextDayPlan.trim()
      });

      // 2. End attendance / Clock out
      await clockOutMutation.mutateAsync(undefined);

      toast.success("Shift notes & next day plan saved. Shift ended successfully!");
      if (onSuccess) onSuccess();
      onClose();

      // 3. If user clicked full logout, log them out of auth session
      if (isLogoutAction) {
        try {
          await authService.logout();
        } catch (err) {}
        navigate('/login');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to complete checkout');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center font-bold">
              <LogOut className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                Shift Checkout &amp; Handover
              </h3>
              <p className="text-xs text-slate-300">
                Mandatory notes &amp; next day plan required before logout
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900 font-medium leading-relaxed">
              <strong>Mandatory Handover:</strong> Logout is permitted only after recording your shift execution notes and planning high-priority deliverables for the next working day.
            </p>
          </div>

          {/* 1. Today's Work Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              1. Today's Work Notes &amp; Updates <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 1) Closed ₹10L Star Health proposal for Amit Sharma&#10;2) Verified KYC documents for Claim #CLM-1029&#10;3) Completed 15 lead follow-up calls"
              className="w-full text-xs p-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-medium text-slate-800 bg-slate-50/50 focus:bg-white"
              required
            />
          </div>

          {/* 2. Next Working Day Plan */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
              2. Next Working Day Plan &amp; Priorities <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={nextDayPlan}
              onChange={(e) => setNextDayPlan(e.target.value)}
              placeholder="e.g. 1) Collect premium cheque from Dr. Kulkarni at 10 AM&#10;2) Follow up with 8 motor policy renewal leads&#10;3) Submit cashless claim documents to HDFC Ergo"
              className="w-full text-xs p-3 rounded-2xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all font-medium text-slate-800 bg-slate-50/50 focus:bg-white"
              required
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              {isSubmitting ? 'Ending Shift & Logging out...' : isLogoutAction ? 'Save Notes, Plan & Logout' : 'Save Notes, Plan & Clock Out'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
