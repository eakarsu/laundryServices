import React, { useCallback, useEffect, useState } from 'react';

const initialClaim = { orderId: '', title: '', jurisdiction: 'NY', incidentDate: '' };

async function api(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({ error: 'INVALID_RESPONSE' }));
  if (!response.ok) throw new Error(payload.message || payload.error || `Request failed (${response.status})`);
  return payload;
}

function Login({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '', type: 'staff' });
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault(); setError('');
    try {
      const path = form.type === 'staff' ? '/auth/staff/login' : '/auth/login';
      onLogin(await api(path, { method: 'POST', body: { email: form.email, password: form.password } }));
    } catch (requestError) { setError(requestError.message); }
  };
  return <main className="claims-shell login-shell">
    <section className="claim-panel login-panel">
      <p className="eyebrow">Governed damage &amp; loss resolution</p>
      <h1>Laundry Claim Governance</h1>
      <p className="muted">Evidence provenance, independent review, signature, filing, and retention in one controlled record.</p>
      <form onSubmit={submit} className="claim-form">
        <label>Identity type<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="staff">Staff</option><option value="customer">Customer</option></select></label>
        <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Password<input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        {error && <p className="claim-error" role="alert">{error}</p>}
        <button className="claim-button primary" type="submit">Sign in</button>
      </form>
    </section>
  </main>;
}

function Status({ value }) {
  return <span className={`claim-status status-${value.toLowerCase()}`}>{value.replaceAll('_', ' ')}</span>;
}

function App() {
  const saved = sessionStorage.getItem('claim-session');
  const [session, setSession] = useState(saved ? JSON.parse(saved) : null);
  const [claims, setClaims] = useState([]);
  const [selected, setSelected] = useState(null);
  const [claimForm, setClaimForm] = useState(initialClaim);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadClaims = useCallback(async () => {
    if (!session?.token) return;
    try { setClaims((await api('/damage-claims', { token: session.token })).items); }
    catch (requestError) { setError(requestError.message); }
  }, [session]);

  useEffect(() => { loadClaims(); }, [loadClaims]);

  const login = (value) => {
    const next = { token: value.token, user: value.user };
    sessionStorage.setItem('claim-session', JSON.stringify(next));
    setSession(next);
  };
  const logout = () => {
    sessionStorage.removeItem('claim-session'); setSession(null); setSelected(null);
  };
  const loadClaim = async (id) => {
    setError('');
    try { setSelected(await api(`/damage-claims/${id}`, { token: session.token })); }
    catch (requestError) { setError(requestError.message); }
  };
  const createClaim = async (event) => {
    event.preventDefault(); setError(''); setNotice('');
    try {
      const created = await api('/damage-claims', {
        token: session.token, method: 'POST', body: {
          ...claimForm,
          incidentDate: new Date(claimForm.incidentDate).toISOString(),
          jurisdiction: claimForm.jurisdiction.toUpperCase(),
          idempotencyKey: `ui-claim:${crypto.randomUUID()}`,
        },
      });
      setClaimForm(initialClaim); setNotice(`Claim ${created.id} opened`);
      await loadClaims(); await loadClaim(created.id);
    } catch (requestError) { setError(requestError.message); }
  };

  if (!session) return <Login onLogin={login} />;
  return <div className="claims-shell">
    <header className="claims-header">
      <div><p className="eyebrow">Laundry Services</p><h1>Claim governance</h1></div>
      <div className="identity"><span>{session.user.firstName} {session.user.lastName}</span><small>{session.user.role || session.user.type}</small><button className="claim-button ghost" onClick={logout}>Sign out</button></div>
    </header>
    {(error || notice) && <div className={error ? 'claim-alert error' : 'claim-alert success'} role="status">{error || notice}</div>}
    <div className="claims-grid">
      <aside className="claim-panel">
        <div className="panel-heading"><div><p className="eyebrow">Matter scope</p><h2>My claims</h2></div><button className="claim-button ghost" onClick={loadClaims}>Refresh</button></div>
        <div className="claim-list">{claims.length ? claims.map((claim) => <button key={claim.id} className={`claim-row ${selected?.id === claim.id ? 'active' : ''}`} onClick={() => loadClaim(claim.id)}>
          <span><strong>{claim.title}</strong><small>Order {claim.orderId.slice(0, 8)} · {claim.jurisdiction}</small></span><Status value={claim.status} />
        </button>) : <p className="empty-state">No active claim matters are assigned to you.</p>}</div>
      </aside>
      <main>
        <section className="claim-panel">
          <p className="eyebrow">Controlled intake</p><h2>Open damage or loss claim</h2>
          <form onSubmit={createClaim} className="claim-form form-grid">
            <label>Laundry order UUID<input required value={claimForm.orderId} onChange={(e) => setClaimForm({ ...claimForm, orderId: e.target.value })} /></label>
            <label>Jurisdiction<input required maxLength="20" value={claimForm.jurisdiction} onChange={(e) => setClaimForm({ ...claimForm, jurisdiction: e.target.value })} /></label>
            <label className="span-2">Claim title<input required maxLength="160" value={claimForm.title} onChange={(e) => setClaimForm({ ...claimForm, title: e.target.value })} /></label>
            <label>Incident date<input type="datetime-local" required value={claimForm.incidentDate} onChange={(e) => setClaimForm({ ...claimForm, incidentDate: e.target.value })} /></label>
            <div className="form-action"><button className="claim-button primary" type="submit">Open governed claim</button></div>
          </form>
        </section>
        <section className="claim-panel claim-detail">
          {!selected ? <div className="empty-state"><h2>Select a claim</h2><p>Inspect evidence versions, legal review, signature status, and the immutable event chain.</p></div> : <>
            <div className="panel-heading"><div><p className="eyebrow">Claim {selected.id}</p><h2>{selected.title}</h2></div><Status value={selected.status} /></div>
            <dl className="claim-facts"><div><dt>Order</dt><dd>{selected.orderId}</dd></div><div><dt>Jurisdiction</dt><dd>{selected.jurisdiction}</dd></div><div><dt>Retention</dt><dd>{new Date(selected.retentionUntil).toLocaleDateString()}</dd></div><div><dt>Legal hold</dt><dd>{selected.legalHold ? 'Active' : 'None'}</dd></div></dl>
            <h3>Evidence and forms</h3>
            <div className="document-list">{selected.documents.map((document) => <article key={document.id}><div><strong>{document.name}</strong><small>{document.kind} · v{document.currentVersion}</small></div><span>{document.privileged ? (document.versions[0]?.redacted ? 'Redacted view' : 'Privileged') : 'Standard'}</span></article>)}</div>
            <h3>Immutable event chain</h3>
            <ol className="audit-list">{selected.audits.map((event) => <li key={event.sequence}><span>{event.sequence}</span><div><strong>{event.action.replaceAll('_', ' ')}</strong><small>{new Date(event.createdAt).toLocaleString()}</small></div></li>)}</ol>
          </>}
        </section>
      </main>
    </div>
  </div>;
}

export default App;
