import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { clientService } from '@api/client.service';
import { 
  User, Phone, Mail, FileText, Building, MapPin, 
  Globe, MessageSquare, Shield, CheckCircle2, AlertCircle 
} from 'lucide-react';
import toast from 'react-hot-toast';

import { FALLBACK_CLIENT_PROFILE } from './clientMockData';

const schema = z.object({
  phone: z.string().optional(),
  email: z.string().email('Valid email required').optional().or(z.literal('')),
  notes: z.string().optional(),
});
type Form = z.infer<typeof schema>;

export default function ClientProfile() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['client-me'],
    queryFn:  clientService.getMe,
  });

  const profile = data?.data || FALLBACK_CLIENT_PROFILE;

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    values: { phone: profile?.phone ?? '', email: profile?.email ?? '', notes: profile?.notes ?? '' },
  });

  const update = useMutation({
    mutationFn: (body: Form) => clientService.updateProfile(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-me'] });
      setEditing(false);
      toast.success('Profile updated successfully');
    },
    onError: () => toast.error('Failed to update profile'),
  });

  if (isLoading) return <div className="flex h-48 items-center justify-center text-gray-400">Loading profile…</div>;
  if (!profile)  return <div className="text-gray-500 p-8">Profile not found.</div>;

  const agency = profile.tenant;
  const advisor = profile.createdByUser;

  const agencyName = agency?.name || 'Sampada Investment Solutions';
  const agentName = advisor ? `${advisor.firstName} ${advisor.lastName}` : (agency?.name ? `${agency.name} Support` : 'Personal Advisor');
  const agentPhone = advisor?.phone || agency?.phone || '+91 98765 43210';
  const agentEmail = advisor?.email || agency?.email || 'support@agency.com';
  const agentPhoto = advisor?.avatarUrl || agency?.agentPhotoUrl;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900">My Profile &amp; Advisor Support</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Manage personal details and connect with your insurance advisory desk</p>
      </div>

      {/* 1. Client Personal Info Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-lg border border-blue-100 shadow-xs">
              {profile.firstName?.charAt(0) || 'C'}
            </div>
            <div>
              <p className="text-lg font-black text-slate-900">{profile.firstName} {profile.lastName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                  {profile.gender || 'Client'}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <CheckCircle2 size={11} /> Verified Portfolio
                </span>
              </div>
            </div>
          </div>

          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Edit Contact Info
            </button>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleSubmit(d => update.mutate(d))} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Mobile Phone</label>
              <input {...register('phone')} className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-slate-900 focus:border-blue-500" />
              {errors.phone && <p className="text-xs text-rose-500 mt-1">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Email Address</label>
              <input {...register('email')} className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-slate-900 focus:border-blue-500" type="email" />
              {errors.email && <p className="text-xs text-rose-500 mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Personal Notes / Preferences</label>
              <textarea {...register('notes')} rows={3} className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-slate-900 focus:border-blue-500" />
            </div>
            <div className="flex gap-2.5 pt-2">
              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer disabled:opacity-60"
              >
                Save Changes
              </button>
              <button 
                type="button" 
                onClick={() => { setEditing(false); reset(); }} 
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <Phone size={12} className="text-slate-400" /> Registered Mobile
              </span>
              <p className="font-bold text-slate-900 text-sm">{profile.phone || '—'}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <Mail size={12} className="text-slate-400" /> Email Address
              </span>
              <p className="font-bold text-slate-900 text-sm truncate">{profile.email || '—'}</p>
            </div>
            {profile.panNumber && (
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <FileText size={12} className="text-slate-400" /> PAN Number
                </span>
                <p className="font-bold text-slate-900 text-sm">{profile.panNumber}</p>
              </div>
            )}
            {profile.addresses && profile.addresses.length > 0 && (
              <div className="p-3 bg-slate-50 rounded-xl space-y-1 sm:col-span-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <MapPin size={12} className="text-slate-400" /> Communication Address
                </span>
                <p className="font-medium text-slate-800 text-xs">
                  {[profile.addresses[0].street, profile.addresses[0].city, profile.addresses[0].state, profile.addresses[0].pincode].filter(Boolean).join(', ')}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Assigned Insurance Advisor & Firm Profile Branding */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-blue-600" />
            <h3 className="font-bold text-slate-900 text-base">Your Dedicated Insurance Advisor</h3>
          </div>
          <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
            Direct Line
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
          <div className="flex items-center gap-3.5">
            {agentPhoto ? (
              <img 
                src={agentPhoto} 
                alt={agentName} 
                className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-xs" 
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-xl flex items-center justify-center shadow-xs">
                {agentName.charAt(0)}
              </div>
            )}
            <div>
              <h4 className="font-black text-slate-900 text-base">{agentName}</h4>
              <p className="text-xs text-blue-600 font-bold">{agencyName}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">IRDAI Certified Financial &amp; Insurance Protection Advisor</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                window.location.href = `tel:${agentPhone}`;
                toast.success(`Calling ${agentName}...`);
              }}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Phone size={13} /> Call
            </button>
            <button
              type="button"
              onClick={() => window.open(`https://wa.me/${agentPhone.replace(/[^0-9]/g, '')}?text=Hi%20${encodeURIComponent(agentName)},%20I%20have%20a%20query%20regarding%20my%20insurance%20policies...`, '_blank')}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <MessageSquare size={13} /> WhatsApp
            </button>
          </div>
        </div>

        {/* Agency Office Contact Info */}
        {agency && (
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {agency.address && (
              <div className="flex items-start gap-2 text-slate-600">
                <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                <span>{[agency.address, agency.city, agency.state, agency.pincode].filter(Boolean).join(', ')}</span>
              </div>
            )}
            {agency.email && (
              <div className="flex items-center gap-2 text-slate-600">
                <Mail size={14} className="text-slate-400 shrink-0" />
                <a href={`mailto:${agency.email}`} className="text-blue-600 hover:underline">{agency.email}</a>
              </div>
            )}
            {agency.website && (
              <div className="flex items-center gap-2 text-slate-600">
                <Globe size={14} className="text-slate-400 shrink-0" />
                <a href={agency.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate">{agency.website}</a>
              </div>
            )}
            {agency.phone && (
              <div className="flex items-center gap-2 text-slate-600">
                <Phone size={14} className="text-slate-400 shrink-0" />
                <span>Office: {agency.phone}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
