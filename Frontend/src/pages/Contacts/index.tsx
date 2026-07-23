import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, Pencil, Trash2, Flame, Heart, Shield, Phone, MessageCircle, Upload, Star, Users,
  Calendar, Award, TrendingUp, Filter, Settings, UserPlus, ChevronDown
} from 'lucide-react';
import { useContacts, useCreateContact, useUpdateContact, useDeleteContact, useUpcomingBirthdays } from '@hooks/useContacts';
import { deletionRequestsService } from '@api/deletionRequestsService';
import { useLookupStore } from '@store/lookup.store';
import { contactsService, policiesService, claimsService } from '@api/index';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import DataTable, { Column } from '@comps/common/DataTable';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, differenceInDays } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useAuthStore } from '@store/auth.store';
import ContactDetailModal from './ContactDetailModal';
import * as XLSX from 'xlsx';

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
  tags: z.string().optional(), // comma-separated, split on submit
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

interface Contact {
  id: string; firstName: string; lastName: string; phone: string; email?: string;
  alternatePhone?: string; gender?: string; dateOfBirth?: string;
  panNumber?: string; aadhaarNumber?: string; annualIncome?: number;
  notes?: string; tags?: string[]; isActive: boolean;
}

export default function Contacts() {
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'contacts' | 'customers' | 'birthdays'>('contacts');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      openCreate();
    }
  }, [searchParams]);
  const [editTarget, setEditTarget] = useState<Contact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [editLeadId, setEditLeadId] = useState<string | null>(null);
  const [editContactId, setEditContactId] = useState<string | null>(null);
  const [loadedContact, setLoadedContact] = useState<any | null>(null);

  // Sorting & Column customisation states
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    name: true,
    phone: true,
    leadStage: true,
    leadStatus: true,
    followUpDate: true,
    assignedTo: true,
    source: true,
    actions: true,
    interests: true,
    stage: true,
    waCampaign: true,
    product: true,
    renewStatus: true,
    renewAssigned: true,
    claimStatus: true,
    claimAssigned: true,
    dateOfBirth: true,
    daysUntil: true,
  });
  const [showColPicker, setShowColPicker] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [filterProducts, setFilterProducts] = useState<string[]>([]);
  const [excludeProduct, setExcludeProduct] = useState(false);
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const { user: authUser } = useAuthStore();
  const [formMedHistory, setFormMedHistory] = useState<string[]>([]);
  const [formRelationships, setFormRelationships] = useState<any[]>([]);
  const [newRelType, setNewRelType] = useState('');
  const [newRelName, setNewRelName] = useState('');
  const [newRelPhone, setNewRelPhone] = useState('');
  const [newRelDob, setNewRelDob] = useState('');
  const [showAddRelForm, setShowAddRelForm] = useState(false);
  
  // Phone Directory import states
  const [dirImportOpen, setDirImportOpen] = useState(false);
  const [dirText, setDirText] = useState('');

  // Customer modal state
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [activeLeadTab, setActiveLeadTab] = useState('Personal');

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
    profileType: 'Lead Profile', // 'Lead Profile' | 'Client Profile'
    leadStatus: 'OPEN',
    interestedIn: ['Health'], // Health, Term, Mutual Funds, Pooling, Other
    leadSource: 'By Agent',
    assignedEmployeeId: '',
    followUpDate: '',
  });

  const [leadComments, setLeadComments] = useState<string[]>([]);
  const [newComment, setNewComment] = useState('');

  // Product Interest Cards state
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

  const removeProductInterest = (id: string) =>
    setProductInterests(prev => prev.filter(c => c.id !== id));

  const updateProductInterest = (id: string, field: keyof ProductInterestCard, value: any) =>
    setProductInterests(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));

  const toggleProductCollapse = (id: string) =>
    setProductInterests(prev => prev.map(c => c.id === id ? { ...c, collapsed: !c.collapsed } : c));

  const addProductComment = (id: string) => {
    const user = useAuthStore.getState().user;
    const author = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'User' : 'User';
    setProductInterests(prev => prev.map(c => {
      if (c.id !== id || !c.newComment.trim()) return c;
      const comment: ProductComment = {
        text: c.newComment.trim(),
        author,
        datetime: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      };
      return { ...c, comments: [...c.comments, comment], newComment: '' };
    }));
  };
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);

  // Family members state
  const [familyMembers, setFamilyMembers] = useState<Array<{
    name: string; dob: string; relation: string;
    whatsapp: string; occupation: string; education: string;
    medicalHistory: string[];
  }>>([]);

  const addFamilyMember = () =>
    setFamilyMembers(prev => [...prev, {
      name: '', dob: '', relation: '',
      whatsapp: '', occupation: '', education: '',
      medicalHistory: []
    }]);

  const updateFamilyMember = (idx: number, field: string, value: any) =>
    setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));

  const toggleMedicalHistory = (idx: number, condition: string) =>
    setFamilyMembers(prev => prev.map((m, i) => {
      if (i !== idx) return m;
      const has = m.medicalHistory.includes(condition);
      return { ...m, medicalHistory: has ? m.medicalHistory.filter(c => c !== condition) : [...m.medicalHistory, condition] };
    }));

  // Policy state — Portfolio (Health/Life) → Entries
  type PolicyItem = {
    company: string; planName: string; policyNo: string;
    startDate: string; duration: string; endDate: string;
    premium: string;
    // Health
    sumInsured: string; deductible: string;
    // Life
    sumAssured: string; maturityDate: string; paymentTerm: string;
    entryType: 'New' | 'Renewal';
  };
  type PolicyPortfolio = { policyType: 'Health' | 'Life'; entries: PolicyItem[] };
  const [policies, setPolicies] = useState<PolicyPortfolio[]>([]);

  const newPolicyItem = (): PolicyItem => ({
    company: '', planName: '', policyNo: '',
    startDate: '', duration: '1 Year', endDate: '',
    premium: '', sumInsured: '', deductible: '',
    sumAssured: '', maturityDate: '', paymentTerm: '',
    entryType: 'New'
  });

  const addPolicy = (policyType: 'Health' | 'Life') =>
    setPolicies(prev => [...prev, { policyType, entries: [newPolicyItem()] }]);

  const addPolicyEntry = (pIdx: number) =>
    setPolicies(prev => prev.map((p, i) => i === pIdx ? { ...p, entries: [...p.entries, newPolicyItem()] } : p));

  const removePolicyEntry = (pIdx: number, eIdx: number) =>
    setPolicies(prev => prev.map((p, i) => {
      if (i !== pIdx) return p;
      const entries = p.entries.filter((_, j) => j !== eIdx);
      return entries.length === 0 ? null : { ...p, entries };
    }).filter(Boolean) as PolicyPortfolio[]);

  const updatePolicyItem = (pIdx: number, eIdx: number, field: string, value: string) =>
    setPolicies(prev => prev.map((p, i) => i !== pIdx ? p : {
      ...p,
      entries: p.entries.map((e, j) => j !== eIdx ? e : { ...e, [field]: value })
    }));

  // Fetch employees lookup to map assignee name
  const { employees, plans: dbPlans } = useLookupStore();

  const { data: contactsRes, isLoading: contactsLoading } = useContacts({
    page,
    limit: 50,
    search: search || undefined
  });

  const { data: birthdayRes, isLoading: birthdayLoading } = useUpcomingBirthdays(30, activeTab === 'birthdays');
  const birthdayList = birthdayRes?.data ?? [];

  // Query plans for Lead creation Policy tab (using empty/mock variables to satisfy compilation)
  const leadPlansList: any[] = [];

  // Fetch policies & claims for customer tab enrichment
  const { data: policiesRes } = useQuery({
    queryKey: ['contacts-policies-list'],
    queryFn: () => policiesService.list({ limit: 200, sortBy: 'createdAt', sortOrder: 'desc' }),
    enabled: activeTab === 'customers',
    staleTime: 60_000,
  });

  const { data: claimsRes } = useQuery({
    queryKey: ['contacts-claims-list'],
    queryFn: () => claimsService.list({ limit: 200, sortBy: 'createdAt', sortOrder: 'desc' }),
    enabled: activeTab === 'customers',
    staleTime: 60_000,
  });

  // Build contactId → [policies] and contactId → [claims] maps for O(1) lookups
  const policyMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    (policiesRes?.data ?? []).forEach((p: any) => {
      if (!map[p.contactId]) map[p.contactId] = [];
      map[p.contactId].push(p);
    });
    return map;
  }, [policiesRes]);

  const claimMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    (claimsRes?.data ?? []).forEach((c: any) => {
      if (!map[c.contactId]) map[c.contactId] = [];
      map[c.contactId].push(c);
    });
    return map;
  }, [claimsRes]);

  // Log Interaction state
  const [interactionModalOpen, setInteractionModalOpen] = useState(false);
  const [interactionTarget, setInteractionTarget] = useState<any | null>(null);

  const [interactionFields, setInteractionFields] = useState({
    interactionType: 'Call',
    leadStage: 'To Contact',
    leadStatus: 'Interested',
    leadType: 'New',
    nextFollowUp: '',
    notes: '',
  });

  const { data: activityRes, isLoading: activityLoading } = useQuery({
    queryKey: ['contact-activity', interactionTarget?.id],
    queryFn: () => contactsService.activity(interactionTarget.id, { page: 1, limit: 100 }),
    enabled: !!interactionTarget?.id,
  });

  const logInteractionMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => contactsService.logInteraction(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      if (interactionTarget?.id) {
        qc.invalidateQueries({ queryKey: ['contact-activity', interactionTarget.id] });
      }
      toast.success('Interaction logged successfully');
      setInteractionModalOpen(false);
      setInteractionTarget(null);
      setInteractionFields({
        interactionType: 'Call',
        leadStage: 'To Contact',
        leadStatus: 'Interested',
        leadType: 'New',
        nextFollowUp: '',
        notes: '',
      });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to log interaction');
    }
  });

  const openLogInteraction = (contact: any) => {
    setInteractionTarget(contact);
    setInteractionFields({
      interactionType: 'Call',
      leadStage: contact.leadStage || 'To Contact',
      leadStatus: contact.leadStatus || 'Interested',
      leadType: contact.leadType || 'New',
      nextFollowUp: contact.followUpDate ? contact.followUpDate.split('T')[0] : '',
      notes: '',
    });
    setInteractionModalOpen(true);
  };

  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  const deleteRelationshipMutation = useMutation({
    mutationFn: (relId: string) => contactsService.removeRelationship(editTarget?.id!, relId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Relationship removed');
    },
    onError: () => toast.error('Failed to remove relationship'),
  });

  const openCustomerCreate = () => {
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
    const curEmp = employees.find(e => e.userId === currentUser?.id || e.id === currentUser?.id);

    setLeadInfoFields({
      profileType: 'Client Profile',
      leadStatus: 'OPEN',
      interestedIn: ['Health'],
      leadSource: 'By Agent',
      assignedEmployeeId: curEmp?.userId || currentUser?.id || '',
      followUpDate: '',
    });
    setLeadComments([]);
    setNewComment('');
    setProductInterests([]);
    setFamilyMembers([]);
    setPolicies([]);
    setSelectedCampaigns([]);
    setEditContactId(null);
    setActiveLeadTab('Personal');
    setLeadModalOpen(true);
  };

  const openLeadEdit = async (leadOrContact: any) => {
    const contactId = leadOrContact.contactId || leadOrContact.id;
    const leadId = leadOrContact.contactId ? leadOrContact.id : (leadOrContact.productInterests?.[0]?.id || null);

    const toastId = toast.loading('Loading lead data...');
    try {
      const res = await contactsService.get(contactId);
      const contact = res.data;
      setLoadedContact(contact);

      const primaryAddr = contact.addresses?.find((a: any) => a.isPrimary) || contact.addresses?.[0];
      const primaryOcc = contact.occupations?.find((o: any) => o.isPrimary) || contact.occupations?.[0];

      setPersonalFields({
        fullName: `${contact.firstName} ${contact.lastName}`.trim(),
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

      const lead = contact.productInterests?.[0] || (leadOrContact.contactId ? leadOrContact : null);
      setLeadInfoFields({
        profileType: activeTab === 'customers' ? 'Client Profile' : 'Lead Profile',
        leadStatus: lead?.stage || 'OPEN',
        interestedIn: lead?.interests || ['Health'],
        leadSource: lead?.source || 'By Agent',
        assignedEmployeeId: lead?.assignedEmployeeId || '',
        followUpDate: lead?.followUpDate ? lead.followUpDate.split('T')[0] : '',
      });

      const comments = lead?.notes ? lead.notes.split('\n') : [];
      setLeadComments(comments);
      setNewComment('');

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

      setEditLeadId(lead?.id || null);
      setEditContactId(contactId);
      setLeadModalOpen(true);
    } catch (err) {
      toast.error('Failed to load lead details', { id: toastId });
    }
  };

  const closeLeadModal = () => {
    setLeadModalOpen(false);
    setLoadedContact(null);
  };

  const handleLeadSubmit = async (e: React.FormEvent, shouldClose: boolean) => {
    e.preventDefault();
    if (!personalFields.fullName.trim()) {
      toast.error('Full Name is required');
      return;
    }
    if (!personalFields.whatsappNumber.trim()) {
      toast.error('Whatsapp Number is required');
      return;
    }

    const toastId = toast.loading(editContactId ? 'Updating lead...' : 'Creating lead...');
    try {
      const parts = personalFields.fullName.trim().split(/\s+/);
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';

      const mergedTags = [...selectedCampaigns];
      const isCustomerTarget = activeTab === 'customers' || leadInfoFields.profileType === 'Client Profile' || leadInfoFields.profileType === 'Customer Profile';
      if (isCustomerTarget) {
        if (!mergedTags.includes('customer')) {
          mergedTags.push('customer');
        }
      } else {
        if (!mergedTags.includes('contact')) {
          mergedTags.push('contact');
        }
        const custIdx = mergedTags.indexOf('customer');
        if (custIdx !== -1) {
          mergedTags.splice(custIdx, 1);
        }
      }

      let contactId = editContactId;
      if (editContactId) {
        await contactsService.update(editContactId, {
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
        });
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
              planId: matchedPlan?.id || '6a3d0584d431b55e6b6e74fe', // fallback ID if plans empty
              sumAssured: Number(entry.sumAssured || entry.sumInsured || 100000),
              premiumAmount: Number(entry.premium || 1000),
              paymentFrequency: 'YEARLY',
              startDate: entry.startDate?.trim() ? new Date(entry.startDate).toISOString() : new Date().toISOString(),
              endDate: entry.endDate?.trim() ? new Date(entry.endDate).toISOString() : new Date(Date.now() + 365 * 86400000).toISOString(),
            }).catch(polErr => console.error('Failed to save policy:', polErr))
          );
        }
      }

      // Await all sub-resource updates concurrently
      await Promise.all(subResourcePromises);

      toast.success(editContactId ? 'Customer successfully updated!' : 'Customer successfully created!', { id: toastId });
      qc.invalidateQueries({ queryKey: ['contacts'] });

      if (shouldClose) {
        setLeadModalOpen(false);
      } else {
        openCustomerCreate();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to save customer', { id: toastId });
    }
  };

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  const getEmployeeName = (id?: string | null) => {
    if (!id) return '—';
    const emp = employees.find(e => e.id === id || e.userId === id);
    if (!emp) return id;
    return `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim() || emp.name || id;
  };

  const toggleFilter = (filter: string) => {
    setSelectedFilters(prev =>
      prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
    );
  };

  const openCreate = () => {
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
    const curEmp = employees.find(e => e.userId === currentUser?.id || e.id === currentUser?.id);

    setLeadInfoFields({
      profileType: 'Contact Profile',
      leadStatus: 'OPEN',
      interestedIn: ['Health'],
      leadSource: 'By Agent',
      assignedEmployeeId: curEmp?.userId || currentUser?.id || '',
      followUpDate: '',
    });
    setLeadComments([]);
    setNewComment('');
    setProductInterests([]);
    setFamilyMembers([]);
    setPolicies([]);
    setSelectedCampaigns([]);
    setEditContactId(null);
    setActiveLeadTab('Personal');
    setLeadModalOpen(true);
  };

  const openEdit = async (contactOrId: any) => {
    const contactId = typeof contactOrId === 'string' ? contactOrId : (contactOrId.contactId || contactOrId.id);
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
        profileType: activeTab === 'customers' ? 'Client Profile' : 'Contact Profile',
        leadStatus: 'OPEN',
        interestedIn: ['Health'],
        leadSource: contact.source || 'By Agent',
        assignedEmployeeId: contact.assignedEmployeeId || '',
        followUpDate: '',
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

      setEditContactId(contactId);
      setActiveLeadTab('Personal');
      setLeadModalOpen(true);
      toast.dismiss(toastId);
    } catch (err) {
      toast.error('Failed to load contact details', { id: toastId });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const isAdmin = authUser?.role === 'OWNER' || authUser?.role === 'SUPERADMIN';
    if (isAdmin) {
      await deleteContact.mutateAsync(deleteTarget.id);
    } else {
      const toastId = toast.loading('Submitting delete request to admin...');
      try {
        await deletionRequestsService.requestDeletion('Contact', deleteTarget.id, `Employee requested deletion of contact`);
        toast.success('Deletion request submitted to admin successfully!', { id: toastId });
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Failed to submit request', { id: toastId });
      }
    }
    setDeleteTarget(null);
  };

  // Local filtering on paginated records based on quick filters
  const filteredData = useMemo(() => {
    const list = activeTab === 'birthdays'
      ? (birthdayRes?.data ?? [])
      : (contactsRes?.data || []);

    return list.filter((item: any) => {
      // Date range filtering
      if (dateFrom && item.createdAt) {
        const itemDate = new Date(item.createdAt);
        const fromDate = new Date(dateFrom);
        if (itemDate < fromDate) return false;
      }
      if (dateTo && item.createdAt) {
        const itemDate = new Date(item.createdAt);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (itemDate > toDate) return false;
      }

      // Product Category Quick & Advanced Multi-Select Filter
      if (filterProducts.length > 0) {
        const contactPolicies = (policyMap[item.id] && policyMap[item.id].length > 0)
          ? policyMap[item.id]
          : (item.policies || []);

        const itemTags: string[] = item.tags || item.contact?.tags || [];

        const matchesProduct = filterProducts.some(fp => {
          const filterLower = fp.toLowerCase();
          const hasProductPolicy = contactPolicies.some((p: any) => {
            const cat = (p.plan?.category || p.category || p.plan?.type || '').toUpperCase();
            const name = (p.plan?.name || p.policyNumber || '').toLowerCase();
            return cat === fp || cat.includes(fp) || name.includes(filterLower);
          });

          const hasProductInterest =
            (item.interests && item.interests.some((i: string) => i.toUpperCase() === fp || i.toLowerCase().includes(filterLower))) ||
            (item.productInterests && item.productInterests.some((pi: any) => (pi.interests || []).some((i: string) => i.toUpperCase() === fp))) ||
            item.plan?.category === fp ||
            itemTags.some((t: string) => t.toLowerCase() === filterLower || t.toLowerCase().includes(filterLower));

          return hasProductPolicy || hasProductInterest;
        });

        const ok = excludeProduct ? !matchesProduct : matchesProduct;
        if (!ok) return false;
      }

      const tags = item.tags || item.contact?.tags || [];
      const hasTag = (tag: string) => tags.some((t: string) => t.toLowerCase() === tag.toLowerCase());

      const isCustomer = (item.policies && item.policies.length > 0) || hasTag('customer') || (policyMap[item.id]?.length > 0);

      if (activeTab === 'contacts') {
        if (isCustomer) return false;
        if (selectedFilters.includes('Active') && !item.isActive) return false;
        if (selectedFilters.includes('Inactive') && item.isActive) return false;
      } else if (activeTab === 'customers') {
        // Customer tab filters
        if (!isCustomer) return false;

        const contactPolicies = policyMap[item.id] ?? [];
        const contactClaims = claimMap[item.id] ?? [];

        if (selectedFilters.includes('Renew Due')) {
          const hasDue = contactPolicies.some((p: any) =>
            p.status === 'ACTIVE' && p.endDate && new Date(p.endDate) <= new Date(Date.now() + 30 * 86400000)
          );
          if (!hasDue) return false;
        }
        if (selectedFilters.includes('Active Claim')) {
          const hasActive = contactClaims.some((c: any) =>
            ['INTIMATED', 'FILED', 'IN_REVIEW'].includes(c.status)
          );
          if (!hasActive) return false;
        }
        if (selectedFilters.includes('Health')) {
          const ok = hasTag('health') ||
            contactPolicies.some((p: any) =>
              p.plan?.category?.toLowerCase().includes('health') ||
              p.plan?.name?.toLowerCase().includes('health')
            );
          if (!ok) return false;
        }
        if (selectedFilters.includes('Term')) {
          const ok = hasTag('term') ||
            contactPolicies.some((p: any) =>
              p.plan?.category?.toLowerCase().includes('term') ||
              p.plan?.name?.toLowerCase().includes('term')
            );
          if (!ok) return false;
        }
      }
      return true;
    });
  }, [activeTab, contactsRes, birthdayRes, selectedFilters, policyMap, claimMap, dateFrom, dateTo, filterProducts, excludeProduct]);

  // Client-side Sorting Memo
  const sortedAndFilteredData = useMemo(() => {
    let result = [...filteredData];
    if (sortKey) {
      result.sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];

        if (sortKey === 'name') {
          valA = `${a.firstName || a.contact?.firstName || ''} ${a.lastName || a.contact?.lastName || ''}`.toLowerCase();
          valB = `${b.firstName || b.contact?.firstName || ''} ${b.lastName || b.contact?.lastName || ''}`.toLowerCase();
        } else if (sortKey === 'phone') {
          valA = (a.phone || a.contact?.phone || '').toLowerCase();
          valB = (b.phone || b.contact?.phone || '').toLowerCase();
        } else if (sortKey === 'product') {
          const pA = policyMap[a.id] ?? [];
          const pB = policyMap[b.id] ?? [];
          valA = pA.map((p: any) => p.plan?.category || p.plan?.name).join(', ').toLowerCase();
          valB = pB.map((p: any) => p.plan?.category || p.plan?.name).join(', ').toLowerCase();
        } else if (sortKey === 'assignedTo') {
          valA = getEmployeeName(a.assignedEmployeeId).toLowerCase();
          valB = getEmployeeName(b.assignedEmployeeId).toLowerCase();
        } else if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = (valB || '').toLowerCase();
        }

        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;

        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [filteredData, sortKey, sortDir, policyMap]);

  // Contact Table Columns
  const CONTACT_COLS: Column<any>[] = [
    {
      key: 'id',
      label: 'CONTACT ID',
      sortable: true,
      render: r => {
        const cid = r.contactId || r.id;
        const shortId = cid ? `#${cid.substring(cid.length - 4).toUpperCase()}` : '—';
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedDetailId(cid);
              setDetailModalOpen(true);
            }}
            className="px-2 py-1 rounded-lg bg-slate-100/90 text-blue-600 hover:bg-blue-600 hover:text-white font-mono font-extrabold text-xs transition-all shadow-2xs border border-slate-200/80 cursor-pointer"
          >
            {shortId}
          </button>
        );
      }
    },
    {
      key: 'name',
      label: 'NAME',
      sortable: true,
      render: r => {
        const initials = `${r.firstName?.[0] || ''}${r.lastName?.[0] || ''}`.toUpperCase() || 'C';
        return (
          <div className="flex items-center gap-3 py-0.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shadow-xs shrink-0 border border-white/20">
              {initials}
            </div>
            <div>
              <div className="font-extrabold text-slate-900 text-xs hover:text-blue-600 transition-colors">{r.firstName} {r.lastName}</div>
              <div className="text-[11px] font-medium text-slate-400">{r.phone || '—'}</div>
            </div>
          </div>
        );
      }
    },
    {
      key: 'phone',
      label: 'PHONE',
      sortable: true,
      render: r => <span className="text-slate-700 text-xs font-bold">{r.phone || '—'}</span>
    },
    {
      key: 'leadStage',
      label: 'LEAD STAGE',
      sortable: true,
      render: r => {
        const stageColors: Record<string, string> = {
          'To Contact': 'bg-slate-100 text-slate-700 border-slate-200',
          'Contacted': 'bg-blue-50 text-blue-700 border-blue-200/60',
          'Proposal Sent': 'bg-purple-50 text-purple-700 border-purple-200/60',
          'Login in Progress': 'bg-amber-50 text-amber-700 border-amber-200/60',
          'Payment Done': 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
        };
        const cls = stageColors[r.leadStage] || 'bg-slate-50 text-slate-500 border-slate-200';
        return (
          <span className={clsx(cls, 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border shadow-2xs')}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {r.leadStage || '—'}
          </span>
        );
      }
    },
    {
      key: 'leadStatus',
      label: 'LEAD STATUS',
      sortable: true,
      render: r => {
        const statusColors: Record<string, string> = {
          'Interested': 'bg-teal-50 text-teal-700 border-teal-200/60',
          'Not Interested': 'bg-rose-50 text-rose-700 border-rose-200/60',
          'Hot': 'bg-orange-50 text-orange-700 border-orange-200/60 font-black animate-pulse',
          'Very Hot': 'bg-red-50 text-red-700 border-red-200/60 font-black animate-bounce',
        };
        const cls = statusColors[r.leadStatus] || 'bg-slate-50 text-slate-500 border-slate-200';
        return (
          <span className={clsx(cls, 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border shadow-2xs')}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {r.leadStatus || '—'}
          </span>
        );
      }
    },
    {
      key: 'followUpDate',
      label: 'NEXT FOLLOW-UP',
      sortable: true,
      render: r => <span className="text-slate-600 text-xs font-semibold">{r.followUpDate ? format(new Date(r.followUpDate), 'dd/MM/yyyy') : '—'}</span>
    },
    {
      key: 'assignedTo',
      label: 'ASSIGNED EMPLOYEE',
      sortable: true,
      render: r => <span className="text-slate-700 text-xs font-bold">{getEmployeeName(r.assignedEmployeeId)}</span>
    },
    {
      key: 'source',
      label: 'SOURCE',
      sortable: true,
      render: r => <span className="text-slate-600 text-xs font-bold capitalize bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">{r.source || '—'}</span>
    },
    {
      key: 'actions',
      label: 'ACTIONS',
      render: r => {
        return (
          <div className="flex gap-1.5 justify-start items-center" onClick={e => e.stopPropagation()}>
            <a
              href={`https://wa.me/${r.phone?.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 hover:bg-emerald-600 hover:text-white transition-all shadow-2xs hover:scale-105"
              title="WhatsApp"
            >
              <MessageCircle size={14} />
            </a>
            <a
              href={`tel:${r.phone}`}
              className="p-1.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 hover:bg-blue-600 hover:text-white transition-all shadow-2xs hover:scale-105"
              title="Call"
            >
              <Phone size={14} />
            </a>
            <button
              onClick={() => openEdit(r)}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-blue-600 cursor-pointer transition-all hover:scale-105"
              title="Edit"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => setDeleteTarget(r)}
              className="p-1.5 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 cursor-pointer transition-all hover:scale-105"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      }
    }
  ];

  // Customer Columns
  const CUSTOMER_COLS: Column<any>[] = [
    {
      key: 'id',
      label: 'CONTACT ID',
      sortable: true,
      render: r => {
        const cid = r.contactId || r.id;
        const shortId = cid ? `#${cid.substring(cid.length - 4).toUpperCase()}` : '—';
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEdit(r);
            }}
            className="px-2 py-1 rounded-lg bg-slate-100/90 text-blue-600 hover:bg-blue-600 hover:text-white font-mono font-extrabold text-xs transition-all shadow-2xs border border-slate-200/80 cursor-pointer"
          >
            {shortId}
          </button>
        );
      }
    },
    {
      key: 'name',
      label: 'NAME',
      sortable: true,
      render: r => {
        const initials = `${r.firstName?.[0] || ''}${r.lastName?.[0] || ''}`.toUpperCase() || 'C';
        return (
          <div className="flex items-center gap-3 py-0.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white font-extrabold text-xs flex items-center justify-center shadow-xs shrink-0 border border-white/20">
              {initials}
            </div>
            <div>
              <div className="font-extrabold text-slate-900 text-xs hover:text-blue-600 transition-colors">{r.firstName} {r.lastName}</div>
              <div className="text-[11px] font-medium text-slate-400">{r.phone}</div>
            </div>
          </div>
        );
      }
    },
    {
      key: 'product',
      label: 'PRODUCT',
      sortable: true,
      render: r => {
        const policies = policyMap[r.id] ?? [];
        if (policies.length === 0) return <span className="text-slate-400 text-xs">—</span>;
        const cats = [...new Set(policies.map((p: any) =>
          p.plan?.category
            ? p.plan.category.charAt(0).toUpperCase() + p.plan.category.slice(1).toLowerCase()
            : p.plan?.name
        ).filter(Boolean))];
        return (
          <div className="flex gap-1 flex-wrap">
            {cats.map((cat: string) => (
              <span key={cat} className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60 text-[10px] font-extrabold shadow-2xs">
                {cat}
              </span>
            ))}
          </div>
        );
      }
    },
    {
      key: 'renewStatus',
      label: 'RENEW STATUS',
      sortable: true,
      render: r => {
        const policies = policyMap[r.id] ?? [];
        const active = policies.filter((p: any) => p.status === 'ACTIVE');
        if (active.length === 0) return <span className="text-slate-400 text-xs">—</span>;
        const due = active.some((p: any) =>
          p.endDate && new Date(p.endDate) <= new Date(Date.now() + 30 * 86400000)
        );
        return due ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold text-[10px] uppercase tracking-wider shadow-xs shadow-orange-500/20 border border-orange-400">
            <Flame size={11} /> Due
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-extrabold text-[10px] uppercase tracking-wider shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> OK
          </span>
        );
      }
    },
    {
      key: 'renewAssigned',
      label: 'RENEW ASSIGNED',
      sortable: true,
      render: r => {
        const policies = policyMap[r.id] ?? [];
        const active = policies.find((p: any) => p.status === 'ACTIVE' && p.assignedEmployeeId);
        return <span className="text-blue-600 text-xs font-bold">{active ? getEmployeeName(active.assignedEmployeeId) : '—'}</span>;
      }
    },
    {
      key: 'claimStatus',
      label: 'CLAIM STATUS',
      sortable: true,
      render: r => {
        const claims = claimMap[r.id] ?? [];
        if (claims.length === 0) return <span className="text-slate-400 text-xs">—</span>;
        const active = claims.find((c: any) => ['INTIMATED', 'FILED', 'IN_REVIEW'].includes(c.status));
        if (active) {
          const CLAIM_LABELS: Record<string, string> = {
            INTIMATED: 'Intimated', FILED: 'Filed', IN_REVIEW: 'In Review',
          };
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60 font-extrabold text-[10px] uppercase tracking-wider shadow-2xs">
              <Star size={11} className="text-amber-500" /> {CLAIM_LABELS[active.status] ?? active.status}
            </span>
          );
        }
        return <span className="text-slate-400 text-xs">—</span>;
      }
    },
    {
      key: 'claimAssigned',
      label: 'CLAIM ASSIGNED',
      sortable: true,
      render: r => {
        const claims = claimMap[r.id] ?? [];
        const active = claims.find((c: any) =>
          ['INTIMATED', 'FILED', 'IN_REVIEW'].includes(c.status) && c.assignedEmployeeId
        );
        return <span className="text-slate-600 text-xs font-bold">{active ? getEmployeeName(active.assignedEmployeeId) : '—'}</span>;
      }
    },
    {
      key: 'waCampaign',
      label: 'WA CAMPAIGN',
      render: r => {
        const campaigns = r.tags?.filter((t: string) => [
          'Health Awareness',
          'New Year Offer',
          'Pension Plan',
          'Monsoon Safety',
          'Term Insurance Promo',
          'Family Health Package'
        ].includes(t)) || [];
        return <span className="text-slate-600 text-xs font-semibold">{campaigns.join(', ') || '—'}</span>;
      }
    },
    {
      key: 'actions',
      label: 'ACTIONS',
      render: r => (
        <div className="flex gap-1.5 justify-start items-center" onClick={e => e.stopPropagation()}>
          <a
            href={`https://wa.me/${r.phone?.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 hover:bg-emerald-600 hover:text-white transition-all shadow-2xs hover:scale-105"
            title="WhatsApp"
          >
            <MessageCircle size={14} />
          </a>
          <a
            href={`tel:${r.phone}`}
            className="p-1.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 hover:bg-blue-600 hover:text-white transition-all shadow-2xs hover:scale-105"
            title="Call"
          >
            <Phone size={14} />
          </a>
          <button
            onClick={() => openEdit(r)}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-blue-600 cursor-pointer transition-all hover:scale-105"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setDeleteTarget(r)}
            className="p-1.5 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 cursor-pointer transition-all hover:scale-105"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ];

  // Birthday Columns
  const BIRTHDAY_COLS: Column<any>[] = [
    {
      key: 'id',
      label: 'CONTACT ID',
      sortable: true,
      render: r => {
        const cid = r.contactId || r.id;
        const shortId = cid ? `#${cid.substring(cid.length - 4).toUpperCase()}` : '—';
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedDetailId(cid);
              setDetailModalOpen(true);
            }}
            className="px-2 py-1 rounded-lg bg-slate-100/90 text-blue-600 hover:bg-blue-600 hover:text-white font-mono font-extrabold text-xs transition-all shadow-2xs border border-slate-200/80 cursor-pointer"
          >
            {shortId}
          </button>
        );
      }
    },
    {
      key: 'name',
      label: 'NAME',
      sortable: true,
      render: r => {
        const initials = `${r.firstName?.[0] || ''}${r.lastName?.[0] || ''}`.toUpperCase() || 'C';
        return (
          <div className="flex items-center gap-3 py-0.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shadow-xs shrink-0 border border-white/20">
              {initials}
            </div>
            <div className="font-extrabold text-slate-900 text-xs">{r.firstName} {r.lastName}</div>
          </div>
        );
      }
    },
    {
      key: 'phone',
      label: 'PHONE',
      sortable: true,
      render: r => <span className="text-slate-700 text-xs font-bold">{r.phone || '—'}</span>
    },
    {
      key: 'dateOfBirth',
      label: 'DATE OF BIRTH',
      sortable: true,
      render: r => <span className="text-slate-600 text-xs font-semibold">{r.dateOfBirth ? format(new Date(r.dateOfBirth), 'dd/MMM/yyyy') : '—'}</span>
    },
    {
      key: 'daysUntil',
      label: 'DAYS UNTIL BIRTHDAY',
      render: r => {
        if (!r.dateOfBirth) return '—';
        const dob = new Date(r.dateOfBirth);
        const today = new Date();
        const nextBday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
        if (nextBday < today) {
          nextBday.setFullYear(today.getFullYear() + 1);
        }
        const diff = differenceInDays(nextBday, today);
        return (
          <span className={clsx(
            "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border shadow-2xs",
            diff === 0 ? "bg-gradient-to-r from-rose-600 to-red-600 text-white border-rose-600 shadow-rose-500/25 animate-pulse" :
            diff <= 7 ? "bg-amber-50 text-amber-700 border-amber-200/80" : "bg-blue-50 text-blue-700 border-blue-200/80"
          )}>
            {diff === 0 ? 'Today! 🎂' : `${diff} days`}
          </span>
        );
      }
    },
    {
      key: 'actions',
      label: 'ACTIONS',
      render: r => (
        <div className="flex gap-1.5 justify-start items-center" onClick={e => e.stopPropagation()}>
          <a
            href={`https://wa.me/${r.phone?.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 hover:bg-emerald-600 hover:text-white transition-all shadow-2xs hover:scale-105"
            title="WhatsApp"
          >
            <MessageCircle size={14} />
          </a>
          <a
            href={`tel:${r.phone}`}
            className="p-1.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 hover:bg-blue-600 hover:text-white transition-all shadow-2xs hover:scale-105"
            title="Call"
          >
            <Phone size={14} />
          </a>
        </div>
      )
    }
  ];

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const toastId = toast.loading('Importing contacts…');
    try {
      let fileToUpload: File = file;
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      if (isExcel) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const csvContent = XLSX.utils.sheet_to_csv(worksheet);
        fileToUpload = new File([csvContent], file.name.replace(/\.[^/.]+$/, ".csv"), { type: 'text/csv' });
      }

      const res = await contactsService.importCsv(fileToUpload);
      toast.success(res.message || 'Contacts imported successfully!', { id: toastId });
      qc.invalidateQueries({ queryKey: ['contacts'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to import contacts', { id: toastId });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const activeCols = useMemo(() => {
    const cols = activeTab === 'birthdays'
      ? BIRTHDAY_COLS
      : activeTab === 'customers'
      ? CUSTOMER_COLS
      : CONTACT_COLS;
    return cols.filter(c => visibleColumns[String(c.key)] !== false);
  }, [activeTab, visibleColumns, CUSTOMER_COLS, CONTACT_COLS, BIRTHDAY_COLS]);

  return (
    <div className="space-y-4 font-sans text-slate-800">
      {/* Hidden file input for CSV import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={handleImport}
      />

      {/* Floating Right Action Panel (Import CSV, Import Directory & Add Buttons) */}
      <div className="fixed right-5 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-3 bg-white/90 backdrop-blur-xl p-2 rounded-2xl shadow-2xl border border-slate-200/80 animate-fadeIn">
        {/* Import CSV */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white flex items-center justify-center transition-all hover:scale-105 shadow-md shadow-emerald-500/25 cursor-pointer group relative"
          title={activeTab === 'customers' ? 'Import Customer' : 'Import Contact'}
        >
          <Upload size={18} strokeWidth={2.2} />
          <span className="absolute right-full mr-3 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl border border-slate-800">
            {activeTab === 'customers' ? 'Import Customer CSV' : 'Import Contact CSV'}
          </span>
        </button>

        {/* Import Directory */}
        <button
          type="button"
          onClick={() => setDirImportOpen(true)}
          className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white flex items-center justify-center transition-all hover:scale-105 shadow-md shadow-purple-500/25 cursor-pointer group relative"
          title="Import Phone Directory"
        >
          <Users size={18} strokeWidth={2.2} />
          <span className="absolute right-full mr-3 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl border border-slate-800">
            Import Phone Directory
          </span>
        </button>

        {/* Add Contact / Customer */}
        {activeTab !== 'birthdays' && (
          <button
            type="button"
            onClick={activeTab === 'customers' ? openCustomerCreate : openCreate}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center justify-center transition-all hover:scale-105 shadow-lg shadow-blue-500/30 cursor-pointer group relative"
            title={activeTab === 'customers' ? 'Add Customer' : 'Add Contact'}
          >
            <UserPlus size={18} strokeWidth={2.2} />
            <span className="absolute right-full mr-3 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl border border-slate-800">
              {activeTab === 'customers' ? 'Add Customer' : 'Add Contact'}
            </span>
          </button>
        )}
      </div>

      {/* Main Control Hub Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-4">
        {/* Top Row: Segmented Navigation & Stats */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          {/* Segmented Tab Controls */}
          <div className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 self-start">
            <button
              onClick={() => { setActiveTab('contacts'); setPage(1); setSelectedFilters([]); }}
              className={clsx(
                'px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2',
                activeTab === 'contacts'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              )}
            >
              <Users size={14} /> Contacts
            </button>
            <button
              onClick={() => { setActiveTab('customers'); setPage(1); setSelectedFilters([]); }}
              className={clsx(
                'px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2',
                activeTab === 'customers'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              )}
            >
              <Award size={14} /> Customers
            </button>
            <button
              onClick={() => { setActiveTab('birthdays'); setPage(1); setSelectedFilters([]); }}
              className={clsx(
                'px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2',
                activeTab === 'birthdays'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              )}
            >
              <Calendar size={14} /> Upcoming Birthdays
            </button>
          </div>

          {/* Quick Context-Aware Filter Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {activeTab === 'contacts' && (
              <>
                <button
                  type="button"
                  onClick={() => toggleFilter('Active')}
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs',
                    selectedFilters.includes('Active')
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-500/20'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Active
                </button>
                <button
                  type="button"
                  onClick={() => toggleFilter('Inactive')}
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs',
                    selectedFilters.includes('Inactive')
                      ? 'bg-rose-600 text-white border-rose-600 shadow-rose-500/20'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-400" /> Inactive
                </button>
              </>
            )}
            {activeTab === 'customers' && (
              <>
                <button
                  type="button"
                  onClick={() => toggleFilter('Renew Due')}
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs',
                    selectedFilters.includes('Renew Due')
                      ? 'bg-orange-500 text-white border-orange-500 shadow-orange-500/20'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <Flame size={13} className={selectedFilters.includes('Renew Due') ? 'text-white' : 'text-orange-500'} /> Renew Due
                </button>
                <button
                  type="button"
                  onClick={() => toggleFilter('Active Claim')}
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs',
                    selectedFilters.includes('Active Claim')
                      ? 'bg-amber-500 text-white border-amber-500 shadow-amber-500/20'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <Star size={13} className={selectedFilters.includes('Active Claim') ? 'text-white' : 'text-amber-500'} /> Active Claim
                </button>
                <button
                  type="button"
                  onClick={() => toggleFilter('Health')}
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs',
                    selectedFilters.includes('Health')
                      ? 'bg-rose-500 text-white border-rose-500 shadow-rose-500/20'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <Heart size={13} className={selectedFilters.includes('Health') ? 'text-white' : 'text-rose-500'} /> Health
                </button>
                <button
                  type="button"
                  onClick={() => toggleFilter('Term')}
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs',
                    selectedFilters.includes('Term')
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-emerald-500/20'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <Shield size={13} className={selectedFilters.includes('Term') ? 'text-white' : 'text-emerald-500'} /> Term
                </button>
              </>
            )}
          </div>
        </div>

        {/* Bottom Row: Product Filter, Search Bar, Date Pickers & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Left Side: Product Category Multi-Select Checkbox Dropdown & Exclude Button */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProductDropdown(!showProductDropdown)}
                className={clsx(
                  "flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200/90 text-xs font-extrabold cursor-pointer transition-all shadow-2xs select-none",
                  filterProducts.length > 0
                    ? "bg-blue-50/90 border-blue-300 text-blue-700"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                )}
              >
                <Shield size={14} className="text-blue-600 shrink-0" />
                <span>
                  {filterProducts.length === 0
                    ? "All Products"
                    : filterProducts.length === 1
                    ? `Product: ${filterProducts[0]}`
                    : `${filterProducts.length} Products Selected`}
                </span>
                <ChevronDown size={14} className={clsx("text-slate-400 transition-transform duration-150", showProductDropdown && "rotate-180")} />
              </button>

              {/* Dropdown Menu Panel */}
              {showProductDropdown && (
                <div className="absolute left-0 mt-2 w-56 bg-white border border-slate-200/90 rounded-2xl shadow-2xl p-3 z-50 animate-fadeIn text-xs space-y-1.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-1">
                    <span className="font-extrabold text-slate-400 uppercase tracking-wider text-[10px]">Filter By Product</span>
                    {filterProducts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setFilterProducts([]); setPage(1); }}
                        className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  {/* All Products Checkbox */}
                  <label className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer font-extrabold text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={filterProducts.length === 0}
                      onChange={() => { setFilterProducts([]); setPage(1); }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                    />
                    <span>All Products</span>
                  </label>

                  <div className="border-t border-slate-100 pt-1 space-y-1">
                    {[
                      { id: 'HEALTH', label: 'Health' },
                      { id: 'LIFE', label: 'Life' },
                      { id: 'MF', label: 'Mutual Funds (MF)' },
                      { id: 'ACCIDENT', label: 'Accident' },
                      { id: 'OTHER', label: 'Other' },
                    ].map(prod => {
                      const isChecked = filterProducts.includes(prod.id);
                      return (
                        <label key={prod.id} className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer font-bold text-slate-700 select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setFilterProducts(prev => {
                                const next = prev.includes(prod.id)
                                  ? prev.filter(p => p !== prod.id)
                                  : [...prev, prod.id];
                                return next;
                              });
                              setPage(1);
                            }}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                          />
                          <span>{prod.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {filterProducts.length > 0 && (
              <button
                type="button"
                onClick={() => { setExcludeProduct(!excludeProduct); setPage(1); }}
                className={clsx(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer border shadow-2xs',
                  excludeProduct
                    ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white border-rose-600 shadow-rose-500/25'
                    : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                )}
                title={excludeProduct ? `Showing contacts/customers who HAVEN'T purchased selected products` : `Click to show who HAVEN'T purchased selected products`}
              >
                {excludeProduct ? `❌ Without Selected Products (Not Purchased)` : `🚫 Exclude / Not Purchased`}
              </button>
            )}
          </div>

          {/* Right Side: Search, Date Range & Column Settings */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all shadow-2xs"
                placeholder={activeTab === 'customers' ? 'Search customers...' : 'Search contacts...'}
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>

            {/* Date Range Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
              <Calendar size={14} className="text-slate-400 shrink-0" />
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                className="bg-transparent border-0 outline-none text-[11px] font-semibold text-slate-700 w-24 focus:ring-0 p-0 cursor-pointer"
                title="From Date"
              />
              <span className="text-slate-300 font-bold">-</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPage(1); }}
                className="bg-transparent border-0 outline-none text-[11px] font-semibold text-slate-700 w-24 focus:ring-0 p-0 cursor-pointer"
                title="To Date"
              />
            </div>

            {/* Column Picker Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setShowColPicker(!showColPicker)}
                className={clsx(
                  "p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 cursor-pointer shadow-2xs transition-all",
                  showColPicker && "bg-blue-50 border-blue-200 text-blue-600"
                )}
                title="Toggle Columns"
              >
                <Settings size={14} />
              </button>
              {showColPicker && (
                <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200/90 rounded-2xl shadow-2xl p-3 z-50 text-xs space-y-2 animate-fadeIn">
                  <p className="font-extrabold text-slate-400 uppercase tracking-wider mb-1 text-[10px]">Show Columns</p>
                  {(activeTab === 'birthdays' ? BIRTHDAY_COLS : activeTab === 'customers' ? CUSTOMER_COLS : CONTACT_COLS).map(c => {
                    if (c.key === 'actions') return null;
                    return (
                      <label key={String(c.key)} className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 hover:text-blue-600 transition-colors">
                        <input
                          type="checkbox"
                          checked={visibleColumns[String(c.key)] !== false}
                          onChange={() => setVisibleColumns(prev => ({ ...prev, [String(c.key)]: !prev[String(c.key)] }))}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                        />
                        <span>{c.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Advanced Filters Toggle Button */}
            <button 
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={clsx(
                "p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 cursor-pointer shadow-2xs transition-all",
                showAdvancedFilters && "bg-blue-50 border-blue-200 text-blue-600"
              )}
              title="Advanced Filters"
            >
              <Filter size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="card grid grid-cols-1 sm:grid-cols-4 gap-4 bg-gradient-to-r from-slate-50 via-blue-50/20 to-slate-50 rounded-2xl border border-slate-200/70 p-4 mb-2 shadow-sm animate-fadeIn">
          <div>
            <label className="label text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned Agent</label>
            <select
              value={leadInfoFields.assignedEmployeeId}
              onChange={e => setLeadInfoFields(prev => ({ ...prev, assignedEmployeeId: e.target.value }))}
              className="input text-xs font-semibold"
            >
              <option value="">All Agents</option>
              {employees?.map((emp: any) => (
                <option key={emp.id} value={emp.userId}>{emp.firstName} {emp.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lead Source</label>
            <select
              value={leadInfoFields.leadSource}
              onChange={e => setLeadInfoFields(prev => ({ ...prev, leadSource: e.target.value }))}
              className="input text-xs font-semibold"
            >
              <option value="By Agent">By Agent</option>
              <option value="Online">Online</option>
              <option value="Referral">Referral</option>
              <option value="Walk-in">Walk-in</option>
            </select>
          </div>
          <div>
            <label className="label text-[10px] font-bold text-slate-400 uppercase tracking-wider">Product Type</label>
            <div className="flex items-center gap-2 mt-1">
              <select
                value={filterProducts[0] || 'ALL'}
                onChange={e => setFilterProducts(e.target.value === 'ALL' ? [] : [e.target.value])}
                className="input py-1.5 text-xs font-semibold flex-1"
              >
                <option value="ALL">All Categories</option>
                <option value="HEALTH">Health</option>
                <option value="LIFE">Life</option>
                <option value="MF">MF (Mutual Funds)</option>
                <option value="ACCIDENT">Accident</option>
                <option value="OTHER">Other</option>
              </select>
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-[10px] font-extrabold text-slate-600 bg-white border border-slate-200 px-2 py-1.5 rounded-lg shadow-2xs shrink-0 hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={excludeProduct}
                  onChange={e => setExcludeProduct(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                />
                <span>Exclude</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Main Data Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <DataTable
          columns={activeCols}
          data={sortedAndFilteredData}
          total={activeTab === 'birthdays' ? birthdayList.length : contactsRes?.meta?.total}
          page={page}
          pageSize={20}
          loading={activeTab === 'birthdays' ? birthdayLoading : contactsLoading}
          rowKey={r => r.id}
          onPageChange={setPage}
          onSort={(key, dir) => {
            setSortKey(key);
            setSortDir(dir);
          }}
          onRowClick={r => {
            if (activeTab === 'customers' || activeTab === 'contacts') {
              openEdit(r);
            } else {
              const cid = r.contactId || r.id;
              setSelectedDetailId(cid);
              setDetailModalOpen(true);
            }
          }}
        />
      </div>



      {/* Delete Confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Contact" size="sm">
        <p className="text-sm text-gray-600 mb-4">Delete <strong>{deleteTarget?.firstName} {deleteTarget?.lastName}</strong>? This cannot be undone.</p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="btn-danger" onClick={confirmDelete} disabled={deleteContact.isPending}>
            {deleteContact.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>

      {/* Log Interaction Modal */}
      <Modal
        open={interactionModalOpen}
        onClose={() => { setInteractionModalOpen(false); setInteractionTarget(null); }}
        title={`Update Contact & Log Interaction — ${interactionTarget?.firstName ?? ''} ${interactionTarget?.lastName ?? ''}`}
        size="lg"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Left Column: Form Fields */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!interactionTarget) return;
              logInteractionMutation.mutate({
                id: interactionTarget.id,
                body: {
                  interactionType: interactionFields.interactionType,
                  leadStage: interactionFields.leadStage,
                  leadStatus: interactionFields.leadStatus,
                  leadType: interactionFields.leadType,
                  nextFollowUp: interactionFields.nextFollowUp || undefined,
                  notes: interactionFields.notes || undefined,
                }
              });
            }}
            className="space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div>
                <label className="label">Interaction Type</label>
                <div className="flex gap-4 mt-1">
                  {['Call', 'WhatsApp', 'Meeting'].map((t) => (
                    <label key={t} className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="interactionType"
                        value={t}
                        checked={interactionFields.interactionType === t}
                        onChange={(e) => setInteractionFields(prev => ({ ...prev, interactionType: e.target.value }))}
                        className="accent-blue-600 h-3.5 w-3.5"
                      />
                      {t}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Lead Stage</label>
                <select
                  value={interactionFields.leadStage}
                  onChange={(e) => setInteractionFields(prev => ({ ...prev, leadStage: e.target.value }))}
                  className="input text-xs"
                >
                  <option value="To Contact">To Contact</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Proposal Sent">Proposal Sent</option>
                  <option value="Login in Progress">Login in Progress</option>
                  <option value="Payment Done">Payment Done</option>
                </select>
              </div>

              <div>
                <label className="label">Lead Status</label>
                <select
                  value={interactionFields.leadStatus}
                  onChange={(e) => setInteractionFields(prev => ({ ...prev, leadStatus: e.target.value }))}
                  className="input text-xs"
                >
                  <option value="Interested">Interested</option>
                  <option value="Not Interested">Not Interested</option>
                  <option value="Hot">Hot</option>
                  <option value="Very Hot">Very Hot</option>
                </select>
              </div>

              <div>
                <label className="label">Lead Type</label>
                <select
                  value={interactionFields.leadType}
                  onChange={(e) => setInteractionFields(prev => ({ ...prev, leadType: e.target.value }))}
                  className="input text-xs"
                >
                  <option value="New">New</option>
                  <option value="Renewal">Renewal</option>
                  <option value="Payment Due">Payment Due</option>
                </select>
              </div>

              <div>
                <label className="label">Next Follow-up Date</label>
                <input
                  type="date"
                  value={interactionFields.nextFollowUp}
                  onChange={(e) => setInteractionFields(prev => ({ ...prev, nextFollowUp: e.target.value }))}
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="label">Consultation Comment</label>
                <textarea
                  value={interactionFields.notes}
                  onChange={(e) => setInteractionFields(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  placeholder="Type a new comment..."
                  className="input text-xs font-sans"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setInteractionModalOpen(false); setInteractionTarget(null); }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={logInteractionMutation.isPending}
              >
                {logInteractionMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>

          {/* Right Column: Timelines and Comments History */}
          <div className="border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-6 flex flex-col">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Consultation Comments Timeline</h3>
            
            <div className="flex-1 max-h-[420px] overflow-y-auto pr-1 space-y-3 custom-scrollbar">
              {activityLoading ? (
                <div className="py-12 flex justify-center items-center text-slate-400 text-xs">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-blue-600 mr-2" />
                  Loading timeline history...
                </div>
              ) : (activityRes?.data ?? []).length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 italic">
                  No interactions logged yet.
                </div>
              ) : (
                (activityRes?.data ?? []).map((act: any, idx: number) => {
                  const creatorName = act.user ? `${act.user.firstName} ${act.user.lastName}` : 'System';
                  return (
                    <div key={act.id || idx} className="bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-1.5 transition-all text-xs">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                        <span>{format(new Date(act.createdAt), 'dd/MM/yyyy hh:mm a')}</span>
                        <span className="text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md">{creatorName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={clsx(
                          'px-1.5 py-0.25 rounded text-[9px] font-bold uppercase tracking-wider',
                          act.action === 'WHATSAPP' ? 'bg-green-100 text-green-700' :
                          act.action === 'MEETING' ? 'bg-purple-100 text-purple-700' :
                          'bg-blue-100 text-blue-700'
                        )}>
                          {act.action}
                        </span>
                      </div>
                      <p className="text-slate-600 whitespace-pre-wrap leading-relaxed mt-1 font-medium">{act.description}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={leadModalOpen}
        onClose={closeLeadModal}
        title={
          editContactId
            ? (activeTab === 'customers' ? "Edit Customer Profile" : "Edit Contact Profile")
            : (activeTab === 'customers' ? "Add New Customer" : "Add New Contact")
        }
        subtitle={
          editContactId
            ? (activeTab === 'customers' ? "Update customer profile, family details, and policies." : "Update contact profile, family details, and address.")
            : (activeTab === 'customers' ? "Manage customer profile, family details, and policies." : "Manage contact profile, family details, and address.")
        }
        size="2xl"
        actions={
          <div className="flex gap-2.5 mr-1">
            {editContactId ? (
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
                                return (
                                  <button
                                    key={prod}
                                    type="button"
                                    onClick={() => {
                                      const next = card.interestedIn.includes(prod)
                                        ? card.interestedIn.filter(x => x !== prod)
                                        : [...card.interestedIn, prod];
                                      updateProductInterest(card.id, 'interestedIn', next);
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer select-none ${PILL_COLORS[prod] || (isSel ? 'bg-slate-700 text-white border-slate-700' : 'bg-white border-slate-200 text-slate-600')}`}
                                  >
                                    {isSel ? '✓ ' : '+ '}{prod}
                                  </button>
                                );
                              })}
                            </div>
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
                <button
                  type="button"
                  onClick={addProductInterest}
                  className="w-full mt-1 py-3 rounded-2xl border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50 text-blue-600 hover:text-blue-700 text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer group"
                >
                  <Plus size={15} className="group-hover:scale-110 transition-transform" />
                  + Add Product Interest
                </button>

              </div>
            )}
            {activeLeadTab === 'Personal' && (
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
            )}


            {activeLeadTab === 'Family' && (
              <div className="h-full flex flex-col gap-0">
                {/* Header */}
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                  <h3 className="text-base font-bold text-gray-800">Dependents &amp; Beneficiaries</h3>
                  <button
                    type="button"
                    onClick={addFamilyMember}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                  >
                    + Add Member
                  </button>
                </div>

                {/* Members */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
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
                          <button
                            type="button"
                            onClick={() => setFamilyMembers(prev => prev.filter((_, i) => i !== idx))}
                            className="w-5 h-5 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors cursor-pointer text-xs font-bold"
                          >
                            ✕
                          </button>
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
                              onChange={e => updateFamilyMember(idx, 'name', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">DOB</label>
                            <input
                              type="date"
                              className="input w-full mt-1"
                              value={member.dob}
                              onChange={e => updateFamilyMember(idx, 'dob', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Relation</label>
                            <select
                              className="input w-full mt-1"
                              value={member.relation}
                              onChange={e => updateFamilyMember(idx, 'relation', e.target.value)}
                            >
                              <option value="">Select</option>
                              <option>Spouse</option>
                              <option>Son</option>
                              <option>Daughter</option>
                              <option>Father</option>
                              <option>Mother</option>
                              <option>Brother</option>
                              <option>Sister</option>
                              <option>Child</option>
                              <option>Other</option>
                            </select>
                          </div>
                        </div>

                        {/* Row 2: WhatsApp | Occupation | Education */}
                        <div className="grid grid-cols-3 gap-3 px-4 pt-3">
                          <div>
                            <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">WhatsApp</label>
                            <div className="flex mt-1">
                              <span className="inline-flex items-center px-2.5 text-xs text-gray-500 bg-gray-50 border border-r-0 border-gray-200 rounded-l-lg font-medium">+91</span>
                              <input
                                type="tel"
                                className="input rounded-l-none flex-1 min-w-0"
                                placeholder="Number"
                                value={member.whatsapp}
                                onChange={e => updateFamilyMember(idx, 'whatsapp', e.target.value)}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Occupation</label>
                            <select
                              className="input w-full mt-1"
                              value={member.occupation}
                              onChange={e => updateFamilyMember(idx, 'occupation', e.target.value)}
                            >
                              <option value="">Select Type</option>
                              <option>Salaried</option>
                              <option>Self Employed</option>
                              <option>Business</option>
                              <option>Student</option>
                              <option>Homemaker</option>
                              <option>Retired</option>
                              <option>Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Education</label>
                            <select
                              className="input w-full mt-1"
                              value={member.education}
                              onChange={e => updateFamilyMember(idx, 'education', e.target.value)}
                            >
                              <option value="">Select Type</option>
                              <option>Below 10th</option>
                              <option>10th Pass</option>
                              <option>12th Pass</option>
                              <option>Graduate</option>
                              <option>Post Graduate</option>
                              <option>Other</option>
                            </select>
                          </div>
                        </div>

                        {/* Row 3: Medical History */}
                        <div className="px-4 pt-3 pb-3">
                          <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Medical History (Select if applicable)</label>
                          <div className="flex flex-wrap gap-3">
                            {['BP', 'Sugar', 'Heart', 'Thyroid', 'Others'].map(condition => (
                              <label key={condition} className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={
                                    condition === 'Others'
                                      ? member.medicalHistory.some(h => !['BP', 'Sugar', 'Heart', 'Thyroid'].includes(h))
                                      : member.medicalHistory.includes(condition)
                                  }
                                  onChange={() => {
                                    if (condition === 'Others') {
                                      const customActive = member.medicalHistory.some(h => !['BP', 'Sugar', 'Heart', 'Thyroid'].includes(h));
                                      if (customActive) {
                                        const cleared = member.medicalHistory.filter(h => ['BP', 'Sugar', 'Heart', 'Thyroid'].includes(h));
                                        updateFamilyMember(idx, 'medicalHistory', cleared);
                                      } else {
                                        updateFamilyMember(idx, 'medicalHistory', [...member.medicalHistory, '']);
                                      }
                                    } else {
                                      toggleMedicalHistory(idx, condition);
                                    }
                                  }}
                                  className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                                />
                                <span className="text-xs text-gray-600">{condition}</span>
                              </label>
                            ))}
                          </div>

                          {/* Option to type if Others is checked */}
                          {member.medicalHistory.some(h => !['BP', 'Sugar', 'Heart', 'Thyroid'].includes(h)) && (
                            <div className="mt-2 animate-fadeIn">
                              <input
                                type="text"
                                className="input w-full text-xs py-1 px-2.5"
                                placeholder="Type medical conditions..."
                                value={member.medicalHistory.find(h => !['BP', 'Sugar', 'Heart', 'Thyroid'].includes(h)) || ''}
                                onChange={e => {
                                  const baseVal = member.medicalHistory.filter(h => ['BP', 'Sugar', 'Heart', 'Thyroid'].includes(h));
                                  updateFamilyMember(idx, 'medicalHistory', [...baseVal, e.target.value]);
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeLeadTab === 'Policy' && (
              <div className="h-full flex flex-col">
                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-3 mb-3 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => addPolicy('Health')}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-blue-400 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    + Add Health Policy
                  </button>
                  <button
                    type="button"
                    onClick={() => addPolicy('Life')}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-pink-400 text-pink-600 text-xs font-semibold rounded-lg hover:bg-pink-50 cursor-pointer transition-colors"
                  >
                    + Add Life Policy
                  </button>
                </div>

                {/* Portfolio cards */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
                  {policies.length === 0 ? (
                    <div className="flex items-center justify-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50" style={{ minHeight: '120px' }}>
                      <p className="text-xs text-gray-400 font-medium">No policies added yet. Select a type above to start.</p>
                    </div>
                  ) : (
                    policies.map((portfolio, pIdx) => {
                      const isHealth = portfolio.policyType === 'Health';
                      const portfolioTitle = isHealth ? 'Health Insurance Portfolio' : 'Life Insurance Portfolio';
                      const accentBorder = isHealth ? 'border-blue-200' : 'border-pink-200';
                      const accentHeader = isHealth ? 'bg-blue-50 border-blue-100' : 'bg-pink-50 border-pink-100';
                      const accentIcon = isHealth ? 'text-blue-500' : 'text-pink-500';
                      const accentAddBtn = isHealth
                        ? 'text-blue-600 border-blue-300 hover:bg-blue-50'
                        : 'text-pink-600 border-pink-300 hover:bg-pink-50';
                      return (
                        <div key={pIdx} className={`border ${accentBorder} rounded-xl bg-white shadow-sm`}>
                          {/* Portfolio header */}
                          <div className={`flex items-center justify-between px-4 py-2.5 border-b ${accentHeader} rounded-t-xl`}>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm ${accentIcon}`}>☆</span>
                              <span className="text-xs font-bold text-gray-700">{portfolioTitle}</span>
                              <span className="text-gray-300 text-xs">›</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setPolicies(prev => prev.filter((_, i) => i !== pIdx))}
                              className="w-5 h-5 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors cursor-pointer text-xs font-bold"
                            >
                              ✕
                            </button>
                          </div>

                          {/* Add Entry button */}
                          <div className="px-4 py-2 border-b border-gray-100">
                            <button
                              type="button"
                              onClick={() => addPolicyEntry(pIdx)}
                              className={`text-xs font-semibold border rounded-lg px-3 py-1.5 cursor-pointer transition-colors ${accentAddBtn}`}
                            >
                              + Add New Policy Entry / Renewal
                            </button>
                          </div>

                          {/* Policy Entries */}
                          <div className="space-y-0 divide-y divide-gray-100">
                            {portfolio.entries.map((entry, eIdx) => (
                              <div key={eIdx} className="px-4 py-3">
                                {/* Entry header */}
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Entry #{eIdx + 1}</span>
                                  <div className="flex items-center gap-2">
                                    <select
                                      className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 cursor-pointer bg-white"
                                      value={entry.entryType}
                                      onChange={e => updatePolicyItem(pIdx, eIdx, 'entryType', e.target.value)}
                                    >
                                      <option value="New">New Client/Opt</option>
                                      <option value="Renewal">Renewal</option>
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => removePolicyEntry(pIdx, eIdx)}
                                      className="w-4 h-4 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors cursor-pointer text-[10px] font-bold"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>

                                {/* Row 1: Insurance Company | Plan Name */}
                                <div className="grid grid-cols-2 gap-3 mb-2">
                                  <div>
                                    <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Insurance Company</label>
                                    <select
                                      className="input w-full mt-1"
                                      value={entry.company}
                                      onChange={e => updatePolicyItem(pIdx, eIdx, 'company', e.target.value)}
                                    >
                                      <option value="">Select Company</option>
                                      <option>Star Health</option>
                                      <option>HDFC Ergo</option>
                                      <option>ICICI Lombard</option>
                                      <option>Niva Bupa</option>
                                      <option>Care Health</option>
                                      <option>Bajaj Allianz</option>
                                      <option>Aditya Birla Health</option>
                                      <option>SBI General</option>
                                      <option>Tata AIG</option>
                                      <option>New India Assurance</option>
                                      <option>LIC</option>
                                      <option>HDFC Life</option>
                                      <option>ICICI Prudential Life</option>
                                      <option>SBI Life</option>
                                      <option>Max Life</option>
                                      <option>Bajaj Allianz Life</option>
                                      <option>Kotak Life</option>
                                      <option>Tata AIA Life</option>
                                      <option>Aditya Birla Sun Life</option>
                                      <option>PNB MetLife</option>
                                      <option>Other</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Plan Name</label>
                                    <select
                                      className="input w-full mt-1"
                                      value={entry.planName}
                                      onChange={e => updatePolicyItem(pIdx, eIdx, 'planName', e.target.value)}
                                    >
                                      <option value="">Select Plan</option>
                                      {isHealth ? (
                                        <>
                                          <option>Individual</option>
                                          <option>Family Floater</option>
                                          <option>Senior Citizen</option>
                                          <option>Critical Illness</option>
                                          <option>Top-Up</option>
                                          <option>Super Top-Up</option>
                                        </>
                                      ) : (
                                        <>
                                          <option>Term Plan</option>
                                          <option>Endowment</option>
                                          <option>ULIP</option>
                                          <option>Money Back</option>
                                          <option>Whole Life</option>
                                          <option>Child Plan</option>
                                        </>
                                      )}
                                      <option>Other</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Row 2: Policy No (full width) */}
                                <div className="mb-2">
                                  <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Policy No</label>
                                  <input
                                    type="text"
                                    className="input w-full mt-1"
                                    placeholder="Enter Policy Number"
                                    value={entry.policyNo}
                                    onChange={e => updatePolicyItem(pIdx, eIdx, 'policyNo', e.target.value)}
                                  />
                                </div>

                                {/* Row 3: Start Date | Duration | End Date */}
                                <div className="grid grid-cols-3 gap-3 mb-2">
                                  <div>
                                    <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Start Date</label>
                                    <input
                                      type="date"
                                      className="input w-full mt-1"
                                      value={entry.startDate}
                                      onChange={e => updatePolicyItem(pIdx, eIdx, 'startDate', e.target.value)}
                                    />
                                  </div>
                                  <div>
                                    <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Duration</label>
                                    <select
                                      className="input w-full mt-1"
                                      value={entry.duration}
                                      onChange={e => updatePolicyItem(pIdx, eIdx, 'duration', e.target.value)}
                                    >
                                      <option>1 Year</option>
                                      <option>2 Years</option>
                                      <option>3 Years</option>
                                      <option>5 Years</option>
                                      <option>10 Years</option>
                                      <option>15 Years</option>
                                      <option>20 Years</option>
                                      <option>30 Years</option>
                                      <option>Lifetime</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">End Date</label>
                                    <input
                                      type="date"
                                      className="input w-full mt-1"
                                      value={entry.endDate}
                                      onChange={e => updatePolicyItem(pIdx, eIdx, 'endDate', e.target.value)}
                                    />
                                  </div>
                                </div>

                                {/* Row 4: Premium | Sum Insured | Deductible */}
                                <div className="grid grid-cols-3 gap-3 mb-2">
                                  <div>
                                    <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Premium (₹)</label>
                                    <div className="flex mt-1">
                                      <span className="inline-flex items-center px-2 text-xs text-gray-400 bg-gray-50 border border-r-0 border-gray-200 rounded-l-lg">₹</span>
                                      <input
                                        type="number"
                                        className="input rounded-l-none flex-1 min-w-0"
                                        placeholder="0"
                                        value={entry.premium}
                                        onChange={e => updatePolicyItem(pIdx, eIdx, 'premium', e.target.value)}
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Sum Insured</label>
                                    <input
                                      type="number"
                                      className="input w-full mt-1"
                                      placeholder="e.g. 5L"
                                      value={entry.sumInsured}
                                      onChange={e => updatePolicyItem(pIdx, eIdx, 'sumInsured', e.target.value)}
                                    />
                                  </div>
                                  <div>
                                    <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Deductible</label>
                                    <input
                                      type="text"
                                      className="input w-full mt-1"
                                      placeholder="Optional"
                                      value={entry.deductible}
                                      onChange={e => updatePolicyItem(pIdx, eIdx, 'deductible', e.target.value)}
                                    />
                                  </div>
                                </div>

                                {/* Upload Policy Document */}
                                <div className="mt-1">
                                  <label className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 cursor-pointer font-medium">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                      <polyline points="17 8 12 3 7 8" />
                                      <line x1="12" y1="3" x2="12" y2="15" />
                                    </svg>
                                    Upload Policy Document
                                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" />
                                  </label>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {activeLeadTab === 'WA Campaign' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-gray-800">Select Campaigns</h3>
                  <p className="text-[11px] text-gray-500 mt-1">Choose which WhatsApp campaigns this lead should be part of:</p>
                </div>
                <div className="space-y-2 mt-3">
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
                </div>
              </div>
            )}

            {activeLeadTab === 'History' && (
              <div className="py-8 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                <p className="text-xs text-gray-400 font-semibold">{activeLeadTab} information will be accessible after saving the lead.</p>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Import from Phone Directory Modal */}
      <Modal open={dirImportOpen} onClose={() => setDirImportOpen(false)} title="Import from Phone Directory">
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Paste contacts below in the format: <span className="font-mono">First Name, Phone</span> (one per line).
          </p>
          <textarea
            className="input font-mono w-full text-xs"
            rows={8}
            placeholder="John Doe, 9876543210&#10;Jane Smith, 9876543211"
            value={dirText}
            onChange={e => setDirText(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary text-xs h-9" onClick={() => setDirImportOpen(false)}>Cancel</button>
            <button
              type="button"
              className="btn-primary text-xs h-9"
              onClick={async () => {
                const lines = dirText.split('\n').filter(l => l.trim());
                const contactsToImport = lines.map(l => {
                  const parts = l.split(',');
                  const namePart = parts[0] || '';
                  const phonePart = parts[1] || '';
                  const nameTokens = namePart.trim().split(/\s+/);
                  const firstName = nameTokens[0] || '';
                  const lastName = nameTokens.slice(1).join(' ') || '';
                  return {
                    firstName,
                    lastName,
                    phone: phonePart.trim(),
                  };
                }).filter(c => c.firstName && c.phone);

                if (contactsToImport.length === 0) {
                  toast.error('No valid contacts found in import text');
                  return;
                }

                const toastId = toast.loading('Bulk importing directory...');
                try {
                  await contactsService.bulkImport({ contacts: contactsToImport });
                  toast.success('Contacts imported successfully!', { id: toastId });
                  setDirImportOpen(false);
                  setDirText('');
                  qc.invalidateQueries({ queryKey: ['contacts'] });
                } catch (err: any) {
                  toast.error(err.response?.data?.message || 'Bulk import failed', { id: toastId });
                }
              }}
            >
              Import
            </button>
          </div>
        </div>
      </Modal>

      <ContactDetailModal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        contactId={selectedDetailId}
        onEditClick={(c) => {
          setDetailModalOpen(false);
          openEdit(c);
        }}
      />
    </div>
  );
}
