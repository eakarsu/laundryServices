import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiCreditCard } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';

function Subscriptions() {
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('plans');
  const [showModal, setShowModal] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [formData, setFormData] = useState({
    name: '', description: '', price: '', billingCycle: 'MONTHLY',
    itemLimit: '', discountPercent: 0, freePickups: 0, freeDeliveries: 0
  });

  const billingCycles = ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [plansRes, subsRes] = await Promise.all([
        api.get('/subscriptions/plans'),
        api.get('/subscriptions')
      ]);
      setPlans(plansRes.data);
      setSubscriptions(subsRes.data.subscriptions || []);
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editPlan) {
        await api.put(`/subscriptions/plans/${editPlan.id}`, formData);
        toast.success('Plan updated');
      } else {
        await api.post('/subscriptions/plans', formData);
        toast.success('Plan created');
      }
      setShowModal(false);
      setEditPlan(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error saving plan');
    }
  };

  const openModal = (plan = null) => {
    if (plan) {
      setEditPlan(plan);
      setFormData({
        name: plan.name,
        description: plan.description || '',
        price: plan.price,
        billingCycle: plan.billingCycle,
        itemLimit: plan.itemLimit || '',
        discountPercent: plan.discountPercent,
        freePickups: plan.freePickups,
        freeDeliveries: plan.freeDeliveries
      });
    } else {
      setEditPlan(null);
      setFormData({
        name: '', description: '', price: '', billingCycle: 'MONTHLY',
        itemLimit: '', discountPercent: 0, freePickups: 0, freeDeliveries: 0
      });
    }
    setShowModal(true);
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Subscriptions</h1>
          <p className="page-subtitle">Manage subscription plans and active subscriptions</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <FiPlus /> Add Plan
        </button>
      </div>

      <div className="tabs" style={{ marginBottom: 24 }}>
        <div className={`tab ${activeTab === 'plans' ? 'active' : ''}`} onClick={() => setActiveTab('plans')}>
          Plans ({plans.length})
        </div>
        <div className={`tab ${activeTab === 'active' ? 'active' : ''}`} onClick={() => setActiveTab('active')}>
          Active Subscriptions ({subscriptions.length})
        </div>
      </div>

      {activeTab === 'plans' && (
        <div className="grid-4">
          {plans.map(plan => (
            <div key={plan.id} className="card" style={{ textAlign: 'center' }}>
              <h4 style={{ marginBottom: 8 }}>{plan.name}</h4>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#2563eb', marginBottom: 8 }}>
                ${parseFloat(plan.price).toFixed(2)}
                <span style={{ fontSize: 14, fontWeight: 400, color: '#64748b' }}>
                  /{plan.billingCycle.toLowerCase()}
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>{plan.description}</p>

              <div style={{ fontSize: 13, textAlign: 'left', marginBottom: 16 }}>
                {plan.discountPercent > 0 && (
                  <div className="flex-between" style={{ marginBottom: 4 }}>
                    <span>Discount</span>
                    <span style={{ fontWeight: 500 }}>{plan.discountPercent}% off</span>
                  </div>
                )}
                {plan.itemLimit && (
                  <div className="flex-between" style={{ marginBottom: 4 }}>
                    <span>Item Limit</span>
                    <span style={{ fontWeight: 500 }}>{plan.itemLimit} items</span>
                  </div>
                )}
                <div className="flex-between" style={{ marginBottom: 4 }}>
                  <span>Free Pickups</span>
                  <span style={{ fontWeight: 500 }}>{plan.freePickups}</span>
                </div>
                <div className="flex-between">
                  <span>Free Deliveries</span>
                  <span style={{ fontWeight: 500 }}>{plan.freeDeliveries}</span>
                </div>
              </div>

              <button className="btn btn-outline" onClick={() => openModal(plan)}>
                <FiEdit /> Edit
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'active' && (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Start Date</th>
                  <th>Renewal Date</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map(sub => (
                  <tr key={sub.id}>
                    <td>{sub.customer?.firstName} {sub.customer?.lastName}</td>
                    <td>{sub.plan?.name}</td>
                    <td>
                      <span className={`badge ${sub.status === 'ACTIVE' ? 'badge-success' : 'badge-secondary'}`}>
                        {sub.status}
                      </span>
                    </td>
                    <td>{new Date(sub.startDate).toLocaleDateString()}</td>
                    <td>{new Date(sub.renewalDate).toLocaleDateString()}</td>
                  </tr>
                ))}
                {subscriptions.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center" style={{ padding: 40, color: '#64748b' }}>
                      No active subscriptions
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editPlan ? 'Edit' : 'Add'} Subscription Plan</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Plan Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Price *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Billing Cycle *</label>
                    <select
                      className="form-select"
                      value={formData.billingCycle}
                      onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value })}
                    >
                      {billingCycles.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Item Limit</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.itemLimit}
                      onChange={(e) => setFormData({ ...formData, itemLimit: e.target.value })}
                      placeholder="Leave empty for unlimited"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Discount %</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.discountPercent}
                      onChange={(e) => setFormData({ ...formData, discountPercent: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Free Pickups</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.freePickups}
                      onChange={(e) => setFormData({ ...formData, freePickups: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Free Deliveries</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.freeDeliveries}
                      onChange={(e) => setFormData({ ...formData, freeDeliveries: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editPlan ? 'Update' : 'Create'} Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Subscriptions;
