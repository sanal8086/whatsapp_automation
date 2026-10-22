import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  Gift,
  CheckCircle2,
  X
} from 'lucide-react';
import { apiRequest } from '../../api/client';
import { CustomerDetail, LoyaltyReward } from '../../types';
import { StatCard } from '../../components/ui';
import { alertError } from '../../utils/alert';

export const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showRedeemModal, setShowRedeemModal] = useState(false);

  // Redeem form
  const [selectedRewardId, setSelectedRewardId] = useState('');

  const fetchCustomer = async () => {
    try {
      setLoading(true);
      const [custData, rewardsData] = await Promise.all([
        apiRequest<CustomerDetail>(`/customers/${id}`),
        apiRequest<LoyaltyReward[]>('/loyalty/rewards'),
      ]);
      setCustomer(custData);
      setRewards(rewardsData);
      if (rewardsData.length > 0) {
        setSelectedRewardId(rewardsData[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomer();
  }, [id]);

  const handleRedeemReward = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/loyalty/redeem', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: id,
          reward_id: selectedRewardId,
        }),
      });
      setShowRedeemModal(false);
      fetchCustomer();
    } catch (err: any) {
      alertError(err.message || 'Error redeeming points');
    }
  };

  if (loading || !customer) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
        Loading customer profile...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Back button */}
      <div>
        <Link to="/app/customers" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem' }}>
          <ArrowLeft size={16} />
          Back to Customers
        </Link>
      </div>

      {/* Header Profile Card */}
      <div className="card" style={{ padding: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: 'var(--primary-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              fontWeight: 800,
              color: 'var(--text-main)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            {(customer.first_name || 'C').charAt(0)}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: 28, fontWeight: 550, letterSpacing: '-0.8px', color: 'var(--text-main)', margin: 0 }}>
                {customer.first_name ? `${customer.first_name} ${customer.last_name || ''}` : 'Guest Member'}
              </h1>
              <span className="badge badge-success">{customer.tier} Member</span>
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '6px', color: 'var(--text-muted)', fontSize: '0.85rem', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Phone size={14} color="#10B981" />
                {customer.phone}
              </span>
              {customer.email && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={14} />
                  {customer.email}
                </span>
              )}
              {customer.address && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} />
                  {customer.address}
                </span>
              )}
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} />
                Joined {new Date(customer.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setShowRedeemModal(true)} className="btn btn-secondary">
            <Gift size={15} />
            Redeem Reward
          </button>
        </div>
      </div>

      {/* Stats Cards (Customer Profile Pastel Palette) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
        <StatCard
          label="Current Points Balance"
          value={`${customer.points_balance} pts`}
          delta="Ready for instant redemption"
          tone="mint-ice"
          icon={<Award size={18} />}
        />
        <StatCard
          label="Total Visits"
          value={customer.visits_count.toString()}
          delta="Lifetime check-in frequency"
          tone="cornflower"
          icon={<Calendar size={18} />}
        />
        <StatCard
          label="Lifetime Spend"
          value={`₹${customer.lifetime_spend.toFixed(2)}`}
          delta="Customer revenue contribution"
          tone="peach-blush"
          icon={<DollarSign size={18} />}
        />
      </div>

      {/* Transaction History Ledger */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>
          Loyalty Points Ledger History
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {customer.loyalty_transactions && customer.loyalty_transactions.length > 0 ? (
            customer.loyalty_transactions.map((txn) => (
              <div
                key={txn.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: txn.points > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {txn.points > 0 ? <CheckCircle2 size={16} color="var(--success)" /> : <Gift size={16} color="var(--danger)" />}
                  </div>
                  <div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {txn.description}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      {new Date(txn.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: txn.points > 0 ? 'var(--success)' : 'var(--danger)',
                    }}
                  >
                    {txn.points > 0 ? `+${txn.points}` : txn.points} pts
                  </span>
                  <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                    Balance: {txn.balance_after}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No loyalty transactions yet.</p>
          )}
        </div>
      </div>

      {/* Modal: Redeem Reward */}
      {showRedeemModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="modal-content" style={{ maxWidth: '420px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Redeem Reward</h3>
              <button onClick={() => setShowRedeemModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleRedeemReward}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Select Reward to Claim</label>
                <select className="form-input" value={selectedRewardId} onChange={(e) => setSelectedRewardId(e.target.value)}>
                  {rewards.map((r) => (
                    <option key={r.id} value={r.id} disabled={customer.points_balance < r.points_required}>
                      {r.name} — {r.points_required} pts {customer.points_balance < r.points_required ? '(Insufficient)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowRedeemModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Confirm Claim</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
