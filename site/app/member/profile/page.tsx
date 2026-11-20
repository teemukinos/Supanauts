'use client';
import { useEffect, useState } from 'react';
import { Button, PageHeader, Loading, ErrorMessage, request, useUnsaved } from '../../../components/app/ui';
type Profile = { name: string; link: string; decision_email: boolean };
export default function Page() {
  const [profile, setProfile] = useState<Profile>({
    name: '',
    link: '',
    decision_email: true,
  });
  const [notice, setNotice] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [dirty, setDirty] = useState(false);
  useUnsaved(dirty);
  async function load() {
    setError('');
    try {
      const data = await request<{ profile: Profile | null }>('/api/community/home');
      setProfile((p) => ({ ...p, ...data.profile }));
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
  function update(patch: Partial<Profile>) {
    setProfile((p) => ({ ...p, ...patch }));
    setDirty(true);
    setNotice('');
  }
  return (
    <main id="main">
      <PageHeader
        title="Profile & preferences"
        description="Private defaults for your projects and account."
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
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                await request('/api/community/profile', profile);
                setNotice('Preferences saved.');
                setDirty(false);
                window.dispatchEvent(new Event('sessionchange'));
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset disabled={busy}>
              <legend>Maker details</legend>
              <p>Each project asks permission before displaying this attribution.</p>
              <label>
                Maker name
                <input
                  value={profile.name}
                  maxLength={100}
                  onChange={(e) => update({ name: e.target.value })}
                />
              </label>
              <label>
                Public profile link
                <input
                  type="url"
                  maxLength={500}
                  value={profile.link}
                  onChange={(e) => update({ link: e.target.value })}
                />
              </label>
            </fieldset>
            <fieldset disabled={busy}>
              <legend>Email preferences</legend>
              <label className="check">
                <input
                  type="checkbox"
                  checked={profile.decision_email}
                  onChange={(e) => update({ decision_email: e.target.checked })}
                />
                Email me when a project review is ready.
              </label>
              <p>
                Review emails are sent when community email delivery is available. Sign-in codes always remain
                available. This does not subscribe you to a newsletter. Manage WhatsApp participation in
                WhatsApp.
              </p>
            </fieldset>
            <div>
              <Button disabled={busy}>{busy ? 'Saving…' : 'Save preferences'}</Button>
            </div>
          </form>
        )
      )}
    </main>
  );
}
