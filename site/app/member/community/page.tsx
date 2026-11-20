'use client';
import MemberNav from '../member-nav';
import { request } from '../../../components/app/ui';
import '../../account.css';
import { useEffect, useState } from 'react';
type Channels = { community?: string; announcements?: string; builders?: string };
export default function MemberCommunity() {
  const [links, setLinks] = useState<Channels | null>(null),
    [agreed, setAgreed] = useState(false),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    setError('');
    setLinks(null);
    setAgreed(false);
    try {
      const d = await request<{ whatsapp: Channels }>('/api/community/channels');
      setLinks(d.whatsapp);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    const restore = () => {
      void load();
    };
    window.addEventListener('sessionrestored', restore);
    return () => window.removeEventListener('sessionrestored', restore);
  }, []);
  return (
    <div className="account-shell">
      <main id="main" className="account-content public-page">
        <MemberNav />
        <section>
          <p className="eyebrow">FOR SUPANAUTS MEMBERS</p>
          <h1>Supanauts WhatsApp</h1>
          <p>Meetup announcements, projects and conversations with other builders.</p>
          {loading ? (
            <p role="status">Checking access…</p>
          ) : error ? (
            <>
              <p role="alert">{error}</p>
              <button className="outline" onClick={load}>
                Try again
              </button>
            </>
          ) : (
            links && (
              <>
                <label className="check">
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />I
                  understand other group participants may see my phone number.
                </label>
                {agreed ? (
                  <div className="actions">
                    {Object.entries(links)
                      .filter(([, value]) => value)
                      .map(([key, value]) => (
                        <a key={key} className="primary" href={value} target="_blank" rel="noreferrer">
                          {key === 'community'
                            ? 'Join Supanauts on WhatsApp'
                            : key === 'announcements'
                              ? 'Join announcements'
                              : 'Join builders'}{' '}
                          ↗
                        </a>
                      ))}
                    {!Object.values(links).some(Boolean) && <p>The invitation is not available yet.</p>}
                  </div>
                ) : (
                  <p className="fineprint">
                    Acknowledge phone visibility to reveal the invitation. Joining is optional.
                  </p>
                )}
              </>
            )
          )}
        </section>
      </main>
    </div>
  );
}
