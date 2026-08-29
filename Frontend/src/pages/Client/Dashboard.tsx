import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { clientService } from '@api/client.service';
import { useClientStore } from '@store/client.store';
import { 
  Shield, AlertCircle, FileText, Calendar, 
  Phone, MessageSquare, Mail, User, ArrowRight, CheckCircle2 
} from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

import { FALLBACK_CLIENT_PROFILE, FALLBACK_CLIENT_POLICIES, FALLBACK_CLIENT_CLAIMS } from './clientMockData';

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:      'bg-emerald-100 text-emerald-700 border-emerald-200',
  INTIMATED:   'bg-amber-100 text-amber-700 border-amber-200',
  FILED:       'bg-blue-100 text-blue-700 border-blue-200',
  IN_REVIEW:   'bg-indigo-100 text-indigo-700 border-indigo-200',
  APPROVED:    'bg-emerald-100 text-emerald-700 border-emerald-200',
  SETTLED:     'bg-green-100 text-green-700 border-green-200',
  REJECTED:    'bg-rose-100 text-rose-700 border-rose-200',
};

export default function ClientDashboard() {
  const user = useClientStore(s => s.user);

  const { data: policiesData } = useQuery({
    queryKey: ['client-policies'],
    queryFn:  clientService.getPolicies,
  });

  const { data: claimsData } = useQuery({
    queryKey: ['client-claims'],
    queryFn:  clientService.getClaims,
  });

  const { data: profileData } = useQuery({
    queryKey: ['client-me'],
    queryFn:  clientService.getMe,
  });

  const rawPolicies = policiesData?.data;
  const rawClaims   = claimsData?.data;
  const rawProfile  = profileData?.data;

  const policies = (rawPolicies && rawPolicies.length > 0) ? rawPolicies : FALLBACK_CLIENT_POLICIES;
  const claims   = (rawClaims && rawClaims.length > 0) ? rawClaims : FALLBACK_CLIENT_CLAIMS;
  const profile  = rawProfile || FALLBACK_CLIENT_PROFILE;
  const tenant   = profile?.tenant;
  const advisor  = profile?.createdByUser;

  const agencyName = tenant?.name || 'Sampada Investment Solutions';
  const tagline = tenant?.tagline || 'Your Trusted Insurance & Financial Protection Partner';
  const primaryColor = tenant?.primaryColor || '#2563eb';
  const banners = tenant?.banners || [];

  const activePolicies = policies.filter((p: any) => p.status === 'ACTIVE');
  const pendingClaims  = claims.filter((c: any) => ['INTIMATED', 'FILED', 'IN_REVIEW', 'DOC_COLLECTION'].includes(c.status));

  // Upcoming renewals (next 90 days)
  const upcoming = policies
    .filter((p: any) => {
      if (!p.nextDueDate) return false;
      const days = differenceInDays(parseISO(p.nextDueDate), new Date());
      return days >= 0 && days <= 90;
    })
    .sort((a: any, b: any) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime())
    .slice(0, 5);

  const agentPhone = advisor?.phone || tenant?.phone || '+91 98765 43210';
  const agentName = advisor ? `${advisor.firstName} ${advisor.lastName}` : (tenant?.name ? `${tenant.name} Support` : 'Personal Advisor');
  const agentEmail = advisor?.email || tenant?.email || 'support@agency.com';
  const agentPhoto = advisor?.avatarUrl || tenant?.agentPhotoUrl;

  return (
    <div className="space-y-6">
      {/* 1. Dynamic Branded Welcome Banner */}
      <div 
        className="rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden transition-all"
        style={{
          background: `linear-gradient(135deg, ${primaryColor} 0%, #1e1b4b 100%)`
        }}
      >
        <div className="absolute right-0 top-0 bottom-0 opacity-10 flex items-center pr-8 pointer-events-none">
          <Shield size={220} />
        </div>
        
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-bold tracking-wide uppercase mb-3 border border-white/20">
            <CheckCircle2 size={13} className="text-emerald-300" />
            {agencyName}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Welcome, {profile?.firstName || user?.firstName || 'Valued Client'} {profile?.lastName || user?.lastName || ''}
          </h2>
          <p className="text-white/80 text-xs sm:text-sm mt-1.5 font-medium leading-relaxed">
            {tagline}
          </p>

          {/* Quick Action Badges */}
          <div className="flex flex-wrap gap-2.5 mt-5">
            <Link
              to="/client/policies"
              className="px-4 py-2 rounded-xl bg-white text-slate-900 hover:bg-slate-100 text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <FileText size={14} className="text-blue-600" /> View In-Force Policies
            </Link>
            <Link
              to="/client/claims"
              className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold flex items-center gap-1.5 backdrop-blur-md border border-white/20 transition-all"
            >
              <AlertCircle size={14} /> Track Active Claims
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Marketing Banners from Firm Profile (if available) */}
      {banners.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {banners.map((b: any) => (
            <div 
              key={b.id}
              className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow"
            >
              {b.imageUrl && (
                <img 
                  src={b.imageUrl} 
                  alt={b.title} 
                  className="w-20 h-20 rounded-xl object-cover shrink-0" 
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  Special Announcement
                </span>
                <h4 className="font-bold text-slate-900 text-sm mt-1 truncate">{b.title}</h4>
                {b.description && (
                  <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{b.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. Key Summary Stats (No commissions) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">In-Force Policies</span>
            <p className="text-2xl font-black text-slate-900 mt-1">{activePolicies.length}</p>
            <p className="text-[11px] text-emerald-600 font-bold mt-0.5">● 100% Protected</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Shield size={24} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Upcoming Renewals</span>
            <p className="text-2xl font-black text-slate-900 mt-1">{upcoming.length}</p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Next 90 days</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Calendar size={24} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Active Claims</span>
            <p className="text-2xl font-black text-slate-900 mt-1">{pendingClaims.length}</p>
            <p className="text-[11px] text-amber-600 font-bold mt-0.5">
              {pendingClaims.length > 0 ? 'Under Processing' : 'All Settled'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <AlertCircle size={24} />
          </div>
        </div>
      </div>

      {/* 4. Main Two Column Views: Renewals & Dedicated Advisor Support */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Upcoming Renewals */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Calendar size={16} className="text-blue-600" />
                  Upcoming Renewals &amp; Premium Due
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">Timely payment ensures continuous coverage &amp; bonus</p>
              </div>
              <Link to="/client/policies" className="text-xs font-bold text-blue-600 hover:text-blue-700">
                View all →
              </Link>
            </div>

            <div className="divide-y divide-slate-50">
              {upcoming.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                  <p className="text-xs font-bold text-slate-800">All Coverages Up-to-Date</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">No premium payments due in the next 90 days.</p>
                </div>
              ) : (
                upcoming.map((p: any) => {
                  const days = differenceInDays(parseISO(p.nextDueDate), new Date());
                  return (
                    <div
                      key={p.id}
                      className="p-4 sm:px-5 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        {p.plan?.company?.logoUrl ? (
                          <img 
                            src={p.plan.company.logoUrl} 
                            alt={p.plan.company.name} 
                            className="w-10 h-10 rounded-xl object-contain bg-white border border-slate-100 p-1 shrink-0" 
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                            <Shield size={20} />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{p.policyNumber}</span>
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                              Active
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-medium">{p.plan?.name} · {p.plan?.company?.name}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                        <div className="text-left sm:text-right">
                          <p className="text-xs font-black text-slate-900">₹{Number(p.premiumAmount).toLocaleString('en-IN')}</p>
                          <p className={`text-[10px] font-bold ${days <= 7 ? 'text-rose-600' : 'text-amber-600'}`}>
                            {days === 0 ? 'Due Today' : `${days} days left`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => window.open(`https://wa.me/${agentPhone.replace(/[^0-9]/g, '')}?text=Hi%20${encodeURIComponent(agentName)},%20I%20would%20like%20to%20renew%20my%20policy%20${encodeURIComponent(p.policyNumber)}...`, '_blank')}
                          className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors cursor-pointer shrink-0"
                        >
                          Renew / Pay
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Claims Preview */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <AlertCircle size={16} className="text-amber-500" />
                  Recent Claims Status
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">Real-time tracking of filed intimations</p>
              </div>
              <Link to="/client/claims" className="text-xs font-bold text-blue-600 hover:text-blue-700">
                View all →
              </Link>
            </div>

            <div className="divide-y divide-slate-50">
              {claims.length === 0 ? (
                <p className="px-5 py-6 text-xs text-slate-400 text-center">No active or historic claims on record.</p>
              ) : (
                claims.slice(0, 3).map((c: any) => (
                  <div key={c.id} className="p-4 px-5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-900">{c.claimNumber}</p>
                      <p className="text-[11px] text-slate-500 font-medium">{c.policy?.policyNumber} · {c.claimType || 'CASHLESS'}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[10px] uppercase border ${STATUS_COLOR[c.status] || 'bg-slate-100 text-slate-700'}`}>
                        {c.status}
                      </span>
                      <p className="font-bold text-slate-900 mt-1">₹{Number(c.claimAmount || 0).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Assigned Insurance Advisor & Emergency Assistance */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <span className="text-xs font-extrabold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
              <User size={14} className="text-blue-600" /> Your Dedicated Advisor
            </span>

            <div className="flex items-center gap-3.5 pt-1">
              {agentPhoto ? (
                <img 
                  src={agentPhoto} 
                  alt={agentName} 
                  className="w-14 h-14 rounded-2xl object-cover border border-slate-100 shadow-xs" 
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-xs">
                  {agentName.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <h4 className="font-extrabold text-slate-900 text-base truncate">{agentName}</h4>
                <p className="text-xs text-blue-600 font-semibold">{agencyName}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Licensed Advisor</p>
              </div>
            </div>

            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Contact your advisor directly for policy endorsements, tax certificates, and emergency hospitalization support.
            </p>

            {/* Quick 1-Tap Call & WhatsApp */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  window.location.href = `tel:${agentPhone}`;
                  toast.success(`Calling ${agentName}...`);
                }}
                className="py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Phone size={14} /> Call Now
              </button>
              <button
                type="button"
                onClick={() => window.open(`https://wa.me/${agentPhone.replace(/[^0-9]/g, '')}?text=Hi%20${encodeURIComponent(agentName)},%20I%20need%20assistance%20with%20my%20insurance%20portfolio...`, '_blank')}
                className="py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <MessageSquare size={14} /> WhatsApp
              </button>
            </div>

            {agentEmail && (
              <a
                href={`mailto:${agentEmail}`}
                className="block text-center py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <Mail size={13} className="inline mr-1.5" /> {agentEmail}
              </a>
            )}
          </div>

          {/* Emergency Hospitalization / Claim Desk Card */}
          <div className="bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-100 rounded-2xl p-5 space-y-2">
            <h4 className="font-extrabold text-rose-900 text-xs uppercase tracking-wide flex items-center gap-1.5">
              <AlertCircle size={14} className="text-rose-600" /> Need Emergency Claim Support?
            </h4>
            <p className="text-xs text-rose-800/80 font-medium">
              In case of emergency hospitalization, intimate your advisor within 24 hours with the patient's admission slip for cashless assistance.
            </p>
            <button
              type="button"
              onClick={() => window.open(`https://wa.me/${agentPhone.replace(/[^0-9]/g, '')}?text=EMERGENCY%20HOSPITALIZATION%20INTIMATION:%20Please%20guide%20me%20for%20cashless%20claim...`, '_blank')}
              className="w-full mt-2 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              Intimate Emergency Claim
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
