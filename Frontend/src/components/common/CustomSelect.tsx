import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, Check, Search } from 'lucide-react';
import clsx from 'clsx';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

interface CustomSelectProps {
  value?: string | number;
  onChange: (value: string) => void;
  options: (SelectOption | string | number)[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  searchable?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value = '',
  onChange,
  options,
  placeholder = 'Select option...',
  className = '',
  disabled = false,
  searchable = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Normalize options to SelectOption[]
  const normalizedOptions: SelectOption[] = options.map(opt => {
    if (typeof opt === 'string' || typeof opt === 'number') {
      return { value: String(opt), label: String(opt) };
    }
    return { ...opt, value: String(opt.value) };
  });

  const selectedOption = normalizedOptions.find(o => String(o.value) === String(value));

  const updateDropdownPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const estimatedDropdownHeight = 240;

    let topPos: number;
    let maxHeight: number;

    if (spaceBelow >= 120 || spaceBelow >= spaceAbove) {
      // Open downward
      topPos = rect.bottom + window.scrollY + 4;
      maxHeight = Math.min(estimatedDropdownHeight, spaceBelow - 8);
    } else {
      // Open upward
      maxHeight = Math.min(estimatedDropdownHeight, spaceAbove - 8);
      topPos = rect.top + window.scrollY - maxHeight - 4;
    }

    setDropdownStyle({
      position: 'absolute',
      top: topPos,
      left: rect.left + window.scrollX,
      width: rect.width,
      maxHeight: Math.max(maxHeight, 100),
      zIndex: 99999,
    });
  }, []);

  useEffect(() => {
    if (isOpen) updateDropdownPosition();
  }, [isOpen, updateDropdownPosition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inContainer && !inDropdown) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    const handleScrollOrResize = () => {
      if (isOpen) updateDropdownPosition();
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updateDropdownPosition]);

  useEffect(() => {
    if (!isOpen) setSearchTerm('');
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const showSearch = searchable || normalizedOptions.length > 7;
  const filteredOptions = normalizedOptions.filter(opt => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      opt.label.toLowerCase().includes(term) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(term))
    );
  });

  const dropdown = isOpen
    ? ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-2xl custom-scrollbar divide-y divide-slate-50"
        >
          {showSearch && (
            <div className="p-2 border-b border-slate-100 sticky top-0 bg-white z-10" onClick={e => e.stopPropagation()}>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => e.stopPropagation()}
                  placeholder="Search..."
                  className="w-full text-xs pl-7 pr-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-slate-50/50"
                  autoFocus
                />
                <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          )}
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-slate-400 text-center">No options found</div>
          ) : (
            filteredOptions.map(opt => {
              const isSelected = String(opt.value) === String(value);
              return (
                <div
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  className={clsx(
                    'px-3.5 py-2.5 text-xs cursor-pointer flex items-center justify-between transition-colors',
                    isSelected
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  )}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="truncate">{opt.label}</span>
                    {opt.sublabel && <span className="text-[10px] text-slate-400 truncate">{opt.sublabel}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {opt.badge && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                        {opt.badge}
                      </span>
                    )}
                    {isSelected && <Check size={14} className="text-blue-600 shrink-0" />}
                  </div>
                </div>
              );
            })
          )}
        </div>,
        document.body
      )
    : null;

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        className={clsx(
          'w-full flex items-center justify-between text-left transition-all duration-150',
          className || 'input w-full h-10 text-xs rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
          disabled && 'opacity-60 cursor-not-allowed bg-slate-50',
          !disabled && 'cursor-pointer',
          isOpen && 'ring-2 ring-blue-500/20 border-blue-500'
        )}
      >
        <span className={clsx('truncate', !selectedOption || !selectedOption.value ? 'text-slate-400' : 'text-slate-800 font-medium')}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={clsx('ml-2 shrink-0 text-slate-400 transition-transform duration-200', isOpen && 'rotate-180 text-blue-600')}
        />
      </button>
      {dropdown}
    </div>
  );
};

export default CustomSelect;
