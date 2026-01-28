import React, { useState } from 'react';
import { FiCamera, FiMessageCircle, FiTrendingUp, FiTool, FiUsers, FiZap, FiCheck, FiSend, FiDatabase } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';

// Sample data for testing
const sampleData = {
  estimator: [
    '3 dress shirts, 2 pairs of pants, 1 suit jacket with wine stain',
    '5 blouses, 3 skirts, 2 dresses for dry cleaning',
    'King size comforter, 4 pillowcases, 2 bed sheets',
    '10 work shirts, 5 polos, 3 pairs of khakis',
    '2 wedding dresses, 3 bridesmaid gowns for preservation'
  ],
  stain: [
    'Red wine stain on white cotton shirt, about 3 inches wide',
    'Coffee spill on beige wool pants, dried overnight',
    'Grass stains on kids soccer shorts, heavily soiled',
    'Ink pen mark on silk blouse, blue ballpoint ink',
    'Oil/grease stain on polyester jacket from car repair'
  ],
  chat: [
    'What are your business hours?',
    'How much does dry cleaning a suit cost?',
    'Do you offer same-day service?',
    'Can you remove wine stains from silk?',
    'What is your turnaround time for regular laundry?'
  ]
};

function AIFeatures() {
  const [activeTab, setActiveTab] = useState('estimator');
  const [loading, setLoading] = useState(false);

  // AI Estimator state
  const [description, setDescription] = useState('');
  const [estimate, setEstimate] = useState(null);

  // AI Chat state
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [sessionId] = useState(`session-${Date.now()}`);

  // AI Stain state
  const [stainDescription, setStainDescription] = useState('');
  const [stainResult, setStainResult] = useState(null);

  // AI Predictions state
  const [predictions, setPredictions] = useState(null);
  const [maintenancePredictions, setMaintenancePredictions] = useState(null);
  const [reactivationTargets, setReactivationTargets] = useState(null);

  const handleEstimate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    try {
      const res = await api.post('/ai/estimate', { description });
      setEstimate(res.data);
    } catch (error) {
      toast.error('Error getting estimate');
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async () => {
    if (!chatMessage.trim()) return;
    const userMsg = chatMessage;
    setChatMessage('');
    setChatHistory([...chatHistory, { role: 'user', message: userMsg }]);

    setLoading(true);
    try {
      const res = await api.post('/ai/chat', { message: userMsg, sessionId });
      setChatHistory(prev => [...prev, { role: 'assistant', message: res.data.response }]);
    } catch (error) {
      toast.error('Error sending message');
    } finally {
      setLoading(false);
    }
  };

  const handleStainAnalysis = async () => {
    if (!stainDescription.trim()) return;
    setLoading(true);
    try {
      const res = await api.post('/ai/identify-stain', { description: stainDescription });
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

  const loadSampleData = () => {
    const randomIndex = (arr) => Math.floor(Math.random() * arr.length);

    switch (activeTab) {
      case 'estimator':
        setDescription(sampleData.estimator[randomIndex(sampleData.estimator)]);
        toast.info('Sample data loaded for Order Estimator');
        break;
      case 'stain':
        setStainDescription(sampleData.stain[randomIndex(sampleData.stain)]);
        toast.info('Sample data loaded for Stain Identifier');
        break;
      case 'chat':
        setChatMessage(sampleData.chat[randomIndex(sampleData.chat)]);
        toast.info('Sample question loaded for Chat');
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
      default:
        toast.info('No sample data for this tab');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Features</h1>
          <p className="page-subtitle">Intelligent tools powered by AI</p>
        </div>
        <button className="btn btn-primary" onClick={loadSampleData}>
          <FiDatabase /> Load Sample Data
        </button>
      </div>

      <div className="tabs" style={{ marginBottom: 24 }}>
        <div className={`tab ${activeTab === 'estimator' ? 'active' : ''}`} onClick={() => setActiveTab('estimator')}>
          <FiCamera /> Order Estimator
        </div>
        <div className={`tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
          <FiMessageCircle /> Service Bot
        </div>
        <div className={`tab ${activeTab === 'stain' ? 'active' : ''}`} onClick={() => setActiveTab('stain')}>
          <FiZap /> Stain Identifier
        </div>
        <div className={`tab ${activeTab === 'demand' ? 'active' : ''}`} onClick={() => setActiveTab('demand')}>
          <FiTrendingUp /> Demand Predictor
        </div>
        <div className={`tab ${activeTab === 'maintenance' ? 'active' : ''}`} onClick={() => setActiveTab('maintenance')}>
          <FiTool /> Maintenance Predictor
        </div>
        <div className={`tab ${activeTab === 'reactivation' ? 'active' : ''}`} onClick={() => setActiveTab('reactivation')}>
          <FiUsers /> Reactivation
        </div>
      </div>

      {activeTab === 'estimator' && (
        <div className="grid-2">
          <div className="card">
            <h4 style={{ marginBottom: 16 }}>AI Order Estimator</h4>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
              Describe your laundry items and get an instant quote
            </p>
            <div className="form-group">
              <label className="form-label">Describe your items</label>
              <textarea
                className="form-textarea"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., 3 dress shirts, 2 pairs of pants, 1 suit jacket..."
              />
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
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Price</th>
                      </tr>
                    </thead>
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
                  Confidence: {(estimate.confidence * 100).toFixed(0)}%
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 40 }}>
                <p>Describe your items to get an estimate</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="card">
          <h4 style={{ marginBottom: 16 }}>AI Customer Service Bot</h4>
          <div style={{ height: 400, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16, background: '#f8fafc' }}>
            {chatHistory.length === 0 && (
              <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>
                Start a conversation! Ask about pricing, hours, order status, etc.
              </div>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} style={{
                marginBottom: 12,
                textAlign: msg.role === 'user' ? 'right' : 'left'
              }}>
                <div style={{
                  display: 'inline-block',
                  padding: '8px 12px',
                  borderRadius: 12,
                  background: msg.role === 'user' ? '#2563eb' : 'white',
                  color: msg.role === 'user' ? 'white' : '#1e293b',
                  maxWidth: '80%',
                  boxShadow: msg.role === 'assistant' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}>
                  {msg.message}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              className="form-input"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder="Type your message..."
              onKeyPress={(e) => e.key === 'Enter' && handleChat()}
            />
            <button className="btn btn-primary" onClick={handleChat} disabled={loading}>
              <FiSend /> Send
            </button>
          </div>
        </div>
      )}

      {activeTab === 'stain' && (
        <div className="grid-2">
          <div className="card">
            <h4 style={{ marginBottom: 16 }}>AI Stain Identifier</h4>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
              Describe the stain and get treatment recommendations
            </p>
            <div className="form-group">
              <label className="form-label">Describe the stain</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={stainDescription}
                onChange={(e) => setStainDescription(e.target.value)}
                placeholder="e.g., red wine stain on white shirt, coffee spill on pants..."
              />
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
              <div className="empty-state" style={{ padding: 40 }}>
                <p>Describe a stain to get treatment recommendations</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'demand' && (
        <div className="card">
          <div className="flex-between" style={{ marginBottom: 16 }}>
            <h4>AI Demand Predictor</h4>
            <button className="btn btn-primary" onClick={handleDemandPrediction} disabled={loading}>
              {loading ? 'Loading...' : 'Generate 7-Day Forecast'}
            </button>
          </div>

          {predictions ? (
            <>
              <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card primary">
                  <div className="stat-label">Total Predicted Orders</div>
                  <div className="stat-value">{predictions.summary.totalPredictedOrders}</div>
                </div>
                <div className="stat-card success">
                  <div className="stat-label">Predicted Revenue</div>
                  <div className="stat-value">${predictions.summary.totalPredictedRevenue.toFixed(2)}</div>
                </div>
                <div className="stat-card warning">
                  <div className="stat-label">Peak Day</div>
                  <div className="stat-value">{predictions.summary.peakDay?.dayOfWeek}</div>
                </div>
              </div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Day</th>
                      <th>Predicted Orders</th>
                      <th>Predicted Revenue</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predictions.predictions.map((p, i) => (
                      <tr key={i}>
                        <td>{p.date}</td>
                        <td>{p.dayOfWeek}</td>
                        <td>{p.predictedOrders}</td>
                        <td>${p.predictedRevenue.toFixed(2)}</td>
                        <td>{(p.confidence * 100).toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <FiTrendingUp size={48} />
              <p>Click "Generate Forecast" to see demand predictions</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'maintenance' && (
        <div className="card">
          <div className="flex-between" style={{ marginBottom: 16 }}>
            <h4>AI Maintenance Predictor</h4>
            <button className="btn btn-primary" onClick={handleMaintenancePrediction} disabled={loading}>
              {loading ? 'Loading...' : 'Analyze Machines'}
            </button>
          </div>

          {maintenancePredictions ? (
            <>
              <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card danger">
                  <div className="stat-label">Critical</div>
                  <div className="stat-value">{maintenancePredictions.summary.criticalCount}</div>
                </div>
                <div className="stat-card warning">
                  <div className="stat-label">High Priority</div>
                  <div className="stat-value">{maintenancePredictions.summary.highCount}</div>
                </div>
                <div className="stat-card primary">
                  <div className="stat-label">Medium</div>
                  <div className="stat-value">{maintenancePredictions.summary.mediumCount}</div>
                </div>
                <div className="stat-card success">
                  <div className="stat-label">Low Priority</div>
                  <div className="stat-value">{maintenancePredictions.summary.lowCount}</div>
                </div>
              </div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Machine</th>
                      <th>Type</th>
                      <th>Priority</th>
                      <th>Cycles Since Maintenance</th>
                      <th>Recommended Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maintenancePredictions.predictions.map((p, i) => (
                      <tr key={i}>
                        <td>{p.machineNumber}</td>
                        <td>{p.type}</td>
                        <td>
                          <span className={`badge ${
                            p.priority === 'CRITICAL' ? 'badge-danger' :
                            p.priority === 'HIGH' ? 'badge-warning' :
                            p.priority === 'MEDIUM' ? 'badge-primary' : 'badge-success'
                          }`}>{p.priority}</span>
                        </td>
                        <td>{p.cyclesSinceLastMaintenance}</td>
                        <td>{p.recommendedMaintenanceDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <FiTool size={48} />
              <p>Click "Analyze Machines" to see maintenance predictions</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'reactivation' && (
        <div className="card">
          <div className="flex-between" style={{ marginBottom: 16 }}>
            <h4>AI Reactivation Campaigns</h4>
            <button className="btn btn-primary" onClick={handleReactivationTargets} disabled={loading}>
              {loading ? 'Loading...' : 'Find Inactive Customers'}
            </button>
          </div>

          {reactivationTargets ? (
            <>
              <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                  <div className="stat-label">Inactive Customers</div>
                  <div className="stat-value">{reactivationTargets.summary.totalInactiveCustomers}</div>
                </div>
                <div className="stat-card success">
                  <div className="stat-label">High Potential</div>
                  <div className="stat-value">{reactivationTargets.summary.highPotential}</div>
                </div>
                <div className="stat-card warning">
                  <div className="stat-label">Medium Potential</div>
                  <div className="stat-value">{reactivationTargets.summary.mediumPotential}</div>
                </div>
              </div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Email</th>
                      <th>Days Inactive</th>
                      <th>Total Spent</th>
                      <th>Score</th>
                      <th>Suggested Offer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reactivationTargets.targets.slice(0, 10).map((t, i) => (
                      <tr key={i}>
                        <td>{t.name}</td>
                        <td>{t.email}</td>
                        <td>{t.daysSinceLastOrder || '-'}</td>
                        <td>${t.totalSpent.toFixed(2)}</td>
                        <td>
                          <span className={`badge ${
                            t.reactivationScore > 70 ? 'badge-success' :
                            t.reactivationScore > 50 ? 'badge-warning' : 'badge-secondary'
                          }`}>{t.reactivationScore}%</span>
                        </td>
                        <td>{t.suggestedOffer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <FiUsers size={48} />
              <p>Click "Find Inactive Customers" to identify reactivation opportunities</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AIFeatures;
