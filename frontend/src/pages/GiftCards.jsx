import React, { useState, useEffect, useMemo } from 'react';
import { FiPlus, FiGift, FiCreditCard, FiSearch, FiDownload, FiFileText } from 'react-icons/fi';
import { toast } from 'react-toastify';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../services/api';
import { TableSkeleton } from '../components/LoadingSkeleton';
import RowDetailModal from '../components/RowDetailModal';
import SortableHeader from '../components/SortableHeader';

function GiftCards() {
  const [giftCards, setGiftCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCheckModal, setShowCheckModal] = useState(false);
  const [formData, setFormData] = useState({ amount: '' });
  const [checkCode, setCheckCode] = useState('');
  const [checkResult, setCheckResult] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');

  useEffect(() => {
    fetchGiftCards();
  }, []);

  const fetchGiftCards = async () => {
    try {
      const res = await api.get('/gift-cards');
      setGiftCards(res.data.giftCards);
    } catch (error) {
      toast.error('Error loading gift cards');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedGiftCards = useMemo(() => {
    const items = [...giftCards];
    items.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (sortField === 'balance' || sortField === 'initialValue') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      }
      if (sortField === 'customer') {
        aVal = a.customer ? `${a.customer.firstName} ${a.customer.lastName}` : '';
        bVal = b.customer ? `${b.customer.firstName} ${b.customer.lastName}` : '';
      }
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return items;
  }, [giftCards, sortField, sortDirection]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/gift-cards', formData);
      toast.success(`Gift card created: ${res.data.code}`);
      setShowModal(false);
      setFormData({ amount: '' });
      fetchGiftCards();
    } catch (error) {
      toast.error('Error creating gift card');
    }
  };

  const handleCheckBalance = async () => {
    try {
      const res = await api.post('/gift-cards/check-balance', { code: checkCode });
      setCheckResult(res.data);
    } catch (error) {
      setCheckResult({ valid: false, error: 'Gift card not found' });
    }
  };

  const handleExportCSV = () => {
    const headers = ['Code', 'Balance', 'Initial Value', 'Customer', 'Expiry', 'Status', 'Created'];
    const rows = giftCards.map(c => [
      c.code, parseFloat(c.balance).toFixed(2), parseFloat(c.initialValue).toFixed(2),
      c.customer ? `${c.customer.firstName} ${c.customer.lastName}` : '-',
      c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : 'No expiry',
      c.isActive ? 'Active' : 'Inactive',
      new Date(c.createdAt).toLocaleDateString()
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'gift-cards.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Gift Cards Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Total Balance: $${giftCards.reduce((sum, g) => sum + parseFloat(g.balance), 0).toFixed(2)}`, 14, 34);

    autoTable(doc, {
      startY: 42,
      head: [['Code', 'Balance', 'Initial Value', 'Customer', 'Expiry', 'Status', 'Created']],
      body: giftCards.map(c => [
        c.code, `$${parseFloat(c.balance).toFixed(2)}`, `$${parseFloat(c.initialValue).toFixed(2)}`,
        c.customer ? `${c.customer.firstName} ${c.customer.lastName}` : '-',
        c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : 'No expiry',
        c.isActive ? 'Active' : 'Inactive',
        new Date(c.createdAt).toLocaleDateString()
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [37, 99, 235] }
    });

    doc.save('gift-cards.pdf');
    toast.success('PDF exported successfully');
  };

  if (loading) {
    return <div style={{ padding: 24 }}><TableSkeleton rows={8} cols={7} /></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Gift Cards</h1>
          <p className="page-subtitle">Create and manage gift cards</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={handleExportCSV} title="Export CSV">
            <FiDownload /> CSV
          </button>
          <button className="btn btn-outline" onClick={handleExportPDF} title="Export PDF">
            <FiFileText /> PDF
          </button>
          <button className="btn btn-outline" onClick={() => setShowCheckModal(true)}>
            <FiSearch /> Check Balance
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <FiPlus /> Create Gift Card
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-label">Total Gift Cards</div>
          <div className="stat-value">{giftCards.length}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Active Cards</div>
          <div className="stat-value">{giftCards.filter(g => g.isActive).length}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">Total Balance</div>
          <div className="stat-value">
            ${giftCards.reduce((sum, g) => sum + parseFloat(g.balance), 0).toFixed(2)}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <SortableHeader label="Code" field="code" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
                <SortableHeader label="Balance" field="balance" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
                <SortableHeader label="Initial Value" field="initialValue" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
                <SortableHeader label="Customer" field="customer" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
                <th>Expiry</th>
                <th>Status</th>
                <SortableHeader label="Created" field="createdAt" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {sortedGiftCards.map(card => (
                <tr key={card.id} onClick={() => setDetailData(card)} style={{ cursor: 'pointer' }}>
                  <td>
                    <code style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: 4 }}>
                      {card.code}
                    </code>
                  </td>
                  <td style={{ fontWeight: 600 }}>${parseFloat(card.balance).toFixed(2)}</td>
                  <td>${parseFloat(card.initialValue).toFixed(2)}</td>
                  <td>
                    {card.customer ? `${card.customer.firstName} ${card.customer.lastName}` : '-'}
                  </td>
                  <td>
                    {card.expiryDate ? new Date(card.expiryDate).toLocaleDateString() : 'No expiry'}
                  </td>
                  <td>
                    <span className={`badge ${card.isActive ? 'badge-success' : 'badge-danger'}`}>
                      {card.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{new Date(card.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {giftCards.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center" style={{ padding: 40, color: '#64748b' }}>
                    <FiGift size={32} style={{ marginBottom: 8 }} />
                    <div>No gift cards found</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Create Gift Card</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="25.00"
                    required
                  />
                </div>
                <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
                  <strong>Quick amounts:</strong>
                  <div className="flex gap-1" style={{ marginTop: 8 }}>
                    {[25, 50, 100, 150, 200].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setFormData({ ...formData, amount: amt })}
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <FiGift /> Create Gift Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCheckModal && (
        <div className="modal-overlay" onClick={() => { setShowCheckModal(false); setCheckResult(null); }}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Check Gift Card Balance</h3>
              <button className="modal-close" onClick={() => { setShowCheckModal(false); setCheckResult(null); }}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Gift Card Code</label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    className="form-input"
                    value={checkCode}
                    onChange={(e) => setCheckCode(e.target.value.toUpperCase())}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                  />
                  <button type="button" className="btn btn-primary" onClick={handleCheckBalance}>
                    Check
                  </button>
                </div>
              </div>

              {checkResult && (
                <div style={{
                  padding: 16,
                  background: checkResult.valid ? '#f0fdf4' : '#fef2f2',
                  borderRadius: 8,
                  marginTop: 16
                }}>
                  {checkResult.valid ? (
                    <>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#22c55e' }}>
                        ${parseFloat(checkResult.balance).toFixed(2)}
                      </div>
                      <div style={{ fontSize: 13, color: '#64748b' }}>Available Balance</div>
                      {checkResult.expiryDate && (
                        <div style={{ fontSize: 12, marginTop: 8 }}>
                          Expires: {new Date(checkResult.expiryDate).toLocaleDateString()}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ color: '#ef4444' }}>{checkResult.error}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {detailData && (
        <RowDetailModal
          data={detailData}
          title={`Gift Card: ${detailData.code}`}
          onClose={() => setDetailData(null)}
        />
      )}
    </div>
  );
}

export default GiftCards;
