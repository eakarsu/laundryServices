import React, { useEffect, useState } from 'react';
import api from '../services/api';

const STAGE_COLORS = {
  intake: '#64748b',
  wash: '#2563eb',
  dry: '#0891b2',
  fold: '#7c3aed',
  ready: '#16a34a',
  delivered: '#0f766e',
};

export default function ServiceStatus() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .get('/custom-views/service-status')
      .then((res) => setData(res.data))
      .catch((e) => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ margin: 0 }}>Service Status Board</h3>
          <p style={{ margin: 0, color: '#666', fontSize: 13 }}>
            Orders by production stage: intake → wash → dry → fold → ready → delivered.
          </p>
        </div>
        <button
          onClick={load}
          style={{
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            padding: '8px 14px',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: '#fee', color: '#900', padding: 10, borderRadius: 6, marginBottom: 10 }}>
          {error}
        </div>
      )}
      {loading && <div style={{ color: '#666' }}>Loading status board…</div>}

      {data && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${data.stages.length}, minmax(180px, 1fr))`,
            gap: 12,
            overflowX: 'auto',
          }}
        >
          {data.stages.map((stage) => {
            const color = STAGE_COLORS[stage.key] || '#475569';
            return (
              <div
                key={stage.key}
                style={{
                  border: '1px solid #e5e7eb',
                  borderTop: `4px solid ${color}`,
                  borderRadius: 8,
                  padding: 10,
                  background: '#fafafa',
                  minHeight: 280,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, color }}>{stage.label}</div>
                  <div
                    style={{
                      background: color,
                      color: '#fff',
                      borderRadius: 999,
                      padding: '2px 8px',
                      fontSize: 12,
                    }}
                  >
                    {stage.orders.length}
                  </div>
                </div>

                {stage.orders.length === 0 && (
                  <div style={{ color: '#94a3b8', fontSize: 12, fontStyle: 'italic' }}>No orders</div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stage.orders.slice(0, 8).map((o) => (
                    <div
                      key={o.id}
                      style={{
                        background: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        padding: 8,
                        fontSize: 12,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 600 }}>{o.orderNumber}</span>
                        {o.isRush && (
                          <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '1px 6px', borderRadius: 4, fontSize: 10 }}>
                            RUSH
                          </span>
                        )}
                      </div>
                      <div style={{ color: '#475569' }}>{o.customer}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', marginTop: 4 }}>
                        <span>{o.itemCount} items</span>
                        <span>${o.total.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                  {stage.orders.length > 8 && (
                    <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center' }}>
                      + {stage.orders.length - 8} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
