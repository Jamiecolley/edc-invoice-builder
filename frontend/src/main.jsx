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
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  const [editingOrgUid, setEditingOrgUid] = useState(null);
  const [originalOrg, setOriginalOrg] = useState(null);

  const [editingRateUid, setEditingRateUid] = useState(null);
  const [originalRate, setOriginalRate] = useState(null);

  async function load() {
    setOrgs(await apiFetch('/admin/organisations'));
    setRates(await apiFetch('/admin/charge-plan-rates'));
  }

  useEffect(() => {
    load().catch(e => setError(e.message));
  }, []);

  function startEditOrg(org) {
    setEditingOrgUid(org.uid);
    setOriginalOrg({ ...org });
    setMessage('');
    setError('');
  }

  function cancelEditOrg() {
    if (originalOrg) {
      setOrgs(orgs.map(o => o.uid === originalOrg.uid ? originalOrg : o));
    }

    setEditingOrgUid(null);
    setOriginalOrg(null);
  }

  function updateOrgLocal(uid, field, value) {
    setOrgs(orgs.map(o => o.uid === uid ? { ...o, [field]: value } : o));
  }

  async function saveOrg(org) {
    setError('');
    setMessage('');

    try {
      await apiFetch(`/admin/organisations/${org.uid}`, {
        method: 'PUT',
        body: JSON.stringify(org)
      });

      setMessage(`Saved organisation ${org.org_code}`);
      setEditingOrgUid(null);
      setOriginalOrg(null);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  function startEditRate(rate) {
    setEditingRateUid(rate.uid);
    setOriginalRate({ ...rate });
    setMessage('');
    setError('');
  }

  function cancelEditRate() {
    if (originalRate && originalRate.isNew) {
      setRates(rates.filter(r => r.uid !== originalRate.uid));
    } else if (originalRate) {
      setRates(rates.map(r => r.uid === originalRate.uid ? originalRate : r));
    }

    setEditingRateUid(null);
    setOriginalRate(null);
  }

  function updateRateLocal(uid, field, value) {
    setRates(rates.map(r => r.uid === uid ? { ...r, [field]: value } : r));
  }

  function addRate() {
    if (editingRateUid !== null) {
      setError('Please save or cancel the current rate before adding another one.');
      return;
    }

    const tempUid = `new-${Date.now()}`;

    const newRate = {
      uid: tempUid,
      charge_plan_code: 'DEFAULT_2026',
      metric_code: 'SHIPMENT',
      from_quantity: '',
      to_quantity: '',
      unit_price: '',
      is_active: true,
      isNew: true
    };

    setRates([...rates, newRate]);
    setEditingRateUid(tempUid);
    setOriginalRate({ ...newRate });
    setMessage('');
    setError('');
  }

  async function saveRate(rate) {
    setError('');
    setMessage('');

    if (!rate.charge_plan_code || !rate.metric_code || rate.from_quantity === '' || rate.unit_price === '') {
      setError('Charge Plan, Metric, From Qty and Unit Price are required.');
      return;
    }

    const payload = {
      charge_plan_code: rate.charge_plan_code,
      metric_code: rate.metric_code,
      from_quantity: Number(rate.from_quantity),
      to_quantity: rate.to_quantity === '' || rate.to_quantity === null ? null : Number(rate.to_quantity),
      unit_price: Number(rate.unit_price),
      is_active: Boolean(rate.is_active)
    };

    try {
      if (rate.isNew) {
        await apiFetch('/admin/charge-plan-rates', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        setMessage(`Added rate ${rate.charge_plan_code}`);
      } else {
        await apiFetch(`/admin/charge-plan-rates/${rate.uid}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });

        setMessage(`Saved rate ${rate.charge_plan_code}`);
      }

      setEditingRateUid(null);
      setOriginalRate(null);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteRate(rate) {
    if (rate.isNew) {
      setRates(rates.filter(r => r.uid !== rate.uid));
      setEditingRateUid(null);
      setOriginalRate(null);
      return;
    }

    const confirmed = window.confirm(`Delete rate ${rate.charge_plan_code} from ${rate.from_quantity}?`);

    if (!confirmed) return;

    setError('');
    setMessage('');

    try {
      await apiFetch(`/admin/charge-plan-rates/${rate.uid}`, {
        method: 'DELETE'
      });

      setMessage(`Deleted rate ${rate.charge_plan_code}`);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  const filteredOrgs = orgs.filter(o => {
    const text = `${o.org_code || ''} ${o.org_full_name || ''} ${o.country_code || ''}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

  return <section className="card">
    <h2>Admin Settings</h2>

    {error && <p className="error">{error}</p>}
    {message && <p className="success">{message}</p>}

    <h3>Organisations</h3>

    <div className="row">
      <label>
        Search
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search org code, name, or country"
        />
      </label>
    </div>

    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>OrgCode</th>
            <th>Name</th>
            <th>Country</th>
            <th>Get Shipment Data</th>
            <th>Excluded</th>
            <th>Charge Plan</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {filteredOrgs.map(o => {
            const isEditing = editingOrgUid === o.uid;
            const anotherRowIsEditing = editingOrgUid !== null && editingOrgUid !== o.uid;

            return <tr key={o.uid}>
              <td>{o.org_code}</td>
              <td>{o.org_full_name}</td>

              <td>
                <input
                  value={o.country_code || ''}
                  disabled={!isEditing}
                  onChange={e => updateOrgLocal(o.uid, 'country_code', e.target.value)}
                  placeholder="GB / DE / Multi"
                />
              </td>

              <td>
                <input
                  type="checkbox"
                  checked={Boolean(o.get_shipment_data)}
                  disabled={!isEditing}
                  onChange={e => updateOrgLocal(o.uid, 'get_shipment_data', e.target.checked)}
                />
              </td>

              <td>
                <input
                  type="checkbox"
                  checked={Boolean(o.excluded)}
                  disabled={!isEditing}
                  onChange={e => updateOrgLocal(o.uid, 'excluded', e.target.checked)}
                />
              </td>

              <td>
                <input
                  value={o.charge_plan_code || ''}
                  disabled={!isEditing}
                  onChange={e => updateOrgLocal(o.uid, 'charge_plan_code', e.target.value)}
                  placeholder="DEFAULT_2026"
                />
              </td>

              <td>
                {!isEditing && (
                  <button disabled={anotherRowIsEditing} onClick={() => startEditOrg(o)}>
                    Edit
                  </button>
                )}

                {isEditing && (
                  <div className="row">
                    <button className="primary" onClick={() => saveOrg(o)}>Save</button>
                    <button onClick={cancelEditOrg}>Cancel</button>
                  </div>
                )}
              </td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>

    <h3>Charge Rates</h3>

    <button onClick={addRate}>Add Rate</button>

    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Charge Plan</th>
            <th>Metric</th>
            <th>From Qty</th>
            <th>To Qty</th>
            <th>Unit Price</th>
            <th>Active</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {rates.map(r => {
            const isEditing = editingRateUid === r.uid;
            const anotherRateIsEditing = editingRateUid !== null && editingRateUid !== r.uid;

            return <tr key={r.uid}>
              <td>
                <input
                  value={r.charge_plan_code || ''}
                  disabled={!isEditing}
                  onChange={e => updateRateLocal(r.uid, 'charge_plan_code', e.target.value)}
                />
              </td>

              <td>
                <input
                  value={r.metric_code || ''}
                  disabled={!isEditing}
                  onChange={e => updateRateLocal(r.uid, 'metric_code', e.target.value)}
                />
              </td>

              <td>
                <input
                  type="number"
                  value={r.from_quantity ?? ''}
                  disabled={!isEditing}
                  onChange={e => updateRateLocal(r.uid, 'from_quantity', e.target.value)}
                />
              </td>

              <td>
                <input
                  type="number"
                  value={r.to_quantity ?? ''}
                  disabled={!isEditing}
                  onChange={e => updateRateLocal(r.uid, 'to_quantity', e.target.value)}
                  placeholder="No limit"
                />
              </td>

              <td>
                <input
                  type="number"
                  step="0.01"
                  value={r.unit_price ?? ''}
                  disabled={!isEditing}
                  onChange={e => updateRateLocal(r.uid, 'unit_price', e.target.value)}
                />
              </td>

              <td>
                <input
                  type="checkbox"
                  checked={Boolean(r.is_active)}
                  disabled={!isEditing}
                  onChange={e => updateRateLocal(r.uid, 'is_active', e.target.checked)}
                />
              </td>

              <td>
                {!isEditing && (
                  <div className="row">
                    <button disabled={anotherRateIsEditing} onClick={() => startEditRate(r)}>
                      Edit
                    </button>
                    <button disabled={anotherRateIsEditing} onClick={() => deleteRate(r)}>
                      Delete
                    </button>
                  </div>
                )}

                {isEditing && (
                  <div className="row">
                    <button className="primary" onClick={() => saveRate(r)}>Save</button>
                    <button onClick={cancelEditRate}>Cancel</button>
                  </div>
                )}
              </td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </section>;
}

function App() {
  const [loggedIn, setLoggedIn] = useState(Boolean(getToken()));
  return loggedIn ? <MainPage onLogout={() => setLoggedIn(false)} /> : <Login onLogin={() => setLoggedIn(true)} />;
}

createRoot(document.getElementById('root')).render(<App />);
