import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calendarService, contactsService, policiesService, leadsService } from '@api/index';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, startOfWeek, endOfWeek, addDays, subDays } from 'date-fns';
import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Clock, Tag, Cake, Users, RefreshCw, Zap, CalendarDays } from 'lucide-react';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import clsx from 'clsx';

// ── Event type colours ─────────────────────────────────────────────────────────
const EVENT_COLORS: Record<string, string> = {
  FOLLOWUP:    'bg-blue-500',
  MEETING:     'bg-violet-500',
  RENEWAL:     'bg-amber-500',
  PAYMENT_DUE: 'bg-red-500',
  BIRTHDAY:    'bg-pink-500',
  OTHER:       'bg-gray-400',
};

const EVENT_GRADIENT: Record<string, string> = {
  FOLLOWUP:    'from-blue-500 to-blue-600',
  MEETING:     'from-violet-500 to-violet-600',
  RENEWAL:     'from-amber-500 to-orange-500',
  PAYMENT_DUE: 'from-red-500 to-rose-600',
  BIRTHDAY:    'from-pink-500 to-rose-500',
  OTHER:       'from-slate-400 to-slate-500',
};

const EVENT_BADGE: Record<string, string> = {
  FOLLOWUP:    'bg-blue-50   text-blue-700   border-blue-200',
  MEETING:     'bg-violet-50 text-violet-700 border-violet-200',
  RENEWAL:     'bg-amber-50  text-amber-700  border-amber-200',
  PAYMENT_DUE: 'bg-red-50    text-red-700    border-red-200',
  BIRTHDAY:    'bg-pink-50   text-pink-700   border-pink-200',
  OTHER:       'bg-gray-50   text-gray-600   border-gray-200',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  FOLLOWUP: 'Follow Up', MEETING: 'Meeting', RENEWAL: 'Renewal',
  PAYMENT_DUE: 'Payment Due', BIRTHDAY: 'Birthday', OTHER: 'Other',
};

const EVENT_DOT_COLOR: Record<string, string> = {
  FOLLOWUP:    'bg-blue-400',
  MEETING:     'bg-violet-400',
  RENEWAL:     'bg-amber-400',
  PAYMENT_DUE: 'bg-red-400',
  BIRTHDAY:    'bg-pink-400',
  OTHER:       'bg-slate-400',
};

// Active pill colours per event type (checked state)
const FILTER_ACTIVE: Record<string, string> = {
  FOLLOWUP:    'bg-blue-100   text-blue-700   border-blue-300',
  MEETING:     'bg-violet-100 text-violet-700 border-violet-300',
  RENEWAL:     'bg-amber-100  text-amber-700  border-amber-300',
  PAYMENT_DUE: 'bg-red-100    text-red-700    border-red-300',
  BIRTHDAY:    'bg-pink-100   text-pink-700   border-pink-300',
  OTHER:       'bg-slate-100  text-slate-600  border-slate-300',
};

export default function Calendar() {
  const qc          = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'threeDays'>('month');
  const [visibleCategories, setVisibleCategories] = useState<string[]>([
    'FOLLOWUP', 'MEETING', 'RENEWAL', 'PAYMENT_DUE', 'BIRTHDAY', 'OTHER'
  ]);

  const [modalOpen,   setModalOpen]   = useState(false);
  const [editTarget,  setEditTarget]  = useState<any | null>(null);
  const [deleteTarget,setDeleteTarget]= useState<any | null>(null);
  const [viewTarget,  setViewTarget]  = useState<any | null>(null);
  const [overflowDay, setOverflowDay] = useState<{ date: Date; events: any[] } | null>(null);

  // Queries for calendar events
  const start = startOfMonth(currentDate);
  const end   = endOfMonth(currentDate);

  const { data } = useQuery({
    queryKey: ['calendar', format(currentDate, 'yyyy-MM')],
    queryFn:  () => calendarService.list({
      startDate: start.toISOString(),
      endDate:   end.toISOString(),
    }),
  });
  const events: any[] = data?.data ?? [];

  // Derived days array based on active viewMode
  const days = useMemo(() => {
    if (viewMode === 'month') {
      const s = startOfMonth(currentDate);
      const e = endOfMonth(currentDate);
      return eachDayOfInterval({ start: s, end: e });
    } else if (viewMode === 'week') {
      const s = startOfWeek(currentDate);
      const e = endOfWeek(currentDate);
      return eachDayOfInterval({ start: s, end: e });
    } else {
      // 3 Days View
      const s = currentDate;
      const e = addDays(currentDate, 2);
      return eachDayOfInterval({ start: s, end: e });
    }
  }, [currentDate, viewMode]);

  const prefixDays = useMemo(() => {
    return viewMode === 'month' ? startOfMonth(currentDate).getDay() : 0;
  }, [currentDate, viewMode]);

  // Sidebar tabular database records
  const { data: contactsRes } = useQuery({
    queryKey: ['calendar-contacts-birthdays'],
    queryFn: () => contactsService.list({ limit: 200 }),
  });
  const { data: policiesRes } = useQuery({
    queryKey: ['calendar-policies-renewals'],
    queryFn: () => policiesService.list({ limit: 200 }),
  });
  const { data: leadsRes } = useQuery({
    queryKey: ['calendar-leads-followups'],
    queryFn: () => leadsService.list({ limit: 200 }),
  });

  const birthdaysToday = useMemo(() => {
    const isBirthdayVisible = visibleCategories.includes('BIRTHDAY');

    // Contacts whose birthday falls on the selected date
    const contactBirthdays = isBirthdayVisible
      ? (contactsRes?.data ?? []).filter((c: any) => {
          if (!c.birthday) return false;
          const bDate = new Date(c.birthday);
          return bDate.getDate() === selectedDate.getDate() && bDate.getMonth() === selectedDate.getMonth();
        }).map((c: any) => ({ _type: 'contact', id: c.id, label: `${c.firstName} ${c.lastName}`, event: null }))
      : [];

    // Calendar events of type BIRTHDAY on the selected date
    const eventBirthdays = isBirthdayVisible
      ? events
          .filter(e => e.eventType === 'BIRTHDAY' && isSameDay(new Date(e.startAt ?? e.startTime), selectedDate))
          .map(e => ({ _type: 'event', id: e.id, label: e.title, event: e }))
      : [];

    return [...contactBirthdays, ...eventBirthdays];
  }, [contactsRes, events, selectedDate, visibleCategories]);

  const renewalsToday = useMemo(() => {
    return (policiesRes?.data ?? []).filter((p: any) => {
      if (!p.nextDueDate) return false;
      const dDate = new Date(p.nextDueDate);
      return isSameDay(dDate, selectedDate);
    });
  }, [policiesRes, selectedDate]);

  const leadsToday = useMemo(() => {
    return (leadsRes?.data ?? []).filter((l: any) => {
      if (!l.followUpDate) return false;
      const fDate = new Date(l.followUpDate);
      return isSameDay(fDate, selectedDate);
    });
  }, [leadsRes, selectedDate]);

  // All calendar events on selected date (non-birthday) for Tasks section
  const tasksToday = useMemo(() => {
    return events.filter(e => {
      const isDateMatch = isSameDay(new Date(e.startAt ?? e.startTime), selectedDate);
      const isNotBirthday = e.eventType !== 'BIRTHDAY';
      const isVisible = visibleCategories.includes(e.eventType || 'OTHER');
      return isDateMatch && isNotBirthday && isVisible;
    });
  }, [events, selectedDate, visibleCategories]);

  const createEvent = useMutation({
    mutationFn: calendarService.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar'] }); toast.success('Event created'); setModalOpen(false); },
    onError:   () => toast.error('Failed to create event'),
  });

  const updateEvent = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => calendarService.update(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar'] }); toast.success('Event updated'); setEditTarget(null); },
    onError:   () => toast.error('Failed to update event'),
  });

  const deleteEvent = useMutation({
    mutationFn: (id: string) => calendarService.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar'] }); toast.success('Event deleted'); setDeleteTarget(null); setViewTarget(null); },
    onError:   () => toast.error('Failed to delete event'),
  });

  const { register, handleSubmit, reset } = useForm<any>();
  const { register: regEdit, handleSubmit: handleEditSubmit, reset: resetEdit, setValue: editSetValue } = useForm<any>();

  const openEdit = (ev: any) => {
    setViewTarget(null);
    setEditTarget(ev);
    editSetValue('title', ev.title);
    editSetValue('eventType', ev.eventType ?? 'OTHER');
    editSetValue('isAllDay', ev.isAllDay ?? false);
    editSetValue('startAt', (ev.startAt ?? ev.startTime)?.slice(0, 16));
    editSetValue('endAt',   (ev.endAt   ?? ev.endTime)?.slice(0, 16)   ?? '');
    editSetValue('description', ev.description ?? '');
  };

  // Date Navigation based on viewMode
  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(d => subDays(d, 7));
    } else {
      setCurrentDate(d => subDays(d, 3));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(d => addDays(d, 7));
    } else {
      setCurrentDate(d => addDays(d, 3));
    }
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  // Quick templates addition mutation
  const quickAddMutation = useMutation({
    mutationFn: calendarService.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar'] }); toast.success('Quick event added!'); },
    onError: () => toast.error('Failed to add quick event'),
  });

  const handleQuickAdd = (template: string) => {
    const startAt = new Date(selectedDate);
    startAt.setHours(9, 0, 0, 0);
    const endAt = new Date(selectedDate);
    endAt.setHours(10, 0, 0, 0);

    const body = {
      title: template,
      eventType: template === 'Monthly Rent Payment' ? 'PAYMENT_DUE' : (template === 'Client Review Session' ? 'MEETING' : 'FOLLOWUP'),
      isAllDay: false,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      description: `Quick added frequent event for ${template}`,
    };
    quickAddMutation.mutate(body);
  };

  const EventFormFields = ({ reg }: { reg: any }) => (
    <div className="space-y-4">
      <div>
        <label className="label">Title *</label>
        <input {...reg('title')} className="input" placeholder="Event title" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Event Type</label>
          <select {...reg('eventType')} className="input">
            {Object.entries(EVENT_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input {...reg('isAllDay')} type="checkbox" className="rounded accent-blue-600" />
            <span className="text-sm text-gray-600 font-medium">All Day</span>
          </label>
        </div>
        <div>
          <label className="label">Start *</label>
          <input {...reg('startAt')} type="datetime-local" className="input" />
        </div>
        <div>
          <label className="label">End</label>
          <input {...reg('endAt')} type="datetime-local" className="input" />
        </div>
      </div>
      <div>
        <label className="label">Description</label>
        <textarea {...reg('description')} className="input" rows={2} placeholder="Optional description…" />
      </div>
    </div>
  );

  // ── Day-of-week labels
  const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-4 animate-fade-in pb-10">

      {/* ── Hero Header Bar ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-violet-600 p-5 shadow-xl shadow-blue-200/40">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-6 left-10 w-28 h-28 rounded-full bg-violet-400/20 blur-xl" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">

          {/* Left: nav + title */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              aria-label="Previous"
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 text-white transition-all border border-white/20 backdrop-blur-sm"
            >
              <ChevronLeft size={15} />
            </button>

            <div className="text-center min-w-[160px]">
              <h2 className="text-lg font-extrabold text-white tracking-tight leading-none">
                {viewMode === 'month'
                  ? format(currentDate, 'MMMM yyyy')
                  : `${format(days[0], 'dd MMM')} – ${format(days[days.length - 1], 'dd/MMM/yyyy')}`}
              </h2>
              <p className="text-white/60 text-[11px] mt-0.5 font-medium">
                {format(new Date(), 'EEEE, dd MMMM yyyy')}
              </p>
            </div>

            <button
              onClick={handleNext}
              aria-label="Next"
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 text-white transition-all border border-white/20 backdrop-blur-sm"
            >
              <ChevronRight size={15} />
            </button>

            <button
              onClick={goToToday}
              className="ml-1 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold border border-white/20 backdrop-blur-sm transition-all"
            >
              Today
            </button>
          </div>

          {/* Centre: view-mode pills */}
          <div className="flex items-center bg-white/10 backdrop-blur-sm p-1 rounded-xl border border-white/15 gap-1">
            {(['month', 'week', 'threeDays'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={clsx(
                  'px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  viewMode === mode
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                )}
              >
                {mode === 'threeDays' ? '3 Days' : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Right: New event button */}
          <button
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-blue-600 font-bold text-sm hover:bg-blue-50 transition-all shadow-lg shadow-blue-900/20 shrink-0"
            onClick={() => setModalOpen(true)}
          >
            <Plus size={15} />
            New Event
          </button>
        </div>
      </div>

      {/* ── Category Filter Bar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mr-1">Filters:</span>
        {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => {
          const isChecked = visibleCategories.includes(key);
          return (
            <label
              key={key}
              className={clsx(
                'flex items-center gap-1.5 cursor-pointer select-none rounded-full py-1 px-3 text-xs font-semibold border transition-all',
                isChecked
                  ? (FILTER_ACTIVE[key] ?? 'bg-slate-100 text-slate-600 border-slate-300') + ' shadow-sm'
                  : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600'
              )}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => {
                  if (isChecked) {
                    setVisibleCategories(prev => prev.filter(k => k !== key));
                  } else {
                    setVisibleCategories(prev => [...prev, key]);
                  }
                }}
                className="sr-only"
              />
              <span className={clsx('w-2 h-2 rounded-full', EVENT_COLORS[key] ?? 'bg-gray-400')} />
              {label}
            </label>
          );
        })}
      </div>

      {/* ── Main Grid: Calendar + Sidebar ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 items-start">

        {/* ── Left: Calendar Grid ─────────────────────────────────────────── */}
        <div className="lg:col-span-3 overflow-hidden rounded-2xl border border-slate-100 shadow-sm bg-white">

          {/* Day-of-week header row */}
          <div className={clsx(
            'grid border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100/60',
            viewMode === 'threeDays' ? 'grid-cols-3' : 'grid-cols-7'
          )}>
            {viewMode === 'threeDays' ? (
              days.map((d: Date) => (
                <div key={d.toISOString()} className="py-3 text-center text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  {format(d, 'eee dd MMM')}
                </div>
              ))
            ) : (
              DOW_LABELS.map(d => (
                <div key={d} className="py-3 text-center text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  {d}
                </div>
              ))
            )}
          </div>

          {/* Days grid */}
          <div className={clsx(
            'grid',
            viewMode === 'threeDays' ? 'grid-cols-3' : 'grid-cols-7'
          )}>
            {/* Prefix blanks */}
            {viewMode === 'month' && Array.from({ length: prefixDays }).map((_, i) => (
              <div key={`pre-${i}`} className="min-h-[110px] border-b border-r border-slate-50 bg-slate-50/30" />
            ))}

            {days.map((day: Date) => {
              const dayEvents = events.filter(e => {
                const isDateMatch = isSameDay(new Date(e.startAt ?? e.startTime), day);
                const isVisible = visibleCategories.includes(e.eventType || 'OTHER');
                return isDateMatch && isVisible;
              });
              const today = isToday(day);
              const isSelected = isSameDay(day, selectedDate);

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={clsx(
                    'min-h-[110px] border-b border-r border-slate-100 p-2 transition-all cursor-pointer group',
                    today
                      ? 'bg-gradient-to-br from-blue-50/80 to-indigo-50/60'
                      : isSelected
                        ? 'bg-gradient-to-br from-slate-50 to-slate-100/60'
                        : 'hover:bg-slate-50/60',
                    isSelected && !today ? 'ring-2 ring-inset ring-blue-400/40' : '',
                    today && isSelected ? 'ring-2 ring-inset ring-blue-500/60' : '',
                  )}
                >
                  {/* Day number */}
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={clsx(
                        'inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-extrabold transition-all',
                        today
                          ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-300/50'
                          : isSelected
                            ? 'text-blue-600 bg-blue-100'
                            : 'text-slate-500 group-hover:text-slate-700'
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[8px] text-slate-400 font-bold">{dayEvents.length}</span>
                    )}
                  </div>

                  {/* Events */}
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(e => (
                      <button
                        key={e.id}
                        onClick={(ev) => { ev.stopPropagation(); setViewTarget(e); }}
                        className={clsx(
                          'w-full text-left flex items-center gap-1 rounded-md px-1.5 py-[3px] text-[9px] font-semibold text-white truncate transition-all hover:scale-[1.02] hover:shadow-sm',
                          `bg-gradient-to-r ${EVENT_GRADIENT[e.eventType] ?? 'from-slate-400 to-slate-500'}`
                        )}
                      >
                        <span className="truncate">{e.title}</span>
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <button
                        onClick={(ev) => { ev.stopPropagation(); setOverflowDay({ date: day, events: dayEvents }); }}
                        className="text-[8px] text-blue-500 font-bold px-1.5 py-0.5 hover:text-blue-700 hover:bg-blue-50 w-full text-left rounded transition-colors"
                      >
                        +{dayEvents.length - 3} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right Sidebar ──────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Quick Templates card */}
          <div className="rounded-2xl border border-slate-100 shadow-sm bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 bg-gradient-to-r from-slate-50 to-white">
              <Zap size={13} className="text-amber-500" />
              <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500">Quick Templates</h3>
            </div>
            <div className="p-3 flex flex-col gap-2">
              {[
                { label: 'Monthly Rent Payment', badge: 'Bills', badgeCls: 'bg-red-100 text-red-700', icon: '💸' },
                { label: 'Client Review Session', badge: 'Meeting', badgeCls: 'bg-violet-100 text-violet-700', icon: '🤝' },
                { label: 'Utility Bill Payment', badge: 'Bills', badgeCls: 'bg-amber-100 text-amber-700', icon: '⚡' },
              ].map(({ label, badge, badgeCls, icon }) => (
                <button
                  key={label}
                  onClick={() => handleQuickAdd(label)}
                  className="group w-full text-left py-2.5 px-3 text-xs bg-slate-50 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 text-slate-700 font-semibold border border-slate-200/80 hover:border-blue-200 rounded-xl transition-all flex items-center justify-between gap-2 shadow-sm hover:shadow-md hover:-translate-y-px"
                >
                  <span className="flex items-center gap-2">
                    <span>{icon}</span>
                    <span className="truncate">{label}</span>
                  </span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-extrabold shrink-0 ${badgeCls}`}>{badge}</span>
                </button>
              ))}
              <p className="text-[9px] text-slate-400 px-1 pt-1">Adds to selected date at 9:00 AM</p>
            </div>
          </div>

          {/* Agenda card */}
          <div className="rounded-2xl border border-slate-100 shadow-sm bg-white overflow-hidden">
            {/* Agenda header */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 bg-gradient-to-r from-slate-50 to-white">
              <CalendarDays size={13} className="text-blue-500" />
              <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
                Agenda — {format(selectedDate, 'dd MMM')}
              </h3>
            </div>

            <div className="p-3 space-y-4 max-h-[420px] overflow-y-auto">

              {/* Tasks & Meetings */}
              <AgendaSection
                icon={<CalendarDays size={11} className="text-blue-500" />}
                title="Tasks & Meetings"
                count={tasksToday.length}
                countCls="bg-blue-100 text-blue-700"
                emptyText="No tasks scheduled."
              >
                {tasksToday.map((t: any) => (
                  <AgendaItem
                    key={t.id}
                    label={t.title}
                    dotCls={EVENT_DOT_COLOR[t.eventType] ?? 'bg-slate-400'}
                    onClick={() => setViewTarget(t)}
                  />
                ))}
              </AgendaSection>

              {/* Birthdays */}
              <AgendaSection
                icon={<Cake size={11} className="text-pink-500" />}
                title="Birthdays"
                count={birthdaysToday.length}
                countCls="bg-pink-100 text-pink-700"
                emptyText="No birthdays today."
              >
                {birthdaysToday.map((b: any) => (
                  <AgendaItem
                    key={b.id}
                    label={b.label}
                    dotCls="bg-pink-400"
                    onClick={b.event ? () => setViewTarget(b.event) : undefined}
                    badge={b._type === 'event' ? { label: 'Event', cls: 'bg-pink-100 text-pink-700' } : undefined}
                  />
                ))}
              </AgendaSection>

              {/* Leads */}
              <AgendaSection
                icon={<Users size={11} className="text-violet-500" />}
                title="Lead Followups"
                count={leadsToday.length}
                countCls="bg-violet-100 text-violet-700"
                emptyText="No lead followups."
              >
                {leadsToday.map((l: any) => (
                  <AgendaItem
                    key={l.id}
                    label={l.name}
                    dotCls="bg-violet-400"
                  />
                ))}
              </AgendaSection>

              {/* Policy Renewals */}
              <AgendaSection
                icon={<RefreshCw size={11} className="text-amber-500" />}
                title="Policy Renewals"
                count={renewalsToday.length}
                countCls="bg-amber-100 text-amber-700"
                emptyText="No policy renewals today."
              >
                {renewalsToday.map((p: any) => (
                  <AgendaItem
                    key={p.id}
                    label={p.policyNumber}
                    dotCls="bg-amber-400"
                  />
                ))}
              </AgendaSection>

            </div>
          </div>
        </div>

      </div>

      {/* ── Create Event Modal ─────────────────────────────────────────────── */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset(); }} title="New Event">
        <form onSubmit={handleSubmit((d: any) => {
          const payload = { ...d };
          if (payload.startAt) payload.startAt = new Date(payload.startAt).toISOString();
          if (payload.endAt)   payload.endAt   = new Date(payload.endAt).toISOString();
          createEvent.mutate(payload);
        })} className="space-y-4">
          <EventFormFields reg={register} />
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => { setModalOpen(false); reset(); }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createEvent.isPending}>
              {createEvent.isPending ? 'Creating…' : 'Create Event'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── View Event Modal ───────────────────────────────────────────────── */}
      {viewTarget && (
        <Modal open onClose={() => setViewTarget(null)} title={viewTarget.title}>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className={clsx('badge border text-xs', EVENT_BADGE[viewTarget.eventType] ?? 'bg-gray-50 text-gray-600 border-gray-200')}>
                <Tag size={10} /> {EVENT_TYPE_LABELS[viewTarget.eventType] ?? viewTarget.eventType}
              </span>
            </div>
            <div className="space-y-2 text-sm text-gray-700 bg-gray-50 rounded-xl p-4 border border-gray-100">
              {(viewTarget.startAt ?? viewTarget.startTime) && (
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-gray-400 shrink-0" />
                  <span><span className="font-medium">Start:</span> {format(new Date(viewTarget.startAt ?? viewTarget.startTime), 'dd MMM yyyy, HH:mm')}</span>
                </div>
              )}
              {(viewTarget.endAt ?? viewTarget.endTime) && (
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-gray-400 shrink-0" />
                  <span><span className="font-medium">End:</span> {format(new Date(viewTarget.endAt ?? viewTarget.endTime), 'dd MMM yyyy, HH:mm')}</span>
                </div>
              )}
              {viewTarget.description && (
                <p className="text-gray-600 mt-2 pt-2 border-t border-gray-200">{viewTarget.description}</p>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center mt-5 pt-4 border-t border-gray-100">
            <button className="btn-secondary gap-1.5" onClick={() => openEdit(viewTarget)}>
              <Pencil size={13} /> Edit
            </button>
            <button className="btn-danger gap-1.5" onClick={() => { setViewTarget(null); setDeleteTarget(viewTarget); }}>
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </Modal>
      )}

      {/* ── Edit Event Modal ───────────────────────────────────────────────── */}
      {editTarget && (
        <Modal open onClose={() => { setEditTarget(null); resetEdit(); }} title="Edit Event">
          <form onSubmit={handleEditSubmit((d: any) => {
            const payload = { ...d };
            if (payload.startAt) payload.startAt = new Date(payload.startAt).toISOString();
            if (payload.endAt)   payload.endAt   = new Date(payload.endAt).toISOString();
            updateEvent.mutate({ id: editTarget.id, body: payload });
          })} className="space-y-4">
            <EventFormFields reg={regEdit} />
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button type="button" className="btn-secondary" onClick={() => { setEditTarget(null); resetEdit(); }}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={updateEvent.isPending}>
                {updateEvent.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Delete Confirm Modal ───────────────────────────────────────────── */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Event" size="sm">
        <p className="text-sm text-gray-600 mb-5">
          Are you sure you want to delete <strong className="text-gray-900">"{deleteTarget?.title}"</strong>?
          This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button
            className="btn-danger"
            disabled={deleteEvent.isPending}
            onClick={() => deleteEvent.mutate(deleteTarget!.id)}
          >
            {deleteEvent.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>

      {/* ── Day Overflow Modal ─────────────────────────────────────────────── */}
      {overflowDay && (
        <Modal
          open
          onClose={() => setOverflowDay(null)}
          title={`All Events — ${format(overflowDay.date, 'dd/MMM/yyyy')}`}
        >
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {overflowDay.events.map((e: any) => (
              <button
                key={e.id}
                onClick={() => { setOverflowDay(null); setViewTarget(e); }}
                className={`w-full text-left flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-white transition-all hover:scale-[1.01] hover:shadow-md bg-gradient-to-r ${EVENT_GRADIENT[e.eventType] ?? 'from-slate-400 to-slate-500'}`}
              >
                <span className="truncate flex-1">{e.title}</span>
                <span className="shrink-0 text-white/70 font-normal">
                  {(e.startAt ?? e.startTime) ? format(new Date(e.startAt ?? e.startTime), 'HH:mm') : ''}
                </span>
              </button>
            ))}
          </div>
        </Modal>
      )}

    </div>
  );
}

// ── Small reusable agenda section component ──────────────────────────────────
function AgendaSection({
  icon, title, count, countCls, emptyText, children
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  countCls: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
          {icon}
          <span>{title}</span>
        </div>
        <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-full ${countCls}`}>{count}</span>
      </div>
      {count === 0 ? (
        <p className="text-[11px] text-slate-400 italic pl-1">{emptyText}</p>
      ) : (
        <div className="space-y-1">{children}</div>
      )}
    </div>
  );
}

// ── Small reusable agenda row ────────────────────────────────────────────────
function AgendaItem({
  label, dotCls, onClick, badge
}: {
  label: string;
  dotCls: string;
  onClick?: () => void;
  badge?: { label: string; cls: string };
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { onClick } : {})}
      className={clsx(
        'w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border text-xs font-semibold transition-all',
        'bg-white border-slate-100 text-slate-700',
        onClick
          ? 'cursor-pointer hover:bg-slate-50 hover:border-slate-200 hover:shadow-sm'
          : 'cursor-default'
      )}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotCls}`} />
      <span className="truncate flex-1 text-left">{label}</span>
      {badge && (
        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-extrabold shrink-0 ${badge.cls}`}>
          {badge.label}
        </span>
      )}
    </Tag>
  );
}
