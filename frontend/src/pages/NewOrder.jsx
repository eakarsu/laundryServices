import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiTrash2, FiPercent } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';

function NewOrder() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [garments, setGarments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [items, setItems] = useState([{ serviceId: '', garmentTypeId: '', quantity: 1 }]);
  const [isRush, setIsRush] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponValid, setCouponValid] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [customersRes, servicesRes, garmentsRes] = await Promise.all([
        api.get('/customers?limit=100'),
        api.get('/services'),
        api.get('/garments')
      ]);
      setCustomers(customersRes.data.customers);
      setServices(servicesRes.data);
      setGarments(garmentsRes.data);
    } catch (error) {
      toast.error('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    setItems([...items, { serviceId: '', garmentTypeId: '', quantity: 1 }]);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const validateCoupon = async () => {
    if (!couponCode) return;
    try {
      const res = await api.get(`/coupons/code/${couponCode}`);
      if (res.data.isValid) {
        setCouponValid(res.data);
        toast.success('Coupon applied!');
      } else {
        setCouponValid(null);
        toast.error(res.data.reason);
      }
    } catch (error) {
      setCouponValid(null);
      toast.error('Invalid coupon code');
    }
  };

  const calculateTotal = () => {
    let subtotal = 0;
    items.forEach(item => {
      if (item.serviceId && item.garmentTypeId) {
        const service = services.find(s => s.id === item.serviceId);
        const garment = garments.find(g => g.id === item.garmentTypeId);
        if (service && garment) {
          subtotal += parseFloat(garment.basePrice) * item.quantity;
        }
      }
    });

    let discount = 0;
    if (couponValid) {
      if (couponValid.discountType === 'PERCENTAGE') {
        discount = subtotal * (parseFloat(couponValid.discountValue) / 100);
        if (couponValid.maxDiscount) {
          discount = Math.min(discount, parseFloat(couponValid.maxDiscount));
        }
      } else {
        discount = parseFloat(couponValid.discountValue);
      }
    }

    const rushFee = isRush ? subtotal * 0.5 : 0;
    const tax = (subtotal - discount + rushFee) * 0.08;
    const total = subtotal - discount + rushFee + tax;

    return { subtotal, discount, rushFee, tax, total };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedCustomer) {
      toast.error('Please select a customer');
      return;
    }

    const validItems = items.filter(i => i.serviceId && i.garmentTypeId);
    if (validItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    setSubmitting(true);
    try {
      const orderData = {
        customerId: selectedCustomer,
        items: validItems,
        isRush,
        rushFee: isRush ? calculateTotal().rushFee : 0,
        specialInstructions,
        couponCode: couponValid ? couponCode : undefined
      };

      const res = await api.post('/orders', orderData);
      toast.success('Order created successfully!');
      navigate(`/orders/${res.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error creating order');
    } finally {
      setSubmitting(false);
    }
  };

  const totals = calculateTotal();

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">New Order</h1>
          <p className="page-subtitle">Create a new laundry order</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid-2">
          <div>
            <div className="card">
              <h4 style={{ marginBottom: 16 }}>Customer</h4>
              <div className="form-group">
                <label className="form-label">Select Customer *</label>
                <select
                  className="form-select"
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  required
                >
                  <option value="">Choose a customer...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName} ({c.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="card">
              <div className="flex-between" style={{ marginBottom: 16 }}>
                <h4>Order Items</h4>
                <button type="button" className="btn btn-outline btn-sm" onClick={addItem}>
                  <FiPlus /> Add Item
                </button>
              </div>

              {items.map((item, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 40px', gap: 12, marginBottom: 12 }}>
                  <select
                    className="form-select"
                    value={item.serviceId}
                    onChange={(e) => updateItem(index, 'serviceId', e.target.value)}
                    required
                  >
                    <option value="">Select service...</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <select
                    className="form-select"
                    value={item.garmentTypeId}
                    onChange={(e) => updateItem(index, 'garmentTypeId', e.target.value)}
                    required
                  >
                    <option value="">Select garment...</option>
                    {garments.map(g => (
                      <option key={g.id} value={g.id}>{g.name} (${parseFloat(g.basePrice).toFixed(2)})</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                  />
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                    style={{ padding: 8 }}
                  >
                    <FiTrash2 />
                  </button>
                </div>
              ))}
            </div>

            <div className="card">
              <h4 style={{ marginBottom: 16 }}>Options</h4>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isRush}
                    onChange={(e) => setIsRush(e.target.checked)}
                  />
                  <span>Rush Order (+50% fee)</span>
                </label>
              </div>
              <div className="form-group">
                <label className="form-label">Special Instructions</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Any special handling instructions..."
                />
              </div>
            </div>
          </div>

          <div>
            <div className="card">
              <h4 style={{ marginBottom: 16 }}>Coupon</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter coupon code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                />
                <button type="button" className="btn btn-outline" onClick={validateCoupon}>
                  <FiPercent /> Apply
                </button>
              </div>
              {couponValid && (
                <div style={{ marginTop: 12, padding: 12, background: '#f0fdf4', borderRadius: 8 }}>
                  <span className="badge badge-success">{couponValid.description}</span>
                </div>
              )}
            </div>

            <div className="card">
              <h4 style={{ marginBottom: 16 }}>Order Summary</h4>
              <div style={{ fontSize: 14 }}>
                <div className="flex-between" style={{ marginBottom: 8 }}>
                  <span style={{ color: '#64748b' }}>Subtotal</span>
                  <span>${totals.subtotal.toFixed(2)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex-between" style={{ marginBottom: 8, color: '#22c55e' }}>
                    <span>Discount</span>
                    <span>-${totals.discount.toFixed(2)}</span>
                  </div>
                )}
                {totals.rushFee > 0 && (
                  <div className="flex-between" style={{ marginBottom: 8 }}>
                    <span style={{ color: '#64748b' }}>Rush Fee</span>
                    <span>${totals.rushFee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex-between" style={{ marginBottom: 8 }}>
                  <span style={{ color: '#64748b' }}>Tax (8%)</span>
                  <span>${totals.tax.toFixed(2)}</span>
                </div>
                <div className="flex-between" style={{ paddingTop: 12, borderTop: '1px solid #e2e8f0', fontWeight: 600, fontSize: 18 }}>
                  <span>Total</span>
                  <span>${totals.total.toFixed(2)}</span>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                style={{ width: '100%', marginTop: 24 }}
                disabled={submitting}
              >
                {submitting ? 'Creating Order...' : 'Create Order'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default NewOrder;
