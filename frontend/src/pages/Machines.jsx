import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiPlay, FiSquare, FiTool, FiActivity, FiDownload, FiFileText } from 'react-icons/fi';
import { toast } from 'react-toastify';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../services/api';
import { CardSkeleton } from '../components/LoadingSkeleton';
import RowDetailModal from '../components/RowDetailModal';

function Machines() {
  const [machines, setMachines] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [formData, setFormData] = useState({
    machineNumber: '', type: 'WASHER', brand: '', model: '',
    capacity: '', pricePerCycle: '', locationId: '', isRemoteEnabled: true
  });
  const [cycleData, setCycleData] = useState({ cycleDurationMinutes: 45, amountPaid: '' });

  const machineTypes = ['WASHER', 'DRYER', 'COMBO', 'PRESS', 'FOLDER'];
  const statuses = ['AVAILABLE', 'IN_USE', 'OUT_OF_ORDER', 'MAINTENANCE', 'RESERVED'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [machinesRes, locationsRes] = await Promise.all([
        api.get('/machines'),
        api.get('/locations')
      ]);
      setMachines(machinesRes.data);
      setLocations(locationsRes.data);
    } catch (error) {
      toast.error('Error loading machines');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedMachine) {
        await api.put(`/machines/${selectedMachine.id}`, formData);
        toast.success('Machine updated');
      } else {
        await api.post('/machines', formData);
        toast.success('Machine created');
      }
      setShowModal(false);
      setSelectedMachine(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error saving machine');
    }
  };

  const openModal = (machine = null) => {
    if (machine) {
      setSelectedMachine(machine);
      setFormData({
        machineNumber: machine.machineNumber,
        type: machine.type,
        brand: machine.brand || '',
        model: machine.model || '',
        capacity: machine.capacity || '',
        pricePerCycle: machine.pricePerCycle,
        locationId: machine.locationId,
        isRemoteEnabled: machine.isRemoteEnabled
      });
    } else {
      setSelectedMachine(null);
      setFormData({
        machineNumber: '', type: 'WASHER', brand: '', model: '',
        capacity: '', pricePerCycle: '', locationId: locations[0]?.id || '', isRemoteEnabled: true
      });
    }
    setShowModal(true);
  };

  const handleStartCycle = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/machines/${selectedMachine.id}/start`, cycleData);
      toast.success('Cycle started');
      setShowStartModal(false);
      setSelectedMachine(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error starting cycle');
    }
  };

  const handleCompleteCycle = async (machineId) => {
    try {
      await api.post(`/machines/${machineId}/complete`);
      toast.success('Cycle completed');
      fetchData();
    } catch (error) {
      toast.error('Error completing cycle');
    }
  };

  const handleStatusChange = async (machineId, status) => {
    try {
      await api.patch(`/machines/${machineId}/status`, { status });
      toast.success('Status updated');
      fetchData();
    } catch (error) {
      toast.error('Error updating status');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      AVAILABLE: '#22c55e',
      IN_USE: '#3b82f6',
      OUT_OF_ORDER: '#ef4444',
      MAINTENANCE: '#f59e0b',
      RESERVED: '#8b5cf6'
    };
    return colors[status] || '#64748b';
  };

  const handleExportCSV = () => {
    const headers = ['Machine #', 'Type', 'Brand', 'Model', 'Location', 'Price/Cycle', 'Status', 'Capacity'];
    const rows = machines.map(m => [
      m.machineNumber, m.type, m.brand || '', m.model || '',
      m.location?.name || '', parseFloat(m.pricePerCycle).toFixed(2),
      m.status, m.capacity || ''
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'machines.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Machines Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

    autoTable(doc, {
      startY: 35,
      head: [['Machine #', 'Type', 'Brand', 'Model', 'Location', 'Price/Cycle', 'Status']],
      body: machines.map(m => [
        m.machineNumber, m.type, m.brand || '-', m.model || '-',
        m.location?.name || '-', `$${parseFloat(m.pricePerCycle).toFixed(2)}`, m.status
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] }
    });

    doc.save('machines.pdf');
    toast.success('PDF exported successfully');
  };

  if (loading) {
    return <div style={{ padding: 24 }}><CardSkeleton count={8} /></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Machine Management</h1>
          <p className="page-subtitle">Monitor and control laundromat machines</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={handleExportCSV} title="Export CSV">
            <FiDownload /> CSV
          </button>
          <button className="btn btn-outline" onClick={handleExportPDF} title="Export PDF">
            <FiFileText /> PDF
          </button>
          <button className="btn btn-primary" onClick={() => openModal()}>
            <FiPlus /> Add Machine
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card success">
          <div className="stat-label">Available</div>
          <div className="stat-value">{machines.filter(m => m.status === 'AVAILABLE').length}</div>
        </div>
        <div className="stat-card primary">
          <div className="stat-label">In Use</div>
          <div className="stat-value">{machines.filter(m => m.status === 'IN_USE').length}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">Maintenance</div>
          <div className="stat-value">{machines.filter(m => m.status === 'MAINTENANCE').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Machines</div>
          <div className="stat-value">{machines.length}</div>
        </div>
      </div>

      <div className="grid-4">
        {machines.map(machine => (
          <div key={machine.id} className="card" style={{ padding: 16, cursor: 'pointer' }} onClick={() => setDetailData(machine)}>
            <div className="flex-between" style={{ marginBottom: 12 }}>
              <div>
                <h4 style={{ marginBottom: 4 }}>{machine.machineNumber}</h4>
                <span className="badge badge-secondary">{machine.type}</span>
              </div>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                backgroundColor: getStatusColor(machine.status)
              }} />
            </div>

            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
              <div>{machine.brand} {machine.model}</div>
              <div>{machine.location?.name}</div>
              <div style={{ fontWeight: 500, color: '#1e293b' }}>${parseFloat(machine.pricePerCycle).toFixed(2)} / cycle</div>
            </div>

            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
              <span className="badge" style={{ backgroundColor: getStatusColor(machine.status) + '20', color: getStatusColor(machine.status) }}>
                {machine.status.replace('_', ' ')}
              </span>
              {machine.status === 'IN_USE' && machine.currentCycleEnd && (
                <div style={{ marginTop: 8 }}>
                  Ends: {new Date(machine.currentCycleEnd).toLocaleTimeString()}
                </div>
              )}
            </div>

            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
              {machine.status === 'AVAILABLE' && (
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => { setSelectedMachine(machine); setCycleData({ ...cycleData, amountPaid: machine.pricePerCycle }); setShowStartModal(true); }}
                >
                  <FiPlay /> Start
                </button>
              )}
              {machine.status === 'IN_USE' && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleCompleteCycle(machine.id)}
                >
                  <FiSquare /> Complete
                </button>
              )}
              <button className="btn btn-outline btn-sm" onClick={() => openModal(machine)}>
                <FiEdit />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{selectedMachine ? 'Edit' : 'Add'} Machine</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Machine Number *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.machineNumber}
                      onChange={(e) => setFormData({ ...formData, machineNumber: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Type *</label>
                    <select
                      className="form-select"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      required
                    >
                      {machineTypes.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Brand</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Model</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Capacity</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g., 40 lbs"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Price per Cycle *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={formData.pricePerCycle}
                      onChange={(e) => setFormData({ ...formData, pricePerCycle: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Location *</label>
                  <select
                    className="form-select"
                    value={formData.locationId}
                    onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                    required
                  >
                    <option value="">Select location...</option>
                    {locations.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {selectedMachine ? 'Update' : 'Create'} Machine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStartModal && selectedMachine && (
        <div className="modal-overlay" onClick={() => setShowStartModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Start Cycle - {selectedMachine.machineNumber}</h3>
              <button className="modal-close" onClick={() => setShowStartModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleStartCycle}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Cycle Duration (minutes)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={cycleData.cycleDurationMinutes}
                    onChange={(e) => setCycleData({ ...cycleData, cycleDurationMinutes: parseInt(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Amount Paid</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={cycleData.amountPaid}
                    onChange={(e) => setCycleData({ ...cycleData, amountPaid: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowStartModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success">
                  <FiPlay /> Start Cycle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailData && (
        <RowDetailModal
          data={detailData}
          title={`Machine ${detailData.machineNumber}`}
          onClose={() => setDetailData(null)}
        />
      )}
    </div>
  );
}

export default Machines;
