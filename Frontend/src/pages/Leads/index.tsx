import { useState, useRef, useEffect, useMemo } from 'react';
import { useLeadKanban, useMoveLeadStage, useCreateLead, useUpdateLead, useDeleteLead } from '@hooks/useLeads';
import Modal from '@comps/common/Modal';
import {
  Plus, Search, Pencil, Trash2, Shield, Upload, Phone, Calendar,
  MessageCircle, LayoutGrid, List, Filter, X, UserPlus,
  UserCircle2, Mail, ChevronDown, Flame, Thermometer, Snowflake,
  Columns, ArrowUpDown, ChevronUp, ChevronRight, Send, RefreshCw, Save
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import clsx from 'clsx';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { contactsService, policiesService, leadsService, employeesService } from '@api/index';
import toast from 'react-hot-toast';
import { useAuthStore } from '@store/auth.store';
import { useLookupStore } from '@store/lookup.store';
import { format } from 'date-fns';

// ── Stage Mappings ────────────────────────────────────────────────────────────

export const STAGE_LABELS: Record<string, string> = {
  OPEN:           'New',
  CONTACTED:      'Contacted',
  PROPOSAL_SENT:  'Proposal Sent',
  IN_DISCUSSION:  'In Discussion',
  LOGIN_PROGRESS: 'Login Progress',
  PAYMENT_DONE:   'Payment Done',
  LOST:           'Lost',
};

const UI_STAGES = ['New', 'Contacted', 'Proposal Sent', 'In Discussion', 'Login Progress', 'Payment Done', 'Lost'];

const STAGE_MAPPINGS: Record<string, string> = {
  'New': 'OPEN',
  'Contacted': 'CONTACTED',
  'Proposal Sent': 'PROPOSAL_SENT',
  'In Discussion': 'IN_DISCUSSION',
  'Login Progress': 'LOGIN_PROGRESS',
  'Payment Done': 'PAYMENT_DONE',
  'Lost': 'LOST',
};

const BACKEND_TO_UI: Record<string, string> = {
  OPEN: 'New',
  CONTACTED: 'Contacted',
  PROPOSAL_SENT: 'Proposal Sent',
  IN_DISCUSSION: 'In Discussion',
  LOGIN_PROGRESS: 'Login Progress',
  PAYMENT_DONE: 'Payment Done',
  LOST: 'Lost',
};

const STAGE_COLORS: Record<string, string> = {
  'New': 'bg-blue-50/20 border-blue-100',
  'Contacted': 'bg-indigo-50/20 border-indigo-100',
  'Proposal Sent': 'bg-purple-50/20 border-purple-100',
  'In Discussion': 'bg-amber-50/20 border-amber-100',
  'Login Progress': 'bg-orange-50/20 border-orange-100',
  'Payment Done': 'bg-green-50/20 border-green-100',
  'Lost': 'bg-rose-50/20 border-rose-100',
};

const BADGE_STYLES: Record<string, string> = {
  OPEN: 'bg-blue-50 text-blue-700 border-blue-200',
  CONTACTED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  IN_DISCUSSION: 'bg-amber-50 text-amber-700 border-amber-200',
  PROPOSAL_SENT: 'bg-purple-50 text-purple-700 border-purple-200',
  LOGIN_PROGRESS: 'bg-orange-50 text-orange-700 border-orange-200',
  PAYMENT_DONE: 'bg-green-50 text-green-700 border-green-200',
  LOST: 'bg-red-50 text-red-700 border-red-200',
};

// ── Hotness Level ─────────────────────────────────────────────────────────────
type HotnessLevel = 'HOT' | 'WARM' | 'COLD';

function deriveHotness(lead: any): HotnessLevel {
  if (!lead.followUpDate) return 'COLD';
  const daysUntil = Math.ceil((new Date(lead.followUpDate).getTime() - Date.now()) / 86400000);
  if (daysUntil < 0) return 'HOT';
  if (daysUntil <= 3) return 'HOT';
  if (daysUntil <= 7) return 'WARM';
  return 'COLD';
}

const HOTNESS_CONFIG: Record<HotnessLevel, { label: string; cls: string; iconName: string }> = {
  HOT:  { label: 'Hot',  cls: 'text-red-600 bg-red-50 border-red-200',     iconName: 'Flame' },
  WARM: { label: 'Warm', cls: 'text-amber-600 bg-amber-50 border-amber-200', iconName: 'Thermometer' },
  COLD: { label: 'Cold', cls: 'text-blue-500 bg-blue-50 border-blue-200',   iconName: 'Snowflake' },
};

function HotnessIcon({ level }: { level: HotnessLevel }) {
  if (level === 'HOT') return <Flame size={10} />;
  if (level === 'WARM') return <Thermometer size={10} />;
  return <Snowflake size={10} />;
}

// ── Form schema ───────────────────────────────────────────────────────────────
const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  phone: z.string().min(10, 'Min 10 digits'),
  alternatePhone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', '']).optional(),
  dateOfBirth: z.string().optional(),
  panNumber: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  annualIncome: z.coerce.number().min(0).optional().or(z.literal('')),
  notes: z.string().optional(),
  tags: z.string().optional(),
  isActive: z.string().optional(),
  city: z.string().optional(),
  source: z.string().optional(),
  assignedEmployeeId: z.string().optional(),
  leadStage: z.string().optional(),
  leadStatus: z.string().optional(),
  leadType: z.string().optional(),
  followUpDate: z.string().optional(),
});
type Form = z.infer<typeof schema>;

// ── Column definitions ────────────────────────────────────────────────────────
const ALL_TABLE_COLUMNS = [
  { key: 'name',          label: 'Client Name',    defaultVisible: true },
  { key: 'plan',          label: 'Product',        defaultVisible: true },
  { key: 'hotness',       label: 'Hotness',        defaultVisible: true },
  { key: 'employee',      label: 'Assigned To',    defaultVisible: true },
  { key: 'premiumBudget', label: 'Exp. Premium',   defaultVisible: true },
  { key: 'followUpDate',  label: 'Next Follow-up', defaultVisible: true },
  { key: 'stage',         label: 'Stage',          defaultVisible: true },
  { key: 'actions',       label: '',               defaultVisible: true },
];

const PLAN_CATEGORIES = [
  { value: 'LIFE',    label: 'Life Insurance' },
  { value: 'HEALTH',  label: 'Health Insurance' },
  { value: 'MOTOR',   label: 'Motor Insurance' },
  { value: 'TRAVEL',  label: 'Travel Insurance' },
  { value: 'GENERAL', label: 'General Insurance' },
];

const ALL_BACKEND_STAGES = [
  { value: 'OPEN',           label: 'New' },
  { value: 'CONTACTED',      label: 'Contacted' },
  { value: 'PROPOSAL_SENT',  label: 'Proposal Sent' },
  { value: 'IN_DISCUSSION',  label: 'In Discussion' },
  { value: 'LOGIN_PROGRESS', label: 'Login Progress' },
  { value: 'PAYMENT_DONE',   label: 'Payment Done' },
  { value: 'LOST',           label: 'Lost' },
];

const LEAD_STATUS_OPTIONS = [
  { value: 'NOT_INTERESTED', label: 'Not Interested' },
  { value: 'LEAD_LOST',      label: 'Lead Lost' },
  { value: 'INTERESTED',     label: 'Interested' },
  { value: 'HOT',            label: 'Hot' },
  { value: 'VERY_HOT',       label: 'Very Hot' },
];

import { useSearchParams } from 'react-router-dom';

// ── Main Component ────────────────────────────────────────────────────────────
export default function Leads() {
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [showFilters, setShowFilters] = useState(false);
  const [createInitialStage, setCreateInitialStage] = useState<string>('OPEN');

  // Filters
  const [filterPlans, setFilterPlans]       = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo]     = useState('');
  const [search, setSearch]                 = useState('');

  const [planFilterOpen, setPlanFilterOpen]     = useState(false);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const planFilterRef   = useRef<HTMLDivElement>(null);
  const statusFilterRef = useRef<HTMLDivElement>(null);

  // Table sort
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Table column visibility
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    Object.fromEntries(ALL_TABLE_COLUMNS.map(c => [c.key, c.defaultVisible]))
  );
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  // Modals
  const [modalOpen, setModalOpen]       = useState(false);

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      openCreate();
    }
  }, [searchParams]);
  const [editTarget, setEditTarget]     = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  // Detail popup
  const [detailTarget, setDetailTarget] = useState<any | null>(null);
  const [detailOpen, setDetailOpen]     = useState(false);
  const [detailTab, setDetailTab]       = useState<'overview' | 'comments' | 'stage'>('overview');

  const [activeLeadTab, setActiveLeadTab] = useState('Product Interest');
  const [editContactId, setEditContactId] = useState<string | null>(null);
  const [loadedContact, setLoadedContact] = useState<any | null>(null);
  const [duplicateContactMatched, setDuplicateContactMatched] = useState<any | null>(null);
  const [maxRenewalWindow, setMaxRenewalWindow] = useState<number>(45);

  useEffect(() => {
    leadsService.getRenewalWindow()
      .then((res: any) => {
        if (res?.data?.maxWindow) {
          setMaxRenewalWindow(res.data.maxWindow);
        }
      })
      .catch((err: any) => console.error(err));
  }, []);

  const [personalFields, setPersonalFields] = useState({
    fullName: '',
    gender: '',
    maritalStatus: '',
    dateOfBirth: '',
    email: '',
    aadhaarNumber: '',
    whatsappNumber: '',
    sameAsWhatsapp: false,
    callingNumber: '',
    education: '',
    annualIncome: '',
    occupationType: '',
    companyName: '',
    state: '',
    district: '',
    city: '',
    pincode: '',
    streetAddress: ''
  });

  const [leadInfoFields, setLeadInfoFields] = useState({
    profileType: 'Lead Profile',
    leadStatus: 'OPEN',
    interestedIn: ['Health'],
    leadSource: 'By Agent',
    assignedEmployeeId: '',
    followUpDate: '',
  });

  const [leadComments, setLeadComments] = useState<string[]>([]);
  const [newComment, setNewComment] = useState('');

  type ProductComment = { text: string; author: string; datetime: string };
  type ProductInterestCard = {
    id: string;
    collapsed: boolean;
    interestedIn: string[];
    otherProduct: string;
    leadStage: string;
    leadStatus: string;
    leadType: string;
    leadSource: string;
    assignedEmployeeId: string;
    followUpDate: string;
    expectedPremium: string;
    comments: ProductComment[];
    newComment: string;
  };

  function parseLeadNotes(notesText?: string | null) {
    const res = {
      leadStatus: 'INTERESTED',
      leadType: 'FRESH',
      cleanNotes: '',
    };
    if (!notesText) return res;
    if (notesText.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(notesText);
        res.leadStatus = parsed.leadStatus || 'INTERESTED';
        res.leadType = parsed.leadType || 'FRESH';
        res.cleanNotes = parsed.cleanNotes || '';
        return res;
      } catch (e) {}
    }
    const lines = notesText.split('\n');
    const cleanLines: string[] = [];
    lines.forEach(line => {
      if (line.startsWith('Status: ')) {
        res.leadStatus = line.replace('Status: ', '').trim();
      } else if (line.startsWith('Type: ')) {
        res.leadType = line.replace('Type: ', '').trim();
      } else {
        cleanLines.push(line);
      }
    });
    res.cleanNotes = cleanLines.join('\n').trim();
    return res;
  }

  function serializeLeadNotes(card: ProductInterestCard) {
    return JSON.stringify({
      leadStatus: card.leadStatus,
      leadType: card.leadType,
      cleanNotes: card.otherProduct ? `Other Product: ${card.otherProduct}` : '',
    });
  }

  const newProductInterestCard = (): ProductInterestCard => ({
    id: Math.random().toString(36).slice(2),
    collapsed: false,
    interestedIn: [],
    otherProduct: '',
    leadStage: 'TO_CONTACT',
    leadStatus: 'INTERESTED',
    leadType: 'FRESH',
    leadSource: 'Social Media',
    assignedEmployeeId: '',
    followUpDate: '',
    expectedPremium: '',
    comments: [],
    newComment: '',
  });

  const [productInterests, setProductInterests] = useState<ProductInterestCard[]>([]);

  const addProductInterest = () =>
    setProductInterests(prev => [...prev, newProductInterestCard()]);

  const removeProductInterest = async (id: string) => {
    const isExisting = id.length === 24 || /^[0-9a-fA-F]{24}$/.test(id);
    if (isExisting) {
      if (!confirm('Are you sure you want to delete this product interest from the server?')) return;
      const toastId = toast.loading('Deleting product interest...');
      try {
        await leadsService.remove(id);
        toast.success('Product interest deleted from server successfully!', { id: toastId });
        qc.invalidateQueries({ queryKey: ['contacts'] });
        qc.invalidateQueries({ queryKey: ['leads'] });
      } catch (err: any) {
        toast.error('Failed to delete product interest from server', { id: toastId });
        return;
      }
    }
    setProductInterests(prev => prev.filter(c => c.id !== id));
  };

  const updateProductInterest = (id: string, field: keyof ProductInterestCard, value: any) =>
    setProductInterests(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));

  const toggleProductCollapse = (id: string) =>
    setProductInterests(prev => prev.map(c => c.id === id ? { ...c, collapsed: !c.collapsed } : c));

  const addProductComment = async (id: string) => {
    const card = productInterests.find(c => c.id === id);
    if (!card || !card.newComment.trim()) return;

    const user = useAuthStore.getState().user;
    const author = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'User' : 'User';
    const commentText = card.newComment.trim();

    const isExisting = id.length === 24 || /^[0-9a-fA-F]{24}$/.test(id);
    if (isExisting) {
      const toastId = toast.loading('Adding comment...');
      try {
        await leadsService.addConsultation(id, { notes: commentText });
        toast.success('Comment added successfully!', { id: toastId });
        qc.invalidateQueries({ queryKey: ['contacts'] });
        qc.invalidateQueries({ queryKey: ['leads'] });
      } catch (err: any) {
        toast.error('Failed to save comment to server', { id: toastId });
      }
    }

    const comment = {
      text: commentText,
      author,
      datetime: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    };

    setProductInterests(prev => prev.map(c => {
      if (c.id !== id) return c;
      return { ...c, comments: [...c.comments, comment], newComment: '' };
    }));
  };

  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: kanbanRes, isLoading } = useLeadKanban();
  const moveStage  = useMoveLeadStage();
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const qc         = useQueryClient();
  const user       = useAuthStore(s => s.user);
  const isOwner    = user?.role === 'OWNER';

  const [draggedOverStage, setDraggedOverStage] = useState<string | null>(null);

  const { data: empRes } = useQuery({
    queryKey: ['employees-list-leads'],
    queryFn: () => employeesService.list({ limit: 100 }),
    enabled: isOwner,
    staleTime: 5 * 60_000,
  });
  const employees = empRes?.data ?? [];

  // Flat leads
  const leadsFlat = useMemo(() => {
    const rawData = kanbanRes?.data ?? {};
    const flat: any[] = [];
    Object.keys(rawData).forEach(backendStage => {
      (rawData[backendStage] || []).forEach((card: any) => {
        flat.push({ ...card, uiStage: BACKEND_TO_UI[card.stage] || 'New' });
      });
    });
    return flat;
  }, [kanbanRes]);

  // Client-side filter
  const filteredLeads = useMemo(() => {
    const sTerm = search.toLowerCase();
    return leadsFlat.filter(lead => {
      const fullName = `${lead.contact?.firstName || ''} ${lead.contact?.lastName || ''}`.toLowerCase();
      if (search && !fullName.includes(sTerm) && !(lead.contact?.phone || '').includes(sTerm)) return false;
      if (filterPlans.length > 0 && !filterPlans.includes(lead.plan?.category ?? '')) return false;
      if (filterEmployee && lead.assignedEmployeeId !== filterEmployee) return false;
      if (filterStatuses.length > 0) {
        const extra = parseLeadNotes(lead.notes);
        const status = extra.leadStatus || 'INTERESTED';
        if (!filterStatuses.includes(status)) return false;
      }
      if (filterDateFrom) {
        const fromDate = new Date(filterDateFrom); fromDate.setHours(0, 0, 0, 0);
        if (!lead.followUpDate || new Date(lead.followUpDate) < fromDate) return false;
      }
      if (filterDateTo) {
        const toDate = new Date(filterDateTo); toDate.setHours(23, 59, 59, 999);
        if (!lead.followUpDate || new Date(lead.followUpDate) > toDate) return false;
      }
      return true;
    });
  }, [leadsFlat, search, filterPlans, filterEmployee, filterStatuses, filterDateFrom, filterDateTo]);

  // Sorted leads for table
  const sortedLeads = useMemo(() => {
    if (!sortKey) return filteredLeads;
    return [...filteredLeads].sort((a, b) => {
      let av: any = '';
      let bv: any = '';
      if (sortKey === 'name') {
        av = `${a.contact?.firstName ?? ''} ${a.contact?.lastName ?? ''}`;
        bv = `${b.contact?.firstName ?? ''} ${b.contact?.lastName ?? ''}`;
      } else if (sortKey === 'plan') {
        av = a.plan?.name ?? ''; bv = b.plan?.name ?? '';
      } else if (sortKey === 'premiumBudget') {
        av = a.premiumBudget ?? 0; bv = b.premiumBudget ?? 0;
      } else if (sortKey === 'followUpDate') {
        av = a.followUpDate ? new Date(a.followUpDate).getTime() : 0;
        bv = b.followUpDate ? new Date(b.followUpDate).getTime() : 0;
      } else if (sortKey === 'stage') {
        av = a.stage ?? ''; bv = b.stage ?? '';
      }
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [filteredLeads, sortKey, sortDir]);

  // Board columns
  const filteredBoard = useMemo(() => {
    const b: Record<string, any[]> = {};
    UI_STAGES.forEach(s => { b[s] = filteredLeads.filter(l => l.uiStage === s); });
    return b;
  }, [filteredLeads]);

  const expectedBusiness = (uiStage: string) =>
    (filteredBoard[uiStage] ?? []).reduce((sum, c) => sum + (c.premiumBudget ?? 0), 0);

  // Click-outside
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (planFilterRef.current && !planFilterRef.current.contains(e.target as Node)) setPlanFilterOpen(false);
      if (statusFilterRef.current && !statusFilterRef.current.contains(e.target as Node)) setStatusFilterOpen(false);
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenuOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleWhatsApp = (phone?: string) => {
    if (!phone) return;
    window.open(`https://wa.me/91${phone.replace(/\D/g, '')}`, '_blank');
  };
  const handleCall = (phone?: string) => {
    if (!phone) return;
    window.location.href = `tel:${phone}`;
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const toastId = toast.loading('Importing leads...');
    try {
      const res = await leadsService.importCsv(file);
      toast.success(res.message || 'Successfully imported leads!', { id: toastId });
      qc.invalidateQueries({ queryKey: ['leads'] });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to import leads', { id: toastId });
    }
  };

  const { register, handleSubmit, reset, setValue } = useForm<Form>({ resolver: zodResolver(schema) });

  const handleLeadSubmit = async (e: React.FormEvent, shouldClose: boolean) => {
    if (e) e.preventDefault();
    if (!personalFields.fullName.trim()) {
      toast.error('Full Name is required');
      return;
    }
    if (!personalFields.whatsappNumber.trim()) {
      toast.error('Whatsapp Number is required');
      return;
    }
    // Validate renewal policy rule
    for (const card of productInterests) {
      if (hasActiveRenewalLeadForCard(card) && card.leadType === 'RENEWAL') {
        toast.error("An active Renewal lead already exists for this product.");
        return;
      }
      if (hasActivePolicyForCard(card) && card.leadType === 'RENEWAL' && isPolicyOutsideRenewalWindowForCard(card)) {
        toast.error("Renewal cannot be created yet. The policy is outside the renewal period.");
        return;
      }
      if (hasActivePolicyForCard(card) && card.leadType !== 'RENEWAL') {
        toast.error("An active policy already exists for this product. Only a Renewal lead can be created.");
        return;
      }
    }

    const toastId = toast.loading(editContactId ? 'Updating lead...' : 'Creating lead...');
    try {
      const parts = personalFields.fullName.trim().split(/\s+/);
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';

      const mergedTags = [...selectedCampaigns];
      if (!mergedTags.includes('contact')) {
        mergedTags.push('contact');
      }

      let contactId = editContactId;
      if (editContactId) {
        // Do not update existing Contact profile or sub-resources from within the Leads module
      } else {
        const contactRes = await contactsService.createFull({
          contact: {
            firstName,
            lastName,
            phone: personalFields.whatsappNumber,
            alternatePhone: personalFields.callingNumber || undefined,
            email: personalFields.email || undefined,
            gender: personalFields.gender || undefined,
            dateOfBirth: personalFields.dateOfBirth?.trim() ? new Date(personalFields.dateOfBirth).toISOString() : undefined,
            aadhaarNumber: personalFields.aadhaarNumber || undefined,
            tags: mergedTags,
            notes: personalFields.streetAddress || undefined,
          },
          address: (personalFields.state || personalFields.city || personalFields.pincode || personalFields.streetAddress) ? {
            type: 'HOME',
            line1: personalFields.streetAddress || 'N/A',
            city: personalFields.city || 'N/A',
            state: personalFields.state || 'N/A',
            pincode: personalFields.pincode || 'N/A',
            country: 'India',
            isPrimary: true,
          } : undefined,
          occupation: (personalFields.occupationType || personalFields.companyName || personalFields.annualIncome) ? {
            type: personalFields.occupationType || 'SALARIED',
            companyName: personalFields.companyName || undefined,
            isPrimary: true,
          } : undefined,
        });
        contactId = contactRes.data.contact.id;
      }

      const subResourcePromises: Promise<any>[] = [];

      // Save Family Members and Policies ONLY for newly created Contacts
      if (!editContactId) {
        // Save Family Members if any
        for (const fam of familyMembers) {
          if (!fam.name.trim()) continue;
          const famParts = fam.name.trim().split(/\s+/);
          const famFirst = famParts[0] || '';
          const famLast = famParts.slice(1).join(' ') || '';

          const saveFamilyFlow = async () => {
            try {
              const famContactRes = await contactsService.create({
                firstName: famFirst,
                lastName: famLast,
                phone: fam.whatsapp || '0000000000',
                dateOfBirth: fam.dob?.trim() ? new Date(fam.dob).toISOString() : undefined,
              });
              const famContactId = famContactRes.data.id;

              await contactsService.addRelationship(contactId!, {
                relatedContactId: famContactId,
                relationshipType: fam.relation || 'OTHER',
              });
            } catch (famErr) {
              console.error('Failed to save family member:', famErr);
            }
          };
          subResourcePromises.push(saveFamilyFlow());
        }

        // Save Policies if any
        const dbPlans = useLookupStore.getState().plans || [];
        for (const portfolio of policies) {
          const isHealth = portfolio.policyType === 'Health';
          const category = isHealth ? 'HEALTH' : 'LIFE';
          const matchedPlan = dbPlans.find((p: any) => p.category === category) || dbPlans[0];

          for (const entry of portfolio.entries) {
            if (!entry.policyNo.trim()) continue;
            subResourcePromises.push(
              policiesService.create({
                policyNumber: entry.policyNo,
                contactId: contactId!,
                planId: matchedPlan?.id || '6a3d0584d431b55e6b6e74fe',
                sumAssured: Number(entry.sumAssured || entry.sumInsured || 100000),
                premiumAmount: Number(entry.premium || 1000),
                paymentFrequency: 'YEARLY',
                startDate: entry.startDate?.trim() ? new Date(entry.startDate).toISOString() : new Date().toISOString(),
                endDate: entry.endDate?.trim() ? new Date(entry.endDate).toISOString() : new Date(Date.now() + 365 * 86400000).toISOString(),
              }).catch(polErr => console.error('Failed to save policy:', polErr))
            );
          }
        }
      }

      // Save Product Interests (Leads) and prevent duplicates
      const uniqueProductInterests: typeof productInterests = [];
      const seenProducts = new Set<string>();
      for (const card of productInterests) {
        const prod = card.interestedIn[0];
        if (!prod) continue;
        const actualProdName = prod === 'Other' && card.otherProduct ? card.otherProduct : prod;
        if (!seenProducts.has(actualProdName)) {
          seenProducts.add(actualProdName);
          uniqueProductInterests.push(card);
        }
      }

      for (const card of uniqueProductInterests) {
        const product = card.interestedIn[0];
        const interests = [product === 'Other' && card.otherProduct ? card.otherProduct : product];
        
        let stage = 'OPEN';
        if (card.leadStage === 'TO_CONTACT') stage = 'OPEN';
        else if (card.leadStage === 'PROCESS_COMPLETED') stage = 'PAYMENT_DONE';
        else stage = card.leadStage;

        const serializedNotes = serializeLeadNotes(card);

        const body = {
          contactId: contactId!,
          interests,
          stage,
          source: card.leadSource,
          assignedEmployeeId: card.assignedEmployeeId || undefined,
          followUpDate: card.followUpDate?.trim() ? new Date(card.followUpDate).toISOString() : undefined,
          premiumBudget: Number(card.expectedPremium) || undefined,
          notes: serializedNotes,
        };

        const isExisting = card.id.length === 24 || /^[0-9a-fA-F]{24}$/.test(card.id);
        const saveLeadFlow = async () => {
          try {
            if (isExisting) {
              await leadsService.update(card.id, body);
            } else {
              const res = await leadsService.create(body);
              const savedLead = res.data ?? res;
              for (const cmt of card.comments) {
                await leadsService.addConsultation(savedLead.id, { notes: cmt.text });
              }
            }
          } catch (leadErr) {
            console.error('Failed to save product interest:', leadErr);
          }
        };
        subResourcePromises.push(saveLeadFlow());
      }

      await Promise.all(subResourcePromises);

      toast.success(editContactId ? 'Lead successfully updated!' : 'Lead successfully created!', { id: toastId });
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['leads'] });

      closeModal();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to save lead', { id: toastId });
    }
  };

  const openCreate = (stage?: string) => {
    setEditTarget(null);
    setEditContactId(null);
    setLoadedContact(null);
    setPersonalFields({
      fullName: '',
      gender: '',
      maritalStatus: '',
      dateOfBirth: '',
      email: '',
      aadhaarNumber: '',
      whatsappNumber: '',
      sameAsWhatsapp: false,
      callingNumber: '',
      education: '',
      annualIncome: '',
      occupationType: '',
      companyName: '',
      state: '',
      district: '',
      city: '',
      pincode: '',
      streetAddress: ''
    });

    const currentUser = useAuthStore.getState().user;
    const curEmp = employees.find((e: any) => e.userId === currentUser?.id || e.id === currentUser?.id);

    setLeadInfoFields({
      profileType: 'Lead Profile',
      leadStatus: stage || 'OPEN',
      interestedIn: ['Health'],
      leadSource: 'Social Media',
      assignedEmployeeId: curEmp?.userId || currentUser?.id || '',
      followUpDate: '',
    });
    setLeadComments([]);
    setNewComment('');
    setProductInterests([]);
    setFamilyMembers([]);
    setPolicies([]);
    setSelectedCampaigns([]);
    setActiveLeadTab('Product Interest');
    setModalOpen(true);
  };

  const openEdit = async (card: any) => {
    setEditTarget(card);
    const contactId = card.contactId || card.contact?.id;
    if (!contactId) {
      toast.error('Associated contact not found for this lead');
      return;
    }
    const toastId = toast.loading('Loading contact details...');
    try {
      const res = await contactsService.get(contactId);
      const contact = res.data;
      setLoadedContact(contact);

      const primaryAddr = contact.addresses?.find((a: any) => a.isPrimary) || contact.addresses?.[0];
      const primaryOcc = contact.occupations?.find((o: any) => o.isPrimary) || contact.occupations?.[0];

      setPersonalFields({
        fullName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
        gender: contact.gender || '',
        maritalStatus: contact.maritalStatus || '',
        dateOfBirth: contact.dateOfBirth ? contact.dateOfBirth.split('T')[0] : '',
        email: contact.email || '',
        aadhaarNumber: contact.aadhaarNumber || '',
        whatsappNumber: contact.phone || '',
        sameAsWhatsapp: contact.phone === contact.alternatePhone,
        callingNumber: contact.alternatePhone || '',
        education: contact.education || '',
        annualIncome: contact.annualIncome ? String(contact.annualIncome) : '',
        occupationType: primaryOcc?.type || '',
        companyName: primaryOcc?.companyName || '',
        state: primaryAddr?.state || '',
        district: primaryAddr?.district || '',
        city: primaryAddr?.city || '',
        pincode: primaryAddr?.pincode || '',
        streetAddress: primaryAddr?.line1 || contact.notes || ''
      });

      setLeadInfoFields({
        profileType: 'Lead Profile',
        leadStatus: card.stage || 'OPEN',
        interestedIn: card.interests || ['Health'],
        leadSource: card.source || 'Social Media',
        assignedEmployeeId: card.assignedEmployeeId || '',
        followUpDate: card.followUpDate ? card.followUpDate.split('T')[0] : '',
      });

      const campaignsList = [
        'Health Awareness', 'New Year Offer', 'Pension Plan',
        'Monsoon Safety', 'Term Insurance Promo', 'Family Health Package'
      ];
      const campaigns = contact.tags?.filter((t: string) => campaignsList.includes(t)) || [];
      setSelectedCampaigns(campaigns);

      const fams = (contact.relationships || []).map((r: any) => {
        const c = r.relatedContact;
        return {
          name: `${c?.firstName || ''} ${c?.lastName || ''}`.trim(),
          dob: c?.dateOfBirth ? c.dateOfBirth.split('T')[0] : '',
          relation: r.relationshipType,
          whatsapp: c?.phone || '',
          occupation: '',
          education: '',
          medicalHistory: []
        };
      });
      setFamilyMembers(fams);

      const healthEntries: any[] = [];
      const lifeEntries: any[] = [];
      (contact.policies || []).forEach((p: any) => {
        const entry = {
          company: p.plan?.company?.name || 'Other',
          planName: p.plan?.name || 'Other',
          policyNo: p.policyNumber,
          startDate: p.startDate ? p.startDate.split('T')[0] : '',
          duration: '1 Year',
          endDate: p.endDate ? p.endDate.split('T')[0] : '',
          premium: String(p.premiumAmount),
          sumInsured: String(p.sumAssured),
          deductible: '',
          sumAssured: String(p.sumAssured),
          maturityDate: p.maturityDate ? p.maturityDate.split('T')[0] : '',
          paymentTerm: '',
          entryType: p.status === 'ACTIVE' ? 'New' : 'Renewal'
        };
        if (p.plan?.category === 'HEALTH') {
          healthEntries.push(entry);
        } else {
          lifeEntries.push(entry);
        }
      });

      const parsedPolicies: any[] = [];
      if (healthEntries.length > 0) parsedPolicies.push({ policyType: 'Health', entries: healthEntries });
      if (lifeEntries.length > 0) parsedPolicies.push({ policyType: 'Life', entries: lifeEntries });
      setPolicies(parsedPolicies);

      // Load & map product interests/leads
      const backendInterests = contact.productInterests || [];
      const mappedInterests = backendInterests.map((lead: any) => {
        const extra = parseLeadNotes(lead.notes);
        const comments = (lead.consultations || []).map((c: any) => ({
          text: c.notes || '',
          author: c.author || 'System',
          datetime: c.createdAt ? new Date(c.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
        }));

        const interestsList = lead.interests || [];
        const isStandard = (p: string) => ['Health', 'Life', 'Term', 'Accident Policy', 'Motor', 'Mutual Funds', 'Porting'].includes(p);
        const standardInterests = interestsList.filter((p: string) => isStandard(p));
        const otherInterests = interestsList.filter((p: string) => !isStandard(p));
        
        const interestedIn = [...standardInterests];
        let otherProduct = '';
        if (otherInterests.length > 0) {
          interestedIn.push('Other');
          otherProduct = otherInterests.join(', ');
        }

        const expectedPremium = lead.premiumBudget ? String(lead.premiumBudget) : '';
        let leadStage = 'TO_CONTACT';
        if (lead.stage === 'OPEN') leadStage = 'TO_CONTACT';
        else if (lead.stage === 'PAYMENT_DONE') leadStage = 'PROCESS_COMPLETED';
        else leadStage = lead.stage;

        return {
          id: lead.id,
          collapsed: true,
          interestedIn,
          otherProduct,
          leadStage,
          leadStatus: extra.leadStatus,
          leadType: extra.leadType,
          leadSource: lead.source || 'Social Media',
          assignedEmployeeId: lead.assignedEmployeeId || '',
          followUpDate: lead.followUpDate ? lead.followUpDate.split('T')[0] : '',
          expectedPremium,
          comments,
          newComment: '',
        };
      });
      setProductInterests(mappedInterests);

      setEditContactId(contactId);
      setActiveLeadTab('Product Interest');
      setModalOpen(true);
      toast.dismiss(toastId);
    } catch (err) {
      toast.error('Failed to load contact details', { id: toastId });
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditTarget(null);
    setEditContactId(null);
    setLoadedContact(null);
    setDuplicateContactMatched(null);
    setProductInterests([]);
    setFamilyMembers([]);
    setPolicies([]);
    setSelectedCampaigns([]);
  };

  const checkForDuplicateContact = async (phone?: string, aadhaar?: string) => {
    if (!phone && !aadhaar) return;
    try {
      const res = await contactsService.list({ limit: 100 });
      const list = res.data || [];
      const match = list.find((c: any) => {
        const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
        const contactPhone = c.phone ? c.phone.replace(/\D/g, '') : '';
        const matchPhone = cleanPhone && contactPhone && contactPhone === cleanPhone;

        const cleanAadhaar = aadhaar ? aadhaar.replace(/\D/g, '') : '';
        const contactAadhaar = c.aadhaarNumber ? c.aadhaarNumber.replace(/\D/g, '') : '';
        const matchAadhaar = cleanAadhaar && contactAadhaar && contactAadhaar === cleanAadhaar;

        return matchPhone || matchAadhaar;
      });

      if (match) {
        const fullRes = await contactsService.get(match.id);
        const contact = fullRes.data;
        setLoadedContact(contact);
        setEditContactId(contact.id);
        setDuplicateContactMatched(contact);
        toast.success("Existing Contact Found – Details Loaded");

        const primaryAddr = contact.addresses?.find((a: any) => a.isPrimary) || contact.addresses?.[0];
        const primaryOcc = contact.occupations?.find((o: any) => o.isPrimary) || contact.occupations?.[0];

        setPersonalFields({
          fullName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
          gender: contact.gender || '',
          maritalStatus: contact.maritalStatus || '',
          dateOfBirth: contact.dateOfBirth ? contact.dateOfBirth.split('T')[0] : '',
          email: contact.email || '',
          aadhaarNumber: contact.aadhaarNumber || '',
          whatsappNumber: contact.phone || '',
          sameAsWhatsapp: contact.phone === contact.alternatePhone,
          callingNumber: contact.alternatePhone || '',
          education: contact.education || '',
          annualIncome: contact.annualIncome ? String(contact.annualIncome) : '',
          occupationType: primaryOcc?.type || '',
          companyName: primaryOcc?.companyName || '',
          state: primaryAddr?.state || '',
          district: primaryAddr?.district || '',
          city: primaryAddr?.city || '',
          pincode: primaryAddr?.pincode || '',
          streetAddress: primaryAddr?.line1 || contact.notes || ''
        });

        const fams = (contact.relationships || []).map((r: any) => {
          const c = r.relatedContact;
          return {
            name: `${c?.firstName || ''} ${c?.lastName || ''}`.trim(),
            dob: c?.dateOfBirth ? c.dateOfBirth.split('T')[0] : '',
            relation: r.relationshipType,
            whatsapp: c?.phone || '',
            occupation: '',
            education: '',
            medicalHistory: []
          };
        });
        setFamilyMembers(fams);

        const healthEntries: any[] = [];
        const lifeEntries: any[] = [];
        (contact.policies || []).forEach((p: any) => {
          const entry = {
            company: p.plan?.company?.name || 'Other',
            planName: p.plan?.name || 'Other',
            policyNo: p.policyNumber,
            startDate: p.startDate ? p.startDate.split('T')[0] : '',
            duration: '1 Year',
            endDate: p.endDate ? p.endDate.split('T')[0] : '',
            premium: String(p.premiumAmount),
            sumInsured: String(p.sumAssured),
            deductible: '',
            sumAssured: String(p.sumAssured),
            maturityDate: p.maturityDate ? p.maturityDate.split('T')[0] : '',
            paymentTerm: '',
            entryType: p.status === 'ACTIVE' ? 'New' : 'Renewal'
          };
          if (p.plan?.category === 'HEALTH') healthEntries.push(entry);
          else lifeEntries.push(entry);
        });

        const parsedPolicies: any[] = [];
        if (healthEntries.length > 0) parsedPolicies.push({ policyType: 'Health', entries: healthEntries });
        if (lifeEntries.length > 0) parsedPolicies.push({ policyType: 'Life', entries: lifeEntries });
        setPolicies(parsedPolicies);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!editTarget && !duplicateContactMatched) {
      const cleanPhone = personalFields.whatsappNumber.replace(/\D/g, '');
      const cleanAadhaar = personalFields.aadhaarNumber.replace(/\D/g, '');
      if (cleanPhone.length === 10) {
        checkForDuplicateContact(cleanPhone, undefined);
      } else if (cleanAadhaar.length === 12) {
        checkForDuplicateContact(undefined, cleanAadhaar);
      }
    }
  }, [personalFields.whatsappNumber, personalFields.aadhaarNumber, editTarget, duplicateContactMatched]);

  const hasActivePolicyForCard = (card: any): boolean => {
    if (!loadedContact) return false;
    const activePolicies = (loadedContact.policies || []).filter((p: any) => p.status === 'ACTIVE' || !p.status);
    return card.interestedIn.some((prod: string) => {
      return activePolicies.some((p: any) => {
        const cat = (p.plan?.category || p.category || '').toUpperCase();
        const prodUpper = prod.toUpperCase();
        if (prodUpper === 'HEALTH' && cat === 'HEALTH') return true;
        if (prodUpper === 'LIFE' && cat === 'LIFE') return true;
        if (prodUpper === 'MOTOR' && cat === 'MOTOR') return true;
        return false;
      });
    });
  };

  const isPolicyOutsideRenewalWindowForCard = (card: any): boolean => {
    if (!loadedContact) return false;
    const activePolicies = (loadedContact.policies || []).filter((p: any) => p.status === 'ACTIVE' || !p.status);
    return card.interestedIn.some((prod: string) => {
      return activePolicies.some((p: any) => {
        const cat = (p.plan?.category || p.category || '').toUpperCase();
        const prodUpper = prod.toUpperCase();
        
        let match = false;
        if (prodUpper === 'HEALTH' && cat === 'HEALTH') match = true;
        if (prodUpper === 'LIFE' && cat === 'LIFE') match = true;
        if (prodUpper === 'MOTOR' && cat === 'MOTOR') match = true;
        
        if (match && p.endDate) {
          const expiryDate = new Date(p.endDate);
          const now = new Date();
          expiryDate.setHours(0, 0, 0, 0);
          now.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > maxRenewalWindow) {
            return true;
          }
        }
        return false;
      });
    });
  };

  const hasActiveRenewalLeadForCard = (card: any): boolean => {
    if (!loadedContact) return false;
    const backendInterests = loadedContact.productInterests || [];
    return card.interestedIn.some((prod: string) => {
      return backendInterests.some((lead: any) => {
        const extra = parseLeadNotes(lead.notes);
        const leadStatus = extra.leadStatus || '';
        const stage = lead.stage || '';
        const leadType = extra.leadType || 'FRESH';
        
        if (leadStatus === 'LEAD_LOST' || leadStatus === 'NOT_INTERESTED' || stage === 'LOST' || stage === 'PAYMENT_DONE') {
          return false;
        }
        if (leadType !== 'RENEWAL') return false;
        return (lead.interests || []).some((i: string) => i.toLowerCase() === prod.toLowerCase());
      });
    });
  };

  const isProductAlreadyExistsForContact = (prod: string, cardLeadType?: string): boolean => {
    if (!loadedContact) return false;
    const backendInterests = loadedContact.productInterests || [];
    
    const activeLead = backendInterests.find((lead: any) => {
      const extra = parseLeadNotes(lead.notes);
      const leadStatus = extra.leadStatus || '';
      const stage = lead.stage || '';
      
      if (leadStatus === 'LEAD_LOST' || leadStatus === 'NOT_INTERESTED' || stage === 'LOST' || stage === 'PAYMENT_DONE') {
        return false;
      }
      return (lead.interests || []).some((i: string) => i.toLowerCase() === prod.toLowerCase());
    });

    if (activeLead) {
      const activeLeadExtra = parseLeadNotes(activeLead.notes);
      const activeLeadType = activeLeadExtra.leadType || 'FRESH';
      
      if (cardLeadType === 'RENEWAL') {
        if (activeLeadType === 'RENEWAL') return true;
      } else {
        return true;
      }
    }

    const hasInPolicies = (loadedContact.policies || []).some((p: any) => {
      if (p.status && p.status !== 'ACTIVE') return false;

      const cat = (p.plan?.category || p.category || '').toUpperCase();
      const prodUpper = prod.toUpperCase();
      
      let match = false;
      if (prodUpper === 'HEALTH' && cat === 'HEALTH') match = true;
      if (prodUpper === 'LIFE' && cat === 'LIFE') match = true;
      if (prodUpper === 'MOTOR' && cat === 'MOTOR') match = true;

      if (match) {
        if (cardLeadType !== 'RENEWAL') return true;
        if (p.endDate) {
          const expiryDate = new Date(p.endDate);
          const now = new Date();
          expiryDate.setHours(0, 0, 0, 0);
          now.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > maxRenewalWindow) return true;
        }
      }
      return false;
    });
    if (hasInPolicies) return true;

    return false;
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    await deleteLead.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
    qc.invalidateQueries();
  };

  const openDetail = (card: any) => {
    setDetailTarget(card);
    setDetailTab('overview');
    setDetailOpen(true);
  };

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const activeFilterCount =
    filterPlans.length + filterStatuses.length +
    (filterEmployee ? 1 : 0) + (filterDateFrom ? 1 : 0) + (filterDateTo ? 1 : 0);

  if (isLoading) return <div className="flex h-48 items-center justify-center text-gray-400">Loading pipeline…</div>;

  return (
    <div className="h-full flex flex-col gap-4">

      {/* Floating Bottom-Right Action Panel */}
      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
      <div className="fixed right-6 bottom-8 z-40 flex flex-row gap-3 bg-white/90 backdrop-blur-xl p-2 rounded-2xl shadow-2xl border border-slate-200/80 animate-fadeIn">
        {/* Import CSV */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white flex items-center justify-center transition-all hover:scale-105 shadow-md shadow-emerald-500/25 cursor-pointer group relative"
          title="Import Leads CSV"
        >
          <Upload size={18} strokeWidth={2.2} />
          <span className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl border border-slate-800">
            Import Leads CSV
          </span>
        </button>

        {/* New Lead */}
        <button
          type="button"
          onClick={() => openCreate('OPEN')}
          className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center justify-center transition-all hover:scale-105 shadow-lg shadow-blue-500/30 cursor-pointer group relative"
          title="New Lead"
        >
          <UserPlus size={18} strokeWidth={2.2} />
          <span className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl border border-slate-800">
            New Lead
          </span>
        </button>
      </div>

      {/* Unified Search & Actions Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 border border-slate-100 rounded-2xl shadow-sm">
        {/* Left: Search Bar */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search leads by name or phone..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-slate-800"
          />
        </div>

        {/* Right: View toggle and controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Kanban / Table Toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/50">
            <button
              onClick={() => setViewMode('board')}
              className={clsx('flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold cursor-pointer transition-all select-none',
                viewMode === 'board' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-900')}
            >
              <LayoutGrid size={13} /> <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={clsx('flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold cursor-pointer transition-all select-none',
                viewMode === 'table' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-900')}
            >
              <List size={13} /> <span className="hidden sm:inline">Table</span>
            </button>
          </div>

          {/* Filters Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx('btn-secondary h-9 py-0 px-3 text-xs flex items-center gap-1.5 font-bold cursor-pointer rounded-lg',
              showFilters && 'bg-blue-50 border-blue-200 text-blue-600')}
          >
            <Filter size={13} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="bg-blue-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Table Columns (only in Table view) */}
          {viewMode === 'table' && (
            <div className="relative" ref={colMenuRef}>
              <button
                onClick={() => setColMenuOpen(!colMenuOpen)}
                className="btn-secondary h-9 py-0 px-3 text-xs flex items-center gap-1.5 font-bold cursor-pointer rounded-lg"
              >
                <Columns size={13} /> <span>Columns</span>
              </button>
              {colMenuOpen && (
                <div className="absolute right-0 mt-1.5 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 min-w-[180px] space-y-1.5">
                  {ALL_TABLE_COLUMNS.filter(c => c.key !== 'actions').map(col => (
                    <label key={col.key} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:text-gray-900">
                      <input
                        type="checkbox"
                        checked={visibleColumns[col.key]}
                        onChange={() => setVisibleColumns(prev => ({ ...prev, [col.key]: !prev[col.key] }))}
                        className="rounded accent-blue-600"
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>



      {/* Filter panel */}
      {showFilters && (
        <div className="card-panel grid grid-cols-2 lg:grid-cols-4 gap-4 bg-gray-50/50 p-4 border rounded-xl">
          <div>
            <label className="label text-[11px] font-bold text-gray-700">Product Category (Multi-Select)</label>
            <div className="relative" ref={planFilterRef}>
              <button type="button" onClick={() => setPlanFilterOpen(!planFilterOpen)}
                className="input text-xs flex items-center justify-between w-full text-left bg-white font-medium">
                <span className="truncate">{filterPlans.length === 0 ? 'All Products' : `${filterPlans.length} selected`}</span>
                <ChevronDown size={12} className="text-gray-400 shrink-0" />
              </button>
              {planFilterOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg p-2 space-y-1 max-h-48 overflow-y-auto">
                  {PLAN_CATEGORIES.map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={filterPlans.includes(opt.value)}
                        onChange={() => setFilterPlans(prev => prev.includes(opt.value) ? prev.filter(v => v !== opt.value) : [...prev, opt.value])}
                        className="rounded accent-blue-600" />
                      {opt.label}
                    </label>
                  ))}
                  {filterPlans.length > 0 && (
                    <button onClick={() => setFilterPlans([])} className="w-full text-xs text-red-500 hover:text-red-700 py-1 text-center font-bold">Clear Selected</button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="label text-[11px] font-bold text-gray-700">
              Lead Status (Multi-Select)
            </label>
            <div className="relative" ref={statusFilterRef}>
              <button type="button" onClick={() => setStatusFilterOpen(!statusFilterOpen)}
                className="input text-xs flex items-center justify-between w-full text-left bg-white font-medium">
                <span className="truncate">{filterStatuses.length === 0 ? 'All Statuses' : `${filterStatuses.length} selected`}</span>
                <ChevronDown size={12} className="text-gray-400 shrink-0" />
              </button>
              {statusFilterOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg p-2 space-y-1 max-h-48 overflow-y-auto">
                  {LEAD_STATUS_OPTIONS.map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={filterStatuses.includes(opt.value)}
                        onChange={() => setFilterStatuses(prev => prev.includes(opt.value) ? prev.filter(v => v !== opt.value) : [...prev, opt.value])}
                        className="rounded accent-blue-600" />
                      {opt.label}
                    </label>
                  ))}
                  {filterStatuses.length > 0 && (
                    <button onClick={() => setFilterStatuses([])} className="w-full text-xs text-red-500 hover:text-red-700 py-1 text-center font-bold">Clear Selected</button>
                  )}
                </div>
              )}
            </div>
          </div>

          {isOwner ? (
            <div>
              <label className="label text-[11px]">Assigned Employee</label>
              <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)} className="input text-xs">
                <option value="">All Employees</option>
                {employees.map((emp: any) => (
                  <option key={emp.id} value={emp.userId}>{emp.firstName} {emp.lastName}</option>
                ))}
              </select>
            </div>
          ) : <div />}

          <div className="space-y-2">
            <label className="label text-[11px]">Next Follow-up Date</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="input text-xs" />
              <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="input text-xs" />
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="col-span-2 lg:col-span-4 flex justify-end">
              <button
                onClick={() => { setFilterPlans([]); setFilterStatuses([]); setFilterEmployee(''); setFilterDateFrom(''); setFilterDateTo(''); }}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
              >
                <X size={11} /> Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main View */}
      {viewMode === 'board' ? (
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1 custom-scrollbar" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {UI_STAGES.map(stage => {
            const cards = filteredBoard[stage] ?? [];
            const totalBudget = expectedBusiness(stage);
            const backendStage = STAGE_MAPPINGS[stage];
            return (
              <div
                key={stage}
                className="flex-shrink-0 w-72 flex flex-col"
                onDragEnter={e => {
                  e.preventDefault();
                  if (draggedOverStage !== stage) setDraggedOverStage(stage);
                }}
                onDragOver={e => {
                  e.preventDefault();
                }}
                onDragLeave={() => {
                  if (draggedOverStage === stage) setDraggedOverStage(null);
                }}
                onDrop={e => {
                  e.preventDefault();
                  setDraggedOverStage(null);
                  const cardId = e.dataTransfer.getData('cardId');
                  if (cardId && backendStage) moveStage.mutate({ id: cardId, stage: backendStage });
                }}
              >
                <div className="flex items-center justify-between mb-3 px-2 py-1 select-none">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={clsx('h-2 w-2 rounded-full shrink-0',
                      stage === 'New' && 'bg-blue-500',
                      stage === 'Contacted' && 'bg-indigo-500',
                      stage === 'Proposal Sent' && 'bg-purple-500',
                      stage === 'In Discussion' && 'bg-amber-500',
                      stage === 'Login Progress' && 'bg-orange-500',
                      stage === 'Payment Done' && 'bg-emerald-500',
                      stage === 'Lost' && 'bg-rose-500'
                    )} />
                    <span className="text-sm font-bold text-slate-800 truncate">{stage}</span>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200/50 px-1.5 py-0.5 rounded-md shrink-0">{cards.length}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 font-bold shrink-0">
                      ₹{totalBudget >= 100000 ? `${(totalBudget / 100000).toFixed(1)}L` : `${(totalBudget / 1000).toFixed(1)}K`}
                    </span>
                    <button
                      onClick={() => openCreate(backendStage)}
                      className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
                      title={`Add lead in ${stage}`}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>

                <div className={clsx(
                  'flex-1 min-h-[400px] rounded-xl border p-2 space-y-2 transition-all duration-200 overflow-y-auto custom-scrollbar',
                  STAGE_COLORS[stage],
                  draggedOverStage === stage ? 'ring-2 ring-blue-500 scale-[1.01] bg-slate-100' : 'bg-slate-50/50'
                )}>
                  {cards.map(card => (
                    <KanbanCard
                      key={card.id}
                      card={card}
                      onEdit={openEdit}
                      onDelete={c => setDeleteTarget(c)}
                      onOpen={openDetail}
                      onCall={handleCall}
                      onWhatsApp={handleWhatsApp}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <LeadsTable
          data={sortedLeads}
          loading={isLoading}
          visibleColumns={visibleColumns}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          onRowClick={openDetail}
          onEdit={openEdit}
          onDelete={c => setDeleteTarget(c)}
          onCall={handleCall}
          onWhatsApp={handleWhatsApp}
          onCreate={() => openCreate('OPEN')}
        />
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={
          editTarget
            ? "Edit Lead"
            : "Add New Lead"
        }
        subtitle={
          editTarget
            ? "Update lead profile, family details, and policies."
            : "Manage lead profile, family details, and address."
        }
        size="2xl"
        actions={
          <div className="flex gap-2.5 mr-1">
            {editTarget ? (
              <button
                type="button"
                className="px-5 py-2 text-xs font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl cursor-pointer shadow-md shadow-blue-500/20 transition-all hover:scale-105"
                onClick={(e) => handleLeadSubmit(e, true)}
              >
                Update Profile
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="px-4 py-2 text-xs font-extrabold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer shadow-2xs transition-all"
                  onClick={(e) => handleLeadSubmit(e, false)}
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  className="px-5 py-2 text-xs font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl cursor-pointer shadow-md shadow-blue-500/20 transition-all hover:scale-105"
                  onClick={(e) => handleLeadSubmit(e, true)}
                >
                  Save & Close
                </button>
              </>
            )}
          </div>
        }
      >
        <form className="space-y-3">

          {/* Modal sub-navigation tabs */}
          <div className="flex bg-slate-200/60 p-1.5 rounded-2xl mt-0 mb-3 gap-2 border border-slate-200/80 overflow-x-auto shadow-2xs">
            {['Product Interest', 'Personal', 'Family', 'Policy', 'WA Campaign', 'History'].map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveLeadTab(tab)}
                className={clsx(
                  'px-5 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap',
                  activeLeadTab === tab
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {editContactId && !editTarget && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl text-xs font-bold mb-3 flex items-center justify-between shadow-2xs animate-fadeIn">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 bg-emerald-500 rounded-full animate-ping shrink-0" />
                Existing Contact Found – Details Loaded.
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditContactId(null);
                  setLoadedContact(null);
                  setDuplicateContactMatched(null);
                  setPersonalFields({
                    fullName: '',
                    gender: '',
                    maritalStatus: '',
                    dateOfBirth: '',
                    email: '',
                    aadhaarNumber: '',
                    whatsappNumber: '',
                    sameAsWhatsapp: false,
                    callingNumber: '',
                    education: '',
                    annualIncome: '',
                    occupationType: '',
                    companyName: '',
                    state: '',
                    district: '',
                    city: '',
                    pincode: '',
                    streetAddress: ''
                  });
                  setFamilyMembers([]);
                  setPolicies([]);
                }}
                className="text-[10px] text-emerald-600 hover:text-emerald-800 underline uppercase tracking-wider font-extrabold cursor-pointer"
              >
                Clear / Reset
              </button>
            </div>
          )}

          {/* Tab contents */}
          <div className="h-[430px] overflow-y-auto pr-2 custom-scrollbar">
            {activeLeadTab === 'Product Interest' && (
              <div className="space-y-3 animate-fadeIn pb-2">

                {/* Cards List */}
                {productInterests.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-xs gap-2">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center mb-1">
                      <Shield size={24} className="text-blue-300" />
                    </div>
                    <p className="font-semibold text-slate-500">No product interests added yet.</p>
                    <p className="text-[11px] text-slate-400">Click "+ Add Product Interest" below to get started.</p>
                  </div>
                )}

                {productInterests.map((card, idx) => {
                  const displayName = card.interestedIn.length > 0
                    ? card.interestedIn.map(p => p === 'Other' && card.otherProduct ? card.otherProduct : p).join(', ')
                    : 'New Product Interest';

                  const PRODUCT_COLORS: Record<string, string> = {
                    Health: 'from-emerald-500 to-teal-600',
                    Life: 'from-blue-500 to-indigo-600',
                    Term: 'from-violet-500 to-purple-600',
                    'Accident Policy': 'from-orange-500 to-amber-600',
                    Motor: 'from-rose-500 to-pink-600',
                    'Mutual Funds': 'from-cyan-500 to-sky-600',
                    Porting: 'from-yellow-500 to-orange-500',
                    Other: 'from-slate-500 to-gray-600',
                  };
                  const firstProduct = card.interestedIn[0] || 'Other';
                  const headerGradient = PRODUCT_COLORS[firstProduct] || 'from-blue-500 to-indigo-600';

                  return (
                    <div
                      key={card.id}
                      className="rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-md transition-all"
                    >
                      {/* Card Header — always visible */}
                      <div
                        className={`bg-gradient-to-r ${headerGradient} px-4 py-3 flex items-center justify-between cursor-pointer select-none`}
                        onClick={() => toggleProductCollapse(card.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-6 h-6 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                            <span className="text-white font-black text-[11px]">{idx + 1}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-white font-extrabold text-xs truncate">{displayName}</p>
                            {card.collapsed && card.leadStage && (
                              <p className="text-white/70 text-[10px] font-semibold truncate">
                                {card.leadStage.replace(/_/g, ' ')} · {card.leadStatus.replace(/_/g, ' ')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); removeProductInterest(card.id); }}
                            className="p-1 rounded-lg bg-white/10 hover:bg-red-500/80 text-white transition-all"
                            title="Remove"
                          >
                            <Trash2 size={13} />
                          </button>
                          <ChevronDown
                            size={16}
                            className={`text-white transition-transform duration-200 ${card.collapsed ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </div>

                      {/* Card Body — collapse/expand */}
                      {!card.collapsed && (
                        <div className="p-4 space-y-4 bg-white">

                          {/* Interested In — toggle buttons */}
                          <div>
                            <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Interested In</label>
                            <div className="flex flex-wrap gap-2">
                              {['Health', 'Life', 'Term', 'Accident Policy', 'Motor', 'Mutual Funds', 'Porting', 'Other'].map(prod => {
                                const isSel = card.interestedIn.includes(prod);
                                const isAlreadySelected = productInterests.some(otherCard => 
                                  otherCard.id !== card.id && otherCard.interestedIn.includes(prod)
                                ) || isProductAlreadyExistsForContact(prod, card.leadType);
                                const PILL_COLORS: Record<string, string> = {
                                  Health: isSel ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
                                  Life: isSel ? 'bg-blue-600 border-blue-600 text-white' : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
                                  Term: isSel ? 'bg-violet-600 border-violet-600 text-white' : 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100',
                                  'Accident Policy': isSel ? 'bg-orange-600 border-orange-600 text-white' : 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100',
                                  Motor: isSel ? 'bg-rose-600 border-rose-600 text-white' : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100',
                                  'Mutual Funds': isSel ? 'bg-cyan-600 border-cyan-600 text-white' : 'bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100',
                                  Porting: isSel ? 'bg-yellow-500 border-yellow-500 text-white' : 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100',
                                  Other: isSel ? 'bg-slate-700 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100',
                                };
                                let btnStyle = PILL_COLORS[prod] || (isSel ? 'bg-slate-700 text-white border-slate-700' : 'bg-white border-slate-200 text-slate-600');
                                if (isAlreadySelected) {
                                  btnStyle = 'bg-slate-100 border-slate-200 text-slate-400 opacity-40 cursor-not-allowed';
                                }
                                return (
                                  <button
                                    key={prod}
                                    type="button"
                                    disabled={isAlreadySelected}
                                    onClick={() => {
                                      const next = isSel ? [] : [prod];
                                      updateProductInterest(card.id, 'interestedIn', next);
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all select-none ${btnStyle}`}
                                  >
                                    {isSel ? '✓ ' : '+ '}{prod}
                                  </button>
                                );
                              })}
                            </div>
                            {hasActiveRenewalLeadForCard(card) && card.leadType === 'RENEWAL' && (
                              <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-xl text-[11px] font-bold mt-2 animate-fadeIn">
                                An active Renewal lead already exists for this product.
                              </div>
                            )}
                            {hasActivePolicyForCard(card) && card.leadType === 'RENEWAL' && isPolicyOutsideRenewalWindowForCard(card) && (
                              <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-xl text-[11px] font-bold mt-2 animate-fadeIn">
                                Renewal cannot be created yet. The policy is outside the renewal period.
                              </div>
                            )}
                            {hasActivePolicyForCard(card) && card.leadType !== 'RENEWAL' && (
                              <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-xl text-[11px] font-bold mt-2 animate-fadeIn">
                                An active policy already exists for this product. Only a Renewal lead can be created.
                              </div>
                            )}
                            {card.interestedIn.includes('Other') && (
                              <input
                                type="text"
                                className="input mt-2 text-xs w-full"
                                placeholder="Specify product name..."
                                value={card.otherProduct}
                                onChange={e => updateProductInterest(card.id, 'otherProduct', e.target.value)}
                              />
                            )}
                          </div>

                          {/* Row 1: Stage, Status, Type */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Lead Stage</label>
                              <select
                                className="input w-full text-xs"
                                value={card.leadStage}
                                onChange={e => updateProductInterest(card.id, 'leadStage', e.target.value)}
                              >
                                <option value="TO_CONTACT">To Contact</option>
                                <option value="CONTACTED">Contacted</option>
                                <option value="PROPOSAL_SENT">Proposal Sent</option>
                                <option value="LOGIN_PROGRESS">Login in Progress</option>
                                <option value="PAYMENT_DONE">Payment Done</option>
                                <option value="PROCESS_COMPLETED">Process Completed</option>
                              </select>
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Lead Status</label>
                              <select
                                className="input w-full text-xs"
                                value={card.leadStatus}
                                onChange={e => updateProductInterest(card.id, 'leadStatus', e.target.value)}
                              >
                                <option value="INTERESTED">Interested</option>
                                <option value="HOT">Hot 🔥</option>
                                <option value="VERY_HOT">Very Hot 🔥🔥</option>
                                <option value="NOT_INTERESTED">Not Interested</option>
                                <option value="LEAD_LOST">Lead Lost</option>
                              </select>
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Lead Type</label>
                              <select
                                className="input w-full text-xs"
                                value={card.leadType}
                                onChange={e => updateProductInterest(card.id, 'leadType', e.target.value)}
                              >
                                <option value="FRESH">Fresh</option>
                                <option value="RENEWAL">Renewal</option>
                                <option value="PORTING">Porting</option>
                              </select>
                            </div>
                          </div>

                          {/* Row 2: Source, Assigned Employee, Follow-up Date, Expected Premium */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Lead Source</label>
                              <input
                                type="text"
                                list={`lead-source-list-${card.id}`}
                                className="input w-full text-xs"
                                placeholder="e.g. Social Media"
                                value={card.leadSource}
                                onChange={e => updateProductInterest(card.id, 'leadSource', e.target.value)}
                              />
                              <datalist id={`lead-source-list-${card.id}`}>
                                <option value="Social Media" />
                                <option value="Our Customer Self" />
                                <option value="Referred by Customer" />
                                <option value="Walk-in" />
                                <option value="BNI" />
                              </datalist>
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Assigned Employee</label>
                              <select
                                className="input w-full text-xs"
                                value={card.assignedEmployeeId}
                                onChange={e => updateProductInterest(card.id, 'assignedEmployeeId', e.target.value)}
                              >
                                <option value="">Select Employee</option>
                                {employees?.map((emp: any) => (
                                  <option key={emp.id} value={emp.userId || emp.id}>
                                    {emp.firstName} {emp.lastName}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Follow-up Date</label>
                              <input
                                type="date"
                                className="input w-full text-xs"
                                value={card.followUpDate}
                                onChange={e => updateProductInterest(card.id, 'followUpDate', e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Expected Premium (₹)</label>
                              <input
                                type="number"
                                className="input w-full text-xs"
                                placeholder="e.g. 12000"
                                min={0}
                                value={card.expectedPremium}
                                onChange={e => updateProductInterest(card.id, 'expectedPremium', e.target.value)}
                              />
                            </div>
                          </div>

                          {/* Consultation Comments Timeline */}
                          <div className="bg-slate-50/80 rounded-xl border border-slate-200/60 p-3 space-y-3">
                            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Consultation Comments</p>

                            {/* Timeline */}
                            <div className="max-h-36 overflow-y-auto space-y-2 custom-scrollbar">
                              {card.comments.length === 0 ? (
                                <p className="text-xs text-slate-400 italic text-center py-4">No comments yet. Add the first one below.</p>
                              ) : (
                                card.comments.map((cmt, ci) => (
                                  <div key={ci} className="bg-white rounded-xl border border-slate-100 p-2.5 shadow-2xs">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">{cmt.author}</span>
                                      <span className="text-[9px] text-slate-400 font-semibold">{cmt.datetime}</span>
                                    </div>
                                    <p className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{cmt.text}</p>
                                  </div>
                                ))
                              )}
                            </div>

                            {/* Add comment input */}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                className="input flex-1 text-xs"
                                placeholder="Type a comment and press Enter or Add..."
                                value={card.newComment}
                                onChange={e => updateProductInterest(card.id, 'newComment', e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { e.preventDefault(); addProductComment(card.id); }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => addProductComment(card.id)}
                                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-extrabold text-xs cursor-pointer transition-all shadow-2xs shrink-0"
                              >
                                Add
                              </button>
                            </div>
                          </div>

                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add Product Interest Button */}
                {(() => {
                  const standardProds = ['Health', 'Life', 'Term', 'Accident Policy', 'Motor', 'Mutual Funds', 'Porting'];
                  const allProductsAdded = editContactId ? standardProds.every(p => isProductAlreadyExistsForContact(p)) : false;

                  return (
                    <>
                      {allProductsAdded && (
                        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-2.5 rounded-xl text-xs font-bold mb-3 shadow-2xs animate-fadeIn">
                          All available products have already been added for this contact. No new Product Interest can be created.
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={allProductsAdded}
                        onClick={addProductInterest}
                        className={clsx(
                          "w-full mt-1 py-3 rounded-2xl border-2 border-dashed text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer group",
                          allProductsAdded
                            ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                            : "border-blue-300 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50 text-blue-600 hover:text-blue-700"
                        )}
                      >
                        <Plus size={15} className="group-hover:scale-110 transition-transform" />
                        + Add Product Interest
                      </button>
                    </>
                  );
                })()}

              </div>
            )}
            {activeLeadTab === 'Personal' && (
              <fieldset disabled={!!editContactId} className="w-full">
                {editContactId && (
                  <div className="bg-slate-50 border border-slate-200 text-slate-500 px-3.5 py-2.5 rounded-xl text-xs font-bold mb-4 flex items-center justify-between shadow-2xs">
                    <span>Contact details are read-only. Edit them in the Contacts module.</span>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Full Name *</label>
                    <input
                      type="text"
                      className="input w-full"
                      placeholder="e.g. Rahul Sharma"
                      value={personalFields.fullName}
                      onChange={e => setPersonalFields(p => ({ ...p, fullName: e.target.value }))}
                    />
                  </div>
                <div>
                  <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Gender</label>
                  <select
                    className="input w-full"
                    value={personalFields.gender}
                    onChange={e => setPersonalFields(p => ({ ...p, gender: e.target.value }))}
                  >
                    <option value="">SelectType</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Marital Status</label>
                  <select
                    className="input w-full"
                    value={personalFields.maritalStatus}
                    onChange={e => setPersonalFields(p => ({ ...p, maritalStatus: e.target.value }))}
                  >
                    <option value="">SelectType</option>
                    <option value="SINGLE">Single</option>
                    <option value="MARRIED">Married</option>
                    <option value="DIVORCED">Divorced</option>
                    <option value="WIDOWED">Widowed</option>
                  </select>
                </div>
                <div>
                  <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Date of Birth</label>
                  <input
                    type="date"
                    className="input w-full"
                    value={personalFields.dateOfBirth}
                    onChange={e => setPersonalFields(p => ({ ...p, dateOfBirth: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Email Address</label>
                  <input
                    type="email"
                    className="input w-full"
                    placeholder="client@example.com"
                    value={personalFields.email}
                    onChange={e => setPersonalFields(p => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Aadhaar Number</label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="12-digit Aadhaar No"
                    maxLength={12}
                    value={personalFields.aadhaarNumber}
                    onChange={e => setPersonalFields(p => ({ ...p, aadhaarNumber: e.target.value.replace(/\D/g, '') }))}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Whatsapp Number *</label>
                    <label className="flex items-center gap-1 text-[9px] text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={personalFields.sameAsWhatsapp}
                        onChange={e => {
                          const checked = e.target.checked;
                          setPersonalFields(p => ({
                            ...p,
                            sameAsWhatsapp: checked,
                            callingNumber: checked ? p.whatsappNumber : p.callingNumber
                          }));
                        }}
                      />
                      Same as Whatsapp
                    </label>
                  </div>
                  <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-500/10 focus-within:border-blue-500 transition-all">
                    <span className="bg-slate-50 px-2.5 py-1.5 text-xs border-r border-slate-200 text-slate-500 font-bold">+91</span>
                    <input
                      type="tel"
                      className="px-3 py-1.5 text-xs w-full outline-none bg-transparent"
                      placeholder="Mobile Number"
                      value={personalFields.whatsappNumber}
                      onChange={e => {
                        const val = e.target.value;
                        setPersonalFields(p => ({
                          ...p,
                          whatsappNumber: val,
                          callingNumber: p.sameAsWhatsapp ? val : p.callingNumber
                        }));
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Calling Number</label>
                  <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-500/10 focus-within:border-blue-500 transition-all">
                    <span className="bg-slate-50 px-2.5 py-1.5 text-xs border-r border-slate-200 text-slate-500 font-bold">+91</span>
                    <input
                      type="tel"
                      className="px-3 py-1.5 text-xs w-full outline-none bg-transparent disabled:bg-slate-50"
                      placeholder="Mobile Number"
                      disabled={personalFields.sameAsWhatsapp}
                      value={personalFields.callingNumber}
                      onChange={e => setPersonalFields(p => ({ ...p, callingNumber: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Education</label>
                  <select
                    className="input w-full"
                    value={personalFields.education}
                    onChange={e => setPersonalFields(p => ({ ...p, education: e.target.value }))}
                  >
                    <option value="">SelectType</option>
                    <option value="HighSchool">High School</option>
                    <option value="Graduate">Graduate</option>
                    <option value="PostGraduate">Post Graduate</option>
                    <option value="Professional">Professional</option>
                  </select>
                </div>
                <div>
                  <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Annual Income</label>
                  <select
                    className="input w-full"
                    value={personalFields.annualIncome}
                    onChange={e => setPersonalFields(p => ({ ...p, annualIncome: e.target.value }))}
                  >
                    <option value="">SelectType</option>
                    <option value="200000">Below 2 Lakhs</option>
                    <option value="500000">2 - 5 Lakhs</option>
                    <option value="1000000">5 - 10 Lakhs</option>
                    <option value="2000000">10 - 20 Lakhs</option>
                    <option value="5000000">20+ Lakhs</option>
                  </select>
                </div>
                <div>
                  <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Occupation Type</label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="e.g. Salaried"
                    value={personalFields.occupationType}
                    onChange={e => setPersonalFields(p => ({ ...p, occupationType: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Company / Business Name</label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="e.g. Infosys / Sharma Traders"
                    value={personalFields.companyName}
                    onChange={e => setPersonalFields(p => ({ ...p, companyName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">State</label>
                  <select
                    className="input w-full"
                    value={personalFields.state}
                    onChange={e => setPersonalFields(p => ({ ...p, state: e.target.value }))}
                  >
                    <option value="">Select State</option>
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Delhi">Delhi</option>
                    <option value="Karnataka">Karnataka</option>
                    <option value="Gujarat">Gujarat</option>
                  </select>
                </div>
                <div>
                  <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">District</label>
                  <select
                    className="input w-full"
                    value={personalFields.district}
                    onChange={e => setPersonalFields(p => ({ ...p, district: e.target.value }))}
                  >
                    <option value="">Select District</option>
                    <option value="Pune">Pune</option>
                    <option value="Mumbai">Mumbai</option>
                    <option value="Bangalore">Bangalore</option>
                    <option value="Ahmedabad">Ahmedabad</option>
                  </select>
                </div>
                <div>
                  <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">City / Town</label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="e.g. Pune"
                    value={personalFields.city}
                    onChange={e => setPersonalFields(p => ({ ...p, city: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Pincode</label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="000000"
                    value={personalFields.pincode}
                    onChange={e => setPersonalFields(p => ({ ...p, pincode: e.target.value }))}
                  />
                </div>
                <div className="col-span-3">
                  <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Street Address / House No</label>
                  <textarea
                    className="input w-full text-xs"
                    rows={2}
                    placeholder="Flat No, Street, Landmark..."
                    value={personalFields.streetAddress}
                    onChange={e => setPersonalFields(p => ({ ...p, streetAddress: e.target.value }))}
                  />
                </div>
              </div>
            </fieldset>
          )}


            {activeLeadTab === 'Family' && (
              <div className="h-full flex flex-col gap-0">
                {editContactId && (
                  <div className="bg-slate-50 border border-slate-200 text-slate-500 px-3.5 py-2.5 rounded-xl text-xs font-bold mb-4 flex items-center justify-between shadow-2xs flex-shrink-0">
                    <span>Contact details are read-only. Edit them in the Contacts module.</span>
                  </div>
                )}
                {/* Header */}
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                  <h3 className="text-base font-bold text-gray-800">Dependents &amp; Beneficiaries</h3>
                  {!editContactId && (
                    <button
                      type="button"
                      onClick={() => setFamilyMembers(prev => [...prev, { name: '', dob: '', relation: '', whatsapp: '', occupation: '', education: '', medicalHistory: [] }])}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                    >
                      + Add Member
                    </button>
                  )}
                </div>

                {/* Members */}
                <fieldset disabled={!!editContactId} className="flex-1 overflow-y-auto pr-0.5 min-h-0">
                  <div className="space-y-3">
                    {familyMembers.length === 0 ? (
                      <div className="flex items-center justify-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50" style={{ minHeight: '120px' }}>
                        <p className="text-xs text-gray-400 font-medium">No family details added yet.</p>
                      </div>
                    ) : (
                      familyMembers.map((member, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-xl bg-white shadow-sm">
                          {/* Card header */}
                          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Member #{idx + 1}</span>
                            {!editContactId && (
                              <button
                                type="button"
                                onClick={() => setFamilyMembers(prev => prev.filter((_, i) => i !== idx))}
                                className="w-5 h-5 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors cursor-pointer text-xs font-bold"
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          {/* Row 1: Name | DOB | Relation */}
                          <div className="grid grid-cols-3 gap-3 px-4 pt-3">
                          <div>
                            <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Name</label>
                            <input
                              type="text"
                              className="input w-full mt-1"
                              placeholder="Full name"
                              value={member.name}
                              onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, name: e.target.value } : m))}
                            />
                          </div>
                          <div>
                            <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">DOB</label>
                            <input
                              type="date"
                              className="input w-full mt-1"
                              value={member.dob}
                              onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, dob: e.target.value } : m))}
                            />
                          </div>
                          <div>
                            <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Relation</label>
                            <select
                              className="input w-full mt-1"
                              value={member.relation}
                              onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, relation: e.target.value } : m))}
                            >
                              <option value="">SelectType</option>
                              <option value="SPOUSE">Spouse</option>
                              <option value="SON">Son</option>
                              <option value="DAUGHTER">Daughter</option>
                              <option value="FATHER">Father</option>
                              <option value="MOTHER">Mother</option>
                              <option value="OTHER">Other</option>
                            </select>
                          </div>
                        </div>

                        {/* Row 2: Whatsapp */}
                        <div className="grid grid-cols-3 gap-3 px-4 py-3">
                          <div>
                            <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Whatsapp</label>
                            <input
                              type="tel"
                              className="input w-full mt-1"
                              placeholder="Mobile"
                              value={member.whatsapp}
                              onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, whatsapp: e.target.value } : m))}
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  </div>
                </fieldset>
              </div>
            )}

            {activeLeadTab === 'Policy' && (
              <div className="h-full flex flex-col gap-3">
                {editContactId && (
                  <div className="bg-slate-50 border border-slate-200 text-slate-500 px-3.5 py-2.5 rounded-xl text-xs font-bold flex-shrink-0 shadow-2xs">
                    <span>Contact details are read-only. Edit them in the Contacts module.</span>
                  </div>
                )}
                <div className="flex items-center justify-between flex-shrink-0">
                  <h3 className="text-base font-bold text-gray-800 text-sm">Policy Portfolio</h3>
                  {!editContactId && (
                    <button
                      type="button"
                      onClick={() => setPolicies(prev => [...prev, { policyType: 'Health', entries: [{ company: '', planName: '', policyNo: '', startDate: '', duration: '1 Year', endDate: '', premium: '', sumInsured: '', deductible: '', sumAssured: '', maturityDate: '', paymentTerm: '', entryType: 'New' }] }])}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                    >
                      + Add Policy Type Card
                    </button>
                  )}
                </div>

                <fieldset disabled={!!editContactId} className="flex-1 overflow-y-auto pr-0.5 min-h-0">
                  <div className="space-y-4">
                    {policies.length === 0 ? (
                      <div className="flex items-center justify-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50" style={{ minHeight: '120px' }}>
                        <p className="text-xs text-gray-400 font-medium">No policies found for this contact.</p>
                      </div>
                    ) : (
                      policies.map((pGroup, gIdx) => (
                        <div key={gIdx} className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-extrabold text-slate-600">Type:</span>
                              <select
                                value={pGroup.policyType}
                                onChange={e => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, policyType: e.target.value } : pg))}
                                className="bg-transparent border-none text-xs font-extrabold text-blue-600 focus:ring-0 cursor-pointer p-0"
                              >
                                <option value="Health">Health</option>
                                <option value="Life">Life</option>
                              </select>
                            </div>
                            {!editContactId && (
                              <button
                                type="button"
                                onClick={() => setPolicies(prev => prev.filter((_, gi) => gi !== gIdx))}
                                className="text-xs text-red-500 hover:text-red-700 font-bold"
                              >
                                Remove Card
                              </button>
                            )}
                          </div>

                        <div className="p-3 space-y-3">
                          {pGroup.entries.map((entry: any, eIdx: number) => (
                            <div key={eIdx} className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-400">Entry #{eIdx + 1}</span>
                                {pGroup.entries.length > 1 && !editContactId && (
                                  <button
                                    type="button"
                                    onClick={() => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: pg.entries.filter((_: any, ei: number) => ei !== eIdx) } : pg))}
                                    className="text-[10px] text-red-500 hover:underline"
                                  >
                                    Remove Entry
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <label className="label text-[10px]">Company</label>
                                  <input
                                    type="text"
                                    className="input w-full mt-1 text-xs"
                                    placeholder="Company name"
                                    value={entry.company}
                                    onChange={e => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: pg.entries.map((en: any, ei: number) => ei === eIdx ? { ...en, company: e.target.value } : en) } : pg))}
                                  />
                                </div>
                                <div>
                                  <label className="label text-[10px]">Plan Name</label>
                                  <input
                                    type="text"
                                    className="input w-full mt-1 text-xs"
                                    placeholder="Plan name"
                                    value={entry.planName}
                                    onChange={e => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: pg.entries.map((en: any, ei: number) => ei === eIdx ? { ...en, planName: e.target.value } : en) } : pg))}
                                  />
                                </div>
                                <div>
                                  <label className="label text-[10px]">Policy Number</label>
                                  <input
                                    type="text"
                                    className="input w-full mt-1 text-xs"
                                    placeholder="Policy No"
                                    value={entry.policyNo}
                                    onChange={e => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: pg.entries.map((en: any, ei: number) => ei === eIdx ? { ...en, policyNo: e.target.value } : en) } : pg))}
                                  />
                                </div>
                                <div>
                                  <label className="label text-[10px]">Start Date</label>
                                  <input
                                    type="date"
                                    className="input w-full mt-1 text-xs"
                                    value={entry.startDate}
                                    onChange={e => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: pg.entries.map((en: any, ei: number) => ei === eIdx ? { ...en, startDate: e.target.value } : en) } : pg))}
                                  />
                                </div>
                                <div>
                                  <label className="label text-[10px]">End Date</label>
                                  <input
                                    type="date"
                                    className="input w-full mt-1 text-xs"
                                    value={entry.endDate}
                                    onChange={e => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: pg.entries.map((en: any, ei: number) => ei === eIdx ? { ...en, endDate: e.target.value } : en) } : pg))}
                                  />
                                </div>
                                <div>
                                  <label className="label text-[10px]">{pGroup.policyType === 'Health' ? 'Premium (₹)' : 'Premium (₹)'}</label>
                                  <input
                                    type="number"
                                    className="input w-full mt-1 text-xs"
                                    placeholder="Premium"
                                    value={entry.premium}
                                    onChange={e => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: pg.entries.map((en: any, ei: number) => ei === eIdx ? { ...en, premium: e.target.value } : en) } : pg))}
                                  />
                                </div>
                                <div>
                                  <label className="label text-[10px]">{pGroup.policyType === 'Health' ? 'Sum Insured (₹)' : 'Sum Assured (₹)'}</label>
                                  <input
                                    type="number"
                                    className="input w-full mt-1 text-xs"
                                    placeholder="Amount"
                                    value={pGroup.policyType === 'Health' ? entry.sumInsured : entry.sumAssured}
                                    onChange={e => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: pg.entries.map((en: any, ei: number) => ei === eIdx ? { ...en, [pGroup.policyType === 'Health' ? 'sumInsured' : 'sumAssured']: e.target.value } : en) } : pg))}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                          {!editContactId && (
                            <button
                              type="button"
                              onClick={() => setPolicies(prev => prev.map((pg, gi) => gi === gIdx ? { ...pg, entries: [...pg.entries, { company: '', planName: '', policyNo: '', startDate: '', duration: '1 Year', endDate: '', premium: '', sumInsured: '', deductible: '', sumAssured: '', maturityDate: '', paymentTerm: '', entryType: 'New' }] } : pg))}
                              className="w-full py-2 border border-dashed border-slate-300 hover:border-slate-400 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-700 bg-white"
                            >
                              + Add Entry
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </fieldset>
            </div>
          )}

            {activeLeadTab === 'WA Campaign' && (
              <div className="space-y-4">
                {editContactId && (
                  <div className="bg-slate-50 border border-slate-200 text-slate-500 px-3.5 py-2.5 rounded-xl text-xs font-bold mb-4 shadow-2xs">
                    <span>Contact campaigns are read-only. Edit them in the Contacts module.</span>
                  </div>
                )}
                <div>
                  <h3 className="text-xs font-semibold text-gray-800">Select Campaigns</h3>
                  <p className="text-[11px] text-gray-500 mt-1">Choose which WhatsApp campaigns this lead should be part of:</p>
                </div>
                <fieldset disabled={!!editContactId} className="space-y-2 mt-3">
                  {[
                    'Health Awareness',
                    'New Year Offer',
                    'Pension Plan',
                    'Monsoon Safety',
                    'Term Insurance Promo',
                    'Family Health Package'
                  ].map((campaign) => (
                    <label
                      key={campaign}
                      className="flex items-center gap-3 p-3 bg-gray-50/50 border border-gray-150 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedCampaigns.includes(campaign)}
                        onChange={() => {
                          setSelectedCampaigns(prev =>
                            prev.includes(campaign) ? prev.filter(c => c !== campaign) : [...prev, campaign]
                          );
                        }}
                      />
                      <span className="text-xs font-semibold text-gray-700">{campaign}</span>
                    </label>
                  ))}
                </fieldset>
              </div>
            )}

            {activeLeadTab === 'History' && (
              <div className="space-y-4">
                <div className="flex flex-col">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Lead Activity Timeline</h3>
                  <div className="max-h-[360px] overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                    {editContactId && loadedContact?.productInterests?.flatMap((pi: any) => pi.consultations || []).length === 0 && (
                      <div className="py-16 text-center text-xs text-slate-400 italic">
                        No activity or interaction logs found for this lead.
                      </div>
                    )}
                    {!editContactId && (
                      <div className="py-16 text-center text-xs text-slate-400 italic">
                        Activity timeline will be available after saving the lead.
                      </div>
                    )}
                    {editContactId && loadedContact?.productInterests?.flatMap((pi: any) => pi.consultations || []).map((act: any, idx: number) => {
                      const author = act.author || 'System';
                      return (
                        <div key={idx} className="bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-1.5 transition-all text-xs">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                            <span>{act.createdAt ? format(new Date(act.createdAt), 'dd/MM/yyyy hh:mm a') : ''}</span>
                            <span className="text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md">{author}</span>
                          </div>
                          <p className="text-slate-600 whitespace-pre-wrap leading-relaxed mt-1 font-medium">{act.notes}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Lead" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Delete Lead for <strong>{deleteTarget?.contact?.firstName} {deleteTarget?.contact?.lastName}</strong>?
        </p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="btn-danger" onClick={executeDelete} disabled={deleteLead.isPending}>Delete</button>
        </div>
      </Modal>

      {/* Detail Popup */}
      <Modal
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailTarget(null); }}
        title={detailTarget ? `${detailTarget.contact?.firstName ?? ''} ${detailTarget.contact?.lastName ?? ''}` : 'Lead Details'}
        size="xl"
      >
        {detailTarget && (
          <LeadDetailPopup
            lead={detailTarget}
            tab={detailTab}
            onTabChange={setDetailTab}
            employees={employees}
            isOwner={isOwner}
            onEdit={() => { setDetailOpen(false); openEdit(detailTarget); }}
          />
        )}
      </Modal>
    </div>
  );
}

// ── Kanban Card ───────────────────────────────────────────────────────────────
function KanbanCard({ card, onEdit, onDelete, onOpen, onCall, onWhatsApp }: {
  card: any;
  onEdit: (c: any) => void;
  onDelete: (c: any) => void;
  onOpen: (c: any) => void;
  onCall: (phone?: string) => void;
  onWhatsApp: (phone?: string) => void;
}) {
  const formattedDate = card.createdAt ? format(new Date(card.createdAt), 'dd MMM') : '';
  const followUp = card.followUpDate ? format(new Date(card.followUpDate), 'dd/MMM/yyyy') : null;
  const assigneeName = card.assignedEmployee?.employeeProfile
    ? `${card.assignedEmployee.employeeProfile.firstName} ${card.assignedEmployee.employeeProfile.lastName}`
    : card.assignedEmployee?.name || 'Unassigned';
  const initials = `${card.contact?.firstName?.[0] ?? ''}${card.contact?.lastName?.[0] ?? ''}`.toUpperCase() || 'LD';
  const hotness = deriveHotness(card);
  const hotnessConf = HOTNESS_CONFIG[hotness];

  const AVATAR_BG: Record<string, string> = {
    OPEN: 'bg-blue-500', CONTACTED: 'bg-indigo-500', PROPOSAL_SENT: 'bg-purple-500',
    IN_DISCUSSION: 'bg-amber-500', LOGIN_PROGRESS: 'bg-orange-500',
    PAYMENT_DONE: 'bg-emerald-500', LOST: 'bg-rose-500',
  };
  const BORDER_TOP: Record<string, string> = {
    OPEN: 'border-t-4 border-t-blue-500', CONTACTED: 'border-t-4 border-t-indigo-500',
    PROPOSAL_SENT: 'border-t-4 border-t-purple-500', IN_DISCUSSION: 'border-t-4 border-t-amber-500',
    LOGIN_PROGRESS: 'border-t-4 border-t-orange-500', PAYMENT_DONE: 'border-t-4 border-t-emerald-500',
    LOST: 'border-t-4 border-t-rose-500',
  };
  const SHADOW_HOVER: Record<string, string> = {
    OPEN: 'hover:shadow-md hover:shadow-blue-500/10 hover:border-blue-400',
    CONTACTED: 'hover:shadow-md hover:shadow-indigo-500/10 hover:border-indigo-400',
    PROPOSAL_SENT: 'hover:shadow-md hover:shadow-purple-500/10 hover:border-purple-400',
    IN_DISCUSSION: 'hover:shadow-md hover:shadow-amber-500/10 hover:border-amber-400',
    LOGIN_PROGRESS: 'hover:shadow-md hover:shadow-orange-500/10 hover:border-orange-400',
    PAYMENT_DONE: 'hover:shadow-md hover:shadow-emerald-500/10 hover:border-emerald-400',
    LOST: 'hover:shadow-md hover:shadow-rose-500/10 hover:border-rose-400',
  };
  const RING_COLOR: Record<string, string> = {
    OPEN: 'ring-blue-500/20', CONTACTED: 'ring-indigo-500/20', PROPOSAL_SENT: 'ring-purple-500/20',
    IN_DISCUSSION: 'ring-amber-500/20', LOGIN_PROGRESS: 'ring-orange-500/20',
    PAYMENT_DONE: 'ring-emerald-500/20', LOST: 'ring-rose-500/20',
  };

  return (
    <div
      draggable
      onDragStart={e => e.dataTransfer.setData('cardId', card.id)}
      onClick={() => onOpen(card)}
      className={clsx(
        'bg-white rounded-2xl p-4 shadow-sm border border-slate-100 cursor-grab active:cursor-grabbing hover:-translate-y-0.5 transition-[transform,box-shadow,border-color] duration-150 flex flex-col gap-3 group relative overflow-hidden',
        BORDER_TOP[card.stage] ?? 'border-t-4 border-t-slate-300',
        SHADOW_HOVER[card.stage] ?? 'hover:shadow-slate-500/10'
      )}
    >
      <div className="flex items-center justify-between min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className={clsx('h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm ring-4',
            AVATAR_BG[card.stage] ?? 'bg-slate-500', RING_COLOR[card.stage] ?? 'ring-slate-500/20')}>
            {initials}
          </div>
          <span className={clsx('flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[9px] font-bold', hotnessConf.cls)}>
            <HotnessIcon level={hotness} /> {hotnessConf.label}
          </span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white pl-1.5" onClick={e => e.stopPropagation()}>
          <button onClick={() => onEdit(card)} className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-slate-50 transition-colors">
            <Pencil size={11} />
          </button>
          <button onClick={() => onDelete(card)} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-slate-50 transition-colors">
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      <div className="min-w-0">
        <h4 className="text-[13px] font-bold text-slate-900 leading-snug hover:text-blue-600 transition-colors truncate">
          {card.contact?.firstName} {card.contact?.lastName}
        </h4>
        <p className="text-[10px] text-slate-500 font-medium mt-0.5">Created {formattedDate}</p>
      </div>

      <div className="border-t border-slate-100/80 my-0.5" />

      <div className="space-y-1.5 text-xs text-slate-700 font-medium">
        {card.contact?.phone && (
          <div className="flex items-center gap-2">
            <Phone size={12} className="text-slate-500 shrink-0" />
            <span className="truncate">{card.contact.phone}</span>
          </div>
        )}
        {card.contact?.email && (
          <div className="flex items-center gap-2">
            <Mail size={12} className="text-slate-500 shrink-0" />
            <span className="truncate">{card.contact.email}</span>
          </div>
        )}
        <div className="flex items-center gap-2 min-w-0">
          <Shield size={12} className="text-slate-500 shrink-0" />
          <span className="truncate font-semibold text-slate-800">{card.plan?.name || 'No Product'}</span>
        </div>

        {/* Expected Premium in Card View */}
        <div className="flex items-center justify-between bg-emerald-50/80 border border-emerald-200/80 rounded-lg px-2.5 py-1 text-xs font-semibold text-emerald-900 mt-1">
          <span className="text-[11px] text-emerald-700 font-medium">Expected Premium</span>
          <span className="font-bold text-emerald-800 text-xs">
            ₹{Number(card.premiumBudget || card.expectedPremium || 0).toLocaleString('en-IN')}
          </span>
        </div>

        {followUp && (
          <div className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200/60 rounded px-2 py-0.5 w-fit font-bold mt-1">
            <Calendar size={10} className="shrink-0 text-amber-600" />
            <span>Follow-up: {followUp}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-0.5 gap-2" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1 text-slate-500 text-[9px] font-semibold truncate">
          <UserCircle2 size={10} className="text-slate-400 shrink-0" />
          <span className="truncate">{assigneeName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => onCall(card.contact?.phone)}
            className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer" title="Call">
            <Phone size={11} />
          </button>
          <button onClick={() => onWhatsApp(card.contact?.phone)}
            className="p-1.5 rounded-lg bg-green-50 border border-green-200 hover:bg-green-100 text-green-600 cursor-pointer" title="WhatsApp">
            <MessageCircle size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Table Component ───────────────────────────────────────────────────────────
function LeadsTable({ data, loading, visibleColumns, sortKey, sortDir, onSort, onRowClick, onEdit, onDelete, onCall, onWhatsApp, onCreate }: {
  data: any[];
  loading: boolean;
  visibleColumns: Record<string, boolean>;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  onSort: (key: string) => void;
  onRowClick: (r: any) => void;
  onEdit: (r: any) => void;
  onDelete: (r: any) => void;
  onCall: (phone?: string) => void;
  onWhatsApp: (phone?: string) => void;
  onCreate?: () => void;
}) {
  const sortableKeys = ['name', 'plan', 'premiumBudget', 'followUpDate', 'stage'];

  const colDefs = [
    {
      key: 'name', label: 'Client Name',
      render: (r: any) => (
        <div>
          <p className="font-semibold text-gray-900 text-[13px]">{r.contact?.firstName} {r.contact?.lastName}</p>
          <p className="text-[11px] text-gray-400">{r.contact?.phone}</p>
        </div>
      ),
    },
    {
      key: 'plan', label: 'Product',
      render: (r: any) => (
        <div>
          <p className="text-[13px] font-medium text-gray-800">{r.plan?.name ?? '—'}</p>
          {r.plan?.category && <p className="text-[11px] text-gray-400">{r.plan.category}</p>}
        </div>
      ),
    },
    {
      key: 'hotness', label: 'Hotness',
      render: (r: any) => {
        const h = deriveHotness(r);
        const conf = HOTNESS_CONFIG[h];
        return (
          <span className={clsx('flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold w-fit', conf.cls)}>
            <HotnessIcon level={h} /> {conf.label}
          </span>
        );
      },
    },
    {
      key: 'employee', label: 'Assigned To',
      render: (r: any) => {
        const name = r.assignedEmployee?.employeeProfile
          ? `${r.assignedEmployee.employeeProfile.firstName} ${r.assignedEmployee.employeeProfile.lastName}`
          : r.assignedEmployee?.name || '—';
        return (
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
              {name !== '—' ? name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : '—'}
            </div>
            <span className="text-[12px] text-gray-700">{name}</span>
          </div>
        );
      },
    },
    {
      key: 'premiumBudget', label: 'Exp. Premium',
      render: (r: any) => r.premiumBudget
        ? <span className="font-semibold text-slate-800">₹{Number(r.premiumBudget).toLocaleString('en-IN')}</span>
        : <span className="text-gray-400">—</span>,
    },
    {
      key: 'followUpDate', label: 'Next Follow-up',
      render: (r: any) => r.followUpDate ? (
        <div className={clsx('flex items-center gap-1 text-[11px] font-semibold',
          new Date(r.followUpDate) < new Date() ? 'text-red-600' : 'text-amber-700')}>
          <Calendar size={11} />
          {format(new Date(r.followUpDate), 'dd/MMM/yyyy')}
        </div>
      ) : <span className="text-gray-400">—</span>,
    },
    {
      key: 'stage', label: 'Stage',
      render: (r: any) => (
        <span className={clsx('inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-semibold border uppercase tracking-wider', BADGE_STYLES[r.stage])}>
          {STAGE_LABELS[r.stage]}
        </span>
      ),
    },
    {
      key: 'actions', label: '',
      render: (r: any) => (
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <button title="Call" className="p-1 rounded hover:bg-gray-100 text-gray-500" onClick={() => onCall(r.contact?.phone)}><Phone size={13} /></button>
          <button title="WhatsApp" className="p-1 rounded hover:bg-green-50 text-green-500" onClick={() => onWhatsApp(r.contact?.phone)}><MessageCircle size={13} /></button>
          <button title="Edit" className="p-1.5 rounded hover:bg-gray-100 text-gray-500" onClick={() => onEdit(r)}><Pencil size={13} /></button>
          <button title="Delete" className="p-1.5 rounded hover:bg-red-50 text-red-400" onClick={() => onDelete(r)}><Trash2 size={13} /></button>
        </div>
      ),
    },
  ];

  const activeCols = colDefs.filter(c => visibleColumns[c.key] !== false);

  return (
    <div className="overflow-hidden bg-white rounded-2xl border border-slate-100 shadow-sm flex-1">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-100/60 border-b border-slate-200/80">
              {activeCols.map(col => (
                <th key={col.key}
                  onClick={() => sortableKeys.includes(col.key) && onSort(col.key)}
                  className={clsx('px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap select-none',
                    sortableKeys.includes(col.key) && 'cursor-pointer hover:text-slate-900')}>
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortableKeys.includes(col.key) && (
                      <span className="text-slate-400">
                        {sortKey === col.key
                          ? sortDir === 'asc' ? <ChevronUp size={11} className="text-blue-500" /> : <ChevronDown size={11} className="text-blue-500" />
                          : <ArrowUpDown size={11} className="opacity-25" />}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/60">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {activeCols.map(col => (
                    <td key={col.key} className="px-5 py-4">
                      <div className="h-3.5 rounded-full animate-pulse bg-gray-100" style={{ width: `${55 + (i * 13 + col.label.length * 7) % 35}%` }} />
                    </td>
                  ))}
                </tr>
              ))
              : data.length === 0
                ? (
                  <tr>
                    <td colSpan={activeCols.length} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <div className="h-12 w-12 rounded-xl bg-gray-50 flex items-center justify-center border border-slate-100">
                          <Shield size={20} className="text-gray-300" />
                        </div>
                        <p className="text-sm font-medium">No leads found</p>
                        <button onClick={() => onCreate?.()} className="btn-primary py-1 px-3 text-xs mt-1">
                          Create Lead
                        </button>
                      </div>
                    </td>
                  </tr>
                )
                : data.map(row => (
                  <tr key={row.id} onClick={() => onRowClick(row)}
                    className="cursor-pointer hover:bg-blue-50/30 transition-colors duration-150">
                    {activeCols.map(col => (
                      <td key={col.key} className="px-5 py-3.5 text-gray-700 align-middle text-[13px] font-medium">
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Lead Detail Popup ─────────────────────────────────────────────────────────
function LeadDetailPopup({ lead, tab, onTabChange, employees, isOwner, onEdit }: {
  lead: any;
  tab: 'overview' | 'comments' | 'stage';
  onTabChange: (t: 'overview' | 'comments' | 'stage') => void;
  employees: any[];
  isOwner: boolean;
  onEdit: () => void;
}) {
  const qc = useQueryClient();
  const moveStage = useMoveLeadStage();
  const [commentText, setCommentText] = useState('');
  const [followUpEdit, setFollowUpEdit] = useState(lead.followUpDate ? lead.followUpDate.slice(0, 10) : '');
  const [assigneeEdit, setAssigneeEdit] = useState(lead.assignedEmployeeId ?? '');
  const [savingFollowup, setSavingFollowup] = useState(false);

  const { data: fullLeadData, refetch } = useQuery({
    queryKey: ['lead-detail-popup', lead.id],
    queryFn: () => leadsService.get(lead.id),
    staleTime: 0,
  });
  const fullLead = fullLeadData?.data ?? lead;
  const consultations: any[] = fullLead.consultations ?? [];

  const addConsultationMutation = useMutation({
    mutationFn: (notes: string) => leadsService.addConsultation(lead.id, { notes }),
    onSuccess: () => {
      setCommentText('');
      refetch();
      qc.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Comment added');
    },
    onError: () => toast.error('Failed to add comment'),
  });

  const updateAssigneeMutation = useMutation({
    mutationFn: (empId: string | null) => leadsService.updateAssignee(lead.id, empId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Assignee updated');
    },
    onError: () => toast.error('Failed to update assignee'),
  });

  const handleStageChange = async (newStage: string) => {
    await moveStage.mutateAsync({ id: lead.id, stage: newStage });
    toast.success('Stage updated');
    qc.invalidateQueries();
  };

  const handleFollowUpSave = async () => {
    setSavingFollowup(true);
    try {
      await leadsService.update(lead.id, { followUpDate: followUpEdit || null });
      qc.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Follow-up date updated');
    } catch {
      toast.error('Failed to update follow-up date');
    } finally {
      setSavingFollowup(false);
    }
  };

  const c = fullLead.contact;
  const hotness = deriveHotness(fullLead);
  const hotnessConf = HOTNESS_CONFIG[hotness];
  const assigneeName = fullLead.assignedEmployee?.employeeProfile
    ? `${fullLead.assignedEmployee.employeeProfile.firstName} ${fullLead.assignedEmployee.employeeProfile.lastName}`
    : fullLead.assignedEmployee?.name || 'Unassigned';

  const tabs: { id: 'overview' | 'comments' | 'stage'; label: string }[] = [
    { id: 'overview',  label: 'Overview' },
    { id: 'comments',  label: `Comments (${consultations.length})` },
    { id: 'stage',     label: 'Stage & Actions' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-xl p-4 border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-bold">
            {c?.firstName?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">{c?.firstName} {c?.lastName}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={clsx('text-[9px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider', BADGE_STYLES[fullLead.stage] ?? 'bg-gray-100 text-gray-700 border-gray-200')}>
                {STAGE_LABELS[fullLead.stage] ?? fullLead.stage}
              </span>
              <span className={clsx('flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded border font-bold', hotnessConf.cls)}>
                <HotnessIcon level={hotness} /> {hotnessConf.label}
              </span>
              {fullLead.plan && <span className="text-[10px] text-slate-500">• {fullLead.plan.name}</span>}
            </div>
          </div>
        </div>
        <button onClick={onEdit} className="btn-secondary text-xs flex items-center gap-1">
          <Pencil size={12} /> Edit
        </button>
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.id} onClick={() => onTabChange(t.id)}
            className={clsx('px-4 py-2 text-xs font-semibold border-b-2 transition-colors',
              tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-slate-100 rounded-xl p-3 space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Contact</p>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Phone size={13} className="text-slate-400" />
                <span>{c?.phone || '—'}</span>
              </div>
              {c?.email && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Mail size={13} className="text-slate-400" />
                  <span className="truncate">{c.email}</span>
                </div>
              )}
            </div>
            <div className="bg-white border border-slate-100 rounded-xl p-3 space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Lead Info</p>
              {fullLead.premiumBudget && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Expected Premium</span>
                  <span className="font-semibold text-slate-800">₹{Number(fullLead.premiumBudget).toLocaleString('en-IN')}</span>
                </div>
              )}
              {fullLead.sumAssuredRequired && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Sum Assured</span>
                  <span className="font-semibold">₹{Number(fullLead.sumAssuredRequired).toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Assigned To</span>
                <span className="font-medium text-slate-700">{assigneeName}</span>
              </div>
            </div>
          </div>

          {/* Follow-up date editor */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
              <Calendar size={11} /> Next Follow-up Date
            </p>
            <div className="flex items-center gap-2">
              <input type="date" value={followUpEdit} onChange={e => setFollowUpEdit(e.target.value)}
                className="input text-xs flex-1 border-amber-200 bg-white" />
              <button onClick={handleFollowUpSave} disabled={savingFollowup}
                className="btn-primary text-xs px-3 py-1.5 h-auto flex items-center gap-1">
                {savingFollowup ? <RefreshCw size={11} className="animate-spin" /> : 'Update'}
              </button>
            </div>
          </div>

          {/* Reassign (owner only) */}
          {isOwner && (
            <div className="bg-white border border-slate-100 rounded-xl p-3 space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <UserCircle2 size={11} /> Assigned Employee
              </p>
              <div className="flex items-center gap-2">
                <select value={assigneeEdit} onChange={e => setAssigneeEdit(e.target.value)} className="input text-xs flex-1">
                  <option value="">Unassigned</option>
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.userId}>{emp.firstName} {emp.lastName}</option>
                  ))}
                </select>
                <button onClick={() => updateAssigneeMutation.mutate(assigneeEdit || null)}
                  disabled={updateAssigneeMutation.isPending}
                  className="btn-secondary text-xs px-3 py-1.5 h-auto flex items-center gap-1">
                  {updateAssigneeMutation.isPending ? <RefreshCw size={11} className="animate-spin" /> : 'Reassign'}
                </button>
              </div>
            </div>
          )}

          {fullLead.notes && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Notes</p>
              <div className="text-sm bg-gray-50 border border-gray-200 rounded-xl p-3 text-gray-700">{fullLead.notes}</div>
            </div>
          )}
        </div>
      )}

      {/* Comments */}
      {tab === 'comments' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Add a communication note or follow-up remark... (Ctrl+Enter to send)"
              className="input text-xs flex-1 resize-none"
              rows={2}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && commentText.trim()) {
                  addConsultationMutation.mutate(commentText.trim());
                }
              }}
            />
            <button
              onClick={() => commentText.trim() && addConsultationMutation.mutate(commentText.trim())}
              disabled={!commentText.trim() || addConsultationMutation.isPending}
              className="btn-primary px-3 self-end h-8 text-xs flex items-center gap-1"
            >
              {addConsultationMutation.isPending ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
            {consultations.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <MessageCircle size={24} className="mx-auto mb-2 opacity-40" />
                <p className="text-xs">No comments yet. Add one above.</p>
              </div>
            ) : (
              [...consultations].reverse().map((c: any) => (
                <div key={c.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <p className="text-[13px] text-gray-800">{c.notes}</p>
                  {c.scheduledAt && (
                    <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                      <Calendar size={10} /> Scheduled: {format(new Date(c.scheduledAt), 'dd/MMM/yyyy')}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">
                    {c.createdAt ? format(new Date(c.createdAt), 'dd MMM yyyy, hh:mm a') : ''}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Stage */}
      {tab === 'stage' && (
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Move to Stage</p>
            <div className="flex flex-wrap gap-2">
              {UI_STAGES.map(s => {
                const backendStage = STAGE_MAPPINGS[s];
                const isCurrent = BACKEND_TO_UI[fullLead.stage] === s;
                return (
                  <button key={s}
                    onClick={() => !isCurrent && backendStage && handleStageChange(backendStage)}
                    disabled={isCurrent || moveStage.isPending}
                    className={clsx('flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer border',
                      isCurrent ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100 hover:text-gray-700')}>
                    {isCurrent && <ChevronRight size={10} />}
                    {s}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-400 mt-2">Click any stage to move this lead there.</p>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Mark as Lost</p>
            <button
              onClick={() => handleStageChange('LOST')}
              disabled={fullLead.stage === 'LOST' || moveStage.isPending}
              className="text-xs px-3 py-1.5 rounded-full font-medium border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Mark as Lost
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Utility export ─────────────────────────────────────────────────────────────
export function cleanLeadPayload(body: any) {
  const payload: any = { ...body };
  if (payload.sumAssuredRequired === '' || payload.sumAssuredRequired == null) {
    delete payload.sumAssuredRequired;
  } else {
    payload.sumAssuredRequired = Number(payload.sumAssuredRequired);
  }
  if (payload.premiumBudget === '' || payload.premiumBudget == null) {
    delete payload.premiumBudget;
  } else {
    payload.premiumBudget = Number(payload.premiumBudget);
  }
  if (payload.followUpDate === '') {
    payload.followUpDate = null;
  } else if (payload.followUpDate) {
    payload.followUpDate = new Date(payload.followUpDate).toISOString();
  }
  return payload;
}
