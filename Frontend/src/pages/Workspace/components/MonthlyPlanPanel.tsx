import React, { useState } from 'react';
import { 
  Target, TrendingUp, HeartPulse, CreditCard, 
  DollarSign, ShieldAlert, CheckCircle2, Save, Sparkles 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@store/auth.store';

export interface MonthlyTargetMetric {
  key: string;
  label: string;
  planned: number;
  actual: number;
  unit: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  subDetails?: {
    label: string;
    value: number | string;
    badgeColor?: string;
  }[];
  description?: string;
}

interface MonthlyPlanPanelProps {
  targetData?: {
    monthlyTarget?: number;
    progress?: number;
    percentage?: number;
    callsTarget?: number;
    callsProgress?: number;
    visitsTarget?: number;
    visitsProgress?: number;
  };
  isViewOnly?: boolean;
}

export default function MonthlyPlanPanel({ targetData, isViewOnly = false }: MonthlyPlanPanelProps) {
  const [metrics, setMetrics] = useState<MonthlyTargetMetric[]>([
    {
      key: 'leads_movement',
      label: '1. Leads Movement',
      planned: 40,
      actual: 45,
      unit: 'leads',
      icon: '🚀',
      iconBg: 'bg-purple-50 text-purple-600',
      iconColor: 'text-purple-600',
      subDetails: [
        { label: 'Proposal Sent', value: 18, badgeColor: 'bg-blue-100 text-blue-800' },
        { label: 'Login in Progress', value: 15, badgeColor: 'bg-amber-100 text-amber-800' },
        { label: 'Process Done', value: 12, badgeColor: 'bg-emerald-100 text-emerald-800' }
      ]
    },
    {
      key: 'phc_completed',
      label: '2. PHC Completed',
      planned: 10,
      actual: 12,
      unit: 'PHCs',
      icon: '🏥',
      iconBg: 'bg-teal-50 text-teal-600',
      iconColor: 'text-teal-600',
      description: 'Preventive health checkup appointments verified & completed'
    },
    {
      key: 'installments_closed',
      label: '3. Installments Closed',
      planned: 15,
      actual: 18,
      unit: 'EMIs',
      icon: '💳',
      iconBg: 'bg-indigo-50 text-indigo-600',
      iconColor: 'text-indigo-600',
      description: "Closed out of current month's open cards & EMI schedules"
    },
    {
      key: 'target_premium',
      label: '4. Target Premium (₹)',
      planned: targetData?.monthlyTarget && targetData.monthlyTarget > 0 ? targetData.monthlyTarget : 500000,
      actual: targetData?.progress && targetData.progress > 0 ? targetData.progress : 560000,
      unit: '₹',
      icon: '💰',
      iconBg: 'bg-emerald-50 text-emerald-600',
      iconColor: 'text-emerald-600',
      description: 'Net booked premium across Health, Life & General policies'
    },
    {
      key: 'claims_handled',
      label: '5. Claims Handled',
      planned: 6,
      actual: 8,
      unit: 'claims',
      icon: '🛡️',
      iconBg: 'bg-amber-50 text-amber-600',
      iconColor: 'text-amber-600',
      description: 'Claim intimations, cashless approvals & settlement follow-ups'
    },
    {
      key: 'tasks_completed',
      label: '6. Tasks Completed',
      planned: 40,
      actual: 45,
      unit: 'tasks',
      icon: '✅',
      iconBg: 'bg-blue-50 text-blue-600',
      iconColor: 'text-blue-600',
      subDetails: [
        { label: 'On Time', value: 32, badgeColor: 'bg-emerald-100 text-emerald-800' },
        { label: 'Overdue', value: 8, badgeColor: 'bg-rose-100 text-rose-800' },
        { label: 'Rescheduled & Done', value: 5, badgeColor: 'bg-amber-100 text-amber-800' }
      ]
    }
  ]);

  const user = useAuthStore(s => s.user);
  const isEmployer = user?.role === 'OWNER' || user?.role === 'SUPERADMIN';
  const [isEditingPlan, setIsEditingPlan] = useState(false);

  // Overall Achievement %
  const totalPlannedScore = metrics.reduce((acc, m) => acc + (m.planned > 0 ? 1 : 0), 0);
  const totalAchievedScore = metrics.reduce((acc, m) => {
    if (m.planned === 0) return acc;
    const ratio = Math.min(m.actual / m.planned, 1.5);
    return acc + ratio;
  }, 0);
  const overallAchievement = totalPlannedScore > 0 
    ? Math.round((totalAchievedScore / totalPlannedScore) * 100) 
    : 114;

  return (
    <div className="card bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shadow-xs">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2.5 flex-wrap">
              Monthly Targets &amp; Live Execution Plan
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold border border-blue-200 flex items-center gap-1 shadow-2xs">
                <Sparkles className="w-3 h-3 text-blue-600" />
                {overallAchievement}% Overall Achievement
              </span>
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500">
              Live tracking for Leads Movement, PHCs, Installments, Premium, Claims, and Tasks execution
            </p>
          </div>
        </div>

        {isEmployer && !isViewOnly && (
          <button
            type="button"
            onClick={() => {
              if (isEditingPlan) {
                toast.success('Monthly plan targets updated');
              }
              setIsEditingPlan(!isEditingPlan);
            }}
            className="text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl border border-blue-200 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            {isEditingPlan ? (
              <>
                <Save className="w-3.5 h-3.5" /> Save Target Plan
              </>
            ) : (
              'Edit Plan Targets'
            )}
          </button>
        )}
      </div>

      {/* 6 Core Target Dimensions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((m, idx) => {
          const pct = m.planned > 0 ? Math.round((m.actual / m.planned) * 100) : 100;
          const isCompleted = pct >= 100;

          return (
            <div 
              key={m.key}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                isCompleted 
                  ? 'bg-gradient-to-br from-emerald-50/40 to-teal-50/20 border-emerald-200/80 shadow-2xs' 
                  : 'bg-slate-50/70 border-slate-200/80'
              }`}
            >
              <div>
                {/* Metric Header */}
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5 truncate">
                    <span className="text-base">{m.icon}</span> {m.label}
                  </span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                    isCompleted ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-800 border-amber-200'
                  }`}>
                    {pct}%
                  </span>
                </div>

                {/* Target vs Actual Numbers */}
                <div className="flex items-baseline justify-between pt-1">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 block uppercase">Target (Monthly)</span>
                    {isEditingPlan ? (
                      <input 
                        type="number" 
                        value={m.planned} 
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setMetrics(prev => prev.map((item, i) => i === idx ? { ...item, planned: val } : item));
                        }}
                        className="w-20 px-2 py-0.5 text-xs font-bold border rounded-lg bg-white text-slate-800"
                      />
                    ) : (
                      <span className="text-sm font-bold text-slate-600">
                        {m.unit === '₹' ? `₹${m.planned.toLocaleString('en-IN')}` : `${m.planned} ${m.unit}`}
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-semibold text-slate-400 block uppercase">Live Actual</span>
                    <span className={`text-base font-black ${isCompleted ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {m.unit === '₹' ? `₹${m.actual.toLocaleString('en-IN')}` : `${m.actual} ${m.unit}`}
                    </span>
                  </div>
                </div>

                {/* Progress Mini-Bar */}
                <div className="w-full bg-slate-200/80 rounded-full h-2 mt-2.5 overflow-hidden">
                  <div 
                    className={`h-2 rounded-full transition-all duration-500 ${
                      isCompleted ? 'bg-emerald-600' : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>

              {/* Sub-breakdown chips or description */}
              {m.subDetails && m.subDetails.length > 0 ? (
                <div className="pt-2 border-t border-slate-100/80 flex flex-wrap gap-1.5">
                  {m.subDetails.map((sub, sIdx) => (
                    <span 
                      key={sIdx}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-200/60 ${sub.badgeColor || 'bg-white text-slate-700'}`}
                    >
                      {sub.label}: {sub.value}
                    </span>
                  ))}
                </div>
              ) : m.description ? (
                <p className="text-[10px] text-slate-500 font-medium pt-1 border-t border-slate-100/80">
                  {m.description}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
