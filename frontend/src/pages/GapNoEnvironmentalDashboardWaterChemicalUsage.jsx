// // === Batch 10 Gaps & Frontend Mounts ===
// Batch 10 frontend page: "No environmental dashboard (water / chemical usage)" (nonai-gap) — laundryServices
import React, { useEffect, useState } from 'react';
import NativeAIControls from '../components/NativeAIControls.jsx';
import FormattedAIReport from '../components/FormattedAIReport.jsx';
import { laundryPromptPresets } from '../components/laundryPromptPresets.js';

const SLUG = "no-environmental-dashboard-water-chemical-usage";
const LABEL = "No environmental dashboard (water / chemical usage)";
const SECTION = "nonai-gap";
const API_PATH = "/api/gap-no-environmental-dashboard-water-chemical-usage";

export default function GapNoEnvironmentalDashboardWaterChemicalUsage() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const presets = laundryPromptPresets(LABEL).map(({ name, prompt: example }) => ({
    name,
    fill: () => { setPrompt(example); return { filled: 1, manual: [] }; },
  }));

  async function loadHistory() {
    try {
      const resp = await fetch(API_PATH + '/history');
      if (!resp.ok) return;
      const json = await resp.json();
      setHistory(json.items || []);
    } catch (_e) { /* ignore */ }
  }

  useEffect(() => { loadHistory(); }, []);

  async function run(e) {
    if (e && e.preventDefault) e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const resp = await fetch(API_PATH + '/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (!resp.ok) {
        setError('Request failed: ' + resp.status);
      } else {
        const json = await resp.json();
        setResult(json);
        loadHistory();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <NativeAIControls busy={loading} context={LABEL} presets={presets}>
    <div style={{ padding: 24, maxWidth: 880, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{LABEL}</h1>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>{SECTION} · slug: {SLUG}</div>
      <form onSubmit={run} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder={'Describe what you want: ' + LABEL}
          rows={5}
          style={{ width: '100%', padding: 12, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ padding: '10px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', alignSelf: 'flex-start' }}
        >
          {loading ? 'Running…' : 'Run'}
        </button>
      </form>
      {error && <div style={{ marginTop: 12, color: '#b91c1c' }}>{error}</div>}
      {result && <FormattedAIReport response={result.result ?? result} title={`${LABEL} result`} />}
      <h2 style={{ marginTop: 28, fontSize: 16, fontWeight: 600 }}>Recent runs</h2>
      <div style={{ marginTop: 10 }}>
        {history.length === 0 && <p style={{ color: '#94a3b8' }}>No history yet</p>}
        {history.map(item => (
          <details key={item.id} style={{ marginBottom: 12 }}>
            <summary style={{ cursor: 'pointer', color: '#475569' }}>
              {item.createdAt} · {String(item.payload?.prompt ?? 'Saved run').slice(0, 80)}
            </summary>
            <FormattedAIReport response={item.result ?? item} title={`${LABEL} saved result`} />
          </details>
        ))}
      </div>
    </div>
    </NativeAIControls>
  );
}
