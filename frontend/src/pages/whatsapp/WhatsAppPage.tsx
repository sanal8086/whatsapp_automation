import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Wallet as WalletIcon,
  CheckCircle2,
  AlertCircle,
  Send,
  PlusCircle,
  RefreshCw,
  Phone,
  ShieldCheck,
  FileText,
  Clock,
  X,
  Download,
  DollarSign,
  Activity,
  Globe
} from 'lucide-react';
import { apiRequest, apiDownload } from '../../api/client';
import { WhatsAppConnection, WhatsAppTemplate, WhatsAppMessage, Wallet as WalletType, WalletTransaction, MessagePricing } from '../../types';

export const WhatsAppPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'connection' | 'templates' | 'wallet' | 'logs' | 'pricing'>('connection');
  const [connection, setConnection] = useState<WhatsAppConnection | null>(null);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [walletTxns, setWalletTxns] = useState<WalletTransaction[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [pricingRules, setPricingRules] = useState<MessagePricing[]>([]);
  const [loading, setLoading] = useState(true);

  // Connect Account Form
  const [connectPhone, setConnectPhone] = useState('+91 98765 43210');
  const [connectName, setConnectName] = useState('Brew & Bite Artisan Cafe');
  const [connectWabaId, setConnectWabaId] = useState('');
  const [connectPhoneId, setConnectPhoneId] = useState('');
  const [connectToken, setConnectToken] = useState('');
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncingTemplates, setSyncingTemplates] = useState(false);

  // Test Message
  const [testPhone, setTestPhone] = useState('+91 98111 00001');
  const [testText, setTestText] = useState('Hello from your loyalty rewards club! Your points balance is 420.');
  const [sendingTest, setSendingTest] = useState(false);

  // Topup
  const [topupAmt, setTopupAmt] = useState('500');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [connData, tplData, walData, txnData, msgData, priceData] = await Promise.all([
        apiRequest<WhatsAppConnection>('/whatsapp/connection'),
        apiRequest<WhatsAppTemplate[]>('/whatsapp/templates'),
        apiRequest<WalletType>('/wallet'),
        apiRequest<WalletTransaction[]>('/wallet/transactions'),
        apiRequest<WhatsAppMessage[]>('/whatsapp/messages'),
        apiRequest<MessagePricing[]>('/whatsapp/pricing'),
      ]);
      setConnection(connData);
      setTemplates(tplData);
      setWallet(walData);
      setWalletTxns(txnData);
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
      alert(isLiveMode ? 'Meta WhatsApp Cloud API v22.0 Connected (Live Mode)!' : 'Sandbox Test Connection Activated!');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect WhatsApp?')) return;
    try {
      const updated = await apiRequest<WhatsAppConnection>('/whatsapp/disconnect', { method: 'POST' });
      setConnection(updated);
    } catch (err: any) {
      alert(err.message || 'Error disconnecting');
    }
  };

  const handleSyncTemplates = async () => {
    setSyncingTemplates(true);
    try {
      const res = await apiRequest('/whatsapp/templates/sync', { method: 'POST' });
      alert(`Synchronized ${res.synced_count} templates from Meta WABA!`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to sync templates from Meta');
    } finally {
      setSyncingTemplates(false);
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingTest(true);
    try {
      await apiRequest('/whatsapp/send-test', {
        method: 'POST',
        body: JSON.stringify({
          phone: testPhone,
          custom_text: testText,
        }),
      });
      alert('Test message dispatched successfully!');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error sending test message');
    } finally {
      setSendingTest(false);
    }
  };

  const handleTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await apiRequest<WalletType>('/wallet/topup-demo', {
        method: 'POST',
        body: JSON.stringify({ amount: parseFloat(topupAmt) }),
      });
      setWallet(updated);
      const txns = await apiRequest<WalletTransaction[]>('/wallet/transactions');
      setWalletTxns(txns);
      alert(`Top-up of ₹${topupAmt} added to your messaging wallet!`);
    } catch (err: any) {
      alert(err.message || 'Top-up error');
    }
  };

  const handleExportLogs = async () => {
    try {
      await apiDownload('/whatsapp/export', 'whatsapp_message_logs.csv');
    } catch (err: any) {
      alert(err.message || 'Export failed');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
              WhatsApp Cloud API & Messaging Wallet
            </h2>
            <span className={`badge ${connection?.is_live_mode ? 'badge-whatsapp' : 'badge-info'}`}>
              {connection?.is_live_mode ? 'Meta Live v22.0' : 'Sandbox Simulated'}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
            Official Meta Cloud API integration, template library, webhook event monitoring & prepaid credit ledger.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <WalletIcon size={16} color="var(--primary)" />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Wallet:</span>
            <span style={{ fontWeight: 800, color: '#fff' }}>₹{wallet?.balance.toFixed(2) || '0.00'}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', gap: '24px', overflowX: 'auto' }}>
        <button
          onClick={() => setActiveTab('connection')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'connection' ? '2px solid var(--primary)' : '2px solid transparent',
            padding: '12px 4px',
            color: activeTab === 'connection' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          Connection & Onboarding
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'templates' ? '2px solid var(--primary)' : '2px solid transparent',
            padding: '12px 4px',
            color: activeTab === 'templates' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          Templates Catalog ({templates.length})
        </button>
        <button
          onClick={() => setActiveTab('wallet')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'wallet' ? '2px solid var(--primary)' : '2px solid transparent',
            padding: '12px 4px',
            color: activeTab === 'wallet' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          Prepaid Wallet & Ledger
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'logs' ? '2px solid var(--primary)' : '2px solid transparent',
            padding: '12px 4px',
            color: activeTab === 'logs' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          Message Delivery Logs ({messages.length})
        </button>
        <button
          onClick={() => setActiveTab('pricing')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'pricing' ? '2px solid var(--primary)' : '2px solid transparent',
            padding: '12px 4px',
            color: activeTab === 'pricing' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          Meta Pricing & Rates
        </button>
      </div>

      {/* Tab 1: Connection & Meta Embedded Signup */}
      {activeTab === 'connection' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
          {/* Status Box */}
          <div className="glass-panel" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>WhatsApp Business Account</h3>
              <span className={`badge ${connection?.connection_status === 'CONNECTED' ? 'badge-whatsapp' : 'badge-warning'}`}>
                {connection?.connection_status}
              </span>
            </div>

            {connection?.connection_status === 'CONNECTED' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--whatsapp-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Phone size={24} color="#25D366" />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>{connection.verified_name}</h4>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{connection.display_phone_number}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px', backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Mode</span>
                    <p style={{ fontSize: '0.825rem', fontWeight: 700, color: connection.is_live_mode ? '#10B981' : 'var(--primary)' }}>
                      {connection.is_live_mode ? 'Live Meta Cloud API v22' : 'Sandbox Simulated'}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>WABA ID</span>
                    <p style={{ fontSize: '0.825rem', fontFamily: 'monospace', color: 'var(--text-main)' }}>{connection.waba_id}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Phone Number ID</span>
                    <p style={{ fontSize: '0.825rem', fontFamily: 'monospace', color: 'var(--text-main)' }}>{connection.phone_number_id}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Quality Rating</span>
                    <p style={{ fontSize: '0.825rem', fontWeight: 700, color: '#10B981' }}>High (Green)</p>
                  </div>
                </div>

                <div style={{ marginTop: '14px', display: 'flex', gap: '10px' }}>
                  <button onClick={handleDisconnect} className="btn btn-secondary" style={{ color: 'var(--danger)' }}>
                    Disconnect Account
                  </button>
                  <button onClick={() => { setIsLiveMode(!isLiveMode); }} className="btn btn-secondary">
                    Switch to {connection.is_live_mode ? 'Sandbox Mode' : 'Live Mode'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConnect}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
                  Connect your business phone number to Meta WhatsApp Cloud API. Supports both Live production credentials and Instant Sandbox testing.
                </p>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Verified Business Name</label>
                  <input type="text" className="form-input" value={connectName} onChange={(e) => setConnectName(e.target.value)} required />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>WhatsApp Phone Number</label>
                  <input type="text" className="form-input" value={connectPhone} onChange={(e) => setConnectPhone(e.target.value)} required />
                </div>

                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: isLiveMode ? '12px' : '0' }}>
                    <input type="checkbox" checked={isLiveMode} onChange={(e) => setIsLiveMode(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--whatsapp)' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>Use Live Meta Cloud API (v22.0)</span>
                  </label>

                  {isLiveMode && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '2px' }}>Meta WABA ID (Optional)</label>
                        <input type="text" className="form-input" placeholder="e.g. 1092837465..." value={connectWabaId} onChange={(e) => setConnectWabaId(e.target.value)} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '2px' }}>Phone Number ID (Optional)</label>
                        <input type="text" className="form-input" placeholder="e.g. 1092837465..." value={connectPhoneId} onChange={(e) => setConnectPhoneId(e.target.value)} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '2px' }}>System User Access Token (Encrypted at rest)</label>
                        <input type="password" className="form-input" placeholder="EAA..." value={connectToken} onChange={(e) => setConnectToken(e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>

                <button type="submit" disabled={connecting} className="btn btn-whatsapp" style={{ width: '100%' }}>
                  {connecting ? 'Connecting...' : isLiveMode ? 'Connect Live Meta WABA' : 'Quick Connect Sandbox Demo'}
                </button>
              </form>
            )}
          </div>

          {/* Test Message Box */}
          <div className="glass-panel" style={{ padding: '28px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>Send Test Message</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
              Verify connectivity by sending a real-time message to any WhatsApp mobile number.
            </p>
            <form onSubmit={handleSendTest}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Recipient Mobile Number</label>
                <input type="tel" className="form-input" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} required />
              </div>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Test Message Content</label>
                <textarea className="form-input" rows={3} value={testText} onChange={(e) => setTestText(e.target.value)} required />
              </div>
              <button type="submit" disabled={sendingTest} className="btn btn-whatsapp">
                <Send size={15} />
                {sendingTest ? 'Sending...' : 'Send Test WhatsApp'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 2: Templates Catalog */}
      {activeTab === 'templates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Meta-approved message templates provisioned for automated customer loyalty notifications and broadcasts.
            </p>
            <button onClick={handleSyncTemplates} disabled={syncingTemplates} className="btn btn-secondary">
              <RefreshCw size={14} className={syncingTemplates ? 'spin' : ''} />
              {syncingTemplates ? 'Syncing...' : 'Sync from Meta WABA'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {templates.map((tpl) => (
              <div key={tpl.id} className="glass-card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>{tpl.name}</h4>
                    <span className="badge badge-success">{tpl.status}</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
                    {tpl.category} • {tpl.language}
                  </span>

                  <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.25)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
                    {tpl.header_text && <p style={{ fontWeight: 700, color: '#fff', fontSize: '0.85rem', marginBottom: '6px' }}>{tpl.header_text}</p>}
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', whiteSpace: 'pre-line' }}>{tpl.body_text}</p>
                    {tpl.footer_text && <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '8px' }}>{tpl.footer_text}</p>}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      setTestText(tpl.body_text.replace('{{1}}', 'Friend').replace('{{2}}', '100').replace('{{3}}', 'Our Store'));
                      setActiveTab('connection');
                    }}
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                  >
                    Test Template
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Wallet */}
      {activeTab === 'wallet' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
            <div className="glass-panel" style={{ padding: '24px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Wallet Balance</span>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                ₹{wallet?.balance.toFixed(2)}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Reserved: ₹{wallet?.reserved_balance.toFixed(2)}</span>
            </div>

            <div className="glass-panel" style={{ padding: '24px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Available Credits</span>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--success)', marginTop: '4px' }}>
                ₹{wallet?.available_balance.toFixed(2)}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Safe to dispatch campaigns</span>
            </div>

            <div className="glass-panel" style={{ padding: '24px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Quick Top-Up Demo</span>
              <form onSubmit={handleTopup} style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <input type="number" className="form-input" style={{ width: '110px' }} value={topupAmt} onChange={(e) => setTopupAmt(e.target.value)} required />
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 14px' }}>
                  + Topup
                </button>
              </form>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 700 }}>
              Immutable Wallet Transactions Audit Trail
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '14px 18px' }}>Type</th>
                  <th style={{ padding: '14px 18px' }}>Amount</th>
                  <th style={{ padding: '14px 18px' }}>Balance After</th>
                  <th style={{ padding: '14px 18px' }}>Description</th>
                  <th style={{ padding: '14px 18px' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {walletTxns.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '14px 18px' }}>
                      <span className={`badge ${t.type === 'CREDIT' ? 'badge-success' : 'badge-danger'}`}>{t.type}</span>
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: t.type === 'CREDIT' ? 'var(--success)' : 'var(--danger)' }}>
                      {t.type === 'CREDIT' ? `+₹${t.amount.toFixed(2)}` : `-₹${t.amount.toFixed(2)}`}
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: 600 }}>₹{t.balance_after.toFixed(2)}</td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>{t.description}</td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-dim)', fontSize: '0.8rem' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Delivery Logs */}
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

          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '14px 18px' }}>Direction</th>
                  <th style={{ padding: '14px 18px' }}>Recipient Mobile</th>
                  <th style={{ padding: '14px 18px' }}>Type</th>
                  <th style={{ padding: '14px 18px' }}>Webhook Status</th>
                  <th style={{ padding: '14px 18px' }}>Cost</th>
                  <th style={{ padding: '14px 18px' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {messages.length > 0 ? (
                  messages.map((m) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '14px 18px' }}>
                        <span className={`badge ${m.direction === 'INBOUND' ? 'badge-primary' : 'badge-info'}`}>
                          {m.direction || 'OUTBOUND'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', fontFamily: 'monospace', color: 'var(--text-main)' }}>
                        {m.recipient_phone}
                      </td>
                      <td style={{ padding: '14px 18px' }}>{m.message_type}</td>
                      <td style={{ padding: '14px 18px' }}>
                        <span className={`badge ${m.status === 'DELIVERED' || m.status === 'READ' ? 'badge-whatsapp' : m.status === 'FAILED' ? 'badge-danger' : 'badge-warning'}`}>
                          {m.status}
                        </span>
                        {m.failure_reason && <span style={{ display: 'block', fontSize: '0.7rem', color: '#F87171', marginTop: '2px' }}>{m.failure_reason}</span>}
                      </td>
                      <td style={{ padding: '14px 18px', fontWeight: 600 }}>₹{m.cost.toFixed(2)}</td>
                      <td style={{ padding: '14px 18px', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-dim)' }}>
                      No WhatsApp messages sent yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Dynamic Pricing & Meta Rates */}
      {activeTab === 'pricing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Transparent conversation rate card governed by country and Meta category definitions.
          </p>

          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '16px 20px' }}>Country</th>
                  <th style={{ padding: '16px 20px' }}>Category</th>
                  <th style={{ padding: '16px 20px' }}>Meta Base Cost</th>
                  <th style={{ padding: '16px 20px' }}>SaaS Platform Margin</th>
                  <th style={{ padding: '16px 20px' }}>Final Merchant Price</th>
                </tr>
              </thead>
              <tbody>
                {pricingRules.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-main)' }}>
                      {p.country === '*' ? 'International (Global)' : p.country}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span className={`badge ${p.category === 'MARKETING' ? 'badge-primary' : p.category === 'UTILITY' ? 'badge-success' : 'badge-info'}`}>
                        {p.category}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', color: 'var(--text-muted)' }}>
                      {p.currency === 'INR' ? '₹' : '$'}{p.meta_cost.toFixed(3)}
                    </td>
                    <td style={{ padding: '14px 20px', color: 'var(--text-dim)' }}>
                      +{p.currency === 'INR' ? '₹' : '$'}{p.markup_margin.toFixed(3)}
                    </td>
                    <td style={{ padding: '14px 20px', fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                      {p.currency === 'INR' ? '₹' : '$'}{p.total_price.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
