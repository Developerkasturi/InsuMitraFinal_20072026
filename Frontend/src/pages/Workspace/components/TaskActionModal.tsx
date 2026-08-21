import React, { useState } from 'react';
import { X, AlertTriangle, Calendar, Clock, ArrowRight, Ban, RefreshCw } from 'lucide-react';
import { DatePicker } from '@comps/common/DatePicker';
import toast from 'react-hot-toast';

export type TaskActionType = 'CANCEL' | 'RESCHEDULE';

interface TaskActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionType: TaskActionType;
  task: any;
  onConfirm: (payload: {
    taskId: string;
    action: TaskActionType;
    reason: string;
    newDueDate?: string;
    notes?: string;
  }) => void;
}

const CANCEL_REASONS = [
  'Customer Declined / Not Interested',
  'Duplicate Task / Already Handled',
  'Deprioritized by Management',
  'Customer Postponed Indefinitely',
  'Incorrect Information / Lead Invalid',
  'Other Reason'
];

const RESCHEDULE_REASONS = [
  'Customer Requested Later Date/Time',
  'Customer Not Reachable / Call Back Needed',
  'Pending Underwriting / Insurer Response',
  'Awaiting KYC / Medical Documents',
  'Internal Rescheduling / Overcapacity',
  'Other Reason'
];

export default function TaskActionModal({
  isOpen,
  onClose,
  actionType,
  task,
  onConfirm
}: TaskActionModalProps) {
  const [reason, setReason] = useState(
    actionType === 'CANCEL' ? CANCEL_REASONS[0] : RESCHEDULE_REASONS[0]
  );
  const [newDueDate, setNewDueDate] = useState(
    new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState('');

  if (!isOpen || !task) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      taskId: task.id,
      action: actionType,
      reason,
      newDueDate: actionType === 'RESCHEDULE' ? newDueDate : undefined,
      notes: notes.trim() || undefined
    });
    toast.success(
      actionType === 'CANCEL'
        ? `Task "${task.title}" has been cancelled`
        : `Task rescheduled to ${newDueDate}`
    );
    onClose();
  };

  const isCancel = actionType === 'CANCEL';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isCancel ? 'bg-rose-50/70 border-rose-100' : 'bg-purple-50/70 border-purple-100'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${
              isCancel ? 'bg-rose-100 text-rose-700' : 'bg-purple-100 text-purple-700'
            }`}>
              {isCancel ? <Ban className="w-5 h-5" /> : <RefreshCw className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                {isCancel ? 'Cancel Task' : 'Reschedule Task'}
              </h3>
              <p className="text-[11px] text-gray-500">
                {isCancel ? 'Provide a cancellation reason to archive this task' : 'Set a new target due date and reason'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Task Summary Banner */}
        <div className="p-4 bg-slate-50 border-b border-gray-100 text-xs">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Target Task</span>
          <p className="font-bold text-gray-900">{task.title}</p>
          {task.entityName && (
            <p className="text-[11px] text-primary-700 font-semibold mt-0.5">
              🔗 {task.entityName}
            </p>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* New Due Date (for Reschedule) */}
          {!isCancel && (
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-600" /> New Target Due Date *
              </label>
              <DatePicker
                value={newDueDate}
                onDateChange={setNewDueDate}
                className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white font-medium"
              />
            </div>
          )}

          {/* Reason Selector */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              {isCancel ? 'Cancellation Reason *' : 'Reschedule Reason *'}
            </label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white font-medium"
            >
              {(isCancel ? CANCEL_REASONS : RESCHEDULE_REASONS).map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Notes / Remarks */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Additional Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder={isCancel ? 'Add internal reason or customer feedback...' : 'Reason for delay or customer request note...'}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all cursor-pointer ${
                isCancel
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                  : 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/20'
              }`}
            >
              {isCancel ? 'Confirm Cancellation' : 'Confirm Reschedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
