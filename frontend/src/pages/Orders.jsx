import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiPlus, FiEye, FiFilter } from 'react-icons/fi';
import api from '../services/api';

function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const statuses = ['PENDING', 'PICKED_UP', 'PROCESSING', 'CLEANING', 'PRESSING', 'QUALITY_CHECK', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED'];

  useEffect(() => {
    fetchOrders();
  }, [page, status]);

  const fetchOrders = async () => {
    try {
      let url = `/orders?page=${page}&limit=20`;
      if (status) url += `&status=${status}`;
      const res = await api.get(url);
      setOrders(res.data.orders);
      setTotalPages(res.data.totalPages);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">Manage and track all orders</p>
        </div>
        <Link to="/orders/new" className="btn btn-primary">
          <FiPlus /> New Order
        </Link>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex gap-2">
            <div className="search-box">
              <FiSearch className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Search orders..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="form-select"
              style={{ width: 200 }}
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            >
              <option value="">All Statuses</option>
              {statuses.map(s => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Rush</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id}>
                  <td>
                    <Link to={`/orders/${order.id}`} style={{ fontWeight: 500 }}>
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td>{order.customer?.firstName} {order.customer?.lastName}</td>
                  <td>{order.items?.length || 0} items</td>
                  <td>${parseFloat(order.total).toFixed(2)}</td>
                  <td>
                    <span className={`badge ${getStatusBadge(order.status)}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    {order.isRush && <span className="badge badge-danger">RUSH</span>}
                  </td>
                  <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td>
                    <Link to={`/orders/${order.id}`} className="btn btn-outline btn-sm">
                      <FiEye /> View
                    </Link>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan="8" className="text-center" style={{ padding: 40, color: '#64748b' }}>
                    No orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="pagination-btn"
              onClick={() => setPage(p => p - 1)}
              disabled={page === 1}
            >
              Previous
            </button>
            <span style={{ padding: '0 16px' }}>Page {page} of {totalPages}</span>
            <button
              className="pagination-btn"
              onClick={() => setPage(p => p + 1)}
              disabled={page === totalPages}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Orders;
