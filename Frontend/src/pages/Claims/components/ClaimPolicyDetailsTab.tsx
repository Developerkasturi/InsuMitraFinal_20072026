import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { policiesService } from '@api/index';
import { 
  Shield, 
  Users, 
  CreditCard, 
  Award, 
  Calendar, 
  User, 
  ExternalLink, 
  FileText, 
  FileCheck2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { getPolicyStatusDisplay } from '@utils/policyStatusUtils';

interface ClaimPolicyDetailsTabProps {
  policy?: any;
  policyId?: string;
  contact?: any;
  onGoToClaimTab?: () => void;
}

export default function ClaimPolicyDetailsTab({
  policy: initialPolicy,
  policyId,
  contact: initialContact,
  onGoToClaimTab,
}: ClaimPolicyDetailsTabProps) {
  const targetId = policyId || initialPolicy?.id;

  const { data: fullPolicyRes, isLoading, error } = useQuery({
    queryKey: ['claim-linked-policy-full', targetId],
    queryFn: () => policiesService.get(targetId!),
    enabled: Boolean(targetId),
  });

  const p = fullPolicyRes?.data || fullPolicyRes || initialPolicy;
  const contact = p?.contact || initialContact;

  if (!targetId && !p) {
    return (
      <div className="p-8 sm:p-12 bg-slate-50/80 border border-slate-200/90 rounded-2xl text-center space-y-3 animate-fadeIn">
        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-100 shadow-2xs">
          <Shield size={28} />
        </div>
        <div className="max-w-md mx-auto space-y-1">
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">No Policy Linked Yet</h4>
          <p className="text-xs text-slate-500">
            Please select a customer and choose an active policy under the <span className="font-bold text-slate-700">Claim Details</span> tab to view complete policy specifications, insured members, and coverage.
          </p>
        </div>
        {onGoToClaimTab && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onGoToClaimTab}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all cursor-pointer"
            >
              Go to Claim Details
            </button>
          </div>
        )}
      </div>
    );
  }

  if (isLoading && !p) {
    return (
      <div className="p-12 bg-white border border-slate-200/90 rounded-2xl flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-600">Loading connected policy details...</p>
      </div>
    );
  }

  if (!p) {
    return (
      <div className="p-8 bg-slate-50 border border-slate-200/90 rounded-2xl text-center space-y-2">
        <AlertCircle size={28} className="text-amber-500 mx-auto" />
        <p className="text-xs font-bold text-slate-700">Policy details not found</p>
        <p className="text-[11px] text-slate-400">The referenced policy could not be loaded.</p>
      </div>
    );
  }

  const statusInfo = getPolicyStatusDisplay(p);
  const companyName = p.plan?.company?.name || p.companyName || '—';
  const planName = p.plan?.name || p.productName || '—';
  const planCategory = p.plan?.category || p.category || 'Health';
  const sumAssuredVal = p.sumAssured || p.sumInsured || p.plan?.sumInsured;
  const premiumVal = p.premiumAmount;
  const agentName = p.agentName
    || `${p.agent?.firstName || p.assignedEmployee?.employeeProfile?.firstName || ''} ${p.agent?.lastName || p.assignedEmployee?.employeeProfile?.lastName || ''}`.trim()
    || '—';
  const membersList: any[] = p.members || [];
  const nomineesList: any[] = p.nominees || [];
  const paymentsList: any[] = p.payments || [];
  const policyClaimsList: any[] = p.claims || [];
  const policyType = p.policyType || p.policyCategory || p.plan?.subCategory || '—';
  const firstYearPremium = p.firstYearPremium || premiumVal;
  const secondYearPremium = p.secondYearPremium || premiumVal;
  const noteValue = (label: string) => {
    const line = (p.notes || '').split(/\r?\n/).find((entry: string) => entry.startsWith(`${label}:`));
    return line?.slice(label.length + 1).trim() || '';
  };
  const policyTerm = noteValue('Policy Term')
    || (p.startDate && p.endDate
      ? `${Math.max(1, Math.round((new Date(p.endDate).getTime() - new Date(p.startDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)))} Year`
      : '—');
  const premiumPayingTerm = noteValue('Premium Payment Period');
  const primaryAddress = contact?.addresses?.find((address: any) => address.isPrimary) || contact?.addresses?.[0];
  const contactCity = contact?.city || primaryAddress?.city || '—';
  const contactStatePincode = [contact?.state || primaryAddress?.state, contact?.pincode || primaryAddress?.pincode]
    .filter(Boolean).join(' · ') || '—';
  const insuredPersonName = p.insuredPerson
    || `${contact?.firstName || ''} ${contact?.lastName || ''}`.trim()
    || '—';
  const paymentMode = noteValue('Payment Mode') || p.paymentMode || p.paymentMethod || '—';
  const paymentOption = noteValue('Payment Option') || '—';

  const DetailField = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="min-w-0">
      <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">{label}</span>
      <div className="min-h-8 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-2 text-[11px] font-bold text-slate-700 flex items-center break-words">
        {value || '—'}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Top Header Card */}
      <div className="border border-slate-200/90 rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <Shield size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  {p.policyNumber || 'Policy #' + p.id?.slice(-6)}
                </h3>
                <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border', statusInfo.badgeClass)}>
                  {statusInfo.label}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-blue-100/70 text-blue-800 text-[10px] font-bold border border-blue-200/60">
                  {planCategory}
                </span>
              </div>
              <p className="text-xs text-slate-600 font-semibold mt-0.5 flex flex-wrap items-center gap-1.5">
                <span>{planName}</span>
                <span>•</span>
                <span className="text-slate-500 font-medium">{companyName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {p.id && (
              <Link
                to={`/policies/${p.id}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 shadow-2xs hover:shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                title="View full policy details page in new tab"
              >
                <span>View in Policies</span>
                <ExternalLink size={12} />
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Card 1: Policy & Coverage Specifications */}
        <div className="border border-slate-200/90 rounded-xl bg-white shadow-2xs overflow-hidden">
          <div className="min-h-8 px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] font-black flex items-center justify-center">1</span>
            <h4 className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-1">
              <FileText size={12} className="text-blue-500" />
              Policy & Plan Specifications
            </h4>
            <span className="ml-auto text-[9px] text-slate-500 font-semibold">Base Policy & Plan Details</span>
            <ChevronDown size={12} className="text-slate-500" />
          </div>
          <div className="p-2.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <DetailField label="Policy Number" value={p.policyNumber} />
            <DetailField label="Insurance Company" value={companyName} />
            <DetailField label="Plan / Product Name" value={planName} />
            <DetailField label="Policy Category" value={planCategory} />
            <DetailField label="Policy Type" value={policyType} />
            <DetailField label="Policy Status" value={statusInfo.label} />
            <DetailField label="Agent / Broker Name" value={agentName} />
            <DetailField label="Agent / Broker Code" value={p.agentCode} />
            <DetailField
              label="Sum Assured / Insured (₹)"
              value={sumAssuredVal ? `₹${Number(sumAssuredVal).toLocaleString('en-IN')}` : '—'}
            />
          </div>
        </div>
      </div>

      <div className="border border-slate-200/90 rounded-xl bg-white shadow-2xs overflow-hidden">
        <div className="min-h-8 px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center">2</span>
          <h4 className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-1">
            <CreditCard size={12} className="text-emerald-600" />
            Premium Breakdown & Installments
          </h4>
          <span className="ml-auto text-[9px] text-slate-500 font-semibold">Premium Amounts & Frequency</span>
          <ChevronDown size={12} className="text-slate-500" />
        </div>

        <div className="p-2.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <DetailField
            label="Premium Amount (₹)"
            value={premiumVal ? `₹${Number(premiumVal).toLocaleString('en-IN')}` : '—'}
          />
          <DetailField
            label="1st Year Premium Amount (₹)"
            value={firstYearPremium ? `₹${Number(firstYearPremium).toLocaleString('en-IN')}` : '—'}
          />
          <DetailField
            label="2nd Year Onwards Premium Amount (₹)"
            value={secondYearPremium ? `₹${Number(secondYearPremium).toLocaleString('en-IN')}` : '—'}
          />
          <DetailField label="Installment Frequency" value={p.paymentFrequency || '—'} />
          <DetailField
            label="Payment Method / Mode"
            value={`${paymentMode}${paymentOption !== '—' ? ` / ${paymentOption}` : ''}`}
          />
          <DetailField
            label="Sum Assured / Sum Insured (₹)"
            value={sumAssuredVal ? `₹${Number(sumAssuredVal).toLocaleString('en-IN')}` : '—'}
          />
        </div>
      </div>

      <div className="border border-slate-200/90 rounded-xl bg-white shadow-2xs overflow-hidden">
        <div className="min-h-8 px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-indigo-500 text-white text-[9px] font-black flex items-center justify-center">3</span>
          <h4 className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-1">
            <Calendar size={12} className="text-indigo-500" />
            Tenure, Maturity & Term Dates
          </h4>
          <span className="ml-auto text-[9px] text-slate-500 font-semibold">Tenure & Policy Dates</span>
          <ChevronDown size={12} className="text-slate-500" />
        </div>
        <div className="p-2.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <DetailField
            label="Policy Start Date (Inception)"
            value={p.startDate ? format(new Date(p.startDate), 'dd/MMM/yyyy') : '—'}
          />
          <DetailField
            label="Policy End Date (Expiry)"
            value={p.endDate ? format(new Date(p.endDate), 'dd/MMM/yyyy') : '—'}
          />
          <DetailField
            label="Date of Maturity"
            value={p.maturityDate ? format(new Date(p.maturityDate), 'dd/MMM/yyyy') : '—'}
          />
          <DetailField
            label="Next Premium Due Date"
            value={p.nextDueDate ? format(new Date(p.nextDueDate), 'dd/MMM/yyyy') : '—'}
          />
          <DetailField label="Policy Term (Years)" value={policyTerm} />
          <DetailField label="Premium Paying Term (Years)" value={premiumPayingTerm || '—'} />
        </div>
      </div>

      <div className="border border-slate-200/90 rounded-xl bg-white shadow-2xs overflow-hidden">
        <div className="min-h-8 px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-violet-500 text-white text-[9px] font-black flex items-center justify-center">4</span>
          <h4 className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-1">
            <User size={12} className="text-violet-500" />
            Policyholder & Proposer Details
          </h4>
          <span className="ml-auto text-[9px] text-slate-500 font-semibold">Customer & Proposer Information</span>
          {contact?.id && (
            <Link
              to={`/contacts/${contact.id}`}
              target="_blank"
              rel="noreferrer"
              className="text-[9px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              View Contact <ExternalLink size={9} />
            </Link>
          )}
          <ChevronDown size={12} className="text-slate-500" />
        </div>
        <div className="p-2.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <DetailField
            label="Proposer / Customer Name"
            value={`${contact?.firstName || ''} ${contact?.lastName || ''}`.trim() || '—'}
          />
          <DetailField label="Phone / WhatsApp Number" value={contact?.phone} />
          <DetailField label="Email Address" value={contact?.email} />
          <DetailField label="City" value={contactCity} />
          <DetailField label="State & Pincode" value={contactStatePincode} />
          <DetailField label="Primary Insured Person" value={insuredPersonName} />
          <div className="sm:col-span-2 lg:col-span-3">
            <DetailField label="Policy Notes & Remarks" value={p.notes || '—'} />
          </div>
        </div>
      </div>

      {/* Grid: Insured Members & Nominees */}
      <div className="border border-slate-200/90 rounded-xl bg-white shadow-2xs overflow-hidden">
        <div className="min-h-8 px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-fuchsia-500 text-white text-[9px] font-black flex items-center justify-center">5</span>
          <h4 className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-1">
            <Users size={12} className="text-fuchsia-600" />
            Insured Members & Nominees
          </h4>
          <span className="ml-auto text-[9px] text-slate-500 font-semibold">
            {membersList.length || 1} Member(s) · {nomineesList.length} Nominee(s)
          </span>
          <ChevronDown size={12} className="text-slate-500" />
        </div>
        <div className="p-2.5 grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {/* Insured Members */}
        <div className="border border-slate-200 rounded-lg bg-white p-2.5 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <h4 className="text-[9px] font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <Users size={14} className="text-blue-600" />
              Insured Members ({membersList.length || 1})
            </h4>
            <span className="text-[9px] text-slate-500 font-semibold">Covered Persons</span>
          </div>

          {membersList.length === 0 ? (
            <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 text-xs">
              <p className="font-bold text-slate-800">
                {contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() : 'Primary Policyholder'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Self (Primary Insured) · Sum Insured: ₹{Number(sumAssuredVal || 0).toLocaleString('en-IN')}</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {membersList.map((m: any, idx: number) => (
                <div key={m.id || idx} className="p-2.5 rounded-xl bg-slate-50/60 border border-slate-100 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block">{m.name || `${m.firstName || ''} ${m.lastName || ''}`}</span>
                    <span className="text-[10px] text-slate-500">
                      {m.relationship || 'Member'}
                      {m.dateOfBirth ? ` · DOB: ${format(new Date(m.dateOfBirth), 'dd/MMM/yyyy')}` : ''}
                      {m.gender ? ` · ${m.gender}` : ''}
                    </span>
                  </div>
                  {m.sumInsured ? (
                    <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                      ₹{Number(m.sumInsured).toLocaleString('en-IN')}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Nominees */}
        <div className="border border-slate-200 rounded-lg bg-white p-2.5 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <h4 className="text-[9px] font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <Award size={14} className="text-purple-600" />
              Nominees ({nomineesList.length})
            </h4>
            <span className="text-[9px] text-slate-500 font-semibold">Beneficiaries</span>
          </div>

          {nomineesList.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">No nominees recorded for this policy.</p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {nomineesList.map((n: any, idx: number) => (
                <div key={n.id || idx} className="p-2.5 rounded-xl bg-slate-50/60 border border-slate-100 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block">{n.name}</span>
                    <span className="text-[10px] text-slate-500">
                      {n.relationship || 'Nominee'}
                      {n.dateOfBirth ? ` · DOB: ${format(new Date(n.dateOfBirth), 'dd/MMM/yyyy')}` : ''}
                    </span>
                  </div>
                  {n.sharePercent ? (
                    <span className="text-[10px] font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                      Share: {n.sharePercent}%
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>

      <div className="border border-slate-200/90 rounded-xl bg-white shadow-2xs overflow-hidden">
        <div className="min-h-8 px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-black flex items-center justify-center">6</span>
          <h4 className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-1">
            <CreditCard size={12} className="text-emerald-600" />
            Payment Schedule & Linked Claims
          </h4>
          <span className="ml-auto text-[9px] text-slate-500 font-semibold">
            {paymentsList.length} Payment(s) · {policyClaimsList.length} Claim(s)
          </span>
          <ChevronDown size={12} className="text-slate-500" />
        </div>
        <div className="p-2.5 space-y-2.5">
          <div>
            <h5 className="text-[9px] font-extrabold text-slate-600 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-1.5 mb-2">
              <CreditCard size={11} className="text-emerald-600" />
              Recent Premium Payment Schedule
            </h5>
            {paymentsList.length === 0 ? (
              <p className="text-[10px] text-slate-500 py-1">No payment schedule recorded for this policy.</p>
            ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
            {paymentsList.map((pay: any) => (
              <div
                key={pay.id}
                className={clsx(
                  'p-2.5 rounded-xl border text-xs space-y-1',
                  pay.isPaid ? 'border-emerald-100 bg-emerald-50/30' : 'border-slate-100 bg-slate-50/40'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900">₹{Number(pay.amount).toLocaleString('en-IN')}</span>
                  {pay.isPaid ? (
                    <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">✓ PAID</span>
                  ) : (
                    <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">DUE</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 flex justify-between">
                  <span>Due: {pay.dueDate ? format(new Date(pay.dueDate), 'dd/MMM/yyyy') : '—'}</span>
                  {pay.mode && <span>{pay.mode}</span>}
                </div>
              </div>
            ))}
          </div>
            )}
          </div>

          <div>
            <h5 className="text-[9px] font-extrabold text-slate-600 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-1.5 mb-2">
              <FileCheck2 size={11} className="text-blue-600" />
              Other Claims Registered on this Policy
            </h5>
            {policyClaimsList.length === 0 ? (
              <p className="text-[10px] text-slate-500 py-1">No other claims registered on this policy.</p>
            ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {policyClaimsList.map((c: any) => (
              <div key={c.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs">
                <div>
                  <span className="font-extrabold text-slate-900">{c.claimNumber || 'Claim'}</span>
                  <span className="text-[10px] text-slate-400 block">{c.claimType || 'General'}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-emerald-700 block">₹{Number(c.claimAmount || 0).toLocaleString('en-IN')}</span>
                  <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase bg-blue-50 text-blue-700 border border-blue-100">
                    {c.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
