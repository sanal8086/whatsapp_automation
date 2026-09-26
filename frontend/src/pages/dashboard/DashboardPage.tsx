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
  CheckCircle2,
  Clock,
  ChevronRight
} from 'lucide-react';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { DashboardMetrics, LoyaltyReward } from '../../types';

export const DashboardPage: React.FC = () => {
  const { tenant } = useAuth();
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

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
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid var(--border-subtle)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '0.9rem' }}>Loading business analytics...</p>
        </div>
      </div>
    );
  }

  const kpis = [
    {
      label: 'Total Customers',
      value: metrics?.total_customers?.toLocaleString() || '0',
      change: '+18.4% this month',
      icon: Users,
      color: '#6366F1',
      bg: 'rgba(99, 102, 241, 0.1)',
    },
    {
      label: 'Loyalty Members',
      value: metrics?.loyalty_members?.toLocaleString() || '0',
      change: '88% enrollment rate',
      icon: Award,
      color: '#10B981',
      bg: 'rgba(16, 185, 129, 0.1)',
    },
    {
      label: 'Points Issued',
      value: metrics?.points_issued?.toLocaleString() || '0',
      change: 'Across all visits',
      icon: TrendingUp,
      color: '#F59E0B',
      bg: 'rgba(245, 158, 11, 0.1)',
    },
    {
      label: 'Campaign Revenue',
      value: `₹${(metrics?.campaign_revenue || 0).toLocaleString()}`,
      change: '14.2x ROI on messages',
      icon: DollarSign,
      color: '#EC4899',
      bg: 'rgba(236, 72, 153, 0.1)',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top Welcome & Quick Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Good day, {tenant?.name || 'Partner'} 👋
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '4px' }}>
            Here is what's happening with your customer loyalty and WhatsApp campaigns.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Link to="/app/campaigns" className="btn btn-primary">
            <Send size={15} />
            Create Campaign
          </Link>
          <Link to="/app/customers" className="btn btn-secondary">
            <PlusCircle size={15} />
            Add Customer
          </Link>
          {tenant && (
            <a href={`/l/${tenant.slug}`} target="_blank" rel="noreferrer" className="btn btn-secondary">
              <ExternalLink size={15} />
              Public Page
            </a>
          )}
        </div>
      </div>

      {/* Hero Insights Banner */}
      {metrics?.insights && metrics.insights.length > 0 && (
        <div
          className="glass-panel"
          style={{
            padding: '20px 24px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(236, 72, 153, 0.08) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '20px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', maxWidth: '750px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'var(--primary-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Sparkles size={22} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>Automated Growth Insight</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Updated moments ago</span>
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {metrics.insights[0].title}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {metrics.insights[0].description}
              </p>
            </div>
          </div>

          <Link
            to="/app/insights"
            className="btn btn-primary"
            style={{ fontSize: '0.825rem', padding: '8px 16px' }}
          >
            {metrics.insights[0].action_label}
            <ChevronRight size={15} />
          </Link>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className="glass-card" style={{ padding: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {kpi.label}
                </span>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: kpi.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={18} color={kpi.color} />
                </div>
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', marginBottom: '6px' }}>
                {kpi.value}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ArrowUpRight size={13} color="var(--success)" />
                {kpi.change}
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart & Recent Activity Split Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '22px' }}>
        {/* Growth Trend Visual */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                7-Day Activity & Points Velocity
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Daily points issued to customers</p>
            </div>
            <span className="badge badge-success">Live Track</span>
          </div>

          {/* Synthetic Bar Graph Representation */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '170px', paddingTop: '20px', gap: '12px' }}>
            {metrics?.chart_data?.map((bar, i) => {
              const heightPct = Math.min(100, Math.max(25, (bar.points_issued / 500) * 100));
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontWeight: 600 }}>{bar.points_issued}</span>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '36px',
                      height: `${heightPct}%`,
                      background: i === 6 ? 'var(--primary-gradient)' : 'rgba(99, 102, 241, 0.4)',
                      borderRadius: '6px 6px 2px 2px',
                      transition: 'all 0.3s ease',
                      boxShadow: i === 6 ? 'var(--shadow-glow)' : 'none',
                    }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{bar.date}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Activity Timeline */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Recent Loyalty Activity
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Latest transactions in the points ledger</p>
            </div>
            <Link to="/app/loyalty" style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
              View All →
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {metrics?.recent_transactions && metrics.recent_transactions.length > 0 ? (
              metrics.recent_transactions.slice(0, 5).map((txn: any) => (
                <div
                  key={txn.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: txn.points > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {txn.points > 0 ? <CheckCircle2 size={16} color="var(--success)" /> : <Gift size={16} color="var(--danger)" />}
                    </div>
                    <div>
                      <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        {txn.customer_name || 'Customer'}
                      </p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                        {txn.description}
                      </p>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
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
    </div>
  );
};
