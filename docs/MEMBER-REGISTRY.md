# Private member registry

The organizer registry is available at `/admin/members`, linked from `/admin`, the organizer workspace, and an organizer's member account. It extends the existing Supabase Auth email-code flow and Resend transport. It does not introduce public signup or a public member directory.

## Access and records

Every registry RPC requires an active organizer membership and an AAL2 authenticator session. Participants can only retrieve their own registrations and rewards through the existing member endpoints. Private API responses use `Cache-Control: no-store, private`; registry records are never included in the public community endpoint or the SupaSquad directory.

The list supports email/name search, event, access status, reward and assignment filters, with 50 records per page. The assignment filter applies to the selected reward, or to any reward when no family is selected. Member details include registration source records, assigned codes, original assignment dates and sources, eligibility, and the most recent 100 audit entries. Registration is not proof of attendance, and assignment is not proof of redemption.

The separate unmatched-reservations view includes legacy recipients whose exact email does not match a member. These reservations continue to consume inventory. Adding that exact email grants membership and makes the existing code retrievable without allocating a second code. It does not grant new reward eligibility. No aliases are automatically merged, and the original legacy reservations remain immutable.

## Organizer actions

- **Add approved member:** Email, optional name, and reason. An existing email returns the existing member without overwriting profile, access or eligibility. A new member receives no code or administrator rights. A matching pending application is marked approved using the existing notification queue; this operation does not dispatch email.
- **Suspend / restore access:** Requires a reason. Suspension prevents login requests and all subsequent protected database operations, including requests with an existing session. Previously delivered information cannot be recalled from a browser. Codes remain permanently assigned. Organizer accounts cannot be suspended through this interface.
- **Default / Allow / Block:** Applies to each member and reward family. Default follows existing entitlement and event-registration rules. Allow grants eligibility, but does not bypass stock, campaign dates, allocation closure, or identity deduplication. Block prevents new claims. Active members can still retrieve codes already assigned to them.

Changes and their audit records commit in the same transaction. The audit stores actor, time, target, reason and before/after access or override values, never reward codes or authentication secrets. Repeating an already-applied access or eligibility setting does not add duplicate audit entries. The claim and administration functions lock the same member row, so a committed block or suspension takes effect before a later claim; a prior completed assignment is preserved.

Email changes, deletion, administrator grants, inventory uploads, code reassignment and redemption tracking are outside this feature.

## Interfaces and migration

Apply migrations in filename order, including `202611190006_member_registry.sql`, to an authorized database before deploying the matching application. Migration 006 adds a private eligibility-override table, a private assignment view, audit detail fields and organizer RPCs. It updates the existing reward reader and allocator to apply overrides and corrects organizer inventory totals to include legacy reservations. It does not rewrite existing people, registrations, codes or claims.

| HTTP interface | Behavior |
| --- | --- |
| `GET /api/admin/members` | Paginated registry; query parameters `search`, `event`, `status`, `family`, `assignment`, `page`, `view` |
| `POST /api/admin/members` | Add member with `email`, optional `name`, and `reason`; returns `id` and `existing` |
| `GET /api/admin/members/:id` | Member details, assignments, eligibility and recent audit |
| `PATCH /api/admin/members/:id` | Set boolean `active`, with `reason` |
| `PUT /api/admin/members/:id/eligibility` | Set `family`, `mode` (`default`, `allow`, `block`), and `reason` |

Mutations require the configured same origin. Request and database validation enforce the same fields and bounds. Member identity for participant operations still comes from verified Supabase Auth, never from a submitted email. The member reward response adds `eligible`; existing fields remain compatible.

For an authorized release, preserve a protected database backup, apply migration 006, then deploy the matching app. Keep earlier schema and immutable assignments during application rollback. Leave migration 006 in place: its override checks must continue protecting claims even when the new registry interface is rolled back. Do not restore the old allocator while any override is in use.

## Local verification

Synthetic verification lives outside Git under `.local/member-registry/`. No real member data, codes or credentials are used. Local checks cover database permissions, organizer MFA, own-member isolation, legacy matching, pagination and filters, audited mutations, duplicate entry, suspension, eligibility and permanent assignments. Native PostgreSQL checks cover concurrent blocks, claims, suspension, Gmail aliases and final-code allocation. HTTP checks use a local SQL-backed Supabase adapter. Browser checks use that adapter and headless Chrome; authentication-provider behavior is separately stubbed.

Local checks do not establish delivery through production Resend, production Auth configuration, or deployment status. Production migration, real email, publishing and remote verification remain separate explicitly authorized actions.
