import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { policiesService, insuranceService } from '@api/index';
import { Plus, Pencil, Trash2, Search, Filter, ShieldCheck, Check, X, ToggleLeft, ToggleRight, Layers, CreditCard, Clock, Building2 } from 'lucide-react';
import Modal from '@comps/common/Modal';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const POLICY_TYPES = ['HEALTH', 'TERM', 'LIFE', 'ACCIDENT', 'TRAVEL', 'GENERAL', 'MOTOR'];
const BUSINESS_TYPES = ['FRESH', 'PORT', 'RENEWAL'];
const PAYMENT_OPTIONS = ['Full Payment', 'EMI', 'Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'];
const DEFAULT_EMI_MONTHS = ['3 Months', '6 Months', '9 Months', '12 Months', '18 Months', '24 Months', '36 Months'];
const DEFAULT_PERIODS = ['1 Yr', '2 Yr', '3 Yr', '4 Yr', '5 Yr', '10 Yr', '15 Yr', '20 Yr', '25 Yr', '30 Yr', '99 Yr'];

export default function PolicyScenariosTab() {
  const qc = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterPolicyType, setFilterPolicyType] = useState('ALL');
  const [filterBusinessType, setFilterBusinessType] = useState('ALL');
  const [filterCompanyId, setFilterCompanyId] = useState('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<any | null>(null);

  // Form State
  const [formPolicyType, setFormPolicyType] = useState('HEALTH');
  const [formBusinessType, setFormBusinessType] = useState('FRESH');
  const [formCompanyId, setFormCompanyId] = useState('');
  const [formPlanId, setFormPlanId] = useState('');
  const [formPeriods, setFormPeriods] = useState<string[]>(['1 Yr', '2 Yr', '3 Yr']);
  const [formPaymentOptions, setFormPaymentOptions] = useState<string[]>(['Full Payment']);
  const [formEmiMonths, setFormEmiMonths] = useState<string[]>([]);
  const [formPaymentTerms, setFormPaymentTerms] = useState<string[]>([]);
  const [formIsActive, setFormIsActive] = useState(true);

  // Custom Inputs for Tags
  const [periodInput, setPeriodInput] = useState('');
  const [emiInput, setEmiInput] = useState('');
  const [termInput, setTermInput] = useState('');

  // Fetch Scenarios
  const { data: scenariosRes, isLoading } = useQuery({
    queryKey: ['policy-scenarios-list'],
    queryFn: () => policiesService.listScenarios(),
  });
  const scenarios: any[] = Array.isArray(scenariosRes?.data) ? scenariosRes.data : Array.isArray(scenariosRes) ? scenariosRes : [];

  // Fetch Companies & Plans
  const { data: companiesRes } = useQuery({
    queryKey: ['insurance-companies-list'],
    queryFn: () => insuranceService.listCompanies(),
  });
  const companies: any[] = Array.isArray(companiesRes?.data) ? companiesRes.data : Array.isArray(companiesRes) ? companiesRes : [];

  const { data: plansRes } = useQuery({
    queryKey: ['all-plans-list'],
    queryFn: () => policiesService.plans(),
  });
  const plans: any[] = Array.isArray(plansRes?.data) ? plansRes.data : Array.isArray(plansRes) ? plansRes : [];

  // Available plans for modal based on company & policy type
  const availablePlans = useMemo(() => {
    return plans.filter((p: any) => {
      const coMatch = !formCompanyId || p.companyId === formCompanyId || p.company?.id === formCompanyId;
      const typeMatch = !formPolicyType || (p.category || '').toUpperCase() === formPolicyType.toUpperCase();
      return coMatch && typeMatch;
    });
  }, [plans, formCompanyId, formPolicyType]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => policiesService.createScenario(data),
    onSuccess: () => {
      toast.success('Policy scenario created successfully!');
      qc.invalidateQueries({ queryKey: ['policy-scenarios-list'] });
      closeModal();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create scenario');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => policiesService.updateScenario(id, data),
    onSuccess: () => {
      toast.success('Policy scenario updated successfully!');
      qc.invalidateQueries({ queryKey: ['policy-scenarios-list'] });
      closeModal();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update scenario');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => policiesService.toggleScenarioStatus(id, isActive),
    onSuccess: () => {
      toast.success('Status updated');
      qc.invalidateQueries({ queryKey: ['policy-scenarios-list'] });
    },
    onError: () => toast.error('Failed to toggle status'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => policiesService.deleteScenario(id),
    onSuccess: () => {
      toast.success('Scenario deleted successfully');
      qc.invalidateQueries({ queryKey: ['policy-scenarios-list'] });
    },
    onError: () => toast.error('Failed to delete scenario'),
  });

  const openCreateModal = () => {
    setEditingScenario(null);
    setFormPolicyType('HEALTH');
    setFormBusinessType('FRESH');
    setFormCompanyId(companies[0]?.id || '');
    setFormPlanId('');
    setFormPeriods(['1 Yr', '2 Yr', '3 Yr', '4 Yr', '5 Yr']);
    setFormPaymentOptions(['Full Payment']);
    setFormEmiMonths([]);
    setFormPaymentTerms([]);
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (sc: any) => {
    setEditingScenario(sc);
    setFormPolicyType((sc.policyType || 'HEALTH').toUpperCase());
    setFormBusinessType((sc.businessType || 'FRESH').toUpperCase());
    setFormCompanyId(sc.companyId || sc.company?.id || '');
    setFormPlanId(sc.planId || sc.plan?.id || '');
    setFormPeriods(Array.isArray(sc.policyPeriods) ? sc.policyPeriods : []);
    setFormPaymentOptions(Array.isArray(sc.paymentOptions) ? sc.paymentOptions : []);
    setFormEmiMonths(Array.isArray(sc.emiMonths) ? sc.emiMonths : []);
    setFormPaymentTerms(Array.isArray(sc.paymentTerms) ? sc.paymentTerms : []);
    setFormIsActive(sc.isActive !== false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingScenario(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCompanyId) {
      toast.error('Please select an Insurance Company');
      return;
    }
    if (!formPlanId) {
      toast.error('Please select an Insurance Plan');
      return;
    }
    if (formPeriods.length === 0) {
      toast.error('Please specify at least one Policy Period option');
      return;
    }
    if (formPaymentOptions.length === 0) {
      toast.error('Please select at least one Premium Payment option');
      return;
    }

    const payload = {
      policyType: formPolicyType.toUpperCase(),
      businessType: formBusinessType.toUpperCase(),
      companyId: formCompanyId,
      planId: formPlanId,
      policyPeriods: formPeriods,
      paymentOptions: formPaymentOptions,
      emiMonths: formEmiMonths,
      paymentTerms: formPaymentTerms,
      isActive: formIsActive,
    };

    if (editingScenario) {
      updateMutation.mutate({ id: editingScenario.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // Tag helper toggles
  const togglePeriod = (p: string) => {
    setFormPeriods(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };
  const addCustomPeriod = () => {
    if (periodInput.trim() && !formPeriods.includes(periodInput.trim())) {
      setFormPeriods(prev => [...prev, periodInput.trim()]);
      setPeriodInput('');
    }
  };

  const togglePaymentOption = (opt: string) => {
    setFormPaymentOptions(prev => prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt]);
  };

  const toggleEmiMonth = (m: string) => {
    setFormEmiMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };
  const addCustomEmi = () => {
    if (emiInput.trim() && !formEmiMonths.includes(emiInput.trim())) {
      setFormEmiMonths(prev => [...prev, emiInput.trim()]);
      setEmiInput('');
    }
  };

  const addTermOption = () => {
    if (termInput.trim() && !formPaymentTerms.includes(termInput.trim())) {
      setFormPaymentTerms(prev => [...prev, termInput.trim()]);
      setTermInput('');
    }
  };
  const removeTermOption = (t: string) => {
    setFormPaymentTerms(prev => prev.filter(x => x !== t));
  };

  // Filtered List
  const filteredScenarios = useMemo(() => {
    return scenarios.filter((sc: any) => {
      const pType = (sc.policyType || '').toUpperCase();
      const bType = (sc.businessType || '').toUpperCase();
      const cId   = sc.companyId || sc.company?.id;
      const coName = sc.company?.name || '';
      const planName = sc.plan?.name || '';

      const matchSearch = !searchQuery || 
        coName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        planName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bType.toLowerCase().includes(searchQuery.toLowerCase());

      const matchPType = filterPolicyType === 'ALL' || pType === filterPolicyType;
      const matchBType = filterBusinessType === 'ALL' || bType === filterBusinessType;
      const matchCompany = filterCompanyId === 'ALL' || cId === filterCompanyId;

      return matchSearch && matchPType && matchBType && matchCompany;
    });
  }, [scenarios, searchQuery, filterPolicyType, filterBusinessType, filterCompanyId]);

  return (
    <div className="space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="text-primary-600" size={20} />
            Policy Scenario Rules Engine
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure dynamic rules for Policy Period, Premium Payment options, and Payment Terms per Company and Plan.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md shadow-primary-500/20 transition-all cursor-pointer"
        >
          <Plus size={15} />
          New Scenario Rule
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto flex-1">
          <div className="relative flex-1 sm:w-64 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search company, plan, type..."
              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-slate-50/50"
            />
          </div>

          <select
            value={filterPolicyType}
            onChange={e => setFilterPolicyType(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500/20 bg-white"
          >
            <option value="ALL">All Policy Types</option>
            {POLICY_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            value={filterBusinessType}
            onChange={e => setFilterBusinessType(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500/20 bg-white"
          >
            <option value="ALL">All Business Types</option>
            {BUSINESS_TYPES.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <select
            value={filterCompanyId}
            onChange={e => setFilterCompanyId(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500/20 bg-white max-w-[180px]"
          >
            <option value="ALL">All Companies</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="text-xs font-semibold text-slate-500">
          Showing <span className="text-slate-900 font-bold">{filteredScenarios.length}</span> rules
        </div>
      </div>

      {/* Table / List */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium">Loading policy scenario rules...</div>
        ) : filteredScenarios.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Layers className="mx-auto text-slate-300" size={36} />
            <p className="text-xs font-bold text-slate-700">No Policy Scenario Rules Found</p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              No scenarios match your filter. Click <strong>New Scenario Rule</strong> to configure dynamic policy rules.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3">Policy & Business Type</th>
                  <th className="px-5 py-3">Company & Plan</th>
                  <th className="px-5 py-3">Valid Policy Periods</th>
                  <th className="px-5 py-3">Payment Options</th>
                  <th className="px-5 py-3">Payment Term (PPT)</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredScenarios.map(sc => {
                  const pType = (sc.policyType || 'HEALTH').toUpperCase();
                  const bType = (sc.businessType || 'FRESH').toUpperCase();
                  const coName = sc.company?.name || 'Insurance Co.';
                  const planName = sc.plan?.name || 'Plan';
                  const periods: string[] = Array.isArray(sc.policyPeriods) ? sc.policyPeriods : [];
                  const payOpts: string[] = Array.isArray(sc.paymentOptions) ? sc.paymentOptions : [];
                  const emiMonths: string[] = Array.isArray(sc.emiMonths) ? sc.emiMonths : [];
                  const payTerms: string[] = Array.isArray(sc.paymentTerms) ? sc.paymentTerms : [];

                  return (
                    <tr key={sc.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className={clsx('px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wide',
                            pType === 'HEALTH' ? 'bg-emerald-100 text-emerald-800' :
                            pType === 'TERM' ? 'bg-indigo-100 text-indigo-800' :
                            pType === 'LIFE' ? 'bg-amber-100 text-amber-800' :
                            'bg-blue-100 text-blue-800'
                          )}>
                            {pType}
                          </span>
                          <span className={clsx('px-2 py-0.5 rounded-md font-bold text-[10px] uppercase border',
                            bType === 'FRESH' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                            bType === 'PORT' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            'bg-amber-50 text-amber-700 border-amber-200'
                          )}>
                            {bType}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900">{coName}</div>
                        <div className="text-[11px] text-slate-500 font-semibold">{planName}</div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {periods.map(p => (
                            <span key={p} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-bold border border-slate-200">
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {payOpts.map(o => (
                            <span key={o} className={clsx('px-2 py-0.5 rounded-md text-[10px] font-bold border',
                              o === 'EMI' ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                            )}>
                              {o}
                            </span>
                          ))}
                          {payOpts.includes('EMI') && emiMonths.length > 0 && (
                            <span className="text-[9px] font-semibold text-violet-600 block w-full mt-0.5">
                              EMI: {emiMonths.join(', ')}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        {payTerms.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {payTerms.map(t => (
                              <span key={t} className="bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-md text-[10px] font-bold">
                                {t}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Same as Policy Period</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => toggleMutation.mutate({ id: sc.id, isActive: !sc.isActive })}
                          className="cursor-pointer transition-opacity hover:opacity-80"
                          title="Click to toggle active status"
                        >
                          {sc.isActive !== false ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
                              <Check size={10} /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
                              <X size={10} /> Inactive
                            </span>
                          )}
                        </button>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(sc)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-primary-600 hover:bg-primary-50 transition-colors cursor-pointer"
                            title="Edit Scenario"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete scenario for ${coName} - ${planName}?`)) {
                                deleteMutation.mutate(sc.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete Scenario"
                          >
                            <Trash2 size={14} />
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

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <Modal
          open={isModalOpen}
          onClose={closeModal}
          title={editingScenario ? 'Edit Policy Scenario Rule' : 'Create Policy Scenario Rule'}
          size="lg"
        >
          <form onSubmit={handleSave} className="space-y-5 p-1">
            {/* Row 1: Policy Type & Business Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Policy Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formPolicyType}
                  onChange={e => setFormPolicyType(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                >
                  {POLICY_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Business Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formBusinessType}
                  onChange={e => setFormBusinessType(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                >
                  {BUSINESS_TYPES.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Insurance Company & Plan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Insurance Company <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formCompanyId}
                  onChange={e => {
                    setFormCompanyId(e.target.value);
                    setFormPlanId('');
                  }}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                >
                  <option value="">-- Select Company --</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Insurance Plan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formPlanId}
                  onChange={e => setFormPlanId(e.target.value)}
                  disabled={!formCompanyId}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  <option value="">-- Select Plan --</option>
                  {availablePlans.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.planCode || p.category})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Section 3: Valid Policy Periods */}
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <label className="block text-xs font-bold text-slate-800">
                Supported Policy Periods <span className="text-rose-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {DEFAULT_PERIODS.map(p => {
                  const selected = formPeriods.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePeriod(p)}
                      className={clsx('px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer',
                        selected
                          ? 'bg-primary-600 text-white border-primary-600 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={periodInput}
                  onChange={e => setPeriodInput(e.target.value)}
                  placeholder="Custom period (e.g. 1 to 99 Yr)..."
                  className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium flex-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <button
                  type="button"
                  onClick={addCustomPeriod}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Add Custom
                </button>
              </div>

              {formPeriods.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide self-center mr-1">Selected:</span>
                  {formPeriods.map(p => (
                    <span key={p} className="inline-flex items-center gap-1 bg-primary-50 text-primary-700 border border-primary-200 px-2 py-0.5 rounded-md text-xs font-bold">
                      {p}
                      <X size={12} className="cursor-pointer hover:text-primary-900" onClick={() => togglePeriod(p)} />
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Section 4: Premium Payment Options */}
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <label className="block text-xs font-bold text-slate-800">
                Premium Payment Options <span className="text-rose-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_OPTIONS.map(opt => {
                  const selected = formPaymentOptions.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => togglePaymentOption(opt)}
                      className={clsx('px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer',
                        selected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                      )}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* EMI Options conditional */}
            {formPaymentOptions.includes('EMI') && (
              <div className="space-y-2 bg-violet-50/60 p-3 rounded-xl border border-violet-200/80">
                <label className="block text-xs font-bold text-violet-900">
                  Supported EMI Tenures / Months
                </label>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_EMI_MONTHS.map(m => {
                    const selected = formEmiMonths.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleEmiMonth(m)}
                        className={clsx('px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer',
                          selected
                            ? 'bg-violet-600 text-white border-violet-600 shadow-xs'
                            : 'bg-white text-violet-700 border-violet-200 hover:border-violet-300'
                        )}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={emiInput}
                    onChange={e => setEmiInput(e.target.value)}
                    placeholder="Custom EMI tenure (e.g. 3 to 36 Months)..."
                    className="border border-violet-200 rounded-xl px-3 py-1.5 text-xs font-medium flex-1 focus:outline-none focus:ring-1 focus:ring-violet-500 bg-white"
                  />
                  <button
                    type="button"
                    onClick={addCustomEmi}
                    className="px-3 py-1.5 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-xs font-bold cursor-pointer"
                  >
                    Add EMI Option
                  </button>
                </div>
              </div>
            )}

            {/* Section 5: Premium Payment Term (PPT) Options */}
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <label className="block text-xs font-bold text-slate-800">
                Premium Payment Term (PPT) Options <span className="text-slate-400 font-normal">(Applicable for Term / Life insurance)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={termInput}
                  onChange={e => setTermInput(e.target.value)}
                  placeholder="e.g. 1 to 99 Yr, Pay till 60, Regular Term..."
                  className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium flex-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <button
                  type="button"
                  onClick={addTermOption}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold cursor-pointer"
                >
                  Add Payment Term
                </button>
              </div>

              {formPaymentTerms.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {formPaymentTerms.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-md text-xs font-bold">
                      {t}
                      <X size={12} className="cursor-pointer hover:text-teal-950" onClick={() => removeTermOption(t)} />
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={e => setFormIsActive(e.target.checked)}
                  className="rounded text-primary-600 focus:ring-primary-500 w-4 h-4"
                />
                Scenario Active
              </label>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md shadow-primary-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingScenario ? 'Update Scenario' : 'Save Scenario'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
