'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { RegistryResult } from '../../lib/member-registry';
import { Button, ErrorMessage, request, useUnsaved } from './ui';
export type EventSettingsData = {
  events: { id: string; title: string }[];
  organizers: { event_id: string; member_id: string; email: string }[];
  sources: { label: string; event_id: string }[];
  unmapped: { label: string; registrations: number }[];
  settings: {
    whatsapp?: {
      community?: string;
      announcements?: string;
      builders?: string;
    };
  };
};
export default function EventSettings({
  data,
  reload,
}: {
  data: EventSettingsData;
  reload: () => Promise<void>;
}) {
  const [event, setEvent] = useState(''),
    [mappingEvent, setMappingEvent] = useState(''),
    [searched, setSearched] = useState(false),
    [dirty, setDirty] = useState(false),
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
  useUnsaved(dirty);
  async function action(action: string, p: object) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await request('/api/workspace/event-admin', {
        action,
        event_id: action === 'map' ? mappingEvent : event,
        ...p,
      });
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
      {!data.events.length && (
        <section className="panel panel-body">
          <h2>Create your first managed event</h2>
          <p>
            Create an event draft before assigning organizers, importing registrations or linking earlier
            registrations. External calendar listings are not added here automatically.
          </p>
          <Link className="btn primary" href="/admin/events?id=new">
            Create event draft
          </Link>
        </section>
      )}
      <section className="panel panel-body">
        <h2>Event organizers</h2>
        <p>
          Organizers can view assigned-event registrations and edit drafts. Admins retain control of codes and
          publication.
        </p>
        <label>
          Event
          <select
            disabled={!data.events.length || busy}
            value={event}
            onChange={(e) => {
              setEvent(e.target.value);
              setMember('');
              setMembers([]);
              setSearched(false);
              setNotice('');
            }}
          >
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
                setMember('');
                setMembers([]);
                setSearched(false);
                try {
                  const result = await request<RegistryResult>(
                    '/api/admin/members?status=active&search=' + encodeURIComponent(search),
                  );
                  if (result.view === 'members') setMembers(result.items);
                  setSearched(true);
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
            {searched && !members.length && (
              <p role="status">
                No active members match this search. Try another email or add the member in Members.
              </p>
            )}
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
        <h2>Connect earlier registrations</h2>
        <p>
          Connect each imported registration label to its event. Until connected, those registrations remain
          visible only to admins. Assigned organizers can then see their event’s participants.
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
              Event for these registrations
              <select
                required
                disabled={!data.events.length || busy}
                value={mappingEvent}
                onChange={(e) => setMappingEvent(e.target.value)}
              >
                <option value="">Choose event</option>
                {data.events.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title}
                  </option>
                ))}
              </select>
            </label>
            <Button disabled={busy || !mappingEvent || !label}>Connect registrations</Button>
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
            setError('');
            setNotice('');
            try {
              await request('/api/community/admin', {
                action: 'settings',
                data: links,
              });
              setNotice('Invitation links saved.');
              setDirty(false);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {(['community', 'announcements', 'builders'] as const).map((key) => (
            <label key={key}>
              {key === 'community'
                ? 'Community invitation'
                : key === 'announcements'
                  ? 'Announcements invitation'
                  : 'Builders invitation'}
              <input
                type="url"
                maxLength={1000}
                placeholder="https://chat.whatsapp.com/…"
                value={links[key]}
                onChange={(e) => {
                  setLinks({ ...links, [key]: e.target.value });
                  setDirty(true);
                  setNotice('');
                }}
              />
            </label>
          ))}
          <p className="fineprint">
            Use official WhatsApp invitation links. Leave a field empty to hide that invitation.
          </p>
          <Button disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save invitations'}</Button>
        </form>
      </section>
    </>
  );
}
