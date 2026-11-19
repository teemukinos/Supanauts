-- Verified email sessions unlock assigned workspaces without authenticator setup.
-- Active membership, database-owned roles, event scope and existing grants remain enforced.
begin;
create or replace function community_private.require_admin() returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.community_admin_status() then raise exception 'FORBIDDEN';end if;
end;$$;
create or replace function public.community_access() returns jsonb language plpgsql security definer set search_path='' as $$
declare m community_private.members; admin boolean; organizer boolean;
begin m:=community_private.current_member();admin:=exists(select 1 from community_private.admins where member_id=m.id);organizer:=exists(select 1 from community_private.event_organizers where member_id=m.id);
return jsonb_build_object('id',m.id,'email',m.email,'name',coalesce((select name from community_private.profiles where member_id=m.id),''),'is_admin',admin,'is_organizer',organizer,'event_ids',coalesce((select jsonb_agg(event_id) from community_private.event_organizers where member_id=m.id),'[]'::jsonb));
end;$$;
create or replace function community_private.require_event(p_event uuid) returns void language plpgsql security definer set search_path='' as $$
declare m community_private.members;begin m:=community_private.current_member();
if not exists(select 1 from community_private.events where id=p_event) then raise exception 'NOT_FOUND';end if;
if not exists(select 1 from community_private.admins where member_id=m.id) and not exists(select 1 from community_private.event_organizers where event_id=p_event and member_id=m.id) then raise exception 'FORBIDDEN';end if;

end;$$;
create or replace function public.community_event_workspace(p_event uuid default null,p_page integer default 1,p_search text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare m community_private.members; result jsonb; skip integer:=greatest(0,least(p_page,100000)-1)*25;begin
m:=community_private.current_member();
if p_event is null then
return jsonb_build_object('events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'data',c.published,'draft_status',c.review_status)) from community_private.events e left join community_private.content c on c.id=e.content_id where exists(select 1 from community_private.admins where member_id=m.id) or exists(select 1 from community_private.event_organizers where event_id=e.id and member_id=m.id)),'[]'::jsonb));end if;
perform community_private.require_event(p_event);
select jsonb_build_object('id',e.id,'title',e.title,'content_id',c.id,'draft',c.draft,'published',c.published,'version',c.version,'review_status',c.review_status,'evidence',c.evidence) into result from community_private.events e left join community_private.content c on c.id=e.content_id where e.id=p_event;
return result||jsonb_build_object('page',greatest(1,p_page),'page_size',25,'total',(select count(*) from community_private.registrations r join community_private.event_sources s on s.label=r.event join community_private.members u on u.id=r.member_id left join community_private.profiles p on p.member_id=u.id where s.event_id=p_event and (p_search='' or u.email ilike '%'||p_search||'%' or p.name ilike '%'||p_search||'%')),'participants',coalesce((select jsonb_agg(to_jsonb(x)) from (select u.email,coalesce(p.name,'') name,r.status,r.source_record from community_private.registrations r join community_private.event_sources s on s.label=r.event join community_private.members u on u.id=r.member_id left join community_private.profiles p on p.member_id=u.id where s.event_id=p_event and (p_search='' or u.email ilike '%'||p_search||'%' or p.name ilike '%'||p_search||'%') order by u.email,r.source_record limit 25 offset skip) x),'[]'::jsonb));
end;$$;
create or replace function public.community_media_access(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare item community_private.media; m community_private.members; allowed boolean:=false;begin
select * into item from community_private.media where id=p_id;if not found then raise exception 'NOT_FOUND';end if;
allowed:=exists(select 1 from community_private.projects p join community_private.project_revisions r on r.id=p.published_revision and r.project_id=p.id where r.status='published' and r.payload->'media' @> jsonb_build_array(p_id::text)) or exists(select 1 from community_private.content where published->'media' @> jsonb_build_array(p_id::text));
if not allowed and auth.uid() is not null then
m:=community_private.current_member();
if exists(select 1 from community_private.event_media where media_id=p_id) then
allowed:=(exists(select 1 from community_private.admins where member_id=m.id) or exists(select 1 from community_private.event_media em join community_private.event_organizers eo using(event_id) where em.media_id=p_id and eo.member_id=m.id));
else allowed:=m.id=item.member_id or (exists(select 1 from community_private.admins where member_id=m.id));end if;end if;
if not allowed then raise exception 'NOT_FOUND';end if;return jsonb_build_object('path',item.object_path,'mime',item.mime);end;$$;
commit;
