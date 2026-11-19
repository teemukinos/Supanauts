import {email} from '../../../../lib/community';
import {choice, field, input, RegistryInputError, registryError, registryRpc} from '../../../../lib/member-registry-server';

export async function GET(req: Request) {
  try {
    const p = new URL(req.url).searchParams;
    const page = Number(p.get('page') ?? 1);
    if (!Number.isInteger(page) || page < 1 || page > 100000) throw new RegistryInputError('Invalid page.');
    return await registryRpc('community_admin_members', {
      p_search: field(p.get('search') ?? '', 254), p_event: field(p.get('event') ?? '', 200),
      p_family: field(p.get('family') ?? '', 100), p_page: page,
      p_status: choice(p.get('status') ?? 'all', ['all', 'active', 'suspended']),
      p_assignment: choice(p.get('assignment') ?? 'all', ['all', 'assigned', 'unassigned']),
      p_view: choice(p.get('view') ?? 'members', ['members', 'reservations']),
    });
  } catch (error) { return registryError(error); }
}
export async function POST(req: Request) {
  try {
    const p = await input(req), address = email(p.email);
    if (!address) throw new RegistryInputError('Enter a valid email address.');
    return await registryRpc('community_admin_create_member', {
      p_email: address, p_name: field(p.name ?? '', 100), p_reason: field(p.reason, 1000, true),
    });
  } catch (error) { return registryError(error); }
}
