import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, RefreshCw, LogOut, ShieldCheck, XCircle } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export const WaitingPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout, tenant, login, token, user } = useAuth();
  const [status, setStatus] = useState<string>(tenant?.status || 'PENDING_APPROVAL');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{
        tenant_id: string;
        tenant_name: string;
        tenant_status: string;
        whatsapp_connected: boolean;
      }>('/onboarding/status');

      setStatus(data.tenant_status);
      setLastChecked(new Date());

      // Update tenant in context
      if (token && user && data.tenant_status !== status) {
        login(token, user, {
          ...(tenant || { id: data.tenant_id, name: data.tenant_name, slug: '', business_type: '', country: '', currency: '', subscription_status: '' }),
          status: data.tenant_status,
        });
      }

      if (data.tenant_status === 'APPROVED') {
        navigate('/onboarding/whatsapp');
      } else if (data.tenant_status === 'ACTIVE') {
        navigate('/app');
      }
    } catch (err) {
      console.error('Status check failed:', err);
    } finally {
      setLoading(false);
      setCooldown(15);
    }
  }, [navigate, token, user, tenant, login, status]);

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isRejected = status === 'REJECTED';
  const isPending = status === 'PENDING_APPROVAL';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-main)',
        backgroundImage: isPending
          ? 'radial-gradient(circle at 50% 0%, rgba(245, 158, 11, 0.12) 0%, transparent 60%)'
          : isRejected
          ? 'radial-gradient(circle at 50% 0%, rgba(239, 68, 68, 0.12) 0%, transparent 60%)'
          : 'radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.12) 0%, transparent 60%)',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '520px' }}>
        {/* Header Icon */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '20px',
              background: isRejected
                ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
                : 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              boxShadow: isRejected
                ? '0 0 30px rgba(239, 68, 68, 0.3)'
                : '0 0 30px rgba(245, 158, 11, 0.3)',
              animation: isPending ? 'pulseSubtle 2.5s infinite ease-in-out' : 'none',
            }}
          >
            {isRejected ? (
              <XCircle size={36} color="#fff" />
            ) : (
              <Clock size={36} color="#fff" />
            )}
          </div>

          <h1
            style={{
              fontSize: '1.85rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'var(--text-main)',
              marginBottom: '8px',
            }}
          >
            {isRejected ? 'Application Not Approved' : 'Under Review'}
          </h1>
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.95rem',
              maxWidth: '400px',
              margin: '0 auto',
              lineHeight: '1.6',
            }}
          >
            {isRejected
              ? 'Unfortunately, your application was not approved at this time. Please contact support for more details.'
              : 'Thank you for signing up! Our team is reviewing your application and will connect with you shortly.'}
          </p>
        </div>

        {/* Status Card */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          {/* Progress Steps */}
          {!isRejected && (
            <div style={{ marginBottom: '28px' }}>
              {[
                { label: 'Account Created', done: true },
                { label: 'Admin Review', done: false, active: true },
                { label: 'WhatsApp Setup', done: false },
                { label: 'Go Live!', done: false },
              ].map((step, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '10px 0',
                    borderBottom: i < 3 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                >
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      flexShrink: 0,
                      background: step.done
                        ? 'var(--emerald-gradient)'
                        : step.active
                        ? 'var(--amber-gradient)'
                        : 'var(--bg-surface-elevated)',
                      color: step.done || step.active ? '#fff' : 'var(--text-dim)',
                      boxShadow: step.active
                        ? '0 0 12px rgba(245, 158, 11, 0.4)'
                        : 'none',
                    }}
                  >
                    {step.done ? (
                      <ShieldCheck size={14} />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: step.active ? 700 : 500,
                      color: step.done
                        ? 'var(--success)'
                        : step.active
                        ? 'var(--warning)'
                        : 'var(--text-dim)',
                    }}
                  >
                    {step.label}
                    {step.active && (
                      <span
                        className="animate-pulse-subtle"
                        style={{
                          marginLeft: '8px',
                          fontSize: '0.7rem',
                          color: 'var(--warning)',
                          fontWeight: 600,
                        }}
                      >
                        IN PROGRESS
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Check Status Button */}
          <button
            onClick={checkStatus}
            disabled={loading || cooldown > 0}
            className="btn"
            style={{
              width: '100%',
              padding: '14px',
              background:
                loading || cooldown > 0
                  ? 'var(--bg-surface-elevated)'
                  : 'var(--primary-gradient)',
              color: loading || cooldown > 0 ? 'var(--text-dim)' : '#fff',
              cursor: loading || cooldown > 0 ? 'not-allowed' : 'pointer',
              opacity: loading || cooldown > 0 ? 0.6 : 1,
              boxShadow:
                loading || cooldown > 0
                  ? 'none'
                  : '0 4px 14px rgba(99, 102, 241, 0.35)',
              fontSize: '0.9rem',
              fontWeight: 700,
            }}
          >
            <RefreshCw
              size={16}
              style={{
                animation: loading ? 'spin 1s linear infinite' : 'none',
              }}
            />
            {loading
              ? 'Checking...'
              : cooldown > 0
              ? `Check Again (${cooldown}s)`
              : 'Check Status'}
          </button>

          {lastChecked && (
            <p
              style={{
                textAlign: 'center',
                fontSize: '0.75rem',
                color: 'var(--text-dim)',
                marginTop: '10px',
              }}
            >
              Last checked: {lastChecked.toLocaleTimeString()}
            </p>
          )}

          {/* Separator */}
          <div
            style={{
              borderTop: '1px solid var(--border-subtle)',
              marginTop: '20px',
              paddingTop: '16px',
              textAlign: 'center',
            }}
          >
            <button
              onClick={handleLogout}
              className="btn btn-ghost"
              style={{ fontSize: '0.85rem', gap: '6px' }}
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>

        {/* Info footer */}
        <p
          style={{
            textAlign: 'center',
            marginTop: '20px',
            fontSize: '0.8rem',
            color: 'var(--text-dim)',
          }}
        >
          Need help? Contact us at{' '}
          <span style={{ color: 'var(--primary)' }}>support@goagain.in</span>
        </p>
      </div>

      {/* Spin animation for refresh icon */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
