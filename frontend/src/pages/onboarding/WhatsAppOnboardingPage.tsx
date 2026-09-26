import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, CheckCircle2, ArrowRight, Loader2, Phone, Building2, Shield, Zap } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

type Step = 'intro' | 'permissions' | 'phone-verify' | 'connecting' | 'success';

interface MockResult {
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string;
  verified_name: string;
  connection_status: string;
}

export const WhatsAppOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { tenant, login, token, user } = useAuth();
  const [step, setStep] = useState<Step>('intro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MockResult | null>(null);

  const startSignup = async () => {
    setLoading(true);
    setError(null);
    try {
      // Step 1: Start the session
      await apiRequest('/onboarding/whatsapp-signup/start', { method: 'POST' });
      setStep('permissions');
    } catch (err: any) {
      setError(err.message || 'Failed to start WhatsApp signup');
    } finally {
      setLoading(false);
    }
  };

  const grantPermissions = () => {
    setStep('phone-verify');
  };

  const verifyPhone = () => {
    setStep('connecting');
    // Simulate a 3s connection process
    setTimeout(async () => {
      try {
        const data = await apiRequest<{
          status: string;
          tenant_status: string;
          whatsapp: MockResult;
        }>('/onboarding/whatsapp-signup/complete', { method: 'POST' });

        setResult(data.whatsapp);
        setStep('success');

        // Update auth context with ACTIVE tenant
        if (token && user && tenant) {
          login(token, user, {
            ...tenant,
            status: data.tenant_status,
          });
        }
      } catch (err: any) {
        setError(err.message || 'WhatsApp connection failed');
        setStep('intro');
      }
    }, 3000);
  };

  const goToDashboard = () => {
    navigate('/app');
  };

  // Step configurations
  const steps: { key: Step; label: string }[] = [
    { key: 'intro', label: 'Get Started' },
    { key: 'permissions', label: 'Permissions' },
    { key: 'phone-verify', label: 'Phone' },
    { key: 'connecting', label: 'Connecting' },
    { key: 'success', label: 'Done' },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-main)',
        backgroundImage:
          'radial-gradient(circle at 50% 0%, rgba(37, 211, 102, 0.12) 0%, transparent 55%)',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '560px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '20px',
              background: step === 'success'
                ? 'var(--emerald-gradient)'
                : 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              boxShadow: '0 0 30px rgba(37, 211, 102, 0.3)',
            }}
          >
            {step === 'success' ? (
              <CheckCircle2 size={34} color="#fff" />
            ) : (
              <MessageSquare size={34} color="#fff" />
            )}
          </div>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'var(--text-main)',
            }}
          >
            {step === 'success' ? 'WhatsApp Connected!' : 'Connect WhatsApp Business'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '6px' }}>
            {step === 'success'
              ? 'Your WhatsApp Business account is ready to go'
              : `Connect your WhatsApp Business number to ${tenant?.name || 'your business'}`}
          </p>
        </div>

        {/* Progress Steps */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            marginBottom: '24px',
          }}
        >
          {steps.map((s, i) => (
            <React.Fragment key={s.key}>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background:
                    i < currentStepIndex
                      ? 'var(--success)'
                      : i === currentStepIndex
                      ? '#25D366'
                      : 'var(--bg-surface-elevated)',
                  transition: 'all 0.3s ease',
                  boxShadow:
                    i === currentStepIndex ? '0 0 8px rgba(37, 211, 102, 0.5)' : 'none',
                }}
              />
              {i < steps.length - 1 && (
                <div
                  style={{
                    width: '32px',
                    height: '2px',
                    background:
                      i < currentStepIndex
                        ? 'var(--success)'
                        : 'var(--bg-surface-elevated)',
                    transition: 'background 0.3s ease',
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Main Card */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          {error && (
            <div
              style={{
                backgroundColor: 'var(--danger-bg)',
                color: 'var(--danger)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '0.85rem',
                marginBottom: '20px',
              }}
            >
              {error}
            </div>
          )}

          {/* Step: Intro */}
          {step === 'intro' && (
            <div className="animate-fade-in">
              <div style={{ marginBottom: '24px' }}>
                {[
                  {
                    icon: <MessageSquare size={18} color="#25D366" />,
                    title: 'Send Campaigns',
                    desc: 'Reach your customers with targeted WhatsApp marketing campaigns',
                  },
                  {
                    icon: <Zap size={18} color="#F59E0B" />,
                    title: 'Automate Messages',
                    desc: 'Birthday wishes, welcome messages, and loyalty updates — automated',
                  },
                  {
                    icon: <Shield size={18} color="#6366F1" />,
                    title: 'Verified Business',
                    desc: 'Get a verified green badge on WhatsApp for your business number',
                  },
                ].map((feature, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: '14px',
                      padding: '14px',
                      marginBottom: '8px',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: 'var(--bg-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {feature.icon}
                    </div>
                    <div>
                      <p
                        style={{
                          fontWeight: 700,
                          fontSize: '0.875rem',
                          color: 'var(--text-main)',
                          marginBottom: '2px',
                        }}
                      >
                        {feature.title}
                      </p>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {feature.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={startSignup}
                disabled={loading}
                className="btn btn-whatsapp"
                style={{ width: '100%', padding: '14px', fontSize: '0.95rem' }}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    Starting...
                  </>
                ) : (
                  <>
                    <MessageSquare size={18} />
                    Connect with WhatsApp
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          )}

          {/* Step: Permissions (Mock Meta dialog) */}
          {step === 'permissions' && (
            <div className="animate-fade-in">
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '14px',
                  padding: '24px',
                  marginBottom: '20px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '18px',
                    paddingBottom: '14px',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: '#1877F2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: '1rem' }}>f</span>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                    Meta Business Permissions
                  </span>
                </div>

                <p
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                    marginBottom: '16px',
                    lineHeight: '1.5',
                  }}
                >
                  <strong style={{ color: 'var(--text-main)' }}>GoAgain</strong> is requesting access
                  to your Meta Business portfolio to:
                </p>

                {[
                  'Create or link a WhatsApp Business Account',
                  'Register a phone number for WhatsApp Cloud API',
                  'Manage message templates on your behalf',
                  'Send and receive messages via Cloud API',
                ].map((perm, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 0',
                      fontSize: '0.825rem',
                      color: 'var(--text-main)',
                    }}
                  >
                    <CheckCircle2 size={16} color="#25D366" />
                    {perm}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setStep('intro')}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '12px' }}
                >
                  Cancel
                </button>
                <button
                  onClick={grantPermissions}
                  className="btn btn-whatsapp"
                  style={{ flex: 2, padding: '12px' }}
                >
                  Allow Access
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step: Phone Verification (Mock) */}
          {step === 'phone-verify' && (
            <div className="animate-fade-in">
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '14px',
                  padding: '24px',
                  marginBottom: '20px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'var(--whatsapp-bg)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '14px',
                  }}
                >
                  <Phone size={26} color="#25D366" />
                </div>

                <h3
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: 'var(--text-main)',
                    marginBottom: '8px',
                  }}
                >
                  Verify Your Business Phone
                </h3>
                <p
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                    marginBottom: '18px',
                    lineHeight: '1.5',
                  }}
                >
                  In production, Meta will send an OTP to your business phone number.
                  <br />
                  <span style={{ color: 'var(--warning)', fontWeight: 600, fontSize: '0.75rem' }}>
                    MOCK MODE — Click below to simulate verification
                  </span>
                </p>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '8px',
                    marginBottom: '18px',
                  }}
                >
                  {['4', '2', '9', '7', '1', '6'].map((digit, i) => (
                    <div
                      key={i}
                      style={{
                        width: '42px',
                        height: '50px',
                        borderRadius: '10px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.2rem',
                        fontWeight: 700,
                        color: 'var(--whatsapp)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {digit}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={verifyPhone}
                className="btn btn-whatsapp"
                style={{ width: '100%', padding: '14px', fontSize: '0.95rem' }}
              >
                <Shield size={18} />
                Verify & Connect
                <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* Step: Connecting */}
          {step === 'connecting' && (
            <div className="animate-fade-in" style={{ textAlign: 'center', padding: '32px 0' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  border: '3px solid var(--border-subtle)',
                  borderTopColor: '#25D366',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <h3
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  marginBottom: '8px',
                }}
              >
                Connecting Your Account...
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                Registering your phone number and setting up WhatsApp Cloud API.
                <br />
                This usually takes a few seconds.
              </p>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && result && (
            <div className="animate-fade-in">
              <div
                style={{
                  background: 'rgba(37, 211, 102, 0.08)',
                  border: '1px solid rgba(37, 211, 102, 0.25)',
                  borderRadius: '14px',
                  padding: '24px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <CheckCircle2 size={22} color="#25D366" />
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#25D366' }}>
                    Successfully Connected
                  </span>
                </div>

                {[
                  { label: 'Business Name', value: result.verified_name, icon: <Building2 size={14} /> },
                  { label: 'Phone Number', value: result.display_phone_number, icon: <Phone size={14} /> },
                  { label: 'WABA ID', value: result.waba_id, icon: <Shield size={14} /> },
                  { label: 'Status', value: result.connection_status, icon: <Zap size={14} /> },
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: i < 3 ? '1px solid rgba(37, 211, 102, 0.12)' : 'none',
                    }}
                  >
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {item.icon}
                      {item.label}
                    </span>
                    <span
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'var(--text-main)',
                        fontFamily: item.label === 'WABA ID' ? 'monospace' : 'inherit',
                      }}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={goToDashboard}
                className="btn btn-primary"
                style={{ width: '100%', padding: '14px', fontSize: '0.95rem' }}
              >
                Go to Dashboard
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
