import React, { useEffect, useState } from 'react';
import api from '../services/api';

export default function TicketPDF() {
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api
      .get('/custom-views/orders')
      .then((res) => {
        setOrders(res.data.orders || []);
        if (res.data.orders?.length) setSelected(res.data.orders[0].id);
      })
      .catch((e) => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, []);

  const downloadPdf = async () => {
    if (!selected) return;
    setDownloading(true);
    setError(null);
    try {
      const res = await api.get(`/custom-views/ticket/${selected}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const orderNumber = orders.find((o) => o.id === selected)?.orderNumber || 'order';
      const a = document.createElement('a');
      a.href = url;
      a.download = `ticket-${orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setDownloading(false);
    }
  };

  const openPreview = () => {
    if (!selected) return;
    api
      .get(`/custom-views/ticket/${selected}`, { responseType: 'blob' })
      .then((res) => {
        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        window.open(url, '_blank');
      })
      .catch((e) => setError(e.response?.data?.error || e.message));
  };

  const selectedOrder = orders.find((o) => o.id === selected);

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <h3 style={{ marginTop: 0 }}>Receipt / Ticket PDF</h3>
      <p style={{ marginTop: 0, color: '#666', fontSize: 13 }}>
        Pick an order to generate a printable PDF receipt (items, weight, services, total, pickup time).
      </p>

      {error && (
        <div style={{ background: '#fee', color: '#900', padding: 10, borderRadius: 6, marginBottom: 10 }}>
          {error}
        </div>
      )}
      {loading && <div style={{ color: '#666' }}>Loading orders…</div>}

      {!loading && orders.length === 0 && (
        <div style={{ color: '#888' }}>No orders found. Create one in the Orders section.</div>
      )}

      {!loading && orders.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              style={{ flex: 1, minWidth: 240, padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
            >
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} — {o.customer} — ${o.total.toFixed(2)} ({o.status})
                </option>
              ))}
            </select>
            <button
              onClick={downloadPdf}
              disabled={!selected || downloading}
              style={{
                background: '#16a34a',
                color: '#fff',
                border: 'none',
                padding: '8px 14px',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              {downloading ? 'Generating…' : 'Download PDF'}
            </button>
            <button
              onClick={openPreview}
              disabled={!selected}
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                padding: '8px 14px',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Preview in new tab
            </button>
          </div>

          {selectedOrder && (
            <div style={{ marginTop: 12, padding: 12, background: '#f9fafb', borderRadius: 8, fontSize: 13, color: '#475569' }}>
              <div><b>Order:</b> {selectedOrder.orderNumber}</div>
              <div><b>Customer:</b> {selectedOrder.customer}</div>
              <div><b>Status:</b> {selectedOrder.status}</div>
              <div><b>Total:</b> ${selectedOrder.total.toFixed(2)}</div>
              <div><b>Created:</b> {new Date(selectedOrder.createdAt).toLocaleString()}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
