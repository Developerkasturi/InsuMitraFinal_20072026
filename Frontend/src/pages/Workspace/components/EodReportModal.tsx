import React, { useState } from 'react';
import { 
  X, FileText, CheckCircle2, Phone, Users, Shield, 
  Clock, DollarSign, Sparkles, Send, Check 
} from 'lucide-react';
import toast from 'react-hot-toast';

interface EodReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (report: any) => void;
}

export default function EodReportModal({ isOpen, onClose, onSubmit }: EodReportModalProps) {
  const [accomplishments, setAccomplishments] = useState('');
  const [keyInteractions, setKeyInteractions] = useState('');
  const [blockers, setBlockers] = useState('');
  const [followUps, setFollowUps] = useState('');
  const [tomorrowPriorities, setTomorrowPriorities] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      accomplishments,
      keyInteractions,
      blockers,
      followUps,
      tomorrowPriorities,
      submittedAt: new Date().toISOString()
    };
    onSubmit(payload);
    setIsSubmitted(true);
    toast.success('End of Day Report submitted successfully!');
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-100 text-indigo-700">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                End of Day (EOD) Performance Report
              </h2>
              <p className="text-xs text-gray-500">Summary of today's work output, accomplishments, blockers & next-day plan</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
          
          {/* Automatic Metrics Summary Grid */}
          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              📊 Today's Auto-Aggregated Work Output:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-center">
                <span className="text-[10px] font-semibold text-blue-600 uppercase">Calls Made</span>
                <p className="text-lg font-bold text-blue-900">18</p>
              </div>
              <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 text-center">
                <span className="text-[10px] font-semibold text-purple-600 uppercase">Meetings / Visits</span>
                <p className="text-lg font-bold text-purple-900">3</p>
              </div>
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 text-center">
                <span className="text-[10px] font-semibold text-emerald-600 uppercase">Policies Sold</span>
                <p className="text-lg font-bold text-emerald-900">4</p>
              </div>
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 text-center">
                <span className="text-[10px] font-semibold text-amber-600 uppercase">Premium</span>
                <p className="text-lg font-bold text-amber-900">₹85,000</p>
              </div>
            </div>
          </div>

          {/* Accomplishments */}
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1">
              1. What did you accomplish today? *
            </label>
            <textarea
              required
              rows={2}
              placeholder="e.g. Closed Star Comprehensive policy, cleared 3 medical queries for Dr. Kulkarni, conducted 18 outbound follow-ups..."
              value={accomplishments}
              onChange={(e) => setAccomplishments(e.target.value)}
              className="input w-full p-3 text-xs border border-gray-200 rounded-xl bg-white"
            />
          </div>

          {/* Key Interactions */}
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1">
              2. Key Customer Interactions & Outcomes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Discussed Care Supreme ₹25L floater with Rajesh Mehta, agreed to issue tomorrow morning."
              value={keyInteractions}
              onChange={(e) => setKeyInteractions(e.target.value)}
              className="input w-full p-3 text-xs border border-gray-200 rounded-xl bg-white"
            />
          </div>

          {/* Problems / Blockers */}
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1">
              3. Problems / Blockers Encountered (if any)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Insurer portal portal downtime between 2-3 PM; delayed KYC verification for Bajaj Allianz policy."
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              className="input w-full p-3 text-xs border border-gray-200 rounded-xl bg-white"
            />
          </div>

          {/* Tomorrow's Priorities */}
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1">
              4. Tomorrow's Priorities & Schedule *
            </label>
            <textarea
              required
              rows={2}
              placeholder="e.g. 1) Collect premium cheque from Mehta Family (10:30 AM), 2) Follow up with 8 corporate motor leads..."
              value={tomorrowPriorities}
              onChange={(e) => setTomorrowPriorities(e.target.value)}
              className="input w-full p-3 text-xs border border-gray-200 rounded-xl bg-white"
            />
          </div>

          {/* Submission status or footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
            <span className="text-[11px] text-gray-500">
              Shift summary will be sent to management upon submission.
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitted}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-70"
              >
                <Send className="w-3.5 h-3.5" />
                {isSubmitted ? '✓ Submitted!' : 'Submit EOD Report'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
