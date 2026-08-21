import React, { useState } from 'react';
import {
  Clock, Search, CheckCheck, XCircle, SkipForward,
  AlertCircle, Download, Sparkles, RefreshCw, Phone,
  FileText, ArrowRight, ShieldCheck, Check, AlertTriangle
} from 'lucide-react';
import { MOCK_WHATSAPP_DATA } from '../mockData';
import toast from 'react-hot-toast';

export default function HistoryTab() {
  const [history, setHistory] = useState(MOCK_WHATSAPP_DATA.history);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DELIVERED_READ' | 'FAILED' | 'SKIPPED'>('ALL');
  const [retryingIds, setRetryingIds] = useState<Record<string, boolean>>({});

  const filtered = history.filter(h => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = h.customer.toLowerCase().includes(q) ||
      h.source.toLowerCase().includes(q) ||
      h.template.toLowerCase().includes(q) ||
      (h.errorCode && h.errorCode.includes(q));

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'DELIVERED_READ' && (h.status === 'READ' || h.status === 'DELIVERED')) ||
      (statusFilter === 'FAILED' && h.status === 'FAILED') ||
      (statusFilter === 'SKIPPED' && h.status === 'SKIPPED');

    return matchesSearch && matchesStatus;
  });

  const handleRetrySingle = (id: string, customer: string) => {
    setRetryingIds(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setHistory(prev => prev.map(item => {
        if (item.id === id) {
          return {
            ...item,
            status: 'DELIVERED',
            sent: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            errorCode: null,
            errorCategory: null,
            canRetry: false,
            detail: 'Queue Retry Succeeded ✓ Delivered to recipient device.',
          };
        }
        return item;
      }));
      setRetryingIds(prev => ({ ...prev, [id]: false }));
      toast.success(`Message to ${customer} re-queued and delivered successfully!`);
    }, 1200);
  };

  const handleRetryAllFailed = () => {
    const failedItems = history.filter(h => h.status === 'FAILED');
    if (failedItems.length === 0) {
      toast('No failed messages to retry');
      return;
    }

    toast.loading('Retrying failed message queue...');
    setTimeout(() => {
      setHistory(prev => prev.map(item => {
        if (item.status === 'FAILED') {
          return {
            ...item,
            status: 'DELIVERED',
            sent: 'Just now',
            errorCode: null,
            errorCategory: null,
            canRetry: false,
            detail: 'Bulk Queue Retry Succeeded ✓ Delivered via Meta Cloud API.',
          };
        }
        return item;
      }));
      toast.dismiss();
      toast.success(`Successfully retried ${failedItems.length} failed messages!`);
    }, 1500);
  };

  const failedCount = history.filter(h => h.status === 'FAILED').length;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-slate-800">WhatsApp Message History &amp; Audit Trail</h3>
            <span className="text-[11px] font-bold text-slate-400 font-mono">
              ({history.length} Logged Dispatches)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time Meta delivery receipts, failure diagnosis, auto-stop justifications &amp; CRM lead milestones
          </p>
        </div>

        <div className="flex items-center gap-2">
          {failedCount > 0 && (
            <button
              onClick={handleRetryAllFailed}
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>Bulk Retry {failedCount} Failed</span>
            </button>
          )}

          <button
            onClick={() => toast.success('Exporting message audit trail CSV...')}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Download size={14} /> Export CSV Audit
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">

        {/* Status Filters */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {[
            { key: 'ALL', label: 'All Logs' },
            { key: 'DELIVERED_READ', label: '✓ Delivered & Read' },
            { key: 'FAILED', label: `✕ Failed (${failedCount})` },
            { key: 'SKIPPED', label: '⏭ Auto-Skipped' },
          ].map(st => (
            <button
              key={st.key}
              onClick={() => setStatusFilter(st.key as any)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${statusFilter === st.key
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer, template, error code..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
          />
        </div>

      </div>

      {/* History Table */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Recipient</th>
                <th className="py-3.5 px-4">Origin / Pipeline</th>
                <th className="py-3.5 px-4">Template Used</th>
                <th className="py-3.5 px-4">Scheduled &amp; Sent</th>
                <th className="py-3.5 px-4">Meta Status</th>
                <th className="py-3.5 px-4">Delivery Audit &amp; Error Diagnosis</th>
                <th className="py-3.5 px-4 text-right">Retry Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.map((h) => {
                const isRead = h.status === 'READ';
                const isDelivered = h.status === 'DELIVERED';
                const isSkipped = h.status === 'SKIPPED';
                const isFailed = h.status === 'FAILED';
                const isRetrying = !!retryingIds[h.id];

                return (
                  <tr
                    key={h.id}
                    className={`hover:bg-slate-50/80 transition-colors ${isSkipped ? 'bg-amber-50/20' : isFailed ? 'bg-rose-50/30' : ''
                      }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-slate-800">{h.customer}</div>
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                        <Phone size={10} /> {h.phone || '+91 98XXX XXXXX'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-700">{h.source}</div>
                      <div className="text-[10px] text-slate-400">{h.type}</div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="font-medium">{h.template}</div>
                      {h.templateId && (
                        <div className="text-[9px] font-mono text-purple-600">{h.templateId}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      <div>{h.scheduled}</div>
                      <div className="text-[10px] text-slate-400">{h.sent ? `Sent: ${h.sent}` : 'Not Sent'}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      {isRead && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCheck size={12} /> Read
                        </span>
                      )}
                      {isDelivered && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                          <CheckCheck size={12} /> Delivered
                        </span>
                      )}
                      {isSkipped && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <SkipForward size={12} /> Skipped
                        </span>
                      )}
                      {isFailed && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle size={12} /> Failed
                        </span>
                      )}
                    </td>

                    {/* Audit detail & error code breakdown */}
                    <td className="py-3.5 px-4 text-slate-600">
                      {h.errorCode && (
                        <div className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-rose-100 text-rose-800 font-mono text-[10px] font-bold rounded mr-1.5 mb-1">
                          Meta {h.errorCode}
                        </div>
                      )}
                      {h.detail.includes('Converted to Lead') ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <Sparkles size={12} className="text-emerald-600" />
                          {h.detail}
                        </span>
                      ) : (
                        <span className={isFailed ? 'text-rose-700 font-medium' : isSkipped ? 'text-amber-800' : ''}>
                          {h.detail}
                        </span>
                      )}
                    </td>

                    {/* Actionable Retry Button */}
                    <td className="py-3.5 px-4 text-right">
                      {isFailed && (
                        <button
                          disabled={isRetrying}
                          onClick={() => handleRetrySingle(h.id, h.customer)}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] border border-rose-200 flex items-center gap-1 transition-all cursor-pointer ml-auto disabled:opacity-50"
                        >
                          <RefreshCw size={11} className={isRetrying ? 'animate-spin' : ''} />
                          <span>{isRetrying ? 'Retrying...' : 'Retry'}</span>
                        </button>
                      )}
                      {(isRead || isDelivered) && (
                        <span className="text-[10px] text-slate-400 font-medium">—</span>
                      )}
                      {isSkipped && (
                        <span className="text-[10px] text-amber-600 font-medium">Auto-Stopped</span>
                      )}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
