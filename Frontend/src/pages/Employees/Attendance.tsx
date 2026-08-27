import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CalendarCheck, Clock, CheckCircle2, AlertCircle, XCircle, 
  Search, Edit3, MessageSquare, Coffee, Check, Plus, User, Palmtree, Sun, HeartPulse 
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesService } from '@api/index';
import DataTable, { Column } from '@comps/common/DataTable';
import Modal from '@comps/common/Modal';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { DatePicker } from '@comps/common/DatePicker';
import { sortData } from '../../utils/sortUtils';
import EmployeeLeaveModal from '../Workspace/components/EmployeeLeaveModal';
import { LeaveRecord, LEAVE_TYPE_CONFIG } from '../Workspace/components/EmployeeLeavePanel';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  name: string;
  designation: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  duration: string;
  callsMade: number;
  meetingsDone: number;
  status: 'PRESENT' | 'CLOCKED_IN' | 'HALF_DAY' | 'LATE' | 'ON_LEAVE' | 'ABSENT' | 'WFH';
  comments?: string;
}

const todayStr = format(new Date(), 'yyyy-MM-dd');

const INITIAL_MOCK_ATTENDANCE: AttendanceRecord[] = [
  {
    id: 'att-101',
    employeeId: 'emp-001',
    name: 'Rahul Sharma',
    designation: 'Senior Insurance Specialist',
    date: todayStr,
    checkIn: '09:04 AM',
    checkOut: null,
    duration: '4h 30m (Active)',
    callsMade: 22,
    meetingsDone: 3,
    status: 'CLOCKED_IN',
    comments: 'Active daily shift • On track with morning agenda'
  },
  {
    id: 'att-102',
    employeeId: 'emp-002',
    name: 'Priya Sharma',
    designation: 'Insurance Agent',
    date: todayStr,
    checkIn: '09:15 AM',
    checkOut: null,
    duration: '4h 20m (Active)',
    callsMade: 18,
    meetingsDone: 2,
    status: 'CLOCKED_IN',
    comments: 'Field visit scheduled for 2:30 PM with Star Health lead'
  },
  {
    id: 'att-103',
    employeeId: 'emp-003',
    name: 'Anjali Nair',
    designation: 'Operations Executive',
    date: todayStr,
    checkIn: '08:58 AM',
    checkOut: '01:30 PM',
    duration: '4h 32m',
    callsMade: 12,
    meetingsDone: 1,
    status: 'HALF_DAY',
    comments: 'Half day approved by manager for medical appointment'
  },
  {
    id: 'att-104',
    employeeId: 'emp-004',
    name: 'Vikram Singhania',
    designation: 'Branch Sales Manager',
    date: todayStr,
    checkIn: '09:45 AM',
    checkOut: null,
    duration: '3h 50m (Active)',
    callsMade: 15,
    meetingsDone: 4,
    status: 'LATE',
    comments: 'Late check-in due to direct client meeting in Andheri'
  },
  {
    id: 'att-105',
    employeeId: 'emp-005',
    name: 'Sneha Deshmukh',
    designation: 'Claims Coordinator',
    date: todayStr,
    checkIn: '09:00 AM',
    checkOut: null,
    duration: '4h 35m (Active)',
    callsMade: 24,
    meetingsDone: 0,
    status: 'WFH',
    comments: 'Approved remote work day for hospital cashless authorizations'
  },
  {
    id: 'att-106',
    employeeId: 'emp-006',
    name: 'Karan Verma',
    designation: 'Referral Partner',
    date: todayStr,
    checkIn: null,
    checkOut: null,
    duration: '—',
    callsMade: 0,
    meetingsDone: 0,
    status: 'ON_LEAVE',
    comments: 'Planned annual leave approved (24 Aug - 26 Aug)'
  },
  {
    id: 'att-107',
    employeeId: 'emp-007',
    name: 'Rohan Joshi',
    designation: 'Junior Sales Associate',
    date: todayStr,
    checkIn: null,
    checkOut: null,
    duration: '—',
    callsMade: 0,
    meetingsDone: 0,
    status: 'ABSENT',
    comments: 'Uninformed absence • HR follow-up triggered'
  }
];

export default function EmployeeAttendance() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [activeViewTab, setActiveViewTab] = useState<'ATTENDANCE' | 'LEAVES'>('ATTENDANCE');
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Leave records state
  const [leavesList, setLeavesList] = useState<LeaveRecord[]>(() => {
    try {
      const saved = localStorage.getItem('insumitra_employee_leaves');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
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
        employeeId: 'emp-003',
        employeeName: 'Anjali Nair',
        leaveType: 'HALF_DAY',
        startDate: '2026-08-27',
        endDate: '2026-08-27',
        daysCount: 0.5,
        reason: '[2nd Half] Medical dental checkup',
        status: 'APPROVED',
        appliedAt: '2026-08-27',
        approvedBy: 'Agency Owner'
      },
      {
        id: 'leave-003',
        employeeId: 'emp-006',
        employeeName: 'Karan Verma',
        leaveType: 'EARNED',
        startDate: '2026-08-24',
        endDate: '2026-08-26',
        daysCount: 3,
        reason: 'Planned annual leave approved',
        status: 'APPROVED',
        appliedAt: '2026-08-20',
        approvedBy: 'Agency Owner'
      },
      {
        id: 'leave-004',
        employeeId: 'emp-002',
        employeeName: 'Priya Sharma',
        leaveType: 'SICK',
        startDate: '2026-09-02',
        endDate: '2026-09-03',
        daysCount: 2,
        reason: 'Pre-scheduled hospital diagnostics & rest',
        status: 'PENDING',
        appliedAt: '2026-08-26'
      }
    ];
  });

  const handleUpdateLeaveStatus = (leaveId: string, newStatus: 'APPROVED' | 'REJECTED') => {
    const updated = leavesList.map(l => {
      if (l.id === leaveId) {
        return {
          ...l,
          status: newStatus,
          approvedBy: newStatus === 'APPROVED' ? 'Manager (Approved)' : 'Manager (Rejected)'
        };
      }
      return l;
    });
    setLeavesList(updated);
    try {
      localStorage.setItem('insumitra_employee_leaves', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
    toast.success(`Leave request ${newStatus === 'APPROVED' ? 'Approved' : 'Rejected'}`);
  };

  // Attendance Records State
  const [records, setRecords] = useState<AttendanceRecord[]>(() => {
    try {
      const saved = localStorage.getItem('insumitra_attendance_logs');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_MOCK_ATTENDANCE;
  });

  // Modal State for Changing Attendance Status
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [newStatus, setNewStatus] = useState<AttendanceRecord['status']>('PRESENT');
  const [checkInInput, setCheckInInput] = useState('');
  const [checkOutInput, setCheckOutInput] = useState('');
  const [statusComment, setStatusComment] = useState('');

  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data: apiData, isLoading } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => employeesService.list({ page: 1, limit: 500 }),
  });

  const filteredRecords = React.useMemo(() => {
    return records.filter(r => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return r.name.toLowerCase().includes(q) || r.designation.toLowerCase().includes(q) || (r.comments || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [records, statusFilter, searchQuery]);

  const sortedRecords = React.useMemo(() => {
    return sortData(filteredRecords, sortKey, sortDir, (row: any, key: string) => {
      if (key === 'name') return row.name;
      return row[key];
    });
  }, [filteredRecords, sortKey, sortDir]);

  const paginatedRecords = React.useMemo(() => {
    const start = (page - 1) * 20;
    return sortedRecords.slice(start, start + 20);
  }, [sortedRecords, page]);

  // Aggregate Metrics
  const totalEmployees = records.length;
  const presentCount = records.filter(r => r.status === 'PRESENT' || r.status === 'CLOCKED_IN' || r.status === 'WFH').length;
  const lateHalfDayCount = records.filter(r => r.status === 'LATE' || r.status === 'HALF_DAY').length;
  const leaveCount = records.filter(r => r.status === 'ON_LEAVE').length;
  const absentCount = records.filter(r => r.status === 'ABSENT').length;

  const openStatusModal = (rec: AttendanceRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingRecord(rec);
    setNewStatus(rec.status);
    setCheckInInput(rec.checkIn || '09:00 AM');
    setCheckOutInput(rec.checkOut || '');
    setStatusComment(rec.comments || '');
    setStatusModalOpen(true);
  };

  const handleSaveStatusChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    if (!statusComment.trim()) {
      toast.error('Please provide a reason / comment for this attendance update');
      return;
    }

    const updatedList = records.map(item => {
      if (item.id === editingRecord.id || item.employeeId === editingRecord.employeeId) {
        return {
          ...item,
          status: newStatus,
          checkIn: newStatus === 'ABSENT' || newStatus === 'ON_LEAVE' ? null : checkInInput || '09:00 AM',
          checkOut: checkOutInput || item.checkOut,
          duration: newStatus === 'ABSENT' || newStatus === 'ON_LEAVE' ? '—' : (checkOutInput ? '8h 00m' : item.duration),
          comments: statusComment.trim()
        };
      }
      return item;
    });

    setRecords(updatedList);
    try {
      localStorage.setItem('insumitra_attendance_logs', JSON.stringify(updatedList));
    } catch (e) {}

    setStatusModalOpen(false);
    toast.success(`Attendance status for ${editingRecord.name} updated to ${newStatus}`);
  };

  const getStatusBadge = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'CLOCKED_IN':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active Shift
          </span>
        );
      case 'PRESENT':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-fit">
            <CheckCircle2 size={11} /> Present
          </span>
        );
      case 'HALF_DAY':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 w-fit">
            <Clock size={11} /> Half Day
          </span>
        );
      case 'LATE':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-orange-100 text-orange-800 border border-orange-300 flex items-center gap-1 w-fit">
            <AlertCircle size={11} /> Late Entry
          </span>
        );
      case 'WFH':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1 w-fit">
            🏠 WFH
          </span>
        );
      case 'ON_LEAVE':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1 w-fit">
            <Coffee size={11} /> On Leave
          </span>
        );
      case 'ABSENT':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1 w-fit">
            <XCircle size={11} /> Absent
          </span>
        );
    }
  };

  const cols: Column<AttendanceRecord>[] = [
    {
      key: 'name',
      label: 'EMPLOYEE',
      render: r => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
            {r.name?.[0]}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-gray-900 leading-tight">{r.name}</span>
            <span className="text-[10px] text-gray-400 font-medium">{r.designation}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'date',
      label: 'DATE',
      render: r => <span className="text-xs font-bold text-slate-700">{r.date}</span>,
    },
    {
      key: 'checkIn',
      label: 'CLOCK IN / OUT',
      render: r => (
        <div className="flex flex-col text-xs font-mono">
          <span className="font-bold text-slate-800">In: {r.checkIn || '—'}</span>
          <span className="text-[11px] text-slate-400">Out: {r.checkOut || (r.checkIn ? 'In Progress' : '—')}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'ATTENDANCE STATUS',
      render: r => getStatusBadge(r.status),
    },
    {
      key: 'comments' as any,
      label: 'ADMIN REMARKS & REASON',
      render: r => (
        <div className="max-w-xs text-xs text-slate-600 font-medium">
          <p className="line-clamp-2 leading-relaxed bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
            {r.comments || 'Standard daily shift logged'}
          </p>
        </div>
      ),
    },
    {
      key: 'actions' as any,
      label: 'ACTIONS',
      render: r => (
        <div className="flex items-center justify-start gap-1.5" onClick={e => e.stopPropagation()}>
          <button
            title="Change Attendance Status & Comments"
            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs transition-all"
            onClick={e => openStatusModal(r, e)}
          >
            <Edit3 size={12} />
            <span>Update Status</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">

      {/* ── Top Header with Action Buttons ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200/70">
          <button
            type="button"
            onClick={() => setActiveViewTab('ATTENDANCE')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeViewTab === 'ATTENDANCE'
                ? 'bg-white text-purple-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <CalendarCheck size={14} className={activeViewTab === 'ATTENDANCE' ? 'text-purple-600' : ''} />
            <span>Attendance Register</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveViewTab('LEAVES')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeViewTab === 'LEAVES'
                ? 'bg-white text-indigo-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Palmtree size={14} className={activeViewTab === 'LEAVES' ? 'text-indigo-600' : ''} />
            <span>Leave Requests &amp; Absence ({leavesList.filter(l => l.status === 'PENDING').length > 0 ? `${leavesList.filter(l => l.status === 'PENDING').length} Pending` : leavesList.length})</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setLeaveModalOpen(true)}
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-purple-500/20 flex items-center gap-1.5 cursor-pointer"
        >
          <Plus size={14} />
          <span>Mark Absence / Apply Leave</span>
        </button>
      </div>
      
      {/* ── Top Summary KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase">Present Today</span>
            <p className="text-xl font-black text-emerald-600 mt-0.5">{presentCount} / {totalEmployees}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase">Late / Half Day</span>
            <p className="text-xl font-black text-amber-600 mt-0.5">{lateHalfDayCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase">On Approved Leave</span>
            <p className="text-xl font-black text-purple-600 mt-0.5">{leaveCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase">Absent</span>
            <p className="text-xl font-black text-rose-600 mt-0.5">{absentCount}</p>
          </div>
        </div>
      </div>

      {/* Filter & Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by employee name or remarks..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-purple-500 font-medium"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {['ALL', 'CLOCKED_IN', 'HALF_DAY', 'LATE', 'WFH', 'ON_LEAVE', 'ABSENT'].map(st => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'ALL' ? 'All Records' : st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {activeViewTab === 'ATTENDANCE' ? (
        <>
          <DataTable
            columns={cols.map(c => ({ ...c, sortable: c.key !== 'actions' }))}
            data={paginatedRecords}
            total={sortedRecords.length}
            page={page}
            pageSize={20}
            loading={isLoading}
            rowKey={r => r.id}
            onPageChange={setPage}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={(k) => {
              if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
              else { setSortKey(k); setSortDir('asc'); }
            }}
            onRowClick={r => navigate(`/employees/${r.employeeId}`)}
          />
        </>
      ) : (
        /* ── LEAVE APPLICATIONS & ABSENCE TRACKER VIEW ── */
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Palmtree className="w-4 h-4 text-indigo-600" />
                Team Leave Requests &amp; Absence Applications ({leavesList.length})
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Review, approve, or reject employee leave and absence declarations.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                {leavesList.filter(l => l.status === 'PENDING').length} Pending Review
              </span>
            </div>
          </div>

          {leavesList.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 font-medium">
              No leave applications recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-3 px-3">Employee</th>
                    <th className="py-3 px-3">Leave Type</th>
                    <th className="py-3 px-3">Duration &amp; Dates</th>
                    <th className="py-3 px-3">Days</th>
                    <th className="py-3 px-3">Reason / Remarks</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Approval Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {leavesList.map(l => {
                    const cfg = LEAVE_TYPE_CONFIG[l.leaveType] || LEAVE_TYPE_CONFIG.CASUAL;
                    const Icon = cfg.icon;
                    return (
                      <tr key={l.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 font-bold text-xs flex items-center justify-center shrink-0">
                              {l.employeeName?.[0] || 'E'}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 leading-tight">{l.employeeName}</p>
                              <span className="text-[10px] text-slate-400">Applied: {l.appliedAt}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border flex items-center gap-1 w-fit ${cfg.color}`}>
                            <Icon size={11} /> {cfg.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="font-bold text-slate-800">
                            {l.startDate === l.endDate ? l.startDate : `${l.startDate} → ${l.endDate}`}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md text-[11px] border border-indigo-100">
                            {l.daysCount} {l.daysCount === 1 ? 'day' : 'days'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 max-w-xs">
                          <p className="line-clamp-2 text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-100 text-[11px]">
                            {l.reason}
                          </p>
                        </td>
                        <td className="py-3.5 px-3">
                          {l.status === 'APPROVED' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Approved
                            </span>
                          )}
                          {l.status === 'PENDING' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                              Pending
                            </span>
                          )}
                          {l.status === 'REJECTED' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                              Rejected
                            </span>
                          )}
                          {l.status === 'CANCELLED' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-500">
                              Cancelled
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          {l.status === 'PENDING' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateLeaveStatus(l.id, 'APPROVED')}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer shadow-2xs"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateLeaveStatus(l.id, 'REJECTED')}
                                className="px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-[11px] cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium">
                              {l.approvedBy || 'Completed'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Leave Application & Absence Modal */}
      <EmployeeLeaveModal
        isOpen={leaveModalOpen}
        onClose={() => setLeaveModalOpen(false)}
      />

      {/* Change Attendance Status & Comments Modal */}
      <Modal
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title={editingRecord ? `Modify Attendance: ${editingRecord.name}` : 'Update Attendance'}
        size="md"
      >
        {editingRecord && (
          <form onSubmit={handleSaveStatusChange} className="space-y-4">
            
            {/* Quick Profile Info */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="w-9 h-9 rounded-xl bg-purple-600 text-white font-bold text-xs flex items-center justify-center">
                {editingRecord.name?.[0]}
              </div>
              <div>
                <h4 className="text-xs font-black text-gray-900">{editingRecord.name}</h4>
                <p className="text-[11px] text-gray-500 font-medium">{editingRecord.designation} • Date: {editingRecord.date}</p>
              </div>
            </div>

            {/* Status Selector */}
            <div>
              <label className="label font-bold text-gray-700 block mb-1">
                Attendance Status <span className="text-red-500">*</span>
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as any)}
                className="input w-full p-2.5 text-xs font-bold border rounded-xl bg-white"
              >
                <option value="CLOCKED_IN">Active Shift / Clocked In</option>
                <option value="PRESENT">Present (Full Day Complete)</option>
                <option value="HALF_DAY">Half Day</option>
                <option value="LATE">Late Check-in</option>
                <option value="WFH">Work From Home (WFH)</option>
                <option value="ON_LEAVE">On Approved Leave</option>
                <option value="ABSENT">Absent (Uninformed)</option>
              </select>
            </div>

            {/* Check-in and Check-out Times */}
            {newStatus !== 'ABSENT' && newStatus !== 'ON_LEAVE' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Check-In Time</label>
                  <input
                    type="text"
                    value={checkInInput}
                    onChange={(e) => setCheckInInput(e.target.value)}
                    placeholder="e.g. 09:15 AM"
                    className="input text-xs"
                  />
                </div>
                <div>
                  <label className="label">Check-Out Time</label>
                  <input
                    type="text"
                    value={checkOutInput}
                    onChange={(e) => setCheckOutInput(e.target.value)}
                    placeholder="e.g. 06:30 PM"
                    className="input text-xs"
                  />
                </div>
              </div>
            )}

            {/* Mandatory Reason / Comments */}
            <div>
              <label className="label font-bold text-gray-700 block mb-1">
                Reason &amp; Remarks <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={statusComment}
                onChange={(e) => setStatusComment(e.target.value)}
                placeholder="Specify the reason or approval details (e.g. 'Approved half-day for medical visit', 'Client meeting delay regularized by manager')..."
                className="input w-full p-2.5 text-xs rounded-xl border font-medium"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStatusModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer"
              >
                Save Attendance Status
              </button>
            </div>

          </form>
        )}
      </Modal>

    </div>
  );
}
