'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Gift,
  CalendarDays,
  Folder,
  Users,
  Inbox,
  LayoutDashboard,
  FileText,
  Mail,
  Megaphone,
  Flag,
  ChartNoAxesCombined,
  Settings,
  MessageCircle,
  UserRound,
  ArrowUpRight,
  ShieldCheck,
  ChevronRight,
  PanelLeft,
  X,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { Brand } from '../../app/community-ui';
import { ThemePicker } from './theme';
import { Loading, Modal } from './ui';
export type Access = {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
  is_organizer: boolean;
  verified: boolean;
  event_ids: string[];
};
const memberLinks: [string, string, LucideIcon][] = [
  ['/member', 'My codes', Gift],
  ['/member/events', 'My events', CalendarDays],
  ['/member/projects', 'My projects', Folder],
  ['/member/community', 'Community', MessageCircle],
  ['/member/profile', 'Profile', UserRound],
];
const adminLinks: [string, string, LucideIcon][] = [
  ['/admin', 'Overview', LayoutDashboard],
  ['/admin/members', 'Members', Users],
  ['/admin/codes', 'Codes', Gift],
  ['/admin/requests', 'Join requests', Inbox],
  ['/admin/projects', 'Projects', Folder],
  ['/admin/events', 'Events', CalendarDays],
  ['/admin/updates', 'Updates', FileText],
  ['/admin/imports', 'Imports', Inbox],
  ['/admin/notifications', 'Notifications', Mail],
  ['/admin/shares', 'Share approvals', Megaphone],
  ['/admin/reports', 'Reports', Flag],
  ['/admin/activity', 'Activity', ChartNoAxesCombined],
  ['/admin/rewards', 'Reward offers', Gift],
  ['/admin/settings', 'Settings', Settings],
];
export default function AppFrame({ children }: { children: ReactNode }) {
  const path = usePathname();
  const privatePage = /^\/(member|admin|organizer)(\/|$)/.test(path);
  const [access, setAccess] = useState<Access | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [drawer, setDrawer] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const previousAccess = useRef<Access | null>(null);
  const [expired, setExpired] = useState(false);
  async function check() {
    setError('');
    try {
      const response = await fetch('/api/access/session', { cache: 'no-store' });
      const data = await response.json();
      if (response.status === 401 && previousAccess.current) {
        setExpired(true);
        return;
      }
      if (response.status === 401 || response.status === 403) {
        setAccess(null);
        previousAccess.current = null;
        setExpired(false);
      } else if (!response.ok) throw Error(data.error);
      else {
        setAccess(data);
        previousAccess.current = data;
        setExpired(false);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (privatePage) void check();
    const refresh = () => void check();
    window.addEventListener('sessionchange', refresh);
    return () => window.removeEventListener('sessionchange', refresh);
  }, [privatePage]);
  useEffect(() => {
    setDrawer(false);
  }, [path]);
  useEffect(() => {
    if (drawer) dialog.current?.showModal();
  }, [drawer]);
  const role = path.startsWith('/admin')
    ? 'Admin'
    : path.startsWith('/organizer')
      ? 'Organizer'
      : 'My account';
  const links =
    role === 'Admin'
      ? adminLinks
      : role === 'Organizer'
        ? [['/organizer/events', 'My events', CalendarDays] as [string, string, LucideIcon]]
        : memberLinks;
  const current =
    links
      .filter(
        ([href]) => path === href || (href !== '/member' && href !== '/admin' && path.startsWith(href + '/')),
      )
      .at(-1)?.[1] || 'Workspace';
  useEffect(() => {
    if (privatePage) document.title = current + ' — Supanauts';
  }, [current, privatePage]);
  const signIn =
    '/member?next=' +
    encodeURIComponent(path + (typeof window === 'undefined' ? '' : window.location.search));
  const forbidden =
    access &&
    ((role === 'Admin' && !access.is_admin) ||
      (role === 'Organizer' && !access.is_admin && !access.is_organizer));
  async function logout() {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) throw Error('Could not sign out. Try again.');
      window.location.assign('/member');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function sidebar() {
    return (
      <aside className="sidebar">
        <Brand />
        <label className="workspace">
          <span className="sr-only">Workspace</span>
          <select
            aria-label="Workspace"
            value={role}
            onChange={(e) =>
              window.location.assign(
                e.target.value === 'Admin'
                  ? '/admin'
                  : e.target.value === 'Organizer'
                    ? '/organizer/events'
                    : '/member',
              )
            }
          >
            <option>My account</option>
            {(access?.is_organizer || access?.is_admin) && <option>Organizer</option>}
            {access?.is_admin && <option>Admin</option>}
          </select>
        </label>
        <nav aria-label={role + ' navigation'}>
          {links.map(([href, label, Icon], index) => (
            <div key={href}>
              {role === 'Admin' && [4, 7].includes(index) && (
                <div className="nav-label">{index === 4 ? 'Publishing' : 'Operations'}</div>
              )}
              <Link
                className={'nav-item ' + (current === label ? 'active' : '')}
                aria-current={current === label ? 'page' : undefined}
                href={href}
              >
                <Icon size={18} />
                {label}
              </Link>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link className="nav-item" href="/">
            <ArrowUpRight size={17} />
            Community website
          </Link>
          <ThemePicker />
          <div className="line" />
          <div className="account">
            <span className="avatar">{(access?.name || access?.email || '').slice(0, 2).toUpperCase()}</span>
            <span className="stack">
              <strong>{access?.name || access?.email}</strong>
              <small>{role}</small>
            </span>
            <button className="btn icon quiet" aria-label="Sign out" onClick={logout}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    );
  }
  if (!privatePage) return <div className="public-surface">{children}</div>;
  if (loading)
    return (
      <div className="private-surface">
        <main className="auth-page">
          <Brand />
          <Loading />
        </main>
      </div>
    );
  if (!access)
    return (
      <div className="private-surface">
        {path === '/member' ? (
          children
        ) : (
          <main id="main" className="auth-page">
            <Brand />
            <h1>{error ? 'Account unavailable' : 'Sign in to continue'}</h1>
            <p>{error || 'Use your registration email to open your private workspace.'}</p>
            {error ? (
              <button className="btn primary" onClick={check}>
                Try again
              </button>
            ) : (
              <Link className="btn primary" href={signIn}>
                Sign in
              </Link>
            )}
          </main>
        )}
      </div>
    );
  return (
    <div className="private-surface">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="shell">
        {sidebar()}
        <div className="main-column">
          <header className="topbar">
            <div className="crumbs">
              <button
                className="btn icon quiet mobile-only"
                aria-label="Open navigation"
                onClick={() => setDrawer(true)}
              >
                <PanelLeft size={18} />
              </button>
              <span>{role}</span>
              <ChevronRight size={13} />
              <strong>{current}</strong>
            </div>
            <span className="badge">
              <ShieldCheck size={12} />
              Private workspace
            </span>
          </header>
          <div className="content">
            {error && (
              <p role="alert" className="member-error">
                {error}
              </p>
            )}
            {forbidden ? (
              <main id="main">
                <h1>Access restricted</h1>
                <p>Your account cannot open this workspace.</p>
                <Link className="btn" href="/member">
                  View my codes
                </Link>
              </main>
            ) : (
              children
            )}
          </div>
        </div>
      </div>
      {expired && (
        <Modal dismissible={false} title="Your session expired" onClose={() => {}}>
          <p>Sign in again in a new tab. Your unsaved edits stay on this page.</p>
          <div className="actions">
            <a className="btn primary" href="/member" target="_blank" rel="noopener">
              Sign in again
            </a>
            <button className="btn" onClick={check}>
              I’ve signed in — continue
            </button>
          </div>
        </Modal>
      )}
      {drawer && (
        <dialog ref={dialog} className="drawer" aria-label="Navigation" onCancel={() => setDrawer(false)}>
          <button
            className="btn icon close-drawer"
            aria-label="Close navigation"
            onClick={() => setDrawer(false)}
          >
            <X size={18} />
          </button>
          {sidebar()}
        </dialog>
      )}
    </div>
  );
}
