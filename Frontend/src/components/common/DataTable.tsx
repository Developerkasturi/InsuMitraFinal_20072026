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
    <div className="overflow-hidden bg-white rounded-2xl border border-slate-100 shadow-sm">

      <div className="overflow-x-auto custom-scrollbar">
        <table className="min-w-full text-sm">

          {/* ── Header ────────────────────────────────────────────────── */}
          <thead>
            <tr className="bg-slate-100/60 border-b border-slate-200/80">
              {columns.map(col => (
                <th
                  key={String(col.key)}
                  className={clsx(
                    'px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider',
                    'text-slate-700 whitespace-nowrap',
                    col.sortable && 'cursor-pointer select-none hover:text-slate-700 transition-colors duration-100',
                    col.className,
                  )}
                  onClick={() => col.sortable && handleSort(String(col.key))}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      <span className="text-slate-400 transition-colors duration-100">
                        {sortKey === String(col.key)
                          ? sortDir === 'asc'
                            ? <ChevronUp size={11} className="text-blue-500" />
                            : <ChevronDown size={11} className="text-blue-500" />
                          : <ChevronUp size={11} className="opacity-25" />
                        }
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {/* ── Body ──────────────────────────────────────────────────── */}
          <tbody className="divide-y divide-slate-100/60">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {columns.map(col => (
                      <td key={String(col.key)} className="px-5 py-4">
                        <div
                          className="h-3.5 rounded-full animate-pulse"
                          style={{
                            background: '#f3f4f6',
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
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <div className="h-12 w-12 rounded-xl bg-gray-50 flex items-center justify-center border border-slate-100">
                        <Inbox size={20} className="text-gray-300" />
                      </div>
                      <p className="text-sm font-medium">{emptyMessage}</p>
                    </div>
                  </td>
                </tr>
              )
              : data.map(row => (
                <tr
                  key={rowKey(row)}
                  onClick={() => onRowClick?.(row)}
                  className={clsx(
                    'transition-colors duration-150',
                    onRowClick
                      ? 'cursor-pointer hover:bg-blue-50/30'
                      : 'hover:bg-slate-50/50',
                  )}
                >
                  {columns.map(col => (
                    <td
                      key={String(col.key)}
                      className={clsx('px-5 py-3.5 text-gray-700 align-middle text-[13px] font-medium', col.className)}
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
        <div className="flex items-center justify-between px-4 py-3"
             style={{ borderTop: '1px solid #f3f4f6', background: '#fafafa' }}>
          <p className="text-xs text-gray-500">
            Showing{' '}
            <span className="font-semibold text-gray-700">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}</span>
            {' '}of{' '}
            <span className="font-semibold text-gray-700">{total}</span>
          </p>
          <div className="flex items-center gap-0.5">
            <button
              disabled={page === 1}
              onClick={() => onPageChange?.(page - 1)}
              className="p-1.5 rounded-lg transition-colors duration-100
                         hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-gray-500"
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
                    'min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-semibold transition-colors duration-100',
                    pg === page
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-200',
                  )}
                >
                  {pg}
                </button>
              );
            })}

            <button
              disabled={page >= totalPages}
              onClick={() => onPageChange?.(page + 1)}
              className="p-1.5 rounded-lg transition-colors duration-100
                         hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-gray-500"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
