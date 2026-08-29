import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, Pencil, Trash2, Flame, Heart, Shield, Phone, MessageCircle, Upload, Star, Users,
  Calendar, Award, TrendingUp, Filter, Settings, UserPlus, UserCircle2, ChevronDown, ChevronUp, Send, Save, FileText, History, UserCheck
} from 'lucide-react';
import { useContacts, useCreateContact, useUpdateContact, useDeleteContact, useUpcomingBirthdays } from '@hooks/useContacts';
import { deletionRequestsService } from '@api/deletionRequestsService';
import { useLookupStore } from '@store/lookup.store';
import { contactsService, policiesService, claimsService, leadsService, insuranceService } from '@api/index';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import DataTable, { Column } from '@comps/common/DataTable';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, differenceInDays } from 'date-fns';
import clsx from 'clsx';
import { DatePicker } from '@comps/common/DatePicker';
import toast from 'react-hot-toast';

import { useAuthStore } from '@store/auth.store';
import { sortData } from '../../utils/sortUtils';
import ContactDetailModal from './ContactDetailModal';
import PolicyDetailModal from '../Policies/PolicyDetailModal';
import CreatePolicyModal from '../Policies/CreatePolicyModal';
import * as XLSX from 'xlsx';
import { CountryPhoneInput } from '@comps/common/CountryPhoneInput';
import { DatalistInput } from '@comps/common/DatalistInput';

const EDUCATION_OPTIONS = [
  'Metric',
  'Intermediate',
  'Graduate',
  'Post Graduate',
  'Up to 9th class passed',
  '10th class passed',
  'Post Graduate (Gen)',
  'Med Graduate',
  'Post Graduate, Eng',
  'Law Graduate / Post Graduate',
  'CA/ICWA/MBA/CFA',
  'Computer degree other',
  'Other',
];

const OCCUPATION_TYPE_OPTIONS = [
  'Salaried Private',
  'Salaried Gov',
  'Salaried/Service',
  'Business Owner',
  'Business',
  'Industrialist',
  'Self Employed Professional',
  'Agriculture',
  'Student',
  'Retired',
  'Homemaker',
  'Other',
];

export const contactFormSchema = z.object({
  // System fields mapping
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
const schema = contactFormSchema;
type Form = z.infer<typeof schema>;

interface Contact {
  id: string; firstName: string; lastName: string; phone: string; email?: string;
  alternatePhone?: string; gender?: string; dateOfBirth?: string;
  panNumber?: string; aadhaarNumber?: string; annualIncome?: number;
  notes?: string; tags?: string[]; isActive: boolean;
}

const MEDICAL_CONDITIONS_LIST = [
  'Diabetes Mellitus',
  'High BP / Cholesterol',
  'Heart Disease',
  'Tuberculosis',
  'Asthma',
  'Other Respiratory Infection',
  'Disease of bones/joints',
  'Slip disc',
  'Spinal Disorder',
  'Ligament Injury',
  'Cancer',
  'Gynecological disorder (DUB, Fibroid Uterus, Ovarian cyst)',
  'Undergone Cesarean / Hysterectomy',
  'Disease of Stomach / Intestine',
  'Liver / Gall Bladder / Pancreas',
  'Kidney / Urinary Bladder / Urinary Tract Disease',
  'Disease of Prostate / Fistula / Piles / Genital Disease',
  'Cataract or Other Disease of Eye and ENT',
  'Thyroid',
  'Others'
];

function MultiSelectBox({
  label,
  selectedValues,
  onChange,
  badgeColor = 'blue',
  placeholder = 'Select Conditions...'
}: {
  label: string;
  selectedValues: string[];
  onChange: (vals: string[]) => void;
  badgeColor?: 'blue' | 'orange';
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = MEDICAL_CONDITIONS_LIST.filter(opt =>
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleOption = (opt: string) => {
    if (selectedValues.includes(opt)) {
      onChange(selectedValues.filter(o => o !== opt));
    } else {
      onChange([...selectedValues, opt]);
    }
  };

  return (
    <div className="relative">
      <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">{label}</label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="input min-h-[40px] w-full cursor-pointer flex items-center justify-between gap-2 flex-wrap py-1.5 px-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all"
      >
        {selectedValues.length === 0 ? (
          <span className="text-slate-400 text-xs font-normal">{placeholder}</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {selectedValues.map((val, idx) => (
              <span
                key={idx}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                  badgeColor === 'orange'
                    ? 'bg-orange-50 text-orange-700 border-orange-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}
              >
                {val}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(selectedValues.filter(v => v !== val));
                  }}
                  className="hover:text-red-600 font-bold cursor-pointer ml-0.5"
                >
                  ×
                </span>
              </span>
            ))}
          </div>
        )}
        <span className="text-slate-400 text-[10px] ml-auto">▼</span>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl p-2.5 max-h-60 overflow-y-auto">
            <input
              type="text"
              className="input w-full text-xs py-1.5 px-2.5 mb-2 border border-slate-200 rounded-lg"
              placeholder="Type to search condition..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="space-y-0.5">
              {filteredOptions.map((opt) => {
                const isChecked = selectedValues.includes(opt);
                return (
                  <label
                    key={opt}
                    className="flex flex-wrap items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-xs select-none"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className={`w-3.5 h-3.5 rounded cursor-pointer ${badgeColor === 'orange' ? 'accent-orange-500' : 'accent-blue-600'}`}
                      checked={isChecked}
                      onChange={() => toggleOption(opt)}
                    />
                    <span className={`font-medium ${isChecked ? 'text-slate-900 font-bold' : 'text-slate-600'}`}>
                      {opt}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import { canEditModule, canManageModule } from '../../utils/permissions';

export default function Contacts() {
  const user = useAuthStore(s => s.user);
  const canEditContacts = canEditModule(user, 'contacts');
  const canManageContacts = canManageModule(user, 'contacts');
  const navigate = useNavigate();
  const location = useLocation();
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
      openCustomerCreate();
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
  const [selectedPolicyModalId, setSelectedPolicyModalId] = useState<string | null>(null);
  const [createPolicyModalOpen, setCreatePolicyModalOpen] = useState(false);
  const [expandedPolicyIds, setExpandedPolicyIds] = useState<Record<string, boolean>>({});
  const [policyToEdit, setPolicyToEdit] = useState<any | null>(null);
  const { user: authUser } = useAuthStore();
  const [formMedHistory, setFormMedHistory] = useState<string[]>([]);
  const [formRelationships, setFormRelationships] = useState<any[]>([]);

  // 15 Detailed Filter State Variables for Contacts Page
  const [filterFollowUpFrom, setFilterFollowUpFrom] = useState('');
  const [filterFollowUpTo, setFilterFollowUpTo] = useState('');
  const [filterGender, setFilterGender] = useState('ALL');
  const [filterMaritalStatus, setFilterMaritalStatus] = useState('ALL');
  const [filterAgeRange, setFilterAgeRange] = useState('ALL');
  const [filterIncomeRange, setFilterIncomeRange] = useState('ALL');
  const [filterEducation, setFilterEducation] = useState('ALL');
  const [filterOccupation, setFilterOccupation] = useState('ALL');
  const [filterResidency, setFilterResidency] = useState('ALL');
  const [filterState, setFilterState] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterBank, setFilterBank] = useState('');
  const [filterMedicalHistory, setFilterMedicalHistory] = useState<string[]>([]);
  const [filterActiveStatus, setFilterActiveStatus] = useState('ALL');
  const [filterPolicyCombo, setFilterPolicyCombo] = useState('ALL');
  const [filterRole, setFilterRole] = useState('ALL');

  const resetAllContactsFilters = () => {
    setFilterFollowUpFrom('');
    setFilterFollowUpTo('');
    setFilterGender('ALL');
    setFilterMaritalStatus('ALL');
    setFilterAgeRange('ALL');
    setFilterIncomeRange('ALL');
    setFilterEducation('ALL');
    setFilterOccupation('ALL');
    setFilterResidency('ALL');
    setFilterState('');
    setFilterCity('');
    setFilterBank('');
    setFilterMedicalHistory([]);
    setFilterActiveStatus('ALL');
    setFilterPolicyCombo('ALL');
    setFilterRole('ALL');
    setFilterProducts([]);
    setExcludeProduct(false);
    setDateFrom('');
    setDateTo('');
    setSearch('');
    setSelectedFilters([]);
  };

  const activeContactsFilterCount = useMemo(() => {
    let count = 0;
    if (filterFollowUpFrom || filterFollowUpTo) count++;
    if (filterGender !== 'ALL') count++;
    if (filterMaritalStatus !== 'ALL') count++;
    if (filterAgeRange !== 'ALL') count++;
    if (filterIncomeRange !== 'ALL') count++;
    if (filterEducation !== 'ALL') count++;
    if (filterOccupation !== 'ALL') count++;
    if (filterResidency !== 'ALL') count++;
    if (filterState) count++;
    if (filterCity) count++;
    if (filterBank) count++;
    if (filterMedicalHistory.length > 0) count++;
    if (filterActiveStatus !== 'ALL') count++;
    if (filterPolicyCombo !== 'ALL') count++;
    if (filterRole !== 'ALL') count++;
    if (filterProducts.length > 0) count++;
    if (dateFrom || dateTo) count++;
    return count;
  }, [
    filterFollowUpFrom, filterFollowUpTo, filterGender, filterMaritalStatus, filterAgeRange,
    filterIncomeRange, filterEducation, filterOccupation, filterResidency, filterState,
    filterCity, filterBank, filterMedicalHistory, filterActiveStatus, filterPolicyCombo,
    filterRole, filterProducts, dateFrom, dateTo
  ]);

  const exportContactsToExcel = () => {
    const dataToExport = sortedAndFilteredData.map((c: any) => {
      const contactPolicies = policyMap[c.id] ?? c.policies ?? [];
      const policySummary = contactPolicies.map((p: any) => p.plan?.name || p.plan?.category || p.policyNumber).join('; ');
      return {
        'Contact ID': c.contactId || c.id,
        'First Name': c.firstName || c.contact?.firstName || '',
        'Last Name': c.lastName || c.contact?.lastName || '',
        'Phone / WhatsApp': c.phone || c.contact?.phone || '',
        'Email': c.email || c.contact?.email || '',
        'Gender': c.gender || c.contact?.gender || '',
        'Marital Status': c.maritalStatus || c.contact?.maritalStatus || '',
        'Date of Birth': c.dateOfBirth ? new Date(c.dateOfBirth).toLocaleDateString() : '',
        'Annual Income': c.annualIncome || '',
        'Education': c.education || '',
        'Occupation': c.occupationType || c.contact?.occupations?.[0]?.type || '',
        'State': c.state || c.contact?.addresses?.[0]?.state || '',
        'City': c.city || c.contact?.addresses?.[0]?.city || '',
        'Bank Name': c.bankName || c.contact?.bankAccounts?.[0]?.bankName || '',
        'Lead Stage': c.leadStage || '',
        'Lead Status': c.leadStatus || '',
        'Next Follow-up': c.followUpDate ? new Date(c.followUpDate).toLocaleDateString() : '',
        'Policies': policySummary || 'None',
        'Status': c.isActive !== false ? 'Active' : 'Inactive',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');
    XLSX.writeFile(workbook, `contacts_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Contacts exported to Excel successfully!');
  };

  const exportContactsToPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups to print PDF');
      return;
    }

    const rowsHtml = sortedAndFilteredData.map((c: any) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 8px;">${((c.firstName || '') + ' ' + (c.lastName || '')).trim() || 'N/A'}</td>
        <td style="padding: 8px; font-weight: 600;">${c.phone || 'N/A'}</td>
        <td style="padding: 8px;">${c.email || 'N/A'}</td>
        <td style="padding: 8px;">${c.city || c.contact?.addresses?.[0]?.city || 'N/A'}</td>
        <td style="padding: 8px;">${c.leadStage || 'N/A'}</td>
        <td style="padding: 8px;">${c.leadStatus || 'N/A'}</td>
        <td style="padding: 8px; text-align: center;"><span style="padding: 2px 6px; border-radius: 4px; background: ${c.isActive !== false ? '#def7ec; color: #03543f;' : '#fde8e8; color: #9b1c1c;'} font-size: 10px; font-weight: bold;">${c.isActive !== false ? 'Active' : 'Inactive'}</span></td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Contacts Export Report</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; padding: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 10px 8px; text-align: left; font-size: 11px; font-weight: bold; text-transform: uppercase; color: #64748b; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 12px; }
            .title { font-size: 20px; font-weight: 800; color: #1e3a8a; }
            .meta { font-size: 11px; color: #64748b; text-align: right; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">INSU-MITRA</div>
              <div style="font-size: 12px; color: #475569; font-weight: 600;">Contacts Export Report</div>
            </div>
            <div class="meta">
              <div>Date: ${new Date().toLocaleString()}</div>
              <div>Record Count: ${sortedAndFilteredData.length}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 25%;">Name</th>
                <th style="width: 15%;">Phone</th>
                <th style="width: 20%;">Email</th>
                <th style="width: 15%;">City</th>
                <th style="width: 10%;">Stage</th>
                <th style="width: 10%;">Status</th>
                <th style="width: 5%; text-align: center;">Active</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

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
  const [isViewMode, setIsViewMode] = useState(false);
  const [activeLeadTab, setActiveLeadTab] = useState('Personal');

  type PersonalFields = Record<string, any>;

  const [personalFields, setPersonalFields] = useState<PersonalFields>({
    firstName: '',
    middleName: '',
    lastName: '',
    fullName: '',
    gender: '',
    maritalStatus: '',
    dateOfBirth: '',
    age: '',
    height: '',
    weight: '',
    pan: '',
    panNumber: '',
    declaredMedicalHistory: [] as string[],
    notDeclaredMedicalHistory: [] as string[],
    medicalHistoryDetails: "",
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
    streetAddress: '',
    bankName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    bankBranch: '',
    chewTobacco: false,
    smoke: false,
    consumeAlcohol: false,
    surgeryDetails: '',
    prescriptionDetails: ''
  });

  const [leadInfoFields, setLeadInfoFields] = useState({
    profileType: 'Lead Profile', // 'Lead Profile' | 'Client Profile'
    leadStatus: 'OPEN',
    interestedIn: ['Health'], // Health, Term, Mutual Funds, Pooling, Other
    leadSource: 'Walk-in',
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
    descriptionDetails?: string;
    leadStage: string;
    leadStatus: string;
    dependencyType?: string;
    dependentDetails?: string;
    leadType: string;
    leadSource: string;
    assignedEmployeeId: string;
    followUpDate: string;
    expectedPremium: string;
    comments: ProductComment[];
    newComment: string;
    showAllComments?: boolean;
  };

  function parseLeadNotes(notesText?: string | null) {
    const res = {
      leadStatus: 'INTERESTED',
      leadType: 'FRESH',
      cleanNotes: '',
      dependencyType: 'SELF',
      dependentDetails: '',
      descriptionDetails: '',
    };
    if (!notesText) return res;
    if (notesText.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(notesText);
        res.leadStatus = parsed.leadStatus || 'INTERESTED';
        res.leadType = parsed.leadType || 'FRESH';
        res.cleanNotes = parsed.cleanNotes || '';
        res.dependencyType = parsed.dependencyType || 'SELF';
        res.dependentDetails = parsed.dependentDetails || '';
        res.descriptionDetails = parsed.descriptionDetails || '';
        return res;
      } catch (e) { }
    }
    const lines = notesText.split('\n');
    const cleanLines: string[] = [];
    lines.forEach(line => {
      if (line.startsWith('Status: ')) {
        res.leadStatus = line.replace('Status: ', '').trim();
      } else if (line.startsWith('Type: ')) {
        res.leadType = line.replace('Type: ', '').trim();
      } else if (line.startsWith('Dependency: ')) {
        res.dependencyType = line.replace('Dependency: ', '').trim();
      } else if (line.startsWith('Dependent Details: ')) {
        res.dependentDetails = line.replace('Dependent Details: ', '').trim();
      } else if (line.startsWith('Description Details: ')) {
        res.descriptionDetails = line.replace('Description Details: ', '').trim();
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
      dependencyType: card.dependencyType || 'SELF',
      dependentDetails: card.dependencyType === 'DEPENDENT' ? (card.dependentDetails || '') : '',
      descriptionDetails: card.descriptionDetails || '',
      cleanNotes: card.otherProduct ? `Other Product: ${card.otherProduct}` : '',
    });
  }

  const newProductInterestCard = (): ProductInterestCard => ({
    id: Math.random().toString(36).slice(2),
    collapsed: false,
    interestedIn: [],
    otherProduct: '',
    descriptionDetails: '',
    leadStage: 'TO_CONTACT',
    leadStatus: 'INTERESTED',
    dependencyType: 'SELF',
    dependentDetails: '',
    leadType: 'FRESH',
    leadSource: 'Walk-in',
    assignedEmployeeId: '',
    followUpDate: '',
    expectedPremium: '',
    comments: [],
    newComment: '',
    showAllComments: false,
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

  const saveProductInterestCard = async (cardId: string) => {
    if (!editContactId) {
      toast.error('Please save the contact details first');
      return;
    }
    const card = productInterests.find(c => c.id === cardId);
    if (!card) return;

    const isExisting = card.id.length === 24 || /^[0-9a-fA-F]{24}$/.test(card.id);

    // If new card, validate all required fields
    if (!isExisting) {
      if (!card.interestedIn || card.interestedIn.length === 0) {
        toast.error('Please select at least one Product Category (Interested In)');
        return;
      }
      if (card.interestedIn.includes('Other') && !card.otherProduct?.trim()) {
        toast.error('Please specify the Other Product Name');
        return;
      }
      if (card.dependencyType === 'DEPENDENT' && !card.dependentDetails?.trim()) {
        toast.error('Please enter dependent details (Name/Relation)');
        return;
      }
      if (!card.leadSource?.trim()) {
        toast.error('Please select or enter a Lead Source');
        return;
      }
      if (!card.followUpDate?.trim()) {
        toast.error('Please select a Follow-up Date');
        return;
      }
      if (!card.expectedPremium || Number(card.expectedPremium) <= 0) {
        toast.error('Please enter a valid Expected Premium / Budget (> 0)');
        return;
      }
    }

    const product = card.interestedIn[0] || 'Other';
    const toastId = toast.loading(isExisting ? 'Updating product interest status...' : 'Saving product interest...');
    try {
      const interests = [product === 'Other' && card.otherProduct ? card.otherProduct : product];

      let stage = card.leadStage && card.leadStage !== 'OPEN' ? card.leadStage : 'TO_CONTACT';

      const serializedNotes = serializeLeadNotes(card);

      const validEmpId = (id?: string) => (id && /^[0-9a-fA-F]{24}$/.test(id.trim())) ? id.trim() : undefined;
      const body = {
        contactId: editContactId,
        interests,
        stage,
        source: card.leadSource,
        assignedEmployeeId: validEmpId(card.assignedEmployeeId),
        followUpDate: card.followUpDate?.trim() ? new Date(card.followUpDate).toISOString() : undefined,
        premiumBudget: Number(card.expectedPremium) || undefined,
        notes: serializedNotes,
      };

      if (isExisting) {
        await leadsService.update(card.id, body);
        toast.success('Product interest status updated successfully!', { id: toastId });
      } else {
        const res = await leadsService.create(body);
        const savedLead = res.data ?? res;
        setProductInterests(prev => prev.map(c => c.id === cardId ? { ...c, id: savedLead.id } : c));
        toast.success('Product interest created successfully!', { id: toastId });
      }
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save product interest', { id: toastId });
    }
  };

  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);

  // Family members state
  const [familyMembers, setFamilyMembers] = useState<Array<{
    contactId?: string;
    name: string; firstName: string; middleName: string; lastName: string;
    dob: string; relation: string;
    whatsapp: string; callingNumber?: string; occupation: string; education: string;
    maritalStatus?: string;
    weddingAnniversary?: string;
    age?: string;
    height?: string;
    weight?: string;
    medicalHistory: string[];
    declaredMedicalHistory?: string[];
    notDeclaredMedicalHistory?: string[];
    medicalHistoryDetails?: string;
  }>>([]);

  const addFamilyMember = () =>
    setFamilyMembers(prev => [...prev, {
      name: '', firstName: '', middleName: '', lastName: '',
      dob: '', relation: '',
      whatsapp: '', callingNumber: '', occupation: '', education: '',
      maritalStatus: '',
      weddingAnniversary: '',
      age: '',
      height: '',
      weight: '',
      medicalHistory: [],
      declaredMedicalHistory: [],
      notDeclaredMedicalHistory: [],
      medicalHistoryDetails: ''
    }]);

  const updateFamilyMember = (idx: number, field: string, value: any) =>
    setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));

  const updateFamilyMemberName = (idx: number, firstName: string, middleName: string, lastName: string) =>
    setFamilyMembers(prev => prev.map((m, i) => i === idx ? {
      ...m,
      firstName,
      middleName,
      lastName,
      name: [firstName, middleName, lastName].filter(Boolean).join(' '),
    } : m));

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

  // Personal Info Collapsed Sub-Sections State
  const [personalCollapsed, setPersonalCollapsed] = useState<Record<string, boolean>>({});
  const togglePersonalCollapse = (key: string) =>
    setPersonalCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

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
  const { employees, plans: dbPlans, loadEmployees } = useLookupStore();

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const employeesList = useMemo(() => {
    const raw = (employees as any)?.data || employees;
    return Array.isArray(raw) ? raw : [];
  }, [employees]);

  const { data: contactsRes, isLoading: contactsLoading, refetch: refetchContacts } = useContacts({
    page,
    limit: 20,
    search: search || undefined
  });

  const contactsListArray = useMemo(() => {
    if (!contactsRes) return [];
    if (Array.isArray(contactsRes.data)) return contactsRes.data;
    if (Array.isArray(contactsRes.data?.data)) return contactsRes.data.data;
    if (Array.isArray(contactsRes)) return contactsRes;
    return [];
  }, [contactsRes]);

  const { data: birthdayRes, isLoading: birthdayLoading } = useUpcomingBirthdays(30, activeTab === 'birthdays');
  const birthdayList = birthdayRes?.data ?? [];

  // Query plans for Lead creation Policy tab (using empty/mock variables to satisfy compilation)
  const leadPlansList: any[] = [];

  // Fetch policies & claims for customer tab enrichment
  const { data: policiesRes } = useQuery({
    queryKey: ['contacts-policies-list'],
    queryFn: () => policiesService.list({ limit: 200, sortBy: 'createdAt', sortOrder: 'desc' }),
    enabled: activeTab === 'customers' || leadModalOpen || createPolicyModalOpen,
    staleTime: 0,
  });

  const { data: claimsRes } = useQuery({
    queryKey: ['contacts-claims-list'],
    queryFn: () => claimsService.list({ limit: 200, sortBy: 'createdAt', sortOrder: 'desc' }),
    enabled: activeTab === 'customers' || leadModalOpen,
    staleTime: 60_000,
  });

  // Extract policy array safely handling direct arrays & paginated response structures
  const policyListArray = useMemo(() => {
    if (!policiesRes) return [];
    if (Array.isArray(policiesRes.data)) return policiesRes.data;
    if (Array.isArray(policiesRes.data?.data)) return policiesRes.data.data;
    if (Array.isArray(policiesRes)) return policiesRes;
    return [];
  }, [policiesRes]);

  // Build contactId → [policies] and contactId → [claims] maps for O(1) lookups
  const policyMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    policyListArray.forEach((p: any) => {
      const keys = [p.contactId, p.contact?.id, p.contact?.contactId].filter(Boolean);
      keys.forEach(k => {
        if (!map[k]) map[k] = [];
        map[k].push(p);
      });
    });
    return map;
  }, [policyListArray]);

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
      isDependent: false,
      dependentNo: '',
      firstName: '',
      middleName: '',
      lastName: '',
      gender: '',
      maritalStatus: '',
      dateOfBirth: '',
      age: '',
      height: '',
      weight: '',
      pan: '',
      panNumber: '',
      declaredMedicalHistory: [],
      notDeclaredMedicalHistory: [],
      medicalHistoryDetails: '',
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
      leadSource: 'Walk-in',
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
    setIsViewMode(false);
  };

  const extractNameFields = (primary: any, secondary?: any) => {
    let fn = primary?.firstName || primary?.contact?.firstName || secondary?.firstName || secondary?.contact?.firstName || '';
    let mn = primary?.middleName || primary?.contact?.middleName || secondary?.middleName || secondary?.contact?.middleName || '';
    let ln = primary?.lastName || primary?.contact?.lastName || secondary?.lastName || secondary?.contact?.lastName || '';

    if (!fn) {
      const nameStr = primary?.fullName || primary?.name || primary?.contact?.fullName || primary?.contact?.name ||
                      secondary?.fullName || secondary?.name || secondary?.contact?.fullName || secondary?.contact?.name || '';
      if (nameStr) {
        const parts = nameStr.trim().split(/\s+/);
        fn = parts[0] || '';
        if (parts.length === 2) {
          ln = parts[1] || '';
        } else if (parts.length > 2) {
          mn = parts.slice(1, -1).join(' ');
          ln = parts[parts.length - 1] || '';
        }
      }
    }
    return { firstName: fn, middleName: mn, lastName: ln };
  };

  const openLeadEdit = async (leadOrContact: any) => {
    const contactId = leadOrContact.contactId || leadOrContact.id;
    if (!contactId) {
      toast.error('Invalid contact selected');
      return;
    }

    setEditContactId(contactId);
    setEditLeadId(leadOrContact.contactId ? leadOrContact.id : (leadOrContact.productInterests?.[0]?.id || null));

    // Fallback initial values from leadOrContact row
    const fallbackContact = leadOrContact;
    setLoadedContact(fallbackContact);

    const initialNames = extractNameFields(fallbackContact);

    setPersonalFields({
      firstName: initialNames.firstName,
      middleName: initialNames.middleName,
      lastName: initialNames.lastName,
      gender: fallbackContact.gender || fallbackContact.contact?.gender || '',
      maritalStatus: fallbackContact.maritalStatus || fallbackContact.contact?.maritalStatus || '',
      dateOfBirth: fallbackContact.dateOfBirth ? fallbackContact.dateOfBirth.split('T')[0] : (fallbackContact.contact?.dateOfBirth ? fallbackContact.contact.dateOfBirth.split('T')[0] : ''),
      age: (fallbackContact.dateOfBirth || fallbackContact.contact?.dateOfBirth) ? String(calculateAge(fallbackContact.dateOfBirth || fallbackContact.contact?.dateOfBirth)) : '',
      height: fallbackContact.height ? String(fallbackContact.height) : '',
      weight: fallbackContact.weight ? String(fallbackContact.weight) : '',
      pan: fallbackContact.panNumber || fallbackContact.pan || '',
      panNumber: fallbackContact.panNumber || fallbackContact.pan || '',
      declaredMedicalHistory: [],
      notDeclaredMedicalHistory: [],
      medicalHistoryDetails: '',
      email: fallbackContact.email || fallbackContact.contact?.email || '',
      aadhaarNumber: fallbackContact.aadhaarNumber || fallbackContact.contact?.aadhaarNumber || '',
      whatsappNumber: fallbackContact.phone || fallbackContact.whatsappNumber || fallbackContact.contact?.phone || '',
      sameAsWhatsapp: (fallbackContact.phone || fallbackContact.whatsappNumber || fallbackContact.contact?.phone) === (fallbackContact.alternatePhone || fallbackContact.contact?.alternatePhone),
      callingNumber: fallbackContact.alternatePhone || fallbackContact.contact?.alternatePhone || '',
      education: fallbackContact.education || fallbackContact.contact?.education || '',
      annualIncome: (fallbackContact.annualIncome || fallbackContact.contact?.annualIncome) ? String(fallbackContact.annualIncome || fallbackContact.contact?.annualIncome) : '',
      occupationType: '',
      companyName: '',
      state: '',
      district: '',
      city: '',
      pincode: '',
      streetAddress: fallbackContact.notes || fallbackContact.contact?.notes || ''
    });

    setActiveLeadTab('Personal');
    setLeadModalOpen(true);

    const toastId = toast.loading('Loading contact details...');
    try {
      const res = await contactsService.get(contactId);
      const contact = res?.data?.data || res?.data || res;
      if (contact && contact.id) {
        setLoadedContact(contact);

        const primaryAddr = contact.addresses?.find((a: any) => a.isPrimary) || contact.addresses?.[0];
        const primaryOcc = contact.occupations?.find((o: any) => o.isPrimary) || contact.occupations?.[0];

        const updatedNames = extractNameFields(contact, fallbackContact);

        setPersonalFields({
          isDependent: !!(contact.isDependent ?? fallbackContact.isDependent),
          dependentNo: contact.dependentNo || fallbackContact.dependentNo || '',
          firstName: updatedNames.firstName,
          middleName: updatedNames.middleName,
          lastName: updatedNames.lastName,
          gender: contact.gender || fallbackContact.gender || fallbackContact.contact?.gender || '',
          maritalStatus: contact.maritalStatus || fallbackContact.maritalStatus || fallbackContact.contact?.maritalStatus || '',
          dateOfBirth: contact.dateOfBirth ? contact.dateOfBirth.split('T')[0] : (fallbackContact.dateOfBirth ? fallbackContact.dateOfBirth.split('T')[0] : ''),
          age: contact.dateOfBirth ? String(calculateAge(contact.dateOfBirth)) : (fallbackContact.dateOfBirth ? String(calculateAge(fallbackContact.dateOfBirth)) : ''),
          height: contact.height ? String(contact.height) : (fallbackContact.height ? String(fallbackContact.height) : ''),
          weight: contact.weight ? String(contact.weight) : (fallbackContact.weight ? String(fallbackContact.weight) : ''),
          pan: contact.panNumber || fallbackContact.panNumber || fallbackContact.pan || '',
          panNumber: contact.panNumber || fallbackContact.panNumber || fallbackContact.pan || '',
          declaredMedicalHistory: [],
          notDeclaredMedicalHistory: [],
          medicalHistoryDetails: '',
          email: contact.email || fallbackContact.email || fallbackContact.contact?.email || '',
          aadhaarNumber: contact.aadhaarNumber || fallbackContact.aadhaarNumber || fallbackContact.contact?.aadhaarNumber || '',
          whatsappNumber: contact.phone || fallbackContact.phone || fallbackContact.contact?.phone || '',
          sameAsWhatsapp: (contact.phone || fallbackContact.phone) === (contact.alternatePhone || fallbackContact.alternatePhone),
          callingNumber: contact.alternatePhone || fallbackContact.alternatePhone || '',
          education: contact.education || fallbackContact.education || '',
          annualIncome: contact.annualIncome ? String(contact.annualIncome) : (fallbackContact.annualIncome ? String(fallbackContact.annualIncome) : ''),
          occupationType: primaryOcc?.type || '',
          companyName: primaryOcc?.companyName || '',
          state: primaryAddr?.state || '',
          district: primaryAddr?.district || '',
          city: primaryAddr?.city || '',
          pincode: primaryAddr?.pincode || '',
          streetAddress: primaryAddr?.line1 || contact.notes || fallbackContact.notes || ''
        });

        const lead = contact.productInterests?.[0] || (leadOrContact.contactId ? leadOrContact : null);
        setLeadInfoFields({
          profileType: activeTab === 'customers' ? 'Client Profile' : 'Lead Profile',
          leadStatus: lead?.stage || 'OPEN',
          interestedIn: lead?.interests || ['Health'],
          leadSource: lead?.source || 'Walk-in',
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

        const rels1 = (contact.relationships || []).map((r: any) => {
          const c = r.relatedContact || r.contact || {};
          const parsedNames = extractNameFields(c);
          return {
            id: r.id,
            contactId: c.id,
            name: `${parsedNames.firstName} ${parsedNames.middleName} ${parsedNames.lastName}`.replace(/\s+/g, ' ').trim(),
            firstName: parsedNames.firstName,
            middleName: parsedNames.middleName,
            lastName: parsedNames.lastName,
            dob: c?.dateOfBirth ? c.dateOfBirth.split('T')[0] : '',
            relation: r.relationshipType || 'OTHER',
            whatsapp: c?.phone || '',
            occupation: '',
            education: '',
            medicalHistory: []
          };
        });
        setFamilyMembers(rels1);

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

        const backendInterests = contact.productInterests || [];
        const mappedInterests: ProductInterestCard[] = backendInterests.map((lead: any) => {
          const extra = parseLeadNotes(lead.notes);
          const comments = (lead.consultations || []).map((c: any) => ({
            text: c.notes || '',
            author: c.author || 'System',
            datetime: c.createdAt ? new Date(c.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
          }));

          const parseBackendInterests = (list: string[] = []): { interestedIn: string[]; otherProduct: string } => {
            const STANDARD_PRODUCTS = ['Health', 'Life', 'Term', 'Accident Policy', 'Motor', 'Mutual Funds', 'Porting'];
            const interestedIn: string[] = [];
            const otherParts: string[] = [];
            for (const raw of list) {
              if (!raw || !raw.trim()) continue;
              const trimmed = raw.trim();
              const lower = trimmed.toLowerCase();
              if (lower.includes('health')) {
                if (!interestedIn.includes('Health')) interestedIn.push('Health');
              } else if (lower.includes('life') && !lower.includes('term')) {
                if (!interestedIn.includes('Life')) interestedIn.push('Life');
              } else if (lower.includes('term')) {
                if (!interestedIn.includes('Term')) interestedIn.push('Term');
              } else if (lower.includes('accident')) {
                if (!interestedIn.includes('Accident Policy')) interestedIn.push('Accident Policy');
              } else if (lower.includes('motor') || lower.includes('car') || lower.includes('vehicle') || lower.includes('bike')) {
                if (!interestedIn.includes('Motor')) interestedIn.push('Motor');
              } else if (lower.includes('mutual') || lower.includes('fund')) {
                if (!interestedIn.includes('Mutual Funds')) interestedIn.push('Mutual Funds');
              } else if (lower.includes('port')) {
                if (!interestedIn.includes('Porting')) interestedIn.push('Porting');
              } else if (STANDARD_PRODUCTS.includes(trimmed)) {
                if (!interestedIn.includes(trimmed)) interestedIn.push(trimmed);
              } else {
                otherParts.push(trimmed);
              }
            }
            if (otherParts.length > 0 && !interestedIn.includes('Other')) {
              interestedIn.push('Other');
            }
            if (interestedIn.length === 0) {
              interestedIn.push('Health');
            }
            return { interestedIn, otherProduct: otherParts.join(', ') };
          };

          const { interestedIn, otherProduct } = parseBackendInterests(lead.interests || []);

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
            descriptionDetails: extra.descriptionDetails || '',
            leadStage,
            leadStatus: extra.leadStatus,
            dependencyType: extra.dependencyType || 'SELF',
            dependentDetails: extra.dependentDetails || '',
            leadType: extra.leadType,
            leadSource: lead.source || 'Walk-in',
            assignedEmployeeId: lead.assignedEmployeeId || '',
            followUpDate: lead.followUpDate ? lead.followUpDate.split('T')[0] : '',
            expectedPremium,
            comments,
            newComment: '',
          };
        });

        setProductInterests(mappedInterests);
      }
      toast.dismiss(toastId);
    } catch (err) {
      toast.dismiss(toastId);
    }
  };

  const openLeadView = (leadOrContact: any) => {
    setIsViewMode(true);
    openLeadEdit(leadOrContact);
  };

  const openEdit = openLeadEdit;

  const closeLeadModal = () => {
    setLeadModalOpen(false);
    setLoadedContact(null);
    setIsViewMode(false);
  };

  const calculateAge = (dob: string): number => {
    if (!dob) return 0;
    try {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age > 0 ? age : 0;
    } catch {
      return 0;
    }
  };

  const handleDOBChange = (val: string) => {
    const age = calculateAge(val);
    setPersonalFields(p => ({ ...p, dateOfBirth: val, age: String(age) }));
  };

  const handleLeadSubmit = async (e: React.FormEvent, shouldClose: boolean) => {
    e.preventDefault();
    const firstName = (personalFields?.firstName || '').trim();
    const lastName = (personalFields?.lastName || '').trim();
    const whatsappNumber = (personalFields?.whatsappNumber || '').trim();

    const isDep = !!personalFields?.isDependent;
    const guardianNo = (personalFields?.dependentNo || '').trim();

    if (!firstName) {
      toast.error('First Name is required');
      return;
    }
    if (!lastName) {
      toast.error('Last Name is required');
      return;
    }

    if (isDep) {
      if (!guardianNo) {
        toast.error('Guardian WhatsApp Number is required for dependent contacts');
        return;
      }
    } else {
      if (!whatsappNumber) {
        toast.error('WhatsApp Number is required');
        return;
      }
      // Strip country code prefix, then validate exactly 10 local digits
      const KNOWN_CODES = ['971','966','974','968','965','973','880','977','234','254','353','91','44','49','33','81','86','94','60','62','63','66','84','27','55','52','39','34','31','41','46','47','45','64','65','61','1','7'];
      const rawWaDigits = whatsappNumber.replace(/\D/g, '');
      const sortedCodes = [...KNOWN_CODES].sort((a, b) => b.length - a.length);
      const matchedCode = sortedCodes.find(c => rawWaDigits.startsWith(c));
      const localDigits = matchedCode ? rawWaDigits.slice(matchedCode.length) : rawWaDigits;
      if (!/^\d{10}$/.test(localDigits) && !/^\d{10}$/.test(rawWaDigits)) {
        toast.error('WhatsApp Number must be exactly 10 digits');
        return;
      }
    }

    const rawPhoneDigits = whatsappNumber ? whatsappNumber.replace(/\D/g, '') : '';
    const cleanPhone = rawPhoneDigits ? (rawPhoneDigits.length > 10 ? rawPhoneDigits.slice(-10) : rawPhoneDigits) : `00${Date.now().toString().slice(-8)}`;

    const cleanAadhaar = (personalFields?.aadhaarNumber || '').replace(/\D/g, '');
    if (cleanAadhaar && cleanAadhaar.length !== 12) {
      toast.error('Aadhaar Number must be exactly 12 digits');
      return;
    }

    if (!personalFields?.dateOfBirth?.trim()) {
      toast.error('Date of Birth is required');
      return;
    }

    if (!personalFields?.occupationType?.trim()) {
      toast.error('Occupation Type is required');
      setActiveLeadTab('Personal');
      return;
    }

    if (!personalFields?.state?.trim()) {
      toast.error('State is required');
      setActiveLeadTab('Personal');
      return;
    }
    if (!personalFields?.district?.trim()) {
      toast.error('District is required');
      setActiveLeadTab('Personal');
      return;
    }
    if (!personalFields?.city?.trim()) {
      toast.error('City is required');
      setActiveLeadTab('Personal');
      return;
    }

    // Validate all product interest cards for missing required fields
    for (let i = 0; i < productInterests.length; i++) {
      const card = productInterests[i];
      const isExisting = card.id.length === 24 || /^[0-9a-fA-F]{24}$/.test(card.id);
      if (!isExisting) {
        if (!card.interestedIn || card.interestedIn.length === 0) {
          toast.error(`Product Interest #${i + 1}: Please select a Product Category`);
          setActiveLeadTab('Product Interest');
          return;
        }
        if (card.interestedIn.includes('Other') && !card.otherProduct?.trim()) {
          toast.error(`Product Interest #${i + 1}: Please specify the Other Product Name`);
          setActiveLeadTab('Product Interest');
          return;
        }

        if (!card.leadSource?.trim()) {
          toast.error(`Product Interest #${i + 1}: Please select or enter a Lead Source`);
          setActiveLeadTab('Product Interest');
          return;
        }
        if (!card.followUpDate?.trim()) {
          toast.error(`Product Interest #${i + 1}: Please select a Follow-up Date`);
          setActiveLeadTab('Product Interest');
          return;
        }
        if (!card.expectedPremium || Number(card.expectedPremium) <= 0) {
          toast.error(`Product Interest #${i + 1}: Please enter a valid Expected Premium / Budget (> 0)`);
          setActiveLeadTab('Product Interest');
          return;
        }
      }
    }

    // Validate family members relation
    for (let i = 0; i < familyMembers.length; i++) {
      const member = familyMembers[i];
      const hasContent = 
        (member.firstName || '').trim() || 
        (member.lastName || '').trim() || 
        (member.dob || '').trim() || 
        (member.whatsapp || '').trim() || 
        (member.callingNumber || '').trim();
      
      if (hasContent && !member.relation?.trim()) {
        toast.error(`Family Member #${i + 1}: Relation is required`);
        setActiveLeadTab('Family');
        return;
      }
    }

    const toastId = toast.loading(editContactId ? 'Updating lead...' : 'Creating lead...');
    try {
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

      const rawAltDigits = personalFields.callingNumber ? personalFields.callingNumber.replace(/\D/g, '') : '';
      const cleanAltPhone = rawAltDigits.length > 10 ? rawAltDigits.slice(-10) : rawAltDigits;

      let contactId = editContactId;
      if (editContactId) {
        const validEmpId = (id?: string) => (id && /^[0-9a-fA-F]{24}$/.test(id.trim())) ? id.trim() : undefined;
        const chosenEmpId = validEmpId(leadInfoFields.assignedEmployeeId) || validEmpId(productInterests[0]?.assignedEmployeeId);

        const updateBody: any = {
          firstName,
          lastName,
          phone: cleanPhone,
          isDependent: !!personalFields.isDependent,
          dependentNo: personalFields.isDependent ? personalFields.dependentNo : undefined,
        };
        if (chosenEmpId) updateBody.assignedEmployeeId = chosenEmpId;
        if (personalFields.middleName?.trim()) updateBody.middleName = personalFields.middleName.trim();
        if (cleanAltPhone) updateBody.alternatePhone = cleanAltPhone;
        if (personalFields.email?.trim()) updateBody.email = personalFields.email.trim();
        if (personalFields.gender) updateBody.gender = personalFields.gender;
        if (personalFields.maritalStatus) updateBody.maritalStatus = personalFields.maritalStatus;
        if (personalFields.dateOfBirth?.trim()) updateBody.dateOfBirth = new Date(personalFields.dateOfBirth).toISOString();
        if (personalFields.height) updateBody.height = Number(personalFields.height);
        if (personalFields.weight) updateBody.weight = Number(personalFields.weight);
        if (personalFields.panNumber || personalFields.pan) updateBody.panNumber = personalFields.panNumber || personalFields.pan;
        if (cleanAadhaar) updateBody.aadhaarNumber = cleanAadhaar;
        if (personalFields.education) updateBody.education = personalFields.education;
        if (personalFields.annualIncome) updateBody.annualIncome = Number(personalFields.annualIncome);
        if (mergedTags && mergedTags.length > 0) updateBody.tags = mergedTags;
        if (personalFields.streetAddress?.trim()) updateBody.notes = personalFields.streetAddress.trim();

        await contactsService.update(editContactId, updateBody);

        // Update Address: clean up old addresses, then create the new primary address
        if (loadedContact) {
          const oldAddresses = loadedContact.addresses || [];
          for (const addr of oldAddresses) {
            await contactsService.removeAddress(editContactId, addr.id).catch(err => console.error('Failed to remove old address:', err));
          }
        }
        if (personalFields.state || personalFields.city || personalFields.pincode || personalFields.streetAddress) {
          await contactsService.addAddress(editContactId, {
            type: 'HOME',
            line1: personalFields.streetAddress || 'N/A',
            city: personalFields.city || 'N/A',
            state: personalFields.state || 'N/A',
            pincode: personalFields.pincode || 'N/A',
            country: 'India',
            isPrimary: true,
          }).catch(err => console.error('Failed to add new address:', err));
        }

        // Update Occupation: clean up old occupations, then create the new primary occupation
        if (loadedContact) {
          const oldOccs = loadedContact.occupations || [];
          for (const occ of oldOccs) {
            await contactsService.removeOccupation(editContactId, occ.id).catch(err => console.error('Failed to remove old occupation:', err));
          }
        }
        if (personalFields.occupationType || personalFields.companyName || personalFields.annualIncome) {
          await contactsService.addOccupation(editContactId, {
            type: personalFields.occupationType || 'SALARIED',
            companyName: personalFields.companyName || undefined,
            isPrimary: true,
          }).catch(err => console.error('Failed to add new occupation:', err));
        }
      } else {
        const contactBody: any = {
          firstName,
          lastName,
          phone: cleanPhone,
          isDependent: !!personalFields.isDependent,
          dependentNo: personalFields.isDependent ? personalFields.dependentNo : undefined,
        };
        if (personalFields.middleName?.trim()) contactBody.middleName = personalFields.middleName.trim();
        if (cleanAltPhone) contactBody.alternatePhone = cleanAltPhone;
        if (personalFields.email?.trim()) contactBody.email = personalFields.email.trim();
        if (personalFields.gender) contactBody.gender = personalFields.gender;
        if (personalFields.maritalStatus) contactBody.maritalStatus = personalFields.maritalStatus;
        if (personalFields.dateOfBirth?.trim()) contactBody.dateOfBirth = new Date(personalFields.dateOfBirth).toISOString();
        if (personalFields.height) contactBody.height = Number(personalFields.height);
        if (personalFields.weight) contactBody.weight = Number(personalFields.weight);
        if (personalFields.panNumber || personalFields.pan) contactBody.panNumber = personalFields.panNumber || personalFields.pan;
        if (cleanAadhaar) contactBody.aadhaarNumber = cleanAadhaar;
        if (personalFields.education) contactBody.education = personalFields.education;
        if (personalFields.annualIncome) contactBody.annualIncome = Number(personalFields.annualIncome);
        if (mergedTags && mergedTags.length > 0) contactBody.tags = mergedTags;
        if (personalFields.streetAddress?.trim()) contactBody.notes = personalFields.streetAddress.trim();

        const contactRes = await contactsService.createFull({
          contact: contactBody,
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
        const createdContactObj = contactRes?.data?.contact || contactRes?.data?.data || contactRes?.data || contactRes;
        contactId = createdContactObj?.id || createdContactObj?._id;
        if (contactId) {
          setEditContactId(contactId);
          if (createdContactObj && typeof createdContactObj === 'object') {
            setLoadedContact(createdContactObj);
          }
        }
      }

      const subResourcePromises: Promise<any>[] = [];
      const createdPolicies: any[] = [];

      // Save Family Members if any
      const currentUser = useAuthStore.getState().user;
      const curEmpId = currentUser?.id;

      for (let i = 0; i < familyMembers.length; i++) {
        const fam = familyMembers[i];
        const famFirst = (fam.firstName || '').trim() || (fam.name || '').trim().split(/\s+/)[0] || '';
        const famMiddle = (fam.middleName || '').trim();
        const famLast = (fam.lastName || '').trim() || (fam.name || '').trim().split(/\s+/).slice(1).join(' ') || '';
        const fullFamName = `${famFirst} ${famMiddle} ${famLast}`.replace(/\s+/g, ' ').trim();
        if (!fullFamName) continue;

        const rawFamPhone = (fam.whatsapp || '').replace(/\D/g, '');
        const cleanFamPhone = rawFamPhone.length === 10 ? rawFamPhone : `9${String(Date.now() + i).slice(-9)}`;
        const relType = fam.relation ? fam.relation.toUpperCase().replace(/\s+/g, '_') : 'OTHER';

        const saveFamilyFlow = async () => {
          try {
            let targetFamContactId = fam.contactId;
            if (targetFamContactId) {
              await contactsService.update(targetFamContactId, {
                firstName: famFirst,
                middleName: famMiddle || undefined,
                lastName: famLast,
                phone: rawFamPhone.length === 10 ? rawFamPhone : undefined,
                dateOfBirth: fam.dob?.trim() ? new Date(fam.dob).toISOString() : undefined,
                assignedEmployeeId: curEmpId || undefined,
              });
              await contactsService.addRelationship(contactId!, {
                relatedContactId: targetFamContactId,
                relationshipType: relType,
              });
            } else {
              await contactsService.addRelationship(contactId!, {
                name: fullFamName,
                phone: rawFamPhone.length === 10 ? rawFamPhone : undefined,
                dateOfBirth: fam.dob?.trim() ? fam.dob : undefined,
                relationshipType: relType,
              });
            }
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
              }).then((res: any) => {
                const savedPolicy = res?.data ?? res;
                if (savedPolicy) createdPolicies.push(savedPolicy);
                return res;
              }).catch(polErr => console.error('Failed to save policy:', polErr))
            );
        }
      }

      // Save Product Interests (Leads)
      for (const card of productInterests) {
        const isUntouchedDefaultPlaceholder = card.id.startsWith('temp-') &&
          (card.interestedIn.length === 1 && card.interestedIn[0] === 'Health') &&
          !card.expectedPremium &&
          !card.followUpDate &&
          !card.descriptionDetails &&
          !card.otherProduct;

        if (isUntouchedDefaultPlaceholder) {
          continue;
        }

        const rawInterests = (card.interestedIn || [])
          .map((p: string) => (p === 'Other' && card.otherProduct ? card.otherProduct : p))
          .filter(Boolean);

        const interests = rawInterests.length > 0 ? rawInterests : ['Health'];

        let stage = card.leadStage && card.leadStage !== 'OPEN' ? card.leadStage : 'TO_CONTACT';

        const serializedNotes = serializeLeadNotes(card);

        const validEmpId = (id?: string) => (id && /^[0-9a-fA-F]{24}$/.test(id.trim())) ? id.trim() : undefined;
        const body = {
          contactId: contactId!,
          interests,
          stage,
          source: card.leadSource || 'Walk-in',
          assignedEmployeeId: validEmpId(card.assignedEmployeeId) || validEmpId(curEmpId),
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
          } catch (leadErr: any) {
            console.error('Failed to save product interest:', leadErr);
            toast.error(`Failed to save Product Interest (${interests.join(', ')}): ${leadErr.response?.data?.message || 'Error occurred'}`);
          }
        };
        subResourcePromises.push(saveLeadFlow());
      }

      // Await all sub-resource updates concurrently
      await Promise.all(subResourcePromises);

      if (createdPolicies.length > 0) {
        setLoadedContact((prev: any) => prev ? {
          ...prev,
          policies: [...(prev.policies || []), ...createdPolicies],
        } : prev);
      }

      const targetLabel = activeTab === 'customers' ? 'Customer' : 'Contact';
      toast.success(
        editContactId
          ? `${targetLabel} updated successfully!`
          : (shouldClose ? `${targetLabel} created successfully!` : 'Draft saved successfully!'),
        { id: toastId }
      );
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.refetchQueries({ queryKey: ['contacts'] });
      refetchContacts();
      qc.invalidateQueries({ queryKey: ['policies'] });
      qc.invalidateQueries({ queryKey: ['contacts-policies-list'] });

      if (shouldClose) {
        setLeadModalOpen(false);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to save customer', { id: toastId });
    }
  };

  const { data: compulsoryRulesRes, isLoading: isLoadingRules } = useQuery({
    queryKey: ['compulsory-rules'],
    queryFn: () => insuranceService.getCompulsoryRules(),
  });
  const compulsoryRules = useMemo(() => compulsoryRulesRes?.data ?? [], [compulsoryRulesRes]);

  const isFieldRequired = (key: string, defaultRequired: boolean) => {
    if (['firstName', 'phone'].includes(key)) return true; // System protected
    const rule = compulsoryRules.find((r: any) => r.module === 'Contact' && r.fieldKey === key);
    if (rule) return rule.required;
    return defaultRequired;
  };

  const activeSchema = useMemo(() => {
    return z.object({
      firstName: isFieldRequired('firstName', true) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      lastName: isFieldRequired('lastName', true) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      phone: isFieldRequired('phone', true) ? z.string().min(10, 'Min 10 digits') : z.string().optional().or(z.literal('')),
      alternatePhone: isFieldRequired('alternatePhone', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      email: isFieldRequired('email', false) ? z.string().email('Invalid email') : z.string().email('Invalid email').optional().or(z.literal('')),
      gender: isFieldRequired('gender', false) ? z.enum(['MALE', 'FEMALE', 'OTHER']).refine(val => !!val, { message: 'Required' }) : z.enum(['MALE', 'FEMALE', 'OTHER', '']).optional(),
      dateOfBirth: isFieldRequired('dateOfBirth', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      panNumber: isFieldRequired('panNumber', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      aadhaarNumber: isFieldRequired('aadhaarNumber', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      annualIncome: isFieldRequired('annualIncome', false) ? z.coerce.number().min(0) : z.coerce.number().min(0).optional().or(z.literal('')),
      notes: isFieldRequired('notes', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      tags: isFieldRequired('tags', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      isActive: z.string().optional(),
      city: isFieldRequired('city', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      source: isFieldRequired('source', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      assignedEmployeeId: isFieldRequired('assignedEmployeeId', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      leadStage: isFieldRequired('leadStage', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      leadStatus: isFieldRequired('leadStatus', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      leadType: isFieldRequired('leadType', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
      followUpDate: isFieldRequired('followUpDate', false) ? z.string().min(1, 'Required') : z.string().optional().or(z.literal('')),
    });
  }, [compulsoryRules]);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<Form>({ resolver: zodResolver(activeSchema) });

  const getEmployeeName = (id?: string | null, assignedEmpObj?: any, contactItem?: any) => {
    const targetObj = assignedEmpObj || contactItem?.assignedEmployee;
    if (targetObj) {
      const prof = targetObj.employeeProfile;
      const name = prof ? `${prof.firstName || ''} ${prof.lastName || ''}`.trim() : (targetObj.email || '');
      if (name) return name;
    }

    const targetId = id || contactItem?.assignedEmployeeId;
    if (!targetId) return 'Unassigned';

    const emp = employeesList.find((e: any) => e.id === targetId || e.userId === targetId || e.user?.id === targetId);
    if (!emp) return 'Unassigned';
    return `${emp.firstName ?? emp.user?.firstName ?? ''} ${emp.lastName ?? emp.user?.lastName ?? ''}`.trim() || emp.name || emp.email || 'Unassigned';
  };

  const handlePickContact = async (contact: any) => {
    const currentUserId = user?.id;
    if (!currentUserId) {
      toast.error('User session not found');
      return;
    }
    const toastId = toast.loading('Assigning contact to you...');
    try {
      await contactsService.update(contact.id, { assignedEmployeeId: currentUserId });
      toast.success('Contact picked successfully!', { id: toastId });
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.refetchQueries({ queryKey: ['contacts'] });
      refetchContacts();
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['policies'] });
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to pick contact', { id: toastId });
    }
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
      declaredMedicalHistory: [],
      notDeclaredMedicalHistory: [],
      medicalHistoryDetails: '',
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
      leadSource: 'Walk-in',
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



  useEffect(() => {
    const state = location.state as any;
    if (state?.reopenContactId) {
      openLeadEdit({ contactId: state.reopenContactId }).then(() => {
        setActiveLeadTab(state.reopenTab || 'Policy');
      });
    }
  }, [location.state]);

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
      : contactsListArray;

    return list.filter((item: any) => {
      // Employee role data isolation safeguard: only see self-assigned, unassigned, or contacts with self-assigned sub-resources
      if (user?.role === 'EMPLOYEE') {
        const currentUserId = user.id;
        const assignedEmpId = item.assignedEmployeeId || item.assignedEmployee?.id || item.assignedEmployee?.userId;
        const myEmp = employeesList.find((e: any) => e.userId === currentUserId || e.user?.id === currentUserId || e.id === currentUserId);
        const validMyIds = [currentUserId];
        if (myEmp?.id) validMyIds.push(myEmp.id);
        if (myEmp?.userId) validMyIds.push(myEmp.userId);
        if (myEmp?.user?.id) validMyIds.push(myEmp.user.id);

        const hasMySubResource =
          (item.policies && item.policies.some((p: any) => p.assignedEmployeeId && validMyIds.includes(p.assignedEmployeeId))) ||
          (item.productInterests && item.productInterests.some((pi: any) => pi.assignedEmployeeId && validMyIds.includes(pi.assignedEmployeeId))) ||
          (item.claims && item.claims.some((c: any) => c.assignedEmployeeId && validMyIds.includes(c.assignedEmployeeId)));

        if (assignedEmpId && !validMyIds.includes(assignedEmpId) && !hasMySubResource) {
          return false;
        }
      }

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
      const medicalOptions = [
        "BP",
        "Sugar",
        "Heart",
        "Thyroid",
        "Others",
      ];
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
        if (hasTag('contact')) {
          // Keep in contacts tab if explicitly tagged as contact
        } else if (isCustomer) {
          return false;
        }
        if (selectedFilters.includes('Active') && !item.isActive) return false;
        if (selectedFilters.includes('Inactive') && item.isActive) return false;
      } else if (activeTab === 'customers') {
        // Customer tab filters
        if (!isCustomer && !hasTag('customer')) return false;

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
      // 1. Next Follow-up Date Filter
      if (filterFollowUpFrom || filterFollowUpTo) {
        const fuDate = item.followUpDate || item.productInterests?.[0]?.followUpDate;
        if (!fuDate) return false;
        const fuTime = new Date(fuDate).getTime();
        if (isNaN(fuTime)) return false;
        if (filterFollowUpFrom && fuTime < new Date(filterFollowUpFrom).getTime()) return false;
        if (filterFollowUpTo && fuTime > new Date(filterFollowUpTo).getTime() + 86400000) return false;
      }

      // 2. Gender Filter
      if (filterGender && filterGender !== 'ALL') {
        const g = item.gender || item.contact?.gender || '';
        if (g.toUpperCase() !== filterGender.toUpperCase()) return false;
      }

      // 3. Marital Status Filter
      if (filterMaritalStatus && filterMaritalStatus !== 'ALL') {
        const ms = item.maritalStatus || item.contact?.maritalStatus || '';
        if (ms.toUpperCase() !== filterMaritalStatus.toUpperCase()) return false;
      }

      // 4. Age Range Filter
      if (filterAgeRange && filterAgeRange !== 'ALL') {
        const dob = item.dateOfBirth || item.contact?.dateOfBirth;
        if (!dob) return false;
        const age = calculateAge(dob);
        if (filterAgeRange === '0_18' && !(age >= 0 && age <= 18)) return false;
        if (filterAgeRange === '19_25' && !(age >= 19 && age <= 25)) return false;
        if (filterAgeRange === '26_30' && !(age >= 26 && age <= 30)) return false;
        if (filterAgeRange === '31_35' && !(age >= 31 && age <= 35)) return false;
        if (filterAgeRange === '36_40' && !(age >= 36 && age <= 40)) return false;
        if (filterAgeRange === '41_50' && !(age >= 41 && age <= 50)) return false;
        if (filterAgeRange === '51_60' && !(age >= 51 && age <= 60)) return false;
        if (filterAgeRange === '61_75' && !(age >= 61 && age <= 75)) return false;
        if (filterAgeRange === '75_PLUS' && !(age > 75)) return false;
      }

      // 5. Annual Income Filter
      if (filterIncomeRange && filterIncomeRange !== 'ALL') {
        const inc = Number(item.annualIncome || item.contact?.annualIncome || 0);
        if (filterIncomeRange === '0_2.5L' && !(inc >= 0 && inc <= 250000)) return false;
        if (filterIncomeRange === '2.5L_5L' && !(inc > 250000 && inc <= 500000)) return false;
        if (filterIncomeRange === '5L_10L' && !(inc > 500000 && inc <= 1000000)) return false;
        if (filterIncomeRange === '10L_25L' && !(inc > 1000000 && inc <= 2500000)) return false;
        if (filterIncomeRange === '25L_50L' && !(inc > 2500000 && inc <= 5000000)) return false;
        if (filterIncomeRange === '50L_PLUS' && !(inc > 5000000)) return false;
      }

      // 6. Education Filter
      if (filterEducation && filterEducation !== 'ALL') {
        const edu = (item.education || item.contact?.education || '').toLowerCase();
        if (!edu.includes(filterEducation.toLowerCase())) return false;
      }

      // 7. Occupation Filter
      if (filterOccupation && filterOccupation !== 'ALL') {
        const occ = (item.occupationType || item.contact?.occupations?.[0]?.type || item.occupations?.[0]?.type || '').toLowerCase();
        if (!occ.includes(filterOccupation.toLowerCase())) return false;
      }

      // 8. Residency Status Filter (Indian / NRI / OCI)
      if (filterResidency && filterResidency !== 'ALL') {
        const res = (item.residencyStatus || item.contact?.residencyStatus || item.notes || '').toLowerCase();
        if (!res.includes(filterResidency.toLowerCase())) return false;
      }

      // 9. State Filter
      if (filterState) {
        const st = (item.state || item.contact?.addresses?.[0]?.state || '').toLowerCase();
        if (!st.includes(filterState.toLowerCase())) return false;
      }

      // 10. City Filter
      if (filterCity) {
        const ct = (item.city || item.contact?.city || item.contact?.addresses?.[0]?.city || '').toLowerCase();
        if (!ct.includes(filterCity.toLowerCase())) return false;
      }

      // 11. Bank Filter
      if (filterBank) {
        const bk = (item.bankName || item.contact?.bankName || item.contact?.bankAccounts?.[0]?.bankName || '').toLowerCase();
        if (!bk.includes(filterBank.toLowerCase())) return false;
      }

      // 12. Medical History Filter
      if (filterMedicalHistory && filterMedicalHistory.length > 0) {
        const medStr = JSON.stringify(item.medicalHistory || item.declaredMedicalHistory || item.notes || '').toLowerCase();
        const matchesMed = filterMedicalHistory.every(m => medStr.includes(m.toLowerCase()));
        if (!matchesMed) return false;
      }

      // 13. Active / Inactive Status Filter
      if (filterActiveStatus && filterActiveStatus !== 'ALL') {
        if (filterActiveStatus === 'Active' && !item.isActive) return false;
        if (filterActiveStatus === 'Inactive' && item.isActive) return false;
      }

      // 14. Policy Combo Filter (Health No Term / Term No Health)
      if (filterPolicyCombo && filterPolicyCombo !== 'ALL') {
        const contactPolicies = policyMap[item.id] ?? item.policies ?? [];
        const hasHealth = contactPolicies.some((p: any) =>
          (p.plan?.category || p.category || p.plan?.name || '').toLowerCase().includes('health')
        ) || (item.tags || []).some((t: string) => t.toLowerCase() === 'health');

        const hasTerm = contactPolicies.some((p: any) =>
          (p.plan?.category || p.category || p.plan?.name || '').toLowerCase().includes('term')
        ) || (item.tags || []).some((t: string) => t.toLowerCase() === 'term');

        if (filterPolicyCombo === 'HEALTH_NO_TERM' && !(hasHealth && !hasTerm)) return false;
        if (filterPolicyCombo === 'TERM_NO_HEALTH' && !(hasTerm && !hasHealth)) return false;
      }

      // 15. Role Filter
      if (filterRole && filterRole !== 'ALL') {
        const r = (item.role || item.user?.role || '').toUpperCase();
        if (r && r !== filterRole) return false;
      }

      return true;
    });
  }, [
    activeTab, contactsRes, birthdayRes, selectedFilters, policyMap, claimMap, dateFrom, dateTo, filterProducts, excludeProduct,
    filterFollowUpFrom, filterFollowUpTo, filterGender, filterMaritalStatus, filterAgeRange, filterIncomeRange,
    filterEducation, filterOccupation, filterResidency, filterState, filterCity, filterBank, filterMedicalHistory,
    filterActiveStatus, filterPolicyCombo, filterRole
  ]);

  // Client-side Sorting Memo
  const sortedAndFilteredData = useMemo(() => {
    return sortData(filteredData, sortKey, sortDir as 'asc' | 'desc', (row: any, key: string) => {
      if (key === 'contactId' || key === 'id') {
        const cid = row.contactId || row.id || '';
        const num = parseInt(cid.replace(/\D/g, ''), 10);
        return isNaN(num) ? cid : num;
      }
      if (key === 'name') return `${row.firstName || row.contact?.firstName || ''} ${row.lastName || row.contact?.lastName || ''}`;
      if (key === 'phone') return row.phone || row.contact?.phone || '';
      if (key === 'product') {
        const p = policyMap[row.id] ?? [];
        return p.map((x: any) => x.plan?.category || x.plan?.name).join(', ');
      }
      if (key === 'assignedTo') return getEmployeeName(row.assignedEmployeeId);
      
      // Attempt to resolve nested paths generically if standard row[key] is undefined
      const parts = key.split('.');
      let val = row;
      for (const part of parts) {
        if (val == null) break;
        val = val[part];
      }
      return val !== undefined ? val : row[key];
    });
  }, [filteredData, sortKey, sortDir, policyMap]);

  // Contact Table Columns
  const CONTACT_COLS: Column<any>[] = [
    {
      key: 'contactId',
      label: 'CONTACT ID',
      sortable: true,
      render: r => {
        const displayId = r.contactId || (r.id ? `#${r.id.substring(r.id.length - 4).toUpperCase()}` : '—');
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              openLeadView(r);
            }}
            className="px-2 py-1 rounded-lg bg-slate-100/90 text-blue-600 hover:bg-blue-600 hover:text-white font-mono font-extrabold text-xs transition-all shadow-2xs border border-slate-200/80 cursor-pointer"
          >
            {displayId}
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
          <div className="flex flex-wrap items-center gap-3 py-0.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shadow-xs shrink-0 border border-white/20">
              {initials}
            </div>
            <div>
              <div className="font-extrabold text-slate-900 text-xs hover:text-blue-600 transition-colors">{r.firstName} {r.lastName}</div>
            </div>
          </div>
        );
      }
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
      render: r => <span className="text-slate-600 text-xs font-semibold">{r.followUpDate ? format(new Date(r.followUpDate), 'dd/MMM/yyyy') : '—'}</span>
    },
    {
      key: 'assignedTo',
      label: 'ASSIGNED EMPLOYEE',
      sortable: true,
      render: r => {
        const empName = getEmployeeName(r.assignedEmployeeId, r.assignedEmployee, r);
        if (empName === 'Unassigned') {
          return (
            <div className="flex flex-wrap items-center gap-1.5 flex-wrap">
              <span className="inline-flex flex-wrap items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                Unassigned
              </span>
              {user?.role === 'EMPLOYEE' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePickContact(r);
                  }}
                  className="px-2.5 py-1 text-[11px] font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg cursor-pointer shadow-xs transition-all hover:scale-105"
                  title="Assign this contact to yourself"
                >
                  Pick Contact
                </button>
              )}
            </div>
          );
        }
        return <span className="text-slate-700 text-xs font-bold">{empName}</span>;
      }
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
        const isEmployee = authUser?.role === 'EMPLOYEE';
        const showPickButton = isEmployee && !r.assignedEmployeeId;
        return (
          <div className="flex gap-1.5 justify-start items-center" onClick={e => e.stopPropagation()}>
            {showPickButton && (
              <button
                onClick={() => handlePickContact(r.id)}
                className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-xs shadow-xs hover:from-blue-700 hover:to-indigo-700 transition-all hover:scale-105 cursor-pointer flex flex-wrap items-center gap-1 shrink-0"
                title="Pick and assign this contact to yourself"
              >
                <UserCheck size={13} />
                Pick Contact
              </button>
            )}
            <a
              href={`https://wa.me/${r.phone?.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-emerald-500/20 hover:shadow-lg hover:scale-105 transition-all"
              title="WhatsApp"
            >
              <MessageCircle size={14} />
            </a>
            <a
              href={`tel:${r.phone}`}
              className="p-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-blue-500/20 hover:shadow-lg hover:scale-105 transition-all"
              title="Call"
            >
              <Phone size={14} />
            </a>
            {canEditContacts && (
              <button
                onClick={() => openEdit(r)}
                className="p-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-purple-500/20 hover:shadow-lg hover:scale-105 transition-all"
                title="Edit Contact"
              >
                <Pencil size={14} />
              </button>
            )}
            {canManageContacts && (
              <button
                onClick={() => setDeleteTarget(r)}
                className="p-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-rose-500/20 hover:shadow-lg hover:scale-105 transition-all"
                title="Delete Contact"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        );
      }
    }
  ];

  // Customer Columns
  const CUSTOMER_COLS: Column<any>[] = [
    {
      key: 'contactId',
      label: 'CONTACT ID',
      sortable: true,
      render: r => {
        const displayId = r.contactId || (r.id ? `#${r.id.substring(r.id.length - 4).toUpperCase()}` : '—');
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              openLeadView(r);
            }}
            className="px-2 py-1 rounded-lg bg-slate-100/90 text-blue-600 hover:bg-blue-600 hover:text-white font-mono font-extrabold text-xs transition-all shadow-2xs border border-slate-200/80 cursor-pointer"
          >
            {displayId}
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
          <div className="flex flex-wrap items-center gap-3 py-0.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white font-extrabold text-xs flex items-center justify-center shadow-xs shrink-0 border border-white/20">
              {initials}
            </div>
            <div>
              <div className="font-extrabold text-slate-900 text-xs hover:text-blue-600 transition-colors">{r.firstName} {r.lastName}</div>
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
        return (
          <div className="flex gap-1 flex-wrap">
            {policies.map((p: any) => {
              const label = p.plan?.category
                ? p.plan.category.charAt(0).toUpperCase() + p.plan.category.slice(1).toLowerCase()
                : (p.plan?.name || p.policyNumber || 'Policy');
              return (
                <button
                  key={p.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPolicyModalId(p.id);
                  }}
                  className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200/60 text-[10px] font-extrabold shadow-2xs transition-all cursor-pointer"
                  title={`Click to view policy details ${p.policyNumber ? `(${p.policyNumber})` : ''}`}
                >
                  {label}
                </button>
              );
            })}
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
          <span className="inline-flex flex-wrap items-center gap-1 px-2.5 py-0.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold text-[10px] uppercase tracking-wider shadow-xs shadow-orange-500/20 border border-orange-400">
            <Flame size={11} /> Due
          </span>
        ) : (
          <span className="inline-flex flex-wrap items-center gap-1 px-2.5 py-0.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-extrabold text-[10px] uppercase tracking-wider shadow-2xs">
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
            <span className="inline-flex flex-wrap items-center gap-1 px-2.5 py-0.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60 font-extrabold text-[10px] uppercase tracking-wider shadow-2xs">
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
            className="p-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-emerald-500/20 hover:shadow-lg hover:scale-105 transition-all"
            title="WhatsApp"
          >
            <MessageCircle size={14} />
          </a>
          <a
            href={`tel:${r.phone}`}
            className="p-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-blue-500/20 hover:shadow-lg hover:scale-105 transition-all"
            title="Call"
          >
            <Phone size={14} />
          </a>
          {canEditContacts && (
            <button
              onClick={() => openEdit(r)}
              className="p-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-purple-500/20 hover:shadow-lg hover:scale-105 transition-all"
              title="Edit Contact"
            >
              <Pencil size={14} />
            </button>
          )}
          {canManageContacts && (
            <button
              onClick={() => setDeleteTarget(r)}
              className="p-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-rose-500/20 hover:shadow-lg hover:scale-105 transition-all"
              title="Delete Contact"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )
    }
  ];

  // Birthday Columns
  const BIRTHDAY_COLS: Column<any>[] = [
    {
      key: 'contactId',
      label: 'CONTACT ID',
      sortable: true,
      render: r => {
        const displayId = r.contactId || (r.id ? `#${r.id.substring(r.id.length - 4).toUpperCase()}` : '—');
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              openLeadView(r);
            }}
            className="px-2 py-1 rounded-lg bg-slate-100/90 text-blue-600 hover:bg-blue-600 hover:text-white font-mono font-extrabold text-xs transition-all shadow-2xs border border-slate-200/80 cursor-pointer"
          >
            {displayId}
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
          <div className="flex flex-wrap items-center gap-3 py-0.5">
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
            className="p-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-emerald-500/20 hover:shadow-lg hover:scale-105 transition-all"
            title="WhatsApp"
          >
            <MessageCircle size={14} />
          </a>
          <a
            href={`tel:${r.phone}`}
            className="p-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-blue-500/20 hover:shadow-lg hover:scale-105 transition-all"
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
          title="Import Contact CSV"
        >
          <Upload size={18} strokeWidth={2.2} />
          <span className="absolute right-full mr-3 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl border border-slate-800">
            Import Contact CSV
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

        {/* Add Contact */}
        <button
          type="button"
          onClick={openCreate}
          className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center justify-center transition-all hover:scale-105 shadow-lg shadow-blue-500/30 cursor-pointer group relative"
          title="Add Contact"
        >
          <UserPlus size={18} strokeWidth={2.2} />
          <span className="absolute right-full mr-3 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-xl border border-slate-800">
            Add Contact
          </span>
        </button>
      </div>

      {/* Main Control Hub Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
        {/* Single Row Layout (Policy & Claims UI Style) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">

          {/* Left Side: Search Bar ONLY */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="page-search-wrapper">
              <Search className="page-search-icon" />
              <input
                type="text"
                className="page-search-input"
                placeholder="Search contact name, phone, email..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>

          {/* Right Side: Active/Inactive Badges, All Products Filter, Date Range Selector & Column Settings */}
          <div className="flex flex-wrap items-center gap-2.5 flex-wrap justify-end">
            {/* Active / Inactive Status Badges */}
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

            {/* Product Category Multi-Select Dropdown */}
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
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200/90 rounded-2xl shadow-2xl p-3 z-50 animate-fadeIn text-xs space-y-1.5">
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
                  <label className="flex flex-wrap items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer font-extrabold text-slate-700 select-none">
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
                        <label key={prod.id} className="flex flex-wrap items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer font-bold text-slate-700 select-none">
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
                title={excludeProduct ? `Showing contacts who HAVEN'T purchased selected products` : `Click to show who HAVEN'T purchased selected products`}
              >
                {excludeProduct ? `❌ Without Selected Products` : `🚫 Exclude / Not Purchased`}
              </button>
            )}

            {/* Date Range Selector */}
            <div className="flex flex-nowrap items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
              <Calendar size={14} className="text-slate-400 shrink-0" />
              <DatePicker
                value={dateFrom}
                onChange={val => { setDateFrom(val); setPage(1); }}
                className="bg-transparent border-0 outline-none text-[11px] font-semibold text-slate-700 w-24 focus:ring-0 p-0 cursor-pointer"
                title="From Date"
              />
              <span className="text-slate-300 font-bold">-</span>
              <DatePicker
                value={dateTo}
                onChange={val => { setDateTo(val); setPage(1); }}
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
                  {CONTACT_COLS.map(c => {
                    if (c.key === 'actions') return null;
                    return (
                      <label key={String(c.key)} className="flex flex-wrap items-center gap-2 cursor-pointer font-bold text-slate-700 hover:text-blue-600 transition-colors">
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
                "p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 cursor-pointer shadow-2xs transition-all flex items-center gap-1.5 text-xs font-bold bg-white",
                showAdvancedFilters && "bg-blue-50 border-blue-200 text-blue-600"
              )}
              title="Advanced Filters"
            >
              <Filter size={14} className={showAdvancedFilters || activeContactsFilterCount > 0 ? "text-blue-600" : "text-slate-500"} />
              <span className="hidden sm:inline">Filters</span>
              {activeContactsFilterCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] bg-blue-600 text-white rounded-full font-black leading-none">
                  {activeContactsFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Active Filter Badges Bar */}
      {activeContactsFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 bg-blue-50/60 p-2.5 rounded-2xl border border-blue-100/90 shadow-2xs animate-fadeIn">
          <span className="text-[11px] font-extrabold text-blue-800 mr-1 flex items-center gap-1">
            <Filter size={13} className="text-blue-600" /> Active Filters ({activeContactsFilterCount}):
          </span>

          {(filterFollowUpFrom || filterFollowUpTo) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-blue-900 text-xs font-bold rounded-xl border border-blue-200 shadow-2xs">
              Follow-up: {filterFollowUpFrom || 'Start'} to {filterFollowUpTo || 'End'}
              <span className="cursor-pointer hover:text-red-500 font-bold ml-1" onClick={() => { setFilterFollowUpFrom(''); setFilterFollowUpTo(''); }}>×</span>
            </span>
          )}
          {filterGender !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-blue-900 text-xs font-bold rounded-xl border border-blue-200 shadow-2xs">
              Gender: {filterGender}
              <span className="cursor-pointer hover:text-red-500 font-bold ml-1" onClick={() => setFilterGender('ALL')}>×</span>
            </span>
          )}
          {filterMaritalStatus !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-blue-900 text-xs font-bold rounded-xl border border-blue-200 shadow-2xs">
              Marital: {filterMaritalStatus}
              <span className="cursor-pointer hover:text-red-500 font-bold ml-1" onClick={() => setFilterMaritalStatus('ALL')}>×</span>
            </span>
          )}
          {filterAgeRange !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-blue-900 text-xs font-bold rounded-xl border border-blue-200 shadow-2xs">
              Age: {filterAgeRange.replace('_', '-').replace('-PLUS', '+')}
              <span className="cursor-pointer hover:text-red-500 font-bold ml-1" onClick={() => setFilterAgeRange('ALL')}>×</span>
            </span>
          )}
          {filterIncomeRange !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-blue-900 text-xs font-bold rounded-xl border border-blue-200 shadow-2xs">
              Income: {filterIncomeRange.replace('_', '-').replace('-PLUS', '+')}
              <span className="cursor-pointer hover:text-red-500 font-bold ml-1" onClick={() => setFilterIncomeRange('ALL')}>×</span>
            </span>
          )}
          {filterEducation !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-blue-900 text-xs font-bold rounded-xl border border-blue-200 shadow-2xs">
              Education: {filterEducation}
              <span className="cursor-pointer hover:text-red-500 font-bold ml-1" onClick={() => setFilterEducation('ALL')}>×</span>
            </span>
          )}
          {filterOccupation !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-blue-900 text-xs font-bold rounded-xl border border-blue-200 shadow-2xs">
              Occupation: {filterOccupation}
              <span className="cursor-pointer hover:text-red-500 font-bold ml-1" onClick={() => setFilterOccupation('ALL')}>×</span>
            </span>
          )}
          {filterResidency !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-blue-900 text-xs font-bold rounded-xl border border-blue-200 shadow-2xs">
              Residency: {filterResidency}
              <span className="cursor-pointer hover:text-red-500 font-bold ml-1" onClick={() => setFilterResidency('ALL')}>×</span>
            </span>
          )}
          {filterState && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-blue-900 text-xs font-bold rounded-xl border border-blue-200 shadow-2xs">
              State: {filterState}
              <span className="cursor-pointer hover:text-red-500 font-bold ml-1" onClick={() => setFilterState('')}>×</span>
            </span>
          )}
          {filterCity && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-blue-900 text-xs font-bold rounded-xl border border-blue-200 shadow-2xs">
              City: {filterCity}
              <span className="cursor-pointer hover:text-red-500 font-bold ml-1" onClick={() => setFilterCity('')}>×</span>
            </span>
          )}
          {filterBank && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-blue-900 text-xs font-bold rounded-xl border border-blue-200 shadow-2xs">
              Bank: {filterBank}
              <span className="cursor-pointer hover:text-red-500 font-bold ml-1" onClick={() => setFilterBank('')}>×</span>
            </span>
          )}
          {filterMedicalHistory.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-blue-900 text-xs font-bold rounded-xl border border-blue-200 shadow-2xs">
              Medical: {filterMedicalHistory.join(', ')}
              <span className="cursor-pointer hover:text-red-500 font-bold ml-1" onClick={() => setFilterMedicalHistory([])}>×</span>
            </span>
          )}
          {filterActiveStatus !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-blue-900 text-xs font-bold rounded-xl border border-blue-200 shadow-2xs">
              Status: {filterActiveStatus}
              <span className="cursor-pointer hover:text-red-500 font-bold ml-1" onClick={() => setFilterActiveStatus('ALL')}>×</span>
            </span>
          )}
          {filterPolicyCombo !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-blue-900 text-xs font-bold rounded-xl border border-blue-200 shadow-2xs">
              Combo: {filterPolicyCombo === 'HEALTH_NO_TERM' ? 'Health (No Term)' : 'Term (No Health)'}
              <span className="cursor-pointer hover:text-red-500 font-bold ml-1" onClick={() => setFilterPolicyCombo('ALL')}>×</span>
            </span>
          )}
          {filterRole !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-blue-900 text-xs font-bold rounded-xl border border-blue-200 shadow-2xs">
              Role: {filterRole}
              <span className="cursor-pointer hover:text-red-500 font-bold ml-1" onClick={() => setFilterRole('ALL')}>×</span>
            </span>
          )}
          {filterProducts.length > 0 && excludeProduct && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-800 text-xs font-bold rounded-xl border border-rose-200 shadow-2xs">
              Not Purchased: {filterProducts.join(', ')}
              <span className="cursor-pointer hover:text-red-600 font-bold ml-1" onClick={() => { setFilterProducts([]); setExcludeProduct(false); }}>×</span>
            </span>
          )}

          <button
            type="button"
            onClick={resetAllContactsFilters}
            className="text-[11px] font-extrabold text-red-600 hover:text-red-800 hover:underline cursor-pointer ml-auto px-2 py-0.5 rounded-lg bg-red-50 hover:bg-red-100 transition-colors"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="card bg-gray-50/50 p-5 rounded-2xl border border-slate-200 shadow-sm mt-2 mb-4 animate-fadeIn">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/70">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Filter size={16} className="text-blue-600" />
              Advanced Filters
            </h3>
            {activeContactsFilterCount > 0 && (
              <span className="text-xs font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                {activeContactsFilterCount} {activeContactsFilterCount === 1 ? 'Filter' : 'Filters'} Active
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4 text-xs">

            {/* 1. Next Followup Date Range */}
            <div>
              <label className="label text-[11px] font-bold text-slate-600">Next Follow-up Date</label>
              <div className="flex gap-2 items-center mt-1">
                <DatePicker className="input text-xs w-full shadow-2xs" value={filterFollowUpFrom} onChange={val => setFilterFollowUpFrom(val)} title="From" />
                <span className="text-gray-400 font-bold">-</span>
                <DatePicker className="input text-xs w-full shadow-2xs" value={filterFollowUpTo} onChange={val => setFilterFollowUpTo(val)} title="To" />
              </div>
            </div>

            {/* 2. Gender */}
            <div>
              <label className="label text-[11px] font-bold text-slate-600">Gender</label>
              <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={filterGender} onChange={e => setFilterGender(e.target.value)}>
                <option value="ALL">All Genders</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {/* 3. Married Status */}
            <div>
              <label className="label text-[11px] font-bold text-slate-600">Marital Status</label>
              <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={filterMaritalStatus} onChange={e => setFilterMaritalStatus(e.target.value)}>
                <option value="ALL">All Statuses</option>
                <option value="SINGLE">Single</option>
                <option value="MARRIED">Married</option>
                <option value="DIVORCED">Divorced</option>
                <option value="WIDOWED">Widowed</option>
              </select>
            </div>

            {/* 4. Age (Slabwise) */}
            <div>
              <label className="label text-[11px] font-bold text-slate-600">Age Group (Slabwise)</label>
              <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={filterAgeRange} onChange={e => setFilterAgeRange(e.target.value)}>
                <option value="ALL">All Ages</option>
                <option value="0_18">0 to 18 Years</option>
                <option value="19_25">19 to 25 Years</option>
                <option value="26_30">26 to 30 Years</option>
                <option value="31_35">31 to 35 Years</option>
                <option value="36_40">36 to 40 Years</option>
                <option value="41_50">41 to 50 Years</option>
                <option value="51_60">51 to 60 Years</option>
                <option value="61_75">61 to 75 Years</option>
                <option value="75_PLUS">75+ Years</option>
              </select>
            </div>

            {/* 5. Annual Income (Slabwise) */}
            <div>
              <label className="label text-[11px] font-bold text-slate-600">Annual Income (Slabwise)</label>
              <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={filterIncomeRange} onChange={e => setFilterIncomeRange(e.target.value)}>
                <option value="ALL">All Income Slabs</option>
                <option value="0_2.5L">0 to ₹2.5 Lakhs</option>
                <option value="2.5L_5L">₹2.5L to ₹5 Lakhs</option>
                <option value="5L_10L">₹5L to ₹10 Lakhs</option>
                <option value="10L_25L">₹10L to ₹25 Lakhs</option>
                <option value="25L_50L">₹25L to ₹50 Lakhs</option>
                <option value="50L_PLUS">Above ₹50 Lakhs</option>
              </select>
            </div>

            {/* 6. Education */}
            <div>
              <label className="label text-[11px] font-bold text-slate-600">Education</label>
              <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={filterEducation} onChange={e => setFilterEducation(e.target.value)}>
                <option value="ALL">All Education Levels</option>
                {EDUCATION_OPTIONS.map(edu => (
                  <option key={edu} value={edu}>{edu}</option>
                ))}
              </select>
            </div>

            {/* 7. Occupation Type */}
            <div>
              <label className="label text-[11px] font-bold text-slate-600">Occupation Type</label>
              <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={filterOccupation} onChange={e => setFilterOccupation(e.target.value)}>
                <option value="ALL">All Occupations</option>
                {OCCUPATION_TYPE_OPTIONS.map(occ => (
                  <option key={occ} value={occ}>{occ}</option>
                ))}
              </select>
            </div>

            {/* 8. Residency Status (Indian / NRI / OCI) */}
            <div>
              <label className="label text-[11px] font-bold text-slate-600">Residency Status</label>
              <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={filterResidency} onChange={e => setFilterResidency(e.target.value)}>
                <option value="ALL">All Residency Types</option>
                <option value="Indian">Indian Resident</option>
                <option value="NRI">NRI (Non-Resident Indian)</option>
                <option value="OCI">OCI (Overseas Citizen)</option>
              </select>
            </div>

            {/* 9. State */}
            <div>
              <label className="label text-[11px] font-bold text-slate-600">State</label>
              <input
                type="text"
                placeholder="e.g. Maharashtra, Delhi..."
                className="input text-xs w-full bg-white shadow-2xs mt-1"
                value={filterState}
                onChange={e => setFilterState(e.target.value)}
              />
            </div>

            {/* 10. City */}
            <div>
              <label className="label text-[11px] font-bold text-slate-600">City</label>
              <input
                type="text"
                placeholder="e.g. Mumbai, Pune..."
                className="input text-xs w-full bg-white shadow-2xs mt-1"
                value={filterCity}
                onChange={e => setFilterCity(e.target.value)}
              />
            </div>

            {/* 11. Bank */}
            <div>
              <label className="label text-[11px] font-bold text-slate-600">Bank Name</label>
              <input
                type="text"
                placeholder="e.g. HDFC, ICICI, SBI..."
                className="input text-xs w-full bg-white shadow-2xs mt-1"
                value={filterBank}
                onChange={e => setFilterBank(e.target.value)}
              />
            </div>

            {/* 12. Active Status */}
            <div>
              <label className="label text-[11px] font-bold text-slate-600">Contact Active Status</label>
              <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={filterActiveStatus} onChange={e => setFilterActiveStatus(e.target.value)}>
                <option value="ALL">All Contacts (Active & Inactive)</option>
                <option value="Active">Active Only</option>
                <option value="Inactive">Inactive Only</option>
              </select>
            </div>

            {/* 13. Policy Combination Segment (Health / Term) */}
            <div>
              <label className="label text-[11px] font-bold text-slate-600">Policy Combination Segment</label>
              <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={filterPolicyCombo} onChange={e => setFilterPolicyCombo(e.target.value)}>
                <option value="ALL">All Clients</option>
                <option value="HEALTH_NO_TERM">Health but No Term</option>
                <option value="TERM_NO_HEALTH">Term but No Health</option>
              </select>
            </div>

            {/* 14. Role */}
            <div>
              <label className="label text-[11px] font-bold text-slate-600">Role</label>
              <select className="input text-xs w-full bg-white shadow-2xs mt-1" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                <option value="ALL">All Roles</option>
                <option value="SUPERADMIN">Super Admin</option>
                <option value="ADMIN">Admin</option>
                <option value="EMPLOYEE">Employee</option>
                <option value="CUSTOMER">Customer</option>
                <option value="AGENT">Agent</option>
              </select>
            </div>

            {/* 15. Assigned Agent */}
            <div>
              <label className="label text-[11px] font-bold text-slate-600">Assigned Agent</label>
              <select
                value={leadInfoFields.assignedEmployeeId}
                onChange={e => setLeadInfoFields(prev => ({ ...prev, assignedEmployeeId: e.target.value }))}
                className="input text-xs w-full bg-white shadow-2xs mt-1 font-semibold"
              >
                <option value="">All Agents</option>
                {employeesList.map((emp: any) => {
                  const empUserId = emp.userId || emp.user?.id || emp.id;
                  const empName = `${emp.firstName || emp.user?.firstName || ''} ${emp.lastName || emp.user?.lastName || ''}`.trim() || emp.email || 'Employee';
                  return (
                    <option key={emp.id || empUserId} value={empUserId}>
                      {empName}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 16. Product Not Purchased (Exclude Filter) */}
            <div>
              <label className="label text-[11px] font-bold text-slate-600">Product Not Purchased</label>
              <select
                className="input text-xs w-full bg-white shadow-2xs mt-1"
                value={filterProducts.length > 0 && excludeProduct ? filterProducts[0] : 'NONE'}
                onChange={e => {
                  if (e.target.value === 'NONE') {
                    if (excludeProduct) {
                      setFilterProducts([]);
                      setExcludeProduct(false);
                    }
                  } else {
                    setFilterProducts([e.target.value]);
                    setExcludeProduct(true);
                  }
                }}
              >
                <option value="NONE">None (Select Category...)</option>
                <option value="HEALTH">Health (Not Purchased)</option>
                <option value="LIFE">Life (Not Purchased)</option>
                <option value="MF">Mutual Funds / MF (Not Purchased)</option>
                <option value="ACCIDENT">Accident (Not Purchased)</option>
                <option value="OTHER">Other Products (Not Purchased)</option>
              </select>
            </div>

            {/* 17. Medical History Multi-Select */}
            <div className="sm:col-span-2">
              <MultiSelectBox
                label="Medical History (BP, Sugar, Thyroid, etc.)"
                selectedValues={filterMedicalHistory}
                onChange={setFilterMedicalHistory}
                badgeColor="blue"
                placeholder="Select Medical Conditions to filter..."
              />
            </div>

          </div>

          {/* Card Actions */}
          <div className="flex flex-wrap justify-between items-center gap-3 mt-6 pt-4 border-t border-slate-200/70">
            {/* Export Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 mr-1">Export Data:</span>
              <button
                type="button"
                onClick={exportContactsToExcel}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer shadow-2xs transition-all flex items-center gap-1.5 text-xs font-bold bg-white"
                title="Export to Excel"
              >
                <FileText size={14} className="text-emerald-600" />
                <span>Export Excel</span>
              </button>
              <button
                type="button"
                onClick={exportContactsToPdf}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer shadow-2xs transition-all flex items-center gap-1.5 text-xs font-bold bg-white"
                title="Export to PDF"
              >
                <FileText size={14} className="text-red-500" />
                <span>Export PDF</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={resetAllContactsFilters}
                className="px-6 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              >
                Reset Filters
              </button>
              <button
                type="button"
                onClick={() => setShowAdvancedFilters(false)}
                className="px-6 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl transition-all shadow-md shadow-blue-500/20 cursor-pointer"
              >
                Apply Filters {activeContactsFilterCount > 0 ? `(${activeContactsFilterCount})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Data Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <DataTable
          columns={activeCols}
          data={sortedAndFilteredData}
          total={activeTab === 'birthdays' ? birthdayList.length : (contactsRes?.meta?.total ?? contactsRes?.total ?? contactsRes?.meta?.totalCount ?? contactsListArray.length)}
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
              openLeadView(r);
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
        <div className="flex flex-wrap justify-end gap-2">
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
                    <label key={t} className="inline-flex flex-wrap items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
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
                <DatePicker
                  value={interactionFields.nextFollowUp}
                  onChange={val => setInteractionFields(prev => ({ ...prev, nextFollowUp: val }))}
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

            <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100 mt-2">
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
                        <span>{format(new Date(act.createdAt), 'dd/MMM/yyyy hh:mm a')}</span>
                        <span className="text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md">{creatorName}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
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
          activeLeadTab === 'Policy'
            ? (editContactId ? "Edit Policy" : "Add Policy")
            : editContactId
              ? (activeTab === 'customers' ? "Edit Customer Profile" : "Edit Contact Profile")
              : (activeTab === 'customers' ? "Add New Customer" : "Add New Contact")
        }
        subtitle={
          activeLeadTab === 'Policy'
            ? "Add or update policy details, company, plan name, and coverage."
            : editContactId
              ? (activeTab === 'customers' ? "Update customer profile, family details, and policies." : "Update contact profile, family details, and address.")
              : (activeTab === 'customers' ? "Manage customer profile, family details, and policies." : "Manage contact profile, family details, and address.")
        }
        size="2xl"
        actions={
          <div className="flex gap-2.5 mr-1">
            {isViewMode ? (
                <button
                  type="button"
                  className="px-3 sm:px-5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl cursor-pointer shadow-md shadow-blue-500/20 transition-all hover:scale-105"
                  onClick={() => setIsViewMode(false)}
                >
                  Edit
                </button>
            ) : (
              <button
                type="button"
                className="px-3 sm:px-5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl cursor-pointer shadow-md shadow-blue-500/20 transition-all hover:scale-105"
                onClick={(e) => handleLeadSubmit(e, false)}
              >
                {activeLeadTab === 'Policy'
                  ? (editContactId ? 'Update Policy' : 'Add Policy')
                  : (editContactId ? 'Update Profile' : 'Save')}
              </button>
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
            <fieldset disabled={isViewMode} className="min-w-0 border-0 p-0 m-0 w-full">
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
                  const isExisting = card.id.length === 24 || /^[0-9a-fA-F]{24}$/.test(card.id);
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
                        <div className="flex flex-wrap items-center gap-3 min-w-0">
                          <div className="w-6 h-6 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                            <span className="text-white font-black text-[11px]">{idx + 1}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-white font-extrabold text-xs truncate">
                              {displayName}
                              {isExisting && (
                                <span className="ml-2 px-1.5 py-0.5 rounded bg-white/20 text-white font-bold text-[9px] uppercase tracking-wider">
                                  Existing
                                </span>
                              )}
                            </p>
                            {card.collapsed && card.leadStage && (
                              <p className="text-white/70 text-[10px] font-semibold truncate">
                                {card.leadStage.replace(/_/g, ' ')} · {card.leadStatus.replace(/_/g, ' ')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {!isExisting && (
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); removeProductInterest(card.id); }}
                              className="p-1 rounded-lg bg-white/10 hover:bg-red-500/80 text-white transition-all"
                              title="Remove"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
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
                            <div className="flex items-center justify-between mb-2">
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Interested In <span className="text-red-500">*</span></label>
                              {isExisting && (
                                <span className="text-[10px] text-slate-400 font-medium italic">
                                  Category fixed for existing records. Change status below or click "+ Add Product Interest" for a new product.
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {['Health', 'Life', 'Term', 'Accident Policy', 'Motor', 'Mutual Funds', 'Porting', 'Other'].map(prod => {
                                const isSel = card.interestedIn.includes(prod);
                                const isAlreadySelected = false;
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
                                return (
                                  <button
                                    key={prod}
                                    type="button"
                                    disabled={isExisting}
                                    onClick={() => {
                                      const next = isSel ? [] : [prod];
                                      updateProductInterest(card.id, 'interestedIn', next);
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all select-none ${btnStyle} ${isExisting ? 'opacity-70 cursor-not-allowed' : ''}`}
                                  >
                                    {isSel ? '✓ ' : '+ '}{prod}
                                  </button>
                                );
                              })}
                            </div>
                            {card.interestedIn.includes('Other') && (
                              <div className="bg-slate-100/90 border-2 border-slate-300 rounded-xl p-3 space-y-1.5 animate-fadeIn mt-2.5">
                                <label className="label text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block">
                                  Specify Other Product Name *
                                </label>
                                <input
                                  type="text"
                                  disabled={isExisting}
                                  className={`w-full text-xs px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 font-medium focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none shadow-xs ${isExisting ? 'opacity-75 bg-slate-100 cursor-not-allowed' : ''}`}
                                  placeholder="Specify product name..."
                                  value={card.otherProduct}
                                  onChange={e => updateProductInterest(card.id, 'otherProduct', e.target.value)}
                                />
                              </div>
                            )}
                          </div>

                          {/* Description Details Box */}
                          <div className="bg-slate-50/90 rounded-2xl border border-slate-200/70 p-4 space-y-2 shadow-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                <FileText size={13} />
                              </div>
                              <h4 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                                Description Details
                              </h4>
                            </div>
                            <textarea
                              rows={2}
                              className="w-full text-xs p-3 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl text-slate-800 placeholder-slate-400 font-medium outline-none resize-y transition-all shadow-2xs"
                              placeholder="Enter details for whom they are interested, specific coverage requirements, family member preferences, or notes..."
                              value={card.descriptionDetails || ''}
                              onChange={e => updateProductInterest(card.id, 'descriptionDetails', e.target.value)}
                            />
                          </div>

                          {/* Row 1: Stage, Status, Type */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Lead Stage *</label>
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
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Lead Status *{isExisting ? ' (Editable)' : ''}
                              </label>
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
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Lead Type *</label>
                              <select
                                disabled={isExisting}
                                className={`input w-full text-xs ${isExisting ? 'opacity-75 bg-slate-100 cursor-not-allowed' : ''}`}
                                value={card.leadType}
                                onChange={e => updateProductInterest(card.id, 'leadType', e.target.value)}
                              >
                                <option value="FRESH">Fresh</option>
                                <option value="RENEWAL">Renewal</option>
                                <option value="PORTING">Porting</option>
                              </select>
                            </div>
                          </div>

                          {/* Prominent Dependent Details Textbox when Depend is selected */}
                          {card.dependencyType === 'DEPENDENT' && (
                            <div className="bg-blue-50/80 border-2 border-blue-200 rounded-xl p-3 space-y-1.5 animate-fadeIn">
                              <label className="label text-[10px] font-extrabold text-blue-700 uppercase tracking-wider flex flex-wrap items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                                Dependent Details / Name / Relation *
                              </label>
                              <input
                                type="text"
                                disabled={isExisting}
                                className={`w-full text-xs px-3.5 py-2.5 bg-white border border-blue-300 rounded-lg text-slate-800 placeholder-slate-400 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-xs ${isExisting ? 'opacity-75 bg-slate-100 cursor-not-allowed' : ''}`}
                                placeholder="Enter dependent details (e.g. Spouse - Anita Sharma, Age 32)..."
                                value={card.dependentDetails || ''}
                                onChange={e => updateProductInterest(card.id, 'dependentDetails', e.target.value)}
                              />
                            </div>
                          )}

                          {/* Row 2: Source, Assigned Employee, Follow-up Date, Expected Premium */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Lead Source *</label>
                              <input
                                type="text"
                                disabled={isExisting}
                                list={`lead-source-list-${card.id}`}
                                className={`input w-full text-xs ${isExisting ? 'opacity-75 bg-slate-100 cursor-not-allowed' : ''}`}
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
                                className="input w-full text-xs bg-white"
                                value={card.assignedEmployeeId}
                                onChange={e => updateProductInterest(card.id, 'assignedEmployeeId', e.target.value)}
                              >
                                <option value="">Unassigned</option>
                                {employeesList.map((emp: any) => {
                                  const empUserId = emp.userId || emp.user?.id || emp.id;
                                  const empName = `${emp.firstName || emp.user?.firstName || ''} ${emp.lastName || emp.user?.lastName || ''}`.trim() || emp.email || 'Employee';
                                  return (
                                    <option key={emp.id || empUserId} value={empUserId}>
                                      {empName}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Follow-up Date *</label>
                              <DatePicker
                                disabled={isExisting}
                                className={`input w-full text-xs ${isExisting ? 'opacity-75 bg-slate-100 cursor-not-allowed' : ''}`}
                                value={card.followUpDate}
                                onDateChange={date => updateProductInterest(card.id, 'followUpDate', date)}
                              />
                            </div>
                            <div>
                              <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Expected Premium / Budget (₹) *</label>
                              <input
                                type="number"
                                disabled={isExisting}
                                className={`input w-full text-xs ${isExisting ? 'opacity-75 bg-slate-100 cursor-not-allowed' : ''}`}
                                placeholder="e.g. 12000"
                                min={0}
                                value={card.expectedPremium}
                                onChange={e => updateProductInterest(card.id, 'expectedPremium', e.target.value)}
                              />
                            </div>
                          </div>

                          {/* Consultation Comments Section */}
                          <div className="bg-slate-50/90 rounded-2xl border border-slate-200/70 p-4 space-y-3 shadow-xs">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                  <MessageCircle size={13} />
                                </div>
                                <h4 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                                  Consultation Comments
                                </h4>
                              </div>
                              {card.comments.length > 0 && (
                                <span className="text-[10px] font-extrabold bg-slate-200/70 text-slate-600 px-2 py-0.5 rounded-full">
                                  {card.comments.length} {card.comments.length === 1 ? 'Comment' : 'Comments'}
                                </span>
                              )}
                            </div>

                            {/* Timeline List */}
                            <div className="max-h-56 overflow-y-auto space-y-2.5 custom-scrollbar pr-0.5">
                              {card.comments.length === 0 ? (
                                <div className="bg-white/60 rounded-xl border border-dashed border-slate-200 p-4 text-center">
                                  <p className="text-xs text-slate-400 font-medium italic">No comments yet. Add the first summary below.</p>
                                </div>
                              ) : (
                                (card.showAllComments ? card.comments : card.comments.slice(0, 2)).map((cmt, ci) => (
                                  <div key={ci} className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs hover:shadow-xs hover:border-blue-200 transition-all space-y-1.5 relative overflow-hidden group">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="inline-flex flex-wrap items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg shadow-2xs">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                        {cmt.author}
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-semibold flex flex-wrap items-center gap-1">
                                        {cmt.datetime}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap pl-0.5">
                                      {cmt.text}
                                    </p>
                                  </div>
                                ))
                              )}
                            </div>

                            {/* Know More / Show Less Toggle Button */}
                            {card.comments.length > 2 && (
                              <div className="pt-0.5 flex justify-start">
                                <button
                                  type="button"
                                  onClick={() => updateProductInterest(card.id, 'showAllComments', !card.showAllComments)}
                                  className="inline-flex flex-wrap items-center gap-1 text-xs font-extrabold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-all"
                                >
                                  {card.showAllComments ? (
                                    <>
                                      Show Less <ChevronUp size={13} />
                                    </>
                                  ) : (
                                    <>
                                      Know More ({card.comments.length - 2} more history) <ChevronDown size={13} />
                                    </>
                                  )}
                                </button>
                              </div>
                            )}

                            {/* Add Call Summary & Consultation Comment Box */}
                            <div className="bg-white rounded-xl border-2 border-blue-200/90 p-3 space-y-2 shadow-2xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all mt-1">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider flex flex-wrap items-center gap-1.5">
                                  <MessageCircle size={12} className="text-blue-600" />
                                  Add Call Summary / Comment
                                </label>
                                <span className="text-[9px] text-slate-400 font-semibold italic">Press Ctrl+Enter to save</span>
                              </div>
                              <textarea
                                rows={2}
                                className="w-full text-xs p-2.5 bg-slate-50/70 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 font-medium focus:bg-white focus:border-blue-400 outline-none resize-y transition-all"
                                placeholder="Type call summary, client discussion details, or follow-up notes..."
                                value={card.newComment}
                                onChange={e => updateProductInterest(card.id, 'newComment', e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    e.preventDefault();
                                    addProductComment(card.id);
                                  }
                                }}
                              />
                              <div className="flex justify-end pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => addProductComment(card.id)}
                                  disabled={!card.newComment.trim()}
                                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs cursor-pointer transition-all shadow-xs flex flex-wrap items-center gap-1.5"
                                >
                                  <Send size={12} />
                                  Save Call Summary
                                </button>
                              </div>
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
                  className="w-full mt-1 py-3 rounded-2xl border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50 text-blue-600 hover:text-blue-700 text-[10px] sm:text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer group"
                >
                  + Add Product Interest
                </button>

              </div>
            )}
            {activeLeadTab === 'Personal' && (
              <div className="space-y-4 max-h-[62vh] overflow-y-auto pr-1">
                {/* 1. Personal Details */}
                <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => togglePersonalCollapse('personalDetails')}
                  >
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">1</span>
                      Personal Details
                    </h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Basic Demographics</span>
                      <ChevronDown
                        size={16}
                        className={`text-slate-500 transition-transform duration-200 ${personalCollapsed['personalDetails'] ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>
                  {!personalCollapsed['personalDetails'] && (
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">First Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                        placeholder="e.g. Rahul"
                        value={personalFields.firstName}
                        onChange={e => setPersonalFields(p => ({ ...p, firstName: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Middle Name</label>
                      <input
                        type="text"
                        className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                        placeholder="e.g. Kumar"
                        value={personalFields.middleName}
                        onChange={e => setPersonalFields(p => ({ ...p, middleName: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Last Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                        placeholder="e.g. Sharma"
                        value={personalFields.lastName}
                        onChange={e => setPersonalFields(p => ({ ...p, lastName: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Is Dependent?</label>
                      <select
                        className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all font-semibold"
                        value={personalFields.isDependent ? 'YES' : 'NO'}
                        onChange={e => setPersonalFields(p => ({ ...p, isDependent: e.target.value === 'YES' }))}
                      >
                        <option value="NO">No</option>
                        <option value="YES">Yes</option>
                      </select>
                    </div>
                    {personalFields.isDependent && (
                      <div className="animate-fadeIn">
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                          Guardian WhatsApp Number <span className="text-red-500">*</span>
                        </label>
                        <CountryPhoneInput
                          value={personalFields.dependentNo || ''}
                          onChange={(value: string) => setPersonalFields(p => ({ ...p, dependentNo: value }))}
                        />
                      </div>
                    )}
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Mother's Name</label>
                      <input
                        type="text"
                        className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                        placeholder="e.g. Sunita Sharma"
                        value={personalFields.motherName || ''}
                        onChange={e => setPersonalFields(p => ({ ...p, motherName: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Gender</label>
                      <select
                        className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                        value={personalFields.gender}
                        onChange={e => setPersonalFields(p => ({ ...p, gender: e.target.value }))}
                      >
                        <option value="">Select Gender</option>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Marital Status</label>
                      <select
                        className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                        value={personalFields.maritalStatus}
                        onChange={e => setPersonalFields(p => ({ ...p, maritalStatus: e.target.value }))}
                      >
                        <option value="">Select Status</option>
                        <option value="SINGLE">Single</option>
                        <option value="MARRIED">Married</option>
                        <option value="DIVORCED">Divorced</option>
                        <option value="WIDOWED">Widowed</option>
                      </select>
                    </div>
                    {personalFields.maritalStatus === 'MARRIED' && (
                      <div className="animate-fadeIn">
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Wedding Anniversary Date</label>
                        <DatePicker
                          className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                          value={personalFields.weddingAnniversaryDate || ''}
                          onDateChange={(val) => setPersonalFields(p => ({ ...p, weddingAnniversaryDate: val }))}
                        />
                      </div>
                    )}
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Date of Birth <span className="text-red-500">*</span></label>
                      <DatePicker
                        className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                        value={personalFields.dateOfBirth}
                        onDateChange={handleDOBChange}
                      />
                    </div>
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Age</label>
                      <input
                        type="text"
                        className="input w-full bg-slate-50 font-semibold text-slate-600 cursor-not-allowed rounded-xl"
                        value={personalFields.age}
                        disabled
                        placeholder="Auto-calculated"
                      />
                    </div>
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Height (cm)</label>
                      <input
                        type="number"
                        className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                        placeholder="e.g. 170"
                        value={personalFields.height}
                        onChange={(e) => setPersonalFields((p) => ({ ...p, height: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Weight (kg)</label>
                      <input
                        type="number"
                        className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                        placeholder="e.g. 65"
                        value={personalFields.weight}
                        onChange={(e) => setPersonalFields((p) => ({ ...p, weight: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">PAN Number {isFieldRequired('panNumber', false) && <span className="text-red-500">*</span>}</label>
                      <input
                        type="text"
                        placeholder="ABCDE1234F"
                        className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all uppercase"
                        value={personalFields.pan || personalFields.panNumber || ''}
                        onChange={(e) => setPersonalFields(p => ({ ...p, pan: e.target.value.toUpperCase(), panNumber: e.target.value.toUpperCase() }))}
                      />
                    </div>
                    </div>
                  )}
                </div>

                {/* 2. Contact Details */}
                <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => togglePersonalCollapse('contactDetails')}
                  >
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">2</span>
                      Contact Details
                    </h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Communication Info</span>
                      <ChevronDown
                        size={16}
                        className={`text-slate-500 transition-transform duration-200 ${personalCollapsed['contactDetails'] ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>
                  {!personalCollapsed['contactDetails'] && (
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Email Address {isFieldRequired('email', false) && <span className="text-red-500">*</span>}</label>
                      <input
                        type="email"
                        className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                        placeholder="client@example.com"
                        value={personalFields.email}
                        onChange={e => setPersonalFields(p => ({ ...p, email: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Aadhaar Number {isFieldRequired('aadhaarNumber', false) && <span className="text-red-500">*</span>}</label>
                      <input
                        type="text"
                        className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                        placeholder="12-digit Aadhaar No"
                        maxLength={12}
                        value={personalFields.aadhaarNumber}
                        onChange={e => setPersonalFields(p => ({ ...p, aadhaarNumber: e.target.value.replace(/\D/g, '') }))}
                      />
                    </div>
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                        Whatsapp Number {!personalFields.isDependent && <span className="text-red-500">*</span>}
                      </label>
                      <CountryPhoneInput
                        value={personalFields.whatsappNumber}
                        onChange={(value: string) =>
                          setPersonalFields((p) => ({
                            ...p,
                            whatsappNumber: value,
                            callingNumber: p.sameAsWhatsapp ? value : p.callingNumber,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Calling Number</label>
                        <label className="flex flex-wrap items-center gap-1 text-[10px] text-blue-600 font-semibold cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="accent-blue-600 w-3 h-3 rounded"
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
                      <CountryPhoneInput
                        disabled={personalFields.sameAsWhatsapp}
                        value={personalFields.callingNumber}
                        onChange={(value: string) =>
                          setPersonalFields((p) => ({
                            ...p,
                            callingNumber: value,
                          }))
                        }
                      />
                    </div>
                    </div>
                  )}
                </div>

                {/* 3. Education & Occupation */}
                <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-visible">
                  <div
                    className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => togglePersonalCollapse('educationOccupation')}
                  >
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">3</span>
                      Education &amp; Occupation
                    </h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Professional Profile</span>
                      <ChevronDown
                        size={16}
                        className={`text-slate-500 transition-transform duration-200 ${personalCollapsed['educationOccupation'] ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>
                  {!personalCollapsed['educationOccupation'] && (
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Education</label>
                      <DatalistInput
                        className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                        placeholder="Select or enter Education"
                        value={personalFields.education || ''}
                        options={EDUCATION_OPTIONS}
                        onChange={val => setPersonalFields(p => ({ ...p, education: val }))}
                      />
                    </div>
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Annual Income {isFieldRequired('annualIncome', false) && <span className="text-red-500">*</span>}</label>
                      <select
                        className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                        value={personalFields.annualIncome}
                        onChange={e => setPersonalFields(p => ({ ...p, annualIncome: e.target.value }))}
                      >
                        <option value="">Select Income Bracket</option>
                        <option value="200000">Below 2 Lakhs</option>
                        <option value="500000">2 - 5 Lakhs</option>
                        <option value="1000000">5 - 10 Lakhs</option>
                        <option value="2000000">10 - 20 Lakhs</option>
                        <option value="5000000">20+ Lakhs</option>
                      </select>
                    </div>
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Occupation Type <span className="text-red-500">*</span></label>
                      <DatalistInput
                        className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                        placeholder="Select or enter Occupation Type"
                        value={personalFields.occupationType || ''}
                        options={OCCUPATION_TYPE_OPTIONS}
                        onChange={val => setPersonalFields(p => ({ ...p, occupationType: val }))}
                      />
                    </div>
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Company / Business Name</label>
                      <input
                        type="text"
                        className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                        placeholder="e.g. Infosys / Traders"
                        value={personalFields.companyName}
                        onChange={e => setPersonalFields(p => ({ ...p, companyName: e.target.value }))}
                      />
                    </div>
                    </div>
                  )}
                </div>

                {/* 4. Address Details */}
                <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => togglePersonalCollapse('addressDetails')}
                  >
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">4</span>
                      Address Details
                    </h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Location &amp; Residence</span>
                      <ChevronDown
                        size={16}
                        className={`text-slate-500 transition-transform duration-200 ${personalCollapsed['addressDetails'] ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>
                  {!personalCollapsed['addressDetails'] && (
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">State <span className="text-red-500">*</span></label>
                      <select
                        className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
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
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">District <span className="text-red-500">*</span></label>
                      <select
                        className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
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
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">City / Town <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                        placeholder="e.g. Pune"
                        value={personalFields.city}
                        onChange={e => setPersonalFields(p => ({ ...p, city: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Pincode</label>
                      <input
                        type="text"
                        className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                        placeholder="000000"
                        value={personalFields.pincode}
                        onChange={e => setPersonalFields(p => ({ ...p, pincode: e.target.value }))}
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Street Address / House No</label>
                      <textarea
                        className="input w-full text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                        rows={2}
                        placeholder="Flat No, Street, Landmark..."
                        value={personalFields.streetAddress}
                        onChange={e => setPersonalFields(p => ({ ...p, streetAddress: e.target.value }))}
                      />
                    </div>
                    </div>
                  )}
                </div>

                {/* 5. Bank Details */}
                <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => togglePersonalCollapse('bankDetails')}
                  >
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">5</span>
                      Bank Details
                    </h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Banking Information</span>
                      <ChevronDown
                        size={16}
                        className={`text-slate-500 transition-transform duration-200 ${personalCollapsed['bankDetails'] ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>
                  {!personalCollapsed['bankDetails'] && (
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Bank Name</label>
                      <input
                        type="text"
                        className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                        placeholder="e.g. HDFC Bank"
                        value={personalFields.bankName || ''}
                        onChange={e => setPersonalFields(p => ({ ...p, bankName: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Account Number</label>
                      <input
                        type="text"
                        className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                        placeholder="e.g. 50100012345678"
                        value={personalFields.bankAccountNumber || ''}
                        onChange={e => setPersonalFields(p => ({ ...p, bankAccountNumber: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">IFSC Code</label>
                      <input
                        type="text"
                        className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all uppercase"
                        placeholder="e.g. HDFC0001234"
                        value={personalFields.bankIfsc || ''}
                        onChange={e => setPersonalFields(p => ({ ...p, bankIfsc: e.target.value.toUpperCase() }))}
                      />
                    </div>
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Branch Name</label>
                      <input
                        type="text"
                        className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                        placeholder="e.g. Shivajinagar Branch"
                        value={personalFields.bankBranch || ''}
                        onChange={e => setPersonalFields(p => ({ ...p, bankBranch: e.target.value }))}
                      />
                    </div>
                    </div>
                  )}
                </div>

                {/* 6. Lifestyle Habits */}
                <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => togglePersonalCollapse('lifestyleHabits')}
                  >
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">6</span>
                      Lifestyle Habits
                    </h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Personal Habits</span>
                      <ChevronDown
                        size={16}
                        className={`text-slate-500 transition-transform duration-200 ${personalCollapsed['lifestyleHabits'] ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>
                  {!personalCollapsed['lifestyleHabits'] && (
                    <div className="p-4 flex flex-wrap gap-4">
                    <label className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all cursor-pointer select-none ${personalFields.chewTobacco ? 'bg-blue-50/80 border-blue-300 text-blue-800 font-bold shadow-2xs' : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      <input
                        type="checkbox"
                        className="accent-blue-600 w-4 h-4 rounded"
                        checked={!!personalFields.chewTobacco}
                        onChange={e => setPersonalFields(p => ({ ...p, chewTobacco: e.target.checked }))}
                      />
                      <span className="text-xs font-semibold">Chew Tobacco</span>
                    </label>
                    <label className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all cursor-pointer select-none ${personalFields.smoke ? 'bg-blue-50/80 border-blue-300 text-blue-800 font-bold shadow-2xs' : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      <input
                        type="checkbox"
                        className="accent-blue-600 w-4 h-4 rounded"
                        checked={!!personalFields.smoke}
                        onChange={e => setPersonalFields(p => ({ ...p, smoke: e.target.checked }))}
                      />
                      <span className="text-xs font-semibold">Smoke</span>
                    </label>
                    <label className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all cursor-pointer select-none ${personalFields.consumeAlcohol ? 'bg-blue-50/80 border-blue-300 text-blue-800 font-bold shadow-2xs' : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      <input
                        type="checkbox"
                        className="accent-blue-600 w-4 h-4 rounded"
                        checked={!!personalFields.consumeAlcohol}
                        onChange={e => setPersonalFields(p => ({ ...p, consumeAlcohol: e.target.checked }))}
                      />
                      <span className="text-xs font-semibold">Consume Alcohol</span>
                    </label>
                    </div>
                  )}
                </div>

                {/* 7. Health History / Medical History */}
                <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => togglePersonalCollapse('healthHistory')}
                  >
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">7</span>
                      Health History / Medical History
                    </h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Medical Records</span>
                      <ChevronDown
                        size={16}
                        className={`text-slate-500 transition-transform duration-200 ${personalCollapsed['healthHistory'] ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>
                  {!personalCollapsed['healthHistory'] && (
                    <div className="p-4 space-y-4">
                    {/* Declared Medical History Multi-Select */}
                    <MultiSelectBox
                      label="Declared Medical History (Multi-Select)"
                      selectedValues={(personalFields.declaredMedicalHistory || []) as string[]}
                      onChange={(vals) => setPersonalFields(p => ({ ...p, declaredMedicalHistory: vals }))}
                      badgeColor="blue"
                      placeholder="Click to select medical conditions..."
                    />

                    {/* NOT Declared Medical History Multi-Select */}
                    <MultiSelectBox
                      label="NOT Declared Medical History (Multi-Select)"
                      selectedValues={(personalFields.notDeclaredMedicalHistory || []) as string[]}
                      onChange={(vals) => setPersonalFields(p => ({ ...p, notDeclaredMedicalHistory: vals }))}
                      badgeColor="orange"
                      placeholder="Click to select NOT declared conditions..."
                    />

                    {/* Details of Medical History */}
                    <div>
                      <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Details of Medical History</label>
                      <textarea
                        className="input w-full resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                        rows={2}
                        placeholder="Add any additional medical history details..."
                        value={personalFields.medicalHistoryDetails}
                        onChange={e => setPersonalFields(p => ({ ...p, medicalHistoryDetails: e.target.value }))}
                      />
                    </div>
                    </div>
                  )}
                </div>

                {/* 8. Any Surgery Done / Advised */}
                <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => togglePersonalCollapse('surgeryDetails')}
                  >
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">8</span>
                      Any Surgery Done / Advised
                    </h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Surgical History</span>
                      <ChevronDown
                        size={16}
                        className={`text-slate-500 transition-transform duration-200 ${personalCollapsed['surgeryDetails'] ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>
                  {!personalCollapsed['surgeryDetails'] && (
                    <div className="p-4">
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Surgery Details / History</label>
                    <textarea
                      className="input w-full text-xs resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      rows={2}
                      placeholder="Specify any surgeries done or advised..."
                      value={personalFields.surgeryDetails || ''}
                      onChange={e => setPersonalFields(p => ({ ...p, surgeryDetails: e.target.value }))}
                    />
                    </div>
                  )}
                </div>

                {/* 9. Current Medicines / Prescription */}
                <div className="border border-slate-200/90 rounded-2xl bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/30 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => togglePersonalCollapse('prescriptionDetails')}
                  >
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex flex-wrap items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">9</span>
                      Current Medicines / Prescription
                    </h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Ongoing Medications</span>
                      <ChevronDown
                        size={16}
                        className={`text-slate-500 transition-transform duration-200 ${personalCollapsed['prescriptionDetails'] ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>
                  {!personalCollapsed['prescriptionDetails'] && (
                    <div className="p-4">
                    <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Prescription &amp; Medication Details</label>
                    <textarea
                      className="input w-full text-xs resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all"
                      rows={2}
                      placeholder="List current ongoing medicines or prescriptions..."
                      value={personalFields.prescriptionDetails || ''}
                      onChange={e => setPersonalFields(p => ({ ...p, prescriptionDetails: e.target.value }))}
                    />
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
                    className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] sm:text-xs font-semibold rounded-lg cursor-pointer transition-colors"
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

                        {/* Row 1: First Name | Middle Name | Last Name | DOB | Relation */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 pt-3">
                          <div>
                            <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">First Name {isFieldRequired('firstName', true) && <span className="text-red-500">*</span>}</label>
                            <input
                              type="text"
                              className="input w-full mt-1"
                              placeholder="First name"
                              value={member.firstName}
                              onChange={e => updateFamilyMemberName(idx, e.target.value, member.middleName, member.lastName)}
                            />
                          </div>
                          <div>
                            <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Middle Name</label>
                            <input
                              type="text"
                              className="input w-full mt-1"
                              placeholder="Middle name"
                              value={member.middleName}
                              onChange={e => updateFamilyMemberName(idx, member.firstName, e.target.value, member.lastName)}
                            />
                          </div>
                          <div>
                            <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Last Name {isFieldRequired('lastName', true) && <span className="text-red-500">*</span>}</label>
                            <input
                              type="text"
                              className="input w-full mt-1"
                              placeholder="Last name"
                              value={member.lastName}
                              onChange={e => updateFamilyMemberName(idx, member.firstName, member.middleName, e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Row 2: DOB | Relation | Occupation */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 pt-3">
                          <div>
                            <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">DOB</label>
                            <DatePicker
                              className="input w-full mt-1"
                              value={member.dob}
                              onChange={val => updateFamilyMember(idx, 'dob', val)}
                            />
                          </div>
                          <div>
                            <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Relation <span className="text-red-500">*</span></label>
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
                        </div>

                        {/* Row 3: WhatsApp | Calling Number | Education */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 pt-3">
                          <div>
                            <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">WhatsApp</label>
                            <div className="mt-1">
                              <CountryPhoneInput
                                value={member.whatsapp || ''}
                                onChange={(value: string) => updateFamilyMember(idx, 'whatsapp', value)}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Calling Number</label>
                            <div className="mt-1">
                              <CountryPhoneInput
                                value={member.callingNumber || ''}
                                onChange={(value: string) => updateFamilyMember(idx, 'callingNumber', value)}
                              />
                            </div>
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

                        {/* Row 3.5: Marital Status | Wedding Anniversary & Age (if married) | Height & Weight */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 pt-3">
                          <div>
                            <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Marital Status</label>
                            <input
                              type="text"
                              list={`marital-status-list-${idx}`}
                              className="input w-full mt-1"
                              placeholder="Select or type..."
                              value={member.maritalStatus || ''}
                              onChange={e => updateFamilyMember(idx, 'maritalStatus', e.target.value)}
                            />
                            <datalist id={`marital-status-list-${idx}`}>
                              <option value="Single" />
                              <option value="Married" />
                              <option value="Unmarried" />
                              <option value="Divorced" />
                              <option value="Widowed" />
                              <option value="Other" />
                            </datalist>
                          </div>

                          {member.maritalStatus?.toLowerCase() === 'married' ? (
                            <>
                              <div>
                                <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Wedding Anniversary Date</label>
                                <DatePicker
                                  className="input w-full mt-1"
                                  value={member.weddingAnniversary || ''}
                                  onChange={val => updateFamilyMember(idx, 'weddingAnniversary', val)}
                                />
                              </div>
                              <div>
                                <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Age</label>
                                <input
                                  type="text"
                                  className="input w-full mt-1"
                                  placeholder="Age"
                                  value={member.age || ''}
                                  onChange={e => updateFamilyMember(idx, 'age', e.target.value)}
                                />
                              </div>
                            </>
                          ) : (
                            <div>
                              <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Age</label>
                              <input
                                type="text"
                                className="input w-full mt-1"
                                placeholder="Age"
                                value={member.age || ''}
                                onChange={e => updateFamilyMember(idx, 'age', e.target.value)}
                              />
                            </div>
                          )}

                          <div>
                            <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Height (cm / ft)</label>
                            <input
                              type="text"
                              className="input w-full mt-1"
                              placeholder="e.g. 170 cm or 5.6 ft"
                              value={member.height || ''}
                              onChange={e => updateFamilyMember(idx, 'height', e.target.value)}
                            />
                          </div>

                          <div>
                            <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Weight (kg)</label>
                            <input
                              type="text"
                              className="input w-full mt-1"
                              placeholder="e.g. 65 kg"
                              value={member.weight || ''}
                              onChange={e => updateFamilyMember(idx, 'weight', e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Row 4: Medical History */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 pt-3 pb-3">
                          {/* Generic Medical History */}
                          <div className="col-span-3">
                            <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Medical History (Select if applicable)</label>
                            <div className="flex flex-wrap gap-x-6 gap-y-2">
                              {['BP', 'Sugar', 'Heart', 'Thyroid', 'Others'].map((condition) => {
                                const isOthers = condition === 'Others';
                                const current = member.medicalHistory || [];
                                const isSelected = isOthers
                                  ? current.some((c: string) => !['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c))
                                  : current.includes(condition);
                                return (
                                  <label key={condition} className="flex flex-wrap items-center gap-1.5 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      className="accent-blue-600 w-3.5 h-3.5"
                                      checked={isSelected}
                                      onChange={() => {
                                        setFamilyMembers(prev => prev.map((m, i) => {
                                          if (i !== idx) return m;
                                          const list: string[] = m.medicalHistory || [];
                                          if (isOthers) {
                                            if (isSelected) {
                                              return {
                                                ...m,
                                                medicalHistory: list.filter((c: string) => ['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c))
                                              };
                                            } else {
                                              return {
                                                ...m,
                                                medicalHistory: [...list, '']
                                              };
                                            }
                                          } else {
                                            return {
                                              ...m,
                                              medicalHistory: isSelected
                                                ? list.filter((c: string) => c !== condition)
                                                : [...list, condition]
                                            };
                                          }
                                        }));
                                      }}
                                    />
                                    <span className="text-xs text-slate-600 font-medium">{condition}</span>
                                  </label>
                                );
                              })}
                            </div>
                            {(member.medicalHistory || []).some((c: string) => !['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c)) && (
                              <div className="mt-2 animate-fadeIn">
                                <input
                                  type="text"
                                  className="input w-full text-xs py-1 px-2.5"
                                  placeholder="Type medical conditions..."
                                  value={(member.medicalHistory || []).find((c: string) => !['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c)) || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setFamilyMembers(prev => prev.map((m, i) => {
                                      if (i !== idx) return m;
                                      const current: string[] = m.medicalHistory || [];
                                      const baseVal = current.filter((c: string) => ['BP', 'Sugar', 'Heart', 'Thyroid'].includes(c));
                                      return {
                                        ...m,
                                        medicalHistory: [...baseVal, val]
                                      };
                                    }));
                                  }}
                                />
                              </div>
                            )}
                          </div>

                          {/* Declared Medical History Multi-Select */}
                          <div className="col-span-3">
                            <MultiSelectBox
                              label="Declared Medical History (Multi-Select)"
                              selectedValues={member.declaredMedicalHistory || []}
                              onChange={(vals) => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, declaredMedicalHistory: vals } : m))}
                              badgeColor="blue"
                              placeholder="Click to select declared medical conditions..."
                            />
                          </div>

                          {/* NOT Declared Medical History Multi-Select */}
                          <div className="col-span-3">
                            <MultiSelectBox
                              label="NOT Declared Medical History (Multi-Select)"
                              selectedValues={member.notDeclaredMedicalHistory || []}
                              onChange={(vals) => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, notDeclaredMedicalHistory: vals } : m))}
                              badgeColor="orange"
                              placeholder="Click to select NOT declared conditions..."
                            />
                          </div>

                          {/* Details of Medical History */}
                          <div className="col-span-3">
                            <label className="label text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Details of Medical History</label>
                            <textarea
                              className="input w-full resize-none"
                              rows={2}
                              placeholder="Add any additional medical history details..."
                              value={member.medicalHistoryDetails || ''}
                              onChange={e => setFamilyMembers(prev => prev.map((m, i) => i === idx ? { ...m, medicalHistoryDetails: e.target.value } : m))}
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeLeadTab === 'Policy' && (() => {
              const direct = loadedContact?.policies || [];
              const map1 = loadedContact?.id ? (policyMap[loadedContact.id] || []) : [];
              const map2 = loadedContact?.contactId ? (policyMap[loadedContact.contactId] || []) : [];
              const map3 = editContactId ? (policyMap[editContactId] || []) : [];
              const combined = [...direct, ...map1, ...map2, ...map3];
              const uniqueMap = new Map();
              combined.forEach(p => { if (p && p.id) uniqueMap.set(p.id, p); });
              const displayedPolicies = Array.from(uniqueMap.values());

              const isPolicyActive = (p: any) => {
                const statusUpper = (p.status || 'ACTIVE').toUpperCase();
                if (['EXPIRED', 'LAPSED', 'CANCELLED', 'INACTIVE'].includes(statusUpper)) {
                  return false;
                }
                if (p.endDate && new Date(p.endDate) < new Date()) {
                  return false;
                }
                return true;
              };

              const activePolicies = displayedPolicies.filter(isPolicyActive);
              const historicalPolicies = displayedPolicies.filter(p => !isPolicyActive(p));

              const renderPolicyCard = (policy: any) => {
                const isExpanded = !!expandedPolicyIds[policy.id];
                const type = (policy.plan?.category || 'OTHER').toUpperCase();
                const typeLabel = type === 'HEALTH' ? 'Health' : type === 'LIFE' ? 'Life' : type.charAt(0) + type.slice(1).toLowerCase();
                const isActive = isPolicyActive(policy);
                const displayStatus = policy.status || (isActive ? 'ACTIVE' : 'EXPIRED');
                const borderTone = isActive
                  ? (type === 'HEALTH' ? 'border-emerald-200' : type === 'LIFE' ? 'border-blue-200' : 'border-slate-200')
                  : 'border-amber-200 opacity-90';
                const headerTone = isActive
                  ? (type === 'HEALTH' ? 'from-emerald-500 to-teal-600' : type === 'LIFE' ? 'from-blue-500 to-indigo-600' : 'from-slate-600 to-slate-700')
                  : 'from-amber-600 to-orange-700';
                const statusTone = isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100';

                return (
                  <div
                    key={policy.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (policy) {
                        setPolicyToEdit(policy);
                        setCreatePolicyModalOpen(true);
                      }
                    }}
                    className={`overflow-hidden rounded-2xl border ${borderTone} bg-white shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group pointer-events-auto relative z-10`}
                    title="Click to view full Policy details"
                  >
                    {/* Header / Minimized Summary Bar */}
                    <div className={`flex items-center justify-between bg-gradient-to-r ${headerTone} px-4 py-3`}>
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-white shrink-0">
                          <Shield size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/80">{typeLabel}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${statusTone}`}>{displayStatus}</span>
                          </div>
                          <p className="text-white font-extrabold text-sm truncate mt-0.5">{policy.policyNumber || 'Policy Number'}</p>
                        </div>
                      </div>

                      {/* Expand / Collapse toggle button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedPolicyIds(prev => ({ ...prev, [policy.id]: !prev[policy.id] }));
                        }}
                        className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white transition-all cursor-pointer shrink-0 ml-1.5"
                        title={isExpanded ? 'Collapse policy card' : 'Expand policy card'}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>

                    {/* Expanded Details Section */}
                    {isExpanded && (
                      <div className="p-4 space-y-4 border-t border-slate-100 bg-slate-50/40">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="rounded-xl bg-white p-3 border border-slate-100 shadow-2xs">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Company</p>
                            <p className="text-xs font-bold text-slate-800 truncate mt-0.5">{policy.plan?.company?.name || policy.plan?.name || 'Insurance Co.'}</p>
                          </div>
                          <div className="rounded-xl bg-white p-3 border border-slate-100 shadow-2xs">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Plan</p>
                            <p className="text-xs font-bold text-slate-800 truncate mt-0.5">{policy.plan?.name || 'Standard Plan'}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-600">
                          <div className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-2xs">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sum Assured</p>
                            <p className="text-xs font-extrabold text-slate-900 mt-0.5">₹{(policy.sumAssured || 0).toLocaleString('en-IN')}</p>
                          </div>
                          <div className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-2xs">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Premium</p>
                            <p className="text-xs font-extrabold text-emerald-700 mt-0.5">₹{(policy.premiumAmount || 0).toLocaleString('en-IN')}</p>
                          </div>
                          <div className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-2xs">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Frequency</p>
                            <p className="text-xs font-bold text-slate-700 mt-0.5">{policy.paymentFrequency || 'Yearly'}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-white p-2.5 shadow-2xs">
                            <Calendar size={13} className="text-slate-400 shrink-0" />
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start</p>
                              <p className="text-xs font-semibold text-slate-700">{policy.startDate ? new Date(policy.startDate).toLocaleDateString('en-IN') : '—'}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
                            <Calendar size={13} className="text-slate-400 shrink-0" />
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">End</p>
                              <p className="text-xs font-semibold text-slate-700">{policy.endDate ? new Date(policy.endDate).toLocaleDateString('en-IN') : '—'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              };

              return (
                <div className="h-full flex flex-col">
                  {/* Action buttons */}
                  <div className="flex items-center justify-between gap-3 mb-3 flex-shrink-0">
                    <p className="text-[11px] text-slate-500 font-semibold">
                      Policies are created in the main policy form and will appear here after saving.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (!editContactId) {
                          toast.error('Please save the contact details first before adding a policy.');
                          return;
                        }
                        setPolicyToEdit(null);
                        setCreatePolicyModalOpen(true);
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-blue-400 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      + Add New Policy
                    </button>
                  </div>

                  <div className="space-y-5 mb-3 overflow-y-auto max-h-[60vh] custom-scrollbar pr-1">
                    {displayedPolicies.length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center min-h-[180px]">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                          <FileText size={18} />
                        </div>
                        <p className="text-sm font-bold text-slate-700">No policies linked yet</p>
                        <p className="text-[11px] text-slate-500 mt-1 max-w-[280px]">
                          Add a policy from the main policy form and it will show up here as a summary card.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Active Policies Section */}
                        {activePolicies.length > 0 && (
                          <div className="space-y-2.5">
                            <div className="flex items-center gap-2 px-1">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Active / Current Policies ({activePolicies.length})
                              </h4>
                            </div>
                            <div className="grid gap-3">
                              {activePolicies.map(renderPolicyCard)}
                            </div>
                          </div>
                        )}

                        {/* Historical / Expired Policies Section */}
                        {historicalPolicies.length > 0 && (
                          <div className="space-y-2.5 pt-2">
                            <div className="flex items-center gap-2 px-1">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                                Historical / Expired Policies ({historicalPolicies.length})
                              </h4>
                            </div>
                            <div className="grid gap-3">
                              {historicalPolicies.map(renderPolicyCard)}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Portfolio cards */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
                    {policies.length > 0 &&
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
                            <div className="flex flex-wrap items-center gap-2">
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
                                  <div className="flex flex-wrap items-center gap-2">
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
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                                  <div>
                                    <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Insurance Company</label>
                                    <select
                                      className="input w-full mt-1"
                                      value={entry.company}
                                      onChange={e => updatePolicyItem(pIdx, eIdx, 'company', e.target.value)}
                                    >
                                      <option value="">Select Company</option>
                                      {entry.company && ![
                                        'Star Health', 'HDFC Ergo', 'ICICI Lombard', 'Niva Bupa', 'Care Health',
                                        'Bajaj Allianz', 'Aditya Birla Health', 'SBI General', 'Tata AIG',
                                        'New India Assurance', 'LIC', 'HDFC Life', 'ICICI Prudential Life',
                                        'SBI Life', 'Max Life', 'Bajaj Allianz Life', 'Kotak Life',
                                        'Tata AIA Life', 'Aditya Birla Sun Life', 'PNB MetLife', 'Other'
                                      ].includes(entry.company) && (
                                          <option value={entry.company}>{entry.company}</option>
                                        )}
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
                                      {entry.planName && ![
                                        'Individual', 'Family Floater', 'Senior Citizen', 'Critical Illness', 'Top-Up', 'Super Top-Up',
                                        'Term Plan', 'Endowment', 'ULIP', 'Money Back', 'Whole Life', 'Child Plan', 'Other'
                                      ].includes(entry.planName) && (
                                          <option value={entry.planName}>{entry.planName}</option>
                                        )}
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
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
                                  <div>
                                    <label className="label text-[10px] font-bold text-gray-500 uppercase tracking-wider">Start Date</label>
                                    <DatePicker
                                      className="input w-full mt-1"
                                      value={entry.startDate}
                                      onChange={val => updatePolicyItem(pIdx, eIdx, 'startDate', val)}
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
                                    <DatePicker
                                      className="input w-full mt-1"
                                      value={entry.endDate}
                                      onChange={val => updatePolicyItem(pIdx, eIdx, 'endDate', val)}
                                    />
                                  </div>
                                </div>

                                {/* Row 4: Premium | Sum Insured | Deductible */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
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
                                  <label className="flex flex-wrap items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 cursor-pointer font-medium">
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
                    })}
                  </div>
                </div>
              );
            })()}

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
                      className="flex flex-wrap items-center gap-3 p-3 bg-gray-50/50 border border-gray-150 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
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
              <div className="space-y-4">
                {/* Tab Header */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      <History size={13} />
                    </div>
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      Contact & Family History Log
                    </h3>
                  </div>
                  <span className="text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-0.5 rounded-full">
                    {familyMembers.length} Family {familyMembers.length === 1 ? 'Member' : 'Members'}
                  </span>
                </div>

                <div className="max-h-[420px] overflow-y-auto pr-1 custom-scrollbar space-y-4">
                  {/* 1. Personal Details Log Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          <UserCircle2 size={13} />
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          Personal Information Log
                        </h4>
                      </div>
                      <span className="text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-md">
                        Active Contact
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100/80 space-y-0.5">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Name</span>
                        <p className="font-bold text-slate-800">
                          {(personalFields.firstName || personalFields.middleName || personalFields.lastName) ? `${personalFields.firstName} ${personalFields.middleName} ${personalFields.lastName}`.trim() : (loadedContact ? `${loadedContact.firstName || ''} ${loadedContact.middleName || ''} ${loadedContact.lastName || ''}`.trim() : 'Not provided')}
                        </p>
                      </div>

                      <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100/80 space-y-0.5">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Mobile & Email</span>
                        <p className="font-semibold text-slate-700">
                          {personalFields.callingNumber || personalFields.whatsappNumber || (loadedContact?.phone) || 'No phone'}
                          {(personalFields.email || loadedContact?.email) ? ` · ${personalFields.email || loadedContact?.email}` : ''}
                        </p>
                      </div>

                      <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100/80 space-y-0.5">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Date of Birth & Gender</span>
                        <p className="font-semibold text-slate-700">
                          {personalFields.dateOfBirth || loadedContact?.dob || 'DOB not set'}
                          {(personalFields.gender || loadedContact?.gender) ? ` · ${personalFields.gender || loadedContact?.gender}` : ''}
                        </p>
                      </div>

                      <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100/80 space-y-0.5">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Occupation & Marital Status</span>
                        <p className="font-semibold text-slate-700">
                          {personalFields.occupationType || loadedContact?.occupation || 'Not specified'}
                          {(personalFields.maritalStatus || loadedContact?.maritalStatus) ? ` · ${personalFields.maritalStatus || loadedContact?.maritalStatus}` : ''}
                        </p>
                      </div>
                    </div>

                    {(personalFields.streetAddress || personalFields.city || loadedContact?.address) && (
                      <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100/80 text-xs space-y-0.5">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Address Details</span>
                        <p className="text-slate-700 font-medium">
                          {[personalFields.streetAddress, personalFields.city, personalFields.state, personalFields.pincode].filter(Boolean).join(', ') || loadedContact?.address}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 2. Family Members Created & Linked Log Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <Users size={13} />
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          Family Members Created ({familyMembers.length})
                        </h4>
                      </div>
                      {familyMembers.length > 0 && (
                        <span className="text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-md">
                          {familyMembers.length} {familyMembers.length === 1 ? 'Member Created' : 'Members Created'}
                        </span>
                      )}
                    </div>

                    {familyMembers.length === 0 ? (
                      <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                        <p className="text-xs text-slate-400 font-medium italic">No family members created for this contact yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {familyMembers.map((member, idx) => (
                          <div key={idx} className="bg-slate-50/80 rounded-xl border border-slate-200/70 p-3 space-y-2 text-xs hover:border-blue-200 transition-all">
                            <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-extrabold flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <span className="font-extrabold text-slate-800 text-xs">
                                  {member.name || `Family Member #${idx + 1}`}
                                </span>
                              </div>
                              {member.relation && (
                                <span className="text-[10px] font-extrabold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">
                                  {member.relation}
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                              <div>
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase block">Date of Birth / Phone</span>
                                <p className="font-semibold text-slate-700">
                                  {member.dob || 'DOB not set'} {member.whatsapp ? ` · ${member.whatsapp}` : ''}
                                </p>
                              </div>
                              <div>
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase block">Occupation & Education</span>
                                <p className="font-semibold text-slate-700">
                                  {member.occupation || 'Not set'} {member.education ? ` · ${member.education}` : ''}
                                </p>
                              </div>
                            </div>

                            {member.medicalHistory && member.medicalHistory.length > 0 && (
                              <div className="pt-1">
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase block mb-1">Medical History Tags</span>
                                <div className="flex flex-wrap gap-1">
                                  {member.medicalHistory.map((tag, ti) => (
                                    <span key={ti} className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3. Particular Contact Audit Log Card */}
                  {loadedContact && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2">
                        <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                          <Calendar size={13} />
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          Contact Record Audit Log
                        </h4>
                      </div>
                      <div className="space-y-1.5 pt-1 text-[11px]">
                        {loadedContact.createdAt && (
                          <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="text-slate-500 font-medium">Record Created Date</span>
                            <span className="font-bold text-slate-700">
                              {new Date(loadedContact.createdAt).toLocaleString()}
                            </span>
                          </div>
                        )}
                        {loadedContact.updatedAt && (
                          <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="text-slate-500 font-medium">Last Modified Date</span>
                            <span className="font-bold text-slate-700">
                              {new Date(loadedContact.updatedAt).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            </fieldset>
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
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-secondary text-[10px] sm:text-xs h-9" onClick={() => setDirImportOpen(false)}>Cancel</button>
            <button
              type="button"
              className="btn-primary text-[10px] sm:text-xs h-9"
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

      <PolicyDetailModal
        open={!!selectedPolicyModalId}
        policyId={selectedPolicyModalId}
        onClose={() => setSelectedPolicyModalId(null)}
      />

      <CreatePolicyModal
        open={createPolicyModalOpen}
        policyToEdit={policyToEdit}
        onClose={() => {
          setPolicyToEdit(null);
          setCreatePolicyModalOpen(false);
          qc.invalidateQueries({ queryKey: ['contacts-policies-list'] });
          qc.invalidateQueries({ queryKey: ['policies'] });
          if (editContactId) {
            qc.invalidateQueries({ queryKey: ['contact', editContactId] });
            setLeadModalOpen(true);
            setActiveLeadTab('Policy');
          }
        }}
        contactId={editContactId || loadedContact?.id}
        contactName={loadedContact ? `${loadedContact.firstName || ''} ${loadedContact.lastName || ''}`.trim() : undefined}
        onSuccess={() => {
          setPolicyToEdit(null);
          refetchContacts();
          qc.invalidateQueries({ queryKey: ['contacts-policies-list'] });
          qc.invalidateQueries({ queryKey: ['policies'] });
          if (editContactId) {
            qc.invalidateQueries({ queryKey: ['contact', editContactId] });
            setLeadModalOpen(true);
            setActiveLeadTab('Policy');
          }
        }}
      />
    </div>
  );
}
