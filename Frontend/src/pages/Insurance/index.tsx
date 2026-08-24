import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { insuranceService, contactsService, leadsService, policiesService, claimsService } from '@api/index';
import {
  Plus, Pencil, Trash2, Building2, Shield, ChevronDown, ChevronRight,
  Download, Filter, FileText, Users, TrendingUp, Briefcase, Type, X, ShieldCheck,
  ArrowLeft, Search, Check, Lock, Calendar, Star
} from 'lucide-react';
import Modal from '@comps/common/Modal';
import SettingsPanel from './SettingsPanel';
import DeletionRequests from '../DeletionRequests';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { DatePicker } from '@comps/common/DatePicker';
import { useUiSettingsStore, FONT_SIZE_MAP, type FontSizeLevel } from '@store/ui-settings.store';
import { useAuthStore } from '@store/auth.store';
import { deletionRequestsService } from '@api/deletionRequestsService';

/* ─── Schemas ──────────────────────────────────────────────────────────────── */
const companySchema = z.object({
  name: z.string().min(1, 'Required'),
  code: z.string().optional(),
  website: z.string().url('Enter a valid URL').optional().or(z.literal('')),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  claimsPhone: z.string().optional(),
  notes: z.string().optional(),
});
type CompanyForm = z.infer<typeof companySchema>;

const planSchema = z.object({
  name: z.string().optional(),
  category: z.enum(['LIFE', 'HEALTH', 'MOTOR', 'TRAVEL', 'HOME', 'FIRE', 'MARINE', 'TERM', 'ULIP', 'PENSION', 'OTHER']),
  description: z.string().optional(),
  minSumAssured: z.coerce.number().min(0).optional(),
  maxSumAssured: z.coerce.number().min(0).optional(),
  minAge: z.coerce.number().min(0).max(120).optional(),
  maxAge: z.coerce.number().min(0).max(120).optional(),
  policyTerm: z.coerce.number().min(0).optional(),
  premiumPayingTerm: z.coerce.number().min(0).optional(),
  isActive: z.boolean().optional(),
});
type PlanForm = z.infer<typeof planSchema>;

const CATEGORIES = ['LIFE', 'HEALTH', 'MOTOR', 'TRAVEL', 'HOME', 'FIRE', 'MARINE', 'TERM', 'ULIP', 'PENSION', 'OTHER'];

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
function fmtDate(v: any): string {
  if (!v) return '';
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
  } catch {
    return String(v);
  }
}
/** Format a number as Indian currency string (no ₹ symbol — plain number for Excel). */
function fmtNum(v: any): string {
  if (v == null || v === '') return '';
  const n = Number(v);
  return isNaN(n) ? String(v) : n.toLocaleString('en-IN');
}
/** Build "First Last" from a contact object. */
function contactName(c: any): string {
  if (!c) return '';
  return `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
}
/** Build employee full name from the nested employeeProfile or fallback fields. */
function empName(u: any): string {
  if (!u) return '';
  if (u.employeeProfile) return `${u.employeeProfile.firstName ?? ''} ${u.employeeProfile.lastName ?? ''}`.trim();
  if (u.firstName) return `${u.firstName} ${u.lastName ?? ''}`.trim();
  return u.name ?? u.email ?? '';
}

/* ─── Export column definitions per entity ──────────────────────────────────── */
// Each column has a `label` (CSV header) and an `extract` function that takes a
// raw API row and returns a plain, readable string — no JSON blobs.
type ExportCol = { key: string; label: string; extract: (row: any) => string };
type ExportEntity = 'contacts' | 'leads' | 'policies' | 'claims';

const EXPORT_COLUMNS: Record<ExportEntity, ExportCol[]> = {
  contacts: [
    { key: 'firstName',   label: 'First Name',    extract: r => r.firstName ?? '' },
    { key: 'lastName',    label: 'Last Name',     extract: r => r.lastName ?? '' },
    { key: 'email',       label: 'Email',         extract: r => r.email ?? '' },
    { key: 'phone',       label: 'Phone',         extract: r => r.phone ?? '' },
    { key: 'city',        label: 'City',          extract: r => r.city ?? '' },
    { key: 'state',       label: 'State',         extract: r => r.state ?? '' },
    { key: 'dateOfBirth', label: 'Date of Birth', extract: r => fmtDate(r.dateOfBirth) },
    { key: 'tags',        label: 'Tags',          extract: r => Array.isArray(r.tags) ? r.tags.join('; ') : (r.tags ?? '') },
    { key: 'createdAt',   label: 'Created At',    extract: r => fmtDate(r.createdAt) },
  ],
  leads: [
    { key: 'contact',        label: 'Contact Name',    extract: r => contactName(r.contact) },
    { key: 'contactPhone',   label: 'Contact Phone',   extract: r => r.contact?.phone ?? '' },
    { key: 'product',        label: 'Product',         extract: r => r.productType ?? r.product ?? '' },
    { key: 'stage',          label: 'Stage',           extract: r => r.stage ?? r.status ?? '' },
    { key: 'estimatedValue', label: 'Estimated Value', extract: r => fmtNum(r.estimatedValue) },
    { key: 'assignedTo',     label: 'Assigned To',     extract: r => empName(r.assignedEmployee) },
    { key: 'followUpDate',   label: 'Follow-up Date',  extract: r => fmtDate(r.followUpDate) },
    { key: 'notes',          label: 'Notes',           extract: r => r.notes ?? '' },
    { key: 'createdAt',      label: 'Created At',      extract: r => fmtDate(r.createdAt) },
  ],
  policies: [
    { key: 'policyNumber',  label: 'Policy Number',  extract: r => r.policyNumber ?? '' },
    { key: 'contact',       label: 'Contact Name',   extract: r => contactName(r.contact) },
    { key: 'contactPhone',  label: 'Contact Phone',  extract: r => r.contact?.phone ?? '' },
    { key: 'insurer',       label: 'Insurer',        extract: r => r.plan?.company?.name ?? r.insurer ?? '' },
    { key: 'plan',          label: 'Plan',           extract: r => r.plan?.name ?? '' },
    { key: 'category',      label: 'Category',       extract: r => r.plan?.category ?? '' },
    { key: 'status',        label: 'Status',         extract: r => r.status ?? '' },
    { key: 'premium',       label: 'Premium (₹)',    extract: r => fmtNum(r.premium) },
    { key: 'sumAssured',    label: 'Sum Assured (₹)',extract: r => fmtNum(r.sumAssured) },
    { key: 'startDate',     label: 'Start Date',     extract: r => fmtDate(r.startDate) },
    { key: 'endDate',       label: 'End / Renewal',  extract: r => fmtDate(r.endDate) },
    { key: 'assignedTo',    label: 'Assigned To',    extract: r => empName(r.assignedEmployee) },
    { key: 'createdAt',     label: 'Created At',     extract: r => fmtDate(r.createdAt) },
  ],
  claims: [
    { key: 'claimNumber',  label: 'Claim Number',   extract: r => r.claimNumber ?? '' },
    { key: 'policy',       label: 'Policy Number',  extract: r => r.policy?.policyNumber ?? '' },
    { key: 'contact',      label: 'Contact Name',   extract: r => contactName(r.contact) },
    { key: 'contactPhone', label: 'Contact Phone',  extract: r => r.contact?.phone ?? '' },
    { key: 'status',       label: 'Status',         extract: r => r.status ?? '' },
    { key: 'claimAmount',  label: 'Claim Amount (₹)',extract: r => fmtNum(r.claimAmount) },
    { key: 'approvedAmount',label: 'Approved Amount (₹)', extract: r => fmtNum(r.approvedAmount) },
    { key: 'filedDate',    label: 'Filed Date',     extract: r => fmtDate(r.filedDate) },
    { key: 'settledDate',  label: 'Settled Date',   extract: r => fmtDate(r.settledDate) },
    { key: 'assignedTo',   label: 'Assigned To',    extract: r => empName(r.assignedEmployee) },
    { key: 'notes',        label: 'Notes',          extract: r => r.notes ?? '' },
    { key: 'createdAt',    label: 'Created At',     extract: r => fmtDate(r.createdAt) },
  ],
};

/** Escape a value for a CSV cell: wrap in quotes, double any internal quotes. */
function csvCell(v: string): string {
  const s = v == null ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

/** Build a UTF-8 CSV Blob from rows using the column extractor functions. */
function buildCsv(rows: any[], cols: ExportCol[]): Blob {
  const header = cols.map(c => csvCell(c.label)).join(',');
  const body   = rows.map(row => cols.map(c => csvCell(c.extract(row))).join(',')).join('\n');
  // BOM (\uFEFF) makes Excel open the file in UTF-8 without garbling Indian names
  return new Blob(['\uFEFF' + header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
}

const ENTITY_ICONS: Record<string, React.ElementType> = {
  contacts: Users,
  leads:    TrendingUp,
  policies: Shield,
  claims:   FileText,
};

/* ─── Bulk Export Panel ─────────────────────────────────────────────────────── */
function BulkExportPanel() {
  const [activeSubView, setActiveSubView] = useState<'list' | 'history'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('All Modules');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [exportingId, setExportingId] = useState<number | null>(null);

  const [modules, setModules] = useState([
    { id: 1, name: 'Insurance Companies', desc: 'All insurance companies and details', records: 2, lastExported: '20-08-2026 10:15 AM', status: 'Exported' },
    { id: 2, name: 'Plans', desc: 'All plans under all companies', records: 15, lastExported: '20-08-2026 10:16 AM', status: 'Exported' },
    { id: 3, name: 'Riders / Add-ons', desc: 'All riders/add-ons under plans', records: 23, lastExported: '20-08-2026 10:16 AM', status: 'Exported' },
    { id: 4, name: 'Agents / Agencies', desc: 'All agents and agencies', records: 18, lastExported: '20-08-2026 10:14 AM', status: 'Exported' },
    { id: 5, name: 'Hospitals & Doctors', desc: 'All hospitals and doctors', records: 475, lastExported: '20-08-2026 10:17 AM', status: 'Exported' },
    { id: 6, name: 'Dropdown / Master Data', desc: 'All dropdown and master data', records: null, lastExported: 'Never', status: 'Not Exported' },
    { id: 7, name: 'Policies', desc: 'All active and inactive policies', records: 142, lastExported: 'Never', status: 'Not Exported' },
    { id: 8, name: 'Leads', desc: 'All active sales leads and inquiries', records: 58, lastExported: 'Never', status: 'Not Exported' },
    { id: 9, name: 'Renewals', desc: 'Policies due for upcoming renewal', records: 12, lastExported: 'Never', status: 'Not Exported' },
    { id: 10, name: 'Preventive Health Checkups (PHC)', desc: 'Preventive Health Checkup tracking statuses', records: 34, lastExported: 'Never', status: 'Not Exported' },
    { id: 11, name: 'Claims', desc: 'All health and general insurance claims', records: 29, lastExported: 'Never', status: 'Not Exported' },
  ]);

  const [historyList, setHistoryList] = useState([
    { id: 1, name: 'Insurance Companies', module: 'Insurance Companies', records: 2, user: 'Rahul Mehta', date: '20-08-2026 10:15 AM', file: 'insurance_companies_2026.xlsx' },
    { id: 2, name: 'Plans', module: 'Plans', records: 15, user: 'Rahul Mehta', date: '20-08-2026 10:16 AM', file: 'plans_2026.xlsx' },
    { id: 3, name: 'Riders/Add-ons', module: 'Riders / Add-ons', records: 23, user: 'Rahul Mehta', date: '20-08-2026 10:16 AM', file: 'riders_2026.xlsx' },
    { id: 4, name: 'Agents/Agencies', module: 'Agents / Agencies', records: 18, user: 'Rahul Mehta', date: '20-08-2026 10:14 AM', file: 'agents_2026.xlsx' },
    { id: 5, name: 'Hospitals & Doctors', module: 'Hospitals & Doctors', records: 475, user: 'Rahul Mehta', date: '20-08-2026 10:17 AM', file: 'hospitals_doctors_2026.xlsx' },
    { id: 6, name: 'All Data (Full Backup)', module: 'All Modules', records: 1200, user: 'Rahul Mehta', date: '19-08-2026 06:30 PM', file: 'full_backup_2026.xlsx' },
  ]);

  const handleExport = async (mod: typeof modules[0]) => {
    setExportingId(mod.id);
    try {
      if (mod.name === 'Insurance Companies') {
        const res = await insuranceService.listCompanies();
        const list = res.data ?? res ?? [];
        const headers = ['Name', 'Code', 'Website', 'Phone', 'Email', 'Notes'];
        const body = list.map((c: any) => [
          `"${(c.name || '').replace(/"/g, '""')}"`,
          `"${(c.code || '').replace(/"/g, '""')}"`,
          `"${(c.website || '').replace(/"/g, '""')}"`,
          `"${(c.phone || '').replace(/"/g, '""')}"`,
          `"${(c.email || '').replace(/"/g, '""')}"`,
          `"${(c.notes || '').replace(/"/g, '""')}"`
        ].join(',')).join('\n');
        downloadFile(headers.join(',') + '\n' + body, 'insurance_companies_2026.csv');
      } else if (mod.name === 'Plans') {
        const cosRes = await insuranceService.listCompanies();
        const cos = cosRes.data ?? cosRes ?? [];
        let allPlans: any[] = [];
        for (const co of cos) {
          const plansRes = await insuranceService.listPlans(co.id);
          const plans = plansRes.data ?? plansRes ?? [];
          allPlans = [...allPlans, ...plans.map((p: any) => ({ ...p, companyName: co.name }))];
        }
        const headers = ['Company', 'Plan Name', 'Category', 'Status', 'Min Sum Assured', 'Max Sum Assured', 'Min Age', 'Max Age', 'Policy Term', 'Premium Term'];
        const body = allPlans.map((p: any) => [
          `"${(p.companyName || '').replace(/"/g, '""')}"`,
          `"${(p.name || '').replace(/"/g, '""')}"`,
          `"${(p.category || '').replace(/"/g, '""')}"`,
          `"${p.isActive ? 'Active' : 'Inactive'}"`,
          p.minSumAssured ?? '',
          p.maxSumAssured ?? '',
          p.minAge ?? '',
          p.maxAge ?? '',
          p.policyTerm ?? '',
          p.premiumPayingTerm ?? ''
        ].join(',')).join('\n');
        downloadFile(headers.join(',') + '\n' + body, 'plans_2026.csv');
      } else if (mod.name === 'Dropdown / Master Data') {
        const data = JSON.parse(localStorage.getItem('mock_dropdowns') || '[]');
        const headers = ['Category', 'Value', 'Active'];
        const body = data.map((d: any) => [
          `"${(d.category || '').replace(/"/g, '""')}"`,
          `"${(d.value || '').replace(/"/g, '""')}"`,
          d.active ? 'Active' : 'Inactive'
        ].join(',')).join('\n');
        downloadFile(headers.join(',') + '\n' + body, 'dropdown_master_25.csv');
      } else {
        // Fallback mock export for demonstration
        const headers = ['ID', 'Module', 'Timestamp', 'Record Count'];
        const body = `1,${mod.name},${new Date().toLocaleString()},${mod.records ?? 0}`;
        downloadFile(headers.join(',') + '\n' + body, `${mod.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_2026.csv`);
      }

      // Update modules exported status list
      setModules(prev => prev.map(m => {
        if (m.id === mod.id) {
          const nowStr = new Date().toLocaleString('en-IN', { hour12: true }).replace(/:\d{2}\s/, ' ');
          return {
            ...m,
            lastExported: nowStr,
            status: 'Exported',
            records: m.records ? m.records + 1 : 1
          };
        }
        return m;
      }));
      toast.success(`${mod.name} exported successfully!`);
    } catch (err) {
      toast.error('Export failed');
    } finally {
      setExportingId(null);
    }
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteHistory = (id: number) => {
    if (confirm('Are you sure you want to delete this export history record?')) {
      setHistoryList(prev => prev.filter(h => h.id !== id));
      toast.success('Export history record deleted');
    }
  };

  // --- FILTERS ---
  const filteredModules = modules.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        m.desc.toLowerCase().includes(searchQuery.toLowerCase());
    const matchModule = moduleFilter === 'All Modules' || m.name.includes(moduleFilter) || moduleFilter.includes(m.name);
    const matchStatus = statusFilter === 'All Status' || m.status === statusFilter;
    return matchSearch && matchModule && matchStatus;
  });

  return (
    <div className="space-y-6">
      {activeSubView === 'list' ? (
        <div className="space-y-5">
          {/* Main header block */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Bulk Data Export</h3>
            <p className="text-xs text-gray-500">Export data in bulk across modules</p>
          </div>

          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64 min-w-[220px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search modules to export..."
                  className="border border-slate-200 rounded-xl pl-9 pr-4 py-1.5 text-xs font-medium w-full focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                />
              </div>

              <select 
                value={moduleFilter}
                onChange={e => setModuleFilter(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
              >
                <option>All Modules</option>
                <option>Insurance</option>
                <option>Plan</option>
                <option>Rider</option>
                <option>Agent</option>
                <option>Hospital</option>
                <option>Master Data</option>
              </select>

              <select 
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
              >
                <option>All Status</option>
                <option>Exported</option>
                <option>Not Exported</option>
              </select>
            </div>

            <button 
              onClick={() => setActiveSubView('history')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors cursor-pointer w-full sm:w-auto justify-center"
            >
              <Download size={13} />
              Export History
            </button>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-55/60 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Module</th>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3 text-center w-24">Records</th>
                  <th className="px-5 py-3 w-40">Last Exported</th>
                  <th className="px-5 py-3 w-28">Status</th>
                  <th className="px-5 py-3 text-right w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredModules.map(mod => (
                  <tr key={mod.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3.5 font-bold text-slate-800">{mod.name}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-500">{mod.desc}</td>
                    <td className="px-5 py-3.5 text-center font-bold text-slate-700">{mod.records !== null ? mod.records : '—'}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-450">{mod.lastExported}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                        mod.status === 'Exported' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' 
                          : 'bg-slate-50 text-slate-500 border border-slate-200/50'
                      }`}>
                        {mod.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button 
                        onClick={() => handleExport(mod)}
                        disabled={exportingId === mod.id}
                        className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-800 font-bold text-xs cursor-pointer disabled:opacity-50"
                      >
                        <Download size={12} />
                        {exportingId === mod.id ? 'Exporting…' : 'Export'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[10px] text-slate-400 italic">Note: Exports are in Excel (.xlsx) format.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Breadcrumb Header */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <button onClick={() => setActiveSubView('list')} className="hover:text-primary-600 transition-colors flex items-center gap-1">
                <ArrowLeft size={13} /> Bulk Data Export
              </button>
              <span>&gt;</span>
              <span className="text-slate-800">Export History</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight mt-2">Export History</h2>
            <p className="text-xs text-slate-500 font-semibold leading-tight mt-0.5">View all previous bulk export records</p>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-55/60 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Export Name</th>
                  <th className="px-5 py-3">Module</th>
                  <th className="px-5 py-3 text-center w-24">Records</th>
                  <th className="px-5 py-3 w-32">Exported By</th>
                  <th className="px-5 py-3 w-40">Exported On</th>
                  <th className="px-5 py-3">File</th>
                  <th className="px-5 py-3 text-right w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyList.map(hist => (
                  <tr key={hist.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3.5 font-bold text-slate-850">{hist.name}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-500">{hist.module}</td>
                    <td className="px-5 py-3.5 text-center font-bold text-slate-700">{hist.records}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800">{hist.user}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-450">{hist.date}</td>
                    <td className="px-5 py-3.5 font-mono text-primary-600 font-semibold">{hist.file}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => {
                            toast.success(`Downloading ${hist.file}...`);
                            const dummyContent = `Export Name,Module,Records,Exported By,Exported On\n${hist.name},${hist.module},${hist.records},${hist.user},${hist.date}`;
                            downloadFile(dummyContent, hist.file.replace('.xlsx', '.csv'));
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-all cursor-pointer"
                          title="Download File"
                        >
                          <Download size={13} />
                        </button>
                        <button 
                          onClick={() => handleDeleteHistory(hist.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all cursor-pointer"
                          title="Delete Record"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="bg-slate-50/50 border-t border-slate-150 px-5 py-3 flex items-center justify-between text-slate-500 font-semibold">
              <span>Showing 1 to {historyList.length} of 24 entries</span>
              <div className="flex items-center gap-1.5">
                <button className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-[11px] cursor-pointer" disabled>1</button>
                <button className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] cursor-pointer">2</button>
                <button className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] cursor-pointer">3</button>
                <span className="px-1.5 text-slate-300">...</span>
                <button className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] cursor-pointer">5</button>
                <button className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] cursor-pointer">&gt;</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Font Size Control Panel ──────────────────────────────────────────────── */
function FontSizePanel() {
  const { fontSize, setFontSize } = useUiSettingsStore();

  const levels: FontSizeLevel[] = ['sm', 'lg', 'xl'];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Font Size Control</h3>
        <p className="text-xs text-gray-500">Adjust the app's base text size. Especially useful when using Insumitra on a phone or tablet. Your preference is saved automatically.</p>
      </div>

      {/* Size picker */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {levels.map(level => {
          const info   = FONT_SIZE_MAP[level];
          const active = fontSize === level;
          return (
            <button
              key={level}
              onClick={() => setFontSize(level)}
              className={[
                'flex flex-col items-start gap-1 p-4 rounded-xl border-2 text-left transition-all duration-150',
                active
                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
              ].join(' ')}
            >
              {/* Preview glyph at actual size */}
              <span
                className="font-bold text-gray-700 leading-none mb-1"
                style={{ fontSize: info.px }}
              >
                Aa
              </span>
              <span className={`text-xs font-semibold ${active ? 'text-blue-700' : 'text-gray-700'}`}>
                {info.label}
              </span>
              <span className="text-[10px] text-gray-400 leading-tight">{info.desc}</span>
              <span className={`mt-1 text-[10px] font-mono font-bold ${ active ? 'text-blue-500' : 'text-gray-300'}`}>
                {info.px}px
              </span>
              {active && (
                <span className="mt-1 self-start text-[9px] uppercase font-bold tracking-widest text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Live preview */}
      <div className="card p-5 space-y-3 bg-gradient-to-br from-gray-50 to-white">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Live Preview</p>
        <p className="font-bold text-gray-900" style={{ fontSize: FONT_SIZE_MAP[fontSize].px + 4 }}>Policy Renewal Reminder</p>
        <p className="text-gray-600" style={{ fontSize: FONT_SIZE_MAP[fontSize].px }}>
          Dear Rajesh Kumar, your motor insurance policy <strong>#POL-2024-9812</strong> is due for renewal on <strong>25 Aug 2026</strong>.
          Please contact us to renew your policy and avoid a lapse in coverage.
        </p>
        <div className="flex gap-3 flex-wrap">
          <span className="badge-green" style={{ fontSize: FONT_SIZE_MAP[fontSize].px - 2 }}>Active</span>
          <span className="badge-blue"  style={{ fontSize: FONT_SIZE_MAP[fontSize].px - 2 }}>MOTOR</span>
          <span className="badge-yellow" style={{ fontSize: FONT_SIZE_MAP[fontSize].px - 2 }}>Renewal Due</span>
        </div>
      </div>

      <p className="text-[10px] text-gray-400 italic">
        Tip: On a phone, try <strong>Large</strong> or <strong>Extra Large</strong> for easier reading without zooming.
      </p>
    </div>
  );
}

/* ─── Main Insurance / Operations Page ─────────────────────────────────────── */
export default function Insurance() {
  const qc = useQueryClient();
  const { user: authUser } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [activeTab, setActiveTab]         = useState<'companies' | 'export' | 'display' | 'settings' | 'delete_requests'>(
    (tabParam === 'settings' || tabParam === 'export' || tabParam === 'display' || tabParam === 'delete_requests') ? tabParam : 'companies'
  );

  const [settingsSubTab, setSettingsSubTab] = useState<'dashboard' | 'compulsory' | 'master' | 'access' | 'employee_access' | 'backup' | 'audit'>('dashboard');
  const [currentView, setCurrentView] = useState<'dashboard' | 'companies' | 'plans' | 'riders' | 'agents' | 'resources' | 'filters' | 'add_hospital' | 'add_doctor' | 'search_settings' | 'mapping'>('dashboard');

  useEffect(() => {
    if (tabParam && tabParam !== activeTab && ['companies', 'settings', 'export', 'display', 'delete_requests'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [tabParam]);

  useEffect(() => {
    const currentParam = searchParams.get('tab');
    if (activeTab === 'companies') {
      if (currentParam) {
        searchParams.delete('tab');
        setSearchParams(searchParams, { replace: true });
      }
    } else if (currentParam !== activeTab) {
      searchParams.set('tab', activeTab);
      setSearchParams(searchParams, { replace: true });
    }
  }, [activeTab, searchParams, setSearchParams]);

  const [companySearch, setCompanySearch] = useState('');
  const [hospitalModal, setHospitalModal] = useState(false);

  // Add Hospital form states
  const [hospitalForm, setHospitalForm] = useState({
    name: '',
    address: '',
    city: '',
    pincode: '',
    contactNo: '',
    type: 'Network',
    claimsPerson1Name: '',
    claimsPerson1Contact: '',
    claimsPerson2Name: '',
    claimsPerson2Contact: '',
    comment: ''
  });
  const [hospitalDoctors, setHospitalDoctors] = useState<Array<{
    id: string;
    name: string;
    degree: string;
    contactNo: string;
    speciality: string;
  }>>([]);
  const [agentModal, setAgentModal] = useState(false);
  const [agentModalTab, setAgentModalTab] = useState<'details' | 'payout'>('details');
  const [agentsList, setAgentsList] = useState([
    {
      id: 1,
      agencyName: 'Avinash Insu Agency',
      agentName: 'Avinash Kumar',
      phone: '+91 98765 43210',
      email: 'avinash@example.com',
      status: 'Active'
    },
    {
      id: 2,
      agencyName: 'PAT Assurance Services',
      agentName: 'Prashant Patil',
      phone: '+91 98123 45678',
      email: 'prashant.pat@example.com',
      status: 'Active'
    }
  ]);
  const [agentForm, setAgentForm] = useState({
    category: '',
    companyId: '',
    agentName: '',
    agencyNameDisplay: '',
    agencyCode: '',
    startDate: '',
    homeBranch: '',
    homeBranchCode: '',
    rmName: '',
    rmContact: '',
    bmName: '',
    bmContact: '',
    bankName: '',
    bankBranch: '',
    bankIfsc: '',
    bankAccount: '',
    comment: ''
  });



  const [companyModal, setCompanyModal]   = useState(false);
  const [companyModalTab, setCompanyModalTab] = useState<'details' | 'others' | 'hospitals' | 'agents' | 'resources'>('details');
  const [extraCompanyFields, setExtraCompanyFields] = useState({
    category: '',
    headOffice: '',
    branchOffice: '',
    emails: [] as { id: string; email: string; description: string }[],
    hospitals: [] as any[],
    agents: [] as any[],
    resources: [] as any[]
  });
  const [editCompany, setEditCompany]     = useState<any | null>(null);
  const [deleteCompany, setDeleteCompany] = useState<any | null>(null);
  
  const handleAgentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentForm.category || !agentForm.companyId || !agentForm.agentName || !agentForm.agencyCode || !agentForm.startDate) {
      toast.error('Please fill in all required fields in Agent Details tab');
      setAgentModalTab('details');
      return;
    }
    const newAgent = {
      id: Date.now(),
      agencyName: agentForm.agencyNameDisplay || `${agentForm.agentName} Agency`,
      agentName: agentForm.agentName,
      phone: agentForm.rmContact || '+91 99999 88888',
      email: `${agentForm.agentName.toLowerCase().replace(/\s+/g, '')}@example.com`,
      status: 'Active'
    };
    setAgentsList(prev => [newAgent, ...prev]);
    toast.success('Agent saved successfully (mock)');
    setAgentModal(false);
    setAgentModalTab('details');
    setAgentForm({
      category: '',
      companyId: '',
      agentName: '',
      agencyNameDisplay: '',
      agencyCode: '',
      startDate: '',
      homeBranch: '',
      homeBranchCode: '',
      rmName: '',
      rmContact: '',
      bmName: '',
      bmContact: '',
      bankName: '',
      bankBranch: '',
      bankIfsc: '',
      bankAccount: '',
      comment: ''
    });
  };

  const closeCompanyModal = () => {
    setCompanyModal(false);
    setEditCompany(null);
    companyForm.reset();
    setExtraCompanyFields({ category: '', headOffice: '', branchOffice: '', emails: [], hospitals: [], agents: [], resources: [] });
    setCompanyModalTab('details');
  };
  const [planModal, setPlanModal]         = useState<{ companyId: string; company: string } | null>(null);
  const [editPlan, setEditPlan]           = useState<any | null>(null);
  const [deletePlan, setDeletePlan]       = useState<any | null>(null);
  const [planNames, setPlanNames]         = useState<string[]>(['']);
  const [planRiders, setPlanRiders]       = useState<{ id: string; name: string; description: string }[]>([]);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [planCompanyId, setPlanCompanyId] = useState<string>('');

  useEffect(() => {
    if (editPlan) setPlanCompanyId(editPlan.companyId || planModal?.companyId || '');
    else if (planModal) setPlanCompanyId(planModal.companyId || '');
  }, [editPlan, planModal]);

  const { data: companies, isLoading } = useQuery({
    queryKey: ['insurance-companies'],
    queryFn: () => insuranceService.listCompanies(),
  });

  const { data: hospitalsRes } = useQuery({
    queryKey: ['hospitals-list'],
    queryFn: () => insuranceService.listHospitals(),
  });
  const hospitals = useMemo(() => {
    return hospitalsRes?.data ?? [];
  }, [hospitalsRes?.data]);

  const totalDoctors = useMemo(() => {
    return hospitals.reduce((sum, h) => sum + (h.doctors?.length || 0), 0);
  }, [hospitals]);

  const { data: plans } = useQuery({
    queryKey: ['insurance-plans', expandedCompany],
    queryFn: () => insuranceService.listPlans(expandedCompany!),
    enabled: !!expandedCompany,
  });

  const { data: planModalPlansRes } = useQuery({
    queryKey: ['insurance-plans-for-modal', planCompanyId],
    queryFn: () => insuranceService.listPlans(planCompanyId),
    enabled: !!planCompanyId,
  });
  const planModalPlans = planModalPlansRes?.data || [];

  const rawCompanyList: any[] = companies?.data ?? companies ?? [];
  const companyList = useMemo(() => {
    if (!companySearch.trim()) return rawCompanyList;
    const q = companySearch.toLowerCase();
    return rawCompanyList.filter((co: any) =>
      co.name?.toLowerCase().includes(q) ||
      co.code?.toLowerCase().includes(q) ||
      co.phone?.includes(q)
    );
  }, [rawCompanyList, companySearch]);
  const planList: any[]    = plans?.data ?? plans ?? [];

  useEffect(() => {
    const catLabel = agentForm.category === 'Health - SAHI' ? 'Health' : (agentForm.category === 'General' ? 'General' : (agentForm.category === 'Life' ? 'Life' : 'Other'));
    const companyObj = rawCompanyList.find(c => c.id === agentForm.companyId);
    const coName = companyObj?.code || companyObj?.name?.split(' ')[0] || '';
    const displayVal = [catLabel, coName, agentForm.agentName].filter(Boolean).join(' - ');
    setAgentForm(p => ({ ...p, agencyNameDisplay: displayVal }));
  }, [agentForm.category, agentForm.companyId, agentForm.agentName, rawCompanyList]);

  const companiesByCategory = useMemo(() => {
    const grouped: Record<string, any[]> = { 
      'Health Insurance - SAHI': [], 
      'General Insurance': [], 
      'Life Insurance': [], 
      'Other': [] 
    };
    companyList.forEach(c => {
      let cat = 'Other';
      if (c.notes && c.notes.startsWith('{')) {
        try { cat = JSON.parse(c.notes).category || 'Other'; } catch {}
      }
      
      if (cat === 'Health - SAHI') cat = 'Health Insurance - SAHI';
      else if (cat === 'General') cat = 'General Insurance';
      else if (cat === 'Life') cat = 'Life Insurance';
      else cat = 'Other';

      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(c);
    });
    return grouped;
  }, [companyList]);

  const selectedCompanyCategory = useMemo(() => {
    const c = companyList.find(x => x.id === planCompanyId);
    if (!c) return '';
    if (c.notes && c.notes.startsWith('{')) {
      try { return JSON.parse(c.notes).category || ''; } catch {}
    }
    return '';
  }, [companyList, planCompanyId]);

  const PLAN_CATEGORY_OPTIONS = useMemo(() => {
    if (selectedCompanyCategory === 'Health - SAHI' || selectedCompanyCategory === 'General') {
      return ['Health', 'Accident', 'Critical Illness', 'Group Health', 'Group PA', 'SME Health', 'SME PA', 'Travel', 'Other'];
    }
    if (selectedCompanyCategory === 'Life') {
      return ['Term Life', 'TULIP', 'ULIP', 'Endowment', 'Moneyback', 'Business', 'Other'];
    }
    return ['Health', 'Accident', 'Critical Illness', 'Term Life', 'ULIP', 'Endowment', 'Other'];
  }, [selectedCompanyCategory]);

  const companyForm = useForm<CompanyForm>({ resolver: zodResolver(companySchema) });
  const planForm    = useForm<PlanForm>({ resolver: zodResolver(planSchema), defaultValues: { isActive: true, category: 'LIFE' } });

  const createCompany = useMutation({
    mutationFn: (body: CompanyForm) => insuranceService.createCompany(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurance-companies'] }); closeCompanyModal(); toast.success('Company created'); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to create company'),
  });

  // Seed default companies if DB is empty
  useEffect(() => {
    if (companies && companyList.length === 0 && !isLoading) {
      const seed = async () => {
        const defaults = [
          { name: 'Star Health', cat: 'Health - SAHI' },
          { name: 'Niva Bupa', cat: 'Health - SAHI' },
          { name: 'Care', cat: 'Health - SAHI' },
          { name: 'Manipal Cigna', cat: 'Health - SAHI' },
          { name: 'HDFC Ergo', cat: 'General' },
          { name: 'ICICI Lombard', cat: 'General' },
          { name: 'Bajaj General', cat: 'General' },
          { name: 'TATA AIG', cat: 'General' },
          { name: 'HDFC Life', cat: 'Life' },
          { name: 'ICICI Pru Life', cat: 'Life' },
          { name: 'Bajaj Life', cat: 'Life' },
          { name: 'TATA AIA', cat: 'Life' },
        ];
        for (const c of defaults) {
          try {
            await insuranceService.createCompany({
              name: c.name,
              code: '',
              phone: '',
              email: '',
              website: '',
              address: '',
              notes: JSON.stringify({ category: c.cat, headOffice: '', branchOffice: '', emails: [], hospitals: [], agents: [], resources: [], comment: '' })
            });
          } catch (e) {}
        }
        qc.invalidateQueries({ queryKey: ['insurance-companies'] });
      };
      seed();
    }
  }, [companies, isLoading]);

  const updateCompany = useMutation({
    mutationFn: ({ id, body }: { id: string; body: CompanyForm }) => insuranceService.updateCompany(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurance-companies'] }); closeCompanyModal(); toast.success('Company updated'); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to update company'),
  });

  const removeCompany = useMutation({
    mutationFn: (id: string) => insuranceService.deleteCompany(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurance-companies'] }); setDeleteCompany(null); toast.success('Company deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to delete company'),
  });

  const createPlan = useMutation({
    mutationFn: ({ companyId, body }: { companyId: string; body: PlanForm }) => insuranceService.createPlan(companyId, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurance-plans', expandedCompany] }); setPlanModal(null); planForm.reset({ isActive: true, category: 'LIFE' }); toast.success('Plan created'); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to create plan'),
  });

  const updatePlan = useMutation({
    mutationFn: ({ planId, body }: { planId: string; body: PlanForm }) => insuranceService.updatePlan(planId, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurance-plans', expandedCompany] }); setEditPlan(null); planForm.reset(); toast.success('Plan updated'); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to update plan'),
  });

  const removePlan = useMutation({
    mutationFn: (planId: string) => insuranceService.deletePlan(planId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurance-plans', expandedCompany] }); setDeletePlan(null); toast.success('Plan deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to delete plan'),
  });

  const createHospitalMutation = useMutation({
    mutationFn: (body: any) => insuranceService.createHospital(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hospitals-list'] });
      toast.success('Hospital created successfully');
      setHospitalModal(false);
      setHospitalForm({
        name: '',
        address: '',
        city: '',
        pincode: '',
        contactNo: '',
        type: 'Network',
        claimsPerson1Name: '',
        claimsPerson1Contact: '',
        claimsPerson2Name: '',
        claimsPerson2Contact: '',
        comment: ''
      });
      setHospitalDoctors([]);
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to create hospital'),
  });

  const removeHospitalMutation = useMutation({
    mutationFn: (id: string) => insuranceService.deleteHospital(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hospitals-list'] });
      toast.success('Hospital deleted successfully');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to delete hospital'),
  });

  const openEditCompany = (co: any) => {
    setEditCompany(co);
    companyForm.setValue('name', co.name);
    companyForm.setValue('code', co.code ?? '');
    companyForm.setValue('website', co.website ?? '');
    companyForm.setValue('phone', co.phone ?? '');
    companyForm.setValue('claimsPhone', co.claimsPhone ?? '');
    
    try {
      if (co.notes && co.notes.trim().startsWith('{')) {
        const parsed = JSON.parse(co.notes);
        setExtraCompanyFields({
          category: parsed.category || '',
          headOffice: parsed.headOffice || '',
          branchOffice: parsed.branchOffice || '',
          emails: parsed.emails || [],
          hospitals: parsed.hospitals || [],
          agents: parsed.agents || [],
          resources: parsed.resources || [],
        });
        companyForm.setValue('notes', parsed.comment || '');
        companyForm.setValue('email', parsed.emails?.[0]?.email || co.email || '');
      } else {
        setExtraCompanyFields({ category: '', headOffice: '', branchOffice: '', emails: [], hospitals: [], agents: [], resources: [] });
        companyForm.setValue('notes', co.notes ?? '');
        companyForm.setValue('email', co.email ?? '');
      }
    } catch {
      setExtraCompanyFields({ category: '', headOffice: '', branchOffice: '', emails: [], hospitals: [], agents: [], resources: [] });
      companyForm.setValue('notes', co.notes ?? '');
      companyForm.setValue('email', co.email ?? '');
    }
    setCompanyModalTab('details');
  };

  const closePlanModal = () => {
    setPlanModal(null);
    setEditPlan(null);
    planForm.reset({ isActive: true, category: 'LIFE' });
    setPlanNames(['']);
    setPlanRiders([]);
  };

  const openEditPlan = (pl: any, companyId: string) => {
    setEditPlan({ ...pl, companyId });
    setPlanNames([pl.name]);
    planForm.setValue('name', pl.name);
    planForm.setValue('category', pl.category);
    
    planForm.setValue('minSumAssured', pl.minSumAssured ?? undefined);
    planForm.setValue('maxSumAssured', pl.maxSumAssured ?? undefined);
    planForm.setValue('minAge', pl.minAge ?? undefined);
    planForm.setValue('maxAge', pl.maxAge ?? undefined);
    planForm.setValue('policyTerm', pl.policyTerm ?? undefined);
    planForm.setValue('premiumPayingTerm', pl.premiumPayingTerm ?? undefined);
    planForm.setValue('isActive', pl.isActive ?? true);
    
    try {
      if (pl.description && pl.description.trim().startsWith('{')) {
        const parsed = JSON.parse(pl.description);
        setPlanRiders(parsed.riders || []);
        planForm.setValue('description', parsed.comment || '');
      } else {
        setPlanRiders([]);
        planForm.setValue('description', pl.description ?? '');
      }
    } catch {
      setPlanRiders([]);
      planForm.setValue('description', pl.description ?? '');
    }
  };

  const TABS = [
    { id: 'companies', label: 'Insurance Companies & Plans', icon: Building2 },
    { id: 'settings',  label: 'Master Settings & Backups',   icon: ShieldCheck },
    { id: 'export',    label: 'Bulk Data Export',            icon: Download },
    { id: 'display',   label: 'Font Size',                   icon: Type },
    { id: 'delete_requests', label: 'Delete Requests',       icon: Trash2 },
  ] as const;

  return (
    <div className="space-y-4">

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all -mb-px
                ${activeTab === tab.id
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab: Insurance Companies ─────────────────────────────────────────── */}
      {activeTab === 'companies' && (
        <div className="space-y-4">
          {currentView === 'dashboard' ? (
            <div className="space-y-4">
              {/* Section: Quick Summary at the top */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Quick Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  {/* Insurance Companies */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col justify-between min-h-[90px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Insurance Companies</span>
                      <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Building2 size={13} /></div>
                    </div>
                    <div className="mt-2">
                      <p className="text-lg font-black text-slate-950">{companyList.length || 2}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Total Companies</p>
                    </div>
                  </div>

                  {/* Plans */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col justify-between min-h-[90px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Plans</span>
                      <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><Shield size={13} /></div>
                    </div>
                    <div className="mt-2">
                      <p className="text-lg font-black text-slate-950">15</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Total Plans</p>
                    </div>
                  </div>

                  {/* Riders / Add-ons */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col justify-between min-h-[90px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Riders / Add-ons</span>
                      <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0"><Plus size={13} /></div>
                    </div>
                    <div className="mt-2">
                      <p className="text-lg font-black text-slate-950">23</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Total Riders</p>
                    </div>
                  </div>

                  {/* Agents / Agencies */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col justify-between min-h-[90px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Agents / Agencies</span>
                      <div className="w-6 h-6 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0"><Users size={13} /></div>
                    </div>
                    <div className="mt-2">
                      <p className="text-lg font-black text-slate-950">18</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Total Agencies</p>
                    </div>
                  </div>

                  {/* Hospitals */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col justify-between min-h-[90px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Hospitals</span>
                      <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0"><Building2 size={13} /></div>
                    </div>
                    <div className="mt-2">
<p className="text-lg font-black text-slate-950">{hospitals.length}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Total Hospitals</p>
                    </div>
                  </div>

                  {/* Doctors */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col justify-between min-h-[90px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Doctors</span>
                      <div className="w-6 h-6 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0"><Users size={13} /></div>
                    </div>
                    <div className="mt-2">
<p className="text-lg font-black text-slate-950">{totalDoctors}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Total Doctors</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 1: Insurance & Plans Management */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Insurance & Plans Management</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Add Insurance Company */}
                  <div 
                    onClick={() => setCurrentView('companies')}
                    className="flex items-center gap-4 bg-white border border-slate-100 rounded-2xl p-4 cursor-pointer hover:shadow-lg hover:border-blue-500/20 hover:scale-[1.01] transition-all duration-200 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Building2 size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 tracking-tight">Add Insurance Company</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Add & manage insurance companies</p>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>

                  {/* Add Plan Name */}
                  <div 
                    onClick={() => setCurrentView('plans')}
                    className="flex items-center gap-4 bg-white border border-slate-100 rounded-2xl p-4 cursor-pointer hover:shadow-lg hover:border-emerald-500/20 hover:scale-[1.01] transition-all duration-200 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <Shield size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 tracking-tight">Add Plan Name</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Add multiple plan names under a company</p>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>

                  {/* Add Riders / Add-ons */}
                  <div 
                    onClick={() => setCurrentView('riders')}
                    className="flex items-center gap-4 bg-white border border-slate-100 rounded-2xl p-4 cursor-pointer hover:shadow-lg hover:border-purple-500/20 hover:scale-[1.01] transition-all duration-200 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                      <Plus size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 tracking-tight">Add Riders / Add-ons</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Add & manage riders/add-ons under plan</p>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>

                  {/* Agents / Agencies */}
                  <div 
                    onClick={() => setCurrentView('agents')}
                    className="flex items-center gap-4 bg-white border border-slate-100 rounded-2xl p-4 cursor-pointer hover:shadow-lg hover:border-orange-500/20 hover:scale-[1.01] transition-all duration-200 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                      <Users size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 tracking-tight">Agents / Agencies</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Add & manage agents and agencies</p>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>

                  {/* Resource Centre */}
                  <div 
                    onClick={() => setCurrentView('resources')}
                    className="flex items-center gap-4 bg-white border border-slate-100 rounded-2xl p-4 cursor-pointer hover:shadow-lg hover:border-cyan-500/20 hover:scale-[1.01] transition-all duration-200 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
                      <Briefcase size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 tracking-tight">Resource Centre</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Upload policy wordings, claim forms, hospital list, etc.</p>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-cyan-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>

                  {/* Dashboard Filters */}
                  <div 
                    onClick={() => setCurrentView('filters')}
                    className="flex items-center gap-4 bg-white border border-slate-100 rounded-2xl p-4 cursor-pointer hover:shadow-lg hover:border-teal-500/20 hover:scale-[1.01] transition-all duration-200 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                      <Filter size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 tracking-tight">Dashboard Filters</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Manage filters used in dashboards</p>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-teal-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                </div>
              </div>

              {/* Section 2: Hospitals & Doctors */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Hospitals & Doctors</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {/* Add Hospital */}
                  <div 
                    onClick={() => setHospitalModal(true)}
                    className="flex items-center gap-4 bg-white border border-slate-100 rounded-2xl p-4 cursor-pointer hover:shadow-lg hover:border-rose-500/20 hover:scale-[1.01] transition-all duration-200 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                      <Building2 size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 tracking-tight">Add Hospital</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Add hospitals with details as per Hospital Details sheet</p>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-rose-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>



                  {/* Hospital Search Settings */}
                  <div 
                    onClick={() => setCurrentView('search_settings')}
                    className="flex items-center gap-4 bg-white border border-slate-100 rounded-2xl p-4 cursor-pointer hover:shadow-lg hover:border-sky-500/20 hover:scale-[1.01] transition-all duration-200 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                      <Search size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 tracking-tight">Hospital Search Settings</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Searchable hospitals & doctors in Claims (city based)</p>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>

                  {/* Hospital & Doctor Mapping */}
                  <div 
                    onClick={() => setCurrentView('mapping')}
                    className="flex items-center gap-4 bg-white border border-slate-100 rounded-2xl p-4 cursor-pointer hover:shadow-lg hover:border-orange-500/20 hover:scale-[1.01] transition-all duration-200 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                      <Briefcase size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 tracking-tight">Hospital & Doctor Mapping</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Map hospitals & doctors for easy selection</p>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Breadcrumb back header */}
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <button onClick={() => setCurrentView('dashboard')} className="hover:text-primary-600 transition-colors flex items-center gap-1 cursor-pointer">
                  <ArrowLeft size={13} /> Home
                </button>
                <span>&gt;</span>
                <span className="text-slate-800 capitalize">{currentView.replace('_', ' ')}</span>
              </div>

              {/* 1. INSURANCE COMPANIES */}
              {currentView === 'companies' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                      <div className="relative w-full sm:w-64">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={companySearch}
                          onChange={e => setCompanySearch(e.target.value)}
                          placeholder="Search companies..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all shadow-2xs"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button onClick={() => toast.success('CSV/Excel Import mock triggered')} className="btn-secondary text-xs py-1.5 px-3">Import</button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {companyList.map((co: any) => (
                      <div key={co.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between shadow-3xs">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                            <Building2 size={18} />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">{co.name}</h4>
                            <p className="text-xs text-slate-400 font-semibold">{co.code || 'No Code'} · {co.phone || 'No Phone'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditCompany(co)}
                            className="p-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-purple-500/20 hover:shadow-lg hover:scale-105 transition-all"
                            title="Edit Company"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteCompany(co)}
                            className="p-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-rose-500/20 hover:shadow-lg hover:scale-105 transition-all"
                            title="Delete Company"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. PLANS */}
              {currentView === 'plans' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Plan Names</h3>
                    </div>
                  </div>
                  <div className="overflow-x-auto border border-slate-100 rounded-xl bg-white shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50/75 border-b text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                          <th className="p-3">Plan Name</th>
                          <th className="p-3">Insurance Company</th>
                          <th className="p-3">Category</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {companyList.flatMap((co: any) => 
                          (co.plans || []).map((pl: any) => ({ ...pl, companyName: co.name, companyId: co.id }))
                        ).map((pl: any, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-3 font-semibold text-slate-800">{pl.name}</td>
                            <td className="p-3 text-slate-600">{pl.companyName}</td>
                            <td className="p-3 text-slate-500">{pl.category}</td>
                            <td className="p-3 text-right space-x-1.5">
                              <button onClick={() => openEditPlan(pl, pl.companyId)} className="text-purple-600 hover:text-purple-800 font-bold">Edit</button>
                              <button onClick={() => setDeletePlan(pl)} className="text-rose-600 hover:text-rose-800 font-bold">Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 3. RIDERS */}
              {currentView === 'riders' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Riders / Add-ons</h3>
                    <button onClick={() => toast.success('Mock Add Rider triggered')} className="btn-primary text-xs py-1 px-3 flex items-center gap-1 cursor-pointer">
                      <Plus size={13} /> Add Rider
                    </button>
                  </div>
                  <div className="overflow-x-auto border border-slate-100 rounded-xl bg-white shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50/75 border-b text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                          <th className="p-3">Rider Name</th>
                          <th className="p-3">Description</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-600">
                        <tr>
                          <td className="p-3 font-semibold text-slate-800">Critical Illness Rider</td>
                          <td className="p-3">Covers 36 major critical illnesses</td>
                          <td className="p-3"><span className="badge-green">Active</span></td>
                        </tr>
                        <tr className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-slate-800">Accidental Death Benefit</td>
                          <td className="p-3">Double sum assured on accidental death</td>
                          <td className="p-3"><span className="badge-green">Active</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 4. AGENTS */}
              {currentView === 'agents' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Agents & Agencies</h3>

                  </div>

                  <div className="overflow-x-auto border border-slate-100 rounded-xl bg-white shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50/75 border-b text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                          <th className="p-3">Agent / Agency</th>
                          <th className="p-3">Contact Person</th>
                          <th className="p-3">Phone</th>
                          <th className="p-3">Email</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-600">
                        {agentsList.map((ag) => (
                          <tr key={ag.id} className="hover:bg-slate-50/50">
                            <td className="p-3 font-semibold text-slate-800">{ag.agencyName}</td>
                            <td className="p-3">{ag.agentName}</td>
                            <td className="p-3">{ag.phone}</td>
                            <td className="p-3">{ag.email}</td>
                            <td className="p-3"><span className="badge-green">{ag.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 5. RESOURCES */}
              {currentView === 'resources' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Resource Centre</h3>
                    <button onClick={() => toast.success('Mock Upload Resource triggered')} className="btn-primary text-xs py-1 px-3 flex items-center gap-1 cursor-pointer">
                      <Plus size={13} /> Upload File
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { title: 'Policy Wordings', count: 18, desc: 'Official terms and conditions brochures' },
                      { title: 'Claim Forms', count: 12, desc: 'Pre-auth and claim reimbursement forms' },
                      { title: 'Hospital Lists', count: 6, desc: 'Cashless network directory guides' }
                    ].map((folder, i) => (
                      <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md cursor-pointer transition-all space-y-2">
                        <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0"><Briefcase size={20} /></div>
                        <h4 className="font-bold text-slate-900 text-sm">{folder.title}</h4>
                        <p className="text-xs text-slate-500 font-semibold">{folder.desc}</p>
                        <span className="inline-block text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full mt-2">{folder.count} Files</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* 6. FILTERS */}
              {currentView === 'filters' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Dashboard Filters</h3>
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md mx-auto text-center space-y-3">
                    <Filter size={32} className="mx-auto text-slate-400" />
                    <h4 className="font-bold text-slate-800 text-sm">Dashboard Filters Master Data</h4>
                    <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                      Configure modules filters, categories lists, branches mapping, and date ranges selectors dynamically.
                    </p>
                    <button onClick={() => toast.success('Filters configuration updated')} className="btn-primary text-xs px-4 py-2 mt-2 cursor-pointer">Save Configurations</button>
                  </div>
                </div>
              )}

              {/* 7. ADD HOSPITAL */}
              {/* 9. SEARCH SETTINGS */}
              {currentView === 'search_settings' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Hospital Search Settings</h3>
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md mx-auto space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-xs font-bold text-slate-700">Filter by City</span>
                        <input type="checkbox" defaultChecked className="rounded text-primary-600" />
                      </div>
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-xs font-bold text-slate-700">Show Doctor Specialities</span>
                        <input type="checkbox" defaultChecked className="rounded text-primary-600" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">Enforce Network/Non-Network Flags</span>
                        <input type="checkbox" className="rounded text-primary-600" />
                      </div>
                    </div>
                    <button onClick={() => toast.success('Search settings saved')} className="btn-primary text-xs px-4 py-2 mt-2 w-full cursor-pointer">Save Search Settings</button>
                  </div>
                </div>
              )}

              {/* 10. MAPPING */}
              {currentView === 'mapping' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Hospital List & Doctors Mapping</h3>
                    <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2 py-1 rounded-full">{hospitals.length} Hospitals</span>
                  </div>

                  {hospitals.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 italic text-xs">
                      No hospitals registered yet. Go back and click 'Add Hospital' to register hospitals.
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              <th className="p-3">Hospital Info</th>
                              <th className="p-3">Claims Department</th>
                              <th className="p-3">Doctors</th>
                              <th className="p-3">Comment</th>
                              <th className="p-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {hospitals.map((h: any) => (
                              <tr key={h.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-3 space-y-1">
                                  <div className="font-bold text-slate-900">{h.name}</div>
                                  <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-2 gap-y-0.5">
                                    <span className={`px-1.5 py-0.2 rounded-full font-bold ${
                                      h.type === 'Network' ? 'bg-emerald-50 text-emerald-600' :
                                      h.type === 'Blacklisted' ? 'bg-red-50 text-red-600' :
                                      'bg-slate-100 text-slate-600'
                                    }`}>{h.type}</span>
                                    <span>{h.city}</span>
                                    {h.pincode && <span>- {h.pincode}</span>}
                                  </div>
                                  {h.phone && <div className="text-[10px] text-slate-500">📞 {h.phone}</div>}
                                  {h.address && <div className="text-[10px] text-slate-400 max-w-[200px] truncate" title={h.address}>{h.address}</div>}
                                </td>
                                <td className="p-3 space-y-1">
                                  {h.claimsPerson1Name && (
                                    <div className="text-[10px] text-slate-600">
                                      <span className="font-semibold">{h.claimsPerson1Name}</span>: {h.claimsPerson1Contact}
                                    </div>
                                  )}
                                  {h.claimsPerson2Name && (
                                    <div className="text-[10px] text-slate-600">
                                      <span className="font-semibold">{h.claimsPerson2Name}</span>: {h.claimsPerson2Contact}
                                    </div>
                                  )}
                                  {!h.claimsPerson1Name && !h.claimsPerson2Name && (
                                    <span className="text-slate-400 italic text-[10px]">Not Provided</span>
                                  )}
                                </td>
                                <td className="p-3">
                                  {h.doctors && h.doctors.length > 0 ? (
                                    <div className="space-y-1 max-w-[220px]">
                                      {h.doctors.map((d: any, idx: number) => (
                                        <div key={d.id || idx} className="text-[10px] bg-slate-50 border border-slate-100 rounded-md p-1">
                                          <div className="font-bold text-slate-800">{d.name} <span className="text-[9px] font-normal text-slate-500">({d.degree})</span></div>
                                          <div className="text-slate-500">{d.specialty} {d.phone && `· ${d.phone}`}</div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic text-[10px]">No Doctors Mapped</span>
                                  )}
                                </td>
                                <td className="p-3 text-[10px] text-slate-500 max-w-[150px] truncate" title={h.comment}>
                                  {h.comment || <span className="text-slate-300 italic">-</span>}
                                </td>
                                <td className="p-3 text-right">
                                  <button
                                    onClick={() => {
                                      if (confirm(`Are you sure you want to delete ${h.name}?`)) {
                                        removeHospitalMutation.mutate(h.id);
                                      }
                                    }}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                    title="Delete Hospital"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Settings ─────────────────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="card p-0 overflow-hidden">
          <SettingsPanel initialSubTab={settingsSubTab} onBack={() => { setActiveTab('companies'); setCurrentView('dashboard'); }} />
        </div>
      )}

      {/* ── Tab: Bulk Export ─────────────────────────────────────────────────── */}
      {activeTab === 'export' && (
        <div className="card">
          <BulkExportPanel />
        </div>
      )}

      {/* ── Tab: Font Size Control ───────────────────────────────────────────── */}
      {activeTab === 'display' && (
        <div className="card">
          <FontSizePanel />
        </div>
      )}

      {/* ── Tab: Delete Requests ──────────────────────────────────────────────── */}
      {activeTab === 'delete_requests' && (
        <div className="card">
          <DeletionRequests />
        </div>
      )}


      {/* ── Company Modal ───────────────────────────────────────────────────── */}
      <Modal
        open={companyModal || !!editCompany}
        onClose={closeCompanyModal}
        title={editCompany ? 'Edit Company' : 'Add Insurance Company'}
        actions={
          <button type="submit" form="company-form" className="btn-primary py-1 px-3 text-xs cursor-pointer">
            {editCompany ? 'Save Changes' : 'Create Company'}
          </button>
        }
        size="2xl"
      >
        <form
          id="company-form"
          onSubmit={companyForm.handleSubmit(body => {
            const payload = {
              ...body,
              email: extraCompanyFields.emails.length > 0 ? extraCompanyFields.emails[0].email : (body.email || ''),
              notes: JSON.stringify({
                category: extraCompanyFields.category,
                headOffice: extraCompanyFields.headOffice,
                branchOffice: extraCompanyFields.branchOffice,
                emails: extraCompanyFields.emails,
                hospitals: [],
                agents: [],
                resources: [],
                comment: body.notes
              })
            };
            if (editCompany) updateCompany.mutate({ id: editCompany.id, body: payload });
            else createCompany.mutate(payload);
          })}
          className="space-y-4 pr-2 max-h-[70vh] overflow-y-auto custom-scrollbar"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1 flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Select Insurance Company Category</label>
              <select
                value={extraCompanyFields.category}
                onChange={e => setExtraCompanyFields(p => ({ ...p, category: e.target.value }))}
                className="input"
              >
                <option value="">Select Category...</option>
                <option value="Health - SAHI">Health Insurance - SAHI</option>
                <option value="General">General Insurance</option>
                <option value="Life">Life Insurance</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1" />

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Company Name - Official *</label>
              <input {...companyForm.register('name')} className="input" placeholder="e.g. LIC of India" required />
              {companyForm.formState.errors.name && <p className="text-xs text-red-500">{companyForm.formState.errors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Company Name - Short</label>
              <input {...companyForm.register('code')} className="input" placeholder="e.g. LIC" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Company Head Office Address</label>
              <textarea
                value={extraCompanyFields.headOffice}
                onChange={e => setExtraCompanyFields(p => ({ ...p, headOffice: e.target.value }))}
                className="input"
                rows={2}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Company Branch Office Address</label>
              <textarea
                value={extraCompanyFields.branchOffice}
                onChange={e => setExtraCompanyFields(p => ({ ...p, branchOffice: e.target.value }))}
                className="input"
                rows={2}
              />
            </div>

            {/* Important Email ID List */}
            <div className="col-span-2 border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
              <div className="flex items-center justify-between mb-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Important Email IDs</label>
                <button
                  type="button"
                  onClick={() => setExtraCompanyFields(p => ({
                    ...p,
                    emails: [...p.emails, { id: Date.now().toString(), email: '', description: '' }]
                  }))}
                  className="text-[10px] sm:text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={12} /> Add Email
                </button>
              </div>
              {extraCompanyFields.emails.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No email IDs added.</p>
              ) : (
                <div className="space-y-3">
                  {extraCompanyFields.emails.map((item, idx) => (
                    <div key={item.id} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-2">
                        <input
                          type="email"
                          placeholder="Email Address"
                          value={item.email}
                          onChange={e => {
                            const newEmails = [...extraCompanyFields.emails];
                            newEmails[idx].email = e.target.value;
                            setExtraCompanyFields(p => ({ ...p, emails: newEmails }));
                          }}
                          className="input w-full"
                        />
                        <input
                          type="text"
                          placeholder="Short description (e.g. When to use this email)"
                          value={item.description}
                          onChange={e => {
                            const newEmails = [...extraCompanyFields.emails];
                            newEmails[idx].description = e.target.value;
                            setExtraCompanyFields(p => ({ ...p, emails: newEmails }));
                          }}
                          className="input w-full text-xs"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newEmails = [...extraCompanyFields.emails];
                          newEmails.splice(idx, 1);
                          setExtraCompanyFields(p => ({ ...p, emails: newEmails }));
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Comment</label>
              <textarea {...companyForm.register('notes')} className="input" rows={2} />
            </div>
          </div>
        </form>
      </Modal>

      {/* ── Plan Modal ──────────────────────────────────────────────────────── */}
      <Modal
        open={!!planModal || !!editPlan}
        onClose={() => { setPlanModal(null); setEditPlan(null); planForm.reset(); }}
        title={editPlan ? 'Edit Plan' : `Add Plan${planCompanyId ? ` — ${companyList.find(c => c.id === planCompanyId)?.name || ''}` : ''}`}
        size="2xl"
      >
        <form
          onSubmit={planForm.handleSubmit(async (body) => {
            const payloadTemplate = {
              ...body,
              description: JSON.stringify({
                comment: body.description || '',
                riders: planRiders
              })
            };

            if (editPlan) {
              updatePlan.mutate({ planId: editPlan.id, body: { ...payloadTemplate, name: planNames[0] } });
            } else {
              if (!planCompanyId) {
                toast.error('Please select an insurance company first');
                return;
              }
              const validNames = planNames.filter(n => n.trim() !== '');
              if (validNames.length === 0) {
                toast.error('Please enter at least one plan name');
                return;
              }
              const toastId = toast.loading(`Creating ${validNames.length} plan(s)...`);
              try {
                for (const name of validNames) {
                  await insuranceService.createPlan(planCompanyId, { ...payloadTemplate, name });
                }
                qc.invalidateQueries({ queryKey: ['insurance-plans'] });
                closePlanModal();
                toast.success(`Created ${validNames.length} plan(s) successfully`, { id: toastId });
              } catch (err: any) {
                toast.error(err.response?.data?.message ?? 'Failed to create plans', { id: toastId });
              }
            }
          })}
          className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Select Insurance Company *</label>
              <select
                className="input"
                value={planCompanyId}
                onChange={e => setPlanCompanyId(e.target.value)}
                disabled={!!editPlan || (!!planModal && !!planModal.companyId)}
                required
              >
                <option value="">Select Company...</option>
                {Object.entries(companiesByCategory).map(([cat, comps]) => {
                  if (comps.length === 0) return null;
                  return (
                    <optgroup key={cat} label={cat}>
                      {comps.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </optgroup>
                  );
                })}
              </select>
            </div>

            <div className="col-span-2 border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
              <div className="flex items-center justify-between mb-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Plan Names *</label>
                {!editPlan && (
                  <button
                    type="button"
                    onClick={() => setPlanNames([...planNames, ''])}
                    className="text-[10px] sm:text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} /> Add Plan Name
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {planNames.map((pName, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      className="input flex-1"
                      list="existing-plans"
                      placeholder="e.g. Jeevan Anand"
                      value={pName}
                      onChange={e => {
                        const newNames = [...planNames];
                        newNames[idx] = e.target.value;
                        setPlanNames(newNames);
                      }}
                    />
                    {!editPlan && planNames.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newNames = [...planNames];
                          newNames.splice(idx, 1);
                          setPlanNames(newNames);
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <datalist id="existing-plans">
                {planModalPlans.map((p: any) => <option key={p.id} value={p.name} />)}
              </datalist>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Plan Category *</label>
              <select {...planForm.register('category')} className="input">
                {PLAN_CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Comment (Description)</label>
              <textarea {...planForm.register('description')} className="input" rows={2} />
            </div>

            <div className="col-span-2 border border-slate-100 rounded-2xl p-4 bg-slate-50/50 mt-2">
              <div className="flex items-center justify-between mb-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Riders / Add-ons</label>
                <button
                  type="button"
                  onClick={() => setPlanRiders([...planRiders, { id: Date.now().toString(), name: '', description: '' }])}
                  className="text-[10px] sm:text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={12} /> Add Rider
                </button>
              </div>
              {planRiders.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No riders added.</p>
              ) : (
                <div className="space-y-3">
                  {planRiders.map((rider, idx) => (
                    <div key={rider.id} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-2">
                        <input
                          placeholder="Rider Name"
                          value={rider.name}
                          onChange={e => {
                            const newR = [...planRiders];
                            newR[idx].name = e.target.value;
                            setPlanRiders(newR);
                          }}
                          className="input w-full"
                        />
                        <input
                          placeholder="Rider short description"
                          value={rider.description}
                          onChange={e => {
                            const newR = [...planRiders];
                            newR[idx].description = e.target.value;
                            setPlanRiders(newR);
                          }}
                          className="input w-full text-xs"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newR = [...planRiders];
                          newR.splice(idx, 1);
                          setPlanRiders(newR);
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded animate-fadeIn"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100 mt-6">
            <button type="button" className="btn-secondary text-xs font-semibold py-2 px-4 rounded-xl cursor-pointer" onClick={closePlanModal}>Cancel</button>
            <button type="submit" className="btn-primary text-xs font-semibold py-2 px-4 rounded-xl cursor-pointer shadow-md shadow-primary-500/20" disabled={createPlan.isPending || updatePlan.isPending}>
              {editPlan ? 'Save Changes' : 'Create Plan(s)'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Company Confirm ─────────────────────────────────────────── */}
      <Modal open={!!deleteCompany} onClose={() => setDeleteCompany(null)} title="Delete Company" size="sm">
        <p className="text-sm text-gray-600 mb-4">Delete <strong>{deleteCompany?.name}</strong>? All associated plans will also be deleted.</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDeleteCompany(null)}>Cancel</button>
          <button className="btn-danger" disabled={removeCompany.isPending} onClick={async () => {
            const isAdmin = authUser?.role === 'SUPERADMIN' || authUser?.role === 'OWNER';
            if (isAdmin) {
              removeCompany.mutate(deleteCompany!.id);
            } else {
              const toastId = toast.loading('Submitting delete request to admin...');
              try {
                await deletionRequestsService.requestDeletion('InsuranceCompany', deleteCompany!.id, `Employee requested deletion of insurance company ${deleteCompany?.name}`);
                toast.success('Deletion request submitted to admin successfully!', { id: toastId });
              } catch (err: any) {
                toast.error(err.response?.data?.message || 'Failed to submit request', { id: toastId });
              }
              setDeleteCompany(null);
            }
          }}>
            {removeCompany.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>

      {/* ── Delete Plan Confirm ────────────────────────────────────────────── */}
      <Modal open={!!deletePlan} onClose={() => setDeletePlan(null)} title="Delete Plan" size="sm">
        <p className="text-sm text-gray-600 mb-4">Delete plan <strong>{deletePlan?.name}</strong>?</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDeletePlan(null)}>Cancel</button>
          <button className="btn-danger" disabled={removePlan.isPending} onClick={async () => {
            const isAdmin = authUser?.role === 'SUPERADMIN' || authUser?.role === 'OWNER';
            if (isAdmin) {
              removePlan.mutate(deletePlan!.id);
            } else {
              const toastId = toast.loading('Submitting delete request to admin...');
              try {
                await deletionRequestsService.requestDeletion('InsurancePlan', deletePlan!.id, `Employee requested deletion of insurance plan ${deletePlan?.name}`);
                toast.success('Deletion request submitted to admin successfully!', { id: toastId });
              } catch (err: any) {
                toast.error(err.response?.data?.message || 'Failed to submit request', { id: toastId });
              }
              setDeletePlan(null);
            }
          }}>
            {removePlan.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>

      {/* Floating Right Action Panel - showing Add Company inside the Companies subpage */}
      {currentView === 'companies' && (
        <div className="fixed right-5 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-3 bg-white/90 backdrop-blur-xl p-2 rounded-2xl shadow-2xl border border-slate-200/80 animate-fadeIn">
          <button
            type="button"
            onClick={() => { closeCompanyModal(); setCompanyModal(true); }}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center justify-center transition-all hover:scale-105 shadow-lg shadow-blue-500/30 cursor-pointer group relative"
            title="Add Company"
          >
            <Plus size={18} strokeWidth={2.2} />
            <span className="absolute right-full mr-3 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl border border-slate-800">
              Add Company
            </span>
          </button>
        </div>
      )}


      {/* ── Add Hospital Modal ──────────────────────────────────────────────── */}
      <Modal
        open={hospitalModal}
        onClose={() => {
          setHospitalModal(false);
          setHospitalForm({
            name: '',
            address: '',
            city: '',
            pincode: '',
            contactNo: '',
            type: 'Network',
            claimsPerson1Name: '',
            claimsPerson1Contact: '',
            claimsPerson2Name: '',
            claimsPerson2Contact: '',
            comment: ''
          });
          setHospitalDoctors([]);
        }}
        title="Add Hospital"
        actions={
          <button type="submit" form="hospital-form" className="btn-primary py-1.5 px-4 text-xs cursor-pointer shadow-md shadow-primary-500/20 rounded-xl" disabled={createHospitalMutation.isPending}>
            {createHospitalMutation.isPending ? 'Saving...' : 'Save Hospital'}
          </button>
        }
        size="3xl"
      >
        {(() => {
          const DOCTOR_DEGREES = ['MBBS', 'MD', 'MS', 'DM', 'MCh', 'DNB', 'BDS', 'MDS'];

          const handleAddDoctor = () => {
            setHospitalDoctors(prev => [
              ...prev,
              {
                id: `doc-${Date.now()}-${Math.random()}`,
                name: '',
                degree: '',
                contactNo: '',
                speciality: ''
              }
            ]);
          };

          const handleRemoveDoctor = (id: string) => {
            setHospitalDoctors(prev => prev.filter(doc => doc.id !== id));
          };

          const handleUpdateDoctor = (id: string, field: string, value: string) => {
            setHospitalDoctors(prev => prev.map(doc => {
              if (doc.id === id) {
                return { ...doc, [field]: value };
              }
              return doc;
            }));
          };

          const handleFormSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            createHospitalMutation.mutate({
              ...hospitalForm,
              doctors: hospitalDoctors
            });
          };

          return (
            <form id="hospital-form" onSubmit={handleFormSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              {/* Section 1: Hospital Details */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-1.5">
                  1. Hospital Details
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Hospital Name *</label>
                    <input
                      type="text"
                      required
                      value={hospitalForm.name}
                      onChange={(e) => setHospitalForm(prev => ({ ...prev, name: e.target.value }))}
                      className="input text-xs"
                      placeholder="e.g. Ruby Hall Clinic"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Hospital Type *</label>
                    <select
                      value={hospitalForm.type}
                      onChange={(e) => setHospitalForm(prev => ({ ...prev, type: e.target.value }))}
                      className="input text-xs"
                      required
                    >
                      <option value="Network">Network</option>
                      <option value="Non-Network">Non-Network</option>
                      <option value="Blacklisted">Blacklisted</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Hospital City *</label>
                    <input
                      type="text"
                      required
                      value={hospitalForm.city}
                      onChange={(e) => setHospitalForm(prev => ({ ...prev, city: e.target.value }))}
                      className="input text-xs"
                      placeholder="e.g. Pune"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Hospital Pincode *</label>
                    <input
                      type="text"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      value={hospitalForm.pincode}
                      onChange={(e) => setHospitalForm(prev => ({ ...prev, pincode: e.target.value.replace(/\D/g, '') }))}
                      className="input text-xs"
                      placeholder="e.g. 411001"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Hospital Contact No *</label>
                    <input
                      type="text"
                      maxLength={15}
                      required
                      value={hospitalForm.contactNo}
                      onChange={(e) => setHospitalForm(prev => ({ ...prev, contactNo: e.target.value.replace(/\D/g, '') }))}
                      className="input text-xs"
                      placeholder="e.g. 9876543210"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Hospital Address</label>
                    <input
                      type="text"
                      value={hospitalForm.address}
                      onChange={(e) => setHospitalForm(prev => ({ ...prev, address: e.target.value }))}
                      className="input text-xs"
                      placeholder="e.g. 40, Bund Garden Road, Pune"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Claims Department Person 1 Name</label>
                    <input
                      type="text"
                      value={hospitalForm.claimsPerson1Name}
                      onChange={(e) => setHospitalForm(prev => ({ ...prev, claimsPerson1Name: e.target.value }))}
                      className="input text-xs"
                      placeholder="e.g. Ramesh Patil"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Claims Person 1 Contact No</label>
                    <input
                      type="text"
                      maxLength={15}
                      value={hospitalForm.claimsPerson1Contact}
                      onChange={(e) => setHospitalForm(prev => ({ ...prev, claimsPerson1Contact: e.target.value.replace(/\D/g, '') }))}
                      className="input text-xs"
                      placeholder="e.g. 9876543210"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Claims Department Person 2 Name</label>
                    <input
                      type="text"
                      value={hospitalForm.claimsPerson2Name}
                      onChange={(e) => setHospitalForm(prev => ({ ...prev, claimsPerson2Name: e.target.value }))}
                      className="input text-xs"
                      placeholder="e.g. Suresh Shinde"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Claims Person 2 Contact No</label>
                    <input
                      type="text"
                      maxLength={15}
                      value={hospitalForm.claimsPerson2Contact}
                      onChange={(e) => setHospitalForm(prev => ({ ...prev, claimsPerson2Contact: e.target.value.replace(/\D/g, '') }))}
                      className="input text-xs"
                      placeholder="e.g. 9876543211"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Comment</label>
                  <textarea
                    value={hospitalForm.comment}
                    onChange={(e) => setHospitalForm(prev => ({ ...prev, comment: e.target.value }))}
                    className="input text-xs min-h-[60px] py-2"
                    placeholder="Add any extra notes here..."
                  />
                </div>
              </div>

              {/* Section 2: Doctor Details */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    2. Doctor Details
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddDoctor}
                    className="text-[10px] sm:text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} /> Add Doctor
                  </button>
                </div>

                {hospitalDoctors.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No doctors mapped yet. Click 'Add Doctor' to map doctors to this hospital.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {hospitalDoctors.map((doc, index) => (
                      <div key={doc.id} className="relative border border-slate-200 rounded-xl p-3 bg-white space-y-2.5 shadow-2xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            Doctor #{index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDoctor(doc.id)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                            title="Remove Doctor"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          <div className="flex flex-col gap-0.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Doctor Name *</label>
                            <input
                              type="text"
                              required
                              value={doc.name}
                              onChange={(e) => handleUpdateDoctor(doc.id, 'name', e.target.value)}
                              className="input text-xs py-1"
                              placeholder="e.g. Dr. Rajesh Shah"
                            />
                          </div>

                          <div className="flex flex-col gap-0.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Doctor Degree *</label>
                            <select
                              required
                              value={doc.degree}
                              onChange={(e) => handleUpdateDoctor(doc.id, 'degree', e.target.value)}
                              className="input text-xs py-1"
                            >
                              <option value="">Select Degree</option>
                              {DOCTOR_DEGREES.map(d => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </div>

                          <div className="flex flex-col gap-0.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Contact No *</label>
                            <input
                              type="text"
                              maxLength={15}
                              required
                              value={doc.contactNo}
                              onChange={(e) => handleUpdateDoctor(doc.id, 'contactNo', e.target.value.replace(/\D/g, ''))}
                              className="input text-xs py-1"
                              placeholder="e.g. 9876543210"
                            />
                          </div>

                          <div className="flex flex-col gap-0.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Speciality *</label>
                            <input
                              type="text"
                              required
                              value={doc.speciality}
                              onChange={(e) => handleUpdateDoctor(doc.id, 'speciality', e.target.value)}
                              className="input text-xs py-1"
                              placeholder="e.g. Cardiology"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </form>
          );
        })()}
      </Modal>

      {/* ── Add Agent Modal ─────────────────────────────────────────────────── */}
      <Modal
        open={agentModal}
        onClose={() => { setAgentModal(false); setAgentModalTab('details'); }}
        title="Add Agent"
        actions={
          <button type="submit" form="agent-form" className="btn-primary py-1 px-3 text-xs cursor-pointer shadow-md shadow-primary-500/20 rounded-xl">
            Save Agent
          </button>
        }
        size="2xl"
      >
        <form
          id="agent-form"
          onSubmit={handleAgentSubmit}
          className="space-y-4 pr-2 max-h-[70vh] min-h-[480px] overflow-y-auto custom-scrollbar"
        >
          {/* Tab Selection Navigation Bar */}
          <div className="flex border-b border-slate-100 pb-2 mb-4 gap-4">
            <button
              type="button"
              onClick={() => setAgentModalTab('details')}
              className={`text-xs font-bold pb-2 transition-all border-b-2 px-1 cursor-pointer ${
                agentModalTab === 'details'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Agent Details
            </button>
            <button
              type="button"
              onClick={() => setAgentModalTab('payout')}
              className={`text-xs font-bold pb-2 transition-all border-b-2 px-1 cursor-pointer ${
                agentModalTab === 'payout'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Payout Bank Details
            </button>
          </div>

          {agentModalTab === 'details' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
              {/* Insurance Company Category */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Insurance Company Category *</label>
                <select
                  value={agentForm.category}
                  onChange={e => {
                    setAgentForm(p => ({ ...p, category: e.target.value, companyId: '' }));
                  }}
                  className="input"
                >
                  <option value="">Select Category...</option>
                  <option value="Health - SAHI">Health Insurance - SAHI</option>
                  <option value="General">General Insurance</option>
                  <option value="Life">Life Insurance</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Insurance Company Name */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Insurance Company Name *</label>
                <select
                  value={agentForm.companyId}
                  onChange={e => {
                    const coId = e.target.value;
                    const co = rawCompanyList.find(c => c.id === coId);
                    let coCat = '';
                    if (co && co.notes && co.notes.startsWith('{')) {
                      try { coCat = JSON.parse(co.notes).category || ''; } catch {}
                    }
                    setAgentForm(p => ({
                      ...p,
                      companyId: coId,
                      category: coCat || p.category
                    }));
                  }}
                  className="input"
                >
                  <option value="">Select Company...</option>
                  {rawCompanyList
                    .filter(co => {
                      if (!agentForm.category) return true; // Show all companies if no category is selected
                      let coCat = 'Other';
                      if (co.notes && co.notes.startsWith('{')) {
                        try { coCat = JSON.parse(co.notes).category || 'Other'; } catch {}
                      }
                      return coCat === agentForm.category;
                    })
                    .map(co => (
                      <option key={co.id} value={co.id}>{co.name}</option>
                    ))}
                </select>
              </div>

              {/* Agent Name */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Agent Name *</label>
                <input
                  type="text"
                  value={agentForm.agentName}
                  onChange={e => setAgentForm(p => ({ ...p, agentName: e.target.value }))}
                  placeholder="e.g. Pratibha Sharma"
                  className="input"
                />
              </div>

              {/* Agency Name to Display */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Agency Name to Display (Auto-Generated)</label>
                <input
                  type="text"
                  value={agentForm.agencyNameDisplay}
                  readOnly
                  placeholder="e.g. Health - Star - Pratibha"
                  className="input bg-slate-50 border-slate-200/60 text-slate-500 font-semibold cursor-not-allowed"
                />
              </div>

              {/* Agency Code */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Agency Code *</label>
                <input
                  type="text"
                  value={agentForm.agencyCode}
                  onChange={e => setAgentForm(p => ({ ...p, agencyCode: e.target.value }))}
                  placeholder="e.g. STAR0987"
                  className="input"
                />
              </div>

              {/* Agency Start Date */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Agency Start Date *</label>
                <input
                  type="date"
                  value={agentForm.startDate}
                  onChange={e => setAgentForm(p => ({ ...p, startDate: e.target.value }))}
                  className="input"
                />
              </div>

              {/* Agency Home Branch */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Agency Home Branch</label>
                <input
                  type="text"
                  value={agentForm.homeBranch}
                  onChange={e => setAgentForm(p => ({ ...p, homeBranch: e.target.value }))}
                  placeholder="e.g. Mumbai Fort"
                  className="input"
                />
              </div>

              {/* Agency Home Branch Code */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Agency Home Branch Code</label>
                <input
                  type="text"
                  value={agentForm.homeBranchCode}
                  onChange={e => setAgentForm(p => ({ ...p, homeBranchCode: e.target.value }))}
                  placeholder="e.g. BOM01"
                  className="input"
                />
              </div>

              {/* RM Name */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">RM Name</label>
                <input
                  type="text"
                  value={agentForm.rmName}
                  onChange={e => setAgentForm(p => ({ ...p, rmName: e.target.value }))}
                  placeholder="Relationship Manager Name"
                  className="input"
                />
              </div>

              {/* RM Contact No */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">RM Contact No</label>
                <input
                  type="tel"
                  value={agentForm.rmContact}
                  onChange={e => setAgentForm(p => ({ ...p, rmContact: e.target.value }))}
                  placeholder="e.g. +91 9876543210"
                  className="input"
                />
              </div>

              {/* BM Name */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">BM Name</label>
                <input
                  type="text"
                  value={agentForm.bmName}
                  onChange={e => setAgentForm(p => ({ ...p, bmName: e.target.value }))}
                  placeholder="Branch Manager Name"
                  className="input"
                />
              </div>

              {/* BM Contact No */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">BM Contact No</label>
                <input
                  type="tel"
                  value={agentForm.bmContact}
                  onChange={e => setAgentForm(p => ({ ...p, bmContact: e.target.value }))}
                  placeholder="e.g. +91 9876543211"
                  className="input"
                />
              </div>
            </div>
          )}

          {agentModalTab === 'payout' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Payout Bank Details Section */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-slate-500">Payout Bank Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Bank Name</label>
                    <input
                      type="text"
                      value={agentForm.bankName}
                      onChange={e => setAgentForm(p => ({ ...p, bankName: e.target.value }))}
                      placeholder="e.g. ICICI Bank"
                      className="input"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Bank Branch</label>
                    <input
                      type="text"
                      value={agentForm.bankBranch}
                      onChange={e => setAgentForm(p => ({ ...p, bankBranch: e.target.value }))}
                      placeholder="e.g. Connaught Place"
                      className="input"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Bank IFSC</label>
                    <input
                      type="text"
                      value={agentForm.bankIfsc}
                      onChange={e => setAgentForm(p => ({ ...p, bankIfsc: e.target.value }))}
                      placeholder="e.g. ICIC0000123"
                      className="input"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Bank Account No</label>
                    <input
                      type="text"
                      value={agentForm.bankAccount}
                      onChange={e => setAgentForm(p => ({ ...p, bankAccount: e.target.value }))}
                      placeholder="e.g. 123456789012"
                      className="input"
                    />
                  </div>
                </div>
              </div>

              {/* Payout Cycle Helper Text */}
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex gap-2 text-xs text-blue-700 leading-snug">
                <Calendar size={16} className="shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Payout Cycle Tentative Dates</span>
                  <p className="mt-0.5 text-blue-600 font-medium">8-10 & 19-21 of every month, 2 months after the policy issuance date</p>
                </div>
              </div>

              {/* Comment */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Comment</label>
                <textarea
                  value={agentForm.comment}
                  onChange={e => setAgentForm(p => ({ ...p, comment: e.target.value }))}
                  placeholder="Add any internal comments or notes regarding this agent..."
                  className="input w-full"
                  rows={2}
                />
              </div>
            </div>
          )}
        </form>
      </Modal>
      {/* Floating Right Action Panel - showing Add Plan inside the Plans subpage */}
      {currentView === 'plans' && (
        <div className="fixed right-5 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-3 bg-white/90 backdrop-blur-xl p-2 rounded-2xl shadow-2xl border border-slate-200/80 animate-fadeIn">
          <button
            type="button"
            onClick={() => { closePlanModal(); setPlanModal({ companyId: '', company: '' }); }}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white flex items-center justify-center transition-all hover:scale-105 shadow-md shadow-emerald-500/25 cursor-pointer group relative"
            title="Add Plan"
          >
            <Plus size={18} strokeWidth={2.2} />
            <span className="absolute right-full mr-3 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl border border-slate-800">
              Add Plan
            </span>
          </button>
        </div>
      )}

      {/* Floating Right Action Panel - showing Add Agent inside the Agents subpage */}
      {currentView === 'agents' && (
        <div className="fixed right-5 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-3 bg-white/90 backdrop-blur-xl p-2 rounded-2xl shadow-2xl border border-slate-200/80 animate-fadeIn">
          <button
            type="button"
            onClick={() => { setAgentModal(true); }}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center justify-center transition-all hover:scale-105 shadow-lg shadow-blue-500/30 cursor-pointer group relative"
            title="Add Agent"
          >
            <Plus size={18} strokeWidth={2.2} />
            <span className="absolute right-full mr-3 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl border border-slate-800">
              Add Agent
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
