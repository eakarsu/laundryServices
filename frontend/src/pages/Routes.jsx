import React, { useState, useEffect } from 'react';
import { FiPlus, FiMap, FiTruck, FiCalendar, FiNavigation } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';

function Routes_() {
  const [routes, setRoutes] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [unassignedPickups, setUnassignedPickups] = useState([]);
  const [unassignedDeliveries, setUnassignedDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ driverId: '', pickupIds: [], deliveryIds: [] });
  const [orders, setOrders] = useState([]);
  const [selectedPickupOrders, setSelectedPickupOrders] = useState([]);
  const [selectedDeliveryOrders, setSelectedDeliveryOrders] = useState([]);

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    try {
      const [routesRes, driversRes, ordersRes] = await Promise.all([
        api.get(`/routes?date=${selectedDate}`),
        api.get('/drivers'),
        api.get('/orders?limit=50')
      ]);

      const routesData = Array.isArray(routesRes.data) ? routesRes.data : [];
      const driversData = Array.isArray(driversRes.data) ? driversRes.data : (driversRes.data.drivers || []);
      const ordersData = ordersRes.data.orders || ordersRes.data.data || ordersRes.data || [];

      setRoutes(routesData);
      setDrivers(driversData);
      setOrders(Array.isArray(ordersData) ? ordersData : []);

      // Try to get unassigned pickups/deliveries, but don't fail if not available
      try {
        const [pickupsRes, deliveriesRes] = await Promise.all([
          api.get(`/routes/unassigned/pickups?date=${selectedDate}`),
          api.get(`/routes/unassigned/deliveries?date=${selectedDate}`)
        ]);
        setUnassignedPickups(Array.isArray(pickupsRes.data) ? pickupsRes.data : []);
        setUnassignedDeliveries(Array.isArray(deliveriesRes.data) ? deliveriesRes.data : []);
      } catch (e) {
        console.log('Could not fetch unassigned pickups/deliveries');
        setUnassignedPickups([]);
        setUnassignedDeliveries([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoute = async (e) => {
    e.preventDefault();
    try {
      await api.post('/routes', {
        driverId: formData.driverId,
        date: selectedDate,
        pickupIds: formData.pickupIds,
        deliveryIds: formData.deliveryIds,
        pickupOrderIds: selectedPickupOrders,
        deliveryOrderIds: selectedDeliveryOrders
      });
      toast.success('Route created');
      setShowModal(false);
      setFormData({ driverId: '', pickupIds: [], deliveryIds: [] });
      setSelectedPickupOrders([]);
      setSelectedDeliveryOrders([]);
      fetchData();
    } catch (error) {
      console.error('Error creating route:', error);
      toast.error(error.response?.data?.error || 'Error creating route');
    }
  };

  const handleOptimize = async (routeId) => {
    try {
      await api.post(`/routes/${routeId}/optimize`);
      toast.success('Route optimized');
      fetchData();
    } catch (error) {
      toast.error('Error optimizing route');
    }
  };

  const handleStatusUpdate = async (routeId, status) => {
    try {
      await api.patch(`/routes/${routeId}/status`, { status });
      toast.success(`Route ${status.toLowerCase()}`);
      fetchData();
    } catch (error) {
      toast.error('Error updating route');
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      PLANNED: 'badge-warning',
      IN_PROGRESS: 'badge-primary',
      COMPLETED: 'badge-success',
      CANCELLED: 'badge-danger'
    };
    return colors[status] || 'badge-secondary';
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Route Management</h1>
          <p className="page-subtitle">Plan and optimize delivery routes</p>
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            className="form-input"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ width: 180 }}
          />
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <FiPlus /> Create Route
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Today's Routes</div>
          <div className="stat-value">{routes.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unassigned Pickups</div>
          <div className="stat-value">{unassignedPickups.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unassigned Deliveries</div>
          <div className="stat-value">{unassignedDeliveries.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Available Drivers</div>
          <div className="stat-value">{drivers.length}</div>
        </div>
      </div>

      <div className="card">
        <h4 style={{ marginBottom: 16 }}>Routes for {new Date(selectedDate).toLocaleDateString()}</h4>

        {routes.length === 0 ? (
          <div className="empty-state">
            <FiMap size={48} />
            <h3>No Routes</h3>
            <p>No routes scheduled for this date</p>
          </div>
        ) : (
          <div className="grid-2" style={{ gap: 16 }}>
            {routes.map(route => (
              <div key={route.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                <div className="flex-between" style={{ marginBottom: 12 }}>
                  <div className="flex gap-2" style={{ alignItems: 'center' }}>
                    <FiTruck size={20} style={{ color: '#2563eb' }} />
                    <div>
                      <div style={{ fontWeight: 600 }}>{route.driver?.firstName} {route.driver?.lastName}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{route.driver?.phone}</div>
                    </div>
                  </div>
                  <span className={`badge ${getStatusBadge(route.status)}`}>{route.status}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Pickups</div>
                    <div style={{ fontSize: 20, fontWeight: 600 }}>{route.pickups?.length || 0}</div>
                  </div>
                  <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Deliveries</div>
                    <div style={{ fontSize: 20, fontWeight: 600 }}>{route.deliveries?.length || 0}</div>
                  </div>
                </div>

                <div className="flex gap-1">
                  {route.status === 'PLANNED' && (
                    <>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => handleOptimize(route.id)}
                      >
                        <FiNavigation /> Optimize
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleStatusUpdate(route.id, 'IN_PROGRESS')}
                      >
                        Start Route
                      </button>
                    </>
                  )}
                  {route.status === 'IN_PROGRESS' && (
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleStatusUpdate(route.id, 'COMPLETED')}
                    >
                      Complete Route
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Create Route</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateRoute}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Driver *</label>
                  <select
                    className="form-select"
                    value={formData.driverId}
                    onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
                    required
                  >
                    <option value="">Select driver...</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Select Orders for Pickup (PENDING orders) - {selectedPickupOrders.length} selected</label>
                  <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8 }}>
                    {orders.filter(o => o.status === 'PENDING').map(order => (
                      <label key={order.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedPickupOrders.includes(order.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPickupOrders([...selectedPickupOrders, order.id]);
                            } else {
                              setSelectedPickupOrders(selectedPickupOrders.filter(id => id !== order.id));
                            }
                          }}
                        />
                        <span style={{ fontSize: 13 }}>
                          {order.orderNumber} - {order.customer?.firstName} {order.customer?.lastName}
                        </span>
                      </label>
                    ))}
                    {orders.filter(o => o.status === 'PENDING').length === 0 && (
                      <div style={{ color: '#64748b', fontSize: 13, padding: 8 }}>No pending orders available</div>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Select Orders for Delivery (READY orders) - {selectedDeliveryOrders.length} selected</label>
                  <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8 }}>
                    {orders.filter(o => o.status === 'READY').map(order => (
                      <label key={order.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedDeliveryOrders.includes(order.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDeliveryOrders([...selectedDeliveryOrders, order.id]);
                            } else {
                              setSelectedDeliveryOrders(selectedDeliveryOrders.filter(id => id !== order.id));
                            }
                          }}
                        />
                        <span style={{ fontSize: 13 }}>
                          {order.orderNumber} - {order.customer?.firstName} {order.customer?.lastName}
                        </span>
                      </label>
                    ))}
                    {orders.filter(o => o.status === 'READY').length === 0 && (
                      <div style={{ color: '#64748b', fontSize: 13, padding: 8 }}>No ready orders available</div>
                    )}
                  </div>
                </div>

                {/* Also show existing unassigned pickups/deliveries if available */}
                {unassignedPickups.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">Existing Unassigned Pickups</label>
                    <div style={{ maxHeight: 100, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8 }}>
                      {unassignedPickups.map(p => (
                        <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 4 }}>
                          <input
                            type="checkbox"
                            checked={formData.pickupIds.includes(p.id)}
                            onChange={(e) => {
                              const ids = e.target.checked
                                ? [...formData.pickupIds, p.id]
                                : formData.pickupIds.filter(id => id !== p.id);
                              setFormData({ ...formData, pickupIds: ids });
                            }}
                          />
                          <span style={{ fontSize: 13 }}>{p.order?.orderNumber} - {p.address?.street}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {unassignedDeliveries.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">Existing Unassigned Deliveries</label>
                    <div style={{ maxHeight: 100, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8 }}>
                      {unassignedDeliveries.map(d => (
                        <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 4 }}>
                          <input
                            type="checkbox"
                            checked={formData.deliveryIds.includes(d.id)}
                            onChange={(e) => {
                              const ids = e.target.checked
                                ? [...formData.deliveryIds, d.id]
                                : formData.deliveryIds.filter(id => id !== d.id);
                              setFormData({ ...formData, deliveryIds: ids });
                            }}
                          />
                          <span style={{ fontSize: 13 }}>{d.order?.orderNumber} - {d.address?.street}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Route
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Routes_;
