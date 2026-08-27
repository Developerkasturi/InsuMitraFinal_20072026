import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Download, Eye, Filter, Calendar, Users, 
  CheckCircle2, Clock, TrendingUp, CreditCard, HeartPulse, 
  FileCheck2, RefreshCw, IndianRupee, Sparkles, ShieldCheck, ChevronDown 
} from 'lucide-react';
import { employeesService } from '@api/index';
import DataTable, { Column } from '@comps/common/DataTable';
import Modal from '@comps/common/Modal';
import * as XLSX from 'xlsx';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { DatePicker } from '@comps/common/DatePicker';
import toast from 'react-hot-toast';
import type { Employee } from './EmployeesLayout';
import { sortData } from '../../utils/sortUtils';
import EmployeeDailyDrillDown, { DailyDrillDownRecord } from './components/EmployeeDailyDrillDown';

// ── Mock Detailed Daily Records for Period Reporting ──
const MOCK_PERIOD_RECORDS: DailyDrillDownRecord[] = [
  {
    date: '2026-08-22',
    employeeId: 'emp-001',
    employeeName: 'Rahul Sharma',
    designation: 'Senior Insurance Specialist',
    department: 'Sales',
    attendanceStatus: 'PRESENT',
    clockInTime: '09:04 AM',
    clockOutTime: '06:15 PM',
    breakDuration: '45m',
    netWorkingHours: '8h 26m',
    tasksCompleted: 7,
    leadMovements: 14,
    installmentsClosed: 5,
    phcsCompleted: 3,
    claimsHandled: 2,
    renewalsClosed: 4,
    premiumGenerated: 125000,
    eodNotes: 'Followed up with 14 leads, converted 2 Star Health proposals. Verified KYC for Policy #POL-8902.',
    nextDayPlan: '1. Follow up on 5 corporate renewal leads.\n2. Submit medical test report for Dr. Vikrant.',
    timelineEvents: [
      { id: 't1', time: '09:04 AM', title: 'Clocked In — Shift Started', category: 'Attendance', isAutoCaptured: true },
      { id: 't2', time: '09:20 AM – 09:45 AM', duration: '25m', title: 'Lead Follow-up Calls (5 Leads)', category: 'Sales', outcome: 'Quotation sent for Star Comprehensive ₹10L', isAutoCaptured: true },
      { id: 't3', time: '10:00 AM – 10:40 AM', duration: '40m', title: 'Customer In-Person Proposal Discussion', category: 'Client Visit', outcome: 'Agreed on HDFC Life Click 2 Protect ₹1.5 Cr', isAutoCaptured: false },
      { id: 't4', time: '10:50 AM – 11:30 AM', duration: '40m', title: 'Policy Processing & Documentation Upload', category: 'Operations', outcome: 'KYC & Medical reports submitted to insurer', isAutoCaptured: true },
      { id: 't5', time: '11:45 AM – 12:20 PM', duration: '35m', title: 'Renewal Follow-up & Payment Link Sharing', category: 'Renewals', outcome: 'Shared direct payment link (₹24,500)', isAutoCaptured: true },
      { id: 't6', time: '01:00 PM – 01:45 PM', duration: '45m', title: 'Lunch Break (Deducted from Work Time)', category: 'Break', isBreak: true },
      { id: 't7', time: '02:00 PM – 03:00 PM', duration: '60m', title: 'Motor Accident Claim Survey Assistance', category: 'Claims', outcome: 'Garage estimate verified and approved', isAutoCaptured: true },
    ]
  },
  {
    date: '2026-08-22',
    employeeId: 'emp-002',
    employeeName: 'Priya Sharma',
    designation: 'Insurance Agent',
    department: 'Sales',
    attendanceStatus: 'PRESENT',
    clockInTime: '09:15 AM',
    clockOutTime: '06:00 PM',
    breakDuration: '30m',
    netWorkingHours: '8h 15m',
    tasksCompleted: 6,
    leadMovements: 9,
    installmentsClosed: 3,
    phcsCompleted: 2,
    claimsHandled: 1,
    renewalsClosed: 2,
    premiumGenerated: 85000,
    eodNotes: 'Closed 2 motor policy renewals and collected 3 premium installments.',
    nextDayPlan: '1. Contact 8 new online leads.\n2. Submit claim endorsement docs.',
    timelineEvents: [
      { id: 't1', time: '09:15 AM', title: 'Clocked In', category: 'Attendance', isAutoCaptured: true },
      { id: 't2', time: '10:00 AM', duration: '30m', title: 'Motor Renewal Follow-ups', category: 'Renewals', outcome: '2 policies renewed successfully', isAutoCaptured: true },
      { id: 't3', time: '01:15 PM', duration: '30m', title: 'Lunch Break', category: 'Break', isBreak: true },
      { id: 't4', time: '03:00 PM', duration: '45m', title: 'Claim Intimation Form Fill', category: 'Claims', outcome: 'Claim submitted to Care Health', isAutoCaptured: true },
    ]
  },
  {
    date: '2026-08-21',
    employeeId: 'emp-001',
    employeeName: 'Rahul Sharma',
    designation: 'Senior Insurance Specialist',
    department: 'Sales',
    attendanceStatus: 'PRESENT',
    clockInTime: '09:00 AM',
    clockOutTime: '06:30 PM',
    breakDuration: '40m',
    netWorkingHours: '8h 50m',
    tasksCompleted: 9,
    leadMovements: 16,
    installmentsClosed: 6,
    phcsCompleted: 4,
    claimsHandled: 3,
    renewalsClosed: 5,
    premiumGenerated: 190000,
    eodNotes: 'Exceeded daily target. Handled 3 major claim surveys and assisted 4 PHC bookings.',
    nextDayPlan: 'Follow up on pending KYC documents.',
    timelineEvents: [
      { id: 't1', time: '09:00 AM', title: 'Clocked In', category: 'Attendance', isAutoCaptured: true },
      { id: 't2', time: '11:00 AM', duration: '50m', title: 'Comprehensive Family Floater Proposal', category: 'Sales', outcome: 'Proposal issued', isAutoCaptured: true },
    ]
  },
  {
    date: '2026-08-21',
    employeeId: 'emp-003',
    employeeName: 'Anjali Nair',
    designation: 'Operations Executive',
    department: 'Operations',
    attendanceStatus: 'PRESENT',
    clockInTime: '09:30 AM',
    clockOutTime: '06:10 PM',
    breakDuration: '45m',
    netWorkingHours: '7h 55m',
    tasksCompleted: 11,
    leadMovements: 6,
    installmentsClosed: 8,
    phcsCompleted: 5,
    claimsHandled: 4,
    renewalsClosed: 3,
    premiumGenerated: 95000,
    eodNotes: 'Reconciled 8 bank payment installments and processed 5 PHC vouchers.',
    nextDayPlan: 'Audit monthly policy issuance register.',
    timelineEvents: [
      { id: 't1', time: '09:30 AM', title: 'Clocked In', category: 'Attendance', isAutoCaptured: true },
      { id: 't2', time: '10:15 AM', duration: '60m', title: 'Installment Bank Reconciliation', category: 'Operations', outcome: '8 payments verified', isAutoCaptured: true },
    ]
  },
  {
    date: '2026-08-20',
    employeeId: 'emp-002',
    employeeName: 'Priya Sharma',
    designation: 'Insurance Agent',
    department: 'Sales',
    attendanceStatus: 'PRESENT',
    clockInTime: '09:05 AM',
    clockOutTime: '05:45 PM',
    breakDuration: '30m',
    netWorkingHours: '8h 10m',
    tasksCompleted: 5,
    leadMovements: 8,
    installmentsClosed: 4,
    phcsCompleted: 2,
    claimsHandled: 2,
    renewalsClosed: 3,
    premiumGenerated: 72000,
    eodNotes: 'Handled customer renewal callbacks and shared quotes.',
    nextDayPlan: 'Follow up with lead pipeline.',
    timelineEvents: [
      { id: 't1', time: '09:05 AM', title: 'Clocked In', category: 'Attendance', isAutoCaptured: true },
    ]
  }
];

export default function EmployeeEodReports() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Filter States
  const [selectedEmpId, setSelectedEmpId] = useState<string>('ALL');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // Drill-down Modal State
  const [drillDownRecord, setDrillDownRecord] = useState<DailyDrillDownRecord | null>(null);
  const [isDrillDownOpen, setIsDrillDownOpen] = useState(false);

  // Sorting
  const [sortKey, setSortKey] = useState<string>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Employee list query for dropdown
  const { data: empData } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => employeesService.list({ page: 1, limit: 500 }),
  });
  const employeeOptions = (empData?.data ?? empData ?? []) as any[];

  // Quick Preset Handlers
  const handleQuickPreset = (preset: 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_MONTH') => {
    const today = new Date();
    if (preset === 'TODAY') {
      const d = format(today, 'yyyy-MM-dd');
      setDateFrom(d);
      setDateTo(d);
    } else if (preset === 'THIS_WEEK') {
      setDateFrom(format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
      setDateTo(format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
    } else if (preset === 'THIS_MONTH') {
      setDateFrom(format(startOfMonth(today), 'yyyy-MM-dd'));
      setDateTo(format(endOfMonth(today), 'yyyy-MM-dd'));
    } else if (preset === 'LAST_MONTH') {
      const prev = subMonths(today, 1);
      setDateFrom(format(startOfMonth(prev), 'yyyy-MM-dd'));
      setDateTo(format(endOfMonth(prev), 'yyyy-MM-dd'));
    }
  };

  // Filtered Period Records
  const filteredRecords = useMemo(() => {
    return MOCK_PERIOD_RECORDS.filter(r => {
      // 1. Employee Filter
      if (selectedEmpId !== 'ALL' && r.employeeId !== selectedEmpId && !r.employeeName.toLowerCase().includes(selectedEmpId.toLowerCase())) {
        return false;
      }
      // 2. Department Filter
      if (selectedDept !== 'ALL' && r.department !== selectedDept) {
        return false;
      }
      // 3. Date Range Filter
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;

      return true;
    });
  }, [selectedEmpId, selectedDept, dateFrom, dateTo]);

  // Aggregated Summary Statistics for Selected Period
  const periodTotals = useMemo(() => {
    const totalWorkingDays = filteredRecords.length;
    const totalTasks = filteredRecords.reduce((sum, r) => sum + r.tasksCompleted, 0);
    const totalLeadMoves = filteredRecords.reduce((sum, r) => sum + r.leadMovements, 0);
    const totalInstallments = filteredRecords.reduce((sum, r) => sum + r.installmentsClosed, 0);
    const totalPHCs = filteredRecords.reduce((sum, r) => sum + r.phcsCompleted, 0);
    const totalClaims = filteredRecords.reduce((sum, r) => sum + r.claimsHandled, 0);
    const totalRenewals = filteredRecords.reduce((sum, r) => sum + r.renewalsClosed, 0);
    const totalPremium = filteredRecords.reduce((sum, r) => sum + r.premiumGenerated, 0);

    return {
      totalWorkingDays,
      totalTasks,
      totalLeadMoves,
      totalInstallments,
      totalPHCs,
      totalClaims,
      totalRenewals,
      totalPremium
    };
  }, [filteredRecords]);

  // Full Multi-Column Excel Export Handler
  const handleExportExcel = () => {
    if (filteredRecords.length === 0) {
      toast.error('No records available in selected period to export');
      return;
    }

    const exportRows = filteredRecords.map(r => ({
      'Date': r.date,
      'Employee ID': r.employeeId,
      'Employee Name': r.employeeName,
      'Designation': r.designation,
      'Department': r.department,
      'Attendance': r.attendanceStatus,
      'Clock In': r.clockInTime,
      'Clock Out': r.clockOutTime,
      'Break Time': r.breakDuration,
      'Net Working Hours': r.netWorkingHours,
      'Tasks Completed': r.tasksCompleted,
      'Lead Stage Movements': r.leadMovements,
      'Installments Closed': r.installmentsClosed,
      'PHC Completed': r.phcsCompleted,
      'Claims Handled': r.claimsHandled,
      'Renewals Closed': r.renewalsClosed,
      'Premium Generated (₹)': r.premiumGenerated,
      'EOD Accomplishments': r.eodNotes || '—',
      'Next Day Plan': r.nextDayPlan || '—',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Productivity Report');
    XLSX.writeFile(workbook, `InsuMitra_Employer_Report_${dateFrom}_to_${dateTo}.xlsx`);
    toast.success('Excel Productivity Report downloaded successfully!');
  };

  const openDrillDown = (record: DailyDrillDownRecord) => {
    setDrillDownRecord(record);
    setIsDrillDownOpen(true);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      
      {/* ── 1. Selection & Date Range Toolbar ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" /> Employer Workforce Productivity &amp; Date-Range Reports
            </h3>
            <p className="text-[11px] text-slate-500">
              Select an employee and custom date range to inspect automatic CRM deliverables, net working hours, and EOD timelines
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export Excel Report (.xlsx)
          </button>
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Employee Dropdown */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Select Employee</label>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-semibold text-slate-800"
            >
              <option value="ALL">👥 All Employees ({employeeOptions.length || 3})</option>
              <option value="emp-001">Rahul Sharma (Senior Insurance Specialist)</option>
              <option value="emp-002">Priya Sharma (Insurance Agent)</option>
              <option value="emp-003">Anjali Nair (Operations Executive)</option>
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Department</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-semibold text-slate-800"
            >
              <option value="ALL">All Departments</option>
              <option value="Sales">Sales</option>
              <option value="Operations">Operations</option>
              <option value="Renewals">Renewals</option>
              <option value="Claims">Claims</option>
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">From Date</label>
            <DatePicker
              value={dateFrom}
              onChange={(val) => setDateFrom(val)}
              placeholder="From Date"
              className="w-full"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">To Date</label>
            <DatePicker
              value={dateTo}
              onChange={(val) => setDateTo(val)}
              placeholder="To Date"
              className="w-full"
            />
          </div>
        </div>

        {/* Quick Date Range Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-bold text-slate-500">Quick Presets:</span>
          <button
            type="button"
            onClick={() => handleQuickPreset('TODAY')}
            className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset('THIS_WEEK')}
            className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            This Week
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset('THIS_MONTH')}
            className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors cursor-pointer"
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset('LAST_MONTH')}
            className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Last Month
          </button>
        </div>
      </div>

      {/* ── 2. Aggregated Summary Metric Strip for Selected Period ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 block uppercase">Work Shifts</span>
          <span className="text-xl font-black text-slate-800">{periodTotals.totalWorkingDays}</span>
          <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">Days Logged</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 block uppercase">Tasks Done</span>
          <span className="text-xl font-black text-emerald-700">{periodTotals.totalTasks}</span>
          <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">Completed</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-blue-400 block uppercase">Lead Moves</span>
          <span className="text-xl font-black text-blue-900">{periodTotals.totalLeadMoves}</span>
          <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">Stages Changed</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-purple-400 block uppercase">Installments</span>
          <span className="text-xl font-black text-purple-900">{periodTotals.totalInstallments}</span>
          <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">EMIs Closed</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-rose-400 block uppercase">PHC Checkups</span>
          <span className="text-xl font-black text-rose-900">{periodTotals.totalPHCs}</span>
          <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">Completed</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-amber-500 block uppercase">Claims</span>
          <span className="text-xl font-black text-amber-900">{periodTotals.totalClaims}</span>
          <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">Handled</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-teal-400 block uppercase">Renewals</span>
          <span className="text-xl font-black text-teal-900">{periodTotals.totalRenewals}</span>
          <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">Retention Closed</span>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-3 rounded-xl border border-emerald-200 shadow-xs">
          <span className="text-[10px] font-bold text-emerald-700 block uppercase">Premium (₹)</span>
          <span className="text-lg font-black text-emerald-900 truncate block">
            ₹{(periodTotals.totalPremium).toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">Total Revenue</span>
        </div>
      </div>

      {/* ── 3. Consolidated Daily Breakdown Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-600" />
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Daily Breakdown Log ({filteredRecords.length} Shifts Found)
            </h4>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Click any row to open the full chronological timeline &amp; audit drill-down
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Net Work Time</th>
                <th className="py-3 px-3 text-center">Tasks</th>
                <th className="py-3 px-3 text-center">Leads Moved</th>
                <th className="py-3 px-3 text-center">Installments</th>
                <th className="py-3 px-3 text-center">PHC</th>
                <th className="py-3 px-3 text-center">Claims</th>
                <th className="py-3 px-4 text-right">Premium (₹)</th>
                <th className="py-3 px-4 text-right">Drill-Down</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-10 text-slate-400 font-medium">
                    No productivity logs found for the selected employee and date range.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, idx) => (
                  <tr 
                    key={idx}
                    onClick={() => openDrillDown(r)}
                    className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {r.date}
                    </td>

                    <td className="py-3 px-4">
                      <div>
                        <p className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                          {r.employeeName}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {r.designation} • {r.department}
                        </p>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {r.attendanceStatus}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-slate-800">
                        {r.netWorkingHours}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-normal">
                        ({r.breakDuration} break deducted)
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center font-bold text-slate-800">
                      {r.tasksCompleted}
                    </td>

                    <td className="py-3 px-3 text-center font-bold text-blue-700">
                      {r.leadMovements}
                    </td>

                    <td className="py-3 px-3 text-center font-bold text-purple-700">
                      {r.installmentsClosed}
                    </td>

                    <td className="py-3 px-3 text-center font-bold text-rose-700">
                      {r.phcsCompleted}
                    </td>

                    <td className="py-3 px-3 text-center font-bold text-amber-700">
                      {r.claimsHandled}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800">
                      ₹{r.premiumGenerated.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDrillDown(r);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white text-[11px] font-bold transition-all flex items-center gap-1 ml-auto cursor-pointer"
                      >
                        <Eye className="w-3 h-3" /> Inspect Day
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 4. Day-Level Detailed Timeline Drill-Down Modal ── */}
      <EmployeeDailyDrillDown
        isOpen={isDrillDownOpen}
        onClose={() => setIsDrillDownOpen(false)}
        record={drillDownRecord}
      />

    </div>
  );
}
