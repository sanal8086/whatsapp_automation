import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Megaphone,
  Users,
  Crown,
  Award,
  Star,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  Image,
  X,
  Upload,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiRequest, apiUpload } from '../../api/client';
import { Campaign, WhatsAppTemplate, WhatsAppConnection } from '../../types';
import { SegmentRules } from '../../components/segments/RuleBuilder';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';

interface AudienceOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  rules: SegmentRules | null;
}

const AUDIENCE_OPTIONS: AudienceOption[] = [
  { id: 'all', label: 'All Customers', icon: React.createElement(Users, { size: 18 }), color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.1)', rules: null },
  { id: 'bronze', label: 'Bronze', icon: React.createElement(Award, { size: 18 }), color: '#A78BFA', bg: 'rgba(167, 139, 250, 0.1)', rules: { operator: 'AND', conditions: [{ field: 'tier', operator: 'eq', value: 'BRONZE' }] } },
  { id: 'silver', label: 'Silver', icon: React.createElement(Star, { size: 18 }), color: '#6B7280', bg: 'rgba(107, 114, 128, 0.1)', rules: { operator: 'AND', conditions: [{ field: 'tier', operator: 'eq', value: 'SILVER' }] } },
  { id: 'gold', label: 'Gold', icon: React.createElement(Crown, { size: 18 }), color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)', rules: { operator: 'AND', conditions: [{ field: 'tier', operator: 'eq', value: 'GOLD' }] } },
  { id: 'platinum', label: 'Platinum', icon: React.createElement(Sparkles, { size: 18 }), color: '#EC4899', bg: 'rgba(236, 72, 153, 0.1)', rules: { operator: 'AND', conditions: [{ field: 'tier', operator: 'eq', value: 'PLATINUM' }] } },
];

export const NewOfferPage: React.FC = () => {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [waConnected, setWaConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [offerName, setOfferName] = useState('');
  const [selectedAudience, setSelectedAudience] = useState<string>('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sent, setSent] = useState(false);

  const [imageMode, setImageMode] = useState<'url' | 'file'>('url');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  useEffect(() => {
    const fetch = async () => {
      try {
        const [tplData, waConn] = await Promise.all([
          apiRequest<WhatsAppTemplate[]>('/whatsapp/templates'),
          apiRequest<WhatsAppConnection>('/whatsapp/connection'),
        ]);
        setTemplates(tplData);
        setWaConnected(waConn.connection_status === 'CONNECTED');
        const preferred = tplData.find((t) => t.name === 'offer_announcement');
        setSelectedTemplateId(preferred?.id || tplData[0]?.id || '');
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const selectedOption = AUDIENCE_OPTIONS.find((o) => o.id === selectedAudience);
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alertWarning('Please select an image file.'); return; }
    setImageFile(file);
    setImageUrl('');
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageFile(null);
    setImageUrl('');
    setImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const previewSrc = imageMode === 'file' ? imagePreview : imageUrl;
  const hasImage = imageMode === 'file' ? !!imageFile : !!imageUrl.trim();

  const handlePreview = async () => {
    const opt = AUDIENCE_OPTIONS.find((o) => o.id === selectedAudience);
    if (!opt) return;
    setPreviewing(true);
    try {
      const body = opt.rules || { operator: 'AND', conditions: [{ field: 'visits_count', operator: 'gte', value: 0 }] };
      const res = await apiRequest<{ matched_count: number }>('/segments/preview', { method: 'POST', body: JSON.stringify(body) });
      setPreviewCount(res.matched_count);
    } catch (err: any) { alertError('Preview failed: ' + err.message); }
    finally { setPreviewing(false); }
  };

  const handleSend = async () => {
    if (!offerName.trim()) { alertWarning('Please enter an offer name.'); return; }
    if (!selectedTemplateId) { alertWarning('No WhatsApp template available.'); return; }
    setSending(true);
    try {
      const opt = AUDIENCE_OPTIONS.find((o) => o.id === selectedAudience);
      const rulesPayload = opt?.rules ? { rules_json: opt.rules } : {};

      // Resolve the offer image: public URL passes through as-is, an uploaded
      // file is uploaded to Meta's media endpoint and we use the media id.
      let imagePayload: string | undefined;
      if (imageMode === 'url' && imageUrl.trim()) {
        imagePayload = imageUrl.trim();
      } else if (imageMode === 'file' && imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        const res = await apiUpload<{ media_id: string }>(`/whatsapp/media?template_id=${encodeURIComponent(selectedTemplateId)}`, formData);
        imagePayload = res.media_id;
      }

      const campaign = await apiRequest<Campaign>('/campaigns', {
        method: 'POST',
        body: JSON.stringify({ name: offerName, ...rulesPayload, template_id: selectedTemplateId, channel: 'WHATSAPP', image_url: imagePayload }),
      });
      await apiRequest(`/campaigns/${campaign.id}/send`, { method: 'POST' });
      alertSuccess('Offer broadcast sent successfully!');
      setSent(true);
    } catch (err: any) { alertError(err.message || 'Failed to send offer'); }
    finally { setSending(false); }
  };

  const resetForm = () => {
    setOfferName('');
    clearImage();
    setSelectedAudience('all');
    setPreviewCount(null);
    setSent(false);
  };

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh', color: 'var(--text-muted)' }}>Loading...</div>;

  if (sent) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: '16px' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckCircle2 size={32} color="#10B981" />
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>Offer Sent!</h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)', textAlign: 'center', maxWidth: '400px' }}>
          Your offer "{offerName}" has been dispatched to {selectedOption?.label || 'all customers'} via WhatsApp.
        </p>
        <button onClick={resetForm} className="btn btn-primary">Send Another Offer</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '860px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header */}
        <div>
          <h1 className="page-title"><Megaphone size={22} style={{ marginRight: '8px', verticalAlign: 'middle' }} />New Offer Run</h1>
          <p className="page-subtitle">Send a new product launch or special offer to your customers via WhatsApp.</p>
        </div>

        {waConnected === false && (
          <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', padding: '12px 16px', borderRadius: '10px', fontSize: '0.85rem', color: '#F59E0B', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <HelpCircle size={18} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>WhatsApp is not connected. <Link to="/app/whatsapp" style={{ color: '#F59E0B', fontWeight: 600, textDecoration: 'underline' }}>Connect WhatsApp</Link></div>
          </div>
        )}

        {/* Row 1: Two Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'stretch' }}>
          {/* Left Card: Offer Name + Image */}
          <div className="card" style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '14px' }}>Offer Name</h3>
            <input type="text" className="form-input" placeholder="e.g. Summer Sale 2026, New Menu Launch" value={offerName} onChange={(e) => setOfferName(e.target.value)} style={{ marginBottom: '20px' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Image size={16} color="var(--primary)" />
                Image <span style={{ fontWeight: 400, color: 'var(--text-dim)', fontSize: '0.82rem' }}>(optional)</span>
              </h3>
              <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-surface)', borderRadius: '8px', padding: '3px' }}>
                <button onClick={() => setImageMode('url')} style={{ padding: '4px 10px', fontSize: '0.72rem', fontWeight: 600, borderRadius: '6px', border: 'none', cursor: 'pointer', background: imageMode === 'url' ? 'var(--bg-surface-elevated)' : 'transparent', color: imageMode === 'url' ? 'var(--text-main)' : 'var(--text-dim)', boxShadow: imageMode === 'url' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>Link</button>
                <button onClick={() => setImageMode('file')} style={{ padding: '4px 10px', fontSize: '0.72rem', fontWeight: 600, borderRadius: '6px', border: 'none', cursor: 'pointer', background: imageMode === 'file' ? 'var(--bg-surface-elevated)' : 'transparent', color: imageMode === 'file' ? 'var(--text-main)' : 'var(--text-dim)', boxShadow: imageMode === 'file' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>Upload</button>
              </div>
            </div>

            {hasImage && previewSrc && (
              <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-subtle)', marginBottom: '10px' }}>
                <img src={previewSrc} alt="" style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <button onClick={clearImage} style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}><X size={13} /></button>
              </div>
            )}

            {imageMode === 'url' ? (
              <input type="url" className="form-input" placeholder="https://example.com/image.jpg" value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setImageFile(null); setImagePreview(''); }} />
            ) : (
              <div>
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp" onChange={handleFileSelect} style={{ display: 'none' }} />
                <div onClick={() => fileInputRef.current?.click()} style={{ padding: '20px', borderRadius: '10px', border: '2px dashed var(--border-subtle)', textAlign: 'center', cursor: 'pointer', color: 'var(--text-dim)' }}>
                  <Upload size={20} style={{ margin: '0 auto 6px', display: 'block' }} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{imageFile ? imageFile.name : 'Click to upload'}</span>
                  <div style={{ fontSize: '0.68rem', marginTop: '2px' }}>PNG, JPG, GIF, WebP</div>
                </div>
              </div>
            )}
          </div>

          {/* Right Card: Choose Customer */}
          <div className="card" style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '14px' }}>Choose Customer</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              {AUDIENCE_OPTIONS.map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => { setSelectedAudience(opt.id); setPreviewCount(null); }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: `2px solid ${selectedAudience === opt.id ? opt.color : 'var(--border-subtle)'}`,
                    backgroundColor: selectedAudience === opt.id ? opt.bg : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: '8px', background: opt.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: opt.color }}>{opt.icon}</div>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem', flex: 1 }}>{opt.label}</span>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${selectedAudience === opt.id ? opt.color : 'var(--border-subtle)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {selectedAudience === opt.id && <div style={{ width: 10, height: 10, borderRadius: '50%', background: opt.color }} />}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button type="button" onClick={handlePreview} disabled={previewing} className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: '0.78rem' }}>
                <Users size={13} />{previewing ? 'Calculating...' : 'Preview Matches'}
              </button>
              {previewCount !== null && <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--success)' }}>{previewCount} customers match</span>}
            </div>
          </div>
        </div>

        {/* Row 2: Send */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            Sending to: <strong style={{ color: 'var(--text-main)' }}>{selectedOption?.label || 'All Customers'}</strong>
          </div>

          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !offerName.trim() || !selectedTemplateId || waConnected === false}
            className="btn btn-whatsapp"
            style={{ fontSize: '0.95rem', padding: '14px 24px', width: '100%', marginTop: '16px' }}
          >
            <Send size={18} />
            {sending ? 'Sending...' : `Send Message to ${selectedOption?.label || 'All Customers'}`}
          </button>
        </div>
      </div>
    </div>
  );
};