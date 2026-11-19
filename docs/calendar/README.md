# Community calendar

The active site checkout is `/Users/teemukinos/Documents/ChatGPT/subanauts`. `/events` combines verified public Luma metadata with published Supanauts events, and preserves the five-city photo archive. The navigation entry is Calendar.

## Automatic refresh

The page and `/api/calendar` now share `site/lib/luma-sync.ts`. Automatic refresh is enabled by default. Each public source is cached for one hour in the Next.js Data Cache. The first request after that interval starts revalidation; cached data can be served while it completes. A visible calendar page refreshes its server data every five minutes and when returning after five minutes away, preserving selected filters, timezone and month. Calendar applications also trigger source checks when they poll the subscription. There is no separate scheduler, credential requirement or rebuild for routine source updates. With no traffic there is no background job; the next request resumes refresh.

Discovery reads the public Supabase calendar and its iCal feed independently. Upcoming and recently ended events are then checked against their individual public Luma pages. The registry's approved independent events are included. New events on configured calendars are discovered automatically; unrelated calendars and global Luma search are not crawled automatically. Add an approved public calendar's ID, URL and name to `luma-sources.json` to expand discovery.

`luma-import.ts` validates source metadata, keeps stable event IDs, propagates schedule changes and cancellations, applies known aliases and date warnings, and removes verified private/unlisted events. Raw page HTML, guest information and meeting links are never cached. The parsed source cache retains its last successful result on fetch or parse errors. A cold cache falls back to the checked-in snapshot for the page. If source failures leave an incomplete cold cache, the full subscription returns 503 with Retry-After so calendar applications retain their previous events instead of interpreting omissions as deletions. Historical event cache entries are read without outbound refresh; verified privacy removals remain applied after events age out of active checks. The page discloses delayed sources and the last source check time. Missing events in a partial feed are not assumed cancelled.

Requests have an eight-second timeout and an 8 MB response limit. One render starts source work for at most 20 seconds (an already-started request may finish up to eight seconds later). Individual event checks are limited to 24 per pass, with overflow rotated hourly. HTTP 403/429 stops further outbound requests in the current process for at least an hour and honors a longer Retry-After. Other failures have a 15-minute process cooldown. Next's source cache prevents successful downloads from repeating on every visit. Multiple server instances need a shared Next Data Cache for consistent caching; the process cooldown is not a distributed rate limiter.

Set `LUMA_SYNC_ENABLED=false` for offline development. Production must preserve or provide the Next.js Data Cache; ephemeral cache resets fall back to the bundled snapshot and require fresh source reads. The current implementation is local and has not been deployed.

## Rebuild the fallback snapshot manually

Run from the repository root:

```sh
python3 scripts/refresh-luma-calendar.py
```

The script reads `site/data/luma-sources.json`, fetches the public Supabase calendar and its iCal feed, and verifies the registered event URLs against their public page metadata. It writes `site/data/luma-events.json` atomically. It requires Python 3 and curl, but no Luma account, API key, database or provider writes. New public URLs can be added to the registry after checking their relationship to Supabase. `onlineEvents` records virtual formats explicitly confirmed on the public event page when structured metadata is incomplete. Public calendar discovery and web search are complementary; search itself is not automated by this script.

Only public facts are retained: title, canonical source URL, event identifier, start/end time, timezone, public city/country/venue and calendar name. Guest lists, organizer contact information, meeting access links, images and event descriptions are not stored. Guest-only venues remain hidden. Private or unlisted pages are excluded when verified. A failed request retains the previous record and its previous check time. Full source failures preserve the snapshot; successful partial runs record failures. A disappeared event must be checked with its organizer rather than silently assumed cancelled.

The public calendar feed observed on 17 November returned 249 historical entries, ending in July 2025. The calendar page supplied its current upcoming event, and public web searches supplied newer and independent events. This is explicitly partial coverage, not a claim that the feed contains every Supabase event. Use `--enrich-archive` to check historical feed pages for original event timezones and locations. Stop on HTTP 403/429 rather than retrying a blocked route. The initial enrichment verified 105 pages; 175 older pages were unavailable (a later request confirmed HTTP 429; further requests stopped) and retain their public feed metadata. City/country are recovered only where the feed includes an explicit address block. Searches covered Luma/lu.ma, Supabase, SupaSquad, meetups, workshops, online events, and November/December 2026.

## Dates and duplication

Luma's structured event schedule is the source for exact timestamps; search snippets and description years are not used to invent dates. Known schedule/description conflicts are recorded in `scheduleNotes`; those listings show a warning and are excluded from iCal until resolved. The Pioneer F26 listing currently has such a conflict. No end time is invented. The original Dublin archive retains its uncertain July date outside the timed calendar.

Canonical URLs normalize lu.ma to luma.com and remove tracking queries. Luma IDs and URLs deduplicate imports. Explicit merged-event aliases are stored in the registry. Published Supanauts items with the same registration URL enrich the existing event with its local recap instead of adding another event. An explicit local cancellation is retained. Event IDs remain stable across refreshes.

The selected display timezone controls agenda dates, month membership and time labels. All-day dates retain their source dates; end dates are exclusive. Ongoing events remain in Upcoming until they end. Cancelled events remain available with a cancellation label and a CANCELLED iCal status.

## Calendar subscription

`/api/calendar` downloads an RFC 5545-style feed with stable UIDs, UTC timestamps, CRLF endings, escaped text and UTF-8-safe line folding. The Subscribe button copies that URL for a calendar application's subscription feature. Downloading the file alone is a one-time import. `?event=EVENT_ID` or an existing published event slug downloads one event. Unknown events return 404; unresolved schedule conflicts return 409.

A deployed subscription uses the same automatically refreshed source cache as the page. Routine source changes do not require a new deployment. Calendar apps control their own polling interval; downloading a file remains a one-time import. The response headers `X-Calendar-Sync` and `X-Calendar-Source-Checked` expose sync state and the last successful source check for diagnostics. If a configured Supanauts backend is unavailable, the full subscription returns 503 rather than silently removing its published events; the public page can still show the Luma snapshot.

## Local verification

Run `npm run typecheck` and `npm run build` in `site/` with Node.js 24 LTS. The local evidence under `.local/community-calendar` covers source validation, timezone boundaries, all-day and multi-day dates, cancelled events, URL deduplication, ICS output, and desktop/mobile interaction. These scripts are local only and excluded from Git. No remote tests or reviews are created.

References: [Supabase community calendar](https://luma.com/supabase_community_events), [Luma discovery limitations](https://help.luma.com/p/searching-for-events), [Luma iCal subscriptions](https://help.luma.com/p/ical-syncing).
