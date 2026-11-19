'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageHeader, Loading, ErrorMessage, Status, Button, request } from './ui';
type Home = {
  projects: {
    id: string;
    slug: string;
    published_revision: string | null;
    revisions: { id: string; status: string; feedback: string; payload: { title: string } }[];
  }[];
  registrations: { event: string; status: string }[];
};
export default function MemberList({ kind }: { kind: 'events' | 'projects' }) {
  const [home, setHome] = useState<Home | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState('');
  async function load() {
    setError('');
    try {
      setHome(await request<Home>('/api/community/home'));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <main id="main">
      <PageHeader
        title={kind === 'events' ? 'My events' : 'My projects'}
        description={
          kind === 'events'
            ? 'Your registration records. Registration does not confirm attendance.'
            : 'Save a draft, share your progress and follow review decisions.'
        }
      >
        {kind === 'projects' && (
          <Link className="btn primary" href="/member/projects/new">
            New project
          </Link>
        )}
      </PageHeader>
      <ErrorMessage error={error} retry={load} />
      {!home && !error ? (
        <Loading />
      ) : home && kind === 'events' ? (
        <section className="panel">
          {home.registrations.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Registration</th>
                </tr>
              </thead>
              <tbody>
                {home.registrations.map((r, i) => (
                  <tr key={r.event + i}>
                    <td data-label="Event">{r.event}</td>
                    <td data-label="Registration">
                      <Status>{r.status}</Status>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">
              No registration records yet.{' '}
              <Link href="/events" className="text-link">
                Browse community events
              </Link>
            </div>
          )}
        </section>
      ) : (
        home && (
          <>
            {!home.projects.length && (
              <div className="panel empty">
                <h2>Share what you’re building</h2>
                <p>Work in progress is welcome. Your draft stays private until approved.</p>
                <Link className="btn primary" href="/member/projects/new">
                  Start a project
                </Link>
              </div>
            )}
            {home.projects.map((p) => (
              <article className="panel panel-body space-top" key={p.id}>
                <div className="between">
                  <h2>{p.revisions[0]?.payload.title || 'Untitled project'}</h2>
                  <Status>{p.revisions[0]?.status.replaceAll('_', ' ')}</Status>
                </div>
                {p.revisions[0]?.feedback && <p>Review feedback: {p.revisions[0].feedback}</p>}
                <div className="actions">
                  <Link className="btn" href={'/member/projects/new?id=' + p.id}>
                    Edit draft
                  </Link>
                  {p.published_revision && (
                    <Link className="btn" href={'/projects/' + p.slug}>
                      View published version
                    </Link>
                  )}
                  <Button
                    variant="outline"
                    disabled={busy === p.id}
                    onClick={async () => {
                      if (!confirm('Withdraw this project and its public share assets?')) return;
                      setBusy(p.id);
                      try {
                        await request('/api/community/withdraw', { id: p.id });
                        await load();
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy('');
                      }
                    }}
                  >
                    Withdraw
                  </Button>
                </div>
              </article>
            ))}
          </>
        )
      )}
    </main>
  );
}
