import React, { useState } from 'react';
import 'leaflet/dist/leaflet.css';
import PickupMap from '../components/PickupMap';
import ServiceStatus from '../components/ServiceStatus';
import TicketPDF from '../components/TicketPDF';
import RouteOptimizer from '../components/RouteOptimizer';

const TABS = [
  { key: 'map', label: 'Pickup Map' },
  { key: 'status', label: 'Service Status' },
  { key: 'ticket', label: 'Ticket PDF' },
  { key: 'route', label: 'Route Optimizer' },
];

export default function CustomViewsPage() {
  const [tab, setTab] = useState('map');

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Laundry Views</h2>
        <p style={{ margin: 0, color: '#666' }}>
          Operational custom views: pickup map, service status board, receipt PDFs, and route optimizer.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? '#2563eb' : '#475569',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 20 }}>
        {tab === 'map' && <PickupMap />}
        {tab === 'status' && <ServiceStatus />}
        {tab === 'ticket' && <TicketPDF />}
        {tab === 'route' && <RouteOptimizer />}
      </div>
    </div>
  );
}
