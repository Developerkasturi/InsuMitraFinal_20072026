import { Download, FileText, Upload } from 'lucide-react';
import Modal from './Modal';

export interface ImportFormatColumn {
  name: string;
  requirement: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onChooseFile: () => void;
  title: string;
  description: string;
  warning: string;
  columns: ImportFormatColumn[];
  sampleRow: string[];
  fileFormats: string;
  sampleFileName: string;
}

export default function ImportFormatModal({
  open,
  onClose,
  onChooseFile,
  title,
  description,
  warning,
  columns,
  sampleRow,
  fileFormats,
  sampleFileName,
}: Props) {
  const downloadSample = () => {
    const escapeCsvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const csv = [
      columns.map(column => column.name),
      sampleRow,
    ].map(row => row.map(escapeCsvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = sampleFileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={description}
      size="lg"
      icon={<FileText size={18} />}
      actions={(
        <button
          type="button"
          onClick={downloadSample}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-extrabold transition-colors cursor-pointer"
        >
          <Download size={13} />
          Download sample CSV
        </button>
      )}
    >
      <div className="space-y-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-[11px] leading-relaxed text-amber-800">
          {warning}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="grid grid-cols-[minmax(120px,0.8fr)_minmax(0,1.6fr)] bg-slate-50 px-3 py-2 text-[9px] font-extrabold uppercase tracking-wider text-slate-500">
            <span>Column</span>
            <span>Requirement and format</span>
          </div>
          {columns.map(column => (
            <div
              key={column.name}
              className="grid grid-cols-[minmax(120px,0.8fr)_minmax(0,1.6fr)] border-t border-slate-100 px-3 py-2 text-[11px] leading-relaxed"
            >
              <span className="font-bold text-slate-700">{column.name}</span>
              <span className="text-slate-600">{column.requirement}</span>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-slate-500">
          Supported format: {fileFormats}. Keep the column headers unchanged. Replace the sample row before importing.
        </p>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onChooseFile}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
          >
            <Upload size={14} />
            Choose file to import
          </button>
        </div>
      </div>
    </Modal>
  );
}
