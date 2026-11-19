-- Additive private workspaces. Existing memberships, inventory and assignments remain unchanged.
begin;
create table community_private.events (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(title) between 3 and 120),
 content_id uuid unique references community_private.content(id),
 created_at timestamptz not null default now()
);
create table community_private.event_sources (
 label text primary key check(length(label) between 1 and 200),
 event_id uuid not null references community_private.events(id)
);
create table community_private.event_organizers (
 event_id uuid not null references community_private.events(id),
 member_id uuid not null references community_private.members(id),
 primary key(event_id,member_id)
);
create table community_private.event_media (
 event_id uuid not null references community_private.events(id),
 media_id uuid not null references community_private.media(id),
 primary key(event_id,media_id)
);
alter table community_private.content add column version integer not null default 1;
alter table community_private.content add column review_status text not null default 'draft' check(review_status in ('draft','submitted','published'));
alter table community_private.events enable row level security;
alter table community_private.event_sources enable row level security;
alter table community_private.event_organizers enable row level security;
alter table community_private.event_media enable row level security;
revoke all on community_private.events,community_private.event_sources,community_private.event_organizers,community_private.event_media from public,anon,authenticated;
-- Content UUIDs are authoritative; imported text labels are deliberately not guessed.
insert into community_private.events(title,content_id) select draft->>'title',id from community_private.content where kind='event';
insert into community_private.event_sources select 'event:'||id::text,id from community_private.events;
insert into community_private.event_media select e.id,m.id from community_private.events e join community_private.content c on c.id=e.content_id join community_private.media m on c.draft->'media' @> jsonb_build_array(m.id::text) or c.published->'media' @> jsonb_build_array(m.id::text) on conflict do nothing;
create function community_private.content_version() returns trigger language plpgsql set search_path='' as $$ begin new.version:=old.version+1;new.updated_at:=clock_timestamp();return new;end;$$;
create trigger content_version before update on community_private.content for each row execute function community_private.content_version();
-- Event attachments remain in the event publication workflow, including after revocation.
create function community_private.project_media_scope() returns trigger language plpgsql set search_path='' as $$
begin
if exists(select 1 from community_private.event_media em where new.payload->'media' @> jsonb_build_array(em.media_id::text)) then raise exception 'EVENT_MEDIA_REQUIRES_EVENT_REVIEW';end if;
return new;end;$$;
create trigger project_media_scope before insert on community_private.project_revisions for each row execute function community_private.project_media_scope();
create function public.community_access() returns jsonb language plpgsql security definer set search_path='' as $$
declare m community_private.members; admin boolean; organizer boolean; verified boolean;
begin m:=community_private.current_member();admin:=exists(select 1 from community_private.admins where member_id=m.id);organizer:=exists(select 1 from community_private.event_organizers where member_id=m.id);verified:=coalesce(auth.jwt()->>'aal','')='aal2';
return jsonb_build_object('id',m.id,'email',m.email,'name',coalesce((select name from community_private.profiles where member_id=m.id),''),'is_admin',admin,'is_organizer',organizer,'verified',verified,'event_ids',case when verified then coalesce((select jsonb_agg(event_id) from community_private.event_organizers where member_id=m.id),'[]'::jsonb) else '[]'::jsonb end);
end;$$;
create function community_private.require_event(p_event uuid) returns void language plpgsql security definer set search_path='' as $$
declare m community_private.members;begin m:=community_private.current_member();
if not exists(select 1 from community_private.events where id=p_event) then raise exception 'NOT_FOUND';end if;
if not exists(select 1 from community_private.admins where member_id=m.id) and not exists(select 1 from community_private.event_organizers where event_id=p_event and member_id=m.id) then raise exception 'FORBIDDEN';end if;
if coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'MFA_REQUIRED';end if;
end;$$;
create function public.community_event_workspace(p_event uuid default null,p_page integer default 1,p_search text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare m community_private.members; result jsonb; skip integer:=greatest(0,least(p_page,100000)-1)*25;begin
m:=community_private.current_member();if coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'MFA_REQUIRED';end if;
if p_event is null then
return jsonb_build_object('events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'data',c.published,'draft_status',c.review_status)) from community_private.events e left join community_private.content c on c.id=e.content_id where exists(select 1 from community_private.admins where member_id=m.id) or exists(select 1 from community_private.event_organizers where event_id=e.id and member_id=m.id)),'[]'::jsonb));end if;
perform community_private.require_event(p_event);
select jsonb_build_object('id',e.id,'title',e.title,'content_id',c.id,'draft',c.draft,'published',c.published,'version',c.version,'review_status',c.review_status,'evidence',c.evidence) into result from community_private.events e left join community_private.content c on c.id=e.content_id where e.id=p_event;
return result||jsonb_build_object('page',greatest(1,p_page),'page_size',25,'total',(select count(*) from community_private.registrations r join community_private.event_sources s on s.label=r.event join community_private.members u on u.id=r.member_id left join community_private.profiles p on p.member_id=u.id where s.event_id=p_event and (p_search='' or u.email ilike '%'||p_search||'%' or p.name ilike '%'||p_search||'%')),'participants',coalesce((select jsonb_agg(to_jsonb(x)) from (select u.email,coalesce(p.name,'') name,r.status,r.source_record from community_private.registrations r join community_private.event_sources s on s.label=r.event join community_private.members u on u.id=r.member_id left join community_private.profiles p on p.member_id=u.id where s.event_id=p_event and (p_search='' or u.email ilike '%'||p_search||'%' or p.name ilike '%'||p_search||'%') order by u.email,r.source_record limit 25 offset skip) x),'[]'::jsonb));
end;$$;
create function public.community_event_save(p_event uuid,p_version integer,p_data jsonb,p_evidence text,p_submit boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare c community_private.content; mid uuid; link jsonb;begin
perform community_private.require_event(p_event);
select c0.* into c from community_private.content c0 join community_private.events e on e.content_id=c0.id where e.id=p_event for update of c0;
if not found then raise exception 'NOT_FOUND';end if;
if p_version is distinct from c.version then raise exception 'STALE_VERSION';end if;
if jsonb_typeof(p_data)<>'object' or length(p_data::text)>50000 or length(coalesce(p_data->>'title','')) not between 3 and 120 or length(coalesce(p_data->>'description',''))<10 or length(p_evidence)>5000 then raise exception 'INVALID_INPUT';end if;
if length(coalesce(p_data->>'description',''))>500 or length(coalesce(p_data->>'body',''))>20000 or length(coalesce(p_data->>'city',''))>100 or length(coalesce(p_data->>'venue',''))>200 or jsonb_typeof(coalesce(p_data->'media','[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_data->'media','[]'::jsonb))>12 then raise exception 'INVALID_INPUT';end if;
if coalesce(p_data->>'timezone','UTC') not in(select name from pg_catalog.pg_timezone_names) then raise exception 'INVALID_INPUT';end if;
if nullif(p_data->>'starts_at','') is not null then perform (p_data->>'starts_at')::timestamptz;end if;
if nullif(p_data->>'ends_at','') is not null then perform (p_data->>'ends_at')::timestamptz;end if;
if nullif(p_data->>'starts_at','') is not null and nullif(p_data->>'ends_at','') is not null and (p_data->>'ends_at')::timestamptz<=(p_data->>'starts_at')::timestamptz then raise exception 'INVALID_INPUT';end if;
if coalesce(p_data->>'registration_url','')<>'' and (p_data->>'registration_url' !~ '^https?://[^[:space:]/@]+([/?#]|$)' or length(p_data->>'registration_url')>1000) then raise exception 'INVALID_INPUT';end if;
for link in select value from jsonb_array_elements(coalesce(p_data->'resources','[]'::jsonb)||coalesce(p_data->'supporters','[]'::jsonb)) loop
if coalesce(link->>'url','')<>'' and (link->>'url' !~ '^https?://[^[:space:]/@]+([/?#]|$)' or length(link->>'url')>1000) then raise exception 'INVALID_INPUT';end if;end loop;
for mid in select value::uuid from jsonb_array_elements_text(coalesce(p_data->'media','[]'::jsonb)) loop
if not exists(select 1 from community_private.event_media where event_id=p_event and media_id=mid) then raise exception 'FORBIDDEN_MEDIA';end if;end loop;
-- Organizers cannot grant promotional rights. Preserve the admin-reviewed value.
update community_private.content set draft=jsonb_set(p_data,'{promotion_permission}',coalesce(c.draft->'promotion_permission','false'::jsonb)),evidence=p_evidence,review_status=case when p_submit then 'submitted' else 'draft' end where id=c.id returning * into c;
perform community_private.log_action(case when p_submit then 'event_submitted' else 'event_draft_saved' end,p_event::text);
return jsonb_build_object('version',c.version,'review_status',c.review_status);
end;$$;
create function public.community_register_event_media(p_event uuid,p_id uuid,p_mime text,p_bytes integer,p_duration numeric) returns text language plpgsql security definer set search_path='' as $$
declare path text;begin perform community_private.require_event(p_event);path:=public.community_register_media(p_id,p_mime,p_bytes,p_duration);insert into community_private.event_media values(p_event,p_id);return path;end;$$;
create or replace function public.community_media_access(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare item community_private.media; m community_private.members; allowed boolean:=false;begin
select * into item from community_private.media where id=p_id;if not found then raise exception 'NOT_FOUND';end if;
allowed:=exists(select 1 from community_private.projects p join community_private.project_revisions r on r.id=p.published_revision and r.project_id=p.id where r.status='published' and r.payload->'media' @> jsonb_build_array(p_id::text)) or exists(select 1 from community_private.content where published->'media' @> jsonb_build_array(p_id::text));
if not allowed and auth.uid() is not null then
m:=community_private.current_member();
if exists(select 1 from community_private.event_media where media_id=p_id) then
allowed:=coalesce(auth.jwt()->>'aal','')='aal2' and (exists(select 1 from community_private.admins where member_id=m.id) or exists(select 1 from community_private.event_media em join community_private.event_organizers eo using(event_id) where em.media_id=p_id and eo.member_id=m.id));
else allowed:=m.id=item.member_id or (coalesce(auth.jwt()->>'aal','')='aal2' and exists(select 1 from community_private.admins where member_id=m.id));end if;end if;
if not allowed then raise exception 'NOT_FOUND';end if;return jsonb_build_object('path',item.object_path,'mime',item.mime);end;$$;
create function public.community_event_admin(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare eid uuid:=(p_data->>'event_id')::uuid; mid uuid;begin
perform community_private.require_admin();
if not exists(select 1 from community_private.events where id=eid) then raise exception 'NOT_FOUND';end if;
if p_action='assign' then
mid:=(p_data->>'member_id')::uuid;if not exists(select 1 from community_private.members where id=mid and active) then raise exception 'INVALID_MEMBER';end if;
insert into community_private.event_organizers values(eid,mid) on conflict do nothing;
elsif p_action='revoke' then delete from community_private.event_organizers where event_id=eid and member_id=(p_data->>'member_id')::uuid;
elsif p_action='map' then
if length(coalesce(p_data->>'label','')) not between 1 and 200 then raise exception 'INVALID_INPUT';end if;
insert into community_private.event_sources values(p_data->>'label',eid) on conflict(label) do update set event_id=excluded.event_id;
else raise exception 'INVALID_ACTION';end if;
insert into community_private.audit(actor,action,target,details) values(auth.uid(),'event_'||p_action,eid::text,p_data);return jsonb_build_object('ok',true);end;$$;
-- Keep legacy operations available only behind the checked dispatcher.
alter function public.community_admin_action(text,jsonb) rename to community_admin_action_legacy;
revoke all on function public.community_admin_action_legacy(text,jsonb) from public,anon,authenticated;
create function public.community_admin_action(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c community_private.content; result jsonb; eid uuid; mid uuid;begin
perform community_private.require_admin();
if p_action in ('content_save','content_publish','content_unpublish') then
if p_action='content_save' then select * into c from community_private.content where kind=p_data->>'kind' and slug=p_data->>'slug' for update;
else select * into c from community_private.content where id=(p_data->>'id')::uuid for update;end if;
if c.id is not null and (p_data->>'version')::integer is distinct from c.version then raise exception 'STALE_VERSION';end if;
end if;
result:=public.community_admin_action_legacy(p_action,p_data);
if p_action='content_save' then
select * into c from community_private.content where id=(result->>'id')::uuid;
update community_private.content set review_status='draft' where id=c.id;
if c.kind='event' then
insert into community_private.events(title,content_id) values(c.draft->>'title',c.id) on conflict(content_id) do update set title=excluded.title returning id into eid;
insert into community_private.event_sources values('event:'||eid::text,eid) on conflict do nothing;
for mid in select value::uuid from jsonb_array_elements_text(coalesce(c.draft->'media','[]'::jsonb)) loop
if not exists(select 1 from community_private.media where id=mid) then raise exception 'FORBIDDEN_MEDIA';end if;
insert into community_private.event_media values(eid,mid) on conflict do nothing;end loop;end if;
elsif p_action='content_publish' then
update community_private.content set review_status='published' where id=(p_data->>'id')::uuid;
update community_private.events e set title=published_content.published->>'title' from community_private.content published_content where published_content.id=e.content_id and published_content.id=(p_data->>'id')::uuid;
elsif p_action='content_unpublish' then update community_private.content set review_status='draft' where id=(p_data->>'id')::uuid;
end if;return result;end;$$;
create function public.community_admin_screen(p_section text,p_page integer default 1,p_search text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb; total bigint; skip integer:=greatest(0,least(p_page,100000)-1)*25;begin
perform community_private.require_admin();
if p_section='overview' then return jsonb_build_object('members',(select count(*) from community_private.members),'requests',(select count(*) from community_private.membership_requests where status='pending'),'projects',(select count(*) from community_private.project_revisions where status='submitted'),'drafts',(select count(*) from community_private.content where review_status='submitted'),'failed_notifications',(select count(*) from community_private.notifications where status='failed'),'unmapped',(select count(distinct event) from community_private.registrations r where not exists(select 1 from community_private.event_sources where label=r.event)));
elsif p_section in ('events','updates') then
select count(*) into total from community_private.content where kind=case when p_section='events' then 'event' else 'story' end;
select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows from(select c.*,e.id event_id from community_private.content c left join community_private.events e on e.content_id=c.id where kind=case when p_section='events' then 'event' else 'story' end order by c.updated_at desc,c.id limit 25 offset skip)x;
elsif p_section='projects' then
select count(*) into total from community_private.projects;
select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows from(select p.id,p.slug,p.published_revision,r.id revision_id,r.status,r.payload,r.feedback,r.created_at from community_private.projects p join lateral(select * from community_private.project_revisions where project_id=p.id order by created_at desc,id desc limit 1) r on true order by r.created_at desc,p.id limit 25 offset skip)x;
elsif p_section='notifications' then select count(*) into total from community_private.notifications;select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows from(select * from community_private.notifications order by created_at desc,id limit 25 offset skip)x;
elsif p_section='reports' then select count(*) into total from community_private.enquiries;select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows from(select * from community_private.enquiries order by (status='open') desc,created_at desc,id limit 25 offset skip)x;
elsif p_section='imports' then select count(*) into total from community_private.import_batches;select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows from(select id,source,created_at,committed_at,jsonb_array_length(batch.rows) row_count from community_private.import_batches batch order by created_at desc,id limit 25 offset skip)x;
elsif p_section='codes' then
select count(*) into total from community_private.registry_assignments a where p_search='' or a.email ilike '%'||p_search||'%' or a.code ilike '%'||p_search||'%';
select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows from(select a.*,f.title,coalesce(p.name,'') name from community_private.registry_assignments a join community_private.reward_families f on f.slug=a.family left join community_private.profiles p on p.member_id=a.member_id where p_search='' or a.email ilike '%'||p_search||'%' or a.code ilike '%'||p_search||'%' order by a.assigned_at desc,a.inventory_id limit 25 offset skip)x;
elsif p_section='settings' then return jsonb_build_object('settings',coalesce((select jsonb_object_agg(key,value) from community_private.settings),'{}'::jsonb),'events',coalesce((select jsonb_agg(to_jsonb(e)) from community_private.events e),'[]'::jsonb),'organizers',coalesce((select jsonb_agg(jsonb_build_object('event_id',o.event_id,'member_id',o.member_id,'email',m.email)) from community_private.event_organizers o join community_private.members m on m.id=o.member_id),'[]'::jsonb),'sources',coalesce((select jsonb_agg(to_jsonb(s)) from community_private.event_sources s),'[]'::jsonb),'unmapped',coalesce((select jsonb_agg(to_jsonb(x)) from(select event label,count(*) registrations from community_private.registrations r where not exists(select 1 from community_private.event_sources where label=r.event) group by event)x),'[]'::jsonb));
elsif p_section='shares' then
select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows from(select kind,slug,published->>'title' title from community_private.content where published is not null and (published->>'promotion_permission')::boolean union all select 'project',p.slug,r.payload->>'title' from community_private.projects p join community_private.project_revisions r on r.id=p.published_revision where r.status='published' and (r.payload->>'promotion_permission')::boolean)x;total:=jsonb_array_length(rows);
elsif p_section='rewards' then select coalesce(jsonb_agg(jsonb_build_object('family',f.slug,'title',f.title,'presentation',f.presentation,'allocation_open',f.allocation_open,'inventory',(select count(*) from community_private.inventory i where i.family=f.slug),'assigned',(select count(*) from community_private.registry_assignments a where a.family=f.slug))),'[]'::jsonb) into rows from community_private.reward_families f;total:=jsonb_array_length(rows);
else raise exception 'INVALID_SECTION';end if;
return jsonb_build_object('items',rows,'total',total,'page',greatest(1,p_page),'page_size',25);end;$$;
revoke all on function public.community_access(),public.community_event_workspace(uuid,integer,text),public.community_event_save(uuid,integer,jsonb,text,boolean),public.community_register_event_media(uuid,uuid,text,integer,numeric),public.community_event_admin(text,jsonb),public.community_admin_action(text,jsonb),public.community_admin_screen(text,integer,text) from public,anon,authenticated;
grant execute on function public.community_access(),public.community_event_workspace(uuid,integer,text),public.community_event_save(uuid,integer,jsonb,text,boolean),public.community_register_event_media(uuid,uuid,text,integer,numeric),public.community_event_admin(text,jsonb),public.community_admin_action(text,jsonb),public.community_admin_screen(text,integer,text) to authenticated;
create or replace function public.community_admin_members(p_search text default '',p_event text default '',p_status text default 'all',p_family text default '',p_assignment text default 'all',p_page integer default 1,p_view text default 'members') returns jsonb
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
   (select count(*) from community_private.registry_assignments a where a.member_id=m.id) as assigned_count,
   coalesce((select jsonb_agg(jsonb_build_object('code',a.code,'title',f.title,'assigned_at',a.assigned_at) order by a.assigned_at) from community_private.registry_assignments a join community_private.reward_families f on f.slug=a.family where a.member_id=m.id),'[]'::jsonb) as assigned_codes
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

create or replace function public.community_member_home() returns jsonb language plpgsql security definer set search_path='' as $$
declare m community_private.members; begin m:=community_private.current_member();
 return jsonb_build_object('projects',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'slug',p.slug,'published_revision',p.published_revision,'revisions',(select jsonb_agg(to_jsonb(r) order by r.created_at desc) from community_private.project_revisions r where r.project_id=p.id))) from community_private.projects p where p.member_id=m.id),'[]'::jsonb),
 'registrations',coalesce((select jsonb_agg(jsonb_build_object('event',coalesce(e.title,r.event),'status',r.status)) from community_private.registrations r left join community_private.event_sources s on s.label=r.event left join community_private.events e on e.id=s.event_id where r.member_id=m.id),'[]'::jsonb),
 'profile',coalesce((select to_jsonb(p)-'member_id' from community_private.profiles p where p.member_id=m.id),'{}'::jsonb));
end;$$;


commit;
