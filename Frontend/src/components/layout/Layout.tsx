import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useLookupStore } from '@store/lookup.store';
import Sidebar from './Sidebar';
import Header  from './Header';

const TITLES: Record<string, string> = {
  dashboard:    'Dashboard',
  workspace:    'Workspace',
  contacts:     'Contacts',
  leads:        'Leads',
  policies:     'Policies',
  claims:       'Claims',
  employees:    'Employees',
  commissions:  'Commissions',
  whatsapp:     'WhatsApp',
  calendar:     'Calendar',
  settings:     'Settings',
  subscription: 'Subscription',
  operations:   'Operations',
};

const SCALED_SECTIONS = [
  'dashboard',
  'workspace',
  'contacts',
  'leads',
  'policies',
  'emi-tracking',
  'calendar',
  'operations',
  'commissions',
  'employees',
  'firm-profile',
  'settings',
];

export default function Layout() {
  const { pathname } = useLocation();
  const parts   = pathname.split('/').filter(Boolean);
  const section = parts[0] === 'insumitra' ? (parts[1] ?? '') : (parts[0] ?? '');
  const title   = TITLES[section] ?? '';
  const [mobileOpen, setMobileOpen] = useState(false);
  const shouldScale = SCALED_SECTIONS.includes(section);

  useEffect(() => {
    useLookupStore.getState().loadAll();
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title={title} setMobileOpen={setMobileOpen} />
        <main className={`flex-1 overflow-y-auto p-3 md:p-5 bg-[#f8fafc] custom-scrollbar ${shouldScale ? 'module-scale-80' : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
