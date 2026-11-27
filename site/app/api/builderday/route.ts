import {cities, type CityCount} from '../../../lib/builderday';

// Luma's public page exposes the same Going count displayed to visitors.
// Its page data is not a stable API: fail closed if its shape changes.
async function readCount(city: typeof cities[number]): Promise<CityCount> {
  try {
    const response = await fetch(city.url, {cache: 'no-store', signal: AbortSignal.timeout(8000)});
    if (!response.ok) throw new Error('Luma unavailable');
    const html = await response.text();
    const match = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json">([\s\S]*?)<\/script>/);
    if (!match) throw new Error('Public event data unavailable');
    const data = JSON.parse(match[1])?.props?.pageProps?.initialData?.data;
    const count = data?.guest_count;
    if (data?.event?.name !== `Supabase Builder Day: ${city.city}` || data?.event?.show_guest_list !== true || !Number.isSafeInteger(count) || count < 0) throw new Error('Public count unavailable');
    return {...city, count};
  } catch {
    return {...city, count: null};
  }
}

let cache: {cities: CityCount[]; updatedAt: string} | undefined;
let pending: Promise<{cities: CityCount[]; updatedAt: string}> | undefined;

export async function GET() {
  if (!cache || Date.now() - Date.parse(cache.updatedAt) >= 300_000) {
    pending ||= Promise.all(cities.map(readCount)).then(counts => ({cities: counts, updatedAt: new Date().toISOString()}));
    try { cache = await pending; } finally { pending = undefined; }
  }
  return Response.json(cache, {headers: {'Cache-Control': 'no-store'}});
}
