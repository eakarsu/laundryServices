import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiUser, FiPhone, FiMapPin, FiClock, FiTruck, FiDollarSign, FiCheck } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';

function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const statuses = ['PENDING', 'PICKED_UP', 'PROCESSING', 'CLEANING', 'PRESSING', 'QUALITY_CHECK', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'];

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      const res = await api.get(`/orders/${id}`);
      setOrder(res.data);
    } catch (error) {
      toast.error('Error fetching order');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    try {
      await api.patch(`/orders/${id}/status`, { status: newStatus });
      toast.success(`Order status updated to ${newStatus}`);
      fetchOrder();
    } catch (error) {
      toast.error('Error updating status');
    }
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      PENDING: 'badge-warning',
      PICKED_UP: 'badge-info',
      PROCESSING: 'badge-primary',
      CLEANING: 'badge-primary',
      PRESSING: 'badge-primary',
      QUALITY_CHECK: 'badge-info',
      READY: 'badge-success',
      OUT_FOR_DELIVERY: 'badge-info',
      DELIVERED: 'badge-success',
      COMPLETED: 'badge-success',
      CANCELLED: 'badge-danger'
    };
    return statusColors[status] || 'badge-secondary';
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  if (!order) {
    return <div className="empty-state"><h3>Order not found</h3></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Order {order.orderNumber}</h1>
          <div className="flex gap-2" style={{ marginTop: 8 }}>
            <span className={`badge ${getStatusBadge(order.status)}`}>{order.status.replace('_', ' ')}</span>
            {order.isRush && <span className="badge badge-danger">RUSH ORDER</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <select
            className="form-select"
            value={order.status}
            onChange={(e) => handleStatusUpdate(e.target.value)}
            style={{ width: 200 }}
          >
            {statuses.map(s => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid-3">
        <div className="card">
          <h4 style={{ marginBottom: 16 }}>
            <FiUser style={{ marginRight: 8 }} />
            Customer
          </h4>
          <div style={{ fontSize: 14 }}>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>
              {order.customer?.firstName} {order.customer?.lastName}
            </p>
            <p style={{ color: '#64748b', marginBottom: 4 }}>{order.customer?.email}</p>
            <p style={{ color: '#64748b' }}>{order.customer?.phone}</p>
            <div style={{ marginTop: 12 }}>
              <Link to={`/customers/${order.customerId}`} className="btn btn-outline btn-sm">
                View Customer
              </Link>
            </div>
          </div>
        </div>

        <div className="card">
          <h4 style={{ marginBottom: 16 }}>
            <FiTruck style={{ marginRight: 8 }} />
            Pickup
          </h4>
          {order.pickup ? (
            <div style={{ fontSize: 14 }}>
              <p style={{ marginBottom: 4 }}>
                <span className={`badge ${order.pickup.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                  {order.pickup.status}
                </span>
              </p>
              <p style={{ color: '#64748b', marginBottom: 4 }}>
                {order.pickup.address?.street}, {order.pickup.address?.city}
              </p>
              <p style={{ color: '#64748b' }}>
                {new Date(order.pickup.scheduledStart).toLocaleString()}
              </p>
              {order.pickup.driver && (
                <p style={{ marginTop: 8 }}>
                  Driver: {order.pickup.driver.firstName} {order.pickup.driver.lastName}
                </p>
              )}
            </div>
          ) : (
            <p style={{ color: '#64748b' }}>No pickup scheduled</p>
          )}
        </div>

        <div className="card">
          <h4 style={{ marginBottom: 16 }}>
            <FiMapPin style={{ marginRight: 8 }} />
            Delivery
          </h4>
          {order.delivery ? (
            <div style={{ fontSize: 14 }}>
              <p style={{ marginBottom: 4 }}>
                <span className={`badge ${order.delivery.status === 'DELIVERED' ? 'badge-success' : 'badge-warning'}`}>
                  {order.delivery.status}
                </span>
              </p>
              <p style={{ color: '#64748b', marginBottom: 4 }}>
                {order.delivery.address?.street}, {order.delivery.address?.city}
              </p>
              <p style={{ color: '#64748b' }}>
                {new Date(order.delivery.scheduledStart).toLocaleString()}
              </p>
              {order.delivery.driver && (
                <p style={{ marginTop: 8 }}>
                  Driver: {order.delivery.driver.firstName} {order.delivery.driver.lastName}
                </p>
              )}
            </div>
          ) : (
            <p style={{ color: '#64748b' }}>No delivery scheduled</p>
          )}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h4 style={{ marginBottom: 16 }}>Order Items</h4>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Tag</th>
                  <th>Service</th>
                  <th>Garment</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map(item => (
                  <tr key={item.id}>
                    <td><code>{item.tagNumber}</code></td>
                    <td>{item.service?.name}</td>
                    <td>{item.garmentType?.name}</td>
                    <td>{item.quantity}</td>
                    <td>${parseFloat(item.totalPrice).toFixed(2)}</td>
                    <td>
                      <span className={`badge ${item.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h4 style={{ marginBottom: 16 }}>
            <FiDollarSign style={{ marginRight: 8 }} />
            Payment Summary
          </h4>
          <div style={{ fontSize: 14 }}>
            <div className="flex-between" style={{ marginBottom: 8 }}>
              <span style={{ color: '#64748b' }}>Subtotal</span>
              <span>${parseFloat(order.subtotal).toFixed(2)}</span>
            </div>
            {parseFloat(order.discount) > 0 && (
              <div className="flex-between" style={{ marginBottom: 8, color: '#22c55e' }}>
                <span>Discount</span>
                <span>-${parseFloat(order.discount).toFixed(2)}</span>
              </div>
            )}
            {parseFloat(order.rushFee) > 0 && (
              <div className="flex-between" style={{ marginBottom: 8 }}>
                <span style={{ color: '#64748b' }}>Rush Fee</span>
                <span>${parseFloat(order.rushFee).toFixed(2)}</span>
              </div>
            )}
            <div className="flex-between" style={{ marginBottom: 8 }}>
              <span style={{ color: '#64748b' }}>Tax</span>
              <span>${parseFloat(order.tax).toFixed(2)}</span>
            </div>
            <div className="flex-between" style={{ marginBottom: 16, paddingTop: 8, borderTop: '1px solid #e2e8f0', fontWeight: 600, fontSize: 18 }}>
              <span>Total</span>
              <span>${parseFloat(order.total).toFixed(2)}</span>
            </div>
            <div className="flex-between" style={{ marginBottom: 8 }}>
              <span style={{ color: '#64748b' }}>Paid</span>
              <span style={{ color: '#22c55e' }}>${parseFloat(order.paidAmount).toFixed(2)}</span>
            </div>
            <div className="flex-between" style={{ marginBottom: 16 }}>
              <span style={{ color: '#64748b' }}>Balance Due</span>
              <span style={{ color: parseFloat(order.total) - parseFloat(order.paidAmount) > 0 ? '#ef4444' : '#22c55e' }}>
                ${(parseFloat(order.total) - parseFloat(order.paidAmount)).toFixed(2)}
              </span>
            </div>

            {order.coupon && (
              <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8, marginBottom: 16 }}>
                <span className="badge badge-success">Coupon Applied: {order.coupon.code}</span>
              </div>
            )}

            <h5 style={{ marginBottom: 12 }}>Payments</h5>
            {order.payments?.map(payment => (
              <div key={payment.id} className="flex-between" style={{ marginBottom: 8, fontSize: 13 }}>
                <span>{payment.type} - {new Date(payment.createdAt).toLocaleDateString()}</span>
                <span className={`badge ${payment.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                  ${parseFloat(payment.amount).toFixed(2)}
                </span>
              </div>
            ))}
            {(!order.payments || order.payments.length === 0) && (
              <p style={{ color: '#64748b', fontSize: 13 }}>No payments recorded</p>
            )}
          </div>
        </div>
      </div>

      {order.specialInstructions && (
        <div className="card">
          <h4 style={{ marginBottom: 12 }}>Special Instructions</h4>
          <p style={{ color: '#64748b' }}>{order.specialInstructions}</p>
        </div>
      )}
    </div>
  );
}

export default OrderDetail;
