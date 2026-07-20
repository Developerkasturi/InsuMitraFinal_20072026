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
  useCreateTask
} from '@hooks/useWorkspace';
import { commissionsService } from '@api/index';
import {
  Clock, CheckCircle, Play, Square,
  TrendingUp, ListTodo, ClipboardList,
  Plus, CheckSquare, Target, User, Shield,
  FileText, Users, Calendar, Phone, DollarSign
} from 'lucide-react';
import { format, differenceInSeconds } from 'date-fns';
import toast from 'react-hot-toast';

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function Workspace() {
  const user = useAuthStore(s => s.user);
  const { data: wsRes, isLoading, refetch } = useWorkspaceData();
  const clockInMutation = useClockIn();
  const clockOutMutation = useClockOut();
  const saveLogMutation = useUpsertDailyLog();
  const updateTaskStatusMutation = useUpdateTaskStatus();
  const createTaskMutation = useCreateTask();

  // My commissions — backend already filters by beneficiaryId for EMPLOYEE role
  const { data: commRes, isLoading: commLoading } = useQuery({
    queryKey: ['my-commissions'],
    queryFn: () => commissionsService.list({ limit: 50 }),
    staleTime: 60_000,
  });

  const [notes, setNotes] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // EOD fields
  const [callsMade, setCallsMade] = useState(0);
  const [visitsCompleted, setVisitsCompleted] = useState(0);
  const [premiumCollected, setPremiumCollected] = useState(0);
  const [nextDayPlan, setNextDayPlan] = useState('');

  const workspaceData = wsRes?.data || wsRes; // support both envelope formats
  const logToday = workspaceData?.dailyLog;
  const isClockedIn = !!logToday?.checkIn && !logToday?.checkOut;
  const isClockedOut = !!logToday?.checkIn && !!logToday?.checkOut;

  // Track clock-in running timer
  useEffect(() => {
    let interval: any;
    if (isClockedIn && logToday?.checkIn) {
      const checkInTime = new Date(logToday.checkIn);
      interval = setInterval(() => {
        const diff = differenceInSeconds(new Date(), checkInTime);
        setElapsed(diff > 0 ? diff : 0);
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(interval);
  }, [isClockedIn, logToday?.checkIn]);

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
    clockInMutation.mutate(undefined, {
      onSuccess: () => refetch()
    });
  };

  const handleClockOut = () => {
    clockOutMutation.mutate({
      notes,
      callsMade,
      visitsCompleted,
      premiumCollected,
      nextDayPlan
    }, {
      onSuccess: () => refetch()
    });
  };

  const handleSaveLog = (e: React.FormEvent) => {
    e.preventDefault();
    saveLogMutation.mutate({
      logDate: new Date().toISOString(),
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
      dueDate: taskDueDate ? new Date(taskDueDate).toISOString() : new Date(Date.now() + 86400000).toISOString(),
    }, {
      onSuccess: () => {
        setTaskTitle('');
        setTaskDueDate('');
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
            Shift Status: {isClockedOut ? 'Shift Completed' : isClockedIn ? 'On Duty' : 'Not Clocked In'}
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Clock In / Out & Logs Column */}
        <div className="space-y-6 lg:col-span-2">
          
          {/* Attendance Actions */}
          <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-primary-600" /> Attendance & Daily Log
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div>
                {!logToday?.checkIn ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500">You haven't clocked in for the day yet. Start your shift now.</p>
                    <button
                      onClick={handleClockIn}
                      className="btn-primary flex items-center gap-2 px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium cursor-pointer"
                    >
                      <Play className="w-4 h-4" /> Clock In
                    </button>
                  </div>
                ) : isClockedIn ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 rounded-xl border border-green-100 flex items-center gap-4">
                      <div className="bg-green-500 p-2.5 rounded-lg text-white animate-pulse">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-green-700 font-semibold uppercase tracking-wider">Clocked In</p>
                        <p className="text-2xl font-bold text-gray-800">{formatDuration(elapsed)}</p>
                        <p className="text-xs text-gray-500">Started at {format(new Date(logToday.checkIn), 'hh:mm a')}</p>
                      </div>
                    </div>
                    
                    <button
                      onClick={handleClockOut}
                      className="btn-primary flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium cursor-pointer"
                    >
                      <Square className="w-4 h-4" /> Clock Out & Complete Shift
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-4">
                    <div className="bg-gray-400 p-2.5 rounded-lg text-white">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Shift Finished</p>
                      <p className="text-sm font-semibold text-gray-800">
                        In: {format(new Date(logToday.checkIn), 'hh:mm a')} | Out: {format(new Date(logToday.checkOut), 'hh:mm a')}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Excellent work today!</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Log Notes Section */}
              <form onSubmit={handleSaveLog} className="space-y-3 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">EOD Form & Planning</h3>
                
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Calls Made</label>
                    <input
                      type="number"
                      value={callsMade}
                      onChange={(e) => setCallsMade(Math.max(0, parseInt(e.target.value) || 0))}
                      disabled={isClockedOut}
                      className="input w-full p-2 text-xs border border-gray-200 rounded-lg text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Visits Done</label>
                    <input
                      type="number"
                      value={visitsCompleted}
                      onChange={(e) => setVisitsCompleted(Math.max(0, parseInt(e.target.value) || 0))}
                      disabled={isClockedOut}
                      className="input w-full p-2 text-xs border border-gray-200 rounded-lg text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Premium (₹)</label>
                    <input
                      type="number"
                      value={premiumCollected}
                      onChange={(e) => setPremiumCollected(Math.max(0, parseFloat(e.target.value) || 0))}
                      disabled={isClockedOut}
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
                    disabled={isClockedOut}
                    className="input w-full p-2 text-xs border border-gray-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Shift Notes / Remarks</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Summarize your progress, key client interactions today..."
                    disabled={isClockedOut}
                    className="input w-full min-h-[60px] text-xs p-2.5 border border-gray-200 rounded-lg"
                  />
                </div>

                {logToday?.checkIn && !isClockedOut && (
                  <button
                    type="submit"
                    className="btn-secondary w-full text-xs font-semibold py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Save EOD / Progress Update
                  </button>
                )}
              </form>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link to="/leads" className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3 hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer hover:no-underline">
              <div className="bg-blue-50 p-2.5 rounded-lg text-blue-600">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Leads</p>
                <p className="text-lg font-bold text-gray-800">{counts.leads}</p>
              </div>
            </Link>
            
            <Link to="/policies" className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3 hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer hover:no-underline">
              <div className="bg-green-50 p-2.5 rounded-lg text-green-600">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Policies</p>
                <p className="text-lg font-bold text-gray-800">{counts.policies}</p>
              </div>
            </Link>

            <Link to="/claims" className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3 hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer hover:no-underline">
              <div className="bg-orange-50 p-2.5 rounded-lg text-orange-600">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Claims</p>
                <p className="text-lg font-bold text-gray-800">{counts.claims}</p>
              </div>
            </Link>

            <Link to="/contacts" className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3 hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer hover:no-underline">
              <div className="bg-purple-50 p-2.5 rounded-lg text-purple-600">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Contacts</p>
                <p className="text-lg font-bold text-gray-800">{counts.contacts}</p>
              </div>
            </Link>
          </div>

          {/* Recent Activity Log Logs Table */}
          <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-4">
              <ClipboardList className="w-5 h-5 text-primary-600" /> Recent Daily Logs (Last 7 Days)
            </h2>
            {recentLogs.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-400">No shift history found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <th className="pb-3">Date</th>
                      <th className="pb-3">Clock In</th>
                      <th className="pb-3">Clock Out</th>
                      <th className="pb-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {recentLogs.map((log: any, i: number) => (
                      <tr key={i} className="text-gray-700">
                        <td className="py-3 font-medium">{format(new Date(log.logDate), 'dd/MMM/yyyy')}</td>
                        <td className="py-3 text-green-600 font-medium">
                          {log.checkIn ? format(new Date(log.checkIn), 'hh:mm a') : '—'}
                        </td>
                        <td className="py-3 text-red-500 font-medium">
                          {log.checkOut ? format(new Date(log.checkOut), 'hh:mm a') : '—'}
                        </td>
                        <td className="py-3 text-gray-500 truncate max-w-xs">{log.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Task Tracker & Targets Column */}
        <div className="space-y-6">

          {/* Quick Actions */}
          <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-4">
              <Plus className="w-5 h-5 text-primary-600" /> Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-3">
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

          {/* Targets & Compensation */}
          <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-5">
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <Target className="w-5 h-5 text-primary-600" /> Targets & Compensation
            </h2>

            {/* Sales Target */}
            <div className="space-y-2">
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
            <div className="space-y-2">
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
                <span>{target.callsProgress || 0} calls made</span>
                <span>Target: {target.callsTarget || 0} calls</span>
              </div>
            </div>

            {/* Visits Target */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
                <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-purple-600" /> Visits Progress</span>
                <span className="text-primary-700">
                  {target.visitsTarget > 0 ? Math.min(100, Math.round(((target.visitsProgress || 0) / target.visitsTarget) * 100)) : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${target.visitsTarget > 0 ? Math.min(100, Math.round(((target.visitsProgress || 0) / target.visitsTarget) * 100)) : 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-500">
                <span>{target.visitsProgress || 0} visits completed</span>
                <span>Target: {target.visitsTarget || 0} visits</span>
              </div>
            </div>

            {/* Salary, Bonus & Commissions */}
            <div className="pt-3 border-t border-gray-100 grid grid-cols-3 gap-2">
              <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                <p className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider">Base Salary</p>
                <p className="text-xs font-bold text-gray-800 mt-1">₹{(target.baseSalary || 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                <p className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider">Bonus Planned</p>
                <p className="text-xs font-bold text-gray-800 mt-1">₹{(target.bonusPlanned || 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                <p className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider">Commission</p>
                <p className="text-xs font-bold text-green-600 mt-1">₹{(target.monthlyCommission || 0).toLocaleString('en-IN')}</p>
              </div>
            </div>
          </div>

          {/* My Commissions List */}
          {(() => {
            const commList: any[] = commRes?.data ?? [];
            const totalCommission = commList.reduce((sum: number, c: any) => sum + Number(c.amount ?? 0), 0);
            const paidCommission  = commList.filter((c: any) => c.isPaid).reduce((sum: number, c: any) => sum + Number(c.amount ?? 0), 0);
            return (
              <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" /> My Commissions
                  </h2>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-gray-500">Total: <span className="font-bold text-gray-800">₹{totalCommission.toLocaleString('en-IN')}</span></span>
                    <span className="text-gray-500">Paid: <span className="font-bold text-green-600">₹{paidCommission.toLocaleString('en-IN')}</span></span>
                  </div>
                </div>

                {commLoading ? (
                  <div className="flex justify-center py-6">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
                  </div>
                ) : commList.length === 0 ? (
                  <div className="text-center py-6 text-sm text-gray-400">No commission entries found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                      <thead>
                        <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          <th className="pb-3">Policy</th>
                          <th className="pb-3">Year</th>
                          <th className="pb-3 text-right">Amount</th>
                          <th className="pb-3 text-right">Rate</th>
                          <th className="pb-3 text-center">Status</th>
                          <th className="pb-3">Paid On</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-sm">
                        {commList.map((c: any) => (
                          <tr key={c.id} className="text-gray-700 hover:bg-gray-50 transition-colors">
                            <td className="py-3 font-semibold text-gray-800">{c.policy?.policyNumber ?? '—'}</td>
                            <td className="py-3 text-gray-500">{c.commissionYear?.name ?? '—'}</td>
                            <td className="py-3 text-right font-bold text-gray-800">₹{Number(c.amount ?? 0).toLocaleString('en-IN')}</td>
                            <td className="py-3 text-right text-gray-500">{Number(c.rate ?? 0).toFixed(2)}%</td>
                            <td className="py-3 text-center">
                              <span className={c.isPaid ? 'badge-green' : 'badge-yellow'}>
                                {c.isPaid ? 'Paid' : 'Pending'}
                              </span>
                            </td>
                            <td className="py-3 text-gray-500 text-xs">
                              {c.paidAt ? format(new Date(c.paidAt), 'dd/MMM/yyyy') : '—'}
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

          {/* Incomplete Tasks Tracker */}
          <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-primary-600" /> Active Tasks
              </h2>
              <button
                onClick={() => setShowAddTask(!showAddTask)}
                className="bg-primary-50 text-primary-700 hover:bg-primary-100 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Task Creation Form */}
            {showAddTask && (
              <form onSubmit={handleAddTask} className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                <input
                  type="text"
                  placeholder="Task title..."
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="input w-full p-2 text-xs border border-gray-200 rounded-lg"
                  required
                />
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="input w-full p-2 text-xs border border-gray-200 rounded-lg"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddTask(false)}
                    className="btn-secondary text-[11px] py-1 px-3 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary text-[11px] py-1 px-3 rounded bg-primary-600 text-white"
                  >
                    Add Task
                  </button>
                </div>
              </form>
            )}

            {tasks.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-400">No active tasks for today. Good job!</div>
            ) : (
              <ul className="space-y-3">
                {tasks.map((task: any) => (
                  <li
                    key={task.id}
                    className="flex items-start justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <button
                        onClick={() => handleToggleTask(task.id, task.status)}
                        className="text-gray-400 hover:text-primary-600 mt-0.5 cursor-pointer"
                      >
                        <CheckSquare className="w-5 h-5" />
                      </button>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{task.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Due: {format(new Date(task.dueDate), 'dd MMM')}
                        </p>
                      </div>
                    </div>
                    <span className="badge badge-yellow text-[10px] uppercase font-bold">{task.priority || 'NORMAL'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
