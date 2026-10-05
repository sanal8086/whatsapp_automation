import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Phone,
  Building2,
  Shield,
  Zap,
  ExternalLink,
  AlertCircle,
  HelpCircle,
  Check,
  Globe
} from 'lucide-react';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

type OnboardingStep = 'ready' | 'authenticating' | 'processing' | 'success';

interface WhatsAppResult {
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string;
  verified_name: string;
  connection_status: string;
  is_live_mode?: boolean;
}

interface SignupConfig {
  session_id: string;
  state: string;
  app_id: string;
  config_id: string;
  graph_version: string;
  use_live_whatsapp: boolean;
  is_mock_app: boolean;
}

export const WhatsAppOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { tenant, login, token, user } = useAuth();

  const [step, setStep] = useState<OnboardingStep>('ready');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Preparing Meta connection...');
  const [config, setConfig] = useState<SignupConfig | null>(null);
  const [result, setResult] = useState<WhatsAppResult | null>(null);
  const [confirmingSkip, setConfirmingSkip] = useState(false);
  const [skipping, setSkipping] = useState(false);

  // Captured IDs from Meta postMessage event listener
  const capturedWabaIdRef = useRef<string | null>(null);
  const capturedPhoneIdRef = useRef<string | null>(null);
  const codeHandledRef = useRef<boolean>(false);

  // Step 1: Start onboarding session & fetch Meta App configuration
  const fetchConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<SignupConfig>('/onboarding/whatsapp-signup/start', { method: 'POST' });
      setConfig(data);

      // Load official Facebook JS SDK if real App ID is provided
      if (data.app_id && !data.is_mock_app) {
        initFacebookSdk(data.app_id, data.graph_version || 'v22.0');
      }

      // Check if user was redirected back from Meta-hosted Embedded Signup landing page
      const searchParams = new URLSearchParams(window.location.search);
      const returnedCode = searchParams.get('code');
      const returnedError = searchParams.get('error') || searchParams.get('error_description');

      if (returnedError) {
        setError(`Meta Authorization Error: ${returnedError}`);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (returnedCode && !codeHandledRef.current) {
        codeHandledRef.current = true;
        // Clean URL query params so reload doesn't re-trigger expired code
        window.history.replaceState({}, document.title, window.location.pathname);
        const redirectUri = window.location.origin + window.location.pathname;
        handleCompleteSignup({
          code: returnedCode,
          redirect_uri: redirectUri,
          is_sandbox_simulation: false,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize WhatsApp onboarding session');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Initialize official Facebook JavaScript SDK
  const initFacebookSdk = (appId: string, version: string) => {
    if (window.FB) {
      try {
        window.FB.init({
          appId,
          autoLogAppEvents: true,
          xfbml: true,
          version,
        });
      } catch (e) {
        console.warn('FB.init error:', e);
      }
      return;
    }

    window.fbAsyncInit = () => {
      window.FB.init({
        appId,
        autoLogAppEvents: true,
        xfbml: true,
        version,
      });
    };

    const existingScript = document.getElementById('facebook-jssdk');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      document.body.appendChild(script);
    }
  };

  // Step 2: Set up Meta postMessage event listener (sessionInfoListener)
  useEffect(() => {
    const handleMetaMessage = (event: MessageEvent) => {
      // Validate origin from Meta domains
      if (
        event.origin !== 'https://www.facebook.com' &&
        event.origin !== 'https://web.facebook.com'
      ) {
        return;
      }

      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

        // Meta Embedded Signup event triggers
        if (
          data?.type === 'WA_EMBEDDED_SIGNUP' ||
          data?.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING' ||
          data?.event === 'WA_EMBEDDED_SIGNUP_FINISH' ||
          data?.data?.type === 'whatsapp_embedded_signup'
        ) {
          const payload = data.data || data;
          if (payload.waba_id) {
            capturedWabaIdRef.current = payload.waba_id;
          }
          if (payload.phone_number_id) {
            capturedPhoneIdRef.current = payload.phone_number_id;
          }
        }
      } catch {
        // Ignore non-JSON postMessages from extensions or frames
      }
    };

    window.addEventListener('message', handleMetaMessage);
    return () => window.removeEventListener('message', handleMetaMessage);
  }, []);

  // Construct official Meta-hosted landing page OAuth URL
  const getMetaHostedUrl = () => {
    if (!config) return '#';
    const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
    const graphVersion = config.graph_version || 'v22.0';
    let url = `https://www.facebook.com/${graphVersion}/dialog/oauth?client_id=${config.app_id}&redirect_uri=${redirectUri}&response_type=code&state=${config.state}`;
    if (config.config_id) {
      url += `&config_id=${config.config_id}`;
    }
    return url;
  };

  // Step 3: Launch real Meta Embedded Signup via FB.login popup
  const handleLaunchMetaSignup = () => {
    setError(null);

    // If still in mock mode or FB SDK not loaded, advise or fallback
    if (!config || config.is_mock_app || !window.FB) {
      if (config?.is_mock_app) {
        handleCompleteSignup({ is_sandbox_simulation: true });
        return;
      }
      setError('Facebook JavaScript SDK is still loading. Please try again in a few seconds or use the Meta-Hosted page.');
      return;
    }

    setStep('authenticating');
    setStatusMessage('Connecting to Meta Embedded Signup dialog...');

    const fbLoginOptions: Record<string, any> = {
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        feature: 'whatsapp_embedded_signup',
        version: 2,
        sessionInfoVersion: 3,
      },
    };

    if (config.config_id) {
      fbLoginOptions.config_id = config.config_id;
    }

    try {
      window.FB.login((response: any) => {
        if (response.authResponse && response.authResponse.code) {
          // Authorization code received from Meta popup
          setStep('processing');
          setStatusMessage('Exchanging authorization code with Meta Graph API...');
          handleCompleteSignup({
            code: response.authResponse.code,
            waba_id: capturedWabaIdRef.current || undefined,
            phone_number_id: capturedPhoneIdRef.current || undefined,
            is_sandbox_simulation: false,
          });
        } else {
          // Merchant closed popup or denied permission
          setStep('ready');
          setError('WhatsApp Embedded Signup was closed or cancelled. Please try again.');
        }
      }, fbLoginOptions);
    } catch (e: any) {
      setStep('ready');
      setError(e.message || 'Failed to open Meta popup. Please check your browser pop-up blocker.');
    }
  };

  // Step 4: Complete signup on backend (Exchanging code, registering phone & subscribing webhooks)
  const handleCompleteSignup = async (payload: {
    code?: string;
    waba_id?: string;
    phone_number_id?: string;
    is_sandbox_simulation?: boolean;
    redirect_uri?: string;
  }) => {
    setStep('processing');
    setStatusMessage(
      payload.is_sandbox_simulation
        ? 'Registering sandbox WABA and activating merchant account...'
        : 'Registering phone number & subscribing Meta Cloud API webhooks...'
    );

    try {
      const data = await apiRequest<{
        status: string;
        tenant_status: string;
        is_live_mode: boolean;
        whatsapp: WhatsAppResult;
      }>('/onboarding/whatsapp-signup/complete', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setResult({
        ...data.whatsapp,
        is_live_mode: data.is_live_mode,
      });
      setStep('success');

      // Update auth context with ACTIVE status
      if (token && user && tenant) {
        login(token, user, {
          ...tenant,
          status: data.tenant_status,
        });
      }
    } catch (err: any) {
      setError(err.message || 'WhatsApp connection and registration failed');
      setStep('ready');
    }
  };

  const goToDashboard = () => {
    navigate('/app');
  };

  const handleSkip = async () => {
    setSkipping(true);
    setError(null);
    try {
      const data = await apiRequest<{ status: string; tenant_status: string }>(
        '/onboarding/whatsapp-signup/skip',
        { method: 'POST' }
      );
      // Mirror handleCompleteSignup (:283-288) — must refresh in-memory tenant.status
      // to ACTIVE or the guards bounce straight back to this step.
      if (token && user && tenant) {
        login(token, user, { ...tenant, status: data.tenant_status });
      }
      navigate('/app');
    } catch (err: any) {
      setError(err.message || 'Failed to skip WhatsApp setup');
      setConfirmingSkip(false);
    } finally {
      setSkipping(false);
    }
  };

  const isLiveConfigured = config && !config.is_mock_app;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-main)',
        backgroundImage:
          'radial-gradient(circle at 50% 0%, rgba(37, 211, 102, 0.12) 0%, transparent 60%)',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '580px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '70px',
              height: '70px',
              borderRadius: '22px',
              background:
                step === 'success'
                  ? 'var(--emerald-gradient)'
                  : 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              boxShadow: '0 0 35px rgba(37, 211, 102, 0.35)',
            }}
          >
            {step === 'success' ? (
              <CheckCircle2 size={36} color="#fff" />
            ) : (
              <MessageSquare size={36} color="#fff" />
            )}
          </div>
          <h1
            style={{
              fontSize: '1.8rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'var(--text-main)',
            }}
          >
            {step === 'success' ? 'WhatsApp Business Active!' : 'Connect WhatsApp Cloud API'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '6px' }}>
            {step === 'success'
              ? 'Your official Meta WhatsApp Cloud API integration is live and ready.'
              : `Link your verified WhatsApp Business phone number for ${tenant?.name || 'your store'}.`}
          </p>
        </div>

        {/* Environment Badges */}
        {config && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '18px',
            }}
          >
            {isLiveConfigured ? (
              <>
                <span
                  className="badge badge-success"
                  style={{
                    padding: '5px 12px',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Globe size={13} />
                  App ID: {config.app_id}
                </span>

                <span
                  className={`badge ${config.config_id ? 'badge-success' : 'badge-warning'}`}
                  style={{
                    padding: '5px 12px',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Shield size={13} />
                  Config ID: {config.config_id || 'Not Set in .env'}
                </span>
              </>
            ) : (
              <span
                className="badge badge-warning"
                style={{
                  padding: '5px 12px',
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Zap size={13} />
                Sandbox / Developer Mode (Configure META_APP_ID & CONFIG_ID in .env)
              </span>
            )}
          </div>
        )}

        {/* Main Card */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          {error && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: 'var(--danger)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '14px 18px',
                borderRadius: '12px',
                fontSize: '0.875rem',
                marginBottom: '20px',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 700 }}>Connection Notice</div>
                <div style={{ fontSize: '0.82rem', marginTop: '2px', lineHeight: '1.4' }}>{error}</div>
              </div>
            </div>
          )}

          {/* Config ID notice if using live app but config_id is missing */}
          {isLiveConfigured && !config?.config_id && (
            <div
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '0.82rem',
                color: '#F59E0B',
                marginBottom: '18px',
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
              }}
            >
              <HelpCircle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Meta Config ID recommended:</strong> Create a Configuration in Meta Developer Portal under{' '}
                <em>Facebook Login for Business &gt; Configurations</em> and paste it into{' '}
                <code style={{ color: '#fff' }}>WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID</code> in{' '}
                <code style={{ color: '#fff' }}>backend/.env</code>.
              </div>
            </div>
          )}

          {/* STEP: READY */}
          {step === 'ready' && (
            <div className="animate-fade-in">
              <div style={{ marginBottom: '22px' }}>
                {[
                  {
                    icon: <Shield size={18} color="#25D366" />,
                    title: 'Official Meta Cloud API',
                    desc: 'Direct server-to-server connection using Meta Graph API v22.0',
                  },
                  {
                    icon: <Zap size={18} color="#F59E0B" />,
                    title: 'Automated 2-Way Webhooks',
                    desc: 'Instant delivery receipts, read ticks, and customer inbound replies',
                  },
                  {
                    icon: <MessageSquare size={18} color="#6366F1" />,
                    title: 'Pre-Approved Loyalty Templates',
                    desc: 'Instant point alerts, welcome bonuses, and birthday reward triggers',
                  },
                ].map((feature, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: '14px',
                      padding: '14px',
                      marginBottom: '10px',
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

              {/* Action Buttons */}
              {isLiveConfigured ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Option 1: In-Page SDK Popup */}
                  <button
                    onClick={handleLaunchMetaSignup}
                    disabled={loading}
                    className="btn"
                    style={{
                      width: '100%',
                      padding: '14px',
                      fontSize: '0.95rem',
                      background: 'linear-gradient(135deg, #1877F2 0%, #0C63D4 100%)',
                      color: '#fff',
                      fontWeight: 700,
                      boxShadow: '0 4px 16px rgba(24, 119, 242, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                    }}
                  >
                    <span style={{ fontWeight: 900, fontSize: '1.1rem' }}>f</span>
                    Launch Meta Embedded Popup
                    <ExternalLink size={16} />
                  </button>

                  {/* Option 2: Meta-Hosted Landing Page / OAuth Dialog */}
                  <a
                    href={getMetaHostedUrl()}
                    className="btn btn-secondary"
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      textDecoration: 'none',
                    }}
                  >
                    <Globe size={16} />
                    Open Meta-Hosted Signup Page (Direct URL)
                    <ArrowRight size={14} />
                  </a>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    onClick={() => handleCompleteSignup({ is_sandbox_simulation: true })}
                    disabled={loading}
                    className="btn btn-whatsapp"
                    style={{
                      width: '100%',
                      padding: '14px',
                      fontSize: '0.95rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Zap size={18} />
                        Connect Sandbox Simulation
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      onClick={handleLaunchMetaSignup}
                      className="btn btn-secondary"
                      style={{ padding: '10px', fontSize: '0.8rem' }}
                      title="Attempts Meta popup with current App ID"
                    >
                      Test Meta Popup
                    </button>
                    <a
                      href={getMetaHostedUrl()}
                      className="btn btn-secondary"
                      style={{
                        padding: '10px',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        textDecoration: 'none',
                      }}
                      title="Opens direct Meta-hosted OAuth landing page"
                    >
                      <Globe size={13} />
                      Meta-Hosted Page
                    </a>
                  </div>
                </div>
              )}

              {/* Separator & Skip for now */}
              <div
                style={{
                  borderTop: '1px solid var(--border-subtle)',
                  marginTop: '20px',
                  paddingTop: '16px',
                  textAlign: 'center',
                }}
              >
                {!confirmingSkip ? (
                  <button
                    type="button"
                    onClick={() => setConfirmingSkip(true)}
                    className="btn btn-ghost"
                    style={{
                      width: '100%',
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Skip for now — configure later
                  </button>
                ) : (
                  <div
                    style={{
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      backgroundColor: 'rgba(245, 158, 11, 0.05)',
                      borderRadius: '10px',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      textAlign: 'left',
                      pointerEvents: skipping ? 'none' : 'auto',
                    }}
                  >
                    <div style={{ fontSize: '0.82rem', color: '#F59E0B', flex: 1, minWidth: '220px' }}>
                      Skip WhatsApp setup for now? Campaigns and automations stay disabled until you connect.
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setConfirmingSkip(false)}
                        className="btn btn-sm btn-ghost"
                        disabled={skipping}
                        style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSkip}
                        className="btn btn-sm"
                        disabled={skipping}
                        style={{
                          fontSize: '0.8rem',
                          backgroundColor: 'rgba(245, 158, 11, 0.2)',
                          color: '#F59E0B',
                          border: '1px solid rgba(245, 158, 11, 0.4)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: skipping ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {skipping && (
                          <span
                            style={{
                              width: '12px',
                              height: '12px',
                              border: '2px solid rgba(245, 158, 11, 0.3)',
                              borderTopColor: '#F59E0B',
                              borderRadius: '50%',
                              display: 'inline-block',
                              animation: 'spin 1s linear infinite',
                            }}
                          />
                        )}
                        {skipping ? 'Skipping...' : 'Yes, skip'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP: AUTHENTICATING / PROCESSING */}
          {(step === 'authenticating' || step === 'processing') && (
            <div className="animate-fade-in" style={{ textAlign: 'center', padding: '36px 0' }}>
              <div
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  border: '3px solid var(--border-subtle)',
                  borderTopColor: '#25D366',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '22px',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <h3
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  marginBottom: '8px',
                }}
              >
                {step === 'authenticating'
                  ? 'Waiting for Meta Authorization'
                  : 'Registering WhatsApp Cloud API'}
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                {statusMessage}
              </p>
            </div>
          )}

          {/* STEP: SUCCESS */}
          {step === 'success' && result && (
            <div className="animate-fade-in">
              <div
                style={{
                  background: 'rgba(37, 211, 102, 0.08)',
                  border: '1px solid rgba(37, 211, 102, 0.3)',
                  borderRadius: '14px',
                  padding: '24px',
                  marginBottom: '22px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={22} color="#25D366" />
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#25D366' }}>
                      Connection Established
                    </span>
                  </div>
                  <span
                    className={`badge ${result.is_live_mode ? 'badge-success' : 'badge-neutral'}`}
                    style={{ fontSize: '0.7rem' }}
                  >
                    {result.is_live_mode ? 'LIVE META CLOUD' : 'SANDBOX SIMULATED'}
                  </span>
                </div>

                {[
                  { label: 'Business Name', value: result.verified_name, icon: <Building2 size={14} /> },
                  { label: 'Phone Number', value: result.display_phone_number, icon: <Phone size={14} /> },
                  { label: 'WABA ID', value: result.waba_id, icon: <Shield size={14} /> },
                  { label: 'Phone Number ID', value: result.phone_number_id, icon: <Zap size={14} /> },
                  { label: 'Connection Status', value: result.connection_status, icon: <Check size={14} /> },
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: i < 4 ? '1px solid rgba(37, 211, 102, 0.12)' : 'none',
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
                        fontFamily:
                          item.label.includes('ID') ? 'monospace' : 'inherit',
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
                style={{ width: '100%', padding: '14px', fontSize: '0.95rem', fontWeight: 700 }}
              >
                Launch Merchant Dashboard
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Footer help note */}
        <p
          style={{
            textAlign: 'center',
            marginTop: '20px',
            fontSize: '0.78rem',
            color: 'var(--text-dim)',
          }}
        >
          Need to update your Meta Cloud API credentials? You can configure your{' '}
          <code style={{ color: 'var(--text-muted)' }}>META_APP_ID</code> and{' '}
          <code style={{ color: 'var(--text-muted)' }}>META_APP_SECRET</code> in the backend{' '}
          <code style={{ color: 'var(--text-muted)' }}>.env</code> file anytime.
        </p>
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
