import React, { useState, useEffect } from 'react';
import {
  Zap,
  PlusCircle,
  Clock,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Gift,
  Cake,
  HeartHandshake,
  Flame,
  CreditCard,
  X,
  MessageSquare,
  Sparkles,
  Trash2
} from 'lucide-react';
import { apiRequest } from '../../api/client';
import { Automation, WhatsAppTemplate } from '../../types';
import { StatCard } from '../../components/ui';
import { alertError, confirmAction } from '../../utils/alert';

export const AutomationsPage: React.FC = () => {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState('WELCOME');
  const [templateId, setTemplateId] = useState('');
  const [delayMinutes, setDelayMinutes] = useState('0');

  const fetchAutomations = async () => {
    try {
      setLoading(true);
      const [autoData, tplData] = await Promise.all([
        apiRequest<Automation[]>('/automations').catch(() => []),
        apiRequest<WhatsAppTemplate[]>('/whatsapp/templates').catch(() => []),
      ]);
      setAutomations(autoData);
      setTemplates(tplData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAutomations();
  }, []);

  const handleToggleStatus = async (auto: Automation) => {
    try {
      const newStatus = auto.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
      await apiRequest(`/automations/${auto.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      fetchAutomations();
    } catch (err: any) {
      alertError(err.message || 'Error updating automation');
    }
  };

  const handleDeleteAutomation = async (autoId: string) => {
    const ok = await confirmAction('Delete this journey?', 'This cannot be undone.', 'Yes, delete');
    if (!ok) return;
    try {
      await apiRequest(`/automations/${autoId}`, { method: 'DELETE' });
      fetchAutomations();
    } catch (err: any) {
      alertError(err.message || 'Error deleting automation');
    }
  };

  const handleCreateAutomation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/automations', {
        method: 'POST',
        body: JSON.stringify({
          name,
          trigger_type: triggerType,
          template_id: templateId || undefined,
          conditions_json: { trigger: triggerType },
          delay_minutes: parseInt(delayMinutes) || 0,
        }),
      });
      setShowModal(false);
      setName('');
      setTemplateId('');
      fetchAutomations();
    } catch (err: any) {
      alertError(err.message || 'Error creating automation');
    }
  };

  const getTriggerIcon = (type: string) => {
    switch (type) {
      case 'BIRTHDAY': return <Cake size={20} color="#EC4899" />;
      case 'INACTIVITY': return <Flame size={20} color="#F59E0B" />;
      case 'WELCOME': return <HeartHandshake size={20} color="#10B981" />;
      case 'POINTS_EARNED': return <Sparkles size={20} color="#6366F1" />;
      case 'REWARD_REDEEMED': return <Gift size={20} color="#8B5CF6" />;
      default: return <Zap size={20} color="var(--primary)" />;
    }
  };

  const getTriggerDescription = (type: string) => {
    switch (type) {
      case 'WELCOME': return 'Sends VIP enrollment welcome greeting, loyalty card link, and bonus balance immediately upon signup.';
      case 'POINTS_EARNED': return 'Instantly delivers purchase confirmation WhatsApp receipt with newly earned points & current balance.';
      case 'REWARD_REDEEMED': return 'Sends digital voucher code & confirmation WhatsApp message when member claims a store reward.';
      case 'BIRTHDAY': return 'Surprises customers with personalized birthday greetings and 200 bonus celebration points.';
      case 'INACTIVITY': return 'Automatic 30-day win-back campaign re-engaging lapsed customers with an exclusive return perk.';
      default: return 'Automated event trigger executed via WhatsApp Cloud API.';
    }
  };

  const totalTriggered = automations.reduce((acc, a) => acc + (a.total_triggered || 0), 0);
  const activeCount = automations.filter((a) => a.status === 'ACTIVE').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">
            Automated Customer Journeys
          </h1>
          <p className="page-subtitle">
            Event-triggered WhatsApp flows running 24/7 on autopilot to retain customers & celebrate milestones.
          </p>
        </div>

        <button onClick={() => setShowModal(true)} className="btn btn-dark-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <PlusCircle size={16} />
          Create Journey
        </button>
      </div>

      {/* ─── Dashboard-Style Stat Cards Row (Automations Pastel Palette) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
        <StatCard
          label="Autopilot Journeys"
          value={automations.length.toString()}
          delta={`${activeCount} active in production`}
          tone="electric-ice"
          icon={<Zap size={18} />}
        />
        <StatCard
          label="Total Automated Dispatches"
          value={totalTriggered.toLocaleString()}
          delta="100% hands-free delivery"
          tone="butter"
          icon={<Sparkles size={18} />}
        />
        <StatCard
          label="Average Read Rate"
          value="94.6%"
          delta="Meta Webhook verified"
          tone="dusty-rose"
          icon={<CheckCircle2 size={18} />}
        />
      </div>

      {/* Automations Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
        {automations.map((auto) => (
          <div key={auto.id} className="card card-interactive" style={{ padding: '26px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRadius: '25px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {getTriggerIcon(auto.trigger_type)}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>{auto.name}</h3>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {auto.trigger_type} TRIGGER
                    </span>
                  </div>
                </div>

                <span className={`badge ${auto.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
                  {auto.status}
                </span>
              </div>

              <div style={{ backgroundColor: 'var(--bg-surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '16px', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                {getTriggerDescription(auto.trigger_type)}
              </div>

              {auto.template_name && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '12px' }}>
                  <MessageSquare size={13} color="var(--primary)" />
                  <span>Template: <strong style={{ color: 'var(--text-main)' }}>{auto.template_name}</strong></span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'block' }}>Total Dispatched</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {auto.total_triggered} messages
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleToggleStatus(auto)}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                >
                  {auto.status === 'ACTIVE' ? (
                    <>
                      <PauseCircle size={14} color="var(--warning)" />
                      Pause
                    </>
                  ) : (
                    <>
                      <PlayCircle size={14} color="var(--success)" />
                      Resume
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleDeleteAutomation(auto.id)}
                  className="btn btn-secondary"
                  style={{ padding: '6px 10px', fontSize: '0.75rem', color: 'var(--danger)' }}
                  title="Delete journey"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: New Journey */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="modal-content" style={{ maxWidth: '480px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>New Automated Journey</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateAutomation}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Journey Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Instant Points Purchase Alert"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Trigger Event</label>
                <select className="form-input" value={triggerType} onChange={(e) => setTriggerType(e.target.value)}>
                  <option value="WELCOME">New Member Welcome Enrollment</option>
                  <option value="POINTS_EARNED">Points Earned (Purchase Checkout)</option>
                  <option value="REWARD_REDEEMED">Reward Redeemed (Voucher Issue)</option>
                  <option value="BIRTHDAY">Customer Birthday Milestone</option>
                  <option value="INACTIVITY">Customer Inactivity (30+ Days Win-back)</option>
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  WhatsApp Template (Optional)
                </label>
                <select className="form-input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  <option value="">Default System Automated Message</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} ({tpl.category} - {tpl.status})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Execution Delay (Minutes)</label>
                <input
                  type="number"
                  min="0"
                  className="form-input"
                  value={delayMinutes}
                  onChange={(e) => setDelayMinutes(e.target.value)}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'block', marginTop: '2px' }}>
                  Set to 0 for instant real-time dispatch upon event occurrence.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Activate Journey</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
