# SupaSquad directory

The `/supasquad` tab helps visitors find people. It replaces the initial programme overview after the owner clarified that the purpose is member discovery.

`site/lib/supasquad.ts` contains 21 public profiles researched on 17 November 2026: 11 people with public membership statements and 10 people documented in SupaSquad programme contribution records. The latter are labelled programme contributors, not certified current members. This is an independent, incomplete directory; the official programme page does not publish a roster.

Every profile has a source URL and a public profile destination. Search matches names, locations, descriptions and topics, ignoring case and diacritics. Visitors can filter membership statements and programme contributors separately. Locations are included only where a public professional profile supports them. Topics describe publicly documented work, not an assigned official programme track. No email addresses, phone numbers, private community rosters, payment amounts or portraits are included in member records.

## Maintaining the list

Prefer an individual's own website, GitHub biography or explicit public membership announcement. A public professional profile can also support a listing. Check that an announcement belongs to the named person: likes, reposts and comments do not prove the profile owner's membership. General Supabase contributions or conference attendance alone are insufficient.

For programme contributors, retain that distinct label and link to the relevant Supabase-hosted contribution record. Payment or contribution records are not an official membership register. Keep historical announcements and known alumni out of the current membership-statement group unless a current public statement supports inclusion. Do not use unused testimonial data or stock-photo names from the upstream website source as a member list.

Update the checked date only after reviewing the source. Add a person only with evidence, remove outdated information when discovered, and honour correction/removal requests through the listed organizer contact. A complete roster still requires an authoritative list from Supabase or its programme organizers.

## Sources

- Official programme: https://supabase.com/open-source/contributing/supasquad
- Official contributor programme explanation: https://supabase.notion.site/Open-Collective-Program-773b9dc371144a5f86c5e64bc2c2485f
- Public programme records: https://opencollective.com/supabase-supasquad/transactions
- Per-person primary sources are retained beside each record in `site/lib/supasquad.ts` and linked from each card.

This change does not create accounts, send invitations, alter membership access, or modify the database. Production publication requires a separate explicit request under the owner's remote-action rule.

## Revolving globe

The globe reuses the original Amsterdam event's embedded land mask and Canvas approach from `skene-marketing-website`, branch `feat/amsterdam-pages`, commit `cffaae33`. The renderer retains 14,000 Fibonacci sample positions, depth shading and a 150-second rotation. No external map API, geolocation permission, runtime geocoding or WebGL dependency is used.

`site/lib/supasquad-locations.ts` maps the directory's existing public location labels to approximate geographic centres. Ten profiles have mapped locations: eight city-level locations and two country-level locations (India and El Salvador). Country-level markers have dashed outlines and an explicit precision label. The other eleven profiles remain searchable without invented map coordinates. These markers are not home addresses or live locations.

Select a marker to focus that location and pause rotation. “Find in directory” filters the list and focuses its search input. The location dropdown was removed at the owner’s request. All people remain available through the searchable directory, including locations on the far side of the globe. Rotation can be paused and respects reduced motion; rendering also stops offscreen and while the document is hidden. The renderer removes its animation frame, observers and listeners when unmounted.
