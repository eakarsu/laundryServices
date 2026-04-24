import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiPlus, FiEye, FiMail, FiPhone, FiDownload, FiFileText } from 'react-icons/fi';
import { toast } from 'react-toastify';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../services/api';
import SortableHeader from '../components/SortableHeader';
import BulkActionBar from '../components/BulkActionBar';
import RowDetailModal from '../components/RowDetailModal';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { validateRequired, validateEmail } from '../utils/validation';

function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedIds, setSelectedIds] = useState([]);
  const [detailData, setDetailData] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '', password: ''
  });

  useEffect(() => {
    fetchCustomers();
  }, [page, search, sortBy, sortOrder]);

  const fetchCustomers = async () => {
    try {
      const res = await api.get(`/customers?page=${page}&search=${search}&sortBy=${sortBy}&sortOrder=${sortOrder}`);
      setCustomers(res.data.customers);
      setTotalPages(res.data.totalPages);
    } catch (error) {
      toast.error('Error fetching customers');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field, order) => {
    setSortBy(field);
    setSortOrder(order);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchCustomers();
  };

  const validateForm = () => {
    const errors = {};
    const fnErr = validateRequired(formData.firstName, 'First name');
    if (fnErr) errors.firstName = fnErr;
    const lnErr = validateRequired(formData.lastName, 'Last name');
    if (lnErr) errors.lastName = lnErr;
    const emErr = validateEmail(formData.email);
    if (emErr) errors.email = emErr;
    const pwErr = validateRequired(formData.password, 'Password');
    if (pwErr) errors.password = pwErr;
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      await api.post('/customers', formData);
      toast.success('Customer created successfully');
      setShowModal(false);
      setFormData({ firstName: '', lastName: '', email: '', phone: '', password: '' });
      setFormErrors({});
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error creating customer');
    }
  };

  const handleSelectAll = (e) => {
    setSelectedIds(e.target.checked ? customers.map(c => c.id) : []);
  };

  const handleSelectRow = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkDelete = async () => {
    try {
      await api.delete('/customers/bulk', { data: { ids: selectedIds } });
      toast.success(`${selectedIds.length} customers deleted`);
      setSelectedIds([]);
      fetchCustomers();
    } catch (error) {
      toast.error('Error deleting customers');
    }
  };

  const handleBulkUpdate = async (data) => {
    try {
      await api.patch('/customers/bulk', { ids: selectedIds, data });
      toast.success(`${selectedIds.length} customers updated`);
      setSelectedIds([]);
      fetchCustomers();
    } catch (error) {
      toast.error('Error updating customers');
    }
  };

  const handleExportCSV = async () => {
    try {
      const res = await api.get(`/customers?format=csv&search=${search}&sortBy=${sortBy}&sortOrder=${sortOrder}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'customers.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('CSV exported');
    } catch (error) {
      toast.error('Error exporting CSV');
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text('Customers Report', 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [['Name', 'Email', 'Phone', 'Orders', 'Credit', 'Points']],
      body: customers.map(c => [
        `${c.firstName} ${c.lastName}`,
        c.email,
        c.phone || '-',
        c._count?.orders || 0,
        `$${parseFloat(c.creditBalance).toFixed(2)}`,
        c.loyaltyPoints
      ])
    });
    doc.save('customers.pdf');
    toast.success('PDF exported');
  };

  const handleRowClick = (customer) => {
    setDetailData(customer);
  };

  const handleDeleteFromDetail = async (customer) => {
    try {
      await api.delete('/customers/bulk', { data: { ids: [customer.id] } });
      toast.success('Customer deleted');
      setDetailData(null);
      fetchCustomers();
    } catch (error) {
      toast.error('Error deleting customer');
    }
  };

  const detailFields = [
    { label: 'First Name', key: 'firstName' },
    { label: 'Last Name', key: 'lastName' },
    { label: 'Email', key: 'email' },
    { label: 'Phone', key: 'phone' },
    { label: 'Credit Balance', key: 'creditBalance' },
    { label: 'Loyalty Points', key: 'loyaltyPoints' },
    { label: 'Active', key: 'isActive' },
    { label: 'Email Verified', key: 'emailVerified' },
    { label: 'Created', key: 'createdAt' }
  ];

  if (loading) {
    return <div style={{ padding: 24 }}><TableSkeleton rows={8} cols={7} /></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Manage customer profiles and information</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={handleExportCSV}><FiDownload /> CSV</button>
          <button className="btn btn-outline" onClick={handleExportPDF}><FiFileText /> PDF</button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}><FiPlus /> Add Customer</button>
        </div>
      </div>

      <BulkActionBar
        selectedCount={selectedIds.length}
        onBulkDelete={handleBulkDelete}
        onBulkUpdate={handleBulkUpdate}
        onClearSelection={() => setSelectedIds([])}
        updateOptions={[
          { label: 'Deactivate', data: { isActive: false } },
          { label: 'Activate', data: { isActive: true } }
        ]}
      />

      <div className="card">
        <div className="card-header">
          <form onSubmit={handleSearch} className="search-box">
            <FiSearch className="search-icon" />
            <input type="text" className="search-input" placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </form>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th><input type="checkbox" onChange={handleSelectAll} checked={selectedIds.length === customers.length && customers.length > 0} /></th>
                <SortableHeader label="Name" field="firstName" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <SortableHeader label="Email" field="email" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <th>Phone</th>
                <th>Orders</th>
                <SortableHeader label="Credit" field="creditBalance" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <SortableHeader label="Points" field="loyaltyPoints" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(customer => (
                <tr key={customer.id} onClick={() => handleRowClick(customer)} style={{ cursor: 'pointer' }}>
                  <td onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.includes(customer.id)} onChange={() => handleSelectRow(customer.id)} />
                  </td>
                  <td>
                    <Link to={`/customers/${customer.id}`} style={{ fontWeight: 500 }} onClick={e => e.stopPropagation()}>
                      {customer.firstName} {customer.lastName}
                    </Link>
                  </td>
                  <td><span className="flex gap-1"><FiMail size={14} style={{ color: '#64748b' }} />{customer.email}</span></td>
                  <td><span className="flex gap-1"><FiPhone size={14} style={{ color: '#64748b' }} />{customer.phone || '-'}</span></td>
                  <td>{customer._count?.orders || 0}</td>
                  <td>${parseFloat(customer.creditBalance).toFixed(2)}</td>
                  <td>{customer.loyaltyPoints}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <Link to={`/customers/${customer.id}`} className="btn btn-outline btn-sm"><FiEye /> View</Link>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr><td colSpan="8" className="text-center" style={{ padding: 40, color: '#64748b' }}>No customers found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button className="pagination-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>Previous</button>
            <span style={{ padding: '0 16px' }}>Page {page} of {totalPages}</span>
            <button className="pagination-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>Next</button>
          </div>
        )}
      </div>

      <RowDetailModal
        isOpen={!!detailData}
        onClose={() => setDetailData(null)}
        data={detailData}
        title="Customer Details"
        fields={detailFields}
        onEdit={(c) => { setDetailData(null); window.location.href = `/customers/${c.id}`; }}
        onDelete={handleDeleteFromDetail}
      />

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
                    <input type="text" className="form-input" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
                    {formErrors.firstName && <span style={{ color: '#ef4444', fontSize: 12 }}>{formErrors.firstName}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input type="text" className="form-input" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
                    {formErrors.lastName && <span style={{ color: '#ef4444', fontSize: 12 }}>{formErrors.lastName}</span>}
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input type="email" className="form-input" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                    {formErrors.email && <span style={{ color: '#ef4444', fontSize: 12 }}>{formErrors.email}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input type="tel" className="form-input" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <input type="password" className="form-input" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                  {formErrors.password && <span style={{ color: '#ef4444', fontSize: 12 }}>{formErrors.password}</span>}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Customers;
