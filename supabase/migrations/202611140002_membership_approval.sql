create table community_private.membership_requests (
 id uuid primary key default gen_random_uuid(), email text not null unique,
 name text not null check(length(name) between 1 and 100),
 reason text not null check(length(reason) between 10 and 1000),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(), reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id), decision_note text
);
create table community_private.admins (member_id uuid primary key references community_private.members(id));
alter table community_private.membership_requests enable row level security;
alter table community_private.admins enable row level security;
create function public.community_submit_request(p_email text,p_name text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 if length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'INVALID_EMAIL'; end if;
 if exists(select 1 from community_private.members where email=lower(btrim(p_email))) then return; end if;
 insert into community_private.membership_requests(email,name,reason) values(lower(btrim(p_email)),btrim(p_name),btrim(p_reason)) on conflict(email) do nothing;
end; $$;
revoke all on function public.community_submit_request(text,text,text) from public,anon,authenticated;
grant execute on function public.community_submit_request(text,text,text) to service_role;
create function public.community_admin_status() returns boolean language plpgsql security definer set search_path='' as $$
declare member community_private.members;
begin member:=community_private.current_member();return exists(select 1 from community_private.admins where member_id=member.id);end;$$;
revoke all on function public.community_admin_status() from public,anon;
grant execute on function public.community_admin_status() to authenticated;
create function community_private.require_admin() returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.community_admin_status() then raise exception 'FORBIDDEN';end if;
 if coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'MFA_REQUIRED';end if;
end;$$;
revoke all on function community_private.require_admin() from public,anon,authenticated;
create function public.community_request_queue() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform community_private.require_admin();
 select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at),'[]'::jsonb) into result from (select id,email,name,reason,created_at from community_private.membership_requests where status='pending' order by created_at limit 100)r;
 return result;
end;$$;
create function public.community_review_request(p_id uuid,p_decision text,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare applicant community_private.membership_requests;
begin
 perform community_private.require_admin();
 if p_decision not in ('approved','rejected') or length(p_note)>1000 then raise exception 'INVALID_DECISION';end if;
 select * into applicant from community_private.membership_requests where id=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if applicant.status=p_decision then return;end if;
 if applicant.status<>'pending' then raise exception 'ALREADY_REVIEWED';end if;
 if p_decision='approved' then
  -- Approval grants community access only, never swag entitlement or admin rights.
  insert into community_private.members(email,source) values(applicant.email,'manual_approval:'||applicant.id::text) on conflict(email) do nothing;
 end if;
 update community_private.membership_requests set status=p_decision,reviewed_at=now(),reviewed_by=auth.uid(),decision_note=p_note where id=p_id;
end;$$;
revoke all on function public.community_request_queue(),public.community_review_request(uuid,text,text) from public,anon;
grant execute on function public.community_request_queue(),public.community_review_request(uuid,text,text) to authenticated;
