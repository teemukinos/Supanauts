# Supabase credit inventory cutover

The November 2026 Amsterdam batch contains 60 single-use codes worth $25 each. The source CSV and final legacy database snapshot match exactly. Twenty codes were assigned through skene.ai/amsterdam; forty remain unassigned. Assignment does not prove provider redemption. The historical CSV is not a current redemption report.

The legacy allocator was closed before the final snapshot. An exclusive table lock drained in-flight writes, and a write-blocking trigger prevents an old invocation from allocating after cutover. The original table and assignments remain intact. Do not reopen that allocator: it no longer owns the unassigned inventory.

All sixty codes are now in the private Supanauts inventory under the single `supabase-credits` reward family. Twenty immutable legacy reservations preserve the exact recipient address, duplicate identity and timestamp. Seven recipients match existing members; thirteen have no exact registered-email match. Unmatched reservations remain assigned and do not grant membership. If an original recipient later gains approved access with the same address, they retrieve their original code.

Every registered event email qualifies regardless of registration status. Manual membership approval alone does not grant a new credit allocation. Previously assigned aliases are blocked using Amsterdam's original normalization. New allocations normalize Gmail aliases only; other providers keep exact registered addresses. Authenticated member and identity locks, unique constraints and one database transaction prevent duplicate allocations and code reuse. Retries return the existing assignment.

All future Supabase credit batches must use the same reward family. Never recycle assigned codes or create a new family to reset eligibility. The public counter excludes both regular claims and legacy reservations. The redemption deadline is 2 May 2027 at 00:00 UTC; no promise is made about credit expiry after redemption.

Protected reconciliation exports and backups stay in `.local/credit-cutover/`, outside Git and deployments. Local synthetic PostgreSQL checks cover concurrent claims, final-code races, retries, Gmail and legacy aliases, unmatched reservations, eligibility, expiry and old allocator shutdown. No real attendee reward was claimed during verification. Teemu's existing swag assignment is unchanged.
