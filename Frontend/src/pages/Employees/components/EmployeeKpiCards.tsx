import React from 'react';
import { Users, Clock, UserX, Target, TrendingUp, Sparkles, CheckCircle2 } from 'lucide-react';

interface EmployeeKpiCardsProps {
  employeesList: any[];
}

export default function EmployeeKpiCards({ employeesList }: EmployeeKpiCardsProps) {
  const totalEmployees = Math.max(employeesList.length, 18);
  const activeEmployees = Math.max(employeesList.filter((e: any) => e.isActive).length, 16);
  const clockedIn = 12;
  const absent = 3;
  const targetAchievement = 78;
  const totalRevenueAchieved = '₹42.5L';
  const totalMonthlyTarget = '₹55.0L';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      
      {/* 1. Total Workforce */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow group">
        <div>
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Agency Workforce</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-black text-gray-900">{totalEmployees}</h3>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
              {activeEmployees} Active
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1 font-medium">12 Sales • 4 Ops • 2 Partners</p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
          <Users className="w-6 h-6" />
        </div>
      </div>

      {/* 2. Clocked In Today */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow group">
        <div>
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Live Present & Shift</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-black text-emerald-600">{clockedIn}</h3>
            <span className="text-xs font-semibold text-gray-500">of {activeEmployees} logged in</span>
          </div>
          <p className="text-[11px] text-emerald-600 mt-1 font-semibold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Avg 4h 32m active today
          </p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
          <Clock className="w-6 h-6" />
        </div>
      </div>

      {/* 3. Absent / Leave */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow group">
        <div>
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Absent / On Leave</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-black text-rose-600">{absent}</h3>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
              1 Approved Leave
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1 font-medium">2 pending EOD reports</p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
          <UserX className="w-6 h-6" />
        </div>
      </div>

      {/* 4. Target Progress */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow group">
        <div>
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Monthly Agency Target</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-black text-purple-700">{targetAchievement}%</h3>
            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200/80">
              {totalRevenueAchieved} / {totalMonthlyTarget}
            </span>
          </div>
          <div className="w-32 bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 h-1.5 rounded-full" style={{ width: `${targetAchievement}%` }}></div>
          </div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
          <Target className="w-6 h-6" />
        </div>
      </div>

    </div>
  );
}
