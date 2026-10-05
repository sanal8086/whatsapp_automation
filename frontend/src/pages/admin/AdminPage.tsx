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
  ChevronDown,
  Clock,
  UserCheck,
  UserX,
  Mail,
  Phone
} from 'lucide-react';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { AuditLog, MessagePricing } from '../../types';

export const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'businesses' | 'users' | 'audit' | 'pricing' | 'templates'>('businesses');
  const [overview, setOverview] = useState<any>(null);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [globalTemplates, setGlobalTemplates] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [pricingRates, setPricingRates] = useState<MessagePricing[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters for Users Tab
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [userFilterStatus, setUserFilterStatus] = useState<string>('ALL');

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
      const [overData, bizData, userData, tplData, auditData, pricingData] = await Promise.all([
        apiRequest('/admin/overview').catch(() => null),
        apiRequest('/admin/businesses').catch(() => []),
        apiRequest('/admin/users').catch(() => []),
        apiRequest('/admin/global-templates').catch(() => []),
        apiRequest('/admin/audit-logs?limit=100').catch(() => []),
        apiRequest('/whatsapp/pricing/rates').catch(() => []),
      ]);
      setOverview(overData);
      setBusinesses(bizData);
      setUsers(userData);
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

  const handleApprove = async (tenantId: string) => {
    try {
      await apiRequest(`/admin/businesses/${tenantId}/approve`, { method: 'POST' });
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Approval failed');
    }
  };

  const handleReject = async (tenantId: string) => {
    if (!confirm('Are you sure you want to reject this business application?')) return;
    try {
      await apiRequest(`/admin/businesses/${tenantId}/reject`, { method: 'POST' });
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Rejection failed');
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
    <div style={{ padding: '36px', minHeight: '100vh', backgroundColor: 'var(--bg-body)' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={24} color="#fff" />
          </div>
          <div>
            <h1 className="page-title">
              Platform Super Admin
            </h1>
            <p className="page-subtitle">
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

      {/* Action Banner for Pending Merchant Applications */}
      {businesses.filter(b => b.status === 'PENDING_APPROVAL').length > 0 && (
        <div style={{
          background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.1) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={20} color="#F59E0B" />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                {businesses.filter(b => b.status === 'PENDING_APPROVAL').length} Merchant Application{businesses.filter(b => b.status === 'PENDING_APPROVAL').length > 1 ? 's' : ''} Awaiting Review
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                New merchants have registered and are waiting on approval before proceeding to WhatsApp onboarding.
              </div>
            </div>
          </div>
          <button
            onClick={() => { setActiveTab('users'); setUserFilterStatus('PENDING_APPROVAL'); }}
            className="btn"
            style={{
              background: 'var(--amber-gradient)',
              color: '#fff',
              fontWeight: 700,
              padding: '8px 18px',
              fontSize: '0.85rem',
              boxShadow: '0 2px 10px rgba(245, 158, 11, 0.35)'
            }}
          >
            Review & Accept Now ({businesses.filter(b => b.status === 'PENDING_APPROVAL').length})
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px', marginBottom: '28px' }}>
        <div className="card card-interactive" style={{ padding: '22px 20px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Total Businesses</span>
          <div style={{ fontSize: '34px', fontWeight: 450, letterSpacing: '-1.2px', color: 'var(--text-main)', marginTop: '8px', lineHeight: 1 }}>
            {overview?.total_businesses || 0}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--success)', display: 'block', marginTop: '8px' }}>{overview?.active_businesses || 0} Active Tenants</span>
        </div>

        <div className="card card-interactive" style={{ padding: '22px 20px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Registered Users</span>
          <div style={{ fontSize: '34px', fontWeight: 450, letterSpacing: '-1.2px', color: 'var(--text-main)', marginTop: '8px', lineHeight: 1 }}>
            {overview?.total_users || 0}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'block', marginTop: '8px' }}>Across all business accounts</span>
        </div>

        <div className="card card-interactive" style={{ padding: '22px 20px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Platform Wallet Reserves</span>
          <div style={{ fontSize: '34px', fontWeight: 450, letterSpacing: '-1.2px', color: 'var(--primary)', marginTop: '8px', lineHeight: 1 }}>
            ₹{(overview?.total_wallet_balance || 0).toLocaleString()}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'block', marginTop: '8px' }}>Prepaid WhatsApp funds in escrow</span>
        </div>

        <div className="card card-interactive" style={{ padding: '22px 20px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Audit Log Events</span>
          <div style={{ fontSize: '34px', fontWeight: 450, letterSpacing: '-1.2px', color: '#F43F5E', marginTop: '8px', lineHeight: 1 }}>
            {auditLogs.length}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'block', marginTop: '8px' }}>Immutable security trail</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="subnav-tabs">
        <button
          onClick={() => setActiveTab('businesses')}
          className={`subnav-tab ${activeTab === 'businesses' ? 'active' : ''}`}
        >
          <Building size={16} />
          Businesses Directory ({businesses.length})
        </button>

        <button
          onClick={() => setActiveTab('users')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'users' ? '2px solid #EC4899' : '2px solid transparent',
            padding: '12px 4px',
            color: activeTab === 'users' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Users size={16} />
          Users & Approvals ({users.length})
          {businesses.filter(b => b.status === 'PENDING_APPROVAL').length > 0 && (
            <span style={{
              background: 'var(--amber-gradient)',
              color: '#fff',
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '10px'
            }}>
              {businesses.filter(b => b.status === 'PENDING_APPROVAL').length} PENDING
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`subnav-tab ${activeTab === 'audit' ? 'active' : ''}`}
        >
          <History size={16} />
          Compliance & Audit Logs ({auditLogs.length})
        </button>

        <button
          onClick={() => setActiveTab('pricing')}
          className={`subnav-tab ${activeTab === 'pricing' ? 'active' : ''}`}
        >
          <Tag size={16} />
          Meta Pricing Rate Card ({pricingRates.length})
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          className={`subnav-tab ${activeTab === 'templates' ? 'active' : ''}`}
        >
          <FileText size={16} />
          Global Template Library ({globalTemplates.length})
        </button>
      </div>

      {/* TAB 1: BUSINESSES DIRECTORY */}
      {activeTab === 'businesses' && (
        <div className="table-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="table-modern">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>WhatsApp Status</th>
                  <th>Subscription Lifecycle</th>
                  <th>Wallet Balance</th>
                  <th>Account Status</th>
                  <th style={{ textAlign: 'right' }}>Admin Operations</th>
                </tr>
              </thead>
              <tbody>
                {businesses.map((biz) => {
                  const initial = (biz.name || 'B').charAt(0).toUpperCase();
                  return (
                    <tr key={biz.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div className="table-avatar purple">
                            {initial}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '13.5px' }}>{biz.name}</div>
                            <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'monospace' }}>/{biz.slug}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`badge ${biz.whatsapp_status === 'CONNECTED' ? 'badge-whatsapp' : 'badge-warning'}`}
                          style={{ borderRadius: '9999px', padding: '4px 12px', fontSize: '11px' }}
                        >
                          {biz.whatsapp_status}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span className={`badge ${biz.subscription_status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`} style={{ borderRadius: '9999px', padding: '3px 10px', fontSize: '11px' }}>
                              {biz.subscription_status}
                            </span>
                            <span className={`badge ${biz.subscription_payment === 'MANUAL_VERIFIED' ? 'badge-info' : 'badge-neutral'}`} style={{ borderRadius: '9999px', padding: '3px 10px', fontSize: '11px' }}>
                              {biz.subscription_payment}
                            </span>
                          </div>
                          {biz.subscription_ends_at && (
                            <span style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>
                              Expires: {new Date(biz.subscription_ends_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '13.5px', fontVariantNumeric: 'tabular-nums' }}>
                        ₹{biz.wallet_balance.toFixed(2)}
                      </td>

                      <td>
                        <span className={`badge ${biz.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`} style={{ borderRadius: '9999px', padding: '4px 12px', fontSize: '11px' }}>
                          {biz.status}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => {
                              setSelectedTenantId(biz.id);
                              setSelectedTenantName(biz.name);
                              setShowAdjustmentModal(true);
                            }}
                            className="btn-table-action"
                            title="Credit or Debit wallet balance with audit note"
                          >
                            Adjust Wallet
                          </button>

                          <button
                            onClick={() => handleExtendSubscription(biz.id, 30)}
                            className="btn-table-action"
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
                            className="btn-table-action"
                          >
                            Mark Paid
                          </button>

                          <button
                            onClick={() => handleToggleStatus(biz.id)}
                            className="btn-table-action"
                            style={{ color: biz.status === 'ACTIVE' ? 'var(--danger)' : 'var(--success)' }}
                          >
                            {biz.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                          </button>

                          <button
                            onClick={() => handleCancelSubscription(biz.id)}
                            className="btn-table-action"
                            style={{ color: 'var(--text-dim)' }}
                            title="Cancel active subscription"
                          >
                            Cancel Sub
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: USERS & APPLICATIONS */}
      {activeTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Controls Bar */}
          <div className="glass-card" style={{ padding: '16px', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '36px' }}
                placeholder="Search users by name, email, phone or business name..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={15} color="var(--text-dim)" />
              <select
                className="form-input"
                style={{ width: 'auto' }}
                value={userFilterStatus}
                onChange={(e) => setUserFilterStatus(e.target.value)}
              >
                <option value="ALL">All Application Statuses</option>
                <option value="PENDING_APPROVAL">Pending Approval ({businesses.filter(b => b.status === 'PENDING_APPROVAL').length})</option>
                <option value="APPROVED">Approved</option>
                <option value="ACTIVE">Active</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          <div className="glass-panel" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '16px 20px' }}>User Details</th>
                  <th style={{ padding: '16px 20px' }}>Associated Business</th>
                  <th style={{ padding: '16px 20px' }}>Role</th>
                  <th style={{ padding: '16px 20px' }}>Application Status</th>
                  <th style={{ padding: '16px 20px' }}>Joined Date</th>
                  <th style={{ padding: '16px 20px', textAlign: 'right' }}>Admin Operations</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => {
                  const query = userSearchQuery.toLowerCase();
                  const matchesSearch =
                    (u.name || '').toLowerCase().includes(query) ||
                    (u.email || '').toLowerCase().includes(query) ||
                    (u.phone || '').toLowerCase().includes(query) ||
                    (u.tenant_name || '').toLowerCase().includes(query);

                  const matchesStatus =
                    userFilterStatus === 'ALL' ||
                    (userFilterStatus === 'PENDING_APPROVAL' && u.tenant_status === 'PENDING_APPROVAL') ||
                    (userFilterStatus === 'APPROVED' && u.tenant_status === 'APPROVED') ||
                    (userFilterStatus === 'ACTIVE' && u.tenant_status === 'ACTIVE') ||
                    (userFilterStatus === 'REJECTED' && u.tenant_status === 'REJECTED');

                  return matchesSearch && matchesStatus;
                }).length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dim)' }}>
                      No registered users found matching the search criteria.
                    </td>
                  </tr>
                ) : (
                  users.filter(u => {
                    const query = userSearchQuery.toLowerCase();
                    const matchesSearch =
                      (u.name || '').toLowerCase().includes(query) ||
                      (u.email || '').toLowerCase().includes(query) ||
                      (u.phone || '').toLowerCase().includes(query) ||
                      (u.tenant_name || '').toLowerCase().includes(query);

                    const matchesStatus =
                      userFilterStatus === 'ALL' ||
                      (userFilterStatus === 'PENDING_APPROVAL' && u.tenant_status === 'PENDING_APPROVAL') ||
                      (userFilterStatus === 'APPROVED' && u.tenant_status === 'APPROVED') ||
                      (userFilterStatus === 'ACTIVE' && u.tenant_status === 'ACTIVE') ||
                      (userFilterStatus === 'REJECTED' && u.tenant_status === 'REJECTED');

                    return matchesSearch && matchesStatus;
                  }).map((u) => {
                    const isPending = u.tenant_status === 'PENDING_APPROVAL';
                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                              {u.name}
                            </div>
                            {u.is_platform_admin && (
                              <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>SUPER ADMIN</span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <Mail size={12} /> {u.email}
                          </div>
                          {u.phone && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                              <Phone size={12} /> {u.phone}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '14px 20px' }}>
                          {u.tenant_name ? (
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{u.tenant_name}</div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'monospace' }}>/{u.tenant_slug}</span>
                              {u.business_type && (
                                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{u.business_type}</span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>Platform Level (No Business)</span>
                          )}
                        </td>

                        <td style={{ padding: '14px 20px' }}>
                          <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>
                            {u.role || (u.is_platform_admin ? 'Super Admin' : 'User')}
                          </span>
                        </td>

                        <td style={{ padding: '14px 20px' }}>
                          <span className={`badge ${
                            u.tenant_status === 'ACTIVE' ? 'badge-success' :
                            u.tenant_status === 'APPROVED' ? 'badge-info' :
                            u.tenant_status === 'PENDING_APPROVAL' ? 'badge-warning' :
                            u.tenant_status === 'REJECTED' ? 'badge-danger' :
                            'badge-neutral'
                          }`}>
                            {u.tenant_status === 'PENDING_APPROVAL' ? '⏳ PENDING APPROVAL' :
                             u.tenant_status === 'APPROVED' ? '✓ APPROVED' :
                             u.tenant_status || u.user_status}
                          </span>
                        </td>

                        <td style={{ padding: '14px 20px', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                          {new Date(u.created_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </td>

                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          {isPending && u.tenant_id ? (
                            <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => handleApprove(u.tenant_id)}
                                className="btn"
                                style={{
                                  padding: '6px 14px',
                                  fontSize: '0.75rem',
                                  background: 'var(--emerald-gradient)',
                                  color: '#fff',
                                  fontWeight: 700,
                                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                                }}
                              >
                                ✓ Approve
                              </button>
                              <button
                                onClick={() => handleReject(u.tenant_id)}
                                className="btn"
                                style={{
                                  padding: '6px 14px',
                                  fontSize: '0.75rem',
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  color: 'var(--danger)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  fontWeight: 700,
                                }}
                              >
                                ✕ Reject
                              </button>
                            </div>
                          ) : u.tenant_status === 'APPROVED' ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--info)', fontWeight: 600 }}>
                              Ready for WhatsApp Setup
                            </span>
                          ) : u.tenant_status === 'ACTIVE' ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
                              Active Merchant
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Controls Bar */}
          <div className="card card-interactive" style={{ padding: '16px', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
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
          <div className="table-card">
            <div style={{ overflowX: 'auto' }}>
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Actor / User</th>
                    <th>Resource Scope</th>
                    <th>Metadata / Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuditLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap', fontSize: '12px' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>

                      <td>
                        <span
                          className={`badge ${
                            log.action.includes('WALLET') ? 'badge-warning' :
                            log.action.includes('CANCEL') ? 'badge-danger' :
                            log.action.includes('CAMPAIGN') ? 'badge-info' : 'badge-whatsapp'
                          }`}
                          style={{ borderRadius: '9999px', padding: '4px 12px', fontSize: '11px' }}
                        >
                          {log.action}
                        </span>
                      </td>

                      <td style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '13.5px' }}>
                        {log.user_email || 'System Worker'}
                      </td>

                      <td>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                          {log.resource_type || 'GLOBAL'}
                          {log.resource_id && <span style={{ fontFamily: 'monospace', display: 'block', fontSize: '11.5px', color: 'var(--text-dim)' }}>{log.resource_id.slice(0, 12)}...</span>}
                        </div>
                      </td>

                      <td>
                        {log.details_json ? (
                          <button
                            onClick={() => setSelectedAuditLog(log)}
                            className="btn-table-action"
                          >
                            View Payload
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredAuditLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-dim)' }}>
                        No audit log records found matching your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: META PRICING RATE CARD */}
      {activeTab === 'pricing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card card-interactive" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
              Meta Cloud API Dynamic Rate Table
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Pricing engine incorporates country-specific wholesale Meta Cloud API conversation rates with SaaS markup margin calculations.
            </p>
          </div>

          <div className="table-card">
            <div style={{ overflowX: 'auto' }}>
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>Country</th>
                    <th>Category</th>
                    <th>Currency</th>
                    <th>Meta Base Cost</th>
                    <th>Platform Markup</th>
                    <th>Final Tenant Price</th>
                  </tr>
                </thead>
                <tbody>
                  {pricingRates.map((rate) => (
                    <tr key={rate.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '13.5px' }}>
                        {rate.country}
                      </td>

                      <td>
                        <span
                          className={`badge ${
                            rate.category === 'MARKETING' ? 'badge-warning' :
                            rate.category === 'UTILITY' ? 'badge-info' :
                            rate.category === 'SERVICE' ? 'badge-whatsapp' : 'badge-neutral'
                          }`}
                          style={{ borderRadius: '9999px', padding: '4px 12px', fontSize: '11px' }}
                        >
                          {rate.category}
                        </span>
                      </td>

                      <td style={{ color: 'var(--text-dim)', fontSize: '13px' }}>
                        {rate.currency}
                      </td>

                      <td style={{ color: 'var(--text-muted)', fontSize: '13.5px', fontVariantNumeric: 'tabular-nums' }}>
                        ₹{rate.meta_cost.toFixed(4)}
                      </td>

                      <td style={{ color: 'var(--success)', fontWeight: 600, fontSize: '13.5px', fontVariantNumeric: 'tabular-nums' }}>
                        +₹{rate.markup_margin.toFixed(4)}
                      </td>

                      <td style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '14px', fontVariantNumeric: 'tabular-nums' }}>
                        ₹{rate.total_price.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GLOBAL TEMPLATES */}
      {activeTab === 'templates' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {globalTemplates.map((gt) => (
            <div key={gt.id} className="card card-interactive" style={{ padding: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="badge badge-info" style={{ borderRadius: '9999px', padding: '4px 12px', fontSize: '11px' }}>{gt.category}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'monospace' }}>{gt.key}</span>
              </div>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '10px' }}>{gt.name}</h4>
              <div style={{ backgroundColor: 'var(--bg-surface)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-subtle)', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {gt.body_text}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: MARK SUBSCRIPTION PAID */}
      {showMarkPaidModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="modal-content" style={{ maxWidth: '420px', padding: '24px' }}>
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
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="modal-content" style={{ maxWidth: '440px', padding: '26px' }}>
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
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="modal-content" style={{ maxWidth: '560px', padding: '26px' }}>
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
