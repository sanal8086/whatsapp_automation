import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Tenant } from '../types';
import { apiRequest } from '../api/client';

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User, tenant?: Tenant) => void;
  logout: () => void;
  switchTenant: (tenantId: string) => Promise<void>;
  reloadTenant: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const login = (newToken: string, newUser: User, newTenant?: Tenant) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(newUser);
    if (newTenant) {
      localStorage.setItem('tenant_id', newTenant.id);
      setTenant(newTenant);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('tenant_id');
    setToken(null);
    setUser(null);
    setTenant(null);
  };

  const reloadTenant = async () => {
    try {
      const data = await apiRequest<Tenant>('/tenants/current');
      setTenant(data);
    } catch (err) {
      console.error('Failed to reload tenant:', err);
    }
  };

  const switchTenant = async (tenantId: string) => {
    localStorage.setItem('tenant_id', tenantId);
    await reloadTenant();
  };

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }
      try {
        const meData = await apiRequest<{ user: User; tenants: any[] }>('/auth/me');
        setUser(meData.user);
        
        let targetTenantId: string | null = localStorage.getItem('tenant_id');
        if (!targetTenantId && meData.tenants && meData.tenants.length > 0) {
          targetTenantId = meData.tenants[0].id;
          if (targetTenantId) {
            localStorage.setItem('tenant_id', targetTenantId);
          }
        }

        // If we have tenant info from /me, use that (includes status)
        if (meData.tenants && meData.tenants.length > 0) {
          const matchedTenant = targetTenantId
            ? meData.tenants.find((t: any) => t.id === targetTenantId)
            : meData.tenants[0];
          if (matchedTenant) {
            setTenant(matchedTenant as Tenant);
          }
        }

        // Only try to load full tenant data if tenant is ACTIVE
        if (targetTenantId) {
          const tenantFromMe = meData.tenants?.find((t: any) => t.id === targetTenantId);
          if (tenantFromMe && tenantFromMe.status === 'ACTIVE') {
            try {
              const tenantData = await apiRequest<Tenant>('/tenants/current');
              setTenant(tenantData);
            } catch {
              // Keep the tenant data from /me response
            }
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        token,
        isLoading,
        login,
        logout,
        switchTenant,
        reloadTenant,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

