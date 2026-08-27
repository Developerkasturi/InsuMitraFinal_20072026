import React from 'react';
import { 
  CheckCircle2, TrendingUp, CreditCard, HeartPulse, 
  FileCheck2, RefreshCw, IndianRupee, Sparkles, ArrowRight, ShieldCheck 
} from 'lucide-react';

export interface LeadMovementBreakdown {
  stage: string;
  count: number;
  color: string;
}

export interface ProductivitySummaryData {
  tasksCompleted: number;
  leadMovementsTotal: number;
  leadMovements: LeadMovementBreakdown[];
  installmentsClosed: number;
  phcsCompleted: number;
  claimsCompleted: number;
  renewalsCompleted: number;
  premiumGenerated: number;
}

interface DailyProductivitySummaryProps {
  data?: Partial<ProductivitySummaryData>;
  isViewOnly?: boolean;
}

const DEFAULT_SUMMARY: ProductivitySummaryData = {
  tasksCompleted: 7,
  leadMovementsTotal: 14,
  leadMovements: [
    { stage: 'New → Contacted', count: 6, color: 'text-blue-700 bg-blue-50 border-blue-200' },
    { stage: 'Contacted → Proposal', count: 4, color: 'text-amber-700 bg-amber-50 border-amber-200' },
    { stage: 'Proposal → Login in Progress', count: 2, color: 'text-purple-700 bg-purple-50 border-purple-200' },
    { stage: 'Login → Converted / Issued', count: 2, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  ],
  installmentsClosed: 5,
  phcsCompleted: 3,
  claimsCompleted: 2,
  renewalsCompleted: 4,
  premiumGenerated: 125000,
};

export default function DailyProductivitySummary({ data, isViewOnly = false }: DailyProductivitySummaryProps) {
  const summary: ProductivitySummaryData = {
    ...DEFAULT_SUMMARY,
    ...data,
    leadMovements: data?.leadMovements && data.leadMovements.length > 0 ? data.leadMovements : DEFAULT_SUMMARY.leadMovements,
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-3 p-4 md:p-5">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs md:text-sm font-extrabold text-slate-900 flex items-center gap-2">
              Today's Auto-Captured Productivity
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                Live CRM Events
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Automatically measured from completed CRM actions, stage movements, and closed deliverables
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/70">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          Single Source of Truth
        </div>
      </div>

      {/* 7 Key Productivity KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
        {/* 1. Tasks Completed */}
        <div className="bg-slate-50/80 hover:bg-slate-100/70 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between text-emerald-600 mb-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-[10px] font-bold text-slate-400">Tasks</span>
          </div>
          <div>
            <span className="text-xl font-black text-slate-800">{summary.tasksCompleted}</span>
            <p className="text-[10px] font-bold text-slate-500 truncate">Tasks Done</p>
          </div>
        </div>

        {/* 2. Lead Movements */}
        <div className="bg-blue-50/50 hover:bg-blue-50/80 border border-blue-200/70 rounded-xl p-3 flex flex-col justify-between transition-all col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-blue-600 mb-1.5">
            <TrendingUp className="w-4 h-4" />
            <span className="text-[10px] font-bold text-blue-700 bg-blue-100/70 px-1.5 py-0.2 rounded">Stages</span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-blue-900">{summary.leadMovementsTotal}</span>
              <span className="text-[10px] font-bold text-blue-600">moves</span>
            </div>
            <p className="text-[10px] font-bold text-slate-600 truncate">Leads Moved</p>
          </div>
        </div>

        {/* 3. Installments Closed */}
        <div className="bg-purple-50/50 hover:bg-purple-50/80 border border-purple-200/70 rounded-xl p-3 flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between text-purple-600 mb-1.5">
            <CreditCard className="w-4 h-4" />
            <span className="text-[10px] font-bold text-purple-400">EMIs</span>
          </div>
          <div>
            <span className="text-xl font-black text-purple-900">{summary.installmentsClosed}</span>
            <p className="text-[10px] font-bold text-slate-500 truncate">Installments Closed</p>
          </div>
        </div>

        {/* 4. PHCs Completed */}
        <div className="bg-rose-50/50 hover:bg-rose-50/80 border border-rose-200/70 rounded-xl p-3 flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between text-rose-600 mb-1.5">
            <HeartPulse className="w-4 h-4" />
            <span className="text-[10px] font-bold text-rose-400">Health</span>
          </div>
          <div>
            <span className="text-xl font-black text-rose-900">{summary.phcsCompleted}</span>
            <p className="text-[10px] font-bold text-slate-500 truncate">PHC Completed</p>
          </div>
        </div>

        {/* 5. Claims Completed */}
        <div className="bg-amber-50/50 hover:bg-amber-50/80 border border-amber-200/70 rounded-xl p-3 flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between text-amber-600 mb-1.5">
            <FileCheck2 className="w-4 h-4" />
            <span className="text-[10px] font-bold text-amber-500">Claims</span>
          </div>
          <div>
            <span className="text-xl font-black text-amber-900">{summary.claimsCompleted}</span>
            <p className="text-[10px] font-bold text-slate-500 truncate">Claims Handled</p>
          </div>
        </div>

        {/* 6. Renewals Completed */}
        <div className="bg-teal-50/50 hover:bg-teal-50/80 border border-teal-200/70 rounded-xl p-3 flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between text-teal-600 mb-1.5">
            <RefreshCw className="w-4 h-4" />
            <span className="text-[10px] font-bold text-teal-400">Retention</span>
          </div>
          <div>
            <span className="text-xl font-black text-teal-900">{summary.renewalsCompleted}</span>
            <p className="text-[10px] font-bold text-slate-500 truncate">Renewals Closed</p>
          </div>
        </div>

        {/* 7. Premium Generated */}
        <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-200 rounded-xl p-3 flex flex-col justify-between transition-all col-span-2 sm:col-span-3 lg:col-span-1">
          <div className="flex items-center justify-between text-emerald-700 mb-1.5">
            <IndianRupee className="w-4 h-4" />
            <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100/80 px-1.5 py-0.2 rounded">Revenue</span>
          </div>
          <div>
            <span className="text-base sm:text-lg font-black text-emerald-900 truncate block">
              ₹{(summary.premiumGenerated).toLocaleString('en-IN')}
            </span>
            <p className="text-[10px] font-bold text-emerald-700 truncate">Premium Generated</p>
          </div>
        </div>
      </div>

      {/* Stage-wise Lead Movement Breakdown Strip */}
      <div className="pt-2 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 shrink-0">
            <span>📋</span> Lead Movement Breakdown:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {summary.leadMovements.map((lm, idx) => (
              <div 
                key={idx} 
                className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1 shadow-2xs ${lm.color}`}
              >
                <span>{lm.stage}</span>
                <span className="bg-white/80 px-1.5 py-0.2 rounded-md font-mono font-extrabold text-[10px] shadow-2xs">
                  {lm.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
