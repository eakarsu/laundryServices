import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';

function Services() {
  const [services, setServices] = useState([]);
  const [garments, setGarments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('services');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '', description: '', category: 'DRY_CLEANING', basePrice: '', estimatedDays: 2
  });

  const serviceCategories = ['DRY_CLEANING', 'LAUNDRY', 'WASH_FOLD', 'PRESSING', 'ALTERATIONS', 'SPECIALTY'];
  const garmentCategories = ['Tops', 'Bottoms', 'Outerwear', 'Dresses', 'Specialty', 'Accessories', 'Household'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [servicesRes, garmentsRes] = await Promise.all([
        api.get('/services'),
        api.get('/garments')
      ]);
      setServices(servicesRes.data);
      setGarments(garmentsRes.data);
    } catch (error) {
      toast.error('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (activeTab === 'services') {
        if (editItem) {
          await api.put(`/services/${editItem.id}`, formData);
          toast.success('Service updated');
        } else {
          await api.post('/services', formData);
          toast.success('Service created');
        }
      } else {
        if (editItem) {
          await api.put(`/garments/${editItem.id}`, formData);
          toast.success('Garment type updated');
        } else {
          await api.post('/garments', formData);
          toast.success('Garment type created');
        }
      }
      setShowModal(false);
      setEditItem(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error saving');
    }
  };

  const openModal = (item = null) => {
    if (item) {
      setEditItem(item);
      setFormData({
        name: item.name,
        description: item.description || '',
        category: item.category,
        basePrice: item.basePrice,
        estimatedDays: item.estimatedDays || 2
      });
    } else {
      setEditItem(null);
      setFormData({
        name: '', description: '',
        category: activeTab === 'services' ? 'DRY_CLEANING' : 'Tops',
        basePrice: '', estimatedDays: 2
      });
    }
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to deactivate this item?')) return;
    try {
      const endpoint = activeTab === 'services' ? `/services/${id}` : `/garments/${id}`;
      await api.delete(endpoint);
      toast.success('Item deactivated');
      fetchData();
    } catch (error) {
      toast.error('Error deleting');
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Services & Garments</h1>
          <p className="page-subtitle">Manage service offerings and garment types</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <FiPlus /> Add {activeTab === 'services' ? 'Service' : 'Garment Type'}
        </button>
      </div>

      <div className="card">
        <div className="tabs">
          <div className={`tab ${activeTab === 'services' ? 'active' : ''}`} onClick={() => setActiveTab('services')}>
            Services ({services.length})
          </div>
          <div className={`tab ${activeTab === 'garments' ? 'active' : ''}`} onClick={() => setActiveTab('garments')}>
            Garment Types ({garments.length})
          </div>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Base Price</th>
                {activeTab === 'services' && <th>Est. Days</th>}
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(activeTab === 'services' ? services : garments).map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 500 }}>{item.name}</td>
                  <td>
                    <span className="badge badge-secondary">{item.category.replace('_', ' ')}</span>
                  </td>
                  <td>${parseFloat(item.basePrice).toFixed(2)}</td>
                  {activeTab === 'services' && <td>{item.estimatedDays} days</td>}
                  <td>
                    <span className={`badge ${item.isActive ? 'badge-success' : 'badge-danger'}`}>
                      {item.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-outline btn-sm" onClick={() => openModal(item)}>
                        <FiEdit />
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={() => handleDelete(item.id)}>
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editItem ? 'Edit' : 'Add'} {activeTab === 'services' ? 'Service' : 'Garment Type'}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                {activeTab === 'services' && (
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-textarea"
                      rows={2}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <select
                      className="form-select"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                    >
                      {(activeTab === 'services' ? serviceCategories : garmentCategories).map(cat => (
                        <option key={cat} value={cat}>{cat.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Base Price *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={formData.basePrice}
                      onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                      required
                    />
                  </div>
                </div>
                {activeTab === 'services' && (
                  <div className="form-group">
                    <label className="form-label">Estimated Days</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.estimatedDays}
                      onChange={(e) => setFormData({ ...formData, estimatedDays: parseInt(e.target.value) })}
                    />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editItem ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Services;
