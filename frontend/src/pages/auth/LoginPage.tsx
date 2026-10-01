import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Hexagon, Lock, Mail, ArrowRight, Sparkles, Coffee } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      login(data.access_token, data.user, data.current_tenant);
      if (data.user.is_platform_admin && !data.current_tenant) {
        navigate('/admin');
      } else {
        navigate('/app');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoMerchant = () => {
    setEmail('merchant@brewandbite.com');
    setPassword('merchant123');
  };

  const fillSuperAdmin = () => {
    setEmail('admin@loyaltysaas.com');
    setPassword('admin123');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-body)',
        backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(100, 211, 231, 0.15) 0%, transparent 60%)',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Logo and Tagline matching dashboard aesthetics */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #64d3e7 0%, #a8e7ee 100%)',
              display: 'inline-grid',
              placeItems: 'center',
              boxShadow: '0 8px 24px rgba(100, 211, 231, 0.32)',
              marginBottom: 16,
            }}
          >
            <Hexagon size={24} color="#202020" />
          </div>
          <h1
            style={{
              fontSize: '30px',
              fontWeight: 500,
              letterSpacing: '-1.1px',
              lineHeight: 1.15,
              color: 'var(--text-main)',
              margin: 0,
            }}
          >
            Welcome back
          </h1>
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '13.5px',
              lineHeight: 1.45,
              marginTop: '8px',
              fontWeight: 400,
            }}
          >
            Manage customer rewards, segments & WhatsApp campaigns
          </p>
        </div>

        {/* Card with dashboard surface styling */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '28px',
            padding: '36px 32px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)',
          }}
        >
          {error && (
            <div
              style={{
                backgroundColor: 'var(--danger-bg)',
                color: 'var(--danger)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '12px 16px',
                borderRadius: '12px',
                fontSize: '13px',
                marginBottom: '20px',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '18px' }}>
              <label className="form-label">
                Business Email
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '14px', top: '15px' }} />
                <input
                  type="email"
                  className="form-input"
                  style={{ paddingLeft: '42px', height: '46px', borderRadius: '14px' }}
                  placeholder="name@business.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '22px' }}>
              <label className="form-label">
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '14px', top: '15px' }} />
                <input
                  type="password"
                  className="form-input"
                  style={{ paddingLeft: '42px', height: '46px', borderRadius: '14px' }}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-dark-pill"
              style={{
                width: '100%',
                height: '46px',
                fontSize: '14px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Quick Demo Logins */}
          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
            <p
              style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                color: 'var(--text-dim)',
                fontWeight: 600,
                letterSpacing: '0.06em',
                marginBottom: '10px',
                textAlign: 'center',
              }}
            >
              ⚡ 1-Click Quick Demo Access
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={fillDemoMerchant}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '14px',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Coffee size={15} color="#10B981" />
                  Brew & Bite Cafe Merchant
                </span>
                <span style={{ color: 'var(--primary-hover)', fontSize: '12px', fontWeight: 600 }}>Fill Login →</span>
              </button>

              <button
                type="button"
                onClick={fillSuperAdmin}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '14px',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Sparkles size={15} color="#EC4899" />
                  Platform Super Admin
                </span>
                <span style={{ color: 'var(--primary-hover)', fontSize: '12px', fontWeight: 600 }}>Fill Login →</span>
              </button>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '22px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Don't have an account?{' '}
              <Link to="/register" style={{ color: 'var(--primary-hover)', fontWeight: 600, textDecoration: 'none' }}>
                Start 14-Day Free Trial
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
