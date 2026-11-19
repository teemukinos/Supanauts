-- Organizer-only registry. No existing member, assignment or inventory is rewritten.
begin;

create table community_private.reward_eligibility_overrides (
 member_id uuid not null references community_private.members(id),
 family text not null references community_private.reward_families(slug),
 mode text not null check (mode in ('allow','block')),
 primary key(member_id,family)
);
alter table community_private.reward_eligibility_overrides enable row level security;
alter table community_private.audit add column details jsonb not null default '{}'::jsonb;

-- One row per reserved inventory item, including recipients who are not members.
create view community_private.registry_assignments as
 select c.member_id,m.email,c.inventory_id,c.family,i.code,c.assigned_at,c.source,'claim'::text as kind
 from community_private.claims c join community_private.members m on m.id=c.member_id
 join community_private.inventory i on i.id=c.inventory_id
 union all
 select m.id,l.email,l.inventory_id,i.family,i.code,l.assigned_at,l.source,'legacy'::text
 from community_private.legacy_credit_assignments l
 join community_private.inventory i on i.id=l.inventory_id
 left join community_private.members m on m.email=l.email
 where not exists(select 1 from community_private.claims c where c.inventory_id=l.inventory_id);
revoke all on community_private.registry_assignments,community_private.reward_eligibility_overrides from public,anon,authenticated;

create function community_private.member_reward_eligible(p_member uuid,p_family text) returns boolean
 language sql stable security definer set search_path='' as $$
 select case (select mode from community_private.reward_eligibility_overrides where member_id=p_member and family=p_family)
 when 'allow' then true when 'block' then false
 else exists(select 1 from community_private.entitlements where member_id=p_member and family=p_family)
 or (p_family='supabase-credits' and exists(select 1 from community_private.registrations where member_id=p_member)) end;
$$;
revoke all on function community_private.member_reward_eligible(uuid,text) from public,anon,authenticated;

create function public.community_admin_members(p_search text default '',p_event text default '',p_status text default 'all',p_family text default '',p_assignment text default 'all',p_page integer default 1,p_view text default 'members') returns jsonb
 language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform community_private.require_admin();
 if p_search is null or length(p_search)>254 or p_event is null or length(p_event)>200
 or p_family is null or length(p_family)>100 or p_status is null or p_status not in ('all','active','suspended')
 or p_assignment is null or p_assignment not in ('all','assigned','unassigned') or p_view is null or p_view not in ('members','reservations')
 or p_page is null or p_page<1 or p_page>100000 then raise exception 'INVALID_INPUT';end if;
 with records as (
  select m.id,m.email,coalesce(nullif(p.name,''),r.name,'') as name,m.active,m.source,m.created_at,
   (select count(*) from community_private.registry_assignments a where a.member_id=m.id) as assigned_count
  from community_private.members m left join community_private.profiles p on p.member_id=m.id
  left join community_private.membership_requests r on r.email=m.email
  where p_view='members'
  and (p_search='' or position(lower(btrim(p_search)) in lower(m.email||' '||coalesce(p.name,'')||' '||coalesce(r.name,'')))>0)
  and (p_status='all' or m.active=(p_status='active'))
  and (p_event='' or exists(select 1 from community_private.registrations r where r.member_id=m.id and r.event=p_event))
  and (p_family='' or community_private.member_reward_eligible(m.id,p_family)
   or exists(select 1 from community_private.registry_assignments a where a.member_id=m.id and a.family=p_family)
   or exists(select 1 from community_private.reward_eligibility_overrides o where o.member_id=m.id and o.family=p_family))
  and (p_assignment='all' or (exists(select 1 from community_private.registry_assignments a where a.member_id=m.id and (p_family='' or a.family=p_family)))=(p_assignment='assigned'))
 ), page_rows as (select * from records order by email,id limit 50 offset (p_page-1)*50)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(r) order by email,id) from page_rows r),'[]'::jsonb),'total',(select count(*) from records),'page',p_page,'page_size',50) into result;
 if p_view='reservations' then
  with records as (
   select a.inventory_id as id,a.email,a.family,f.title,a.code,a.assigned_at,a.source
   from community_private.registry_assignments a join community_private.reward_families f on f.slug=a.family
   where a.member_id is null and (p_search='' or position(lower(btrim(p_search)) in a.email)>0)
   and (p_family='' or a.family=p_family) and p_assignment<>'unassigned' and p_event='' and p_status='all'
  ), page_rows as (select * from records order by email,id limit 50 offset (p_page-1)*50)
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(r) order by email,id) from page_rows r),'[]'::jsonb),'total',(select count(*) from records),'page',p_page,'page_size',50) into result;
 end if;
 return result||jsonb_build_object('view',p_view,'events',coalesce((select jsonb_agg(event order by event) from (select distinct event from community_private.registrations)e),'[]'::jsonb),
 'families',coalesce((select jsonb_agg(jsonb_build_object('slug',slug,'title',title) order by title,slug) from community_private.reward_families),'[]'::jsonb));
end;$$;

create function public.community_admin_member(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m community_private.members;
begin
 perform community_private.require_admin();
 select * into m from community_private.members where id=p_id;if not found then raise exception 'NOT_FOUND';end if;
 return jsonb_build_object('id',m.id,'email',m.email,'active',m.active,'source',m.source,'created_at',m.created_at,
 'name',coalesce(nullif((select name from community_private.profiles where member_id=m.id),''),(select name from community_private.membership_requests where email=m.email),''),
 'is_admin',exists(select 1 from community_private.admins where member_id=m.id),
 'registrations',coalesce((select jsonb_agg(jsonb_build_object('event',event,'status',status,'source_record',source_record) order by event,source_record) from community_private.registrations where member_id=m.id),'[]'::jsonb),
 'assignments',coalesce((select jsonb_agg(jsonb_build_object('inventory_id',a.inventory_id,'family',a.family,'title',f.title,'code',a.code,'assigned_at',a.assigned_at,'source',a.source,'kind',a.kind) order by a.assigned_at,a.inventory_id) from community_private.registry_assignments a join community_private.reward_families f on f.slug=a.family where a.member_id=m.id),'[]'::jsonb),
 'eligibility',coalesce((select jsonb_agg(jsonb_build_object('family',f.slug,'title',f.title,'mode',coalesce(o.mode,'default'),'eligible',community_private.member_reward_eligible(m.id,f.slug),'allocation_open',f.allocation_open) order by f.title,f.slug) from community_private.reward_families f left join community_private.reward_eligibility_overrides o on o.member_id=m.id and o.family=f.slug),'[]'::jsonb),
 'audit',coalesce((select jsonb_agg(to_jsonb(a) order by created_at desc,id desc) from (select id,actor,action,created_at,details from community_private.audit where target=m.id::text order by created_at desc,id desc limit 100)a),'[]'::jsonb));
end;$$;

create function public.community_admin_create_member(p_email text,p_name text,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare mid uuid; address text:=lower(btrim(p_email));
begin
 perform community_private.require_admin();
 if address is null or length(address)>254 or address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or p_name is null or length(p_name)>100 or p_reason is null or length(btrim(p_reason)) not between 1 and 1000 then raise exception 'INVALID_INPUT';end if;
 insert into community_private.members(email,source) values(address,'organizer_entry') on conflict(email) do nothing returning id into mid;
 if mid is null then select id into mid from community_private.members where email=address;return jsonb_build_object('id',mid,'existing',true);end if;
 if btrim(p_name)<>'' then insert into community_private.profiles(member_id,name) values(mid,btrim(p_name));end if;
 -- A manual approval resolves the same pending application. Its normal notification is queued, never sent here.
 update community_private.membership_requests set status='approved',reviewed_at=now(),reviewed_by=auth.uid(),decision_note=btrim(p_reason) where email=address and status='pending';
 insert into community_private.audit(actor,action,target,details) values(auth.uid(),'member_created',mid::text,jsonb_build_object('reason',btrim(p_reason),'before',null,'after',jsonb_build_object('active',true,'source','organizer_entry')));
 return jsonb_build_object('id',mid,'existing',false);
end;$$;

create function public.community_admin_set_member_active(p_id uuid,p_active boolean,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare m community_private.members;
begin
 perform community_private.require_admin();
 if p_active is null or p_reason is null or length(btrim(p_reason)) not between 1 and 1000 then raise exception 'INVALID_INPUT';end if;
 if exists(select 1 from community_private.admins where member_id=p_id) then raise exception 'PROTECTED_ORGANIZER';end if;
 select * into m from community_private.members where id=p_id for update;if not found then raise exception 'NOT_FOUND';end if;
 if m.active=p_active then return;end if;
 update community_private.members set active=p_active where id=p_id;
 insert into community_private.audit(actor,action,target,details) values(auth.uid(),'member_access_changed',p_id::text,jsonb_build_object('reason',btrim(p_reason),'before',jsonb_build_object('active',m.active),'after',jsonb_build_object('active',p_active)));
end;$$;

create function public.community_admin_set_eligibility(p_id uuid,p_family text,p_mode text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare previous text;
begin
 perform community_private.require_admin();
 if p_mode is null or p_mode not in ('default','allow','block') or p_reason is null or length(btrim(p_reason)) not between 1 and 1000
 or p_family is null or length(p_family)>100 then raise exception 'INVALID_INPUT';end if;
 -- Claims lock the same member first. A completed block cannot race a later new claim.
 perform 1 from community_private.members where id=p_id for update;if not found then raise exception 'NOT_FOUND';end if;
 if not exists(select 1 from community_private.reward_families where slug=p_family) then raise exception 'INVALID_INPUT';end if;
 select mode into previous from community_private.reward_eligibility_overrides where member_id=p_id and family=p_family;
 previous:=coalesce(previous,'default');if previous=p_mode then return;end if;
 if p_mode='default' then delete from community_private.reward_eligibility_overrides where member_id=p_id and family=p_family;
 else insert into community_private.reward_eligibility_overrides values(p_id,p_family,p_mode) on conflict(member_id,family) do update set mode=excluded.mode;end if;
 insert into community_private.audit(actor,action,target,details) values(auth.uid(),'member_eligibility_changed',p_id::text,jsonb_build_object('reason',btrim(p_reason),'family',p_family,'before',jsonb_build_object('mode',previous),'after',jsonb_build_object('mode',p_mode)));
end;$$;

revoke all on function public.community_admin_members(text,text,text,text,text,integer,text),public.community_admin_member(uuid),public.community_admin_create_member(text,text,text),public.community_admin_set_member_active(uuid,boolean,text),public.community_admin_set_eligibility(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.community_admin_members(text,text,text,text,text,integer,text),public.community_admin_member(uuid),public.community_admin_create_member(text,text,text),public.community_admin_set_member_active(uuid,boolean,text),public.community_admin_set_eligibility(uuid,text,text,text) to authenticated;

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
 if not community_private.member_reward_eligible(member.id,p_family) then raise exception 'INELIGIBLE';end if;
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
 select coalesce(jsonb_agg(jsonb_build_object('family',f.slug,'title',f.title,'code',i.code,'assigned_at',coalesce(c.assigned_at,l.assigned_at),'allocation_open',f.allocation_open,'eligible',community_private.member_reward_eligible(member.id,f.slug),'details',f.presentation,'state',case when c.id is null and l.inventory_id is null and not community_private.member_reward_eligible(member.id,f.slug) then 'Blocked' when not f.allocation_open or f.starts_at>now() then 'Not open' when f.ends_at<=now() then 'Expired' when community_private.available_reward_count(f.slug)=0 then 'Sold out' else 'Available' end) order by f.slug),'[]'::jsonb)
 into result from community_private.reward_families f
 left join community_private.claims c on c.member_id=member.id and c.family=f.slug
 left join community_private.legacy_credit_assignments l on f.slug='supabase-credits' and l.email=member.email
 left join community_private.inventory i on i.id=coalesce(c.inventory_id,l.inventory_id)
 where c.id is not null or l.inventory_id is not null
 or exists(select 1 from community_private.entitlements e where e.member_id=member.id and e.family=f.slug)
 or (f.slug='supabase-credits' and exists(select 1 from community_private.registrations r where r.member_id=member.id))
 or exists(select 1 from community_private.reward_eligibility_overrides o where o.member_id=member.id and o.family=f.slug);
 return jsonb_build_object('email',member.email,'rewards',result);
end;$$;

create or replace function public.community_admin_workspace() returns jsonb language plpgsql security definer set search_path='' as $$
begin perform community_private.require_admin();return jsonb_build_object(
 'revisions',coalesce((select jsonb_agg(to_jsonb(r)) from community_private.project_revisions r where r.status='submitted'),'[]'::jsonb),
 'content',coalesce((select jsonb_agg(to_jsonb(c)) from community_private.content c),'[]'::jsonb),
 'notifications',coalesce((select jsonb_agg(to_jsonb(n)-'recipient'-'message') from community_private.notifications n),'[]'::jsonb),
 'enquiries',coalesce((select jsonb_agg(to_jsonb(e)) from community_private.enquiries e where status='open'),'[]'::jsonb),
 'rewards',coalesce((select jsonb_agg(jsonb_build_object('family',f.slug,'title',f.title,'presentation',f.presentation,'allocation_open',f.allocation_open,'inventory',(select count(*) from community_private.inventory i where i.family=f.slug),'assigned',(select count(*) from community_private.registry_assignments c where c.family=f.slug))) from community_private.reward_families f),'[]'::jsonb),
 'imports',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'source',b.source,'created_at',b.created_at,'committed_at',b.committed_at,'rows',jsonb_array_length(b.rows))) from community_private.import_batches b),'[]'::jsonb),
 'settings',coalesce((select jsonb_object_agg(key,value) from community_private.settings),'{}'::jsonb));end;$$;

commit;
