'use client';
import { useState } from 'react';
import type { ContentData } from '../../lib/participation';
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
  organizer = false,
}: {
  initial?: ContentData;
  evidence?: string;
  kind?: string;
  slug?: string;
  eventId?: string;
  organizer?: boolean;
  onSave: (data: ContentData, evidence: string, slug: string, submit: boolean) => Promise<void>;
}) {
  const [data, setData] = useState({ ...emptyContent, ...initial }),
    [notes, setNotes] = useState(evidence),
    [urlSlug, setSlug] = useState(slug),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [preview, setPreview] = useState(false),
    [progress, setProgress] = useState<number | null>(null);
  useUnsaved(dirty);
  function update(key: string, value: unknown) {
    setData((p) => ({ ...p, [key]: value }));
    setDirty(true);
    setNotice('');
  }
  async function save(submit: boolean) {
    setError('');
    setBusy(true);
    try {
      await onSave(data, notes, urlSlug, submit);
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
          maxLength={key === 'title' ? 120 : 1000}
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
      const form = new FormData();
      form.set('file', file);
      const result = await new Promise<{ id: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/uploads' + (eventId ? '?event=' + eventId : ''));
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onerror = () => reject(Error('Upload interrupted. Retry this file.'));
        xhr.onload = () => {
          try {
            const value = JSON.parse(xhr.responseText);
            xhr.status < 300 ? resolve(value) : reject(Error(value.error || 'Upload failed.'));
          } catch {
            reject(Error('Upload failed.'));
          }
        };
        xhr.send(form);
      });
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
              required
              value={urlSlug}
              readOnly={!!slug}
              onChange={(e) => {
                setSlug(e.target.value);
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
              {key === 'starts_at' ? 'Starts' : 'Ends'} (UTC)
              <input
                type="datetime-local"
                value={data[key] ? new Date(data[key]!).toISOString().slice(0, 16) : ''}
                onChange={(e) =>
                  update(key, e.target.value ? new Date(e.target.value + 'Z').toISOString() : '')
                }
              />
            </label>
          ))}
          <label>
            Display timezone
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
          Attach an image or video
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4"
            disabled={(data.media?.length || 0) >= 12}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = '';
            }}
          />
        </label>
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
          Private source and media-rights notes
          <textarea
            required
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
        <Button type="button" variant="outline" onClick={() => setPreview(true)}>
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
