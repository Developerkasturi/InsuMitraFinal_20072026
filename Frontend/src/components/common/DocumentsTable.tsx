import { CalendarDays, Download, Eye, FileText, MessageCircle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { documentsService } from '@api/index';
import toast from 'react-hot-toast';

interface Props {
  documents: any[];
  onView: (document: any) => void;
  onDelete: (document: any) => void;
  onShare?: (document: any) => void;
}

const formatBytes = (bytes?: number | null) => {
  if (bytes == null) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getDocumentName = (document: any) => {
  const name = document.originalName || document.fileName || document.originalname || document.name || document.title || 'Document';
  const extension = document.storageKey?.split('.').pop();
  if (/\.[a-z0-9]{1,8}$/i.test(name) || !extension || extension.includes('/')) return name;
  return `${name}.${extension}`;
};

const getDocumentType = (type?: string) => {
  const labels: Record<string, string> = {
    KYC: 'KYC',
    POLICY_DOCUMENT: 'POLICY',
    CLAIM_DOCUMENT: 'CLAIM',
    PREMIUM_RECEIPT: 'PREMIUM RECEIPT',
    OTHER: 'OTHER',
  };
  return labels[type || ''] || (type || 'DOCUMENT').replace(/_/g, ' ');
};

export default function DocumentsTable({ documents, onView, onDelete, onShare }: Props) {
  if (!documents.length) {
    return <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-400">No documents uploaded.</p>;
  }

  return (
    <div className="max-h-[55vh] overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            <th className="px-3 py-2.5">Uploaded Date</th>
            <th className="px-3 py-2.5">Document Name</th>
            <th className="px-3 py-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-xs">
          {documents.map(document => {
            const documentName = getDocumentName(document);
            const documentTitle = document.name || document.title || documentName;
            const extension = documentName.split('.').pop()?.toUpperCase() || 'FILE';
            const date = document.createdAt
              ? format(new Date(document.createdAt), 'dd MMM yyyy')
              : '—';
            const fileSize = formatBytes(document.sizeBytes);
            return (
              <tr key={document.id} className="transition-colors hover:bg-slate-50/80">
                <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={13} className="text-slate-400" />
                    {date}
                  </span>
                </td>
                <td className="min-w-[220px] px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 px-1 font-mono text-[9px] font-bold text-blue-600">
                      {extension.slice(0, 4)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-extrabold text-slate-800" title={documentName}>{documentName}</p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="truncate font-semibold text-slate-600" title={documentTitle}>{documentTitle}</span>
                        <span className="rounded border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-indigo-700">
                          {getDocumentType(document.type || document.tag)}
                        </span>
                        {fileSize && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">{fileSize}</span>}
                      </div>
                      {document.description && <p className="mt-0.5 truncate text-[10px] text-slate-500" title={document.description}>{document.description}</p>}
                    </div>
                    <FileText size={14} className="ml-auto hidden shrink-0 text-slate-300 sm:block" />
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {onShare && (
                      <button type="button" onClick={() => onShare(document)} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100" title="Share document">
                        <MessageCircle size={13} />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </button>
                    )}
                    <button type="button" onClick={() => onView(document)} className="rounded-lg border border-blue-100 bg-blue-50 p-1.5 text-blue-600 transition-colors hover:bg-blue-100" title="View document" aria-label={`View ${documentName}`}>
                      <Eye size={14} />
                    </button>
                    <button type="button" onClick={async () => {
                      try {
                        const response = await documentsService.url(document.id, true);
                        const url = response?.url || response?.data?.url || response?.data?.data?.url;
                        if (!url) throw new Error('No download URL was returned');
                        const link = globalThis.document.createElement('a');
                        link.href = url;
                        link.download = document.originalName || documentName;
                        link.rel = 'noopener noreferrer';
                        link.target = '_blank';
                        globalThis.document.body.appendChild(link);
                        link.click();
                        link.remove();
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : 'Unable to download document.');
                      }
                    }} className="rounded-lg border border-slate-200 bg-slate-100 p-1.5 text-slate-700 transition-colors hover:bg-slate-200" title="Download document" aria-label={`Download ${documentName}`}>
                      <Download size={14} />
                    </button>
                    <button type="button" onClick={() => onDelete(document)} className="rounded-lg border border-rose-100 bg-rose-50 p-1.5 text-rose-600 transition-colors hover:bg-rose-100" title="Delete document" aria-label={`Delete ${documentName}`}>
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
  );
}
