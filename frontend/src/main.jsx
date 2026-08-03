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

const TABLE_HEADER_LABELS = {
  org_code: 'Organisation',
  org_full_name: 'Organisation Name',
  shipment_count: 'Shipments',
  order_count: 'Orders',
  booking_count: 'Bookings',
  year_month: 'Period',
  organization_usage_total: 'Organisation Usage Total',
  shipments_read_total: 'Shipments Data Total',
  difference: 'Difference',
  severity: 'Severity',
  unique_consign_ref: 'Shipment Number',
  date_created: 'Shipment Created Date',
  transport_mode: 'Transport Mode',
  resolved_countr: 'Resolved Country Code',
  resolved_country_code: 'Resolved Country Code',
  resolved_country_source: 'Resolved Country Code Source',
  country_code: 'Country Code',
  division: 'Division',
  org_managed_by: 'Organisation Managed By',
  charge_plan_code: 'Charge Plan',
  quantity: 'Number of Shipments',
  unit_price: 'Cost per Shipment',
  total_cost: 'Total Cost',
  currency_code: 'Currency',
  source: 'Source'
};

function formatTableValue(header, value) {
  if (value == null) return '';

  if (header === 'date_created') {
    const minutePrecision = String(value).match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
    if (minutePrecision) return minutePrecision[1];
  }

  return String(value);
}

function Table({ rows, view }) {
  if (!rows || rows.length === 0) return <p className="muted">No rows to show.</p>;
  const hiddenHeaders = view === 'exceptions'
    ? new Set(['get_shipment_data', 'message', 'is_resolved'])
    : new Set();
  const headers = Object.keys(rows[0]).filter(header => header.toLowerCase() !== 'uid' && !hiddenHeaders.has(header));
  return <div className={`table-wrap data-review-table data-review-table--${view}`}><table><thead><tr>{headers.map(h => <th className={`column-${h}`} key={h}>{TABLE_HEADER_LABELS[h] || h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{headers.map(h => <td className={`column-${h}`} key={h}>{formatTableValue(h, r[h])}</td>)}</tr>)}</tbody></table></div>;
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

  function formatDateInput(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function setMonthRange(year, month) {
    const firstDate = new Date(year, month, 1);
    const rangeYear = firstDate.getFullYear();
    const rangeMonth = firstDate.getMonth();
    const lastDay = new Date(rangeYear, rangeMonth + 1, 0).getDate();
    setFromDate(formatDateInput(rangeYear, rangeMonth, 1));
    setToDate(formatDateInput(rangeYear, rangeMonth, lastDay));
  }

  function setLastMonth() {
    const now = new Date();
    setMonthRange(now.getFullYear(), now.getMonth() - 1);
  }

  function setThisMonth() {
    const now = new Date();
    setMonthRange(now.getFullYear(), now.getMonth());
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
  async function loadFinalLines() {
    if (!selected) return;
    setTab('final');
    setRows(await apiFetch(`/invoice-process/${selected}/create-final-invoice`, { method: 'POST' }));
  }
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
      <div className="invoice-date-fields">
        <label>From <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></label>
        <label>To <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} /></label>
      </div>
      <div className="invoice-actions"><button onClick={setThisMonth}>This Month</button><button onClick={setLastMonth}>Last Month</button><button className="primary" onClick={start} disabled={loading || !fromDate || !toDate}>{loading ? 'Running...' : 'Collect Data'}</button></div>
      {message && <p className={message.startsWith('Failed') ? 'error' : 'success'}>{message}</p>}
    </section>
    <section className="card">
      <h2>Processes</h2>
      <div className="button-list">{processes.map(p => <button key={p.process_number} className={selected === p.process_number ? 'selected' : ''} onClick={() => { setSelected(p.process_number); loadTab('usage', p.process_number); }}>#{p.process_number} {p.status}</button>)}</div>
    </section>
    <section className="card">
      <h2>Data Review {selected ? `- Process ${selected}` : ''}</h2>
      <div className="tabs"><button onClick={() => loadTab('usage')}>SCM Usage</button><button onClick={() => loadTab('shipments')}>Shipment Data</button><button onClick={() => loadTab('exceptions')}>Warnings</button><button onClick={loadFinalLines}>Final Lines</button><button onClick={downloadExcel}>Download Excel</button></div>
      <Table rows={rows} view={tab} />
    </section>
</>}
{view === 'admin' && <AdminPanel />}
  </div>;
}

function AdminPanel() {
  const [orgs, setOrgs] = useState([]);
  const [rates, setRates] = useState([]);
  const [countryCodeMappings, setCountryCodeMappings] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [adminTab, setAdminTab] = useState('organisations');

  const [editingOrgUid, setEditingOrgUid] = useState(null);
  const [originalOrg, setOriginalOrg] = useState(null);

  const [editingRateUid, setEditingRateUid] = useState(null);
  const [originalRate, setOriginalRate] = useState(null);
  const [editingOriginUid, setEditingOriginUid] = useState(null);
  const [originalOrigin, setOriginalOrigin] = useState(null);

  const [splitOrg, setSplitOrg] = useState(null);
  const [countrySplits, setCountrySplits] = useState([]);
  const [editingSplitUid, setEditingSplitUid] = useState(null);
  const [originalSplit, setOriginalSplit] = useState(null);

  async function load() {
    setOrgs(await apiFetch('/admin/organisations'));
    setRates(await apiFetch('/admin/charge-plan-rates'));
    setCountryCodeMappings(await apiFetch('/admin/country-code-mappings'));
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
        updated.shipment_country_basis = updated.shipment_country_basis || 'ORIGIN';
      }

      if (field === 'get_shipment_data' && value === false) {
        updated.shipment_country_basis = null;
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

  function addRate(chargePlanCode = '') {
    if (editingRateUid !== null) {
      setError('Please save or cancel the current rate before adding another one.');
      return;
    }

    const tempUid = `new-${Date.now()}`;

    const newRate = {
      uid: tempUid,
      charge_plan_code: chargePlanCode,
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

  function addCountryCodeMapping() {
    if (editingOriginUid !== null) return setError('Please save or cancel the current country code mapping first.');
    const uid = `new-origin-${Date.now()}`;
    const row = { uid, location_name: '', country_code: '', isNew: true };
    setCountryCodeMappings([...countryCodeMappings, row]);
    setEditingOriginUid(uid);
    setOriginalOrigin({ ...row });
    setError(''); setMessage('');
  }

  function startEditOrigin(row) {
    setEditingOriginUid(row.uid);
    setOriginalOrigin({ ...row });
    setError(''); setMessage('');
  }

  function updateOriginLocal(uid, field, value) {
    setCountryCodeMappings(countryCodeMappings.map(row => row.uid === uid ? { ...row, [field]: value } : row));
  }

  function cancelEditOrigin() {
    if (originalOrigin?.isNew) {
      setCountryCodeMappings(countryCodeMappings.filter(row => row.uid !== originalOrigin.uid));
    } else if (originalOrigin) {
      setCountryCodeMappings(countryCodeMappings.map(row => row.uid === originalOrigin.uid ? originalOrigin : row));
    }
    setEditingOriginUid(null); setOriginalOrigin(null);
  }

  async function saveCountryCodeMapping(row) {
    if (!row.location_name.trim() || !row.country_code.trim()) return setError('Location and Country Code are required.');
    const payload = { location_name: row.location_name.trim(), country_code: row.country_code.trim().toUpperCase() };
    try {
      await apiFetch(row.isNew ? '/admin/country-code-mappings' : `/admin/country-code-mappings/${row.uid}`, {
        method: row.isNew ? 'POST' : 'PUT', body: JSON.stringify(payload)
      });
      setEditingOriginUid(null); setOriginalOrigin(null);
      setMessage(`Saved country code mapping for ${payload.location_name}`);
      await load();
    } catch (e) { setError(e.message); }
  }

  async function deleteCountryCodeMapping(row) {
    if (!window.confirm(`Delete country code mapping for ${row.location_name}?`)) return;
    try {
      await apiFetch(`/admin/country-code-mappings/${row.uid}`, { method: 'DELETE' });
      setMessage(`Deleted country code mapping for ${row.location_name}`);
      await load();
    } catch (e) { setError(e.message); }
  }

  const filteredOrgs = orgs.filter(o => {
    const text = `${o.org_code || ''} ${o.org_full_name || ''} ${o.country_code || ''}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });
  const availableChargePlans = [...new Set(rates
    .filter(rate => Boolean(rate.is_active) && rate.charge_plan_code)
    .map(rate => rate.charge_plan_code))].sort();
  const chargeRateGroups = Object.values(rates.reduce((groups, rate) => {
    const key = rate.charge_plan_code || `new-${rate.uid}`;
    if (!groups[key]) groups[key] = { chargePlanCode: rate.charge_plan_code, rates: [] };
    groups[key].rates.push(rate);
    return groups;
  }, {}));

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
      <button
        className={adminTab === 'origins' ? 'selected' : ''}
        onClick={() => setAdminTab('origins')}
      >
        Country Code Mappings
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
              <th><span>OrgCode</span></th>
              <th><span>Name</span></th>
              <th><span>Country</span></th>
              <th><span>Division</span></th>
              <th><span>Org Managed By</span></th>
              <th><span>Get Shipment Data</span></th>
              <th><span>Billing Country</span></th>
              <th><span>Country Multi</span></th>
              <th><span>Freight Manager</span></th>
              <th><span>Excluded</span></th>
              <th><span>Charge Plan</span></th>
              <th className="org-actions"><span>Action</span></th>
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
    value={o.division || ''}
    disabled={!isEditing}
    onChange={e => updateOrgLocal(o.uid, 'division', e.target.value)}
    placeholder="Division"
  />
</td>

<td>
  <input
    value={o.org_managed_by || ''}
    disabled={!isEditing}
    onChange={e => updateOrgLocal(o.uid, 'org_managed_by', e.target.value)}
    placeholder="Org Managed By"
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
                  <select
                    value={o.shipment_country_basis || ''}
                    disabled={!isEditing || !Boolean(o.get_shipment_data)}
                    onChange={e => updateOrgLocal(o.uid, 'shipment_country_basis', e.target.value)}
                  >
                    {!o.get_shipment_data && <option value="">Not applicable</option>}
                    <option value="ORIGIN">Origin</option>
                    <option value="DESTINATION">Destination</option>
                  </select>
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
                  <select
                    value={o.charge_plan_code || ''}
                    disabled={!isEditing}
                    onChange={e => updateOrgLocal(o.uid, 'charge_plan_code', e.target.value)}
                  >
                    <option value="">Select a plan</option>
                    {o.charge_plan_code && !availableChargePlans.includes(o.charge_plan_code) && (
                      <option value={o.charge_plan_code}>{o.charge_plan_code} (no active rates)</option>
                    )}
                    {availableChargePlans.map(plan => <option value={plan} key={plan}>{plan}</option>)}
                  </select>
                </td>

                <td className="org-actions">
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

      <p className="muted">Create one Charge Plan, then add its quantity tiers. Each tier charges only the shipments within that range; Cost per Shipment is the blended average.</p>

      <button onClick={() => addRate()}>Add Charge Plan</button>

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
            {chargeRateGroups.flatMap(group => group.rates.map((r, tierIndex) => {
              const isEditing = editingRateUid === r.uid;
              const anotherRateIsEditing = editingRateUid !== null && editingRateUid !== r.uid;

              return <tr key={r.uid}>
                {tierIndex === 0 && <td rowSpan={group.rates.length} className="charge-plan-group">
                  {r.isNew
                    ? <input
                        value={r.charge_plan_code || ''}
                        disabled={!isEditing}
                        onChange={e => updateRateLocal(r.uid, 'charge_plan_code', e.target.value)}
                        placeholder="Plan name"
                      />
                    : <><strong>{group.chargePlanCode}</strong><button disabled={editingRateUid !== null} onClick={() => addRate(group.chargePlanCode)}>Add Tier</button></>}
                </td>}

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
            }))}
          </tbody>
        </table>
      </div>
    </>}

    {adminTab === 'origins' && <>
      <h3>Country Code Mappings</h3>
      <p className="muted">Maps a shipment location or place name to a country code. Used for the Origin/OriginPort and Destination fallbacks.</p>
      <button onClick={addCountryCodeMapping}>Add Mapping</button>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Location</th><th>Country Code</th><th>Action</th></tr></thead>
          <tbody>{countryCodeMappings.map(row => {
            const isEditing = editingOriginUid === row.uid;
            const anotherIsEditing = editingOriginUid !== null && !isEditing;
            return <tr key={row.uid}>
              <td><input value={row.location_name || ''} disabled={!isEditing} onChange={e => updateOriginLocal(row.uid, 'location_name', e.target.value)} placeholder="City or place name" /></td>
              <td><input value={row.country_code || ''} disabled={!isEditing} onChange={e => updateOriginLocal(row.uid, 'country_code', e.target.value)} placeholder="GB" /></td>
              <td>{isEditing
                ? <div className="row"><button className="primary" onClick={() => saveCountryCodeMapping(row)}>Save</button><button onClick={cancelEditOrigin}>Cancel</button></div>
                : <div className="row"><button disabled={anotherIsEditing} onClick={() => startEditOrigin(row)}>Edit</button><button disabled={anotherIsEditing} onClick={() => deleteCountryCodeMapping(row)}>Delete</button></div>}
              </td>
            </tr>;
          })}</tbody>
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

  useEffect(() => {
    function handleExpiredToken() {
      setLoggedIn(false);
    }

    window.addEventListener('auth:expired', handleExpiredToken);
    return () => window.removeEventListener('auth:expired', handleExpiredToken);
  }, []);

  return loggedIn ? <MainPage onLogout={() => setLoggedIn(false)} /> : <Login onLogin={() => setLoggedIn(true)} />;
}

createRoot(document.getElementById('root')).render(<App />);
