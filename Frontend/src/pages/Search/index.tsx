import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchService } from '@api/index';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Users, Shield, FileText, TrendingUp, Layers } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { useGlobalSearchStore } from '@store/search.store';

const SECTION_META: Record<string, { label: string; Icon: React.ElementType; route: string; color: string }> = {
  contacts: { label: 'Contacts', Icon: Users, route: '/contacts', color: 'text-blue-600 bg-blue-50' },
  policies: { label: 'Policies', Icon: Shield, route: '/policies', color: 'text-emerald-600 bg-emerald-50' },
  claims:   { label: 'Claims', Icon: FileText, route: '/claims', color: 'text-amber-600 bg-amber-50' },
  leads:    { label: 'Leads', Icon: TrendingUp, route: '/leads', color: 'text-purple-600 bg-purple-50' },
};

function getItemLabel(section: string, item: any): string {
  if (section === 'contacts') return item.contactName || `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim() || item.phone || 'Contact';
  if (section === 'policies') return item.policyNumber || item.contactName || 'Policy';
  if (section === 'claims')   return item.claimNumber || item.contactName || 'Claim';
  if (section === 'leads')    return item.contactName || `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim() || item.planName || 'Lead';
  return item.id;
}

function getItemSub(section: string, item: any): string {
  const plan = item.planName || item.plan?.name || '';
  const contact = item.contactName || `${item.contact?.firstName ?? ''} ${item.contact?.lastName ?? ''}`.trim();
  const phone = item.phone || item.contact?.phone || item.email || '';

  if (section === 'contacts') return [phone, item.email, item.aadhaarNumber, item.panNumber].filter(Boolean).join(' · ');
  if (section === 'policies') return [plan, contact, item.status].filter(Boolean).join(' · ');
  if (section === 'claims')   return [item.claimType, contact, item.policyNumber, item.status].filter(Boolean).join(' · ');
  if (section === 'leads')    return [plan, contact, item.stage].filter(Boolean).join(' · ');
  return '';
}

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { globalQuery, setGlobalQuery } = useGlobalSearchStore();

  const urlQ = searchParams.get('q') || searchParams.get('search') || '';
  const [query, setQuery] = useState(urlQ || globalQuery || '');
  const [activeTab, setActiveTab] = useState<'all' | 'contacts' | 'policies' | 'claims' | 'leads'>('all');

  useEffect(() => {
    if (urlQ && urlQ !== query) {
      setQuery(urlQ);
    }
  }, [urlQ]);

  const debouncedQuery = useDebounce(query.trim(), 300);

  const { data, isLoading } = useQuery({
    queryKey: ['global-search-page', debouncedQuery],
    queryFn: () => searchService.search(debouncedQuery, 'all', 50),
    enabled: debouncedQuery.length >= 1,
  });

  const rawData = data?.data?.contacts ? data.data : (data?.data ?? data ?? {});
  const results: Record<string, any[]> = {
    contacts: rawData.contacts ?? [],
    policies: rawData.policies ?? [],
    claims:   rawData.claims ?? [],
    leads:    rawData.leads ?? [],
  };

  const totalCount = Object.values(results).reduce((acc: number, arr: any[]) => acc + (arr?.length ?? 0), 0);

  const handleQueryChange = (newVal: string) => {
    setQuery(newVal);
    setGlobalQuery(newVal);
    if (newVal.trim()) {
      setSearchParams({ q: newVal.trim() }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div>
        <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Global Search</h2>
        <p className="text-xs text-slate-500 mt-1">Search across contacts, policies, claims, and leads instantly.</p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="w-full pl-11 pr-10 py-3 text-sm bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 shadow-sm transition-all"
          placeholder="Type to search contacts, policies, claims, leads…"
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          autoFocus
        />
        {query && (
          <button
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-1 rounded-full hover:bg-slate-100 transition-colors"
            onClick={() => handleQueryChange('')}>
            ✕
          </button>
        )}
      </div>

      {/* Category Tabs */}
      {debouncedQuery.length >= 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200/80 text-xs">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers size={13} />
            <span>All Results</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${activeTab === 'all' ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'}`}>
              {totalCount}
            </span>
          </button>

          {(['contacts', 'policies', 'claims', 'leads'] as const).map(sec => {
            const meta = SECTION_META[sec];
            const count = results[sec]?.length ?? 0;
            const Icon = meta.Icon;
            return (
              <button
                key={sec}
                onClick={() => setActiveTab(sec)}
                className={`px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === sec
                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={13} />
                <span>{meta.label}</span>
                <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${activeTab === sec ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Loading state */}
      {isLoading && debouncedQuery.length >= 1 && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse bg-slate-100 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Empty prompt */}
      {!debouncedQuery && (
        <div className="text-center py-16 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <Search size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Start typing to search across your workspace…</p>
          <p className="text-xs text-slate-400 mt-1">Search contacts by name/phone, policies by policy#, claims, and leads.</p>
        </div>
      )}

      {/* No results state */}
      {debouncedQuery.length >= 1 && !isLoading && totalCount === 0 && (
        <div className="text-center py-12 text-slate-500 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-sm font-medium">No results found for &ldquo;<strong className="text-slate-800">{debouncedQuery}</strong>&rdquo;</p>
          <p className="text-xs text-slate-400 mt-1">Try checking for typos or searching by phone number or policy number.</p>
        </div>
      )}

      {/* Results List */}
      {debouncedQuery.length >= 1 && !isLoading && totalCount > 0 && (
        <div className="space-y-5">
          {Object.entries(SECTION_META).map(([section, meta]) => {
            if (activeTab !== 'all' && activeTab !== section) return null;
            const items: any[] = results[section] ?? [];
            if (items.length === 0) return null;
            const { label, Icon, route, color } = meta;

            return (
              <div key={section} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`p-1.5 rounded-lg ${color}`}><Icon size={14}/></span>
                    <h3 className="text-sm font-bold text-slate-800">{label}</h3>
                    <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{items.length}</span>
                  </div>
                  <button
                    onClick={() => navigate(`${route}?search=${encodeURIComponent(debouncedQuery)}`)}
                    className="text-xs text-blue-600 font-semibold hover:underline"
                  >
                    View in {label} →
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {items.map((item: any) => (
                    <div
                      key={item.id}
                      onClick={() => navigate(item.id ? `${route}/${item.id}` : `${route}?search=${encodeURIComponent(debouncedQuery)}`)}
                      className="w-full flex items-center justify-between py-3 px-2 rounded-xl hover:bg-slate-50 text-left transition-colors cursor-pointer group"
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                          {getItemLabel(section, item)}
                        </p>
                        {getItemSub(section, item) && (
                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            {getItemSub(section, item)}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {item.phone && (
                          <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded-md">
                            {item.phone}
                          </span>
                        )}
                        <span className="text-xs text-blue-600 opacity-0 group-hover:opacity-100 font-semibold transition-opacity">
                          View details →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

