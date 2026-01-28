import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiMail, FiPhone, FiMapPin, FiCreditCard, FiStar, FiEdit, FiPlus } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';

function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders');

  useEffect(() => {
    fetchCustomer();
  }, [id]);

  const fetchCustomer = async () => {
    try {
      const res = await api.get(`/customers/${id}`);
      setCustomer(res.data);
    } catch (error) {
      toast.error('Error fetching customer');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      PENDING: 'badge-warning',
      PROCESSING: 'badge-primary',
      READY: 'badge-success',
      DELIVERED: 'badge-success',
      CANCELLED: 'badge-danger'
    };
    return statusColors[status] || 'badge-secondary';
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  if (!customer) {
    return <div className="empty-state"><h3>Customer not found</h3></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{customer.firstName} {customer.lastName}</h1>
          <p className="page-subtitle">Customer since {new Date(customer.createdAt).toLocaleDateString()}</p>
        </div>
        <Link to="/orders/new" className="btn btn-primary">
          <FiPlus /> New Order
        </Link>
      </div>

      <div className="grid-3">
        <div className="card">
          <h4 style={{ marginBottom: 16 }}>Contact Information</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="flex gap-1">
              <FiMail style={{ color: '#64748b' }} />
              <span>{customer.email}</span>
            </div>
            <div className="flex gap-1">
              <FiPhone style={{ color: '#64748b' }} />
              <span>{customer.phone || 'Not provided'}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h4 style={{ marginBottom: 16 }}>Account Balance</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="flex-between">
              <span style={{ color: '#64748b' }}>Credit Balance</span>
              <span style={{ fontWeight: 600, fontSize: 18 }}>${parseFloat(customer.creditBalance).toFixed(2)}</span>
            </div>
            <div className="flex-between">
              <span style={{ color: '#64748b' }}>Loyalty Points</span>
              <span style={{ fontWeight: 600, fontSize: 18 }}>{customer.loyaltyPoints} pts</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h4 style={{ marginBottom: 16 }}>Preferences</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
            <div className="flex-between">
              <span style={{ color: '#64748b' }}>Starch</span>
              <span className="badge badge-secondary">{customer.starchPreference}</span>
            </div>
            <div className="flex-between">
              <span style={{ color: '#64748b' }}>Hangers</span>
              <span className="badge badge-secondary">{customer.hangerPreference ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex-between">
              <span style={{ color: '#64748b' }}>Crease</span>
              <span className="badge badge-secondary">{customer.creasePreference ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="tabs">
          <div className={`tab ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
            Orders
          </div>
          <div className={`tab ${activeTab === 'addresses' ? 'active' : ''}`} onClick={() => setActiveTab('addresses')}>
            Addresses
          </div>
          <div className={`tab ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>
            Payment Methods
          </div>
          <div className={`tab ${activeTab === 'subscriptions' ? 'active' : ''}`} onClick={() => setActiveTab('subscriptions')}>
            Subscriptions
          </div>
        </div>

        {activeTab === 'orders' && (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {customer.orders?.map(order => (
                  <tr key={order.id}>
                    <td>
                      <Link to={`/orders/${order.id}`}>{order.orderNumber}</Link>
                    </td>
                    <td>{order.items?.length || 0} items</td>
                    <td>${parseFloat(order.total).toFixed(2)}</td>
                    <td>
                      <span className={`badge ${getStatusBadge(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {(!customer.orders || customer.orders.length === 0) && (
                  <tr>
                    <td colSpan="5" className="text-center" style={{ padding: 40, color: '#64748b' }}>
                      No orders yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'addresses' && (
          <div className="grid-2" style={{ gap: 16 }}>
            {customer.addresses?.map(address => (
              <div key={address.id} style={{ padding: 16, border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <div className="flex-between" style={{ marginBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>{address.label}</span>
                  {address.isDefault && <span className="badge badge-primary">Default</span>}
                </div>
                <div style={{ color: '#64748b', fontSize: 14 }}>
                  <div>{address.street}</div>
                  {address.apartment && <div>{address.apartment}</div>}
                  <div>{address.city}, {address.state} {address.zipCode}</div>
                  {address.instructions && (
                    <div style={{ marginTop: 8, fontStyle: 'italic' }}>{address.instructions}</div>
                  )}
                </div>
              </div>
            ))}
            {(!customer.addresses || customer.addresses.length === 0) && (
              <div style={{ padding: 40, color: '#64748b', textAlign: 'center', gridColumn: 'span 2' }}>
                No addresses saved
              </div>
            )}
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="grid-2" style={{ gap: 16 }}>
            {customer.paymentMethods?.map(method => (
              <div key={method.id} style={{ padding: 16, border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <div className="flex-between" style={{ marginBottom: 8 }}>
                  <span className="flex gap-1">
                    <FiCreditCard />
                    <span style={{ fontWeight: 600 }}>{method.type.replace('_', ' ')}</span>
                  </span>
                  {method.isDefault && <span className="badge badge-primary">Default</span>}
                </div>
                {method.lastFour && (
                  <div style={{ color: '#64748b', fontSize: 14 }}>
                    **** **** **** {method.lastFour}
                    {method.expiryMonth && ` (${method.expiryMonth}/${method.expiryYear})`}
                  </div>
                )}
              </div>
            ))}
            {(!customer.paymentMethods || customer.paymentMethods.length === 0) && (
              <div style={{ padding: 40, color: '#64748b', textAlign: 'center', gridColumn: 'span 2' }}>
                No payment methods saved
              </div>
            )}
          </div>
        )}

        {activeTab === 'subscriptions' && (
          <div>
            {customer.subscriptions?.map(sub => (
              <div key={sub.id} style={{ padding: 16, border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 12 }}>
                <div className="flex-between" style={{ marginBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>{sub.plan?.name}</span>
                  <span className={`badge ${sub.status === 'ACTIVE' ? 'badge-success' : 'badge-secondary'}`}>
                    {sub.status}
                  </span>
                </div>
                <div style={{ color: '#64748b', fontSize: 14 }}>
                  <div>${parseFloat(sub.plan?.price).toFixed(2)} / {sub.plan?.billingCycle.toLowerCase()}</div>
                  <div>Next renewal: {new Date(sub.renewalDate).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
            {(!customer.subscriptions || customer.subscriptions.length === 0) && (
              <div style={{ padding: 40, color: '#64748b', textAlign: 'center' }}>
                No active subscriptions
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CustomerDetail;
