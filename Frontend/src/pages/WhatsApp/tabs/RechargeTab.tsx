import React, { useState } from 'react';
import {
  Wallet, CreditCard, Sparkles, ArrowUpRight, CheckCircle2,
  Clock, Download, Zap, Shield, AlertCircle, RefreshCw,
  Plus, Check, ChevronRight, FileText
} from 'lucide-react';
import { MOCK_WHATSAPP_DATA } from '../mockData';
import toast from 'react-hot-toast';

export default function RechargeTab() {
  const [balance, setBalance] = useState(MOCK_WHATSAPP_DATA.agent.walletBalance || 1450);
  const [autoRecharge, setAutoRecharge] = useState(true);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedPack, setSelectedPack] = useState<number | null>(1500);

  const PACKS = [
    { id: 1, amount: 500, bonus: 0, msgs: '1,040', popular: false, label: 'Starter Pack' },
    { id: 2, amount: 1500, bonus: 150, msgs: '3,430', popular: true, label: 'Growth Pack' },
    { id: 3, amount: 3000, bonus: 450, msgs: '7,180', popular: false, label: 'Pro Agency Pack' },
    { id: 4, amount: 5000, bonus: 1000, msgs: '12,500', popular: false, label: 'Scale Pack' },
  ];

  const [history, setHistory] = useState([
    { id: 'TXN-9941', date: '15 Aug 2026, 11:30 AM', amount: 1500, bonus: 150, mode: 'UPI (GPay)', status: 'COMPLETED', invoice: 'INV-2026-0812' },
    { id: 'TXN-8812', date: '01 Aug 2026, 09:15 AM', amount: 1000, bonus: 50, mode: 'HDFC Corporate Card', status: 'COMPLETED', invoice: 'INV-2026-0798' },
    { id: 'TXN-7734', date: '15 Jul 2026, 04:20 PM', amount: 2000, bonus: 200, mode: 'UPI (PhonePe)', status: 'COMPLETED', invoice: 'INV-2026-0744' },
    { id: 'TXN-6612', date: '01 Jul 2026, 10:00 AM', amount: 1500, bonus: 150, mode: 'UPI (GPay)', status: 'COMPLETED', invoice: 'INV-2026-0689' },
  ]);

  const handleRecharge = (amountToRecharge: number, bonusAmount: number = 0) => {
    const finalAmt = amountToRecharge;
    const finalBonus = bonusAmount || Math.round(finalAmt * 0.1);
    const totalCredit = finalAmt + finalBonus;

    setBalance(prev => prev + totalCredit);
    MOCK_WHATSAPP_DATA.agent.walletBalance = balance + totalCredit;

    const newTxn = {
      id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
      date: 'Just now',
      amount: finalAmt,
      bonus: finalBonus,
      mode: 'UPI Instant Pay',
      status: 'COMPLETED',
      invoice: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    };

    setHistory(prev => [newTxn, ...prev]);
    toast.success(`Wallet recharged with ₹${finalAmt.toLocaleString()} + ₹${finalBonus} Bonus Credits!`);
    setCustomAmount('');
  };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Top Header & Stats Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Card 1: Balance & Quick Recharge */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-600/10 flex flex-col justify-between relative overflow-hidden">
          <div className="pointer-events-none absolute -right-8 -bottom-8 w-36 h-36 bg-white/10 rounded-full blur-xl" />

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-100 flex items-center gap-1.5">
                <Wallet size={14} /> Available WhatsApp Credits
              </span>
              <span className="text-[10px] font-extrabold bg-white/20 px-2 py-0.5 rounded-full text-white">
                Live
              </span>
            </div>
            <div className="text-3xl font-black text-white mt-3">
              ₹{balance.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-emerald-100 mt-1 font-medium">
              ≈ {Math.round(balance / 0.48).toLocaleString()} messages available
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs">
            <span className="text-emerald-100 font-medium">Burn Rate: ~₹52/day</span>
            <span className="font-bold text-white">~28 Days Left</span>
          </div>
        </div>

        {/* Card 2: Auto-Recharge Safeguard */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Zap size={14} className="text-amber-500" /> Auto-Recharge Guard
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                autoRecharge ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
              }`}>
                {autoRecharge ? 'Active' : 'Disabled'}
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-800 mt-2">Zero Campaign Interruption</h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Automatically add ₹1,000 when wallet balance drops below ₹200 to prevent message dispatch failures.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Auto-Refill Threshold: ₹200</span>
            <button
              onClick={() => {
                setAutoRecharge(!autoRecharge);
                toast.success(`Auto-Recharge ${!autoRecharge ? 'Enabled' : 'Disabled'}`);
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                autoRecharge ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-emerald-600 text-white'
              }`}
            >
              {autoRecharge ? 'Disable' : 'Enable Guard'}
            </button>
          </div>
        </div>

        {/* Card 3: Meta Rate Card Reference */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Shield size={14} className="text-blue-500" /> Meta Cloud Billing Rates
            </span>
            <div className="mt-3 space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Utility &amp; Renewals:</span>
                <strong className="text-slate-800">₹0.35 / conversation</strong>
              </div>
              <div className="flex justify-between">
                <span>Marketing &amp; Campaigns:</span>
                <strong className="text-slate-800">₹0.82 / conversation</strong>
              </div>
              <div className="flex justify-between">
                <span>2-Way Service Chat:</span>
                <strong className="text-slate-800">₹0.29 / 24h session</strong>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>GST Input Tax Credit Eligible</span>
            <span className="text-blue-600 font-bold">18% GST Included</span>
          </div>
        </div>

      </div>

      {/* ── Recharge Packs Selector ── */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-800">Select Instant Recharge Pack</h3>
          <p className="text-xs text-slate-500">
            Instant credit activation with automatic GST invoice &amp; tax deduction certificate
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {PACKS.map((pack) => {
            const isSelected = selectedPack === pack.amount;
            return (
              <div
                key={pack.id}
                onClick={() => setSelectedPack(pack.amount)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? 'bg-emerald-50/40 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                {pack.popular && (
                  <span className="absolute top-0 right-0 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-bl-xl">
                    Best Value ⭐
                  </span>
                )}

                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase">{pack.label}</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    ₹{pack.amount.toLocaleString()}
                  </div>
                  {pack.bonus > 0 && (
                    <span className="inline-block mt-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.2 rounded-md">
                      + ₹{pack.bonus} Free Bonus
                    </span>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
                    ≈ <strong>{pack.msgs}</strong> WhatsApp messages
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRecharge(pack.amount, pack.bonus);
                  }}
                  className={`mt-4 w-full py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 ${
                    isSelected
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-500/20'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                  }`}
                >
                  <Sparkles size={13} /> Recharge ₹{pack.amount}
                </button>
              </div>
            );
          })}
        </div>

        {/* Custom Amount Form */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Or Enter Custom Amount:</span>
            <div className="relative w-40">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
              <input
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="2000"
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none font-bold text-slate-800"
              />
            </div>
            <button
              type="button"
              disabled={!customAmount || Number(customAmount) < 100}
              onClick={() => handleRecharge(Number(customAmount))}
              className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold transition-all"
            >
              Pay Custom
            </button>
          </div>

          <div className="text-xs text-slate-400 font-medium">
            🔒 256-bit Encrypted SSL Instant Gateway
          </div>
        </div>
      </div>

      {/* ── Transaction & Billing History Table ── */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Recharge &amp; Invoice History</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Past transactions with downloadable GST compliance tax receipts</p>
          </div>
          <button
            onClick={() => toast.success('Downloaded complete statement (PDF)')}
            className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-all"
          >
            <Download size={13} /> Download All Invoices
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-4">Date &amp; Time</th>
                <th className="py-3 px-4">Amount Paid</th>
                <th className="py-3 px-4">Bonus Credits</th>
                <th className="py-3 px-4">Payment Mode</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {history.map((txn) => (
                <tr key={txn.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-800">{txn.id}</td>
                  <td className="py-3 px-4 text-slate-500">{txn.date}</td>
                  <td className="py-3 px-4 font-black text-slate-900">₹{txn.amount.toLocaleString()}</td>
                  <td className="py-3 px-4">
                    {txn.bonus > 0 ? (
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                        +₹{txn.bonus}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-600 font-medium">{txn.mode}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 size={11} /> Success
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => toast.success(`Downloaded Tax Invoice ${txn.invoice}`)}
                      className="px-2.5 py-1 rounded-lg text-blue-600 hover:bg-blue-50 font-bold text-[11px] inline-flex items-center gap-1 transition-all"
                    >
                      <FileText size={12} /> {txn.invoice}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
