import React, { useEffect, useState } from 'react';
import api from '../services/api';

const empty = { machine: '', location: '', lastCleaned: '', cycleCount: 0, operator: '', status: 'due soon' };

export default function LintFilterCompliance() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ total: 0, overdue: 0, dueSoon: 0 });
  const [form, setForm] = useState(empty);
  const load = async () => { const res = await api.get('/lint-filter-compliance'); setRows(res.data.rows || []); setSummary(res.data.summary || summary); };
  useEffect(() => { load(); }, []);
  const submit = async e => { e.preventDefault(); await api.post('/lint-filter-compliance', form); setForm(empty); load(); };
  return <div className="page"><h1>Lint Filter Compliance</h1><p>Dryer lint-clean checks by machine, cycle count, and operator.</p>
    <div className="stats-grid">{['total','overdue','dueSoon'].map(k => <div className="stat-card" key={k}><h3>{k}</h3><div className="stat-value">{summary[k]}</div></div>)}</div>
    <form className="card" onSubmit={submit} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12}}>{['machine','location','lastCleaned','operator'].map(f => <input key={f} placeholder={f} value={form[f]} onChange={e => setForm({...form,[f]:e.target.value})}/>)}<input type="number" value={form.cycleCount} onChange={e=>setForm({...form,cycleCount:e.target.value})}/><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>due soon</option><option>clear</option><option>overdue</option></select><button>Add Check</button></form>
    <table className="data-table"><thead><tr>{['Machine','Location','Last Cleaned','Cycles','Operator','Status'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.machine}</td><td>{r.location}</td><td>{r.lastCleaned}</td><td>{r.cycleCount}</td><td>{r.operator}</td><td>{r.status}</td></tr>)}</tbody></table>
  </div>;
}
