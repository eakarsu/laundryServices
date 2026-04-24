import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiBox, FiMapPin, FiDownload, FiFileText } from 'react-icons/fi';
import { toast } from 'react-toastify';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../services/api';
import { CardSkeleton } from '../components/LoadingSkeleton';
import RowDetailModal from '../components/RowDetailModal';

function Lockers() {
  const [lockers, setLockers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editLocker, setEditLocker] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [formData, setFormData] = useState({
    name: '', location: '', address: '', totalUnits: ''
  });

  useEffect(() => {
    fetchLockers();
  }, []);

  const fetchLockers = async () => {
    try {
      const res = await api.get('/lockers');
      setLockers(res.data);
    } catch (error) {
      toast.error('Error loading lockers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editLocker) {
        await api.put(`/lockers/${editLocker.id}`, formData);
        toast.success('Locker updated');
      } else {
        await api.post('/lockers', formData);
        toast.success('Locker created');
      }
      setShowModal(false);
      setEditLocker(null);
      fetchLockers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error saving locker');
    }
  };

  const openModal = (locker = null) => {
    if (locker) {
      setEditLocker(locker);
      setFormData({
        name: locker.name,
        location: locker.location,
        address: locker.address,
        totalUnits: locker.totalUnits
      });
    } else {
      setEditLocker(null);
      setFormData({ name: '', location: '', address: '', totalUnits: '' });
    }
    setShowModal(true);
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Location', 'Address', 'Total Units', 'Available Units', 'Active'];
    const rows = lockers.map(l => [
      l.name, l.location, l.address,
      l.totalUnits, l.availableUnits,
      l.isActive ? 'Yes' : 'No'
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'lockers.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Locker Stations Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

    autoTable(doc, {
      startY: 35,
      head: [['Name', 'Location', 'Address', 'Total Units', 'Available', 'Active']],
      body: lockers.map(l => [
        l.name, l.location, l.address,
        l.totalUnits, l.availableUnits,
        l.isActive ? 'Yes' : 'No'
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] }
    });

    doc.save('lockers.pdf');
    toast.success('PDF exported successfully');
  };

  if (loading) {
    return <div style={{ padding: 24 }}><CardSkeleton count={6} /></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Locker Stations</h1>
          <p className="page-subtitle">Manage self-service pickup locker locations</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={handleExportCSV} title="Export CSV">
            <FiDownload /> CSV
          </button>
          <button className="btn btn-outline" onClick={handleExportPDF} title="Export PDF">
            <FiFileText /> PDF
          </button>
          <button className="btn btn-primary" onClick={() => openModal()}>
            <FiPlus /> Add Locker Station
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-label">Total Stations</div>
          <div className="stat-value">{lockers.length}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Total Units</div>
          <div className="stat-value">{lockers.reduce((sum, l) => sum + l.totalUnits, 0)}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">Available Units</div>
          <div className="stat-value">{lockers.reduce((sum, l) => sum + l.availableUnits, 0)}</div>
        </div>
        <div className="stat-card info">
          <div className="stat-label">In Use</div>
          <div className="stat-value">
            {lockers.reduce((sum, l) => sum + (l.totalUnits - l.availableUnits), 0)}
          </div>
        </div>
      </div>

      <div className="grid-3">
        {lockers.map(locker => (
          <div key={locker.id} className="card" onClick={() => setDetailData(locker)} style={{ cursor: 'pointer' }}>
            <div className="flex-between" style={{ marginBottom: 16 }}>
              <div className="flex gap-2" style={{ alignItems: 'center' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 8,
                  background: '#eff6ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <FiBox size={24} style={{ color: '#2563eb' }} />
                </div>
                <div>
                  <h4>{locker.name}</h4>
                  <span className={`badge ${locker.isActive ? 'badge-success' : 'badge-danger'}`}>
                    {locker.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
              <div className="flex gap-1" style={{ marginBottom: 4 }}>
                <FiMapPin size={14} />
                <span>{locker.location}</span>
              </div>
              <div style={{ fontSize: 12 }}>{locker.address}</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div className="flex-between" style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#64748b' }}>Capacity</span>
                <span style={{ fontWeight: 500 }}>
                  {locker.availableUnits} / {locker.totalUnits} available
                </span>
              </div>
              <div style={{
                height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${((locker.totalUnits - locker.availableUnits) / locker.totalUnits) * 100}%`,
                  background: locker.availableUnits > 5 ? '#22c55e' : locker.availableUnits > 0 ? '#f59e0b' : '#ef4444',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>

            <div onClick={e => e.stopPropagation()}>
              <button className="btn btn-outline btn-sm" onClick={() => openModal(locker)}>
                <FiEdit /> Edit
              </button>
            </div>
          </div>
        ))}

        {lockers.length === 0 && (
          <div className="card" style={{ gridColumn: 'span 3', textAlign: 'center', padding: 60 }}>
            <FiBox size={48} style={{ color: '#64748b', marginBottom: 16 }} />
            <h3>No Locker Stations</h3>
            <p style={{ color: '#64748b' }}>Add your first locker station</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editLocker ? 'Edit' : 'Add'} Locker Station</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Station Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Location *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Grand Central Terminal"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
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
                <div className="form-group">
                  <label className="form-label">Total Units *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.totalUnits}
                    onChange={(e) => setFormData({ ...formData, totalUnits: parseInt(e.target.value) })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editLocker ? 'Update' : 'Create'} Station
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

export default Lockers;
