import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { apiFetch, clearToken, getToken, setToken } from './api/client';
import './styles.css';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email_address: email, password }) });
      setToken(data.access_token);
      onLogin();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return <div className="login-shell"><form className="login-card" onSubmit={submit}>
    <h1>eDC Invoice Builder</h1>
    <p>Log in to create monthly service charge invoices.</p>
    {error && <div className="error">{error}</div>}
    <label>Email address</label>
    <input value={email} onChange={e => setEmail(e.target.value)} type="email" required />
    <label>Password</label>
    <input value={password} onChange={e => setPassword(e.target.value)} type="password" required />
    <button disabled={loading}>{loading ? 'Logging in...' : 'Log in'}</button>
  </form></div>;
}

function Table({ rows }) {
  if (!rows || rows.length === 0) return <p className="muted">No rows to show.</p>;
  const headers = Object.keys(rows[0]);
  return <div className="table-wrap"><table><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{headers.map(h => <td key={h}>{String(r[h] ?? '')}</td>)}</tr>)}</tbody></table></div>;
}

function MainPage({ onLogout }) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [processes, setProcesses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('usage');
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('invoice');

  async function loadProcesses() { setProcesses(await apiFetch('/invoice-process')); }
  useEffect(() => { loadProcesses().catch(() => {}); }, []);

  function setLastMonth() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    setFromDate(start.toISOString().slice(0,10)); setToDate(end.toISOString().slice(0,10));
  }
  function setThisMonth() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth()+1, 0);
    setFromDate(start.toISOString().slice(0,10)); setToDate(end.toISOString().slice(0,10));
  }
  async function start() {
    setLoading(true); setMessage('Collecting data from eDC APIs...');
    try {
      const p = await apiFetch('/invoice-process/start', { method: 'POST', body: JSON.stringify({ from_date: fromDate, to_date: toDate }) });
      setSelected(p.process_number); setMessage(`Process ${p.process_number} completed with status ${p.status}`); await loadProcesses();
    } catch (err) { setMessage(`Failed: ${err.message}`); }
    finally { setLoading(false); }
  }
  async function loadTab(nextTab = tab, processNumber = selected) {
    if (!processNumber) return;
    setTab(nextTab);
    const path = nextTab === 'usage' ? 'usage' : nextTab === 'shipments' ? 'shipments' : nextTab === 'exceptions' ? 'exceptions' : 'final-lines';
    setRows(await apiFetch(`/invoice-process/${processNumber}/${path}`));
  }
  async function createFinal() { if (!selected) return; setRows(await apiFetch(`/invoice-process/${selected}/create-final-invoice`, { method: 'POST' })); setTab('final'); }
  function downloadExcel() { if (selected) window.location.href = `/api/invoice-process/${selected}/download-excel`; }

  return <div className="app">
<header>
  <h1>eDC Invoice Builder</h1>
  <div className="row">
    <button onClick={() => setView('invoice')}>Invoice</button>
    <button onClick={() => setView('admin')}>Admin Settings</button>
    <button onClick={() => { clearToken(); onLogout(); }}>Log out</button>
  </div>
</header>
{view === 'invoice' && <>
    <section className="card">
      <h2>Create invoice process</h2>
      <div className="row"><label>From <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></label><label>To <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} /></label></div>
      <div className="row"><button onClick={setThisMonth}>This Month</button><button onClick={setLastMonth}>Last Month</button><button className="primary" onClick={start} disabled={loading || !fromDate || !toDate}>{loading ? 'Running...' : 'Collect Data'}</button></div>
      {message && <p className={message.startsWith('Failed') ? 'error' : 'success'}>{message}</p>}
    </section>
    <section className="card">
      <h2>Processes</h2>
      <div className="button-list">{processes.map(p => <button key={p.process_number} className={selected === p.process_number ? 'selected' : ''} onClick={() => { setSelected(p.process_number); loadTab('usage', p.process_number); }}>#{p.process_number} {p.status}</button>)}</div>
    </section>
    <section className="card">
      <h2>Data Review {selected ? `- Process ${selected}` : ''}</h2>
      <div className="tabs"><button onClick={() => loadTab('usage')}>SCM Usage</button><button onClick={() => loadTab('shipments')}>Shipment Data</button><button onClick={() => loadTab('exceptions')}>Warnings</button><button onClick={createFinal}>Create Final Invoice</button><button onClick={() => loadTab('final')}>Final Lines</button><button onClick={downloadExcel}>Download Excel</button></div>
      <Table rows={rows} />
    </section>
</>}
{view === 'admin' && <AdminPanel />}
  </div>;
}

function AdminPanel() {
  const [orgs, setOrgs] = useState([]);
  const [rates, setRates] = useState([]);
  const [error, setError] = useState('');
  async function load() { setOrgs(await apiFetch('/admin/organisations')); setRates(await apiFetch('/admin/charge-plan-rates')); }
  useEffect(() => { load().catch(e => setError(e.message)); }, []);
  async function toggleOrg(org, field) {
    await apiFetch(`/admin/organisations/${org.uid}`, { method: 'PUT', body: JSON.stringify({ ...org, [field]: !org[field] }) });
    await load();
  }
  async function addRate() {
    const from = Number(prompt('From quantity?'));
    const toText = prompt('To quantity? Leave blank for no limit');
    const unit = Number(prompt('Unit price?'));
    await apiFetch('/admin/charge-plan-rates', { method: 'POST', body: JSON.stringify({ charge_plan_code: 'DEFAULT_2026', metric_code: 'SHIPMENT', from_quantity: from, to_quantity: toText ? Number(toText) : null, unit_price: unit }) });
    await load();
  }
  return <section className="card"><h2>Admin Settings</h2>{error && <p className="error">{error}</p>}
    <h3>Organisations</h3><div className="table-wrap"><table><thead><tr><th>OrgCode</th><th>Name</th><th>Country</th><th>Get Shipment Data</th><th>Excluded</th><th>Charge Plan</th></tr></thead><tbody>{orgs.map(o => <tr key={o.uid}><td>{o.org_code}</td><td>{o.org_full_name}</td><td>{o.country_code}</td><td><input type="checkbox" checked={o.get_shipment_data} onChange={() => toggleOrg(o, 'get_shipment_data')} /></td><td><input type="checkbox" checked={o.excluded} onChange={() => toggleOrg(o, 'excluded')} /></td><td>{o.charge_plan_code}</td></tr>)}</tbody></table></div>
    <h3>Charge Rates</h3><button onClick={addRate}>Add Rate</button><Table rows={rates} />
  </section>;
}

function App() {
  const [loggedIn, setLoggedIn] = useState(Boolean(getToken()));
  return loggedIn ? <MainPage onLogout={() => setLoggedIn(false)} /> : <Login onLogin={() => setLoggedIn(true)} />;
}

createRoot(document.getElementById('root')).render(<App />);
