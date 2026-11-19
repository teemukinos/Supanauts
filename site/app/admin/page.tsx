'use client';

import {useEffect, useState} from 'react';
type Applicant = {id: string; email: string; name: string; reason: string; created_at: string};

export default function JoinRequests() {
  const [requests, setRequests] = useState<Applicant[] | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  async function load() {
    setError('');
    try {
      const response = await fetch('/api/admin/requests', {cache: 'no-store'});
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Could not load join requests.');
      setRequests(data.requests);
    } catch (e) {setError((e as Error).message); setRequests(null);}
  }
  useEffect(() => {void load();}, []);
  async function review(id: string, decision: string) {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/requests', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, decision, note: notes[id] ?? ''})});
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Could not save this decision.');
      await load();
    } catch (e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  return <main id="main" className="public-page account-content">
    <h1>Join requests</h1><p>Review people applying to join. Event registrants already have access.</p>
    {error && <div className="member-error" role="alert"><p>{error}</p><a className="outline" href="/admin">Check access and retry</a></div>}
    {!requests && !error && <p role="status">Loading join requests…</p>}
    {requests && <><p className="fineprint">Approving membership grants sign-in access. Reward eligibility is managed separately in Members & codes.</p>
      {!requests.length ? <section className="channel-card"><h2>No pending requests</h2><p>New applications will appear here.</p><a className="outline" href="/admin/members">View members & codes</a></section>
      : requests.map(person => <article className="channel-card" key={person.id}>
        <h2>{person.name}</h2><p>{person.email}</p><p>{person.reason}</p>
        <p className="fineprint">Applied {new Date(person.created_at).toLocaleDateString()}</p>
        <label htmlFor={'note-' + person.id}>Private decision note</label><textarea id={'note-' + person.id} rows={2} maxLength={1000} value={notes[person.id] ?? ''} onChange={e => setNotes({...notes, [person.id]: e.target.value})}/>
        <div className="actions"><button className="primary" disabled={busy} onClick={() => review(person.id, 'approved')}>Approve membership</button><button className="outline" disabled={busy} onClick={() => review(person.id, 'rejected')}>Decline request</button></div>
      </article>)}
    </>}
  </main>;
}
