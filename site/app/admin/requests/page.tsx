'use client';

import { useEffect, useState } from 'react';
import { PageHeader, ErrorMessage, request } from '../../../components/app/ui';
type Applicant = {
  id: string;
  email: string;
  name: string;
  reason: string;
  created_at: string;
};

export default function JoinRequests() {
  const [requests, setRequests] = useState<Applicant[] | null>(null);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  async function load() {
    setError('');
    try {
      const data = await request<{ requests: Applicant[] }>('/api/admin/requests');
      setRequests(data.requests);
    } catch (e) {
      setError((e as Error).message);
      setRequests(null);
    }
  }
  useEffect(() => {
    void load();
    const restore = () => {
      void load();
    };
    window.addEventListener('sessionrestored', restore);
    return () => window.removeEventListener('sessionrestored', restore);
  }, []);
  async function review(id: string, decision: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await request('/api/admin/requests', {
        id,
        decision,
        note: notes[id] ?? '',
      });
      setNotice(
        decision === 'approved'
          ? 'Membership approved. They can now sign in with their email. No reward was assigned.'
          : 'Request declined. No email was sent.',
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="public-page account-content">
      <PageHeader
        title="Join requests"
        description="Review people applying to join. Imported event registrants already have access."
      />
      <ErrorMessage error={error} retry={load} />
      {notice && (
        <p className="member-notice" role="status">
          {notice}
        </p>
      )}
      {!requests && !error && <p role="status">Loading join requests…</p>}
      {requests && (
        <>
          <p className="fineprint">
            Approving membership grants sign-in access. Reward eligibility is managed separately in Members.
          </p>
          {!requests.length ? (
            <section className="channel-card">
              <h2>No pending requests</h2>
              <p>New applications will appear here.</p>
              <a className="outline" href="/admin/members">
                View members
              </a>
            </section>
          ) : (
            requests.map((person) => (
              <article className="channel-card" key={person.id}>
                <h2>{person.name}</h2>
                <p>{person.email}</p>
                <p>{person.reason}</p>
                <p className="fineprint">Applied {new Date(person.created_at).toLocaleDateString()}</p>
                <label htmlFor={'note-' + person.id}>Private decision note</label>
                <textarea
                  id={'note-' + person.id}
                  rows={2}
                  maxLength={1000}
                  value={notes[person.id] ?? ''}
                  onChange={(e) => setNotes({ ...notes, [person.id]: e.target.value })}
                />
                <div className="actions">
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          'Approve membership for ' +
                            person.email +
                            '? This grants sign-in access, not rewards.',
                        )
                      )
                        void review(person.id, 'approved');
                    }}
                  >
                    Approve membership
                  </button>
                  <button
                    className="outline"
                    disabled={busy}
                    onClick={() => {
                      if (confirm('Decline this membership request? No email will be sent.'))
                        void review(person.id, 'rejected');
                    }}
                  >
                    Decline request
                  </button>
                </div>
              </article>
            ))
          )}
        </>
      )}
    </main>
  );
}
