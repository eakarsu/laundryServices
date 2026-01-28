import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiPercent, FiDollarSign } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';

function Coupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCoupon, setEditCoupon] = useState(null);
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

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Coupons & Promotions</h1>
          <p className="page-subtitle">Create and manage discount codes</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <FiPlus /> Add Coupon
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Description</th>
                <th>Discount</th>
                <th>Min Order</th>
                <th>Usage</th>
                <th>Valid Period</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map(coupon => (
                <tr key={coupon.id}>
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
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={() => openModal(coupon)}>
                      <FiEdit />
                    </button>
                  </td>
                </tr>
              ))}
              {coupons.length === 0 && (
                <tr>
                  <td colSpan="8" className="text-center" style={{ padding: 40, color: '#64748b' }}>
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
    </div>
  );
}

export default Coupons;
