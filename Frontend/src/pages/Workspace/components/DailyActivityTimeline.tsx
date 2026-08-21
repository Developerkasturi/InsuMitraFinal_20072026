import React from 'react';
import { 
  Clock, CheckCircle, Coffee, Phone, Users, Shield, 
  FileText, ArrowRight, Play, Check 
} from 'lucide-react';

export interface TimelineEvent {
  id: string;
  timeRange: string;
  duration: string;
  title: string;
  category: string;
  entityName?: string;
  outcome?: string;
  type: 'WORK' | 'BREAK' | 'ATTENDANCE';
}

const DEFAULT_TIMELINE: TimelineEvent[] = [
  {
    id: 't-1',
    timeRange: '09:04 AM',
    duration: '—',
    title: 'Clocked In — Shift Started',
    category: 'Attendance',
    type: 'ATTENDANCE'
  },
  {
    id: 't-2',
    timeRange: '09:20 AM – 09:45 AM',
    duration: '25m',
    title: 'Lead Follow-up Calls (5 Leads)',
    category: 'Sales',
    entityName: 'Amit Sharma & 4 others',
    outcome: 'Quotation sent for Star Comprehensive ₹10L',
    type: 'WORK'
  },
  {
    id: 't-3',
    timeRange: '10:00 AM – 10:40 AM',
    duration: '40m',
    title: 'Customer In-Person Proposal Discussion',
    category: 'Client Visit',
    entityName: 'Dr. Vikrant Kulkarni',
    outcome: 'Agreed on HDFC Life Click 2 Protect ₹1.5 Cr',
    type: 'WORK'
  },
  {
    id: 't-4',
    timeRange: '10:50 AM – 11:30 AM',
    duration: '40m',
    title: 'Policy Processing & Documentation Upload',
    category: 'Operations',
    entityName: 'Policy #POL-8902 (Sunita Patil)',
    outcome: 'KYC & Medical test reports submitted to insurer',
    type: 'WORK'
  },
  {
    id: 't-5',
    timeRange: '11:45 AM – 12:20 PM',
    duration: '35m',
    title: 'Renewal Follow-up & Payment Link Sharing',
    category: 'Renewals',
    entityName: 'Mehta Family Care Supreme',
    outcome: 'Shared direct payment link (₹24,500)',
    type: 'WORK'
  },
  {
    id: 't-6',
    timeRange: '01:00 PM – 01:45 PM',
    duration: '45m',
    title: 'Lunch & Rest Break',
    category: 'Break',
    type: 'BREAK'
  },
  {
    id: 't-7',
    timeRange: '02:00 PM – 03:00 PM',
    duration: '60m',
    title: 'Motor Accident Claim Survey Assistance',
    category: 'Claims',
    entityName: 'Bajaj Allianz Claim #CLM-1029',
    outcome: 'Garage estimate verified and approved',
    type: 'WORK'
  }
];

export default function DailyActivityTimeline({ events = DEFAULT_TIMELINE }: { events?: TimelineEvent[] }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary-600" /> Today's Activity Timeline
          </h3>
          <p className="text-xs text-gray-500">Visual chronological record of working hours and completed activities</p>
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold text-gray-600">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Active Work</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Break</span>
        </div>
      </div>

      {/* Timeline List */}
      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {events.map((ev, idx) => (
          <div key={ev.id} className="relative group">
            {/* Timeline Dot */}
            <div className={`absolute -left-6 top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-xs flex items-center justify-center ${
              ev.type === 'ATTENDANCE' ? 'bg-emerald-500' :
              ev.type === 'BREAK' ? 'bg-amber-400' :
              'bg-blue-600'
            }`}>
              <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
            </div>

            {/* Content Card */}
            <div className={`p-3 rounded-xl border transition-all ${
              ev.type === 'BREAK' 
                ? 'bg-amber-50/40 border-amber-200/60' 
                : 'bg-slate-50/80 border-slate-200/70 hover:bg-slate-50 hover:shadow-xs'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                <span className="text-xs font-bold text-slate-800">
                  {ev.timeRange}
                </span>

                <div className="flex items-center gap-1.5">
                  {ev.duration !== '—' && (
                    <span className="text-[10px] font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-md border border-primary-200/60">
                      ⏱ {ev.duration}
                    </span>
                  )}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                    ev.type === 'BREAK' ? 'bg-amber-100 text-amber-800' :
                    ev.type === 'ATTENDANCE' ? 'bg-emerald-100 text-emerald-800' :
                    'bg-slate-200 text-slate-700'
                  }`}>
                    {ev.category}
                  </span>
                </div>
              </div>

              <p className="text-xs font-semibold text-gray-900">{ev.title}</p>

              {ev.entityName && (
                <p className="text-[11px] text-primary-700 font-medium mt-0.5">
                  🔗 Related: <span className="font-bold">{ev.entityName}</span>
                </p>
              )}

              {ev.outcome && (
                <p className="text-[11px] text-emerald-700 font-medium mt-0.5 flex items-center gap-1">
                  <Check className="w-3 h-3 shrink-0" /> Outcome: {ev.outcome}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
