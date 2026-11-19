import { json, memberClient } from '../../../../lib/community';
export async function GET() {
  try {
    const client = await memberClient();
    if (!client) return json({ error: 'Sign in to continue.' }, 401);
    const { data, error } = await client.rpc('community_access');
    if (error)
      return json(
        { error: 'Account access could not be checked.' },
        error.message.includes('INELIGIBLE') ? 403 : 503,
      );
    return json(data);
  } catch {
    return json({ error: 'Account service unavailable. Try again.' }, 503);
  }
}
