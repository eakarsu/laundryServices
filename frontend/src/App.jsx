import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import NewOrder from './pages/NewOrder';
import Services from './pages/Services';
import Pricing from './pages/Pricing';
import Drivers from './pages/Drivers';
import Routes_ from './pages/Routes';
import Machines from './pages/Machines';
import Locations from './pages/Locations';
import Staff from './pages/Staff';
import Reports from './pages/Reports';
import Subscriptions from './pages/Subscriptions';
import Coupons from './pages/Coupons';
import GiftCards from './pages/GiftCards';
import Lockers from './pages/Lockers';
import AIFeatures from './pages/AIFeatures';
import POS from './pages/POS';
import QualityIssues from './pages/QualityIssues';
import OrderTracking from './pages/OrderTracking';
import DriverDashboard from './pages/DriverDashboard';
import ErrorBoundary from './components/ErrorBoundary';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading" style={{ height: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <SocketProvider>
      <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/track/:orderNumber" element={<OrderTracking />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/" element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/new" element={<NewOrder />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="orders/:orderId/tracking" element={<OrderTracking />} />
          <Route path="pos" element={<POS />} />
          <Route path="services" element={<Services />} />
          <Route path="pricing" element={<Pricing />} />
          <Route path="drivers" element={<Drivers />} />
          <Route path="driver-dashboard" element={<DriverDashboard />} />
          <Route path="routes" element={<Routes_ />} />
          <Route path="machines" element={<Machines />} />
          <Route path="locations" element={<Locations />} />
          <Route path="staff" element={<Staff />} />
          <Route path="reports" element={<Reports />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="coupons" element={<Coupons />} />
          <Route path="gift-cards" element={<GiftCards />} />
          <Route path="lockers" element={<Lockers />} />
          <Route path="quality-issues" element={<QualityIssues />} />
          <Route path="ai" element={<AIFeatures />} />
          <Route path="tracking" element={<OrderTracking />} />
        </Route>
      </Routes>
      </ErrorBoundary>
    </SocketProvider>
  );
}

export default App;
