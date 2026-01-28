import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiUser, FiMail, FiPhone } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';

function Staff() {
  const [staff, setStaff] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editStaff, setEditStaff] = useState(null);
  const [formData, setFormData] = useState({
    email: '', phone: '', firstName: '', lastName: '',
    password: '', role: 'CLERK', locationId: ''
  });

  const roles = ['ADMIN', 'MANAGER', 'CLERK', 'PRESSER', 'CLEANER'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [staffRes, locationsRes] = await Promise.all([
        api.get('/staff'),
        api.get('/locations')
      ]);
      setStaff(staffRes.data);
      setLocations(locationsRes.data);
    } catch (error) {
      toast.error('Error loading staff');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editStaff) {
        await api.put(`/staff/${editStaff.id}`, formData);
        toast.success('Staff updated');
      } else {
        await api.post('/staff', formData);
        toast.success('Staff created');
      }
      setShowModal(false);
      setEditStaff(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error saving staff');
    }
  };

  const openModal = (member = null) => {
    if (member) {
      setEditStaff(member);
      setFormData({
        email: member.email,
        phone: member.phone || '',
        firstName: member.firstName,
        lastName: member.lastName,
        password: '',
        role: member.role,
        locationId: member.location?.id || ''
      });
    } else {
      setEditStaff(null);
      setFormData({
        email: '', phone: '', firstName: '', lastName: '',
        password: '', role: 'CLERK', locationId: locations[0]?.id || ''
      });
    }
    setShowModal(true);
  };

  const toggleStatus = async (member) => {
    try {
      const endpoint = member.isActive ? 'deactivate' : 'activate';
      await api.post(`/staff/${member.id}/${endpoint}`);
      toast.success(`Staff ${member.isActive ? 'deactivated' : 'activated'}`);
      fetchData();
    } catch (error) {
      toast.error('Error updating staff status');
    }
  };

  const getRoleBadge = (role) => {
    const colors = {
      ADMIN: 'badge-danger',
      MANAGER: 'badge-warning',
      CLERK: 'badge-primary',
      PRESSER: 'badge-info',
      CLEANER: 'badge-secondary'
    };
    return colors[role] || 'badge-secondary';
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Staff Management</h1>
          <p className="page-subtitle">Manage employees and their roles</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <FiPlus /> Add Staff
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Location</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(member => (
                <tr key={member.id}>
                  <td style={{ fontWeight: 500 }}>{member.firstName} {member.lastName}</td>
                  <td>{member.email}</td>
                  <td>{member.phone || '-'}</td>
                  <td>
                    <span className={`badge ${getRoleBadge(member.role)}`}>{member.role}</span>
                  </td>
                  <td>{member.location?.name || '-'}</td>
                  <td>
                    <span className={`badge ${member.isActive ? 'badge-success' : 'badge-danger'}`}>
                      {member.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    {member.lastLogin ? new Date(member.lastLogin).toLocaleDateString() : 'Never'}
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-outline btn-sm" onClick={() => openModal(member)}>
                        <FiEdit />
                      </button>
                      <button
                        className={`btn btn-sm ${member.isActive ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => toggleStatus(member)}
                      >
                        {member.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr>
                  <td colSpan="8" className="text-center" style={{ padding: 40, color: '#64748b' }}>
                    No staff members found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editStaff ? 'Edit' : 'Add'} Staff Member</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
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
                      disabled={editStaff}
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
                {!editStaff && (
                  <div className="form-group">
                    <label className="form-label">Password *</label>
                    <input
                      type="password"
                      className="form-input"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required={!editStaff}
                    />
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Role *</label>
                    <select
                      className="form-select"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      required
                    >
                      {roles.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <select
                      className="form-select"
                      value={formData.locationId}
                      onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                    >
                      <option value="">No Location</option>
                      {locations.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editStaff ? 'Update' : 'Create'} Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Staff;
