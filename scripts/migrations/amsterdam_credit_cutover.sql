-- Apply ONLY to the legacy supabase-skene-hackathon project, after reconciliation.
-- The table lock waits for active allocations; the trigger also blocks callers
-- that started the old function before this transaction committed.
begin;
lock table public.amsterdam_scratch_codes in access exclusive mode;
create function public.amsterdam_credits_moved() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'CREDITS_MOVED_TO_SUPANAUTS';end;$$;
revoke all on function public.amsterdam_credits_moved() from public,anon,authenticated;
create trigger amsterdam_credits_frozen before insert or update or delete on public.amsterdam_scratch_codes for each row execute function public.amsterdam_credits_moved();
create or replace function public.claim_amsterdam_code(p_email text,p_key text) returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('status','closed','url','https://supanauts-git-feat-initial-application-tkinos.vercel.app/member');
$$;
commit;
