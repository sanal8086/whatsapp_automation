import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Award,
  Gift,
  Settings,
  PlusCircle,
  Coins,
  History,
  CheckCircle2,
  X,
  Edit2,
  Download,
  Sparkles,
  QrCode,
  CreditCard
} from 'lucide-react';
import { apiRequest, apiDownload } from '../../api/client';
import { LoyaltyProgram, LoyaltyReward, LoyaltyTransaction } from '../../types';
import { StatCard } from '../../components/ui';
import { alertError, alertSuccess } from '../../utils/alert';

type TabKey = 'rewards' | 'rules' | 'ledger';

export const LoyaltyPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab: TabKey =
    tabParam === 'ledger' || tabParam === 'rules' || tabParam === 'rewards' ? tabParam : 'rewards';
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  // Keep the tab in sync when the query param changes (e.g. dashboard "View All")
  useEffect(() => {
    if (tabParam === 'ledger' || tabParam === 'rules' || tabParam === 'rewards') {
      setActiveTab(tabParam);
    }
  }, [tabParam]);
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // New/Edit Reward Modal
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [rewardName, setRewardName] = useState('');
  const [rewardDesc, setRewardDesc] = useState('');
  const [rewardPoints, setRewardPoints] = useState('200');
  const [rewardImg, setRewardImg] = useState('');
  const [rewardItem, setRewardItem] = useState('');

  // Rules form state
  const [pointsName, setPointsName] = useState('Points');
  const [earnType, setEarnType] = useState('SPEND_BASED');
  const [earnRate, setEarnRate] = useState('1');
  const [earnUnit, setEarnUnit] = useState('10');
  const [welcomeBonus, setWelcomeBonus] = useState('100');
  const [birthdayBonus, setBirthdayBonus] = useState('200');
  const [savingRules, setSavingRules] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [progData, rewData, txnData] = await Promise.all([
        apiRequest<LoyaltyProgram>('/loyalty/program'),
        apiRequest<LoyaltyReward[]>('/loyalty/rewards'),
        apiRequest<LoyaltyTransaction[]>('/loyalty/transactions'),
      ]);
      setProgram(progData);
      setRewards(rewData);
      setTransactions(txnData);

      setPointsName(progData.points_currency_name);
      setEarnType(progData.earn_type);
      setEarnRate(String(progData.earn_rate));
      setEarnUnit(String(progData.earn_spend_unit));
      setWelcomeBonus(String(progData.welcome_bonus_points));
      setBirthdayBonus(String(progData.birthday_bonus_points));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveReward = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedItem = rewardItem.trim();
    try {
      if (editingRewardId) {
        await apiRequest(`/loyalty/rewards/${editingRewardId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: rewardName,
            description: rewardDesc,
            points_required: parseInt(rewardPoints),
            image_url: rewardImg || undefined,
            items: cleanedItem ? [cleanedItem] : [],
          }),
        });
      } else {
        await apiRequest('/loyalty/rewards', {
          method: 'POST',
          body: JSON.stringify({
            name: rewardName,
            description: rewardDesc,
            points_required: parseInt(rewardPoints),
            image_url: rewardImg || undefined,
            items: cleanedItem ? [cleanedItem] : undefined,
            stock: -1,
            expiry_days: 30,
          }),
        });
      }
      setShowRewardModal(false);
      setEditingRewardId(null);
      setRewardName('');
      setRewardDesc('');
      setRewardPoints('200');
      setRewardImg('');
      setRewardItem('');
      fetchData();
    } catch (err: any) {
      alertError(err.message || 'Error saving reward');
    }
  };

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRules(true);
    try {
      const updated = await apiRequest<LoyaltyProgram>('/loyalty/program', {
        method: 'PATCH',
        body: JSON.stringify({
          points_currency_name: pointsName,
          earn_type: earnType,
          earn_rate: parseFloat(earnRate),
          earn_spend_unit: parseFloat(earnUnit),
          welcome_bonus_points: parseInt(welcomeBonus),
          birthday_bonus_points: parseInt(birthdayBonus),
        }),
      });
      setProgram(updated);
      alertSuccess('Loyalty program rules saved!');
    } catch (err: any) {
      alertError(err.message || 'Error updating rules');
    } finally {
      setSavingRules(false);
    }
  };

  const openEditReward = (r: LoyaltyReward) => {
    setEditingRewardId(r.id);
    setRewardName(r.name);
    setRewardDesc(r.description || '');
    setRewardPoints(String(r.points_required));
    setRewardImg(r.image_url || '');
    setRewardItem(r.items && r.items.length > 0 ? r.items[0] : '');
    setShowRewardModal(true);
  };

  const totalRedemptions = transactions.filter((t) => t.type === 'REDEEM').length;
  const isVisitBased = program?.earn_type === 'VISIT_BASED';
  const pointsPerVisit = program
    ? Math.max(1, Math.floor((1 / (program.earn_spend_unit > 0 ? program.earn_spend_unit : 1)) * (program.earn_rate || 1)))
    : 1;
  const spendPerPoint = program && program.earn_rate > 0 ? program.earn_spend_unit / program.earn_rate : 10;

  const rewardCostLabel = (points: number) => {
    if (isVisitBased) {
      const visits = Math.ceil(points / pointsPerVisit);
      return `${visits} visit${visits === 1 ? '' : 's'}`;
    }
    const spend = Math.ceil(points * spendPerPoint);
    return `₹${spend.toLocaleString('en-IN')} spent`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ─── Hero Header ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">
            Loyalty Engine & Rewards
          </h1>
          <p className="page-subtitle">
            Configure points accrual rules, manage redeemable rewards & audit the immutable points ledger.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingRewardId(null);
            setRewardName('');
            setRewardDesc('');
            setRewardPoints('200');
            setRewardImg('');
            setRewardItem('');
            setShowRewardModal(true);
          }}
          className="btn btn-dark-pill"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <PlusCircle size={16} />
          Create Reward
        </button>
      </div>

      {/* ─── Dashboard-Style Stat Cards Row (Loyalty Pastel Palette) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
        <StatCard
          label="Active Rewards"
          value={rewards.length.toString()}
          delta="Catalog items ready"
          tone="butter"
          icon={<Gift size={18} />}
        />
        <StatCard
          label="Points Rule"
          value={`${earnRate} ${pointsName}`}
          delta={`per ₹${earnUnit} spent`}
          tone="periwinkle"
          icon={<Award size={18} />}
        />
        <StatCard
          label="Total Redemptions"
          value={totalRedemptions.toString()}
          delta={`${transactions.length} audit records`}
          tone="rose-milk"
          icon={<History size={18} />}
        />
      </div>

      {/* ─── Navigation Tabs ─── */}
      <div className="subnav-tabs">
        <button
          onClick={() => setActiveTab('rewards')}
          className={`subnav-tab ${activeTab === 'rewards' ? 'active' : ''}`}
        >
          <Gift size={15} />
          Rewards Catalog ({rewards.length})
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`subnav-tab ${activeTab === 'rules' ? 'active' : ''}`}
        >
          <Settings size={15} />
          Program Rules & Bonuses
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`subnav-tab ${activeTab === 'ledger' ? 'active' : ''}`}
        >
          <History size={15} />
          Audit Ledger ({transactions.length})
        </button>
      </div>

      {/* ─── Tab 1: Modern Rewards Catalog Grid ─── */}
      {activeTab === 'rewards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '20px' }}>
          {rewards.map((r) => (
            <div key={r.id} className="reward-card">
              <div className="reward-card-image">
                {r.image_url ? (
                  <img src={r.image_url} alt={r.name} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary-bg)' }}>
                    <Gift size={38} color="var(--primary)" />
                  </div>
                )}
                <div className="reward-points-badge">
                  <Coins size={13} color="#F59E0B" />
                  <span>{r.points_required} {program?.points_currency_name || 'pts'}</span>
                </div>
              </div>

              <div style={{ padding: '16px 4px 4px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, letterSpacing: '-0.3px', color: 'var(--text-main)', marginBottom: '6px' }}>
                    {r.name}
                  </h3>
                  {r.items && r.items.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-main)', marginBottom: '10px' }}>
                      <CheckCircle2 size={13} color="var(--success)" style={{ flexShrink: 0 }} />
                      {r.items[0]}
                    </div>
                  )}
                  <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: '16px' }}>
                    {r.description || 'Exclusive loyalty reward voucher for active club members.'}
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
                  <button
                    onClick={() => openEditReward(r)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '6px 14px', fontSize: '0.75rem', gap: 6 }}
                  >
                    <Edit2 size={12} />
                    Edit
                  </button>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '8px', display: 'block', fontWeight: 600 }}>
                  Unlock after {rewardCostLabel(r.points_required)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Tab 2: Program Rules & Live Pass Preview ─── */}
      {activeTab === 'rules' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1fr) 340px', gap: '28px', alignItems: 'start' }}>
          {/* Rules Form Card */}
          <div className="card" style={{ padding: '32px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, letterSpacing: '-0.3px', marginBottom: '6px' }}>
              Accrual & Bonus Logic
            </h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Define how customers earn currency and the automated bonuses credited on key lifecycle milestones.
            </p>

            <form onSubmit={handleSaveRules}>
              <div style={{ marginBottom: '18px' }}>
                <label className="form-label">
                  Points Currency Name
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Points, Beans, Stars, Coins"
                  value={pointsName}
                  onChange={(e) => setPointsName(e.target.value)}
                  style={{ borderRadius: '12px' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label className="form-label">
                  Accrual Model
                </label>
                <select
                  className="form-input"
                  value={earnType}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    setEarnType(nextType);
                    setEarnUnit(nextType === 'VISIT_BASED' ? '1' : '10');
                  }}
                  style={{ borderRadius: '12px' }}
                >
                  <option value="SPEND_BASED">Spend Based (Points earned per ₹ spend)</option>
                  <option value="VISIT_BASED">Visit Based (Points earned per number of visits)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
                <div>
                  <label className="form-label">
                    Points Earned
                  </label>
                  <input type="number" className="form-input" value={earnRate} onChange={(e) => setEarnRate(e.target.value)} style={{ borderRadius: '12px' }} required />
                </div>
                <div>
                  <label className="form-label">
                    {earnType === 'VISIT_BASED' ? 'Per Number of Visits' : 'Per Amount Spent (₹)'}
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    min={1}
                    value={earnUnit}
                    onChange={(e) => setEarnUnit(e.target.value)}
                    style={{ borderRadius: '12px' }}
                    required
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                    {earnType === 'VISIT_BASED'
                      ? `e.g. ${earnRate || 0} points per ${earnUnit || 0} visit${earnUnit === '1' ? '' : 's'}`
                      : `e.g. ${earnRate || 0} point${earnRate === '1' ? '' : 's'} per ₹${earnUnit || 0} spent`}
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '28px' }}>
                <div>
                  <label className="form-label">
                    Welcome Bonus
                  </label>
                  <input type="number" className="form-input" value={welcomeBonus} onChange={(e) => setWelcomeBonus(e.target.value)} style={{ borderRadius: '12px' }} required />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>Credited on registration</span>
                </div>
                <div>
                  <label className="form-label">
                    Birthday Bonus
                  </label>
                  <input type="number" className="form-input" value={birthdayBonus} onChange={(e) => setBirthdayBonus(e.target.value)} style={{ borderRadius: '12px' }} required />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>Sent via WhatsApp greeting</span>
                </div>
              </div>

              <button type="submit" disabled={savingRules} className="btn btn-dark-pill" style={{ width: '100%' }}>
                {savingRules ? 'Saving Changes...' : 'Save Program Rules'}
              </button>
            </form>
          </div>

          {/* Right Column: Live Simulated Customer Digital Membership Pass */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                borderRadius: '26px',
                padding: '28px',
                background: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)',
                color: '#ffffff',
                boxShadow: '0 16px 36px rgba(0, 0, 0, 0.16)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(100, 211, 231, 0.25) 0%, transparent 70%)' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--primary-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={16} color="#202020" />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>
                    VIP Loyalty Pass
                  </span>
                </div>
                <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.12)', padding: '4px 10px', borderRadius: '9999px', letterSpacing: '0.5px' }}>
                  ACTIVE
                </span>
              </div>

              <div style={{ marginBottom: '28px' }}>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Available Balance</span>
                <div style={{ fontSize: '2.2rem', fontWeight: 700, letterSpacing: '-0.5px', color: '#ffffff', marginTop: 2 }}>
                  750 <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--primary-light)' }}>{pointsName}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'rgba(255,255,255,0.06)', padding: '14px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Earn Rate</span>
                  <p style={{ fontSize: '12px', fontWeight: 600, marginTop: 2 }}>{earnRate} {pointsName} / ₹{earnUnit}</p>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Welcome Bonus</span>
                  <p style={{ fontSize: '12px', fontWeight: 600, marginTop: 2 }}>+{welcomeBonus} pts</p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>MEMBER #GA-8921</span>
                <QrCode size={20} color="rgba(255,255,255,0.7)" />
              </div>
            </div>

            <div className="card" style={{ padding: '20px', borderRadius: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CreditCard size={18} color="var(--primary)" />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>WhatsApp Wallet Integration</span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.45 }}>
                Customers receive this branded digital pass directly via WhatsApp upon making their first purchase.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Tab 3: Ledger ─── */}
      {activeTab === 'ledger' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Immutable audit ledger tracking every single loyalty point earned, redeemed, or adjusted.
            </p>
            <button
              onClick={async () => {
                try {
                  await apiDownload('/loyalty/export', 'loyalty_ledger.csv');
                } catch (err: any) {
                   alertError(err.message || 'Export failed');
                }
              }}
              className="btn btn-secondary btn-sm"
              style={{ gap: 6 }}
            >
              <Download size={13} />
              Export Ledger CSV
            </button>
          </div>

          <div className="table-card">
            <div style={{ overflowX: 'auto' }}>
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Points</th>
                    <th>Balance After</th>
                    <th>Customer</th>
                    <th>Description</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-dim)' }}>
                        No loyalty transactions yet. Award or redeem points to populate the ledger.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <span
                            className={`badge ${t.type === 'EARN' ? 'badge-success' : t.type === 'REDEEM' ? 'badge-warning' : 'badge-info'}`}
                            style={{ borderRadius: '9999px', padding: '4px 12px', fontSize: '11px' }}
                          >
                            {t.type}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: t.type === 'EARN' ? 'var(--success)' : 'var(--warning)', fontSize: '13.5px', fontVariantNumeric: 'tabular-nums' }}>
                          {t.type === 'EARN' || t.type === 'BONUS' ? `+${t.points}` : `-${t.points}`}
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>
                          {t.balance_after ?? '—'}
                        </td>
                        <td>
                          <div style={{ fontFamily: 'monospace', color: 'var(--text-main)', fontSize: '13px' }}>
                            {t.customer_phone || '—'}
                          </div>
                          {t.customer_name && (
                            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{t.customer_name}</div>
                          )}
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                          {t.description}
                        </td>
                        <td style={{ color: 'var(--text-dim)', fontSize: '12px' }}>
                          {new Date(t.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Reward */}
      {showRewardModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="modal-content" style={{ maxWidth: '500px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                {editingRewardId ? 'Edit Reward' : 'Create New Reward'}
              </h3>
              <button onClick={() => setShowRewardModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveReward}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Reward Title</label>
                <input type="text" className="form-input" placeholder="e.g. Free Cappuccino" value={rewardName} onChange={(e) => setRewardName(e.target.value)} required />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Description</label>
                <input type="text" className="form-input" placeholder="Single origin espresso with fresh milk" value={rewardDesc} onChange={(e) => setRewardDesc(e.target.value)} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Reward Item</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Margherita Pizza"
                  value={rewardItem}
                  onChange={(e) => setRewardItem(e.target.value)}
                />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Points Required</label>
                <input type="number" className="form-input" value={rewardPoints} onChange={(e) => setRewardPoints(e.target.value)} required />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Cover Image URL</label>
                <input type="url" className="form-input" placeholder="https://images.unsplash.com/..." value={rewardImg} onChange={(e) => setRewardImg(e.target.value)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowRewardModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingRewardId ? 'Update Reward' : 'Publish Reward'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
