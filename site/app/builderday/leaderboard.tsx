'use client';

import {useEffect, useState} from 'react';
import {cities, type Leaderboard} from '../../lib/builderday';

export default function LeaderboardView() {
  const [data, setData] = useState<Leaderboard | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch('/api/builderday', {cache: 'no-store'});
        if (!response.ok) throw new Error('Unavailable');
        const next: Leaderboard = await response.json();
        if (!active) return;
        if (next.cities.every(city => city.count === null)) throw new Error('Unavailable');
        setData(next); setFailed(false);
      } catch { if (active) setFailed(true); }
    };
    void refresh();
    const timer = window.setInterval(refresh, 300_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const rows = (data?.cities || cities.map(city => ({...city, count: null}))).slice().sort((a,b) => a.count === null ? (b.count === null ? a.city.localeCompare(b.city) : 1) : b.count === null ? -1 : b.count - a.count || a.city.localeCompare(b.city));
  const known = rows.filter(row => row.count !== null);
  const total = known.reduce((sum, row) => sum + (row.count ?? 0), 0);
  const incomplete = known.length < cities.length;
  return <div className="bd-board">
    <div className="bd-score"><div><p className="bd-label"><span className="bd-dot"/> BUILDER DAY / DEC 10, 2026</p><h1>ONE DAY.<br/><em>14 CITIES.</em></h1><p className="bd-intro">A worldwide 90-minute build. Find your city and join the people making it happen.</p><a className="bd-button" href="#city-rankings">Find your city <span aria-hidden="true">↘</span></a></div><div className="bd-total"><span className="bd-label">BUILDERS GOING {incomplete && known.length > 0 ? ' / PARTIAL TOTAL' : ''}</span><strong>{known.length ? total.toLocaleString('en-US') : '—'}{known.length > 0 && incomplete ? '+' : ''}</strong><span>across {known.length} of 14 cities with public counts</span><small>{data ? `Checked ${new Date(data.updatedAt).toLocaleString(undefined, {dateStyle:'medium',timeStyle:'short'})}` : failed ? 'Counts temporarily unavailable' : 'Checking Luma counts…'}{failed && data ? ' · Refresh failed; showing last result' : ''}</small></div></div>
    <div className="bd-bar"><span>14 CITIES</span><span>90 MINUTES</span><span>ONE GLOBAL BUILD</span></div>
    <section id="city-rankings" className="bd-rankings"><div className="bd-heading"><div><p className="bd-label">THE GLOBAL RACE / LIVE PUBLIC COUNTS</p><h2>CITY<br/><em>LEADERBOARD.</em></h2></div><p>Every city is building together.<br/>Find your crew and take your place.</p></div><p className="bd-note">Counts show Luma’s public “Going” figures, not actual attendance. {incomplete ? 'Ranking and total include only cities with visible counts.' : 'All 14 city counts are available.'} Updates are checked every five minutes.</p><div className="bd-list">{rows.map((row,index) => { const rank = row.count === null ? null : rows.findIndex(other => other.count === row.count) + 1; return <a className={'bd-row'+(rank === 1 ? ' bd-first' : '')} href={row.url} target="_blank" rel="noreferrer" key={row.city}><span className="bd-rank">{rank === null ? '—' : String(rank).padStart(2,'0')}</span><span className="bd-city">{row.city}{rank === 1 && <small>{incomplete ? 'LEADING VISIBLE CITIES' : 'POLE POSITION'}</small>}</span><span className="bd-count">{row.count === null ? 'Count unavailable' : `${row.count.toLocaleString('en-US')} going`}</span><span className="bd-link">Register <span aria-hidden="true">↗</span></span></a>;})}</div><p className="bd-note">Counts come from public Luma pages. Pending requests and hidden guest counts may not appear. <a href="https://luma.com/supabase_community_events" target="_blank" rel="noreferrer">View the organizer’s calendar ↗</a></p></section>
  </div>;
}
