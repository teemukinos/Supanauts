import { json, memberClient, sameOrigin } from '../../../../lib/community';
import { contentPayload, text, uuid } from '../../../../lib/validation';
const sections = [
  'overview',
  'projects',
  'events',
  'updates',
  'imports',
  'codes',
  'settings',
  'shares',
  'notifications',
  'reports',
  'rewards',
];
function failure(message: string) {
  const known: Record<string, [number, string]> = {
    FORBIDDEN: [403, 'You do not have access to this workspace.'],
    INELIGIBLE: [403, 'Your membership is not active.'],
    NOT_FOUND: [404, 'This record is unavailable.'],
    STALE_VERSION: [409, 'Someone changed this draft. Reload the saved version before retrying.'],
    FORBIDDEN_MEDIA: [403, 'This attachment is not available to this event.'],
  };
  const match = Object.entries(known).find(([key]) => message.includes(key));
  return match
    ? json({ error: match[1][1], code: match[0] }, match[1][0])
    : json({ error: 'Could not complete this request. Check your fields and try again.' }, 400);
}
export async function GET(req: Request, { params }: { params: Promise<{ operation: string }> }) {
  try {
    const c = await memberClient();
    if (!c) return json({ error: 'Sign in to continue.' }, 401);
    const { operation } = await params;
    const q = new URL(req.url).searchParams;
    const page = Math.max(1, Math.min(100000, Number(q.get('page')) || 1));
    const search = text(q.get('search') || '', 254);
    let result;
    if (operation === 'events')
      result = await c.rpc('community_event_workspace', {
        p_event: q.get('id') ? uuid(q.get('id')) : null,
        p_page: page,
        p_search: search,
      });
    else if (operation === 'admin') {
      const section = q.get('section') || 'overview';
      if (!sections.includes(section)) return json({ error: 'Not found.' }, 404);
      result = await c.rpc('community_admin_screen', { p_section: section, p_page: page, p_search: search });
      if (!result.error && section === 'notifications')
        result.data.dispatch_enabled =
          process.env.NOTIFICATIONS_ENABLED === 'true' &&
          !!process.env.RESEND_API_KEY &&
          !!process.env.EMAIL_FROM;
    } else return json({ error: 'Not found.' }, 404);
    return result.error ? failure(result.error.message) : json(result.data);
  } catch {
    return json({ error: 'Workspace unavailable. Please retry.' }, 503);
  }
}
export async function POST(req: Request, { params }: { params: Promise<{ operation: string }> }) {
  try {
    if (!sameOrigin(req)) return json({ error: 'Invalid request origin.' }, 403);
    const c = await memberClient();
    if (!c) return json({ error: 'Sign in to continue.' }, 401);
    const raw = await req.text();
    if (raw.length > 60000) return json({ error: 'Request too large.' }, 413);
    const p = JSON.parse(raw);
    const { operation } = await params;
    let result;
    if (operation === 'event-save') {
      if (!Number.isInteger(p.version) || p.version < 1) throw Error('INVALID_INPUT');
      result = await c.rpc('community_event_save', {
        p_event: uuid(p.id),
        p_version: p.version,
        p_data: contentPayload(p.data),
        p_evidence: text(p.evidence || '', 5000),
        p_submit: p.submit === true,
      });
    } else if (operation === 'event-admin') {
      if (!['assign', 'revoke', 'map'].includes(p.action)) throw Error('INVALID_INPUT');
      const data = {
        event_id: uuid(p.event_id),
        ...(p.action === 'map' ? { label: text(p.label, 200) } : { member_id: uuid(p.member_id) }),
      };
      result = await c.rpc('community_event_admin', { p_action: p.action, p_data: data });
    } else return json({ error: 'Not found.' }, 404);
    return result.error ? failure(result.error.message) : json(result.data);
  } catch (e) {
    return failure(e instanceof Error ? e.message : 'Invalid request.');
  }
}
