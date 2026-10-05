import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Hexagon, Lock, Mail, User, Building, ArrowRight } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('Cafe & Restaurant');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          password,
          phone,
          business_name: businessName,
          business_type: businessType,
          currency: 'INR',
        }),
      });
      login(data.access_token, data.user, data.current_tenant);
      navigate('/waiting');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
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
        padding: '32px 24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '460px' }}>
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
            Start Your Loyalty Program
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
            Instant setup with 14-day free trial & ₹250 free WhatsApp credits
          </p>
        </div>

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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label className="form-label">
                  Your Name
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Arjun Mehta"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="form-label">
                  Business Name
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Urban Bistro"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label className="form-label">
                Business Category
              </label>
              <select
                className="form-input"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
              >
                <option value="Cafe & Bakery">Cafe & Bakery</option>
                <option value="Restaurant & Bar">Restaurant & Bar</option>
                <option value="Retail & Fashion">Retail & Fashion</option>
                <option value="Salon & Spa">Salon & Spa</option>
                <option value="Fitness & Health">Fitness & Health</option>
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label className="form-label">
                Email Address
              </label>
              <input
                type="email"
                className="form-input"
                placeholder="contact@urbanbistro.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '22px' }}>
              <div>
                <label className="form-label">
                  Phone Number
                </label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="+91 98765 00000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">
                  Password
                </label>
                <input
                  type="password"
                  className="form-input"
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
              {loading ? 'Creating Account...' : 'Get Started Free'}
              <ArrowRight size={16} />
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '22px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: 'var(--primary-hover)', fontWeight: 600, textDecoration: 'none' }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
