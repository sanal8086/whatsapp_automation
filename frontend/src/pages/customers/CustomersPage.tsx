import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  Filter,
  PlusCircle,
  Upload,
  Download,
  Award,
  Layers,
  Phone,
  MessageCircle,
  Eye,
  CheckCircle,
  AlertCircle,
  X,
  FileSpreadsheet,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { apiRequest, apiDownload } from '../../api/client';
import { Customer, Segment, ImportPreview } from '../../types';

export const CustomersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'customers' | 'segments'>('customers');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSegmentModal, setShowSegmentModal] = useState(false);

  // New Customer Form
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustFirstName, setNewCustFirstName] = useState('');
  const [newCustLastName, setNewCustLastName] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustCity, setNewCustCity] = useState('');

  // Bulk File Import State
  const [uploadingFile, setUploadingFile] = useState(false);
  const [executingImport, setExecutingImport] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [columnMapping, setColumnMapping] = useState({
    phone_col: '',
    first_name_col: '',
    last_name_col: '',
    email_col: '',
    spend_col: '',
    dob_col: '',
    city_col: '',
  });
  const [importResult, setImportResult] = useState<any>(null);

  // Segment Builder
  const [newSegName, setNewSegName] = useState('');
  const [newSegDesc, setNewSegDesc] = useState('');
  const [segField, setSegField] = useState('inactivity_days');
  const [segOperator, setSegOperator] = useState('greater_than');
  const [segValue, setSegValue] = useState('30');
  const [previewCount, setPreviewCount] = useState<number | null>(null);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (selectedTier !== 'ALL') query.set('tier', selectedTier);

      const data = await apiRequest<Customer[]>(`/customers?${query.toString()}`);
      setCustomers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSegments = async () => {
    try {
      const data = await apiRequest<Segment[]>('/segments');
      setSegments(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [search, selectedTier]);

  useEffect(() => {
    fetchSegments();
  }, []);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/customers', {
        method: 'POST',
        body: JSON.stringify({
          phone: newCustPhone,
          first_name: newCustFirstName,
          last_name: newCustLastName,
          email: newCustEmail,
          city: newCustCity,
          marketing_consent: true,
          whatsapp_consent: true,
        }),
      });
      setShowAddModal(false);
      setNewCustPhone('');
      setNewCustFirstName('');
      setNewCustLastName('');
      setNewCustEmail('');
      setNewCustCity('');
      fetchCustomers();
    } catch (err: any) {
      alert(err.message || 'Error adding customer');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setImportResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const tenantId = localStorage.getItem('tenant_id');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (tenantId) headers['X-Tenant-ID'] = tenantId;

      const res = await fetch('http://localhost:8000/api/v1/customers/import/file', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Failed to read spreadsheet file');
      }

      const preview: ImportPreview = await res.json();
      setImportPreview(preview);

      // Auto-match common header names
      const headersLower = preview.headers.map((h) => h.toLowerCase());
      const findCol = (terms: string[]) => {
        const idx = headersLower.findIndex((h) => terms.some((t) => h.includes(t)));
        return idx !== -1 ? preview.headers[idx] : '';
      };

      setColumnMapping({
        phone_col: findCol(['phone', 'mobile', 'cell', 'whatsapp', 'number', 'contact']) || preview.headers[0],
        first_name_col: findCol(['first_name', 'first', 'fname', 'customer_name', 'name']),
        last_name_col: findCol(['last_name', 'last', 'lname', 'surname']),
        email_col: findCol(['email', 'mail']),
        spend_col: findCol(['spend', 'amount', 'total', 'revenue']),
        dob_col: findCol(['dob', 'birthday', 'birth']),
        city_col: findCol(['city', 'location', 'town']),
      });
    } catch (err: any) {
      alert(err.message || 'File upload error');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!importPreview) return;
    if (!columnMapping.phone_col) {
      alert('Please select which column contains customer phone numbers.');
      return;
    }

    setExecutingImport(true);
    try {
      const res = await apiRequest('/customers/import/execute', {
        method: 'POST',
        body: JSON.stringify({
          file_token: importPreview.file_token,
          mapping: columnMapping,
        }),
      });
      setImportResult(res);
      fetchCustomers();
    } catch (err: any) {
      alert(err.message || 'Import execution failed');
    } finally {
      setExecutingImport(false);
    }
  };

  const handleExportCustomers = async () => {
    try {
      await apiDownload('/customers/export', 'customers_directory.csv');
    } catch (err: any) {
      alert(err.message || 'Export failed');
    }
  };

  const previewSegmentAudience = async () => {
    try {
      const rules = {
        operator: 'AND',
        conditions: [
          {
            field: segField,
            operator: segOperator,
            value: parseFloat(segValue) || segValue,
          },
        ],
      };
      const res = await apiRequest('/segments/preview', {
        method: 'POST',
        body: JSON.stringify(rules),
      });
      setPreviewCount(res.matched_count);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateSegment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/segments', {
        method: 'POST',
        body: JSON.stringify({
          name: newSegName,
          description: newSegDesc,
          rules_json: {
            operator: 'AND',
            conditions: [
              {
                field: segField,
                operator: segOperator,
                value: parseFloat(segValue) || segValue,
              },
            ],
          },
        }),
      });
      setShowSegmentModal(false);
      setNewSegName('');
      setNewSegDesc('');
      fetchSegments();
    } catch (err: any) {
      alert(err.message || 'Error creating segment');
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier.toUpperCase()) {
      case 'PLATINUM': return { bg: 'rgba(168, 85, 247, 0.15)', text: '#C084FC', border: 'rgba(168, 85, 247, 0.3)' };
      case 'GOLD': return { bg: 'rgba(245, 158, 11, 0.15)', text: '#FBBF24', border: 'rgba(245, 158, 11, 0.3)' };
      case 'SILVER': return { bg: 'rgba(156, 163, 175, 0.15)', text: '#E5E7EB', border: 'rgba(156, 163, 175, 0.3)' };
      default: return { bg: 'rgba(180, 83, 9, 0.15)', text: '#FCD34D', border: 'rgba(180, 83, 9, 0.3)' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header and Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Customer Directory & CRM
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
            Manage loyalty accounts, normalize phone numbers & create dynamic target groups.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleExportCustomers} className="btn btn-secondary">
            <Download size={15} />
            Export CSV
          </button>
          <button onClick={() => { setShowImportModal(true); setImportPreview(null); setImportResult(null); }} className="btn btn-secondary">
            <Upload size={15} />
            Import Excel / CSV
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            <PlusCircle size={15} />
            Add Customer
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', gap: '24px' }}>
        <button
          onClick={() => setActiveTab('customers')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'customers' ? '2px solid var(--primary)' : '2px solid transparent',
            padding: '12px 4px',
            color: activeTab === 'customers' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Users size={16} />
          All Customers ({customers.length})
        </button>
        <button
          onClick={() => setActiveTab('segments')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'segments' ? '2px solid var(--primary)' : '2px solid transparent',
            padding: '12px 4px',
            color: activeTab === 'segments' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Layers size={16} />
          Target Segments ({segments.length})
        </button>
      </div>

      {/* Tab 1: All Customers */}
      {activeTab === 'customers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filters Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '320px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '38px' }}
                placeholder="Search phone, name, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Tier:</span>
              {['ALL', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'].map((tier) => (
                <button
                  key={tier}
                  onClick={() => setSelectedTier(tier)}
                  className={`btn ${selectedTier === tier ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>

          {/* Customers Table */}
          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)' }}>
                    <th style={{ padding: '14px 18px', fontWeight: 600 }}>Customer</th>
                    <th style={{ padding: '14px 18px', fontWeight: 600 }}>Mobile</th>
                    <th style={{ padding: '14px 18px', fontWeight: 600 }}>Tier</th>
                    <th style={{ padding: '14px 18px', fontWeight: 600 }}>Points Balance</th>
                    <th style={{ padding: '14px 18px', fontWeight: 600 }}>Lifetime Spend</th>
                    <th style={{ padding: '14px 18px', fontWeight: 600 }}>Visits</th>
                    <th style={{ padding: '14px 18px', fontWeight: 600 }}>WhatsApp</th>
                    <th style={{ padding: '14px 18px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-dim)' }}>
                        Loading customer database...
                      </td>
                    </tr>
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-dim)' }}>
                        No customers match this filter. Click "Add Customer" or "Import Excel" to get started.
                      </td>
                    </tr>
                  ) : (
                    customers.map((c) => {
                      const tierStyle = getTierBadge(c.tier);
                      return (
                        <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background-color 0.15s' }}>
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                              {c.first_name ? `${c.first_name} ${c.last_name || ''}` : 'Unnamed Member'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{c.email || 'No email'}</div>
                          </td>
                          <td style={{ padding: '14px 18px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                            {c.phone_normalized || c.phone}
                          </td>
                          <td style={{ padding: '14px 18px' }}>
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                backgroundColor: tierStyle.bg,
                                color: tierStyle.text,
                                border: `1px solid ${tierStyle.border}`,
                              }}
                            >
                              {c.tier}
                            </span>
                          </td>
                          <td style={{ padding: '14px 18px' }}>
                            <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.95rem' }}>
                              {c.points_balance.toLocaleString()}
                            </span>
                          </td>
                          <td style={{ padding: '14px 18px', color: 'var(--text-main)', fontWeight: 600 }}>
                            ₹{c.lifetime_spend.toLocaleString()}
                          </td>
                          <td style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>
                            {c.visits_count}
                          </td>
                          <td style={{ padding: '14px 18px' }}>
                            {c.whatsapp_consent ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10B981', fontSize: '0.78rem' }}>
                                <CheckCircle size={14} /> Subscribed
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>Opted Out</span>
                            )}
                          </td>
                          <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                            <Link to={`/app/customers/${c.id}`} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem' }}>
                              <Eye size={13} />
                              View 360° Profile
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Target Segments */}
      {activeTab === 'segments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Dynamic segments automatically group customers based on real-time spending, visit frequency, and loyalty tier.
            </p>
            <button onClick={() => setShowSegmentModal(true)} className="btn btn-primary">
              <PlusCircle size={15} />
              Create Segment
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {segments.map((seg) => (
              <div key={seg.id} className="glass-card" style={{ padding: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>{seg.name}</h4>
                  <span className="badge badge-primary">{seg.cached_count} Members</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px', minHeight: '36px' }}>
                  {seg.description || 'Target specific audiences with tailored promotions.'}
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <Link
                    to={`/app/campaigns`}
                    className="btn btn-primary"
                    style={{ padding: '6px 14px', fontSize: '0.75rem' }}
                  >
                    Launch Campaign
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Add Customer */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel" style={{ width: '450px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Add Customer</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddCustomer}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Phone Number (WhatsApp) *
                </label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="+91 98765 43210"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>First Name</label>
                  <input type="text" className="form-input" placeholder="Rohan" value={newCustFirstName} onChange={(e) => setNewCustFirstName(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Last Name</label>
                  <input type="text" className="form-input" placeholder="Sharma" value={newCustLastName} onChange={(e) => setNewCustLastName(e.target.value)} />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Email Address</label>
                <input type="email" className="form-input" placeholder="rohan@example.com" value={newCustEmail} onChange={(e) => setNewCustEmail(e.target.value)} />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>City</label>
                <input type="text" className="form-input" placeholder="Mumbai" value={newCustCity} onChange={(e) => setNewCustCity(e.target.value)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save & Enroll</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Production Excel/CSV Import & Column Mapping */}
      {showImportModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel" style={{ width: '680px', maxHeight: '90vh', overflowY: 'auto', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileSpreadsheet size={22} color="var(--primary)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Excel & CSV Customer Importer</h3>
              </div>
              <button onClick={() => setShowImportModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {!importPreview ? (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
                  Upload your existing customer spreadsheet (.xlsx, .xls, or .csv). Our engine reads headers, lets you map columns visually, normalizes phone numbers, and initializes loyalty accounts.
                </p>

                <div
                  style={{
                    border: '2px dashed var(--border-subtle)',
                    borderRadius: '12px',
                    padding: '36px',
                    textAlign: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    marginBottom: '20px',
                    cursor: 'pointer'
                  }}
                  onClick={() => document.getElementById('file-upload-input')?.click()}
                >
                  <Upload size={32} color="var(--primary)" style={{ margin: '0 auto 12px' }} />
                  <p style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    {uploadingFile ? 'Analyzing spreadsheet...' : 'Click to select Excel (.xlsx) or CSV file'}
                  </p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Supports files with thousands of rows</span>
                  <input
                    id="file-upload-input"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', backgroundColor: 'rgba(79, 70, 229, 0.1)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(79, 70, 229, 0.2)' }}>
                  <div>
                    <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.875rem' }}>File: {importPreview.filename}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>{importPreview.total_rows} customer records found</span>
                  </div>
                  <button onClick={() => setImportPreview(null)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                    Choose Different File
                  </button>
                </div>

                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-main)' }}>
                  Map Spreadsheet Columns to CRM Fields:
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#F87171', marginBottom: '4px' }}>
                      Mobile / Phone (Required) *
                    </label>
                    <select
                      className="form-input"
                      value={columnMapping.phone_col}
                      onChange={(e) => setColumnMapping({ ...columnMapping, phone_col: e.target.value })}
                      required
                    >
                      <option value="">Select column...</option>
                      {importPreview.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Customer Name / First Name
                    </label>
                    <select
                      className="form-input"
                      value={columnMapping.first_name_col}
                      onChange={(e) => setColumnMapping({ ...columnMapping, first_name_col: e.target.value })}
                    >
                      <option value="">-- None / Skip --</option>
                      {importPreview.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Email Address
                    </label>
                    <select
                      className="form-input"
                      value={columnMapping.email_col}
                      onChange={(e) => setColumnMapping({ ...columnMapping, email_col: e.target.value })}
                    >
                      <option value="">-- None / Skip --</option>
                      {importPreview.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Lifetime Spend (₹)
                    </label>
                    <select
                      className="form-input"
                      value={columnMapping.spend_col}
                      onChange={(e) => setColumnMapping({ ...columnMapping, spend_col: e.target.value })}
                    >
                      <option value="">-- None / Skip --</option>
                      {importPreview.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Date of Birth
                    </label>
                    <select
                      className="form-input"
                      value={columnMapping.dob_col}
                      onChange={(e) => setColumnMapping({ ...columnMapping, dob_col: e.target.value })}
                    >
                      <option value="">-- None / Skip --</option>
                      {importPreview.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      City / Location
                    </label>
                    <select
                      className="form-input"
                      value={columnMapping.city_col}
                      onChange={(e) => setColumnMapping({ ...columnMapping, city_col: e.target.value })}
                    >
                      <option value="">-- None / Skip --</option>
                      {importPreview.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>

                {importResult && (
                  <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '14px', borderRadius: '8px', marginBottom: '18px', fontSize: '0.85rem' }}>
                    <p style={{ fontWeight: 700, color: 'var(--success)', marginBottom: '4px' }}>✅ Import Execution Complete!</p>
                    <p style={{ color: 'var(--text-main)', fontSize: '0.8rem' }}>
                      • New Customers Imported: {importResult.imported}<br />
                      • Existing Customers Updated: {importResult.updated}<br />
                      • Invalid / Skipped: {importResult.invalid + importResult.skipped}
                    </p>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" onClick={() => setShowImportModal(false)} className="btn btn-secondary">
                    {importResult ? 'Done' : 'Cancel'}
                  </button>
                  {!importResult && (
                    <button type="button" disabled={executingImport} onClick={handleExecuteImport} className="btn btn-primary">
                      {executingImport ? 'Processing...' : `Execute Import (${importPreview.total_rows} Rows)`}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Create Segment */}
      {showSegmentModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel" style={{ width: '480px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Build Dynamic Segment</h3>
              <button onClick={() => setShowSegmentModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSegment}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Segment Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. VIP Inactive Weekend Spenders"
                  value={newSegName}
                  onChange={(e) => setNewSegName(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Description</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Brief description for campaign targeting"
                  value={newSegDesc}
                  onChange={(e) => setNewSegDesc(e.target.value)}
                />
              </div>

              <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)', marginBottom: '18px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>
                  Targeting Rule (Condition)
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px' }}>
                  <select className="form-input" value={segField} onChange={(e) => setSegField(e.target.value)}>
                    <option value="inactivity_days">Days Inactive</option>
                    <option value="lifetime_spend">Lifetime Spend (₹)</option>
                    <option value="visits_count">Visit Count</option>
                    <option value="points_balance">Points Balance</option>
                    <option value="tier">Loyalty Tier</option>
                  </select>

                  <select className="form-input" value={segOperator} onChange={(e) => setSegOperator(e.target.value)}>
                    <option value="greater_than">&gt; Greater than</option>
                    <option value="less_than">&lt; Less than</option>
                    <option value="equals">= Equals</option>
                  </select>

                  <input
                    type="text"
                    className="form-input"
                    value={segValue}
                    onChange={(e) => setSegValue(e.target.value)}
                  />
                </div>

                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button type="button" onClick={previewSegmentAudience} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                    Calculate Matches
                  </button>
                  {previewCount !== null && (
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)' }}>
                      👥 {previewCount} customers matched
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowSegmentModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Segment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
