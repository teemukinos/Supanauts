'use client';

import {useEffect, useState, type FormEvent} from 'react';
import Dashboard from './dashboard';
import {Brand, SiteFooter} from '../community-ui';
import MemberNav from './member-nav';
import {safeNext} from '../../lib/validation';
import '../account.css';

type Reward = {family: string; title: string; code: string | null; assigned_at: string | null; allocation_open: boolean; eligible?: boolean; state?: string; details?: {eligibility?: string; value?: string; instructions?: string; redemption_url?: string; deadline?: string}};
type Account = {email: string; rewards: Reward[]; is_admin?: boolean};
export default function Member() {
  const [email, setEmail] = useState(''), [token, setToken] = useState(''), [next, setNext] = useState('/member');
  const [sent, setSent] = useState(false), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(''), [problem, setProblem] = useState('');
  const [member, setMember] = useState<Account | null>(null), [copied, setCopied] = useState('');
  const [claiming, setClaiming] = useState('');
  async function refresh() {
    const response = await fetch('/api/rewards/mine', {cache: 'no-store'});
    const data = await response.json();
    if (response.ok) {
      setMember(data);
      const destination = safeNext(new URLSearchParams(window.location.search).get('next'));
      if (destination !== '/member') window.location.assign(destination);
    } else {setMember(null); if (response.status !== 401) setProblem(data.error);}
    setLoading(false);
  }
  useEffect(() => {
    setNext(safeNext(new URLSearchParams(window.location.search).get('next')));
    refresh().catch(() => {setProblem('Could not load your account. Please refresh.'); setLoading(false);});
  }, []);
  async function action(path: string, data: object) {
    const response = await fetch(path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Please try again.');
    return result;
  }
  async function sendCode() {
    const result = await action('/api/auth/request', {email});
    setSent(true); setToken(''); setNotice(result.message);
  }
  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setProblem(''); setNotice('');
    try {
      if (sent) {
        const verified = await action('/api/auth/verify', {email, token, next});
        setToken('');
        if (verified.next !== '/member') {window.location.assign(verified.next); return;}
        await refresh();
      } else await sendCode();
    } catch (e) {setProblem((e as Error).message);} finally {setBusy(false);}
  }
  async function claim(family: string) {
    setBusy(true); setClaiming(family); setProblem(''); setNotice('');
    try {await action('/api/rewards/claim', {family}); await refresh(); setNotice('Your code is saved to your account.');}
    catch (e) {setProblem((e as Error).message);} finally {setBusy(false); setClaiming('');}
  }
  async function logout() {
    setBusy(true); setProblem('');
    try {await action('/api/auth/logout', {}); setMember(null); setSent(false); setToken(''); setNotice('You are signed out.');}
    catch (e) {setProblem((e as Error).message);} finally {setBusy(false);}
  }
  const organizer = next.startsWith('/admin');
  return <div className="account-shell">
    <a className="skip" href="#main">Skip to content</a>
    <header className="account-header"><Brand/><div className="account-header-actions"><a href="/events">Browse events</a>{member && <button className="outline" disabled={busy} onClick={logout}>Sign out</button>}</div></header>
    <main id="main" className={member ? 'account-content public-page' : 'access-page'}>
      {loading ? <p role="status">Checking your session…</p> : member ? <>
        <div className="account-title"><div><p className="eyebrow">Private member account</p><h1>My account</h1><p>{member.email}</p></div>{member.is_admin && <a className="primary" href="/admin/members">Open member registry</a>}</div>
        <MemberNav/>
        {notice && <p role="status" className="member-notice">{notice}</p>}
        {problem && <p role="alert" className="member-error">{problem}</p>}
        <section id="my-codes" aria-labelledby="codes-heading"><h2 id="codes-heading">My codes & rewards</h2><p>Codes assigned to you stay here. Only you and organizers can see them.</p>
          {!member.rewards.length ? <div className="channel-card"><h3>No rewards yet</h3><p>Your account is ready. Assigned codes and available rewards will appear here.</p></div> : <div className="account-rewards">{member.rewards.map(reward => {
            const available = reward.eligible !== false && reward.allocation_open && !['Sold out', 'Expired', 'Not open', 'Blocked'].includes(reward.state ?? '');
            return <article className="channel-card account-reward" key={reward.family}>
              <span className="account-badge">{reward.code ? 'Assigned to you' : available ? 'Available to claim' : 'Not available'}</span>
              <h3>{reward.title}</h3>{reward.details?.value && <p>{reward.details.value}</p>}
              {reward.code ? <><code className="reward-code" aria-label="Your assigned code">{reward.code}</code><div className="actions"><button className="primary" onClick={async () => {try {await navigator.clipboard.writeText(reward.code!); setCopied(reward.family);} catch {setProblem('Copy unavailable. Select the code to copy it.');}}}>{copied === reward.family ? 'Copied' : 'Copy code'}</button>{(reward.details?.redemption_url || reward.family.includes('swag')) && <a className="outline" href={reward.details?.redemption_url || 'https://supabase.store/'} target="_blank" rel="noreferrer">Redeem reward ↗</a>}</div>
                {reward.details?.instructions && <p>{reward.details.instructions}</p>}{reward.details?.deadline && <p>Redeem by {reward.details.deadline}</p>}
                <p className="fineprint">{reward.assigned_at && <>Assigned {new Date(reward.assigned_at).toLocaleDateString()}. </>}Assignment does not confirm redemption.</p>
              </> : <><p>{reward.details?.eligibility || 'An offer available to eligible members.'}</p><p>{reward.state === 'Blocked' ? 'This reward is not available to your account.' : reward.state === 'Sold out' ? 'All codes have been claimed.' : reward.state === 'Expired' ? 'This offer has ended.' : available ? 'Claim once. Your code will be saved here.' : 'New claims are not open for your account.'}</p>{available && <button className="primary" disabled={busy} onClick={() => claim(reward.family)}>{claiming === reward.family ? 'Claiming…' : 'Claim my code'}</button>}</>}
            </article>;
          })}</div>}
        </section>
        <Dashboard/>
      </> : <section className="access-card">
        <p className="eyebrow">{organizer ? 'Private organizer area' : 'Your Supanauts account'}</p>
        <h1>{sent ? 'Check your email' : organizer ? 'Organizer sign-in' : 'Sign in'}</h1>
        <p>{sent ? <>If <strong>{email}</strong> has access, a sign-in code is on its way. Enter the latest code here.</> : organizer ? 'Use your organizer email. After email verification, you will continue to the private organizer area.' : 'See your assigned codes, event registrations and projects. Use the email you registered with. No password needed.'}</p>
        <form className="standard-form" onSubmit={login}>
          <label htmlFor="email">{organizer ? 'Organizer email' : 'Registration email'}<input id="email" type="email" autoComplete="email" required value={email} readOnly={sent} onChange={e => setEmail(e.target.value)}/></label>
          {sent && <label htmlFor="token">Code from your email<input id="token" autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" maxLength={10} required value={token} onChange={e => setToken(e.target.value.replace(/\D/g, ''))}/></label>}
          {problem && <p role="alert" className="member-error">{problem}</p>}
          {notice && <p role="status" className="member-notice">{notice}</p>}
          <button className="primary" disabled={busy}>{busy ? 'Please wait…' : sent ? 'Verify code & continue' : 'Send sign-in code'}</button>
          {sent && <div className="actions"><button type="button" className="outline" disabled={busy} onClick={async () => {setBusy(true); setProblem(''); setNotice(''); try {await sendCode();} catch (e) {setProblem((e as Error).message);} finally {setBusy(false);}}}>Send a new code</button><button type="button" className="outline" disabled={busy} onClick={() => {setSent(false); setToken(''); setNotice(''); setProblem('');}}>Use a different email</button></div>}
        </form>
        {sent && <p className="fineprint">Check your spam folder. Keep this page open and enter the code in this browser.</p>}
        {!organizer && <p>New here? <a className="text-link" href="/join">Apply to join the community</a>.</p>}
        <p className="fineprint">Your email and codes are private. Signing in does not subscribe you to marketing.</p>
      </section>}
    </main><SiteFooter/>
  </div>;
}
