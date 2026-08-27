import React, { useState } from 'react';
import { 
  Plus, CheckSquare, Clock, ListTodo, AlertTriangle 
} from 'lucide-react';
import ExhaustiveTaskActivityModal from './ExhaustiveTaskActivityModal';
import DailyActivityTimeline from './DailyActivityTimeline';
import MyTasksPanel from './MyTasksPanel';
import OverdueWorkPanel from './OverdueWorkPanel';

interface UnifiedTaskActivityLogProps {
  tasks: any[];
  employeesList: any[];
  onToggleTask: (taskId: string, currentStatus: string) => void;
  onAddTask: (taskPayload: any) => void;
  isViewOnly?: boolean;
}

export default function UnifiedTaskActivityLog({
  tasks,
  employeesList,
  onToggleTask,
  onAddTask,
  isViewOnly = false
}: UnifiedTaskActivityLogProps) {
  const [activeSubTab, setActiveSubTab] = useState<'OVERDUE' | 'QUEUE' | 'TIMELINE'>('OVERDUE');
  const [showExhaustiveModal, setShowExhaustiveModal] = useState(false);
  const [modalMode, setModalMode] = useState<'TASK' | 'ACTIVITY'>('TASK');

  const handleCreateNew = (mode: 'TASK' | 'ACTIVITY') => {
    setModalMode(mode);
    setShowExhaustiveModal(true);
  };

  const closingTodayCount = tasks ? tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'DONE').length : 5;

  return (
    <div className="space-y-4">
      
      {/* Action Controls & Sub-Tab Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Sub-Tab Switcher: 1. Overdue, 2. Today's Queue, 3. Today's Timeline */}
        <div className="flex flex-wrap p-1 bg-slate-100 rounded-xl border border-slate-200 gap-1">
          <button
            type="button"
            onClick={() => setActiveSubTab('OVERDUE')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'OVERDUE' 
                ? 'bg-white text-rose-700 shadow-xs' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Overdue
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 font-bold border border-rose-200">
              4
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('QUEUE')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'QUEUE' 
                ? 'bg-white text-amber-700 shadow-xs' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ListTodo className="w-3.5 h-3.5 text-amber-600" /> Today's Queue
            {closingTodayCount > 0 && (
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200">
                {closingTodayCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('TIMELINE')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'TIMELINE' 
                ? 'bg-white text-primary-700 shadow-xs' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-primary-600" /> Today's Timeline
          </button>
        </div>

        {/* Single Unified Action Button */}
        {!isViewOnly && (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleCreateNew('TASK')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-extrabold flex items-center gap-2 transition-all shadow-md shadow-blue-500/25 hover:scale-105 cursor-pointer select-none"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Schedule / Log</span>
            </button>
          </div>
        )}
      </div>

      {/* View 1: Overdue & Critical Items */}
      {activeSubTab === 'OVERDUE' && (
        <OverdueWorkPanel />
      )}

      {/* View 2: Today's Queue */}
      {activeSubTab === 'QUEUE' && (
        <MyTasksPanel 
          tasks={tasks} 
          employeesList={employeesList}
          onToggleTask={onToggleTask}
          onAddTask={onAddTask}
          isViewOnly={isViewOnly} 
        />
      )}

      {/* View 3: Today's Timeline */}
      {activeSubTab === 'TIMELINE' && (
        <DailyActivityTimeline />
      )}

      {/* Exhaustive Task / Activity Modal */}
      <ExhaustiveTaskActivityModal
        isOpen={showExhaustiveModal}
        onClose={() => setShowExhaustiveModal(false)}
        onSave={onAddTask}
        employeesList={employeesList}
        initialMode={modalMode}
      />

    </div>
  );
}

