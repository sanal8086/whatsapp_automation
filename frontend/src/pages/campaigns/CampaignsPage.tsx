import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Send,
  PlusCircle,
  Clock,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  X,
  ChevronRight,
  ChevronLeft,
  Users,
  FileText,
  Download,
  Calendar,
  ShieldAlert,
  Award,
  HelpCircle
} from 'lucide-react';
import { apiRequest, apiDownload } from '../../api/client';
import { Campaign, Segment, WhatsAppTemplate, WhatsAppConnection } from '../../types';
import { StatCard } from '../../components/ui';

export const CampaignsPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [waConnected, setWaConnected] = useState<boolean | null>(null);

  // Wizard state
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [campaignName, setCampaignName] = useState('');
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('');
  const [estimateData, setEstimateData] = useState<any>(null);
  const [sending, setSending] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [campData, segData, tplData, waConn] = await Promise.all([
        apiRequest<Campaign[]>('/campaigns'),
        apiRequest<Segment[]>('/segments'),
        apiRequest<WhatsAppTemplate[]>('/whatsapp/templates'),
        apiRequest<WhatsAppConnection>('/whatsapp/connection'),
      ]);
      setCampaigns(campData);
      setSegments(segData);
      setTemplates(tplData);
      setWaConnected(waConn.connection_status === 'CONNECTED');

      if (tplData.length > 0) {
        setSelectedTemplateId(tplData[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleNextToEstimate = async () => {
    try {
      const res = await apiRequest('/campaigns/estimate', {
        method: 'POST',
        body: JSON.stringify({ segment_id: selectedSegmentId || undefined }),
      });
      setEstimateData(res);
      setWizardStep(4);
    } catch (err: any) {
      alert('Estimation failed: ' + err.message);
    }
  };

  const handleLaunchCampaign = async () => {
    setSending(true);
    try {
      // 1. Create campaign
      const newCamp = await apiRequest<Campaign>('/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: campaignName,
          segment_id: selectedSegmentId || undefined,
          template_id: selectedTemplateId,
          channel: 'WHATSAPP',
          scheduled_at: isScheduled && scheduleTime ? new Date(scheduleTime).toISOString() : undefined,
        }),
      });

      // 2. Dispatch if send now
      if (!isScheduled || !scheduleTime) {
        await apiRequest(`/campaigns/${newCamp.id}/send`, { method: 'POST' });
        alert('Campaign broadcast successfully dispatched to WhatsApp queue!');
      } else {
        alert('Campaign scheduled successfully! Background runner will dispatch at target time.');
      }

      setShowWizard(false);
      setWizardStep(1);
      setCampaignName('');
      setIsScheduled(false);
      setScheduleTime('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error launching campaign');
    } finally {
      setSending(false);
    }
  };

  const handleExportCampaigns = async () => {
    try {
      await apiDownload('/campaigns/export', 'campaigns_summary.csv');
    } catch (err: any) {
      alert(err.message || 'Export failed');
    }
  };

  const totalDelivered = campaigns.reduce((acc, c) => acc + c.delivered_count, 0);
  const totalAttributed = campaigns.reduce((acc, c) => acc + c.attributed_revenue, 0);
  const totalCost = campaigns.reduce((acc, c) => acc + c.actual_cost, 0);
  const overallRoi = totalCost > 0 ? (totalAttributed / totalCost).toFixed(1) : '24.5';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">
            WhatsApp Broadcast Campaigns
          </h1>
          <p className="page-subtitle">
            Send targeted promotions, festival offers & rewards updates directly to customer WhatsApp phones.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleExportCampaigns} className="btn btn-secondary">
            <Download size={15} />
            Export Campaigns CSV
          </button>
          <button onClick={() => { setShowWizard(true); setWizardStep(1); }} className="btn btn-whatsapp">
            <PlusCircle size={15} />
            Create Campaign
          </button>
        </div>
      </div>

      {/* WhatsApp Not Connected Warning Banner */}
      {waConnected === false && (
        <div
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            padding: '12px 16px',
            borderRadius: '10px',
            fontSize: '0.85rem',
            color: '#F59E0B',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
          }}
        >
          <HelpCircle size={18} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            WhatsApp Cloud API is not connected — campaigns will fail at dispatch.{' '}
            <Link
              to="/app/whatsapp"
              style={{
                color: '#F59E0B',
                fontWeight: 600,
                textDecoration: 'underline',
                marginLeft: '4px',
              }}
            >
              Connect WhatsApp
            </Link>
          </div>
        </div>
      )}

      {/* Stats Cards Row (Campaigns Pastel Palette) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
        <StatCard
          label="Total Delivered"
          value={totalDelivered.toLocaleString()}
          delta="Across all broadcast runs"
          tone="cornflower"
          icon={<Send size={18} />}
        />
        <StatCard
          label="Attributed Revenue"
          value={`₹${totalAttributed.toLocaleString()}`}
          delta="From tracked redemptions"
          tone="apricot"
          icon={<TrendingUp size={18} />}
        />
        <StatCard
          label="Total Messaging Cost"
          value={`₹${totalCost.toFixed(2)}`}
          delta="Dynamic Meta pricing"
          tone="turquoise"
          icon={<DollarSign size={18} />}
        />
        <StatCard
          label="Average Campaign ROI"
          value={`${overallRoi}x`}
          delta="Revenue / Campaign spend"
          tone="orchid-mist"
          icon={<Award size={18} />}
        />
      </div>

      {/* Campaigns History Table */}
      <div className="table-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="table-modern">
            <thead>
              <tr>
                <th>Campaign Name</th>
                <th>Audience</th>
                <th>Status</th>
                <th>Sent / Delivered</th>
                <th>Actual Cost</th>
                <th>Attributed Revenue</th>
                <th>Scheduled / Created</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length > 0 ? (
                campaigns.map((camp) => (
                  <tr key={camp.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div className="table-avatar cyan">
                          <Send size={16} color="#0284c7" />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '13.5px' }}>{camp.name}</div>
                          <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                            Template: {camp.template_name || 'loyalty_points_earned'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      {camp.segment_name || 'All Customers'}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          camp.status === 'COMPLETED' ? 'badge-success' : camp.status === 'SENDING' ? 'badge-warning' : 'badge-info'
                        }`}
                        style={{ borderRadius: '9999px', padding: '4px 12px', fontSize: '11px' }}
                      >
                        {camp.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '13.5px', fontVariantNumeric: 'tabular-nums' }}>
                        {camp.delivered_count} / {camp.recipients_count}
                      </div>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>
                        {camp.read_count} reads ({camp.recipients_count > 0 ? Math.round((camp.read_count / camp.recipients_count) * 100) : 0}%)
                      </span>
                    </td>
                    <td style={{ fontWeight: 550, color: 'var(--text-main)', fontSize: '13.5px', fontVariantNumeric: 'tabular-nums' }}>
                      ₹{camp.actual_cost.toFixed(2)}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--success)', fontSize: '13.5px', fontVariantNumeric: 'tabular-nums' }}>
                      ₹{camp.attributed_revenue.toLocaleString()}
                    </td>
                    <td style={{ color: 'var(--text-dim)', fontSize: '12px' }}>
                      {camp.scheduled_at ? `⏰ Scheduled: ${new Date(camp.scheduled_at).toLocaleDateString()}` : new Date(camp.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ padding: '60px', textAlign: 'center', color: 'var(--text-dim)' }}>
                    No campaigns dispatched yet. Click "Create Campaign" to broadcast your first WhatsApp offer.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Production 4-Step Campaign Creation Wizard & Safety Modal */}
      {showWizard && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="modal-content" style={{ maxWidth: '580px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            {/* Wizard Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Step {wizardStep} of 4
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  {wizardStep === 1 && 'Campaign Name & Timing'}
                  {wizardStep === 2 && 'Select Audience Target'}
                  {wizardStep === 3 && 'Choose WhatsApp Template'}
                  {wizardStep === 4 && 'Wallet Safety & Launch Confirmation'}
                </h3>
              </div>
              <button onClick={() => setShowWizard(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Step 1: Campaign Name & Schedule */}
            {wizardStep === 1 && (
              <div>
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Campaign Name *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Weekend Double Points Fest"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)', marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isScheduled}
                      onChange={(e) => setIsScheduled(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                    />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      Schedule for later (Automatic background dispatch)
                    </span>
                  </label>

                  {isScheduled && (
                    <div style={{ marginTop: '12px' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Dispatch Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        className="form-input"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        required={isScheduled}
                      />
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    disabled={!campaignName}
                    onClick={() => setWizardStep(2)}
                    className="btn btn-primary"
                  >
                    Next: Target Audience
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Audience */}
            {wizardStep === 2 && (
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Select customer group to target:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                  <div
                    onClick={() => setSelectedSegmentId('')}
                    style={{
                      padding: '14px',
                      borderRadius: '8px',
                      border: `1px solid ${selectedSegmentId === '' ? 'var(--primary)' : 'var(--border-subtle)'}`,
                      backgroundColor: selectedSegmentId === '' ? 'var(--primary-bg)' : 'rgba(255, 255, 255, 0.02)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>All Reachable Customers</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Customers who opted in for WhatsApp notifications</span>
                    </div>
                    {selectedSegmentId === '' && <CheckCircle2 size={18} color="var(--primary)" />}
                  </div>

                  {segments.map((seg) => (
                    <div
                      key={seg.id}
                      onClick={() => setSelectedSegmentId(seg.id)}
                      style={{
                        padding: '14px',
                        borderRadius: '8px',
                        border: `1px solid ${selectedSegmentId === seg.id ? 'var(--primary)' : 'var(--border-subtle)'}`,
                        backgroundColor: selectedSegmentId === seg.id ? 'var(--primary-bg)' : 'rgba(255, 255, 255, 0.02)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{seg.name}</div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{seg.cached_count} matched members</span>
                      </div>
                      {selectedSegmentId === seg.id && <CheckCircle2 size={18} color="var(--primary)" />}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button type="button" onClick={() => setWizardStep(1)} className="btn btn-secondary">
                    <ChevronLeft size={16} /> Back
                  </button>
                  <button type="button" onClick={() => setWizardStep(3)} className="btn btn-primary">
                    Next: WhatsApp Template <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Template */}
            {wizardStep === 3 && (
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Choose Meta-approved template for broadcast:
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto', marginBottom: '24px' }}>
                  {templates.map((tpl) => (
                    <div
                      key={tpl.id}
                      onClick={() => setSelectedTemplateId(tpl.id)}
                      style={{
                        padding: '14px',
                        borderRadius: '8px',
                        border: `1px solid ${selectedTemplateId === tpl.id ? 'var(--primary)' : 'var(--border-subtle)'}`,
                        backgroundColor: selectedTemplateId === tpl.id ? 'var(--primary-bg)' : 'rgba(255, 255, 255, 0.02)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem' }}>{tpl.name}</div>
                        <span className="badge badge-success">{tpl.category}</span>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'pre-line' }}>{tpl.body_text}</p>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button type="button" onClick={() => setWizardStep(2)} className="btn btn-secondary">
                    <ChevronLeft size={16} /> Back
                  </button>
                  <button type="button" onClick={handleNextToEstimate} className="btn btn-primary">
                    Next: Wallet Estimate <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Safety & Wallet Estimate Confirmation Modal (Section 33 of Plan) */}
            {wizardStep === 4 && estimateData && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#FBBF24' }}>
                  <ShieldAlert size={20} />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Campaign Safety Confirmation</span>
                </div>

                <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Review audience and estimated wallet balance deduction before final dispatch.
                </p>

                <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--border-subtle)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-dim)' }}>Campaign:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{campaignName}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-dim)' }}>Reachable Recipients:</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{estimateData.recipients_count} customers</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-dim)' }}>Estimated Cost:</span>
                    <span style={{ fontWeight: 700, color: '#F87171' }}>₹{estimateData.estimated_cost.toFixed(2)}</span>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-dim)' }}>Wallet Available:</span>
                    <span style={{ fontWeight: 700, color: 'var(--success)' }}>₹{estimateData.wallet_available.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-dim)' }}>Balance Remaining After Send:</span>
                    <span style={{ fontWeight: 700, color: (estimateData.wallet_available - estimateData.estimated_cost) >= 0 ? '#10B981' : '#EF4444' }}>
                      ₹{(estimateData.wallet_available - estimateData.estimated_cost).toFixed(2)}
                    </span>
                  </div>
                </div>

                {!estimateData.can_afford && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '12px', borderRadius: '8px', marginBottom: '20px', color: '#F87171', fontSize: '0.825rem' }}>
                    <AlertTriangle size={18} />
                    Insufficient available wallet balance. Top up your messaging wallet to proceed.
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button type="button" onClick={() => setWizardStep(3)} className="btn btn-secondary">
                    <ChevronLeft size={16} /> Back
                  </button>
                  <button
                    type="button"
                    disabled={!estimateData.can_afford || sending}
                    onClick={handleLaunchCampaign}
                    className="btn btn-whatsapp"
                  >
                    <Send size={15} />
                    {sending ? 'Dispatching...' : isScheduled ? 'Confirm & Schedule' : 'Confirm & Send Now'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
