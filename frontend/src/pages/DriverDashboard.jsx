import React, { useState, useEffect } from 'react';
import {
  FiTruck, FiPackage, FiMapPin, FiCheck, FiPhone, FiNavigation,
  FiPlay, FiSquare, FiAlertCircle, FiClock
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';

function DriverDashboard() {
  const [routeData, setRouteData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);

  useEffect(() => {
    fetchData();

    // Start location tracking
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
        },
        { enableHighAccuracy: true, maximumAge: 10000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Send location updates periodically
  useEffect(() => {
    if (!currentLocation) return;

    const interval = setInterval(() => {
      updateLocation();
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [currentLocation]);

  const fetchData = async () => {
    try {
      console.log('Fetching driver route data...');
      const [routeRes, statsRes] = await Promise.all([
        api.get('/driver-mobile/my-route'),
        api.get('/driver-mobile/stats')
      ]);
      console.log('Route response:', routeRes.data);
      console.log('Stats response:', statsRes.data);
      setRouteData(routeRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching driver data:', error);
      toast.error('Error loading route data');
    } finally {
      setLoading(false);
    }
  };

  const updateLocation = async () => {
    if (!currentLocation) return;
    setUpdatingLocation(true);
    try {
      await api.post('/driver-mobile/location', {
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
        accuracy: currentLocation.accuracy
      });
    } catch (error) {
      console.error('Error updating location:', error);
    } finally {
      setUpdatingLocation(false);
    }
  };

  const handleStartRoute = async () => {
    if (!routeData?.route?.id) return;
    try {
      await api.post(`/driver-mobile/route/${routeData.route.id}/start`);
      toast.success('Route started');
      fetchData();
    } catch (error) {
      toast.error('Error starting route');
    }
  };

  const handleCompleteRoute = async () => {
    if (!routeData?.route?.id) return;
    try {
      await api.post(`/driver-mobile/route/${routeData.route.id}/complete`);
      toast.success('Route completed');
      fetchData();
    } catch (error) {
      toast.error('Error completing route');
    }
  };

  const handlePickupStatus = async (pickupId, status) => {
    try {
      await api.post(`/driver-mobile/pickup/${pickupId}/status`, {
        status,
        latitude: currentLocation?.lat,
        longitude: currentLocation?.lng
      });
      toast.success(`Pickup ${status.toLowerCase()}`);
      fetchData();
    } catch (error) {
      toast.error('Error updating pickup');
    }
  };

  const handleDeliveryStatus = async (deliveryId, status) => {
    try {
      await api.post(`/driver-mobile/delivery/${deliveryId}/status`, {
        status,
        latitude: currentLocation?.lat,
        longitude: currentLocation?.lng
      });
      toast.success(`Delivery ${status.toLowerCase()}`);
      fetchData();
    } catch (error) {
      toast.error('Error updating delivery');
    }
  };

  const openNavigation = (address) => {
    const query = encodeURIComponent(`${address.street}, ${address.city}, ${address.state} ${address.zipCode}`);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}`, '_blank');
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Driver Dashboard</h1>
          <p className="page-subtitle">
            {routeData?.route ? `Route for ${new Date(routeData.route.date).toLocaleDateString()}` : 'No active route'}
          </p>
        </div>
        {currentLocation && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiMapPin size={16} style={{ color: updatingLocation ? '#22c55e' : '#94a3b8' }} />
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {updatingLocation ? 'Syncing...' : 'GPS Active'}
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#dbeafe', color: '#2563eb' }}>
            <FiPackage size={24} />
          </div>
          <div>
            <div className="stat-label">Pickups Today</div>
            <div className="stat-value">{stats?.pickupsCompleted || 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>
            <FiTruck size={24} />
          </div>
          <div>
            <div className="stat-label">Deliveries Today</div>
            <div className="stat-value">{stats?.deliveriesCompleted || 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
            <FiClock size={24} />
          </div>
          <div>
            <div className="stat-label">Pending Pickups</div>
            <div className="stat-value">{stats?.pendingPickups || 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <FiAlertCircle size={24} />
          </div>
          <div>
            <div className="stat-label">Pending Deliveries</div>
            <div className="stat-value">{stats?.pendingDeliveries || 0}</div>
          </div>
        </div>
      </div>

      {/* Route Controls */}
      {routeData?.route && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="flex-between">
            <div>
              <h3 style={{ marginBottom: 4 }}>Today's Route</h3>
              <div style={{ fontSize: 14, color: '#64748b' }}>
                {routeData.route.totalStops} stops · {routeData.route.completedStops} completed
              </div>
            </div>
            <div className="flex gap-2">
              {routeData.route.status === 'PLANNED' && (
                <button className="btn btn-primary" onClick={handleStartRoute}>
                  <FiPlay /> Start Route
                </button>
              )}
              {routeData.route.status === 'IN_PROGRESS' && (
                <button className="btn btn-success" onClick={handleCompleteRoute}>
                  <FiSquare /> Complete Route
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: 16 }}>
            <div style={{
              height: 8,
              background: '#e2e8f0',
              borderRadius: 4,
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${(routeData.route.completedStops / routeData.route.totalStops) * 100}%`,
                background: '#22c55e',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Stops List */}
      {routeData?.stops && routeData.stops.length > 0 ? (
        <div className="card">
          <h4 style={{ marginBottom: 16 }}>Stops</h4>
          <div>
            {routeData.stops.map((stop, index) => (
              <StopCard
                key={stop.id}
                stop={stop}
                index={index}
                onPickupStatus={handlePickupStatus}
                onDeliveryStatus={handleDeliveryStatus}
                onNavigate={openNavigation}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <FiTruck size={48} style={{ color: '#94a3b8', marginBottom: 16 }} />
          <h3>No Route Assigned</h3>
          <p style={{ color: '#64748b' }}>You don't have any stops scheduled for today</p>
        </div>
      )}
    </div>
  );
}

function StopCard({ stop, index, onPickupStatus, onDeliveryStatus, onNavigate }) {
  const isPickup = stop.type === 'PICKUP';
  const isCompleted = stop.status === 'COMPLETED' || stop.status === 'DELIVERED';

  const getStatusColor = () => {
    if (isCompleted) return '#22c55e';
    if (stop.status === 'EN_ROUTE' || stop.status === 'ARRIVED') return '#f59e0b';
    return '#94a3b8';
  };

  return (
    <div style={{
      padding: 16,
      borderBottom: '1px solid #f1f5f9',
      opacity: isCompleted ? 0.6 : 1
    }}>
      <div className="flex-between" style={{ marginBottom: 12 }}>
        <div className="flex gap-3" style={{ alignItems: 'center' }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: isPickup ? '#dbeafe' : '#dcfce7',
            color: isPickup ? '#2563eb' : '#16a34a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            fontSize: 14
          }}>
            {index + 1}
          </div>
          <div>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              {stop.orderNumber}
              <span style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 12,
                background: isPickup ? '#dbeafe' : '#dcfce7',
                color: isPickup ? '#2563eb' : '#16a34a'
              }}>
                {stop.type}
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              {stop.customer?.firstName} {stop.customer?.lastName}
            </div>
          </div>
        </div>
        <div style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: getStatusColor()
        }} />
      </div>

      <div style={{ fontSize: 13, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <FiMapPin size={16} style={{ color: '#64748b', marginTop: 2 }} />
          <div>
            <div>{stop.address?.street}</div>
            {stop.address?.apartment && <div>{stop.address.apartment}</div>}
            <div style={{ color: '#64748b' }}>
              {stop.address?.city}, {stop.address?.state} {stop.address?.zipCode}
            </div>
            {stop.address?.instructions && (
              <div style={{ marginTop: 4, color: '#f59e0b', fontStyle: 'italic' }}>
                Note: {stop.address.instructions}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Items summary */}
      {stop.items && stop.items.length > 0 && (
        <div style={{
          fontSize: 12,
          color: '#64748b',
          marginBottom: 12,
          padding: 8,
          background: '#f8fafc',
          borderRadius: 6
        }}>
          {stop.items.slice(0, 3).map((item, i) => (
            <span key={i}>
              {item.quantity}x {item.garmentType?.name}
              {i < Math.min(stop.items.length - 1, 2) && ', '}
            </span>
          ))}
          {stop.items.length > 3 && ` +${stop.items.length - 3} more`}
        </div>
      )}

      {/* Customer phone */}
      {stop.customer?.phone && (
        <div style={{ fontSize: 13, marginBottom: 12 }}>
          <a href={`tel:${stop.customer.phone}`} style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4 }}>
            <FiPhone size={14} /> {stop.customer.phone}
          </a>
        </div>
      )}

      {/* Actions */}
      {!isCompleted && (
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => onNavigate(stop.address)}
          >
            <FiNavigation /> Navigate
          </button>

          {isPickup ? (
            <>
              {stop.status === 'SCHEDULED' && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => onPickupStatus(stop.id, 'EN_ROUTE')}
                >
                  En Route
                </button>
              )}
              {stop.status === 'EN_ROUTE' && (
                <button
                  className="btn btn-warning btn-sm"
                  onClick={() => onPickupStatus(stop.id, 'ARRIVED')}
                >
                  Arrived
                </button>
              )}
              {stop.status === 'ARRIVED' && (
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => onPickupStatus(stop.id, 'COMPLETED')}
                >
                  <FiCheck /> Complete Pickup
                </button>
              )}
            </>
          ) : (
            <>
              {stop.status === 'SCHEDULED' && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => onDeliveryStatus(stop.id, 'EN_ROUTE')}
                >
                  En Route
                </button>
              )}
              {stop.status === 'EN_ROUTE' && (
                <button
                  className="btn btn-warning btn-sm"
                  onClick={() => onDeliveryStatus(stop.id, 'ARRIVED')}
                >
                  Arrived
                </button>
              )}
              {stop.status === 'ARRIVED' && (
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => onDeliveryStatus(stop.id, 'DELIVERED')}
                >
                  <FiCheck /> Complete Delivery
                </button>
              )}
            </>
          )}
        </div>
      )}

      {isCompleted && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: '#22c55e',
          fontSize: 13
        }}>
          <FiCheck /> Completed
        </div>
      )}
    </div>
  );
}

export default DriverDashboard;
