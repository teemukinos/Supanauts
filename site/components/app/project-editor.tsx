'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUploadPolicy, uploadHelp, uploadMedia } from './upload';
import { Media } from '../../app/media';
import { Button, PageHeader, Loading, ErrorMessage, Modal, request, useUnsaved } from './ui';
const blank = {
  title: '',
  description: '',
  maker: '',
  maker_link: '',
  demo_url: '',
  repository_url: '',
  event: '',
  technologies: '',
  learned: '',
  help: '',
  display_permission: false,
  promotion_permission: false,
  media: [] as string[],
};
type Payload = typeof blank;
export default function ProjectEditor() {
  const [payload, setPayload] = useState(blank),
    [id, setId] = useState<string | null>(null),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [dirty, setDirty] = useState(false),
    [preview, setPreview] = useState(false),
    [events, setEvents] = useState<string[]>([]),
    [progress, setProgress] = useState<number | null>(null);
  useUnsaved(dirty);
  const uploadPolicy = useUploadPolicy();
  async function load() {
    setError('');
    try {
      const data = await request<{
        projects: { id: string; revisions: { payload: Payload }[] }[];
        registrations: { event: string }[];
        profile: { name: string; link: string };
      }>('/api/community/home');
      setEvents([...new Set(data.registrations.map((r) => r.event))]);
      const pid = new URLSearchParams(window.location.search).get('id');
      if (pid) {
        const project = data.projects.find((p) => p.id === pid);
        if (!project) throw Error('Project not found.');
        setId(pid);
        setPayload({ ...blank, ...project.revisions[0].payload });
      } else
        setPayload((p) => ({ ...p, maker: data.profile?.name || '', maker_link: data.profile?.link || '' }));
      setReady(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (ready) return;
    const restore = () => {
      void load();
    };
    window.addEventListener('sessionrestored', restore);
    return () => window.removeEventListener('sessionrestored', restore);
  }, [ready]);
  function update<K extends keyof Payload>(key: K, value: Payload[K]) {
    setPayload((p) => ({ ...p, [key]: value }));
    setDirty(true);
    setNotice('');
  }
  async function save(submit: boolean) {
    setBusy(true);
    setError('');
    try {
      const data = await request<{ result: string }>('/api/community/save-project', { id, payload, submit });
      setId(data.result);
      window.history.replaceState(null, '', '/member/projects/new?id=' + data.result);
      setDirty(false);
      setPreview(false);
      setNotice(
        submit
          ? 'Submitted for review. Any previously published version stays unchanged.'
          : 'Private draft saved.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File) {
    setError('');
    setProgress(0);
    try {
      const result = await uploadMedia(file, uploadPolicy, setProgress);
      update('media', [...payload.media, result.id]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  }
  const field = (
    key: Exclude<keyof Payload, 'media' | 'display_permission' | 'promotion_permission'>,
    label: string,
    multiline = false,
    required = false,
  ) => (
    <label>
      {label}
      {multiline ? (
        <textarea
          value={payload[key]}
          rows={key === 'description' ? 5 : 3}
          required={required}
          minLength={key === 'description' ? 20 : undefined}
          maxLength={key === 'description' ? 5000 : key === 'help' ? 1000 : 2000}
          onChange={(e) => update(key, e.target.value)}
        />
      ) : (
        <input
          value={payload[key]}
          required={required}
          minLength={key === 'title' ? 3 : undefined}
          type={key.endsWith('url') || key === 'maker_link' ? 'url' : 'text'}
          maxLength={key === 'title' ? 120 : key === 'maker' ? 100 : key === 'technologies' ? 300 : 500}
          onChange={(e) => update(key, e.target.value)}
        />
      )}
    </label>
  );
  return (
    <main id="main">
      <PageHeader
        title="Project draft"
        description="Share what you built or what you’re still figuring out."
      />
      <ErrorMessage error={error} retry={!ready ? load : undefined} />
      {notice && (
        <p role="status" className="member-notice">
          {notice}
        </p>
      )}
      {!ready && !error ? (
        <Loading />
      ) : (
        ready && (
          <form
            className="standard-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save(false);
            }}
          >
            <fieldset disabled={busy}>
              <legend>1. Project details</legend>
              {field('title', 'Project title', false, true)}
              {field('description', 'What did you build?', true, true)}
              <p className="fineprint">
                A title and at least 20 characters describing your project are required to save.
              </p>
              {field('technologies', 'Technologies used')}
              <label>
                Related event (optional)
                <input
                  list="member-events"
                  value={payload.event}
                  maxLength={150}
                  onChange={(e) => update('event', e.target.value)}
                />
                <datalist id="member-events">
                  {events.map((event) => (
                    <option key={event}>{event}</option>
                  ))}
                </datalist>
              </label>
              {field('learned', 'What did you learn?', true)}
              {field('help', 'Where would you like help?', true)}
            </fieldset>
            <fieldset disabled={busy}>
              <legend>2. Links and media</legend>
              {field('demo_url', 'Demo link (optional)')}
              {field('repository_url', 'Repository link (optional)')}
              <label>
                Attach project media
                <input
                  type="file"
                  accept={
                    'image/jpeg,image/png,image/webp' + (uploadPolicy.videoMaxBytes ? ',video/mp4' : '')
                  }
                  disabled={progress !== null || payload.media.length >= 6}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
                    e.target.value = '';
                  }}
                />
              </label>
              <p className="fineprint">
                {uploadHelp(uploadPolicy)} Up to five images and, when available, one video.
              </p>
              {progress !== null && (
                <p role="status">{progress === 100 ? 'Processing media…' : `Uploading ${progress}%`}</p>
              )}
              <div className="media-preview">
                {payload.media.map((mid) => (
                  <div key={mid}>
                    <Media id={mid} title={payload.title} />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        update(
                          'media',
                          payload.media.filter((x) => x !== mid),
                        )
                      }
                    >
                      Remove attachment
                    </Button>
                  </div>
                ))}
              </div>
            </fieldset>
            <fieldset disabled={busy}>
              <legend>3. Attribution and permissions</legend>
              {field('maker', 'Public maker name')}
              {field('maker_link', 'Public maker link (optional)')}
              <label className="check">
                <input
                  type="checkbox"
                  checked={payload.display_permission}
                  onChange={(e) => update('display_permission', e.target.checked)}
                />
                I own or have permission to share this content and allow website display with this
                attribution.
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={payload.promotion_permission}
                  onChange={(e) => update('promotion_permission', e.target.checked)}
                />
                I also allow promotional reuse and downloadable share assets. Optional.
              </label>
              <Link className="text-link" href="/help/permissions" target="_blank">
                Read content permissions
              </Link>
            </fieldset>
            <div className="actions">
              <Button variant="outline" disabled={busy || progress !== null}>
                {busy ? 'Saving…' : 'Save private draft'}
              </Button>
              <Button
                type="button"
                disabled={busy || progress !== null || !payload.display_permission}
                onClick={(e) => {
                  if (e.currentTarget.form?.reportValidity()) setPreview(true);
                }}
              >
                Preview & submit
              </Button>
            </div>
            {!payload.display_permission && (
              <p className="fineprint">
                To submit for review, allow website display in the permissions section above. You can save a
                private draft without this permission.
              </p>
            )}
            <p className="fineprint">
              {dirty ? 'Unsaved changes.' : 'Your draft stays private until approved.'}
            </p>
          </form>
        )
      )}
      {preview && (
        <Modal title="Review your submission" onClose={() => setPreview(false)}>
          <h2>{payload.title}</h2>
          <p>{payload.description}</p>
          <p>Attribution: {payload.maker || 'No maker name'}</p>
          <p>Promotional reuse: {payload.promotion_permission ? 'Allowed' : 'Not allowed'}</p>
          <div className="media-preview">
            {payload.media.map((mid) => (
              <Media key={mid} id={mid} title={payload.title} />
            ))}
          </div>
          <ErrorMessage error={error} retry={!ready ? load : undefined} />
          <Button disabled={busy} onClick={() => void save(true)}>
            {busy ? 'Submitting…' : 'Submit for review'}
          </Button>
        </Modal>
      )}
      <Link className="text-link" href="/member/projects">
        ← My projects
      </Link>
    </main>
  );
}
