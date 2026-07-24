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
  const [adminTab, setAdminTab] = useState('organisations');

  const [editingOrgUid, setEditingOrgUid] = useState(null);
  const [originalOrg, setOriginalOrg] = useState(null);

  const [editingRateUid, setEditingRateUid] = useState(null);
  const [originalRate, setOriginalRate] = useState(null);

  const [splitOrg, setSplitOrg] = useState(null);
  const [countrySplits, setCountrySplits] = useState([]);
  const [editingSplitUid, setEditingSplitUid] = useState(null);
  const [originalSplit, setOriginalSplit] = useState(null);

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
    setOrgs(orgs.map(o => {
      if (o.uid !== uid) return o;

      const updated = { ...o, [field]: value };

      if (field === 'get_shipment_data' && value === true) {
        updated.country_multi = false;
      }

      return updated;
    }));
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

  async function openCountrySplit(org) {
    setSplitOrg(org);
    setEditingSplitUid(null);
    setOriginalSplit(null);
    setError('');
    setMessage('');

    try {
      const rows = await apiFetch(`/admin/country-splits/${org.org_code}`);
      setCountrySplits(rows);
    } catch (e) {
      setError(e.message);
    }
  }

  function closeCountrySplit() {
    setSplitOrg(null);
    setCountrySplits([]);
    setEditingSplitUid(null);
    setOriginalSplit(null);
  }

  function startEditSplit(split) {
    setEditingSplitUid(split.uid);
    setOriginalSplit({ ...split });
    setError('');
    setMessage('');
  }

  function cancelEditSplit() {
    if (originalSplit && originalSplit.isNew) {
      setCountrySplits(countrySplits.filter(s => s.uid !== originalSplit.uid));
    } else if (originalSplit) {
      setCountrySplits(countrySplits.map(s => s.uid === originalSplit.uid ? originalSplit : s));
    }

    setEditingSplitUid(null);
    setOriginalSplit(null);
  }

  function updateSplitLocal(uid, field, value) {
    setCountrySplits(countrySplits.map(s => s.uid === uid ? { ...s, [field]: value } : s));
  }

  function addCountrySplitRow() {
    if (!splitOrg) return;

    if (editingSplitUid !== null) {
      setError('Please save or cancel the current split row before adding another one.');
      return;
    }

    const tempUid = `new-${Date.now()}`;

    const newSplit = {
      uid: tempUid,
      org_code: splitOrg.org_code,
      country_code: '',
      percentage: '',
      is_active: true,
      isNew: true
    };

    setCountrySplits([...countrySplits, newSplit]);
    setEditingSplitUid(tempUid);
    setOriginalSplit({ ...newSplit });
  }

  async function saveCountrySplit(split) {
    setError('');
    setMessage('');

    if (!split.country_code || split.percentage === '') {
      setError('Country Code and Percentage are required.');
      return;
    }

    const payload = {
      org_code: splitOrg.org_code,
      country_code: split.country_code.toUpperCase(),
      percentage: Number(split.percentage),
      is_active: Boolean(split.is_active)
    };

    try {
      if (split.isNew) {
        await apiFetch('/admin/country-splits', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        setMessage(`Added country split for ${splitOrg.org_code}`);
      } else {
        await apiFetch(`/admin/country-splits/${split.uid}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });

        setMessage(`Saved country split for ${splitOrg.org_code}`);
      }

      const rows = await apiFetch(`/admin/country-splits/${splitOrg.org_code}`);
      setCountrySplits(rows);
      setEditingSplitUid(null);
      setOriginalSplit(null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteCountrySplit(split) {
    if (split.isNew) {
      setCountrySplits(countrySplits.filter(s => s.uid !== split.uid));
      setEditingSplitUid(null);
      setOriginalSplit(null);
      return;
    }

    const confirmed = window.confirm(`Delete ${split.country_code} split for ${splitOrg.org_code}?`);
    if (!confirmed) return;

    try {
      await apiFetch(`/admin/country-splits/${split.uid}`, {
        method: 'DELETE'
      });

      const rows = await apiFetch(`/admin/country-splits/${splitOrg.org_code}`);
      setCountrySplits(rows);
      setMessage(`Deleted country split for ${splitOrg.org_code}`);
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

  const splitTotal = countrySplits
    .filter(s => Boolean(s.is_active))
    .reduce((total, s) => total + Number(s.percentage || 0), 0);

  return <section className="card">
    <h2>Admin Settings</h2>

    <div className="tabs">
      <button
        className={adminTab === 'organisations' ? 'selected' : ''}
        onClick={() => setAdminTab('organisations')}
      >
        Organisations
      </button>

      <button
        className={adminTab === 'rates' ? 'selected' : ''}
        onClick={() => setAdminTab('rates')}
      >
        Charge Rates
      </button>
    </div>

    {error && <p className="error">{error}</p>}
    {message && <p className="success">{message}</p>}

    {adminTab === 'organisations' && <>
      <h3>Organisations</h3>

      <div className="admin-search-row">
        <label>Search</label>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search org code, name, or country"
        />
      </div>

      <div className="table-wrap org-table">
        <table>
          <thead>
            <tr>
              <th>OrgCode</th>
              <th>Name</th>
              <th>Country</th>
              <th>Get Shipment Data</th>
              <th>Country Multi</th>
              <th>Freight Manager</th>
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
                    checked={Boolean(o.country_multi)}
                    disabled={!isEditing || Boolean(o.get_shipment_data)}
                    onChange={e => updateOrgLocal(o.uid, 'country_multi', e.target.checked)}
                  />
                </td>

                <td>
                  <input
                    type="checkbox"
                    checked={Boolean(o.is_freight_manager)}
                    disabled
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
  <div className="row">
    <button disabled={anotherRowIsEditing} onClick={() => startEditOrg(o)}>
      Edit
    </button>

    {Boolean(o.country_multi) && (
      <button onClick={() => openCountrySplit(o)}>
        Country Split
      </button>
    )}
  </div>
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
    </>}

    {adminTab === 'rates' && <>
      <h3>Charge Rates</h3>

      <button onClick={addRate}>Add Rate</button>

      <div className="table-wrap charge-rates-table">
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
    </>}

    {splitOrg && (
      <div className="modal-backdrop">
        <div className="modal-card">
          <h3>Country Split - {splitOrg.org_code}</h3>
          <p className="muted">{splitOrg.org_full_name}</p>

          <div className="row">
            <button onClick={addCountrySplitRow}>Add Row</button>
            <button onClick={closeCountrySplit}>Close</button>
          </div>

          <p className={splitTotal === 100 ? 'success' : 'error'}>
            Total active split: {splitTotal}%
          </p>

          {splitOrg.get_shipment_data && (
            <p className="error">
              Get Shipment Data is enabled for this organisation. Country split will not be used for final invoice calculation.
            </p>
          )}

          {!splitOrg.country_multi && (
            <p className="error">
              Country Multi is not enabled for this organisation. Enable Country Multi on the organisation row to use these splits.
            </p>
          )}

          <div className="table-wrap country-split-table">
            <table>
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Percentage</th>
                  <th>Active</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {countrySplits.map(s => {
                  const isEditing = editingSplitUid === s.uid;
                  const anotherSplitIsEditing = editingSplitUid !== null && editingSplitUid !== s.uid;

                  return <tr key={s.uid}>
                    <td>
                      <input
                        value={s.country_code || ''}
                        disabled={!isEditing}
                        onChange={e => updateSplitLocal(s.uid, 'country_code', e.target.value)}
                        placeholder="FR / DE / GB"
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={s.percentage ?? ''}
                        disabled={!isEditing}
                        onChange={e => updateSplitLocal(s.uid, 'percentage', e.target.value)}
                      />
                    </td>

                    <td>
                      <input
                        type="checkbox"
                        checked={Boolean(s.is_active)}
                        disabled={!isEditing}
                        onChange={e => updateSplitLocal(s.uid, 'is_active', e.target.checked)}
                      />
                    </td>

                    <td>
                      {!isEditing && (
                        <div className="row">
                          <button disabled={anotherSplitIsEditing} onClick={() => startEditSplit(s)}>
                            Edit
                          </button>
                          <button disabled={anotherSplitIsEditing} onClick={() => deleteCountrySplit(s)}>
                            Delete
                          </button>
                        </div>
                      )}

                      {isEditing && (
                        <div className="row">
                          <button className="primary" onClick={() => saveCountrySplit(s)}>Save</button>
                          <button onClick={cancelEditSplit}>Cancel</button>
                        </div>
                      )}
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )}
  </section>;
}

function App() {
  const [loggedIn, setLoggedIn] = useState(Boolean(getToken()));
  return loggedIn ? <MainPage onLogout={() => setLoggedIn(false)} /> : <Login onLogin={() => setLoggedIn(true)} />;
}

createRoot(document.getElementById('root')).render(<App />);
