import React, { useState, useEffect } from 'react';
import { FiDollarSign, FiShoppingBag, FiUsers, FiTruck, FiCalendar } from 'react-icons/fi';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../services/api';

function Reports() {
  const [activeTab, setActiveTab] = useState('revenue');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [revenueData, setRevenueData] = useState(null);
  const [ordersData, setOrdersData] = useState(null);
  const [customersData, setCustomersData] = useState(null);
  const [routesData, setRoutesData] = useState(null);
  const [loading, setLoading] = useState(true);

  const COLORS = ['#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  useEffect(() => {
    fetchReports();
  }, [dateRange, activeTab]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = `startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;

      if (activeTab === 'revenue') {
        const res = await api.get(`/reports/revenue?${params}&groupBy=day`);
        setRevenueData(res.data);
      } else if (activeTab === 'orders') {
        const res = await api.get(`/reports/orders?${params}`);
        setOrdersData(res.data);
      } else if (activeTab === 'customers') {
        const res = await api.get(`/reports/customers?${params}`);
        setCustomersData(res.data);
      } else if (activeTab === 'routes') {
        const res = await api.get(`/reports/routes?${params}`);
        setRoutesData(res.data);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Business insights and performance metrics</p>
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            className="form-input"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
          />
          <input
            type="date"
            className="form-input"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
          />
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 24 }}>
        <div className={`tab ${activeTab === 'revenue' ? 'active' : ''}`} onClick={() => setActiveTab('revenue')}>
          <FiDollarSign /> Revenue
        </div>
        <div className={`tab ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
          <FiShoppingBag /> Orders
        </div>
        <div className={`tab ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => setActiveTab('customers')}>
          <FiUsers /> Customers
        </div>
        <div className={`tab ${activeTab === 'routes' ? 'active' : ''}`} onClick={() => setActiveTab('routes')}>
          <FiTruck /> Routes
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"></div></div>
      ) : (
        <>
          {activeTab === 'revenue' && revenueData && (
            <>
              <div className="stats-grid">
                <div className="stat-card primary">
                  <div className="stat-label">Total Revenue</div>
                  <div className="stat-value">${revenueData.summary.totalRevenue.toFixed(2)}</div>
                </div>
                <div className="stat-card success">
                  <div className="stat-label">Collected</div>
                  <div className="stat-value">${revenueData.summary.totalCollected.toFixed(2)}</div>
                </div>
                <div className="stat-card warning">
                  <div className="stat-label">Total Orders</div>
                  <div className="stat-value">{revenueData.summary.totalOrders}</div>
                </div>
                <div className="stat-card info">
                  <div className="stat-label">Avg Order Value</div>
                  <div className="stat-value">${revenueData.summary.averageOrderValue.toFixed(2)}</div>
                </div>
              </div>

              <div className="card">
                <h4 style={{ marginBottom: 16 }}>Revenue Over Time</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={revenueData.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => [`$${value.toFixed(2)}`, 'Revenue']} />
                    <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {activeTab === 'orders' && ordersData && (
            <>
              <div className="stats-grid">
                <div className="stat-card primary">
                  <div className="stat-label">Total Orders</div>
                  <div className="stat-value">{ordersData.totalOrders}</div>
                </div>
                <div className="stat-card success">
                  <div className="stat-label">Regular Orders</div>
                  <div className="stat-value">{ordersData.regularOrders}</div>
                </div>
                <div className="stat-card danger">
                  <div className="stat-label">Rush Orders</div>
                  <div className="stat-value">{ordersData.rushOrders}</div>
                </div>
              </div>

              <div className="grid-2">
                <div className="card">
                  <h4 style={{ marginBottom: 16 }}>Orders by Status</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={Object.entries(ordersData.statusBreakdown).map(([name, value]) => ({ name, value }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        dataKey="value"
                        label
                      >
                        {Object.keys(ordersData.statusBreakdown).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="card">
                  <h4 style={{ marginBottom: 16 }}>Daily Order Volume</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={ordersData.dailyVolume}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {activeTab === 'customers' && customersData && (
            <>
              <div className="stats-grid">
                <div className="stat-card primary">
                  <div className="stat-label">Total Customers</div>
                  <div className="stat-value">{customersData.summary.totalCustomers}</div>
                </div>
                <div className="stat-card success">
                  <div className="stat-label">New Customers</div>
                  <div className="stat-value">{customersData.summary.newCustomers}</div>
                </div>
                <div className="stat-card warning">
                  <div className="stat-label">Active Customers</div>
                  <div className="stat-value">{customersData.summary.activeCustomers}</div>
                </div>
                <div className="stat-card info">
                  <div className="stat-label">Retention Rate</div>
                  <div className="stat-value">{customersData.summary.retentionRate}%</div>
                </div>
              </div>

              <div className="card">
                <h4 style={{ marginBottom: 16 }}>Top Customers</h4>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Email</th>
                        <th>Orders</th>
                        <th>Total Spent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customersData.topCustomers.map((customer, i) => (
                        <tr key={customer.id}>
                          <td style={{ fontWeight: 500 }}>
                            <span style={{ marginRight: 8, color: '#64748b' }}>#{i + 1}</span>
                            {customer.name}
                          </td>
                          <td>{customer.email}</td>
                          <td>{customer.orderCount}</td>
                          <td style={{ fontWeight: 500 }}>${customer.totalSpent.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === 'routes' && routesData && (
            <>
              <div className="stats-grid">
                <div className="stat-card primary">
                  <div className="stat-label">Total Routes</div>
                  <div className="stat-value">{routesData.summary.totalRoutes}</div>
                </div>
                <div className="stat-card success">
                  <div className="stat-label">Completed</div>
                  <div className="stat-value">{routesData.summary.completedRoutes}</div>
                </div>
                <div className="stat-card warning">
                  <div className="stat-label">Avg Stops/Route</div>
                  <div className="stat-value">{routesData.summary.averageStopsPerRoute}</div>
                </div>
                <div className="stat-card info">
                  <div className="stat-label">Completion Rate</div>
                  <div className="stat-value">{routesData.summary.averageCompletionRate}%</div>
                </div>
              </div>

              <div className="card">
                <h4 style={{ marginBottom: 16 }}>Route Performance</h4>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Driver</th>
                        <th>Status</th>
                        <th>Stops</th>
                        <th>Completion Rate</th>
                        <th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {routesData.routes.map(route => (
                        <tr key={route.id}>
                          <td>{new Date(route.date).toLocaleDateString()}</td>
                          <td>{route.driver}</td>
                          <td>
                            <span className={`badge ${route.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                              {route.status}
                            </span>
                          </td>
                          <td>{route.completedStops}/{route.totalStops}</td>
                          <td>{route.completionRate}%</td>
                          <td>{route.duration ? `${route.duration} min` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default Reports;
