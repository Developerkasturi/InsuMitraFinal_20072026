import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchService } from '@api/index';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Users, Shield, FileText, TrendingUp } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';

const SECTION_META: Record<string, { label: string; Icon: React.ElementType; route: string; color: string }> = {
  contacts: { label: 'Contacts', Icon: Users, route: '/contacts', color: 'text-blue-500 bg-blue-50' },
  policies: { label: 'Policies', Icon: Shield, route: '/policies', color: 'text-green-500 bg-green-50' },
  claims:   { label: 'Claims', Icon: FileText, route: '/claims', color: 'text-yellow-500 bg-yellow-50' },
  leads:    { label: 'Leads', Icon: TrendingUp, route: '/leads', color: 'text-purple-500 bg-purple-50' },
};

// API returns properties mapped from backend search service
function getItemLabel(section: string, item: any): string {
  const contactName = item.contactName || `${item.firstName ?? item.first_name ?? item.contact_first ?? ''} ${item.lastName ?? item.last_name ?? item.contact_last ?? ''}`.trim();
  if (section === 'contacts') {
    return contactName || item.phone || 'Contact';
  }
  if (section === 'policies') {
    return item.policyNumber || item.policy_number || contactName || 'Policy';
  }
  if (section === 'claims') {
    return item.claimNumber || item.claim_number || contactName || 'Claim';
  }
  if (section === 'leads') {
    return contactName || item.planName || item.plan_name || 'Lead';
  }
  return item.id;
}

function getItemSub(section: string, item: any): string {
  const contactName = item.contactName || `${item.contact_first ?? item.contact?.firstName ?? ''} ${item.contact_last ?? item.contact?.lastName ?? ''}`.trim();
  const phone = item.phone || item.contact_phone || item.contact?.phone;

  if (section === 'contacts') return [phone, item.email, item.aadhaarNumber || item.aadhaar_number].filter(Boolean).join(' · ');
  if (section === 'policies') return [item.policyNumber || item.policy_number, item.planName || item.plan_name, item.companyName || item.company_name, contactName, item.status].filter(Boolean).join(' · ');
  if (section === 'claims')   return [item.claimNumber || item.claim_number, item.claimType || item.claim_type, contactName, item.policyNumber || item.policy_number, item.status].filter(Boolean).join(' · ');
  if (section === 'leads')    return [item.planName || item.plan_name || (item.interests?.length ? item.interests.join(', ') : ''), contactName, item.stage].filter(Boolean).join(' · ');
  return '';
}

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const debouncedQuery = useDebounce(query, 300);

  // Sync state with URL params — only when URL changes externally (e.g. browser back/forward)
  // Do NOT run on every searchParams change to avoid overwriting the input
  useEffect(() => {
    const q = searchParams.get('q') || '';
    // Only sync if the URL was changed externally (not by handleQueryChange)
    if (q !== query && document.activeElement?.tagName !== 'INPUT') {
      setQuery(q);
    }
  }, [searchParams]);

  // Sync URL search params with input value
  const handleQueryChange = (val: string) => {
    setQuery(val);
    setSearchParams(val ? { q: val } : {}, { replace: true });
  };

  const { data, isLoading } = useQuery({
    queryKey: ['global-search-page', debouncedQuery],
    queryFn: () => searchService.search(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  const results = data?.data ?? {};
  const hasResults = Object.values(results).some((arr: any) => arr?.length > 0);
  const totalCount = Object.values(results).reduce((acc: number, arr: any) => acc + (arr?.length ?? 0), 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Global Search</h2>
        <p className="text-sm text-gray-500">Search across contacts, policies, claims, and leads.</p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full pl-11 pr-4 py-3 text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
          placeholder="Type to search contacts, policies, claims, leads…"
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          autoFocus
        />
        {query && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded"
            onClick={() => handleQueryChange('')}>
            ✕
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoading && debouncedQuery.length >= 2 && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card h-16 animate-pulse bg-gray-100" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {debouncedQuery.length < 2 && !query && (
        <div className="text-center py-16 text-gray-400">
          <Search size={36} className="mx-auto mb-3 text-gray-200" />
          <p>Start typing to search…</p>
          <p className="text-xs mt-1">Minimum 2 characters required</p>
        </div>
      )}

      {/* No results */}
      {debouncedQuery.length >= 2 && !isLoading && !hasResults && (
        <div className="text-center py-12 text-gray-400">
          <p>No results found for &ldquo;<strong>{debouncedQuery}</strong>&rdquo;</p>
        </div>
      )}

      {/* Results */}
      {hasResults && !isLoading && (
        <div className="space-y-5">
          <p className="text-sm text-gray-500">{totalCount} result{totalCount !== 1 ? 's' : ''} for &ldquo;<strong>{debouncedQuery}</strong>&rdquo;</p>
          {Object.entries(SECTION_META).map(([section, meta]) => {
            const items: any[] = results[section] ?? [];
            if (items.length === 0) return null;
            const { label, Icon, route, color } = meta;
            return (
              <div key={section} className="card space-y-2">
                <div
                  className="flex items-center gap-2 mb-1 cursor-pointer hover:opacity-80"
                  onClick={() => navigate(`${route}?search=${encodeURIComponent(query)}`)}
                >
                  <span className={`p-1.5 rounded-lg ${color}`}><Icon size={14}/></span>
                  <h3 className="text-sm font-semibold text-gray-700">{label}</h3>
                  <span className="badge-gray ml-auto">{items.length} (View list →)</span>
                </div>
                <div className="space-y-1">
                  {items.map((item: any) => {
                    const labelText = getItemLabel(section, item);
                    const subText = getItemSub(section, item);

                    return (
                      <div
                        key={item.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`${route}/${item.id}`);
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-3 rounded-lg hover:bg-slate-50 text-left transition-colors group cursor-pointer border border-transparent hover:border-slate-100"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-primary-600 transition-colors">
                            {labelText}
                          </p>
                          {subText && (
                            <p className="text-xs text-gray-500 truncate mt-0.5">{subText}</p>
                          )}
                        </div>
                        <span
                          className="text-xs font-semibold text-primary-600 group-hover:text-primary-700 bg-primary-50/60 group-hover:bg-primary-100 px-3 py-1.5 rounded-md transition-all shrink-0 ml-3 flex items-center gap-1"
                        >
                          View →
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
