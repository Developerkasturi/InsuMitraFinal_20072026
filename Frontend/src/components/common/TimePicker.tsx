import React, { forwardRef, useRef, useImperativeHandle, useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { TimepickerUI } from 'timepicker-ui';
import 'timepicker-ui/index.css';

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
    const p = (match12[3] || 'AM').toUpperCase();
    return `${h.toString().padStart(2, '0')}:${m} ${p}`;
  }
  return timeStr;
}

export const TimePicker = forwardRef<HTMLInputElement, TimePickerProps>(
  ({ value, onChange, onTimeChange, className, placeholder = 'hh:mm AM/PM', disabled, required, ...props }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [displayVal, setDisplayVal] = useState(() => formatTime12h(value || ''));

    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    useEffect(() => {
      if (value !== undefined) {
        setDisplayVal(formatTime12h(value || ''));
      }
    }, [value]);

    useEffect(() => {
      if (!containerRef.current) return;

      const pickerElement = containerRef.current;
      const tm = new TimepickerUI(pickerElement, {
        clock: {
          type: '12h',
          autoSwitchToMinutes: true,
          incrementMinutes: 5,
        },
        ui: {
          theme: 'basic',
          animation: true,
          backdrop: true,
        },
        callbacks: {
          onConfirm: (data) => {
            const hour = String(data.hour || '10').padStart(2, '0');
            const minutes = String(data.minutes || '00').padStart(2, '0');
            const period = String(data.type || 'AM').toUpperCase();
            const formatted = `${hour}:${minutes} ${period}`;
            setDisplayVal(formatted);
            if (onTimeChange) onTimeChange(formatted);
            if (onChange) {
              const fakeEvent = { target: { value: formatted }, toString: () => formatted } as any;
              onChange(fakeEvent);
            }
          }
        }
      });

      tm.create();

      return () => {
        try {
          tm.destroy();
        } catch {
          // ignore
        }
      };
    }, [onTimeChange, onChange]);

    const handleTextInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      const text = e.target.value;
      setDisplayVal(text);
      if (onTimeChange) onTimeChange(text);
      if (onChange) {
        const fakeEvent = { target: { value: text }, toString: () => text } as any;
        onChange(fakeEvent);
      }
    };

    return (
      <div ref={containerRef} className="timepicker-ui relative w-full min-w-[130px]">
        {/* Visible input configured for timepicker-ui */}
        <input
          ref={inputRef}
          type="text"
          value={displayVal}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          onChange={handleTextInput}
          className={`timepicker-ui-input ${className || ''} cursor-pointer pl-3 pr-8 text-slate-800 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs`}
          autoComplete="off"
          {...props}
        />

        {/* Clock icon button */}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors p-0.5 pointer-events-none"
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
