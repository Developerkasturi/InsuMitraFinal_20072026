import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { insuranceService } from '@api/index';
import { TABLE_COLUMNS_CONFIG } from '../../constants/tableColumns';
import { tableVisibilityManager } from '../../utils/TableVisibilityManager';

interface TableColumnSettingsProps {
  onBack: () => void;
}

export default function TableColumnSettings({ onBack }: TableColumnSettingsProps) {
  const qc = useQueryClient();
  const [selectedPageId, setSelectedPageId] = useState<string>(TABLE_COLUMNS_CONFIG[0].pageId);

  const { data: visibilityRulesRes, isLoading } = useQuery({
    queryKey: ['table-columns'],
    queryFn: () => insuranceService.getTableColumnVisibility(),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { pageId: string; colName: string; isHidden: boolean }) =>
      insuranceService.updateTableColumnVisibility(data.pageId, data.colName, data.isHidden),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['table-columns'] }).then(() => {
        // Optimistically update local rules inside the manager to reflect instantly
        if (visibilityRulesRes?.data) {
          const arr: any[] = visibilityRulesRes.data;
          const idx = arr.findIndex(a => a.pageId === variables.pageId && a.colName === variables.colName);
          if (idx >= 0) arr[idx].isHidden = variables.isHidden;
          else arr.push({ ...variables, tenantId: 'local' });
          tableVisibilityManager.setRules(arr);
        }
      });
      toast.success(`${variables.colName} is now ${variables.isHidden ? 'Hidden' : 'Visible'}`);
    },
    onError: () => toast.error('Failed to update visibility'),
  });

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  const rules = visibilityRulesRes?.data || [];
  
  const getIsHidden = (pageId: string, colName: string) => {
    const rule = rules.find((r: any) => r.pageId === pageId && r.colName === colName);
    return rule ? rule.isHidden : false;
  };

  const handleToggle = (colName: string) => {
    const isCurrentlyHidden = getIsHidden(selectedPageId, colName);
    updateMutation.mutate({ pageId: selectedPageId, colName, isHidden: !isCurrentlyHidden });
  };

  const handleReset = () => {
    // Reset all rules for this page
    const tasks = TABLE_COLUMNS_CONFIG.find(p => p.pageId === selectedPageId)?.columns.map(col => {
      if (getIsHidden(selectedPageId, col)) {
        return updateMutation.mutateAsync({ pageId: selectedPageId, colName: col, isHidden: false });
      }
      return null;
    }).filter(Boolean);
    
    if (tasks && tasks.length > 0) {
      Promise.all(tasks).then(() => {
        toast.success(`Reset ${selectedPageId} columns to default (Show All).`);
      });
    } else {
      toast.success('Columns are already fully visible.');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <button onClick={onBack} className="hover:text-primary-600 transition-colors flex items-center gap-1 cursor-pointer">
            <ArrowLeft size={13} /> Master Settings & Backups
          </button>
          <span>&gt;</span>
          <span className="text-slate-800">Table Column Visibility</span>
        </div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight mt-2">Column Visibility Configuration</h2>
        <p className="text-xs text-slate-500 font-semibold leading-tight mt-0.5">Control which table columns to show or hide globally across different modules.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Navigation for Tables */}
        <div className="w-full md:w-64 shrink-0 flex flex-col gap-1 border-r border-slate-200 pr-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-3">Available Tables</h4>
          {TABLE_COLUMNS_CONFIG.map(config => (
            <button
              key={config.pageId}
              onClick={() => setSelectedPageId(config.pageId)}
              className={`text-left px-3 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                selectedPageId === config.pageId ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {config.pageName}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              Columns for {TABLE_COLUMNS_CONFIG.find(p => p.pageId === selectedPageId)?.pageName}
            </h3>
            <button 
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
            >
              <RotateCcw size={13} />
              Reset to Default (Show All)
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Column Name</th>
                  <th className="px-5 py-3 text-center w-32">Status</th>
                  <th className="px-5 py-3 text-right w-24">Visibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {TABLE_COLUMNS_CONFIG.find(p => p.pageId === selectedPageId)?.columns.map((col) => {
                  const isHidden = getIsHidden(selectedPageId, col);
                  return (
                    <tr key={col} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3.5 font-medium text-slate-800">{col}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                          !isHidden 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' 
                            : 'bg-rose-50 text-rose-700 border border-rose-200/50'
                        }`}>
                          {!isHidden ? 'Showing' : 'Hidden'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => handleToggle(col)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            !isHidden ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                              !isHidden ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
