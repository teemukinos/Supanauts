'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

type Access = 'loading' | 'signed-out' | 'forbidden' | 'verify' | 'ready' | 'error';
export default function WorkspaceAccess({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [access, setAccess] = useState<Access>('loading');
  const [email, setEmail] = useState(''),
    [factor, setFactor] = useState('');
  const [qr, setQr] = useState(''),
    [secret, setSecret] = useState(''),
    [code, setCode] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const signIn = '/member?next=' + encodeURIComponent(path);

  async function check() {
    setAccess('loading');
    setError('');
    try {
      const response = await fetch('/api/admin/mfa', { cache: 'no-store' });
      const data = await response.json();
      if (response.status === 401) {
        setAccess('signed-out');
        return;
      }
      if (response.status === 403) {
        setAccess('forbidden');
        return;
      }
      if (!response.ok) throw Error(data.error || 'Could not check access.');
      setEmail(data.email);
      setFactor(data.factors[0]?.id ?? '');
      setAccess(data.verified ? 'ready' : 'verify');
    } catch (e) {
      setError((e as Error).message);
      setAccess('error');
    }
  }
  useEffect(() => {
    void check();
  }, [path]);
  async function action(data: object) {
    const response = await fetch('/api/admin/mfa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Please try again.');
    return result;
  }
  async function enroll() {
    setBusy(true);
    setError('');
    try {
      const data = await action({ action: 'enroll' });
      setFactor(data.id);
      setSecret(data.secret);
      setQr(
        data.qr_code.startsWith('data:')
          ? data.qr_code
          : 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data.qr_code),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    setBusy(true);
    setError('');
    try {
      await action({ action: 'verify', factor, code });
      setCode('');
      setQr('');
      setSecret('');
      await check();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) throw Error('Could not sign out. Please retry.');
      window.location.assign(signIn);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="account-shell workspace-shell">
      <a className="skip" href="#main">
        Skip to content
      </a>
      {access === 'ready' ? (
        children
      ) : (
        <main id="main" className="access-page">
          {access === 'loading' ? (
            <p role="status">Checking workspace access…</p>
          ) : (
            <section className="access-card">
              <p className="eyebrow">Private workspace area</p>
              {access === 'signed-out' ? (
                <>
                  <h1>Sign in to continue</h1>
                  <p>See participants, assigned codes and join requests using your workspace account.</p>
                  <ol className="access-steps">
                    <li>Sign in with your email code.</li>
                    <li>Verify your authenticator to open the registry.</li>
                  </ol>
                  <a className="primary" href={signIn}>
                    Sign in to workspace
                  </a>
                  <p className="fineprint">
                    Already signed in elsewhere? Sign in here too. Sessions stay in the browser where you
                    entered your code.
                  </p>
                </>
              ) : access === 'forbidden' ? (
                <>
                  <h1>Workspace access only</h1>
                  <p>
                    Your current account cannot view other participants. Use your workspace email or return to
                    your own codes.
                  </p>
                  <div className="actions">
                    <button className="primary" disabled={busy} onClick={signOut}>
                      Use a different account
                    </button>
                    <a className="outline" href="/member">
                      View my codes
                    </a>
                  </div>
                </>
              ) : access === 'error' ? (
                <>
                  <h1>Access check unavailable</h1>
                  <p>Your session could not be checked. Retry to continue.</p>
                  <button className="primary" onClick={check}>
                    Try again
                  </button>
                </>
              ) : (
                <>
                  <h1>{factor ? 'Verify your authenticator' : 'Protect workspace access'}</h1>
                  <p>
                    Signed in as <strong>{email}</strong>.
                  </p>
                  <p>
                    Participant information requires an extra verification step. You will stay on this page.
                  </p>
                  {!factor ? (
                    <>
                      <button className="primary" disabled={busy} onClick={enroll}>
                        {busy ? 'Preparing…' : 'Set up authenticator'}
                      </button>
                    </>
                  ) : (
                    <>
                      {qr && (
                        <div className="mfa-setup">
                          <p>1. Scan this QR code with your authenticator app.</p>
                          <img src={qr} alt="Authenticator setup QR code" />
                          <details>
                            <summary>Cannot scan? Enter setup key manually</summary>
                            <code>{secret}</code>
                          </details>
                          <p>2. Enter the six-digit code shown in the app.</p>
                        </div>
                      )}
                      <form
                        className="standard-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void verify();
                        }}
                      >
                        <label htmlFor="workspace-code">
                          Authenticator code
                          <input
                            id="workspace-code"
                            autoFocus
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            required
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                          />
                        </label>
                        <p className="fineprint">Use your authenticator app, not the code from your email.</p>
                        <button className="primary" disabled={busy || code.length !== 6}>
                          {busy ? 'Verifying…' : 'Verify and continue'}
                        </button>
                      </form>
                    </>
                  )}
                </>
              )}
              {error && (
                <p role="alert" className="member-error">
                  {error}
                </p>
              )}
            </section>
          )}
        </main>
      )}
    </div>
  );
}
