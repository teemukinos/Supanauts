# Supanauts application

An unofficial Supabase community built with Next.js and TypeScript. This is source code, not a copy of the live membership database. All credentials, people records, reward inventory and original event media remain outside Git.

## Run without backend access

Use Node.js 22 or newer supported by the installed Next.js version:

```sh
cd site
npm ci
npm run dev
```

The default local URL is http://127.0.0.1:3017. If another preview already uses that port, run `npm run dev -- --port 3018`. Public pages render without credentials and show the original Supanauts illustration instead of private event photos. Protected operations report an unavailable service until a development backend is configured.

## Configure your own Supabase project

1. Create or select a disposable development project that you control. Never use the production community project for development.
2. Apply both migrations from `../supabase/migrations/` in filename order to that project using your chosen Supabase database migration tool or SQL Editor. They contain schema only; no members, codes, administrator assignments or production identifiers.
3. Copy `.env.example` to `.env.local`. Set the project URL, publishable/anon key, server service-role key and exact `APP_ORIGIN`, including your local port. The service-role key must never be exposed through `NEXT_PUBLIC_`.
4. Configure Email Auth with confirmation enabled. Enable the Before User Created Postgres hook for `public.community_before_user_created`. Give its URI your own project: `pg-functions://postgres/public/community_before_user_created`.
5. Put `{{ .Token }}` in both the confirmation and magic-link email templates so the page can accept the numeric code. Use an eight-digit code with a ten-minute expiry. Configure your own SMTP or the local Supabase email inbox; the hosted default sender has recipient and delivery limits.
6. Enable TOTP enrollment and verification for administrator access. Set the Auth site URL to your local app origin. No external redirect is required by the OTP form.

The database starts empty and closed. Bootstrap your own development organizer through a trusted SQL connection, replacing the example address with an address you control:

```sql
insert into community_private.members(email, source)
values ('you@example.com', 'development_organizer')
on conflict (email) do nothing;

insert into community_private.admins(member_id)
select id from community_private.members where email = 'you@example.com'
on conflict do nothing;
```

The email must be lowercase and must belong to you. Sign in through `/member`, then open `/admin` and set up your authenticator. For reward development use only dummy codes in your isolated database, not real Supabase offers. Do not commit your local seed files.

## Behavior and interfaces

- `/member`: email OTP, private rewards, existing-code retrieval and logout. Sessions use HttpOnly, SameSite=Strict cookies, expire after one hour and require HTTPS Secure cookies in production.
- `/join`: rate-limited membership requests. Pending and rejected applicants cannot sign in.
- `/admin`: organizer-only approval queue requiring a verified AAL2 authenticator session. Approval grants membership only, never automatic swag entitlement or admin rights. No automatic decision email is sent.
- `/api/auth/request`, `/api/auth/verify`, `/api/auth/logout`: same-origin authentication operations.
- `/api/rewards/mine`, `/api/rewards/claim`: authenticated own-member reads and atomic, repeatable claims.
- `/api/access/request`, `/api/admin/requests`, `/api/admin/mfa`: application and approval operations.

Tables live in a private schema with RLS enabled. Server-controlled entitlements govern giveaways. Claims derive identity from the verified Auth user, not a submitted email. Member and inventory locks plus unique constraints prevent duplicate assignments. Claims and code inventory are immutable; never delete claims to recover a lost code. Email changes require verified administrative reconciliation.

Store redemption is separate from allocation. Existing allocations always remain assigned. Live imports and inventory opening require a separate reconciliation process; there is no general import UI yet.

## Event media and branding

No event photographs are included. Leave `NEXT_PUBLIC_EVENT_MEDIA_BASE_URL` unset to show the bundled illustration. A separately authorized HTTPS media location can supply the named WebP photographs; failed loads also fall back to the illustration. The variable is public and must never contain credentials or private tokens.

Official Supabase wordmarks are unchanged assets in `public/brand/`; use white lettering on dark surfaces and black lettering on light surfaces. Preserve their separate trademark terms. Supanauts' independent identity and unofficial notice must remain visible.

## Local validation

```sh
npm run typecheck
npm run build
```

Also check mobile layout, keyboard navigation, reduced motion and pause controls in a local browser. Synthetic behavioral tests and their evidence remain local under the owner's repository policy. No remote tests, CI workflows, publishing jobs or deployment integration are included.

## Participation features

Migration `202611140003_participation.sql` adds projects and immutable approved revisions, content drafts, private upload metadata, notification jobs, moderation, reporting, import previews, event calendars and aggregate metrics. See [`docs/PARTICIPATION-RELEASE.md`](../docs/PARTICIPATION-RELEASE.md) for setup, operation, verification limits, media-host requirements and release gates. All data and provider setup remains in your own Supabase project. Real email dispatch defaults to off.
