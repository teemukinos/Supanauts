import {choice, field, input, memberId, registryError, registryRpc} from '../../../../../../lib/member-registry-server';
export async function PUT(req: Request, context: {params: Promise<{id: string}>}) {
  try {
    const p = await input(req);
    return await registryRpc('community_admin_set_eligibility', {
      p_id: memberId((await context.params).id), p_family: field(p.family, 100, true),
      p_mode: choice(p.mode, ['default', 'allow', 'block']), p_reason: field(p.reason, 1000, true),
    });
  } catch (error) { return registryError(error); }
}
