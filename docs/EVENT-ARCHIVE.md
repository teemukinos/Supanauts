# Event archive and media

The editorial archive lives in `site/lib/event-archive.ts`. It is separate from moderated member submissions. Five city pages at `/events/archive/[city]` retain original event sources and published resources. Dublin uses a month-only date because the supplied records disagree on the day. The owner subsequently supplied Berlin and Amsterdam originals; both pages now have documentary galleries and photographic covers.

The gallery contains 18 Helsinki, 10 Stockholm, 18 Berlin and 11 Amsterdam photographs, plus 3 explicitly labelled Dublin film stills. Selection followed visual review of all 79 Helsinki and 53 Stockholm originals. Helsinki retains the professional photographer's existing grade. Stockholm, Berlin and Amsterdam use modest Pixelmator tonal corrections and selected crops. No generated faces, replacement backgrounds or AI-styled documentary images are used.

Media stays outside Git and is not relicensed under the repository's Apache licence. The owner requested use of the event archive. Photographer attribution has not been supplied. Originals and superseded treatments remain in the Studio job.

## Local media handoff

The existing Studio job is `/Users/teemukinos/Personal/studio/supabase-europe`.

- Source photographs: `assets/photo-restoration-20261117/helsinki` and the owner’s `/Users/teemukinos/Downloads/Stockholm`, `Berlin` and `Amsterdam` folders.
- Final exports: `art/photo-restoration-20261117/helsinki-preserved`, `stockholm-final`, `berlin-final` and `amsterdam-final`; matching 900px derivatives are in `thumbnails`.
- Recipe, final contact sheets, grade comparison, media manifest and responsive screenshots: `out/photo-restoration-20261117`.
- Packaging: `scripts/package-restored-photos.py` copies full images and thumbnails into this checkout's ignored `site/public/media/restored`. It removes EXIF/XMP, retains ICC profiles and asserts that metadata removal does not change decoded pixels.

Build with `NEXT_PUBLIC_EVENT_MEDIA_BASE_URL=/media` for local media. A future deployment must include the manifest's 114 files plus the existing film/still assets, or upload them to the configured media base. Source code alone does not include these media files. Do not include originals, contact sheets or superseded treatments in the public media package.

## Validation — 17 November 2026

Production build and TypeScript checks pass. Local browser checks cover desktop/mobile overflow, visible image decoding, city filters, pagination, viewer keyboard controls and restored focus, all five archive routes, unknown-city 404, anonymous channel rejection, no video download before Play and Dublin playback. The captured 16 backend source files remain byte-identical to the start of this restoration. Local preview has no backend credentials; unavailable rewards there are not production inventory data.

The 114 media files total 26,059,022 bytes. All 18 Helsinki source/export profile pairs are sRGB. No remote publication, database changes, GitHub writes or deployment occurred in this unit.
