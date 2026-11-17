-- Keep invitations out of anonymous RPC responses as well as public HTML.
begin;
create or replace function public.community_public() returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object(
 'content',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'kind',c.kind,'slug',c.slug,'data',c.published,'published_at',c.published_at)) from community_private.content c where c.published is not null),'[]'::jsonb),
 'projects',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'slug',p.slug,'revision',r.id,'data',r.payload,'published_at',r.reviewed_at)) from community_private.projects p join community_private.project_revisions r on r.id=p.published_revision and r.project_id=p.id where r.status='published'),'[]'::jsonb),
 'whatsapp','{}'::jsonb,
 'rewards',coalesce((select jsonb_agg(jsonb_build_object('family',f.slug,'title',f.title,'details',f.presentation,'state',case when not f.allocation_open or f.starts_at>now() then 'Not open' when f.ends_at<now() then 'Expired' when (select count(*) from community_private.inventory i where i.family=f.slug and not exists(select 1 from community_private.claims c where c.inventory_id=i.id))=0 then 'Sold out' else 'Available' end,'available',case when f.allocation_open then (select count(*) from community_private.inventory i where i.family=f.slug and not exists(select 1 from community_private.claims c where c.inventory_id=i.id)) else null end)) from community_private.reward_families f),'[]'::jsonb),
 'updated_at',now());
$$;

create function public.community_member_channels() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform community_private.current_member();
 return coalesce((select value from community_private.settings where key='whatsapp'),'{}'::jsonb);
end;$$;
revoke all on function public.community_member_channels() from public,anon,authenticated;
grant execute on function public.community_member_channels() to authenticated;
commit;
