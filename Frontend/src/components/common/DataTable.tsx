import { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import clsx from 'clsx';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onSort?: (key: string, dir: 'asc' | 'desc') => void;
  loading?: boolean;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export default function DataTable<T>({
  columns,
  data,
  total = 0,
  page = 1,
  pageSize = 20,
  onPageChange,
  onSort,
  loading,
  rowKey,
  onRowClick,
  emptyMessage = 'No records found',
}: Props<T>) {
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (!onSort) return;
    const dir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc';
    setSortKey(key);
    setSortDir(dir);
    onSort(key, dir);
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="overflow-hidden bg-white rounded-2xl border border-slate-200/70 shadow-sm">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="min-w-full text-sm border-collapse">

          {/* ── Header ────────────────────────────────────────────────── */}
          <thead>
            <tr className="bg-gradient-to-r from-slate-100/90 via-slate-50 to-slate-100/90 border-b border-slate-200/80">
              {columns.map(col => (
                <th
                  key={String(col.key)}
                  className={clsx(
                    'px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-wider',
                    'text-slate-500 whitespace-nowrap select-none',
                    col.sortable && 'cursor-pointer hover:text-blue-600 transition-colors duration-150',
                    col.className,
                  )}
                  onClick={() => col.sortable && handleSort(String(col.key))}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {col.label}
                    {col.sortable && (
                      <span className="text-slate-400 transition-colors duration-150">
                        {sortKey === String(col.key)
                          ? sortDir === 'asc'
                            ? <ChevronUp size={12} className="text-blue-600 stroke-[2.5]" />
                            : <ChevronDown size={12} className="text-blue-600 stroke-[2.5]" />
                          : <ChevronUp size={12} className="opacity-30 hover:opacity-60" />
                        }
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {/* ── Body ──────────────────────────────────────────────────── */}
          <tbody className="divide-y divide-slate-100/80">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="even:bg-slate-50/30">
                    {columns.map(col => (
                      <td key={String(col.key)} className="px-5 py-4">
                        <div
                          className="h-3.5 rounded-full animate-pulse bg-slate-100"
                          style={{
                            width: `${55 + (i * 13 + col.label.length * 7) % 35}%`,
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              : data.length === 0
              ? (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-200/60 shadow-2xs">
                        <Inbox size={22} className="text-slate-400" />
                      </div>
                      <p className="text-xs font-bold text-slate-500">{emptyMessage}</p>
                    </div>
                  </td>
                </tr>
              )
              : data.map((row, idx) => (
                <tr
                  key={rowKey(row)}
                  onClick={() => onRowClick?.(row)}
                  className={clsx(
                    'transition-all duration-150',
                    idx % 2 === 1 ? 'bg-slate-50/20' : 'bg-white',
                    onRowClick
                      ? 'cursor-pointer hover:bg-blue-50/40 hover:shadow-2xs'
                      : 'hover:bg-slate-50/60',
                  )}
                >
                  {columns.map(col => (
                    <td
                      key={String(col.key)}
                      className={clsx('px-5 py-3.5 text-slate-700 align-middle text-xs font-medium', col.className)}
                    >
                      {col.render ? col.render(row) : String((row as any)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {/* ── Pagination ────────────────────────────────────────────────── */}
      {total > pageSize && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <p className="text-xs font-medium text-slate-500">
            Showing{' '}
            <span className="font-extrabold text-slate-800">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}</span>
            {' '}of{' '}
            <span className="font-extrabold text-slate-800">{total}</span> records
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 1}
              onClick={() => onPageChange?.(page - 1)}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-all shadow-2xs"
            >
              <ChevronLeft size={15} />
            </button>

            {/* Page numbers */}
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
              const pg = page <= 3
                ? i + 1
                : page >= totalPages - 2
                ? totalPages - 4 + i
                : page - 2 + i;
              if (pg < 1 || pg > totalPages) return null;
              return (
                <button
                  key={pg}
                  onClick={() => onPageChange?.(pg)}
                  className={clsx(
                    'min-w-[30px] h-7 px-2 rounded-lg text-xs font-extrabold transition-all border cursor-pointer',
                    pg === page
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 shadow-2xs',
                  )}
                >
                  {pg}
                </button>
              );
            })}

            <button
              disabled={page >= totalPages}
              onClick={() => onPageChange?.(page + 1)}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-all shadow-2xs"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
