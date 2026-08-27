import React, { forwardRef, useRef, useImperativeHandle, useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface TimePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: string | null | any;
  onChange?: (val: any) => void;
  onTimeChange?: (val: string) => void;
  className?: string;
  placeholder?: string;
}

/** Converts time strings to standardized "hh:mm AM/PM" (e.g. "14:30" -> "02:30 PM", "10:00 AM" -> "10:00 AM") */
function formatTime12h(timeStr: string): string {
  if (!timeStr) return '';
  const trimmed = String(timeStr).trim();
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = match12[2];
    let p = (match12[3] || '').toUpperCase();
    if (!p) {
      p = h >= 12 ? 'PM' : 'AM';
      if (h > 12) h -= 12;
      if (h === 0) h = 12;
    }
    return `${h.toString().padStart(2, '0')}:${m} ${p}`;
  }
  return timeStr;
}

/** Converts "02:30 PM" to "14:30" for native input */
function formatTime24h(timeStr: string): string {
  if (!timeStr) return '';
  const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = match[2];
    const period = (match[3] || '').toUpperCase();
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${m}`;
  }
  return '';
}

export const TimePicker = forwardRef<HTMLInputElement, TimePickerProps>(
  ({ value, onChange, onTimeChange, className, placeholder = 'hh:mm AM/PM', disabled, required, ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const nativeTimeRef = useRef<HTMLInputElement | null>(null);
    const [displayVal, setDisplayVal] = useState(() => formatTime12h(value || ''));

    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    useEffect(() => {
      if (value !== undefined) {
        setDisplayVal(formatTime12h(value || ''));
      }
    }, [value]);

    const handleChange = (newVal: string) => {
      const formatted = formatTime12h(newVal);
      setDisplayVal(formatted);
      if (onTimeChange) onTimeChange(formatted);
      if (onChange) {
        const fakeEvent = { target: { value: formatted }, toString: () => formatted } as any;
        onChange(fakeEvent);
      }
    };

    const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.value) {
        handleChange(e.target.value);
      }
    };

    const openNativePicker = () => {
      if (disabled) return;
      if (nativeTimeRef.current) {
        if ('showPicker' in nativeTimeRef.current && typeof (nativeTimeRef.current as any).showPicker === 'function') {
          try {
            (nativeTimeRef.current as any).showPicker();
          } catch {
            nativeTimeRef.current.focus();
          }
        } else {
          nativeTimeRef.current.focus();
        }
      }
    };

    return (
      <div className="relative w-full min-w-[130px] inline-flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={displayVal}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          onChange={e => handleChange(e.target.value)}
          className={`w-full ${className || ''} cursor-pointer pl-3 pr-8 py-1.5 text-slate-800 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs`}
          autoComplete="off"
          {...props}
        />

        {/* Hidden native time input for browser picker modal */}
        <input
          ref={nativeTimeRef}
          type="time"
          value={formatTime24h(displayVal)}
          onChange={handleNativeChange}
          className="absolute inset-0 opacity-0 pointer-events-none w-0 h-0"
          tabIndex={-1}
        />

        {/* Clock icon button */}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={openNativePicker}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors p-0.5 cursor-pointer"
          aria-label="Clock time picker"
        >
          <Clock size={15} />
        </button>
      </div>
    );
  }
);

TimePicker.displayName = 'TimePicker';

export default TimePicker;
