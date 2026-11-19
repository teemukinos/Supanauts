import {field, input, memberId, RegistryInputError, registryError, registryRpc} from '../../../../../lib/member-registry-server';
type Context = {params: Promise<{id: string}>};
export async function GET(_req: Request, context: Context) {
  try { return await registryRpc('community_admin_member', {p_id: memberId((await context.params).id)}); }
  catch (error) { return registryError(error); }
}
export async function PATCH(req: Request, context: Context) {
  try {
    const p = await input(req);
    if (typeof p.active !== 'boolean') throw new RegistryInputError('Choose active or suspended access.');
    return await registryRpc('community_admin_set_member_active', {
      p_id: memberId((await context.params).id), p_active: p.active, p_reason: field(p.reason, 1000, true),
    });
  } catch (error) { return registryError(error); }
}
