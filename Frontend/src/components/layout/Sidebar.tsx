import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, Users, TrendingUp, Shield, FileText,
  UserCheck, DollarSign, MessageSquare, Calendar,
  CreditCard, LogOut, ChevronLeft, ChevronRight, Building2,
  Lock, Briefcase, Zap, Target, Clock, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useState } from 'react';
import { authService } from '@api/auth.service';
import { subscriptionsService } from '@api/index';
import { useAuthStore } from '@store/auth.store';
import UpgradePromptModal from './UpgradePromptModal';
import clsx from 'clsx';

const NAV: { to: string; label: string; Icon: React.ElementType; roles?: string[]; feature?: string }[] = [
  { to: '/dashboard',    label: 'Dashboard',    Icon: LayoutDashboard, roles: ['OWNER', 'SUPERADMIN'], feature: 'dashboard' },
  { to: '/workspace',    label: 'Workspace',    Icon: Briefcase,       roles: ['EMPLOYEE', 'OWNER', 'SUPERADMIN'], feature: 'workspace' },
  { to: '/contacts',     label: 'Contacts',     Icon: Users,           feature: 'contacts' },
  { to: '/leads',        label: 'Leads',        Icon: TrendingUp,      feature: 'leads' },
  { to: '/policies',     label: 'Policies',     Icon: Shield,          feature: 'policies' },
  { to: '/claims',       label: 'Claims',       Icon: FileText,        feature: 'claims' },
  { to: '/calendar',     label: 'Calendar',     Icon: Calendar,        feature: 'calendar' },
  { to: '/whatsapp',     label: 'WhatsApp',     Icon: MessageSquare,   roles: ['OWNER', 'SUPERADMIN'], feature: 'whatsapp' },
  { to: '/operations',   label: 'Operations',   Icon: Briefcase,       roles: ['OWNER', 'SUPERADMIN'], feature: 'operations' },
  { to: '/commissions',  label: 'Commissions',  Icon: DollarSign,      roles: ['OWNER', 'SUPERADMIN'], feature: 'commissions' },
  { to: '/subscription', label: 'Subscription', Icon: CreditCard,      roles: ['OWNER', 'SUPERADMIN'] },
  { to: '/firm-profile', label: 'Firm Profile', Icon: Building2,       roles: ['OWNER', 'SUPERADMIN'], feature: 'branding' },
];

const EMPLOYEE_SUB_ITEMS = [
  { to: '/employees',               label: 'Overview',       Icon: UserCheck,  end: true  },
  { to: '/employees/targets',       label: 'Targets',        Icon: Target,     end: false },
  { to: '/employees/attendance',    label: 'Attendance',     Icon: Clock,      end: false },
  { to: '/employees/eod-reports',   label: 'EOD Reports',    Icon: FileText,   end: false },
  { to: '/employees/access-control',label: 'Access Control', Icon: Shield,     end: false },
];

const OVERVIEW_ROUTES = ['/dashboard', '/workspace'];
const OPS_ROUTES      = ['/contacts', '/leads', '/policies', '/claims', '/calendar', '/whatsapp', '/operations'];
const MGMT_ROUTES     = ['/commissions', '/subscription', '/firm-profile'];

interface NavGroupProps {
  title: string;
  items: typeof NAV;
  collapsed: boolean;
  isFeatureEnabled: (feature?: string) => boolean;
  setLockedFeature: (label: string) => void;
  user: any;
}

function NavGroup({ title, items, collapsed, isFeatureEnabled, setLockedFeature }: NavGroupProps) {
  if (!items.length) return null;
  return (
    <div className="space-y-px">
      {!collapsed && title && (
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] px-3.5 pb-2 pt-4 select-none text-slate-500">
          {title}
        </p>
      )}
      {items.map(({ to, label, Icon, feature }) => {
        const enabled = isFeatureEnabled(feature);
        return (
          <NavLink
            key={to}
            to={to}
            onClick={(e) => { if (!enabled) { e.preventDefault(); setLockedFeature(label); } }}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all duration-200 relative group select-none',
                collapsed ? 'justify-center px-0 w-10 h-10 mx-auto mb-1' : 'hover:translate-x-0.5',
                isActive && enabled
                  ? 'bg-white/10 text-white shadow-md border-l-2 border-blue-400 pl-[12px]'
                  : 'text-slate-300 hover:bg-white/[0.06] hover:text-white border-l-2 border-transparent',
                !enabled && 'opacity-35 cursor-not-allowed pointer-events-none',
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={clsx(
                  "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200",
                  isActive && enabled
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                    : "bg-white/[0.05] text-slate-355 group-hover:bg-white/[0.1] group-hover:text-white"
                )}>
                  <Icon size={16} className="transition-transform duration-200 group-hover:scale-110" strokeWidth={2.25} />
                </div>
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate leading-none">{label}</span>
                    {!enabled && (
                      <Lock size={11} className="text-slate-600 shrink-0" />
                    )}
                  </>
                )}
                {/* Collapsed Tooltip */}
                {collapsed && (
                  <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-100 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all duration-150 pointer-events-none whitespace-nowrap shadow-xl z-50">
                    {label}
                    {!enabled && <Lock size={10} className="inline ml-1 text-slate-500" />}
                  </div>
                )}
              </>
            )}
          </NavLink>
        );
      })}
    </div>
  );
}

// ── Employees expandable sub-menu ─────────────────────────────────────────────
interface EmployeesMenuProps {
  collapsed: boolean;
  isEnabled: boolean;
  setLockedFeature: (label: string) => void;
}

function EmployeesMenu({ collapsed, isEnabled, setLockedFeature }: EmployeesMenuProps) {
  const location = useLocation();
  const isOnEmployees = location.pathname.startsWith('/employees');
  const [open, setOpen] = useState(isOnEmployees);

  const linkBase = clsx(
    'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-medium transition-all duration-200 relative group select-none w-full',
    collapsed ? 'justify-center px-0 w-10 h-10 mx-auto mb-1' : 'hover:translate-x-0.5',
  );

  // In collapsed mode, just show the icon linking to /employees
  if (collapsed) {
    return (
      <NavLink
        to="/employees"
        end
        onClick={(e) => { if (!isEnabled) { e.preventDefault(); setLockedFeature('Employees'); } }}
        title="Employees"
        className={({ isActive }) =>
          clsx(
            linkBase,
            isActive && isEnabled
              ? 'bg-white/10 text-white shadow-md border-l-2 border-blue-400 pl-[12px]'
              : 'text-slate-300 hover:bg-white/[0.06] hover:text-white border-l-2 border-transparent',
            !isEnabled && 'opacity-35 cursor-not-allowed pointer-events-none',
          )
        }
      >
        <UserCheck size={16} className="shrink-0 transition-transform duration-200 group-hover:scale-110" strokeWidth={2} />
        <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-100 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all duration-150 pointer-events-none whitespace-nowrap shadow-xl z-50">
          Employees
          {!isEnabled && <Lock size={10} className="inline ml-1 text-slate-500" />}
        </div>
      </NavLink>
    );
  }

  return (
    <div className={clsx(
      "transition-all duration-200 px-1 mb-1.5",
      open && isEnabled && "bg-[#111c44] border border-[#1b2559] rounded-2xl p-1 pb-1.5 mt-1"
    )}>
      {/* Parent row — clicking toggles sub-menu */}
      <button
        onClick={() => {
          if (!isEnabled) { setLockedFeature('Employees'); return; }
          setOpen(o => !o);
        }}
        className={clsx(
          linkBase,
          isOnEmployees && isEnabled
            ? 'bg-white/10 text-white shadow-md border-l-2 border-blue-400 pl-[12px]'
            : 'text-slate-300 hover:bg-white/[0.06] hover:text-white border-l-2 border-transparent',
          !isEnabled && 'opacity-35 cursor-not-allowed pointer-events-none',
        )}
      >
        <div className={clsx(
          "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 mr-0.5",
          isOnEmployees && isEnabled
            ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
            : "bg-white/[0.05] text-slate-355 group-hover:bg-white/[0.1] group-hover:text-white"
        )}>
          <UserCheck size={16} className="transition-transform duration-200 group-hover:scale-110" strokeWidth={2.25} />
        </div>
        <span className="flex-1 truncate leading-none text-left">Employees</span>
        {isEnabled && (
          open
            ? <ChevronUp size={12} className="shrink-0 text-slate-500" />
            : <ChevronDown size={12} className="shrink-0 text-slate-500" />
        )}
        {!isEnabled && <Lock size={11} className="text-slate-600 shrink-0" />}
      </button>

      {/* Sub-items */}
      {open && isEnabled && (
        <div className="mt-1 space-y-0.5 pl-1.5">
          {EMPLOYEE_SUB_ITEMS.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-xl px-3 py-2 text-[12px] font-medium transition-all duration-150 group select-none',
                  isActive
                    ? 'text-white bg-white/10 shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className={clsx(
                    "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200",
                    isActive
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-white/[0.03] text-slate-400 group-hover:bg-white/[0.06] group-hover:text-white"
                  )}>
                    <Icon size={13} className="transition-transform duration-200 group-hover:scale-110" strokeWidth={2.25} />
                  </div>
                  <span className="truncate">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const [collapsed, setCollapsed]         = useState(false);
  const [lockedFeature, setLockedFeature] = useState<string | null>(null);
  const user                              = useAuthStore(s => s.user);
  const navigate                          = useNavigate();

  const { data: subRes } = useQuery({
    queryKey: ['subscription', 'current'],
    queryFn:  subscriptionsService.current,
    staleTime: 5 * 60_000,
    enabled:  !!user,
  });

  const planName = subRes?.data?.plan?.name || 'Free';

  const isFeatureEnabled = (feature?: string) => {
    if (user?.role === 'SUPERADMIN') return true;
    if (!feature) return true;
    const free    = ['contacts', 'policies', 'claims', 'calendar', 'workspace'];
    const starter = [...free, 'dashboard', 'leads', 'documents', 'operations'];
    const growth  = [...starter, 'employees', 'commissions', 'branding'];
    if (free.includes(feature))    return true;
    if (planName === 'Starter')    return starter.includes(feature);
    if (planName === 'Growth')     return growth.includes(feature);
    if (['Enterprise', 'Business'].includes(planName)) return true;
    return false;
  };

  const visibleByRole = (item: typeof NAV[0]) => {
    if (item.to === '/whatsapp') {
      return user?.role === 'OWNER' || user?.role === 'SUPERADMIN' || (user?.role === 'EMPLOYEE' && (user as any)?.permissions?.includes('manage_whatsapp'));
    }
    return !item.roles || item.roles.includes(user?.role ?? '');
  };

  const overviewItems = NAV.filter(i => OVERVIEW_ROUTES.includes(i.to) && visibleByRole(i));
  const opsItems      = NAV.filter(i => OPS_ROUTES.includes(i.to)      && visibleByRole(i));
  const mgmtItems     = NAV.filter(i => MGMT_ROUTES.includes(i.to)     && visibleByRole(i));

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`;

  return (
    <aside
      className={clsx(
        'flex flex-col h-screen sticky top-0 z-30 shrink-0 relative',
        'transition-all duration-300 ease-in-out border-r',
        collapsed ? 'w-16' : 'w-64',
      )}
      style={{
        background: '#0b1437',
        borderColor: 'rgba(27, 37, 89, 0.6)',
      }}
    >
      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <div
        className={clsx(
          'flex items-center shrink-0 px-5 py-[22px]',
          collapsed ? 'justify-center px-0' : 'gap-3.5',
        )}
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20 ring-1 ring-white/15"
             style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)' }}>
          <Shield className="text-white drop-shadow-sm animate-pulse-subtle" size={18} strokeWidth={2.25} />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-none min-w-0">
            <span className="font-extrabold text-[16.5px] text-white tracking-tight bg-gradient-to-r from-white via-white to-blue-100 bg-clip-text text-transparent">
              InsuMitra
            </span>
            <span className="text-[8.5px] font-extrabold tracking-[0.2em] uppercase mt-[5.5px] text-blue-400/90">
              CRM Portal
            </span>
          </div>
        )}
      </div>

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1 custom-scrollbar px-3">
        <NavGroup
          title="Overview"
          items={overviewItems}
          collapsed={collapsed}
          isFeatureEnabled={isFeatureEnabled}
          setLockedFeature={setLockedFeature}
          user={user}
        />
        {(opsItems.length > 0) && <div style={{ height: 6 }} />}
        <NavGroup
          title="Operations"
          items={opsItems}
          collapsed={collapsed}
          isFeatureEnabled={isFeatureEnabled}
          setLockedFeature={setLockedFeature}
          user={user}
        />
        {/* Employees with expandable sub-menu — only for OWNER / SUPERADMIN */}
        {(user?.role === 'OWNER' || user?.role === 'SUPERADMIN' || (user?.role === 'EMPLOYEE' && (user as any)?.permissions?.includes('manage_employees'))) && (
          <>
            {!collapsed && (
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] px-3.5 pb-2 pt-4 select-none text-slate-500">
                Management
              </p>
            )}
            <EmployeesMenu
              collapsed={collapsed}
              isEnabled={isFeatureEnabled('employees')}
              setLockedFeature={setLockedFeature}
            />
            <NavGroup
              title=""
              items={mgmtItems}
              collapsed={collapsed}
              isFeatureEnabled={isFeatureEnabled}
              setLockedFeature={setLockedFeature}
              user={user}
            />
          </>
        )}
      </nav>

      {/* ── Upgrade banner (Free plan only) ──────────────────────────────── */}
      {!collapsed && planName === 'Free' && (
        <div className="mx-3.5 mb-3 rounded-2xl p-4 relative overflow-hidden"
             style={{
               background: 'linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(124,58,237,0.08) 100%)',
               border: '1px solid rgba(255,255,255,0.05)',
             }}>
          {/* Decorative glows */}
          <div className="absolute -right-4 -top-4 w-12 h-12 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="absolute -left-4 -bottom-4 w-12 h-12 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />

          <div className="flex items-center gap-2 mb-2 relative">
            <div className="w-5 h-5 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Zap size={11} className="text-blue-400 shrink-0" />
            </div>
            <p className="text-[12px] font-bold text-slate-200">Upgrade Plan</p>
          </div>
          <p className="text-[11px] leading-relaxed mb-3.5 text-slate-400 relative">
            Unlock leads, performance analytics &amp; smart features.
          </p>
          <button
            onClick={() => navigate('/subscription')}
            className="w-full py-2 rounded-xl text-[11px] font-bold text-white transition-all duration-200 relative
                       bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500
                       hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.97]"
          >
            View Premium Plans
          </button>
        </div>
      )}

      {/* ── User + collapse ───────────────────────────────────────────────── */}
      <div className="shrink-0 p-3 space-y-1.5"
           style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        {/* User row */}
        {!collapsed && user && (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/[0.02]"
               style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center
                            text-white text-[12px] font-bold shrink-0 shadow-inner">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-slate-100 truncate leading-none">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-[9px] uppercase font-bold tracking-wider mt-1 text-slate-500">
                {user.role}
              </p>
            </div>
          </div>
        )}

        {/* Logout row */}
        <button
          onClick={handleLogout}
          title="Logout"
          className={clsx(
            'w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[12px] font-semibold transition-all duration-200',
            collapsed ? 'justify-center' : '',
            'text-slate-400 hover:bg-red-500/10 hover:text-red-400'
          )}
        >
          <LogOut size={15} strokeWidth={2} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      {/* Floating edge collapse toggle button */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-900 border border-slate-700/80 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shadow-md z-50 cursor-pointer hidden md:flex"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={11} strokeWidth={2.5} /> : <ChevronLeft size={11} strokeWidth={2.5} />}
      </button>

      <UpgradePromptModal
        isOpen={!!lockedFeature}
        onClose={() => setLockedFeature(null)}
        featureName={lockedFeature || ''}
      />
    </aside>
  );
}
