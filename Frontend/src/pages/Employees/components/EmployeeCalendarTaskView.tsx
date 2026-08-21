import React, { useState } from 'react';
import { 
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths 
} from 'date-fns';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, 
  Clock, CheckSquare, Sparkles, Repeat, Plus, Shield, 
  Users, CheckCircle2 
} from 'lucide-react';
import ExhaustiveTaskActivityModal from '../../Workspace/components/ExhaustiveTaskActivityModal';

interface EmployeeCalendarTaskViewProps {
  employeeId?: string;
  employeeName?: string;
  tasks?: any[];
}

const SAMPLE_EVENTS_AND_TASKS = [
  {
    id: 'e-1',
    title: 'Star Health Renewal Follow-up Call (Mehta Family)',
    date: new Date().toISOString(),
    time: '10:00 AM',
    type: 'TASK',
    priority: 'HIGH',
    entityName: 'Rajesh Mehta (#POL-4512)',
    isRecurring: false
  },
  {
    id: 'e-2',
    title: 'Weekly Agency Sales Review Meeting [Event]',
    date: new Date().toISOString(),
    time: '11:30 AM',
    type: 'EVENT',
    priority: 'CRITICAL',
    isRecurring: true,
    recurrence: 'WEEKLY'
  },
  {
    id: 'e-3',
    title: 'Dr. Vikrant Kulkarni Life Policy Proposal Discussion',
    date: new Date(Date.now() + 86400000).toISOString(),
    time: '03:00 PM',
    type: 'TASK',
    priority: 'CRITICAL',
    entityName: 'Dr. Vikrant Kulkarni',
    isRecurring: false
  },
  {
    id: 'e-4',
    title: 'Medical Underwriting KYC Verification (Sunita Patil)',
    date: new Date(Date.now() + 86400000 * 2).toISOString(),
    time: '02:00 PM',
    type: 'TASK',
    priority: 'MEDIUM',
    entityName: 'Sunita Patil (#POL-8902)',
    isRecurring: false
  },
  {
    id: 'e-5',
    title: 'Daily Shift Planning & Lead Allocation [Event]',
    date: new Date(Date.now() + 86400000 * 3).toISOString(),
    time: '09:15 AM',
    type: 'EVENT',
    priority: 'MEDIUM',
    isRecurring: true,
    recurrence: 'DAILY'
  }
];

export default function EmployeeCalendarTaskView({
  employeeId,
  employeeName = 'Employee',
  tasks = []
}: EmployeeCalendarTaskViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allCalendarItems, setAllCalendarItems] = useState(
    tasks.length > 0 ? tasks : SAMPLE_EVENTS_AND_TASKS
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const selectedDateItems = allCalendarItems.filter(item => {
    const itemDate = new Date(item.date || item.dueDate || item.createdAt);
    return isSameDay(itemDate, selectedDate);
  });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
      
      {/* Top Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-purple-600" />
            Calendar & Scheduled Events Merge
          </h3>
          <p className="text-xs text-gray-500">
            Unified view of deadline-pinned tasks and recurring scheduled calendar events for {employeeName}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span> Tasks
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-600"></span> Events (Recurring)
            </span>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-white text-gray-600 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-gray-800 px-2 min-w-[110px] text-center">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-white text-gray-600 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Schedule Event / Task
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Monthly Grid (Left 2 Columns) */}
        <div className="lg:col-span-2 space-y-2">
          {/* Day Names Header */}
          <div className="grid grid-cols-7 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider pb-1">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Day Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {days.map((day, idx) => {
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isSelected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, new Date());

              const dayItems = allCalendarItems.filter(item => {
                const itemDate = new Date(item.date || item.dueDate || item.createdAt);
                return isSameDay(itemDate, day);
              });

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDate(day)}
                  className={`min-h-[85px] p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-purple-50/70 border-purple-400 ring-2 ring-purple-200'
                      : isToday
                      ? 'bg-blue-50/40 border-blue-200'
                      : isCurrentMonth
                      ? 'bg-slate-50/70 hover:bg-slate-100/70 border-slate-200/70'
                      : 'bg-slate-50/20 border-slate-100 text-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${
                      isSelected ? 'text-purple-900 font-black' : isToday ? 'text-blue-700 font-bold' : isCurrentMonth ? 'text-gray-800' : 'text-gray-300'
                    }`}>
                      {format(day, 'd')}
                    </span>
                    {dayItems.length > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-purple-200 text-purple-800">
                        {dayItems.length}
                      </span>
                    )}
                  </div>

                  {/* Micro Chips for Day */}
                  <div className="space-y-1 mt-1">
                    {dayItems.slice(0, 2).map((item, i) => {
                      const isEvent = item.type === 'EVENT' || item.isRecurring;
                      return (
                        <div
                          key={i}
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded truncate ${
                            isEvent 
                              ? 'bg-purple-100 text-purple-800 border border-purple-200/60' 
                              : 'bg-blue-100 text-blue-800 border border-blue-200/60'
                          }`}
                        >
                          {isEvent ? '⚡ ' : '📋 '}
                          {item.title}
                        </div>
                      );
                    })}
                    {dayItems.length > 2 && (
                      <span className="text-[8px] font-bold text-gray-400 block text-right">
                        +{dayItems.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Date Detail Sidebar (Right Column) */}
        <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200/80 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Schedule for</span>
                <h4 className="text-sm font-bold text-gray-900">
                  {format(selectedDate, 'EEEE, dd MMMM yyyy')}
                </h4>
              </div>
              <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2.5 py-1 rounded-xl">
                {selectedDateItems.length} Items
              </span>
            </div>

            {/* List */}
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
              {selectedDateItems.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-xs">
                  No scheduled tasks or events for this date.
                </div>
              ) : (
                selectedDateItems.map(item => {
                  const isEvent = item.type === 'EVENT' || item.isRecurring;
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 bg-white rounded-2xl border border-gray-200 shadow-2xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          isEvent 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {isEvent ? '⚡ Calendar Event' : '📋 Task'}
                        </span>

                        <span className="text-[10px] font-semibold text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {item.time || '10:00 AM'}
                        </span>
                      </div>

                      <h5 className="text-xs font-bold text-gray-900 leading-snug">
                        {item.title}
                      </h5>

                      {item.entityName && (
                        <p className="text-[11px] text-primary-700 font-semibold truncate">
                          🔗 {item.entityName}
                        </p>
                      )}

                      {item.recurrence && item.recurrence !== 'NONE' && (
                        <span className="text-[10px] font-bold text-purple-700 flex items-center gap-1 mt-1">
                          <Repeat className="w-3 h-3" /> Repeats: {item.recurrence}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Event for {format(selectedDate, 'dd MMM')}
          </button>
        </div>

      </div>

      {/* Task / Event Modal */}
      <ExhaustiveTaskActivityModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={(payload) => {
          setAllCalendarItems(prev => [
            {
              ...payload,
              id: `ce-${Date.now()}`,
              date: payload.dueDate || selectedDate.toISOString(),
              time: '10:00 AM',
              type: payload.isRecurring ? 'EVENT' : 'TASK'
            },
            ...prev
          ]);
        }}
        employeesList={[]}
        initialMode="TASK"
      />

    </div>
  );
}
