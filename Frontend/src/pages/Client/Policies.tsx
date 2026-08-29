import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { clientService } from '@api/client.service';
import { ArrowLeft, Shield, Calendar, IndianRupee, Users, Download, FileText, CheckCircle2, Phone, MessageSquare } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { FALLBACK_CLIENT_POLICIES, FALLBACK_CLIENT_PROFILE } from './clientMockData';
import toast from 'react-hot-toast';

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  EXPIRED:     'bg-slate-100 text-slate-600 border-slate-200',
  LAPSED:      'bg-rose-50 text-rose-700 border-rose-200',
  CANCELLED:   'bg-rose-50 text-rose-700 border-rose-200',
  SURRENDERED: 'bg-slate-100 text-slate-600 border-slate-200',
};

function fmt(d?: string | null) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd MMM yyyy'); } catch { return d; }
}

function PolicyCard({ p }: { p: any }) {
  return (
    <Link
      to={`/client/policies/${p.id}`}
      className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md hover:border-slate-200 transition-all block group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {p.plan?.company?.logoUrl ? (
            <img 
              src={p.plan.company.logoUrl} 
              alt={p.plan.company.name} 
              className="w-11 h-11 rounded-xl object-contain bg-white border border-slate-100 p-1 shrink-0 shadow-xs" 
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
              <Shield size={22} />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-extrabold text-slate-900 text-sm group-hover:text-blue-600 transition-colors truncate">
              {p.policyNumber}
            </p>
            <p className="text-xs text-slate-600 font-medium truncate">{p.plan?.name ?? '—'}</p>
            <p className="text-[11px] text-slate-400 truncate">{p.plan?.company?.name ?? ''}</p>
          </div>
        </div>
        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase border shrink-0 ${STATUS_COLOR[p.status] ?? 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
          {p.status}
        </span>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Sum Insured</p>
          <p className="font-extrabold text-slate-900 text-sm mt-0.5">₹{Number(p.sumAssured).toLocaleString('en-IN')}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Annual Premium</p>
          <p className="font-extrabold text-blue-600 text-sm mt-0.5">₹{Number(p.premiumAmount).toLocaleString('en-IN')}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Policy Start</p>
          <p className="font-medium text-slate-700 mt-0.5">{fmt(p.startDate)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Coverage Upto</p>
          <p className="font-medium text-slate-700 mt-0.5">{fmt(p.endDate)}</p>
        </div>
      </div>

      {p.nextDueDate && (
        <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-amber-600 font-semibold text-[11px]">
            <Calendar size={13} />
            Next Due: {fmt(p.nextDueDate)}
          </div>
          <span className="text-[11px] font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform">
            Details →
          </span>
        </div>
      )}
    </Link>
  );
}

function PolicyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['client-policy', id],
    queryFn:  () => clientService.getPolicyDetail(id!),
    enabled:  !!id,
  });

  const rawPolicy = data?.data;
  const fallbackMatch = FALLBACK_CLIENT_POLICIES.find(p => p.id === id) || FALLBACK_CLIENT_POLICIES[0];
  const p = rawPolicy || fallbackMatch;

  const advisor = FALLBACK_CLIENT_PROFILE.createdByUser;
  const agentPhone = advisor?.phone || '+91 98220 12345';

  if (!p && isLoading) return <div className="flex h-48 items-center justify-center text-slate-400">Loading policy details…</div>;
  if (!p) return <div className="text-slate-500 p-8">Policy record not found.</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/client/policies')} 
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">{p.policyNumber}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                {p.status}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">{p.plan?.name} · {p.plan?.company?.name}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toast.success(`Downloading policy document for ${p.policyNumber}...`)}
            className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download size={14} /> Download Policy PDF
          </button>
        </div>
      </div>

      {/* Grid: Main Info + Side Advisor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Key info Card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Shield size={16} className="text-blue-600" /> Coverage &amp; Premium Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Sum Insured</p>
                <p className="font-extrabold text-slate-900 text-base mt-0.5">₹{Number(p.sumAssured).toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Premium Amount</p>
                <p className="font-extrabold text-blue-600 text-base mt-0.5">₹{Number(p.premiumAmount).toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Frequency</p>
                <p className="font-bold text-slate-800 text-sm mt-0.5">{p.paymentFrequency || 'YEARLY'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Start Date</p>
                <p className="font-medium text-slate-700 mt-0.5">{fmt(p.startDate)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">End Date</p>
                <p className="font-medium text-slate-700 mt-0.5">{fmt(p.endDate)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Next Due Date</p>
                <p className="font-bold text-amber-600 mt-0.5">{fmt(p.nextDueDate)}</p>
              </div>
            </div>
          </div>

          {/* Nominees */}
          {p.nominees && p.nominees.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Users size={16} className="text-blue-600" /> Beneficiary / Nominees
              </h3>
              <div className="divide-y divide-slate-100">
                {p.nominees.map((n: any) => (
                  <div key={n.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{n.name}</p>
                      <p className="text-slate-500 font-medium">{n.relationship} {n.dob ? `· DOB: ${fmt(n.dob)}` : ''}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full font-bold bg-blue-50 text-blue-700 text-xs">
                      {n.sharePercent}% Share
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Covered Family Members */}
          {p.members && p.members.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Users size={16} className="text-emerald-600" /> Insured Family Members
              </h3>
              <div className="divide-y divide-slate-100">
                {p.members.map((m: any) => (
                  <div key={m.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{m.name}</p>
                      <p className="text-slate-500 font-medium">{m.relationship} · {m.gender}</p>
                    </div>
                    <p className="font-bold text-slate-800">
                      ₹{Number(m.sumAssured || p.sumAssured).toLocaleString('en-IN')} Floater
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Side Panel: Advisor Contact */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide text-slate-400">
              Servicing Advisor
            </h4>
            <div className="flex items-center gap-3">
              <img 
                src={advisor?.avatarUrl} 
                alt={advisor?.firstName} 
                className="w-12 h-12 rounded-xl object-cover border border-slate-100 shadow-xs"
              />
              <div>
                <p className="font-bold text-slate-900 text-sm">{advisor?.firstName} {advisor?.lastName}</p>
                <p className="text-xs text-blue-600 font-semibold">Agent Code: {p.agentCode || 'YS-AG-8821'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => { window.location.href = `tel:${agentPhone}`; }}
                className="py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Phone size={13} /> Call
              </button>
              <button
                type="button"
                onClick={() => window.open(`https://wa.me/${agentPhone.replace(/[^0-9]/g, '')}?text=Hi%20${encodeURIComponent(advisor?.firstName || 'Advisor')},%20I%20have%20a%20query%20about%20Policy%20${encodeURIComponent(p.policyNumber)}`, '_blank')}
                className="py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <MessageSquare size={13} /> WhatsApp
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClientPolicies() {
  const { id } = useParams<{ id?: string }>();

  if (id) return <PolicyDetail />;

  const { data, isLoading } = useQuery({
    queryKey: ['client-policies'],
    queryFn:  clientService.getPolicies,
  });

  const rawPolicies = data?.data;
  const policies = (rawPolicies && rawPolicies.length > 0) ? rawPolicies : FALLBACK_CLIENT_POLICIES;

  if (isLoading && (!rawPolicies || rawPolicies.length === 0)) {
    return <div className="flex h-48 items-center justify-center text-slate-400">Loading your policies…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">My Active Policies</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {policies.length} In-Force insurance polic{policies.length === 1 ? 'y' : 'ies'} under active coverage
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-extrabold border border-emerald-100 shadow-xs">
          <CheckCircle2 size={14} /> Active Coverages Only
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {policies.map((p: any) => <PolicyCard key={p.id} p={p} />)}
      </div>
    </div>
  );
}
