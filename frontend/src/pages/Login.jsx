import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { FiUser, FiShield, FiTruck, FiUsers } from 'react-icons/fi';

const demoAccounts = [
  {
    role: 'Admin',
    email: 'admin@laundry.com',
    password: 'password123',
    icon: FiShield,
    color: '#dc2626',
    description: 'Full system access'
  },
  {
    role: 'Manager',
    email: 'manager@laundry.com',
    password: 'password123',
    icon: FiUsers,
    color: '#2563eb',
    description: 'Operations management'
  },
  {
    role: 'Driver',
    email: 'driver1@laundry.com',
    password: 'password123',
    icon: FiTruck,
    color: '#16a34a',
    description: 'Delivery & pickups'
  },
  {
    role: 'Customer',
    email: 'john.smith@email.com',
    password: 'password123',
    icon: FiUser,
    color: '#9333ea',
    description: 'Customer portal'
  }
];

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Auto-detect user type based on email
  const detectUserType = (email) => {
    const lowerEmail = email.toLowerCase();
    if (lowerEmail.includes('driver')) return 'driver';
    if (lowerEmail.includes('@laundry.com')) return 'staff';
    return 'customer';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userType = detectUserType(email);
      await login(email, password, userType);
      toast.success('Login successful!');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (account) => {
    setEmail(account.email);
    setPassword(account.password);
  };

  const handleQuickLoginAndSubmit = async (account) => {
    setLoading(true);
    try {
      const userType = detectUserType(account.email);
      await login(account.email, account.password, userType);
      toast.success(`Logged in as ${account.role}!`);
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: 480 }}>
        <div className="login-header">
          <h1>Laundry Services</h1>
          <p>AI Platform - Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 24 }}>
          <div style={{
            textAlign: 'center',
            marginBottom: 16,
            color: '#64748b',
            fontSize: 13,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Quick Demo Login
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {demoAccounts.map((account) => {
              const Icon = account.icon;
              return (
                <button
                  key={account.role}
                  type="button"
                  onClick={() => handleQuickLoginAndSubmit(account)}
                  disabled={loading}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '16px 12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: 12,
                    background: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    opacity: loading ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = account.color;
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: `${account.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 8
                  }}>
                    <Icon size={24} style={{ color: account.color }} />
                  </div>
                  <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 14 }}>
                    {account.role}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    {account.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{
          marginTop: 20,
          padding: 12,
          background: '#f8fafc',
          borderRadius: 8,
          fontSize: 12,
          color: '#64748b',
          textAlign: 'center'
        }}>
          <strong>All demo accounts use password:</strong> password123
        </div>
      </div>
    </div>
  );
}

export default Login;
