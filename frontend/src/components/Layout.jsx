import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import { FiHome, FiUsers, FiShoppingBag, FiTruck, FiMapPin, FiSettings, FiBarChart2,
         FiCreditCard, FiGift, FiPercent, FiBox, FiCpu, FiMap, FiLogOut, FiUser,
         FiDollarSign, FiGrid, FiAlertTriangle, FiNavigation, FiActivity } from 'react-icons/fi';

function Layout() {
  const { user, logout, isAdmin, isManager, isDriver } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // ignore - stateless JWT
    }
    logout();
    navigate('/login');
  };

  const driverUser = isDriver();

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>Laundry Services</h1>
          <p>AI Platform</p>
          {connected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, color: '#22c55e' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
              Real-time Connected
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section">
            <div className="sidebar-section-title">Main</div>
            <NavLink to="/" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} end>
              <FiHome /> Dashboard
            </NavLink>
            {!driverUser && (
              <NavLink to="/pos" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                <FiCreditCard /> Point of Sale
              </NavLink>
            )}
          </div>

          {/* Driver-specific navigation - show for drivers OR show My Route for everyone */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">Driver Tools</div>
            <NavLink to="/driver-dashboard" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <FiActivity /> My Route
            </NavLink>
            <NavLink to="/tracking" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <FiNavigation /> Order Tracking
            </NavLink>
          </div>

          {!driverUser && (
            <>
              <div className="sidebar-section">
                <div className="sidebar-section-title">Orders</div>
                <NavLink to="/orders" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                  <FiShoppingBag /> Orders
                </NavLink>
                <NavLink to="/customers" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                  <FiUsers /> Customers
                </NavLink>
                <NavLink to="/tracking" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                  <FiNavigation /> Order Tracking
                </NavLink>
              </div>

              <div className="sidebar-section">
                <div className="sidebar-section-title">Logistics</div>
                <NavLink to="/drivers" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                  <FiTruck /> Drivers
                </NavLink>
                <NavLink to="/routes" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                  <FiMap /> Routes
                </NavLink>
                <NavLink to="/lockers" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                  <FiBox /> Lockers
                </NavLink>
              </div>

              <div className="sidebar-section">
                <div className="sidebar-section-title">Quality</div>
                <NavLink to="/quality-issues" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                  <FiAlertTriangle /> Quality Issues
                </NavLink>
              </div>

              <div className="sidebar-section">
                <div className="sidebar-section-title">Laundromat</div>
                <NavLink to="/machines" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                  <FiGrid /> Machines
                </NavLink>
                <NavLink to="/locations" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                  <FiMapPin /> Locations
                </NavLink>
              </div>

              <div className="sidebar-section">
                <div className="sidebar-section-title">Pricing</div>
                <NavLink to="/services" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                  <FiSettings /> Services
                </NavLink>
                <NavLink to="/pricing" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                  <FiDollarSign /> Pricing
                </NavLink>
                <NavLink to="/subscriptions" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                  <FiCreditCard /> Subscriptions
                </NavLink>
                <NavLink to="/coupons" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                  <FiPercent /> Coupons
                </NavLink>
                <NavLink to="/gift-cards" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                  <FiGift /> Gift Cards
                </NavLink>
              </div>

              <div className="sidebar-section">
                <div className="sidebar-section-title">AI Features</div>
                <NavLink to="/ai" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                  <FiCpu /> AI Tools
                </NavLink>
                <NavLink to="/ai/subscription-optimize" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                  <FiCpu /> Subscription Optimizer
                </NavLink>
              </div>

              {isManager() && (
                <div className="sidebar-section">
                  <div className="sidebar-section-title">Admin</div>
                  <NavLink to="/staff" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <FiUser /> Staff
                  </NavLink>
                  <NavLink to="/reports" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                    <FiBarChart2 /> Reports
                  </NavLink>
                </div>
              )}
            </>
          )}

          <div className="sidebar-section" style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="sidebar-link" style={{ opacity: 0.7 }}>
              <FiUser /> {user?.firstName} {user?.lastName}
              <span style={{
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.2)',
                marginLeft: 8
              }}>
                {user?.role || user?.type || 'User'}
              </span>
            </div>
            <button onClick={handleLogout} className="sidebar-link" style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <FiLogOut /> Logout
            </button>
          </div>
        </nav>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
