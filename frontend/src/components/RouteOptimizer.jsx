import React, { useEffect, useState } from 'react';
import api from '../services/api';

const SAMPLE_STOPS = [
  'Pickup — 123 Main St',
  'Dropoff — 45 Park Ave',
  'Pickup — 789 Broadway',
  'Dropoff — 12 W 34th St',
  'Pickup — 555 5th Ave',
];

export default function RouteOptimizer() {
  const [drivers, setDrivers] = useState([]);
  const [driverId, setDriverId] = useState('');
  const [stops, setStops] = useState(SAMPLE_STOPS.join('\n'));
  const [avgSpeed, setAvgSpeed] = useState(30);
  const [stopMinutes, setStopMinutes] = useState(8);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get('/custom-views/drivers')
      .then((res) => {
        setDrivers(res.data.drivers || []);
        if (res.data.drivers?.length) setDriverId(res.data.drivers[0].id);
      })
      .catch((e) => setError(e.response?.data?.error || e.message));
  }, []);

  const submit = async () => {
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const lines = stops
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((label, i) => ({ label, address: label }));
      if (!lines.length) throw new Error('Add at least one stop (one per line)');
      const res = await api.post('/custom-views/optimize-route', {
        driverId: driverId || null,
        stops: lines,
        avgSpeedKmh: Number(avgSpeed) || 30,
        stopMinutes: Number(stopMinutes) || 8,
      });
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <h3 style={{ marginTop: 0 }}>Route Optimizer</h3>
      <p style={{ marginTop: 0, color: '#666', fontSize: 13 }}>
        Pick a driver and stops — POST returns the optimized order with ETA per stop.
      </p>

      {error && (
        <div style={{ background: '#fee', color: '#900', padding: 10, borderRadius: 6, marginBottom: 10 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#555', marginBottom: 4 }}>Driver</label>
          <select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
          >
            <option value="">(no driver — start at depot)</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} — {d.vehicle}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#555', marginBottom: 4 }}>Avg speed (km/h)</label>
          <input
            type="number"
            value={avgSpeed}
            min={5}
            max={120}
            onChange={(e) => setAvgSpeed(e.target.value)}
            style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#555', marginBottom: 4 }}>Minutes per stop</label>
          <input
            type="number"
            value={stopMinutes}
            min={0}
            max={60}
            onChange={(e) => setStopMinutes(e.target.value)}
            style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
          />
        </div>
      </div>

      <label style={{ display: 'block', fontSize: 12, color: '#555', marginBottom: 4 }}>
        Stops (one per line)
      </label>
      <textarea
        value={stops}
        onChange={(e) => setStops(e.target.value)}
        rows={6}
        style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6, fontFamily: 'monospace' }}
      />

      <button
        onClick={submit}
        disabled={loading}
        style={{
          marginTop: 10,
          background: '#7c3aed',
          color: '#fff',
          border: 'none',
          padding: '10px 16px',
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        {loading ? 'Optimizing…' : 'Optimize Route'}
      </button>

      {result && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', color: '#475569', fontSize: 13 }}>
            <div>Total distance: <b>{result.totalKm} km</b></div>
            <div>Total time: <b>{result.totalMinutes} min</b></div>
            <div>Stops: <b>{result.optimized.length}</b></div>
          </div>

          <table style={{ width: '100%', marginTop: 10, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ padding: 6, textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>#</th>
                <th style={{ padding: 6, textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Stop</th>
                <th style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>Leg km</th>
                <th style={{ padding: 6, textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>ETA</th>
              </tr>
            </thead>
            <tbody>
              {result.optimized.map((s) => (
                <tr key={s.sequence}>
                  <td style={{ padding: 6, borderBottom: '1px solid #f1f5f9' }}>{s.sequence}</td>
                  <td style={{ padding: 6, borderBottom: '1px solid #f1f5f9' }}>{s.label}</td>
                  <td style={{ padding: 6, borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>{s.legKm}</td>
                  <td style={{ padding: 6, borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                    {new Date(s.eta).toLocaleTimeString()} (+{s.etaMinutesFromStart}m)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
