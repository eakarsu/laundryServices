import React, { useState, useEffect, useMemo } from 'react';
import { FiPlus, FiEdit, FiPercent, FiDollarSign, FiDownload, FiFileText } from 'react-icons/fi';
import { toast } from 'react-toastify';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../services/api';
import { TableSkeleton } from '../components/LoadingSkeleton';
import RowDetailModal from '../components/RowDetailModal';
import SortableHeader from '../components/SortableHeader';
import BulkActionBar from '../components/BulkActionBar';

function Coupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCoupon, setEditCoupon] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [sortField, setSortField] = useState('code');
  const [sortDirection, setSortDirection] = useState('asc');
  const [selectedIds, setSelectedIds] = useState([]);
  const [formData, setFormData] = useState({
    code: '', description: '', discountType: 'PERCENTAGE', discountValue: '',
    minOrderAmount: '', maxDiscount: '', usageLimit: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: ''
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const res = await api.get('/coupons');
      setCoupons(res.data.coupons);
    } catch (error) {
      toast.error('Error loading coupons');
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

  const sortedCoupons = useMemo(() => {
    const items = [...coupons];
    items.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (sortField === 'discountValue' || sortField === 'minOrderAmount') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
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
  }, [coupons, sortField, sortDirection]);

  const handleSelectAll = () => {
    if (selectedIds.length === coupons.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(coupons.map(c => c.id));
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDeactivate = async () => {
    if (!confirm(`Deactivate ${selectedIds.length} coupon(s)?`)) return;
    try {
      await Promise.all(selectedIds.map(id =>
        api.patch(`/coupons/${id}`, { isActive: false })
      ));
      toast.success(`${selectedIds.length} coupon(s) deactivated`);
      setSelectedIds([]);
      fetchCoupons();
    } catch (error) {
      toast.error('Error deactivating coupons');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editCoupon) {
        await api.put(`/coupons/${editCoupon.id}`, formData);
        toast.success('Coupon updated');
      } else {
        await api.post('/coupons', formData);
        toast.success('Coupon created');
      }
      setShowModal(false);
      setEditCoupon(null);
      fetchCoupons();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error saving coupon');
    }
  };

  const openModal = (coupon = null) => {
    if (coupon) {
      setEditCoupon(coupon);
      setFormData({
        code: coupon.code,
        description: coupon.description || '',
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minOrderAmount: coupon.minOrderAmount || '',
        maxDiscount: coupon.maxDiscount || '',
        usageLimit: coupon.usageLimit || '',
        startDate: new Date(coupon.startDate).toISOString().split('T')[0],
        endDate: new Date(coupon.endDate).toISOString().split('T')[0]
      });
    } else {
      setEditCoupon(null);
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      setFormData({
        code: '', description: '', discountType: 'PERCENTAGE', discountValue: '',
        minOrderAmount: '', maxDiscount: '', usageLimit: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: nextMonth.toISOString().split('T')[0]
      });
    }
    setShowModal(true);
  };

  const isExpired = (endDate) => new Date(endDate) < new Date();
  const isActive = (coupon) => coupon.isActive && !isExpired(coupon.endDate);

  const handleExportCSV = () => {
    const headers = ['Code', 'Description', 'Discount Type', 'Discount Value', 'Min Order', 'Usage', 'Start Date', 'End Date', 'Status'];
    const rows = coupons.map(c => [
      c.code, c.description || '', c.discountType, c.discountValue,
      c.minOrderAmount || '', `${c.usageCount}${c.usageLimit ? '/' + c.usageLimit : ''}`,
      new Date(c.startDate).toLocaleDateString(),
      new Date(c.endDate).toLocaleDateString(),
      isActive(c) ? 'Active' : isExpired(c.endDate) ? 'Expired' : 'Inactive'
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'coupons.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Coupons Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

    autoTable(doc, {
      startY: 35,
      head: [['Code', 'Description', 'Discount', 'Min Order', 'Usage', 'Valid Period', 'Status']],
      body: coupons.map(c => [
        c.code, c.description || '-',
        `${c.discountValue}${c.discountType === 'PERCENTAGE' ? '%' : '$'}`,
        c.minOrderAmount ? `$${c.minOrderAmount}` : '-',
        `${c.usageCount}${c.usageLimit ? '/' + c.usageLimit : ''}`,
        `${new Date(c.startDate).toLocaleDateString()} - ${new Date(c.endDate).toLocaleDateString()}`,
        isActive(c) ? 'Active' : isExpired(c.endDate) ? 'Expired' : 'Inactive'
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [37, 99, 235] }
    });

    doc.save('coupons.pdf');
    toast.success('PDF exported successfully');
  };

  if (loading) {
    return <div style={{ padding: 24 }}><TableSkeleton rows={8} cols={8} /></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Coupons & Promotions</h1>
          <p className="page-subtitle">Create and manage discount codes</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={handleExportCSV} title="Export CSV">
            <FiDownload /> CSV
          </button>
          <button className="btn btn-outline" onClick={handleExportPDF} title="Export PDF">
            <FiFileText /> PDF
          </button>
          <button className="btn btn-primary" onClick={() => openModal()}>
            <FiPlus /> Add Coupon
          </button>
        </div>
      </div>

      <BulkActionBar
        selectedCount={selectedIds.length}
        onBulkDelete={handleBulkDeactivate}
        onBulkUpdate={() => {}}
        onClearSelection={() => setSelectedIds([])}
        updateOptions={[]}
      />

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    checked={coupons.length > 0 && selectedIds.length === coupons.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <SortableHeader label="Code" field="code" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
                <th>Description</th>
                <SortableHeader label="Discount" field="discountValue" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
                <th>Min Order</th>
                <th>Usage</th>
                <SortableHeader label="Start Date" field="startDate" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedCoupons.map(coupon => (
                <tr key={coupon.id} onClick={() => setDetailData(coupon)} style={{ cursor: 'pointer' }}>
                  <td onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(coupon.id)}
                      onChange={() => handleSelectOne(coupon.id)}
                    />
                  </td>
                  <td>
                    <code style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: 4 }}>
                      {coupon.code}
                    </code>
                  </td>
                  <td>{coupon.description || '-'}</td>
                  <td>
                    <span className="flex gap-1" style={{ alignItems: 'center' }}>
                      {coupon.discountType === 'PERCENTAGE' ? <FiPercent size={14} /> : <FiDollarSign size={14} />}
                      {coupon.discountValue}
                      {coupon.discountType === 'PERCENTAGE' ? '%' : ''}
                    </span>
                  </td>
                  <td>{coupon.minOrderAmount ? `$${coupon.minOrderAmount}` : '-'}</td>
                  <td>
                    {coupon.usageCount}{coupon.usageLimit ? `/${coupon.usageLimit}` : ''}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {new Date(coupon.startDate).toLocaleDateString()} -
                    {new Date(coupon.endDate).toLocaleDateString()}
                  </td>
                  <td>
                    <span className={`badge ${isActive(coupon) ? 'badge-success' : 'badge-secondary'}`}>
                      {isActive(coupon) ? 'Active' : isExpired(coupon.endDate) ? 'Expired' : 'Inactive'}
                    </span>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="btn btn-outline btn-sm" onClick={() => openModal(coupon)}>
                      <FiEdit />
                    </button>
                  </td>
                </tr>
              ))}
              {coupons.length === 0 && (
                <tr>
                  <td colSpan="9" className="text-center" style={{ padding: 40, color: '#64748b' }}>
                    No coupons found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editCoupon ? 'Edit' : 'Add'} Coupon</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Coupon Code *</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ textTransform: 'uppercase' }}
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Discount Type *</label>
                    <select
                      className="form-select"
                      value={formData.discountType}
                      onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                    >
                      <option value="PERCENTAGE">Percentage</option>
                      <option value="FIXED_AMOUNT">Fixed Amount</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      Discount Value * {formData.discountType === 'PERCENTAGE' ? '(%)' : '($)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={formData.discountValue}
                      onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Min Order Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={formData.minOrderAmount}
                      onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Max Discount</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={formData.maxDiscount}
                      onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })}
                      placeholder="For percentage discounts"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Usage Limit</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.usageLimit}
                      onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                      placeholder="Leave empty for unlimited"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Start Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editCoupon ? 'Update' : 'Create'} Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailData && (
        <RowDetailModal
          data={detailData}
          title={`Coupon: ${detailData.code}`}
          onClose={() => setDetailData(null)}
        />
      )}
    </div>
  );
}

export default Coupons;
