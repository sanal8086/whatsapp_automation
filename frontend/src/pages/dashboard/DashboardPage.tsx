import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  Award,
  TrendingUp,
  DollarSign,
  MessageSquare,
  Sparkles,
  ArrowUpRight,
  PlusCircle,
  Send,
  ExternalLink,
  Gift,
  CheckCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
  Home,
} from 'lucide-react';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { DashboardMetrics, LoyaltyReward } from '../../types';
import {
  StatCard,
  PeriodTabs,
  SearchBar,
  CalendarButton,
  ProfitChart,
  PropertyList,
  DashboardHeader,
  LoadingSpinner,
} from '../../components/ui';

export const DashboardPage: React.FC = () => {
  const { tenant } = useAuth();
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('Week');

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<DashboardMetrics>('/insights/dashboard');
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [tenant]);

  if (loading) {
    return <LoadingSpinner message="Loading business analytics..." />;
  }

  const kpiCards = [
    {
      label: 'Customers',
      value: metrics?.total_customers?.toLocaleString() || '0',
      delta: '+18% this month',
      tone: 'views' as const,
      icon: <Users size={18} />,
    },
    {
      label: 'Loyalty Members',
      value: metrics?.loyalty_members?.toLocaleString() || '0',
      delta: '88% enrollment',
      tone: 'clients' as const,
      icon: <Award size={18} />,
    },
    {
      label: 'Points Issued',
      value: metrics?.points_issued?.toLocaleString() || '0',
      delta: '+12% this week',
      tone: 'purchases' as const,
      icon: <CheckCircle size={18} />,
    },
  ];

  // Build property list items from chart data
  const topItems = [
    { name: 'Campaign Revenue', percent: `₹${(metrics?.campaign_revenue || 0).toLocaleString()}`, dark: true, thumbColor: '#89e0ed' },
    { name: 'Points Redeemed', percent: (metrics?.points_redeemed || 0).toLocaleString(), thumbColor: '#d7c7ff' },
    { name: 'Wallet Balance', percent: `₹${(metrics?.wallet_balance || 0).toLocaleString()}`, thumbColor: '#8edfe9' },
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* ─── Hero Header ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        gap: 28,
        alignItems: 'start',
        marginBottom: 8,
      }}>
        <div>
          <h1
            style={{
              fontSize: 34,
              lineHeight: 1.08,
              letterSpacing: -1.1,
              fontWeight: 500,
              color: 'var(--text-main)',
            }}
          >
            Good day, {tenant?.name || 'Partner'} 👋
          </h1>
          <p style={{ marginTop: 14, color: 'var(--text-muted)', fontSize: 12 }}>
            Here's what's happening with your customer loyalty and WhatsApp campaigns
          </p>
        </div>
        <SearchBar style={{ width: 190 }} />
        <CalendarButton />
      </div>

      {/* ─── Period Tabs ─── */}
      <div style={{ marginBottom: 28 }}>
        <PeriodTabs selected={period} onChange={setPeriod} />
      </div>

      {/* ─── Stat Cards ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginBottom: 32 }}>
        {kpiCards.map((kpi, i) => (
          <StatCard key={i} {...kpi} />
        ))}
      </div>

      {/* ─── AI Insight Banner (if available) ─── */}
      {metrics?.insights && metrics.insights.length > 0 && (
        <div
          className="card"
          style={{
            padding: '22px 28px',
            background: 'linear-gradient(135deg, var(--primary-bg) 0%, rgba(207, 224, 255, 0.3) 100%)',
            border: '1px solid rgba(100, 211, 231, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 20,
            flexWrap: 'wrap',
            marginBottom: 32,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, maxWidth: 700 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'var(--primary-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Sparkles size={20} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="badge badge-primary" style={{ fontSize: '0.68rem' }}>Growth Insight</span>
              </div>
              <h3 style={{ fontSize: '1.02rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {metrics.insights[0].title}
              </h3>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {metrics.insights[0].description}
              </p>
            </div>
          </div>
          <Link to="/app/insights" className="btn btn-primary btn-sm">
            {metrics.insights[0].action_label}
            <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* ─── Chart Row ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: 42 }}>
        {/* Left: Chart or Activity */}
        <div>
          {/* Point Velocity Chart */}
          <div className="card" style={{ padding: 28, marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 className="section-title">7-Day Points Velocity</h3>
                <p className="section-subtitle">Daily points issued to customers</p>
              </div>
              <span className="badge badge-success">Live</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 170, gap: 12 }}>
              {metrics?.chart_data?.map((bar, i) => {
                const heightPct = Math.min(100, Math.max(25, (bar.points_issued / 500) * 100));
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                      {bar.points_issued}
                    </span>
                    <div
                      style={{
                        width: '100%',
                        maxWidth: 36,
                        height: `${heightPct}%`,
                        background: i === (metrics.chart_data.length - 1)
                          ? 'var(--primary-gradient)'
                          : 'rgba(100, 211, 231, 0.35)',
                        borderRadius: '6px 6px 2px 2px',
                        transition: 'all 0.3s ease',
                      }}
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {bar.date}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 className="section-title">Recent Loyalty Activity</h3>
                <p className="section-subtitle">Latest transactions in the points ledger</p>
              </div>
              <Link
                to="/app/loyalty"
                style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}
              >
                View All →
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {metrics?.recent_transactions && metrics.recent_transactions.length > 0 ? (
                metrics.recent_transactions.slice(0, 5).map((txn: any) => (
                  <div
                    key={txn.id}
                    className="object-item"
                    style={{
                      height: 'auto',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'default',
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: txn.points > 0 ? 'var(--success-bg)' : 'var(--danger-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {txn.points > 0 ? (
                        <CheckCircle2 size={16} color="var(--success)" />
                      ) : (
                        <Gift size={16} color="var(--danger)" />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        {txn.customer_name || 'Customer'}
                      </p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                        {txn.description}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span
                        style={{
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          color: txn.points > 0 ? 'var(--success)' : 'var(--danger)',
                        }}
                      >
                        {txn.points > 0 ? `+${txn.points}` : txn.points} pts
                      </span>
                      <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                        {new Date(txn.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '24px 0' }}>
                  No recent transactions recorded.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: KPI Summary & Quick Actions */}
        <div>
          {/* Revenue Summary */}
          <PropertyList
            items={topItems}
            tabs={['Revenue', 'Growth']}
          />

          {/* Quick Actions */}
          <div style={{ marginTop: 32 }}>
            <h3 className="section-title" style={{ marginBottom: 16 }}>Quick Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link to="/app/campaigns" className="btn btn-primary" style={{ justifyContent: 'flex-start' }}>
                <Send size={15} />
                Create Campaign
              </Link>
              <Link to="/app/customers" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                <PlusCircle size={15} />
                Add Customer
              </Link>
              {tenant && (
                <a
                  href={`/l/${tenant.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                  style={{ justifyContent: 'flex-start' }}
                >
                  <ExternalLink size={15} />
                  Public Page
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
