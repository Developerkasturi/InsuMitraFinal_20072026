import { Bell, Search, ChevronDown, User, Settings, LogOut, Camera, Users, Shield, FileText, TrendingUp } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { notificationsService, searchService } from '@api/index';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@store/auth.store';
import { authService } from '@api/auth.service';

import { useDebounce } from '@hooks/useDebounce';
import { useGlobalSearchStore } from '@store/search.store';

const SECTION_ICONS: Record<string, React.ElementType> = {
  contacts: Users,
  policies: Shield,
  claims: FileText,
  leads: TrendingUp,
};

export default function Header({ title }: { title?: string }) {
  const { globalQuery, setGlobalQuery, clearGlobalQuery } = useGlobalSearchStore();
  const [query, setQuery]           = useState(globalQuery || '');
  const [showSearch, setShowSearch] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const user                        = useAuthStore(s => s.user);
  const navigate                    = useNavigate();
  const location                    = useLocation();
  const [searchParams]              = useSearchParams();
  const inputRef                    = useRef<HTMLInputElement>(null);

  // Sync header search bar with global store and URL params
  useEffect(() => {
    const urlQ = searchParams.get('search') || searchParams.get('q');
    if (urlQ !== null && urlQ !== undefined) {
      setQuery(urlQ);
      setGlobalQuery(urlQ);
    } else if (globalQuery !== query) {
      setQuery(globalQuery);
    }
  }, [location.pathname, searchParams, globalQuery]);

  const debouncedQuery = useDebounce(query.trim(), 300);
  const shouldSearch = debouncedQuery.length >= 1;

  const { data: notifs } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn:  () => notificationsService.list({ unreadOnly: true, limit: 1 }),
    refetchInterval: 60_000,
  });

  const { data: searchResults, isLoading: isSearchLoading } = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn:  () => searchService.search(debouncedQuery, 'all', 50),
    enabled:  shouldSearch,
  });

  const resultsObj = searchResults?.data?.contacts ? searchResults.data : (searchResults?.data ?? searchResults ?? {});
  const sectionMap: Record<string, any[]> = {
    contacts: resultsObj.contacts ?? [],
    policies: resultsObj.policies ?? [],
    claims:   resultsObj.claims ?? [],
    leads:    resultsObj.leads ?? [],
  };
  const totalCount = Object.values(sectionMap).reduce((acc, arr) => acc + (arr?.length ?? 0), 0);
  const hasResults = totalCount > 0;

  const unreadCount = notifs?.meta?.unreadCount ?? 0;
  const initials    = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`;

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (e) {}
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white/75 backdrop-blur-md flex items-center px-6 gap-4 sticky top-0 z-20 shrink-0 transition-all duration-200"
            style={{ borderBottom: '1px solid rgba(226, 232, 240, 0.8)' }}>

      {/* Page title / breadcrumb */}
      {title && (
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-xs font-semibold tracking-wide uppercase text-slate-400/85">InsuMitra</span>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="shrink-0 opacity-60">
            <path d="M4.5 3L7.5 6L4.5 9" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <h1 className="text-sm font-bold text-slate-800 tracking-tight">{title}</h1>
        </div>
      )}

      {/* Divider */}
      {title && <div className="h-5 w-px bg-slate-100 shrink-0" />}

      {/* Global search */}
      {true && (
        <div className="relative flex-1 max-w-[420px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-colors group-focus-within:text-blue-500" />
          <input
            ref={inputRef}
            className="w-full pl-9 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-100 rounded-xl
                       placeholder-slate-400 outline-none transition-all duration-300
                       hover:bg-slate-100/70 hover:border-slate-200
                       focus:bg-white focus:border-blue-500/70 focus:ring-4 focus:ring-blue-500/5 focus:shadow-[0_0_15px_rgba(59,130,246,0.06)]"
            placeholder="Search contacts, policies, claims, leads…"
            value={query}
            onChange={e => {
              const val = e.target.value;
              setQuery(val);
              setGlobalQuery(val);
              setShowSearch(true);
            }}
            onFocus={() => setShowSearch(true)}
            onBlur={() => setTimeout(() => setShowSearch(false), 250)}
            onKeyDown={e => {
              if (e.key === 'Enter' && query.trim()) {
                setShowSearch(false);
                setGlobalQuery(query.trim());
                (e.target as HTMLInputElement).blur();
                const currentSec = location.pathname.split('/')[1];
                const validSecs = ['contacts', 'policies', 'claims', 'leads'];
                const targetSec = validSecs.includes(currentSec) ? currentSec : 'contacts';
                navigate(`/${targetSec}?search=${encodeURIComponent(query.trim())}`);
              }
            }}
          />
          {query && (
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-0.5 rounded cursor-pointer"
              onMouseDown={(e) => {
                e.preventDefault();
                setQuery('');
                clearGlobalQuery();
                setShowSearch(false);
              }}
            >
              ✕
            </button>
          )}

          {/* Search dropdown */}
          {showSearch && shouldSearch && (
            <div className="absolute top-full mt-2.5 w-full min-w-[390px] bg-white/95 backdrop-blur-md rounded-2xl overflow-hidden animate-fade-in shadow-xl border border-slate-200/80 z-50">
              {isSearchLoading ? (
                <div className="p-4 text-center text-xs text-slate-400 font-medium flex items-center justify-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  Searching…
                </div>
              ) : hasResults ? (
                (['contacts', 'policies', 'claims', 'leads'] as const).map(section => {
                  const items = sectionMap[section] ?? [];
                  if (!items.length) return null;
                  const SectionIcon = SECTION_ICONS[section] || Search;
                  return (
                    <div key={section} className="border-b border-slate-100 last:border-0">
                      <div
                        className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/70 flex items-center justify-between cursor-pointer hover:bg-slate-100/80 transition-colors"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setShowSearch(false);
                          navigate(`/${section}?search=${encodeURIComponent(query)}`);
                        }}
                      >
                        <span className="flex items-center gap-1.5">
                          <SectionIcon size={12} className="text-slate-400" />
                          <span>{section} ({items.length})</span>
                        </span>
                        <span className="text-[10px] text-blue-600 font-semibold normal-case hover:underline">View all →</span>
                      </div>
                      {items.map((item: any) => {
                        const titleText =
                          item.contactName ||
                          (item.firstName ? `${item.firstName} ${item.lastName || ''}`.trim() : null) ||
                          item.policyNumber ||
                          item.claimNumber ||
                          'Result';

                        const subDetails = [
                          section !== 'contacts' && item.policyNumber,
                          section !== 'contacts' && item.claimNumber,
                          item.planName,
                          item.claimType,
                          item.stage,
                        ].filter(Boolean);

                        return (
                          <div
                            key={item.id}
                            className="w-full px-4 py-2.5 text-xs transition-all hover:bg-blue-50/60 flex items-center justify-between gap-3 group"
                          >
                            <button
                              type="button"
                              className="min-w-0 flex-1 text-left cursor-pointer focus:outline-none"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setShowSearch(false);
                                setGlobalQuery(titleText);
                                navigate(`/${section}?search=${encodeURIComponent(titleText)}`);
                              }}
                            >
                              <p className="font-semibold text-slate-700 truncate group-hover:text-blue-600 transition-colors">{titleText}</p>
                              {subDetails.length > 0 && (
                                <p className="text-[11px] text-slate-400 truncate">
                                  {subDetails.join(' · ')}
                                </p>
                              )}
                            </button>
                            {item.phone && (
                              <span className="text-[10px] text-slate-500 font-mono shrink-0 bg-slate-100 px-1.5 py-0.5 rounded">{item.phone}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-slate-400 font-medium">
                  No results found for &ldquo;{debouncedQuery}&rdquo;
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Right actions */}
      <div className="flex items-center gap-2 ml-auto">

        {/* WhatsApp shortcut */}
        <a
          href="https://web.whatsapp.com"
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-xl text-emerald-600 bg-emerald-50/20 hover:bg-emerald-50 border border-transparent hover:border-emerald-100 transition-all duration-200"
          title="WhatsApp Web"
        >
          <svg className="w-[16px] h-[16px]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.45L0 24zm6.59-4.846c1.6.95 2.568 1.48 4.23 1.482 5.54.004 10.05-4.502 10.054-10.045.002-2.684-1.038-5.207-2.93-7.098-1.892-1.892-4.41-2.934-7.098-2.936-5.544 0-10.056 4.506-10.06 10.051-.001 1.705.469 2.76 1.34 4.256l-.994 3.63 3.738-.979zm11.087-7.24c-.1-.166-.36-.265-.756-.462-.397-.197-2.348-1.159-2.706-1.29-.358-.13-.618-.195-.878.197-.26.392-1.002 1.258-1.228 1.515-.227.257-.453.29-.85.092-.397-.197-1.677-.618-3.197-1.974-1.182-1.055-1.98-2.357-2.21-2.75-.23-.393-.024-.606.173-.803.178-.178.397-.463.595-.694.198-.23.264-.393.396-.66.13-.267.065-.5-.032-.697-.098-.197-.878-2.115-1.203-2.898-.316-.762-.64-.66-.878-.672-.227-.012-.487-.014-.747-.014-.26 0-.682.097-1.038.483-.357.387-1.363 1.332-1.363 3.247 0 1.916 1.395 3.766 1.59 4.028.195.263 2.747 4.195 6.654 5.885.93.402 1.655.643 2.22.823.934.296 1.785.254 2.457.154.75-.113 2.348-.96 2.678-1.888.33-.928.33-1.724.23-1.89zm0 0" stroke="none" />
          </svg>
        </a>

        {/* Notification bell */}
        <button
          className="relative p-2 rounded-xl text-slate-400 bg-slate-50/20 hover:text-slate-700 hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all duration-200"
          onClick={() => navigate('/settings')}
          aria-label="Notifications"
        >
          <Bell size={16} strokeWidth={2} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-red-500 rounded-full text-[8px] font-bold text-white flex items-center justify-center px-0.5 shadow-[0_0_0_2px_#ffffff] animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Vertical divider */}
        <div className="h-6 w-px bg-slate-200/80 mx-1" />

        {/* User avatar chip wrapper */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2.5 pl-1.5 pr-3.5 py-1.5 rounded-xl border border-transparent hover:border-slate-100 hover:bg-slate-50/70 hover:shadow-sm transition-all duration-200 group"
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
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-slate-650 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors text-left"
                  >
                    <User size={14} className="text-slate-450" />
                    Edit Profile
                  </button>
                  <button
                    onClick={() => { navigate('/settings'); setShowDropdown(false); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-slate-650 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors text-left"
                  >
                    <Settings size={14} className="text-slate-450" />
                    Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-slate-650 hover:text-red-650 hover:bg-red-50/50 rounded-xl transition-colors text-left"
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
