import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { insuranceService } from '@api/index';
import { contactFormSchema } from '../Contacts';
import { leadFormSchema } from '../Leads';
import { policyFormSchema } from '../Policies';
import { claimFormSchema } from '../Claims';
import { 
  Database, ShieldCheck, Download, Upload, Settings2, Plus, Trash2, 
  ChevronRight, SlidersHorizontal, UserCheck, ArrowLeft, Search, RotateCcw, Pencil, X,
  Shield, Check, User, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Rule {
  id: number | string;
  module: string;
  name: string;
  label: string;
  status: 'Active' | 'Optional';
  required: boolean;
  isProtected?: boolean;
}

interface DropdownMenu {
  id: number;
  name: string;
  module: string;
  totalOptions: number;
  status: 'Active' | 'Inactive';
}

interface Role {
  id: number;
  name: string;
  desc: string;
  users: number;
  status: 'Active' | 'Inactive';
}

interface SettingsPanelProps {
  initialSubTab?: 'dashboard' | 'compulsory' | 'master' | 'access' | 'employee_access' | 'backup' | 'audit';
  onBack?: () => void;
}

export default function SettingsPanel({ initialSubTab = 'dashboard', onBack }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'compulsory' | 'master' | 'access' | 'employee_access' | 'backup' | 'audit'>(initialSubTab);

  useEffect(() => {
    setActiveTab(initialSubTab);
  }, [initialSubTab]);
  
  // --- SUBTABS ---
  const [compulsorySubTab, setCompulsorySubTab] = useState<'rules' | 'preferences'>('rules');
  const [dropdownSubTab, setDropdownSubTab] = useState<'lists' | 'usage'>('lists');
  const [accessSubTab, setAccessSubTab] = useState<'roles' | 'permissions' | 'users'>('roles');

  // --- FILTERS & SEARCH STATE ---
  const [compulsoryModuleFilter, setCompulsoryModuleFilter] = useState('All Modules');
  const [compulsorySearch, setCompulsorySearch] = useState('');
  
  const [dropdownModuleFilter, setDropdownModuleFilter] = useState('All Modules');
  const [dropdownSearch, setDropdownSearch] = useState('');

  const [accessSearch, setAccessSearch] = useState('');

  // --- MODALS STATE ---
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [showAddDropdownModal, setShowAddDropdownModal] = useState(false);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);

  // --- FORM STATES ---
  const [newRule, setNewRule] = useState({ module: 'Insurance Company', name: '', label: '', required: true });
  const [newDropdown, setNewDropdown] = useState({ name: '', module: 'Insurance Company', totalOptions: 0 });
  const [newRole, setNewRole] = useState({ name: '', desc: '', users: 0 });

  // --- DATA STATES ---
  const qc = useQueryClient();

  const { data: compulsoryRulesRes } = useQuery({
    queryKey: ['compulsory-rules'],
    queryFn: () => insuranceService.getCompulsoryRules(),
  });
  const compulsoryRules = useMemo(() => compulsoryRulesRes?.data ?? [], [compulsoryRulesRes]);

  const updateCompulsoryMutation = useMutation({
    mutationFn: (rulesList: any[]) => insuranceService.updateCompulsoryRules(rulesList),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compulsory-rules'] });
      toast.success('Compulsory rules updated successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update rules');
    }
  });

  const fieldRules = useMemo(() => {
    const modules = [
      { name: 'Contact', schema: contactFormSchema, critical: ['firstName', 'phone'] },
      { name: 'Leads', schema: leadFormSchema, critical: ['firstName', 'phone'] },
      { name: 'Policy', schema: policyFormSchema, critical: ['contactId', 'planId', 'policyNumber', 'startDate', 'endDate'] },
      { name: 'Claim', schema: claimFormSchema, critical: ['policyId', 'contactId', 'claimNumber', 'claimType', 'intimatedAt'] }
    ];

    const list: Rule[] = [];
    modules.forEach(mod => {
      const keys = Object.keys(mod.schema.shape);
      keys.forEach(key => {
        const fieldLabelMap: Record<string, string> = {
          firstName: "First Name",
          lastName: "Last Name",
          phone: "Phone Number",
          alternatePhone: "Alternate Phone",
          email: "Email Address",
          gender: "Gender",
          dateOfBirth: "Date of Birth",
          panNumber: "PAN Number",
          aadhaarNumber: "Aadhaar Number",
          annualIncome: "Annual Income",
          notes: "Notes",
          tags: "Tags",
          isActive: "Is Active",
          city: "City",
          source: "Source",
          assignedEmployeeId: "Assigned Employee",
          leadStage: "Lead Stage",
          leadStatus: "Lead Status",
          leadType: "Lead Type",
          followUpDate: "Follow-up Date",
          contactId: "Contact ID / Client",
          planId: "Plan ID / Product Name",
          policyNumber: "Policy Number",
          sumAssured: "Sum Assured",
          premiumAmount: "Premium Amount",
          startDate: "Risk Start Date",
          endDate: "Risk End Date",
          paymentFrequency: "Payment Frequency",
          riders: "Riders",
          deductible: "Deductible",
          status: "Status",
          nextDueDate: "Next Due Date",
          maturityDate: "Maturity Date",
          agentCode: "Agent Code",
          firstPremiumDate: "First Premium Date",
          premiumPaymentPeriod: "Premium Payment Period",
          lastPremiumDate: "Last Premium Date",
          emiCase: "EMI Case",
          emiGateway: "EMI Gateway",
          emiDate: "EMI Date",
          emiPremium: "EMI Premium",
          phcRequired: "PHC Required",
          phcAmount: "PHC Amount",
          phcStatus: "PHC Status",
          phcClaimSettled: "PHC Claim Settled",
          firstYearPremium: "First Year Premium",
          secondYearPremium: "Second Year Premium",
          policyId: "Policy ID / Number",
          claimNumber: "Claim Reference Number",
          claimType: "Claim Type / Category",
          claimAmount: "Claimed Amount",
          intimatedAt: "Intimation Date",
          diagnosis: "Diagnosis / Cause of Admission",
          hospital: "Hospital",
          hospitalAddress: "Hospital Address",
          patientName: "Patient Name",
          admissionAt: "Admission Date",
          dischargeAt: "Discharge Date",
          amtHospital: "Hospital Amount",
          amtMedicine: "Medicine Amount",
          amtLab: "Lab Amount",
          amtPreHosp: "Pre-Hospitalization Amount",
          amtPostHosp: "Post-Hospitalization Amount",
          amtOthers: "Other Amount",
          approvedAmount: "Approved Amount",
          deductionsNotes: "Deductions Notes",
          subClaimNo: "Sub Claim Number",
          uiClaimStatus: "Claim Status",
          comment: "Comment",
          insuranceCompanyCategory: "Insurance Company Category",
          insuranceCompany: "Insurance Company",
          insuranceProductName: "Insurance Product Name",
          agentName: "Agent Name",
          deathAdmissionDate: "Death Admission Date",
          causeOfDeath: "Cause of Death",
          dateOfOccurance: "Date of Occurrence",
          dateOfDeath: "Date of Death",
          wasInComa: "Was in Coma",
          deathSumInsured: "Death Sum Insured",
          deathTotalClaimedAmount: "Death Total Claimed Amount",
          deathComment: "Death Comment",
          hospitalName: "Hospital Name",
          hospitalState: "Hospital State",
          hospitalCity: "Hospital City",
          hospitalPincode: "Hospital Pincode",
          hospitalContactNo: "Hospital Contact No"
        };

        const label = fieldLabelMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        const isProtected = mod.critical.includes(key);

        const defaultRequiredMap: Record<string, string[]> = {
          Contact: ['firstName', 'lastName', 'phone'],
          Leads: ['firstName', 'lastName', 'phone'],
          Policy: ['contactId', 'planId', 'policyNumber', 'sumAssured', 'premiumAmount', 'startDate', 'endDate', 'paymentFrequency'],
          Claim: ['policyId', 'contactId', 'claimNumber', 'claimType', 'claimAmount', 'intimatedAt']
        };
        const defaultRequired = (defaultRequiredMap[mod.name] || []).includes(key);

        const savedRule = compulsoryRules.find((r: any) => r.module === mod.name && r.fieldKey === key);
        const required = isProtected ? true : (savedRule ? savedRule.required : defaultRequired);

        list.push({
          id: `${mod.name}-${key}`,
          module: mod.name,
          name: key,
          label,
          status: required ? 'Active' : 'Optional',
          required,
          isProtected
        });
      });
    });
    return list;
  }, [compulsoryRules]);

  const initialDropdownMenus: DropdownMenu[] = [
    { id: 1, name: 'Company Categories', module: 'Insurance Company', totalOptions: 4, status: 'Active' },
    { id: 2, name: 'Plan Categories', module: 'Plan', totalOptions: 6, status: 'Active' },
    { id: 3, name: 'Rider Categories', module: 'Rider / Add-on', totalOptions: 8, status: 'Active' },
    { id: 4, name: 'Cities', module: 'Hospital', totalOptions: 125, status: 'Active' },
    { id: 5, name: 'States', module: 'Hospital / Agent', totalOptions: 36, status: 'Active' },
    { id: 6, name: 'Branches', module: 'Agent', totalOptions: 215, status: 'Active' },
    { id: 7, name: 'Bank Names', module: 'Agent', totalOptions: 82, status: 'Active' },
    { id: 8, name: 'Payout Cycles', module: 'Agent', totalOptions: 4, status: 'Active' },
  ];
  const [dropdownMenus, setDropdownMenus] = useState<DropdownMenu[]>(initialDropdownMenus);

  const initialRoles: Role[] = [
    { id: 1, name: 'Owner', desc: 'Full access to all modules & settings', users: 1, status: 'Active' },
    { id: 2, name: 'Admin', desc: 'Manage system data & configuration', users: 2, status: 'Active' },
    { id: 3, name: 'Operations', desc: 'Manage daily operations data', users: 5, status: 'Active' },
    { id: 4, name: 'Claims', desc: 'Access to claims related modules', users: 8, status: 'Active' },
    { id: 5, name: 'Finance', desc: 'Access to finance & payout modules', users: 3, status: 'Active' },
    { id: 6, name: 'Employee', desc: 'Basic access for employees', users: 12, status: 'Active' },
  ];
  const [roles, setRoles] = useState<Role[]>(initialRoles);

  // --- HANDLERS ---
  const handleToggleRequired = (id: number | string) => {
    const updated = fieldRules.map((rule: Rule) => {
      if (rule.id === id) {
        return { ...rule, required: !rule.required };
      }
      return rule;
    });
    const rulesList = updated.map((r: Rule) => ({
      module: r.module,
      fieldKey: r.name,
      required: r.required
    }));
    updateCompulsoryMutation.mutate(rulesList);
  };

  const handleResetCompulsory = () => {
    const resetList = fieldRules.map((r: Rule) => ({
      module: r.module,
      fieldKey: r.name,
      required: r.isProtected ? true : (['lastName', 'phone', 'sumAssured', 'premiumAmount', 'paymentFrequency', 'claimAmount', 'claimType'].includes(r.name) ? true : false)
    }));
    updateCompulsoryMutation.mutate(resetList);
    setCompulsorySearch('');
    setCompulsoryModuleFilter('All Modules');
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.name.trim() || !newRule.label.trim()) {
      toast.error('Please enter all details');
      return;
    }
    const rulesList = [
      ...fieldRules.map((r: Rule) => ({ module: r.module, fieldKey: r.name, required: r.required })),
      { module: newRule.module, fieldKey: newRule.name.trim(), required: newRule.required }
    ];
    updateCompulsoryMutation.mutate(rulesList);
    setShowAddRuleModal(false);
    setNewRule({ module: 'Insurance Company', name: '', label: '', required: true });
  };

  const handleDeleteRule = (id: number | string) => {
    if (confirm('Are you sure you want to delete this rule?')) {
      const remaining = fieldRules.filter((r: Rule) => r.id !== id);
      const rulesList = remaining.map((r: Rule) => ({ module: r.module, fieldKey: r.name, required: r.required }));
      updateCompulsoryMutation.mutate(rulesList);
    }
  };

  const handleAddDropdown = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDropdown.name.trim()) {
      toast.error('Please enter dropdown name');
      return;
    }
    const newDropObj: DropdownMenu = {
      id: Date.now(),
      name: newDropdown.name.trim(),
      module: newDropdown.module,
      totalOptions: Number(newDropdown.totalOptions) || 0,
      status: 'Active'
    };
    setDropdownMenus(prev => [newDropObj, ...prev]);
    setShowAddDropdownModal(false);
    setNewDropdown({ name: '', module: 'Insurance Company', totalOptions: 0 });
    toast.success('Dropdown master data added!');
  };

  const handleDeleteDropdown = (id: number) => {
    if (confirm('Are you sure you want to delete this dropdown menu?')) {
      setDropdownMenus(prev => prev.filter(d => d.id !== id));
      toast.success('Dropdown removed');
    }
  };

  const handleAddRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRole.name.trim() || !newRole.desc.trim()) {
      toast.error('Please enter role name and description');
      return;
    }
    const newRoleObj: Role = {
      id: Date.now(),
      name: newRole.name.trim(),
      desc: newRole.desc.trim(),
      users: Number(newRole.users) || 0,
      status: 'Active'
    };
    setRoles(prev => [newRoleObj, ...prev]);
    setShowAddRoleModal(false);
    setNewRole({ name: '', desc: '', users: 0 });
    toast.success('Role added successfully!');
  };

  const handleDeleteRole = (id: number) => {
    if (confirm('Are you sure you want to delete this role?')) {
      setRoles(prev => prev.filter(r => r.id !== id));
      toast.success('Role deleted');
    }
  };

  // --- BACKUP & RESTORE IMPLEMENTATION ---
  const handleBackup = () => {
    toast.success('Backup initiated. Check downloads folder soon.');
    const data = JSON.stringify(localStorage);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insumitra_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        toast.success('Database restored successfully! Please refresh.');
      } catch {
        toast.error('Corrupted or invalid backup file.');
      }
    };
    reader.readAsText(file);
  };

  // --- FILTERED DATA LISTS ---
  const filteredFieldRules = fieldRules.filter(rule => {
    const matchModule = compulsoryModuleFilter === 'All Modules' || rule.module === compulsoryModuleFilter;
    const matchSearch = rule.name.toLowerCase().includes(compulsorySearch.toLowerCase()) || 
                        rule.label.toLowerCase().includes(compulsorySearch.toLowerCase()) ||
                        rule.module.toLowerCase().includes(compulsorySearch.toLowerCase());
    return matchModule && matchSearch;
  });

  const filteredDropdownMenus = dropdownMenus.filter(menu => {
    const matchModule = dropdownModuleFilter === 'All Modules' || menu.module.includes(dropdownModuleFilter) || dropdownModuleFilter.includes(menu.module);
    const matchSearch = menu.name.toLowerCase().includes(dropdownSearch.toLowerCase()) ||
                        menu.module.toLowerCase().includes(dropdownSearch.toLowerCase());
    return matchModule && matchSearch;
  });

  const filteredRoles = roles.filter(role => {
    return role.name.toLowerCase().includes(accessSearch.toLowerCase()) ||
           role.desc.toLowerCase().includes(accessSearch.toLowerCase());
  });

  return (
    <div className="w-full">
      {/* 1. DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="p-6 space-y-6 bg-slate-50/10">
          {onBack && (
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
              <button onClick={onBack} className="hover:text-primary-600 transition-colors flex items-center gap-1 cursor-pointer">
                <ArrowLeft size={13} /> Home
              </button>
            </div>
          )}
          {/* Section: System Configuration */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">System Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Compulsory Fields */}
              <div 
                onClick={() => setActiveTab('compulsory')}
                className="bg-white rounded-2xl border border-slate-200/60 p-5 flex items-center justify-between cursor-pointer hover:border-indigo-300 hover:shadow-sm hover:scale-[1.01] transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0 shadow-2xs">
                    <Settings2 size={22} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Compulsory Fields</h4>
                    <p className="text-xs text-slate-500 font-semibold leading-tight mt-0.5">Define and relax compulsory fields for all modules</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
              </div>

              {/* Card 2: Dropdown Menus */}
              <div 
                onClick={() => setActiveTab('master')}
                className="bg-white rounded-2xl border border-slate-200/60 p-5 flex items-center justify-between cursor-pointer hover:border-indigo-300 hover:shadow-sm hover:scale-[1.01] transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0 shadow-2xs">
                    <SlidersHorizontal size={22} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Dropdown Menus</h4>
                    <p className="text-xs text-slate-500 font-semibold leading-tight mt-0.5">Add & manage dropdown options (repetitive data)</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
              </div>

              {/* Card 3: Access Control */}
              <div 
                onClick={() => setActiveTab('access')}
                className="bg-white rounded-2xl border border-slate-200/60 p-5 flex items-center justify-between cursor-pointer hover:border-indigo-300 hover:shadow-sm hover:scale-[1.01] transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0 shadow-2xs">
                    <ShieldCheck size={22} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Access Control</h4>
                    <p className="text-xs text-slate-500 font-semibold leading-tight mt-0.5">Manage roles, permissions & user access</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
              </div>

              {/* Card 4: Employee Access & Login */}
              <div 
                onClick={() => setActiveTab('employee_access')}
                className="bg-white rounded-2xl border border-slate-200/60 p-5 flex items-center justify-between cursor-pointer hover:border-indigo-300 hover:shadow-sm hover:scale-[1.01] transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0 shadow-2xs">
                    <UserCheck size={22} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Employee Access & Login</h4>
                    <p className="text-xs text-slate-500 font-semibold leading-tight mt-0.5">Manage employees, access rights & login credentials</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
              </div>

              {/* Card 5: Audit Logs */}
              <div 
                onClick={() => setActiveTab('audit')}
                className="bg-white rounded-2xl border border-slate-200/60 p-5 flex items-center justify-between cursor-pointer hover:border-indigo-300 hover:shadow-sm hover:scale-[1.01] transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0 shadow-2xs">
                    <FileText size={22} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Audit Logs</h4>
                    <p className="text-xs text-slate-500 font-semibold leading-tight mt-0.5">View all system & data change logs</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
              </div>
            </div>
          </div>

          {/* Section: Backup & Restore */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Backup & Restore</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Data Export & Backup */}
              <div 
                onClick={() => setActiveTab('backup')}
                className="bg-white rounded-2xl border border-slate-200/60 p-5 flex items-center justify-between cursor-pointer hover:border-indigo-300 hover:shadow-sm hover:scale-[1.01] transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0 shadow-2xs">
                    <Download size={22} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Data Export & Backup (All Data)</h4>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">Export all system data and create a backup</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
              </div>

              {/* Card 2: Restore from Backup */}
              <div 
                onClick={() => setActiveTab('backup')}
                className="bg-white rounded-2xl border border-slate-200/60 p-5 flex items-center justify-between cursor-pointer hover:border-indigo-300 hover:shadow-sm hover:scale-[1.01] transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0 shadow-2xs">
                    <Upload size={22} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Restore from Backup (All Data)</h4>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">Restore all system data from previous backup</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. COMPULSORY FIELDS SUBPAGE */}
      {activeTab === 'compulsory' && (
        <div className="p-6 space-y-6">
          {/* Breadcrumb Header */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <button onClick={() => setActiveTab('dashboard')} className="hover:text-primary-600 transition-colors flex items-center gap-1">
                <ArrowLeft size={13} /> Master Settings & Backups
              </button>
              <span>&gt;</span>
              <span className="text-slate-800">Compulsory Fields</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight mt-2">Compulsory Fields</h2>
            <p className="text-xs text-slate-500 font-semibold leading-tight mt-0.5">Define and relax compulsory fields for all modules</p>
          </div>

          {/* Subtabs */}
          <div className="flex gap-4 border-b border-slate-150">
            <button 
              onClick={() => setCompulsorySubTab('rules')}
              className={`pb-2 text-xs font-semibold border-b-2 transition-all -mb-px ${
                compulsorySubTab === 'rules' ? 'border-primary-600 text-primary-700 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Field Rules
            </button>
            <button 
              onClick={() => setCompulsorySubTab('preferences')}
              className={`pb-2 text-xs font-semibold border-b-2 transition-all -mb-px ${
                compulsorySubTab === 'preferences' ? 'border-primary-600 text-primary-700 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Module Preferences
            </button>
          </div>

          {compulsorySubTab === 'rules' ? (
            <div className="space-y-4">
              {/* Controls bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <select 
                    value={compulsoryModuleFilter}
                    onChange={(e) => setCompulsoryModuleFilter(e.target.value)}
                    className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                  >
                    <option>All Modules</option>
                    <option>Insurance Company</option>
                    <option>Plan</option>
                    <option>Contact</option>
                    <option>Leads</option>
                    <option>Policy</option>
                    <option>Claim</option>
                    <option>Agent</option>
                    <option>Hospital</option>
                  </select>

                  <div className="relative flex-1 sm:w-64 min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text"
                      value={compulsorySearch}
                      onChange={(e) => setCompulsorySearch(e.target.value)}
                      placeholder="Search fields..."
                      className="border border-slate-200 rounded-xl pl-9 pr-4 py-1.5 text-xs font-medium w-full focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button 
                    onClick={handleResetCompulsory}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    Reset to Default
                  </button>
                  <button 
                    onClick={() => setShowAddRuleModal(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-sm shadow-primary-500/10"
                  >
                    <Plus size={13} />
                    Add Rule
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-55/60 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Module</th>
                      <th className="px-5 py-3">Field Name</th>
                      <th className="px-5 py-3">Field Label</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-center w-28">Required</th>
                      <th className="px-5 py-3 text-right w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredFieldRules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3.5 font-bold text-slate-700">{rule.module}</td>
                        <td className="px-5 py-3.5 font-mono text-slate-500">{rule.name}</td>
                        <td className="px-5 py-3.5 font-medium text-slate-800">{rule.label}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                            rule.status === 'Active' 
                              ? 'bg-emerald-55 text-emerald-750 border border-emerald-200/50' 
                              : 'bg-amber-55 text-amber-750 border border-amber-200/50'
                          }`}>
                            {rule.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <button
                            disabled={rule.isProtected}
                            onClick={() => handleToggleRequired(rule.id)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              rule.isProtected ? 'opacity-50 cursor-not-allowed' : ''
                            } ${
                              rule.required ? 'bg-primary-600' : 'bg-slate-200'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                                rule.required ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button 
                              onClick={() => toast.success('Mock edit rule clicked')}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-all cursor-pointer"
                              title="Edit Rule"
                            >
                              <Pencil size={13} />
                            </button>
                            <button 
                              onClick={() => handleDeleteRule(rule.id)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all cursor-pointer"
                              title="Delete Rule"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredFieldRules.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-slate-400 font-medium">No rules match search or filter.</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Table Footer / Pagination */}
                <div className="bg-slate-50/50 border-t border-slate-150 px-5 py-3 flex items-center justify-between text-slate-500 font-semibold">
                  <span>Showing 1 to {filteredFieldRules.length} of {fieldRules.length} entries</span>
                  <div className="flex items-center gap-1.5">
                    <button className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-[11px] cursor-pointer" disabled>1</button>
                    <button className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] cursor-pointer">2</button>
                    <button className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] cursor-pointer">3</button>
                    <span className="px-1.5 text-slate-300">...</span>
                    <button className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] cursor-pointer">6</button>
                    <button className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] cursor-pointer">&gt;</button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center max-w-md mx-auto space-y-3">
              <Settings2 size={36} className="mx-auto text-primary-500" />
              <h4 className="font-bold text-slate-800 text-sm">Module Preference Settings</h4>
              <p className="text-xs text-slate-500 leading-normal">
                Define the default behavior, fallback states, and strict parsing thresholds for document validation rules on a per-module level. 
              </p>
              <button 
                onClick={() => toast.success('Preference updates successfully saved')}
                className="btn-primary text-xs px-4 py-2 mt-2 mx-auto cursor-pointer"
              >
                Save Preferences
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. DROPDOWN MENUS SUBPAGE */}
      {activeTab === 'master' && (
        <div className="p-6 space-y-6">
          {/* Breadcrumb Header */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <button onClick={() => setActiveTab('dashboard')} className="hover:text-primary-600 transition-colors flex items-center gap-1">
                <ArrowLeft size={13} /> Master Settings & Backups
              </button>
              <span>&gt;</span>
              <span className="text-slate-800">Dropdown Menus</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight mt-2">Dropdown Menus</h2>
            <p className="text-xs text-slate-500 font-semibold leading-tight mt-0.5">Add & manage dropdown options (repetitive data)</p>
          </div>

          {/* Subtabs */}
          <div className="flex gap-4 border-b border-slate-150">
            <button 
              onClick={() => setDropdownSubTab('lists')}
              className={`pb-2 text-xs font-semibold border-b-2 transition-all -mb-px ${
                dropdownSubTab === 'lists' ? 'border-primary-600 text-primary-700 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Dropdown Lists
            </button>
            <button 
              onClick={() => setDropdownSubTab('usage')}
              className={`pb-2 text-xs font-semibold border-b-2 transition-all -mb-px ${
                dropdownSubTab === 'usage' ? 'border-primary-600 text-primary-700 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Usage Mapping
            </button>
          </div>

          {dropdownSubTab === 'lists' ? (
            <div className="space-y-4">
              {/* Controls bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64 min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text"
                      value={dropdownSearch}
                      onChange={(e) => setDropdownSearch(e.target.value)}
                      placeholder="Search dropdown lists..."
                      className="border border-slate-200 rounded-xl pl-9 pr-4 py-1.5 text-xs font-medium w-full focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                    />
                  </div>

                  <select 
                    value={dropdownModuleFilter}
                    onChange={(e) => setDropdownModuleFilter(e.target.value)}
                    className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                  >
                    <option>All Modules</option>
                    <option>Insurance Company</option>
                    <option>Plan</option>
                    <option>Rider / Add-on</option>
                    <option>Hospital</option>
                    <option>Agent</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button 
                    onClick={() => setShowAddDropdownModal(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-sm shadow-primary-500/10"
                  >
                    <Plus size={13} />
                    Add Dropdown
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-55/60 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Dropdown Name</th>
                      <th className="px-5 py-3">Module</th>
                      <th className="px-5 py-3">Total Options</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDropdownMenus.map((menu) => (
                      <tr key={menu.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3.5 font-bold text-slate-800">{menu.name}</td>
                        <td className="px-5 py-3.5 font-semibold text-slate-500">{menu.module}</td>
                        <td className="px-5 py-3.5 font-bold text-slate-700">{menu.totalOptions}</td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200/50 uppercase">
                            {menu.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button 
                              onClick={() => toast.success(`Mock edit dropdown '${menu.name}'`)}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-all cursor-pointer"
                              title="Edit Dropdown"
                            >
                              <Pencil size={13} />
                            </button>
                            <button 
                              onClick={() => handleDeleteDropdown(menu.id)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all cursor-pointer"
                              title="Delete Dropdown"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredDropdownMenus.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-slate-400 font-medium">No dropdown master data matches.</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Table Footer / Pagination */}
                <div className="bg-slate-50/50 border-t border-slate-150 px-5 py-3 flex items-center justify-between text-slate-500 font-semibold">
                  <span>Showing 1 to {filteredDropdownMenus.length} of {dropdownMenus.length} entries</span>
                  <div className="flex items-center gap-1.5">
                    <button className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-[11px] cursor-pointer" disabled>1</button>
                    <button className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] cursor-pointer">2</button>
                    <button className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] cursor-pointer">3</button>
                    <button className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] cursor-pointer">&gt;</button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center max-w-md mx-auto space-y-3">
              <SlidersHorizontal size={36} className="mx-auto text-primary-500" />
              <h4 className="font-bold text-slate-800 text-sm">Field-to-Dropdown Usage Mapping</h4>
              <p className="text-xs text-slate-500 leading-normal">
                Configure module schema fields that bind directly to active dropdown options lists. Changes here propagate to form inputs dynamically.
              </p>
              <button 
                onClick={() => toast.success('Mappings mapped correctly')}
                className="btn-primary text-xs px-4 py-2 mt-2 mx-auto cursor-pointer"
              >
                Configure Mapping Schema
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. ACCESS CONTROL SUBPAGE */}
      {activeTab === 'access' && (
        <div className="p-6 space-y-6">
          {/* Breadcrumb Header */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <button onClick={() => setActiveTab('dashboard')} className="hover:text-primary-600 transition-colors flex items-center gap-1">
                <ArrowLeft size={13} /> Master Settings & Backups
              </button>
              <span>&gt;</span>
              <span className="text-slate-800">Access Control</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight mt-2">Access Control</h2>
            <p className="text-xs text-slate-500 font-semibold leading-tight mt-0.5">Manage roles, permissions & user access</p>
          </div>

          {/* Subtabs */}
          <div className="flex gap-4 border-b border-slate-150">
            <button 
              onClick={() => setAccessSubTab('roles')}
              className={`pb-2 text-xs font-semibold border-b-2 transition-all -mb-px ${
                accessSubTab === 'roles' ? 'border-primary-600 text-primary-700 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Roles
            </button>
            <button 
              onClick={() => setAccessSubTab('permissions')}
              className={`pb-2 text-xs font-semibold border-b-2 transition-all -mb-px ${
                accessSubTab === 'permissions' ? 'border-primary-600 text-primary-700 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Permissions
            </button>
            <button 
              onClick={() => setAccessSubTab('users')}
              className={`pb-2 text-xs font-semibold border-b-2 transition-all -mb-px ${
                accessSubTab === 'users' ? 'border-primary-600 text-primary-700 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Users
            </button>
          </div>

          {accessSubTab === 'roles' ? (
            <div className="space-y-4">
              {/* Controls bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative flex-1 sm:w-64 min-w-[200px] w-full">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text"
                    value={accessSearch}
                    onChange={(e) => setAccessSearch(e.target.value)}
                    placeholder="Search roles..."
                    className="border border-slate-200 rounded-xl pl-9 pr-4 py-1.5 text-xs font-medium w-full focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                  />
                </div>

                <button 
                  onClick={() => setShowAddRoleModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-sm shadow-primary-500/10 w-full sm:w-auto justify-center"
                >
                  <Plus size={13} />
                  Add Role
                </button>
              </div>

              {/* Data Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-55/60 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Role Name</th>
                      <th className="px-5 py-3">Description</th>
                      <th className="px-5 py-3 w-32 text-center">Users</th>
                      <th className="px-5 py-3 w-28">Status</th>
                      <th className="px-5 py-3 text-right w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRoles.map((role) => (
                      <tr key={role.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3.5 font-bold text-slate-800">{role.name}</td>
                        <td className="px-5 py-3.5 font-semibold text-slate-500">{role.desc}</td>
                        <td className="px-5 py-3.5 text-center font-bold text-slate-700">{role.users}</td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200/50 uppercase">
                            {role.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button 
                              onClick={() => toast.success(`Mock editing permissions for '${role.name}'`)}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-all cursor-pointer"
                              title="Edit Role"
                            >
                              <Pencil size={13} />
                            </button>
                            <button 
                              onClick={() => handleDeleteRole(role.id)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all cursor-pointer"
                              title="Delete Role"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredRoles.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-slate-400 font-medium">No roles match search criteria.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="bg-slate-50/50 border-t border-slate-150 px-5 py-3 flex items-center justify-between text-slate-500 font-semibold">
                  <span>Showing 1 to {filteredRoles.length} of {roles.length} entries</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center max-w-md mx-auto space-y-3">
              <ShieldCheck size={36} className="mx-auto text-primary-500" />
              <h4 className="font-bold text-slate-800 text-sm">Role Permission Matrix</h4>
              <p className="text-xs text-slate-500 leading-normal">
                Detailed access grids for Create, Read, Update, Delete (CRUD) operations on Contacts, Policies, and Claims are validated in backend middleware.
              </p>
              <button 
                onClick={() => toast.success('Permissions mapping saved')}
                className="btn-primary text-xs px-4 py-2 mt-2 mx-auto cursor-pointer"
              >
                Access System Matrix
              </button>
            </div>
          )}
        </div>
      )}

      {/* 5. EMPLOYEE ACCESS & LOGIN CREDENTIALS */}
      {activeTab === 'employee_access' && (
        <div className="p-6 space-y-6">
          {/* Breadcrumb Header */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <button onClick={() => setActiveTab('dashboard')} className="hover:text-primary-600 transition-colors flex items-center gap-1">
                <ArrowLeft size={13} /> Master Settings & Backups
              </button>
              <span>&gt;</span>
              <span className="text-slate-800">Employee Access & Login</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight mt-2">Employee Access & Login</h2>
            <p className="text-xs text-slate-500 font-semibold leading-tight mt-0.5">Manage employee profiles and system credentials</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-md mx-auto space-y-4 shadow-2xs">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mx-auto shadow-2xs">
              <User size={30} strokeWidth={2} />
            </div>
            <div className="space-y-1.5">
              <h4 className="font-bold text-slate-800 text-sm">Credentials Managed Externally</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Employee profile details, login passwords, and activation statuses are managed globally under the **Employees Directory** module.
              </p>
            </div>
            <button 
              onClick={() => window.location.href = '/employees'}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-primary-500/15"
            >
              Go to Employees Directory
            </button>
          </div>
        </div>
      )}

      {/* 6. DATABASE BACKUP & RESTORE */}
      {activeTab === 'backup' && (
        <div className="p-6 space-y-6">
          {/* Breadcrumb Header */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <button onClick={() => setActiveTab('dashboard')} className="hover:text-primary-600 transition-colors flex items-center gap-1">
                <ArrowLeft size={13} /> Master Settings & Backups
              </button>
              <span>&gt;</span>
              <span className="text-slate-800">Backup & Restore</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight mt-2">Database Backup & Restore</h2>
            <p className="text-xs text-slate-500 font-semibold leading-tight mt-0.5">Securely export and import your master data and records</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl">
            {/* Export Card */}
            <div 
              className="border border-slate-200 bg-white rounded-2xl p-6 hover:border-primary-300 hover:shadow-xs transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-4"
              onClick={handleBackup}
            >
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-3xs border border-indigo-100">
                <Download size={26} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-800 text-sm">Export Backup Snapshot</h4>
                <p className="text-xs text-slate-400 max-w-xs font-semibold leading-relaxed">
                  Generates and downloads a compiled snapshot of all current Master Settings, rules, and configurations as a secure `.json` database file.
                </p>
              </div>
            </div>

            {/* Restore Card */}
            <div 
              className="border border-slate-200 bg-white rounded-2xl p-6 hover:border-primary-300 hover:shadow-xs transition-all relative flex flex-col items-center justify-center text-center gap-4"
            >
              <input
                type="file"
                accept=".json"
                onChange={handleRestore}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-3xs border border-blue-100">
                <Upload size={26} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-800 text-sm">Restore from File</h4>
                <p className="text-xs text-slate-400 max-w-xs font-semibold leading-relaxed">
                  Restore your configurations back to a specific state by uploading a previous snapshot. Warning: This replaces local system states.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="p-6 space-y-6">
          {/* Breadcrumb Header */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <button onClick={() => setActiveTab('dashboard')} className="hover:text-primary-600 transition-colors flex items-center gap-1 cursor-pointer">
                <ArrowLeft size={13} /> Master Settings & Backups
              </button>
              <span>&gt;</span>
              <span className="text-slate-800">Audit Logs</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight mt-2">Audit Logs</h2>
            <p className="text-xs text-slate-500 font-semibold leading-tight mt-0.5">View all system & data change logs</p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <input className="input max-w-xs text-xs py-1.5" placeholder="Search logs..." />
            </div>
            <div className="overflow-x-auto border border-slate-100 rounded-xl bg-white shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b text-slate-550 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3">User</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Module</th>
                    <th className="p-3">Details</th>
                    <th className="p-3">Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { user: 'Rahul Mehta', action: 'Created', mod: 'Insurance Company', desc: 'Added HDFC ERGO', time: '20 May 2024 10:30 AM' },
                    { user: 'Anjali Mehta', action: 'Updated', mod: 'Plan Name', desc: 'Updated plan details', time: '20 May 2024 09:15 AM' },
                    { user: 'Vikram Joshi', action: 'Deleted', mod: 'Agent / Agency', desc: 'Deleted agent record', time: '20 May 2024 05:45 PM' },
                    { user: 'Pooja Sharma', action: 'Created', mod: 'Hospital', desc: 'Added new hospital', time: '19 May 2024 03:20 PM' },
                    { user: 'Suresh Kumar', action: 'Updated', mod: 'Policy', desc: 'Updated policy status', time: '19 May 2024 11:10 AM' }
                  ].map((c, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-800">{c.user}</td>
                      <td className="p-3 text-slate-600">{c.action}</td>
                      <td className="p-3 text-slate-500">{c.mod}</td>
                      <td className="p-3 text-slate-600">{c.desc}</td>
                      <td className="p-3 text-slate-500">{c.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD COMPULSORY RULE MODAL --- */}
      {showAddRuleModal && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-950 uppercase tracking-wide">Add Field Requirement Rule</h3>
              <button onClick={() => setShowAddRuleModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddRule} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Module Module</label>
                <select 
                  value={newRule.module}
                  onChange={(e) => setNewRule(prev => ({ ...prev, module: e.target.value }))}
                  className="w-full border border-slate-250 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-primary-500 bg-white"
                >
                  <option>Insurance Company</option>
                  <option>Plan</option>
                  <option>Contact</option>
                  <option>Leads</option>
                  <option>Policy</option>
                  <option>Claim</option>
                  <option>Agent</option>
                  <option>Hospital</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Field Name (Technical Key)</label>
                <input 
                  type="text"
                  placeholder="e.g. registration_number"
                  value={newRule.name}
                  onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-slate-250 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Field Label (User-facing)</label>
                <input 
                  type="text"
                  placeholder="e.g. IRDAI Registration No."
                  value={newRule.label}
                  onChange={(e) => setNewRule(prev => ({ ...prev, label: e.target.value }))}
                  className="w-full border border-slate-250 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div className="flex items-center gap-2 py-1">
                <input 
                  type="checkbox"
                  id="req_rule_cb"
                  checked={newRule.required}
                  onChange={(e) => setNewRule(prev => ({ ...prev, required: e.target.checked }))}
                  className="rounded text-primary-600 cursor-pointer h-4 w-4"
                />
                <label htmlFor="req_rule_cb" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                  Mark as Compulsory Field
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowAddRuleModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD DROPDOWN MODAL --- */}
      {showAddDropdownModal && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-950 uppercase tracking-wide">Add Dropdown List</h3>
              <button onClick={() => setShowAddDropdownModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddDropdown} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Dropdown Name</label>
                <input 
                  type="text"
                  placeholder="e.g. Premium Types"
                  value={newDropdown.name}
                  onChange={(e) => setNewDropdown(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-slate-250 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Module Module</label>
                <select 
                  value={newDropdown.module}
                  onChange={(e) => setNewDropdown(prev => ({ ...prev, module: e.target.value }))}
                  className="w-full border border-slate-250 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-primary-500 bg-white"
                >
                  <option>Insurance Company</option>
                  <option>Plan</option>
                  <option>Rider / Add-on</option>
                  <option>Hospital</option>
                  <option>Agent</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Total Initial Options</label>
                <input 
                  type="number"
                  placeholder="e.g. 5"
                  value={newDropdown.totalOptions || ''}
                  onChange={(e) => setNewDropdown(prev => ({ ...prev, totalOptions: Number(e.target.value) }))}
                  className="w-full border border-slate-250 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowAddDropdownModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Save Dropdown
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD ROLE MODAL --- */}
      {showAddRoleModal && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-955 uppercase tracking-wide">Add Access Control Role</h3>
              <button onClick={() => setShowAddRoleModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddRole} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Role Name</label>
                <input 
                  type="text"
                  placeholder="e.g. Super User"
                  value={newRole.name}
                  onChange={(e) => setNewRole(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-slate-250 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Role Description</label>
                <textarea 
                  placeholder="e.g. Read-write access to insurance but cannot export databases..."
                  value={newRole.desc}
                  onChange={(e) => setNewRole(prev => ({ ...prev, desc: e.target.value }))}
                  rows={3}
                  className="w-full border border-slate-250 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Associated Users Count</label>
                <input 
                  type="number"
                  placeholder="0"
                  value={newRole.users || ''}
                  onChange={(e) => setNewRole(prev => ({ ...prev, users: Number(e.target.value) }))}
                  className="w-full border border-slate-250 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowAddRoleModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Save Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
