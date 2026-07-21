import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useAuthStore } from '@store/auth.store';
import { useClientStore } from '@store/client.store';
import { useQuery } from '@tanstack/react-query';
import { subscriptionsService } from '@api/index';
import Layout from '@comps/layout/Layout';
import ClientLayout from '@comps/layout/ClientLayout';

// Auth pages
import Login from '@pages/Auth/Login';

// SuperAdmin pages
import SuperAdminLogin      from '@pages/Superadmin/Login';
import { SuperAdminLayout } from '@pages/Superadmin/SuperAdminLayout';
const SuperAdminDashboard = lazy(() => import('@pages/Superadmin/Dashboard'));
const SuperAdminTenants   = lazy(() => import('@pages/Superadmin/Tenants'));

// Client portal pages
import ClientLogin     from '@pages/Client/Login';
const ClientDashboard  = lazy(() => import('@pages/Client/Dashboard'));
const ClientPolicies   = lazy(() => import('@pages/Client/Policies'));
const ClientClaims     = lazy(() => import('@pages/Client/Claims'));
const ClientProfile    = lazy(() => import('@pages/Client/Profile'));

// Feature pages (lazy-loaded)
const Dashboard      = lazy(() => import('@pages/Dashboard'));
const Workspace      = lazy(() => import('@pages/Workspace'));
const Contacts       = lazy(() => import('@pages/Contacts'));
const ContactDetail  = lazy(() => import('@pages/Contacts/ContactDetail'));
const Leads          = lazy(() => import('@pages/Leads'));
const LeadDetail     = lazy(() => import('@pages/Leads/LeadDetail'));
const Policies       = lazy(() => import('@pages/Policies'));
const PolicyDetail   = lazy(() => import('@pages/Policies/PolicyDetail'));
const Claims         = lazy(() => import('@pages/Claims'));
const ClaimDetail    = lazy(() => import('@pages/Claims/ClaimDetail'));
const Employees        = lazy(() => import('@pages/Employees'));
const EmployeesLayout  = lazy(() => import('@pages/Employees/EmployeesLayout'));
const EmployeeTargets  = lazy(() => import('@pages/Employees/Targets'));
const EmployeeAttend   = lazy(() => import('@pages/Employees/Attendance'));
const EmployeeEod      = lazy(() => import('@pages/Employees/EodReports'));
const EmployeeAccess   = lazy(() => import('@pages/Employees/AccessControl'));
const EmployeeDetail   = lazy(() => import('@pages/Employees/EmployeeDetail'));
const Commissions    = lazy(() => import('@pages/Commissions'));
const WhatsApp       = lazy(() => import('@pages/WhatsApp'));
const Calendar       = lazy(() => import('@pages/Calendar'));
const Settings       = lazy(() => import('@pages/Settings'));
const Subscription   = lazy(() => import('@pages/Subscription'));
const Insurance      = lazy(() => import('@pages/Insurance'));
const Documents      = lazy(() => import('@pages/Documents'));
const DeletionRequests = lazy(() => import('@pages/DeletionRequests'));
const GlobalSearch   = lazy(() => import('@pages/Search'));
const FirmProfile    = lazy(() => import('@pages/FirmProfile'));

function PrivateRoute({ children }: { children: React.ReactNode }) {

  const token = useAuthStore(s => s.accessToken);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function OwnerRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'EMPLOYEE') return <Navigate to="/workspace" replace />;
  if (user.role !== 'OWNER' && user.role !== 'SUPERADMIN') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminOrAuthorizedRoute({ children, permission }: { children: React.ReactNode; permission?: string }) {
  const user = useAuthStore(s => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'OWNER' || user.role === 'SUPERADMIN') return <>{children}</>;
  if (user.role === 'EMPLOYEE' && permission && (user as any).permissions?.includes(permission)) {
    return <>{children}</>;
  }
  return <Navigate to="/workspace" replace />;
}

function PlanProtectedRoute({ children, feature }: { children: React.ReactNode; feature: string }) {
  const user = useAuthStore(s => s.user);
  
  const { data: subRes, isLoading } = useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: subscriptionsService.current,
    staleTime: 5 * 60_000,
    enabled: !!user,
  });

  if (isLoading) {
    return <Loader />;
  }

  const sub = subRes?.data;
  const planName = sub?.plan?.name || 'Free';

  const isFeatureEnabled = (plan: string, feat: string): boolean => {
    if (user?.role === 'SUPERADMIN') return true;
    const freeFeatures = ['contacts', 'policies', 'claims', 'calendar', 'workspace'];
    if (freeFeatures.includes(feat)) return true;

    const starterFeatures = [...freeFeatures, 'dashboard', 'leads', 'documents', 'operations'];
    if (plan === 'Starter') {
      return starterFeatures.includes(feat);
    }

    const growthFeatures = [...starterFeatures, 'employees', 'commissions', 'branding'];
    if (plan === 'Growth') {
      return growthFeatures.includes(feat);
    }

    if (plan === 'Enterprise' || plan === 'Business') {
      return true;
    }

    return false;
  };

  if (!isFeatureEnabled(planName, feature)) {
    const redirectPath = (user?.role === 'EMPLOYEE' || planName === 'Free') ? '/workspace' : '/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}

function ClientRoute({ children }: { children: React.ReactNode }) {
  const token = useClientStore(s => s.accessToken);
  return token ? <>{children}</> : <Navigate to="/client/login" replace />;
}

function Loader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
    </div>
  );
}

function IndexRedirect() {
  const user = useAuthStore(s => s.user);

  const { data: subRes, isLoading } = useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: subscriptionsService.current,
    staleTime: 5 * 60_000,
    enabled: !!user,
  });

  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'SUPERADMIN') {
    return <Navigate to="/superadmin" replace />;
  }

  if (isLoading) {
    return <Loader />;
  }

  const sub = subRes?.data;
  const planName = sub?.plan?.name || 'Free';

  if (user.role === 'OWNER' || user.role === 'ADMIN') {
    if (planName === 'Free') {
      return <Navigate to="/workspace" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  if (user.role === 'EMPLOYEE') {
    return <Navigate to="/workspace" replace />;
  }

  return <Navigate to="/workspace" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* SuperAdmin */}
      <Route path="/superadmin/login" element={<SuperAdminLogin />} />
      <Route path="/superadmin" element={<SuperAdminLayout />}>
        <Route index element={<Navigate to="/superadmin/dashboard" replace />} />
        <Route path="dashboard" element={<Suspense fallback={<Loader />}><SuperAdminDashboard /></Suspense>} />
        <Route path="tenants"   element={<Suspense fallback={<Loader />}><SuperAdminTenants /></Suspense>} />
        <Route path="deletion-requests" element={<Suspense fallback={<Loader />}><DeletionRequests /></Suspense>} />
      </Route>

      {/* Client Portal */}
      <Route path="/client/login" element={<ClientLogin />} />
      <Route
        path="/client"
        element={<ClientRoute><ClientLayout /></ClientRoute>}
      >
        <Route index element={<Navigate to="/client/dashboard" replace />} />
        <Route path="dashboard" element={<Suspense fallback={<Loader />}><ClientDashboard /></Suspense>} />
        <Route path="policies"  element={<Suspense fallback={<Loader />}><ClientPolicies /></Suspense>} />
        <Route path="policies/:id" element={<Suspense fallback={<Loader />}><ClientPolicies /></Suspense>} />
        <Route path="claims"    element={<Suspense fallback={<Loader />}><ClientClaims /></Suspense>} />
        <Route path="profile"   element={<Suspense fallback={<Loader />}><ClientProfile /></Suspense>} />
      </Route>

      {/* Protected */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<IndexRedirect />} />
        <Route path="dashboard"    element={<OwnerRoute><PlanProtectedRoute feature="dashboard"><Suspense fallback={<Loader />}><Dashboard /></Suspense></PlanProtectedRoute></OwnerRoute>} />
        <Route path="workspace"    element={<PlanProtectedRoute feature="workspace"><Suspense fallback={<Loader />}><Workspace /></Suspense></PlanProtectedRoute>} />
        <Route path="contacts"     element={<Suspense fallback={<Loader />}><Contacts /></Suspense>} />
        <Route path="contacts/:id" element={<Suspense fallback={<Loader />}><ContactDetail /></Suspense>} />
        <Route path="leads"        element={<PlanProtectedRoute feature="leads"><Suspense fallback={<Loader />}><Leads /></Suspense></PlanProtectedRoute>} />
        <Route path="leads/:id"    element={<PlanProtectedRoute feature="leads"><Suspense fallback={<Loader />}><LeadDetail /></Suspense></PlanProtectedRoute>} />
        <Route path="policies"     element={<Suspense fallback={<Loader />}><Policies /></Suspense>} />
        <Route path="policies/:id" element={<Suspense fallback={<Loader />}><PolicyDetail /></Suspense>} />
        <Route path="claims"       element={<Suspense fallback={<Loader />}><Claims /></Suspense>} />
        <Route path="claims/:id"   element={<Suspense fallback={<Loader />}><ClaimDetail /></Suspense>} />
        <Route
          path="employees/*"
          element={
            <AdminOrAuthorizedRoute permission="manage_employees">
              <PlanProtectedRoute feature="employees">
                <Suspense fallback={<Loader />}><EmployeesLayout /></Suspense>
              </PlanProtectedRoute>
            </AdminOrAuthorizedRoute>
          }
        >
          <Route index                element={<Suspense fallback={<Loader />}><Employees /></Suspense>} />
          <Route path="targets"        element={<Suspense fallback={<Loader />}><EmployeeTargets /></Suspense>} />
          <Route path="attendance"     element={<Suspense fallback={<Loader />}><EmployeeAttend /></Suspense>} />
          <Route path="eod-reports"    element={<Suspense fallback={<Loader />}><EmployeeEod /></Suspense>} />
          <Route path="access-control" element={<Suspense fallback={<Loader />}><EmployeeAccess /></Suspense>} />
        </Route>
        <Route path="employees/:id" element={<AdminOrAuthorizedRoute permission="manage_employees"><PlanProtectedRoute feature="employees"><Suspense fallback={<Loader />}><EmployeeDetail /></Suspense></PlanProtectedRoute></AdminOrAuthorizedRoute>} />
        <Route path="commissions"  element={<OwnerRoute><PlanProtectedRoute feature="commissions"><Suspense fallback={<Loader />}><Commissions /></Suspense></PlanProtectedRoute></OwnerRoute>} />
        <Route path="whatsapp/*"   element={<AdminOrAuthorizedRoute permission="manage_whatsapp"><PlanProtectedRoute feature="whatsapp"><Suspense fallback={<Loader />}><WhatsApp /></Suspense></PlanProtectedRoute></AdminOrAuthorizedRoute>} />
        <Route path="calendar"     element={<Suspense fallback={<Loader />}><Calendar /></Suspense>} />
        <Route path="settings"     element={<OwnerRoute><Suspense fallback={<Loader />}><Settings /></Suspense></OwnerRoute>} />
        <Route path="firm-profile" element={<OwnerRoute><PlanProtectedRoute feature="branding"><Suspense fallback={<Loader />}><FirmProfile /></Suspense></PlanProtectedRoute></OwnerRoute>} />
        <Route path="subscription" element={<OwnerRoute><Suspense fallback={<Loader />}><Subscription /></Suspense></OwnerRoute>} />
        <Route path="operations"   element={<OwnerRoute><PlanProtectedRoute feature="operations"><Suspense fallback={<Loader />}><Insurance /></Suspense></PlanProtectedRoute></OwnerRoute>} />
        <Route path="documents"    element={<OwnerRoute><PlanProtectedRoute feature="documents"><Suspense fallback={<Loader />}><Documents /></Suspense></PlanProtectedRoute></OwnerRoute>} />
        <Route path="search"       element={<OwnerRoute><Suspense fallback={<Loader />}><GlobalSearch /></Suspense></OwnerRoute>} />
        <Route path="deletion-requests" element={<OwnerRoute><Suspense fallback={<Loader />}><DeletionRequests /></Suspense></OwnerRoute>} />
      </Route>

      <Route path="*" element={<IndexRedirect />} />
    </Routes>
  );
}



