import 'server-only';
import {json, memberClient, sameOrigin} from './community';

export class RegistryInputError extends Error {}
export function field(value: unknown, max: number, required = false): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new RegistryInputError('Check the required fields and text lengths.');
  }
  return value.trim();
}
export function memberId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new RegistryInputError('Invalid member identifier.');
  }
  return value;
}
export function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) throw new RegistryInputError('Invalid selection.');
  return value as T;
}
export async function input(req: Request): Promise<Record<string, unknown>> {
  if (!sameOrigin(req)) throw new RegistryInputError('Invalid request origin.');
  if (!req.headers.get('content-type')?.startsWith('application/json')) throw new RegistryInputError('Expected JSON.');
  const raw = await req.text();
  if (raw.length > 4096) throw new RegistryInputError('Request is too large.');
  let data: unknown;
  try { data = JSON.parse(raw); } catch { throw new RegistryInputError('Invalid JSON.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new RegistryInputError('Expected an object.');
  return data as Record<string, unknown>;
}
export async function registryRpc(name: string, args: Record<string, unknown>) {
  const client = await memberClient();
  if (!client) return json({error: 'Sign in as organizer first.'}, 401);
  // Every RPC independently checks active membership, organizer role and AAL2.
  const {data, error} = await client.rpc(name, args);
  if (error) {
    const errors: Record<string, [number, string]> = {
      UNAUTHENTICATED: [401, 'Sign in as organizer first.'],
      UNVERIFIED: [401, 'Verify your email first.'],
      INELIGIBLE: [403, 'Organizer access is unavailable.'],
      FORBIDDEN: [403, 'Organizer access is required.'],
      MFA_REQUIRED: [403, 'Verify your authenticator at the organizer page first.'],
      NOT_FOUND: [404, 'Member not found.'],
      INVALID_INPUT: [400, 'Check the submitted fields.'],
      PROTECTED_ORGANIZER: [409, 'Organizer accounts cannot be suspended here.'],
    };
    const known = errors[error.message];
    if (known) return json({error: known[1]}, known[0]);
    return json({error: 'Registry is unavailable. Refresh before retrying.'}, 503);
  }
  if (name === 'community_admin_set_member_active' || name === 'community_admin_set_eligibility') return json({ok: true});
  return json(data);
}
export function registryError(error: unknown) {
  return error instanceof RegistryInputError
    ? json({error: error.message}, 400)
    : json({error: 'Registry is temporarily unavailable.'}, 503);
}
