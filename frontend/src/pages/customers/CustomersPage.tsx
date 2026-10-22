import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  PlusCircle,
  Upload,
  Download,
  Eye,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { apiRequest, apiDownload, apiUpload } from '../../api/client';
import { Customer, ImportPreview, ImportResult } from '../../types';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';

const PAGE_SIZE = 7;

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // New Customer Form
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustFirstName, setNewCustFirstName] = useState('');
  const [newCustLastName, setNewCustLastName] = useState('');

  // Bulk File Import State
  const [uploadingFile, setUploadingFile] = useState(false);
  const [executingImport, setExecutingImport] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [columnMapping, setColumnMapping] = useState({
    phone_col: '',
    first_name_col: '',
    last_name_col: '',
  });
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (selectedTier !== 'ALL') query.set('tier', selectedTier);
      query.set('skip', String((page - 1) * PAGE_SIZE));
      query.set('limit', String(PAGE_SIZE));

      const data = await apiRequest<{ items: Customer[]; total: number }>(`/customers?${query.toString()}`);
      setCustomers(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [search, selectedTier, page]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const name = [newCustFirstName, newCustLastName].filter(Boolean).join(' ').trim();
      await apiRequest('/customers', {
        method: 'POST',
        body: JSON.stringify({
          phone: newCustPhone,
          first_name: newCustFirstName,
          last_name: newCustLastName,
          marketing_consent: true,
          whatsapp_consent: true,
        }),
      });
      setShowAddModal(false);
      setNewCustPhone('');
      setNewCustFirstName('');
      setNewCustLastName('');
      alertSuccess(name ? `Customer "${name}" added successfully!` : 'Customer added successfully!');
      fetchCustomers();
    } catch (err: any) {
      alertError(err.message || 'Error adding customer');
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
      const preview = await apiUpload<ImportPreview>('/customers/import/file', formData);
      setImportPreview(preview);

      // Auto-detect phone / first name / last name columns from headers
      const headersLower = preview.headers.map((h) => h.toLowerCase());
      const findCol = (terms: string[]) => {
        const idx = headersLower.findIndex((h) => terms.some((t) => h.includes(t)));
        return idx !== -1 ? preview.headers[idx] : '';
      };

      setColumnMapping({
        phone_col: findCol(['phone', 'mobile', 'cell', 'whatsapp', 'number', 'contact']) || preview.headers[0],
        first_name_col: findCol(['first_name', 'first', 'fname', 'customer_name', 'name']),
        last_name_col: findCol(['last_name', 'last', 'lname', 'surname']),
      });
    } catch (err: any) {
      alertError(err.message || 'File upload error');
    } finally {
      setUploadingFile(false);
      // Allow re-selecting the same file after a failure or new attempt
      e.target.value = '';
    }
  };

  const handleExecuteImport = async () => {
    if (!importPreview) return;
    if (!columnMapping.phone_col) {
      alertWarning('No phone number column was detected in this file.');
      return;
    }

    setExecutingImport(true);
    try {
      const res = await apiRequest<ImportResult>('/customers/import/execute', {
        method: 'POST',
        body: JSON.stringify({
          file_token: importPreview.file_token,
          mapping: columnMapping,
        }),
      });
      setImportResult(res);
      fetchCustomers();
    } catch (err: any) {
      alertError(err.message || 'Import execution failed');
    } finally {
      setExecutingImport(false);
    }
  };

  const handleExportCustomers = async () => {
    try {
      await apiDownload('/customers/export', 'customers_directory.csv');
    } catch (err: any) {
      alertError(err.message || 'Export failed');
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier.toUpperCase()) {
      case 'PLATINUM': return { bg: 'rgba(168, 85, 247, 0.1)', text: '#7C3AED', border: 'rgba(168, 85, 247, 0.25)' };
      case 'GOLD': return { bg: 'rgba(245, 158, 11, 0.1)', text: '#B45309', border: 'rgba(245, 158, 11, 0.25)' };
      case 'SILVER': return { bg: 'rgba(156, 163, 175, 0.12)', text: '#6B7280', border: 'rgba(156, 163, 175, 0.3)' };
      default: return { bg: 'rgba(180, 83, 9, 0.1)', text: '#92400E', border: 'rgba(180, 83, 9, 0.25)' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">
            Customer Directory & CRM
          </h1>
          <p className="page-subtitle">
            Manage loyalty accounts, normalize phone numbers & track customer activity.
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

      {/* All Customers */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Filters Bar */}
        <div className="table-filter-bar">
          <div className="search-pill" style={{ width: '320px' }}>
            <Search size={16} color="var(--text-dim)" />
            <input
              type="text"
              placeholder="Search phone or name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Tier:</span>
            <div className="filter-pills">
              {['ALL', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'].map((tier) => (
                <button
                  key={tier}
                  onClick={() => { setSelectedTier(tier); setPage(1); }}
                  className={`filter-pill ${selectedTier === tier ? 'active' : ''}`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Customers Table */}
        <div className="table-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="table-modern">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Mobile</th>
                  <th>Tier</th>
                  <th>Points Balance</th>
                  <th>Lifetime Spend</th>
                    <th>Visits</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-dim)' }}>
                      Loading customer database...
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '60px', textAlign: 'center', color: 'var(--text-dim)' }}>
                      No customers match this filter. Click "Add Customer" or "Import Excel" to get started.
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => {
                    const tierStyle = getTierBadge(c.tier);
                    const initial = (c.first_name || 'U').charAt(0).toUpperCase();
                    const avatarClass = c.tier === 'PLATINUM' ? 'purple' : c.tier === 'GOLD' ? '' : 'cyan';
                    return (
                      <tr key={c.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div className={`table-avatar ${avatarClass}`}>
                              {initial}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '13.5px' }}>
                                {c.first_name ? `${c.first_name} ${c.last_name || ''}` : 'Unnamed Member'}
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{c.phone_normalized || c.phone}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '13px' }}>
                          {c.phone_normalized || c.phone}
                        </td>
                        <td>
                          <span
                            style={{
                              padding: '4px 12px',
                              borderRadius: '9999px',
                              fontSize: '11px',
                              fontWeight: 700,
                              letterSpacing: '0.04em',
                              backgroundColor: tierStyle.bg,
                              color: tierStyle.text,
                              border: `1px solid ${tierStyle.border}`,
                              display: 'inline-block',
                            }}
                          >
                            {c.tier}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: '#0284c7', fontSize: '14px', fontVariantNumeric: 'tabular-nums' }}>
                            {c.points_balance.toLocaleString()}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '13.5px', fontVariantNumeric: 'tabular-nums' }}>
                          ₹{c.lifetime_spend.toLocaleString()}
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>
                          {c.visits_count}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Link to={`/app/customers/${c.id}`} className="btn-table-action">
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

        {/* Pagination */}
        {!loading && total > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} customers
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                style={{ padding: '5px 12px', fontSize: '0.75rem' }}
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 600 }}>
                Page {page} of {totalPages}
              </span>
              <button
                className="btn btn-secondary"
                style={{ padding: '5px 12px', fontSize: '0.75rem' }}
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Add Customer */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>First Name</label>
                  <input type="text" className="form-input" placeholder="Rohan" value={newCustFirstName} onChange={(e) => setNewCustFirstName(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Last Name</label>
                  <input type="text" className="form-input" placeholder="Sharma" value={newCustLastName} onChange={(e) => setNewCustLastName(e.target.value)} />
                </div>
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
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '680px' }}>
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
                  Upload a spreadsheet (.xlsx, .xls, or .csv) with a phone number column and optional first / last name columns. Headers are detected automatically.
                </p>

                <div
                  style={{
                    border: '2px dashed var(--border-subtle)',
                    borderRadius: '12px',
                    padding: '36px',
                    textAlign: 'center',
                    backgroundColor: 'var(--bg-surface)',
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', backgroundColor: 'var(--primary-bg)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(100, 211, 231, 0.25)' }}>
                  <div>
                    <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.875rem' }}>File: {importPreview.filename}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>{importPreview.total_rows} customer records found</span>
                  </div>
                  <button onClick={() => setImportPreview(null)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                    Choose Different File
                  </button>
                </div>

                <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '10px', padding: '16px', marginBottom: '18px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>
                    Auto-Detected Columns
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Phone (required): </span>
                      <strong>{columnMapping.phone_col || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>First name (optional): </span>
                      <strong>{columnMapping.first_name_col || 'not found — skipped'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Last name (optional): </span>
                      <strong>{columnMapping.last_name_col || 'not found — skipped'}</strong>
                    </div>
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
                    {importResult.errors.length > 0 && (
                      <p style={{ color: '#F87171', fontSize: '0.75rem', marginTop: '8px' }}>
                        {importResult.errors.slice(0, 5).map((msg, i) => (
                          <span key={i} style={{ display: 'block' }}>⚠ {msg}</span>
                        ))}
                        {importResult.errors.length > 5 && (
                          <span>…and {importResult.errors.length - 5} more</span>
                        )}
                      </p>
                    )}
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
    </div>
  );
};
