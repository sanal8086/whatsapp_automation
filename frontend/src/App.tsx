import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { CustomersPage } from './pages/customers/CustomersPage';
import { CustomerDetailPage } from './pages/customers/CustomerDetailPage';
import { LoyaltyPage } from './pages/loyalty/LoyaltyPage';
import { CampaignsPage } from './pages/campaigns/CampaignsPage';
import { AutomationsPage } from './pages/automations/AutomationsPage';
import { WhatsAppPage } from './pages/whatsapp/WhatsAppPage';
import { InsightsPage } from './pages/insights/InsightsPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { AdminPage } from './pages/admin/AdminPage';
import { PublicLoyaltyPage } from './pages/public/PublicLoyaltyPage';
import { WaitingPage } from './pages/onboarding/WaitingPage';
import { WhatsAppOnboardingPage } from './pages/onboarding/WhatsAppOnboardingPage';

// Protected Route Guard — routes based on tenant onboarding status
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isLoading, tenant } = useAuth();
  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--bg-body)', color: 'var(--text-muted)' }}>
        Loading...
      </div>
    );
  }
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Route based on tenant onboarding status
  const tenantStatus = tenant?.status;
  if (tenantStatus === 'PENDING_APPROVAL' || tenantStatus === 'REJECTED') {
    return <Navigate to="/waiting" replace />;
  }
  if (tenantStatus === 'APPROVED') {
    return <Navigate to="/onboarding/whatsapp" replace />;
  }

  return <>{children}</>;
};

// Onboarding Route Guard — only for pending/approved tenants
const OnboardingRoute: React.FC<{ children: React.ReactNode; allowedStatuses: string[] }> = ({ children, allowedStatuses }) => {
  const { token, isLoading, tenant } = useAuth();
  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0B0F19', color: '#9CA3AF' }}>
        Loading...
      </div>
    );
  }
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const tenantStatus = tenant?.status;
  if (tenantStatus === 'ACTIVE') {
    return <Navigate to="/app" replace />;
  }
  if (tenantStatus && !allowedStatuses.includes(tenantStatus)) {
    if (tenantStatus === 'PENDING_APPROVAL' || tenantStatus === 'REJECTED') {
      return <Navigate to="/waiting" replace />;
    }
    if (tenantStatus === 'APPROVED') {
      return <Navigate to="/onboarding/whatsapp" replace />;
    }
  }

  return <>{children}</>;
};

// Admin Guard
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token, isLoading } = useAuth();
  if (isLoading) return null;
  if (!token || !user?.is_platform_admin) {
    return <Navigate to="/app" replace />;
  }
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Branded Loyalty Landing Page */}
          <Route path="/l/:slug" element={<PublicLoyaltyPage />} />

          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Onboarding Flow */}
          <Route
            path="/waiting"
            element={
              <OnboardingRoute allowedStatuses={['PENDING_APPROVAL', 'REJECTED']}>
                <WaitingPage />
              </OnboardingRoute>
            }
          />
          <Route
            path="/onboarding/whatsapp"
            element={
              <OnboardingRoute allowedStatuses={['APPROVED']}>
                <WhatsAppOnboardingPage />
              </OnboardingRoute>
            }
          />

          {/* Platform Super Admin */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          />

          {/* Merchant Application — only for ACTIVE tenants */}
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="customers/:id" element={<CustomerDetailPage />} />
            <Route path="loyalty" element={<LoyaltyPage />} />
            <Route path="campaigns" element={<CampaignsPage />} />
            <Route path="automations" element={<AutomationsPage />} />
            <Route path="whatsapp" element={<WhatsAppPage />} />
            <Route path="insights" element={<InsightsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Default Route */}
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;

