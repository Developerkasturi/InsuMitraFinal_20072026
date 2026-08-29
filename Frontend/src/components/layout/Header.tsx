import { Bell, Search, ChevronDown, User, Settings, LogOut, Camera, Users, Shield, FileText, TrendingUp, Menu } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { notificationsService, searchService } from '@api/index';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@store/auth.store';
import { authService } from '@api/auth.service';

import { useDebounce } from '@hooks/useDebounce';
import TopBarShiftTracker from './TopBarShiftTracker';

const SECTION_META: Record<string, { label: string; Icon: React.ElementType; color: string; iconBg: string }> = {
  contacts: { label: 'Contacts', Icon: Users, color: 'text-blue-600', iconBg: 'bg-blue-50' },
  policies: { label: 'Policies', Icon: Shield, color: 'text-emerald-600', iconBg: 'bg-emerald-50' },
  claims: { label: 'Claims', Icon: FileText, color: 'text-amber-600', iconBg: 'bg-amber-50' },
  leads: { label: 'Leads', Icon: TrendingUp, color: 'text-purple-600', iconBg: 'bg-purple-50' },
};

export default function Header({ title, setMobileOpen }: { title?: string, setMobileOpen: (v: boolean) => void }) {
  const [query, setQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifPop, setShowNotifPop] = useState(false);
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();

  const debouncedQuery = useDebounce(query.trim(), 300);

  const { data: notifs, refetch: refetchNotifs } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationsService.list({ limit: 10 }),
    refetchInterval: 30_000,
  });

  const { data: searchResults, isLoading: isSearchLoading, isError: isSearchError } = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn: () => searchService.search(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 0,
    retry: false,
  });

  const resultsObj = searchResults?.data?.contacts !== undefined
    ? searchResults.data
    : (searchResults?.data ?? searchResults ?? {});
  const sectionMap: Record<string, any[]> = {
    contacts: resultsObj?.contacts ?? [],
    policies: resultsObj?.policies ?? [],
    claims: resultsObj?.claims ?? [],
    leads: resultsObj?.leads ?? [],
  };
  const totalCount = Object.values(sectionMap).reduce((acc, arr) => acc + (arr?.length ?? 0), 0);
  const hasResults = totalCount > 0;

  const unreadCount = notifs?.meta?.unreadCount ?? 0;
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`;

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (e) { }
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md flex items-center px-3 sm:px-6 gap-2 sm:gap-4 sticky top-0 z-20 shrink-0 transition-all duration-200"
      style={{ borderBottom: '1px solid rgba(226, 232, 240, 0.8)' }}>

      {/* Hamburger Menu (Mobile) */}
      <button 
        className="md:hidden p-1.5 -ml-1 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
        onClick={() => setMobileOpen(true)}
        aria-label="Open Navigation"
      >
        <Menu size={20} />
      </button>

      {/* Page title / breadcrumb (Mobile Responsive) */}
      {title && (
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 max-w-[140px] sm:max-w-none">
          <span className="text-[10px] sm:text-xs font-semibold tracking-wide uppercase text-slate-400 hidden sm:inline">
            Insumitra
          </span>
          <svg width="8" height="8" viewBox="0 0 12 12" fill="none" className="shrink-0 opacity-60 hidden sm:inline">
            <path d="M4.5 3L7.5 6L4.5 9" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h1 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight truncate">
            {title}
          </h1>
        </div>
      )}

      {/* Divider */}
      {title && <div className="h-5 w-px bg-slate-200/80 shrink-0 hidden sm:block" />}

      {/* Global search */}
      {true && (
        <div className="relative flex-1 max-w-[420px] min-w-0">
          <Search size={14} className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-colors group-focus-within:text-blue-500" />
          <input
            className="w-full pl-8 sm:pl-9 pr-3 sm:pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200/70 rounded-xl
                       placeholder-slate-400 outline-none transition-all duration-300
                       hover:bg-slate-100/70 hover:border-slate-300
                       focus:bg-white focus:border-blue-500/70 focus:ring-4 focus:ring-blue-500/5 focus:shadow-[0_0_15px_rgba(59,130,246,0.06)]"
            placeholder="Search contacts, policies, claims…"
            value={query}
            onChange={e => { setQuery(e.target.value); setShowSearch(true); }}
            onFocus={() => setShowSearch(true)}
            onBlur={() => setTimeout(() => setShowSearch(false), 400)}
          />

          {/* Search dropdown */}
          {showSearch && query.trim().length >= 2 && (
            <div className="absolute top-full mt-2 w-[calc(100vw-24px)] sm:w-full min-w-[280px] sm:min-w-[420px] max-w-[440px] -left-8 sm:left-0 bg-white/98 backdrop-blur-md rounded-2xl overflow-hidden animate-fade-in shadow-xl border border-slate-200/80 z-50">
              {isSearchLoading ? (
                <div className="p-5 flex flex-col items-center gap-2">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-slate-400 font-medium">Searching…</p>
                </div>
              ) : isSearchError ? (
                <div className="p-5 text-center">
                  <p className="text-xs text-red-500 font-semibold">Search failed. Please try again.</p>
                  <p className="text-[10px] text-slate-400 mt-1">Check your connection or contact support.</p>
                </div>
              ) : hasResults ? (
                <div>
                  {(['contacts', 'policies', 'claims', 'leads'] as const).map(section => {
                    const items = sectionMap[section] ?? [];
                    if (!items.length) return null;
                    const { label, Icon, color, iconBg } = SECTION_META[section];
                    return (
                      <div key={section} className="border-b border-slate-100 last:border-0">
                        {/* Section header */}
                        <div className={`px-4 py-1.5 flex items-center gap-1.5 bg-slate-50/80`}>
                          <span className={`p-0.5 rounded ${iconBg}`}>
                            <Icon size={10} className={color} />
                          </span>
                          <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
                            {label}
                          </span>
                          <span className="ml-auto text-[9px] font-bold text-slate-400 bg-slate-200/70 px-1.5 py-0.5 rounded-full">
                            {items.length}
                          </span>
                        </div>
                        {/* Items */}
                        {items.map((item: any) => {
                          const titleText =
                            item.contactName ||
                            (item.firstName ? `${item.firstName} ${item.lastName || ''}`.trim() : null) ||
                            item.policyNumber ||
                            item.claimNumber ||
                            'Result';

                          const subParts = [
                            section !== 'contacts' && item.policyNumber,
                            section !== 'contacts' && item.claimNumber,
                            item.planName,
                            item.claimType,
                            item.stage,
                            item.status,
                          ].filter(Boolean);

                          return (
                            <button
                              key={item.id}
                              type="button"
                              className="w-full text-left px-3 sm:px-4 py-1.5 sm:py-2.5 text-[10px] sm:text-xs transition-all hover:bg-blue-50/60 flex flex-wrap items-center gap-3 cursor-pointer group"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setShowSearch(false);
                                setQuery('');
                                navigate(`/${section}/${item.id}`);
                              }}
                            >
                              {/* Section icon dot */}
                              <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
                                <Icon size={11} className={color} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-slate-700 truncate">{titleText}</p>
                                {subParts.length > 0 && (
                                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                    {subParts.join(' · ')}
                                  </p>
                                )}
                              </div>
                              {item.phone && (
                                <span className="text-[10px] text-slate-500 font-mono shrink-0 bg-slate-100 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                  {item.phone}
                                </span>
                              )}
                              <span className={`text-[10px] font-bold shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${color}`}>→</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                  {/* View all results link */}
                  <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-medium">{totalCount} result{totalCount !== 1 ? 's' : ''} for &ldquo;{debouncedQuery}&rdquo;</span>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setShowSearch(false);
                        navigate('/search');
                      }}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                    >
                      View all →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-5 text-center">
                  <Search size={20} className="mx-auto mb-2 text-slate-200" />
                  <p className="text-xs text-slate-400 font-medium">No results for &ldquo;{debouncedQuery}&rdquo;</p>
                  <p className="text-[10px] text-slate-300 mt-1">Try a different name, phone, or policy number</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Right actions */}
      <div className="flex flex-wrap items-center gap-2.5 ml-auto">

        {/* Live Top Bar Shift Tracker */}
        <TopBarShiftTracker />

        {/* Notification bell */}
        <div className="relative">
          <button
            className="relative p-2 rounded-xl text-slate-400 bg-slate-50/20 hover:text-slate-700 hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all duration-200"
            onClick={() => setShowNotifPop(!showNotifPop)}
            aria-label="Notifications"
          >
            <Bell size={16} strokeWidth={2} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-red-500 rounded-full text-[8px] font-bold text-white flex items-center justify-center px-0.5 shadow-[0_0_0_2px_#ffffff] animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Popover */}
          {showNotifPop && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifPop(false)} />
              <div className="absolute right-0 top-full mt-2 w-[340px] bg-white rounded-2xl border border-slate-200 shadow-xl p-4 z-50 animate-fade-in">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Bell size={14} className="text-blue-600" />
                    <h4 className="text-xs font-bold text-slate-800">Notifications</h4>
                    {unreadCount > 0 && (
                      <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={async () => {
                        await notificationsService.markAllRead();
                        refetchNotifs();
                      }}
                      className="text-[10px] font-semibold text-blue-600 hover:text-blue-800"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-[300px] overflow-y-auto flex flex-col gap-2">
                  {(notifs?.data || []).length > 0 ? (
                    (notifs?.data || []).map((n: any) => (
                      <div
                        key={n.id}
                        onClick={async () => {
                          if (!n.isRead) {
                            await notificationsService.markRead(n.id);
                            refetchNotifs();
                          }
                          const recordType = n.data?.recordType;
                          const recordId = n.data?.recordId || n.data?.taskId;
                          if (recordId) {
                            setShowNotifPop(false);
                            if (n.type === 'TASK_ASSIGNED' || recordType?.toLowerCase() === 'task') {
                              navigate('/workspace');
                            } else if (recordType) {
                              const path = recordType.toLowerCase() === 'contact' ? 'contacts' : recordType.toLowerCase() === 'lead' ? 'leads' : recordType.toLowerCase() === 'policy' ? 'policies' : 'claims';
                              navigate(`/${path}/${recordId}`);
                            }
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          n.isRead ? 'bg-slate-50/60 border-slate-100 text-slate-500' : 'bg-blue-50/40 border-blue-100 text-slate-800 font-medium hover:bg-blue-50'
                        }`}
                      >
                        <p className="font-semibold text-slate-800">{n.title}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5">{n.body}</p>
                        <p className="text-[9px] text-slate-400 mt-1">
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center text-slate-400 text-xs">
                      No notifications yet
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Vertical divider */}
        <div className="h-6 w-px bg-slate-200/80 mx-1" />

        {/* User avatar chip wrapper */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex flex-wrap items-center gap-2.5 pl-1.5 pr-3.5 py-1.5 rounded-xl border border-transparent hover:border-slate-100 hover:bg-slate-50/70 hover:shadow-sm transition-all duration-200 group"
          >
            <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center
                            text-white text-xs font-bold shrink-0 shadow-sm shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
              {initials}
            </div>
            <div className="hidden sm:flex flex-col items-start leading-none gap-0.5">
              <span className="text-xs font-bold text-slate-800">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                {user?.role}
              </span>
            </div>
            <ChevronDown size={12} className="text-slate-400 hidden sm:block transition-transform duration-200 group-hover:translate-y-0.5" />
          </button>

          {/* Dropdown Card */}
          {showDropdown && (
            <>
              {/* Click outside to close backdrop */}
              <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />

              {/* Dropdown Menu */}
              <div className="absolute right-0 top-full mt-2 w-[280px] bg-white rounded-2xl border border-slate-150 shadow-[0_10px_35px_-5px_rgba(0,0,0,0.1),0_2px_10px_-2px_rgba(0,0,0,0.05)] p-5 z-50 flex flex-col items-center animate-fade-in">
                {/* Avatar details */}
                <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white text-2xl font-bold relative mb-3 shadow-inner shadow-blue-500/20">
                  {initials}
                  <div className="absolute bottom-0 right-0 p-1 bg-white border border-slate-100 rounded-full shadow-sm">
                    <Camera size={10} className="text-slate-500" />
                  </div>
                </div>
                <h4 className="text-sm font-bold text-slate-800">Hi, {user?.firstName} {user?.lastName}!</h4>
                <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>

                <button
                  onClick={() => { navigate('/settings'); setShowDropdown(false); }}
                  className="mt-3.5 w-full py-1.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-full text-xs font-semibold text-slate-700 transition-colors text-center"
                >
                  Manage your Account
                </button>

                <div className="w-full h-px bg-slate-100 my-4" />

                <div className="w-full flex flex-col gap-1">
                  <button
                    onClick={() => { navigate('/settings'); setShowDropdown(false); }}
                    className="flex flex-wrap items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-slate-650 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors text-left"
                  >
                    <User size={14} className="text-slate-450" />
                    Edit Profile
                  </button>
                  <button
                    onClick={() => { navigate('/settings'); setShowDropdown(false); }}
                    className="flex flex-wrap items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-slate-650 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors text-left"
                  >
                    <Settings size={14} className="text-slate-450" />
                    Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex flex-wrap items-center gap-2.5 w-full px-3 py-2 text-[10px] sm:text-xs font-semibold text-slate-650 hover:text-red-650 hover:bg-red-50/50 rounded-xl transition-colors text-left"
                  >
                    <LogOut size={14} className="text-slate-450" />
                    Sign out
                  </button>
                </div>

                <div className="text-[9px] font-medium text-slate-400 mt-4 tracking-wide">
                  Privacy Policy &bull; Terms of Service
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
