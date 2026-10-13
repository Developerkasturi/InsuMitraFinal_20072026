import { useEffect, useRef, useState } from 'react';
import { FileCheck2, FileText, Upload } from 'lucide-react';
import Modal from '@comps/common/Modal';

export interface DocumentUploadMeta {
  type: string;
  title: string;
  description: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File, meta: DocumentUploadMeta) => Promise<boolean | void>;
  title?: string;
  subtitle?: string;
  types: Array<{ value: string; label: string }>;
  defaultType: string;
  zIndexClass?: string;
  explicitFilePicker?: boolean;
}

export default function DocumentUploadModal({
  open,
  onClose,
  onUpload,
  title = 'Upload Document',
  subtitle = 'Choose a document to upload.',
  types,
  defaultType,
  zIndexClass,
  explicitFilePicker = false,
}: Props) {
  const [type, setType] = useState(defaultType);
  const [documentTitle, setDocumentTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setType(defaultType);
      setDocumentTitle('');
      setDescription('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [open, defaultType]);

  const close = () => {
    if (uploading) return;
    setFile(null);
    setDocumentTitle('');
    setDescription('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  const selectFile = (selected: File | null) => {
    setFile(selected);
    if (selected) setDocumentTitle(selected.name.replace(/\.[^.]+$/, ''));
  };

  const openFilePicker = () => {
    if (!fileInputRef.current || uploading) return;
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  };

  const submit = async () => {
    if (!file || !documentTitle.trim()) return;
    setUploading(true);
    try {
      const uploaded = await onUpload(file, { type, title: documentTitle.trim(), description: description.trim() });
      if (uploaded === false) return;
      setFile(null);
      setDocumentTitle('');
      setDescription('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      subtitle={subtitle}
      size="md"
      zIndexClass={zIndexClass}
      icon={<FileText className="text-indigo-600" size={20} />}
    >
      <div className="space-y-4 py-1">
        <div>
          <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
            Document Type <span className="text-red-500">*</span>
          </label>
          <select
            value={type}
            onChange={event => setType(event.target.value)}
            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
          >
            {types.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
            Document Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={documentTitle}
            onChange={event => setDocumentTitle(event.target.value)}
            className="input w-full h-10 text-xs rounded-xl bg-white border border-slate-200"
            placeholder="Title is filled from the selected filename"
          />
        </div>

        <div>
          <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
            Description / Notes
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={event => setDescription(event.target.value)}
            onMouseDown={event => event.stopPropagation()}
            className="input relative z-10 w-full p-2.5 text-xs rounded-xl bg-white border border-slate-200 pointer-events-auto"
            placeholder="Optional notes about this document"
          />
        </div>

        <div>
          <label className="label text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
            Choose File <span className="text-red-500">*</span>
          </label>
          <div className={`rounded-xl border-2 border-dashed p-4 transition-colors ${
            file ? 'border-emerald-400 bg-emerald-50/60' : 'border-slate-300 bg-slate-50/40 hover:border-blue-500 hover:bg-blue-50/30'
          }`}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
              className={explicitFilePicker ? 'sr-only' : 'block w-full cursor-pointer text-xs text-slate-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-blue-700'}
              disabled={uploading}
              onChange={event => selectFile(event.target.files?.[0] ?? null)}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
                {file ? (
                  <>
                <FileCheck2 size={18} className="shrink-0 text-emerald-600" />
                <span className="min-w-0 truncate font-semibold" title={file.name}>{file.name}</span>
                <span className="shrink-0 text-slate-400">{(file.size / 1024).toFixed(1)} KB</span>
                  </>
                ) : (
                  <p className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <Upload size={13} /> PDF, image, Word, or Excel
                  </p>
                )}
              </div>
              {explicitFilePicker && (
                <button
                  type="button"
                  onClick={openFilePicker}
                  disabled={uploading}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Upload size={14} />
                  {file ? 'Change File' : 'Choose File'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" onClick={close} disabled={uploading} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!file || !documentTitle.trim() || uploading}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : 'Add Document'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
