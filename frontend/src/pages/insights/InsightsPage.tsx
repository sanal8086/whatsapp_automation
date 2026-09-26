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
  Zap
} from 'lucide-react';
import { apiRequest } from '../../api/client';
import { DashboardMetrics, InsightItem } from '../../types';

export const InsightsPage: React.FC = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={20} color="#fff" />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Growth & Marketing Insights
          </h2>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
          Actionable business intelligence synthesized from customer visits, points redemption, and spend behavior.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
        {metrics?.insights && metrics.insights.map((item) => (
          <div
            key={item.id}
            className="glass-card"
            style={{
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              border: item.category === 'WIN_BACK' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span className="badge badge-info">{item.category}</span>
                <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--primary)' }}>{item.metric}</span>
              </div>

              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                {item.title}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '20px' }}>
                {item.description}
              </p>
            </div>

            <button
              onClick={() => handleAction(item)}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'space-between' }}
            >
              <span>{item.action_label}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
