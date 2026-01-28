import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiTrash2, FiSearch, FiCreditCard, FiDollarSign, FiGift, FiPercent } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';

function POS() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [garments, setGarments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [items, setItems] = useState([]);
  const [isRush, setIsRush] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponValid, setCouponValid] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [submitting, setSubmitting] = useState(false);

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

  const filteredCustomers = customers.filter(c =>
    `${c.firstName} ${c.lastName} ${c.email} ${c.phone}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addItem = (service, garment) => {
    const existingIndex = items.findIndex(
      i => i.serviceId === service.id && i.garmentTypeId === garment.id
    );

    if (existingIndex >= 0) {
      const newItems = [...items];
      newItems[existingIndex].quantity++;
      setItems(newItems);
    } else {
      setItems([...items, {
        serviceId: service.id,
        serviceName: service.name,
        garmentTypeId: garment.id,
        garmentName: garment.name,
        quantity: 1,
        unitPrice: parseFloat(garment.basePrice)
      }]);
    }
  };

  const updateItemQuantity = (index, quantity) => {
    if (quantity < 1) {
      removeItem(index);
      return;
    }
    const newItems = [...items];
    newItems[index].quantity = quantity;
    setItems(newItems);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
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

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

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

  const handleCheckout = async () => {
    if (!selectedCustomer) {
      toast.error('Please select a customer');
      return;
    }
    if (items.length === 0) {
      toast.error('Please add items to the order');
      return;
    }

    setSubmitting(true);
    try {
      const totals = calculateTotals();

      // Create order
      const orderRes = await api.post('/orders', {
        customerId: selectedCustomer.id,
        items: items.map(i => ({
          serviceId: i.serviceId,
          garmentTypeId: i.garmentTypeId,
          quantity: i.quantity,
          unitPrice: i.unitPrice
        })),
        isRush,
        rushFee: totals.rushFee,
        specialInstructions,
        couponCode: couponValid ? couponCode : undefined
      });

      // Process payment
      await api.post('/payments/process', {
        orderId: orderRes.data.id,
        amount: totals.total,
        type: paymentMethod
      });

      toast.success(`Order ${orderRes.data.orderNumber} created and paid!`);

      // Reset form
      setSelectedCustomer(null);
      setItems([]);
      setIsRush(false);
      setSpecialInstructions('');
      setCouponCode('');
      setCouponValid(null);

      // Navigate to order
      navigate(`/orders/${orderRes.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error processing checkout');
    } finally {
      setSubmitting(false);
    }
  };

  const totals = calculateTotals();

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 24, height: 'calc(100vh - 48px)' }}>
      {/* Left Panel - Item Selection */}
      <div style={{ overflow: 'auto' }}>
        <h2 style={{ marginBottom: 16 }}>Point of Sale</h2>

        {/* Customer Selection */}
        {!selectedCustomer ? (
          <div className="card" style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 12 }}>Select Customer</h4>
            <div className="search-box" style={{ marginBottom: 12 }}>
              <FiSearch className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {filteredCustomers.slice(0, 10).map(c => (
                <div
                  key={c.id}
                  onClick={() => setSelectedCustomer(c)}
                  style={{
                    padding: 12,
                    borderBottom: '1px solid #e2e8f0',
                    cursor: 'pointer'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                >
                  <div style={{ fontWeight: 500 }}>{c.firstName} {c.lastName}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{c.email}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="flex-between">
              <div>
                <h4>{selectedCustomer.firstName} {selectedCustomer.lastName}</h4>
                <div style={{ fontSize: 13, color: '#64748b' }}>{selectedCustomer.email}</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setSelectedCustomer(null)}>
                Change
              </button>
            </div>
          </div>
        )}

        {/* Quick Add */}
        <div className="card">
          <h4 style={{ marginBottom: 16 }}>Quick Add Items</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
            {services.slice(0, 4).map(service => (
              <div key={service.id}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{service.name}</div>
                {garments.slice(0, 6).map(garment => (
                  <button
                    key={garment.id}
                    className="btn btn-outline btn-sm"
                    style={{ width: '100%', marginBottom: 4, fontSize: 11 }}
                    onClick={() => addItem(service, garment)}
                  >
                    {garment.name}
                    <br />
                    ${parseFloat(garment.basePrice).toFixed(2)}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Cart & Checkout */}
      <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 4px 6px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ marginBottom: 16 }}>Order Summary</h3>

        {/* Items List */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>
              No items added
            </div>
          ) : (
            items.map((item, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{item.garmentName}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{item.serviceName}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ padding: '4px 8px' }}
                    onClick={() => updateItemQuantity(index, item.quantity - 1)}
                  >
                    -
                  </button>
                  <span style={{ width: 30, textAlign: 'center' }}>{item.quantity}</span>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ padding: '4px 8px' }}
                    onClick={() => updateItemQuantity(index, item.quantity + 1)}
                  >
                    +
                  </button>
                </div>
                <div style={{ width: 70, textAlign: 'right', fontWeight: 500 }}>
                  ${(item.unitPrice * item.quantity).toFixed(2)}
                </div>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ padding: 4 }}
                  onClick={() => removeItem(index)}
                >
                  <FiTrash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Options */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={isRush} onChange={(e) => setIsRush(e.target.checked)} />
            <span>Rush Order (+50%)</span>
          </label>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Coupon code"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              style={{ fontSize: 13 }}
            />
            <button className="btn btn-outline btn-sm" onClick={validateCoupon}>
              <FiPercent />
            </button>
          </div>
          {couponValid && (
            <div style={{ fontSize: 12, color: '#22c55e', marginBottom: 8 }}>
              Coupon applied: {couponValid.description}
            </div>
          )}
        </div>

        {/* Totals */}
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginBottom: 16 }}>
          <div className="flex-between" style={{ marginBottom: 8, fontSize: 14 }}>
            <span>Subtotal</span>
            <span>${totals.subtotal.toFixed(2)}</span>
          </div>
          {totals.discount > 0 && (
            <div className="flex-between" style={{ marginBottom: 8, fontSize: 14, color: '#22c55e' }}>
              <span>Discount</span>
              <span>-${totals.discount.toFixed(2)}</span>
            </div>
          )}
          {totals.rushFee > 0 && (
            <div className="flex-between" style={{ marginBottom: 8, fontSize: 14 }}>
              <span>Rush Fee</span>
              <span>${totals.rushFee.toFixed(2)}</span>
            </div>
          )}
          <div className="flex-between" style={{ marginBottom: 8, fontSize: 14 }}>
            <span>Tax</span>
            <span>${totals.tax.toFixed(2)}</span>
          </div>
          <div className="flex-between" style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>
            <span>Total</span>
            <span>${totals.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Method */}
        <div style={{ marginBottom: 16 }}>
          <label className="form-label" style={{ fontSize: 13 }}>Payment Method</label>
          <div className="flex gap-1">
            {['CASH', 'CREDIT_CARD', 'DEBIT_CARD'].map(method => (
              <button
                key={method}
                className={`btn ${paymentMethod === method ? 'btn-primary' : 'btn-outline'} btn-sm`}
                onClick={() => setPaymentMethod(method)}
                style={{ flex: 1 }}
              >
                {method === 'CASH' ? <FiDollarSign /> : <FiCreditCard />}
                {method.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Checkout Button */}
        <button
          className="btn btn-success btn-lg"
          style={{ width: '100%' }}
          onClick={handleCheckout}
          disabled={submitting || !selectedCustomer || items.length === 0}
        >
          {submitting ? 'Processing...' : `Checkout $${totals.total.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}

export default POS;
