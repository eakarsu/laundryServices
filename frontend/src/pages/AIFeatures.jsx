import React, { useState, useEffect } from 'react';
import {
  FiCamera, FiMessageCircle, FiTrendingUp, FiTool, FiUsers, FiZap, FiSend,
  FiDatabase, FiAlertOctagon, FiTag, FiPhone, FiActivity,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';

// Sample data for testing
const sampleData = {
  estimator: [
    '3 dress shirts, 2 pairs of pants, 1 suit jacket with wine stain',
    '5 blouses, 3 skirts, 2 dresses for dry cleaning',
    'King size comforter, 4 pillowcases, 2 bed sheets',
    '10 work shirts, 5 polos, 3 pairs of khakis',
    '2 wedding dresses, 3 bridesmaid gowns for preservation',
  ],
  stain: [
    'Red wine stain on white cotton shirt, about 3 inches wide',
    'Coffee spill on beige wool pants, dried overnight',
    'Grass stains on kids soccer shorts, heavily soiled',
    'Ink pen mark on silk blouse, blue ballpoint ink',
    'Oil/grease stain on polyester jacket from car repair',
  ],
  chat: [
    'What are your business hours?',
    'How much does dry cleaning a suit cost?',
    'Do you offer same-day service?',
    'Can you remove wine stains from silk?',
    'What is your turnaround time for regular laundry?',
  ],
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function AIFeatures() {
  const [activeTab, setActiveTab] = useState('estimator');
  const [loading, setLoading] = useState(false);

  // Estimator
  const [description, setDescription] = useState('');
  const [estimatorImage, setEstimatorImage] = useState(null);
  const [estimate, setEstimate] = useState(null);

  // Chat
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [sessionId] = useState(`session-${Date.now()}`);

  // Stain
  const [stainDescription, setStainDescription] = useState('');
  const [stainImage, setStainImage] = useState(null);
  const [stainResult, setStainResult] = useState(null);

  // Predictions
  const [predictions, setPredictions] = useState(null);
  const [maintenancePredictions, setMaintenancePredictions] = useState(null);
  const [reactivationTargets, setReactivationTargets] = useState(null);

  // Churn
  const [churnResult, setChurnResult] = useState(null);

  // Lifecycle
  const [garmentId, setGarmentId] = useState('');
  const [lifecycleEvents, setLifecycleEvents] = useState(null);

  // WhatsApp / Audit log
  const [conversations, setConversations] = useState(null);
  const [aiResults, setAiResults] = useState(null);

  const handleEstimate = async () => {
    if (!description.trim() && !estimatorImage) return;
    setLoading(true);
    try {
      const payload = { description };
      if (estimatorImage) {
        payload.imageBase64 = await fileToBase64(estimatorImage);
      }
      const res = await api.post('/ai/estimate', payload);
      setEstimate(res.data);
      toast.success(res.data.aiPowered ? 'AI estimate generated' : 'Heuristic estimate (AI unavailable)');
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Error getting estimate');
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async () => {
    if (!chatMessage.trim()) return;
    const userMsg = chatMessage;
    setChatMessage('');
    setChatHistory((prev) => [...prev, { role: 'user', message: userMsg }]);
    setLoading(true);
    try {
      const res = await api.post('/ai/chat', { message: userMsg, sessionId });
      setChatHistory((prev) => [...prev, { role: 'assistant', message: res.data.response }]);
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Error sending message');
    } finally {
      setLoading(false);
    }
  };

  const handleStainAnalysis = async () => {
    if (!stainDescription.trim() && !stainImage) return;
    setLoading(true);
    try {
      const payload = { description: stainDescription };
      if (stainImage) payload.imageBase64 = await fileToBase64(stainImage);
      const res = await api.post('/ai/identify-stain', payload);
      setStainResult(res.data);
    } catch (error) {
      toast.error('Error analyzing stain');
    } finally {
      setLoading(false);
    }
  };

  const handleDemandPrediction = async () => {
    setLoading(true);
    try {
      const res = await api.get('/ai/predict-demand?days=7');
      setPredictions(res.data);
    } catch (error) {
      toast.error('Error getting predictions');
    } finally {
      setLoading(false);
    }
  };

  const handleMaintenancePrediction = async () => {
    setLoading(true);
    try {
      const res = await api.get('/ai/predict-maintenance');
      setMaintenancePredictions(res.data);
    } catch (error) {
      toast.error('Error getting maintenance predictions');
    } finally {
      setLoading(false);
    }
  };

  const handleReactivationTargets = async () => {
    setLoading(true);
    try {
      const res = await api.get('/ai/reactivation-targets?inactiveDays=30');
      setReactivationTargets(res.data);
    } catch (error) {
      toast.error('Error getting reactivation targets');
    } finally {
      setLoading(false);
    }
  };

  const handleChurn = async (autoCoupon) => {
    setLoading(true);
    try {
      const res = await api.post('/ai/churn-score', { autoCoupon });
      setChurnResult(res.data);
      toast.success(`${res.data.summary.high} high-risk customers identified`);
    } catch (error) {
      toast.error('Error scoring churn');
    } finally {
      setLoading(false);
    }
  };

  const handleLifecycle = async () => {
    if (!garmentId.trim()) return;
    setLoading(true);
    try {
      const res = await api.get(`/ai/garment/${garmentId}/lifecycle`);
      setLifecycleEvents(res.data);
    } catch (error) {
      toast.error('Error fetching lifecycle');
    } finally {
      setLoading(false);
    }
  };

  const handleConversations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/ai/whatsapp/conversations');
      setConversations(res.data);
    } catch (error) {
      toast.error('Error fetching conversations');
    } finally {
      setLoading(false);
    }
  };

  const handleResultsLoad = async () => {
    setLoading(true);
    try {
      const res = await api.get('/ai/results');
      setAiResults(res.data);
    } catch (error) {
      toast.error('Error fetching AI audit log');
    } finally {
      setLoading(false);
    }
  };

  const loadSampleData = () => {
    const r = (a) => Math.floor(Math.random() * a.length);
    switch (activeTab) {
      case 'estimator':
        setDescription(sampleData.estimator[r(sampleData.estimator)]);
        toast.info('Sample loaded');
        break;
      case 'stain':
        setStainDescription(sampleData.stain[r(sampleData.stain)]);
        toast.info('Sample loaded');
        break;
      case 'chat':
        setChatMessage(sampleData.chat[r(sampleData.chat)]);
        toast.info('Sample loaded');
        break;
      case 'demand':
        handleDemandPrediction();
        break;
      case 'maintenance':
        handleMaintenancePrediction();
        break;
      case 'reactivation':
        handleReactivationTargets();
        break;
      case 'churn':
        handleChurn(false);
        break;
      case 'whatsapp':
        handleConversations();
        break;
      case 'audit':
        handleResultsLoad();
        break;
      default:
        toast.info('No sample data for this tab');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Features</h1>
          <p className="page-subtitle">Vision, churn prediction, lifecycle, WhatsApp concierge</p>
        </div>
        <button className="btn btn-primary" onClick={loadSampleData}>
          <FiDatabase /> Load Sample Data
        </button>
      </div>

      <div className="tabs" style={{ marginBottom: 24, flexWrap: 'wrap' }}>
        <div className={`tab ${activeTab === 'estimator' ? 'active' : ''}`} onClick={() => setActiveTab('estimator')}>
          <FiCamera /> Estimator (Vision)
        </div>
        <div className={`tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
          <FiMessageCircle /> Service Bot
        </div>
        <div className={`tab ${activeTab === 'stain' ? 'active' : ''}`} onClick={() => setActiveTab('stain')}>
          <FiZap /> Stain Identifier
        </div>
        <div className={`tab ${activeTab === 'demand' ? 'active' : ''}`} onClick={() => setActiveTab('demand')}>
          <FiTrendingUp /> Demand
        </div>
        <div className={`tab ${activeTab === 'maintenance' ? 'active' : ''}`} onClick={() => setActiveTab('maintenance')}>
          <FiTool /> Maintenance
        </div>
        <div className={`tab ${activeTab === 'reactivation' ? 'active' : ''}`} onClick={() => setActiveTab('reactivation')}>
          <FiUsers /> Reactivation
        </div>
        <div className={`tab ${activeTab === 'churn' ? 'active' : ''}`} onClick={() => setActiveTab('churn')}>
          <FiAlertOctagon /> Churn
        </div>
        <div className={`tab ${activeTab === 'lifecycle' ? 'active' : ''}`} onClick={() => setActiveTab('lifecycle')}>
          <FiTag /> Lifecycle
        </div>
        <div className={`tab ${activeTab === 'whatsapp' ? 'active' : ''}`} onClick={() => setActiveTab('whatsapp')}>
          <FiPhone /> WhatsApp
        </div>
        <div className={`tab ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>
          <FiActivity /> AI Audit Log
        </div>
      </div>

      {/* === ESTIMATOR === */}
      {activeTab === 'estimator' && (
        <div className="grid-2">
          <div className="card">
            <h4 style={{ marginBottom: 16 }}>AI Order Estimator (Vision)</h4>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
              Describe items <em>or</em> upload a photo for vision-based itemization.
            </p>
            <div className="form-group">
              <label className="form-label">Describe items (optional if photo)</label>
              <textarea
                className="form-textarea"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., 3 dress shirts, 2 pairs of pants..."
              />
            </div>
            <div className="form-group">
              <label className="form-label">Or upload a photo</label>
              <input type="file" accept="image/*" onChange={(e) => setEstimatorImage(e.target.files?.[0] || null)} />
              {estimatorImage && <small>{estimatorImage.name}</small>}
            </div>
            <button className="btn btn-primary" onClick={handleEstimate} disabled={loading}>
              {loading ? 'Analyzing...' : 'Get Estimate'}
            </button>
          </div>

          <div className="card">
            <h4 style={{ marginBottom: 16 }}>Estimate Result</h4>
            {estimate ? (
              <div>
                <div className="table-container" style={{ marginBottom: 16 }}>
                  <table className="table">
                    <thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead>
                    <tbody>
                      {estimate.items.map((item, i) => (
                        <tr key={i}>
                          <td>{item.name}</td>
                          <td>{item.quantity}</td>
                          <td>${(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex-between" style={{ fontSize: 18, fontWeight: 600 }}>
                  <span>Estimated Total</span>
                  <span>${estimate.totalEstimate.toFixed(2)}</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                  Confidence: {(estimate.confidence * 100).toFixed(0)}% · {estimate.aiPowered ? (estimate.visionUsed ? 'Vision AI' : 'Text AI') : 'Heuristic fallback'}
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 40 }}><p>Submit details to estimate.</p></div>
            )}
          </div>
        </div>
      )}

      {/* === CHAT === */}
      {activeTab === 'chat' && (
        <div className="card">
          <h4 style={{ marginBottom: 16 }}>AI Customer Service Bot</h4>
          <div style={{ height: 400, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16, background: '#f8fafc' }}>
            {chatHistory.length === 0 && (
              <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>
                Start a conversation! Ask about pricing, hours, order status.
              </div>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} style={{ marginBottom: 12, textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                <div style={{
                  display: 'inline-block', padding: '8px 12px', borderRadius: 12,
                  background: msg.role === 'user' ? '#2563eb' : 'white',
                  color: msg.role === 'user' ? 'white' : '#1e293b', maxWidth: '80%',
                }}>{msg.message}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text" className="form-input" value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)} placeholder="Type your message..."
              onKeyPress={(e) => e.key === 'Enter' && handleChat()}
            />
            <button className="btn btn-primary" onClick={handleChat} disabled={loading}>
              <FiSend /> Send
            </button>
          </div>
        </div>
      )}

      {/* === STAIN === */}
      {activeTab === 'stain' && (
        <div className="grid-2">
          <div className="card">
            <h4 style={{ marginBottom: 16 }}>AI Stain Identifier (Vision)</h4>
            <div className="form-group">
              <label className="form-label">Describe the stain (optional if photo)</label>
              <textarea className="form-textarea" rows={3} value={stainDescription}
                onChange={(e) => setStainDescription(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Or upload photo</label>
              <input type="file" accept="image/*" onChange={(e) => setStainImage(e.target.files?.[0] || null)} />
            </div>
            <button className="btn btn-primary" onClick={handleStainAnalysis} disabled={loading}>
              {loading ? 'Analyzing...' : 'Identify Stain'}
            </button>
          </div>

          <div className="card">
            <h4 style={{ marginBottom: 16 }}>Analysis Result</h4>
            {stainResult ? (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <span className="badge badge-primary" style={{ fontSize: 16, padding: '8px 16px' }}>
                    {stainResult.stainType}
                  </span>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <h5 style={{ marginBottom: 8 }}>Recommended Treatment</h5>
                  <p style={{ color: '#64748b', fontSize: 14 }}>{stainResult.treatment}</p>
                </div>
                <div className="flex-between" style={{ padding: 12, background: '#f0fdf4', borderRadius: 8 }}>
                  <span>Expected Success Rate</span>
                  <span style={{ fontWeight: 600, color: '#22c55e' }}>{stainResult.expectedSuccessRate}</span>
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 40 }}><p>Describe a stain or upload a photo.</p></div>
            )}
          </div>
        </div>
      )}

      {/* === DEMAND === */}
      {activeTab === 'demand' && (
        <div className="card">
          <div className="flex-between" style={{ marginBottom: 16 }}>
            <h4>AI Demand Predictor</h4>
            <button className="btn btn-primary" onClick={handleDemandPrediction} disabled={loading}>
              {loading ? 'Loading...' : 'Generate 7-Day Forecast'}
            </button>
          </div>
          {predictions ? (
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Date</th><th>Day</th><th>Orders</th><th>Revenue</th><th>Confidence</th></tr></thead>
                <tbody>
                  {predictions.predictions.map((p, i) => (
                    <tr key={i}>
                      <td>{p.date}</td><td>{p.dayOfWeek}</td>
                      <td>{p.predictedOrders}</td><td>${p.predictedRevenue?.toFixed(2)}</td>
                      <td>{(p.confidence * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state"><FiTrendingUp size={48} /><p>Generate a forecast.</p></div>
          )}
        </div>
      )}

      {/* === MAINTENANCE === */}
      {activeTab === 'maintenance' && (
        <div className="card">
          <div className="flex-between" style={{ marginBottom: 16 }}>
            <h4>AI Maintenance Predictor</h4>
            <button className="btn btn-primary" onClick={handleMaintenancePrediction} disabled={loading}>
              {loading ? 'Loading...' : 'Analyze Machines'}
            </button>
          </div>
          {maintenancePredictions ? (
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Machine</th><th>Type</th><th>Priority</th><th>Cycles</th><th>Recommended</th></tr></thead>
                <tbody>
                  {maintenancePredictions.predictions.map((p, i) => (
                    <tr key={i}>
                      <td>{p.machineNumber}</td><td>{p.type}</td>
                      <td><span className={`badge ${
                        p.priority === 'CRITICAL' ? 'badge-danger' :
                        p.priority === 'HIGH' ? 'badge-warning' :
                        p.priority === 'MEDIUM' ? 'badge-primary' : 'badge-success'
                      }`}>{p.priority}</span></td>
                      <td>{p.cyclesSinceLastMaintenance}</td>
                      <td>{p.recommendedMaintenanceDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state"><FiTool size={48} /><p>Analyze your machines.</p></div>
          )}
        </div>
      )}

      {/* === REACTIVATION === */}
      {activeTab === 'reactivation' && (
        <div className="card">
          <div className="flex-between" style={{ marginBottom: 16 }}>
            <h4>AI Reactivation Campaigns</h4>
            <button className="btn btn-primary" onClick={handleReactivationTargets} disabled={loading}>
              {loading ? 'Loading...' : 'Find Inactive'}
            </button>
          </div>
          {reactivationTargets ? (
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Customer</th><th>Email</th><th>Days Inactive</th><th>Total Spent</th><th>Score</th><th>Offer</th></tr></thead>
                <tbody>
                  {reactivationTargets.targets.slice(0, 10).map((t, i) => (
                    <tr key={i}>
                      <td>{t.name}</td><td>{t.email}</td>
                      <td>{t.daysSinceLastOrder || '-'}</td>
                      <td>${t.totalSpent?.toFixed(2)}</td>
                      <td>{t.reactivationScore}</td>
                      <td>{t.suggestedOffer}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state"><FiUsers size={48} /><p>Find inactive customers.</p></div>
          )}
        </div>
      )}

      {/* === CHURN === */}
      {activeTab === 'churn' && (
        <div className="card">
          <div className="flex-between" style={{ marginBottom: 16 }}>
            <h4>Subscription Churn Predictor</h4>
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={() => handleChurn(false)} disabled={loading}>
                Score
              </button>
              <button className="btn btn-primary" onClick={() => handleChurn(true)} disabled={loading}>
                Score + Auto Coupon
              </button>
            </div>
          </div>
          {churnResult ? (
            <>
              <div className="stats-grid" style={{ marginBottom: 16 }}>
                <div className="stat-card danger"><div className="stat-label">High Risk</div><div className="stat-value">{churnResult.summary.high}</div></div>
                <div className="stat-card warning"><div className="stat-label">Medium</div><div className="stat-value">{churnResult.summary.medium}</div></div>
                <div className="stat-card success"><div className="stat-label">Low</div><div className="stat-value">{churnResult.summary.low}</div></div>
                <div className="stat-card primary"><div className="stat-label">Coupons Sent</div><div className="stat-value">{churnResult.summary.couponsSent}</div></div>
              </div>
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Customer</th><th>Score</th><th>Risk</th><th>Days Since Order</th><th>Coupon</th></tr></thead>
                  <tbody>
                    {churnResult.scored.slice(0, 20).map((s, i) => (
                      <tr key={i}>
                        <td>{s.name}</td>
                        <td>{(s.score * 100).toFixed(0)}%</td>
                        <td><span className={`badge ${s.riskLevel === 'high' ? 'badge-danger' : s.riskLevel === 'medium' ? 'badge-warning' : 'badge-success'}`}>{s.riskLevel}</span></td>
                        <td>{s.factors?.daysSinceLastOrder}</td>
                        <td>{s.couponSent ? '✓' : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="empty-state"><FiAlertOctagon size={48} /><p>Score active subscriptions.</p></div>
          )}
        </div>
      )}

      {/* === LIFECYCLE === */}
      {activeTab === 'lifecycle' && (
        <div className="card">
          <h4>Garment Lifecycle (QR/RFID Provenance)</h4>
          <div className="flex gap-2" style={{ margin: '16px 0' }}>
            <input
              type="text" className="form-input" placeholder="Garment ID or scan…"
              value={garmentId} onChange={(e) => setGarmentId(e.target.value)}
            />
            <button className="btn btn-primary" onClick={handleLifecycle} disabled={loading}>
              Show History
            </button>
          </div>
          {lifecycleEvents ? (
            <div className="table-container">
              <table className="table">
                <thead><tr><th>When</th><th>Event</th><th>Order</th><th>Notes</th></tr></thead>
                <tbody>
                  {lifecycleEvents.events.map((e) => (
                    <tr key={e.id}>
                      <td>{new Date(e.createdAt).toLocaleString()}</td>
                      <td><span className="badge badge-primary">{e.eventType}</span></td>
                      <td>{e.orderId || '-'}</td>
                      <td>{e.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state"><FiTag size={48} /><p>Enter a garment ID to view its provenance.</p></div>
          )}
        </div>
      )}

      {/* === WHATSAPP === */}
      {activeTab === 'whatsapp' && (
        <div className="card">
          <div className="flex-between" style={{ marginBottom: 16 }}>
            <h4>WhatsApp Concierge</h4>
            <button className="btn btn-primary" onClick={handleConversations} disabled={loading}>
              Refresh
            </button>
          </div>
          {conversations ? (
            <div className="table-container">
              <table className="table">
                <thead><tr><th>When</th><th>Phone</th><th>Direction</th><th>Message</th></tr></thead>
                <tbody>
                  {conversations.conversations.map((c) => (
                    <tr key={c.id}>
                      <td>{new Date(c.createdAt).toLocaleString()}</td>
                      <td>{c.phoneNumber}</td>
                      <td><span className={`badge ${c.direction === 'inbound' ? 'badge-primary' : 'badge-success'}`}>{c.direction}</span></td>
                      <td>{c.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state"><FiPhone size={48} /><p>Inbound webhook: POST /api/ai/whatsapp/inbound</p></div>
          )}
        </div>
      )}

      {/* === AUDIT === */}
      {activeTab === 'audit' && (
        <div className="card">
          <div className="flex-between" style={{ marginBottom: 16 }}>
            <h4>AI Audit Log (ai_results JSONB)</h4>
            <button className="btn btn-primary" onClick={handleResultsLoad} disabled={loading}>
              Load
            </button>
          </div>
          {aiResults ? (
            <div className="table-container">
              <table className="table">
                <thead><tr><th>When</th><th>Feature</th><th>Model</th><th>Success</th><th>Latency</th></tr></thead>
                <tbody>
                  {aiResults.results.map((r) => (
                    <tr key={r.id}>
                      <td>{new Date(r.createdAt).toLocaleString()}</td>
                      <td>{r.feature}</td>
                      <td>{r.model}</td>
                      <td>{r.success ? '✓' : '✗'}</td>
                      <td>{r.latencyMs ? `${r.latencyMs}ms` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state"><FiActivity size={48} /><p>Load to see recent AI calls.</p></div>
          )}
        </div>
      )}
    </div>
  );
}

export default AIFeatures;
