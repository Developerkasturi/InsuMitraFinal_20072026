import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { claimsService, documentsService } from '@api/index';
import { ArrowLeft, Upload, FileText, Trash2, Plus, DollarSign, MessageCircle, Building2, MapPin, Shield, CreditCard } from 'lucide-react';
import Modal from '@comps/common/Modal';
import { useState } from 'react';
import DocumentUploadModal, { DocumentUploadMeta } from '@comps/common/DocumentUploadModal';
import DocumentsTable from '@comps/common/DocumentsTable';
import clsx from 'clsx';
import ClaimPolicyDetailsTab from './components/ClaimPolicyDetailsTab';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useLookupStore } from '@store/lookup.store';
import { getClaimNotesData, serializeNotes } from './index';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAddClaimExpense, useRemoveClaimExpense } from '@hooks/useClaims';
import { useAuthStore } from '@store/auth.store';
import { DatePicker } from '@comps/common/DatePicker';
import { deletionRequestsService } from '@api/deletionRequestsService';

const STATUS_BADGE: Record<string, string> = {
  INTIMATED: 'badge-yellow',
  DOC_COLLECTION: 'badge-blue',
  FILED: 'badge-blue',
  IN_REVIEW: 'badge-blue',
  APPROVED: 'badge-green',
  SETTLED: 'badge-green',
  REJECTED: 'badge-red',
};

const DISPLAY_STATUS_FLOW = ['INTIMATED', 'DOC_COLLECTION', 'FILED', 'IN_REVIEW', 'APPROVED', 'SETTLED', 'REJECTED'];

const expenseSchema = z.object({
  description: z.string().min(1, 'Description required'),
  amount: z.coerce.number().positive('Enter a valid amount'),
  category: z.enum(['HOSPITALIZATION', 'MEDICINES', 'LABORATORY', 'AMBULANCE', 'OTHER']),
  date: z.string().min(1, 'Date required'),
});
type ExpenseForm = z.infer<typeof expenseSchema>;

export default function ClaimDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user: authUser } = useAuthStore();

  // Lookup store
  const employees = useLookupStore(s => s.employees);

  const [uploadModal, setUploadModal] = useState(false);
  const [statusModal, setStatusModal] = useState(false);
  const [expenseModal, setExpenseModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [deleteDocTarget, setDeleteDocTarget] = useState<any | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'claim' | 'policy' | 'hospital' | 'expenses'>('claim');

  const { data: claim, isLoading } = useQuery({
    queryKey: ['claim', id],
    queryFn: () => claimsService.get(id!),
    enabled: !!id,
  });

  const { data: documents, refetch: refetchDocs } = useQuery({
    queryKey: ['claim-docs', id],
    queryFn: () => documentsService.list({ claimId: id }),
    enabled: !!id,
  });

  const updateStatus = useMutation({
    // Direct status update
    mutationFn: ({ status, ...rest }: any) => {
      return claimsService.updateStatus(id!, {
        status: status,
        approvedAmount: rest.approvedAmount ? Number(rest.approvedAmount) : undefined,
        rejectionReason: rest.rejectionReason || undefined,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['claim', id] }); setStatusModal(false); toast.success('Status updated'); },
    onError: () => toast.error('Failed to update status'),
  });

  const addExpense = useAddClaimExpense(id!);
  const removeExpense = useRemoveClaimExpense(id!);

  const expenseForm = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { category: 'HOSPITALIZATION', date: format(new Date(), 'yyyy-MM-dd') },
  });

  const removeDoc = useMutation({
    // Document removal
    mutationFn: (docId: string) => documentsService.remove(docId),
    onSuccess: () => { refetchDocs(); toast.success('Document removed'); },
    onError: () => toast.error('Failed to remove document'),
  });

  const handleUpload = async (file: File, meta: DocumentUploadMeta) => {
    try {
      await documentsService.upload(file, { claimId: id!, ...meta });
      await refetchDocs();
      setUploadModal(false);
      toast.success('Document uploaded');
      return true;
    } catch {
      toast.error('Upload failed');
      return false;
    }
  };

  const viewDoc = async (docId: string) => {
    try {
      const res = await documentsService.url(docId);
      const url = res?.url || res?.data?.url || res?.data?.data?.url;
      if (!url) throw new Error('No document URL was returned');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Could not load document URL');
    }
  };

  const openStatusModal = () => {
    const cl = claim?.data ?? claim;
    setNewStatus(cl?.status || '');
    setApprovedAmount(cl?.approvedAmount ? String(cl.approvedAmount) : '');
    setRejectionReason(cl?.rejectionReason ?? '');
    setStatusModal(true);
  };

  const onExpenseSubmit = async (data: ExpenseForm) => {
    try {
      await addExpense.mutateAsync(data);
      setExpenseModal(false);
      expenseForm.reset({ category: 'HOSPITALIZATION', date: format(new Date(), 'yyyy-MM-dd'), description: '', amount: undefined });
    } catch {
      // toast shown by hook
    }
  };

  if (isLoading) return <div className="flex h-48 items-center justify-center text-gray-400">Loading…</div>;

  const cl = claim?.data ?? claim;
  if (!cl) return <div className="text-gray-500 p-8">Claim not found.</div>;

  const docList: any[] = Array.isArray(documents?.data?.data)
    ? documents.data.data
    : Array.isArray(documents?.data)
      ? documents.data
      : Array.isArray(documents)
        ? documents
        : [];
  const notesData = getClaimNotesData(cl.notes);
  const displayStatus = cl.status;

  const parsedDoctors: any[] = (() => {
    try {
      const list = JSON.parse(notesData.hospitalDoctors || '[]');
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  })();

  const emp = employees.find(e => e.userId === cl.assignedEmployeeId);
  const assigneeName = emp ? `${emp.firstName} ${emp.lastName}` : 'Unassigned';

  // Expense Calculations
  const expensesList: any[] = cl.expenses ?? [];
  const getSubtotal = (cat: string) =>
    expensesList.filter(e => e.category === cat).reduce((sum, e) => sum + (e.amount || 0), 0);

  const hospitalizationTotal = getSubtotal('HOSPITALIZATION');
  const medicinesTotal = getSubtotal('MEDICINES');
  const laboratoryTotal = getSubtotal('LABORATORY');
  const ambulanceTotal = getSubtotal('AMBULANCE');
  const otherTotal = getSubtotal('OTHER');
  const overallTotal = expensesList.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">{cl.claimNumber}</h2>
            <span className={STATUS_BADGE[displayStatus] ?? 'badge-gray'}>{displayStatus.replace('_', ' ')}</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {cl.claimType} claim · Policy: {cl.policy?.policyNumber}
          </p>
        </div>
        <button onClick={openStatusModal} className="btn-primary">Update Status</button>
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex bg-slate-200/60 p-1.5 rounded-2xl gap-2 border border-slate-200/80 overflow-x-auto shadow-2xs">
        {[
          { id: 'claim', label: 'Claim Details', icon: FileText },
          { id: 'policy', label: 'Policy Details', icon: Shield },
          { id: 'hospital', label: 'Hospital & Medical', icon: Building2 },
          { id: 'expenses', label: 'Expenses & Documents', icon: CreditCard },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveDetailTab(t.id as any)}
              className={clsx(
                'px-5 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap flex items-center gap-2',
                activeDetailTab === t.id
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              )}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {activeDetailTab === 'policy' && (
        <ClaimPolicyDetailsTab
          policy={cl.policy}
          policyId={cl.policy?.id || cl.policyId}
          contact={cl.contact}
          onGoToClaimTab={() => setActiveDetailTab('claim')}
        />
      )}

      {activeDetailTab !== 'policy' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Claim Details */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Claim Details</h3>
            <InfoRow label="Claim Number" value={cl.claimNumber} />
            <InfoRow label="Type" value={cl.claimType} />
            <InfoRow label="Diagnosis" value={notesData.diagnosis || '—'} />
            <InfoRow label="Hospital" value={notesData.hospital || '—'} />
            <InfoRow label="Admission Date" value={notesData.admissionAt ? format(new Date(notesData.admissionAt), 'dd/MMM/yyyy') : '—'} />
            <InfoRow label="Discharge Date" value={notesData.dischargeAt ? format(new Date(notesData.dischargeAt), 'dd/MMM/yyyy') : '—'} />
            <InfoRow label="Claim Amount" value={`₹${Number(cl.claimAmount).toLocaleString('en-IN')}`} />
            <InfoRow label="Approved Amount" value={cl.approvedAmount ? `₹${Number(cl.approvedAmount).toLocaleString('en-IN')}` : '—'} />
            <InfoRow label="Intimated At" value={cl.intimatedAt ? format(new Date(cl.intimatedAt), 'dd/MMM/yyyy') : '—'} />
            <InfoRow label="Assignee" value={assigneeName} />
            {cl.rejectionReason && (
              <div className="mt-2 text-sm text-red-600 bg-red-50 rounded-lg p-2">
                <span className="font-medium">Rejection reason: </span>{cl.rejectionReason}
              </div>
            )}
            {notesData.notes && (
              <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2">
                <span className="font-medium text-gray-700">Notes: </span>{notesData.notes}
              </div>
            )}
          </div>

          {/* People & Policy Links */}
          <div className="card space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Contact &amp; Policy</h3>
            {cl.contact && (
              <Link to={`/contacts/${cl.contact.id ?? cl.contactId}`}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 text-sm">
                <span className="font-medium text-gray-900">{cl.contact.firstName} {cl.contact.lastName}</span>
                <span className="text-primary-600 text-xs">View Contact →</span>
              </Link>
            )}
            {cl.policy && (
              <div className="space-y-1.5 pt-1">
                <Link to={`/policies/${cl.policy.id ?? cl.policyId}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-55 text-sm">
                  <span className="font-medium text-gray-900">{cl.policy.policyNumber}</span>
                  <span className="text-primary-600 text-xs">View Policy Page →</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setActiveDetailTab('policy')}
                  className="w-full py-1.5 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-1.5"><Shield size={12} /> Open Policy Details Tab</span>
                  <span>→</span>
                </button>
              </div>
            )}
          </div>

          {/* Lifecycle Status flow visualization */}
          <div className="card space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Status Flow</h3>
            <div className="flex flex-wrap gap-2">
              {DISPLAY_STATUS_FLOW.map(s => (
                <span key={s}
                  className={`text-xs px-2 py-1 rounded-full border ${s === displayStatus
                    ? 'bg-primary-100 text-primary-700 border-primary-300 font-semibold'
                    : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                  {s.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Expenses Breakdown & Documents */}
        <div className="lg:col-span-2 space-y-4">

          {/* Hospital & Medical Team Card */}
          {(notesData.hospitalName || notesData.hospital || parsedDoctors.length > 0) && (
            <div className="card space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <Building2 size={16} className="text-blue-600" /> Hospital &amp; Medical Team
                </h3>
                {notesData.hospitalType && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    {notesData.hospitalType}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Hospital Name</span>
                  <span className="font-bold text-slate-800 text-sm">{notesData.hospitalName || notesData.hospital || '—'}</span>
                  {notesData.hospitalRating && (
                    <span className="inline-block mt-0.5 ml-1 text-[10px] text-amber-700 font-semibold">
                      ⭐ {notesData.hospitalRating}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Location</span>
                  <span className="text-slate-700 font-medium">
                    {[notesData.hospitalAddress, notesData.hospitalCity, notesData.hospitalState, notesData.hospitalPincode].filter(Boolean).join(', ') || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Hospital Contact</span>
                  <span className="text-slate-700 font-medium">{notesData.hospitalContactNo || '—'}</span>
                </div>
                {(notesData.claimsPerson1Name || notesData.claimsPerson1Contact) && (
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Claims Dept Person 1</span>
                    <span className="text-slate-700 font-medium">
                      {notesData.claimsPerson1Name} {notesData.claimsPerson1Contact ? `(${notesData.claimsPerson1Contact})` : ''}
                    </span>
                  </div>
                )}
                {(notesData.claimsPerson2Name || notesData.claimsPerson2Contact) && (
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Claims Dept Person 2</span>
                    <span className="text-slate-700 font-medium">
                      {notesData.claimsPerson2Name} {notesData.claimsPerson2Contact ? `(${notesData.claimsPerson2Contact})` : ''}
                    </span>
                  </div>
                )}
              </div>

              {parsedDoctors.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block mb-2">Consulting Doctors ({parsedDoctors.length})</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {parsedDoctors.map((doc: any, i: number) => (
                      <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                        <div className="font-bold text-slate-800 flex items-center justify-between text-xs">
                          <span>{doc.name || 'Doctor'}</span>
                          {doc.degree && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">{doc.degree}</span>}
                        </div>
                        {doc.speciality && <div className="text-[11px] text-slate-500 mt-0.5">{doc.speciality}</div>}
                        {doc.contactNo && <div className="text-[10px] text-slate-400 mt-1">📞 {doc.contactNo}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Expense Breakdown Card */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 flex flex-wrap items-center gap-1.5">
                <DollarSign size={14} /> Expense Breakdown
              </h3>
              <button onClick={() => setExpenseModal(true)} className="btn-sm btn-primary flex flex-wrap items-center gap-1">
                <Plus size={12} /> Record Expense
              </button>
            </div>

            {/* Categorized Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 gap-2 bg-gray-50/50 p-3 rounded-lg text-xs font-medium">
              <div className="p-2 border border-gray-100 rounded bg-white">
                <span className="text-gray-400">Hospitalization</span>
                <p className="text-sm font-bold text-gray-800 mt-0.5">₹{hospitalizationTotal.toLocaleString('en-IN')}</p>
              </div>
              <div className="p-2 border border-gray-100 rounded bg-white">
                <span className="text-gray-400">Medicines</span>
                <p className="text-sm font-bold text-gray-800 mt-0.5">₹{medicinesTotal.toLocaleString('en-IN')}</p>
              </div>
              <div className="p-2 border border-gray-100 rounded bg-white">
                <span className="text-gray-400">Laboratory</span>
                <p className="text-sm font-bold text-gray-800 mt-0.5">₹{laboratoryTotal.toLocaleString('en-IN')}</p>
              </div>
              <div className="p-2 border border-gray-100 rounded bg-white">
                <span className="text-gray-400">Ambulance</span>
                <p className="text-sm font-bold text-gray-800 mt-0.5">₹{ambulanceTotal.toLocaleString('en-IN')}</p>
              </div>
              <div className="p-2 border border-gray-100 rounded bg-white">
                <span className="text-gray-400">Other Expenses</span>
                <p className="text-sm font-bold text-gray-800 mt-0.5">₹{otherTotal.toLocaleString('en-IN')}</p>
              </div>
              <div className="p-2 border border-blue-100 rounded bg-blue-50/50">
                <span className="text-blue-500 font-semibold">Total Expenses</span>
                <p className="text-sm font-bold text-blue-700 mt-0.5">₹{overallTotal.toLocaleString('en-IN')}</p>
              </div>
            </div>

            {/* Individual expenses list */}
            {expensesList.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No expenses recorded for this claim.</p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {expensesList.map((exp: any) => (
                  <div key={exp.id} className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 group text-sm">
                    <div>
                      <p className="font-semibold text-gray-900">{exp.description}</p>
                      <p className="text-xs text-gray-400">
                        {exp.category} · {exp.date ? format(new Date(exp.date), 'dd/MMM/yyyy') : '—'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-gray-800">₹{Number(exp.amount).toLocaleString('en-IN')}</span>
                      <button onClick={() => removeExpense.mutate(exp.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-400 transition-opacity">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documents Card */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 flex flex-wrap items-center gap-1.5">
                <FileText size={14} /> Documents
              </h3>
              <button type="button" onClick={() => setUploadModal(true)} className="btn-sm btn-primary flex flex-wrap items-center gap-1">
                <Upload size={12} /> Upload Document
              </button>
            </div>
            <DocumentsTable
              documents={docList}
              onView={doc => viewDoc(doc.id)}
              onDelete={setDeleteDocTarget}
              onShare={async doc => {
                const phone = cl.proposerPhone || cl.patientPhone || cl.contact?.phone || '';
                const message = `Hi, here is the document: ${doc.name || doc.originalName || 'Document'}`;
                const phoneParam = phone ? `phone=${encodeURIComponent(phone)}&` : '';
                window.open(`https://api.whatsapp.com/send?${phoneParam}text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
              }}
            />
          </div>
        </div>
      </div>
      )}

      {/* Record Expense Modal */}
      <Modal open={expenseModal} onClose={() => setExpenseModal(false)} title="Record Claim Expense">
        <form onSubmit={expenseForm.handleSubmit(onExpenseSubmit)} className="space-y-3">
          <div>
            <label className="label">Description *</label>
            <input {...expenseForm.register('description')} className="input" placeholder="e.g. ICU Room Charges" />
            {expenseForm.formState.errors.description && <p className="text-xs text-red-500 mt-0.5">{expenseForm.formState.errors.description.message}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Amount (₹) *</label>
              <input {...expenseForm.register('amount')} type="number" className="input" placeholder="15000" />
              {expenseForm.formState.errors.amount && <p className="text-xs text-red-500 mt-0.5">{expenseForm.formState.errors.amount.message}</p>}
            </div>
            <div>
              <label className="label">Expense Category</label>
              <select {...expenseForm.register('category')} className="input">
                <option value="HOSPITALIZATION">Hospitalization</option>
                <option value="MEDICINES">Medicines</option>
                <option value="LABORATORY">Laboratory</option>
                <option value="AMBULANCE">Ambulance</option>
                <option value="OTHER">Other Expenses</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Date *</label>
            <DatePicker {...expenseForm.register('date')} className="input" />
            {expenseForm.formState.errors.date && <p className="text-xs text-red-500 mt-0.5">{expenseForm.formState.errors.date.message}</p>}
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setExpenseModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={addExpense.isPending}>
              {addExpense.isPending ? 'Recording…' : 'Record Expense'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Update Status Modal */}
      <Modal open={statusModal} onClose={() => setStatusModal(false)} title="Update Claim Status">
        <div className="space-y-4">
          <div>
            <label className="label">New Status</label>
            <select className="input" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
              {DISPLAY_STATUS_FLOW.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          {(newStatus === 'APPROVED' || newStatus === 'SETTLED') && (
            <div>
              <label className="label">Approved Amount (₹)</label>
              <input type="number" className="input" value={approvedAmount} onChange={e => setApprovedAmount(e.target.value)} placeholder="Enter approved amount" />
            </div>
          )}
          {newStatus === 'REJECTED' && (
            <div>
              <label className="label">Rejection Reason</label>
              <textarea className="input" rows={2} value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} />
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button className="btn-secondary" onClick={() => setStatusModal(false)}>Cancel</button>
            <button className="btn-primary" disabled={updateStatus.isPending}
              onClick={() => updateStatus.mutate({
                status: newStatus,
                ...(approvedAmount ? { approvedAmount: Number(approvedAmount) } : {}),
                ...(rejectionReason ? { rejectionReason } : {}),
              })}>
              {updateStatus.isPending ? 'Saving…' : 'Update'}
            </button>
          </div>
        </div>
      </Modal>

      <DocumentUploadModal
        open={uploadModal}
        onClose={() => setUploadModal(false)}
        onUpload={handleUpload}
        title="Upload Claim Document"
        subtitle="Attach supporting documents to this claim."
        defaultType="CLAIM"
        types={[
          { value: 'CLAIM', label: 'Claim Document' },
          { value: 'DISCHARGE_VOUCHER', label: 'Discharge Voucher' },
          { value: 'MEDICAL_REPORT', label: 'Medical Report' },
          { value: 'ID_PROOF', label: 'ID Proof' },
          { value: 'OTHER', label: 'Other' },
        ]}
      />

      <Modal open={!!deleteDocTarget} onClose={() => setDeleteDocTarget(null)} title="Delete Document" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Delete <strong>{deleteDocTarget?.fileName ?? deleteDocTarget?.originalName ?? 'this document'}</strong>?
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDeleteDocTarget(null)}>Cancel</button>
          <button
            className="btn-danger"
            disabled={removeDoc.isPending}
            onClick={async () => {
              const isAdmin = authUser?.role === 'SUPERADMIN' || authUser?.role === 'OWNER';
              if (isAdmin) {
                await removeDoc.mutateAsync(deleteDocTarget!.id);
              } else {
                const toastId = toast.loading('Submitting delete request to admin...');
                try {
                  await deletionRequestsService.requestDeletion('Document', deleteDocTarget!.id, `Employee requested deletion of document ${deleteDocTarget?.fileName}`);
                  toast.success('Deletion request submitted to admin successfully!', { id: toastId });
                } catch (err: any) {
                  toast.error(err.response?.data?.message || 'Failed to submit request', { id: toastId });
                }
              }
              setDeleteDocTarget(null);
            }}
          >
            {removeDoc.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-800 font-medium text-right">{value ?? '—'}</span>
    </div>
  );
}
