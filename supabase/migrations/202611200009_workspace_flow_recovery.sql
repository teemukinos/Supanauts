-- Preserve reward metadata when editing instructions; open drafts independently of list pagination.
begin;
create or replace function public.community_admin_action(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c community_private.content; result jsonb; eid uuid; mid uuid;begin
perform community_private.require_admin();
if p_action='reward_details' then
if jsonb_typeof(p_data->'presentation') is distinct from 'object' then raise exception 'INVALID_INPUT';end if;
update community_private.reward_families set presentation=coalesce(presentation,'{}'::jsonb)||(p_data->'presentation') where slug=p_data->>'family';
if not found then raise exception 'NOT_FOUND';end if;
perform community_private.log_action(p_action,p_data->>'family');
return jsonb_build_object('ok',true);
end if;
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
create function public.community_admin_content(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
perform community_private.require_admin();
select to_jsonb(c)||jsonb_build_object('event_id',e.id) into result from community_private.content c left join community_private.events e on e.content_id=c.id where c.id=p_id;
if result is null then raise exception 'NOT_FOUND';end if;
return result;end;$$;
revoke all on function public.community_admin_content(uuid) from public,anon,authenticated;
grant execute on function public.community_admin_content(uuid) to authenticated;
commit;
