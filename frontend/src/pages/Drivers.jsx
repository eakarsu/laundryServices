import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiTruck, FiPhone, FiMail, FiMapPin } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';

function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editDriver, setEditDriver] = useState(null);
  const [formData, setFormData] = useState({
    email: '', phone: '', firstName: '', lastName: '',
    password: '', licenseNumber: '', vehicleInfo: ''
  });

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      const res = await api.get('/drivers');
      setDrivers(res.data);
    } catch (error) {
      toast.error('Error loading drivers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editDriver) {
        await api.put(`/drivers/${editDriver.id}`, formData);
        toast.success('Driver updated');
      } else {
        await api.post('/drivers', formData);
        toast.success('Driver created');
      }
      setShowModal(false);
      setEditDriver(null);
      fetchDrivers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error saving driver');
    }
  };

  const openModal = (driver = null) => {
    if (driver) {
      setEditDriver(driver);
      setFormData({
        email: driver.email,
        phone: driver.phone,
        firstName: driver.firstName,
        lastName: driver.lastName,
        password: '',
        licenseNumber: driver.licenseNumber || '',
        vehicleInfo: driver.vehicleInfo || ''
      });
    } else {
      setEditDriver(null);
      setFormData({
        email: '', phone: '', firstName: '', lastName: '',
        password: '', licenseNumber: '', vehicleInfo: ''
      });
    }
    setShowModal(true);
  };

  const toggleAvailability = async (driver) => {
    try {
      await api.patch(`/drivers/${driver.id}/availability`, {
        isAvailable: !driver.isAvailable
      });
      toast.success(`Driver ${driver.isAvailable ? 'set unavailable' : 'set available'}`);
      fetchDrivers();
    } catch (error) {
      toast.error('Error updating availability');
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Drivers</h1>
          <p className="page-subtitle">Manage delivery drivers</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <FiPlus /> Add Driver
        </button>
      </div>

      <div className="grid-3">
        {drivers.map(driver => (
          <div key={driver.id} className="card">
            <div className="flex-between" style={{ marginBottom: 16 }}>
              <div className="flex gap-2" style={{ alignItems: 'center' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: driver.isAvailable ? '#dcfce7' : '#fee2e2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <FiTruck size={24} style={{ color: driver.isAvailable ? '#22c55e' : '#ef4444' }} />
                </div>
                <div>
                  <h4>{driver.firstName} {driver.lastName}</h4>
                  <span className={`badge ${driver.isAvailable ? 'badge-success' : 'badge-danger'}`}>
                    {driver.isAvailable ? 'Available' : 'Unavailable'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 14, marginBottom: 16 }}>
              <div className="flex gap-1" style={{ marginBottom: 8, color: '#64748b' }}>
                <FiMail size={14} /> {driver.email}
              </div>
              <div className="flex gap-1" style={{ marginBottom: 8, color: '#64748b' }}>
                <FiPhone size={14} /> {driver.phone}
              </div>
              {driver.vehicleInfo && (
                <div className="flex gap-1" style={{ color: '#64748b' }}>
                  <FiTruck size={14} /> {driver.vehicleInfo}
                </div>
              )}
            </div>

            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
              <div className="flex-between">
                <span>Total Pickups:</span>
                <span style={{ fontWeight: 500 }}>{driver._count?.pickups || 0}</span>
              </div>
              <div className="flex-between">
                <span>Total Deliveries:</span>
                <span style={{ fontWeight: 500 }}>{driver._count?.deliveries || 0}</span>
              </div>
            </div>

            <div className="flex gap-1">
              <button className="btn btn-outline btn-sm" onClick={() => openModal(driver)}>
                <FiEdit /> Edit
              </button>
              <button
                className={`btn btn-sm ${driver.isAvailable ? 'btn-danger' : 'btn-success'}`}
                onClick={() => toggleAvailability(driver)}
              >
                {driver.isAvailable ? 'Set Unavailable' : 'Set Available'}
              </button>
            </div>
          </div>
        ))}

        {drivers.length === 0 && (
          <div className="card" style={{ gridColumn: 'span 3', textAlign: 'center', padding: 60 }}>
            <FiTruck size={48} style={{ color: '#64748b', marginBottom: 16 }} />
            <h3>No Drivers</h3>
            <p style={{ color: '#64748b' }}>Add your first driver to start managing deliveries</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editDriver ? 'Edit' : 'Add'} Driver</h3>
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
                      disabled={editDriver}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone *</label>
                    <input
                      type="tel"
                      className="form-input"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>
                </div>
                {!editDriver && (
                  <div className="form-group">
                    <label className="form-label">Password *</label>
                    <input
                      type="password"
                      className="form-input"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required={!editDriver}
                    />
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">License Number</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.licenseNumber}
                      onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vehicle Info</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g., 2022 Ford Transit - White"
                      value={formData.vehicleInfo}
                      onChange={(e) => setFormData({ ...formData, vehicleInfo: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editDriver ? 'Update' : 'Create'} Driver
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Drivers;
