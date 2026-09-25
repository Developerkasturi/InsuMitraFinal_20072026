import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import clsx from 'clsx';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

interface CustomSelectProps {
  value?: string;
  onChange: (value: string) => void;
  options: (SelectOption | string)[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value = '',
  onChange,
  options,
  placeholder = 'Select option...',
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize options to SelectOption[]
  const normalizedOptions: SelectOption[] = options.map(opt => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });

  const selectedOption = normalizedOptions.find(o => o.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        className={clsx(
          'w-full flex items-center justify-between text-left transition-all duration-150',
          className || 'input',
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

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-[9999] max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl custom-scrollbar divide-y divide-slate-50 animate-in fade-in zoom-in-95 duration-100">
          {normalizedOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400 text-center">No options available</div>
          ) : (
            normalizedOptions.map(opt => {
              const isSelected = opt.value === value;
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
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
