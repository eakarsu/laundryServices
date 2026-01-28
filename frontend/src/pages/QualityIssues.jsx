import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiAlertTriangle, FiCheck, FiClock, FiFilter, FiX, FiEye } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';

const issueTypes = [
  'DAMAGE', 'STAIN_NOT_REMOVED', 'WRONG_ITEM', 'MISSING_ITEM', 'SHRINKAGE',
  'COLOR_BLEEDING', 'PRESSING_ISSUE', 'ODOR', 'LOST_BUTTON', 'TORN_FABRIC', 'OTHER'
];

const severityOptions = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const statusOptions = ['OPEN', 'IN_PROGRESS', 'PENDING_CUSTOMER', 'RESOLVED', 'CLOSED', 'ESCALATED'];
const compensationTypes = ['REFUND', 'CREDIT', 'REDO_SERVICE', 'DISCOUNT', 'REPLACEMENT', 'NONE'];

function QualityIssues() {
  const navigate = useNavigate();
  const [issues, setIssues] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [orders, setOrders] = useState([]);
  const [filters, setFilters] = useState({ status: '', severity: '', type: '' });
  const [formData, setFormData] = useState({
    orderId: '',
    issueType: 'OTHER',
    severity: 'MEDIUM',
    title: '',
    description: ''
  });

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.type) params.append('type', filters.type);

      const [issuesRes, statsRes, ordersRes] = await Promise.all([
        api.get(`/quality-issues?${params.toString()}`),
        api.get('/quality-issues/stats'),
        api.get('/orders?limit=100')
      ]);

      // Handle different response formats
      const issuesData = issuesRes.data;
      setIssues(Array.isArray(issuesData) ? issuesData : (issuesData.issues || issuesData.data || []));

      setStats(statsRes.data);

      const ordersData = ordersRes.data;
      setOrders(Array.isArray(ordersData) ? ordersData : (ordersData.orders || ordersData.data || []));
    } catch (error) {
      console.error('Error loading quality issues:', error);
      toast.error('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/quality-issues', formData);
      toast.success('Quality issue reported');
      setShowModal(false);
      setFormData({ orderId: '', issueType: 'OTHER', severity: 'MEDIUM', title: '', description: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error creating issue');
    }
  };

  const handleUpdateStatus = async (issueId, status) => {
    try {
      await api.patch(`/quality-issues/${issueId}`, { status });
      toast.success('Status updated');
      fetchData();
      if (selectedIssue?.id === issueId) {
        setSelectedIssue({ ...selectedIssue, status });
      }
    } catch (error) {
      toast.error('Error updating status');
    }
  };

  const handleResolve = async (issueId, resolution, compensationType, compensationAmount) => {
    try {
      await api.patch(`/quality-issues/${issueId}`, {
        status: 'RESOLVED',
        resolution,
        compensationType,
        compensationAmount: compensationAmount ? parseFloat(compensationAmount) : null
      });
      toast.success('Issue resolved');
      setShowDetailModal(false);
      fetchData();
    } catch (error) {
      toast.error('Error resolving issue');
    }
  };

  const viewIssue = async (issue) => {
    try {
      const res = await api.get(`/quality-issues/${issue.id}`);
      setSelectedIssue(res.data);
      setShowDetailModal(true);
    } catch (error) {
      toast.error('Error loading issue details');
    }
  };

  const getSeverityBadge = (severity) => {
    const colors = {
      LOW: 'badge-secondary',
      MEDIUM: 'badge-warning',
      HIGH: 'badge-danger',
      CRITICAL: 'badge-danger'
    };
    return colors[severity] || 'badge-secondary';
  };

  const getStatusBadge = (status) => {
    const colors = {
      OPEN: 'badge-danger',
      IN_PROGRESS: 'badge-warning',
      PENDING_CUSTOMER: 'badge-primary',
      RESOLVED: 'badge-success',
      CLOSED: 'badge-secondary',
      ESCALATED: 'badge-danger'
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
          <h1 className="page-title">Quality Issues</h1>
          <p className="page-subtitle">Track and resolve customer quality concerns</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <FiPlus /> Report Issue
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <FiAlertTriangle size={24} />
          </div>
          <div>
            <div className="stat-label">Open Issues</div>
            <div className="stat-value">{stats?.summary?.openIssues || 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
            <FiClock size={24} />
          </div>
          <div>
            <div className="stat-label">Critical</div>
            <div className="stat-value">{stats?.summary?.criticalIssues || 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>
            <FiCheck size={24} />
          </div>
          <div>
            <div className="stat-label">Resolved This Week</div>
            <div className="stat-value">{stats?.summary?.resolvedThisWeek || 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#e0e7ff', color: '#4f46e5' }}>
            <FiFilter size={24} />
          </div>
          <div>
            <div className="stat-label">By Type (Top)</div>
            <div className="stat-value" style={{ fontSize: 14 }}>
              {stats?.byType ? Object.entries(stats.byType).sort((a,b) => b[1] - a[1])[0]?.[0]?.replace('_', ' ') || 'N/A' : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <select
            className="form-select"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            style={{ width: 150 }}
          >
            <option value="">All Statuses</option>
            {statusOptions.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <select
            className="form-select"
            value={filters.severity}
            onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
            style={{ width: 150 }}
          >
            <option value="">All Severities</option>
            {severityOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            className="form-select"
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            style={{ width: 180 }}
          >
            <option value="">All Types</option>
            {issueTypes.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
          {(filters.status || filters.severity || filters.type) && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setFilters({ status: '', severity: '', type: '' })}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Issues Table */}
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Issue</th>
              <th>Order</th>
              <th>Customer</th>
              <th>Type</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!Array.isArray(issues) || issues.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 40 }}>
                  No quality issues found
                </td>
              </tr>
            ) : (
              issues.map(issue => (
                <tr key={issue.id} onClick={() => viewIssue(issue)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{issue.title}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {issue.description?.substring(0, 50)}...
                    </div>
                  </td>
                  <td>{issue.order?.orderNumber || '-'}</td>
                  <td>{issue.customer ? `${issue.customer.firstName} ${issue.customer.lastName}` : '-'}</td>
                  <td>{issue.issueType?.replace('_', ' ')}</td>
                  <td><span className={`badge ${getSeverityBadge(issue.severity)}`}>{issue.severity}</span></td>
                  <td><span className={`badge ${getStatusBadge(issue.status)}`}>{issue.status?.replace('_', ' ')}</span></td>
                  <td>{new Date(issue.createdAt).toLocaleDateString()}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <button className="btn btn-outline btn-sm" onClick={() => viewIssue(issue)}>
                        <FiEye />
                      </button>
                      {issue.status === 'OPEN' && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleUpdateStatus(issue.id, 'IN_PROGRESS')}
                        >
                          Start
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Report Quality Issue</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Order *</label>
                  <select
                    className="form-select"
                    value={formData.orderId}
                    onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
                    required
                  >
                    <option value="">Select order...</option>
                    {Array.isArray(orders) && orders.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.orderNumber} - {o.customer?.firstName} {o.customer?.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Issue Type *</label>
                    <select
                      className="form-select"
                      value={formData.issueType}
                      onChange={(e) => setFormData({ ...formData, issueType: e.target.value })}
                      required
                    >
                      {issueTypes.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Severity *</label>
                    <select
                      className="form-select"
                      value={formData.severity}
                      onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                      required
                    >
                      {severityOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Brief description of the issue"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description *</label>
                  <textarea
                    className="form-input"
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Detailed description of the quality issue..."
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Report Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedIssue && (
        <IssueDetailModal
          issue={selectedIssue}
          onClose={() => setShowDetailModal(false)}
          onUpdateStatus={handleUpdateStatus}
          onResolve={handleResolve}
          getSeverityBadge={getSeverityBadge}
          getStatusBadge={getStatusBadge}
        />
      )}
    </div>
  );
}

function IssueDetailModal({ issue, onClose, onUpdateStatus, onResolve, getSeverityBadge, getStatusBadge }) {
  const [resolution, setResolution] = useState(issue.resolution || '');
  const [compensationType, setCompensationType] = useState(issue.compensationType || '');
  const [compensationAmount, setCompensationAmount] = useState(issue.compensationAmount || '');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <h3 className="modal-title">Issue Details</h3>
          <button className="modal-close" onClick={onClose}><FiX /></button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 8 }}>{issue.title}</h4>
            <div className="flex gap-2" style={{ marginBottom: 12 }}>
              <span className={`badge ${getSeverityBadge(issue.severity)}`}>{issue.severity}</span>
              <span className={`badge ${getStatusBadge(issue.status)}`}>{issue.status?.replace('_', ' ')}</span>
              <span className="badge badge-secondary">{issue.issueType?.replace('_', ' ')}</span>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <strong>Order:</strong> {issue.order?.orderNumber || 'N/A'}
          </div>

          <div style={{ marginBottom: 16 }}>
            <strong>Customer:</strong> {issue.customer?.firstName} {issue.customer?.lastName}
            <br />
            <span style={{ color: '#64748b' }}>{issue.customer?.email}</span>
          </div>

          <div style={{ marginBottom: 16 }}>
            <strong>Description:</strong>
            <p style={{ marginTop: 4, color: '#475569' }}>{issue.description}</p>
          </div>

          <div style={{ marginBottom: 16 }}>
            <strong>Created:</strong> {new Date(issue.createdAt).toLocaleString()}
          </div>

          {issue.status !== 'RESOLVED' && issue.status !== 'CLOSED' && (
            <>
              <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />

              <div className="form-group">
                <label className="form-label">Resolution Notes</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Describe how the issue was resolved..."
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Compensation Type</label>
                  <select
                    className="form-select"
                    value={compensationType}
                    onChange={(e) => setCompensationType(e.target.value)}
                  >
                    <option value="">None</option>
                    {compensationTypes.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Amount ($)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={compensationAmount}
                    onChange={(e) => setCompensationAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
            </>
          )}

          {issue.resolution && (
            <div style={{ marginBottom: 16, padding: 12, background: '#f0fdf4', borderRadius: 8 }}>
              <strong>Resolution:</strong>
              <p style={{ marginTop: 4 }}>{issue.resolution}</p>
              {issue.compensationType && (
                <p style={{ marginTop: 8, color: '#16a34a' }}>
                  Compensation: {issue.compensationType.replace('_', ' ')}
                  {issue.compensationAmount && ` - $${issue.compensationAmount}`}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          {issue.status !== 'RESOLVED' && issue.status !== 'CLOSED' && (
            <>
              {issue.status === 'OPEN' && (
                <button
                  className="btn btn-warning"
                  onClick={() => onUpdateStatus(issue.id, 'IN_PROGRESS')}
                >
                  Start Working
                </button>
              )}
              <button
                className="btn btn-success"
                onClick={() => onResolve(issue.id, resolution, compensationType, compensationAmount)}
              >
                Mark Resolved
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default QualityIssues;
