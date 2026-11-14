-- Private data is never exposed through the REST table API.
create schema if not exists community_private;
revoke all on schema community_private from public, anon, authenticated;
create table community_private.members (
 id uuid primary key default gen_random_uuid(),
 email text not null unique check (email=lower(btrim(email))),
 auth_user_id uuid unique references auth.users(id),
 active boolean not null default true,
 source text not null,
 created_at timestamptz not null default now()
);
create table community_private.registrations (
 member_id uuid not null references community_private.members(id),
 event text not null, source_record text not null, status text not null,
 primary key(member_id,event,source_record)
);
create table community_private.reward_families (
 slug text primary key, title text not null, allocation_open boolean not null default false,
 starts_at timestamptz, ends_at timestamptz
);
create table community_private.entitlements (
 member_id uuid not null references community_private.members(id),
 family text not null references community_private.reward_families(slug),
 primary key(member_id,family)
);
create table community_private.inventory (
 id uuid primary key default gen_random_uuid(), family text not null references community_private.reward_families(slug),
 code text not null unique, source text not null, unique(id,family)
);
create function community_private.reward_identity(email text) returns text language sql immutable set search_path='' as $$
 select case when split_part(lower(btrim(email)),'@',2) in ('gmail.com','googlemail.com')
 then replace(split_part(split_part(lower(btrim(email)),'@',1),'+',1),'.','')||'@gmail.com'
 else lower(btrim(email)) end;
$$;
create table community_private.claims (
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references community_private.members(id),
 family text not null references community_private.reward_families(slug),
 inventory_id uuid not null unique,
 identity_key text not null,
 assigned_at timestamptz not null default now(),
 source text not null,
 unique(member_id,family), unique(identity_key,family),
 foreign key(inventory_id,family) references community_private.inventory(id,family)
);
create table community_private.login_limits (
 key text primary key, attempts integer not null, window_start timestamptz not null
);
alter table community_private.members enable row level security;
alter table community_private.registrations enable row level security;
alter table community_private.reward_families enable row level security;
alter table community_private.entitlements enable row level security;
alter table community_private.inventory enable row level security;
alter table community_private.claims enable row level security;
alter table community_private.login_limits enable row level security;

-- A code assignment is permanent, including when an account is suspended.
create function community_private.prevent_reallocation() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Assignments and code inventory are immutable'; end; $$;
create trigger immutable_claim before update or delete on community_private.claims for each row execute function community_private.prevent_reallocation();
create trigger immutable_inventory before update or delete on community_private.inventory for each row execute function community_private.prevent_reallocation();

-- Before-user-created hook: the client cannot bypass the registration allowlist.
create function public.community_before_user_created(event jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from community_private.members m where m.email=lower(btrim(event->'user'->>'email')) and m.active and m.auth_user_id is null) then
   return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Registration is required.'));
 end if;
 return '{}'::jsonb;
end; $$;
revoke all on function public.community_before_user_created(jsonb) from public,anon,authenticated;
grant execute on function public.community_before_user_created(jsonb) to supabase_auth_admin;

-- Server-only eligibility lookup and persistent cooldown, including unknown addresses.
create function public.community_login_allowed(p_email text) returns boolean language sql security definer set search_path='' as $$
 select exists(select 1 from community_private.members where email=lower(btrim(p_email)) and active);
$$;
create function public.community_rate_limit(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql security definer set search_path='' as $$
declare hits integer;
begin
 insert into community_private.login_limits as l(key,attempts,window_start) values(p_key,1,clock_timestamp())
 on conflict(key) do update set attempts=case when l.window_start < clock_timestamp()-make_interval(secs=>p_seconds) then 1 else l.attempts+1 end,
 window_start=case when l.window_start < clock_timestamp()-make_interval(secs=>p_seconds) then clock_timestamp() else l.window_start end
 returning attempts into hits;
 return hits<=p_limit;
end; $$;
revoke all on function public.community_login_allowed(text) from public,anon,authenticated;
revoke all on function public.community_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.community_login_allowed(text), public.community_rate_limit(text,integer,integer) to service_role;

-- Resolve membership from the verified Auth user, never from request JSON or editable metadata.
create function community_private.current_member() returns community_private.members language plpgsql security definer set search_path='' as $$
declare member community_private.members; verified_email text;
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 select lower(btrim(u.email)) into verified_email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 if verified_email is null then raise exception 'UNVERIFIED'; end if;
 select * into member from community_private.members m where m.auth_user_id=auth.uid() for update;
 if found then
  if not member.active or member.email<>verified_email then raise exception 'INELIGIBLE'; end if;
  return member;
 end if;
 select * into member from community_private.members m where m.email=verified_email and m.active for update;
 if not found or (member.auth_user_id is not null and member.auth_user_id<>auth.uid()) then raise exception 'INELIGIBLE'; end if;
 update community_private.members set auth_user_id=auth.uid() where id=member.id returning * into member;
 return member;
end; $$;
revoke all on function community_private.current_member() from public,anon,authenticated;

create function public.community_my_rewards() returns jsonb language plpgsql security definer set search_path='' as $$
declare member community_private.members; result jsonb;
begin
 member:=community_private.current_member();
 select coalesce(jsonb_agg(jsonb_build_object('family',f.slug,'title',f.title,'code',i.code,'assigned_at',c.assigned_at,'allocation_open',f.allocation_open) order by f.slug),'[]'::jsonb)
 into result from community_private.entitlements e join community_private.reward_families f on f.slug=e.family
 left join community_private.claims c on c.member_id=e.member_id and c.family=e.family
 left join community_private.inventory i on i.id=c.inventory_id where e.member_id=member.id;
 return jsonb_build_object('email',member.email,'rewards',result);
end; $$;

create function public.community_claim_reward(p_family text) returns jsonb language plpgsql security definer set search_path='' as $$
declare member community_private.members; prior community_private.claims; item community_private.inventory; campaign community_private.reward_families; identity text;
begin
 member:=community_private.current_member(); -- locks the member across all concurrent claims
 identity:=community_private.reward_identity(member.email);
 select * into prior from community_private.claims where member_id=member.id and family=p_family;
 if found then
   select * into item from community_private.inventory where id=prior.inventory_id;
   return jsonb_build_object('code',item.code,'family',item.family,'assigned_at',prior.assigned_at,'existing',true);
 end if;
 if not exists(select 1 from community_private.entitlements where member_id=member.id and family=p_family) then raise exception 'INELIGIBLE'; end if;
 if exists(select 1 from community_private.claims where identity_key=identity and family=p_family) then raise exception 'ALREADY_ALLOCATED'; end if;
 select * into campaign from community_private.reward_families where slug=p_family;
 if not found or not campaign.allocation_open then raise exception 'UNAVAILABLE'; end if;
 if campaign.starts_at is not null and now()<campaign.starts_at then raise exception 'UNAVAILABLE'; end if;
 if campaign.ends_at is not null and now()>campaign.ends_at then raise exception 'EXPIRED'; end if;
 select i.* into item from community_private.inventory i where i.family=p_family
 and not exists(select 1 from community_private.claims c where c.inventory_id=i.id)
 order by i.id for update of i skip locked limit 1;
 if not found then raise exception 'SOLD_OUT'; end if;
 insert into community_private.claims(member_id,family,inventory_id,identity_key,source) values(member.id,p_family,item.id,identity,'authenticated_claim') returning * into prior;
 return jsonb_build_object('code',item.code,'family',item.family,'assigned_at',prior.assigned_at,'existing',false);
end; $$;
revoke all on function public.community_my_rewards(),public.community_claim_reward(text) from public,anon;
grant execute on function public.community_my_rewards(),public.community_claim_reward(text) to authenticated;
