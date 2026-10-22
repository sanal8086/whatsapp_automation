import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Award,
  Send,
  MessageSquare,
  Megaphone,
  Settings,
  ShieldCheck,
  LogOut,
  ExternalLink,
  Menu,
  MapPin,
  Hexagon,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AppLayout: React.FC = () => {
  const { user, tenant, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    return localStorage.getItem('goagain_sidebar_expanded') === 'true';
  });

  const toggleSidebar = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      localStorage.setItem('goagain_sidebar_expanded', String(next));
      return next;
    });
  };

  const navItems = [
    { label: 'Award Points', path: '/app', icon: PlusCircle },
    { label: 'Dashboard', path: '/app/dashboard', icon: LayoutDashboard },
    { label: 'Customers', path: '/app/customers', icon: Users },
    { label: 'Loyalty & Rewards', path: '/app/loyalty', icon: Award },
    { label: 'Campaigns', path: '/app/campaigns', icon: Send },
    { label: 'New Offer Run', path: '/app/offers', icon: Megaphone },
    { label: 'WhatsApp', path: '/app/whatsapp', icon: MessageSquare },
    { label: 'Settings & Page', path: '/app/settings', icon: Settings },
  ];

  const currentPage = navItems.find(
    (n) => n.path === location.pathname || (n.path !== '/app' && location.pathname.startsWith(n.path))
  );

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        maxHeight: '100vh',
        width: '100vw',
        backgroundColor: 'var(--bg-sidebar)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* ─── Expandable Docked Sidebar (Non-scrollable) ─── */}
      <aside
        style={{
          width: isExpanded ? '250px' : '78px',
          height: '100vh',
          maxHeight: '100vh',
          backgroundColor: 'var(--bg-sidebar)',
          color: 'var(--text-inverse)',
          display: 'flex',
          flexDirection: 'column',
          padding: isExpanded ? '24px 16px 20px' : '24px 0 20px',
          gap: '8px',
          flexShrink: 0,
          transition: 'width 0.28s cubic-bezier(0.16, 1, 0.3, 1), padding 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'sticky',
          top: 0,
          left: 0,
          zIndex: 40,
          overflow: 'hidden',
          userSelect: 'none',
        }}
      >
          {/* Brand Logo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isExpanded ? 'flex-start' : 'center',
              width: '100%',
              padding: isExpanded ? '0 12px 16px' : '0 0 14px',
              borderBottom: isExpanded ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
              marginBottom: isExpanded ? 8 : 4,
            }}
          >
            <Link
              to="/app"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                textDecoration: 'none',
                color: '#fff',
              }}
              title="GoAgain"
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #64d3e7 0%, #a8e7ee 100%)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(100, 211, 231, 0.3)',
                }}
              >
                <Hexagon size={19} color="#202020" />
              </div>
              {isExpanded && (
                <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.4px', display: 'block', lineHeight: 1.2 }}>
                    GoAgain
                  </span>
                  <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', display: 'block' }}>
                    Loyalty SaaS
                  </span>
                </div>
              )}
            </Link>
          </div>

          {/* Nav Items */}
          <nav
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              flex: 1,
              width: '100%',
              alignItems: isExpanded ? 'stretch' : 'center',
              overflowY: 'auto',
              scrollbarWidth: 'none',
              minHeight: 0,
            }}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item === currentPage;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={!isExpanded ? item.label : undefined}
                  style={{
                    height: 42,
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isExpanded ? 'flex-start' : 'center',
                    padding: isExpanded ? '0 14px' : 0,
                    width: isExpanded ? '100%' : 42,
                    gap: 12,
                    backgroundColor: isActive ? 'var(--bg-sidebar-active)' : 'transparent',
                    color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    position: 'relative',
                  }}
                >
                  <Icon size={18} style={{ flexShrink: 0, color: isActive ? 'var(--primary)' : 'inherit' }} />
                  {isExpanded && (
                    <span style={{ fontSize: '13.5px', fontWeight: isActive ? 600 : 450, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.label}
                    </span>
                  )}
                  {isActive && isExpanded && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary)',
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Bottom Section */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              width: '100%',
              alignItems: isExpanded ? 'stretch' : 'center',
              paddingTop: 12,
              borderTop: isExpanded ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
            }}
          >
            {isExpanded && tenant && (
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: 14,
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 4,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: 'var(--gradient-clients)',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                    color: '#202020',
                    flexShrink: 0,
                  }}
                >
                  {tenant.name?.charAt(0) || 'G'}
                </div>
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  <p
                    style={{
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: '#ffffff',
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tenant.name}
                  </p>
                  <span style={{ fontSize: '10.5px', color: 'rgba(255, 255, 255, 0.5)' }}>Partner Club</span>
                </div>
              </div>
            )}

            {user?.is_platform_admin && (
              <Link
                to="/admin"
                title={!isExpanded ? 'Platform Admin' : undefined}
                style={{
                  height: 40,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isExpanded ? 'flex-start' : 'center',
                  padding: isExpanded ? '0 14px' : 0,
                  width: isExpanded ? '100%' : 42,
                  gap: 12,
                  color: 'rgba(255, 255, 255, 0.65)',
                  transition: 'all 0.2s',
                  textDecoration: 'none',
                }}
              >
                <ShieldCheck size={18} style={{ flexShrink: 0 }} />
                {isExpanded && <span style={{ fontSize: '13px' }}>Platform Admin</span>}
              </Link>
            )}

            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              title={!isExpanded ? 'Logout' : undefined}
              style={{
                height: 40,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: isExpanded ? 'flex-start' : 'center',
                padding: isExpanded ? '0 14px' : 0,
                width: isExpanded ? '100%' : 42,
                gap: 12,
                color: 'rgba(255, 255, 255, 0.65)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <LogOut size={18} style={{ flexShrink: 0 }} />
              {isExpanded && <span style={{ fontSize: '13px' }}>Log Out</span>}
            </button>
          </div>
        </aside>

        {/* ─── Main Content Area with Inside Curve ─── */}
        <div
          style={{
            flex: 1,
            height: '100vh',
            maxHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            minHeight: 0,
            backgroundColor: 'var(--bg-app)',
            borderTopLeftRadius: '32px',
            borderBottomLeftRadius: '32px',
            overflow: 'hidden',
            boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.16)',
            position: 'relative',
            zIndex: 10,
          }}
        >
          {/* ─── Top Bar ─── */}
          <header
            style={{
              height: '72px',
              flexShrink: 0,
              backgroundColor: 'var(--bg-surface-elevated)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 36px 0 32px',
              position: 'sticky',
              top: 0,
              zIndex: 30,
            }}
          >
            {/* Left: Sidebar toggle + Page title + status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button
                onClick={toggleSidebar}
                title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  transition: 'color 0.2s, background 0.2s',
                }}
              >
                {isExpanded ? <PanelLeftClose size={19} /> : <PanelLeftOpen size={19} />}
              </button>

              <h2
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  letterSpacing: '-0.02em',
                }}
              >
                {currentPage?.label || 'Overview'}
              </h2>
          </div>

          {/* Right: Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Public Page */}
            {tenant && (
              <a
                href={`/l/${tenant.slug}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-sm btn-secondary"
              >
                <ExternalLink size={14} />
                Live Page
              </a>
            )}

            {/* User avatar */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--gradient-clients)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                cursor: 'pointer',
              }}
              title={user?.name || 'User'}
            >
              {user?.name?.charAt(0) || 'U'}
            </div>
          </div>
        </header>

        {/* ─── Page Content ─── */}
        <main
          style={{
            flex: 1,
            minHeight: 0,
            padding: '36px 42px 42px',
            overflowY: 'auto',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};
