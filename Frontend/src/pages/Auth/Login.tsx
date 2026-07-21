import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { authService } from '@api/auth.service';
import toast from 'react-hot-toast';
import { 
  Mail, Lock, Eye, EyeOff, ShieldCheck, Sparkles, 
  ArrowRight, Users, Layers
} from 'lucide-react';

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type Form = z.infer<typeof schema>;

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    setLoading(true);
    try {
      await authService.login(data);
      navigate('/');
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (roleEmail: string) => {
    const pwd = roleEmail.includes('owner') ? 'Owner@1234!' : 'Employee@1234!';
    setValue('email', roleEmail, { shouldValidate: true });
    setValue('password', pwd, { shouldValidate: true });
    toast.success(`Demo credentials loaded for ${roleEmail.split('@')[0]}`);
  };

  return (
    <div className="h-screen w-full bg-slate-50 relative overflow-hidden flex flex-col items-center justify-center p-3 md:p-4 select-none">
      
      {/* Soft Pastel Floating Ambient Blobs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-teal-200/50 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute top-1/3 -right-32 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-emerald-200/40 rounded-full blur-3xl pointer-events-none" />

      {/* Subtle Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:28px_28px] opacity-35 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md my-auto flex flex-col items-center">

        {/* Top Centered Portal Switcher Tabs */}
        <div className="inline-flex items-center gap-1 p-1 bg-white/90 backdrop-blur-xl border border-white rounded-full shadow-md shadow-teal-900/5 mb-3 text-[11px] font-semibold">
          <span className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-sm">
            Agency Login
          </span>
          <a href="/client/login" className="px-3 py-1.5 rounded-full text-slate-600 hover:text-slate-900 transition-colors">
            Client Portal
          </a>
          <a href="/superadmin/login" className="px-3 py-1.5 rounded-full text-slate-600 hover:text-slate-900 transition-colors">
            Admin Portal
          </a>
        </div>

        {/* Centered Glassmorphic Login Form Card */}
        <div className="w-full bg-white/90 backdrop-blur-2xl border border-white rounded-3xl p-5 md:p-6 shadow-xl shadow-slate-300/50 space-y-3">
          
          {/* Logo & Header */}
          <div className="text-center space-y-1">
            <img src="/InsumitraLogo.png" alt="InsuMitra" className="h-24 md:h-28 max-w-[260px] w-auto object-contain mx-auto" />

            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight">Welcome Back</h1>
              <p className="text-[11px] text-slate-500 font-medium">Sign in to access your agency workspace</p>
            </div>
          </div>

          {/* Quick Fill Demo Roles */}
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('owner@demo-agency.com')}
                className="px-3 py-1 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200/80 text-teal-800 text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
              >
                <Users className="w-3 h-3 text-teal-600" /> Broker-Owner
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('employee@demo-agency.com')}
                className="px-3 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 text-indigo-800 text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
              >
                <Layers className="w-3 h-3 text-indigo-600" /> Employee
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-2.5">
            
            {/* Email Field */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="you@agency.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all"
                />
              </div>
              {errors.email && (
                <p className="text-[10px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                  <span>•</span> {errors.email.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-9 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[10px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                  <span>•</span> {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-1 py-3 px-5 rounded-xl bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 hover:from-teal-700 hover:to-emerald-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 hover:shadow-lg hover:shadow-teal-600/30 transition-all hover:scale-[1.005] active:scale-[0.995] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Security Compliance */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>256-bit Encrypted SSL Security</span>
          </div>

        </div>

        {/* Footer info */}
        <p className="text-center text-[10px] text-slate-400 font-medium mt-3">
          © {new Date().getFullYear()} InsuMitra. All rights reserved.
        </p>

      </div>
    </div>
  );
}
