import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiMapPin, FiClock, FiPhone } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';

function Locations() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editLocation, setEditLocation] = useState(null);
  const [formData, setFormData] = useState({
    name: '', address: '', city: '', state: '', zipCode: '',
    phone: '', openTime: '07:00', closeTime: '19:00'
  });

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const res = await api.get('/locations');
      setLocations(res.data);
    } catch (error) {
      toast.error('Error loading locations');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editLocation) {
        await api.put(`/locations/${editLocation.id}`, formData);
        toast.success('Location updated');
      } else {
        await api.post('/locations', formData);
        toast.success('Location created');
      }
      setShowModal(false);
      setEditLocation(null);
      fetchLocations();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error saving location');
    }
  };

  const openModal = (location = null) => {
    if (location) {
      setEditLocation(location);
      setFormData({
        name: location.name,
        address: location.address,
        city: location.city,
        state: location.state,
        zipCode: location.zipCode,
        phone: location.phone || '',
        openTime: location.openTime || '07:00',
        closeTime: location.closeTime || '19:00'
      });
    } else {
      setEditLocation(null);
      setFormData({
        name: '', address: '', city: '', state: '', zipCode: '',
        phone: '', openTime: '07:00', closeTime: '19:00'
      });
    }
    setShowModal(true);
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Locations</h1>
          <p className="page-subtitle">Manage store locations</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <FiPlus /> Add Location
        </button>
      </div>

      <div className="grid-2">
        {locations.map(location => (
          <div key={location.id} className="card">
            <div className="flex-between" style={{ marginBottom: 16 }}>
              <h4>{location.name}</h4>
              <span className={`badge ${location.isActive ? 'badge-success' : 'badge-danger'}`}>
                {location.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
              <div className="flex gap-1" style={{ marginBottom: 8 }}>
                <FiMapPin size={14} />
                <span>{location.address}, {location.city}, {location.state} {location.zipCode}</span>
              </div>
              {location.phone && (
                <div className="flex gap-1" style={{ marginBottom: 8 }}>
                  <FiPhone size={14} />
                  <span>{location.phone}</span>
                </div>
              )}
              {location.openTime && location.closeTime && (
                <div className="flex gap-1">
                  <FiClock size={14} />
                  <span>{location.openTime} - {location.closeTime}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 600 }}>{location._count?.machines || 0}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Machines</div>
              </div>
              <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 600 }}>{location._count?.staff || 0}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Staff</div>
              </div>
            </div>

            <button className="btn btn-outline btn-sm" onClick={() => openModal(location)}>
              <FiEdit /> Edit
            </button>
          </div>
        ))}

        {locations.length === 0 && (
          <div className="card" style={{ gridColumn: 'span 2', textAlign: 'center', padding: 60 }}>
            <FiMapPin size={48} style={{ color: '#64748b', marginBottom: 16 }} />
            <h3>No Locations</h3>
            <p style={{ color: '#64748b' }}>Add your first location to get started</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editLocation ? 'Edit' : 'Add'} Location</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Location Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Address *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">City *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">ZIP Code *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.zipCode}
                      onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                      required
                    />
                  </div>
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
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Opening Time</label>
                    <input
                      type="time"
                      className="form-input"
                      value={formData.openTime}
                      onChange={(e) => setFormData({ ...formData, openTime: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Closing Time</label>
                    <input
                      type="time"
                      className="form-input"
                      value={formData.closeTime}
                      onChange={(e) => setFormData({ ...formData, closeTime: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editLocation ? 'Update' : 'Create'} Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Locations;
