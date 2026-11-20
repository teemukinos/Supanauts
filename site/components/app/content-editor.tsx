'use client';
import { useState } from 'react';
import type { ContentData } from '../../lib/participation';
import { localEventTime, eventTimeUTC } from '../../lib/event-time';
import { useUploadPolicy, uploadHelp, uploadMedia } from './upload';
import { Media } from '../../app/media';
import { Button, ErrorMessage, Modal, useUnsaved } from './ui';
export const emptyContent: ContentData = {
  title: '',
  description: '',
  body: '',
  city: '',
  venue: '',
  starts_at: '',
  ends_at: '',
  timezone: 'Europe/Helsinki',
  registration_url: '',
  media: [],
  resources: [],
  supporters: [],
  promotion_permission: false,
};
export default function ContentEditor({
  initial = emptyContent,
  evidence = '',
  kind = 'event',
  slug = '',
  eventId,
  onSave,
  onReload,
  organizer = false,
}: {
  initial?: ContentData;
  evidence?: string;
  kind?: string;
  slug?: string;
  eventId?: string;
  organizer?: boolean;
  onReload?: () => Promise<void>;
  onSave: (data: ContentData, evidence: string, slug: string, submit: boolean) => Promise<void>;
}) {
  const [data, setData] = useState({ ...emptyContent, ...initial }),
    [notes, setNotes] = useState(evidence),
    [urlSlug, setSlug] = useState(slug),
    [slugEdited, setSlugEdited] = useState(!!slug),
    [times, setTimes] = useState({
      starts_at: localEventTime(initial.starts_at, initial.timezone || 'Europe/Helsinki'),
      ends_at: localEventTime(initial.ends_at, initial.timezone || 'Europe/Helsinki'),
    }),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [preview, setPreview] = useState(false),
    [progress, setProgress] = useState<number | null>(null);
  useUnsaved(dirty);
  const uploadPolicy = useUploadPolicy();
  function update(key: string, value: unknown) {
    setData((p) => ({ ...p, [key]: value }));
    if (key === 'title' && !slugEdited && !organizer)
      setSlug(
        String(value)
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 100),
      );
    setDirty(true);
    setNotice('');
  }
  async function save(submit: boolean) {
    setError('');
    setBusy(true);
    try {
      let savedData = data;
      if (kind === 'event') {
        try {
          new Intl.DateTimeFormat('en', { timeZone: data.timezone });
        } catch {
          throw Error('Choose a valid event timezone, such as Europe/Helsinki.');
        }
        savedData = {
          ...data,
          starts_at: eventTimeUTC(times.starts_at, data.timezone || 'Europe/Helsinki'),
          ends_at: eventTimeUTC(times.ends_at, data.timezone || 'Europe/Helsinki'),
        };
        if (savedData.starts_at && savedData.ends_at && savedData.ends_at <= savedData.starts_at)
          throw Error('The end time must be after the start time.');
      }
      await onSave(savedData, notes, urlSlug, submit);
      setDirty(false);
      setNotice(submit ? 'Submitted for admin review.' : 'Private draft saved.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function input(key: keyof ContentData, label: string, type = 'text', required = false) {
    return (
      <label>
        {label}
        <input
          type={type}
          required={required}
          minLength={key === 'title' ? 3 : undefined}
          maxLength={
            key === 'title'
              ? 120
              : key === 'city' || key === 'date_label'
                ? 100
                : key === 'venue'
                  ? 200
                  : 1000
          }
          value={String(data[key] ?? '')}
          onChange={(e) => update(key, e.target.value)}
        />
      </label>
    );
  }
  async function upload(file: File) {
    setError('');
    setProgress(0);
    try {
      const result = await uploadMedia(file, uploadPolicy, setProgress, eventId);
      update('media', [...(data.media || []), result.id]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  }
  return (
    <form
      className="standard-form"
      onSubmit={(e) => {
        e.preventDefault();
        void save(false);
      }}
    >
      <ErrorMessage error={error} />
      {onReload && error.includes('Someone changed') && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (!dirty || confirm('Discard your unsaved changes and reload the latest saved draft?'))
              void onReload();
          }}
        >
          Reload saved draft
        </Button>
      )}
      {notice && (
        <p role="status" className="member-notice">
          {notice}
        </p>
      )}
      <fieldset disabled={busy}>
        <legend>Details</legend>
        {input('title', 'Title', 'text', true)}
        {!organizer && (
          <label>
            Page address
            <input
              pattern="[a-z0-9][a-z0-9-]*"
              maxLength={100}
              required
              value={urlSlug}
              readOnly={!!slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugEdited(true);
                setDirty(true);
              }}
            />
            <span className="fineprint">
              {kind === 'event' ? '/events/' : '/stories/'}
              {urlSlug || 'your-title'}
            </span>
          </label>
        )}
        <label>
          Summary
          <textarea
            required
            minLength={10}
            maxLength={500}
            rows={3}
            value={data.description}
            onChange={(e) => update('description', e.target.value)}
          />
        </label>
        <label>
          {kind === 'event' ? 'Event details' : 'Article'}
          <textarea
            rows={8}
            maxLength={20000}
            value={data.body}
            onChange={(e) => update('body', e.target.value)}
          />
        </label>
      </fieldset>
      {kind === 'event' && (
        <fieldset disabled={busy}>
          <legend>When and where</legend>
          {input('city', 'City')}
          {input('venue', 'Venue')}
          {(['starts_at', 'ends_at'] as const).map((key) => (
            <label key={key}>
              {key === 'starts_at' ? 'Starts' : 'Ends'}
              <input
                type="datetime-local"
                value={times[key]}
                onChange={(e) => {
                  setTimes((t) => ({ ...t, [key]: e.target.value }));
                  setDirty(true);
                  setNotice('');
                }}
              />
            </label>
          ))}
          <label>
            Event timezone
            <input
              list="timezones"
              value={data.timezone}
              onChange={(e) => update('timezone', e.target.value)}
            />
            <datalist id="timezones">
              {Intl.supportedValuesOf('timeZone').map((zone) => (
                <option key={zone}>{zone}</option>
              ))}
            </datalist>
          </label>
          <p className="fineprint">Start and end times use the event timezone above.</p>
          {input('date_label', 'Historical date, if exact time is unknown')}
          {input('registration_url', 'Registration link', 'url')}
          <label className="check">
            <input
              type="checkbox"
              checked={!!data.cancelled}
              onChange={(e) => update('cancelled', e.target.checked)}
            />
            Event cancelled
          </label>
        </fieldset>
      )}
      <fieldset disabled={busy || progress !== null}>
        <legend>Media and permissions</legend>
        <label>
          Attach event or article media
          <input
            type="file"
            accept={'image/jpeg,image/png,image/webp' + (uploadPolicy.videoMaxBytes ? ',video/mp4' : '')}
            disabled={(data.media?.length || 0) >= 12}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = '';
            }}
          />
        </label>
        <p className="fineprint">{uploadHelp(uploadPolicy)} Up to 12 attachments.</p>
        {progress !== null && (
          <p role="status">{progress === 100 ? 'Processing media…' : `Uploading ${progress}%`}</p>
        )}
        <div className="media-preview">
          {data.media?.map((id) => (
            <div key={id}>
              <Media id={id} title={data.title} />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  update(
                    'media',
                    data.media?.filter((x) => x !== id),
                  )
                }
              >
                Remove attachment
              </Button>
            </div>
          ))}
        </div>
        <label>
          Private source and media-rights notes (required before publication)
          <textarea
            maxLength={5000}
            rows={3}
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setDirty(true);
            }}
          />
        </label>
        {!organizer && (
          <label className="check">
            <input
              type="checkbox"
              checked={!!data.promotion_permission}
              onChange={(e) => update('promotion_permission', e.target.checked)}
            />
            Promotional reuse rights verified
          </label>
        )}
      </fieldset>
      {(['resources', 'supporters'] as const).map((key) => (
        <fieldset key={key} disabled={busy}>
          <legend>{key === 'resources' ? 'Resources' : 'Supporters'}</legend>
          {(data[key] || []).map((row, i) => (
            <div className="form-grid" key={i}>
              {(key === 'resources' ? ['title', 'url'] : ['name', 'role', 'url']).map((field) => (
                <label key={field}>
                  {field}
                  <input
                    value={String((row as unknown as Record<string, string>)[field] || '')}
                    type={field === 'url' ? 'url' : 'text'}
                    onChange={(e) =>
                      update(
                        key,
                        data[key]?.map((r, j) => (j === i ? { ...r, [field]: e.target.value } : r)),
                      )
                    }
                  />
                </label>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  update(
                    key,
                    data[key]?.filter((_, j) => i !== j),
                  )
                }
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              update(key, [
                ...(data[key] || []),
                key === 'resources' ? { title: '', url: '' } : { name: '', role: '', url: '' },
              ])
            }
          >
            Add {key === 'resources' ? 'resource' : 'supporter'}
          </Button>
        </fieldset>
      ))}
      <div className="actions">
        <Button disabled={busy || progress !== null}>{busy ? 'Saving…' : 'Save draft'}</Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || progress !== null}
          onClick={() => setPreview(true)}
        >
          Preview
        </Button>
        {organizer && (
          <Button
            type="button"
            variant="outline"
            disabled={busy || progress !== null}
            onClick={(e) => {
              if (e.currentTarget.form?.reportValidity()) void save(true);
            }}
          >
            Submit for approval
          </Button>
        )}
      </div>
      {preview && (
        <Modal title="Draft preview" onClose={() => setPreview(false)}>
          <h2>{data.title}</h2>
          <p>{data.description}</p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{data.body}</p>
          {data.media?.map((id) => (
            <Media key={id} id={id} title={data.title} />
          ))}
          <p className="fineprint">Saving does not publish this draft.</p>
        </Modal>
      )}
    </form>
  );
}
