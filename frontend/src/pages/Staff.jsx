import { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiDownload, FiFileText } from 'react-icons/fi';
import { toast } from 'react-toastify';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../services/api';
import SortableHeader from '../components/SortableHeader';
import BulkActionBar from '../components/BulkActionBar';
import RowDetailModal from '../components/RowDetailModal';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { validateRequired, validateEmail } from '../utils/validation';

function Staff() {
  const [staff, setStaff] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editStaff, setEditStaff] = useState(null);
  const [sortBy, setSortBy] = useState('firstName');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedIds, setSelectedIds] = useState([]);
  const [detailData, setDetailData] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [formData, setFormData] = useState({ email: '', phone: '', firstName: '', lastName: '', password: '', role: 'CLERK', locationId: '' });

  const roles = ['ADMIN', 'MANAGER', 'CLERK', 'PRESSER', 'CLEANER'];

  useEffect(() => { fetchData(); }, [sortBy, sortOrder]);

  const fetchData = async () => {
    try {
      const [staffRes, locationsRes] = await Promise.all([
        api.get(`/staff?sortBy=${sortBy}&sortOrder=${sortOrder}`),
        api.get('/locations')
      ]);
      setStaff(staffRes.data);
      setLocations(locationsRes.data);
    } catch (error) { toast.error('Error loading staff'); } finally { setLoading(false); }
  };

  const handleSort = (field, order) => { setSortBy(field); setSortOrder(order); };

  const validateForm = () => {
    const errors = {};
    if (validateRequired(formData.firstName, 'First name')) errors.firstName = validateRequired(formData.firstName, 'First name');
    if (validateRequired(formData.lastName, 'Last name')) errors.lastName = validateRequired(formData.lastName, 'Last name');
    if (!editStaff && validateEmail(formData.email)) errors.email = validateEmail(formData.email);
    if (!editStaff && validateRequired(formData.password, 'Password')) errors.password = validateRequired(formData.password, 'Password');
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      if (editStaff) { await api.put(`/staff/${editStaff.id}`, formData); toast.success('Staff updated'); }
      else { await api.post('/staff', formData); toast.success('Staff created'); }
      setShowModal(false); setEditStaff(null); setFormErrors({}); fetchData();
    } catch (error) { toast.error(error.response?.data?.error || 'Error saving staff'); }
  };

  const openModal = (member = null) => {
    if (member) {
      setEditStaff(member);
      setFormData({ email: member.email, phone: member.phone || '', firstName: member.firstName, lastName: member.lastName, password: '', role: member.role, locationId: member.location?.id || '' });
    } else {
      setEditStaff(null);
      setFormData({ email: '', phone: '', firstName: '', lastName: '', password: '', role: 'CLERK', locationId: locations[0]?.id || '' });
    }
    setFormErrors({});
    setShowModal(true);
  };

  const toggleStatus = async (member) => {
    try {
      const endpoint = member.isActive ? 'deactivate' : 'activate';
      await api.post(`/staff/${member.id}/${endpoint}`);
      toast.success(`Staff ${member.isActive ? 'deactivated' : 'activated'}`);
      fetchData();
    } catch (error) { toast.error('Error updating staff status'); }
  };

  const getRoleBadge = (role) => ({ ADMIN: 'badge-danger', MANAGER: 'badge-warning', CLERK: 'badge-primary', PRESSER: 'badge-info', CLEANER: 'badge-secondary' }[role] || 'badge-secondary');

  const handleSelectAll = (e) => setSelectedIds(e.target.checked ? staff.map(s => s.id) : []);
  const handleSelectRow = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const handleBulkDelete = async () => {
    try { await api.delete('/staff/bulk', { data: { ids: selectedIds } }); toast.success(`${selectedIds.length} staff deleted`); setSelectedIds([]); fetchData(); }
    catch { toast.error('Error deleting staff'); }
  };
  const handleBulkUpdate = async (data) => {
    try { await api.patch('/staff/bulk', { ids: selectedIds, data }); toast.success(`${selectedIds.length} staff updated`); setSelectedIds([]); fetchData(); }
    catch { toast.error('Error updating staff'); }
  };

  const handleExportCSV = async () => {
    try {
      const res = await api.get(`/staff?format=csv&sortBy=${sortBy}&sortOrder=${sortOrder}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.setAttribute('download', 'staff.csv');
      document.body.appendChild(a); a.click(); a.remove();
      toast.success('CSV exported');
    } catch { toast.error('Error exporting CSV'); }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text('Staff Report', 14, 16);
    autoTable(doc, { startY: 22, head: [['Name', 'Email', 'Phone', 'Role', 'Location', 'Status']], body: staff.map(m => [`${m.firstName} ${m.lastName}`, m.email, m.phone || '-', m.role, m.location?.name || '-', m.isActive ? 'Active' : 'Inactive']) });
    doc.save('staff.pdf');
    toast.success('PDF exported');
  };

  const detailFields = [{ label: 'First Name', key: 'firstName' }, { label: 'Last Name', key: 'lastName' }, { label: 'Email', key: 'email' }, { label: 'Phone', key: 'phone' }, { label: 'Role', key: 'role' }, { label: 'Active', key: 'isActive' }, { label: 'Last Login', key: 'lastLogin' }, { label: 'Created', key: 'createdAt' }];

  if (loading) return <div style={{ padding: 24 }}><TableSkeleton rows={8} cols={8} /></div>;

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Staff Management</h1><p className="page-subtitle">Manage employees and their roles</p></div>
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={handleExportCSV}><FiDownload /> CSV</button>
          <button className="btn btn-outline" onClick={handleExportPDF}><FiFileText /> PDF</button>
          <button className="btn btn-primary" onClick={() => openModal()}><FiPlus /> Add Staff</button>
        </div>
      </div>

      <BulkActionBar selectedCount={selectedIds.length} onBulkDelete={handleBulkDelete} onBulkUpdate={handleBulkUpdate} onClearSelection={() => setSelectedIds([])}
        updateOptions={[{ label: 'Deactivate', data: { isActive: false } }, { label: 'Activate', data: { isActive: true } }]} />

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th><input type="checkbox" onChange={handleSelectAll} checked={selectedIds.length === staff.length && staff.length > 0} /></th>
                <SortableHeader label="Name" field="firstName" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <SortableHeader label="Email" field="email" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <th>Phone</th>
                <SortableHeader label="Role" field="role" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                <th>Location</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(member => (
                <tr key={member.id} onClick={() => setDetailData(member)} style={{ cursor: 'pointer' }}>
                  <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(member.id)} onChange={() => handleSelectRow(member.id)} /></td>
                  <td style={{ fontWeight: 500 }}>{member.firstName} {member.lastName}</td>
                  <td>{member.email}</td>
                  <td>{member.phone || '-'}</td>
                  <td><span className={`badge ${getRoleBadge(member.role)}`}>{member.role}</span></td>
                  <td>{member.location?.name || '-'}</td>
                  <td><span className={`badge ${member.isActive ? 'badge-success' : 'badge-danger'}`}>{member.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td>{member.lastLogin ? new Date(member.lastLogin).toLocaleDateString() : 'Never'}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <button className="btn btn-outline btn-sm" onClick={() => openModal(member)}><FiEdit /></button>
                      <button className={`btn btn-sm ${member.isActive ? 'btn-danger' : 'btn-success'}`} onClick={() => toggleStatus(member)}>{member.isActive ? 'Deactivate' : 'Activate'}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && <tr><td colSpan="9" className="text-center" style={{ padding: 40, color: '#64748b' }}>No staff members found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <RowDetailModal isOpen={!!detailData} onClose={() => setDetailData(null)} data={detailData} title="Staff Details" fields={detailFields}
        onEdit={(m) => { setDetailData(null); openModal(m); }} onDelete={async (m) => { try { await api.delete('/staff/bulk', { data: { ids: [m.id] } }); toast.success('Staff deleted'); setDetailData(null); fetchData(); } catch { toast.error('Error'); } }} />

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">{editStaff ? 'Edit' : 'Add'} Staff Member</h3><button className="modal-close" onClick={() => setShowModal(false)}>&times;</button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label className="form-label">First Name *</label><input type="text" className="form-input" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />{formErrors.firstName && <span style={{ color: '#ef4444', fontSize: 12 }}>{formErrors.firstName}</span>}</div>
                  <div className="form-group"><label className="form-label">Last Name *</label><input type="text" className="form-input" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />{formErrors.lastName && <span style={{ color: '#ef4444', fontSize: 12 }}>{formErrors.lastName}</span>}</div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Email *</label><input type="email" className="form-input" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} disabled={editStaff} />{formErrors.email && <span style={{ color: '#ef4444', fontSize: 12 }}>{formErrors.email}</span>}</div>
                  <div className="form-group"><label className="form-label">Phone</label><input type="tel" className="form-input" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
                </div>
                {!editStaff && <div className="form-group"><label className="form-label">Password *</label><input type="password" className="form-input" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />{formErrors.password && <span style={{ color: '#ef4444', fontSize: 12 }}>{formErrors.password}</span>}</div>}
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Role *</label><select className="form-select" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}>{roles.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                  <div className="form-group"><label className="form-label">Location</label><select className="form-select" value={formData.locationId} onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}><option value="">No Location</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
                </div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">{editStaff ? 'Update' : 'Create'} Staff</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Staff;
