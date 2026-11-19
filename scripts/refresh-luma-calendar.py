#!/usr/bin/env python3
"""Read public Luma metadata into the website snapshot. No account or remote writes."""
import argparse
import datetime as dt
import json
import re
import subprocess
import time
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'site/data/luma-events.json'
SOURCES = json.loads((ROOT / 'site/data/luma-sources.json').read_text())
class SourceUnavailable(ValueError):
    pass


NOW = dt.datetime.now(dt.timezone.utc).isoformat().replace('+00:00', 'Z')


def fetch(url):
    parsed = urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname not in {'luma.com', 'api.lu.ma'}:
        raise ValueError('Only public Luma source URLs are supported')
    result = subprocess.run(['curl', '--fail', '--silent', '--show-error', '--max-time', '30', '--write-out', '\n%{http_code}', url], capture_output=True, text=True)
    body, _, status = result.stdout.rpartition('\n')
    if result.returncode:
        raise SourceUnavailable('HTTP ' + status if status else 'Public source request failed')
    if len(body) > 8_000_000:
        raise ValueError('Source exceeds size limit')
    return body


def page(url):
    text = fetch(url)
    match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', text, re.S)
    if not match:
        raise ValueError('Public page metadata unavailable')
    return json.loads(match.group(1))['props']['pageProps']['initialData']


def normalized(event, source, checked=NOW):
    if event.get('visibility') != 'public':
        return None
    start, end = event.get('start_at'), event.get('end_at')
    if not start or not end or dt.datetime.fromisoformat(end.replace('Z', '+00:00')) <= dt.datetime.fromisoformat(start.replace('Z', '+00:00')):
        return None
    geo = event.get('geo_address_info') or {}
    online = event.get('location_type') in {'online', 'virtual'}
    public_address = event.get('geo_address_visibility') == 'public' and geo.get('mode') != 'obfuscated'
    slug = event.get('url', '')
    if not re.fullmatch(r'[\w-]+', slug):
        raise ValueError('Invalid event URL')
    return {'id': event['api_id'], 'title': event['name'], 'url': 'https://luma.com/' + slug,
            'startsAt': start, 'endsAt': end, 'timezone': event.get('timezone') or 'UTC',
            'allDay': False, 'city': geo.get('city') or geo.get('city_state') or '',
            'country': geo.get('country') or '', 'location': geo.get('address', '') if public_address else '',
            'online': online, 'locationHidden': not online and not public_address,
            'status': 'cancelled' if event.get('cancelled_at') else 'scheduled',
            'source': source, 'checkedAt': checked}


def unescape(value):
    return re.sub(r'\\([nN,;\\])', lambda m: '\n' if m[1].lower() == 'n' else m[1], value)


def ics_events(text, source):
    if not text.startswith('BEGIN:VCALENDAR') or 'END:VCALENDAR' not in text:
        raise ValueError('Invalid public iCal feed')
    text = re.sub(r'\r?\n[ \t]', '', text)
    output = []
    for block in text.split('BEGIN:VEVENT')[1:]:
        fields = {}
        for line in block.split('END:VEVENT')[0].splitlines():
            key, sep, value = line.partition(':')
            if sep:
                fields[key.split(';')[0]] = value
        if not all(fields.get(k) for k in ['DTSTART', 'DTEND', 'UID', 'SUMMARY']):
            continue
        description = unescape(fields.get('DESCRIPTION', ''))
        link = re.search(r'https://(?:luma\.com|lu\.ma)/([\w-]+)', description)
        if not link:
            continue
        start, end = fields['DTSTART'], fields['DTEND']
        all_day = len(start) == 8
        if not all_day and not (start.endswith('Z') and end.endswith('Z')):
            continue  # Do not invent a timezone for floating dates.
        fmt = '%Y%m%d' if all_day else '%Y%m%dT%H%M%SZ'
        a, b = [dt.datetime.strptime(x, fmt).replace(tzinfo=dt.timezone.utc) for x in [start, end]]
        if b <= a:
            continue
        location = unescape(fields.get('LOCATION', ''))
        address = description.split('Address:\n', 1)[-1].split('\n\nHosted by', 1)[0].split('\n') if 'Address:\n' in description else []
        city, country = ('', '')
        if len(address) >= 3 and not any(line.startswith('http') for line in address[-2:]):
            city, country = address[-2].split(',')[0].strip(), address[-1].strip()
        if location.startswith('https://luma.com/event/') or location.startswith('https://lu.ma/event/'):
            location = ''
        output.append({'id': fields['UID'].split('@')[0], 'title': unescape(fields['SUMMARY']),
                       'url': 'https://luma.com/' + link[1], 'startsAt': a.isoformat().replace('+00:00', 'Z'),
                       'endsAt': b.isoformat().replace('+00:00', 'Z'), 'timezone': 'UTC', 'allDay': all_day,
                       'city': city, 'country': country, 'location': location,
                       'online': location.lower() in ['online', 'zoom', 'google meet'],
                       'locationHidden': not bool(location),
                       'status': 'cancelled' if fields.get('STATUS') == 'CANCELLED' else 'scheduled',
                       'source': source, 'checkedAt': NOW})
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--enrich-archive', action='store_true', help='Also verify historical feed pages; slower and subject to Luma rate limits')
    args = parser.parse_args()
    previous = json.loads(TARGET.read_text()) if TARGET.exists() else {'events': []}
    events = {e['id']: e for e in previous['events']}
    reports, failures = [], []
    verified_pages = 0
    for calendar in SOURCES['calendars']:
        url, name = calendar['url'], calendar['name']
        try:
            data = page(url)['data']
            cal_id = data['calendar']['api_id']
            feed = ics_events(fetch('https://api.lu.ma/ics/get?entity=calendar&id=' + cal_id), name)
            for event in feed:
                # Prefer richer event-page metadata when both sources have it.
                old = events.get(event['id'])
                if not old or old.get('timezone') == 'UTC':
                    events[event['id']] = event
            upcoming = data.get('upcoming', {})
            for item in upcoming.get('entries', []):
                event = normalized(item['event'], name)
                if event:
                    events[event['id']] = event
            reports.append({'name': name, 'url': url, 'checkedAt': NOW, 'feedCount': len(feed),
                            'upcomingCount': len(upcoming.get('entries', [])), 'hasMore': upcoming.get('has_more', False)})
        except Exception as error:
            failures.append({'url': url, 'reason': str(error)[:120]})
    slugs = list(dict.fromkeys(SOURCES['events'] + ([event['url'].rsplit('/', 1)[-1] for event in events.values()] if args.enrich_archive else [])))
    for slug in slugs:
        url = 'https://luma.com/' + slug
        try:
            payload = page(url)
            if payload['kind'] != 'event':
                raise ValueError('Source is not an event')
            data = payload['data']
            verified_pages += 1
            event = normalized(data['event'], (data.get('calendar') or {}).get('name') or 'Independent organizer')
            if event:
                # Only registry-approved sources or events explicitly mentioning Supabase.
                events[event['id']] = event
            else:
                events = {key: value for key, value in events.items() if value['url'] != url and key != data['event'].get('api_id')}
        except Exception as error:
            failures.append({'url': url, 'reason': str(error)[:120]})
            if 'HTTP 429' in str(error) or 'HTTP 403' in str(error):
                failures.append({'url': 'https://luma.com', 'reason': 'Remaining page checks deferred after access throttling; retained feed or previous metadata.'})
                break
        time.sleep(0.5)
    aliases = SOURCES.get('aliases', {})
    unique = {}
    for event in events.values():
        url = aliases.get(event['url'], event['url'])
        if url != event['url']:
            continue
        if url in SOURCES.get('onlineEvents', []):
            event.update(online=True, locationHidden=False, location='', city='', country='')
        event['scheduleNote'] = SOURCES.get('scheduleNotes', {}).get(url, '')
        unique[url] = event
    result = {'updatedAt': NOW, 'coverage': 'partial', 'coverageNote': SOURCES['notes'],
              'sources': reports, 'failures': failures, 'events': sorted(unique.values(), key=lambda e: e['startsAt'])}
    if not reports and verified_pages == 0:
        raise SystemExit('No sources refreshed; existing snapshot preserved.')
    temporary = TARGET.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(TARGET)
    print(f"Saved {len(result['events'])} unique events; {len(failures)} source failures. Coverage: partial.")
    for failure in failures[:5]:
        print(f"Unavailable: {failure['url']} ({failure['reason']})")


if __name__ == '__main__':
    main()
