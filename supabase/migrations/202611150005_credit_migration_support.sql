-- Preserve Amsterdam reservations independently of membership eligibility.
begin;
create table community_private.legacy_credit_assignments (
 inventory_id uuid primary key references community_private.inventory(id),
 email text not null unique,
 legacy_identity text not null unique,
 assigned_at timestamptz not null,
 source text not null
);
alter table community_private.legacy_credit_assignments enable row level security;
create trigger immutable_legacy_credit_assignment before update or delete on community_private.legacy_credit_assignments for each row execute function community_private.prevent_reallocation();
create function community_private.legacy_credit_identity(email text) returns text language sql immutable set search_path='' as $$
 select case when split_part(lower(btrim(email)),'@',2) in ('gmail.com','googlemail.com')
 then replace(split_part(split_part(lower(btrim(email)),'@',1),'+',1),'.','')||'@gmail.com'
 else split_part(split_part(lower(btrim(email)),'@',1),'+',1)||'@'||split_part(lower(btrim(email)),'@',2) end;
$$;
revoke all on function community_private.legacy_credit_identity(text) from public,anon,authenticated;
create function community_private.available_reward_count(p_family text) returns bigint language sql stable security definer set search_path='' as $$
 select count(*) from community_private.inventory i where i.family=p_family
 and not exists(select 1 from community_private.claims c where c.inventory_id=i.id)
 and not exists(select 1 from community_private.legacy_credit_assignments l where l.inventory_id=i.id);
$$;
revoke all on function community_private.available_reward_count(text) from public,anon,authenticated;
create or replace function public.community_claim_reward(p_family text) returns jsonb language plpgsql security definer set search_path='' as $$
declare member community_private.members; prior community_private.claims; legacy community_private.legacy_credit_assignments; item community_private.inventory; campaign community_private.reward_families; identity text;
begin
 member:=community_private.current_member();
 identity:=community_private.reward_identity(member.email);
 perform pg_advisory_xact_lock(hashtextextended('community_reward:'||p_family||':'||identity,0));
 select * into prior from community_private.claims where member_id=member.id and family=p_family;
 if found then
  select * into item from community_private.inventory where id=prior.inventory_id;
  return jsonb_build_object('code',item.code,'family',item.family,'assigned_at',prior.assigned_at,'existing',true);
 end if;
 if p_family='supabase-credits' then
  select * into legacy from community_private.legacy_credit_assignments where email=member.email;
  if found then
   select * into item from community_private.inventory where id=legacy.inventory_id;
   return jsonb_build_object('code',item.code,'family',item.family,'assigned_at',legacy.assigned_at,'existing',true);
  end if;
  -- Amsterdam stripped plus tags for every provider. Preserve that legacy block only;
  -- new allocations use the narrower Gmail normalization above.
  if exists(select 1 from community_private.legacy_credit_assignments where legacy_identity=community_private.legacy_credit_identity(member.email)) then raise exception 'ALREADY_ALLOCATED';end if;
 end if;
 if not exists(select 1 from community_private.entitlements where member_id=member.id and family=p_family)
 and not (p_family='supabase-credits' and exists(select 1 from community_private.registrations where member_id=member.id)) then raise exception 'INELIGIBLE';end if;
 if exists(select 1 from community_private.claims where identity_key=identity and family=p_family) then raise exception 'ALREADY_ALLOCATED';end if;
 select * into campaign from community_private.reward_families where slug=p_family;
 if not found or not campaign.allocation_open then raise exception 'UNAVAILABLE';end if;
 if campaign.starts_at is not null and now()<campaign.starts_at then raise exception 'UNAVAILABLE';end if;
 if campaign.ends_at is not null and now()>=campaign.ends_at then raise exception 'EXPIRED';end if;
 select i.* into item from community_private.inventory i where i.family=p_family
 and not exists(select 1 from community_private.claims c where c.inventory_id=i.id)
 and not exists(select 1 from community_private.legacy_credit_assignments l where l.inventory_id=i.id)
 order by i.id for update of i skip locked limit 1;
 if not found then raise exception 'SOLD_OUT';end if;
 insert into community_private.claims(member_id,family,inventory_id,identity_key,source) values(member.id,p_family,item.id,identity,'authenticated_claim') returning * into prior;
 return jsonb_build_object('code',item.code,'family',item.family,'assigned_at',prior.assigned_at,'existing',false);
end;$$;
create or replace function public.community_my_rewards() returns jsonb language plpgsql security definer set search_path='' as $$
declare member community_private.members;result jsonb;begin
 member:=community_private.current_member();
 select coalesce(jsonb_agg(jsonb_build_object('family',f.slug,'title',f.title,'code',i.code,'assigned_at',coalesce(c.assigned_at,l.assigned_at),'allocation_open',f.allocation_open,'details',f.presentation,'state',case when not f.allocation_open or f.starts_at>now() then 'Not open' when f.ends_at<=now() then 'Expired' when community_private.available_reward_count(f.slug)=0 then 'Sold out' else 'Available' end) order by f.slug),'[]'::jsonb)
 into result from community_private.reward_families f
 left join community_private.claims c on c.member_id=member.id and c.family=f.slug
 left join community_private.legacy_credit_assignments l on f.slug='supabase-credits' and l.email=member.email
 left join community_private.inventory i on i.id=coalesce(c.inventory_id,l.inventory_id)
 where c.id is not null or l.inventory_id is not null
 or exists(select 1 from community_private.entitlements e where e.member_id=member.id and e.family=f.slug)
 or (f.slug='supabase-credits' and exists(select 1 from community_private.registrations r where r.member_id=member.id));
 return jsonb_build_object('email',member.email,'rewards',result);
end;$$;
create or replace function public.community_public() returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object(
 'content',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'kind',c.kind,'slug',c.slug,'data',c.published,'published_at',c.published_at)) from community_private.content c where c.published is not null),'[]'::jsonb),
 'projects',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'slug',p.slug,'revision',r.id,'data',r.payload,'published_at',r.reviewed_at)) from community_private.projects p join community_private.project_revisions r on r.id=p.published_revision and r.project_id=p.id where r.status='published'),'[]'::jsonb),
 'whatsapp','{}'::jsonb,
 'rewards',coalesce((select jsonb_agg(jsonb_build_object('family',f.slug,'title',f.title,'details',f.presentation,'state',case when not f.allocation_open or f.starts_at>now() then 'Not open' when f.ends_at<=now() then 'Expired' when community_private.available_reward_count(f.slug)=0 then 'Sold out' else 'Available' end,'available',case when f.allocation_open and (f.starts_at is null or f.starts_at<=now()) and (f.ends_at is null or f.ends_at>now()) then community_private.available_reward_count(f.slug) else null end)) from community_private.reward_families f),'[]'::jsonb),
 'updated_at',now());
$$;
commit;
