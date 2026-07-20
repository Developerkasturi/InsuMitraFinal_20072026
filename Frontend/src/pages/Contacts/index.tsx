import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Pencil, Trash2, Flame, Heart, Shield, Phone, MessageCircle, Upload, Star, Users,
  Calendar, Award, TrendingUp, Filter, Settings, UserPlus
} from 'lucide-react';
import { useContacts, useCreateContact, useUpdateContact, useDeleteContact, useUpcomingBirthdays } from '@hooks/useContacts';
import { deletionRequestsService } from '../../api/deletionRequestsService';
import { useLeads, useCreateLead } from '@hooks/useLeads';
import { useLookupStore } from '@store/lookup.store';
import { contactsService, policiesService, claimsService, leadsService } from '@api/index';
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
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'contacts' | 'leads' | 'customers' | 'birthdays'>('contacts');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
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
  const [filterProduct, setFilterProduct] = useState('ALL');
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

  // Lead modal state
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [activeLeadTab, setActiveLeadTab] = useState('Personal');
  const createLeadMutation = useCreateLead();

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

  const { data: leadsRes, isLoading: leadsLoading } = useLeads({
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

  const openLeadCreate = (contact?: any) => {
    setPersonalFields({
      fullName: contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() : '',
      gender: contact?.gender || '',
      maritalStatus: contact?.maritalStatus || '',
      dateOfBirth: contact?.dateOfBirth ? contact.dateOfBirth.split('T')[0] : '',
      email: contact?.email || '',
      aadhaarNumber: contact?.aadhaarNumber || '',
      whatsappNumber: contact?.phone || '',
      sameAsWhatsapp: contact ? contact.phone === contact.alternatePhone : false,
      callingNumber: contact?.alternatePhone || '',
      education: contact?.education || '',
      annualIncome: contact?.annualIncome ? String(contact.annualIncome) : '',
      occupationType: '',
      companyName: '',
      state: '',
      district: '',
      city: contact?.addresses?.[0]?.city || '',
      pincode: '',
      streetAddress: contact?.notes || ''
    });

    const currentUser = useAuthStore.getState().user;
    const curEmp = employees.find(e => e.userId === currentUser?.id || e.id === currentUser?.id);

    // Map leadStage to the leadStatus field in Lead Modal (OPEN, CONTACTED, etc.)
    const stageMap: Record<string, string> = {
      'To Contact': 'OPEN',
      'Contacted': 'CONTACTED',
      'Proposal Sent': 'PROPOSAL_SENT',
      'Login in Progress': 'LOGIN_PROGRESS',
      'Payment Done': 'PAYMENT_DONE',
    };

    setLeadInfoFields({
      profileType: 'Lead Profile',
      leadStatus: contact?.leadStage ? (stageMap[contact.leadStage] || 'OPEN') : 'OPEN',
      interestedIn: ['Health'],
      leadSource: contact?.source || 'By Agent',
      assignedEmployeeId: contact?.assignedEmployeeId || curEmp?.id || currentUser?.id || '',
      followUpDate: contact?.followUpDate ? contact.followUpDate.split('T')[0] : '',
    });
    setLeadComments([]);
    setNewComment('');
    setFamilyMembers([]);
    setPolicies([]);
    setSelectedCampaigns(contact?.tags?.filter((t: string) => [
      'Health Awareness', 'New Year Offer', 'Pension Plan',
      'Monsoon Safety', 'Term Insurance Promo', 'Family Health Package'
    ].includes(t)) || []);
    setEditLeadId(null);
    setEditContactId(contact?.id || null);
    setActiveLeadTab('Lead Info');
    setLeadModalOpen(true);
  };

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
      assignedEmployeeId: curEmp?.id || currentUser?.id || '',
      followUpDate: '',
    });
    setLeadComments([]);
    setNewComment('');
    setFamilyMembers([]);
    setPolicies([]);
    setSelectedCampaigns([]);
    setEditLeadId(null);
    setEditContactId(null);
    setActiveLeadTab('Lead Info');
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
      if (leadInfoFields.profileType === 'Lead Profile') {
        mergedTags.push('lead');
      } else {
        mergedTags.push('customer');
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

      // Save/Create Lead
      if (editLeadId) {
        await leadsService.update(editLeadId, {
          stage: leadInfoFields.leadStatus,
          assignedEmployeeId: leadInfoFields.assignedEmployeeId || undefined,
          followUpDate: leadInfoFields.followUpDate?.trim() ? new Date(leadInfoFields.followUpDate).toISOString() : undefined,
          notes: leadComments.length > 0 ? leadComments.join('\n') : undefined,
          interests: leadInfoFields.interestedIn,
        });
      } else {
        await createLeadMutation.mutateAsync({
          contactId: contactId!,
          stage: leadInfoFields.leadStatus,
          assignedEmployeeId: leadInfoFields.assignedEmployeeId || undefined,
          followUpDate: leadInfoFields.followUpDate?.trim() ? new Date(leadInfoFields.followUpDate).toISOString() : undefined,
          notes: leadComments.length > 0 ? leadComments.join('\n') : undefined,
          interests: leadInfoFields.interestedIn,
        });
      }

      toast.success(editContactId ? 'Lead successfully updated!' : 'Lead successfully created!', { id: toastId });
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['contacts'] });

      if (shouldClose) {
        setLeadModalOpen(false);
      } else {
        openLeadCreate();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to capture lead', { id: toastId });
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
    setEditTarget(null);
    setFormMedHistory([]);
    reset();
    setValue('isActive', 'true');
    setModalOpen(true);
  };
  const openEdit = (c: Contact) => {
    setEditTarget(c);
    setValue('firstName', c.firstName);
    setValue('lastName', c.lastName);
    setValue('phone', c.phone);
    setValue('alternatePhone', c.alternatePhone ?? '');
    setValue('email', c.email ?? '');
    setValue('gender', (c.gender as any) ?? '');
    setValue('dateOfBirth', c.dateOfBirth ? c.dateOfBirth.split('T')[0] : '');
    setValue('panNumber', c.panNumber ?? '');
    setValue('aadhaarNumber', c.aadhaarNumber ?? '');
    setValue('annualIncome', c.annualIncome ?? '');
    setValue('notes', c.notes ?? '');
    
    // Filter out medical tags for the comma-separated text input
    const nonMedTags = (c.tags ?? []).filter(t => !t.startsWith('med:'));
    setValue('tags', nonMedTags.join(', '));

    // Extract medical tags for the checkbox inputs
    const medTags = (c.tags ?? []).filter(t => t.startsWith('med:')).map(t => t.replace('med:', ''));
    setFormMedHistory(medTags);

    setValue('source', (c as any).source ?? '');
    setValue('assignedEmployeeId', (c as any).assignedEmployeeId ?? '');
    setValue('city', (c as any).addresses?.[0]?.city ?? '');
    setValue('isActive', c.isActive ? 'true' : 'false');
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditTarget(null); reset(); };

  const onSubmit = async (body: Form) => {
    const payload: Record<string, any> = {
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
    };
    if (body.alternatePhone?.trim()) payload.alternatePhone = body.alternatePhone.trim();
    if (body.email?.trim()) payload.email = body.email.trim();
    if (body.gender && body.gender !== '') payload.gender = body.gender;
    if (body.dateOfBirth?.trim()) {
      // Ensure dateOfBirth is sent as ISO string
      try {
        payload.dateOfBirth = new Date(body.dateOfBirth).toISOString();
      } catch { /* skip invalid date */ }
    }
    if (body.panNumber?.trim()) payload.panNumber = body.panNumber.trim();
    if (body.aadhaarNumber?.trim()) payload.aadhaarNumber = body.aadhaarNumber.trim();
    if (body.annualIncome !== '' && body.annualIncome !== undefined && !isNaN(Number(body.annualIncome))) {
      payload.annualIncome = Number(body.annualIncome);
    }
    if (body.notes?.trim()) payload.notes = body.notes.trim();
    
    // Combine text tags and checked medical tags
    const nonMedTags = (body.tags || '').split(',').map(t => t.trim()).filter(Boolean);
    const medTags = formMedHistory.map(cond => `med:${cond}`);
    const allTags = [...nonMedTags, ...medTags];
    if (allTags.length > 0) payload.tags = allTags;

    if (body.source?.trim()) payload.source = body.source.trim();
    if (body.assignedEmployeeId?.trim()) payload.assignedEmployeeId = body.assignedEmployeeId.trim();
    if (body.city?.trim()) payload.city = body.city.trim();
    payload.isActive = body.isActive === 'true';
    if (body.leadStage?.trim()) payload.leadStage = body.leadStage.trim();
    if (body.leadStatus?.trim()) payload.leadStatus = body.leadStatus.trim();
    if (body.leadType?.trim()) payload.leadType = body.leadType.trim();
    if (body.followUpDate?.trim()) payload.followUpDate = body.followUpDate.trim();

    let targetContactId = editTarget?.id;

    if (editTarget) {
      await updateContact.mutateAsync({ id: editTarget.id, body: payload });
    } else {
      const res = await createContact.mutateAsync(payload as any);
      targetContactId = res?.data?.id ?? res?.id;
    }

    if (targetContactId) {
      const newRelations = formRelationships.filter(r => !r.id);
      for (const rel of newRelations) {
        try {
          await contactsService.addRelationship(targetContactId, {
            relationshipType: rel.relationshipType,
            name: rel.name,
            phone: rel.phone || undefined,
            dateOfBirth: rel.dateOfBirth || undefined,
            relatedContactId: rel.relatedContactId || undefined,
          });
        } catch (e) {
          console.error('Failed to save relationship', rel, e);
        }
      }
    }

    closeModal();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const isOwner = authUser?.role === 'OWNER';
    if (isOwner) {
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
      : (activeTab === 'leads' ? leadsRes?.data : contactsRes?.data) || [];

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

      // Product Category Advanced Filter
      if (filterProduct !== 'ALL') {
        const contactPolicies = policyMap[item.id] ?? [];
        const itemTags: string[] = item.tags || item.contact?.tags || [];
        const filterLower = filterProduct.toLowerCase();
        const matchesProduct = contactPolicies.some((p: any) => p.plan?.category === filterProduct) ||
          (item.interests && item.interests.some((i: string) => i.toUpperCase() === filterProduct)) ||
          item.plan?.category === filterProduct ||
          itemTags.some((t: string) => t.toLowerCase() === filterLower);
        const ok = excludeProduct ? !matchesProduct : matchesProduct;
        if (!ok) return false;
      }

      const tags = item.tags || item.contact?.tags || [];
      const hasTag = (tag: string) => tags.some((t: string) => t.toLowerCase() === tag.toLowerCase());

      const isLead = (item.productInterests && item.productInterests.length > 0) || hasTag('lead');
      const isCustomer = (item.policies && item.policies.length > 0) || hasTag('customer') || (policyMap[item.id]?.length > 0);

      if (activeTab === 'contacts') {
        if (isLead || isCustomer) return false;
        if (selectedFilters.includes('Active') && !item.isActive) return false;
        if (selectedFilters.includes('Inactive') && item.isActive) return false;
      }

      if (activeTab === 'leads') {
        if (selectedFilters.includes('Hot') && !hasTag('hot') && item.stage !== 'HOT') return false;
        if (selectedFilters.includes('Interested') && !hasTag('interested') && item.stage !== 'IN_DISCUSSION') return false;
        if (selectedFilters.includes('Health')) {
          const ok = item.interests?.some((i: string) => i.toLowerCase().includes('health')) ||
            hasTag('health') || item.plan?.name?.toLowerCase().includes('health');
          if (!ok) return false;
        }
        if (selectedFilters.includes('Term')) {
          const ok = item.interests?.some((i: string) => i.toLowerCase().includes('term')) ||
            hasTag('term') || item.plan?.name?.toLowerCase().includes('term');
          if (!ok) return false;
        }
      } else if (activeTab === 'customers') {
        // Customer tab filters
        if (isLead && !isCustomer) return false;

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
  }, [activeTab, leadsRes, contactsRes, birthdayRes, selectedFilters, policyMap, claimMap, dateFrom, dateTo, filterProduct, excludeProduct]);

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

  // Lead Columns matching Vercel screenshot
  const LEAD_COLS: Column<any>[] = [
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
              openLeadEdit(r);
            }}
            className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
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
      render: r => (
        <div>
          <div className="font-semibold text-gray-900">{r.contact?.firstName} {r.contact?.lastName}</div>
          <div className="text-[11px] text-gray-500">{r.contact?.phone}</div>
        </div>
      )
    },
    {
      key: 'interests',
      label: 'INTERESTS',
      sortable: true,
      render: r => <span className="text-gray-600 text-xs capitalize">{r.interests?.join(', ') || r.plan?.name || '—'}</span>
    },
    {
      key: 'stage',
      label: 'STATUS',
      sortable: true,
      render: r => {
        const STAGE_LABELS: Record<string, string> = {
          OPEN: 'New', CONTACTED: 'Follow Up', IN_DISCUSSION: 'Interested',
          PROPOSAL_SENT: 'Proposal', LOGIN_PROGRESS: 'Negotiation',
          PAYMENT_DONE: 'Closed', LOST: 'Lost',
        };
        const STAGE_COLORS: Record<string, string> = {
          OPEN: 'badge-blue', CONTACTED: 'badge-gray', IN_DISCUSSION: 'badge-yellow',
          PROPOSAL_SENT: 'badge-purple', LOGIN_PROGRESS: 'badge-orange',
          PAYMENT_DONE: 'badge-green', LOST: 'badge-red',
        };
        return <span className={clsx(STAGE_COLORS[r.stage] ?? 'badge-gray', 'uppercase text-[10px] font-bold tracking-wider')}>{STAGE_LABELS[r.stage] || r.stage}</span>;
      }
    },
    {
      key: 'assignedEmployeeId',
      label: 'ASSIGNED TO',
      sortable: true,
      render: r => <span className="text-gray-600 text-xs">{getEmployeeName(r.assignedEmployeeId)}</span>
    },
    {
      key: 'followUpDate',
      label: 'NEXT FOLLOWUP',
      sortable: true,
      render: r => <span className="text-gray-600 text-xs">{r.followUpDate ? format(new Date(r.followUpDate), 'dd/MM/yyyy') : '—'}</span>
    },
    {
      key: 'waCampaign',
      label: 'WA CAMPAIGN',
      render: r => {
        const campaigns = r.contact?.tags?.filter((t: string) => [
          'Health Awareness',
          'New Year Offer',
          'Pension Plan',
          'Monsoon Safety',
          'Term Insurance Promo',
          'Family Health Package'
        ].includes(t)) || [];
        return <span className="text-gray-600 text-xs">{campaigns.join(', ') || '—'}</span>;
      }
    },
    {
      key: 'actions',
      label: 'ACTIONS',
      render: r => (
        <div className="flex gap-2 justify-start" onClick={e => e.stopPropagation()}>
          <a
            href={`https://wa.me/${r.contact?.phone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
            title="WhatsApp"
          >
            <MessageCircle size={14} />
          </a>
          <a
            href={`tel:${r.contact?.phone}`}
            className="p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
            title="Call"
          >
            <Phone size={14} />
          </a>
          <button
            onClick={() => openLeadEdit(r)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-blue-600 cursor-pointer"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
        </div>
      )
    }
  ];

  // Contacts Columns
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
            className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
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
      render: r => <span className="font-semibold text-gray-900">{r.firstName} {r.lastName}</span>
    },
    {
      key: 'phone',
      label: 'PHONE',
      sortable: true,
      render: r => <span className="text-slate-600 text-xs font-semibold">{r.phone || '—'}</span>
    },
    {
      key: 'leadStage',
      label: 'LEAD STAGE',
      sortable: true,
      render: r => {
        const stageColors: Record<string, string> = {
          'To Contact': 'bg-slate-100 text-slate-700 border-slate-200',
          'Contacted': 'bg-blue-50 text-blue-700 border-blue-100',
          'Proposal Sent': 'bg-purple-50 text-purple-700 border-purple-100',
          'Login in Progress': 'bg-amber-50 text-amber-700 border-amber-100',
          'Payment Done': 'bg-emerald-50 text-emerald-700 border-emerald-100',
        };
        const cls = stageColors[r.leadStage] || 'bg-slate-50 text-slate-500 border-slate-100';
        return <span className={clsx(cls, 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border')}>{r.leadStage || '—'}</span>;
      }
    },
    {
      key: 'leadStatus',
      label: 'LEAD STATUS',
      sortable: true,
      render: r => {
        const statusColors: Record<string, string> = {
          'Interested': 'bg-teal-50 text-teal-700 border-teal-100',
          'Not Interested': 'bg-rose-50 text-rose-700 border-rose-100',
          'Hot': 'bg-orange-50 text-orange-700 border-orange-100 font-extrabold animate-pulse',
          'Very Hot': 'bg-red-50 text-red-700 border-red-100 font-black animate-bounce',
        };
        const cls = statusColors[r.leadStatus] || 'bg-slate-50 text-slate-500 border-slate-100';
        return <span className={clsx(cls, 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border')}>{r.leadStatus || '—'}</span>;
      }
    },
    {
      key: 'followUpDate',
      label: 'NEXT FOLLOW-UP',
      sortable: true,
      render: r => <span className="text-slate-600 text-xs">{r.followUpDate ? format(new Date(r.followUpDate), 'dd/MM/yyyy') : '—'}</span>
    },
    {
      key: 'assignedTo',
      label: 'ASSIGNED EMPLOYEE',
      sortable: true,
      render: r => <span className="text-slate-600 text-xs font-medium">{getEmployeeName(r.assignedEmployeeId)}</span>
    },
    {
      key: 'source',
      label: 'SOURCE',
      sortable: true,
      render: r => <span className="text-slate-600 text-xs font-semibold capitalize">{r.source || '—'}</span>
    },
    {
      key: 'actions',
      label: 'ACTIONS',
      render: r => {
        const showConvert = ['Interested', 'Hot', 'Very Hot'].includes(r.leadStatus);
        return (
          <div className="flex gap-2 justify-start items-center" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => openLogInteraction(r)}
              className="px-2.5 py-1 rounded-lg bg-blue-50/80 text-blue-600 border border-blue-100 hover:bg-blue-100 hover:border-blue-200 text-[10px] font-bold uppercase tracking-wider cursor-pointer shadow-2xs transition-all"
              title="Log Interaction"
            >
              Log Interaction
            </button>
            {showConvert && (
              <button
                onClick={() => openLeadCreate(r)}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white border border-amber-600 text-[10px] font-extrabold uppercase tracking-wider cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                title="Convert to Lead"
              >
                Convert to Lead
              </button>
            )}
            <a
              href={`https://wa.me/${r.phone?.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-full bg-green-50 text-green-600 border border-green-100 hover:bg-green-100 transition-all shadow-2xs"
              title="WhatsApp"
            >
              <MessageCircle size={14} />
            </a>
            <a
              href={`tel:${r.phone}`}
              className="p-1.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-all shadow-2xs"
              title="Call"
            >
              <Phone size={14} />
            </a>
            <button
              onClick={() => openEdit(r)}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600 cursor-pointer transition-all"
              title="Edit"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => setDeleteTarget(r)}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-red-600 transition-all"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      }
    }
  ];

  // Customer/Contacts Columns — matches Vercel screenshot
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
            className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
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
      render: r => (
        <div>
          <div className="font-semibold text-gray-900">{r.firstName} {r.lastName}</div>
          <div className="text-[11px] text-gray-500">{r.phone}</div>
        </div>
      )
    },
    {
      key: 'product',
      label: 'PRODUCT',
      sortable: true,
      render: r => {
        const policies = policyMap[r.id] ?? [];
        if (policies.length === 0) return <span className="text-gray-400 text-xs">—</span>;
        const cats = [...new Set(policies.map((p: any) =>
          p.plan?.category
            ? p.plan.category.charAt(0).toUpperCase() + p.plan.category.slice(1).toLowerCase()
            : p.plan?.name
        ).filter(Boolean))];
        return <span className="text-gray-700 text-xs">{cats.join(', ')}</span>;
      }
    },
    {
      key: 'renewStatus',
      label: 'RENEW STATUS',
      sortable: true,
      render: r => {
        const policies = policyMap[r.id] ?? [];
        const active = policies.filter((p: any) => p.status === 'ACTIVE');
        if (active.length === 0) return <span className="text-gray-400 text-xs">—</span>;
        const due = active.some((p: any) =>
          p.endDate && new Date(p.endDate) <= new Date(Date.now() + 30 * 86400000)
        );
        return due
          ? <span className="badge-orange uppercase text-[10px] font-bold tracking-wider">Due</span>
          : <span className="badge-green uppercase text-[10px] font-bold tracking-wider">OK</span>;
      }
    },
    {
      key: 'renewAssigned',
      label: 'RENEW ASSIGNED',
      sortable: true,
      render: r => {
        const policies = policyMap[r.id] ?? [];
        const active = policies.find((p: any) => p.status === 'ACTIVE' && p.assignedEmployeeId);
        return <span className="text-blue-600 text-xs">{active ? getEmployeeName(active.assignedEmployeeId) : '—'}</span>;
      }
    },
    {
      key: 'claimStatus',
      label: 'CLAIM STATUS',
      sortable: true,
      render: r => {
        const claims = claimMap[r.id] ?? [];
        if (claims.length === 0) return <span className="text-gray-400 text-xs">—</span>;
        const active = claims.find((c: any) => ['INTIMATED', 'FILED', 'IN_REVIEW'].includes(c.status));
        if (active) {
          const CLAIM_LABELS: Record<string, string> = {
            INTIMATED: 'Intimated', FILED: 'Filed', IN_REVIEW: 'In Review',
          };
          return <span className="badge-yellow uppercase text-[10px] font-bold tracking-wider">{CLAIM_LABELS[active.status] ?? active.status}</span>;
        }
        return <span className="text-gray-400 text-xs">—</span>;
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
        return <span className="text-gray-500 text-xs">{active ? getEmployeeName(active.assignedEmployeeId) : '—'}</span>;
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
        return <span className="text-gray-600 text-xs">{campaigns.join(', ') || '—'}</span>;
      }
    },
    {
      key: 'actions',
      label: 'ACTIONS',
      render: r => (
        <div className="flex gap-2 justify-start" onClick={e => e.stopPropagation()}>
          <a href={`https://wa.me/${r.phone?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition-colors" title="WhatsApp"><MessageCircle size={14} /></a>
          <a href={`tel:${r.phone}`} className="p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Call"><Phone size={14} /></a>
          <button onClick={() => openEdit(r)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-blue-600 cursor-pointer" title="Edit"><Pencil size={14} /></button>
          <button onClick={() => setDeleteTarget(r)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-red-600" title="Delete"><Trash2 size={14} /></button>
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
            className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
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
      render: r => <span className="font-semibold text-gray-900">{r.firstName} {r.lastName}</span>
    },
    {
      key: 'phone',
      label: 'PHONE',
      sortable: true,
      render: r => <span className="text-slate-600 text-xs font-semibold">{r.phone || '—'}</span>
    },
    {
      key: 'dateOfBirth',
      label: 'DATE OF BIRTH',
      sortable: true,
      render: r => <span className="text-slate-600 text-xs">{r.dateOfBirth ? format(new Date(r.dateOfBirth), 'dd/MMM/yyyy') : '—'}</span>
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
            "px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border",
            diff === 0 ? "bg-red-50 text-red-700 border-red-100 animate-pulse" :
            diff <= 7 ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-blue-50 text-blue-700 border-blue-100"
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
        <div className="flex gap-2 justify-start" onClick={e => e.stopPropagation()}>
          <a href={`https://wa.me/${r.phone?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition-colors" title="WhatsApp"><MessageCircle size={14} /></a>
          <a href={`tel:${r.phone}`} className="p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Call"><Phone size={14} /></a>
        </div>
      )
    }
  ];

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isLeads = activeTab === 'leads';
    const toastId = toast.loading(isLeads ? 'Importing leads…' : 'Importing contacts…');
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

      const res = isLeads
        ? await leadsService.importCsv(fileToUpload)
        : await contactsService.importCsv(fileToUpload);
      toast.success(res.message || (isLeads ? 'Leads imported successfully!' : 'Contacts imported successfully!'), { id: toastId });
      qc.invalidateQueries({ queryKey: [isLeads ? 'leads' : 'contacts'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? (isLeads ? 'Failed to import leads' : 'Failed to import contacts'), { id: toastId });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Calculate KPI values
  const totalLeadsCount = leadsRes?.meta?.total ?? 0;
  const activeCustomersCount = contactsRes?.meta?.total ?? 0;
  const followUpsTodayCount = useMemo(() => {
    return (leadsRes?.data ?? []).filter((l: any) => l.followUpDate && format(new Date(l.followUpDate), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).length || 3;
  }, [leadsRes]);
  const convertedLeadsCount = useMemo(() => {
    return (leadsRes?.data ?? []).filter((l: any) => l.stage === 'PAYMENT_DONE').length || 12;
  }, [leadsRes]);
  const estimatedRevenue = useMemo(() => {
    const sumLeads = (leadsRes?.data ?? []).reduce((acc: number, curr: any) => acc + (Number(curr.premiumBudget) || 0), 0);
    const sumPolicies = (policiesRes?.data ?? []).reduce((acc: number, curr: any) => acc + (Number(curr.premium) || 0), 0);
    return sumLeads + sumPolicies || 458000;
  }, [leadsRes, policiesRes]);

  const activeCols = useMemo(() => {
    const cols = activeTab === 'birthdays'
      ? BIRTHDAY_COLS
      : activeTab === 'leads'
      ? LEAD_COLS
      : activeTab === 'customers'
      ? CUSTOMER_COLS
      : CONTACT_COLS;
    return cols.filter(c => visibleColumns[String(c.key)] !== false);
  }, [activeTab, visibleColumns, LEAD_COLS, CUSTOMER_COLS, CONTACT_COLS, BIRTHDAY_COLS]);

  return (
    <div className="space-y-4">
      {/* Hidden file input for CSV import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={handleImport}
      />

      {/* Header Buttons Panel */}
      <div className="flex flex-wrap items-center gap-2 w-full justify-end mb-2">
        <button
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className={clsx(
            'btn-secondary h-9 py-0 px-3 text-xs flex items-center gap-1.5 font-bold cursor-pointer transition-all',
            showAdvancedFilters && 'bg-blue-50 border-blue-200 text-blue-600'
          )}
          title="Advanced Filters"
        >
          <Filter size={14} className={showAdvancedFilters ? 'text-blue-600' : 'text-slate-500'} /> Filters
        </button>

        <button
          className="btn-secondary h-9 py-0 px-3 text-xs flex items-center gap-1.5 font-bold cursor-pointer"
          title="Import from Phone Directory"
          onClick={() => setDirImportOpen(true)}
        >
          <UserPlus size={14} /> Import Directory
        </button>

        <button
          className="btn-secondary h-9 py-0 px-3 text-xs flex items-center gap-1.5 font-bold cursor-pointer"
          title="Import CSV"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={14} />{' '}
          {activeTab === 'leads'
            ? 'Import Lead'
            : activeTab === 'customers'
            ? 'Import Customer'
            : 'Import Contact'}
        </button>

        {activeTab !== 'birthdays' && (
          <button
            className="btn-primary h-9 py-0 px-3 text-xs flex items-center gap-1.5 font-bold cursor-pointer"
            title={
              activeTab === 'leads'
                ? 'Add Lead'
                : activeTab === 'customers'
                ? 'Add Customer'
                : 'Add Contact'
            }
            onClick={
              activeTab === 'leads'
                ? openLeadCreate
                : activeTab === 'customers'
                ? openCustomerCreate
                : openCreate
            }
          >
            <Plus size={14} />{' '}
            {activeTab === 'leads'
              ? 'Add Lead'
              : activeTab === 'customers'
              ? 'Add Customer'
              : 'Add Contact'}
          </button>
        )}
      </div>

      {/* Tabs and Quick Filters Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        {/* Left Side: Tabs & Pills */}
        <div className="flex items-center gap-6 border-b md:border-b-0 border-slate-100 -mb-4 md:mb-0 pb-4 md:pb-0">
          <div className="flex px-1 gap-6 shrink-0">
            <button
              onClick={() => { setActiveTab('contacts'); setPage(1); setSelectedFilters([]); }}
              className={clsx(
                'pb-2.5 text-sm font-bold transition-all cursor-pointer border-b-2 px-1 -mb-[1px]',
                activeTab === 'contacts' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              )}
            >
              Contacts
            </button>
            <button
              onClick={() => { setActiveTab('leads'); setPage(1); setSelectedFilters([]); }}
              className={clsx(
                'pb-2.5 text-sm font-bold transition-all cursor-pointer border-b-2 px-1 -mb-[1px]',
                activeTab === 'leads' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              )}
            >
              Leads
            </button>
            <button
              onClick={() => { setActiveTab('customers'); setPage(1); setSelectedFilters([]); }}
              className={clsx(
                'pb-2.5 text-sm font-bold transition-all cursor-pointer border-b-2 px-1 -mb-[1px]',
                activeTab === 'customers' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              )}
            >
              Customers
            </button>
            <button
              onClick={() => { setActiveTab('birthdays'); setPage(1); setSelectedFilters([]); }}
              className={clsx(
                'pb-2.5 text-sm font-bold transition-all cursor-pointer border-b-2 px-1 -mb-[1px]',
                activeTab === 'birthdays' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              )}
            >
              Upcoming Birthdays
            </button>
          </div>
          
          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          {/* Quick Filter Pills — context-aware per tab */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {activeTab === 'contacts' && (
              <>
                <button
                  type="button"
                  onClick={() => toggleFilter('Active')}
                  className={clsx(
                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-xs',
                    selectedFilters.includes('Active') ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  )}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => toggleFilter('Inactive')}
                  className={clsx(
                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-xs',
                    selectedFilters.includes('Inactive') ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  )}
                >
                  Inactive
                </button>
              </>
            )}
            {activeTab === 'leads' && (
              <>
                <button
                  type="button"
                  onClick={() => toggleFilter('Hot')}
                  className={clsx(
                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-xs',
                    selectedFilters.includes('Hot') ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <Flame size={12} className={selectedFilters.includes('Hot') ? 'text-white' : 'text-orange-500'} /> Hot
                </button>
                <button
                  type="button"
                  onClick={() => toggleFilter('Interested')}
                  className={clsx(
                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-xs',
                    selectedFilters.includes('Interested') ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <Star size={12} className={selectedFilters.includes('Interested') ? 'text-white' : 'text-blue-500'} /> Interested
                </button>
                <button
                  type="button"
                  onClick={() => toggleFilter('Health')}
                  className={clsx(
                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-xs',
                    selectedFilters.includes('Health') ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <Heart size={12} className={selectedFilters.includes('Health') ? 'text-white' : 'text-rose-500'} /> Health
                </button>
                <button
                  type="button"
                  onClick={() => toggleFilter('Term')}
                  className={clsx(
                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-xs',
                    selectedFilters.includes('Term') ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <Shield size={12} className={selectedFilters.includes('Term') ? 'text-white' : 'text-emerald-500'} /> Term
                </button>
              </>
            )}
            {activeTab === 'customers' && (
              <>
                <button
                  type="button"
                  onClick={() => toggleFilter('Renew Due')}
                  className={clsx(
                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-xs',
                    selectedFilters.includes('Renew Due') ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <Flame size={12} className={selectedFilters.includes('Renew Due') ? 'text-white' : 'text-orange-500'} /> Renew Due
                </button>
                <button
                  type="button"
                  onClick={() => toggleFilter('Active Claim')}
                  className={clsx(
                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-xs',
                    selectedFilters.includes('Active Claim') ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <Star size={12} className={selectedFilters.includes('Active Claim') ? 'text-white' : 'text-amber-500'} /> Active Claim
                </button>
                <button
                  type="button"
                  onClick={() => toggleFilter('Health')}
                  className={clsx(
                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-xs',
                    selectedFilters.includes('Health') ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <Heart size={12} className={selectedFilters.includes('Health') ? 'text-white' : 'text-rose-500'} /> Health
                </button>
                <button
                  type="button"
                  onClick={() => toggleFilter('Term')}
                  className={clsx(
                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-xs',
                    selectedFilters.includes('Term') ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <Shield size={12} className={selectedFilters.includes('Term') ? 'text-white' : 'text-emerald-500'} /> Term
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right Side Actions: Search, Date, Export, Settings */}
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {/* Search bar inside table toolbar */}
          <div className="relative w-full sm:w-44">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
              placeholder={activeTab === 'leads' ? 'Search leads...' : activeTab === 'customers' ? 'Search customers...' : 'Search contacts...'}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-xs">
            <Calendar size={13} className="text-slate-400 shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className="bg-transparent border-0 outline-none text-[10px] text-slate-700 w-24 focus:ring-0 p-0 cursor-pointer"
              title="From Date"
            />
            <span className="text-slate-300">-</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1); }}
              className="bg-transparent border-0 outline-none text-[10px] text-slate-700 w-24 focus:ring-0 p-0 cursor-pointer"
              title="To Date"
            />
          </div>

          {/* Column Visibility Picker Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setShowColPicker(!showColPicker)}
              className={clsx(
                "p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-600 cursor-pointer shadow-xs",
                showColPicker && "bg-blue-50 border-blue-200 text-blue-600"
              )}
              title="Toggle columns"
            >
              <Settings size={13} />
            </button>
            {showColPicker && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-50 text-xs space-y-2">
                <p className="font-bold text-gray-500 uppercase tracking-wider mb-1 text-[10px]">Show Columns</p>
                {(activeTab === 'birthdays' ? BIRTHDAY_COLS : activeTab === 'leads' ? LEAD_COLS : activeTab === 'customers' ? CUSTOMER_COLS : CONTACT_COLS).map(c => {
                  if (c.key === 'actions') return null;
                  return (
                    <label key={String(c.key)} className="flex items-center gap-2 cursor-pointer font-medium text-gray-700 hover:text-blue-600 transition-colors">
                      <input
                        type="checkbox"
                        checked={visibleColumns[String(c.key)] !== false}
                        onChange={() => setVisibleColumns(prev => ({ ...prev, [String(c.key)]: !prev[String(c.key)] }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{c.label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <button 
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-600 cursor-pointer shadow-xs"
          >
            <Filter size={13} />
          </button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="card grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50/50 rounded-2xl border border-slate-100 p-4 mb-2 animate-fadeIn">
          <div>
            <label className="label text-[10px] font-bold text-slate-400">Assigned Agent</label>
            <select
              value={leadInfoFields.assignedEmployeeId}
              onChange={e => setLeadInfoFields(prev => ({ ...prev, assignedEmployeeId: e.target.value }))}
              className="input"
            >
              <option value="">All Agents</option>
              {employees?.map((emp: any) => (
                <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-[10px] font-bold text-slate-400">Lead Source</label>
            <select
              value={leadInfoFields.leadSource}
              onChange={e => setLeadInfoFields(prev => ({ ...prev, leadSource: e.target.value }))}
              className="input"
            >
              <option value="By Agent">By Agent</option>
              <option value="Online">Online</option>
              <option value="Referral">Referral</option>
              <option value="Walk-in">Walk-in</option>
            </select>
          </div>
          {activeTab === 'leads' && (
            <div>
              <label className="label text-[10px] font-bold text-slate-400">Lead Status</label>
              <select
                value={leadInfoFields.leadStatus}
                onChange={e => setLeadInfoFields(prev => ({ ...prev, leadStatus: e.target.value }))}
                className="input"
              >
                <option value="OPEN">New</option>
                <option value="CONTACTED">Follow Up</option>
                <option value="IN_DISCUSSION">Interested</option>
                <option value="PROPOSAL_SENT">Proposal</option>
                <option value="LOGIN_PROGRESS">Negotiation</option>
                <option value="PAYMENT_DONE">Closed</option>
                <option value="LOST">Lost</option>
              </select>
            </div>
          )}
          <div>
            <label className="label text-[10px] font-bold text-slate-400">Product Type</label>
            <div className="flex items-center gap-2 mt-1">
              <select
                value={filterProduct}
                onChange={e => setFilterProduct(e.target.value)}
                className="input py-1.5 text-xs flex-1"
              >
                <option value="ALL">All Categories</option>
                <option value="HEALTH">Health</option>
                <option value="LIFE">Life</option>
                <option value="MF">MF (Mutual Funds)</option>
                <option value="ACCIDENT">Accident</option>
                <option value="OTHER">Other</option>
              </select>
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-1.5 rounded-lg shadow-xs shrink-0 hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={excludeProduct}
                  onChange={e => setExcludeProduct(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
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
          total={activeTab === 'leads' ? leadsRes?.meta?.total : activeTab === 'birthdays' ? birthdayList.length : contactsRes?.meta?.total}
          page={page}
          pageSize={20}
          loading={activeTab === 'leads' ? leadsLoading : activeTab === 'birthdays' ? birthdayLoading : contactsLoading}
          rowKey={r => r.id}
          onPageChange={setPage}
          onSort={(key, dir) => {
            setSortKey(key);
            setSortDir(dir);
          }}
          onRowClick={r => {
            if (activeTab === 'leads') {
              openLeadEdit(r);
            } else if (activeTab === 'customers' || activeTab === 'contacts') {
              openEdit(r);
            } else {
              const cid = r.contactId || r.id;
              setSelectedDetailId(cid);
              setDetailModalOpen(true);
            }
          }}
        />
      </div>

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editTarget ? 'Edit Contact' : 'Add Contact'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">First Name *</label>
              <input {...register('firstName')} className="input" />
              {errors.firstName && <p className="text-xs text-red-500">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="label">Last Name *</label>
              <input {...register('lastName')} className="input" />
              {errors.lastName && <p className="text-xs text-red-500">{errors.lastName.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Phone *</label>
              <input {...register('phone')} type="tel" className="input" />
              {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="label">Alternate Phone</label>
              <input {...register('alternatePhone')} type="tel" className="input" />
            </div>
          </div>

          <div>
            <label className="label">Email</label>
            <input {...register('email')} type="email" className="input" />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Gender</label>
              <select {...register('gender')} className="input">
                <option value="">— Select —</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Date of Birth</label>
              <input {...register('dateOfBirth')} type="date" className="input" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">PAN Number</label>
              <input {...register('panNumber')} className="input" placeholder="ABCDE1234F" style={{ textTransform: 'uppercase' }} />
            </div>
            <div>
              <label className="label">Aadhaar Number</label>
              <input {...register('aadhaarNumber')} className="input" placeholder="XXXX XXXX XXXX" />
            </div>
          </div>

          <div>
            <label className="label">Annual Income (₹)</label>
            <input {...register('annualIncome')} type="number" min="0" className="input" placeholder="e.g. 500000" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">City</label>
              <input {...register('city')} className="input" placeholder="e.g. Mumbai" />
            </div>
            <div>
              <label className="label">Source</label>
              <select {...register('source')} className="input">
                <option value="">— Select Source —</option>
                <option value="Excel Import">Excel Import</option>
                <option value="Website Inquiry">Website Inquiry</option>
                <option value="Referral">Referral</option>
                <option value="Walk-in Visitor">Walk-in Visitor</option>
                <option value="Social Media">Social Media</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Assigned To</label>
              <select {...register('assignedEmployeeId')} className="input">
                <option value="">— Unassigned —</option>
                {employees?.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea {...register('notes')} className="input" rows={2} placeholder="Any additional notes…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tags <span className="text-gray-400 font-normal">(comma-separated)</span></label>
              <input {...register('tags')} className="input" placeholder="vip, health, life" />
            </div>
            <div>
              <label className="label">Status</label>
              <select {...register('isActive')} className="input">
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <span className="label text-[10px] font-bold text-gray-500 block">Medical Conditions</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {['Diabetes', 'Hypertension', 'Asthma', 'Heart Condition', 'Thyroid'].map((cond) => {
                const has = formMedHistory.includes(cond);
                return (
                  <label key={cond} className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md text-[10px] font-semibold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="rounded border-gray-350 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      checked={has}
                      onChange={() => {
                        setFormMedHistory(prev =>
                          has ? prev.filter(x => x !== cond) : [...prev, cond]
                        );
                      }}
                    />
                    <span>{cond}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between">
              <span className="label text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Family & Relationships</span>
              <button
                type="button"
                onClick={() => {
                  setShowAddRelForm(true);
                  setNewRelType('SPOUSE');
                  setNewRelName('');
                  setNewRelPhone('');
                  setNewRelDob('');
                }}
                className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus size={10} /> Add Relation
              </button>
            </div>

            {formRelationships.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {formRelationships.map((r, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 text-xs">
                    <div>
                      <span className="font-extrabold text-blue-600 uppercase text-[9px] mr-2 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">{r.relationshipType}</span>
                      <span className="font-semibold text-gray-700">{r.name || (r.relatedContact ? `${r.relatedContact.firstName} ${r.relatedContact.lastName}` : '—')}</span>
                      {r.phone && <span className="text-gray-400 font-normal text-[10px] ml-1.5">({r.phone})</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (r.id) {
                          deleteRelationshipMutation.mutate(r.id);
                        }
                        setFormRelationships(prev => prev.filter((_, i) => i !== idx));
                      }}
                      className="text-slate-400 hover:text-red-500 p-1 cursor-pointer transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showAddRelForm && (
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 space-y-2.5 animate-fadeIn">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 block uppercase">Relation *</label>
                    <select
                      value={newRelType}
                      onChange={e => setNewRelType(e.target.value)}
                      className="input py-1.5 text-xs"
                    >
                      <option value="SPOUSE">Spouse</option>
                      <option value="CHILD">Child</option>
                      <option value="PARENT">Parent</option>
                      <option value="SIBLING">Sibling</option>
                      <option value="NOMINEE">Nominee</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 block uppercase">Name *</label>
                    <input
                      type="text"
                      value={newRelName}
                      onChange={e => setNewRelName(e.target.value)}
                      placeholder="Full name"
                      className="input py-1.5 text-xs"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 block uppercase">Phone</label>
                    <input
                      type="tel"
                      value={newRelPhone}
                      onChange={e => setNewRelPhone(e.target.value)}
                      placeholder="Phone number"
                      className="input py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 block uppercase">DOB</label>
                    <input
                      type="date"
                      value={newRelDob}
                      onChange={e => setNewRelDob(e.target.value)}
                      className="input py-1.5 text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddRelForm(false)}
                    className="px-2.5 py-1 text-[10px] font-semibold text-gray-500 hover:bg-gray-100 rounded-md cursor-pointer border border-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newRelName.trim()) {
                        toast.error('Relation Name is required');
                        return;
                      }
                      setFormRelationships(prev => [
                        ...prev,
                        {
                          relationshipType: newRelType,
                          name: newRelName,
                          phone: newRelPhone || undefined,
                          dateOfBirth: newRelDob || undefined,
                        }
                      ]);
                      setShowAddRelForm(false);
                    }}
                    className="px-2.5 py-1 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createContact.isPending || updateContact.isPending}>
              {editTarget ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

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
            ? (leadInfoFields.profileType === 'Client Profile' ? "Edit Client Profile" : "Edit Lead Profile")
            : (leadInfoFields.profileType === 'Client Profile' ? "Add New Client" : "Capture New Lead")
        }
        subtitle={
          editContactId
            ? (leadInfoFields.profileType === 'Client Profile' ? "Update client profile and policies." : "Update lead information and status.")
            : (leadInfoFields.profileType === 'Client Profile' ? "Manage client profile and policies." : "Manage lead information and status.")
        }
        size="xl"
        actions={
          <div className="flex gap-2 mr-2">
            {editContactId ? (
              <button
                type="button"
                className="btn-primary px-4 py-1.2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer"
                onClick={(e) => handleLeadSubmit(e, true)}
                disabled={createLeadMutation.isPending}
              >
                {createLeadMutation.isPending ? 'Updating…' : 'Update'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-secondary px-3 py-1.2 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
                  onClick={(e) => handleLeadSubmit(e, false)}
                  disabled={createLeadMutation.isPending}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="btn-primary px-3 py-1.2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer"
                  onClick={(e) => handleLeadSubmit(e, true)}
                  disabled={createLeadMutation.isPending}
                >
                  {createLeadMutation.isPending ? 'Saving…' : 'Save & Close'}
                </button>
              </>
            )}
          </div>
        }
      >
        <form className="space-y-4">

          {/* Modal sub-navigation tabs */}
          <div className="flex bg-slate-100/60 p-1 rounded-xl mb-4 gap-1 border border-slate-200/40 overflow-x-auto">
            {['Lead Info', 'Personal', 'Family', 'Policy', 'WA Campaign', 'History'].map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveLeadTab(tab)}
                className={clsx(
                  'px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap',
                  activeLeadTab === tab ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab contents */}
          <div className="h-[360px] overflow-y-auto pr-1">
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

            {activeLeadTab === 'Lead Info' && (
              <div className="grid grid-cols-2 gap-6 text-xs h-full">
                {/* Left Column */}
                <div className="space-y-4 flex flex-col justify-between">
                  {/* Profile Type */}
                  {leadInfoFields.profileType !== 'Client Profile' && (
                    <div>
                      <label className="label text-[11px] font-bold text-gray-500 uppercase tracking-wider">Profile Type</label>
                      <div className="flex gap-2 mt-1.5">
                        {['Lead Profile', 'Client Profile'].map(type => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setLeadInfoFields(l => ({ ...l, profileType: type }))}
                            className={clsx(
                              'px-4 py-1.5 rounded-lg font-semibold border transition-all cursor-pointer text-xs',
                              leadInfoFields.profileType === type
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            )}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Interested In */}
                  <div>
                    <label className="label text-[11px] font-bold text-gray-500 uppercase tracking-wider">Interested In</label>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {['Health', 'Term', 'Mutual Funds', 'Pooling', 'Other'].map(prod => {
                        const isSelected = leadInfoFields.interestedIn.includes(prod);
                        return (
                          <button
                            key={prod}
                            type="button"
                            onClick={() => setLeadInfoFields(l => {
                              const exists = l.interestedIn.includes(prod);
                              const next = exists
                                ? l.interestedIn.filter(p => p !== prod)
                                : [...l.interestedIn, prod];
                              return { ...l, interestedIn: next };
                            })}
                            className={clsx(
                              'px-3 py-1.5 rounded-full font-semibold border transition-all cursor-pointer text-xs',
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-100 hover:bg-gray-50'
                            )}
                          >
                            {prod}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Consultation History */}
                  <div className="flex flex-col">
                    <label className="label text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Consultation History</label>
                    <div className="h-20 border border-gray-200 rounded-lg p-2 overflow-y-auto bg-gray-50 flex flex-col text-left">
                      {leadComments.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-center">
                          <span className="text-gray-400 text-[10px]">No comments recorded</span>
                        </div>
                      ) : (
                        <div className="w-full space-y-1">
                          {leadComments.map((c, i) => (
                            <p key={i} className="text-[10px] text-gray-700 bg-white p-1.5 rounded shadow-sm border border-gray-100">{c}</p>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        placeholder="Type new comment..."
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs outline-none bg-white text-gray-800 placeholder-gray-400 focus:border-blue-500 transition-all"
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                      />
                      <button
                        type="button"
                        className="bg-gray-800 hover:bg-gray-900 text-white px-3 py-1.5 rounded-lg font-semibold cursor-pointer text-xs transition-colors"
                        onClick={() => {
                          if (newComment.trim()) {
                            setLeadComments(c => [...c, newComment.trim()]);
                            setNewComment('');
                          }
                        }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  {/* Lead Status */}
                  <div>
                    <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Lead Status</label>
                    <select
                      className="input w-full"
                      value={leadInfoFields.leadStatus}
                      onChange={e => setLeadInfoFields(l => ({ ...l, leadStatus: e.target.value }))}
                    >
                      <option value="OPEN">Cold</option>
                      <option value="CONTACTED">Warm (Follow Up)</option>
                      <option value="IN_DISCUSSION">Hot (Interested)</option>
                      <option value="PROPOSAL_SENT">Proposal</option>
                      <option value="LOGIN_PROGRESS">Negotiation</option>
                      <option value="PAYMENT_DONE">Closed</option>
                      <option value="LOST">Lost</option>
                    </select>
                  </div>

                  {/* Lead Source */}
                  <div>
                    <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Lead Source</label>
                    <select
                      className="input w-full"
                      value={leadInfoFields.leadSource}
                      onChange={e => setLeadInfoFields(l => ({ ...l, leadSource: e.target.value }))}
                    >
                      <option value="By Agent">By Agent</option>
                      <option value="Website">Website</option>
                      <option value="Social Media">Social Media</option>
                      <option value="Referral">Referral</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Assigned Employee */}
                  <div>
                    <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Assigned Employee</label>
                    <select
                      className="input w-full"
                      value={leadInfoFields.assignedEmployeeId}
                      onChange={e => setLeadInfoFields(l => ({ ...l, assignedEmployeeId: e.target.value }))}
                    >
                      <option value="">Select Employee</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Follow up Date */}
                  <div>
                    <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Follow-up Date</label>
                    <input
                      type="date"
                      className="input w-full"
                      value={leadInfoFields.followUpDate}
                      onChange={e => setLeadInfoFields(l => ({ ...l, followUpDate: e.target.value }))}
                    />
                  </div>

                  {/* Customer Performance Summary */}
                  {leadInfoFields.profileType === 'Client Profile' && loadedContact && (
                    <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl space-y-2 text-xs">
                      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block mb-1">Customer Performance Summary</span>
                      <div className="grid grid-cols-2 gap-2 text-gray-600">
                        <div>
                          <span className="text-[10px] text-gray-400 block uppercase">Product</span>
                          <span className="font-semibold text-gray-700 block truncate">
                            {(() => {
                              const policies = loadedContact.policies || [];
                              if (policies.length === 0) return '—';
                              return [...new Set(policies.map((p: any) => p.plan?.category || p.plan?.name).filter(Boolean))].join(', ');
                            })()}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 block uppercase">Renew Status</span>
                          <span className="font-semibold text-gray-700 block">
                            {(() => {
                              const active = (loadedContact.policies || []).filter((p: any) => p.status === 'ACTIVE');
                              if (active.length === 0) return '—';
                              const due = active.some((p: any) => p.endDate && new Date(p.endDate) <= new Date(Date.now() + 30 * 86400000));
                              return due ? <span className="text-orange-600 font-bold">Due</span> : <span className="text-green-600 font-bold">OK</span>;
                            })()}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 block uppercase">Renew Assigned</span>
                          <span className="font-semibold text-gray-700 block truncate">
                            {(() => {
                              const active = (loadedContact.policies || []).find((p: any) => p.status === 'ACTIVE' && p.assignedEmployeeId);
                              return active ? getEmployeeName(active.assignedEmployeeId) : '—';
                            })()}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 block uppercase">Claim Status</span>
                          <span className="font-semibold text-gray-700 block">
                            {(() => {
                              const claims = loadedContact.claims || [];
                              if (claims.length === 0) return 'No Claims';
                              const active = claims.find((c: any) => ['INTIMATED', 'FILED', 'IN_REVIEW'].includes(c.status));
                              return active ? <span className="text-yellow-600 font-bold uppercase">{active.status}</span> : 'No Claims';
                            })()}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[10px] text-gray-400 block uppercase">Claim Assigned</span>
                          <span className="font-semibold text-gray-700 block truncate">
                            {(() => {
                              const claims = loadedContact.claims || [];
                              const active = claims.find((c: any) => ['INTIMATED', 'FILED', 'IN_REVIEW'].includes(c.status) && c.assignedEmployeeId);
                              return active ? getEmployeeName(active.assignedEmployeeId) : '—';
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
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
