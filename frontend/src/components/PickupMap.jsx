import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import api from '../services/api';

// Prevent the default icon 404s (Leaflet looks for assets we don't bundle).
// We replace the icon entirely with a coloured CircleMarker per kind.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'data:image/png;base64,iVBORw0KGgo=',
  iconUrl: 'data:image/png;base64,iVBORw0KGgo=',
  shadowUrl: 'data:image/png;base64,iVBORw0KGgo=',
});

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function PickupMap() {
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get('/custom-views/pickup-map', { params: { date } })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.response?.data?.error || e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const center = useMemo(() => {
    if (data?.center) return [data.center.lat, data.center.lng];
    return [40.7484, -73.9857];
  }, [data]);

  const allMarkers = useMemo(() => {
    if (!data) return [];
    return [...(data.pickups || []), ...(data.dropoffs || [])];
  }, [data]);

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ margin: 0 }}>Pickup / Dropoff Map</h3>
          <p style={{ margin: 0, color: '#666', fontSize: 13 }}>
            Markers per day. Blue = pickup, Green = dropoff.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 13, color: '#666' }}>Date:</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: 6 }}
          />
        </div>
      </div>

      {error && (
        <div style={{ background: '#fee', color: '#900', padding: 10, borderRadius: 6, marginBottom: 10 }}>
          {error}
        </div>
      )}
      {loading && <div style={{ color: '#666', marginBottom: 8 }}>Loading map data…</div>}

      <div style={{ height: 480, borderRadius: 8, overflow: 'hidden', border: '1px solid #eee' }}>
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {allMarkers.map((m) => (
            <CircleMarker
              key={`${m.kind}-${m.id}`}
              center={[m.lat, m.lng]}
              radius={9}
              pathOptions={{
                color: m.kind === 'pickup' ? '#2563eb' : '#16a34a',
                fillColor: m.kind === 'pickup' ? '#2563eb' : '#16a34a',
                fillOpacity: 0.7,
              }}
            >
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    {m.kind === 'pickup' ? '📦 Pickup' : '🚚 Dropoff'} — {m.label}
                  </div>
                  {m.customer && <div style={{ fontSize: 13 }}>{m.customer}</div>}
                  {m.address && <div style={{ fontSize: 12, color: '#666' }}>{m.address}</div>}
                  <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                    {m.scheduledStart ? new Date(m.scheduledStart).toLocaleString() : ''}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>Status: {m.status}</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      <div style={{ display: 'flex', gap: 24, marginTop: 12, fontSize: 13, color: '#444' }}>
        <div>📦 Pickups: <b>{data?.pickups?.length ?? 0}</b></div>
        <div>🚚 Dropoffs: <b>{data?.dropoffs?.length ?? 0}</b></div>
      </div>
    </div>
  );
}
