import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Award,
  Send,
  Zap,
  MessageSquare,
  Sparkles,
  Settings,
  ShieldCheck,
  LogOut,
  Wallet,
  ExternalLink,
  PlusCircle,
  Menu,
  X,
  CreditCard
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../api/client';
import { Wallet as WalletType, WhatsAppConnection } from '../../types';

export const AppLayout: React.FC = () => {
  const { user, tenant, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [waConnection, setWaConnection] = useState<WhatsAppConnection | null>(null);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState('500');
  const [topupLoading, setTopupLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const fetchStatus = async () => {
    try {
      const [walletData, waData] = await Promise.all([
        apiRequest<WalletType>('/wallet'),
        apiRequest<WhatsAppConnection>('/whatsapp/connection'),
      ]);
      setWallet(walletData);
      setWaConnection(waData);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [tenant]);

  const handleTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    setTopupLoading(true);
    try {
      const updated = await apiRequest<WalletType>('/wallet/topup-demo', {
        method: 'POST',
        body: JSON.stringify({ amount: parseFloat(topupAmount) }),
      });
      setWallet(updated);
      setShowTopupModal(false);
    } catch (err) {
      alert('Topup error');
    } finally {
      setTopupLoading(false);
    }
  };

  const navItems = [
    { label: 'Dashboard', path: '/app', icon: LayoutDashboard },
    { label: 'Customers', path: '/app/customers', icon: Users },
    { label: 'Loyalty & Rewards', path: '/app/loyalty', icon: Award },
    { label: 'Campaigns', path: '/app/campaigns', icon: Send },
    { label: 'Automations', path: '/app/automations', icon: Zap },
    { label: 'WhatsApp & Wallet', path: '/app/whatsapp', icon: MessageSquare },
    { label: 'Smart Insights', path: '/app/insights', icon: Sparkles },
    { label: 'Settings & Page', path: '/app/settings', icon: Settings },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: '260px',
          backgroundColor: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 40,
        }}
      >
        {/* Brand Header */}
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'var(--primary-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            <Award size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
              LoyaltySaaS
            </h1>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>WhatsApp Growth Cloud</p>
          </div>
        </div>

        {/* Business Badge */}
        {tenant && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
              Active Business
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }}>
                {tenant.name}
              </span>
              <a
                href={`/l/${tenant.slug}`}
                target="_blank"
                rel="noreferrer"
                title="Open Public Loyalty Page"
                style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}
              >
                <ExternalLink size={15} />
              </a>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== '/app' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  backgroundColor: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  border: isActive ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                }}
              >
                <Icon size={18} color={isActive ? 'var(--primary)' : 'currentColor'} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div style={{ padding: '16px 14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {user?.is_platform_admin && (
            <Link
              to="/admin"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '8px',
                fontSize: '0.825rem',
                fontWeight: 600,
                color: '#EC4899',
                backgroundColor: 'rgba(236, 72, 153, 0.1)',
                border: '1px solid rgba(236, 72, 153, 0.25)',
                textDecoration: 'none',
              }}
            >
              <ShieldCheck size={16} />
              Platform Admin
            </Link>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: 'var(--primary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div style={{ maxWidth: '120px' }}>
                <p style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.name}
                </p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.email}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              title="Logout"
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '6px' }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: '100vh' }}>
        {/* Topbar */}
        <header
          style={{
            height: '68px',
            backgroundColor: 'var(--bg-glass)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 28px',
            position: 'sticky',
            top: 0,
            zIndex: 30,
          }}
        >
          {/* Breadcrumb / Status info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
              {navItems.find((n) => n.path === location.pathname)?.label || 'Overview'}
            </span>

            {/* WhatsApp Status Pill */}
            {waConnection && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  backgroundColor: waConnection.connection_status === 'CONNECTED' ? 'rgba(37, 211, 102, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                  border: `1px solid ${waConnection.connection_status === 'CONNECTED' ? 'rgba(37, 211, 102, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: waConnection.connection_status === 'CONNECTED' ? '#25D366' : '#F59E0B',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: waConnection.connection_status === 'CONNECTED' ? '#25D366' : '#F59E0B',
                  }}
                />
                {waConnection.connection_status === 'CONNECTED' ? 'WhatsApp Connected' : 'WhatsApp Disconnected'}
              </div>
            )}
          </div>

          {/* Right Topbar Stats & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Wallet Balance Pill */}
            {wallet && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '6px 12px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Wallet size={16} color="var(--primary)" />
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'block', lineHeight: 1 }}>Credits</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      ₹{wallet.balance.toFixed(2)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowTopupModal(true)}
                  style={{
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                    color: '#818CF8',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  + Top-up
                </button>
              </div>
            )}

            {/* Public Page View Button */}
            {tenant && (
              <a
                href={`/l/${tenant.slug}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
                style={{ padding: '8px 14px', fontSize: '0.8rem' }}
              >
                <ExternalLink size={14} />
                Live Loyalty Page
              </a>
            )}
          </div>
        </header>

        {/* Page View */}
        <main style={{ flex: 1, padding: '32px 36px', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>

      {/* Quick Top-up Modal */}
      {showTopupModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div className="glass-panel" style={{ width: '400px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Add Messaging Credits</h3>
              <button onClick={() => setShowTopupModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
              Messaging credits are deducted when sending WhatsApp templates (₹0.78 per marketing message).
            </p>
            <form onSubmit={handleTopup}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>
                  Select Recharge Amount (INR)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
                  {['250', '500', '1000'].map((amt) => (
                    <button
                      type="button"
                      key={amt}
                      onClick={() => setTopupAmount(amt)}
                      style={{
                        padding: '8px',
                        borderRadius: '8px',
                        border: `1px solid ${topupAmount === amt ? 'var(--primary)' : 'var(--border-subtle)'}`,
                        backgroundColor: topupAmount === amt ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-surface-elevated)',
                        color: '#fff',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  className="form-input"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  placeholder="Custom amount"
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowTopupModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={topupLoading} className="btn btn-primary">
                  {topupLoading ? 'Adding...' : 'Confirm Top-up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
