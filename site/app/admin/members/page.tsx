'use client';

import {useEffect, useRef, useState, type FormEvent} from 'react';
import type {Eligibility, EligibilityMode, MemberDetail, RegistryFilters, RegistryResult} from '../../../lib/member-registry';
import './registry.css';

const defaults: RegistryFilters = {search: '', event: '', status: 'all', family: '', assignment: 'all', page: 1, view: 'members'};
class RegistryError extends Error { constructor(message: string, readonly status: number) {super(message);} }
const date = (value: string) => new Date(value).toLocaleString();
function auditState(value: Record<string, unknown> | null | undefined): string {
  if (!value) return 'No record';
  if (typeof value.active === 'boolean') return value.active ? 'Active' : 'Suspended';
  if (typeof value.mode === 'string') return value.mode.charAt(0).toUpperCase() + value.mode.slice(1);
  return 'Recorded';
}
async function read<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {cache: 'no-store', ...init});
  const data = await response.json();
  if (!response.ok) throw new RegistryError(data.error || 'Could not load the registry.', response.status);
  return data;
}
const message = (error: unknown) => error instanceof Error ? error.message : 'Please retry.';

export default function Registry() {
  const [draft, setDraft] = useState(defaults), [filters, setFilters] = useState(defaults);
  const [result, setResult] = useState<RegistryResult | null>(null), [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(''), [member, setMember] = useState<MemberDetail | null>(null);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0), [createOpen, setCreateOpen] = useState(false);
  const [address, setAddress] = useState(''), [name, setName] = useState(''), [reason, setReason] = useState('');
  const detailHeading = useRef<HTMLHeadingElement>(null), createHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const query = new URLSearchParams(Object.entries(filters).map(([key, value]) => [key, String(value)]));
    read<RegistryResult>('/api/admin/members?' + query, {signal: controller.signal})
      .then(setResult).catch(e => { if (!controller.signal.aborted) { setError(message(e)); setResult(null); setMember(null); setSelected(''); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, revision]);
  useEffect(() => {
    setMember(null);
    if (!selected) return;
    const controller = new AbortController();
    read<MemberDetail>('/api/admin/members/' + selected, {signal: controller.signal})
      .then(setMember).catch(e => { if (!controller.signal.aborted) {setError(message(e)); if (e instanceof RegistryError && [401,403].includes(e.status)) {setResult(null); setSelected('');}} });
    return () => controller.abort();
  }, [selected, revision]);
  useEffect(() => { if (member) detailHeading.current?.focus(); }, [member]);
  useEffect(() => { if (createOpen) createHeading.current?.focus(); }, [createOpen]);

  async function mutate<T>(url: string, method: string, data: object): Promise<T | null> {
    setBusy(true); setError(''); setNotice('');
    try { return await read<T>(url, {method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)}); }
    catch (e) { setError(message(e)); setMember(null); if (e instanceof RegistryError && [401,403].includes(e.status)) {setResult(null); setSelected('');} return null; }
    finally { setBusy(false); }
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    const saved = await mutate<{id: string; existing: boolean}>('/api/admin/members', 'POST', {email: address, name, reason});
    if (!saved) return;
    setNotice(saved.existing ? 'Existing member opened. Access and eligibility are unchanged.' : 'Member added. No new reward was assigned.');
    setAddress(''); setName(''); setReason(''); setCreateOpen(false); setSelected(saved.id); setRevision(r => r + 1);
  }
  async function access(next: boolean, reason: string) {
    if (!member) return false;
    const saved = await mutate('/api/admin/members/' + member.id, 'PATCH', {active: next, reason});
    if (!saved) return false;
    setNotice(next ? 'Access restored. Existing assignments are unchanged.' : 'Access suspended. Existing codes stay assigned.');
    setRevision(r => r + 1); return true;
  }
  async function eligibility(family: string, mode: EligibilityMode, reason: string) {
    if (!member) return false;
    const saved = await mutate('/api/admin/members/' + member.id + '/eligibility', 'PUT', {family, mode, reason});
    if (!saved) return false;
    setNotice('Eligibility saved. Existing assignments are unchanged.'); setRevision(r => r + 1); return true;
  }
  function switchView(view: RegistryFilters['view']) {
    const next = {...defaults, view}; setDraft(next); setFilters(next); setSelected(''); setMember(null);
  }
  function add(email = '') { setAddress(email); setName(''); setReason(''); setCreateOpen(true); }

  return <main id="main" className="public-page registry">
    <h1>Members & codes</h1>
    <p>Find a participant and open their record to see exactly which codes they received.</p>
    <p className="fineprint">Private to organizers. Participants can only see their own codes.</p>
    {error && <div role="alert" className="member-error"><p>{error}</p>{!result && <a className="outline" href="/admin/members">Check access and retry</a>}</div>}
    {notice && <p role="status" className="member-notice">{notice}</p>}
    {result && !selected && <><div className="actions registry-toolbar" role="group" aria-label="Registry views">
      <button className={filters.view === 'members' && filters.assignment === 'all' ? 'primary' : 'outline'} aria-pressed={filters.view === 'members' && filters.assignment === 'all'} disabled={busy} onClick={() => switchView('members')}>All participants</button>
      <button className={filters.view === 'members' && filters.assignment === 'assigned' ? 'primary' : 'outline'} aria-pressed={filters.view === 'members' && filters.assignment === 'assigned'} disabled={busy || loading} onClick={() => {const next = {...defaults, assignment: 'assigned' as const}; setDraft(next); setFilters(next);}}>Participants with codes</button>
      <button className={filters.view === 'reservations' ? 'primary' : 'outline'} aria-pressed={filters.view === 'reservations'} disabled={busy} onClick={() => switchView('reservations')}>Reservations without membership</button>
      <button className="outline" disabled={busy || !result} onClick={() => add()}>Add member</button>
      <button className="outline" disabled={busy || loading} onClick={() => setRevision(r => r + 1)}>Refresh</button>
    </div>
    {createOpen && <section className="channel-card registry-create" aria-labelledby="create-heading">
      <h2 id="create-heading" ref={createHeading} tabIndex={-1}>Add approved member</h2>
      <p>This grants sign-in access. It does not grant new codes. An exact email match retrieves any existing reservation.</p>
      <form className="standard-form" onSubmit={create}><fieldset disabled={busy}>
        <label>Email<input type="email" autoComplete="off" required maxLength={254} value={address} onChange={e => setAddress(e.target.value)}/></label>
        <label>Name (optional)<input maxLength={100} value={name} onChange={e => setName(e.target.value)}/></label>
        <label>Reason<textarea required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)}/></label>
        <div className="actions"><button className="primary" disabled={!reason.trim()}>Add approved member</button><button type="button" className="outline" onClick={() => setCreateOpen(false)}>Cancel</button></div>
      </fieldset></form>
    </section>}
    <form className="registry-filters standard-form" onSubmit={e => { e.preventDefault(); setFilters({...draft, page: 1}); setSelected(''); }}>
      <fieldset disabled={busy || loading}>
        <label>{filters.view === 'members' ? 'Search email or name' : 'Search recipient email'}<input type="search" maxLength={254} value={draft.search} onChange={e => setDraft({...draft, search: e.target.value})}/></label>
        <div className="actions"><button className="primary">Apply filters</button><button className="outline" type="button" onClick={() => switchView(filters.view)}>Clear filters</button></div>
        <details className="registry-additional-filters"><summary>More filters: event, access and reward</summary><div className="registry-filter-options">
        {filters.view === 'members' && <>
          <label>Event<select value={draft.event} onChange={e => setDraft({...draft, event: e.target.value})}><option value="">All events</option>{result?.events.map(event => <option key={event}>{event}</option>)}</select></label>
          <label>Access<select value={draft.status} onChange={e => setDraft({...draft, status: e.target.value as RegistryFilters['status']})}><option value="all">All members</option><option value="active">Active</option><option value="suspended">Suspended</option></select></label>
        </>}
        <label>Reward<select value={draft.family} onChange={e => setDraft({...draft, family: e.target.value})}><option value="">All rewards</option>{result?.families.map(f => <option key={f.slug} value={f.slug}>{f.title}</option>)}</select></label>
        {filters.view === 'members' && <label>Assignment<select value={draft.assignment} onChange={e => setDraft({...draft, assignment: e.target.value as RegistryFilters['assignment']})}><option value="all">Any assignment status</option><option value="assigned">Has assigned code</option><option value="unassigned">No assigned code</option></select></label>}
        </div></details>
      </fieldset>
    </form></>}
    {loading && <p role="status">Loading registry…</p>}
    {result && !selected && <section aria-label="Registry results" aria-busy={loading}>
      {result.view === 'reservations' && <p>These recipients have reserved codes but no matching membership. Reservations do not grant access.</p>}
      <p role="status">{result.total} {result.view === 'members' ? (result.total === 1 ? 'member' : 'members') : (result.total === 1 ? 'reservation' : 'reservations')} found. Page {result.page} of {Math.max(1, Math.ceil(result.total / result.page_size))}.</p>
      {!result.items.length ? <p>No matching records.</p> : <div className="registry-table-wrap" tabIndex={0} role="region" aria-label="Scrollable registry results"><table className="registry-table">
        <caption>{result.view === 'members' ? 'Private members' : 'Private unmatched code reservations'}</caption>
        <thead><tr><th scope="col">Email</th>{result.view === 'members' ? <><th scope="col">Name</th><th scope="col">Access</th><th scope="col">Assigned codes</th></> : <><th scope="col">Reward / code</th><th scope="col">Assigned</th><th scope="col">Source</th></>}<th scope="col">Action</th></tr></thead>
        <tbody>{result.view === 'members' ? result.items.map(row => <tr key={row.id}>
          <td data-label="Email">{row.email}</td><td data-label="Name">{row.name || '—'}</td><td data-label="Access">{row.active ? 'Active' : 'Suspended'}</td><td data-label="Assigned codes">{row.assigned_count}</td>
          <td className="registry-row-action"><button className="outline" disabled={busy} aria-label={'View codes & details for ' + row.email} onClick={() => { setError(''); setSelected(row.id); }}>View codes & details</button></td>
        </tr>) : result.items.map(row => <tr key={row.id}>
          <td data-label="Email">{row.email}</td><td data-label="Reward / code"><div>{row.title}<code className="registry-code">{row.code}</code></div></td><td data-label="Assigned">{date(row.assigned_at)}</td><td data-label="Source">{row.source}</td>
          <td className="registry-row-action"><button className="outline" disabled={busy} aria-label={'Add member ' + row.email} onClick={() => add(row.email)}>Add member</button></td>
        </tr>)}</tbody>
      </table></div>}
      <div className="actions registry-pagination"><button className="outline" disabled={busy || result.page <= 1} onClick={() => setFilters({...filters, page: filters.page - 1})}>Previous</button><button className="outline" disabled={busy || result.page * result.page_size >= result.total} onClick={() => setFilters({...filters, page: filters.page + 1})}>Next</button></div>
    </section>}
    {selected && <button className="outline" onClick={() => {setSelected(''); setMember(null); setError('');}}>← Back to participants</button>}
    {selected && !member && !error && <p role="status">Loading member details…</p>}
    {member && <section className="registry-detail channel-card" aria-labelledby="member-heading">
      <h2 id="member-heading" ref={detailHeading} tabIndex={-1}>{member.name || member.email}</h2>
      <p>{member.email} · {member.active ? 'Active' : 'Suspended'}{member.is_admin ? ' · Organizer' : ''}</p>
      <p className="fineprint">Added {date(member.created_at)} · Source: {member.source}</p>
      <h3>Assigned codes</h3><p>Assignment does not confirm redemption. Codes stay assigned permanently.</p>
      {member.assignments.length ? member.assignments.map(a => <article className="member-reward" key={a.inventory_id}><h4>{a.title}</h4><code className="registry-code">{a.code}</code><p>Assigned {date(a.assigned_at)}</p><p className="fineprint">{a.kind === 'legacy' ? 'Legacy reservation' : 'Member claim'} · {a.source}</p></article>) : <p>No codes assigned.</p>}
      <h3>Event registrations</h3><p className="fineprint">Registration status does not confirm attendance.</p>
      {member.registrations.length ? <ul>{member.registrations.map(r => <li key={r.event + '/' + r.source_record}>{r.event} — {r.status} <span className="fineprint">({r.source_record})</span></li>)}</ul> : <p>No registration records.</p>}
      <details className="registry-management"><summary>Manage access & reward eligibility</summary>
      <h3>Account access</h3>
      {member.is_admin ? <p>Organizer accounts cannot be suspended here.</p> : <AccessForm key={member.id + member.active} active={member.active} busy={busy} save={access}/>}
      <h3>Reward eligibility</h3><p>Default keeps registration and entitlement rules. Allow or Block applies only to new claims. Existing assignments stay unchanged.</p>
      {!member.active && <p>Suspended members cannot access rewards, even with Allow selected.</p>}
      {member.eligibility.length ? member.eligibility.map(e => <EligibilityForm key={member.id + '/' + e.family + '/' + e.mode} entry={e} busy={busy} save={eligibility}/>) : <p>No reward families configured.</p>}
      </details>
      <h3>Recent changes</h3>
      {member.audit.length ? <details><summary>View {member.audit.length} recent {member.audit.length === 1 ? 'change' : 'changes'}</summary><ol className="registry-audit">{member.audit.map(a => <li key={a.id}><strong>{a.action.replaceAll('_', ' ')}</strong> · {date(a.created_at)}<p>{a.details.reason || 'No reason recorded.'}</p>{a.details.family && <p>Reward: {a.details.family}</p>}{a.details.before !== undefined && <p>Before: {auditState(a.details.before)} · After: {auditState(a.details.after)}</p>}<p className="fineprint">Actor: {a.actor || 'System'}</p></li>)}</ol></details> : <p>No administrative changes recorded.</p>}
      <p className="fineprint">Most recent 100 changes shown.</p>
    </section>}
  </main>;
}

function AccessForm({active, busy, save}: {active: boolean; busy: boolean; save: (active: boolean, reason: string) => Promise<boolean>}) {
  const [reason, setReason] = useState('');
  return <form className="standard-form" onSubmit={async e => {e.preventDefault(); if (await save(!active, reason)) setReason('');}}><fieldset disabled={busy}>
    <p>{active ? 'Suspending blocks sign-in and private access immediately. It does not release codes.' : 'Restoring access lets this member sign in again with the same email.'}</p>
    <label>Reason for access change<textarea required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)}/></label>
    <button className="outline" disabled={!reason.trim()}>{active ? 'Suspend access' : 'Restore access'}</button>
  </fieldset></form>;
}
function EligibilityForm({entry, busy, save}: {entry: Eligibility; busy: boolean; save: (family: string, mode: EligibilityMode, reason: string) => Promise<boolean>}) {
  const [mode, setMode] = useState(entry.mode), [reason, setReason] = useState('');
  return <form className="standard-form member-reward" onSubmit={async e => {e.preventDefault(); if (await save(entry.family, mode, reason)) setReason('');}}><fieldset disabled={busy}>
    <legend>{entry.title}</legend><p>{entry.eligible ? 'Eligible' : 'Not eligible'} for new claims. {entry.allocation_open ? 'Allocation enabled; stock and offer dates still apply.' : 'Allocation closed.'}</p>
    <label>Eligibility for {entry.title}<select value={mode} onChange={e => setMode(e.target.value as EligibilityMode)}><option value="default">Default</option><option value="allow">Allow</option><option value="block">Block</option></select></label>
    <label>Reason for eligibility change<textarea required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)}/></label>
    <button className="outline" disabled={mode === entry.mode || !reason.trim()}>Save eligibility</button>
  </fieldset></form>;
}
