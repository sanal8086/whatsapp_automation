import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Building,
  Wallet,
  Users,
  X,
  ArrowLeft,
  History,
  Tag,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Mail,
  Phone,
  Palette,
  ExternalLink,
  Sparkles,
  Gift
} from 'lucide-react';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { AuditLog, MessagePricing } from '../../types';
import { alertError, alertSuccess, confirmAction } from '../../utils/alert';
import { TablePagination } from '../../components/ui';

const PAGE_SIZE = 10;

export const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'businesses' | 'users' | 'audit' | 'pricing' | 'designer'>('businesses');
  const [overview, setOverview] = useState<any>(null);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
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

  // Pagination
  const [bizPage, setBizPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);

  // Live Page Designer
  const [designBizId, setDesignBizId] = useState<string>('');
  const [designPage, setDesignPage] = useState<any>(null);
  const [designForm, setDesignForm] = useState<any>(null);
  const [designSaving, setDesignSaving] = useState(false);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [overData, bizData, userData, auditData, pricingData] = await Promise.all([
        apiRequest('/admin/overview').catch(() => null),
        apiRequest('/admin/businesses').catch(() => []),
        apiRequest('/admin/users').catch(() => []),
        apiRequest('/admin/audit-logs?limit=100').catch(() => []),
        apiRequest('/whatsapp/pricing').catch(() => []),
      ]);
      setOverview(overData);
      setBusinesses(bizData);
      setUsers(userData);
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
      alertError(err.message || 'Status change failed');
    }
  };

  const handleApprove = async (tenantId: string) => {
    try {
      await apiRequest(`/admin/businesses/${tenantId}/approve`, { method: 'POST' });
      fetchAdminData();
    } catch (err: any) {
      alertError(err.message || 'Approval failed');
    }
  };

  const handleReject = async (tenantId: string) => {
    const ok = await confirmAction('Reject this business application?', 'The merchant will not be able to proceed.', 'Yes, reject');
    if (!ok) return;
    try {
      await apiRequest(`/admin/businesses/${tenantId}/reject`, { method: 'POST' });
      fetchAdminData();
    } catch (err: any) {
      alertError(err.message || 'Rejection failed');
    }
  };

  // Live Page Designer
  const fetchDesignPage = async (tenantId: string) => {
    try {
      const data = await apiRequest(`/admin/businesses/${tenantId}/public-page`);
      setDesignPage(data);
      setDesignForm({
        hero_title: data.hero_title || '',
        hero_description: data.hero_description || '',
        primary_color: data.primary_color || '#4F46E5',
        secondary_color: data.secondary_color || '#06B6D4',
        logo_url: data.logo_url || '',
        header_subtitle: data.header_subtitle || '',
        hero_cta_text: data.hero_cta_text || '',
        how_it_works: data.how_it_works_json?.steps?.length
          ? data.how_it_works_json.steps.map((s: any) => ({ title: s.title || '', description: s.description || '' }))
          : [
              { title: 'Join in 10 Seconds', description: 'Enter your mobile number and instantly receive your welcome bonus points.' },
              { title: 'Earn on Every Visit', description: 'Share your phone number at billing. Points get added automatically with WhatsApp receipts.' },
              { title: 'Unlock Free Perks', description: 'Redeem your points for delicious food items, discounts & VIP member experiences.' }
            ],
        how_it_works_title: data.how_it_works_json?.section_title || 'How It Works',
        terms_text: data.terms_text || '',
      });
    } catch (err: any) {
      alertError(err.message || 'Failed to load page design');
    }
  };

  const handleSaveDesign = async () => {
    if (!designBizId || !designForm) return;
    setDesignSaving(true);
    try {
      const data = await apiRequest(`/admin/businesses/${designBizId}/public-page`, {
        method: 'PATCH',
        body: JSON.stringify({
          hero_title: designForm.hero_title,
          hero_description: designForm.hero_description,
          primary_color: designForm.primary_color,
          secondary_color: designForm.secondary_color,
          logo_url: designForm.logo_url || null,
          header_subtitle: designForm.header_subtitle || null,
          hero_cta_text: designForm.hero_cta_text || null,
          how_it_works_json: {
            section_title: designForm.how_it_works_title,
            steps: (designForm.how_it_works || []).filter((s: any) => s.title || s.description),
          },
          terms_text: designForm.terms_text || null,
        }),
      });
      setDesignPage(data);
      alertSuccess('Live page design saved — customers will see the update immediately.');
    } catch (err: any) {
      alertError(err.message || 'Failed to save design');
    } finally {
      setDesignSaving(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'designer' && !designBizId && businesses.length > 0) {
      setDesignBizId(businesses[0].id);
    }
  }, [activeTab, designBizId, businesses]);

  useEffect(() => {
    if (designBizId) {
      setDesignPage(null);
      fetchDesignPage(designBizId);
    }
  }, [designBizId]);

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

  const filteredUsers = users.filter((u) => {
    const query = userSearchQuery.toLowerCase();
    const matchesSearch =
      (u.name || '').toLowerCase().includes(query) ||
      (u.email || '').toLowerCase().includes(query) ||
      (u.phone || '').toLowerCase().includes(query) ||
      (u.tenant_name || '').toLowerCase().includes(query);

    const matchesStatus =
      userFilterStatus === 'ALL' || u.tenant_status === userFilterStatus;

    return matchesSearch && matchesStatus;
  });

  // Pagination slices (reset to page 1 when filters change)
  useEffect(() => { setUserPage(1); }, [userSearchQuery, userFilterStatus]);
  useEffect(() => { setAuditPage(1); }, [auditSearchQuery, auditFilterAction]);

  const bizTotalPages = Math.max(1, Math.ceil(businesses.length / PAGE_SIZE));
  const bizSafePage = Math.min(bizPage, bizTotalPages);
  const pagedBusinesses = businesses.slice((bizSafePage - 1) * PAGE_SIZE, bizSafePage * PAGE_SIZE);

  const userTotalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const userSafePage = Math.min(userPage, userTotalPages);
  const pagedUsers = filteredUsers.slice((userSafePage - 1) * PAGE_SIZE, userSafePage * PAGE_SIZE);

  const auditTotalPages = Math.max(1, Math.ceil(filteredAuditLogs.length / PAGE_SIZE));
  const auditSafePage = Math.min(auditPage, auditTotalPages);
  const pagedAuditLogs = filteredAuditLogs.slice((auditSafePage - 1) * PAGE_SIZE, auditSafePage * PAGE_SIZE);


  return (
    <div className="admin-dark" style={{ padding: '36px', minHeight: '100vh', backgroundColor: 'var(--bg-body)' }}>
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
          onClick={() => setActiveTab('designer')}
          className={`subnav-tab ${activeTab === 'designer' ? 'active' : ''}`}
        >
          <Palette size={16} />
          Live Page Designer
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
                  <th>Subscription Status</th>
                  <th>Expires</th>
                  <th style={{ textAlign: 'right' }}>Admin Operations</th>
                </tr>
              </thead>
              <tbody>
                {pagedBusinesses.map((biz) => {
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
                        <span className={`badge ${biz.subscription_status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`} style={{ borderRadius: '9999px', padding: '3px 10px', fontSize: '11px' }}>
                          {biz.subscription_status}
                        </span>
                      </td>

                      <td style={{ fontSize: '12px', color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                        {biz.subscription_ends_at ? new Date(biz.subscription_ends_at).toLocaleDateString() : '—'}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleToggleStatus(biz.id)}
                            className="btn-table-action"
                            style={{ color: biz.status === 'ACTIVE' ? 'var(--danger)' : 'var(--success)' }}
                          >
                            {biz.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={bizSafePage}
            totalPages={bizTotalPages}
            totalItems={businesses.length}
            onPageChange={setBizPage}
          />
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
                <option value="SUSPENDED">Suspended</option>
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
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dim)' }}>
                      No registered users found matching the search criteria.
                    </td>
                  </tr>
                ) : (
                  pagedUsers.map((u) => {
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
                            u.tenant_status === 'SUSPENDED' ? 'badge-danger' :
                            'badge-neutral'
                          }`}>
                            {u.tenant_status === 'PENDING_APPROVAL' ? '⏳ PENDING APPROVAL' :
                             u.tenant_status === 'APPROVED' ? '✓ APPROVED' :
                             u.tenant_status === 'SUSPENDED' ? '⛔ SUSPENDED' :
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
                          ) : u.tenant_status === 'SUSPENDED' ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 600 }}>
                              Suspended — manage in Businesses Directory
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
          <TablePagination
            page={userSafePage}
            totalPages={userTotalPages}
            totalItems={filteredUsers.length}
            onPageChange={setUserPage}
          />
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
                <option value="BUSINESS_APPROVED">Business Approved</option>
                <option value="BUSINESS_REJECTED">Business Rejected</option>
                <option value="WHATSAPP_CONNECTED">WhatsApp Connected</option>
                <option value="WHATSAPP_DISCONNECTED">WhatsApp Disconnected</option>
                <option value="CAMPAIGN_EXECUTED">Campaign Executed</option>
                <option value="CAMPAIGN_CREATED">Campaign Created</option>
                <option value="CUSTOMERS_IMPORTED">Customers Imported</option>
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
                  {pagedAuditLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap', fontSize: '12px' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>

                      <td>
                        <span
                          className={`badge ${
                            log.action.includes('REJECT') || log.action.includes('CANCEL') ? 'badge-danger' :
                            log.action.includes('DISCONNECT') ? 'badge-warning' :
                            log.action.includes('APPROVE') || log.action.includes('CONNECT') ? 'badge-success' :
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
            <TablePagination
              page={auditSafePage}
              totalPages={auditTotalPages}
              totalItems={filteredAuditLogs.length}
              onPageChange={setAuditPage}
            />
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

      {/* TAB 4: LIVE PAGE DESIGNER */}
      {activeTab === 'designer' && (
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Editor Panel */}
          <div className="glass-card" style={{ padding: '24px', flex: 1, minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                Loyalty & Rewards Page Designer
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Design the live preview page your business owner's customers see. Shows their program & created rewards.
              </span>
            </div>

            {businesses.length === 0 ? (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No businesses available yet.</span>
            ) : (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Business</label>
                  <select
                    className="form-input"
                    value={designBizId}
                    onChange={(e) => setDesignBizId(e.target.value)}
                  >
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.status})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Hero Title</label>
                  <input
                    type="text"
                    className="form-input"
                    value={designForm?.hero_title || ''}
                    onChange={(e) => setDesignForm({ ...designForm, hero_title: e.target.value })}
                    placeholder="Welcome to VIP Rewards"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Hero Description</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={designForm?.hero_description || ''}
                    onChange={(e) => setDesignForm({ ...designForm, hero_description: e.target.value })}
                    placeholder="Earn points on every visit and unlock exclusive rewards!"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Primary Color</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={designForm?.primary_color || '#4F46E5'}
                        onChange={(e) => setDesignForm({ ...designForm, primary_color: e.target.value })}
                        style={{ width: '42px', height: '38px', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-default)', cursor: 'pointer', background: 'none' }}
                      />
                      <input
                        type="text"
                        className="form-input"
                        value={designForm?.primary_color || ''}
                        onChange={(e) => setDesignForm({ ...designForm, primary_color: e.target.value })}
                        style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Secondary Color</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={designForm?.secondary_color || '#06B6D4'}
                        onChange={(e) => setDesignForm({ ...designForm, secondary_color: e.target.value })}
                        style={{ width: '42px', height: '38px', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-default)', cursor: 'pointer', background: 'none' }}
                      />
                      <input
                        type="text"
                        className="form-input"
                        value={designForm?.secondary_color || ''}
                        onChange={(e) => setDesignForm({ ...designForm, secondary_color: e.target.value })}
                        style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Logo URL</label>
                  <input
                    type="text"
                    className="form-input"
                    value={designForm?.logo_url || ''}
                    onChange={(e) => setDesignForm({ ...designForm, logo_url: e.target.value })}
                    placeholder="https://... (optional)"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Header Subtitle (under business name)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={designForm?.header_subtitle || ''}
                    onChange={(e) => setDesignForm({ ...designForm, header_subtitle: e.target.value })}
                    placeholder="VIP Loyalty Club"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Hero CTA Text (leave blank for auto: "Join Rewards Now & Get X Pts")</label>
                  <input
                    type="text"
                    className="form-input"
                    value={designForm?.hero_cta_text || ''}
                    onChange={(e) => setDesignForm({ ...designForm, hero_cta_text: e.target.value })}
                    placeholder="Join Rewards Now & Get 100 Pts"
                  />
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>How It Works — Section Title</label>
                  <input
                    type="text"
                    className="form-input"
                    value={designForm?.how_it_works_title || ''}
                    onChange={(e) => setDesignForm({ ...designForm, how_it_works_title: e.target.value })}
                    placeholder="How It Works"
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                    {(designForm?.how_it_works || []).map((step: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'var(--primary-bg)', color: 'var(--primary-hover)', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {idx + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <input
                            type="text"
                            className="form-input"
                            value={step.title}
                            onChange={(e) => {
                              const steps = [...designForm.how_it_works];
                              steps[idx] = { ...steps[idx], title: e.target.value };
                              setDesignForm({ ...designForm, how_it_works: steps });
                            }}
                            placeholder={`Step ${idx + 1} title`}
                            style={{ marginBottom: '6px' }}
                          />
                          <textarea
                            className="form-input"
                            rows={2}
                            value={step.description}
                            onChange={(e) => {
                              const steps = [...designForm.how_it_works];
                              steps[idx] = { ...steps[idx], description: e.target.value };
                              setDesignForm({ ...designForm, how_it_works: steps });
                            }}
                            placeholder={`Step ${idx + 1} description`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Terms Text</label>
                  <input
                    type="text"
                    className="form-input"
                    value={designForm?.terms_text || ''}
                    onChange={(e) => setDesignForm({ ...designForm, terms_text: e.target.value })}
                    placeholder="Points cannot be exchanged for cash..."
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleSaveDesign}
                    disabled={designSaving}
                    className="btn"
                    style={{ background: 'var(--emerald-gradient)', color: '#fff', fontWeight: 700, opacity: designSaving ? 0.6 : 1 }}
                  >
                    {designSaving ? 'Saving...' : 'Save Design'}
                  </button>
                  {designPage?.slug && (
                    <a
                      href={`/l/${designPage.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary"
                    >
                      <ExternalLink size={14} /> Open Live Page
                    </a>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Live Preview Panel */}
          <div className="glass-panel" style={{ padding: '24px', flex: 1.2, minWidth: '340px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Customer Preview</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Edits reflect instantly below</span>
            </div>

            {!designPage || !designForm ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                Loading preview…
              </div>
            ) : (() => {
              const primary = designForm.primary_color || '#059669';
              const secondary = designForm.secondary_color || '#D97706';
              const program = designPage.program || {};
              const rewards = designPage.rewards || [];
              return (
                <div style={{ background: '#0B0F19', color: '#F9FAFB', borderRadius: '18px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {/* Brand header */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {designForm.logo_url ? (
                        <img src={designForm.logo_url} alt="logo" style={{ width: '34px', height: '34px', borderRadius: '10px', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 15px ${primary}66` }}>
                          <Sparkles size={16} color="#fff" />
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{designPage.business_name}</div>
                        <div style={{ fontSize: '0.68rem', color: '#9CA3AF' }}>{designForm.header_subtitle || 'VIP Loyalty Club'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Hero */}
                  <div style={{ padding: '28px 18px', backgroundImage: `radial-gradient(circle at 50% 20%, ${primary}33 0%, rgba(17, 24, 39, 0.6) 80%)` }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(31, 41, 55, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9999px', padding: '5px 12px', fontSize: '0.7rem', fontWeight: 600, marginBottom: '12px' }}>
                      <Gift size={12} color={secondary} />
                      {program.welcome_bonus_points ?? 100} {program.points_currency_name || 'Points'} Welcome Bonus
                    </div>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 8px' }}>{designForm.hero_title || 'Welcome to VIP Rewards'}</h2>
                    <p style={{ fontSize: '0.82rem', color: '#9CA3AF', margin: '0 0 14px', lineHeight: 1.5 }}>
                      {designForm.hero_description || 'Earn points on every visit and unlock exclusive rewards!'}
                    </p>
                    {designForm.hero_cta_text && (
                      <div style={{ display: 'inline-block', background: primary, color: '#fff', fontWeight: 700, fontSize: '0.8rem', padding: '9px 20px', borderRadius: '9999px' }}>
                        {designForm.hero_cta_text}
                      </div>
                    )}
                  </div>

                  {/* How It Works */}
                  <div style={{ padding: '0 18px 18px' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '10px' }}>{designForm.how_it_works_title || 'How It Works'}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {(designForm.how_it_works || []).map((step: any, idx: number) => (
                        <div key={idx} style={{ background: 'rgba(31, 41, 55, 0.4)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ width: '24px', height: '24px', borderRadius: '7px', backgroundColor: primary, color: '#fff', fontWeight: 800, fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                            {idx + 1}
                          </div>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: '3px' }}>{step.title}</div>
                          <div style={{ fontSize: '0.62rem', color: '#9CA3AF', lineHeight: 1.4 }}>{step.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Rewards grid — the rewards created for this business */}
                  <div style={{ padding: '18px' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>Featured Member Rewards</div>
                    {rewards.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#6B7280', fontSize: '0.8rem', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '12px' }}>
                        No rewards created yet for this business.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                        {rewards.map((r: any) => (
                          <div key={r.id} style={{ background: 'rgba(31, 41, 55, 0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', overflow: 'hidden' }}>
                            <div style={{ height: '70px', background: `${primary}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {r.image_url ? (
                                <img src={r.image_url} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <Gift size={22} color={primary} />
                              )}
                            </div>
                            <div style={{ padding: '10px' }}>
                              <div style={{ fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                              {r.description && (
                                <div style={{ fontSize: '0.68rem', color: '#9CA3AF', marginTop: '2px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                  {r.description}
                                </div>
                              )}
                              <div style={{ marginTop: '6px' }}>
                                <span style={{ background: secondary, color: '#fff', fontSize: '0.64rem', fontWeight: 800, padding: '3px 9px', borderRadius: '9999px' }}>
                                  {r.points_required} {program.points_currency_name || 'Points'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
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
