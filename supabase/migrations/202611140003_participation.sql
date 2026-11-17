-- Additive community features. No inventory or existing claim is modified.
create table community_private.content (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('event','story')),
 slug text not null check(slug ~ '^[a-z0-9][a-z0-9-]{0,99}$'),
 draft jsonb not null, published jsonb, evidence text not null default '',
 updated_at timestamptz not null default now(), published_at timestamptz,
 unique(kind,slug)
);
create table community_private.projects (
 id uuid primary key default gen_random_uuid(), member_id uuid not null references community_private.members,
 slug text not null unique default gen_random_uuid()::text,
 published_revision uuid, created_at timestamptz not null default now()
);
create table community_private.project_revisions (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references community_private.projects,
 payload jsonb not null, status text not null default 'draft' check(status in ('draft','submitted','approved','changes_requested','rejected','published','withdrawn')),
 created_at timestamptz not null default now(), submitted_at timestamptz, reviewed_at timestamptz,
 reviewed_by uuid references auth.users, feedback text not null default ''
);
alter table community_private.projects add foreign key(published_revision) references community_private.project_revisions;
create table community_private.media (
 id uuid primary key default gen_random_uuid(), member_id uuid not null references community_private.members,
 object_path text not null unique, mime text not null, bytes integer not null,
 duration numeric, created_at timestamptz not null default now(),
 check(bytes>0 and bytes<=104857600), check(duration is null or duration<=90)
);
create table community_private.profiles (
 member_id uuid primary key references community_private.members,
 name text not null default '', link text not null default '', decision_email boolean not null default true
);
create table community_private.notifications (
 id uuid primary key default gen_random_uuid(), dedupe_key text not null unique,
 recipient text not null, subject text not null, message text not null,
 status text not null default 'pending' check(status in ('pending','sending','sent','failed')),
 attempts integer not null default 0, provider_id text, last_error text, locked_at timestamptz, first_attempt_at timestamptz,
 created_at timestamptz not null default now(), sent_at timestamptz
);
create table community_private.enquiries (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('host','report')),
 email text not null, message text not null check(length(message) between 10 and 3000),
 status text not null default 'open' check(status in ('open','resolved')), created_at timestamptz not null default now()
);
create table community_private.audit (
 id bigint generated always as identity primary key, actor uuid, action text not null,
 target text, created_at timestamptz not null default now()
);
create table community_private.import_batches (
 id uuid primary key default gen_random_uuid(), digest text not null unique, source text not null,
 rows jsonb not null, committed_at timestamptz, created_at timestamptz not null default now()
);
create table community_private.settings (key text primary key, value jsonb not null);
create table community_private.share_approvals (
 id uuid primary key default gen_random_uuid(), kind text not null, slug text not null,
 revision text not null, copy text not null, approved_by uuid not null, created_at timestamptz not null default now()
);
create table community_private.metrics (
 day date not null default current_date, name text not null, count bigint not null default 0, primary key(day,name)
);
alter table community_private.reward_families add column presentation jsonb not null default '{}';
-- All tables are private and accessible only through narrowly scoped functions.
do $$ declare t text; begin foreach t in array array['content','projects','project_revisions','media','profiles','notifications','enquiries','audit','import_batches','settings','share_approvals','metrics'] loop execute format('alter table community_private.%I enable row level security',t); end loop; end $$;

create function community_private.log_action(p_action text,p_target text) returns void language sql security definer set search_path='' as $$
 insert into community_private.audit(actor,action,target) values(auth.uid(),p_action,p_target);
$$;
create function public.community_public() returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object(
 'content',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'kind',c.kind,'slug',c.slug,'data',c.published,'published_at',c.published_at)) from community_private.content c where c.published is not null),'[]'::jsonb),
 'projects',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'slug',p.slug,'revision',r.id,'data',r.payload,'published_at',r.reviewed_at)) from community_private.projects p join community_private.project_revisions r on r.id=p.published_revision and r.project_id=p.id where r.status='published'),'[]'::jsonb),
 'whatsapp',coalesce((select value from community_private.settings where key='whatsapp'),'{}'::jsonb),
 'rewards',coalesce((select jsonb_agg(jsonb_build_object('family',f.slug,'title',f.title,'details',f.presentation,'state',case when not f.allocation_open or f.starts_at>now() then 'Not open' when f.ends_at<now() then 'Expired' when (select count(*) from community_private.inventory i where i.family=f.slug and not exists(select 1 from community_private.claims c where c.inventory_id=i.id))=0 then 'Sold out' else 'Available' end,'available',case when f.allocation_open then (select count(*) from community_private.inventory i where i.family=f.slug and not exists(select 1 from community_private.claims c where c.inventory_id=i.id)) else null end)) from community_private.reward_families f),'[]'::jsonb),
 'updated_at',now());
$$;
create function public.community_member_home() returns jsonb language plpgsql security definer set search_path='' as $$
declare m community_private.members; begin m:=community_private.current_member();
 return jsonb_build_object('projects',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'slug',p.slug,'published_revision',p.published_revision,'revisions',(select jsonb_agg(to_jsonb(r) order by r.created_at desc) from community_private.project_revisions r where r.project_id=p.id))) from community_private.projects p where p.member_id=m.id),'[]'::jsonb),
 'registrations',coalesce((select jsonb_agg(jsonb_build_object('event',r.event,'status',r.status)) from community_private.registrations r where r.member_id=m.id),'[]'::jsonb),
 'profile',coalesce((select to_jsonb(p)-'member_id' from community_private.profiles p where p.member_id=m.id),'{}'::jsonb));
end;$$;

create function public.community_save_project(p_id uuid,p_payload jsonb,p_submit boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare m community_private.members; pid uuid; rid uuid; aid text; begin
 m:=community_private.current_member();
 if coalesce(length(p_payload->>'title'),0) not between 3 and 120 or coalesce(length(p_payload->>'description'),0) not between 20 and 5000 then raise exception 'INVALID_PROJECT';end if;
 if jsonb_typeof(p_payload)<>'object' or length(p_payload::text)>20000 then raise exception 'INVALID_PROJECT';end if;
 for aid in select unnest(array['demo_url','repository_url','maker_link']) loop
  if coalesce(p_payload->>aid,'')<>'' and (p_payload->>aid !~ '^https?://[^[:space:]]+$' or length(p_payload->>aid)>1000) then raise exception 'INVALID_URL';end if;
 end loop;
 if p_submit and not coalesce((p_payload->>'display_permission')::boolean,false) then raise exception 'DISPLAY_PERMISSION_REQUIRED';end if;
 if jsonb_array_length(coalesce(p_payload->'media','[]'))>6 then raise exception 'TOO_MANY_FILES';end if;
 for aid in select jsonb_array_elements_text(coalesce(p_payload->'media','[]')) loop
  if not exists(select 1 from community_private.media where id=aid::uuid and member_id=m.id) then raise exception 'INVALID_MEDIA';end if;
 end loop;
 if (select count(*) from community_private.media where id::text in (select jsonb_array_elements_text(coalesce(p_payload->'media','[]'))) and mime='image/webp')>5 or (select count(*) from community_private.media where id::text in (select jsonb_array_elements_text(coalesce(p_payload->'media','[]'))) and mime='video/mp4')>1 then raise exception 'TOO_MANY_FILES';end if;
 if p_id is null then insert into community_private.projects(member_id) values(m.id) returning id into pid;
 else select id into pid from community_private.projects where id=p_id and member_id=m.id for update; if not found then raise exception 'NOT_FOUND';end if;end if;
 insert into community_private.project_revisions(project_id,payload,status,submitted_at) values(pid,p_payload,case when p_submit then 'submitted' else 'draft' end,case when p_submit then now() end) returning id into rid;
 -- New submissions supersede older pending revisions, never the published revision.
 update community_private.project_revisions set status='withdrawn' where project_id=pid and id<>rid and status in ('draft','submitted');
 perform community_private.log_action(case when p_submit then 'project_submitted' else 'project_draft' end,pid::text);
 return pid;
end;$$;
create function public.community_withdraw_project(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare m community_private.members; begin m:=community_private.current_member();
 perform 1 from community_private.projects where id=p_id and member_id=m.id for update; if not found then raise exception 'NOT_FOUND';end if;
 update community_private.projects set published_revision=null where id=p_id;
 update community_private.project_revisions set status='withdrawn' where project_id=p_id;
 delete from community_private.share_approvals where kind='project' and slug=(select slug from community_private.projects where id=p_id);
 perform community_private.log_action('project_withdrawn',p_id::text);
end;$$;
create function public.community_save_profile(p_name text,p_link text,p_decision_email boolean) returns void language plpgsql security definer set search_path='' as $$
declare m community_private.members; begin m:=community_private.current_member();
 if length(p_name)>100 or length(p_link)>500 then raise exception 'INVALID_PROFILE';end if;
 insert into community_private.profiles values(m.id,p_name,p_link,p_decision_email) on conflict(member_id) do update set name=excluded.name,link=excluded.link,decision_email=excluded.decision_email;
end;$$;
create function public.community_register_media(p_id uuid,p_mime text,p_bytes integer,p_duration numeric) returns text language plpgsql security definer set search_path='' as $$
declare m community_private.members; path text; begin m:=community_private.current_member();
 if p_mime not in ('image/webp','video/mp4') or (p_mime='image/webp' and p_bytes>10485760) then raise exception 'INVALID_MEDIA';end if;
 path:=m.id::text||'/'||p_id::text;
 insert into community_private.media(id,member_id,object_path,mime,bytes,duration) values(p_id,m.id,path,p_mime,p_bytes,p_duration);return path;
end;$$;
create function public.community_media_access(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare item community_private.media; m community_private.members; allowed boolean:=false; begin
 select * into item from community_private.media where id=p_id;if not found then raise exception 'NOT_FOUND';end if;
 allowed:=exists(select 1 from community_private.projects p join community_private.project_revisions r on r.id=p.published_revision and r.project_id=p.id where r.status='published' and r.payload->'media' @> jsonb_build_array(p_id::text));
 allowed:=allowed or exists(select 1 from community_private.content where published is not null and published->'media' @> jsonb_build_array(p_id::text));
 if not allowed and auth.uid() is not null then m:=community_private.current_member();allowed:=m.id=item.member_id;
 if not allowed then perform community_private.require_admin();allowed:=true;end if;end if;
 if not allowed then raise exception 'NOT_FOUND';end if;
 return jsonb_build_object('path',item.object_path,'mime',item.mime);
end;$$;
-- Membership decision notifications are committed atomically with the decision.
create function community_private.notify_membership() returns trigger language plpgsql security definer set search_path='' as $$
begin if new.status<>old.status and new.status in ('approved','rejected') then
 insert into community_private.notifications(dedupe_key,recipient,subject,message) values('membership:'||new.id||':'||new.status,new.email,'Your Supanauts application',case when new.status='approved' then 'Your community application is approved. Sign in with your application email.' else 'Your community application was not approved. Contact the organizer if you need help.' end) on conflict do nothing;end if;return new;end;$$;
create trigger membership_decision_notification after update on community_private.membership_requests for each row execute function community_private.notify_membership();
create function public.community_admin_workspace() returns jsonb language plpgsql security definer set search_path='' as $$
begin perform community_private.require_admin();return jsonb_build_object(
 'revisions',coalesce((select jsonb_agg(to_jsonb(r)) from community_private.project_revisions r where r.status='submitted'),'[]'::jsonb),
 'content',coalesce((select jsonb_agg(to_jsonb(c)) from community_private.content c),'[]'::jsonb),
 'notifications',coalesce((select jsonb_agg(to_jsonb(n)-'recipient'-'message') from community_private.notifications n),'[]'::jsonb),
 'enquiries',coalesce((select jsonb_agg(to_jsonb(e)) from community_private.enquiries e where status='open'),'[]'::jsonb),
 'rewards',coalesce((select jsonb_agg(jsonb_build_object('family',f.slug,'title',f.title,'presentation',f.presentation,'allocation_open',f.allocation_open,'inventory',(select count(*) from community_private.inventory i where i.family=f.slug),'assigned',(select count(*) from community_private.claims c where c.family=f.slug))) from community_private.reward_families f),'[]'::jsonb),
 'imports',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'source',b.source,'created_at',b.created_at,'committed_at',b.committed_at,'rows',jsonb_array_length(b.rows))) from community_private.import_batches b),'[]'::jsonb),
 'settings',coalesce((select jsonb_object_agg(key,value) from community_private.settings),'{}'::jsonb));end;$$;
create function public.community_review_project(p_id uuid,p_decision text,p_feedback text) returns void language plpgsql security definer set search_path='' as $$
declare r community_private.project_revisions; p community_private.projects; m community_private.members; begin
 perform community_private.require_admin();
 if p_decision not in ('approved','changes_requested','rejected','published') or length(p_feedback)>2000 then raise exception 'INVALID_DECISION';end if;
 select * into r from community_private.project_revisions where id=p_id for update;if not found or r.status<>'submitted' then raise exception 'ALREADY_REVIEWED';end if;
 select * into p from community_private.projects where id=r.project_id for update;
 if p_decision in ('approved','published') and not coalesce((r.payload->>'display_permission')::boolean,false) then raise exception 'PERMISSION_REQUIRED';end if;
 update community_private.project_revisions set status=case when p_decision in ('approved','published') then 'published' else p_decision end,reviewed_by=auth.uid(),reviewed_at=now(),feedback=p_feedback where id=p_id;
 if p_decision in ('approved','published') then update community_private.projects set published_revision=p_id where id=p.id;delete from community_private.share_approvals where kind='project' and slug=p.slug;end if;
 select * into m from community_private.members where id=p.member_id;
 if coalesce((select decision_email from community_private.profiles where member_id=m.id),true) then
 insert into community_private.notifications(dedupe_key,recipient,subject,message) values('project:'||p_id,m.email,'Your Supanauts project update','Your project “'||(r.payload->>'title')||'”: '||p_decision||'. '||p_feedback) on conflict do nothing;end if;
 perform community_private.log_action('project_'||p_decision,p_id::text);
end;$$;
create function public.community_admin_action(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid; b community_private.import_batches; row jsonb; mid uuid; rev text; begin
 perform community_private.require_admin();
 if p_action='content_save' then
 insert into community_private.content(kind,slug,draft,evidence) values(p_data->>'kind',p_data->>'slug',p_data->'data',p_data->>'evidence') on conflict(kind,slug) do update set draft=excluded.draft,evidence=excluded.evidence,updated_at=now() returning id into cid;
 elsif p_action='content_publish' then
 update community_private.content set published=draft,published_at=now() where id=(p_data->>'id')::uuid and length(evidence)>0 returning id into cid;if cid is null then raise exception 'EVIDENCE_REQUIRED';end if;
 delete from community_private.share_approvals where kind=(select kind from community_private.content where id=cid) and slug=(select slug from community_private.content where id=cid);
 elsif p_action='content_unpublish' then update community_private.content set published=null where id=(p_data->>'id')::uuid;
 elsif p_action='project_unpublish' then update community_private.projects set published_revision=null where id=(p_data->>'id')::uuid;
 elsif p_action='settings' then insert into community_private.settings values('whatsapp',p_data) on conflict(key) do update set value=excluded.value;
 elsif p_action='reward_details' then update community_private.reward_families set presentation=p_data->'presentation' where slug=p_data->>'family';
 elsif p_action='resolve' then update community_private.enquiries set status='resolved' where id=(p_data->>'id')::uuid;
 elsif p_action='import_preview' then
 insert into community_private.import_batches(digest,source,rows) values(p_data->>'digest',p_data->>'source',p_data->'rows') on conflict(digest) do update set digest=excluded.digest returning id into cid;
 elsif p_action='import_commit' then
 select * into b from community_private.import_batches where id=(p_data->>'id')::uuid for update;if not found then raise exception 'NOT_FOUND';end if;
 if b.committed_at is null then
 for row in select * from jsonb_array_elements(b.rows) loop
 insert into community_private.members(email,source) values(row->>'email','import:'||b.id) on conflict(email) do update set email=excluded.email returning id into mid;
 insert into community_private.registrations values(mid,row->>'event',row->>'record',row->>'status') on conflict do nothing;
 end loop;update community_private.import_batches set committed_at=now() where id=b.id;end if;
 elsif p_action='share_approve' then
 if p_data->>'kind'='project' then select r.id::text into rev from community_private.projects p join community_private.project_revisions r on r.id=p.published_revision where p.slug=p_data->>'slug' and r.status='published' and (r.payload->>'promotion_permission')::boolean;
 else select published_at::text into rev from community_private.content where kind=p_data->>'kind' and slug=p_data->>'slug' and published is not null and (published->>'promotion_permission')::boolean;end if;
 if rev is null then raise exception 'PUBLICATION_PERMISSION_REQUIRED';end if;
 insert into community_private.share_approvals(kind,slug,revision,copy,approved_by) values(p_data->>'kind',p_data->>'slug',rev,p_data->>'copy',auth.uid());
 else raise exception 'INVALID_ACTION';end if;
 perform community_private.log_action(p_action,coalesce(cid::text,p_data->>'id'));
 return jsonb_build_object('ok',true,'id',cid);
end;$$;
create function public.community_submit_enquiry(p_kind text,p_email text,p_message text) returns void language sql security definer set search_path='' as $$
 insert into community_private.enquiries(kind,email,message) values(p_kind,p_email,p_message);
$$;
-- Only an authenticated organizer can take a job. Network dispatch is separately disabled by default.
create function public.community_notification_take(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare job community_private.notifications;begin perform community_private.require_admin();
 select * into job from community_private.notifications where id=p_id for update;
 if not found or job.status='sent' or (job.status='sending' and job.locked_at>now()-interval '10 minutes') then return null;end if;
 -- Provider idempotency window is 24 hours. Never automatically resend an ambiguous old attempt.
 if job.attempts>0 and job.first_attempt_at<now()-interval '23 hours' then raise exception 'RECONCILE_PROVIDER_FIRST';end if;
 update community_private.notifications set status='sending',attempts=attempts+1,locked_at=now(),first_attempt_at=coalesce(first_attempt_at,now()) where id=p_id;return to_jsonb(job);end;$$;
create function public.community_notification_finish(p_id uuid,p_provider text,p_error text) returns void language plpgsql security definer set search_path='' as $$
begin perform community_private.require_admin();update community_private.notifications set status=case when p_provider is null then 'failed' else 'sent' end,provider_id=p_provider,last_error=p_error,sent_at=case when p_provider is not null then now() end where id=p_id and status='sending';end;$$;

revoke all on all functions in schema community_private from public,anon,authenticated;
revoke all on function public.community_public(),public.community_member_home(),public.community_save_project(uuid,jsonb,boolean),public.community_withdraw_project(uuid),public.community_save_profile(text,text,boolean),public.community_register_media(uuid,text,integer,numeric),public.community_media_access(uuid),public.community_admin_workspace(),public.community_review_project(uuid,text,text),public.community_admin_action(text,jsonb),public.community_submit_enquiry(text,text,text),public.community_notification_take(uuid),public.community_notification_finish(uuid,text,text) from public,anon,authenticated;
grant execute on function public.community_public(),public.community_media_access(uuid) to anon,authenticated;
grant execute on function public.community_member_home(),public.community_save_project(uuid,jsonb,boolean),public.community_withdraw_project(uuid),public.community_save_profile(text,text,boolean),public.community_register_media(uuid,text,integer,numeric),public.community_admin_workspace(),public.community_review_project(uuid,text,text),public.community_admin_action(text,jsonb),public.community_notification_take(uuid),public.community_notification_finish(uuid,text,text) to authenticated;
grant execute on function public.community_submit_enquiry(text,text,text) to service_role;
-- Private bucket: media is streamed through an authorization-checked route, never a public storage URL.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('community-quarantine','community-quarantine',false,104857600,array['image/webp','video/mp4']) on conflict(id) do nothing;

create or replace function public.community_my_rewards() returns jsonb language plpgsql security definer set search_path='' as $$
declare member community_private.members; result jsonb;begin
 member:=community_private.current_member();
 select coalesce(jsonb_agg(jsonb_build_object('family',f.slug,'title',f.title,'code',i.code,'assigned_at',c.assigned_at,'allocation_open',f.allocation_open,'details',f.presentation,'state',case when not f.allocation_open or f.starts_at>now() then 'Not open' when f.ends_at<now() then 'Expired' else 'Available' end) order by f.slug),'[]'::jsonb)
 into result from community_private.reward_families f
 left join community_private.claims c on c.member_id=member.id and c.family=f.slug
 left join community_private.inventory i on i.id=c.inventory_id
 where c.id is not null or exists(select 1 from community_private.entitlements e where e.member_id=member.id and e.family=f.slug);
 return jsonb_build_object('email',member.email,'rewards',result);
end;$$;
create table community_private.daily_visits(member_id uuid references community_private.members,day date default current_date,primary key(member_id,day));
alter table community_private.daily_visits enable row level security;
create function public.community_record_visit() returns void language plpgsql security definer set search_path='' as $$
declare m community_private.members; added integer; returning_member boolean;begin
 m:=community_private.current_member();returning_member:=exists(select 1 from community_private.daily_visits where member_id=m.id and day<current_date);
 insert into community_private.daily_visits values(m.id,current_date) on conflict do nothing;get diagnostics added=row_count;
 if added>0 then insert into community_private.metrics(day,name,count) values(current_date,case when returning_member then 'returning_members' else 'first_seen_members' end,1) on conflict(day,name) do update set count=community_private.metrics.count+1;end if;
 delete from community_private.daily_visits where day<current_date-90;
end;$$;
create function public.community_metric(p_name text) returns void language plpgsql security definer set search_path='' as $$
begin if p_name not in ('event_registration_click','share_link_copy','share_link_visit') then raise exception 'INVALID_METRIC';end if;
 insert into community_private.metrics(day,name,count) values(current_date,p_name,1) on conflict(day,name) do update set count=community_private.metrics.count+1;
end;$$;
create function public.community_admin_metrics() returns jsonb language plpgsql security definer set search_path='' as $$
begin perform community_private.require_admin();return jsonb_build_object('daily',coalesce((select jsonb_agg(to_jsonb(m)) from community_private.metrics m where day>=current_date-90),'[]'::jsonb),'submitted_projects',(select count(distinct project_id) from community_private.project_revisions where submitted_at is not null),'published_projects',(select count(*) from community_private.projects where published_revision is not null),'allocations',(select count(*) from community_private.claims),'median_review_hours',(select percentile_cont(0.5) within group(order by extract(epoch from (reviewed_at-submitted_at))/3600) from community_private.project_revisions where reviewed_at is not null));end;$$;
revoke all on function public.community_record_visit(),public.community_metric(text),public.community_admin_metrics() from public,anon,authenticated;
grant execute on function public.community_record_visit(),public.community_admin_metrics() to authenticated;
grant execute on function public.community_metric(text) to service_role;
