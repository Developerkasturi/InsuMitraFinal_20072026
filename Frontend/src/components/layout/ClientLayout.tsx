import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useClientStore } from '@store/client.store';
import { useAuthStore } from '@store/auth.store';
import { useQuery } from '@tanstack/react-query';
import { clientService } from '@api/client.service';
import { Shield, FileText, AlertCircle, User, LogOut, ArrowLeft } from 'lucide-react';

import { FALLBACK_CLIENT_PROFILE } from '@pages/Client/clientMockData';

const NAV = [
  { to: '/client/dashboard', label: 'Overview',       mobileLabel: 'Home',    icon: Shield },
  { to: '/client/policies',  label: 'Policies',       mobileLabel: 'Policies', icon: FileText },
  { to: '/client/claims',    label: 'Claims',         mobileLabel: 'Claims',  icon: AlertCircle },
  { to: '/client/profile',   label: 'Profile & Advisor', mobileLabel: 'Profile', icon: User },
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
  const agencyName = tenant?.name || 'InsuMitra Agency';
  const logoUrl = tenant?.logoUrl;
  const primaryColor = tenant?.primaryColor || '#0f766e';

  const crmReturnPath = crmUser?.role === 'EMPLOYEE' ? '/workspace' : '/dashboard';

  const handleLogout = () => {
    if (crmUser) {
      navigate(crmReturnPath);
      return;
    }
    if (clientLogout) clientLogout();
    useAuthStore.getState().logout();
    navigate('/login', { replace: true });
  };

  const displayName = crmUser
    ? `${crmUser.firstName || ''} ${crmUser.lastName || ''}`.trim() || (crmUser.role === 'OWNER' ? 'Agency Owner' : 'Employee')
    : `${clientUser?.firstName || profile?.firstName || 'Contact'} ${clientUser?.lastName || profile?.lastName || ''}`.trim();

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      {/* Top nav — Single clean line */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 transition-all duration-200 shadow-sm">
        {/* Main header row */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-6 flex-nowrap">
          
          {/* Left: Agency Logo & Name */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 min-w-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={agencyName}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain bg-white shadow-sm border border-slate-100 p-0.5 shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div 
                className="p-1.5 text-white rounded-lg shrink-0"
                style={{ backgroundColor: primaryColor }}
              >
                <Shield size={16} strokeWidth={2.5} />
              </div>
            )}
            <div className="flex flex-col leading-none min-w-0">
              <span className="font-extrabold text-slate-900 text-xs sm:text-sm md:text-base tracking-tight truncate max-w-[140px] sm:max-w-[220px] md:max-w-none">
                {agencyName}
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 tracking-wider uppercase mt-0.5 whitespace-nowrap">
                Contact Portal
              </span>
            </div>
          </div>

          {/* Centre: Desktop nav tabs */}
          <nav className="hidden lg:flex items-center gap-1 flex-nowrap">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 border ${
                    isActive
                      ? 'bg-blue-50/90 text-blue-600 border-blue-200/70'
                      : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/70'
                  }`
                }
              >
                <Icon size={13} strokeWidth={2.25} className="shrink-0" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Right: Exit Portal button */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 sm:gap-1.5 text-xs font-bold text-slate-600 hover:text-rose-600 hover:bg-rose-50 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200/80 hover:border-rose-200 transition-all duration-200 shrink-0 whitespace-nowrap cursor-pointer"
            title={crmUser ? 'Exit Portal back to CRM' : 'Logout from Contact Portal'}
          >
            <LogOut size={14} strokeWidth={2.25} />
            <span className="hidden sm:inline">Exit Portal</span>
          </button>
        </div>

        {/* Mobile & Tablet Tab Bar (hidden on lg+) */}
        <nav className="lg:hidden flex border-t border-slate-100 bg-white/95 backdrop-blur-md">
          {NAV.map(({ to, mobileLabel, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center py-2 text-[10px] font-bold tracking-wide gap-0.5 transition-colors ${
                  isActive ? 'text-teal-600' : 'text-slate-500 hover:text-slate-700'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  <span>{mobileLabel}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <Outlet />
      </main>

      <footer className="text-center text-xs text-gray-400 py-3 sm:py-4 border-t border-slate-100 bg-white">
        Powered by {agencyName} · Personalized Insurance Desk
      </footer>
    </div>
  );
}
