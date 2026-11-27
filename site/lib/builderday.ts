export const cities = [
  'Peshawar', 'Seoul', 'Singapore', 'Nouakchott', 'Manta', 'London', 'Rosario',
  'Santiago', 'San Salvador', 'New York City', 'Toronto', 'Austin', 'Mexico City', 'San Francisco',
].map(city => ({city, url: `https://luma.com/supabase-builder-day-${city.toLowerCase().replaceAll(' ', '-')}`}));

export type CityCount = {city: string; url: string; count: number | null};
export type Leaderboard = {cities: CityCount[]; updatedAt: string};
