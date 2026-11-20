// Only known local destinations may be used after email sign-in.
export function safeNext(value: unknown) {
  if (typeof value !== 'string') return '/member';
  if (value.startsWith('//') || value.includes('\\')) return '/member';
  const [path, query = ''] = value.split('?');
  const allowed =
    /^\/admin(?:\/(?:members|codes|requests|workspace|projects|events|updates|imports|notifications|shares|reports|activity|settings|rewards))?$/.test(
      path,
    ) ||
    [
      '/member',
      '/member/profile',
      '/member/community',
      '/member/events',
      '/member/projects',
      '/member/projects/new',
    ].includes(path) ||
    path === '/projects/new' ||
    /^\/organizer\/events(?:\/[a-f0-9-]{36})?$/.test(path);
  if (!allowed) return '/member';
  const params = new URLSearchParams(query);
  const clean = new URLSearchParams();
  for (const key of ['id', 'member']) {
    const id = params.get(key);
    if (id && /^[a-f0-9-]{36}$/.test(id)) clean.set(key, id);
  }
  if (params.get('id') === 'new' && ['/admin/events', '/admin/updates'].includes(path)) clean.set('id', 'new');
  const tab = params.get('tab');
  if (tab && ['overview', 'participants', 'draft'].includes(tab)) clean.set('tab', tab);
  const page = params.get('page');
  if (page && /^[1-9][0-9]{0,4}$/.test(page)) clean.set('page', page);
  for (const key of ['search', 'event', 'family', 'status', 'assignment', 'view']) {
    const value = params.get(key);
    if (value && value.length <= 254) clean.set(key, value);
  }
  return path + (clean.size ? '?' + clean : '');
}
export function text(value: unknown, max = 5000) {
  if (typeof value !== 'string' || value.length > max) throw Error('Invalid text.');
  return value.trim();
}
export function url(value: unknown) {
  if (!value) return '';
  const v = text(value, 1000);
  const u = new URL(v);
  if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password)
    throw Error('Use a public HTTP or HTTPS link.');
  return u.toString();
}
export function uuid(value: unknown) {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
    throw Error('Invalid identifier.');
  return value;
}
export function projectPayload(p: Record<string, unknown>) {
  const title = text(p.title, 120),
    description = text(p.description);
  if (title.length < 3 || description.length < 20)
    throw Error('Add a title and at least 20 characters describing your project.');
  const media = Array.isArray(p.media) ? p.media.map(uuid) : [];
  if (media.length > 6) throw Error('Maximum six files.');
  return {
    title,
    description,
    maker: text(p.maker, 100),
    maker_link: url(p.maker_link),
    demo_url: url(p.demo_url),
    repository_url: url(p.repository_url),
    event: text(p.event, 150),
    technologies: text(p.technologies, 300),
    learned: text(p.learned, 2000),
    help: text(p.help, 1000),
    display_permission: p.display_permission === true,
    promotion_permission: p.promotion_permission === true,
    media,
  };
}
export function contentPayload(p: Record<string, unknown>) {
  const title = text(p.title, 120),
    description = text(p.description, 500),
    body = text(p.body, 20000);
  if (title.length < 3 || description.length < 10) throw Error('Title and summary required.');
  const start = p.starts_at ? text(p.starts_at, 60) : '',
    end = p.ends_at ? text(p.ends_at, 60) : '';
  if (
    (start && !Number.isFinite(Date.parse(start))) ||
    (end && !Number.isFinite(Date.parse(end))) ||
    (start && end && Date.parse(end) <= Date.parse(start))
  )
    throw Error('Invalid event dates.');
  const timezone = p.timezone ? text(p.timezone, 100) : 'Europe/Helsinki';
  new Intl.DateTimeFormat('en', { timeZone: timezone });
  return {
    title,
    description,
    body,
    media: Array.isArray(p.media) ? p.media.slice(0, 12).map(uuid) : [],
    date_label: text(p.date_label || '', 100),
    city: text(p.city || '', 100),
    starts_at: start,
    ends_at: end,
    timezone,
    venue: text(p.venue || '', 200),
    registration_url: url(p.registration_url),
    cancelled: p.cancelled === true,
    promotion_permission: p.promotion_permission === true,
    resources: Array.isArray(p.resources)
      ? p.resources.slice(0, 30).map((x) => ({ title: text(x.title, 120), url: url(x.url) }))
      : [],
    supporters: Array.isArray(p.supporters)
      ? p.supporters
          .slice(0, 30)
          .map((x) => ({ name: text(x.name, 100), role: text(x.role, 150), url: url(x.url) }))
      : [],
  };
}
