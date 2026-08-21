import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, Zap, Rocket,
  FileText, Users, Image, History,
  BarChart2, Settings, Wallet, Sparkles, Bot
} from 'lucide-react';
import { useAuthStore } from '@store/auth.store';

// Sub-tabs
import DashboardTab from './tabs/DashboardTab';
import InboxTab from './tabs/InboxTab';
import WhatsAppLeadsTab from './tabs/WhatsAppLeadsTab';
import ChatbotTab from './tabs/ChatbotTab';
import AutomationsTab from './tabs/AutomationsTab';
import CampaignsTab from './tabs/CampaignsTab';
import TemplatesTab from './tabs/TemplatesTab';
import ContactsTab from './tabs/ContactsTab';
import MediaLibraryTab from './tabs/MediaLibraryTab';
import HistoryTab from './tabs/HistoryTab';
import AnalyticsTab from './tabs/AnalyticsTab';
import RechargeTab from './tabs/RechargeTab';
import SettingsTab from './tabs/SettingsTab';

// Modals
import WhatsAppLeadModal, { WhatsAppLeadContext } from './components/WhatsAppLeadModal';
import AutomationBuilderModal from './components/AutomationBuilderModal';
import CampaignWizardModal from './components/CampaignWizardModal';
import TemplateBuilderModal from './components/TemplateBuilderModal';
import toast from 'react-hot-toast';

export default function WhatsApp() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') || 'dashboard';
  const rawSubTab = searchParams.get('subtab');

  // Normalize legacy tab keys to consolidated 9 tabs
  let activePrimaryTab = rawTab;
  let initialTemplatesSubTab: 'templates' | 'media' = 'templates';
  let initialReportsSubTab: 'analytics' | 'history' = 'analytics';

  if (rawTab === 'templates') {
    activePrimaryTab = 'templates_media';
    initialTemplatesSubTab = 'templates';
  } else if (rawTab === 'media') {
    activePrimaryTab = 'templates_media';
    initialTemplatesSubTab = 'media';
  } else if (rawTab === 'analytics') {
    activePrimaryTab = 'reports';
    initialReportsSubTab = 'analytics';
  } else if (rawTab === 'history') {
    activePrimaryTab = 'reports';
    initialReportsSubTab = 'history';
  } else if (rawTab === 'recharge') {
    activePrimaryTab = 'billing';
  }

  const [templatesSubTab, setTemplatesSubTab] = useState<'templates' | 'media'>(
    rawSubTab === 'media' ? 'media' : initialTemplatesSubTab
  );
  const [reportsSubTab, setReportsSubTab] = useState<'analytics' | 'history'>(
    rawSubTab === 'history' ? 'history' : initialReportsSubTab
  );

  // Sync state when URL search params change
  useEffect(() => {
    if (rawTab === 'media' || rawSubTab === 'media') {
      setTemplatesSubTab('media');
    } else if (rawTab === 'templates' || rawSubTab === 'templates') {
      setTemplatesSubTab('templates');
    }

    if (rawTab === 'history' || rawSubTab === 'history') {
      setReportsSubTab('history');
    } else if (rawTab === 'analytics' || rawSubTab === 'analytics') {
      setReportsSubTab('analytics');
    }
  }, [rawTab, rawSubTab]);

  // Lead Modal state
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadContext, setLeadContext] = useState<WhatsAppLeadContext | null>(null);

  // Quick Action Modals
  const [builderModalOpen, setBuilderModalOpen] = useState(false);
  const [wizardModalOpen, setWizardModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  const handleTabChange = (tabKey: string, subTabKey?: string) => {
    if (tabKey === 'templates') {
      setTemplatesSubTab('templates');
      setSearchParams({ tab: 'templates_media', subtab: 'templates' });
      return;
    }
    if (tabKey === 'media') {
      setTemplatesSubTab('media');
      setSearchParams({ tab: 'templates_media', subtab: 'media' });
      return;
    }
    if (tabKey === 'analytics') {
      setReportsSubTab('analytics');
      setSearchParams({ tab: 'reports', subtab: 'analytics' });
      return;
    }
    if (tabKey === 'history') {
      setReportsSubTab('history');
      setSearchParams({ tab: 'reports', subtab: 'history' });
      return;
    }
    if (tabKey === 'recharge') {
      setSearchParams({ tab: 'billing' });
      return;
    }

    if (subTabKey) {
      setSearchParams({ tab: tabKey, subtab: subTabKey });
    } else {
      setSearchParams({ tab: tabKey });
    }
  };

  const handleOpenLeadModal = (ctx: WhatsAppLeadContext) => {
    setLeadContext(ctx);
    setLeadModalOpen(true);
  };

  // Consolidated Primary Tabs
  const TABS = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
    { key: 'inbox', label: 'Inbox', icon: MessageSquare, badge: 3 },
    { key: 'leads', label: 'Leads', icon: Sparkles, badge: '18' },
    { key: 'chatbot', label: 'Chatbots', icon: Bot, badge: 'AI' },
    { key: 'automations', label: 'Automations', icon: Zap, badge: null },
    { key: 'campaigns', label: 'Campaigns', icon: Rocket, badge: null },
    { key: 'templates_media', label: 'Templates & Media', icon: FileText, badge: 1 },
    { key: 'contacts', label: 'Contacts', icon: Users, badge: null },
    { key: 'reports', label: 'Reports', icon: BarChart2, badge: null },
    { key: 'billing', label: 'Billing', icon: Wallet, badge: null },
    { key: 'settings', label: 'Settings', icon: Settings, badge: null },
  ] as const;

  return (
    <div className="space-y-4 animate-fade-in pb-12" style={{ zoom: 0.9 }}>

      {/* ── Sleek Light Navigation Bar (Consolidated Tabs with Hover Effects) ── */}
      <div className="rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/80 p-2 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = activePrimaryTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => handleTabChange(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 hover:shadow-2xs hover:-translate-y-0.5 active:translate-y-0'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
                <span>{t.label}</span>
                {t.badge && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${
                    isActive ? 'bg-white text-emerald-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Active Tab View ── */}
      <div className="animate-fade-in">
        {activePrimaryTab === 'dashboard' && (
          <DashboardTab
            onNavigateTab={handleTabChange}
            onOpenNewAutomation={() => setBuilderModalOpen(true)}
            onOpenNewCampaign={() => setWizardModalOpen(true)}
          />
        )}

        {activePrimaryTab === 'inbox' && (
          <InboxTab onOpenLeadModal={handleOpenLeadModal} />
        )}

        {activePrimaryTab === 'leads' && (
          <WhatsAppLeadsTab
            onOpenLeadModal={handleOpenLeadModal}
            onNavigateTab={handleTabChange}
          />
        )}

        {activePrimaryTab === 'chatbot' && (
          <ChatbotTab onOpenLeadModal={handleOpenLeadModal} />
        )}

        {activePrimaryTab === 'automations' && (
          <AutomationsTab
            onOpenBuilder={() => setBuilderModalOpen(true)}
            onOpenLeadModal={handleOpenLeadModal}
          />
        )}

        {activePrimaryTab === 'campaigns' && (
          <CampaignsTab
            onOpenWizard={() => setWizardModalOpen(true)}
            onOpenLeadModal={handleOpenLeadModal}
          />
        )}

        {/* ── Consolidated Tab: Templates & Media ── */}
        {activePrimaryTab === 'templates_media' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-100/80 p-1.5 rounded-2xl w-fit border border-slate-200/60">
              <button
                onClick={() => {
                  setTemplatesSubTab('templates');
                  handleTabChange('templates_media', 'templates');
                }}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  templatesSubTab === 'templates'
                    ? 'bg-white text-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/60 hover:-translate-y-0.5'
                }`}
              >
                <FileText size={13} className={templatesSubTab === 'templates' ? 'text-purple-600' : 'text-slate-400'} />
                <span>Meta Templates (Approved)</span>
                <span className="bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">1 Alert</span>
              </button>

              <button
                onClick={() => {
                  setTemplatesSubTab('media');
                  handleTabChange('templates_media', 'media');
                }}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  templatesSubTab === 'media'
                    ? 'bg-white text-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/60 hover:-translate-y-0.5'
                }`}
              >
                <Image size={13} className={templatesSubTab === 'media' ? 'text-indigo-600' : 'text-slate-400'} />
                <span>Media Assets Library</span>
              </button>
            </div>

            {templatesSubTab === 'templates' ? (
              <TemplatesTab onOpenBuilder={() => setTemplateModalOpen(true)} />
            ) : (
              <MediaLibraryTab />
            )}
          </div>
        )}

        {/* ── Contacts (Single Unified Tab) ── */}
        {activePrimaryTab === 'contacts' && (
          <ContactsTab onOpenLeadModal={handleOpenLeadModal} />
        )}

        {/* ── Consolidated Tab: Reports (Analytics + Delivery Logs) ── */}
        {activePrimaryTab === 'reports' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-100/80 p-1.5 rounded-2xl w-fit border border-slate-200/60">
              <button
                onClick={() => {
                  setReportsSubTab('analytics');
                  handleTabChange('reports', 'analytics');
                }}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  reportsSubTab === 'analytics'
                    ? 'bg-white text-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/60 hover:-translate-y-0.5'
                }`}
              >
                <BarChart2 size={13} className={reportsSubTab === 'analytics' ? 'text-emerald-600' : 'text-slate-400'} />
                <span>Performance &amp; ROI Analytics</span>
              </button>

              <button
                onClick={() => {
                  setReportsSubTab('history');
                  handleTabChange('reports', 'history');
                }}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  reportsSubTab === 'history'
                    ? 'bg-white text-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/60 hover:-translate-y-0.5'
                }`}
              >
                <History size={13} className={reportsSubTab === 'history' ? 'text-blue-600' : 'text-slate-400'} />
                <span>Delivery History &amp; Error Logs</span>
              </button>
            </div>

            {reportsSubTab === 'analytics' ? (
              <AnalyticsTab />
            ) : (
              <HistoryTab />
            )}
          </div>
        )}

        {/* ── Billing ── */}
        {activePrimaryTab === 'billing' && (
          <RechargeTab />
        )}

        {/* ── Settings ── */}
        {activePrimaryTab === 'settings' && (
          <SettingsTab />
        )}
      </div>

      {/* ── Global Modals ── */}
      <WhatsAppLeadModal
        open={leadModalOpen}
        onClose={() => setLeadModalOpen(false)}
        context={leadContext}
      />

      <AutomationBuilderModal
        open={builderModalOpen}
        onClose={() => setBuilderModalOpen(false)}
        onSaved={(a) => {
          toast.success(`Automation "${a.name}" created!`);
          handleTabChange('automations');
        }}
      />

      <CampaignWizardModal
        open={wizardModalOpen}
        onClose={() => setWizardModalOpen(false)}
        onLaunched={(c) => {
          toast.success(`Campaign "${c.name}" scheduled!`);
          handleTabChange('campaigns');
        }}
      />

      <TemplateBuilderModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onSaved={(t) => {
          toast.success(`Template "${t.name}" submitted!`);
          handleTabChange('templates_media', 'templates');
        }}
      />

    </div>
  );
}
