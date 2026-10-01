import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  TrendingUp,
  AlertCircle,
  Gift,
  ArrowRight,
  Flame,
  CheckCircle2,
  Cake,
  Zap,
  Users,
  Target,
  ArrowUpRight
} from 'lucide-react';
import { apiRequest } from '../../api/client';
import { DashboardMetrics, InsightItem } from '../../types';
import { StatCard } from '../../components/ui';

export const InsightsPage: React.FC = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const fetchInsights = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<DashboardMetrics>('/insights/dashboard');
      setMetrics(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const handleAction = (item: InsightItem) => {
    if (item.action_type === 'CREATE_CAMPAIGN') {
      navigate('/app/campaigns');
    } else if (item.action_type === 'VIEW_CUSTOMERS') {
      navigate('/app/customers');
    } else if (item.action_type === 'VIEW_AUTOMATIONS') {
      navigate('/app/automations');
    }
  };

  const getCategoryTheme = (category: string, index: number) => {
    switch (category) {
      case 'WIN_BACK':
        return {
          tone: 'purchases' as const,
          icon: <Flame size={20} color="#7c3aed" />,
          squircleBg: 'linear-gradient(135deg, #efc2f4 0%, #d7c7ff 100%)',
          badgeText: 'Win-Back Opportunity',
          badgeClass: 'badge-warning',
          tagColor: '#d97706',
        };
      case 'VIP_UPGRADE':
      case 'LOYALTY':
        return {
          tone: 'views' as const,
          icon: <Sparkles size={20} color="#2563eb" />,
          squircleBg: 'var(--gradient-views)',
          badgeText: 'Loyalty Elevation',
          badgeClass: 'badge-primary',
          tagColor: '#2563eb',
        };
      case 'BIRTHDAY':
        return {
          tone: 'purchases' as const,
          icon: <Cake size={20} color="#ec4899" />,
          squircleBg: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)',
          badgeText: 'Milestone Celebration',
          badgeClass: 'badge-info',
          tagColor: '#ec4899',
        };
      default:
        return {
          tone: (index % 2 === 0 ? 'clients' : 'views') as 'clients' | 'views',
          icon: <Zap size={20} color="#0d9488" />,
          squircleBg: 'var(--gradient-clients)',
          badgeText: 'Revenue Driver',
          badgeClass: 'badge-success',
          tagColor: '#059669',
        };
    }
  };

  const insightsList = metrics?.insights || [];
  const filteredInsights = selectedCategory === 'ALL'
    ? insightsList
    : insightsList.filter((item) => item.category === selectedCategory);

  const categories = ['ALL', ...Array.from(new Set(insightsList.map((i) => i.category)))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ─── Page Title Header ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">
            Growth & Marketing Insights
          </h1>
          <p className="page-subtitle">
            Actionable business intelligence synthesized from customer visits, points redemption, and spend behavior.
          </p>
        </div>
      </div>

      {/* ─── Dashboard-Style Stat Cards Row (Insights Pastel Palette) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
        <StatCard
          label="Active Opportunities"
          value={`${insightsList.length} Synthesized`}
          delta="Real-time algorithm signals"
          tone="lemon-sorbet"
          icon={<Sparkles size={18} />}
        />
        <StatCard
          label="Revenue Upside"
          value={`₹${(metrics?.campaign_revenue || 28400).toLocaleString()}`}
          delta="+24% estimated recovery"
          tone="electric-ice"
          icon={<TrendingUp size={18} />}
        />
        <StatCard
          label="Targetable Audience"
          value={`${metrics?.total_customers ? Math.round(metrics.total_customers * 0.45) : 180} Users`}
          delta="High conversion affinity"
          tone="mauve"
          icon={<CheckCircle2 size={18} />}
        />
      </div>

      {/* ─── Category Filter Navigation Tabs ─── */}
      {categories.length > 2 && (
        <div className="subnav-tabs">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`subnav-tab ${selectedCategory === cat ? 'active' : ''}`}
            >
              {cat === 'ALL' ? 'All Opportunities' : cat.replace('_', ' ')}
            </button>
          ))}
        </div>
      )}

      {/* ─── Insight Cards Grid Matching Dashboard Aesthetics ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {filteredInsights.map((item, index) => {
          const theme = getCategoryTheme(item.category, index);

          return (
            <div
              key={item.id}
              className={`insight-card ${theme.tone}`}
            >
              <div>
                {/* Header Row: Icon squircle + Category badge + Highlight metric */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      className="insight-icon-squircle"
                      style={{ background: theme.squircleBg }}
                    >
                      {theme.icon}
                    </div>
                    <div>
                      <span
                        className={`badge ${theme.badgeClass}`}
                        style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '9999px' }}
                      >
                        {item.category.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <span
                    className="insight-metric-pill"
                    style={{
                      background: 'rgba(255, 255, 255, 0.88)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255, 255, 255, 0.7)',
                      color: 'var(--text-main)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                    }}
                  >
                    <ArrowUpRight size={13} color={theme.tagColor} />
                    {item.metric}
                  </span>
                </div>

                {/* Card Title & Content */}
                <h3
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 600,
                    letterSpacing: '-0.4px',
                    color: 'var(--text-main)',
                    lineHeight: 1.35,
                    marginBottom: '10px',
                  }}
                >
                  {item.title}
                </h3>
                <p
                  style={{
                    fontSize: '0.86rem',
                    color: 'var(--text-muted)',
                    lineHeight: 1.55,
                    marginBottom: '28px',
                  }}
                >
                  {item.description}
                </p>
              </div>

              {/* Action Button: Dashboard-style dark pill */}
              <button
                onClick={() => handleAction(item)}
                className="btn btn-dark-pill"
                style={{
                  width: '100%',
                  justifyContent: 'space-between',
                  padding: '12px 22px',
                  fontSize: '0.88rem',
                }}
              >
                <span>{item.action_label}</span>
                <ArrowRight size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

