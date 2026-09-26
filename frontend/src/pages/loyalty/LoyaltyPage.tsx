import React, { useState, useEffect } from 'react';
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
  Download
} from 'lucide-react';
import { apiRequest, apiDownload } from '../../api/client';
import { LoyaltyProgram, LoyaltyReward, LoyaltyTransaction } from '../../types';

export const LoyaltyPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'rewards' | 'rules' | 'ledger'>('rewards');
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
  const [rewardCash, setRewardCash] = useState('150');
  const [rewardImg, setRewardImg] = useState('');

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
    try {
      if (editingRewardId) {
        await apiRequest(`/loyalty/rewards/${editingRewardId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: rewardName,
            description: rewardDesc,
            points_required: parseInt(rewardPoints),
            cash_value: parseFloat(rewardCash) || 0,
            image_url: rewardImg || undefined,
          }),
        });
      } else {
        await apiRequest('/loyalty/rewards', {
          method: 'POST',
          body: JSON.stringify({
            name: rewardName,
            description: rewardDesc,
            points_required: parseInt(rewardPoints),
            cash_value: parseFloat(rewardCash) || 0,
            image_url: rewardImg || undefined,
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
      setRewardCash('150');
      setRewardImg('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error saving reward');
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
      alert('Loyalty program rules saved!');
    } catch (err: any) {
      alert(err.message || 'Error updating rules');
    } finally {
      setSavingRules(false);
    }
  };

  const openEditReward = (r: LoyaltyReward) => {
    setEditingRewardId(r.id);
    setRewardName(r.name);
    setRewardDesc(r.description || '');
    setRewardPoints(String(r.points_required));
    setRewardCash(String(r.cash_value));
    setRewardImg(r.image_url || '');
    setShowRewardModal(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Loyalty Engine & Rewards
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
            Configure points accrual rules, manage redeemable rewards & audit the immutable points ledger.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingRewardId(null);
            setRewardName('');
            setRewardDesc('');
            setRewardPoints('200');
            setRewardCash('150');
            setRewardImg('');
            setShowRewardModal(true);
          }}
          className="btn btn-primary"
        >
          <PlusCircle size={15} />
          Create Reward
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', gap: '24px' }}>
        <button
          onClick={() => setActiveTab('rewards')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'rewards' ? '2px solid var(--primary)' : '2px solid transparent',
            padding: '12px 4px',
            color: activeTab === 'rewards' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Gift size={16} />
          Rewards Catalog ({rewards.length})
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'rules' ? '2px solid var(--primary)' : '2px solid transparent',
            padding: '12px 4px',
            color: activeTab === 'rules' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Settings size={16} />
          Program Rules & Bonuses
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'ledger' ? '2px solid var(--primary)' : '2px solid transparent',
            padding: '12px 4px',
            color: activeTab === 'ledger' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <History size={16} />
          Audit Ledger ({transactions.length})
        </button>
      </div>

      {/* Tab 1: Rewards Grid */}
      {activeTab === 'rewards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {rewards.map((r) => (
            <div key={r.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {r.image_url ? (
                <img
                  src={r.image_url}
                  alt={r.name}
                  style={{ width: '100%', height: '150px', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ width: '100%', height: '140px', backgroundColor: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Gift size={36} color="var(--primary)" />
                </div>
              )}
              <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>{r.name}</h3>
                    <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                      {r.points_required} {program?.points_currency_name || 'pts'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                    {r.description || 'Enjoy this exclusive reward voucher.'}
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    Value: ₹{r.cash_value}
                  </span>
                  <button
                    onClick={() => openEditReward(r)}
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                  >
                    <Edit2 size={13} />
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Program Rules */}
      {activeTab === 'rules' && (
        <div className="glass-panel" style={{ padding: '28px', maxWidth: '640px' }}>
          <form onSubmit={handleSaveRules}>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Points Currency Name
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Points, Beans, Stars, Coins"
                value={pointsName}
                onChange={(e) => setPointsName(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Accrual Model
              </label>
              <select className="form-input" value={earnType} onChange={(e) => setEarnType(e.target.value)}>
                <option value="SPEND_BASED">Spend Based (Points earned per ₹ spend)</option>
                <option value="VISIT_BASED">Visit Based (Fixed points per visit)</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Points Earned
                </label>
                <input type="number" className="form-input" value={earnRate} onChange={(e) => setEarnRate(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Per Amount Spent (₹)
                </label>
                <input type="number" className="form-input" value={earnUnit} onChange={(e) => setEarnUnit(e.target.value)} required />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Welcome Bonus Points
                </label>
                <input type="number" className="form-input" value={welcomeBonus} onChange={(e) => setWelcomeBonus(e.target.value)} required />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Awarded on customer signup</span>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Birthday Bonus Points
                </label>
                <input type="number" className="form-input" value={birthdayBonus} onChange={(e) => setBirthdayBonus(e.target.value)} required />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Sent automatically via WhatsApp</span>
              </div>
            </div>

            <button type="submit" disabled={savingRules} className="btn btn-primary">
              {savingRules ? 'Saving Changes...' : 'Save Program Rules'}
            </button>
          </form>
        </div>
      )}

      {/* Tab 3: Ledger */}
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
                  alert(err.message || 'Export failed');
                }
              }}
              className="btn btn-secondary"
            >
              <Download size={14} />
              Export Ledger CSV
            </button>
          </div>

          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '16px 20px' }}>Type</th>
                  <th style={{ padding: '16px 20px' }}>Points Change</th>
                <th style={{ padding: '16px 20px' }}>Balance After</th>
                <th style={{ padding: '16px 20px' }}>Description</th>
                <th style={{ padding: '16px 20px' }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '14px 20px' }}>
                    <span className={`badge ${t.points > 0 ? 'badge-success' : 'badge-danger'}`}>
                      {t.type}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px', fontWeight: 700, color: t.points > 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {t.points > 0 ? `+${t.points}` : t.points}
                  </td>
                  <td style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text-main)' }}>
                    {t.balance_after}
                  </td>
                  <td style={{ padding: '14px 20px', color: 'var(--text-muted)' }}>
                    {t.description}
                  </td>
                  <td style={{ padding: '14px 20px', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                    {new Date(t.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Modal: Add/Edit Reward */}
      {showRewardModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel" style={{ width: '450px', padding: '28px' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Points Required</label>
                  <input type="number" className="form-input" value={rewardPoints} onChange={(e) => setRewardPoints(e.target.value)} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Approx Cash Value (₹)</label>
                  <input type="number" className="form-input" value={rewardCash} onChange={(e) => setRewardCash(e.target.value)} />
                </div>
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
