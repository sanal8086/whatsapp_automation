import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Building,
  Palette,
  Users,
  CreditCard,
  ExternalLink,
  Save,
  CheckCircle2
} from 'lucide-react';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Tenant, TenantMember, PublicPageData } from '../../types';

export const SettingsPage: React.FC = () => {
  const { tenant, reloadTenant } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'branding' | 'team' | 'subscription'>('profile');

  // Business profile
  const [bizName, setBizName] = useState('');
  const [bizType, setBizType] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [savingBiz, setSavingBiz] = useState(false);

  // Public Page Branding
  const [heroTitle, setHeroTitle] = useState('');
  const [heroDesc, setHeroDesc] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#059669');
  const [secondaryColor, setSecondaryColor] = useState('#D97706');
  const [termsText, setTermsText] = useState('');
  const [savingBranding, setSavingBranding] = useState(false);

  // Team & Sub
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [subscription, setSubscription] = useState<any>(null);

  const fetchSettings = async () => {
    try {
      const [tData, pageData, memData, subData] = await Promise.all([
        apiRequest<Tenant>('/tenants/current'),
        apiRequest<PublicPageData>('/tenants/current/public-page'),
        apiRequest<TenantMember[]>('/tenants/current/members'),
        apiRequest<any>('/tenants/current/subscription'),
      ]);

      setBizName(tData.name);
      setBizType(tData.business_type);
      setCurrency(tData.currency);

      setHeroTitle(pageData.hero_title);
      setHeroDesc(pageData.hero_description);
      setPrimaryColor(pageData.primary_color || '#059669');
      setSecondaryColor(pageData.secondary_color || '#D97706');
      setTermsText(pageData.terms_text || '');

      setMembers(memData);
      setSubscription(subData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [tenant]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBiz(true);
    try {
      await apiRequest('/tenants/current', {
        method: 'PATCH',
        body: JSON.stringify({ name: bizName, business_type: bizType, currency }),
      });
      await reloadTenant();
      alert('Business details updated!');
    } catch (err: any) {
      alert(err.message || 'Update failed');
    } finally {
      setSavingBiz(false);
    }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBranding(true);
    try {
      await apiRequest('/tenants/current/public-page', {
        method: 'PATCH',
        body: JSON.stringify({
          hero_title: heroTitle,
          hero_description: heroDesc,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          terms_text: termsText,
        }),
      });
      alert('Public loyalty page branding saved!');
    } catch (err: any) {
      alert(err.message || 'Update failed');
    } finally {
      setSavingBranding(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
          Business Settings & Branding
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
          Configure merchant profile, customize branded consumer loyalty landing page & manage team.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', gap: '24px' }}>
        <button
          onClick={() => setActiveTab('profile')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'profile' ? '2px solid var(--primary)' : '2px solid transparent',
            padding: '12px 4px',
            color: activeTab === 'profile' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
          }}
        >
          General Profile
        </button>

        <button
          onClick={() => setActiveTab('branding')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'branding' ? '2px solid var(--primary)' : '2px solid transparent',
            padding: '12px 4px',
            color: activeTab === 'branding' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
          }}
        >
          Public Page & Branding
        </button>

        <button
          onClick={() => setActiveTab('team')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'team' ? '2px solid var(--primary)' : '2px solid transparent',
            padding: '12px 4px',
            color: activeTab === 'team' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
          }}
        >
          Team ({members.length})
        </button>

        <button
          onClick={() => setActiveTab('subscription')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'subscription' ? '2px solid var(--primary)' : '2px solid transparent',
            padding: '12px 4px',
            color: activeTab === 'subscription' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
          }}
        >
          Subscription & Billing
        </button>
      </div>

      {/* Tab 1: Profile */}
      {activeTab === 'profile' && (
        <div className="glass-panel" style={{ padding: '28px', maxWidth: '580px' }}>
          <form onSubmit={handleSaveProfile}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Business Name</label>
              <input type="text" className="form-input" value={bizName} onChange={(e) => setBizName(e.target.value)} required />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Business Type</label>
              <input type="text" className="form-input" value={bizType} onChange={(e) => setBizType(e.target.value)} required />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Currency</label>
              <select className="form-input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="AED">AED (د.إ)</option>
              </select>
            </div>

            <button type="submit" disabled={savingBiz} className="btn btn-primary">
              <Save size={15} />
              {savingBiz ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Public Page Branding */}
      {activeTab === 'branding' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
          <div className="glass-panel" style={{ padding: '28px' }}>
            <form onSubmit={handleSaveBranding}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Hero Title</label>
                <input type="text" className="form-input" value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} required />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Hero Subtitle & Incentive</label>
                <textarea className="form-input" rows={3} value={heroDesc} onChange={(e) => setHeroDesc(e.target.value)} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Primary Accent Color</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ width: '40px', height: '38px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'none' }} />
                    <input type="text" className="form-input" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Secondary Accent Color</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} style={{ width: '40px', height: '38px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'none' }} />
                    <input type="text" className="form-input" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '22px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Terms & Conditions</label>
                <textarea className="form-input" rows={2} value={termsText} onChange={(e) => setTermsText(e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="submit" disabled={savingBranding} className="btn btn-primary">
                  <Save size={15} />
                  {savingBranding ? 'Saving...' : 'Save Branding'}
                </button>
                {tenant && (
                  <a href={`/l/${tenant.slug}`} target="_blank" rel="noreferrer" className="btn btn-secondary">
                    <ExternalLink size={15} />
                    Preview Live Page
                  </a>
                )}
              </div>
            </form>
          </div>

          {/* Mini Live Preview Box */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '14px', fontWeight: 700 }}>
              Live Portal Mockup
            </span>
            <div
              style={{
                width: '100%',
                maxWidth: '320px',
                borderRadius: '16px',
                backgroundColor: '#111827',
                border: '1px solid var(--border-subtle)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div style={{ height: '80px', backgroundColor: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 }}>
                {bizName || 'Business Name'}
              </div>
              <div style={{ padding: '16px', textAlign: 'center' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>{heroTitle}</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '14px' }}>{heroDesc}</p>
                <button
                  style={{
                    backgroundColor: secondaryColor,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    width: '100%',
                  }}
                >
                  Join VIP Rewards
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Team */}
      {activeTab === 'team' && (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '16px 20px' }}>Member</th>
                <th style={{ padding: '16px 20px' }}>Role</th>
                <th style={{ padding: '16px 20px' }}>Status</th>
                <th style={{ padding: '16px 20px' }}>Joined At</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{m.user_name}</div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{m.user_email}</span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span className="badge badge-info">{m.role}</span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span className="badge badge-success">{m.status}</span>
                  </td>
                  <td style={{ padding: '14px 20px', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                    {new Date(m.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: Subscription */}
      {activeTab === 'subscription' && (
        <div className="glass-panel" style={{ padding: '28px', maxWidth: '580px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {subscription?.plan_name || 'Growth Plan'}
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                Status: <span style={{ color: 'var(--success)', fontWeight: 700 }}>{subscription?.status || 'ACTIVE'}</span>
              </span>
            </div>
            <span className="badge badge-success">
              {subscription?.payment_status || 'VERIFIED'}
            </span>
          </div>

          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Recurring Plan Cost:</span>
              <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>₹{subscription?.amount || 2499}/month</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Billing Cycle Ends:</span>
              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                {subscription?.ends_at ? new Date(subscription.ends_at).toLocaleDateString() : 'Active'}
              </span>
            </div>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
            To upgrade your subscription tier or update billing details, contact platform administration.
          </p>
        </div>
      )}
    </div>
  );
};
