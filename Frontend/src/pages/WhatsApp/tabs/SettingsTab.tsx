import React, { useState } from 'react';
import {
  ShieldCheck, Smartphone, Key, Globe, Bell,
  RefreshCw, CheckCircle2, Copy, AlertCircle, Eye,
  EyeOff, Terminal, Zap, Shield, HelpCircle, ArrowUpRight,
  TrendingUp, Check, AlertTriangle, Play
} from 'lucide-react';
import { MOCK_WHATSAPP_DATA } from '../mockData';
import toast from 'react-hot-toast';

export default function SettingsTab() {
  const [subTab, setSubTab] = useState<'account' | 'webhooks' | 'quality_tier' | 'notifications'>('account');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [testWebhookEvent, setTestWebhookEvent] = useState('message_delivered');
  const [simulatingWebhook, setSimulatingWebhook] = useState(false);

  const quality = MOCK_WHATSAPP_DATA.quality;
  const webhookUrl = 'https://api.insumitra.com/webhook/whatsapp/v1';
  const verifyToken = 'inso_wa_verify_sec_992182';
  const permanentToken = 'EAAGm0PX4ZCpsBAK8ZCFQ...[System_User_Permanent_Token]...z994';

  const handleCopy = (text: string, type: 'url' | 'token') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
    toast.success('Copied to clipboard');
  };

  const handleSimulateWebhook = () => {
    setSimulatingWebhook(true);
    setTimeout(() => {
      setSimulatingWebhook(false);
      toast.success(`Webhook test event "${testWebhookEvent}" delivered with HTTP 200 OK!`);
    }, 1000);
  };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-slate-800">Meta WhatsApp Cloud API Settings</h3>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.2 rounded-md">
              API v20.0 (Cloud)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Meta Cloud Business Account credentials, webhook dispatch logs, phone quality rating &amp; rate limit tiers
          </p>
        </div>
      </div>

      {/* Settings Sub-Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        {[
          { key: 'account', label: 'Meta API Credentials' },
          { key: 'webhooks', label: 'Inbound Webhooks & Simulator' },
          { key: 'quality_tier', label: 'Phone Quality & Tiers' },
          { key: 'notifications', label: 'Alert Preferences' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key as any)}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${subTab === t.key
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── SubTab 1: Meta API Credentials ── */}
      {subTab === 'account' && (
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs p-6 space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Smartphone size={20} />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-800">WhatsApp Business Account (WABA) Connection</h4>
                <p className="text-xs text-slate-400">Registered Phone: <strong>+91 98765 43210</strong> (Display Name: InsuMitra Advisory)</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 size={14} className="text-emerald-500" /> Meta Connected &amp; Verified
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 font-bold">WhatsApp Business Account ID (WABA ID)</span>
              <div className="font-mono text-slate-700 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 mt-1 flex justify-between items-center">
                <span>2847364918273645</span>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">VERIFIED</span>
              </div>
            </div>
            <div>
              <span className="text-slate-400 font-bold">Phone Number ID</span>
              <div className="font-mono text-slate-700 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 mt-1 flex justify-between items-center">
                <span>1928374650192837</span>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">ACTIVE</span>
              </div>
            </div>
          </div>

          <div className="text-xs">
            <span className="font-bold text-slate-700 block mb-1">Permanent System User Access Token</span>
            <div className="flex items-center gap-2">
              <input
                type={showToken ? 'text' : 'password'}
                readOnly
                value={permanentToken}
                className="flex-1 px-3 py-2 text-xs font-mono rounded-xl bg-slate-50 border border-slate-200 text-slate-700"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl cursor-pointer"
                title={showToken ? 'Hide Token' : 'Show Token'}
              >
                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button
                type="button"
                onClick={() => handleCopy(permanentToken, 'token')}
                className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 rounded-xl cursor-pointer flex items-center gap-1"
              >
                <Copy size={13} /> {copiedToken ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Generated via Meta Business Manager System User with <code>whatsapp_business_messaging</code> permissions. Never expires.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Need to reconnect with another phone number?</span>
            <button
              onClick={() => toast.success('Connecting to Meta Business Embedded Signup Flow...')}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
            >
              Re-authorize via Meta Embedded Signup
            </button>
          </div>
        </div>
      )}

      {/* ── SubTab 2: Webhooks & Live Simulator ── */}
      {subTab === 'webhooks' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs p-6 space-y-4 text-xs">
            <h4 className="text-sm font-extrabold text-slate-800">Inbound Webhook Configuration</h4>
            <p className="text-slate-500 text-[11px]">
              Meta Cloud API sends real-time delivery receipts, read receipts (blue ticks), customer incoming messages, and template approval updates to this callback URL.
            </p>

            <div className="space-y-3 pt-1">
              <div>
                <span className="text-slate-400 font-bold">Callback URL (Webhook Endpoint)</span>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="flex-1 px-3 py-2 text-xs font-mono rounded-xl bg-slate-50 border border-slate-200 text-slate-700"
                  />
                  <button
                    onClick={() => handleCopy(webhookUrl, 'url')}
                    className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Copy size={13} /> {copiedUrl ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-bold">Verify Token</span>
                <input
                  type="text"
                  readOnly
                  value={verifyToken}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-slate-50 border border-slate-200 text-slate-700 mt-1"
                />
              </div>
            </div>
          </div>

          {/* Webhook Test Simulator */}
          <div className="rounded-2xl bg-slate-900 text-white p-5 space-y-4 text-xs shadow-inner">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-emerald-400" />
                <span className="font-extrabold text-white text-sm">Webhook Payload Dispatch Simulator</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">Status: Ready</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Simulated Event Type</label>
                <select
                  value={testWebhookEvent}
                  onChange={(e) => setTestWebhookEvent(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white outline-none font-mono text-xs"
                >
                  <option value="messages">messages (Inbound Customer Chat)</option>
                  <option value="message_deliveries">message_deliveries (Handset Delivered)</option>
                  <option value="message_reads">message_reads (Blue Ticks)</option>
                  <option value="template_status_update">template_status_update (Approval / Reject)</option>
                </select>
              </div>

              <div className="sm:col-span-2 flex items-end">
                <button
                  disabled={simulatingWebhook}
                  onClick={handleSimulateWebhook}
                  className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Play size={13} className={simulatingWebhook ? 'animate-spin' : ''} />
                  <span>{simulatingWebhook ? 'Dispatching...' : 'Fire Simulated Webhook POST'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SubTab 3: Phone Quality & Tiers ── */}
      {subTab === 'quality_tier' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs p-6 space-y-4 text-xs">
            <h4 className="text-sm font-extrabold text-slate-800">Meta Phone Number Health &amp; Daily Messaging Tier</h4>
            <p className="text-slate-500 text-[11px]">
              Meta dynamically scales your daily recipient limits based on user block/report rates and message quality.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1 text-center">
                <div className="text-[10px] uppercase font-bold text-emerald-700">Quality Rating</div>
                <div className="text-2xl font-black text-emerald-800">HIGH (Green)</div>
                <div className="text-[10px] text-emerald-600 font-semibold">Health Score: {quality.qualityScore}/100</div>
              </div>

              <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 space-y-1 text-center">
                <div className="text-[10px] uppercase font-bold text-purple-700">Current Messaging Tier</div>
                <div className="text-2xl font-black text-purple-800">{quality.tier}</div>
                <div className="text-[10px] text-purple-600 font-semibold">{quality.dailyLimit.toLocaleString()} unique recipients / 24h</div>
              </div>

              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-1 text-center">
                <div className="text-[10px] uppercase font-bold text-blue-700">Spam Report Rate</div>
                <div className="text-2xl font-black text-blue-800">{quality.blockReportRate}</div>
                <div className="text-[10px] text-blue-600 font-semibold">Safe Limit: &lt; 0.50%</div>
              </div>
            </div>

            {/* Tier Upgrade Pathway */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex justify-between font-bold text-slate-700 text-xs">
                <span>Tier 2 (10K/day) → Tier 3 Upgrade (100K/day)</span>
                <span className="text-purple-700">62% Milestone Completed</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full bg-purple-600 rounded-full" style={{ width: '62%' }} />
              </div>
              <p className="text-[11px] text-slate-500">
                To upgrade to Tier 3 (100,000 msgs/day), send 5,000+ messages in a 7-day window with HIGH quality rating.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── SubTab 4: Notifications ── */}
      {subTab === 'notifications' && (
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs p-6 space-y-4 text-xs">
          <h4 className="text-sm font-extrabold text-slate-800">Operational Alert Notifications</h4>
          <div className="space-y-2.5">
            {[
              { label: 'Instant alert on Meta Template Rejection', defaultChecked: true },
              { label: 'Notify agent when customer replies on WhatsApp chat', defaultChecked: true },
              { label: 'Notify sales manager when high-intent CRM lead is auto-created', defaultChecked: true },
              { label: 'Alert when broadcast failure rate exceeds 2%', defaultChecked: true },
              { label: 'Low wallet balance alert (under ₹500 remaining)', defaultChecked: true },
            ].map((n, i) => (
              <label key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer hover:bg-slate-100/60 transition-colors">
                <span className="font-semibold text-slate-700">{n.label}</span>
                <input type="checkbox" defaultChecked={n.defaultChecked} className="w-4 h-4 accent-emerald-600 cursor-pointer" />
              </label>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
