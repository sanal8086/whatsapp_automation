import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  Award,
  Gift,
  Phone,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Star,
  QrCode,
  LogOut,
  Coffee,
  X
} from 'lucide-react';
import { apiRequest } from '../../api/client';
import { PublicPageData } from '../../types';

export const PublicLoyaltyPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [pageData, setPageData] = useState<PublicPageData | null>(null);
  const [loading, setLoading] = useState(true);

  // Auth / Member state
  const [memberPhone, setMemberPhone] = useState<string | null>(localStorage.getItem(`loyalty_member_${slug}`));
  const [memberData, setMemberData] = useState<any>(null);

  // Modal: Join / Login
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authStep, setAuthStep] = useState<'phone' | 'otp' | 'register'>('phone');
  const [inputPhone, setInputPhone] = useState('');
  const [inputOtp, setInputOtp] = useState('');
  const [inputName, setInputName] = useState('');
  const [inputEmail, setInputEmail] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Redeeming state
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [successClaim, setSuccessClaim] = useState<string | null>(null);

  const fetchPage = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<PublicPageData>(`/public/l/${slug}`);
      setPageData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMember = async (phone: string) => {
    try {
      const data = await apiRequest(`/public/l/${slug}/member/${encodeURIComponent(phone)}`);
      setMemberData(data);
    } catch (err) {
      // not enrolled
      setMemberPhone(null);
      localStorage.removeItem(`loyalty_member_${slug}`);
    }
  };

  useEffect(() => {
    fetchPage();
  }, [slug]);

  useEffect(() => {
    if (memberPhone && slug) {
      fetchMember(memberPhone);
    }
  }, [memberPhone, slug]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const res = await apiRequest(`/public/l/${slug}/otp`, {
        method: 'POST',
        body: JSON.stringify({ phone: inputPhone }),
      });
      setInputOtp('1234'); // auto-fill demo OTP
      if (res.is_existing) {
        setAuthStep('otp');
      } else {
        setAuthStep('register');
      }
    } catch (err: any) {
      alert(err.message || 'OTP failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      // Login existing
      localStorage.setItem(`loyalty_member_${slug}`, inputPhone);
      setMemberPhone(inputPhone);
      setShowAuthModal(false);
      setAuthStep('phone');
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
    } catch (err) {
      alert('Verification error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegisterJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      await apiRequest(`/public/l/${slug}/join`, {
        method: 'POST',
        body: JSON.stringify({
          phone: inputPhone,
          first_name: inputName,
          email: inputEmail || undefined,
          whatsapp_consent: true,
        }),
      });
      localStorage.setItem(`loyalty_member_${slug}`, inputPhone);
      setMemberPhone(inputPhone);
      setShowAuthModal(false);
      setAuthStep('phone');
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
    } catch (err: any) {
      alert(err.message || 'Registration failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleClaimReward = async (rewardId: string, rewardName: string) => {
    if (!memberData?.customer?.id) return;
    setRedeeming(rewardId);
    try {
      await apiRequest(`/public/l/${slug}/redeem`, {
        method: 'POST',
        body: JSON.stringify({
          customer_id: memberData.customer.id,
          reward_id: rewardId,
        }),
      });

      confetti({ particleCount: 150, spread: 100, origin: { y: 0.4 } });
      setSuccessClaim(`Reward "${rewardName}" claimed! Show your QR code at the counter.`);
      fetchMember(memberPhone!);
    } catch (err: any) {
      alert(err.message || 'Redemption failed');
    } finally {
      setRedeeming(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(`loyalty_member_${slug}`);
    setMemberPhone(null);
    setMemberData(null);
  };

  if (loading || !pageData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0F19', color: '#9CA3AF' }}>
        Loading rewards program...
      </div>
    );
  }

  const primary = pageData.primary_color || '#059669';
  const secondary = pageData.secondary_color || '#D97706';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0B0F19', color: '#F9FAFB', fontFamily: 'var(--font-primary)' }}>
      {/* Brand Nav Header */}
      <header
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          backgroundColor: 'rgba(17, 24, 39, 0.85)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 800,
                boxShadow: `0 0 15px ${primary}66`,
              }}
            >
              <Award size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                {pageData.business_name}
              </h1>
              <span style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>VIP Loyalty Club</span>
            </div>
          </div>

          <div>
            {memberData ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>
                    {memberData.customer.name || 'Member'}
                  </span>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: '#10B981', fontWeight: 600 }}>
                    {memberData.customer.points_balance} {pageData.program?.points_currency_name || 'pts'}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  title="Logout"
                  style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#9CA3AF', padding: '6px', cursor: 'pointer' }}
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthStep('phone');
                  setShowAuthModal(true);
                }}
                style={{
                  backgroundColor: primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '8px 18px',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: `0 4px 14px ${primary}40`,
                }}
              >
                Join / Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 20px 80px' }}>
        {/* LOGGED IN MEMBER VIEW */}
        {memberData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* VIP Card */}
            <div
              style={{
                borderRadius: '20px',
                padding: '32px',
                background: `linear-gradient(135deg, ${primary} 0%, #111827 100%)`,
                border: '1px solid rgba(255, 255, 255, 0.15)',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '24px',
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>
                  VIP Member Pass • {memberData.customer.tier} Tier
                </span>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
                  {memberData.customer.name || 'Member'}
                </h2>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '16px' }}>
                  <span style={{ fontSize: '2.75rem', fontWeight: 900, color: '#fff' }}>
                    {memberData.customer.points_balance}
                  </span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
                    {pageData.program?.points_currency_name || 'Points'}
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>
                  {memberData.customer.visits} store visits recorded
                </p>
              </div>

              {/* Digital Barcode simulation */}
              <div
                style={{
                  backgroundColor: '#fff',
                  padding: '16px',
                  borderRadius: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  color: '#000',
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
                }}
              >
                <QrCode size={80} color="#000" />
                <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 700, marginTop: '6px' }}>
                  {memberData.customer.phone}
                </span>
                <span style={{ fontSize: '0.65rem', color: '#6B7280' }}>Scan at billing</span>
              </div>
            </div>

            {/* Success Claim Banner */}
            {successClaim && (
              <div
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  color: '#10B981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Sparkles size={20} />
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{successClaim}</span>
                </div>
                <button onClick={() => setSuccessClaim(null)} style={{ background: 'none', border: 'none', color: '#10B981', cursor: 'pointer' }}>
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Available Rewards Catalogue */}
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '16px' }}>
                Claimable Rewards
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '18px' }}>
                {memberData.available_rewards?.map((r: any) => (
                  <div
                    key={r.id}
                    style={{
                      backgroundColor: 'rgba(31, 41, 55, 0.6)',
                      borderRadius: '14px',
                      border: '1px solid rgba(255,255,255,0.08)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    {r.image_url ? (
                      <img src={r.image_url} alt={r.name} style={{ width: '100%', height: '140px', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '120px', backgroundColor: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Gift size={32} color={primary} />
                      </div>
                    )}
                    <div style={{ padding: '18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{r.name}</h4>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#FBBF24' }}>
                          {r.points_required} pts
                        </span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: '#9CA3AF', marginBottom: '16px' }}>
                        {r.description || 'Exclusive customer reward'}
                      </p>

                      <button
                        disabled={!r.can_redeem || redeeming === r.id}
                        onClick={() => handleClaimReward(r.id, r.name)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: r.can_redeem ? secondary : 'rgba(255,255,255,0.05)',
                          color: r.can_redeem ? '#fff' : '#6B7280',
                          fontWeight: 700,
                          fontSize: '0.825rem',
                          cursor: r.can_redeem ? 'pointer' : 'not-allowed',
                        }}
                      >
                        {redeeming === r.id ? 'Claiming...' : r.can_redeem ? 'Claim Reward' : `Need ${r.points_required - memberData.customer.points_balance} more pts`}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Points Timeline */}
            <div style={{ backgroundColor: 'rgba(31, 41, 55, 0.4)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>
                Your Points History
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {memberData.transactions?.map((t: any) => (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{t.description}</span>
                      <span style={{ display: 'block', fontSize: '0.72rem', color: '#6B7280' }}>
                        {new Date(t.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: t.points > 0 ? '#10B981' : '#EF4444' }}>
                      {t.points > 0 ? `+${t.points}` : t.points} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* GUEST LANDING VIEW */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
            {/* Hero Section */}
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                borderRadius: '24px',
                background: `radial-gradient(circle at 50% 20%, ${primary}33 0%, rgba(17, 24, 39, 0.6) 80%)`,
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginBottom: '20px',
                }}
              >
                <Sparkles size={15} color={secondary} />
                Instant {pageData.program?.welcome_bonus_points || 100} Welcome Points
              </div>

              <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.2, maxWidth: '650px', margin: '0 auto 16px' }}>
                {pageData.hero_title}
              </h2>

              <p style={{ fontSize: '1.05rem', color: '#9CA3AF', maxWidth: '580px', margin: '0 auto 28px', lineHeight: 1.6 }}>
                {pageData.hero_description}
              </p>

              <button
                onClick={() => {
                  setAuthStep('phone');
                  setShowAuthModal(true);
                }}
                style={{
                  backgroundColor: primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px 32px',
                  fontSize: '1rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: `0 8px 24px ${primary}50`,
                }}
              >
                Join Rewards Now & Get {pageData.program?.welcome_bonus_points || 100} Pts
              </button>
            </div>

            {/* How It Works */}
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, textAlign: 'center', marginBottom: '28px' }}>
                How It Works
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                <div style={{ backgroundColor: 'rgba(31, 41, 55, 0.4)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, marginBottom: '14px' }}>
                    1
                  </div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>Join in 10 Seconds</h4>
                  <p style={{ fontSize: '0.85rem', color: '#9CA3AF' }}>Enter your mobile number and instantly receive your welcome bonus points.</p>
                </div>

                <div style={{ backgroundColor: 'rgba(31, 41, 55, 0.4)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, marginBottom: '14px' }}>
                    2
                  </div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>Earn on Every Visit</h4>
                  <p style={{ fontSize: '0.85rem', color: '#9CA3AF' }}>Share your phone number at billing. Points get added automatically with WhatsApp receipts.</p>
                </div>

                <div style={{ backgroundColor: 'rgba(31, 41, 55, 0.4)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, marginBottom: '14px' }}>
                    3
                  </div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>Unlock Free Perks</h4>
                  <p style={{ fontSize: '0.85rem', color: '#9CA3AF' }}>Redeem your points for delicious food items, discounts & VIP member experiences.</p>
                </div>
              </div>
            </div>

            {/* Rewards Teaser */}
            {pageData.rewards && pageData.rewards.length > 0 && (
              <div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, textAlign: 'center', marginBottom: '24px' }}>
                  Featured Member Rewards
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                  {pageData.rewards.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        backgroundColor: 'rgba(31, 41, 55, 0.4)',
                        borderRadius: '16px',
                        border: '1px solid rgba(255,255,255,0.06)',
                        overflow: 'hidden',
                      }}
                    >
                      {r.image_url && <img src={r.image_url} alt={r.name} style={{ width: '100%', height: '140px', objectFit: 'cover' }} />}
                      <div style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                          <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>{r.name}</h4>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: secondary }}>
                            {r.points_required} pts
                          </span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>{r.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Join / OTP Modal */}
      {showAuthModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '420px', backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                {authStep === 'phone' && 'Join VIP Rewards'}
                {authStep === 'otp' && 'Verify Mobile Number'}
                {authStep === 'register' && 'Complete Your Profile'}
              </h3>
              <button onClick={() => setShowAuthModal(false)} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            {authStep === 'phone' && (
              <form onSubmit={handleSendOtp}>
                <p style={{ fontSize: '0.85rem', color: '#9CA3AF', marginBottom: '16px' }}>
                  Enter your mobile number to sign in or claim your instant welcome points.
                </p>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#9CA3AF', marginBottom: '4px' }}>Phone Number (WhatsApp)</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="+91 98765 00000"
                    value={inputPhone}
                    onChange={(e) => setInputPhone(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" disabled={authLoading} style={{ width: '100%', backgroundColor: primary, color: '#fff', border: 'none', borderRadius: '10px', padding: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  {authLoading ? 'Sending Code...' : 'Continue'}
                </button>
              </form>
            )}

            {authStep === 'otp' && (
              <form onSubmit={handleVerifyOtp}>
                <p style={{ fontSize: '0.85rem', color: '#9CA3AF', marginBottom: '16px' }}>
                  Enter the 4-digit code sent to your WhatsApp (Demo OTP: <strong style={{ color: '#10B981' }}>1234</strong>)
                </p>
                <div style={{ marginBottom: '20px' }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ textAlign: 'center', letterSpacing: '0.3em', fontSize: '1.25rem', fontWeight: 800 }}
                    value={inputOtp}
                    onChange={(e) => setInputOtp(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" disabled={authLoading} style={{ width: '100%', backgroundColor: primary, color: '#fff', border: 'none', borderRadius: '10px', padding: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  {authLoading ? 'Verifying...' : 'Verify & Enter'}
                </button>
              </form>
            )}

            {authStep === 'register' && (
              <form onSubmit={handleRegisterJoin}>
                <p style={{ fontSize: '0.85rem', color: '#9CA3AF', marginBottom: '16px' }}>
                  Welcome! Tell us your name to credit your {pageData.program?.welcome_bonus_points || 100} welcome points.
                </p>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#9CA3AF', marginBottom: '4px' }}>Your Name</label>
                  <input type="text" className="form-input" placeholder="e.g. Rohan Sharma" value={inputName} onChange={(e) => setInputName(e.target.value)} required />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#9CA3AF', marginBottom: '4px' }}>Email (Optional)</label>
                  <input type="email" className="form-input" placeholder="rohan@example.com" value={inputEmail} onChange={(e) => setInputEmail(e.target.value)} />
                </div>
                <button type="submit" disabled={authLoading} style={{ width: '100%', backgroundColor: primary, color: '#fff', border: 'none', borderRadius: '10px', padding: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  {authLoading ? 'Enrolling...' : 'Claim Welcome Points 🎉'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
