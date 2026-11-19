'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import type { ContentData } from '../../lib/participation';
import { PageHeader, Status, Loading, ErrorMessage, Button, Pagination, request } from './ui';
import ContentEditor from './content-editor';
type Event = { id: string; title: string; data: ContentData | null; draft_status: string };
type Detail = {
  id: string;
  title: string;
  draft: ContentData | null;
  published: ContentData | null;
  version: number;
  review_status: string;
  evidence: string;
  total: number;
  participants: { email: string; name: string; status: string; source_record: string }[];
};
export default function Organizer({ id }: { id?: string }) {
  const params = useSearchParams(),
    router = useRouter();
  const tab = params.get('tab') || 'participants',
    page = Math.max(1, Number(params.get('page')) || 1),
    query = params.get('search') || '';
  const [events, setEvents] = useState<Event[] | null>(null),
    [detail, setDetail] = useState<Detail | null>(null),
    [search, setSearch] = useState(query),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  async function load() {
    setError('');
    try {
      const url =
        '/api/workspace/events' +
        (id ? '?id=' + id + '&page=' + page + '&search=' + encodeURIComponent(query) : '');
      if (id) setDetail(await request(url));
      else setEvents((await request<{ events: Event[] }>(url)).events);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [id, page, query]);
  function navigate(patch: Record<string, string>) {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) v ? q.set(k, v) : q.delete(k);
    router.push('/organizer/events/' + id + '?' + q);
  }
  return (
    <main id="main">
      <ErrorMessage error={error} retry={load} />
      {notice && (
        <p role="status" className="member-notice">
          {notice}
        </p>
      )}
      {!id ? (
        <>
          <PageHeader title="My events" description="Registrations and drafts for your assigned events." />
          {!events && !error ? (
            <Loading />
          ) : events?.length ? (
            <div className="detail-grid">
              {events.map((e) => (
                <Link key={e.id} className="panel panel-body" href={'/organizer/events/' + e.id}>
                  <h2>{e.title}</h2>
                  <p>{e.data?.city || 'Private event draft'}</p>
                  <Status>{e.draft_status.replaceAll('_', ' ')}</Status>
                  <p className="text-link">Open event ↗</p>
                </Link>
              ))}
            </div>
          ) : (
            events && (
              <div className="panel empty">No events assigned. Ask an admin to assign your event.</div>
            )
          )}
        </>
      ) : !detail && !error ? (
        <Loading />
      ) : (
        detail && (
          <>
            <Link className="text-link" href="/organizer/events">
              ← My events
            </Link>
            <PageHeader title={detail.title} description={detail.published?.venue || detail.draft?.venue}>
              <Status tone={detail.review_status === 'submitted' ? 'amber' : ''}>
                {detail.review_status === 'submitted'
                  ? 'Awaiting admin review'
                  : detail.published
                    ? 'Published event'
                    : 'Private draft'}
              </Status>
            </PageHeader>
            <nav className="event-links" aria-label="Event sections">
              {['overview', 'participants', 'draft'].map((t) => (
                <Link key={t} href={'?tab=' + t} aria-current={tab === t ? 'page' : undefined}>
                  {t[0].toUpperCase() + t.slice(1)}
                </Link>
              ))}
            </nav>
            {tab === 'draft' ? (
              detail.draft ? (
                <ContentEditor
                  key={detail.id + detail.version}
                  initial={detail.draft}
                  evidence={detail.evidence}
                  eventId={id}
                  organizer
                  onSave={async (data, evidence, _slug, submit) => {
                    await request('/api/workspace/event-save', {
                      id,
                      version: detail.version,
                      data,
                      evidence,
                      submit,
                    });
                    setNotice(
                      submit
                        ? 'Submitted for admin review. Published event stays unchanged.'
                        : 'Draft saved.',
                    );
                    await load();
                  }}
                />
              ) : (
                <p>An admin must create event content before you can prepare a draft.</p>
              )
            ) : tab === 'overview' ? (
              <section className="panel panel-body">
                <h2>Event details</h2>
                <p>{detail.published?.description || detail.draft?.description}</p>
                <p>
                  {detail.published?.starts_at
                    ? new Date(detail.published.starts_at).toLocaleString()
                    : 'Date to be confirmed'}
                </p>
                <p>{detail.published?.timezone || detail.draft?.timezone}</p>
                <p>
                  Organizers prepare drafts. Admins approve publication and manage membership, rewards and
                  messaging.
                </p>
                <Link className="btn" href="?tab=draft">
                  Prepare event update
                </Link>
              </section>
            ) : (
              <>
                <div className="between">
                  <h2>
                    Participants <Status>{detail.total}</Status>
                  </h2>
                </div>
                <p>Registration is not proof of attendance.</p>
                <form
                  className="toolbar"
                  onSubmit={(e) => {
                    e.preventDefault();
                    navigate({ search, page: '1' });
                  }}
                >
                  <label className="search">
                    <span className="sr-only">Search name or email</span>
                    <input
                      type="search"
                      placeholder="Search name or email…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <Button variant="outline">Search</Button>
                </form>
                <section className="panel">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Participant</th>
                        <th>Email</th>
                        <th>Registration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.participants.map((p) => (
                        <tr key={p.email + p.source_record}>
                          <td data-label="Participant">{p.name || 'Name not provided'}</td>
                          <td data-label="Email">{p.email}</td>
                          <td data-label="Registration">
                            <Status>{p.status}</Status>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!detail.participants.length && (
                    <div className="empty">
                      No matching mapped registrations. An admin can review imports and event mappings.
                    </div>
                  )}
                  <Pagination
                    page={page}
                    total={detail.total}
                    onPage={(p) => navigate({ page: String(p) })}
                  />
                </section>
                <p className="fineprint">
                  Only this event’s registrations are visible. Admins manage membership and rewards.
                </p>
              </>
            )}
          </>
        )
      )}
    </main>
  );
}
