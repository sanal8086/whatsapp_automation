import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  CheckCircle,
  CheckCircle2,
  DollarSign,
  Gift,
  Wallet,
  AlertTriangle,
} from 'lucide-react';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { DashboardMetrics } from '../../types';
import {
  StatCard,
  LoadingSpinner,
  EmptyState,
  DateRangePicker,
  RangeMode,
} from '../../components/ui';
import {
  startOfDay,
  startOfWeek,
  endOfWeek,
  toISODate,
  formatRangeLabel,
} from '../../components/ui/DateRangePicker';

const initialRange = (): [Date, Date] => {
  const today = startOfDay(new Date());
  return [startOfWeek(today), endOfWeek(today)];
};

export const DashboardPage: React.FC = () => {
  const { tenant } = useAuth();

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<RangeMode>('week');
  const [[startDate, endDate], setRange] = useState<[Date, Date]>(initialRange);

  // ISO keys drive the fetch — stable string deps, fires on every filter change
  const startISO = toISODate(startDate);
  const endISO = toISODate(endDate);

  useEffect(() => {
    let cancelled = false;
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiRequest<DashboardMetrics>(
          `/insights/dashboard?start_date=${startISO}&end_date=${endISO}`
        );
        if (!cancelled) setMetrics(data);
      } catch (err: any) {
        console.error('Failed to load dashboard:', err);
        if (!cancelled) setError(err?.message || 'Failed to load dashboard data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchDashboard();
    return () => {
      cancelled = true;
    };
  }, [tenant, startISO, endISO]);

  const handleModeChange = (m: RangeMode) => {
    setMode(m);
  };

  const rangeDays = useMemo(
    () => Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1,
    [startDate, endDate]
  );

  const formatDelta = (d?: number | null): string =>
    d === null || d === undefined
      ? 'No prior period data'
      : `${d >= 0 ? '+' : ''}${d}% vs prev period`;

  const kpiCards = [
    {
      label: 'Customers',
      value: metrics?.total_customers?.toLocaleString() || '0',
      delta: formatDelta(metrics?.deltas?.total_customers),
      tone: 'lavender' as const,
      icon: <Users size={18} />,
    },
    {
      label: 'Points Issued',
      value: metrics?.points_issued?.toLocaleString() || '0',
      delta: formatDelta(metrics?.deltas?.points_issued),
      tone: 'pistachio' as const,
      icon: <CheckCircle size={18} />,
    },
    {
      label: 'Campaign Revenue',
      value: `₹${(metrics?.campaign_revenue || 0).toLocaleString()}`,
      delta: formatDelta(metrics?.deltas?.campaign_revenue),
      tone: 'electric-ice' as const,
      icon: <DollarSign size={18} />,
    },
    {
      label: 'Points Redeemed',
      value: metrics?.points_redeemed?.toLocaleString() || '0',
      delta: formatDelta(metrics?.deltas?.points_redeemed),
      tone: 'rose-milk' as const,
      icon: <Gift size={18} />,
    },
    {
      label: 'Wallet Balance',
      value: `₹${(metrics?.wallet_balance || 0).toLocaleString()}`,
      delta: 'Live messaging credits',
      tone: 'apricot-cream' as const,
      icon: <Wallet size={18} />,
    },
  ];

  const chartMeta =
    rangeDays <= 1
      ? { title: 'Points Velocity — Hourly', subtitle: `Points issued on ${formatRangeLabel(startDate, endDate)} (4-hour blocks)` }
      : rangeDays <= 14
      ? { title: `${rangeDays}-Day Points Velocity`, subtitle: 'Daily points issued to customers' }
      : rangeDays <= 92
      ? { title: `${rangeDays}-Day Points Velocity`, subtitle: 'Weekly points issued (7-day blocks)' }
      : { title: 'Points Velocity by Month', subtitle: 'Points issued per calendar month' };

  const maxBarPoints = Math.max(1, ...(metrics?.chart_data?.map((bar) => bar.points_issued) ?? [0]));

  // SVG line-chart geometry (viewBox 0..100 mapped to the plot box)
  const chartBars = metrics?.chart_data ?? [];
  const chartN = chartBars.length;
  const chartX = (i: number) => (chartN === 1 ? 50 : (i / (chartN - 1)) * 100);
  const chartY = (v: number) => 14 + (1 - v / maxBarPoints) * 80;
  const chartLinePath = chartBars
    .map((bar, i) => `${i === 0 ? 'M' : 'L'} ${chartX(i).toFixed(2)} ${chartY(bar.points_issued).toFixed(2)}`)
    .join(' ');
  const chartAreaPath =
    chartN > 0
      ? `${chartLinePath} L ${chartX(chartN - 1).toFixed(2)} 100 L ${chartX(0).toFixed(2)} 100 Z`
      : '';

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* ─── Hero Header ─── */}
      <div style={{ marginBottom: 8 }}>
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

      {/* ─── Date Range Calendar ─── */}
      <div style={{ marginBottom: 28 }}>
        <DateRangePicker
          mode={mode}
          startDate={startDate}
          endDate={endDate}
          onModeChange={handleModeChange}
          onRangeChange={(s, e) => setRange([s, e])}
        />
      </div>

      {loading ? (
        <LoadingSpinner message="Loading business analytics..." />
      ) : error ? (
        <div className="card" style={{ padding: 28, marginBottom: 28 }}>
          <EmptyState
            icon={<AlertTriangle size={28} />}
            title="Could not load dashboard data"
            description={`${error}. Please check that the backend server is running, then try again.`}
          />
        </div>
      ) : (
      <>
      {/* ─── Stat Cards ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginBottom: 32 }}>
        {kpiCards.map((kpi, i) => (
          <StatCard key={i} {...kpi} />
        ))}
      </div>

      {/* ─── Chart & Activity ─── */}
      <div>
        {/* Left: Chart or Activity */}
        <div>
          {/* Point Velocity Chart */}
          <div className="card" style={{ padding: 28, marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 className="section-title">{chartMeta.title}</h3>
                <p className="section-subtitle">{chartMeta.subtitle}</p>
              </div>
              <span className="badge badge-success">Live</span>
            </div>
            <div style={{ position: 'relative', height: 170 }}>
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
              >
                <defs>
                  <linearGradient id="pointsAreaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(100, 211, 231, 0.32)" />
                    <stop offset="100%" stopColor="rgba(100, 211, 231, 0)" />
                  </linearGradient>
                </defs>
                {[25, 50, 75].map((gy) => (
                  <line
                    key={gy}
                    x1={0}
                    x2={100}
                    y1={gy}
                    y2={gy}
                    stroke="var(--border-subtle)"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {chartAreaPath && <path d={chartAreaPath} fill="url(#pointsAreaFill)" />}
                {chartLinePath && (
                  <path
                    d={chartLinePath}
                    fill="none"
                    stroke="#64d3e7"
                    strokeWidth={2.25}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>
              {chartBars.map((bar, i) => {
                const x = chartX(i);
                const y = chartY(bar.points_issued);
                const isLast = i === chartN - 1;
                return (
                  <React.Fragment key={i}>
                    <span
                      style={{
                        position: 'absolute',
                        left: `${x}%`,
                        top: `${y}%`,
                        transform: 'translate(-50%, calc(-100% - 10px))',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        color: isLast ? 'var(--text-main)' : 'var(--text-dim)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {bar.points_issued.toLocaleString()}
                    </span>
                    <span
                      style={{
                        position: 'absolute',
                        left: `${x}%`,
                        top: `${y}%`,
                        transform: 'translate(-50%, -50%)',
                        width: isLast ? 10 : 8,
                        height: isLast ? 10 : 8,
                        borderRadius: '50%',
                        background: isLast ? 'var(--primary)' : '#64d3e7',
                        border: '2px solid var(--bg-surface-elevated)',
                        boxShadow: isLast ? '0 0 0 4px rgba(100, 211, 231, 0.18)' : 'none',
                        transition: 'all 0.3s ease',
                      }}
                    />
                  </React.Fragment>
                );
              })}
            </div>
            <div style={{ position: 'relative', height: 18, marginTop: 10 }}>
              {chartBars.map((bar, i) => (
                <span
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${chartX(i)}%`,
                    transform: 'translateX(-50%)',
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {bar.date}
                </span>
              ))}
            </div>
          </div>

          {/* Recent Activity — latest 5; full ledger via View All */}
          <div className="card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 className="section-title">Recent Loyalty Activity</h3>
                <p className="section-subtitle">Latest 5 transactions in the points ledger</p>
              </div>
              <Link
                to="/app/loyalty?tab=ledger"
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
                  No transactions in this date range.
                </p>
              )}
            </div>
          </div>

        </div>
      </div>
      </>
      )}
    </div>
  );
};
