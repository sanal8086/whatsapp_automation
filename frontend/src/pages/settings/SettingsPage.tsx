import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Building,
  Users,
  Save,
  CheckCircle2,
  Edit2,
  Trash2,
  X,
  Award,
  Layers,
  FileText
} from 'lucide-react';
import { apiRequest } from '../../api/client';
import { alertError, alertSuccess } from '../../utils/alert';
import { useAuth } from '../../context/AuthContext';
import { Tenant, TenantMember, Segment } from '../../types';
import { RuleBuilder, SegmentRules, defaultRules, coerceRules, hasCompleteRules, describeRules } from '../../components/segments/RuleBuilder';

type TabKey = 'profile' | 'team' | 'segments' | 'tiers';

interface TierConfig {
  thresholds: {
    SILVER: number;
    GOLD: number;
    PLATINUM: number;
  };
  names: {
    BRONZE: string;
    SILVER: string;
    GOLD: string;
    PLATINUM: string;
  };
}

const DEFAULT_TIER_CONFIG: TierConfig = {
  thresholds: { SILVER: 500, GOLD: 1500, PLATINUM: 3000 },
  names: { BRONZE: 'Bronze', SILVER: 'Silver', GOLD: 'Gold', PLATINUM: 'Platinum' }
};

export const SettingsPage: React.FC = () => {
  const { tenant, reloadTenant } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('profile');

  // Business profile
  const [bizName, setBizName] = useState('');
  const [bizType, setBizType] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [savingBiz, setSavingBiz] = useState(false);

  // Team
  const [members, setMembers] = useState<TenantMember[]>([]);

  // Segments
  const [segments, setSegments] = useState<Segment[]>([]);
  const [showSegmentModal, setShowSegmentModal] = useState(false);
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [segmentName, setSegmentName] = useState('');
  const [segmentDesc, setSegmentDesc] = useState('');
  const [segmentRules, setSegmentRules] = useState<SegmentRules>(defaultRules());
  const [savingSegment, setSavingSegment] = useState(false);

  // Tier Config
  const [tierConfig, setTierConfig] = useState<TierConfig>(DEFAULT_TIER_CONFIG);
  const [savingTiers, setSavingTiers] = useState(false);

  const fetchSettings = async () => {
    try {
      const [tData, memData, segData, tierData] = await Promise.all([
        apiRequest<Tenant>('/tenants/current'),
        apiRequest<TenantMember[]>('/tenants/current/members'),
        apiRequest<Segment[]>('/segments'),
        apiRequest<TierConfig>('/loyalty/tier-config').catch(() => DEFAULT_TIER_CONFIG),
      ]);

      setBizName(tData.name);
      setBizType(tData.business_type);
      setCurrency(tData.currency);

      setMembers(memData);
      setSegments(segData);
      setTierConfig(tierData || DEFAULT_TIER_CONFIG);
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
      alertSuccess('Business details updated!');
    } catch (err: any) {
      alertError(err.message || 'Update failed');
    } finally {
      setSavingBiz(false);
    }
  };

  // Segment handlers
  const openEditSegment = (seg: Segment) => {
    setEditingSegmentId(seg.id);
    setSegmentName(seg.name);
    setSegmentDesc(seg.description || '');
    setSegmentRules(seg.rules_json || defaultRules());
    setShowSegmentModal(true);
  };

  const handleSaveSegment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasCompleteRules(segmentRules)) {
      alertError('Please fill in all rule conditions');
      return;
    }
    setSavingSegment(true);
    try {
      if (editingSegmentId) {
        await apiRequest(`/segments/${editingSegmentId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: segmentName,
            description: segmentDesc,
            rules_json: coerceRules(segmentRules),
          }),
        });
        alertSuccess('Segment updated!');
      } else {
        await apiRequest('/segments', {
          method: 'POST',
          body: JSON.stringify({
            name: segmentName,
            description: segmentDesc,
            rules_json: coerceRules(segmentRules),
            source: 'MANUAL',
          }),
        });
        alertSuccess('Segment created!');
      }
      setShowSegmentModal(false);
      fetchSettings();
    } catch (err: any) {
      alertError(err.message || 'Error saving segment');
    } finally {
      setSavingSegment(false);
    }
  };

  const handleDeleteSegment = async (segId: string) => {
    if (!confirm('Delete this segment? This cannot be undone.')) return;
    try {
      await apiRequest(`/segments/${segId}`, { method: 'DELETE' });
      alertSuccess('Segment deleted');
      fetchSettings();
    } catch (err: any) {
      alertError(err.message || 'Cannot delete segment');
    }
  };

  // Tier config handler
  const handleSaveTierConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTiers(true);
    try {
      await apiRequest('/loyalty/tier-config', {
        method: 'PUT',
        body: JSON.stringify(tierConfig),
      });
      alertSuccess('Tier configuration saved!');
    } catch (err: any) {
      alertError(err.message || 'Error saving tier config');
    } finally {
      setSavingTiers(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 className="page-title">
          Business Settings
        </h1>
        <p className="page-subtitle">
          Configure merchant profile, manage team, segments & loyalty tiers.
        </p>
      </div>

      {/* Tabs */}
      <div className="subnav-tabs">
        <button
          onClick={() => setActiveTab('profile')}
          className={`subnav-tab ${activeTab === 'profile' ? 'active' : ''}`}
        >
          General Profile
        </button>

        <button
          onClick={() => setActiveTab('team')}
          className={`subnav-tab ${activeTab === 'team' ? 'active' : ''}`}
        >
          Team ({members.length})
        </button>

        <button
          onClick={() => setActiveTab('segments')}
          className={`subnav-tab ${activeTab === 'segments' ? 'active' : ''}`}
        >
          <Layers size={15} />
          Segments ({segments.length})
        </button>

        <button
          onClick={() => setActiveTab('tiers')}
          className={`subnav-tab ${activeTab === 'tiers' ? 'active' : ''}`}
        >
          <Award size={15} />
          Tier Config
        </button>
      </div>

      {/* Tab 1: Profile */}
      {activeTab === 'profile' && (
        <div className="card" style={{ padding: '28px', maxWidth: '580px' }}>
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

      {/* Tab 3: Team */}
      {activeTab === 'team' && (
        <div className="table-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="table-modern">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined At</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const initial = (m.user_name || 'U').charAt(0).toUpperCase();
                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div className="table-avatar cyan">
                            {initial}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '13.5px' }}>{m.user_name}</div>
                            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{m.user_email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-info" style={{ borderRadius: '9999px', padding: '4px 12px', fontSize: '11px' }}>{m.role}</span>
                      </td>
                      <td>
                        <span className="badge badge-success" style={{ borderRadius: '9999px', padding: '4px 12px', fontSize: '11px' }}>{m.status}</span>
                      </td>
                      <td style={{ color: 'var(--text-dim)', fontSize: '12px' }}>
                        {new Date(m.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Segments */}
      {activeTab === 'segments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              View and manage customer segments. Create new segments from the Campaigns page.
            </p>
          </div>

          {segments.length === 0 ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
              <Layers size={40} color="var(--text-dim)" style={{ marginBottom: '12px' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>No segments yet</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '16px' }}>Segments let you group customers for targeted WhatsApp campaigns.</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Create segments from the Campaigns page when building a campaign.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {segments.map((seg) => (
                <div key={seg.id} className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>{seg.name}</h3>
                      {seg.description && <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{seg.description}</p>}
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#8B5CF6', background: 'rgba(139, 92, 246, 0.1)', padding: '4px 12px', borderRadius: '9999px' }}>
                      {seg.cached_count} people
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '14px' }}>
                    {seg.rules_json ? describeRules(seg.rules_json) : 'No rules defined'}
                  </p>
                  <div style={{ display: 'flex', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                    <button onClick={() => openEditSegment(seg)} className="btn btn-secondary btn-sm" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                      <Edit2 size={12} />
                      Edit
                    </button>
                    {seg.source !== 'AUTO' && (
                      <button onClick={() => handleDeleteSegment(seg.id)} className="btn btn-secondary btn-sm" style={{ padding: '6px 12px', fontSize: '0.75rem', color: 'var(--danger)' }}>
                        <Trash2 size={12} />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Tier Configuration */}
      {activeTab === 'tiers' && (
        <div className="card" style={{ padding: '28px', maxWidth: '600px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Award size={20} color="var(--primary)" />
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>Loyalty Tier Configuration</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Customize tier names and point thresholds for customer loyalty levels.</p>
            </div>
          </div>

          <form onSubmit={handleSaveTierConfig}>
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '14px' }}>Tier Names</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const).map((tier) => (
                  <div key={tier}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{tier}</label>
                    <input
                      type="text"
                      className="form-input"
                      value={tierConfig.names[tier]}
                      onChange={(e) => setTierConfig({
                        ...tierConfig,
                        names: { ...tierConfig.names, [tier]: e.target.value }
                      })}
                      required
                    />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>Point Thresholds</h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '14px' }}>Customers earn tiers based on lifetime points earned.</p>
              
              <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--border-subtle)', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', padding: '8px', background: 'rgba(205, 127, 50, 0.1)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#CD7F32', minWidth: '80px' }}>{tierConfig.names.BRONZE}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Starting tier (0 points)</span>
                </div>

                {(['SILVER', 'GOLD', 'PLATINUM'] as const).map((tier, idx) => {
                  const colors: Record<string, string> = { SILVER: '#C0C0C0', GOLD: '#FFD700', PLATINUM: '#E5E4E2' };
                  return (
                    <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', padding: '8px', background: `rgba(${tier === 'SILVER' ? '192,192,192' : tier === 'GOLD' ? '255,215,0' : '229,228,226'}, 0.1)`, borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: colors[tier], minWidth: '80px' }}>{tierConfig.names[tier]}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginRight: '8px' }}>at</span>
                      <input
                        type="number"
                        className="form-input"
                        style={{ width: '120px' }}
                        value={tierConfig.thresholds[tier]}
                        onChange={(e) => setTierConfig({
                          ...tierConfig,
                          thresholds: { ...tierConfig.thresholds, [tier]: parseInt(e.target.value) || 0 }
                        })}
                        min={0}
                        required
                      />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>lifetime points</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', borderRadius: '10px', padding: '14px', marginBottom: '20px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
                <strong>Preview:</strong> A customer with 1,000 lifetime points would be{' '}
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                  {tierConfig.thresholds.PLATINUM && 1000 >= tierConfig.thresholds.PLATINUM
                    ? tierConfig.names.PLATINUM
                    : tierConfig.thresholds.GOLD && 1000 >= tierConfig.thresholds.GOLD
                      ? tierConfig.names.GOLD
                      : tierConfig.thresholds.SILVER && 1000 >= tierConfig.thresholds.SILVER
                        ? tierConfig.names.SILVER
                        : tierConfig.names.BRONZE}
                </span>
              </p>
            </div>

            <button type="submit" disabled={savingTiers} className="btn btn-primary">
              <Save size={15} />
              {savingTiers ? 'Saving...' : 'Save Tier Configuration'}
            </button>
          </form>
        </div>
      )}

      {/* Segment Modal */}
      {showSegmentModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="modal-content" style={{ maxWidth: '550px', padding: '28px', maxHeight: '85vh', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                Edit Segment
              </h3>
              <button onClick={() => setShowSegmentModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveSegment}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Segment Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. VIP Customers, Inactive Users"
                  value={segmentName}
                  onChange={(e) => setSegmentName(e.target.value)}
                  required
                />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Description</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Optional description for this segment"
                  value={segmentDesc}
                  onChange={(e) => setSegmentDesc(e.target.value)}
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Rules</label>
                <div style={{ padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                  <RuleBuilder rules={segmentRules} onChange={setSegmentRules} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowSegmentModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={savingSegment} className="btn btn-primary">
                  {savingSegment ? 'Saving...' : 'Update Segment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};