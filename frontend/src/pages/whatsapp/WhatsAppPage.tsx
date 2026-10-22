import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Phone,
  ShieldCheck,
  Download,
  Globe,
  Send as SendIcon
} from 'lucide-react';
import { apiRequest, apiDownload } from '../../api/client';
import { WhatsAppConnection, WhatsAppTemplate, WhatsAppMessage, MessagePricing } from '../../types';
import { StatCard } from '../../components/ui';
import { alertError, alertSuccess, alertWarning, confirmAction } from '../../utils/alert';

export const WhatsAppPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'connection' | 'templates' | 'logs' | 'pricing'>('connection');
  const [connection, setConnection] = useState<WhatsAppConnection | null>(null);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [pricingRules, setPricingRules] = useState<MessagePricing[]>([]);
  const [loading, setLoading] = useState(true);

  // Connect Account Form
  const [connectPhone, setConnectPhone] = useState('+91 98765 43210');
  const [connectName, setConnectName] = useState('HelloPets');
  const [connectWabaId, setConnectWabaId] = useState('');
  const [connectPhoneId, setConnectPhoneId] = useState('');
  const [connectToken, setConnectToken] = useState('');
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncingTemplates, setSyncingTemplates] = useState(false);
  const [embeddedLoading, setEmbeddedLoading] = useState(false);

  const launchEmbeddedSignup = async () => {
    try {
      setEmbeddedLoading(true);
      const config = await apiRequest<{ app_id: string; config_id: string; graph_version: string }>('/whatsapp/embedded-signup/config');
      
      if (!config.app_id || config.app_id.includes('mock') || !config.config_id) {
        const proceedMock = await confirmAction(
          'Simulate Meta Embedded Signup?',
          `Meta App ID: ${config.app_id}\nConfig ID: ${config.config_id || 'Not set'}\n\nSimulate a successful authorization callback to test the live handshake?`,
          'Simulate'
        );
        if (proceedMock) {
          const res = await apiRequest<WhatsAppConnection>('/whatsapp/embedded-signup/callback', {
            method: 'POST',
            body: JSON.stringify({
              code: 'AQ_TEST_EMBEDDED_SIGNUP_AUTH_CODE_' + Date.now(),
              waba_id: '109827364512345',
              phone_number_id: '102938475610293',
              display_phone_number: '+91 98765 43210',
              verified_name: connectName || 'HelloPets'
            })
          });
          setConnection(res);
          alertSuccess('Meta Embedded Signup handshake succeeded! Account registered and connected.');
          fetchData();
        }
        return;
      }

      // Initialize Facebook SDK if not already loaded
      if (!(window as any).FB) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://connect.facebook.net/en_US/sdk.js';
          script.async = true;
          script.defer = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Facebook SDK'));
          document.body.appendChild(script);
        });
      }

      const FB = (window as any).FB;
      FB.init({
        appId: config.app_id,
        autoLogAppEvents: true,
        xfbml: true,
        version: config.graph_version || 'v22.0'
      });

      // Capture session info from postMessage
      let sessionData: any = {};
      const messageListener = (event: MessageEvent) => {
        if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') return;
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data.type === 'WA_EMBEDDED_SIGNUP') {
            sessionData = data.data || {};
          }
        } catch (e) {}
      };
      window.addEventListener('message', messageListener);

      FB.login((response: any) => {
        window.removeEventListener('message', messageListener);
        if (response.authResponse?.code) {
          apiRequest<WhatsAppConnection>('/whatsapp/embedded-signup/callback', {
            method: 'POST',
            body: JSON.stringify({
              code: response.authResponse.code,
              waba_id: sessionData.waba_id || '',
              phone_number_id: sessionData.phone_number_id || '',
              display_phone_number: sessionData.display_phone_number || undefined,
              verified_name: sessionData.verified_name || undefined
            })
          }).then((res) => {
            setConnection(res);
            alertSuccess('Meta Embedded Signup completed successfully!');
            fetchData();
          }).catch((err) => {
            alertError(err.message || 'Error finishing Embedded Signup exchange');
          });
        }
      }, {
        config_id: config.config_id,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          sessionInfoVersion: '3'
        }
      });
    } catch (err: any) {
      alertError(err.message || 'Embedded signup failed');
    } finally {
      setEmbeddedLoading(false);
    }
  };

  // Message Delivery Logs pagination (10 per page)
  const LOG_PAGE_SIZE = 10;
  const [logPage, setLogPage] = useState(0);
  const logTotalPages = Math.max(1, Math.ceil(messages.length / LOG_PAGE_SIZE));
  const safeLogPage = Math.min(logPage, logTotalPages - 1);
  const pagedMessages = messages.slice(safeLogPage * LOG_PAGE_SIZE, safeLogPage * LOG_PAGE_SIZE + LOG_PAGE_SIZE);

  // Per-template test send
  const [testTemplateId, setTestTemplateId] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState('+91 ');
  const [testingTemplate, setTestingTemplate] = useState<string | null>(null);

  const handleTestTemplate = async (templateId: string) => {
    const phoneClean = testPhone.replace(/\s|-/g, '');
    if (phoneClean.length < 10) { alertWarning('Please enter a valid WhatsApp number.'); return; }
    setTestingTemplate(templateId);
    try {
      const msg = await apiRequest<{ status: string; failure_reason?: string }>('/whatsapp/send-test', {
        method: 'POST',
        body: JSON.stringify({ phone: phoneClean, template_id: templateId }),
      });
      if (msg.status === 'FAILED') {
        alertError(`Test failed: ${msg.failure_reason || 'Meta rejected the message'}`);
      } else {
        alertSuccess('Test message dispatched! Check the customer\'s WhatsApp.');
        setTestTemplateId(null);
      }
      fetchData();
    } catch (err: any) {
      alertError(err.message || 'Error sending test message');
    } finally {
      setTestingTemplate(null);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [connData, tplData, msgData, priceData] = await Promise.all([
        apiRequest<WhatsAppConnection>('/whatsapp/connection'),
        apiRequest<WhatsAppTemplate[]>('/whatsapp/templates'),
        apiRequest<WhatsAppMessage[]>('/whatsapp/messages'),
        apiRequest<MessagePricing[]>('/whatsapp/pricing'),
      ]);
      setConnection(connData);
      setTemplates(tplData);
      setMessages(msgData);
      setPricingRules(priceData);
      setIsLiveMode(connData.is_live_mode || false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    try {
      const updated = await apiRequest<WhatsAppConnection>('/whatsapp/connect', {
        method: 'POST',
        body: JSON.stringify({
          display_phone_number: connectPhone,
          verified_name: connectName,
          waba_id: connectWabaId || undefined,
          phone_number_id: connectPhoneId || undefined,
          access_token: connectToken || undefined,
          is_live_mode: isLiveMode,
        }),
      });
      setConnection(updated);
      alertSuccess(isLiveMode ? 'Meta WhatsApp Cloud API v22.0 Connected (Live Mode)!' : 'Sandbox Test Connection Activated!');
      fetchData();
    } catch (err: any) {
      alertError(err.message || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleSyncTemplates = async () => {
    setSyncingTemplates(true);
    try {
      const res = await apiRequest('/whatsapp/templates/sync', { method: 'POST' });
      alertSuccess(`Synchronized ${res.synced_count} templates from Meta WABA!`);
      fetchData();
    } catch (err: any) {
      alertError(err.message || 'Failed to sync templates from Meta');
    } finally {
      setSyncingTemplates(false);
    }
  };

  const handleExportLogs = async () => {
    try {
      await apiDownload('/whatsapp/export', 'whatsapp_message_logs.csv');
    } catch (err: any) {
      alertError(err.message || 'Export failed');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 className="page-title">
            WhatsApp Cloud API
          </h1>
          <span className={`badge ${connection?.is_live_mode ? 'badge-whatsapp' : 'badge-info'}`}>
            {connection?.is_live_mode ? 'Meta Live v22.0' : 'Sandbox Simulated'}
          </span>
        </div>
        <p className="page-subtitle">
          Official Meta Cloud API integration, template library and webhook event monitoring.
        </p>
      </div>

      {/* Dashboard-Style Stat Cards Row (WhatsApp Pastel Palette) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
        <StatCard
          label="Meta Cloud Handshake"
          value={connection?.connection_status === 'CONNECTED' ? 'Active & Live' : 'Ready to Link'}
          delta={connection?.is_live_mode ? 'Graph API v22.0 Connected' : 'Sandbox Demo Mode'}
          tone="mint-ice"
          icon={<Globe size={18} />}
        />
        <StatCard
          label="Meta Verified Identity"
          value={connection?.verified_name || connectName}
          delta={connection?.display_phone_number || connectPhone}
          tone="sky-aqua"
          icon={<ShieldCheck size={18} />}
        />
      </div>

      {/* Tabs */}
      <div className="subnav-tabs">
        <button
          onClick={() => setActiveTab('connection')}
          className={`subnav-tab ${activeTab === 'connection' ? 'active' : ''}`}
        >
          Connection & Onboarding
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`subnav-tab ${activeTab === 'templates' ? 'active' : ''}`}
        >
          Templates Catalog ({templates.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`subnav-tab ${activeTab === 'logs' ? 'active' : ''}`}
        >
          Message Delivery Logs ({messages.length})
        </button>
        <button
          onClick={() => setActiveTab('pricing')}
          className={`subnav-tab ${activeTab === 'pricing' ? 'active' : ''}`}
        >
          Meta Pricing & Rates
        </button>
      </div>

      {/* Tab 1: Connection & Meta Embedded Signup */}
      {activeTab === 'connection' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '24px' }}>
          {/* Status Box / Meta Onboarding Card */}
          {connection?.connection_status === 'CONNECTED' ? (
            <div className="card" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 10px #10B981' }} />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 600, letterSpacing: '-0.3px' }}>Connected Meta Cloud WABA</h3>
                </div>
                <span className="badge badge-whatsapp">
                  CONNECTED
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-surface)', padding: '16px 20px', borderRadius: '20px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 6px 18px rgba(16, 185, 129, 0.25)' }}>
                    <Phone size={24} color="#ffffff" />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '-0.3px' }}>{connection.verified_name}</h4>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{connection.display_phone_number}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '6px' }}>
                  <div className="meta-pill-chip">
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Gateway Engine</span>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: connection.is_live_mode ? '#10B981' : 'var(--primary)' }}>
                      {connection.is_live_mode ? 'Live Meta Cloud API v22' : 'Sandbox Simulated'}
                    </p>
                  </div>
                  <div className="meta-pill-chip">
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Quality Rating</span>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#10B981' }}>High (Meta Verified)</p>
                  </div>
                  <div className="meta-pill-chip">
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>WABA ID</span>
                    <p style={{ fontSize: '0.825rem', fontFamily: 'monospace', color: 'var(--text-main)' }}>{connection.waba_id}</p>
                  </div>
                  <div className="meta-pill-chip">
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone ID</span>
                    <p style={{ fontSize: '0.825rem', fontFamily: 'monospace', color: 'var(--text-main)' }}>{connection.phone_number_id}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="meta-hero-card">
              {/* Meta Embedded Signup Official 1-Click */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '13px', background: '#0064e0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 6px 18px rgba(0, 100, 224, 0.28)' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.15rem', fontWeight: 600, letterSpacing: '-0.3px', color: 'var(--text-main)' }}>Official Meta Embedded Signup</h4>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Fastest & Official Partner Onboarding (v22.0)</span>
                  </div>
                </div>
                <span className="badge badge-primary" style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '9999px' }}>
                  Recommended
                </span>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '18px', lineHeight: '1.5' }}>
                Login directly via Meta OAuth. Grants automatic permissions, links your WABA and phone number, and configures webhooks with 0 manual token management.
              </p>

              {/* Feature micro-chips */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <span style={{ fontSize: '11px', background: 'var(--bg-surface)', padding: '5px 12px', borderRadius: '9999px', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  ⚡ 1-Click Fast Handshake
                </span>
                <span style={{ fontSize: '11px', background: 'var(--bg-surface)', padding: '5px 12px', borderRadius: '9999px', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  🛡️ Meta Cloud API v22.0
                </span>
                <span style={{ fontSize: '11px', background: 'var(--bg-surface)', padding: '5px 12px', borderRadius: '9999px', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  🔒 Zero-Config Webhooks
                </span>
              </div>

              <button
                type="button"
                onClick={launchEmbeddedSignup}
                disabled={embeddedLoading}
                className="btn btn-meta"
                style={{ width: '100%', padding: '14px 24px', fontSize: '0.92rem', justifyContent: 'center' }}
              >
                <Globe size={18} />
                {embeddedLoading ? 'Launching Meta Popup...' : 'Continue with Facebook (1-Click Meta Signup)'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0 16px' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Or Sandbox / Manual Configuration</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
              </div>

              <form onSubmit={handleConnect}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label className="form-label">Business Name</label>
                    <input type="text" className="form-input" style={{ borderRadius: '12px' }} value={connectName} onChange={(e) => setConnectName(e.target.value)} required />
                  </div>
                  <div>
                    <label className="form-label">WhatsApp Phone</label>
                    <input type="text" className="form-input" style={{ borderRadius: '12px' }} value={connectPhone} onChange={(e) => setConnectPhone(e.target.value)} required />
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-surface)', padding: '14px 18px', borderRadius: '16px', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: isLiveMode ? '12px' : '0' }}>
                    <input type="checkbox" checked={isLiveMode} onChange={(e) => setIsLiveMode(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Use Live Production Meta Cloud API (v22.0)</span>
                  </label>

                  {isLiveMode && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '2px' }}>Meta WABA ID (Optional)</label>
                        <input type="text" className="form-input" style={{ borderRadius: '10px' }} placeholder="e.g. 1092837465..." value={connectWabaId} onChange={(e) => setConnectWabaId(e.target.value)} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '2px' }}>Phone Number ID (Optional)</label>
                        <input type="text" className="form-input" style={{ borderRadius: '10px' }} placeholder="e.g. 1092837465..." value={connectPhoneId} onChange={(e) => setConnectPhoneId(e.target.value)} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '2px' }}>System User Access Token</label>
                        <input type="password" className="form-input" style={{ borderRadius: '10px' }} placeholder="EAA..." value={connectToken} onChange={(e) => setConnectToken(e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>

                <button type="submit" disabled={connecting} className="btn btn-dark-pill" style={{ width: '100%', padding: '12px' }}>
                  {connecting ? 'Connecting...' : isLiveMode ? 'Connect Live Meta WABA' : 'Quick Connect Sandbox Demo'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Templates Catalog */}
      {activeTab === 'templates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Meta-approved message templates provisioned for automated customer loyalty notifications and broadcasts.
            </p>
            <button onClick={handleSyncTemplates} disabled={syncingTemplates} className="btn btn-secondary btn-sm" style={{ gap: 6 }}>
              <RefreshCw size={13} className={syncingTemplates ? 'spin' : ''} />
              {syncingTemplates ? 'Syncing...' : 'Sync from Meta WABA'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {templates.map((tpl) => (
              <div key={tpl.id} className="card card-interactive" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRadius: '24px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '1.02rem', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '-0.3px' }}>{tpl.name}</h4>
                    <span className="badge badge-success" style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '9999px' }}>{tpl.status}</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '14px', letterSpacing: '0.5px' }}>
                    {tpl.category} • {tpl.language}
                  </span>

                  <div style={{ backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-subtle)', marginBottom: '18px' }}>
                    {tpl.header_text && <p style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem', marginBottom: '6px' }}>{tpl.header_text}</p>}
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', whiteSpace: 'pre-line', lineHeight: 1.5 }}>{tpl.body_text}</p>
                    {tpl.footer_text && <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '8px' }}>{tpl.footer_text}</p>}
                  </div>

                  {testTemplateId === tpl.id && (
                    <form
                      onSubmit={(e) => { e.preventDefault(); handleTestTemplate(tpl.id); }}
                      style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}
                    >
                      <input
                        type="tel"
                        className="form-input"
                        placeholder="+91 98765 43210"
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                        autoFocus
                        style={{ borderRadius: '10px', flex: 1, padding: '7px 12px', fontSize: '0.8rem' }}
                      />
                      <button
                        type="submit"
                        disabled={testingTemplate === tpl.id}
                        className="btn btn-whatsapp"
                        style={{ padding: '7px 14px', fontSize: '0.78rem', flexShrink: 0 }}
                      >
                        <SendIcon size={13} />
                        {testingTemplate === tpl.id ? 'Sending...' : 'Send Test'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setTestTemplateId(null)}
                        className="btn btn-secondary"
                        style={{ padding: '7px 12px', fontSize: '0.78rem' }}
                      >
                        Cancel
                      </button>
                    </form>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setTestTemplateId(testTemplateId === tpl.id ? null : tpl.id)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '6px 16px', fontSize: '0.75rem' }}
                  >
                    <SendIcon size={12} />
                    Test Template
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Message Delivery Logs */}
      {activeTab === 'logs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Real-time delivery status updates streamed via Meta Webhook callbacks.
            </p>
            <button onClick={handleExportLogs} className="btn btn-secondary">
              <Download size={14} />
              Export Message Logs CSV
            </button>
          </div>

          <div className="table-card">
            <div style={{ overflowX: 'auto' }}>
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>Direction</th>
                    <th>Recipient Mobile</th>
                    <th>Type</th>
                    <th>Webhook Status</th>
                    <th>Cost</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedMessages.length > 0 ? (
                    pagedMessages.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <span
                            className={`badge ${m.direction === 'INBOUND' ? 'badge-primary' : 'badge-info'}`}
                            style={{ borderRadius: '9999px', padding: '4px 12px', fontSize: '11px' }}
                          >
                            {m.direction || 'OUTBOUND'}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', color: 'var(--text-main)', fontSize: '13px' }}>
                          {m.recipient_phone}
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{m.message_type}</td>
                        <td>
                          <span
                            className={`badge ${m.status === 'DELIVERED' || m.status === 'READ' ? 'badge-whatsapp' : m.status === 'FAILED' ? 'badge-danger' : 'badge-warning'}`}
                            style={{ borderRadius: '9999px', padding: '4px 12px', fontSize: '11px' }}
                          >
                            {m.status}
                          </span>
                          {m.failure_reason && <span style={{ display: 'block', fontSize: '11px', color: '#F87171', marginTop: '4px' }}>{m.failure_reason}</span>}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '13.5px', fontVariantNumeric: 'tabular-nums' }}>
                          ₹{m.cost.toFixed(2)}
                        </td>
                        <td style={{ color: 'var(--text-dim)', fontSize: '12px' }}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-dim)' }}>
                        No WhatsApp messages sent yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {messages.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Showing {safeLogPage * LOG_PAGE_SIZE + 1}-{Math.min((safeLogPage + 1) * LOG_PAGE_SIZE, messages.length)} of {messages.length} messages
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => setLogPage(Math.max(0, safeLogPage - 1))}
                    disabled={safeLogPage === 0}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                  >
                    Previous
                  </button>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 600 }}>
                    Page {safeLogPage + 1} of {logTotalPages}
                  </span>
                  <button
                    onClick={() => setLogPage(Math.min(logTotalPages - 1, safeLogPage + 1))}
                    disabled={safeLogPage >= logTotalPages - 1}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Dynamic Pricing & Meta Rates */}
      {activeTab === 'pricing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Transparent conversation rate card governed by country and Meta category definitions.
          </p>

          <div className="table-card">
            <div style={{ overflowX: 'auto' }}>
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>Country</th>
                    <th>Category</th>
                    <th>Meta Base Cost</th>
                    <th>SaaS Platform Margin</th>
                    <th>Final Merchant Price</th>
                  </tr>
                </thead>
                <tbody>
                  {pricingRules.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '13.5px' }}>
                        {p.country === '*' ? 'International (Global)' : p.country}
                      </td>
                      <td>
                        <span
                          className={`badge ${p.category === 'MARKETING' ? 'badge-primary' : p.category === 'UTILITY' ? 'badge-success' : 'badge-info'}`}
                          style={{ borderRadius: '9999px', padding: '4px 12px', fontSize: '11px' }}
                        >
                          {p.category}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '13.5px', fontVariantNumeric: 'tabular-nums' }}>
                        {p.currency === 'INR' ? '₹' : '$'}{p.meta_cost.toFixed(3)}
                      </td>
                      <td style={{ color: 'var(--text-dim)', fontSize: '13.5px', fontVariantNumeric: 'tabular-nums' }}>
                        +{p.currency === 'INR' ? '₹' : '$'}{p.markup_margin.toFixed(3)}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '14px', fontVariantNumeric: 'tabular-nums' }}>
                        {p.currency === 'INR' ? '₹' : '$'}{p.total_price.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
