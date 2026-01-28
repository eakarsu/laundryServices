import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FiPackage, FiTruck, FiCheck, FiMapPin, FiClock, FiPhone } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';

function OrderTracking() {
  const { orderId } = useParams();
  const [orderNumber, setOrderNumber] = useState('');
  const [tracking, setTracking] = useState(null);
  const [allOrders, setAllOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      fetchTracking(orderId);
    } else {
      fetchAllOrders();
    }
  }, [orderId]);

  useEffect(() => {
    if (orderNumber.trim() === '') {
      setFilteredOrders(allOrders);
    } else {
      const search = orderNumber.toLowerCase();
      const filtered = allOrders.filter(order =>
        order.orderNumber?.toLowerCase().includes(search) ||
        order.customer?.firstName?.toLowerCase().includes(search) ||
        order.customer?.lastName?.toLowerCase().includes(search) ||
        order.status?.toLowerCase().includes(search)
      );
      setFilteredOrders(filtered);
    }
  }, [orderNumber, allOrders]);

  const fetchAllOrders = async () => {
    try {
      const res = await api.get('/orders?limit=50');
      const orders = res.data.orders || res.data.data || res.data || [];
      const orderList = Array.isArray(orders) ? orders : [];
      setAllOrders(orderList);
      setFilteredOrders(orderList);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTracking = async (id) => {
    setLoading(true);
    try {
      const res = await api.get(`/tracking/order/${id}`);
      setTracking(res.data);
    } catch (error) {
      toast.error('Order not found');
      setTracking(null);
    } finally {
      setLoading(false);
    }
  };

  const handleTrackByNumber = async (e) => {
    e.preventDefault();
    if (!orderNumber) return;

    setLoading(true);
    try {
      const res = await api.get(`/tracking/track/${orderNumber}`);
      console.log('Tracking response:', res.data);
      setTracking(res.data);
    } catch (error) {
      console.error('Tracking error:', error);
      toast.error('Order not found');
      setTracking(null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status, completed) => {
    if (completed) {
      return <FiCheck size={20} style={{ color: '#16a34a' }} />;
    }
    switch (status) {
      case 'PICKED_UP':
      case 'OUT_FOR_DELIVERY':
        return <FiTruck size={20} />;
      case 'READY':
        return <FiPackage size={20} />;
      default:
        return <FiClock size={20} />;
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Order Tracking</h1>
          <p className="page-subtitle">Track your order status in real-time</p>
        </div>
      </div>

      {!orderId && !tracking && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>Search Orders</h3>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search by order number, customer name, or status..."
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              style={{ fontSize: 16 }}
            />
          </div>
          {orderNumber && (
            <div style={{ marginTop: 8, fontSize: 13, color: '#64748b' }}>
              Found {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="loading"><div className="spinner"></div></div>
      )}

      {tracking && !loading && (
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <button
            className="btn btn-outline"
            style={{ marginBottom: 16 }}
            onClick={() => { setTracking(null); fetchAllOrders(); }}
          >
            ← Back to All Orders
          </button>
          {/* Order Summary */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="flex-between" style={{ marginBottom: 16 }}>
              <div>
                <h3 style={{ marginBottom: 4 }}>Order {tracking.orderNumber}</h3>
                <span className={`badge ${getStatusBadge(tracking.status)}`}>
                  {tracking.status?.replace('_', ' ')}
                </span>
              </div>
              {tracking.estimatedDelivery && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Estimated Delivery</div>
                  <div style={{ fontWeight: 600 }}>
                    {new Date(tracking.estimatedDelivery).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              )}
            </div>

            {/* Driver Info (if out for delivery) */}
            {tracking.delivery?.driver && tracking.status === 'OUT_FOR_DELIVERY' && (
              <div style={{
                padding: 16,
                background: '#f0f9ff',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 16
              }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white'
                }}>
                  <FiTruck size={24} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>
                    {tracking.delivery.driver.firstName} {tracking.delivery.driver.lastName}
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>Your delivery driver</div>
                </div>
                {tracking.delivery.driver.phone && (
                  <a
                    href={`tel:${tracking.delivery.driver.phone}`}
                    className="btn btn-outline"
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <FiPhone /> Call
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Live Map (placeholder) */}
          {tracking.delivery?.driverLocation && tracking.status === 'OUT_FOR_DELIVERY' && (
            <div className="card" style={{ marginBottom: 24 }}>
              <h4 style={{ marginBottom: 16 }}>
                <FiMapPin style={{ marginRight: 8 }} />
                Driver Location
              </h4>
              <div style={{
                height: 200,
                background: '#f1f5f9',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <FiMapPin size={32} style={{ marginBottom: 8 }} />
                  <div>Driver is at</div>
                  <div style={{ fontWeight: 600 }}>
                    {tracking.delivery.driverLocation.lat?.toFixed(4)}, {tracking.delivery.driverLocation.lng?.toFixed(4)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="card">
            <h4 style={{ marginBottom: 20 }}>Order Timeline</h4>
            <div style={{ position: 'relative', paddingLeft: 30 }}>
              {tracking.timeline?.map((step, index) => (
                <div
                  key={step.status}
                  style={{
                    position: 'relative',
                    paddingBottom: index === tracking.timeline.length - 1 ? 0 : 24,
                    opacity: step.completed ? 1 : 0.5
                  }}
                >
                  {/* Connector line */}
                  {index < tracking.timeline.length - 1 && (
                    <div style={{
                      position: 'absolute',
                      left: -22,
                      top: 28,
                      width: 2,
                      height: 'calc(100% - 8px)',
                      background: step.completed ? '#16a34a' : '#e2e8f0'
                    }} />
                  )}

                  {/* Status dot */}
                  <div style={{
                    position: 'absolute',
                    left: -30,
                    top: 4,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: step.completed ? '#16a34a' : '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white'
                  }}>
                    {step.completed && <FiCheck size={12} />}
                  </div>

                  {/* Content */}
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{step.title}</div>
                    <div style={{ fontSize: 13, color: '#64748b', marginBottom: 2 }}>
                      {step.description}
                    </div>
                    {step.timestamp && (
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>
                        {new Date(step.timestamp).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Updates */}
          {tracking.trackingHistory && tracking.trackingHistory.length > 0 && (
            <div className="card" style={{ marginTop: 24 }}>
              <h4 style={{ marginBottom: 16 }}>Recent Updates</h4>
              <div>
                {tracking.trackingHistory.slice(0, 5).map((update, index) => (
                  <div
                    key={update.id || index}
                    style={{
                      padding: '12px 0',
                      borderBottom: index < 4 ? '1px solid #f1f5f9' : 'none'
                    }}
                  >
                    <div className="flex-between">
                      <span style={{ fontWeight: 500 }}>{update.status?.replace('_', ' ')}</span>
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        {new Date(update.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {update.note && (
                      <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                        {update.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!tracking && !loading && !orderId && filteredOrders.length > 0 && (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(order => (
                  <tr key={order.id}>
                    <td style={{ fontWeight: 600 }}>{order.orderNumber}</td>
                    <td>{order.customer?.firstName} {order.customer?.lastName}</td>
                    <td>
                      <span className={`badge ${getStatusBadge(order.status)}`}>
                        {order.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={async () => {
                          setLoading(true);
                          try {
                            const res = await api.get(`/tracking/track/${order.orderNumber}`);
                            setTracking(res.data);
                          } catch (error) {
                            toast.error('Error loading tracking');
                          } finally {
                            setLoading(false);
                          }
                        }}
                      >
                        <FiMapPin size={14} /> Track
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!tracking && !loading && !orderId && filteredOrders.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <FiPackage size={48} style={{ color: '#94a3b8', marginBottom: 16 }} />
          <h3>{orderNumber ? 'No matching orders' : 'No orders found'}</h3>
          <p style={{ color: '#64748b' }}>
            {orderNumber ? 'Try a different search term' : 'Create an order first to see tracking'}
          </p>
        </div>
      )}
    </div>
  );
}

function getStatusBadge(status) {
  const colors = {
    PENDING: 'badge-warning',
    PICKED_UP: 'badge-primary',
    PROCESSING: 'badge-primary',
    CLEANING: 'badge-primary',
    PRESSING: 'badge-primary',
    QUALITY_CHECK: 'badge-primary',
    READY: 'badge-success',
    OUT_FOR_DELIVERY: 'badge-warning',
    DELIVERED: 'badge-success',
    COMPLETED: 'badge-success',
    CANCELLED: 'badge-danger'
  };
  return colors[status] || 'badge-secondary';
}

export default OrderTracking;
