import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { insuranceService, contactsService, leadsService, policiesService, claimsService } from '@api/index';
import {
  Plus, Pencil, Trash2, Building2, Shield, ChevronDown, ChevronRight,
  Download, Filter, FileText, Users, TrendingUp, Briefcase, Type,
} from 'lucide-react';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { useUiSettingsStore, FONT_SIZE_MAP, type FontSizeLevel } from '@store/ui-settings.store';

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
  name: z.string().min(1, 'Required'),
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
/** Format a date string to DD/MM/YYYY, or return '' if empty. */
function fmtDate(v: any): string {
  if (!v) return '';
  try { return new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return String(v); }
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
  const [entity, setEntity]       = useState<ExportEntity>('contacts');
  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo, setDateTo]       = useState('');
  const [status, setStatus]       = useState('');
  const [cols, setCols]           = useState<Set<string>>(new Set(EXPORT_COLUMNS.contacts.map(c => c.key)));
  const [exporting, setExporting] = useState(false);

  const columns = EXPORT_COLUMNS[entity] ?? [];

  const handleEntityChange = (e: string) => {
    setEntity(e as ExportEntity);
    setCols(new Set(EXPORT_COLUMNS[e as ExportEntity].map(c => c.key)));
    setStatus('');
  };

  const toggleCol = (k: string) => {
    setCols(prev => {
      const next = new Set(prev);
      if (next.has(k)) { next.delete(k); } else { next.add(k); }
      return next;
    });
  };

  const handleExport = async () => {
    if (cols.size === 0) { toast.error('Select at least one column'); return; }
    setExporting(true);
    try {
      let blob: Blob;
      const selectedCols = EXPORT_COLUMNS[entity].filter(c => cols.has(c.key));

      if (entity === 'contacts') {
        // Backend CSV is used but reformatted client-side so columns match selection
        const rawBlob = await contactsService.exportCsv();
        // Parse the backend CSV and re-emit using our extractor (consistent format)
        const text = await rawBlob.text();
        const lines = text.split('\n').filter(Boolean);
        if (lines.length <= 1) {
          blob = buildCsv([], selectedCols);
        } else {
          // Parse CSV header from backend, then map each row to a plain object
          const headers = lines[0].split(',').map((h: string) => h.replace(/^"|"$/g, '').trim());
          const rows = lines.slice(1).map((line: string) => {
            const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) ?? line.split(',');
            const obj: any = {};
            headers.forEach((h: string, i: number) => { obj[h] = (vals[i] ?? '').replace(/^"|"$/g, ''); });
            return obj;
          });
          // Use extractors for selected cols; fall back to direct key for contacts (flat fields)
          blob = buildCsv(rows, selectedCols);
        }
      } else {
        let rows: any[] = [];
        const params: any = { limit: 5000 };
        if (dateFrom) params.createdAtFrom = dateFrom;
        if (dateTo)   params.createdAtTo   = dateTo;
        if (status)   params.status        = status;

        if (entity === 'leads')    { const r = await leadsService.list(params);    rows = r?.data ?? r ?? []; }
        if (entity === 'policies') { const r = await policiesService.list(params); rows = r?.data ?? r ?? []; }
        if (entity === 'claims')   { const r = await claimsService.list(params);   rows = r?.data ?? r ?? []; }

        blob = buildCsv(rows, selectedCols);
      }

      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href  = url;
      link.download = `${entity}_export_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`${entity.charAt(0).toUpperCase() + entity.slice(1)} exported — ${cols.size} column${cols.size !== 1 ? 's' : ''}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const EntityIcon = ENTITY_ICONS[entity];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Bulk Data Export</h3>
        <p className="text-xs text-gray-500">Select an entity, apply filters, choose columns, and download a CSV.</p>
      </div>

      {/* Entity selector */}
      <div>
        <p className="label mb-2">Select Entity</p>
        <div className="grid grid-cols-4 gap-3">
          {(['contacts', 'leads', 'policies', 'claims'] as const).map(e => {
            const Icon = ENTITY_ICONS[e];
            return (
              <button
                key={e}
                onClick={() => handleEntityChange(e)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-xs font-semibold capitalize
                  ${entity === e
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-500 hover:text-gray-700'
                  }`}
              >
                <Icon size={18} />
                {e}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 mb-1">
          <Filter size={13} />
          Filters
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date From</label>
            <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">Date To</label>
            <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          {entity !== 'contacts' && (
            <div className="col-span-2">
              <label className="label">Status</label>
              <input className="input" placeholder="e.g. ACTIVE, OPEN, FILED…" value={status} onChange={e => setStatus(e.target.value)} />
            </div>
          )}
        </div>
      </div>

      {/* Column selector */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-600">Select Columns</p>
          <div className="flex gap-2">
            <button onClick={() => setCols(new Set(columns.map(c => c.key)))} className="text-[11px] text-primary-600 hover:underline">All</button>
            <button onClick={() => setCols(new Set())} className="text-[11px] text-gray-400 hover:underline">None</button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {columns.map(col => (
            <label key={col.key} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded text-primary-600"
                checked={cols.has(col.key)}
                onChange={() => toggleCol(col.key)}
              />
              {col.label}
            </label>
          ))}
        </div>
      </div>

      {/* Export button */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {cols.size} of {columns.length} columns selected
        </p>
        <button
          onClick={handleExport}
          disabled={exporting || cols.size === 0}
          className="btn-primary"
        >
          <Download size={14} />
          {exporting ? 'Exporting…' : `Export ${entity.charAt(0).toUpperCase() + entity.slice(1)} CSV`}
        </button>
      </div>
    </div>
  );
}

/* ─── Font Size Control Panel ──────────────────────────────────────────────── */
function FontSizePanel() {
  const { fontSize, setFontSize } = useUiSettingsStore();

  const levels: FontSizeLevel[] = ['xs', 'sm', 'md', 'lg', 'xl'];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Font Size Control</h3>
        <p className="text-xs text-gray-500">Adjust the app's base text size. Especially useful when using InsuMitra on a phone or tablet. Your preference is saved automatically.</p>
      </div>

      {/* Size picker */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
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
  const [activeTab, setActiveTab]         = useState<'companies' | 'export' | 'display'>('companies');
  const [companyModal, setCompanyModal]   = useState(false);
  const [editCompany, setEditCompany]     = useState<any | null>(null);
  const [deleteCompany, setDeleteCompany] = useState<any | null>(null);
  const [planModal, setPlanModal]         = useState<{ companyId: string; company: string } | null>(null);
  const [editPlan, setEditPlan]           = useState<any | null>(null);
  const [deletePlan, setDeletePlan]       = useState<any | null>(null);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

  const { data: companies, isLoading } = useQuery({
    queryKey: ['insurance-companies'],
    queryFn: () => insuranceService.listCompanies(),
  });

  const { data: plans } = useQuery({
    queryKey: ['insurance-plans', expandedCompany],
    queryFn: () => insuranceService.listPlans(expandedCompany!),
    enabled: !!expandedCompany,
  });

  const companyForm = useForm<CompanyForm>({ resolver: zodResolver(companySchema) });
  const planForm    = useForm<PlanForm>({ resolver: zodResolver(planSchema), defaultValues: { isActive: true, category: 'LIFE' } });

  const createCompany = useMutation({
    mutationFn: (body: CompanyForm) => insuranceService.createCompany(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurance-companies'] }); setCompanyModal(false); companyForm.reset(); toast.success('Company created'); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to create company'),
  });

  const updateCompany = useMutation({
    mutationFn: ({ id, body }: { id: string; body: CompanyForm }) => insuranceService.updateCompany(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurance-companies'] }); setEditCompany(null); companyForm.reset(); toast.success('Company updated'); },
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

  const openEditCompany = (co: any) => {
    setEditCompany(co);
    companyForm.setValue('name', co.name);
    companyForm.setValue('code', co.code ?? '');
    companyForm.setValue('website', co.website ?? '');
    companyForm.setValue('phone', co.phone ?? '');
    companyForm.setValue('email', co.email ?? '');
    companyForm.setValue('claimsPhone', co.claimsPhone ?? '');
    companyForm.setValue('notes', co.notes ?? '');
  };

  const openEditPlan = (pl: any, companyId: string) => {
    setEditPlan({ ...pl, companyId });
    planForm.setValue('name', pl.name);
    planForm.setValue('category', pl.category);
    planForm.setValue('description', pl.description ?? '');
    planForm.setValue('minSumAssured', pl.minSumAssured ?? undefined);
    planForm.setValue('maxSumAssured', pl.maxSumAssured ?? undefined);
    planForm.setValue('minAge', pl.minAge ?? undefined);
    planForm.setValue('maxAge', pl.maxAge ?? undefined);
    planForm.setValue('policyTerm', pl.policyTerm ?? undefined);
    planForm.setValue('premiumPayingTerm', pl.premiumPayingTerm ?? undefined);
    planForm.setValue('isActive', pl.isActive ?? true);
  };

  const companyList: any[] = companies?.data ?? companies ?? [];
  const planList: any[]    = plans?.data ?? plans ?? [];

  const TABS = [
    { id: 'companies', label: 'Insurance Companies & Plans', icon: Building2 },
    { id: 'export',    label: 'Bulk Data Export',            icon: Download },
    { id: 'display',   label: 'Font Size',                   icon: Type },
  ] as const;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Briefcase size={18} className="text-primary-600" />
            Operations
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Manage insurance companies, plans, and export your data.</p>
        </div>
        {activeTab === 'companies' && (
          <button className="btn-primary" onClick={() => { setEditCompany(null); companyForm.reset(); setCompanyModal(true); }}>
            <Plus size={15} /> Add Company
          </button>
        )}
      </div>

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
        <div className="space-y-3">
          {isLoading && <div className="text-gray-400 text-center py-8">Loading…</div>}

          {companyList.map((co: any) => (
            <div key={co.id} className="card p-0 overflow-hidden">
              {/* Company row */}
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                onClick={() => setExpandedCompany(expandedCompany === co.id ? null : co.id)}>
                <Building2 size={16} className="text-primary-500 shrink-0"/>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{co.name}</p>
                  {co.code && <p className="text-xs text-gray-400">{co.code}</p>}
                </div>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  {co.phone && <span className="text-xs text-gray-400">{co.phone}</span>}
                  <button onClick={() => { setPlanModal({ companyId: co.id, company: co.name }); planForm.reset({ isActive: true, category: 'LIFE' }); }}
                    className="btn-sm text-xs px-2 py-1 border border-primary-300 text-primary-700 rounded hover:bg-primary-50 flex items-center gap-1">
                    <Plus size={11}/> Plan
                  </button>
                  <button onClick={() => openEditCompany(co)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"><Pencil size={13}/></button>
                  <button onClick={() => setDeleteCompany(co)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 size={13}/></button>
                </div>
                {expandedCompany === co.id ? <ChevronDown size={14} className="text-gray-400 shrink-0"/> : <ChevronRight size={14} className="text-gray-400 shrink-0"/>}
              </div>

              {/* Plans (expanded) */}
              {expandedCompany === co.id && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-2">
                  {planList.length === 0 && <p className="text-xs text-gray-400">No plans. Click "+ Plan" to add one.</p>}
                  {planList.map((pl: any) => (
                    <div key={pl.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-100 group">
                      <Shield size={13} className="text-green-500 shrink-0"/>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{pl.name}</p>
                        <p className="text-xs text-gray-400">{pl.category}
                          {pl.policyTerm ? ` · ${pl.policyTerm}yr` : ''}
                          {pl.minSumAssured ? ` · Min ₹${Number(pl.minSumAssured).toLocaleString('en-IN')}` : ''}
                        </p>
                      </div>
                      <span className={pl.isActive ? 'badge-green' : 'badge-gray'}>{pl.isActive ? 'Active' : 'Inactive'}</span>
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                        <button onClick={() => openEditPlan(pl, co.id)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"><Pencil size={12}/></button>
                        <button onClick={() => setDeletePlan(pl)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 size={12}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {companyList.length === 0 && !isLoading && (
            <div className="text-center py-16 text-gray-400">
              <Building2 size={32} className="mx-auto mb-3 text-gray-200"/>
              <p>No insurance companies yet. Add one to get started.</p>
            </div>
          )}
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


      {/* ── Company Modal ───────────────────────────────────────────────────── */}
      <Modal
        open={companyModal || !!editCompany}
        onClose={() => { setCompanyModal(false); setEditCompany(null); companyForm.reset(); }}
        title={editCompany ? 'Edit Company' : 'Add Insurance Company'}
        size="xl">
        <form onSubmit={companyForm.handleSubmit(body => editCompany
          ? updateCompany.mutate({ id: editCompany.id, body })
          : createCompany.mutate(body)
        )} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Company Name *</label>
              <input {...companyForm.register('name')} className="input" placeholder="e.g. LIC of India" />
              {companyForm.formState.errors.name && <p className="text-xs text-red-500">{companyForm.formState.errors.name.message}</p>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Company Code</label>
              <input {...companyForm.register('code')} className="input" placeholder="e.g. LIC" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Phone</label>
              <input {...companyForm.register('phone')} className="input" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Email</label>
              <input {...companyForm.register('email')} type="email" className="input" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Claims Phone</label>
              <input {...companyForm.register('claimsPhone')} className="input" />
            </div>
            <div className="col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Website</label>
              <input {...companyForm.register('website')} className="input" placeholder="https://" />
            </div>
            <div className="col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Notes</label>
              <textarea {...companyForm.register('notes')} className="input" rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 mt-6">
            <button type="button" className="btn-secondary" onClick={() => { setCompanyModal(false); setEditCompany(null); companyForm.reset(); }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createCompany.isPending || updateCompany.isPending}>
              {editCompany ? 'Save Changes' : 'Create Company'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Plan Modal ──────────────────────────────────────────────────────── */}
      <Modal
        open={!!planModal || !!editPlan}
        onClose={() => { setPlanModal(null); setEditPlan(null); planForm.reset(); }}
        title={editPlan ? 'Edit Plan' : `Add Plan — ${planModal?.company ?? ''}`}
        size="2xl">
        <form onSubmit={planForm.handleSubmit(body => editPlan
          ? updatePlan.mutate({ planId: editPlan.id, body })
          : createPlan.mutate({ companyId: planModal!.companyId, body })
        )} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Plan Name *</label>
              <input {...planForm.register('name')} className="input" placeholder="e.g. Jeevan Anand" />
              {planForm.formState.errors.name && <p className="text-xs text-red-500">{planForm.formState.errors.name.message}</p>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Category *</label>
              <select {...planForm.register('category')} className="input">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Policy Term (years)</label>
              <input {...planForm.register('policyTerm')} type="number" className="input" min="0" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Premium Paying Term (yrs)</label>
              <input {...planForm.register('premiumPayingTerm')} type="number" className="input" min="0" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Min Age (years)</label>
              <input {...planForm.register('minAge')} type="number" className="input" min="0" max="120" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Max Age (years)</label>
              <input {...planForm.register('maxAge')} type="number" className="input" min="0" max="120" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Min Sum Assured (₹)</label>
              <input {...planForm.register('minSumAssured')} type="number" className="input" min="0" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Max Sum Assured (₹)</label>
              <input {...planForm.register('maxSumAssured')} type="number" className="input" min="0" />
            </div>
            <div className="col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Description</label>
              <textarea {...planForm.register('description')} className="input" rows={2} />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input {...planForm.register('isActive')} type="checkbox" id="planActive" className="rounded" />
              <label htmlFor="planActive" className="text-sm text-gray-700">Active (available for new policies)</label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 mt-6">
            <button type="button" className="btn-secondary" onClick={() => { setPlanModal(null); setEditPlan(null); planForm.reset(); }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createPlan.isPending || updatePlan.isPending}>
              {editPlan ? 'Save Changes' : 'Create Plan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Company Confirm ─────────────────────────────────────────── */}
      <Modal open={!!deleteCompany} onClose={() => setDeleteCompany(null)} title="Delete Company" size="sm">
        <p className="text-sm text-gray-600 mb-4">Delete <strong>{deleteCompany?.name}</strong>? All associated plans will also be deleted.</p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDeleteCompany(null)}>Cancel</button>
          <button className="btn-danger" disabled={removeCompany.isPending} onClick={() => removeCompany.mutate(deleteCompany!.id)}>
            {removeCompany.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>

      {/* ── Delete Plan Confirm ────────────────────────────────────────────── */}
      <Modal open={!!deletePlan} onClose={() => setDeletePlan(null)} title="Delete Plan" size="sm">
        <p className="text-sm text-gray-600 mb-4">Delete plan <strong>{deletePlan?.name}</strong>?</p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDeletePlan(null)}>Cancel</button>
          <button className="btn-danger" disabled={removePlan.isPending} onClick={() => removePlan.mutate(deletePlan!.id)}>
            {removePlan.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
