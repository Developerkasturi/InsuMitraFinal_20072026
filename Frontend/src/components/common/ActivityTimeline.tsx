import { Clock, History, Pencil, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export interface ActivityTimelineEvent {
  id: string;
  action: string;
  description?: string | null;
  entityType?: string;
  entityId?: string;
  userId?: string | null;
  user?: { firstName?: string; lastName?: string } | null;
  createdAt: string | Date;
}

interface ActivityTimelineProps {
  events: unknown;
  fallbackEvents?: ActivityTimelineEvent[];
  entityType?: string;
  entityId?: string;
  isLoading?: boolean;
  isError?: boolean;
  subtitle: string;
}

const actionIcons: Record<string, typeof History> = {
  CREATE: Plus,
  UPDATE: Pencil,
  DELETE: Trash2,
};

export default function ActivityTimeline({
  events,
  fallbackEvents = [],
  entityType,
  entityId,
  isLoading = false,
  isError = false,
  subtitle,
}: ActivityTimelineProps) {
  const collectedEvents: ActivityTimelineEvent[] = [];
  const collectEvents = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(collectEvents);
      return;
    }
    if (!value || typeof value !== 'object') return;

    const record = value as Record<string, unknown>;
    if (typeof record.action === 'string' && record.createdAt) {
      collectedEvents.push(record as unknown as ActivityTimelineEvent);
      return;
    }
    if ('data' in record) collectEvents(record.data);
  };
  collectEvents(events);
  const uniqueEvents = new Map<string, ActivityTimelineEvent>();
  const visibleEvents = [
    ...collectedEvents,
    ...fallbackEvents.filter(fallback => !collectedEvents.some(event =>
      event.entityType === fallback.entityType &&
      event.entityId === fallback.entityId &&
      event.action === fallback.action
    )),
  ];
  visibleEvents.forEach((event, index) => {
    if (entityType && event.entityType?.toLowerCase() !== entityType.toLowerCase()) return;
    if (entityId && event.entityId !== entityId) return;
    const key = event.id || `${event.entityType}-${event.entityId}-${event.action}-${event.createdAt}-${index}`;
    uniqueEvents.set(key, event);
  });

  const latestFirst = [...uniqueEvents.values()].sort((a, b) => {
    const timestampA = new Date(a.createdAt).getTime();
    const timestampB = new Date(b.createdAt).getTime();
    return (Number.isNaN(timestampB) ? 0 : timestampB) - (Number.isNaN(timestampA) ? 0 : timestampA);
  });

  return (
    <section className="space-y-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex min-w-0 items-start gap-2">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <History size={13} />
          </div>
          <div>
            <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-slate-800">
              Audit Trail &amp; Activity History
            </h3>
            <p className="mt-0.5 text-[10px] text-slate-500">{subtitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-extrabold text-emerald-700">
            Live Updates
          </span>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[9px] font-extrabold text-blue-700">
            {isLoading ? 'Loading…' : `${latestFirst.length} ${latestFirst.length === 1 ? 'Event' : 'Events'} Total`}
          </span>
        </div>
      </div>

      <div className="relative mt-2.5 max-h-[350px] space-y-2.5 overflow-y-auto pl-3.5 pr-1 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-blue-200 custom-scrollbar">
        {isLoading && latestFirst.length === 0 ? (
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-7 text-center text-[11px] text-slate-500">
            Loading activity history…
          </div>
        ) : isError && latestFirst.length === 0 ? (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-4 text-center text-[11px] font-medium text-rose-700">
            Activity history could not be loaded. Please try again.
          </div>
        ) : latestFirst.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-3 py-7 text-center text-[11px] text-slate-500">
            No activity has been recorded yet.
          </div>
        ) : latestFirst.map((event, index) => {
          const timestamp = new Date(event.createdAt);
          const timestampLabel = Number.isNaN(timestamp.getTime())
            ? 'Date unavailable'
            : format(timestamp, 'dd MMM yyyy, hh:mm a');
          const action = event.action?.toUpperCase() || 'ACTIVITY';
          const ActionIcon = actionIcons[action] || History;
          const entityType = event.entityType || 'Record';
          const actorName = [event.user?.firstName, event.user?.lastName].filter(Boolean).join(' ');
          const actor = actorName || (event.userId ? 'Team member' : 'System');

          return (
            <article
              key={event.id || `${event.createdAt}-${index}`}
              className="relative rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-2xs"
            >
              <span className="absolute -left-[17px] top-2.5 flex h-5 w-5 items-center justify-center rounded-full border border-indigo-400 bg-white text-indigo-600">
                <ActionIcon size={10} />
              </span>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h4 className="text-[10px] font-extrabold uppercase tracking-wide text-slate-800">
                  {event.description || `${entityType} ${action.toLowerCase()}`}
                </h4>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1 text-[9px] font-bold text-slate-600">
                  <Clock size={10} />
                  {timestampLabel}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                <span className="rounded-md bg-slate-100 px-1.5 py-1 text-[9px] font-semibold text-slate-600">
                  By {actor}
                </span>
                <span className="rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-1 text-[9px] font-extrabold uppercase text-indigo-700">
                  {entityType} · {action}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
