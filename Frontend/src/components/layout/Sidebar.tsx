import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, Users, TrendingUp, Shield, FileText,
  UserCheck, DollarSign, MessageSquare, Calendar,
  CreditCard, LogOut, ChevronLeft, ChevronRight, Building2,
  Lock, Briefcase, Zap, Trash2
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
  { to: '/policies?tab=emi', label: 'Installments Tracking', Icon: CreditCard, feature: 'policies' },
  { to: '/claims',       label: 'Claims',       Icon: FileText,        feature: 'claims' },
  { to: '/calendar',     label: 'Calendar',     Icon: Calendar,        feature: 'calendar' },
  { to: '/whatsapp',     label: 'WhatsApp',     Icon: MessageSquare,   roles: ['OWNER', 'SUPERADMIN'], feature: 'whatsapp' },
  { to: '/operations',   label: 'Operations',   Icon: Briefcase,       roles: ['OWNER', 'SUPERADMIN'], feature: 'operations' },
  { to: '/commissions',  label: 'Commissions',  Icon: DollarSign,      roles: ['OWNER', 'SUPERADMIN'], feature: 'commissions' },
  { to: '/employees',    label: 'Employees',    Icon: UserCheck,       roles: ['OWNER', 'SUPERADMIN'], feature: 'employees' },
  { to: '/subscription', label: 'Subscription', Icon: CreditCard,      roles: ['OWNER', 'SUPERADMIN'] },
  { to: '/firm-profile', label: 'Firm Profile', Icon: Building2,       roles: ['OWNER', 'SUPERADMIN'], feature: 'branding' },
];

const OVERVIEW_ROUTES = ['/dashboard', '/workspace'];
const OPS_ROUTES      = ['/contacts', '/leads', '/policies', '/claims', '/calendar', '/whatsapp', '/operations'];
const MGMT_ROUTES     = ['/employees', '/commissions', '/subscription', '/firm-profile'];

interface NavGroupProps {
  title: string;
  items: typeof NAV;
  collapsed: boolean;
  isFeatureEnabled: (feature?: string) => boolean;
  setLockedFeature: (label: string) => void;
  user: any;
}

interface NavItemProps {
  item: typeof NAV[0];
  collapsed: boolean;
  isFeatureEnabled: (feature?: string) => boolean;
  setLockedFeature: (label: string) => void;
  setTooltip: (tooltip: { label: string; enabled: boolean; top: number } | null) => void;
}

function NavItem({ item, collapsed, isFeatureEnabled, setLockedFeature, setTooltip }: NavItemProps) {
  const { to, label, Icon, feature } = item;
  const enabled = isFeatureEnabled(feature);

  return (
    <NavLink
      key={to}
      to={to}
      onClick={(e) => { if (!enabled) { e.preventDefault(); setLockedFeature(label); } }}
      onMouseEnter={(e) => {
        if (collapsed) {
          const rect = e.currentTarget.getBoundingClientRect();
          setTooltip({ label, enabled, top: rect.top + rect.height / 2 });
        }
      }}
      onMouseLeave={() => setTooltip(null)}
      className={({ isActive }) =>
        clsx(
          'flex items-center rounded-xl font-medium transition-all duration-200 relative group select-none',
          collapsed
            ? 'justify-center w-10 h-10 mx-auto my-0.5'
            : 'gap-3.5 px-3 py-2 text-[13px] hover:translate-x-0.5 my-0.5',
          isActive && enabled
            ? collapsed
              ? 'bg-blue-600/20 text-white ring-1 ring-blue-500/40'
              : 'bg-white/10 text-white shadow-md border-l-2 border-blue-400 pl-[12px]'
            : 'text-slate-300 hover:bg-white/[0.08] hover:text-white border-l-2 border-transparent',
          !enabled && 'opacity-35 cursor-not-allowed',
        )
      }
    >
      {({ isActive }) => (
        <>
          <div className={clsx(
            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200",
            isActive && enabled
              ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/30"
              : "bg-white/[0.05] text-slate-300 group-hover:bg-white/[0.1] group-hover:text-white"
          )}>
            <Icon size={16} className="transition-transform duration-200 group-hover:scale-110" strokeWidth={2.25} />
          </div>
          {!collapsed && (
            <>
              <span className="flex-1 truncate leading-none ml-1">{label}</span>
              {!enabled && (
                <Lock size={11} className="text-slate-500 shrink-0" />
              )}
            </>
          )}
        </>
      )}
    </NavLink>
  );
}

function NavGroup({ title, items, collapsed, isFeatureEnabled, setLockedFeature, setTooltip, isFirst }: NavGroupProps & { setTooltip: (tooltip: any) => void; isFirst?: boolean }) {
  if (!items.length) return null;
  return (
    <div className="space-y-0.5">
      {!collapsed && title && (
        <p className={clsx("text-[10px] font-bold uppercase tracking-[0.2em] px-3.5 pb-1 select-none text-slate-500", isFirst ? "pt-1" : "pt-3")}>
          {title}
        </p>
      )}
      {collapsed && !isFirst && (
        <div className="w-7 h-[1px] bg-white/[0.08] mx-auto my-1.5 rounded-full" />
      )}
      {items.map((item) => (
        <NavItem
          key={item.to}
          item={item}
          collapsed={collapsed}
          isFeatureEnabled={isFeatureEnabled}
          setLockedFeature={setLockedFeature}
          setTooltip={setTooltip}
        />
      ))}
    </div>
  );
}

export default function Sidebar({ mobileOpen, setMobileOpen }: { mobileOpen: boolean; setMobileOpen: (v: boolean) => void }) {
  const [collapsed, setCollapsed]         = useState(true);
  const [lockedFeature, setLockedFeature] = useState<string | null>(null);
  const [tooltip, setTooltip]             = useState<{ label: string; enabled: boolean; top: number } | null>(null);
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
    if (user?.role === 'OWNER' || user?.role === 'SUPERADMIN') return true;
    if (user?.role === 'EMPLOYEE') {
      const perms: string[] = (user as any)?.permissions || [];
      const modKey = item.to.replace('/', '').replace('-', '_');
      const hasPerm = perms.some((p: string) => p.includes(modKey));
      if (hasPerm) return true;
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
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={clsx(
          'flex flex-col h-screen shrink-0 select-none border-r',
          'transition-all duration-300 ease-in-out',
          'fixed md:sticky top-0 z-50 md:z-30',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
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
          'flex items-center shrink-0 px-5 py-2 group relative',
          collapsed ? 'justify-center px-0' : 'gap-3.5',
        )}
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20 ring-1 ring-white/15 cursor-pointer"
             style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)' }}>
          <Shield className="text-white drop-shadow-sm animate-pulse-subtle" size={18} strokeWidth={2.25} />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-none min-w-0">
            <span className="font-extrabold text-[14px] text-white tracking-tight bg-gradient-to-r from-white via-white to-blue-100 bg-clip-text text-transparent">
              Insumitra
            </span>
            <span className="text-[8.5px] font-extrabold tracking-[0.2em] uppercase mt-[5.5px] text-blue-400/90">
              CRM Portal
            </span>
          </div>
        )}
      </div>

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto pt-1 pb-2 space-y-0.5 custom-scrollbar px-3 relative">
        <NavGroup
          title="Overview"
          items={overviewItems}
          collapsed={collapsed}
          isFeatureEnabled={isFeatureEnabled}
          setLockedFeature={setLockedFeature}
          setTooltip={setTooltip}
          user={user}
          isFirst
        />
        <NavGroup
          title="Operations"
          items={opsItems}
          collapsed={collapsed}
          isFeatureEnabled={isFeatureEnabled}
          setLockedFeature={setLockedFeature}
          setTooltip={setTooltip}
          user={user}
        />
        {(mgmtItems.length > 0) && (
          <NavGroup
            title="Management"
            items={mgmtItems}
            collapsed={collapsed}
            isFeatureEnabled={isFeatureEnabled}
            setLockedFeature={setLockedFeature}
            setTooltip={setTooltip}
            user={user}
          />
        )}
      </nav>

      {/* ── Upgrade banner (Free plan only) ──────────────────────────────── */}
      {!collapsed && planName === 'Free' && (
        <div className="mx-3.5 mb-3 rounded-2xl p-4 relative overflow-hidden"
             style={{
               background: 'linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(124,58,237,0.08) 100%)',
               border: '1px solid rgba(255,255,255,0.05)',
             }}>
          <div className="flex flex-wrap items-center gap-2 mb-2 relative">
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

      {collapsed && planName === 'Free' && (
        <div className="mb-2 relative group flex justify-center">
          <button
            onClick={() => navigate('/subscription')}
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltip({ label: 'Upgrade Plan', enabled: true, top: rect.top + rect.height / 2 });
            }}
            onMouseLeave={() => setTooltip(null)}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600/30 to-indigo-600/30 border border-blue-500/30 flex items-center justify-center text-blue-400 hover:bg-blue-600/40 hover:text-white transition-all shadow-sm"
          >
            <Zap size={15} />
          </button>
        </div>
      )}

      {/* ── User + Logout ───────────────────────────────────────────────── */}


      {/* Floating Tooltip outside overflow container */}
      {collapsed && tooltip && (
        <div
          className="fixed left-[72px] px-3 py-1.5 rounded-xl bg-slate-900/95 border border-slate-700/80 text-xs font-bold text-white shadow-2xl z-[99999] pointer-events-none whitespace-nowrap flex flex-wrap items-center gap-1.5 animate-fadeIn"
          style={{ top: `${tooltip.top}px`, transform: 'translateY(-50%)' }}
        >
          {tooltip.label}
          {!tooltip.enabled && <Lock size={10} className="text-slate-400" />}
        </div>
      )}

      <UpgradePromptModal
        isOpen={!!lockedFeature}
        onClose={() => setLockedFeature(null)}
        featureName={lockedFeature || ''}
      />
    </aside>
    </>
  );
}


