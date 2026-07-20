import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { superAdminService } from '@api/superadmin.service';
import toast from 'react-hot-toast';
import { useState } from 'react';

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password required'),
});
type Form = z.infer<typeof schema>;

export default function SuperAdminLogin() {
  const navigate  = useNavigate();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (form: Form) => {
    setLoading(true);
    try {
      await superAdminService.login(form.email, form.password);
      navigate('/superadmin/dashboard');
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/InsumitraLogo.png" alt="InsuMitra" className="h-20 w-auto mx-auto mb-4 drop-shadow-lg" />
          <p className="text-gray-300 mt-1">Platform Administration</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl shadow-xl p-8 space-y-4">
          <div className="text-center mb-2">
            <h2 className="text-lg font-semibold text-gray-900">Super Admin Login</h2>
            <p className="text-xs text-gray-500 mt-0.5">Platform-level access only</p>
          </div>

          <div>
            <label className="label">Email</label>
            <input
              {...register('email')}
              type="email"
              className="input"
              placeholder="admin@insumitra.com"
              autoComplete="username"
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label">Password</label>
            <input
              {...register('password')}
              type="password"
              className="input"
              placeholder="••••••••"
              autoComplete="current-password"
            />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-2">
            {loading ? 'Signing in…' : 'Sign In as Super Admin'}
          </button>

          <p className="text-center text-xs text-gray-400 pt-1">
            Agency login?{' '}
            <a href="/login" className="text-primary-600 hover:underline">Go to tenant login</a>
          </p>
        </form>
      </div>
    </div>
  );
}
