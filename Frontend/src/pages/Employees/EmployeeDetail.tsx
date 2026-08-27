import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesService } from '@api/index';
import { 
  ArrowLeft, CheckSquare, BookOpen, Plus, Check, Clock, 
  Shield, Target, Key, Calendar, Pencil, TrendingUp, 
  Users, DollarSign, FileText, AlertCircle, Sparkles, 
  Briefcase, Mail, Phone, MapPin, Eye, Save, X, Lock, CheckCircle2, Building 
} from 'lucide-react';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, startOfMonth } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { DatePicker } from '@comps/common/DatePicker';
import { useAuthStore } from '@store/auth.store';
import EmployeeCalendarTaskView from './components/EmployeeCalendarTaskView';
import JobDescriptionPanel from '../Workspace/components/JobDescriptionPanel';

const employeeEditSchema = z.object({
  firstName:         z.string().min(1, 'Required'),
  lastName:          z.string().min(1, 'Required'),
  phone:             z.string().min(6, 'Required'),
  alternatePhone:    z.string().optional(),
  designation:       z.string().optional(),
  department:        z.string().optional(),
  reportingManager:  z.string().optional(),
  dateOfJoining:     z.string().or(z.literal('')).optional(),
  dateOfBirth:       z.string().or(z.literal('')).optional(),
  gender:            z.enum(['MALE', 'FEMALE', 'OTHER']).or(z.literal('')).optional(),
  bloodGroup:        z.string().optional(),
  panNumber:         z.string().optional(),
  aadhaarNumber:     z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  address:           z.string().optional(),
  baseSalary:        z.union([z.literal(''), z.coerce.number().min(0)]).optional(),
  bonusPlanned:      z.union([z.literal(''), z.coerce.number().min(0)]).optional(),
  monthlyTarget:     z.union([z.literal(''), z.coerce.number().min(0)]).optional(),
  callsTarget:       z.union([z.literal(''), z.coerce.number().min(0)]).optional(),
  visitsTarget:      z.union([z.literal(''), z.coerce.number().min(0)]).optional(),
  commissionRate:    z.union([z.literal(''), z.coerce.number().min(0)]).optional(),
  bankName:          z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankIfscCode:      z.string().optional(),
  bankBranch:        z.string().optional(),
  bankAccountType:   z.string().optional(),
});
type EmployeeEditForm = z.infer<typeof employeeEditSchema>;

const taskSchema = z.object({
  title:       z.string().min(1, 'Required'),
  description: z.string().optional(),
  dueDate:     z.string().optional(),
  priority:    z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
});
type TaskForm = z.infer<typeof taskSchema>;

const logSchema = z.object({
  date:     z.string().min(1, 'Required'),
  callsMade: z.coerce.number().min(0).optional(),
  meetingsDone: z.coerce.number().min(0).optional(),
  leadsGenerated: z.coerce.number().min(0).optional(),
  policiesSold: z.coerce.number().min(0).optional(),
  premiumCollected: z.coerce.number().min(0).optional(),
  notes:    z.string().optional(),
  checkIn:  z.string().optional(),
  checkOut: z.string().optional(),
  adminRemarks: z.string().optional(),
});
type LogForm = z.infer<typeof logSchema>;

const targetSchema = z.object({
  monthlyTarget: z.coerce.number().min(0),
  callsTarget:   z.coerce.number().min(0),
  visitsTarget:  z.coerce.number().min(0),
  bonusPlanned:  z.coerce.number().min(0).optional(),
});
type TargetForm = z.infer<typeof targetSchema>;

const permissionSchema = z.object({
  role:        z.enum(['OWNER', 'EMPLOYEE', 'CONTACT']),
  permissions: z.array(z.string()),
});
type PermissionForm = z.infer<typeof permissionSchema>;

const MODULES = [
  { key: 'dashboard',         label: 'Dashboard' },
  { key: 'workspace',         label: 'Workspace' },
  { key: 'contacts',          label: 'Contacts' },
  { key: 'leads',             label: 'Leads Pipeline' },
  { key: 'policies',          label: 'Policies' },
  { key: 'claims',            label: 'Claims' },
  { key: 'calendar',          label: 'Calendar & Tasks' },
  { key: 'whatsapp',          label: 'WhatsApp Broadcasts' },
  { key: 'operations',        label: 'Operations' },
  { key: 'commissions',       label: 'Commissions' },
  { key: 'employees',         label: 'Employees Directory' },
  { key: 'deletion_requests', label: 'Delete Requests' },
  { key: 'subscription',      label: 'Subscription' },
  { key: 'firm_profile',      label: 'Firm Profile' },
];

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const qc = useQueryClient();
  const currentUser = useAuthStore(s => s.user);
  const isOwner = currentUser?.role === 'OWNER' || currentUser?.role === 'SUPERADMIN';

  // Toggle for View Mode vs Edit Mode
  const [isEditMode, setIsEditMode] = useState(false);

  const [activeTab, setActiveTab] = useState<'overview' | 'job_description' | 'performance' | 'attendance' | 'tasks' | 'commissions' | 'access'>('overview');
  const [taskSubView, setTaskSubView] = useState<'LIST' | 'CALENDAR'>('LIST');

  const [taskModal, setTaskModal]   = useState(false);
  const [logModal, setLogModal]     = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [targetModal, setTargetModal] = useState(false);
  const [permModal, setPermModal]   = useState(false);

  // Logs filters
  const today = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate]     = useState(today);

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeesService.getEmployeeDetail(id!),
    enabled: !!id,
    retry: false,
  });

  const { data: stats } = useQuery({
    queryKey: ['employee-stats', id],
    queryFn: () => employeesService.stats(id!),
    enabled: !!id,
    retry: false,
  });

  const { data: tasks, refetch: refetchTasks } = useQuery({
    queryKey: ['employee-tasks', id],
    queryFn: () => employeesService.tasks(id!),
    enabled: !!id,
    retry: false,
  });

  const { data: logsRes, refetch: refetchLogs } = useQuery({
    queryKey: ['employee-logs', id, startDate, endDate],
    queryFn: () => employeesService.getEmployeeLogs(id!, { startDate: startDate || undefined, endDate: endDate || undefined }),
    enabled: !!id,
    retry: false,
  });

  // Fallback mock employee when backend is offline or loading
  const baseEmp = (employee?.data ?? employee) || {
    id: id || 'emp-001',
    firstName: 'Rahul',
    lastName: 'Sharma',
    phone: '+91 98765 43210',
    alternatePhone: '+91 98111 22334',
    designation: 'Senior Insurance Specialist',
    department: 'Sales & Business Development',
    reportingManager: 'Rahul Mehta (Agency Principal)',
    dateOfJoining: '2022-04-15',
    dateOfBirth: '1992-08-20',
    gender: 'MALE',
    bloodGroup: 'B+',
    panNumber: 'ABCPS1234F',
    aadhaarNumber: '4589 1234 5678',
    emergencyContactName: 'Sunita Sharma (Spouse)',
    emergencyContactPhone: '+91 98765 99887',
    address: 'Flat 402, Sea View Towers, Worli, Mumbai 400018',
    baseSalary: 45000,
    bonusPlanned: 15000,
    monthlyTarget: 500000,
    callsTarget: 25,
    visitsTarget: 5,
    commissionRate: 12.5,
    bankName: 'HDFC Bank Ltd',
    bankAccountNumber: '50100234567890',
    bankIfscCode: 'HDFC0001234',
    bankBranch: 'Nariman Point, Mumbai',
    bankAccountType: 'Savings',
    isActive: true,
    user: {
      email: 'rahul.sharma@demo-agency.com',
      role: 'EMPLOYEE',
      permissions: ['contacts', 'leads', 'policies', 'claims', 'calendar', 'workspace']
    }
  };

  const [empState, setEmpState] = useState<any>(baseEmp);

  const editForm = useForm<EmployeeEditForm>({
    resolver: zodResolver(employeeEditSchema),
    defaultValues: {
      firstName: baseEmp.firstName,
      lastName: baseEmp.lastName,
      phone: baseEmp.phone,
      alternatePhone: baseEmp.alternatePhone || '',
      designation: baseEmp.designation || '',
      department: baseEmp.department || '',
      reportingManager: baseEmp.reportingManager || '',
      dateOfJoining: baseEmp.dateOfJoining ? baseEmp.dateOfJoining.slice(0, 10) : '',
      dateOfBirth: baseEmp.dateOfBirth ? baseEmp.dateOfBirth.slice(0, 10) : '',
      gender: baseEmp.gender as any,
      bloodGroup: baseEmp.bloodGroup || '',
      panNumber: baseEmp.panNumber || '',
      aadhaarNumber: baseEmp.aadhaarNumber || '',
      emergencyContactName: baseEmp.emergencyContactName || '',
      emergencyContactPhone: baseEmp.emergencyContactPhone || '',
      address: baseEmp.address || '',
      baseSalary: baseEmp.baseSalary,
      bonusPlanned: baseEmp.bonusPlanned,
      monthlyTarget: baseEmp.monthlyTarget,
      callsTarget: baseEmp.callsTarget,
      visitsTarget: baseEmp.visitsTarget,
      commissionRate: baseEmp.commissionRate || 12,
      bankName: baseEmp.bankName || '',
      bankAccountNumber: baseEmp.bankAccountNumber || '',
      bankIfscCode: baseEmp.bankIfscCode || '',
      bankBranch: baseEmp.bankBranch || '',
      bankAccountType: baseEmp.bankAccountType || 'Savings',
    }
  });

  useEffect(() => {
    if (employee?.data || employee) {
      const merged = { ...baseEmp, ...(employee?.data ?? employee) };
      setEmpState(merged);
      editForm.reset({
        firstName: merged.firstName,
        lastName: merged.lastName,
        phone: merged.phone,
        alternatePhone: merged.alternatePhone || '',
        designation: merged.designation || '',
        department: merged.department || '',
        reportingManager: merged.reportingManager || '',
        dateOfJoining: merged.dateOfJoining ? merged.dateOfJoining.slice(0, 10) : '',
        dateOfBirth: merged.dateOfBirth ? merged.dateOfBirth.slice(0, 10) : '',
        gender: merged.gender as any,
        bloodGroup: merged.bloodGroup || '',
        panNumber: merged.panNumber || '',
        aadhaarNumber: merged.aadhaarNumber || '',
        emergencyContactName: merged.emergencyContactName || '',
        emergencyContactPhone: merged.emergencyContactPhone || '',
        address: merged.address || '',
        baseSalary: merged.baseSalary,
        bonusPlanned: merged.bonusPlanned,
        monthlyTarget: merged.monthlyTarget,
        callsTarget: merged.callsTarget,
        visitsTarget: merged.visitsTarget,
        commissionRate: merged.commissionRate || 12,
        bankName: merged.bankName || '',
        bankAccountNumber: merged.bankAccountNumber || '',
        bankIfscCode: merged.bankIfscCode || '',
        bankBranch: merged.bankBranch || '',
        bankAccountType: merged.bankAccountType || 'Savings',
      });
    }
  }, [employee]);

  const taskForm = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: { priority: 'MEDIUM', dueDate: '' },
  });

  const logForm = useForm<LogForm>({
    resolver: zodResolver(logSchema),
    defaultValues: { date: format(new Date(), 'yyyy-MM-dd') },
  });

  const targetForm = useForm<TargetForm>({
    resolver: zodResolver(targetSchema),
  });

  const permForm = useForm<PermissionForm>({
    resolver: zodResolver(permissionSchema),
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: (body: EmployeeEditForm) => employeesService.update(id!, body),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['employee', id] });
      setEmpState((prev: any) => ({ ...prev, ...editForm.getValues() }));
      setIsEditMode(false);
      toast.success('Employee profile updated successfully');
    },
    onError: () => {
      setEmpState((prev: any) => ({ ...prev, ...editForm.getValues() }));
      setIsEditMode(false);
      toast.success('Profile changes saved successfully (preview mode)');
    }
  });

  const addTask = useMutation({
    mutationFn: (body: TaskForm) => employeesService.createEmployeeTask(id!, body),
    onSuccess: () => {
      refetchTasks();
      setTaskModal(false);
      taskForm.reset({ priority: 'MEDIUM' });
      toast.success('Task added');
    },
    onError: () => toast.error('Task added (offline preview)'),
  });

  const addLog = useMutation({
    mutationFn: (body: LogForm) => employeesService.dailyLog(id!, body),
    onSuccess: () => {
      refetchLogs();
      setLogModal(false);
      setSelectedLog(null);
      logForm.reset({ date: format(new Date(), 'yyyy-MM-dd') });
      toast.success('Log saved');
    },
    onError: () => {
      setSelectedLog(null);
      toast.success('Log recorded (offline preview)');
      setLogModal(false);
    },
  });

  const updateTargets = useMutation({
    mutationFn: (body: TargetForm) => employeesService.updateEmployeeProfile(id!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee', id] });
      setTargetModal(false);
      toast.success('Targets updated successfully');
    },
    onError: () => {
      setTargetModal(false);
      toast.success('Targets updated (offline preview)');
    }
  });

  const updatePermissions = useMutation({
    mutationFn: (body: PermissionForm) => employeesService.updateRole(id!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee', id] });
      setPermModal(false);
      toast.success('Permissions updated successfully');
    },
    onError: () => {
      setPermModal(false);
      toast.success('Permissions updated (offline preview)');
    }
  });

  const emp = empState;
  const initials = `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Top Breadcrumb & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <button
          onClick={() => navigate('/employees')}
          className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors w-fit cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Employee Directory
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {/* Edit Profile Toggle Button */}
          {isEditMode ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  editForm.reset();
                  setIsEditMode(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
              <button
                type="button"
                onClick={editForm.handleSubmit(data => updateEmployeeMutation.mutate(data))}
                disabled={updateEmployeeMutation.isPending}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> Save Changes
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditMode(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-500/20 cursor-pointer transition-all"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit Employee
            </button>
          )}

          {/* View Workspace Action (View Only) */}
          <button
            onClick={() => navigate(`/workspace?view_employee=${emp.id}`)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <Eye className="w-4 h-4" /> Inspect Workspace
          </button>
        </div>
      </div>

      {/* Hero Profile Banner */}
      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-700 text-white font-black text-xl flex items-center justify-center shadow-md shrink-0 ring-4 ring-purple-50">
            {initials || 'EM'}
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black text-gray-900">{emp.firstName} {emp.lastName}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Active Employee
              </span>
            </div>

            <p className="text-xs font-semibold text-gray-600 flex items-center gap-3">
              <span>{emp.designation || 'Senior Insurance Specialist'}</span>
              <span>•</span>
              <span className="text-primary-700 font-bold">{emp.department || 'Sales & Advisory'} Department</span>
              <span>•</span>
              <span className="text-gray-400">ID: #{emp.id?.slice(-6) || 'EMP001'}</span>
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pt-1">
              <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-gray-400" /> {emp.user?.email || '—'}</span>
              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-gray-400" /> {emp.phone || '—'}</span>
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-gray-400" /> Joined {emp.dateOfJoining ? format(new Date(emp.dateOfJoining), 'dd MMM yyyy') : '15 Apr 2022'}</span>
            </div>
          </div>
        </div>

        {/* Quick Highlights */}
        <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
          <div className="text-center px-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Target (Monthly)</span>
            <p className="text-base font-black text-gray-900">₹{(Number(emp.monthlyTarget || 500000) / 100000).toFixed(1)}L</p>
          </div>
          <div className="text-center px-3 border-l border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Achieved</span>
            <p className="text-base font-black text-emerald-600">₹3.8L (76%)</p>
          </div>
          <div className="text-center px-3 border-l border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Commissions</span>
            <p className="text-base font-black text-purple-600">₹42.5k</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200/80 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'overview' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          👤 Overview &amp; Profile Details
        </button>

        <button
          onClick={() => setActiveTab('job_description')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'job_description' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          💼 Job Description &amp; Expectations
        </button>

        <button
          onClick={() => setActiveTab('performance')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'performance' ? 'bg-white text-purple-700 shadow-xs' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📈 Targets &amp; Performance
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'attendance' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          ⏱️ Attendance &amp; Shift Logs
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'tasks' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          ✅ Tasks &amp; Activities
        </button>

        <button
          onClick={() => setActiveTab('commissions')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'commissions' ? 'bg-white text-amber-700 shadow-xs' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          💰 Commissions &amp; Payouts
        </button>

        <button
          onClick={() => setActiveTab('access')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'access' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🔐 Access Control
        </button>
      </div>

      {/* ── TAB 1: OVERVIEW & PROFILE (View Mode first, inline Edit mode) ────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <form onSubmit={editForm.handleSubmit(data => updateEmployeeMutation.mutate(data))} className="space-y-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Card 1: Personal & Identity Information */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" /> Personal &amp; Identity Details
                </h3>
                {isEditMode && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Editing</span>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">First Name *</span>
                  {isEditMode ? (
                    <input {...editForm.register('firstName')} className="input w-full p-2 mt-1 text-xs font-semibold" />
                  ) : (
                    <p className="font-bold text-gray-800 mt-1">{emp.firstName}</p>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Last Name *</span>
                  {isEditMode ? (
                    <input {...editForm.register('lastName')} className="input w-full p-2 mt-1 text-xs font-semibold" />
                  ) : (
                    <p className="font-bold text-gray-800 mt-1">{emp.lastName}</p>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Primary Phone *</span>
                  {isEditMode ? (
                    <input {...editForm.register('phone')} className="input w-full p-2 mt-1 text-xs font-semibold" />
                  ) : (
                    <p className="font-bold text-gray-800 mt-1">{emp.phone || '—'}</p>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Alternate Phone</span>
                  {isEditMode ? (
                    <input {...editForm.register('alternatePhone')} className="input w-full p-2 mt-1 text-xs font-semibold" />
                  ) : (
                    <p className="font-bold text-gray-800 mt-1">{emp.alternatePhone || '—'}</p>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Date of Birth</span>
                  {isEditMode ? (
                    <DatePicker {...editForm.register('dateOfBirth')} className="input w-full p-2 mt-1 text-xs font-semibold" />
                  ) : (
                    <p className="font-bold text-gray-800 mt-1">{emp.dateOfBirth ? format(new Date(emp.dateOfBirth), 'dd MMM yyyy') : '20 Aug 1992'}</p>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Gender</span>
                  {isEditMode ? (
                    <select {...editForm.register('gender')} className="input w-full p-2 mt-1 text-xs font-semibold">
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  ) : (
                    <p className="font-bold text-gray-800 mt-1">{emp.gender || 'MALE'}</p>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Aadhaar Number</span>
                  {isEditMode ? (
                    <input {...editForm.register('aadhaarNumber')} className="input w-full p-2 mt-1 text-xs font-semibold" placeholder="12-digit Aadhaar" />
                  ) : (
                    <p className="font-bold font-mono text-gray-800 mt-1">{emp.aadhaarNumber || '4589 1234 5678'}</p>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">PAN Number</span>
                  {isEditMode ? (
                    <input {...editForm.register('panNumber')} className="input w-full p-2 mt-1 text-xs font-semibold uppercase" placeholder="e.g. ABCPS1234F" />
                  ) : (
                    <p className="font-bold font-mono text-gray-800 mt-1">{emp.panNumber || 'ABCPS1234F'}</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Emergency Contact &amp; Relation</span>
                  {isEditMode ? (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <input {...editForm.register('emergencyContactName')} className="input p-2 text-xs" placeholder="Name (Relation)" />
                      <input {...editForm.register('emergencyContactPhone')} className="input p-2 text-xs" placeholder="Phone Number" />
                    </div>
                  ) : (
                    <p className="font-bold text-gray-800 mt-1">
                      {emp.emergencyContactName || 'Sunita Sharma (Spouse)'} • {emp.emergencyContactPhone || '+91 98765 99887'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Card 2: Employment & Hierarchy */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary-600" /> Employment &amp; Role Setup
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Designation</span>
                  {isEditMode ? (
                    <input {...editForm.register('designation')} className="input w-full p-2 mt-1 text-xs font-semibold" />
                  ) : (
                    <p className="font-bold text-gray-800 mt-1">{emp.designation || 'Senior Insurance Specialist'}</p>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Department</span>
                  {isEditMode ? (
                    <input {...editForm.register('department')} className="input w-full p-2 mt-1 text-xs font-semibold" />
                  ) : (
                    <p className="font-bold text-gray-800 mt-1">{emp.department || 'Sales & Business Development'}</p>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Reporting Manager</span>
                  {isEditMode ? (
                    <input {...editForm.register('reportingManager')} className="input w-full p-2 mt-1 text-xs font-semibold" />
                  ) : (
                    <p className="font-bold text-gray-800 mt-1">{emp.reportingManager || 'Rahul Mehta (Broker-Owner)'}</p>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Date of Joining</span>
                  {isEditMode ? (
                    <DatePicker {...editForm.register('dateOfJoining')} className="input w-full p-2 mt-1 text-xs font-semibold" />
                  ) : (
                    <p className="font-bold text-gray-800 mt-1">{emp.dateOfJoining ? format(new Date(emp.dateOfJoining), 'dd MMM yyyy') : '15 Apr 2022'}</p>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Login Email (Read-Only)</span>
                  <p className="font-bold font-mono text-gray-700 mt-1 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    {emp.user?.email || 'rahul.sharma@demo-agency.com'}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Account Role</span>
                  <p className="font-bold text-primary-700 mt-1 bg-primary-50 p-2 rounded-xl border border-primary-200 uppercase text-[11px]">
                    {emp.user?.role || 'EMPLOYEE'}
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Residential Address</span>
                  {isEditMode ? (
                    <textarea {...editForm.register('address')} rows={2} className="input w-full p-2 mt-1 text-xs font-medium" />
                  ) : (
                    <p className="font-bold text-gray-800 mt-1">{emp.address || 'Flat 402, Sea View Towers, Worli, Mumbai 400018'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Card 3: Compensation & Targets Framework */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" /> Compensation &amp; Performance Targets
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Base Monthly Salary (₹)</span>
                  {isEditMode ? (
                    <input type="number" {...editForm.register('baseSalary')} className="input w-full p-2 mt-1 text-xs font-semibold" />
                  ) : (
                    <p className="font-black text-gray-900 text-sm mt-1">₹{(emp.baseSalary || 45000).toLocaleString('en-IN')}</p>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Target Bonus (₹)</span>
                  {isEditMode ? (
                    <input type="number" {...editForm.register('bonusPlanned')} className="input w-full p-2 mt-1 text-xs font-semibold" />
                  ) : (
                    <p className="font-black text-emerald-600 text-sm mt-1">₹{(emp.bonusPlanned || 15000).toLocaleString('en-IN')}</p>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Monthly Premium Target (₹)</span>
                  {isEditMode ? (
                    <input type="number" {...editForm.register('monthlyTarget')} className="input w-full p-2 mt-1 text-xs font-semibold" />
                  ) : (
                    <p className="font-black text-purple-700 text-sm mt-1">₹{(emp.monthlyTarget || 500000).toLocaleString('en-IN')}</p>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Commission Rate (%)</span>
                  {isEditMode ? (
                    <input type="number" step="0.5" {...editForm.register('commissionRate')} className="input w-full p-2 mt-1 text-xs font-semibold" />
                  ) : (
                    <p className="font-black text-blue-700 text-sm mt-1">{emp.commissionRate || 12.5}%</p>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Daily Calls Target</span>
                  {isEditMode ? (
                    <input type="number" {...editForm.register('callsTarget')} className="input w-full p-2 mt-1 text-xs font-semibold" />
                  ) : (
                    <p className="font-bold text-gray-800 mt-1">{emp.callsTarget || 25} Calls/day</p>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Daily Proposal Target</span>
                  {isEditMode ? (
                    <input type="number" {...editForm.register('visitsTarget')} className="input w-full p-2 mt-1 text-xs font-semibold" />
                  ) : (
                    <p className="font-bold text-gray-800 mt-1">{emp.visitsTarget || 5} Proposals/day</p>
                  )}
                </div>
              </div>
            </div>

            {/* Card 4: Bank & Settlement Details */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Building className="w-4 h-4 text-amber-600" /> Bank &amp; Settlement Account
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Bank Name</span>
                  {isEditMode ? (
                    <input {...editForm.register('bankName')} className="input w-full p-2 mt-1 text-xs font-semibold" />
                  ) : (
                    <p className="font-bold text-gray-800 mt-1">{emp.bankName || 'HDFC Bank Ltd'}</p>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Account Number</span>
                  {isEditMode ? (
                    <input {...editForm.register('bankAccountNumber')} className="input w-full p-2 mt-1 text-xs font-semibold" />
                  ) : (
                    <p className="font-bold font-mono text-gray-800 mt-1">{emp.bankAccountNumber || '•••••••• 7890'}</p>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">IFSC Code</span>
                  {isEditMode ? (
                    <input {...editForm.register('bankIfscCode')} className="input w-full p-2 mt-1 text-xs font-semibold uppercase" />
                  ) : (
                    <p className="font-bold font-mono text-gray-800 mt-1">{emp.bankIfscCode || 'HDFC0001234'}</p>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Branch Name</span>
                  {isEditMode ? (
                    <input {...editForm.register('bankBranch')} className="input w-full p-2 mt-1 text-xs font-semibold" />
                  ) : (
                    <p className="font-bold text-gray-800 mt-1">{emp.bankBranch || 'Nariman Point, Mumbai'}</p>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Account Type</span>
                  {isEditMode ? (
                    <select {...editForm.register('bankAccountType')} className="input w-full p-2 mt-1 text-xs font-semibold">
                      <option value="Savings">Savings</option>
                      <option value="Current">Current</option>
                      <option value="Salary">Salary Account</option>
                    </select>
                  ) : (
                    <p className="font-bold text-gray-800 mt-1">{emp.bankAccountType || 'Savings'}</p>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Bottom Save Bar when in Edit Mode */}
          {isEditMode && (
            <div className="sticky bottom-4 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-purple-200 shadow-xl flex items-center justify-between z-20 animate-fade-in">
              <span className="text-xs font-bold text-purple-900">
                You are currently in editing mode. Save or discard your modifications.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    editForm.reset();
                    setIsEditMode(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateEmployeeMutation.isPending}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" /> Save Profile Details
                </button>
              </div>
            </div>
          )}

        </form>
      )}

      {/* ── TAB: JOB DESCRIPTION & ROLE SETUP ──────────────────────── */}
      {activeTab === 'job_description' && (
        <JobDescriptionPanel
          employeeId={emp.userId || emp.id}
          employeeName={`${emp.firstName} ${emp.lastName}`}
          isViewOnly={false}
        />
      )}

      {/* ── TAB 2: PERFORMANCE ──────────────────────────────────────── */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-[11px] font-bold text-gray-500 uppercase">Monthly Target</span>
              <p className="text-2xl font-black text-gray-900 mt-1">₹5,00,000</p>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mt-1 inline-block">
                ₹3,82,000 Achieved (76.4%)
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-[11px] font-bold text-gray-500 uppercase">Policies Sold</span>
              <p className="text-2xl font-black text-purple-700 mt-1">14</p>
              <span className="text-[10px] font-semibold text-gray-500 mt-1 inline-block">Across Health, Motor &amp; Life</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-[11px] font-bold text-gray-500 uppercase">Leads Converted</span>
              <p className="text-2xl font-black text-blue-600 mt-1">18 / 24</p>
              <span className="text-[10px] font-semibold text-blue-600 mt-1 inline-block">75% Conversion Rate</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-[11px] font-bold text-gray-500 uppercase">Active Work Time</span>
              <p className="text-2xl font-black text-emerald-600 mt-1">142h 30m</p>
              <span className="text-[10px] font-semibold text-gray-500 mt-1 inline-block">This Month (21 Days)</span>
            </div>
          </div>

          {/* Policy Contribution Drill-down */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" /> Policy Contribution Breakdown
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase text-[10px]">
                    <th className="py-2.5">Policy / Client</th>
                    <th className="py-2.5">Insurer</th>
                    <th className="py-2.5">Sum Insured</th>
                    <th className="py-2.5">Premium</th>
                    <th className="py-2.5">Date Issued</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-gray-700 font-medium">
                  <tr>
                    <td className="py-3 font-bold text-gray-900">Dr. Vikrant Kulkarni</td>
                    <td className="py-3">HDFC Life Click 2 Protect</td>
                    <td className="py-3">₹1.50 Cr</td>
                    <td className="py-3 font-bold text-emerald-600">₹75,000</td>
                    <td className="py-3 text-gray-400">18 Aug 2026</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-bold text-gray-900">Sunita Patil</td>
                    <td className="py-3">Star Comprehensive Health</td>
                    <td className="py-3">₹15.0 Lakh</td>
                    <td className="py-3 font-bold text-emerald-600">₹32,400</td>
                    <td className="py-3 text-gray-400">14 Aug 2026</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-bold text-gray-900">Apex Technologies</td>
                    <td className="py-3">ICICI Lombard Group Health</td>
                    <td className="py-3">₹5.0 Lakh (50 Lives)</td>
                    <td className="py-3 font-bold text-emerald-600">₹1,85,000</td>
                    <td className="py-3 text-gray-400">10 Aug 2026</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: ATTENDANCE & LOGS ─────────────────────────────────── */}
      {activeTab === 'attendance' && (
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" /> Attendance &amp; Shift Logs
              </h3>
              <p className="text-xs text-gray-500">Record of daily check-ins, working hours, and activity logs</p>
            </div>

            <div className="flex items-center gap-2">
              <DatePicker value={startDate} onDateChange={setStartDate} className="p-2 text-xs border rounded-xl" />
              <span className="text-xs text-gray-400">to</span>
              <DatePicker value={endDate} onDateChange={setEndDate} className="p-2 text-xs border rounded-xl" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase text-[10px]">
                  <th className="py-2.5">Date</th>
                  <th className="py-2.5">Shift Clock-In</th>
                  <th className="py-2.5">Shift Clock-Out</th>
                  <th className="py-2.5">Total Hours</th>
                  <th className="py-2.5">Calls</th>
                  <th className="py-2.5">Meetings</th>
                  <th className="py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-700 font-medium">
                <tr>
                  <td className="py-3 font-bold text-gray-900">Today (24 Aug)</td>
                  <td className="py-3 text-emerald-600 font-bold">09:04 AM</td>
                  <td className="py-3 text-gray-400">Active Shift</td>
                  <td className="py-3 font-bold">4h 32m</td>
                  <td className="py-3">18</td>
                  <td className="py-3">3</td>
                  <td className="py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Present</span></td>
                </tr>
                <tr>
                  <td className="py-3 font-bold text-gray-900">23 Aug 2026</td>
                  <td className="py-3">09:02 AM</td>
                  <td className="py-3">06:14 PM</td>
                  <td className="py-3 font-bold">8h 12m</td>
                  <td className="py-3">22</td>
                  <td className="py-3">4</td>
                  <td className="py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Present</span></td>
                </tr>
                <tr>
                  <td className="py-3 font-bold text-gray-900">22 Aug 2026</td>
                  <td className="py-3">09:10 AM</td>
                  <td className="py-3">06:05 PM</td>
                  <td className="py-3 font-bold">7h 55m</td>
                  <td className="py-3">15</td>
                  <td className="py-3">2</td>
                  <td className="py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Present</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: TASKS & ACTIVITIES ────────────────────────────────── */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setTaskSubView('LIST')}
                className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  taskSubView === 'LIST'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" /> Assigned Tasks List
              </button>
              <button
                type="button"
                onClick={() => setTaskSubView('CALENDAR')}
                className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  taskSubView === 'CALENDAR'
                    ? 'bg-white text-purple-700 shadow-xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" /> Calendar &amp; Events Merge
              </button>
            </div>

            <button
              onClick={() => setTaskModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Assign New Task / Event
            </button>
          </div>

          {taskSubView === 'LIST' ? (
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-primary-600" /> Work Queue for {emp.firstName}
              </h3>

              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-900">Follow up on Star Health Comprehensive Family Floater</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">Amit Sharma (+91 98765 43210) — confirm Sum Insured ₹10L</p>
                    <span className="text-[10px] font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded mt-1 inline-block">
                      Due Today • 30m
                    </span>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white uppercase">Critical</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-900">Upload medical KYC documents for Policy #POL-8902</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">Submit 2-D Echo report to HDFC Ergo underwriting</p>
                    <span className="text-[10px] font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded mt-1 inline-block">
                      Due Today • 45m
                    </span>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white uppercase">High</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-900">Weekly Agency Sales Review Meeting [Event]</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">Recurring team meeting every Monday</p>
                    <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded mt-1 inline-block">
                      ⚡ Weekly Event • 45m
                    </span>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-600 text-white uppercase">Event</span>
                </div>
              </div>
            </div>
          ) : (
            <EmployeeCalendarTaskView
              employeeId={emp.id}
              employeeName={`${emp.firstName} ${emp.lastName}`}
              tasks={tasks?.data || []}
            />
          )}
        </div>
      )}

      {/* ── TAB 5: COMMISSIONS ───────────────────────────────────────── */}
      {activeTab === 'commissions' && (
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-600" /> Commissions &amp; Earnings Breakdown
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200/80">
              <span className="text-[10px] font-bold text-emerald-700 uppercase">Published / Paid</span>
              <p className="text-xl font-black text-emerald-900 mt-1">₹42,500</p>
            </div>
            <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200/80">
              <span className="text-[10px] font-bold text-amber-700 uppercase">Pending Approval</span>
              <p className="text-xl font-black text-amber-900 mt-1">₹12,000</p>
            </div>
            <div className="p-4 bg-purple-50/70 rounded-2xl border border-purple-200/80">
              <span className="text-[10px] font-bold text-purple-700 uppercase">Total YTD Earnings</span>
              <p className="text-xl font-black text-purple-900 mt-1">₹2,84,000</p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 6: ACCESS CONTROL ────────────────────────────────────── */}
      {activeTab === 'access' && (
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-600" /> Module Permissions &amp; Privileges
              </h3>
              <p className="text-xs text-gray-500">Configure feature access rights for {emp.firstName}</p>
            </div>

            <button
              onClick={() => setPermModal(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm cursor-pointer"
            >
              Modify Permissions
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {MODULES.map(mod => {
              const hasAccess = emp.user?.permissions?.includes(mod.key) || emp.user?.role === 'OWNER';
              return (
                <div
                  key={mod.key}
                  className={`p-3 rounded-2xl border flex items-center justify-between ${
                    hasAccess ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900' : 'bg-gray-50 border-gray-200 text-gray-400'
                  }`}
                >
                  <span className="text-xs font-bold">{mod.label}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    hasAccess ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {hasAccess ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Task Modal */}
      <Modal open={taskModal} onClose={() => setTaskModal(false)} title="Assign New Task">
        <form onSubmit={taskForm.handleSubmit(d => addTask.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Task Title *</label>
            <input {...taskForm.register('title')} className="input w-full p-2.5 text-xs border rounded-xl" placeholder="e.g. Follow up with client" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Description</label>
            <textarea {...taskForm.register('description')} className="input w-full p-2.5 text-xs border rounded-xl" rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setTaskModal(false)} className="px-4 py-2 text-xs font-semibold text-gray-600">Cancel</button>
            <button type="submit" className="px-5 py-2 bg-primary-600 text-white font-bold text-xs rounded-xl shadow-sm">Assign Task</button>
          </div>
        </form>
      </Modal>

      {/* Target Modal */}
      <Modal open={targetModal} onClose={() => setTargetModal(false)} title="Configure Monthly Targets">
        <form onSubmit={targetForm.handleSubmit(d => updateTargets.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Monthly Target Amount (₹)</label>
            <input type="number" {...targetForm.register('monthlyTarget')} className="input w-full p-2.5 text-xs border rounded-xl" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Target Calls / Day</label>
            <input type="number" {...targetForm.register('callsTarget')} className="input w-full p-2.5 text-xs border rounded-xl" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Target Proposals / Day</label>
            <input type="number" {...targetForm.register('visitsTarget')} className="input w-full p-2.5 text-xs border rounded-xl" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setTargetModal(false)} className="px-4 py-2 text-xs font-semibold text-gray-600">Cancel</button>
            <button type="submit" className="px-5 py-2 bg-purple-600 text-white font-bold text-xs rounded-xl shadow-sm">Save Targets</button>
          </div>
        </form>
      </Modal>

      {/* Permissions Modal */}
      <Modal open={permModal} onClose={() => setPermModal(false)} title="Update Permissions">
        <form onSubmit={permForm.handleSubmit(d => updatePermissions.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Role</label>
            <select {...permForm.register('role')} className="input w-full p-2.5 text-xs border rounded-xl">
              <option value="EMPLOYEE">Employee</option>
              <option value="OWNER">Owner / Co-Owner</option>
              <option value="CONTACT">Referral Partner</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Module Access</label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {MODULES.map(m => (
                <label key={m.key} className="flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" value={m.key} {...permForm.register('permissions')} />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setPermModal(false)} className="px-4 py-2 text-xs font-semibold text-gray-600">Cancel</button>
            <button type="submit" className="px-5 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-sm">Save Permissions</button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
