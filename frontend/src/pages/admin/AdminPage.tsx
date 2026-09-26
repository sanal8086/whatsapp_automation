import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Building,
  CreditCard,
  Wallet,
  Users,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  FileText,
  X,
  ArrowLeft,
  Calendar,
  History,
  Tag,
  Search,
  Filter,
  RefreshCw,
  MinusCircle,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { AuditLog, MessagePricing } from '../../types';

export const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'businesses' | 'audit' | 'pricing' | 'templates'>('businesses');
  const [overview, setOverview] = useState<any>(null);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [globalTemplates, setGlobalTemplates] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [pricingRates, setPricingRates] = useState<MessagePricing[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters for Audit Logs
  const [auditFilterAction, setAuditFilterAction] = useState<string>('ALL');
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);

  // Mark Paid Modal
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [selectedTenantName, setSelectedTenantName] = useState('');
  const [paidAmount, setPaidAmount] = useState('2499');
  const [paidMonths, setPaidMonths] = useState('1');
  const [paidNotes, setPaidNotes] = useState('NEFT Bank Transfer received');

  // Wallet Adjustment Modal (Credit or Debit)
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [adjustmentAmount, setAdjustmentAmount] = useState('500');
  const [adjustmentReason, setAdjustmentReason] = useState('Promotional messaging incentive');

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [overData, bizData, tplData, auditData, pricingData] = await Promise.all([
        apiRequest('/admin/overview').catch(() => null),
        apiRequest('/admin/businesses').catch(() => []),
        apiRequest('/admin/global-templates').catch(() => []),
        apiRequest('/admin/audit-logs?limit=100').catch(() => []),
        apiRequest('/whatsapp/pricing/rates').catch(() => []),
      ]);
      setOverview(overData);
      setBusinesses(bizData);
      setGlobalTemplates(tplData);
      setAuditLogs(auditData);
      setPricingRates(pricingData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleToggleStatus = async (tenantId: string) => {
    try {
      await apiRequest(`/admin/businesses/${tenantId}/toggle-status`, { method: 'POST' });
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Status change failed');
    }
  };

  const handleExtendSubscription = async (tenantId: string, days: number = 30) => {
    if (!confirm(`Extend subscription for ${days} days?`)) return;
    try {
      await apiRequest(`/admin/subscriptions/${tenantId}/extend?days=${days}`, { method: 'POST' });
      alert(`Subscription extended by ${days} days!`);
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to extend subscription');
    }
  };

  const handleCancelSubscription = async (tenantId: string) => {
    if (!confirm('Are you sure you want to CANCEL this subscription?')) return;
    try {
      await apiRequest(`/admin/subscriptions/${tenantId}/cancel`, { method: 'POST' });
      alert('Subscription marked as CANCELLED');
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel subscription');
    }
  };

  const handleMarkPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/admin/subscriptions/mark-paid', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: selectedTenantId,
          amount: parseFloat(paidAmount),
          months: parseInt(paidMonths) || 1,
          notes: paidNotes,
        }),
      });
      setShowMarkPaidModal(false);
      alert('Subscription marked PAID and extended!');
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to update subscription');
    }
  };

  const handleAdjustWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/admin/wallets/adjustment', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: selectedTenantId,
          amount: parseFloat(adjustmentAmount),
          type: adjustmentType,
          description: adjustmentReason,
        }),
      });
      setShowAdjustmentModal(false);
      alert(`Wallet successfully ${adjustmentType === 'CREDIT' ? 'credited' : 'debited'}!`);
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Adjustment failed');
    }
  };

  // Filtered audit logs
  const filteredAuditLogs = auditLogs.filter((log) => {
    const matchesAction = auditFilterAction === 'ALL' || log.action === auditFilterAction;
    const matchesQuery = !auditSearchQuery ||
      (log.user_email && log.user_email.toLowerCase().includes(auditSearchQuery.toLowerCase())) ||
      (log.action && log.action.toLowerCase().includes(auditSearchQuery.toLowerCase())) ||
      (log.resource_type && log.resource_type.toLowerCase().includes(auditSearchQuery.toLowerCase())) ||
      (log.tenant_id && log.tenant_id.toLowerCase().includes(auditSearchQuery.toLowerCase()));
    return matchesAction && matchesQuery;
  });

  return (
    <div style={{ padding: '36px', minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={24} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Platform Super Admin
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Multi-tenant management, manual billing verification, messaging credit adjustments & audit logging.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={fetchAdminData} className="btn btn-secondary" title="Refresh Admin Metrics">
            <RefreshCw size={15} />
            Refresh
          </button>
          <Link to="/app" className="btn btn-primary">
            <ArrowLeft size={16} />
            Merchant Dashboard
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px', marginBottom: '28px' }}>
        <div className="glass-card" style={{ padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Businesses</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
            {overview?.total_businesses || 0}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--success)' }}>{overview?.active_businesses || 0} Active Tenants</span>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Registered Users</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
            {overview?.total_users || 0}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Across all business accounts</span>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Platform Wallet Reserves</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#818CF8', marginTop: '4px' }}>
            ₹{(overview?.total_wallet_balance || 0).toLocaleString()}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Prepaid WhatsApp funds in escrow</span>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Audit Log Events</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#F43F5E', marginTop: '4px' }}>
            {auditLogs.length}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Immutable security trail</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', gap: '24px', marginBottom: '24px', overflowX: 'auto' }}>
        <button
          onClick={() => setActiveTab('businesses')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'businesses' ? '2px solid #EC4899' : '2px solid transparent',
            padding: '12px 4px',
            color: activeTab === 'businesses' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Building size={16} />
          Businesses Directory ({businesses.length})
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'audit' ? '2px solid #EC4899' : '2px solid transparent',
            padding: '12px 4px',
            color: activeTab === 'audit' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <History size={16} />
          Compliance & Audit Logs ({auditLogs.length})
        </button>

        <button
          onClick={() => setActiveTab('pricing')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'pricing' ? '2px solid #EC4899' : '2px solid transparent',
            padding: '12px 4px',
            color: activeTab === 'pricing' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Tag size={16} />
          Meta Pricing Rate Card ({pricingRates.length})
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'templates' ? '2px solid #EC4899' : '2px solid transparent',
            padding: '12px 4px',
            color: activeTab === 'templates' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <FileText size={16} />
          Global Template Library ({globalTemplates.length})
        </button>
      </div>

      {/* TAB 1: BUSINESSES DIRECTORY */}
      {activeTab === 'businesses' && (
        <div className="glass-panel" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '16px 20px' }}>Business</th>
                <th style={{ padding: '16px 20px' }}>WhatsApp Status</th>
                <th style={{ padding: '16px 20px' }}>Subscription Lifecycle</th>
                <th style={{ padding: '16px 20px' }}>Wallet Balance</th>
                <th style={{ padding: '16px 20px' }}>Account Status</th>
                <th style={{ padding: '16px 20px', textAlign: 'right' }}>Admin Operations</th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((biz) => (
                <tr key={biz.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{biz.name}</div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'monospace' }}>/{biz.slug}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>ID: {biz.id.slice(0, 10)}...</span>
                  </td>

                  <td style={{ padding: '14px 20px' }}>
                    <span className={`badge ${biz.whatsapp_status === 'CONNECTED' ? 'badge-whatsapp' : 'badge-warning'}`}>
                      {biz.whatsapp_status}
                    </span>
                  </td>

                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span className={`badge ${biz.subscription_status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
                          {biz.subscription_status}
                        </span>
                        <span className={`badge ${biz.subscription_payment === 'MANUAL_VERIFIED' ? 'badge-info' : 'badge-neutral'}`}>
                          {biz.subscription_payment}
                        </span>
                      </div>
                      {biz.subscription_ends_at && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                          Expires: {new Date(biz.subscription_ends_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </td>

                  <td style={{ padding: '14px 20px', fontWeight: 700, color: 'var(--text-main)' }}>
                    ₹{biz.wallet_balance.toFixed(2)}
                  </td>

                  <td style={{ padding: '14px 20px' }}>
                    <span className={`badge ${biz.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>
                      {biz.status}
                    </span>
                  </td>

                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => {
                          setSelectedTenantId(biz.id);
                          setSelectedTenantName(biz.name);
                          setShowAdjustmentModal(true);
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                        title="Credit or Debit wallet balance with audit note"
                      >
                        Adjust Wallet
                      </button>

                      <button
                        onClick={() => handleExtendSubscription(biz.id, 30)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                        title="Extend subscription by 30 days"
                      >
                        +30d Sub
                      </button>

                      <button
                        onClick={() => {
                          setSelectedTenantId(biz.id);
                          setSelectedTenantName(biz.name);
                          setShowMarkPaidModal(true);
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                      >
                        Mark Paid
                      </button>

                      <button
                        onClick={() => handleToggleStatus(biz.id)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.75rem', color: biz.status === 'ACTIVE' ? 'var(--danger)' : 'var(--success)' }}
                      >
                        {biz.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      </button>

                      <button
                        onClick={() => handleCancelSubscription(biz.id)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 8px', fontSize: '0.75rem', color: 'var(--text-dim)' }}
                        title="Cancel active subscription"
                      >
                        Cancel Sub
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Controls Bar */}
          <div className="glass-card" style={{ padding: '16px', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '36px' }}
                placeholder="Search audit trail by user, action, tenant or resource..."
                value={auditSearchQuery}
                onChange={(e) => setAuditSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={15} color="var(--text-dim)" />
              <select
                className="form-input"
                style={{ width: 'auto' }}
                value={auditFilterAction}
                onChange={(e) => setAuditFilterAction(e.target.value)}
              >
                <option value="ALL">All Actions</option>
                <option value="CAMPAIGN_EXECUTED">CAMPAIGN_EXECUTED</option>
                <option value="WALLET_ADJUSTED">WALLET_ADJUSTED</option>
                <option value="SUBSCRIPTION_EXTENDED">SUBSCRIPTION_EXTENDED</option>
                <option value="SUBSCRIPTION_CANCELLED">SUBSCRIPTION_CANCELLED</option>
                <option value="CONSENT_UPDATED">CONSENT_UPDATED</option>
                <option value="CUSTOMER_IMPORTED">CUSTOMER_IMPORTED</option>
              </select>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="glass-panel" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '14px 18px' }}>Timestamp</th>
                  <th style={{ padding: '14px 18px' }}>Action</th>
                  <th style={{ padding: '14px 18px' }}>Actor / User</th>
                  <th style={{ padding: '14px 18px' }}>Resource Scope</th>
                  <th style={{ padding: '14px 18px' }}>Metadata / Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 18px', color: 'var(--text-dim)', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>

                    <td style={{ padding: '12px 18px' }}>
                      <span className={`badge ${
                        log.action.includes('WALLET') ? 'badge-warning' :
                        log.action.includes('CANCEL') ? 'badge-danger' :
                        log.action.includes('CAMPAIGN') ? 'badge-info' : 'badge-whatsapp'
                      }`}>
                        {log.action}
                      </span>
                    </td>

                    <td style={{ padding: '12px 18px', color: 'var(--text-main)', fontWeight: 600 }}>
                      {log.user_email || 'System Worker'}
                    </td>

                    <td style={{ padding: '12px 18px' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {log.resource_type || 'GLOBAL'}
                        {log.resource_id && <span style={{ fontFamily: 'monospace', display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)' }}>{log.resource_id.slice(0, 12)}...</span>}
                      </div>
                    </td>

                    <td style={{ padding: '12px 18px' }}>
                      {log.details_json ? (
                        <button
                          onClick={() => setSelectedAuditLog(log)}
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                        >
                          View Payload
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredAuditLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-dim)' }}>
                      No audit log records found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: META PRICING RATE CARD */}
      {activeTab === 'pricing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
              Meta Cloud API Dynamic Rate Table
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Pricing engine incorporates country-specific wholesale Meta Cloud API conversation rates with SaaS markup margin calculations.
            </p>
          </div>

          <div className="glass-panel" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '16px 20px' }}>Country</th>
                  <th style={{ padding: '16px 20px' }}>Category</th>
                  <th style={{ padding: '16px 20px' }}>Currency</th>
                  <th style={{ padding: '16px 20px' }}>Meta Base Cost</th>
                  <th style={{ padding: '16px 20px' }}>Platform Markup</th>
                  <th style={{ padding: '16px 20px' }}>Final Tenant Price</th>
                </tr>
              </thead>
              <tbody>
                {pricingRates.map((rate) => (
                  <tr key={rate.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 700, color: 'var(--text-main)' }}>
                      {rate.country}
                    </td>

                    <td style={{ padding: '14px 20px' }}>
                      <span className={`badge ${
                        rate.category === 'MARKETING' ? 'badge-warning' :
                        rate.category === 'UTILITY' ? 'badge-info' :
                        rate.category === 'SERVICE' ? 'badge-whatsapp' : 'badge-neutral'
                      }`}>
                        {rate.category}
                      </span>
                    </td>

                    <td style={{ padding: '14px 20px', color: 'var(--text-dim)' }}>
                      {rate.currency}
                    </td>

                    <td style={{ padding: '14px 20px', color: 'var(--text-muted)' }}>
                      ₹{rate.meta_cost.toFixed(4)}
                    </td>

                    <td style={{ padding: '14px 20px', color: 'var(--success)', fontWeight: 600 }}>
                      +₹{rate.markup_margin.toFixed(4)}
                    </td>

                    <td style={{ padding: '14px 20px', fontWeight: 800, color: 'var(--text-main)' }}>
                      ₹{rate.total_price.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: GLOBAL TEMPLATES */}
      {activeTab === 'templates' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {globalTemplates.map((gt) => (
            <div key={gt.id} className="glass-card" style={{ padding: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="badge badge-info">{gt.category}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'monospace' }}>{gt.key}</span>
              </div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px' }}>{gt.name}</h4>
              <div style={{ backgroundColor: 'rgba(0,0,0,0.25)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {gt.body_text}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: MARK SUBSCRIPTION PAID */}
      {showMarkPaidModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel" style={{ width: '420px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Mark Subscription Payment</h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Tenant: {selectedTenantName}</span>
              </div>
              <button onClick={() => setShowMarkPaidModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleMarkPaid}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Amount Received (INR)</label>
                <input type="number" className="form-input" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} required />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Months Extension</label>
                <input type="number" className="form-input" value={paidMonths} onChange={(e) => setPaidMonths(e.target.value)} required />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Payment Reference / Notes</label>
                <input type="text" className="form-input" value={paidNotes} onChange={(e) => setPaidNotes(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowMarkPaidModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Verify & Activate</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: WALLET ADJUSTMENT (CREDIT OR DEBIT) */}
      {showAdjustmentModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel" style={{ width: '440px', padding: '26px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Adjust Messaging Wallet</h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Tenant: {selectedTenantName}</span>
              </div>
              <button onClick={() => setShowAdjustmentModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleAdjustWallet}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Adjustment Action</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('CREDIT')}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: adjustmentType === 'CREDIT' ? '2px solid var(--success)' : '1px solid var(--border-subtle)',
                      backgroundColor: adjustmentType === 'CREDIT' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                      color: adjustmentType === 'CREDIT' ? 'var(--success)' : 'var(--text-muted)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <PlusCircle size={16} />
                    Credit (+)
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustmentType('DEBIT')}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: adjustmentType === 'DEBIT' ? '2px solid var(--danger)' : '1px solid var(--border-subtle)',
                      backgroundColor: adjustmentType === 'DEBIT' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                      color: adjustmentType === 'DEBIT' ? 'var(--danger)' : 'var(--text-muted)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <MinusCircle size={16} />
                    Debit (-)
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Amount (INR)</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  className="form-input"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '22px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Audited Reason / Description <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Compensation for failed delivery batch / Refund"
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowAdjustmentModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {adjustmentType === 'CREDIT' ? 'Confirm Credit' : 'Confirm Debit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AUDIT LOG PAYLOAD VIEWER */}
      {selectedAuditLog && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel" style={{ width: '560px', padding: '26px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Audit Event Details</h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                  {selectedAuditLog.action} • {new Date(selectedAuditLog.created_at).toLocaleString()}
                </span>
              </div>
              <button onClick={() => setSelectedAuditLog(null)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', maxHeight: '350px', overflowY: 'auto' }}>
              <pre style={{ fontSize: '0.8rem', color: 'var(--text-main)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {JSON.stringify(selectedAuditLog.details_json, null, 2)}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => setSelectedAuditLog(null)} className="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
