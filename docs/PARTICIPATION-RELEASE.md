# Participation release: implementation and launch runbook

## Local implementation

The application includes public content pages, project revisions and moderation, safe OTP return paths, member profiles, registration history, private uploads, manual sharing, calendars, organizer content/import tools, reward availability, reports and transactional notification queues. Migration `202611140003_participation.sql` is additive. Existing code inventory, claims and allocator are unchanged.

The clean repository is the implementation source. The original studio preview is preserved separately. No production migration, deployment, SMTP change, message, inventory opening or merge is part of this delivery. The owner separately authorized pushing the application source to the private teemukinos/Supanauts repository on 14 November 2026.

## Setup and local verification

Use your own Supabase instance and run migrations in filename order. The third migration creates a private storage bucket. Copy `site/.env.example` to a local ignored environment file. `NOTIFICATIONS_ENABLED` remains false unless real delivery is explicitly authorized. Use `npm ci`, `npm run typecheck` and `npm run build` from `site/`.

The public site works without credentials using original illustration fallbacks and honest service-unavailable states. It does not substitute demonstration content or an invented stock count. The database-backed features require all three migrations on a development instance. Do not point a new feature preview at production before the migration is approved.

Local verification scripts and evidence are intentionally excluded from Git under `.local/` and `out/`. Desktop and mobile layouts were also reviewed in the in-app browser. No remote CI or review workflow is added.

## Organizer workflow

1. Sign in with the organizer account, then complete MFA at `/admin`.
2. Open `/admin/workspace`. Review membership separately from projects.
3. In Content, load the six researched drafts. This creates five event drafts and an archive recap; it never publishes. Review source notes and exact facts, edit roles, then publish saved drafts individually.
4. Approve project submissions only after checking links, media and both permission choices. New edits leave the current published revision intact. Withdrawal immediately removes public access, share-image access and media authorization unless the same asset remains used in another published project.
5. Configure existing WhatsApp invitations. The site does not create groups or add people.
6. Review reports/host enquiries. Unpublish content where needed and record the action. Respond manually through the chosen communication channel only with authorization.
7. Review notification jobs. Sending remains disabled by default. Real delivery is a deliberate organizer action; there is no background dispatcher in this release.

## Registration imports

Run `python scripts/prepare-registrations.py INPUT --event EVENT-SLUG --output private/import.json`. For XLSX install `openpyxl` locally and supply `--sheet SHEET-NAME`; do not combine overlapping workbook sheets blindly. The normalizer retains only email, event, source record and original status, with an adjacent quarantine report. Upload the JSON in the organizer Imports tab, inspect the accepted/quarantine counts, then commit that preview. All statuses qualify. Repeating a batch does not duplicate membership; omissions do not delete or reactivate members. Use one authoritative event identifier consistently.

## Rewards and legacy cutover

The Rewards tab shows total, assigned and unassigned inventory and edits presentation metadata. It deliberately cannot import real codes or open allocation. Existing assignments remain immutable, including the owner's reserved swag code.

Before any production cutover, export protected snapshots of legacy codes and claims, reconcile normalized identities and source records, stop the legacy allocator, take a final snapshot, then import in a transaction. Verify total inventory, all assignments, duplicate identities, unmatched recipients and remaining stock. Preserve unmatched assignments. Only enable new allocations after the owner approves this exact package. If reconciliation fails, keep allocation closed. Never restore an old allocator without reconciling newer claims.

## Media hosting limitation

Images are decoded, rotated, resized and re-encoded as WebP without inherited metadata. Video is inspected with ffprobe, limited to 90 seconds, transcoded to MP4 and stripped of metadata. Both stay in a private bucket. The media route rechecks authorization on every request and sends no-store responses; it does not issue enduring public URLs.

The current upload route accepts multipart uploads on a Node host with a 105 MB request allowance and ffmpeg/ffprobe installed. A default Vercel Function request limit cannot support the planned 100 MB upload. **Do not advertise full video uploading on a default Vercel deployment.** Before public deployment, provision an owner-approved Node upload host behind the same origin, or implement and verify direct-to-quarantine uploads plus an asynchronous video worker. Set `FFMPEG_PATH` and `FFPROBE_PATH` only on that host. Without them the route rejects video with guidance to use a demo link. This hosting dependency is unresolved, not a completed production capability.

## Notification delivery

Login delivery uses the server-side Resend API directly. Set `RESEND_API_KEY` and `LOGIN_EMAIL_FROM` to a sender on your verified Resend domain. The login endpoint checks membership and rate limits before asking Supabase Auth to generate an OTP; Resend transports that OTP. Supabase still verifies the code and issues the session. The signup allowlist hook, organizer MFA, and reward allocator remain unchanged. Never expose the generated OTP, link, or either provider credential in API responses or logs. No custom Supabase SMTP is required for this login path. Direct calls to Supabase's public OTP endpoint still use its separately configured sender.

Authentication delivery and moderation notification delivery are separate paths. `EMAIL_FROM`, `RESEND_API_KEY` and `NOTIFICATIONS_ENABLED=true` enable explicit queue dispatch. Login delivery does not enable decision emails. Keep preview credentials restricted to the owner-controlled application branch; add production credentials separately when authorizing production release. Changing Vercel environment variables requires a new deployment.

References: [Supabase generateLink](https://supabase.com/docs/reference/javascript/auth-admin-generatelink), [Resend send email](https://resend.com/docs/api-reference/emails/send-email).

Jobs are created atomically with membership/project decisions. A delivery failure never reverses approval. A stable job ID is the provider idempotency key. Retries of ambiguous attempts stop after 23 hours from the **first** attempt, because Resend retains keys for 24 hours. Reconcile with the provider before attempting any later delivery; there is no automatic reset. Source: https://resend.com/docs/dashboard/emails/idempotency-keys

## Content and permissions still required

- Three to five real project submissions with maker permission; none were invented or submitted on someone else's behalf.
- WhatsApp announcement/builders invitations from the owner.
- Confirmed upcoming-event programme, date/time, venue and public registration URL. The historical 10 December target is not presented as a confirmed event.
- Public photo/video rights. The supplied five Helsinki photographs and original films remain outside Git. AI-styled Stockholm imagery is not documentary material.
- Final event-specific roles for Supabase, Stripe, Skene, Anthropic, Epicenter, Typö and Revent. Planning documents are not evidence of delivered sponsorship. Known venue/organizer roles are included only in review drafts.
- Organizer review of privacy/retention text and actual hosting/email processors before publication.

Verified official community links: Discord is linked from https://supabase.com/ ; Reddit is linked from https://supabase.com/docs/guides/self-hosting . Checked 14 November 2026.

## Release and rollback

Before release, back up the existing schema/private tables/storage manifest, verify owner assignment counts and rehearsal results, apply the additive migration to the authorized target, refresh schema cache, and verify the before-user-created hook remains enabled. Deploy the reviewed application only after separate approval. Set the real canonical origin and configure the same-origin upload host. Keep indexing disabled until public launch approval.

Rollback application code if needed; do not drop new tables or delete claims. Keep allocations closed if any data invariant is uncertain. Retain queued notifications and audit records. Check private pages, public stock, approval queues and provider delivery errors after release. Restore backups only after reconciling writes since the snapshot.

## Measurement

Admin Metrics distinguishes first-seen and returning members within a 90-day window, submissions, publications, allocation totals, review latency, copied share links, visits through tagged share links and registration-link clicks. A click is not a completed event registration or external post. No third-party tracking or session replay is added.

## Verification completed locally on 14 November 2026

- Fresh source export: `npm ci`, production build and TypeScript passed.
- All three migrations executed against an isolated PGlite database with synthetic identities and dummy codes. Checks passed for unpublished isolation, revision approval, renewed review, withdrawal, MFA enforcement, idempotent imports, existing-claim retries, sold out and notification deduplication. This is not a substitute for a multi-connection production cutover rehearsal.
- The Next.js HTTP routes were exercised against a local SQL-backed adapter: membership isolation, project save/review/publication/withdrawal, unsafe URLs, media isolation, content publication, stable calendar IDs and disabled real email all passed.
- Browser flow passed from Share your project through a synthetic local OTP provider to the intended submission form, then a successful pending submission. No real emails were sent.
- Synthetic JPEG and MP4 processing passed. No private event media was uploaded.
- Desktop and 390 px mobile layouts were inspected; global motion pause worked. Official Supabase SVG bytes remain unchanged.
- Eligible-source scan found no real codes, project credentials, attendee exports, private local paths or unexpected binary assets.

Not yet verified: actual deployed SMTP, a production membership approval, production storage/100 MB transport, multi-connection race rehearsal for the release target, real-device performance, or final published event/project content. These require the outstanding setup, content and release gates.

## Owner direction: placeholders for now

Use clearly labeled placeholders for projects, WhatsApp invitations and upcoming-event details. These inputs are not required for the current visual review. Replace placeholders only with verified content and publication permissions. Do not simulate stock or enable invitation/registration links before their real destinations exist.

## Final photo and submission pass — 14 November 2026
The owner authorized use of previous-event photographs on the website. Five Helsinki images are exported with Pixelmator as 1600-pixel WebP derivatives, without EXIF, and supplied separately under `site/public/media/`. They remain excluded from Git and Apache licensing. Set `NEXT_PUBLIC_EVENT_MEDIA_BASE_URL=/media` when packaging those authorized files; a clone without the media configuration uses the original illustration fallback. The hero shows one photo at a time, and the gallery lazy-loads later photographs.

The project call now explains what to submit and offers copyable invitation text. No invitations are automatically sent to registrants or WhatsApp. Publication and promotional permissions still come from each maker’s submission.

## Event films and shorter homepage — 15 November 2026

The homepage now leads from a compact introduction into three portrait films, followed by project submission, one WhatsApp invitation and live reward availability. Detailed event listings remain on Events; submission instructions and the copyable invitation remain on Projects. December is month-only. Local visible homepage copy fell from 434 to 123 words before expanding descriptions or revealing the invitation.

Media is packaged separately from Git. The owner authorized these existing event films for the website; this does not grant an Apache redistribution licence. Sources and review evidence are recorded in the Studio job. Original films and embedded titles/logos are untouched. Pixelmator produced portrait posters. Compressor exports exceeded the required source-size ceiling; bounded FFmpeg H.264/AAC derivatives provide the documented fallback, with fast-start playback and no upscaling. Film descriptions identify the montage content and music. No recorded-talk transcript is represented by unverified automatic song lyrics.

Local checks cover all three films, keyboard selection, one active player, no MP4 request before Play, stable player dimensions, 390px overflow, error/retry, reduced motion, global pause, WhatsApp acknowledgement and reward availability states. Type checking and production build pass. Authentication, membership approvals, project moderation and the immutable reward allocator are unchanged. No database migration, real notification, GitHub push, PR merge or production promotion accompanies this review deployment.

## Member-only invitations and header stills — 15 November 2026 (local candidate)

WhatsApp now has a dedicated `/member/community` page. Public HTML, public JSON and browser bundles carry no invitation. The server-only `WHATSAPP_COMMUNITY_URL` supplies the default; organizer settings can override it. The authenticated channels RPC rechecks verified email and active membership. Phone-number visibility acknowledgement remains required before displaying links. Login preserves the destination. Migration `202611150004_private_channels.sql` removes invitations from the anonymous RPC and adds the protected read; it does not modify rewards or assignments.

The header cycles six documentary frames from Helsinki and Dublin every five seconds. Global pause, reduced motion and background tabs stop automatic rotation. Native event films still load only after Play. The homepage explains occasional credits, T-shirts and swag; the credit counter uses actual database availability. The current connected database contains one assigned swag box and no credit inventory, so no historical credit count is presented as currently claimable stock.

Release requires applying migration 004, configuring the server-only invitation and deploying the review candidate. No remote write has been performed for this candidate. Local SQL access checks, browser checks, type checking and build passed. A credit inventory migration remains a separate reconciliation/cutover task.

Access rollout authorization received on 15 November 2026. Migration 004 is now applied to the dedicated Supanauts project. The private invitation is configured as a sensitive Vercel environment variable for the review branch. Before/after database readback confirms Teemu's original claim, inventory ID, timestamp and code fingerprint remain unchanged; total inventory and claims are both one. Anonymous execution of the channels RPC is denied and public channel data is empty. No reward was claimed or reassigned during rollout.
