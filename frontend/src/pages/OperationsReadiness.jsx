import React, { useEffect, useState } from 'react';
import NativeAIControls from '../components/NativeAIControls.jsx';
import FormattedAIReport from '../components/FormattedAIReport.jsx';

const examples = [
  'A neighborhood laundry receives 80 orders weekly. Review pickup handoff records, exception escalation, and staff approval before changing a customer claim.',
  'A two-location laundry wants to audit missing-item complaints. Review intake photos, custody transfers, customer notices, and independent staff review.',
  'A laundry team handles 120 weekly orders and seasonal delays. Assess evidence retention, role permissions, escalation timing, and checks for unresolved exceptions.',
];

async function request(path, token, options = {}) {
  const response = await fetch(`/api/runtime-ai/${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error || `Request failed (${response.status})`);
  return value;
}

export default function OperationsReadiness({ token }) {
  const [workflowSummary, setWorkflowSummary] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function loadHistory() {
    try {
      const payload = await request('operations-readiness/history', token);
      if (!Array.isArray(payload.items)) throw new Error('Saved analyses response is invalid');
      setHistory(payload.items);
    } catch (reason) { setError(reason.message); }
  }

  useEffect(() => { loadHistory(); }, [token]);

  async function run(event) {
    event.preventDefault();
    setBusy(true); setError(''); setResult(null);
    try {
      const payload = await request('operations-readiness', token, {
        method: 'POST', body: JSON.stringify({ workflowSummary }),
      });
      setResult(payload.result ?? payload);
      await loadHistory();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  const presets = examples.map((example, index) => ({
    name: ['Quick brief', 'Team planning', 'Detailed review'][index],
    fill: () => { setWorkflowSummary(example); return { filled: 1, manual: [] }; },
  }));

  return <main style={{ maxWidth: 980, margin: '0 auto' }}>
    <NativeAIControls context="operations readiness" presets={presets} busy={busy}>
      <section className="claim-panel">
        <p className="eyebrow">Administrative review</p><h2>Operations readiness</h2>
        <p className="muted">Describe a deidentified laundry workflow. A qualified person remains responsible for claim decisions.</p>
        <form onSubmit={run} className="claim-form">
          <label>Workflow summary<textarea required minLength={10} maxLength={1000} rows={5} value={workflowSummary} onChange={(event) => setWorkflowSummary(event.target.value)} /></label>
          <button className="claim-button primary" type="submit" disabled={busy}>{busy ? 'Reviewing…' : 'Run analysis'}</button>
        </form>
        {error && <p className="claim-error" role="alert">{error === 'AI provider request failed' ? 'The AI provider is unavailable. Your request was not saved; try again later.' : error}</p>}
        {result !== null && <FormattedAIReport response={result} title="Operations readiness result" />}
      </section>
      <section className="claim-panel"><h2>Saved analyses</h2>
        {history.length === 0 ? <p className="empty-state">No saved analyses yet.</p> : history.map((item) => <details key={item.id}>
          <summary>{new Date(item.createdAt).toLocaleString()}</summary>
          <FormattedAIReport response={item.output?.result ?? item.output} title="Saved operations readiness result" />
        </details>)}
      </section>
    </NativeAIControls>
  </main>;
}
