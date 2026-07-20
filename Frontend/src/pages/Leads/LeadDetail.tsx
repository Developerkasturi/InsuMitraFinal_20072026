import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsService } from '@api/index';
import { ArrowLeft, Edit2, ChevronRight } from 'lucide-react';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { cleanLeadPayload } from './index';

const STAGES = ['OPEN', 'CONTACTED', 'PROPOSAL_SENT', 'IN_DISCUSSION', 'LOGIN_PROGRESS', 'PAYMENT_DONE', 'LOST'];

const STAGE_LABELS: Record<string, string> = {
  OPEN: 'New', CONTACTED: 'Contacted', PROPOSAL_SENT: 'Proposal Sent',
  IN_DISCUSSION: 'In Discussion', LOGIN_PROGRESS: 'Login Progress',
  PAYMENT_DONE: 'Payment Done', LOST: 'Lost',
};

const STAGE_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700', CONTACTED: 'bg-indigo-100 text-indigo-700',
  PROPOSAL_SENT: 'bg-purple-100 text-purple-700', IN_DISCUSSION: 'bg-amber-100 text-amber-700',
  LOGIN_PROGRESS: 'bg-orange-100 text-orange-700', PAYMENT_DONE: 'bg-green-100 text-green-700',
  LOST: 'bg-red-100 text-red-700',
};

const editSchema = z.object({
  notes: z.string().optional(),
  sumAssuredRequired: z.coerce.number().positive().optional().or(z.literal('')),
  premiumBudget: z.coerce.number().positive().optional().or(z.literal('')),
  followUpDate: z.string().optional(),
  lostReason: z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [editModal, setEditModal] = useState(false);

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => leadsService.get(id!),
    enabled: !!id,
  });

  const { register, handleSubmit, reset, setValue } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  });

  const updateLead = useMutation({
    mutationFn: (body: any) => leadsService.update(id!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', id] });
      setEditModal(false);
      toast.success('Lead updated');
    },
    onError: (e: any, variables: any) => {
      const errs = e.response?.data?.errors;
      const msg = Array.isArray(errs) && errs.length > 0
        ? errs.join(', ')
        : (e.response?.data?.message ?? 'Failed to update lead');

      if (process.env.NODE_ENV !== 'production') {
        console.error('[Lead Detail Update Failed]', {
          payload: variables,
          status: e.response?.status,
          response: e.response?.data,
        });
      }
      toast.error(msg);
    },
  });

  const moveStage = useMutation({
    mutationFn: (stage: string) => leadsService.moveStage(id!, stage),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', id] });
      toast.success('Stage updated');
    },
    onError: () => toast.error('Failed to move stage'),
  });

  const openEdit = () => {
    const l = lead?.data ?? lead;
    setValue('notes', l?.notes ?? '');
    setValue('sumAssuredRequired', l?.sumAssuredRequired ?? '');
    setValue('premiumBudget', l?.premiumBudget ?? '');
    setValue('followUpDate', l?.followUpDate ? l.followUpDate.slice(0, 10) : '');
    setValue('lostReason', l?.lostReason ?? '');
    setEditModal(true);
  };

  if (isLoading) return <div className="flex h-48 items-center justify-center text-gray-400">Loading…</div>;

  const l = lead?.data ?? lead;
  if (!l) return <div className="text-gray-500 p-8">Lead not found.</div>;

  // Normalize CONTACTED to OPEN for visual progress bar matching Contacted stage
  if (l.stage === 'CONTACTED') {
    l.stage = 'OPEN';
  }

  const currentIdx = STAGES.indexOf(l.stage);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">
              {l.contact?.firstName} {l.contact?.lastName}
            </h2>
            <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', STAGE_COLORS[l.stage] ?? 'bg-gray-100 text-gray-700')}>
              {STAGE_LABELS[l.stage] ?? l.stage}
            </span>
          </div>
          {l.plan && <p className="text-sm text-gray-500 mt-0.5">{l.plan.name} · {l.plan.company?.name}</p>}
        </div>
        <button onClick={openEdit} className="btn-secondary flex items-center gap-1"><Edit2 size={14}/>Edit</button>
      </div>

      {/* Stage Pipeline */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Stage Pipeline</h3>
        <div className="flex items-center gap-1 flex-wrap">
          {STAGES.map((s, idx) => (
            <div key={s} className="flex items-center">
              <button
                onClick={() => s !== l.stage && moveStage.mutate(s)}
                disabled={moveStage.isPending || s === l.stage}
                className={clsx(
                  'text-xs px-3 py-1.5 rounded-full font-medium transition-all',
                  s === l.stage
                    ? clsx(STAGE_COLORS[s], 'ring-2 ring-offset-1 ring-current cursor-default')
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 cursor-pointer',
                )}>
                {STAGE_LABELS[s]}
              </button>
              {idx < STAGES.length - 1 && <ChevronRight size={12} className="text-gray-300 mx-0.5 shrink-0" />}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">Click any stage to move this lead there.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Details */}
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Lead Details</h3>
          {l.sumAssuredRequired && (
            <InfoRow label="Sum Assured Required" value={`₹${Number(l.sumAssuredRequired).toLocaleString('en-IN')}`} />
          )}
          {l.premiumBudget && (
            <InfoRow label="Premium Budget" value={`₹${Number(l.premiumBudget).toLocaleString('en-IN')}`} />
          )}
          {l.followUpDate && (
            <InfoRow label="Follow-up Date" value={format(new Date(l.followUpDate), 'dd/MMM/yyyy')} />
          )}
          {l.lostReason && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg p-2">
              <span className="font-medium">Lost reason: </span>{l.lostReason}
            </div>
          )}
          {l.notes && (
            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2">{l.notes}</div>
          )}
          <InfoRow label="Created" value={l.createdAt ? format(new Date(l.createdAt), 'dd/MMM/yyyy') : '—'} />
        </div>

        {/* Contact & Plan */}
        <div className="space-y-4">
          {l.contact && (
            <div className="card space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">Contact</h3>
              <Link to={`/contacts/${l.contact.id ?? l.contactId}`}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 text-sm">
                <div>
                  <p className="font-medium text-gray-900">{l.contact.firstName} {l.contact.lastName}</p>
                  <p className="text-xs text-gray-400">{l.contact.phone}</p>
                </div>
                <span className="text-primary-600 text-xs">View →</span>
              </Link>
            </div>
          )}
          {l.plan && (
            <div className="card space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">Insurance Plan</h3>
              <p className="text-sm font-medium text-gray-900">{l.plan.name}</p>
              <p className="text-xs text-gray-400">{l.plan.company?.name} · {l.plan.category}</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Lead" size="xl">
        <form onSubmit={handleSubmit(body => {
          const lData = lead?.data ?? lead;
          const cleaned = cleanLeadPayload({
            ...body,
            contactId: lData?.contactId ?? lData?.contact?.id,
          });
          updateLead.mutate(cleaned);
        })} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Sum Assured Required (₹)</label>
              <input {...register('sumAssuredRequired')} type="number" className="input" min="0" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Premium Budget (₹)</label>
              <input {...register('premiumBudget')} type="number" className="input" min="0" />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="label">Follow-up Date</label>
            <input {...register('followUpDate')} type="date" className="input" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="label">Lost Reason</label>
            <input {...register('lostReason')} className="input" placeholder="If lost" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="label">Notes</label>
            <textarea {...register('notes')} className="input" rows={3} />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 mt-6">
            <button type="button" className="btn-secondary" onClick={() => setEditModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={updateLead.isPending}>
              {updateLead.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-800 font-medium">{value ?? '—'}</span>
    </div>
  );
}
