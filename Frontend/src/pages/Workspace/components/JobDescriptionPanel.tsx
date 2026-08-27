import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Briefcase, Edit3, Save, CheckCircle2, 
  User, Building, Target, FileText, 
  Shield, Sparkles, Check
} from 'lucide-react';
import { employeesService } from '@api/index';
import { useAuthStore } from '@store/auth.store';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export interface SimpleJobDescriptionData {
  title: string;
  department: string;
  reportingTo: string;
  summary: string;
  responsibilities: string[];
  expectations: string[];
  lastUpdated?: string;
  updatedBy?: string;
}

export const DEFAULT_SIMPLE_JD: SimpleJobDescriptionData = {
  title: 'Senior Insurance Specialist & Advisory Manager',
  department: 'Sales & Advisory',
  reportingTo: 'Agency Principal / Branch Owner',
  summary: 'Responsible for client insurance advisory, new policy issuance, renewal retention, and customer claims assistance across Health, Life, Motor, and Commercial insurance portfolios while upholding IRDAI compliance.',
  responsibilities: [
    'Promptly follow up on prospective insurance leads within 30 minutes of assignment.',
    'Conduct client protection needs analysis and prepare customized comparison quotes (Star Health, Care, HDFC Ergo, ICICI Lombard).',
    'Coordinate policy issuance, pre-policy health checkups (PHC), and documentation underwriting.',
    'Proactively manage the policy renewal pipeline to ensure zero policy lapse in assigned book of business.',
    'Assist clients during claim intimations, cashless hospital authorizations, and claim filing.',
    'Maintain daily activity logs, customer notes, and CRM records in InsuMitra.'
  ],
  expectations: [
    'Achieve monthly Gross Written Premium (GWP) targets agreed in targets agreement.',
    'Maintain a minimum lead-to-proposal conversion rate of 35%.',
    'Achieve 90%+ portfolio renewal retention rate year-on-year.',
    'Acknowledge and attend to client claim queries within 24 hours.',
    'Strictly adhere to IRDAI guidelines and customer data privacy standards.'
  ],
  lastUpdated: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  updatedBy: 'Management'
};

interface JobDescriptionPanelProps {
  employeeId?: string | null;
  employeeName?: string;
  isViewOnly?: boolean;
}

export default function JobDescriptionPanel({
  employeeId,
  employeeName,
  isViewOnly = false
}: JobDescriptionPanelProps) {
  const user = useAuthStore(s => s.user);

  // Fetch employees list to locate respective employee profile
  const { data: empRes } = useQuery({
    queryKey: ['employees', 'workspace-jd-single'],
    queryFn: () => employeesService.list({ limit: 200 }),
    staleTime: 60_000,
  });

  const employees: any[] = empRes?.data || [];

  // Determine the target employee for this personal workspace
  const targetEmployee = useMemo(() => {
    if (employeeId) {
      const found = employees.find(e => e.id === employeeId || e.userId === employeeId);
      if (found) return found;
    }
    if (user?.id) {
      const found = employees.find(e => e.id === user.id || e.userId === user.id);
      if (found) return found;
    }
    return {
      id: employeeId || user?.id || 'current',
      firstName: employeeName?.split(' ')[0] || user?.firstName || 'My',
      lastName: employeeName?.split(' ')[1] || user?.lastName || 'Account',
      designation: user?.role || 'Insurance Advisor',
      department: 'Sales & Advisory',
      reportingManager: 'Agency Principal'
    };
  }, [employeeId, user, employees, employeeName]);

  // Read the respective employee's JD from localStorage
  const loadEmployeeJd = (): SimpleJobDescriptionData => {
    if (!targetEmployee) return DEFAULT_SIMPLE_JD;
    const keys = [
      `insumitra_jd_${targetEmployee.id}`,
      ...(targetEmployee.userId ? [`insumitra_jd_${targetEmployee.userId}`] : []),
      ...(targetEmployee.user?.id ? [`insumitra_jd_${targetEmployee.user.id}`] : []),
      ...(user?.id ? [`insumitra_jd_${user.id}`] : [])
    ];
    for (const key of keys) {
      try {
        const saved = localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            title: parsed.title || targetEmployee.designation || DEFAULT_SIMPLE_JD.title,
            department: parsed.department || targetEmployee.department || DEFAULT_SIMPLE_JD.department,
            reportingTo: parsed.reportingTo || targetEmployee.reportingManager || DEFAULT_SIMPLE_JD.reportingTo,
            summary: parsed.summary || DEFAULT_SIMPLE_JD.summary,
            responsibilities: parsed.responsibilities || DEFAULT_SIMPLE_JD.responsibilities,
            expectations: parsed.expectations || DEFAULT_SIMPLE_JD.expectations,
            lastUpdated: parsed.lastUpdated,
            updatedBy: parsed.updatedBy
          };
        }
      } catch (e) {}
    }
    return {
      ...DEFAULT_SIMPLE_JD,
      title: targetEmployee.designation || DEFAULT_SIMPLE_JD.title,
      department: targetEmployee.department || DEFAULT_SIMPLE_JD.department,
      reportingTo: targetEmployee.reportingManager || DEFAULT_SIMPLE_JD.reportingTo,
    };
  };

  const [currentJd, setCurrentJd] = useState<SimpleJobDescriptionData>(loadEmployeeJd);
  const [isEditing, setIsEditing] = useState(false);

  // Edit fields
  const [editTitle, setEditTitle] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editReportingTo, setEditReportingTo] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editResponsibilitiesText, setEditResponsibilitiesText] = useState('');
  const [editExpectationsText, setEditExpectationsText] = useState('');

  // Sync state when target employee or storage updates
  useEffect(() => {
    const syncData = () => {
      const data = loadEmployeeJd();
      setCurrentJd(data);
      setEditTitle(data.title);
      setEditDepartment(data.department);
      setEditReportingTo(data.reportingTo);
      setEditSummary(data.summary);
      setEditResponsibilitiesText(data.responsibilities.join('\n'));
      setEditExpectationsText(data.expectations.join('\n'));
      setIsEditing(false);
    };

    syncData();
    window.addEventListener('storage', syncData);
    return () => window.removeEventListener('storage', syncData);
  }, [targetEmployee]);

  const handleStartEdit = () => {
    setEditTitle(currentJd.title);
    setEditDepartment(currentJd.department);
    setEditReportingTo(currentJd.reportingTo);
    setEditSummary(currentJd.summary);
    setEditResponsibilitiesText(currentJd.responsibilities.join('\n'));
    setEditExpectationsText(currentJd.expectations.join('\n'));
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!targetEmployee) return;

    const respList = editResponsibilitiesText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    const expList = editExpectationsText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    const updated: SimpleJobDescriptionData = {
      title: editTitle.trim() || targetEmployee.designation || DEFAULT_SIMPLE_JD.title,
      department: editDepartment.trim() || targetEmployee.department || DEFAULT_SIMPLE_JD.department,
      reportingTo: editReportingTo.trim() || DEFAULT_SIMPLE_JD.reportingTo,
      summary: editSummary.trim() || DEFAULT_SIMPLE_JD.summary,
      responsibilities: respList.length > 0 ? respList : DEFAULT_SIMPLE_JD.responsibilities,
      expectations: expList.length > 0 ? expList : DEFAULT_SIMPLE_JD.expectations,
      lastUpdated: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      updatedBy: `${user?.firstName || 'User'} (${user?.role || 'Team Member'})`
    };

    setCurrentJd(updated);

    try {
      localStorage.setItem(`insumitra_jd_${targetEmployee.id}`, JSON.stringify(updated));
      if (targetEmployee.userId) localStorage.setItem(`insumitra_jd_${targetEmployee.userId}`, JSON.stringify(updated));
      if (targetEmployee.user?.id) localStorage.setItem(`insumitra_jd_${targetEmployee.user.id}`, JSON.stringify(updated));
      if (user?.id) localStorage.setItem(`insumitra_jd_${user.id}`, JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}

    setIsEditing(false);
    toast.success(`Job Description for ${targetEmployee.firstName} saved!`);
  };

  const displayName = `${targetEmployee.firstName || ''} ${targetEmployee.lastName || ''}`.trim() || 'My Workspace';

  return (
    <div className="space-y-4 animate-fadeIn">
      
      {/* ── Top Header Profile & Role Card ── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20 shrink-0">
            <Briefcase size={22} />
          </div>

          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                {displayName}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold">
                {isEditing ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="border border-blue-400 bg-white rounded px-2 py-0.5 text-xs font-bold text-slate-900 outline-none"
                    placeholder="Role Title"
                  />
                ) : (
                  currentJd.title
                )}
              </span>
            </div>

            <p className="text-xs text-slate-500 flex flex-wrap items-center gap-3 font-medium">
              <span className="flex items-center gap-1 text-slate-700 font-semibold">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                {isEditing ? (
                  <input
                    type="text"
                    value={editDepartment}
                    onChange={e => setEditDepartment(e.target.value)}
                    className="border rounded px-1.5 py-0.5 text-xs text-slate-800"
                    placeholder="Department"
                  />
                ) : (
                  currentJd.department
                )}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-slate-700 font-semibold">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Reports to: {isEditing ? (
                  <input
                    type="text"
                    value={editReportingTo}
                    onChange={e => setEditReportingTo(e.target.value)}
                    className="border rounded px-1.5 py-0.5 text-xs text-slate-800"
                    placeholder="Manager"
                  />
                ) : (
                  currentJd.reportingTo
                )}
              </span>
              {currentJd.lastUpdated && (
                <>
                  <span>•</span>
                  <span className="text-slate-400">Updated: {currentJd.lastUpdated}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Save size={14} />
                <span>Save Changes</span>
              </button>
            </>
          ) : (
            !isViewOnly && (
              <button
                type="button"
                onClick={handleStartEdit}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 size={14} />
                <span>Edit Details</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* ── Role Summary ── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-2">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-600" />
          Role Purpose &amp; Overview
        </h3>
        {isEditing ? (
          <textarea
            rows={3}
            value={editSummary}
            onChange={e => setEditSummary(e.target.value)}
            className="w-full text-xs p-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none leading-relaxed font-medium text-slate-800"
            placeholder="Describe the primary mission and purpose of this role..."
          />
        ) : (
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
            {currentJd.summary}
          </p>
        )}
      </div>

      {/* ── Two Clean Grid Cards: Responsibilities & KPIs ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Card 1: Key Responsibilities */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <Target className="w-4 h-4 text-blue-600" />
              Key Deliverables &amp; Responsibilities ({currentJd.responsibilities.length})
            </h3>

            {isEditing ? (
              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-400 font-medium block">
                  Enter each responsibility on a new line:
                </span>
                <textarea
                  rows={8}
                  value={editResponsibilitiesText}
                  onChange={e => setEditResponsibilitiesText(e.target.value)}
                  className="w-full text-xs p-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none leading-relaxed font-medium text-slate-800"
                />
              </div>
            ) : (
              <ul className="space-y-2.5">
                {currentJd.responsibilities.map((resp, i) => (
                  <li key={i} className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50/70 border border-slate-100 text-xs font-medium text-slate-800">
                    <span className="w-5 h-5 rounded-lg bg-blue-100 text-blue-700 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="flex-1 leading-relaxed">{resp}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Card 2: Performance Expectations & KPIs */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <Shield className="w-4 h-4 text-emerald-600" />
              Performance Expectations &amp; KPIs ({currentJd.expectations.length})
            </h3>

            {isEditing ? (
              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-400 font-medium block">
                  Enter each target or KPI on a new line:
                </span>
                <textarea
                  rows={8}
                  value={editExpectationsText}
                  onChange={e => setEditExpectationsText(e.target.value)}
                  className="w-full text-xs p-3 rounded-2xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none leading-relaxed font-medium text-slate-800"
                />
              </div>
            ) : (
              <ul className="space-y-2.5">
                {currentJd.expectations.map((exp, i) => (
                  <li key={i} className="flex items-start gap-2.5 p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100 text-xs font-medium text-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="flex-1 leading-relaxed text-emerald-950 font-semibold">{exp}</span>
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
