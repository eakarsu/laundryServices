import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiPlus, FiEye, FiEdit, FiMail, FiPhone } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';

function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '', password: ''
  });

  useEffect(() => {
    fetchCustomers();
  }, [page, search]);

  const fetchCustomers = async () => {
    try {
      const res = await api.get(`/customers?page=${page}&search=${search}`);
      setCustomers(res.data.customers);
      setTotalPages(res.data.totalPages);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchCustomers();
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      await api.post('/customers', formData);
      toast.success('Customer created successfully');
      setShowModal(false);
      setFormData({ firstName: '', lastName: '', email: '', phone: '', password: '' });
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error creating customer');
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Manage customer profiles and information</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <FiPlus /> Add Customer
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <form onSubmit={handleSearch} className="search-box">
            <FiSearch className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Orders</th>
                <th>Credit Balance</th>
                <th>Loyalty Points</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(customer => (
                <tr key={customer.id}>
                  <td>
                    <Link to={`/customers/${customer.id}`} style={{ fontWeight: 500 }}>
                      {customer.firstName} {customer.lastName}
                    </Link>
                  </td>
                  <td>
                    <span className="flex gap-1">
                      <FiMail size={14} style={{ color: '#64748b' }} />
                      {customer.email}
                    </span>
                  </td>
                  <td>
                    <span className="flex gap-1">
                      <FiPhone size={14} style={{ color: '#64748b' }} />
                      {customer.phone || '-'}
                    </span>
                  </td>
                  <td>{customer._count?.orders || 0}</td>
                  <td>${parseFloat(customer.creditBalance).toFixed(2)}</td>
                  <td>{customer.loyaltyPoints}</td>
                  <td>
                    <div className="flex gap-1">
                      <Link to={`/customers/${customer.id}`} className="btn btn-outline btn-sm">
                        <FiEye /> View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center" style={{ padding: 40, color: '#64748b' }}>
                    No customers found
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

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Customer</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateCustomer}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input
                      type="email"
                      className="form-input"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      type="tel"
                      className="form-input"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <input
                    type="password"
                    className="form-input"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Customers;
