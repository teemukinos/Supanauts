'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { ContentData } from '../../lib/participation';
import { Media } from '../../app/media';
import {
  PageHeader,
  Button,
  Status,
  Loading,
  ErrorMessage,
  CopyCode,
  Pagination,
  Modal,
  request,
  pageNumber,
  useUnsaved,
} from './ui';
import ContentEditor from './content-editor';
import ImportWizard from './import-wizard';
import EventSettings, { type EventSettingsData } from './event-settings';
type Item = {
  id: string;
  slug: string;
  title: string;
  name: string;
  email: string;
  member_id: string | null;
  family: string;
  code: string;
  inventory_id: string;
  assigned_at: string;
  source: string;
  kind: string;
  event_id?: string;
  draft: ContentData;
  published: ContentData | null;
  version: number;
  review_status: string;
  evidence: string;
  status: string;
  created_at: string;
  committed_at: string | null;
  row_count: number;
  payload: ContentData;
  revision_id: string;
  published_revision: string | null;
  subject: string;
  message: string;
  recipient: string;
  attempts: number;
  last_error: string | null;
  provider_id: string | null;
  presentation: Record<string, string>;
  inventory: number;
  assigned: number;
  allocation_open: boolean;
};
type Screen = {
  items: Item[];
  page: number;
  page_size: number;
  total: number;
  dispatch_enabled?: boolean;
} & EventSettingsData;
const titles: Record<string, string> = {
  overview: 'Overview',
  projects: 'Projects',
  events: 'Events',
  updates: 'Updates',
  imports: 'Registration imports',
  codes: 'Code assignments',
  settings: 'Settings',
  shares: 'Share approvals',
  notifications: 'Notifications',
  reports: 'Reports',
  activity: 'Community activity',
  rewards: 'Reward offers',
};
const date = (value?: string | null) => (value ? new Date(value).toLocaleString() : '—');
export default function AdminScreen({ section }: { section: string }) {
  const router = useRouter(),
    path = usePathname(),
    params = useSearchParams();
  const page = pageNumber(params.get('page')),
    search = params.get('search') || '',
    editorId = params.get('id');
  const [content, setContent] = useState<Item | null>(null);
  const [data, setData] = useState<Screen | null>(null),
    [overview, setOverview] = useState<Record<string, number> | null>(null),
    [metrics, setMetrics] = useState<{
      daily: { day: string; name: string; count: number }[];
      submitted_projects: number;
      published_projects: number;
      allocations: number;
      median_review_hours: number | null;
    } | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(''),
    [query, setQuery] = useState(search),
    [feedback, setFeedback] = useState<Record<string, string>>({}),
    [confirmation, setConfirmation] = useState<Item | null>(null),
    [share, setShare] = useState(''),
    [copy, setCopy] = useState(''),
    [approved, setApproved] = useState('');
  const edit = content?.id === editorId ? content : data?.items?.find((x) => x.id === editorId);
  const creating = editorId === 'new';
  function navigate(patch: Record<string, string>) {
    const q = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) value ? q.set(key, value) : q.delete(key);
    router.push(path + (q.size ? '?' + q : ''));
  }
  const loadNumber = useRef(0);
  async function load() {
    const currentLoad = ++loadNumber.current;
    setError('');
    try {
      if (editorId && editorId !== 'new' && ['events', 'updates'].includes(section)) {
        const selected = await request<Item>(
          '/api/workspace/content?id=' +
            encodeURIComponent(editorId) +
            '&kind=' +
            (section === 'events' ? 'event' : 'story'),
        );
        if (currentLoad === loadNumber.current) setContent(selected);
      }
      if (section === 'activity') {
        const result = await request<NonNullable<typeof metrics>>('/api/community/metrics');
        if (currentLoad === loadNumber.current) setMetrics(result);
      } else if (section === 'overview') {
        const result = await request<Record<string, number>>('/api/workspace/admin?section=overview');
        if (currentLoad === loadNumber.current) setOverview(result);
      } else {
        const result = await request<Screen>(
          '/api/workspace/admin?section=' +
            section +
            '&page=' +
            page +
            '&search=' +
            encodeURIComponent(search),
        );
        if (currentLoad === loadNumber.current) setData(result);
      }
    } catch (e) {
      if (currentLoad === loadNumber.current) setError((e as Error).message);
    }
  }
  useEffect(() => {
    setData(null);
    setContent(null);
    setMetrics(null);
    setOverview(null);
    setQuery(search);
    void load();
    return () => {
      loadNumber.current++;
    };
  }, [section, page, search, editorId]);
  useEffect(() => {
    setNotice('');
    setConfirmation(null);
  }, [section]);
  useEffect(() => {
    if (editorId) return;
    const restore = () => {
      void load();
    };
    window.addEventListener('sessionrestored', restore);
    return () => window.removeEventListener('sessionrestored', restore);
  }, [section, page, search, editorId]);
  async function action(name: string, payload: object, message: string) {
    setBusy(name);
    setError('');
    try {
      const result = await request('/api/community/admin', {
        action: name,
        data: payload,
      });
      setNotice(message);
      await load();
      return result;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy('');
    }
  }
  const run = (name: string, payload: object, message: string) =>
    void action(name, payload, message).catch(() => {});
  return (
    <main id="main">
      <PageHeader
        title={
          creating
            ? 'New ' + (section === 'events' ? 'event' : 'update')
            : editorId
              ? 'Edit ' + (section === 'events' ? 'event' : 'update')
              : titles[section] || 'Workspace'
        }
        description={
          section === 'codes'
            ? 'See who has each code. Assignment, email delivery and redemption are separate.'
            : section === 'events'
              ? 'Manage event drafts, publication and organizer access. External calendar listings are managed by their source.'
              : undefined
        }
      >
        {!editorId && ['events', 'updates'].includes(section) && (
          <Button onClick={() => navigate({ id: 'new' })}>
            New {section === 'events' ? 'event' : 'update'}
          </Button>
        )}
      </PageHeader>
      <ErrorMessage error={error} retry={load} />
      {editorId && error && !data && (
        <Link className="btn" href={path}>
          Back to {section}
        </Link>
      )}
      {notice && (
        <p role="status" className="member-notice">
          {notice}
        </p>
      )}
      {!data && !overview && !metrics && !error && <Loading />}
      {overview && (
        <>
          <div className="statline">
            {[
              ['members', 'Members', '/admin/members'],
              ['requests', 'Join requests', '/admin/requests'],
              ['projects', 'Project submissions', '/admin/projects'],
            ].map(([key, title, url]) => (
              <Link className="stat" key={key} href={url}>
                <span>{title}</span>
                <h2>{overview[key]}</h2>
                <small>Open workspace</small>
              </Link>
            ))}
          </div>
          <section className="panel panel-body">
            <h2>Needs attention</h2>
            {[
              ['drafts', 'Event drafts awaiting review', '/admin/events'],
              ['failed_notifications', 'Messages needing attention', '/admin/notifications'],
              ['unmapped', 'Unmapped registration sources', '/admin/settings'],
            ].map(([key, title, url]) => (
              <div className="between panel-body" key={key}>
                <Link className="text-link" href={url}>
                  {title}
                </Link>
                <Status>{overview[key]}</Status>
              </div>
            ))}
          </section>
        </>
      )}
      {metrics && (
        <>
          <div className="statline">
            {[
              ['Submitted projects', metrics.submitted_projects],
              ['Published projects', metrics.published_projects],
              ['Code allocations', metrics.allocations],
            ].map(([label, count]) => (
              <div className="stat" key={label}>
                <span>{label}</span>
                <h2>{count}</h2>
              </div>
            ))}
          </div>
          <p>
            Median review time:{' '}
            {metrics.median_review_hours === null
              ? 'No completed reviews yet'
              : metrics.median_review_hours.toFixed(1) + ' hours'}
            .
          </p>
          <p className="fineprint">
            Clicks are not registrations or published posts. Returning members are measured within the
            existing 90-day window.
          </p>
          <section className="panel table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Activity</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {metrics.daily.map((x) => (
                  <tr key={x.day + x.name}>
                    <td data-label="Date">{date(x.day)}</td>
                    <td data-label="Activity">{x.name.replaceAll('_', ' ')}</td>
                    <td data-label="Count">{x.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!metrics.daily.length && <div className="empty">No activity recorded yet.</div>}
          </section>
        </>
      )}
      {data && (
        <>
          {section === 'codes' && (
            <>
              <form
                className="toolbar"
                onSubmit={(e) => {
                  e.preventDefault();
                  navigate({ search: query, page: '1' });
                }}
              >
                <label className="search">
                  <span className="sr-only">Search recipient email or code</span>
                  <input
                    type="search"
                    placeholder="Search recipient email or code…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <Button variant="outline">Search</Button>
                {search && (
                  <Button type="button" variant="ghost" onClick={() => navigate({ search: '', page: '1' })}>
                    Clear search
                  </Button>
                )}
              </form>
              <section className="panel table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Participant</th>
                      <th>Reward / code</th>
                      <th>Assigned</th>
                      <th>Source</th>
                      <th>Delivery / redemption</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((x) => (
                      <tr key={x.inventory_id}>
                        <td data-label="Participant">
                          {x.member_id ? (
                            <Link className="text-link" href={'/admin/members?member=' + x.member_id}>
                              {x.name || x.email}
                            </Link>
                          ) : (
                            <span>
                              {x.email}
                              <span className="cell-sub">Reservation without membership</span>
                            </span>
                          )}
                          {x.name && <span className="cell-sub">{x.email}</span>}
                        </td>
                        <td data-label="Reward / code">
                          {x.title}
                          <CopyCode code={x.code} />
                        </td>
                        <td data-label="Assigned">{date(x.assigned_at)}</td>
                        <td data-label="Source">
                          {x.kind === 'legacy' ? 'Legacy reservation' : 'Member claim'}
                          <span className="cell-sub">{x.source}</span>
                        </td>
                        <td data-label="Delivery / redemption">
                          Delivery unknown
                          <span className="cell-sub">Redemption unknown</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.items.length && (
                  <div className="empty">
                    {search
                      ? 'No assignments match this search. Try another email or clear the search.'
                      : 'No codes have been assigned yet.'}
                  </div>
                )}
              </section>
            </>
          )}
          {['events', 'updates'].includes(section) && (
            <>
              {editorId ? (
                <>
                  <Link
                    className="btn"
                    href={
                      path +
                      '?' +
                      new URLSearchParams([...params.entries()].filter(([key]) => key !== 'id')).toString()
                    }
                  >
                    Back to {section}
                  </Link>
                  {edit || creating ? (
                    <ContentEditor
                      key={edit ? edit.id + edit.version : 'new'}
                      initial={edit?.draft}
                      evidence={edit?.evidence}
                      slug={edit?.slug}
                      eventId={edit?.event_id}
                      onReload={load}
                      kind={section === 'events' ? 'event' : 'story'}
                      onSave={async (d, e, s) => {
                        await action(
                          'content_save',
                          {
                            kind: section === 'events' ? 'event' : 'story',
                            slug: s,
                            data: d,
                            evidence: e,
                            version: edit?.version ?? null,
                          },
                          'Private draft saved.',
                        );
                        navigate({ id: '' });
                      }}
                    />
                  ) : (
                    <p>
                      Draft unavailable. It may have been removed. Return to the list to choose another draft.
                    </p>
                  )}
                </>
              ) : (
                <section className="panel">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Revision</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((x) => (
                        <tr key={x.id}>
                          <td data-label="Title">
                            {x.draft.title}
                            <span className="cell-sub">
                              /{section === 'events' ? 'events' : 'stories'}/{x.slug}
                            </span>
                          </td>
                          <td data-label="Status">
                            <Status
                              tone={x.review_status === 'submitted' ? 'amber' : x.published ? 'green' : ''}
                            >
                              {x.review_status === 'submitted'
                                ? 'Awaiting review'
                                : x.published
                                  ? 'Published'
                                  : 'Draft'}
                            </Status>
                          </td>
                          <td data-label="Revision">Version {x.version}</td>
                          <td>
                            <div className="actions">
                              <Button variant="outline" size="sm" onClick={() => navigate({ id: x.id })}>
                                Edit
                              </Button>
                              {section === 'events' && x.event_id && (
                                <Link
                                  className="btn"
                                  href={'/organizer/events/' + x.event_id + '?tab=participants'}
                                >
                                  Participants
                                </Link>
                              )}
                              <Button variant="outline" size="sm" onClick={() => setConfirmation(x)}>
                                Review & publish
                              </Button>
                              {x.published && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={!!busy}
                                  onClick={() => {
                                    if (confirm('Unpublish this page?'))
                                      run(
                                        'content_unpublish',
                                        { id: x.id, version: x.version },
                                        'Page unpublished.',
                                      );
                                  }}
                                >
                                  Unpublish
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!data.items.length && (
                    <div className="empty">No {section} yet. Create a private draft to begin.</div>
                  )}
                </section>
              )}
            </>
          )}
          {section === 'projects' && (
            <>
              {!data.items.length && <div className="panel empty">No projects yet.</div>}
              {data.items.map((x) => (
                <article className="panel panel-body space-top" key={x.id}>
                  <div className="between">
                    <h2>{x.payload.title}</h2>
                    <Status>{x.status.replaceAll('_', ' ')}</Status>
                  </div>
                  <p>{x.payload.description}</p>
                  <p>Maker: {x.payload.maker || 'Not provided'}</p>
                  <div className="actions">
                    {[x.payload.demo_url, x.payload.repository_url, x.payload.maker_link]
                      .filter(Boolean)
                      .map((url) => (
                        <a className="text-link" key={url} href={url} target="_blank" rel="noreferrer">
                          {url}
                        </a>
                      ))}
                  </div>
                  <p>{x.payload.learned}</p>
                  <p>{x.payload.help}</p>
                  <div className="media-preview">
                    {x.payload.media?.map((id) => (
                      <Media key={id} id={id} title={x.payload.title} />
                    ))}
                  </div>
                  <p className="fineprint">
                    Promotional reuse: {x.payload.promotion_permission ? 'Permitted' : 'Not permitted'}
                  </p>
                  {x.status === 'submitted' && (
                    <>
                      <label>
                        Feedback
                        <textarea
                          rows={3}
                          maxLength={2000}
                          value={feedback[x.id] || ''}
                          onChange={(e) => setFeedback({ ...feedback, [x.id]: e.target.value })}
                        />
                      </label>
                      <div className="actions">
                        {[
                          ['approved', 'Approve and publish'],
                          ['changes_requested', 'Request changes'],
                          ['rejected', 'Reject'],
                        ].map(([decision, label]) => (
                          <Button
                            key={decision}
                            variant={decision === 'approved' ? 'default' : 'outline'}
                            disabled={!!busy}
                            onClick={async () => {
                              if (
                                decision === 'approved' &&
                                !confirm(
                                  'Publish this project revision with its permitted attribution and media?',
                                )
                              )
                                return;
                              setBusy(x.id);
                              try {
                                await request('/api/community/review', {
                                  id: x.revision_id,
                                  decision,
                                  feedback: feedback[x.id] || '',
                                });
                                setNotice('Review decision saved.');
                                await load();
                              } catch (e) {
                                setError((e as Error).message);
                              } finally {
                                setBusy('');
                              }
                            }}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                    </>
                  )}
                  {x.published_revision && (
                    <div className="actions">
                      <Link className="btn" href={'/projects/' + x.slug}>
                        Published page
                      </Link>
                      <Button
                        variant="outline"
                        disabled={!!busy}
                        onClick={() => {
                          if (confirm('Unpublish ' + x.payload.title + '?'))
                            run('project_unpublish', { id: x.id }, 'Project unpublished.');
                        }}
                      >
                        Unpublish
                      </Button>
                    </div>
                  )}
                </article>
              ))}
            </>
          )}
          {section === 'imports' && (
            <>
              <ImportWizard onCommit={() => void load()} />
              <h2>Import history</h2>
              {!data.items.length && (
                <p className="empty">No imports yet. Start with a CSV or XLSX registration file.</p>
              )}
              <section className="panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Records</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((x) => (
                      <tr key={x.id}>
                        <td data-label="Source">{x.source}</td>
                        <td data-label="Records">{x.row_count}</td>
                        <td data-label="Status">{x.committed_at ? 'Committed' : 'Preview only'}</td>
                        <td data-label="Date">{date(x.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )}
          {section === 'settings' && <EventSettings data={data} reload={load} />}
          {section === 'notifications' && (
            <>
              {!data.dispatch_enabled && (
                <p className="member-notice">Email dispatch is not configured. Messages remain queued.</p>
              )}
              {data.items.map((x) => (
                <article className="panel panel-body space-top" key={x.id}>
                  <div className="between">
                    <h2>{x.subject}</h2>
                    <Status tone={x.status === 'failed' ? 'amber' : x.status === 'sent' ? 'green' : ''}>
                      {x.status === 'sent' ? 'Provider accepted' : x.status}
                    </Status>
                  </div>
                  <p>To: {x.recipient}</p>
                  <details>
                    <summary>Preview message</summary>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{x.message}</p>
                  </details>
                  <p className="fineprint">
                    {date(x.created_at)} · {x.attempts} attempts
                  </p>
                  {x.last_error && <p role="alert">{x.last_error}</p>}
                  <Button
                    variant="outline"
                    disabled={!!busy || !data.dispatch_enabled || ['sent', 'sending'].includes(x.status)}
                    onClick={async () => {
                      if (!confirm('Send this approved message to ' + x.recipient + '?')) return;
                      setBusy(x.id);
                      try {
                        await request('/api/community/notify', { id: x.id });
                        setNotice('Provider accepted the message.');
                        await load();
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy('');
                      }
                    }}
                  >
                    Send / retry
                  </Button>
                </article>
              ))}
              {!data.items.length && <div className="panel empty">No queued messages.</div>}
            </>
          )}
          {section === 'shares' && !data.items.length && (
            <div className="panel empty">
              <h2>No content ready to share</h2>
              <p>Publish a project, event or update with promotional permission first.</p>
              <Link className="text-link" href="/admin/projects">
                Review projects
              </Link>
            </div>
          )}
          {section === 'shares' && data.items.length > 0 && (
            <section className="panel panel-body">
              <h2>Approve exact social copy</h2>
              <p>Choose published content with promotional permission. Publishing stays manual.</p>
              <form
                className="standard-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const item = data.items.find((x) => x.kind + ':' + x.slug === share);
                  if (!item) return;
                  try {
                    await action(
                      'share_approve',
                      { kind: item.kind, slug: item.slug, copy },
                      'Exact copy approved.',
                    );
                    setApproved(share + '\n' + copy);
                  } catch {}
                }}
              >
                <label>
                  Published content
                  <select required value={share} onChange={(e) => setShare(e.target.value)}>
                    <option value="">Choose content</option>
                    {data.items.map((x) => (
                      <option key={x.kind + x.slug} value={x.kind + ':' + x.slug}>
                        {x.title} · {x.kind}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Exact post copy
                  <textarea
                    rows={7}
                    required
                    maxLength={5000}
                    value={copy}
                    onChange={(e) => setCopy(e.target.value)}
                  />
                </label>
                <Button disabled={!!busy}>Approve this copy</Button>
              </form>
              {approved && (
                <p role="status">
                  {approved === share + '\n' + copy
                    ? 'This exact copy is approved. Nothing has been posted.'
                    : 'Copy changed. Approve this revision again before publishing.'}
                </p>
              )}
            </section>
          )}
          {section === 'reports' && (
            <>
              {data.items.map((x) => (
                <article className="panel panel-body space-top" key={x.id}>
                  <div className="between">
                    <h2>{x.kind === 'host' ? 'Host enquiry' : 'Report'}</h2>
                    <Status>{x.status}</Status>
                  </div>
                  <p>
                    {x.email} · {date(x.created_at)}
                  </p>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{x.message}</p>
                  <Button
                    variant="outline"
                    disabled={!!busy || x.status === 'resolved'}
                    onClick={() => run('resolve', { id: x.id }, 'Report resolved.')}
                  >
                    Mark resolved
                  </Button>
                </article>
              ))}
              {!data.items.length && <div className="panel empty">No reports or enquiries.</div>}
            </>
          )}
          {section === 'rewards' && (
            <>
              <p>Offer instructions and inventory totals. Existing assignments remain permanent.</p>
              {data.items.map((x) => (
                <RewardOffer
                  key={x.family}
                  item={x}
                  busy={!!busy}
                  save={(presentation) =>
                    action('reward_details', { family: x.family, presentation }, 'Reward instructions saved.')
                  }
                />
              ))}
            </>
          )}
          {!editorId && !['settings', 'shares', 'rewards'].includes(section) && (
            <Pagination page={page} total={data.total || 0} onPage={(p) => navigate({ page: String(p) })} />
          )}
        </>
      )}
      {confirmation && (
        <Modal title="Review before publication" onClose={() => setConfirmation(null)}>
          <h2>{confirmation.draft.title}</h2>
          <p>{confirmation.draft.description}</p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{confirmation.draft.body}</p>
          <div className="media-preview">
            {confirmation.draft.media?.map((id) => (
              <Media key={id} id={id} title={confirmation.draft.title} />
            ))}
          </div>
          <h3>Private evidence</h3>
          <p>{confirmation.evidence || 'Evidence is required before publication.'}</p>
          <ErrorMessage error={error} />
          <Button
            disabled={!!busy || !confirmation.evidence}
            onClick={async () => {
              try {
                await action(
                  'content_publish',
                  { id: confirmation.id, version: confirmation.version },
                  'Saved draft published.',
                );
                setConfirmation(null);
              } catch {}
            }}
          >
            Publish this saved revision
          </Button>
        </Modal>
      )}
    </main>
  );
}
function RewardOffer({
  item,
  busy,
  save,
}: {
  item: Item;
  busy: boolean;
  save: (p: Record<string, string>) => Promise<unknown>;
}) {
  const [dirty, setDirty] = useState(false);
  const [details, setDetails] = useState({
    eligibility: '',
    value: '',
    instructions: '',
    redemption_url: '',
    deadline: '',
    ...item.presentation,
  });
  useUnsaved(dirty);
  const labels: Record<string, string> = {
    eligibility: 'Who can claim',
    value: 'Reward value',
    instructions: 'How to redeem',
    redemption_url: 'Redemption link',
    deadline: 'Redemption deadline',
  };
  const limits: Record<string, number> = {
    eligibility: 500,
    value: 100,
    instructions: 2000,
    redemption_url: 1000,
    deadline: 100,
  };
  return (
    <section className="panel panel-body">
      <h2>{item.title}</h2>
      <p>
        {item.inventory} total · {item.assigned} assigned · {item.inventory - item.assigned} unassigned
      </p>
      <Status>{item.allocation_open ? 'Allocation open' : 'Allocation closed'}</Status>
      <form
        className="standard-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save(details)
            .then(() => setDirty(false))
            .catch(() => {});
        }}
      >
        {Object.keys(labels).map((key) => (
          <label key={key}>
            {labels[key] || key.replaceAll('_', ' ')}
            <input
              maxLength={limits[key]}
              type={key === 'redemption_url' ? 'url' : 'text'}
              value={details[key as keyof typeof details]}
              onChange={(e) => {
                setDetails({ ...details, [key]: e.target.value });
                setDirty(true);
              }}
            />
          </label>
        ))}
        <Button disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save offer details'}</Button>
      </form>
    </section>
  );
}
