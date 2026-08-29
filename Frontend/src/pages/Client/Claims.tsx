import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clientService } from '@api/client.service';
import { AlertCircle, Clock, CheckCircle2, Shield, Phone, MessageSquare, ArrowRight, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { FALLBACK_CLIENT_CLAIMS, FALLBACK_CLIENT_PROFILE } from './clientMockData';
import Modal from '@comps/common/Modal';
import { getClaimNotesData, ClaimDetailView } from '../Claims/index';
import toast from 'react-hot-toast';

const STATUS_COLOR: Record<string, string> = {
  INTIMATED:      'bg-amber-50 text-amber-700 border-amber-200',
  DOC_COLLECTION: 'bg-blue-50 text-blue-700 border-blue-200',
  FILED:          'bg-indigo-50 text-indigo-700 border-indigo-200',
  IN_REVIEW:      'bg-blue-50 text-blue-700 border-blue-200',
  APPROVED:       'bg-emerald-50 text-emerald-700 border-emerald-200',
  SETTLED:        'bg-green-50 text-green-700 border-green-200',
  REJECTED:       'bg-rose-50 text-rose-700 border-rose-200',
};

const STAGES = ['Intimated', 'Under Review', 'Approved', 'Settled'];

function fmt(d?: string | null) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd MMM yyyy'); } catch { return d; }
}

export default function ClientClaims() {
  const { data, isLoading } = useQuery({
    queryKey: ['client-claims'],
    queryFn:  clientService.getClaims,
  });

  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const rawClaims = data?.data;
  const claims = (rawClaims && rawClaims.length > 0) ? rawClaims : FALLBACK_CLIENT_CLAIMS;

  const advisor = FALLBACK_CLIENT_PROFILE.createdByUser;
  const agentPhone = advisor?.phone || '+91 98220 12345';

  if (isLoading && (!rawClaims || rawClaims.length === 0)) {
    return <div className="flex h-48 items-center justify-center text-slate-400">Loading claims status…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">My Claims &amp; Settlement Tracker</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Track real-time progress of cashless hospitalizations and reimbursement claims
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.open(`https://wa.me/${agentPhone.replace(/[^0-9]/g, '')}?text=Hi%20${encodeURIComponent(advisor?.firstName || 'Advisor')},%20I%20need%20help%20filing%20a%20new%20insurance%20claim...`, '_blank')}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
        >
          <MessageSquare size={14} /> Intimate New Claim
        </button>
      </div>

      {/* Claims List */}
      <div className="space-y-4">
        {claims.map((c: any) => {
          const notesData = getClaimNotesData(c.notes);
          const displayStatus = notesData.statusOverride || c.status;
          const isSettled = displayStatus === 'SETTLED' || displayStatus === 'APPROVED';

          return (
            <div
              key={c.id}
              onClick={() => { setSelectedClaim(c); setDetailOpen(true); }}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 hover:shadow-md hover:border-slate-200 cursor-pointer transition-all space-y-4 group"
            >
              {/* Top Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                    <FileText size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-extrabold text-slate-900 text-base group-hover:text-blue-600 transition-colors">
                        {c.claimNumber}
                      </p>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {c.claimType || 'CASHLESS'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Policy: {c.policy?.policyNumber} · {c.policy?.plan?.name || 'Comprehensive Coverage'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <span className={`text-[11px] font-black px-3 py-1 rounded-full uppercase border shrink-0 ${STATUS_COLOR[displayStatus] || 'bg-slate-100 text-slate-700'}`}>
                    {displayStatus.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Status Visual Tracker */}
              <div className="py-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1.5 px-1">
                  <span>Intimated ({fmt(c.intimatedAt)})</span>
                  <span>Document Audit</span>
                  <span>Approval</span>
                  <span className={isSettled ? 'text-emerald-600 font-extrabold' : ''}>Settlement</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      displayStatus === 'SETTLED' ? 'w-full bg-emerald-500' :
                      displayStatus === 'APPROVED' ? 'w-3/4 bg-blue-600' :
                      displayStatus === 'IN_REVIEW' || displayStatus === 'FILED' ? 'w-1/2 bg-blue-500' :
                      'w-1/4 bg-amber-500'
                    }`}
                  />
                </div>
              </div>

              {/* Amount Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Claim Amount</p>
                  <p className="font-extrabold text-slate-900 text-sm mt-0.5">₹{Number(c.claimAmount || 0).toLocaleString('en-IN')}</p>
                </div>
                {c.approvedAmount != null && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Approved Payout</p>
                    <p className="font-extrabold text-emerald-600 text-sm mt-0.5">₹{Number(c.approvedAmount).toLocaleString('en-IN')}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Hospitalization / Date</p>
                  <p className="font-medium text-slate-700 mt-0.5">{fmt(c.intimatedAt)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Settled / Closed</p>
                  <p className="font-medium text-slate-700 mt-0.5">{fmt(c.settledAt || c.settledDate) || 'In Progress'}</p>
                </div>
              </div>

              {/* Notes / Updates */}
              {c.notes && (
                <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-100 flex items-start gap-2">
                  <Clock size={14} className="text-slate-400 shrink-0 mt-0.5" />
                  <p className="font-medium">{c.notes}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* View-Only Claim Details Modal */}
      <Modal open={detailOpen} onClose={() => { setDetailOpen(false); setSelectedClaim(null); }} title="Claim Details & Tracking" size="xl">
        {selectedClaim ? (
          <ClaimDetailView claim={selectedClaim} />
        ) : null}
      </Modal>
    </div>
  );
}
