import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Briefcase, CheckCircle2, User, Building, 
  Target, FileText, Shield, Search, X, Edit3, Save
} from 'lucide-react';
import { employeesService } from '@api/index';
import { useAuthStore } from '@store/auth.store';
import toast from 'react-hot-toast';
import { SimpleJobDescriptionData, DEFAULT_SIMPLE_JD } from '../Workspace/components/JobDescriptionPanel';

export const SIMPLE_JD_TEMPLATES: Record<string, SimpleJobDescriptionData> = {
  advisor: {
    title: 'Senior Insurance Specialist & Advisory Manager',
    department: 'Sales & Advisory',
    reportingTo: 'Agency Principal / Branch Owner',
    summary: 'Responsible for end-to-end insurance advisory, lead conversion, policy lifecycle management, renewal retention, and customer claims support across Health, Life, and General insurance portfolios.',
    responsibilities: [
      'Promptly follow up on prospective insurance leads within 30 minutes of generation.',
      'Conduct financial needs analysis and quote customized insurance proposals (Star Health, Care, HDFC Ergo, ICICI Lombard).',
      'Facilitate cashless Pre-Hospitalization / PHC checkup bookings and guide policyholders through underwriting requirements.',
      'Manage monthly policy renewals, quarterly/monthly EMI collections, and prevent policy lapse.',
      'Assist clients during claim intimations, document submission, cashless authorization, and claim settlement tracking.',
      'Maintain 100% CRM hygiene by recording call logs, customer notes, and daily work agendas in InsuMitra.'
    ],
    expectations: [
      'Maintain a minimum lead-to-proposal conversion rate of 35% on assigned leads.',
      'Achieve monthly Gross Written Premium (GWP) target as agreed in monthly targets.',
      'Zero policy lapse due to uncontacted renewal notices within 30 days before grace period expiry.',
      'Resolve client claim queries and document uploads within 24 hours of notification.',
      'Adhere strictly to IRDAI guidelines, KYC compliance, and data privacy policies.'
    ]
  },
  telecaller: {
    title: 'Inbound & Outbound Insurance Tele-Calling Executive',
    department: 'Inside Sales & Lead Qualification',
    reportingTo: 'Sales Team Leader',
    summary: 'Dedicated to high-velocity prospect engagement, customer outreach for renewal reminders, instant lead follow-ups, and scheduling qualified appointments for senior advisory specialists.',
    responsibilities: [
      'Make 40-60 outbound calls daily to marketing leads, inquiry forms, and renewal prospect lists.',
      'Explain basic policy coverage, sum insured options, and premium discounts to interested clients.',
      'Schedule appointments and product demonstrations for Senior Advisory Specialists.',
      'Follow up diligently on renewal grace periods, EMI payment dates, and pending KYC submissions.',
      'Accurately log call disposition, customer feedback, and follow-up reminders in InsuMitra CRM.'
    ],
    expectations: [
      'Maintain an average daily talk time of 2.5+ hours with 40+ connected customer conversations.',
      'Book a minimum of 4-6 qualified advisor consultation meetings per day.',
      'Achieve 85%+ contact rate on newly generated web and social leads within 1 hour.',
      'Zero customer grievance regarding unsolicited or inaccurate policy representations.'
    ]
  },
  claims: {
    title: 'Claims Support & Policy Operations Associate',
    department: 'Customer Operations & Claims Settlement',
    reportingTo: 'Operations Head',
    summary: 'Ensures frictionless claim processing, hospital cashless coordination, policy endorsements, document verification, and client advocacy during emergency hospitalizations and insurance claim settlements.',
    responsibilities: [
      'Guide policyholders through cashless hospital admission procedures, e-card downloads, and TPA pre-authorization.',
      'Review and verify reimbursement claim paperwork (hospital discharge summary, pharmacy bills, diagnostic reports).',
      'Follow up with insurance company claim desks and TPAs for speedy query resolution and claim settlement approval.',
      'Manage policy endorsements (address change, member addition/deletion, nominee correction).',
      'Maintain real-time claim status trackers in InsuMitra and notify policyholders via WhatsApp/Call.'
    ],
    expectations: [
      '100% of claim intimations acknowledged and attended within 2 hours.',
      'Achieve 95%+ first-time-right document verification for reimbursement files.',
      'Maintain an average claim turnaround time (TAT) under 10 days for reimbursement claims.',
      'Zero rejected claims due to preventable administrative or filing errors.'
    ]
  },
  field_agent: {
    title: 'Field Relationship Officer & POSP Manager',
    department: 'Direct Field Sales & Partner Channel',
    reportingTo: 'Agency Branch Manager',
    summary: 'Direct field presence driving community relationships, retail customer visits, POSP sub-broker onboarding, local merchant partnerships, and door-to-door insurance advisory.',
    responsibilities: [
      'Conduct daily 3-5 in-person client visits for insurance advisory and proposal presentations.',
      'Build local distribution networks with automobile garages, clinics, CA firms, and local business hubs.',
      'Collect physical KYC documents, inspect vehicle photos for break-in motor insurance, and submit proposals.',
      'Organize local financial wellness camps and health checkup awareness kiosks.',
      'Report daily field visit logs, client location tags, and meeting summaries via InsuMitra mobile workspace.'
    ],
    expectations: [
      'Complete a minimum of 60 verified client in-person visits per month.',
      'Achieve monthly new-to-agency GWP targets across Health, Motor, and SME packages.',
      'Maintain 100% daily check-in/out and visit summary submission on mobile CRM.'
    ]
  }
};

const DEFAULT_MOCK_EMPLOYEES: any[] = [
  {
    id: 'emp-001',
    firstName: 'Rahul',
    lastName: 'Mehta',
    phone: '+91 98765 43210',
    designation: 'Senior Insurance Specialist & Advisory Manager',
    department: 'Sales & Advisory',
    reportingManager: 'Agency Principal',
    user: { email: 'rahul.mehta@insumitra.com', role: 'ADMIN' },
    templateKey: 'advisor'
  },
  {
    id: 'emp-002',
    firstName: 'Priya',
    lastName: 'Sharma',
    phone: '+91 98230 11223',
    designation: 'Inbound & Outbound Insurance Tele-Calling Executive',
    department: 'Inside Sales & Lead Qualification',
    reportingManager: 'Rahul Mehta',
    user: { email: 'priya.sharma@insumitra.com', role: 'EMPLOYEE' },
    templateKey: 'telecaller'
  },
  {
    id: 'emp-003',
    firstName: 'Anjali',
    lastName: 'Nair',
    phone: '+91 97654 32109',
    designation: 'Claims Support & Policy Operations Associate',
    department: 'Customer Operations & Claims Settlement',
    reportingManager: 'Rahul Mehta',
    user: { email: 'anjali.nair@insumitra.com', role: 'EMPLOYEE' },
    templateKey: 'claims'
  },
  {
    id: 'emp-004',
    firstName: 'Vikram',
    lastName: 'Singhania',
    phone: '+91 99887 76655',
    designation: 'Field Relationship Officer & POSP Manager',
    department: 'Direct Field Sales & Partner Channel',
    reportingManager: 'Rahul Mehta',
    user: { email: 'vikram.singhania@insumitra.com', role: 'EMPLOYEE' },
    templateKey: 'field_agent'
  },
  {
    id: 'emp-005',
    firstName: 'Sneha',
    lastName: 'Kulkarni',
    phone: '+91 98112 44556',
    designation: 'Underwriting & Renewal Retention Specialist',
    department: 'Sales & Advisory',
    reportingManager: 'Rahul Mehta',
    user: { email: 'sneha.kulkarni@insumitra.com', role: 'EMPLOYEE' },
    templateKey: 'advisor'
  },
  {
    id: 'emp-006',
    firstName: 'Karan',
    lastName: 'Verma',
    phone: '+91 98112 33445',
    designation: 'POSP Partner & Agency Distribution Executive',
    department: 'Direct Field Sales & Partner Channel',
    reportingManager: 'Rahul Mehta',
    user: { email: 'karan.verma@insumitra.com', role: 'EMPLOYEE' },
    templateKey: 'field_agent'
  }
];

export default function EmployeeJobDescriptions() {
  const user = useAuthStore(s => s.user);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selected employee for modal inspection / editing
  const [inspectEmployee, setInspectEmployee] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Edit fields
  const [editTitle, setEditTitle] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editReportingTo, setEditReportingTo] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editResponsibilitiesText, setEditResponsibilitiesText] = useState('');
  const [editExpectationsText, setEditExpectationsText] = useState('');

  // Employee directory list
  const { data: empRes, isLoading: empLoading } = useQuery({
    queryKey: ['employees', 'job-descriptions-list'],
    queryFn: () => employeesService.list({ limit: 200 }),
    staleTime: 60_000,
  });

  const employees: any[] = useMemo(() => {
    const list = empRes?.data || [];
    if (list.length === 0) {
      return DEFAULT_MOCK_EMPLOYEES;
    }
    return list;
  }, [empRes]);

  // Helper to read JD for any employee
  const getEmployeeJd = (emp: any): SimpleJobDescriptionData => {
    if (!emp) return DEFAULT_SIMPLE_JD;
    const keys = [
      `insumitra_jd_${emp.id}`,
      ...(emp.userId ? [`insumitra_jd_${emp.userId}`] : []),
      ...(emp.user?.id ? [`insumitra_jd_${emp.user.id}`] : [])
    ];
    for (const key of keys) {
      try {
        const saved = localStorage.getItem(key);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }

    const template = emp.templateKey && SIMPLE_JD_TEMPLATES[emp.templateKey] 
      ? SIMPLE_JD_TEMPLATES[emp.templateKey] 
      : DEFAULT_SIMPLE_JD;

    return {
      ...template,
      title: emp.designation || template.title,
      department: emp.department || template.department,
      reportingTo: emp.reportingManager || template.reportingTo,
      lastUpdated: 'Live',
      updatedBy: 'Workspace Sync'
    };
  };

  // Populate edit fields when inspectEmployee opens or changes
  const handleOpenInspect = (emp: any, editDirectly: boolean = false) => {
    const data = getEmployeeJd(emp);
    setInspectEmployee(emp);
    setEditTitle(data.title);
    setEditDepartment(data.department);
    setEditReportingTo(data.reportingTo);
    setEditSummary(data.summary);
    setEditResponsibilitiesText(data.responsibilities.join('\n'));
    setEditExpectationsText(data.expectations.join('\n'));
    setIsEditing(editDirectly);
  };

  const handleSaveEdit = () => {
    if (!inspectEmployee) return;

    const respList = editResponsibilitiesText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    const expList = editExpectationsText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    const updated: SimpleJobDescriptionData = {
      title: editTitle.trim() || inspectEmployee.designation || DEFAULT_SIMPLE_JD.title,
      department: editDepartment.trim() || inspectEmployee.department || DEFAULT_SIMPLE_JD.department,
      reportingTo: editReportingTo.trim() || DEFAULT_SIMPLE_JD.reportingTo,
      summary: editSummary.trim() || DEFAULT_SIMPLE_JD.summary,
      responsibilities: respList.length > 0 ? respList : DEFAULT_SIMPLE_JD.responsibilities,
      expectations: expList.length > 0 ? expList : DEFAULT_SIMPLE_JD.expectations,
      lastUpdated: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      updatedBy: `${user?.firstName || 'Owner'} (Admin Edit)`
    };

    try {
      localStorage.setItem(`insumitra_jd_${inspectEmployee.id}`, JSON.stringify(updated));
      if (inspectEmployee.userId) localStorage.setItem(`insumitra_jd_${inspectEmployee.userId}`, JSON.stringify(updated));
      if (inspectEmployee.user?.id) localStorage.setItem(`insumitra_jd_${inspectEmployee.user.id}`, JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}

    setIsEditing(false);
    toast.success(`Job Description for ${inspectEmployee.firstName} updated & synced!`);
  };

  const filteredEmployees = useMemo(() => {
    if (!searchTerm.trim()) return employees;
    const q = searchTerm.toLowerCase();
    return employees.filter((e: any) => {
      const name = `${e.firstName || ''} ${e.lastName || ''}`.toLowerCase();
      const desig = (e.designation || '').toLowerCase();
      const dept = (e.department || '').toLowerCase();
      return name.includes(q) || desig.includes(q) || dept.includes(q);
    });
  }, [employees, searchTerm]);

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* ── ALL EMPLOYEES OVERVIEW TABLE ── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        
        {/* Search Bar on the Left */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search employee, designation, department..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>

          <p className="text-xs text-slate-400 font-bold">
            All Employees ({filteredEmployees.length})
          </p>
        </div>
        
        {empLoading && employees.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 font-semibold">
            Loading employees…
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 font-medium">
            No employees found matching filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="py-3 px-3">Employee</th>
                  <th className="py-3 px-3">Role &amp; Department</th>
                  <th className="py-3 px-3">Key Responsibilities</th>
                  <th className="py-3 px-3">KPI Targets</th>
                  <th className="py-3 px-3">Workspace Status</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {filteredEmployees.map((emp: any) => {
                  const empJd = getEmployeeJd(emp);

                  return (
                    <tr 
                      key={emp.id} 
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      onClick={() => handleOpenInspect(emp, false)}
                    >
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {emp.firstName?.[0] || 'E'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">
                              {emp.firstName} {emp.lastName}
                            </p>
                            <span className="text-[10px] text-slate-400">
                              {emp.user?.email || emp.phone || 'Active Employee'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <div>
                          <p className="font-bold text-slate-800">{empJd.title}</p>
                          <span className="text-[10px] text-slate-500 font-medium">{empJd.department}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-100">
                          {empJd.responsibilities.length} Duties
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-100">
                          {empJd.expectations.length} KPIs
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                          <CheckCircle2 size={11} className="text-emerald-600" />
                          <span>Live in Workspace</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenInspect(emp, true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                            title="Edit Job Description & KPIs"
                          >
                            <Edit3 size={12} />
                            <span>Edit JD</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* ── INSPECT & EDIT EMPLOYEE MODAL ── */}
      {inspectEmployee && (() => {
        const jd = getEmployeeJd(inspectEmployee);
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-100 shadow-2xl p-6 space-y-5 animate-scaleUp max-h-[90vh] overflow-y-auto">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold">
                    {inspectEmployee.firstName?.[0] || 'E'}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      {inspectEmployee.firstName} {inspectEmployee.lastName}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {isEditing ? editTitle : jd.title} • {isEditing ? editDepartment : jd.department}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 size={13} />
                      <span>Edit Details</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save size={13} />
                      <span>Save Changes</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setInspectEmployee(null);
                      setIsEditing(false);
                    }}
                    className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Editable Fields for Role Title, Dept, Reporting To */}
              {isEditing && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-blue-50/50 p-3.5 rounded-2xl border border-blue-100">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase text-blue-900 tracking-wider">
                      Role / Designation
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      className="w-full text-xs font-bold text-slate-800 bg-white border border-blue-200 rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase text-blue-900 tracking-wider">
                      Department
                    </label>
                    <input
                      type="text"
                      value={editDepartment}
                      onChange={e => setEditDepartment(e.target.value)}
                      className="w-full text-xs font-bold text-slate-800 bg-white border border-blue-200 rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase text-blue-900 tracking-wider">
                      Reports To
                    </label>
                    <input
                      type="text"
                      value={editReportingTo}
                      onChange={e => setEditReportingTo(e.target.value)}
                      className="w-full text-xs font-bold text-slate-800 bg-white border border-blue-200 rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              )}

              {/* Purpose */}
              <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                  <FileText size={13} className="text-blue-600" />
                  Role Purpose &amp; Overview
                </span>
                {isEditing ? (
                  <textarea
                    rows={3}
                    value={editSummary}
                    onChange={e => setEditSummary(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none leading-relaxed font-medium text-slate-800"
                    placeholder="Describe role purpose..."
                  />
                ) : (
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    {jd.summary}
                  </p>
                )}
              </div>

              {/* Responsibilities & KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Responsibilities */}
                <div className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                    <Target size={14} className="text-blue-600" />
                    Key Responsibilities {isEditing ? '(One per line)' : `(${jd.responsibilities.length})`}
                  </span>
                  {isEditing ? (
                    <textarea
                      rows={8}
                      value={editResponsibilitiesText}
                      onChange={e => setEditResponsibilitiesText(e.target.value)}
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none leading-relaxed font-medium text-slate-800"
                    />
                  ) : (
                    <ul className="space-y-1.5">
                      {jd.responsibilities.map((resp, i) => (
                        <li key={i} className="text-xs text-slate-700 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 leading-relaxed font-medium">
                          {i + 1}. {resp}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Performance KPIs */}
                <div className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                    <Shield size={14} className="text-emerald-600" />
                    Performance KPIs {isEditing ? '(One per line)' : `(${jd.expectations.length})`}
                  </span>
                  {isEditing ? (
                    <textarea
                      rows={8}
                      value={editExpectationsText}
                      onChange={e => setEditExpectationsText(e.target.value)}
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none leading-relaxed font-medium text-slate-800"
                    />
                  ) : (
                    <ul className="space-y-1.5">
                      {jd.expectations.map((exp, i) => (
                        <li key={i} className="text-xs text-emerald-950 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100 leading-relaxed font-semibold">
                          ✓ {exp}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-[10px] text-slate-400 font-medium">
                  {isEditing ? 'Editing mode active' : `Last synced: ${jd.lastUpdated || 'Today'}`}
                </span>

                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <Save size={14} />
                        <span>Save Changes</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setInspectEmployee(null)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
