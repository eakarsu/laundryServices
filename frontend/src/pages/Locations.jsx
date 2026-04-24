import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiMapPin, FiClock, FiPhone, FiDownload, FiFileText } from 'react-icons/fi';
import { toast } from 'react-toastify';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../services/api';
import { CardSkeleton } from '../components/LoadingSkeleton';
import RowDetailModal from '../components/RowDetailModal';

function Locations() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editLocation, setEditLocation] = useState(null);
  const [detailData, setDetailData] = useState(null);
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

  const handleExportCSV = () => {
    const headers = ['Name', 'Address', 'City', 'State', 'ZIP', 'Phone', 'Hours', 'Active', 'Machines', 'Staff'];
    const rows = locations.map(l => [
      l.name, l.address, l.city, l.state, l.zipCode,
      l.phone || '', `${l.openTime || ''}-${l.closeTime || ''}`,
      l.isActive ? 'Yes' : 'No',
      l._count?.machines || 0, l._count?.staff || 0
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'locations.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Locations Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

    autoTable(doc, {
      startY: 35,
      head: [['Name', 'Address', 'City', 'State', 'ZIP', 'Phone', 'Active', 'Machines']],
      body: locations.map(l => [
        l.name, l.address, l.city, l.state, l.zipCode,
        l.phone || '-', l.isActive ? 'Yes' : 'No',
        l._count?.machines || 0
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] }
    });

    doc.save('locations.pdf');
    toast.success('PDF exported successfully');
  };

  if (loading) {
    return <div style={{ padding: 24 }}><CardSkeleton count={4} /></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Locations</h1>
          <p className="page-subtitle">Manage store locations</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={handleExportCSV} title="Export CSV">
            <FiDownload /> CSV
          </button>
          <button className="btn btn-outline" onClick={handleExportPDF} title="Export PDF">
            <FiFileText /> PDF
          </button>
          <button className="btn btn-primary" onClick={() => openModal()}>
            <FiPlus /> Add Location
          </button>
        </div>
      </div>

      <div className="grid-2">
        {locations.map(location => (
          <div key={location.id} className="card" onClick={() => setDetailData(location)} style={{ cursor: 'pointer' }}>
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

            <div onClick={e => e.stopPropagation()}>
              <button className="btn btn-outline btn-sm" onClick={() => openModal(location)}>
                <FiEdit /> Edit
              </button>
            </div>
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

      {detailData && (
        <RowDetailModal
          data={detailData}
          title={detailData.name}
          onClose={() => setDetailData(null)}
        />
      )}
    </div>
  );
}

export default Locations;
