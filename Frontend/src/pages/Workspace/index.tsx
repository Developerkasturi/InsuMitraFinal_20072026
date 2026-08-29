import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@store/auth.store';
import {
  useWorkspaceData,
  useClockIn,
  useClockOut,
  useUpsertDailyLog,
  useUpdateTaskStatus,
  useCreateTask,
  useEmployeeTasks
} from '@hooks/useWorkspace';
import { commissionsService, employeesService, workspaceService } from '@api/index';
import {
  Clock, CheckCircle, Play, Square,
  TrendingUp, ListTodo, ClipboardList,
  Plus, CheckSquare, Target, User, Shield,
  FileText, Users, Calendar, Phone, DollarSign,
  Filter, Check, AlertCircle, LayoutDashboard, ArrowRight, Lock, MessageSquare,
  ChevronDown, Eye, X, Briefcase, Palmtree
} from 'lucide-react';
import { format } from 'date-fns';
import { DatePicker } from '@comps/common/DatePicker';
import toast from 'react-hot-toast';
import WorkspaceHeader from './components/WorkspaceHeader';
import WorkspaceKpiCards from './components/WorkspaceKpiCards';
import UnifiedTaskActivityLog from './components/UnifiedTaskActivityLog';
import MyTasksPanel from './components/MyTasksPanel';
import DailyProductivitySummary from './components/DailyProductivitySummary';
import MonthlyPlanPanel from './components/MonthlyPlanPanel';
import JobDescriptionPanel from './components/JobDescriptionPanel';
import EmployeeLeavePanel from './components/EmployeeLeavePanel';
function formatTotalDuration(checkIn: string | Date, checkOut: string | Date) {
  const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  if (diffMs <= 0) return '0m';
  const totalMins = Math.floor(diffMs / (1000 * 60));
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

type TabType = 'today' | 'my_tasks' | 'targets' | 'leaves' | 'job_description';

const formatPreview = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return format(d, 'dd/MMM/yyyy');
  } catch {
    return '';
  }
};

export default function Workspace() {
  const user = useAuthStore(s => s.user);
  const { data: wsRes, isLoading, refetch } = useWorkspaceData();
  const clockInMutation = useClockIn();
  const clockOutMutation = useClockOut();
  const saveLogMutation = useUpsertDailyLog();
  const updateTaskStatusMutation = useUpdateTaskStatus();
  const createTaskMutation = useCreateTask();

  // Active tab state
  const [activeTab, setActiveTab] = useState<TabType>('today');

  // Task filter & form state
  const [taskStatusFilter, setTaskStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<'ALL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('ALL');
  const [taskFilterDateFrom, setTaskFilterDateFrom] = useState('');
  const [taskFilterDateTo, setTaskFilterDateTo] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [comments, setComments] = useState('');
  const [taskStartDate, setTaskStartDate] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskTargetTime, setTaskTargetTime] = useState('');
  const [taskTimeRequired, setTaskTimeRequired] = useState('');
  const [taskPriority, setTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [showAddTask, setShowAddTask] = useState(false);

  // Employee list for Task assignment
  const { data: employeesRes } = useQuery({
    queryKey: ['employees-lookup-workspace'],
    queryFn: () => employeesService.list({ limit: 100 }),
    staleTime: 5 * 60_000,
  });

  // My tasks list query
  const { data: allTasksRes, isLoading: tasksLoading } = useEmployeeTasks(
    taskStatusFilter === 'ALL' ? {} : { status: taskStatusFilter }
  );

  // My commissions — backend filters by beneficiaryId for EMPLOYEE role
  const { data: commRes, isLoading: commLoading } = useQuery({
    queryKey: ['my-commissions'],
    queryFn: () => commissionsService.list({ limit: 50 }),
    staleTime: 60_000,
  });

  // EOD fields
  const [notes, setNotes] = useState('');
  const [callsMade, setCallsMade] = useState(0);
  const [visitsCompleted, setVisitsCompleted] = useState(0);
  const [premiumCollected, setPremiumCollected] = useState(0);
  const [nextDayPlan, setNextDayPlan] = useState('');

  // Admin View Employee Workspace state
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedEmployeeUserId = searchParams.get('view_employee');
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);

  // Query for selected employee workspace data (when admin selects an employee)
  const { data: selectedEmpWsRes, isLoading: selectedEmpWsLoading } = useQuery({
    queryKey: ['workspace', 'employee-data', selectedEmployeeUserId],
    queryFn: () => selectedEmployeeUserId ? workspaceService.getEmployeeData(selectedEmployeeUserId) : null,
    enabled: !!selectedEmployeeUserId && (user?.role === 'OWNER' || user?.role === 'SUPERADMIN'),
    staleTime: 30_000,
  });

  const workspaceData = wsRes?.data || wsRes; // support both envelope formats
  const logToday = workspaceData?.dailyLog;
  const isClockedIn = !!logToday?.checkIn && !logToday?.checkOut;
  const isClockedOut = !!logToday?.checkIn && !!logToday?.checkOut;

  // Sync log fields to local state
  useEffect(() => {
    if (logToday) {
      setNotes(logToday.notes || '');
      setCallsMade(logToday.callsMade || 0);
      setVisitsCompleted(logToday.visitsCompleted || 0);
      setPremiumCollected(logToday.premiumCollected || 0);
      setNextDayPlan(logToday.nextDayPlan || '');
    }
  }, [logToday]);

  const handleClockIn = () => {
    if (isClockedOut) {
      toast.error('Attendance is locked after EOD submission for today');
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
    clockOutMutation.mutate(undefined, {
      onSuccess: () => refetch()
    });
  };

  const handleSaveLog = (e: React.FormEvent) => {
    e.preventDefault();
    saveLogMutation.mutate({
      notes,
      callsMade,
      visitsCompleted,
      premiumCollected,
      nextDayPlan
    }, {
      onSuccess: () => refetch()
    });
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    createTaskMutation.mutate({
      title: taskTitle,
      description: taskDesc || undefined,
      assignedToId: assignedToId || user?.id,
      comments: comments || undefined,
      startDate: taskStartDate ? new Date(taskStartDate).toISOString() : undefined,
      dueDate: taskDueDate ? new Date(taskDueDate).toISOString() : new Date(Date.now() + 86400000).toISOString(),
      targetTime: taskTargetTime || undefined,
      timeRequired: taskTimeRequired || undefined,
      priority: taskPriority,
    }, {
      onSuccess: () => {
        setTaskTitle('');
        setTaskDesc('');
        setComments('');
        setTaskStartDate('');
        setTaskDueDate('');
        setTaskTargetTime('');
        setTaskTimeRequired('');
        setTaskPriority('MEDIUM');
        setShowAddTask(false);
        refetch();
      }
    });
  };

  const handleToggleTask = (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    updateTaskStatusMutation.mutate({ taskId, status: nextStatus }, {
      onSuccess: () => refetch()
    });
  };

  const employeesList = (employeesRes?.data?.data || employeesRes?.data || []) as any[];
  const selectedEmployeeObj = employeesList.find((e: any) => (e.user?.id || e.userId || e.id) === selectedEmployeeUserId);

  const defaultMockCounts = { leads: 24, policies: 18, claims: 4, contacts: 36 };
  const defaultMockTarget = { monthlyTarget: 500000, progress: 382000, percentage: 76, callsTarget: 25, callsProgress: 18, visitsTarget: 5, visitsProgress: 3 };

  const activeWorkspaceData = selectedEmployeeUserId ? (selectedEmpWsRes?.data || selectedEmpWsRes) : workspaceData;
  const activeCounts = activeWorkspaceData?.counts && Object.values(activeWorkspaceData.counts).some((v: any) => Number(v) > 0)
    ? activeWorkspaceData.counts
    : (workspaceData?.counts && Object.values(workspaceData.counts).some((v: any) => Number(v) > 0) ? workspaceData.counts : defaultMockCounts);
  const activeTarget = activeWorkspaceData?.target && activeWorkspaceData.target.monthlyTarget > 0
    ? activeWorkspaceData.target
    : (workspaceData?.target && workspaceData.target.monthlyTarget > 0 ? workspaceData.target : defaultMockTarget);
  const activeTasks = activeWorkspaceData?.tasks || (workspaceData?.tasks || []);
  const activeRecentLogs = activeWorkspaceData?.recentLogs || (workspaceData?.recentLogs || []);
  const activeLogToday = activeWorkspaceData?.dailyLog;
  const activeIsClockedIn = !!activeLogToday?.checkIn && !activeLogToday?.checkOut;
  const activeIsClockedOut = !!activeLogToday?.checkIn && !!activeLogToday?.checkOut;

  const counts = activeCounts;
  const target = activeTarget;
  const tasks = activeTasks;
  const recentLogs = activeRecentLogs;

  const taskListFromApi = selectedEmployeeUserId ? activeTasks : (allTasksRes?.data || tasks);

  const filteredTasksList = useMemo(() => {
    const list = taskListFromApi || [];
    return list.filter((task: any) => {
      // 1. Status Filter
      if (taskStatusFilter !== 'ALL' && task.status !== taskStatusFilter) {
        return false;
      }
      // 2. Priority Filter
      if (taskPriorityFilter !== 'ALL' && (task.priority || 'MEDIUM') !== taskPriorityFilter) {
        return false;
      }
      // 3. Datewise Filter (matches task dueDate, startDate, or createdAt)
      const taskDateStr = task.dueDate || task.startDate || task.createdAt;
      if (taskDateStr) {
        const taskTime = new Date(taskDateStr).getTime();
        if (taskFilterDateFrom) {
          const fromTime = new Date(taskFilterDateFrom).setHours(0, 0, 0, 0);
          if (taskTime < fromTime) return false;
        }
        if (taskFilterDateTo) {
          const toTime = new Date(taskFilterDateTo).setHours(23, 59, 59, 999);
          if (taskTime > toTime) return false;
        }
      }
      return true;
    });
  }, [taskListFromApi, taskStatusFilter, taskPriorityFilter, taskFilterDateFrom, taskFilterDateTo]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. TOP KPI METRIC CARDS */}
      <WorkspaceKpiCards
        activeCounts={activeCounts}
        taskListFromApi={taskListFromApi}
      />

      {/* Admin Select Employee Modal / Modal List */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-800 flex flex-wrap items-center gap-2">
                <Users className="w-5 h-5 text-primary-600" /> Select Employee Workspace
              </h3>
              <button
                onClick={() => setIsEmployeeModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-xs text-gray-500">
              Select an employee to view their targets, active tasks, daily log reports, and performance in view-only mode.
            </p>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {employeesList.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-400">No employees found.</div>
              ) : (
                employeesList.map((emp: any) => {
                  const empUserId = emp.user?.id || emp.userId || emp.id;
                  const isSelected = selectedEmployeeUserId === empUserId;
                  return (
                    <button
                      key={empUserId}
                      onClick={() => {
                        setSearchParams({ view_employee: empUserId });
                        setIsEmployeeModalOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-xs transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-primary-50 border-primary-300 text-primary-900 font-bold'
                          : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-800 font-semibold'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs">
                          {emp.firstName?.[0] || 'E'}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900">{emp.firstName} {emp.lastName}</p>
                          <p className="text-[10px] text-gray-500">{emp.designation || 'Employee'} • {emp.email || emp.user?.email}</p>
                        </div>
                      </div>
                      <Eye className="w-4 h-4 text-primary-600 opacity-60 group-hover:opacity-100" />
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsEmployeeModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. THREE WORKSPACE NAVIGATION TABS (Mobile Responsive Horizontal Scroll) */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto no-scrollbar flex-nowrap scroll-smooth">
        <button
          onClick={() => setActiveTab('today')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${
            activeTab === 'today'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 bg-white border border-gray-100 sm:border-transparent'
          }`}
        >
          <Calendar className="w-4 h-4" /> Today
        </button>

        <button
          onClick={() => setActiveTab('my_tasks')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${
            activeTab === 'my_tasks'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 bg-white border border-gray-100 sm:border-transparent'
          }`}
        >
          <ListTodo className="w-4 h-4" /> My Tasks
        </button>

        <button
          onClick={() => setActiveTab('targets')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${
            activeTab === 'targets'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 bg-white border border-gray-100 sm:border-transparent'
          }`}
        >
          <Target className="w-4 h-4" /> Targets &amp; Commissions
        </button>

        <button
          onClick={() => setActiveTab('leaves')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${
            activeTab === 'leaves'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 bg-white border border-gray-100 sm:border-transparent'
          }`}
        >
          <Palmtree className="w-4 h-4" /> Absence &amp; Leaves
        </button>

        <button
          onClick={() => setActiveTab('job_description')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${
            activeTab === 'job_description'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 bg-white border border-gray-100 sm:border-transparent'
          }`}
        >
          <Briefcase className="w-4 h-4" /> Job Description &amp; Expectations
        </button>

        {/* "View Employee Workspace" Button Next to Tabs */}
        <div className="shrink-0 whitespace-nowrap ml-auto flex items-center gap-2">
          {selectedEmployeeUserId ? (
            <button
              onClick={() => setSearchParams({})}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm shrink-0 whitespace-nowrap"
            >
              <X className="w-4 h-4 text-amber-700" /> Clear Filter
            </button>
          ) : (
            <button
              onClick={() => setIsEmployeeModalOpen(!isEmployeeModalOpen)}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm shrink-0 whitespace-nowrap"
            >
              <Users className="w-4 h-4 text-primary-600" /> View Employee <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: TODAY (Executive Cockpit: Shift Control + Daily Summary + 3 Sub-Tabs: Overdue, Today's Queue, Today's Timeline) */}
      {activeTab === 'today' && (
        <div className="space-y-6">
          <WorkspaceHeader
            selectedEmployeeUserId={selectedEmployeeUserId}
            selectedEmployeeObj={selectedEmployeeObj}
            activeLogToday={activeLogToday}
            refetch={refetch}
          />

          {/* Auto-Captured Daily Productivity Summary Cards */}
          <DailyProductivitySummary 
            isViewOnly={!!selectedEmployeeUserId}
          />

          {/* 3 Sub-Tabs: Overdue, Today's Queue, Today's Timeline */}
          <UnifiedTaskActivityLog 
            tasks={filteredTasksList} 
            employeesList={employeesList}
            onToggleTask={handleToggleTask}
            onAddTask={(payload) => createTaskMutation.mutate(payload, { onSuccess: () => refetch() })}
            isViewOnly={!!selectedEmployeeUserId}
          />
        </div>
      )}

      {/* TAB 2: MY TASKS (TABLE & KANBAN) */}
      {activeTab === 'my_tasks' && (
        <MyTasksPanel
          tasks={filteredTasksList}
          employeesList={employeesList}
          onToggleTask={handleToggleTask}
          onAddTask={(payload) => createTaskMutation.mutate(payload, { onSuccess: () => refetch() })}
          isViewOnly={!!selectedEmployeeUserId}
        />
      )}

      {/* TAB 3: MY TARGETS & COMMISSIONS */}
      {activeTab === 'targets' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Monthly Target & Plan vs Live Actual Execution (Clubbed) */}
            <div className="lg:col-span-2">
              <MonthlyPlanPanel 
                targetData={target}
                isViewOnly={!!selectedEmployeeUserId}
              />
            </div>

            {/* Compensation Overview (Backend Sourced) */}
            <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <h2 className="text-base font-bold text-gray-800 flex flex-wrap items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" /> Real Backend Compensation
              </h2>

              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">Base Salary</span>
                  <span className="text-sm font-bold text-gray-900">₹{(target.baseSalary || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">Bonus Planned</span>
                  <span className="text-sm font-bold text-gray-900">₹{(target.bonusPlanned || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="p-3 bg-green-50/60 rounded-xl border border-green-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-green-700">Monthly Commission</span>
                  <span className="text-sm font-bold text-green-700">₹{(target.monthlyCommission || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Commissions List */}
          {(() => {
            const commList: any[] = commRes?.data ?? [];
            const totalCommission = commList.reduce((sum: number, c: any) => sum + Number(c.amount ?? 0), 0);
            const paidCommission  = commList.filter((c: any) => c.isPaid).reduce((sum: number, c: any) => sum + Number(c.amount ?? 0), 0);
            return (
              <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <h2 className="text-base font-bold text-gray-800 flex flex-wrap items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" /> Commission History (Backend Sourced)
                  </h2>
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <span className="text-gray-500">Total: <span className="font-bold text-gray-800">₹{totalCommission.toLocaleString('en-IN')}</span></span>
                    <span className="text-gray-500">Paid: <span className="font-bold text-green-600">₹{paidCommission.toLocaleString('en-IN')}</span></span>
                  </div>
                </div>

                {commLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
                  </div>
                ) : commList.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-400">No commission entries found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                      <thead>
                        <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          <th className="pb-3 px-3">Policy Details</th>
                          <th className="pb-3 px-3">Policy Number</th>
                          <th className="pb-3 px-3">Year</th>
                          <th className="pb-3 px-3 text-right">Commission Amount</th>
                          <th className="pb-3 px-3 text-right">Rate</th>
                          <th className="pb-3 px-3 text-center">Status</th>
                          <th className="pb-3 px-3">Paid Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs">
                        {commList.map((c: any) => {
                          const contactName = c.policy?.contact ? `${c.policy.contact.firstName ?? ''} ${c.policy.contact.lastName ?? ''}`.trim() : '';
                          const planName = c.policy?.plan?.name || c.policyName || 'Insurance Policy';
                          return (
                            <tr key={c.id} className="text-gray-700 hover:bg-gray-50 transition-colors">
                              <td className="py-3 px-3">
                                <div className="flex flex-col">
                                  <span className="font-bold text-gray-900 text-xs">{planName}</span>
                                  {contactName && <span className="text-[11px] text-gray-500 font-medium">Holder: {contactName}</span>}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                  #{c.policy?.policyNumber ?? '—'}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-gray-600 font-medium">{c.commissionYear?.name ?? (c.year ? `Year ${c.year}` : '—')}</td>
                              <td className="py-3 px-3 text-right font-bold text-gray-900">₹{Number(c.amount ?? 0).toLocaleString('en-IN')}</td>
                              <td className="py-3 px-3 text-right text-gray-500">{Number(c.rate ?? 0).toFixed(2)}%</td>
                              <td className="py-3 px-3 text-center">
                                <span className={c.isPaid ? 'badge-green' : 'badge-yellow'}>
                                  {c.isPaid ? 'Paid' : 'Pending'}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-gray-500">
                                {c.paidAt ? format(new Date(c.paidAt), 'dd/MMM/yyyy') : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 4: ABSENCE & LEAVES */}
      {activeTab === 'leaves' && (
        <EmployeeLeavePanel
          employeeId={selectedEmployeeUserId}
          employeeName={selectedEmployeeObj ? `${selectedEmployeeObj.firstName} ${selectedEmployeeObj.lastName}` : undefined}
          isViewOnly={!!selectedEmployeeUserId}
        />
      )}

      {/* TAB 5: JOB DESCRIPTION & ROLE EXPECTATIONS */}
      {activeTab === 'job_description' && (
        <JobDescriptionPanel
          employeeId={selectedEmployeeUserId}
          employeeName={selectedEmployeeObj ? `${selectedEmployeeObj.firstName} ${selectedEmployeeObj.lastName}` : undefined}
          isViewOnly={false}
        />
      )}

    </div>
  );
}
