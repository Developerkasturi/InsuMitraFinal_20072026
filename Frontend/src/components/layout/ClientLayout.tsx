import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useClientStore } from '@store/client.store';
import { useAuthStore } from '@store/auth.store';
import { useQuery } from '@tanstack/react-query';
import { clientService } from '@api/client.service';
import { Shield, FileText, AlertCircle, User, LogOut, ArrowLeft } from 'lucide-react';

import { FALLBACK_CLIENT_PROFILE } from '@pages/Client/clientMockData';

const NAV = [
  { to: '/client/dashboard', label: 'Overview',  icon: Shield },
  { to: '/client/policies',  label: 'Policies',  icon: FileText },
  { to: '/client/claims',    label: 'Claims',    icon: AlertCircle },
  { to: '/client/profile',   label: 'Profile & Advisor',   icon: User },
];

export default function ClientLayout() {
  const { user: clientUser, logout: clientLogout } = useClientStore();
  const crmUser = useAuthStore(s => s.user);
  const navigate = useNavigate();

  const { data: profileData } = useQuery({
    queryKey: ['client-me'],
    queryFn:  clientService.getMe,
    staleTime: 5 * 60_000,
  });

  const profile = profileData?.data || FALLBACK_CLIENT_PROFILE;
  const tenant = profile?.tenant;
  const agencyName = tenant?.name || 'Sampada Investment Solutions';
  const logoUrl = tenant?.logoUrl;
  const primaryColor = tenant?.primaryColor || '#2563eb';

  const handleLogout = () => {
    if (clientLogout) clientLogout();
    navigate(crmUser ? '/dashboard' : '/client/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      {/* Top nav */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-30 transition-all duration-200">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={agencyName}
                className="w-9 h-9 rounded-xl object-contain bg-white shadow-xs border border-slate-100 p-0.5"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div 
                className="p-1.5 text-white rounded-lg shadow-xs"
                style={{ backgroundColor: primaryColor }}
              >
                <Shield size={18} strokeWidth={2.5} />
              </div>
            )}
            <div className="flex flex-col leading-none">
              <span className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight truncate max-w-[200px] sm:max-w-xs">
                {agencyName}
              </span>
              <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mt-0.5">
                Contact Portal
              </span>
            </div>
          </div>

          <nav className="hidden sm:flex flex-wrap items-center gap-1.5">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-250 border ${
                    isActive
                      ? 'bg-blue-50/80 text-blue-600 border-blue-100/60 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-50'
                  }`
                }
              >
                <Icon size={14} strokeWidth={2.25} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {crmUser && (
              <button
                onClick={() => navigate('/dashboard')}
                className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 py-1.5 px-3 rounded-xl border border-blue-200 transition-colors cursor-pointer"
                title="Return to CRM Admin / Workspace"
              >
                <ArrowLeft size={13} /> Return to CRM
              </button>
            )}

            <span className="text-xs font-bold text-slate-700 hidden sm:block bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
              {clientUser?.firstName || crmUser?.firstName || profile?.firstName || 'Contact'} {clientUser?.lastName || crmUser?.lastName || profile?.lastName || ''}
            </span>
            <button
              onClick={handleLogout}
              className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors py-1.5 px-2.5 rounded-lg hover:bg-red-50/50 cursor-pointer"
            >
              <LogOut size={14} strokeWidth={2} />
              <span className="hidden sm:block">{crmUser ? 'Exit Portal' : 'Logout'}</span>
            </button>
          </div>
        </div>

        {/* Mobile Sub-Nav */}
        <nav className="sm:hidden flex border-t border-slate-100 bg-white/95 backdrop-blur-md">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center py-2 text-[10px] font-bold tracking-wide gap-1 transition-colors ${
                  isActive ? 'text-blue-600 font-black' : 'text-slate-500'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>

      <footer className="text-center text-xs text-gray-400 py-4 border-t border-slate-100 bg-white">
        Powered by {agencyName} · Personalized Insurance Desk
      </footer>
    </div>
  );
}
