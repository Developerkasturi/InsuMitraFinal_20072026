import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
import { commissionsService, employeesService } from '@api/index';
import {
  Clock, CheckCircle, Play, Square,
  TrendingUp, ListTodo, ClipboardList,
  Plus, CheckSquare, Target, User, Shield,
  FileText, Users, Calendar, Phone, DollarSign,
  Filter, Check, AlertCircle, LayoutDashboard, ArrowRight, Lock, MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

function formatTotalDuration(checkIn: string | Date, checkOut: string | Date) {
  const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  if (diffMs <= 0) return '0m';
  const totalMins = Math.floor(diffMs / (1000 * 60));
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

type TabType = 'overview' | 'tasks' | 'daily_log' | 'targets';

export default function Workspace() {
  const user = useAuthStore(s => s.user);
  const { data: wsRes, isLoading, refetch } = useWorkspaceData();
  const clockInMutation = useClockIn();
  const clockOutMutation = useClockOut();
  const saveLogMutation = useUpsertDailyLog();
  const updateTaskStatusMutation = useUpdateTaskStatus();
  const createTaskMutation = useCreateTask();

  // Active tab state
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Task filter & form state
  const [taskStatusFilter, setTaskStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');
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

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  const counts = workspaceData?.counts || { leads: 0, policies: 0, claims: 0, contacts: 0 };
  const target = workspaceData?.target || { monthlyTarget: 0, progress: 0, percentage: 0 };
  const tasks = workspaceData?.tasks || [];
  const recentLogs = workspaceData?.recentLogs || [];

  const taskListFromApi = allTasksRes?.data || tasks;
  const employeesList = (employeesRes?.data as any[]) || [];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-gradient-to-r from-primary-800 to-primary-600 rounded-2xl p-6 text-white shadow-lg">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {user?.firstName}!</h1>
          <p className="text-primary-100 text-sm mt-1">
            Role: <span className="font-semibold">{user?.role}</span> | {format(new Date(), 'EEEE, dd MMMM yyyy')}
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm">
          <Clock className="w-5 h-5 text-primary-200" />
          <span className="text-sm font-medium">
            Shift Status: {isClockedOut ? 'Attendance Ended (Locked)' : isClockedIn ? 'Attendance Marked (On Duty)' : 'Attendance Not Marked'}
          </span>
        </div>
      </div>

      {/* Workspace Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" /> Overview
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all cursor-pointer ${
            activeTab === 'tasks'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <ListTodo className="w-4 h-4" /> My Tasks
          {tasks.length > 0 && (
            <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${
              activeTab === 'tasks' ? 'bg-white text-primary-700' : 'bg-primary-100 text-primary-700'
            }`}>
              {tasks.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('daily_log')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all cursor-pointer ${
            activeTab === 'daily_log'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Clock className="w-4 h-4" /> Daily Log & Attendance
        </button>
        <button
          onClick={() => setActiveTab('targets')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all cursor-pointer ${
            activeTab === 'targets'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Target className="w-4 h-4" /> My Targets & Commissions
        </button>
      </div>

      {/* Mini Dashboard & Quick Actions Row (Visible in Overview & My Targets tabs) */}
      {(activeTab === 'overview' || activeTab === 'targets') && (
        <div className="space-y-4">
          {/* Quick Metrics Grid - Clickable with Assigned to Me filter */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              to="/leads?assignedTo=me"
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer hover:no-underline group"
            >
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Assigned Leads</p>
                  <p className="text-lg font-bold text-gray-800">{counts.leads}</p>
                </div>
              </div>
              <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold border border-blue-100 hidden sm:inline-block">Assigned to Me</span>
            </Link>
            
            <Link
              to="/contacts?assignedTo=me"
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer hover:no-underline group"
            >
              <div className="flex items-center gap-3">
                <div className="bg-purple-50 p-2.5 rounded-xl text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Assigned Contacts</p>
                  <p className="text-lg font-bold text-gray-800">{counts.contacts}</p>
                </div>
              </div>
              <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-semibold border border-purple-100 hidden sm:inline-block">Assigned to Me</span>
            </Link>

            <Link
              to="/policies?assignedTo=me"
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer hover:no-underline group"
            >
              <div className="flex items-center gap-3">
                <div className="bg-green-50 p-2.5 rounded-xl text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Assigned Policies</p>
                  <p className="text-lg font-bold text-gray-800">{counts.policies}</p>
                </div>
              </div>
              <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-semibold border border-green-100 hidden sm:inline-block">Assigned to Me</span>
            </Link>

            <Link
              to="/claims?assignedTo=me"
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer hover:no-underline group"
            >
              <div className="flex items-center gap-3">
                <div className="bg-orange-50 p-2.5 rounded-xl text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Assigned Claims</p>
                  <p className="text-lg font-bold text-gray-800">{counts.claims}</p>
                </div>
              </div>
              <span className="text-[10px] bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-semibold border border-orange-100 hidden sm:inline-block">Assigned to Me</span>
            </Link>
          </div>
        </div>
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Attendance & EOD Column */}
          <div className="space-y-6 lg:col-span-2">
            
            {/* Quick Actions Bar */}
            <div className="card bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3">
                <Plus className="w-4 h-4 text-primary-600" /> Quick Actions
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Link
                  to="/contacts?action=add"
                  className="flex items-center justify-center gap-2 p-3 bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold rounded-xl text-xs transition-all hover:scale-[1.02] hover:no-underline"
                >
                  <Users className="w-4 h-4 text-purple-600" /> + Contact
                </Link>
                <Link
                  to="/leads?action=add"
                  className="flex items-center justify-center gap-2 p-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-xl text-xs transition-all hover:scale-[1.02] hover:no-underline"
                >
                  <TrendingUp className="w-4 h-4 text-blue-600" /> + Lead
                </Link>
                <Link
                  to="/policies?action=add"
                  className="flex items-center justify-center gap-2 p-3 bg-green-50 hover:bg-green-100 text-green-700 font-semibold rounded-xl text-xs transition-all hover:scale-[1.02] hover:no-underline"
                >
                  <Shield className="w-4 h-4 text-green-600" /> + Policy
                </Link>
                <Link
                  to="/claims?action=add"
                  className="flex items-center justify-center gap-2 p-3 bg-orange-50 hover:bg-orange-100 text-orange-700 font-semibold rounded-xl text-xs transition-all hover:scale-[1.02] hover:no-underline"
                >
                  <FileText className="w-4 h-4 text-orange-600" /> + Claim
                </Link>
              </div>
            </div>
            
            {/* Attendance & EOD Form Card */}
            <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-primary-600" /> Attendance & Daily Log
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Attendance Card */}
                <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Mark / End Attendance</h3>
                  {!logToday?.checkIn ? (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-500">You haven't marked attendance for today yet. Click below to mark present.</p>
                      <button
                        onClick={handleClockIn}
                        disabled={clockInMutation.isPending || isClockedOut}
                        className="btn-primary flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-semibold cursor-pointer shadow-sm transition-all disabled:opacity-50"
                      >
                        <Play className="w-4 h-4" /> {clockInMutation.isPending ? 'Marking...' : 'Mark Attendance'}
                      </button>
                    </div>
                  ) : isClockedIn ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-green-50 rounded-xl border border-green-100 flex items-center gap-3">
                        <div className="bg-green-500 p-2 rounded-lg text-white">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] text-green-700 font-bold uppercase tracking-wider">Attendance Marked (On Duty)</p>
                          <p className="text-sm font-bold text-gray-800">
                            Marked In at {format(new Date(logToday.checkIn), 'hh:mm a')}
                          </p>
                        </div>
                      </div>
                      
                      <button
                        onClick={handleClockOut}
                        disabled={clockOutMutation.isPending}
                        className="btn-primary flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer shadow-sm transition-all"
                      >
                        <Square className="w-4 h-4" /> {clockOutMutation.isPending ? 'Ending...' : 'End Attendance'}
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-3">
                      <div className="bg-gray-400 p-2 rounded-lg text-white">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Attendance Locked</p>
                        <p className="text-xs font-semibold text-gray-800">
                          In: {format(new Date(logToday.checkIn), 'hh:mm a')} | Out: {format(new Date(logToday.checkOut), 'hh:mm a')}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Duration: {formatTotalDuration(logToday.checkIn, logToday.checkOut)} | Attendance locked after EOD
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* EOD Form */}
                <form onSubmit={handleSaveLog} className="space-y-3 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">EOD Form & Planning</h3>
                    {logToday?.updatedAt && (
                      <span className="text-[10px] text-gray-400 font-medium">
                        Saved: {format(new Date(logToday.updatedAt), 'hh:mm a')}
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Calls Made</label>
                      <input
                        type="number"
                        value={callsMade}
                        onChange={(e) => setCallsMade(Math.max(0, parseInt(e.target.value) || 0))}
                        className="input w-full p-2 text-xs border border-gray-200 rounded-lg text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Visits Done</label>
                      <input
                        type="number"
                        value={visitsCompleted}
                        onChange={(e) => setVisitsCompleted(Math.max(0, parseInt(e.target.value) || 0))}
                        className="input w-full p-2 text-xs border border-gray-200 rounded-lg text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Premium (₹)</label>
                      <input
                        type="number"
                        value={premiumCollected}
                        onChange={(e) => setPremiumCollected(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="input w-full p-2 text-xs border border-gray-200 rounded-lg text-center"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Next Day Plan / Agenda</label>
                    <input
                      type="text"
                      value={nextDayPlan}
                      onChange={(e) => setNextDayPlan(e.target.value)}
                      placeholder="Agenda, follow ups, scheduled visits..."
                      className="input w-full p-2 text-xs border border-gray-200 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Shift Notes / Remarks</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Summarize your progress, key client interactions today..."
                      className="input w-full min-h-[50px] text-xs p-2 border border-gray-200 rounded-lg"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saveLogMutation.isPending}
                    className="btn-primary w-full text-xs font-semibold py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white transition-all cursor-pointer shadow-sm"
                  >
                    {saveLogMutation.isPending ? 'Saving EOD...' : 'Save EOD'}
                  </button>
                </form>
              </div>
            </div>

            {/* EOD History Table Preview */}
            <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-primary-600" /> Recent Daily Logs
                </h2>
                <button
                  onClick={() => setActiveTab('daily_log')}
                  className="text-xs text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  View All Logs <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              {recentLogs.length === 0 ? (
                <div className="text-center py-6 text-sm text-gray-400">No EOD history found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead>
                      <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        <th className="pb-3 px-2">Date</th>
                        <th className="pb-3 px-2">Attendance</th>
                        <th className="pb-3 px-2 text-center">Calls</th>
                        <th className="pb-3 px-2 text-center">Visits</th>
                        <th className="pb-3 px-2 text-right">Premium</th>
                        <th className="pb-3 px-2">Next Day Plan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                      {recentLogs.slice(0, 5).map((log: any, i: number) => (
                        <tr key={i} className="text-gray-700 hover:bg-gray-50/50">
                          <td className="py-3 px-2 font-semibold text-gray-900">{format(new Date(log.logDate), 'dd MMM yyyy')}</td>
                          <td className="py-3 px-2">
                            {log.checkIn ? (
                              <span className="text-green-600 font-medium">
                                In: {format(new Date(log.checkIn), 'hh:mm a')}
                                {log.checkOut ? ` | Out: ${format(new Date(log.checkOut), 'hh:mm a')}` : ''}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-center font-medium">{log.callsMade ?? 0}</td>
                          <td className="py-3 px-2 text-center font-medium">{log.visitsCompleted ?? 0}</td>
                          <td className="py-3 px-2 text-right font-medium text-green-700">
                            ₹{Number(log.premiumCollected ?? 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-2 text-gray-600 truncate max-w-[150px]" title={log.nextDayPlan || undefined}>
                            {log.nextDayPlan || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Tasks & Targets Summary */}
          <div className="space-y-6">

            {/* Active Tasks Tracker */}
            <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <ListTodo className="w-5 h-5 text-primary-600" /> Active Tasks
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddTask(!showAddTask)}
                    className="bg-primary-50 text-primary-700 hover:bg-primary-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                    title="Add Task"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveTab('tasks')}
                    className="text-xs text-primary-600 hover:text-primary-700 font-semibold cursor-pointer"
                  >
                    View All
                  </button>
                </div>
              </div>

              {tasks.length === 0 ? (
                <div className="text-center py-6 text-sm text-gray-400">No active tasks for today. Good job!</div>
              ) : (
                <ul className="space-y-3">
                  {tasks.slice(0, 5).map((task: any) => (
                    <li
                      key={task.id}
                      className="flex items-start justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-start gap-3 flex-1">
                        <button
                          onClick={() => handleToggleTask(task.id, task.status)}
                          className="text-gray-400 hover:text-primary-600 mt-0.5 cursor-pointer"
                          title="Mark Complete"
                        >
                          <CheckSquare className="w-5 h-5" />
                        </button>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{task.title}</p>
                          {task.dueDate && (
                            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Target: {format(new Date(task.dueDate), 'dd MMM')}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`badge text-[10px] uppercase font-bold ${
                        task.priority === 'URGENT' ? 'badge-red' :
                        task.priority === 'HIGH' ? 'badge-orange' : 'badge-yellow'
                      }`}>
                        {task.priority || 'NORMAL'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Targets Summary */}
            <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary-600" /> Target Progress
                </h2>
                <button
                  onClick={() => setActiveTab('targets')}
                  className="text-xs text-primary-600 hover:text-primary-700 font-semibold cursor-pointer"
                >
                  View Details
                </button>
              </div>

              {/* Sales Target */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
                  <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-green-600" /> Sales Progress</span>
                  <span className="text-primary-700">{target.monthlyTarget > 0 ? target.percentage : 0}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${target.monthlyTarget > 0 ? target.percentage : 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-500">
                  <span>₹{(target.progress || 0).toLocaleString('en-IN')} achieved</span>
                  <span>Target: ₹{(target.monthlyTarget || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Calls Target */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
                  <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-blue-600" /> Calls Progress</span>
                  <span className="text-primary-700">
                    {target.callsTarget > 0 ? Math.min(100, Math.round(((target.callsProgress || 0) / target.callsTarget) * 100)) : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${target.callsTarget > 0 ? Math.min(100, Math.round(((target.callsProgress || 0) / target.callsTarget) * 100)) : 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-500">
                  <span>{target.callsProgress || 0} calls</span>
                  <span>Target: {target.callsTarget || 0}</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* TAB 2: MY TASKS */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <ListTodo className="w-5 h-5 text-primary-600" /> My Tasks
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Manage and track work items with complete assignment and timing control</p>
              </div>

              <div className="flex items-center gap-3">
                {/* Status Filter buttons */}
                <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs">
                  <button
                    onClick={() => setTaskStatusFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                      taskStatusFilter === 'ALL' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setTaskStatusFilter('PENDING')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                      taskStatusFilter === 'PENDING' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Pending
                  </button>
                  <button
                    onClick={() => setTaskStatusFilter('COMPLETED')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                      taskStatusFilter === 'COMPLETED' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Completed
                  </button>
                </div>

                <button
                  onClick={() => setShowAddTask(!showAddTask)}
                  className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition-all cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Add Task
                </button>
              </div>
            </div>

            {/* Task Creation Form with ALL required fields */}
            {showAddTask && (
              <form onSubmit={handleAddTask} className="mb-6 p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Create New Task (All Fields)</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Title *</label>
                    <input
                      type="text"
                      placeholder="Task title..."
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Assigned To</label>
                    <select
                      value={assignedToId}
                      onChange={(e) => setAssignedToId(e.target.value)}
                      className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white"
                    >
                      <option value="">Self ({user?.firstName} {user?.lastName})</option>
                      {employeesList.map((emp: any) => (
                        <option key={emp.userId || emp.id} value={emp.userId || emp.id}>
                          {emp.firstName} {emp.lastName} ({emp.designation || 'Employee'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Priority</label>
                    <select
                      value={taskPriority}
                      onChange={(e: any) => setTaskPriority(e.target.value)}
                      className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white"
                    >
                      <option value="LOW">Low Priority</option>
                      <option value="MEDIUM">Medium Priority</option>
                      <option value="HIGH">High Priority</option>
                      <option value="URGENT">Urgent Priority</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Description</label>
                  <textarea
                    placeholder="Task details and scope..."
                    value={taskDesc}
                    onChange={(e) => setTaskDesc(e.target.value)}
                    className="input w-full min-h-[50px] p-2.5 text-xs border border-gray-200 rounded-xl bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Start Date</label>
                    <input
                      type="date"
                      value={taskStartDate}
                      onChange={(e) => setTaskStartDate(e.target.value)}
                      className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Target Date</label>
                    <input
                      type="date"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Target Time</label>
                    <input
                      type="time"
                      value={taskTargetTime}
                      onChange={(e) => setTaskTargetTime(e.target.value)}
                      className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Time Required (e.g. 2h 30m)</label>
                    <input
                      type="text"
                      placeholder="e.g. 3 hours"
                      value={taskTimeRequired}
                      onChange={(e) => setTaskTimeRequired(e.target.value)}
                      className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Comments / Instructions</label>
                  <input
                    type="text"
                    placeholder="Additional instructions or notes..."
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddTask(false)}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createTaskMutation.isPending}
                    className="btn-primary px-5 py-2 rounded-xl bg-primary-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    {createTaskMutation.isPending ? 'Creating Task...' : 'Save Task'}
                  </button>
                </div>
              </form>
            )}

            {/* Task Table with ALL required columns */}
            {tasksLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
              </div>
            ) : taskListFromApi.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <ListTodo className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-medium">No tasks found matching current filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <th className="pb-3 px-3">Done</th>
                      <th className="pb-3 px-3">Title & Scope</th>
                      <th className="pb-3 px-3">Assigned To</th>
                      <th className="pb-3 px-3 text-center">Priority</th>
                      <th className="pb-3 px-3">Start Date</th>
                      <th className="pb-3 px-3">Target Date & Time</th>
                      <th className="pb-3 px-3">Time Required</th>
                      <th className="pb-3 px-3">Comments</th>
                      <th className="pb-3 px-3 text-center">Status</th>
                      <th className="pb-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {taskListFromApi.map((task: any) => {
                      const isDone = task.status === 'COMPLETED';
                      const assignedName = task.assignedTo?.employeeProfile
                        ? `${task.assignedTo.employeeProfile.firstName} ${task.assignedTo.employeeProfile.lastName}`
                        : task.assignedTo?.email || 'Self';
                      return (
                        <tr key={task.id} className={`hover:bg-gray-50/80 transition-colors ${isDone ? 'bg-gray-50/40' : ''}`}>
                          <td className="py-4 px-3">
                            <button
                              onClick={() => handleToggleTask(task.id, task.status)}
                              disabled={updateTaskStatusMutation.isPending}
                              className={`p-1 rounded-lg border transition-colors cursor-pointer ${
                                isDone
                                  ? 'bg-green-500 border-green-600 text-white'
                                  : 'border-gray-300 text-transparent hover:text-gray-400'
                              }`}
                              title={isDone ? 'Mark as Pending' : 'Mark as Complete'}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </td>
                          <td className="py-4 px-3 max-w-[200px]">
                            <p className={`font-semibold text-sm ${isDone ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                              {task.title}
                            </p>
                            {task.description && (
                              <p className="text-xs text-gray-500 mt-0.5 truncate" title={task.description}>{task.description}</p>
                            )}
                          </td>
                          <td className="py-4 px-3 text-gray-700 font-medium">
                            {assignedName}
                          </td>
                          <td className="py-4 px-3 text-center">
                            <span className={`badge text-[10px] uppercase font-bold ${
                              task.priority === 'URGENT' ? 'badge-red' :
                              task.priority === 'HIGH' ? 'badge-orange' :
                              task.priority === 'LOW' ? 'badge-gray' : 'badge-yellow'
                            }`}>
                              {task.priority || 'MEDIUM'}
                            </span>
                          </td>
                          <td className="py-4 px-3 text-gray-600">
                            {task.startDate ? format(new Date(task.startDate), 'dd MMM yyyy') : '—'}
                          </td>
                          <td className="py-4 px-3 text-gray-600">
                            {task.dueDate ? (
                              <span className="flex flex-col">
                                <span>{format(new Date(task.dueDate), 'dd MMM yyyy')}</span>
                                {task.targetTime && <span className="text-[10px] text-gray-400">{task.targetTime}</span>}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-4 px-3 text-gray-600">
                            {task.timeRequired || '—'}
                          </td>
                          <td className="py-4 px-3 text-gray-500 truncate max-w-[150px]" title={task.comments || undefined}>
                            {task.comments || '—'}
                          </td>
                          <td className="py-4 px-3 text-center">
                            <span className={`badge text-[10px] uppercase font-bold ${
                              isDone ? 'badge-green' : 'badge-yellow'
                            }`}>
                              {task.status || 'PENDING'}
                            </span>
                          </td>
                          <td className="py-4 px-3 text-right">
                            <button
                              onClick={() => handleToggleTask(task.id, task.status)}
                              disabled={updateTaskStatusMutation.isPending}
                              className={`px-3 py-1 rounded-lg font-semibold text-[11px] transition-all cursor-pointer ${
                                isDone
                                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                              }`}
                            >
                              {isDone ? 'Reopen' : 'Mark Complete'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DAILY LOG & ATTENDANCE */}
      {activeTab === 'daily_log' && (
        <div className="space-y-6">
          <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-6">
              <Clock className="w-5 h-5 text-primary-600" /> Attendance & Daily EOD Reporting
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Attendance Shift Status */}
              <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Attendance Status</h3>
                
                {isClockedOut ? (
                  <div className="p-4 bg-gray-100 rounded-xl border border-gray-200 space-y-2">
                    <div className="flex items-center gap-2 text-gray-700 font-bold text-xs uppercase tracking-wider">
                      <Lock className="w-4 h-4 text-gray-500" /> Attendance Locked
                    </div>
                    <p className="text-xs font-semibold text-gray-800">
                      In: {format(new Date(logToday.checkIn), 'hh:mm a')} | Out: {format(new Date(logToday.checkOut), 'hh:mm a')}
                    </p>
                    <p className="text-xs text-gray-600">
                      Total Duration: <span className="font-semibold">{formatTotalDuration(logToday.checkIn, logToday.checkOut)}</span>
                    </p>
                    <p className="text-[10px] text-amber-700 font-medium bg-amber-50 p-2 rounded-lg border border-amber-200 mt-2">
                      Shift completed & attendance locked for today after EOD submission.
                    </p>
                  </div>
                ) : !logToday?.checkIn ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs">
                      <p className="font-semibold">Shift Not Started</p>
                      <p className="mt-1 text-amber-700">Click below to mark present and begin today's shift log.</p>
                    </div>
                    <button
                      onClick={handleClockIn}
                      disabled={clockInMutation.isPending}
                      className="btn-primary flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-semibold cursor-pointer shadow-sm transition-all"
                    >
                      <Play className="w-4 h-4" /> {clockInMutation.isPending ? 'Marking Attendance...' : 'Mark Attendance (Clock In)'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 rounded-xl border border-green-200 flex items-center gap-3">
                      <div className="bg-green-500 p-2.5 rounded-xl text-white">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] text-green-700 font-bold uppercase tracking-wider">On Duty</p>
                        <p className="text-sm font-bold text-gray-800">
                          Clocked In: {format(new Date(logToday.checkIn), 'hh:mm a')}
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={handleClockOut}
                      disabled={clockOutMutation.isPending}
                      className="btn-primary flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer shadow-sm transition-all"
                    >
                      <Square className="w-4 h-4" /> {clockOutMutation.isPending ? 'Ending Shift...' : 'End Attendance (Clock Out)'}
                    </button>
                  </div>
                )}
              </div>

              {/* Comprehensive EOD Form */}
              <form onSubmit={handleSaveLog} className="lg:col-span-2 space-y-4 bg-gray-50 p-5 rounded-2xl border border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Today's End of Day (EOD) Report</h3>
                  {logToday?.updatedAt && (
                    <span className="text-[10px] text-gray-400 font-medium">
                      Last Updated: {format(new Date(logToday.updatedAt), 'hh:mm a')}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Calls Made Today</label>
                    <input
                      type="number"
                      value={callsMade}
                      onChange={(e) => setCallsMade(Math.max(0, parseInt(e.target.value) || 0))}
                      className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Visits Completed Today</label>
                    <input
                      type="number"
                      value={visitsCompleted}
                      onChange={(e) => setVisitsCompleted(Math.max(0, parseInt(e.target.value) || 0))}
                      className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Premium Collected (₹)</label>
                    <input
                      type="number"
                      value={premiumCollected}
                      onChange={(e) => setPremiumCollected(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white text-center font-bold text-green-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Tomorrow's Plan & Agenda</label>
                  <input
                    type="text"
                    value={nextDayPlan}
                    onChange={(e) => setNextDayPlan(e.target.value)}
                    placeholder="Scheduled client visits, follow-up calls, target tasks..."
                    className="input w-full p-2.5 text-xs border border-gray-200 rounded-xl bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Today's Shift Notes & Remarks</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Summary of day activities, customer feedback, issues faced..."
                    className="input w-full min-h-[70px] text-xs p-2.5 border border-gray-200 rounded-xl bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saveLogMutation.isPending}
                  className="btn-primary w-full text-xs font-semibold py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white transition-all cursor-pointer shadow-sm"
                >
                  {saveLogMutation.isPending ? 'Saving EOD Report...' : 'Save Today\'s EOD Log'}
                </button>
              </form>
            </div>
          </div>

          {/* EOD Log History Table */}
          <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-4">
              <ClipboardList className="w-5 h-5 text-primary-600" /> Daily Log History
            </h2>
            {recentLogs.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-400">No daily log history recorded.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <th className="pb-3 px-3">Log Date</th>
                      <th className="pb-3 px-3">Shift Timing</th>
                      <th className="pb-3 px-3 text-center">Calls</th>
                      <th className="pb-3 px-3 text-center">Visits</th>
                      <th className="pb-3 px-3 text-right">Premium Collected</th>
                      <th className="pb-3 px-3">Next Day Plan</th>
                      <th className="pb-3 px-3">Notes & Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {recentLogs.map((log: any, i: number) => (
                      <tr key={i} className="text-gray-700 hover:bg-gray-50/50">
                        <td className="py-3 px-3 font-semibold text-gray-900">{format(new Date(log.logDate), 'dd MMM yyyy')}</td>
                        <td className="py-3 px-3">
                          {log.checkIn ? (
                            <span className="text-green-600 font-medium">
                              {format(new Date(log.checkIn), 'hh:mm a')}
                              {log.checkOut ? ` - ${format(new Date(log.checkOut), 'hh:mm a')}` : ' (On Duty)'}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-medium">{log.callsMade ?? 0}</td>
                        <td className="py-3 px-3 text-center font-medium">{log.visitsCompleted ?? 0}</td>
                        <td className="py-3 px-3 text-right font-semibold text-green-700">
                          ₹{Number(log.premiumCollected ?? 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-gray-600 truncate max-w-[200px]" title={log.nextDayPlan || undefined}>
                          {log.nextDayPlan || '—'}
                        </td>
                        <td className="py-3 px-3 text-gray-500 truncate max-w-[200px]" title={log.notes || log.adminRemarks || undefined}>
                          {log.notes || log.adminRemarks || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: MY TARGETS & COMMISSIONS */}
      {activeTab === 'targets' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Target Meters */}
            <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6 lg:col-span-2">
              <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <Target className="w-5 h-5 text-primary-600" /> Monthly Target Progress (Auto-Calculated from Policies & Lead Movements)
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Sales Progress Card */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-green-600" /> Sales Target
                    </span>
                    <span className="text-xs font-bold text-green-600">{target.monthlyTarget > 0 ? target.percentage : 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-green-500 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${target.monthlyTarget > 0 ? target.percentage : 0}%` }}
                    />
                  </div>
                  <div className="space-y-1 pt-1 text-xs">
                    <div className="flex justify-between text-gray-500">
                      <span>Achieved:</span>
                      <span className="font-bold text-gray-800">₹{(target.progress || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Target:</span>
                      <span className="font-semibold text-gray-700">₹{(target.monthlyTarget || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Calls Progress Card */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                      <Phone className="w-4 h-4 text-blue-600" /> Calls Target
                    </span>
                    <span className="text-xs font-bold text-blue-600">
                      {target.callsTarget > 0 ? Math.min(100, Math.round(((target.callsProgress || 0) / target.callsTarget) * 100)) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${target.callsTarget > 0 ? Math.min(100, Math.round(((target.callsProgress || 0) / target.callsTarget) * 100)) : 0}%` }}
                    />
                  </div>
                  <div className="space-y-1 pt-1 text-xs">
                    <div className="flex justify-between text-gray-500">
                      <span>Calls Made:</span>
                      <span className="font-bold text-gray-800">{target.callsProgress || 0}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Target:</span>
                      <span className="font-semibold text-gray-700">{target.callsTarget || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Visits Progress Card */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-purple-600" /> Visits Target
                    </span>
                    <span className="text-xs font-bold text-purple-600">
                      {target.visitsTarget > 0 ? Math.min(100, Math.round(((target.visitsProgress || 0) / target.visitsTarget) * 100)) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-purple-500 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${target.visitsTarget > 0 ? Math.min(100, Math.round(((target.visitsProgress || 0) / target.visitsTarget) * 100)) : 0}%` }}
                    />
                  </div>
                  <div className="space-y-1 pt-1 text-xs">
                    <div className="flex justify-between text-gray-500">
                      <span>Visits Done:</span>
                      <span className="font-bold text-gray-800">{target.visitsProgress || 0}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Target:</span>
                      <span className="font-semibold text-gray-700">{target.visitsTarget || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Compensation Overview (Backend Sourced) */}
            <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
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
                  <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" /> Commission History (Backend Sourced)
                  </h2>
                  <div className="flex items-center gap-4 text-xs">
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
                          <th className="pb-3 px-3">Policy #</th>
                          <th className="pb-3 px-3">Year</th>
                          <th className="pb-3 px-3 text-right">Commission Amount</th>
                          <th className="pb-3 px-3 text-right">Rate</th>
                          <th className="pb-3 px-3 text-center">Status</th>
                          <th className="pb-3 px-3">Paid Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs">
                        {commList.map((c: any) => (
                          <tr key={c.id} className="text-gray-700 hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-3 font-semibold text-gray-800">{c.policy?.policyNumber ?? '—'}</td>
                            <td className="py-3 px-3 text-gray-500">{c.commissionYear?.name ?? '—'}</td>
                            <td className="py-3 px-3 text-right font-bold text-gray-900">₹{Number(c.amount ?? 0).toLocaleString('en-IN')}</td>
                            <td className="py-3 px-3 text-right text-gray-500">{Number(c.rate ?? 0).toFixed(2)}%</td>
                            <td className="py-3 px-3 text-center">
                              <span className={c.isPaid ? 'badge-green' : 'badge-yellow'}>
                                {c.isPaid ? 'Paid' : 'Pending'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-gray-500">
                              {c.paidAt ? format(new Date(c.paidAt), 'dd MMM yyyy') : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

    </div>
  );
}
