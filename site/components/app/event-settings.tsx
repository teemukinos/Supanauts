'use client';
import { useState } from 'react';
import type { RegistryResult } from '../../lib/member-registry';
import { Button, ErrorMessage, request } from './ui';
export type EventSettingsData = {
  events: { id: string; title: string }[];
  organizers: { event_id: string; member_id: string; email: string }[];
  sources: { label: string; event_id: string }[];
  unmapped: { label: string; registrations: number }[];
  settings: { whatsapp?: { community?: string; announcements?: string; builders?: string } };
};
export default function EventSettings({
  data,
  reload,
}: {
  data: EventSettingsData;
  reload: () => Promise<void>;
}) {
  const [event, setEvent] = useState(''),
    [search, setSearch] = useState(''),
    [members, setMembers] = useState<{ id: string; email: string }[]>([]),
    [member, setMember] = useState(''),
    [label, setLabel] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [links, setLinks] = useState({
      community: '',
      announcements: '',
      builders: '',
      ...data.settings.whatsapp,
    });
  async function action(action: string, p: object) {
    setBusy(true);
    setError('');
    try {
      await request('/api/workspace/event-admin', { action, event_id: event, ...p });
      setNotice(
        action === 'assign'
          ? 'Event organizer access granted.'
          : action === 'revoke'
            ? 'Event access revoked.'
            : 'Registration source mapped.',
      );
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <ErrorMessage error={error} />
      {notice && (
        <p role="status" className="member-notice">
          {notice}
        </p>
      )}
      <section className="panel panel-body">
        <h2>Event organizers</h2>
        <p>
          Organizers can view assigned-event registrations and edit drafts. Admins retain control of codes and
          publication.
        </p>
        <label>
          Event
          <select value={event} onChange={(e) => setEvent(e.target.value)}>
            <option value="">Choose event</option>
            {data.events.map((x) => (
              <option value={x.id} key={x.id}>
                {x.title}
              </option>
            ))}
          </select>
        </label>
        {event && (
          <>
            <form
              className="standard-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  const result = await request<RegistryResult>(
                    '/api/admin/members?status=active&search=' + encodeURIComponent(search),
                  );
                  if (result.view === 'members') setMembers(result.items);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Find an existing member
                <input type="search" required value={search} onChange={(e) => setSearch(e.target.value)} />
              </label>
              <Button variant="outline" disabled={busy}>
                Search members
              </Button>
            </form>
            {members.length > 0 && (
              <div className="actions">
                <select
                  aria-label="Member to assign"
                  value={member}
                  onChange={(e) => setMember(e.target.value)}
                >
                  <option value="">Choose member</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.email}
                    </option>
                  ))}
                </select>
                <Button
                  disabled={!member || busy}
                  onClick={() => {
                    if (confirm('Grant this member access to this event’s participant emails and drafts?'))
                      void action('assign', { member_id: member });
                  }}
                >
                  Assign organizer
                </Button>
              </div>
            )}
            {data.organizers
              .filter((o) => o.event_id === event)
              .map((o) => (
                <div className="between panel-body" key={o.member_id}>
                  <span>{o.email}</span>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      if (confirm('Revoke this organizer’s event access?'))
                        void action('revoke', { member_id: o.member_id });
                    }}
                  >
                    Revoke access
                  </Button>
                </div>
              ))}
          </>
        )}
      </section>
      <section className="panel panel-body">
        <h2>Unmapped registration sources</h2>
        <p>
          Unmapped registrations stay admin-only. Mapping a source makes its registrations visible to
          organizers assigned to that event.
        </p>
        {!data.unmapped.length ? (
          <p>All registration sources are mapped.</p>
        ) : (
          <form
            className="standard-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (confirm('Map every registration with this source label to the selected event?'))
                void action('map', { label });
            }}
          >
            <label>
              Source label
              <select required value={label} onChange={(e) => setLabel(e.target.value)}>
                <option value="">Choose source</option>
                {data.unmapped.map((s) => (
                  <option key={s.label} value={s.label}>
                    {s.label} · {s.registrations} records
                  </option>
                ))}
              </select>
            </label>
            <label>
              Canonical event
              <select required value={event} onChange={(e) => setEvent(e.target.value)}>
                <option value="">Choose event</option>
                {data.events.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title}
                  </option>
                ))}
              </select>
            </label>
            <Button disabled={busy}>Map reviewed source</Button>
          </form>
        )}
        <details>
          <summary>Existing source mappings</summary>
          {data.sources.map((s) => (
            <p key={s.label}>
              {s.label} · {data.events.find((e) => e.id === s.event_id)?.title}
            </p>
          ))}
        </details>
      </section>
      <section className="panel panel-body">
        <h2>Community invitations</h2>
        <form
          className="standard-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await request('/api/community/admin', { action: 'settings', data: links });
              setNotice('Invitation links saved.');
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {(['community', 'announcements', 'builders'] as const).map((key) => (
            <label key={key}>
              {key}
              <input
                type="url"
                value={links[key]}
                onChange={(e) => setLinks({ ...links, [key]: e.target.value })}
              />
            </label>
          ))}
          <Button disabled={busy}>Save invitations</Button>
        </form>
      </section>
    </>
  );
}
