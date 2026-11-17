export type EventFilm = {
  id: string;
  title: string;
  duration: string;
  video: string;
  poster: string;
  captions?: string;
  summary: string;
};

// Website-use permission is recorded in the Studio brief. Media stays outside Git.
export const eventFilms: EventFilm[] = [
  {id:'roadshow', title:'Roadshow', duration:'15 sec', video:'roadshow-2026.mp4', poster:'roadshow-2026-poster.webp', summary:'A short city montage introducing the Supabase × Skene roadshow. Instrumental music; no dialogue.'},
  {id:'helsinki', title:'Helsinki', duration:'27 sec', video:'helsinki.mp4', poster:'helsinki-poster.webp', summary:'Builders, laptops and conversations at the Helsinki meetup. Music with vocals; no recorded talks.'},
  {id:'dublin', title:'Dublin', duration:'26 sec', video:'dublin.mp4', poster:'dublin-poster.webp', summary:'Dublin streets, talks and builders sharing a table at the meetup. Music with vocals; no recorded talks.'},
];
