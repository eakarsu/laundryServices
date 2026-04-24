import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiShoppingBag, FiTruck, FiDollarSign, FiUsers, FiPlus, FiArrowRight, FiMail } from 'react-icons/fi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

function Dashboard() {
  const navigate = useNavigate();
  const { user, isCustomer } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [dashboardRes, ordersRes, revenueRes] = await Promise.all([
        api.get('/reports/dashboard'),
        api.get('/orders?limit=5'),
        api.get('/reports/revenue?groupBy=day')
      ]);

      setStats(dashboardRes.data);
      setRecentOrders(ordersRes.data.orders);
      setRevenueData(revenueRes.data.data.slice(-7));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
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
      READY: 'badge-success',
      DELIVERED: 'badge-success',
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
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back! Here's what's happening today.</p>
        </div>
        <Link to="/orders/new" className="btn btn-primary">
          <FiPlus /> New Order
        </Link>
      </div>

      {isCustomer() && user && !user.emailVerified && (
        <div style={{
          background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8,
          padding: '12px 20px', marginBottom: 16, display: 'flex',
          alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiMail style={{ color: '#d97706' }} />
            <span style={{ color: '#92400e', fontSize: 14 }}>
              Please verify your email address to access all features.
            </span>
          </div>
          <button
            className="btn btn-sm btn-warning"
            onClick={async () => {
              try {
                await api.post('/auth/resend-verification');
                toast.success('Verification email sent!');
              } catch {
                toast.error('Failed to send verification email');
              }
            }}
          >
            Resend Verification
          </button>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card primary" onClick={() => navigate('/orders')} style={{ cursor: 'pointer' }}>
          <div className="stat-label">Today's Orders</div>
          <div className="stat-value">{stats?.orders?.today || 0}</div>
          <div className="stat-change">{stats?.orders?.pending || 0} pending</div>
        </div>
        <div className="stat-card success" onClick={() => navigate('/reports')} style={{ cursor: 'pointer' }}>
          <div className="stat-label">Today's Revenue</div>
          <div className="stat-value">${stats?.revenue?.today?.toFixed(2) || '0.00'}</div>
          <div className="stat-change">{stats?.orders?.ready || 0} ready for pickup</div>
        </div>
        <div className="stat-card warning" onClick={() => navigate('/routes')} style={{ cursor: 'pointer' }}>
          <div className="stat-label">Today's Pickups</div>
          <div className="stat-value">{stats?.logistics?.todayPickups || 0}</div>
          <div className="stat-change">{stats?.logistics?.todayDeliveries || 0} deliveries</div>
        </div>
        <div className="stat-card info" onClick={() => navigate('/machines')} style={{ cursor: 'pointer' }}>
          <div className="stat-label">Machine Utilization</div>
          <div className="stat-value">{stats?.machines?.utilizationRate || 0}%</div>
          <div className="stat-change">{stats?.machines?.active || 0} of {stats?.machines?.total || 0} in use</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Revenue Trend (Last 7 Days)</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => [`$${value.toFixed(2)}`, 'Revenue']} />
              <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} dot={{ fill: '#2563eb' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Orders by Day</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="orders" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Recent Orders</h3>
          <Link to="/orders" className="btn btn-outline btn-sm">
            View All <FiArrowRight />
          </Link>
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
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map(order => (
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
                  <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center" style={{ padding: 40, color: '#64748b' }}>
                    No orders yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-4" style={{ marginTop: 24 }}>
        <Link to="/orders/new" className="card" style={{ textAlign: 'center', cursor: 'pointer', textDecoration: 'none' }}>
          <FiShoppingBag size={32} style={{ color: '#2563eb', marginBottom: 12 }} />
          <h4>New Order</h4>
          <p style={{ fontSize: 13, color: '#64748b' }}>Create a new order</p>
        </Link>
        <Link to="/customers" className="card" style={{ textAlign: 'center', cursor: 'pointer', textDecoration: 'none' }}>
          <FiUsers size={32} style={{ color: '#22c55e', marginBottom: 12 }} />
          <h4>Customers</h4>
          <p style={{ fontSize: 13, color: '#64748b' }}>Manage customers</p>
        </Link>
        <Link to="/routes" className="card" style={{ textAlign: 'center', cursor: 'pointer', textDecoration: 'none' }}>
          <FiTruck size={32} style={{ color: '#f59e0b', marginBottom: 12 }} />
          <h4>Routes</h4>
          <p style={{ fontSize: 13, color: '#64748b' }}>Manage deliveries</p>
        </Link>
        <Link to="/reports" className="card" style={{ textAlign: 'center', cursor: 'pointer', textDecoration: 'none' }}>
          <FiDollarSign size={32} style={{ color: '#8b5cf6', marginBottom: 12 }} />
          <h4>Reports</h4>
          <p style={{ fontSize: 13, color: '#64748b' }}>View analytics</p>
        </Link>
      </div>
    </div>
  );
}

export default Dashboard;
