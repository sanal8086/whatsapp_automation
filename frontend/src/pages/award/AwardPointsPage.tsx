import React, { useState, useEffect } from 'react';
import { Award, CheckCircle2, Coins } from 'lucide-react';
import { apiRequest } from '../../api/client';
import { Customer, LoyaltyProgram } from '../../types';
import { alertError, alertWarning } from '../../utils/alert';

// Default expiry: same day next month
const getDefaultExpiry = (): string => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().split('T')[0];
};

const phonesMatch = (customerPhone: string, enteredDigits: string): boolean => {
  const cd = (customerPhone || '').replace(/\D/g, '');
  return cd === enteredDigits || cd.endsWith(enteredDigits) || enteredDigits.endsWith(cd.slice(-10));
};

export const AwardPointsPage: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [nameLocked, setNameLocked] = useState(false);
  const [spendAmount, setSpendAmount] = useState('500');
  const [visitCount, setVisitCount] = useState('1');
  const [awardDesc, setAwardDesc] = useState('In-store purchase');
  const [expiryDate, setExpiryDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);

  useEffect(() => {
    apiRequest<LoyaltyProgram>('/loyalty/program')
      .then(setProgram)
      .catch(() => setProgram(null));
  }, []);

  // Look up existing customer by phone: fetch name from DB and lock the field
  useEffect(() => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) {
      setNameLocked(false);
      return;
    }
    const timer = setTimeout(() => {
      apiRequest<{ items: Customer[] }>(`/customers?search=${encodeURIComponent(phone.trim())}&skip=0&limit=20`)
        .then((data) => {
          const found = data.items.find((c) => phonesMatch(c.phone_normalized || c.phone, digits));
          if (found) {
            setFirstName(found.first_name || '');
            setNameLocked(true);
          } else {
            setNameLocked(false);
          }
        })
        .catch(() => setNameLocked(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [phone]);

  const pointsName = program?.points_currency_name || 'Points';
  const earnRate = program?.earn_rate ?? 1;
  const earnUnit = program?.earn_spend_unit ?? 10;
  const isVisitBased = program?.earn_type === 'VISIT_BASED';

  // Same formula as backend
  const pointsPerVisit = isVisitBased ? Math.max(1, Math.floor((1 / (earnUnit || 1)) * earnRate)) : 0;
  const previewPoints = (() => {
    if (isVisitBased) {
      const visits = parseInt(visitCount) || 0;
      return Math.max(1, pointsPerVisit * Math.max(0, visits));
    }
    const amount = parseFloat(spendAmount) || 0;
    if (earnUnit > 0) {
      return Math.max(1, Math.floor((amount / earnUnit) * earnRate));
    }
    return Math.max(1, Math.floor(amount * 0.1));
  })();

  const avatarLetter = (firstName.trim().charAt(0) || phone.replace(/\D/g, '').slice(-1) || 'C').toUpperCase();

  const handleAwardPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      alertWarning('Phone number is required.');
      return;
    }
    if (isVisitBased) {
      const visits = parseInt(visitCount) || 0;
      if (visits < 1) {
        alertWarning('Number of visits must be at least 1.');
        return;
      }
    } else {
      const amount = parseFloat(spendAmount) || 0;
      if (amount < 1) {
        alertWarning('Bill amount must be at least ₹1.');
        return;
      }
    }

    setSubmitting(true);
    setSuccessMsg('');
    try {
      // Find existing customer by phone
      const data = await apiRequest<{ items: Customer[] }>(
        `/customers?search=${encodeURIComponent(phone.trim())}&skip=0&limit=20`
      );
      const digits = phone.replace(/\D/g, '');
      let customer = data.items.find((c) => phonesMatch(c.phone_normalized || c.phone, digits));

      // Create on the fly if not enrolled yet
      if (!customer) {
        customer = await apiRequest<Customer>('/customers', {
          method: 'POST',
          body: JSON.stringify({
            phone: phone.trim(),
            first_name: firstName.trim() || undefined,
            marketing_consent: true,
            whatsapp_consent: true,
          }),
        });
      }

      const res = await apiRequest<{
        points?: number;
        balance_after?: number;
        whatsapp_sent?: boolean;
        whatsapp_error?: string;
        redeem_cta_sent?: boolean;
        redeem_cta_error?: string;
      }>('/loyalty/earn', {
        method: 'POST',
          body: JSON.stringify({
            customer_id: customer.id,
            amount_spent: isVisitBased ? 0 : parseFloat(spendAmount) || 0,
            visits: isVisitBased ? parseInt(visitCount) || 1 : undefined,
            description: awardDesc,
            expiry_date: expiryDate || undefined,
          }),
      });

      const name = customer.first_name || firstName.trim() || phone.trim();
      const awarded = res?.points;
      const balance = res?.balance_after;
      setSuccessMsg(
        awarded !== undefined && balance !== undefined
          ? `Awarded +${awarded} ${pointsName} to ${name}. New balance: ${balance} ${pointsName}`
          : `Points awarded to ${name}`
      );
      if (res?.whatsapp_sent) {
        setSuccessMsg((m) => `${m} • WhatsApp message sent to ${customer.phone_normalized || customer.phone}`);
      } else if (res?.whatsapp_error) {
        setSuccessMsg((m) => `${m} • WhatsApp not sent: ${res.whatsapp_error}`);
      }
      if (res?.redeem_cta_sent) {
        setSuccessMsg((m) => `${m} • Redeem points link sent`);
      }
    } catch (err: any) {
      alertError(err.message || 'Error awarding points');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
      {/* Header */}
      <div style={{ width: '100%', maxWidth: '960px' }}>
        <h1 className="page-title">Award Points</h1>
        <p className="page-subtitle">
          {isVisitBased
            ? 'Enter the customer\'s phone number and visits to credit loyalty points.'
            : 'Enter the customer\'s phone number and bill details to credit loyalty points.'}
        </p>
      </div>

      <div className="card" style={{ padding: '32px', width: '100%', maxWidth: '960px' }}>
        {/* Live avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'var(--primary-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.35rem',
              fontWeight: 800,
              color: 'var(--text-main)',
              boxShadow: 'var(--shadow-md)',
              flexShrink: 0,
            }}
          >
            {avatarLetter}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>
              {firstName.trim() || (phone.trim() ? phone.trim() : 'Customer')}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              {phone.trim() ? 'Ready to award' : 'Enter phone to continue'}
            </div>
          </div>
        </div>

        {successMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              padding: '12px 14px',
              borderRadius: '8px',
              marginBottom: '18px',
              fontSize: '0.85rem',
              color: 'var(--success)',
              fontWeight: 600,
            }}
          >
            <CheckCircle2 size={16} />
            {successMsg}
          </div>
        )}

        <form onSubmit={handleAwardPoints}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Phone Number *
            </label>
            <input
              type="tel"
              className="form-input"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              First Name {nameLocked ? '(existing customer)' : '(optional)'}
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Rohan"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={nameLocked}
              style={nameLocked ? { backgroundColor: 'var(--bg-subtle, #f5f5f5)', cursor: 'not-allowed' } : undefined}
            />
          </div>

          {isVisitBased ? (
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Number of Visits
              </label>
              <input
                type="number"
                className="form-input"
                min="1"
                step="1"
                value={visitCount}
                onChange={(e) => setVisitCount(e.target.value)}
                required
              />
            </div>
          ) : (
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Bill Amount Spent (INR)
              </label>
              <input
                type="number"
                className="form-input"
                min="1"
                step="any"
                value={spendAmount}
                onChange={(e) => setSpendAmount(e.target.value)}
                required
              />
            </div>
          )}

          {/* Live points preview — mirrors backend earn rule */}
          <div
            style={{
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: 'var(--primary-bg)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <Coins size={18} color="var(--primary)" />
            <div>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>
                {previewPoints} {pointsName}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                {isVisitBased
                  ? `${pointsPerVisit} ${pointsName} per visit`
                  : `${earnRate} ${pointsName} per ₹${earnUnit} spent`}
              </span>
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Points Expiry Date
            </label>
            <input
              type="date"
              className="form-input"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Transaction Note
            </label>
            <input
              type="text"
              className="form-input"
              value={awardDesc}
              onChange={(e) => setAwardDesc(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              <Award size={15} />
              {submitting ? 'Awarding...' : 'Confirm & Award'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
