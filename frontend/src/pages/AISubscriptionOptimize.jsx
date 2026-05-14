import React, { useState } from 'react';
import { FiZap, FiSettings, FiSend } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';

function AISubscriptionOptimize() {
  const [customerId, setCustomerId] = useState('');
  const [subscriptionId, setSubscriptionId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const reset = () => {
    setError('');
    setResult(null);
  };

  const handleOptimize = async () => {
    reset();
    if (!customerId.trim()) {
      setError('Customer ID is required.');
      return;
    }
    setLoading(true);
    try {
      const payload = { customerId: customerId.trim() };
      if (subscriptionId.trim()) payload.subscriptionId = subscriptionId.trim();
      if (notes.trim()) payload.notes = notes.trim();
      const res = await api.post('/ai/subscription-optimize', payload);
      setResult(res.data);
      toast.success('Recommendation generated');
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Error optimizing subscription';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const recommendation = result?.recommendation || result;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Subscription Optimizer</h1>
          <p className="page-subtitle">
            Pulls the customer, latest subscription, and recent orders to recommend frequency, plan, and add-ons.
          </p>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h4 style={{ marginBottom: 16 }}>
            <FiSettings style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Inputs
          </h4>
          <div className="form-group">
            <label className="form-label">Customer ID *</label>
            <input
              type="text"
              className="form-input"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="e.g. 42 or cus-123"
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Subscription ID (optional)</label>
            <input
              type="text"
              className="form-input"
              value={subscriptionId}
              onChange={(e) => setSubscriptionId(e.target.value)}
              placeholder="If not given, latest subscription is used"
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Customer mentioned they want lower frequency in summer..."
              disabled={loading}
            />
          </div>
          {error && (
            <div
              style={{
                padding: '8px 12px',
                background: '#fee2e2',
                color: '#991b1b',
                borderRadius: 8,
                marginBottom: 12,
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}
          <button className="btn btn-primary" onClick={handleOptimize} disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" style={{ width: 14, height: 14, marginRight: 6 }} /> Optimizing...
              </>
            ) : (
              <>
                <FiSend style={{ marginRight: 6 }} /> Get Recommendation
              </>
            )}
          </button>
        </div>

        <div className="card">
          <h4 style={{ marginBottom: 16 }}>
            <FiZap style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Recommendation
          </h4>
          {!result && !loading && !error && (
            <div className="empty-state" style={{ padding: 40 }}>
              <FiZap size={48} />
              <p>Enter a customer ID and submit to see AI recommendations.</p>
            </div>
          )}
          {loading && (
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="spinner"></div>
              <p>Working...</p>
            </div>
          )}
          {result && (
            <div>
              {recommendation && typeof recommendation === 'object' && (
                <div className="stats-grid" style={{ marginBottom: 16 }}>
                  {recommendation.recommended_frequency && (
                    <div className="stat-card primary">
                      <div className="stat-label">Frequency</div>
                      <div className="stat-value" style={{ fontSize: 18 }}>
                        {recommendation.recommended_frequency}
                      </div>
                    </div>
                  )}
                  {recommendation.recommended_plan && (
                    <div className="stat-card success">
                      <div className="stat-label">Plan</div>
                      <div className="stat-value" style={{ fontSize: 18 }}>
                        {recommendation.recommended_plan}
                      </div>
                    </div>
                  )}
                  {recommendation.expected_savings_per_month != null && (
                    <div className="stat-card warning">
                      <div className="stat-label">Savings / mo</div>
                      <div className="stat-value">${Number(recommendation.expected_savings_per_month).toFixed(2)}</div>
                    </div>
                  )}
                  {recommendation.expected_revenue_lift_per_month != null && (
                    <div className="stat-card primary">
                      <div className="stat-label">Revenue Lift / mo</div>
                      <div className="stat-value">${Number(recommendation.expected_revenue_lift_per_month).toFixed(2)}</div>
                    </div>
                  )}
                </div>
              )}
              {recommendation?.recommended_add_ons?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <h5 style={{ marginBottom: 8 }}>Recommended Add-ons</h5>
                  <ul style={{ paddingLeft: 18, color: '#334155', fontSize: 14 }}>
                    {recommendation.recommended_add_ons.map((a, i) => (
                      <li key={i}>{typeof a === 'string' ? a : JSON.stringify(a)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {recommendation?.rationale && (
                <div style={{ marginBottom: 16 }}>
                  <h5 style={{ marginBottom: 8 }}>Rationale</h5>
                  <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.5 }}>
                    {typeof recommendation.rationale === 'string'
                      ? recommendation.rationale
                      : JSON.stringify(recommendation.rationale)}
                  </p>
                </div>
              )}
              {recommendation?.warnings?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <h5 style={{ marginBottom: 8 }}>Warnings</h5>
                  <ul style={{ paddingLeft: 18, color: '#b45309', fontSize: 14 }}>
                    {recommendation.warnings.map((w, i) => (
                      <li key={i}>{typeof w === 'string' ? w : JSON.stringify(w)}</li>
                    ))}
                  </ul>
                </div>
              )}
              <details>
                <summary style={{ cursor: 'pointer', color: '#64748b', fontSize: 13 }}>Show raw JSON</summary>
                <pre
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    background: '#f8fafc',
                    padding: 12,
                    borderRadius: 8,
                    overflow: 'auto',
                    maxHeight: 320,
                  }}
                >
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AISubscriptionOptimize;
