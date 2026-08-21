import React from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, ListTodo, Shield, FileText, Users, ArrowRight, DollarSign } from 'lucide-react';

interface WorkspaceKpiCardsProps {
  activeCounts: any;
  taskListFromApi: any[];
}

export default function WorkspaceKpiCards({
  activeCounts,
  taskListFromApi
}: WorkspaceKpiCardsProps) {
  // Using mock data for missing endpoints as per user request
  const leadsAssigned = activeCounts?.leads || 0;
  const contacts = activeCounts?.contacts || 0;
  const policies = activeCounts?.policies || 0;
  const claims = activeCounts?.claims || 0;
  const tasks = taskListFromApi?.length || 0;
  const pendingCommissions = 12500; // Mock data
  const upcomingRenewals = 8; // Mock data

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
      <Link
        to="/leads?assignedTo=me"
        className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer hover:no-underline group"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="bg-blue-50 p-2 rounded-xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <TrendingUp className="w-5 h-5" />
          </div>
          <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-800">{leadsAssigned}</p>
          <p className="text-[11px] text-gray-500 font-medium mt-0.5">Assigned Leads</p>
        </div>
      </Link>
      
      <Link
        to="/contacts?assignedTo=me"
        className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer hover:no-underline group"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="bg-purple-50 p-2 rounded-xl text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
            <Users className="w-5 h-5" />
          </div>
          <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-800">{contacts}</p>
          <p className="text-[11px] text-gray-500 font-medium mt-0.5">My Contacts</p>
        </div>
      </Link>

      <button
        type="button"
        className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer text-left group"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
            <ListTodo className="w-5 h-5" />
          </div>
          <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-800">{tasks}</p>
          <p className="text-[11px] text-gray-500 font-medium mt-0.5">Pending Tasks/Activity</p>
        </div>
      </button>

      <Link
        to="/policies?assignedTo=me"
        className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer hover:no-underline group"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="bg-green-50 p-2 rounded-xl text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
            <Shield className="w-5 h-5" />
          </div>
          <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-green-600 group-hover:translate-x-0.5 transition-all" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-800">{policies}</p>
          <p className="text-[11px] text-gray-500 font-medium mt-0.5">Active Policies</p>
        </div>
      </Link>

      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer text-left group">
        <div className="flex items-center justify-between mb-3">
          <div className="bg-amber-50 p-2 rounded-xl text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
            <Shield className="w-5 h-5" />
          </div>
          <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-800">{upcomingRenewals}</p>
          <p className="text-[11px] text-gray-500 font-medium mt-0.5">Upcoming Renewals</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer text-left group">
        <div className="flex items-center justify-between mb-3">
          <div className="bg-teal-50 p-2 rounded-xl text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">
            <DollarSign className="w-5 h-5" />
          </div>
          <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all" />
        </div>
        <div>
          <p className="text-lg font-bold text-gray-800">₹{pendingCommissions.toLocaleString()}</p>
          <p className="text-[11px] text-gray-500 font-medium mt-0.5">Pending Commissions</p>
        </div>
      </div>
    </div>
  );
}
