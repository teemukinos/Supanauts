'use client';
import { useState, type FormEvent } from 'react';
import { SiteHeader, SiteFooter } from '../community-ui';
export default function Join() {
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [message, setMessage] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const r = await fetch('/api/access/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      const d = await r.json();
      setMessage(d.message || d.error);
      setDone(r.ok);
    } catch {
      setMessage('Could not save your request. Please retry.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-page join-page">
        <section className="member-card">
          <p className="eyebrow">GOOD PEOPLE. SHARED CURIOSITY.</p>
          <h1>Join the community.</h1>
          <p>
            Registered for one of our events?{' '}
            <a href="/member">
              <u>You can sign in already.</u>
            </a>
          </p>
          <p>
            New here? Tell us a little about yourself. Teemu approves new members before they can sign in. We
            aim to review applications within two working days.
          </p>
          {!done && (
            <form onSubmit={submit}>
              <label htmlFor="name">Your name</label>
              <input id="name" name="name" autoComplete="name" required maxLength={100} />
              <label htmlFor="email">Your email</label>
              <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
              <label htmlFor="reason">What are you building or hoping to learn?</label>
              <textarea id="reason" name="reason" required minLength={10} maxLength={1000} rows={4} />
              <button className="primary" disabled={busy}>
                {busy ? 'Sending…' : 'Ask to join'}
              </button>
            </form>
          )}
          {message && <p role="status">{message}</p>}
          <p className="fineprint">
            Approval grants community access. Giveaways have separate eligibility. This request does not
            subscribe you to marketing. Contact teemu@skene.ai if you need help with your application.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
