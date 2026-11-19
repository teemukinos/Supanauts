'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { CopyCode } from '../../components/app/ui';
import EventPhoto from '../event-photo';
import { Brand } from '../community-ui';
import MemberNav from './member-nav';
import { safeNext } from '../../lib/validation';
import '../account.css';

type Reward = {
  family: string;
  title: string;
  code: string | null;
  assigned_at: string | null;
  allocation_open: boolean;
  eligible?: boolean;
  state?: string;
  details?: {
    eligibility?: string;
    value?: string;
    instructions?: string;
    redemption_url?: string;
    deadline?: string;
  };
};
type Account = { email: string; rewards: Reward[]; is_admin?: boolean };
export default function Member() {
  const [email, setEmail] = useState(''),
    [token, setToken] = useState(''),
    [next, setNext] = useState('/member');
  const [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(''),
    [problem, setProblem] = useState('');
  const [member, setMember] = useState<Account | null>(null);
  const [claiming, setClaiming] = useState('');
  async function refresh() {
    const response = await fetch('/api/rewards/mine', { cache: 'no-store' });
    const data = await response.json();
    if (response.ok) {
      setMember(data);
      const destination = safeNext(new URLSearchParams(window.location.search).get('next'));
      if (destination !== '/member') window.location.assign(destination);
    } else {
      setMember(null);
      if (response.status !== 401) setProblem(data.error);
    }
    setLoading(false);
  }
  useEffect(() => {
    setNext(safeNext(new URLSearchParams(window.location.search).get('next')));
    refresh().catch(() => {
      setProblem('Could not load your account. Please refresh.');
      setLoading(false);
    });
  }, []);
  async function action(path: string, data: object) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401) window.dispatchEvent(new Event('sessionchange'));
      throw Error(result.error || 'Please try again.');
    }
    return result;
  }
  async function sendCode() {
    const result = await action('/api/auth/request', { email });
    setSent(true);
    setToken('');
    setNotice(result.message);
  }
  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem('');
    setNotice('');
    try {
      if (sent) {
        const verified = await action('/api/auth/verify', { email, token, next });
        setToken('');
        window.location.assign(verified.next);
        return;
      } else await sendCode();
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function claim(family: string) {
    setBusy(true);
    setClaiming(family);
    setProblem('');
    setNotice('');
    try {
      await action('/api/rewards/claim', { family });
      await refresh();
      setNotice('Your code is saved to your account.');
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
      setClaiming('');
    }
  }
  async function logout() {
    setBusy(true);
    setProblem('');
    try {
      await action('/api/auth/logout', {});
      setMember(null);
      setSent(false);
      setToken('');
      setNotice('You are signed out.');
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const organizer = next.startsWith('/admin') || next.startsWith('/organizer');
  return (
    <div className="account-shell">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="account-header">
        <Brand />
        <div className="account-header-actions">
          <a href="/events">Browse events</a>
          {member && (
            <button className="outline" disabled={busy} onClick={logout}>
              Sign out
            </button>
          )}
        </div>
      </header>
      <main id="main" className={member ? 'account-content public-page' : 'access-page'}>
        {loading ? (
          <p role="status">Checking your session…</p>
        ) : member ? (
          <>
            <div className="account-title">
              <div>
                <p className="eyebrow">Private member account</p>
                <h1>My codes</h1>
                <p>{member.email}</p>
              </div>
              {member.is_admin && (
                <a className="primary" href="/admin/members">
                  Open member registry
                </a>
              )}
            </div>
            <MemberNav />
            {notice && (
              <p role="status" className="member-notice">
                {notice}
              </p>
            )}
            {problem && (
              <p role="alert" className="member-error">
                {problem}
              </p>
            )}
            <div className="member-grid">
              <div>
                <section id="my-codes" aria-labelledby="codes-heading" className="panel">
                  <div className="panel-head between">
                    <h2 id="codes-heading">Assigned to you</h2>
                    <span className="badge">
                      {member.rewards.filter((r) => r.code).length}{' '}
                      {member.rewards.filter((r) => r.code).length === 1 ? 'code' : 'codes'}
                    </span>
                  </div>
                  {!member.rewards.some((r) => r.code) ? (
                    <div className="empty">
                      <h3>No codes assigned yet</h3>
                      <p>
                        Assigned codes will appear here. Eligibility and availability are separate from
                        membership.
                      </p>
                    </div>
                  ) : (
                    member.rewards
                      .filter((r) => r.code)
                      .map((reward) => (
                        <article className="reward" key={reward.family}>
                          <div className="between">
                            <div>
                              <h3>{reward.title}</h3>
                              {reward.details?.value && <p>{reward.details.value}</p>}
                            </div>
                            <span className="badge green">Assigned</span>
                          </div>
                          <CopyCode code={reward.code!} />
                          {reward.details?.instructions && <p>{reward.details.instructions}</p>}
                          {reward.details?.deadline && <p>Redeem by {reward.details.deadline}</p>}
                          <div className="reward-foot">
                            <span className="fine-print">
                              {reward.assigned_at && (
                                <>
                                  Assigned {new Date(reward.assigned_at).toLocaleDateString()}
                                  <br />
                                </>
                              )}
                              Redemption status unknown
                            </span>
                            {(reward.details?.redemption_url || reward.family.includes('swag')) && (
                              <a
                                className="btn"
                                href={reward.details?.redemption_url || 'https://supabase.store/'}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Redeem reward ↗
                              </a>
                            )}
                          </div>
                        </article>
                      ))
                  )}
                </section>
                <p className="quiet-note">
                  Keep your codes private. Assignment does not confirm provider redemption.
                </p>
                {member.rewards.some((r) => !r.code) && (
                  <section>
                    <h2>Other offers</h2>
                    {member.rewards
                      .filter((r) => !r.code)
                      .map((reward) => {
                        const available =
                          reward.eligible !== false &&
                          reward.allocation_open &&
                          !['Sold out', 'Expired', 'Not open', 'Blocked'].includes(reward.state ?? '');
                        return (
                          <article className="panel panel-body space-top" key={reward.family}>
                            <div className="between">
                              <h3>{reward.title}</h3>
                              <span className="badge">
                                {available
                                  ? 'Available to claim'
                                  : reward.state === 'Blocked'
                                    ? 'Not eligible'
                                    : reward.state || 'Not available'}
                              </span>
                            </div>
                            <p>{reward.details?.eligibility || 'Available to eligible community members.'}</p>
                            {available ? (
                              <button
                                className="primary"
                                disabled={busy}
                                onClick={() => claim(reward.family)}
                              >
                                {claiming === reward.family ? 'Claiming…' : 'Claim my code'}
                              </button>
                            ) : (
                              <p className="fineprint">
                                {reward.state === 'Sold out'
                                  ? 'All codes have been allocated.'
                                  : reward.state === 'Expired'
                                    ? 'This offer has ended.'
                                    : 'New claims are not available to this account.'}
                              </p>
                            )}
                          </article>
                        );
                      })}
                  </section>
                )}
              </div>
              <aside className="member-aside">
                <section className="panel aside-card">
                  <EventPhoto
                    thumbnail
                    file="restored/helsinki-4M0A6230.webp"
                    alt="Builders sharing a laptop at the Helsinki meetup"
                  />
                  <div className="panel-body">
                    <span className="eyebrow">Between meetups</span>
                    <h2>Keep building together.</h2>
                    <p>Meet other members, ask a question and share what you’re working on.</p>
                    <a className="btn" href="/member/community">
                      Open community ↗
                    </a>
                  </div>
                </section>
                <section className="help-block">
                  <h3>Something missing?</h3>
                  <p>
                    Use the email you registered with. Event registrations and reward eligibility are
                    separate.
                  </p>
                  <a className="text-link" href="/help/report">
                    Get help ↗
                  </a>
                </section>
                <a className="btn" href="/member/projects">
                  Share your project ↗
                </a>
              </aside>
            </div>
          </>
        ) : (
          <section className="access-card">
            <p className="eyebrow">{organizer ? 'Private workspace' : 'Your Supanauts account'}</p>
            <h1>{sent ? 'Check your email' : organizer ? 'Workspace sign-in' : 'Sign in'}</h1>
            <p>
              {sent ? (
                <>
                  If <strong>{email}</strong> has access, a sign-in code is on its way. Enter the latest code
                  here.
                </>
              ) : organizer ? (
                'Use your registered email. Your account permissions determine which workspace opens.'
              ) : (
                'See your assigned codes, event registrations and projects. Use the email you registered with. No password needed.'
              )}
            </p>
            <form className="standard-form" onSubmit={login}>
              <label htmlFor="email">
                {organizer ? 'Workspace email' : 'Registration email'}
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  readOnly={sent}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              {sent && (
                <label htmlFor="token">
                  Code from your email
                  <input
                    id="token"
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6,10}"
                    maxLength={10}
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
                  />
                </label>
              )}
              {problem && (
                <p role="alert" className="member-error">
                  {problem}
                </p>
              )}
              {notice && (
                <p role="status" className="member-notice">
                  {notice}
                </p>
              )}
              <button className="primary" disabled={busy}>
                {busy ? 'Please wait…' : sent ? 'Verify code & continue' : 'Send sign-in code'}
              </button>
              {sent && (
                <div className="actions">
                  <button
                    type="button"
                    className="outline"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setProblem('');
                      setNotice('');
                      try {
                        await sendCode();
                      } catch (e) {
                        setProblem((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Send a new code
                  </button>
                  <button
                    type="button"
                    className="outline"
                    disabled={busy}
                    onClick={() => {
                      setSent(false);
                      setToken('');
                      setNotice('');
                      setProblem('');
                    }}
                  >
                    Use a different email
                  </button>
                </div>
              )}
            </form>
            {sent && (
              <p className="fineprint">
                Check your spam folder. Keep this page open and enter the code in this browser.
              </p>
            )}
            {!organizer && (
              <p>
                New here?{' '}
                <a className="text-link" href="/join">
                  Apply to join the community
                </a>
                .
              </p>
            )}
            <p className="fineprint">
              Your email and codes are private. Signing in does not subscribe you to marketing.
            </p>
          </section>
        )}
      </main>
      {!member && (
        <p className="access-footer">
          <a href="/help/privacy">Privacy</a> · <a href="/help/report">Get help</a>
        </p>
      )}
    </div>
  );
}
