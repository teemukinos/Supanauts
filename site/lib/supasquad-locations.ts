// Representative city/country centres, not personal addresses or live locations.
// Keys match the public location labels sourced in supasquad.ts.
export type GlobeLocation={latitude:number;longitude:number;precision:'city'|'country'};
export const supaSquadLocations:Record<string,GlobeLocation>={
  'El Salvador':{latitude:13.79,longitude:-88.90,precision:'country'},
  'Santiago, Chile':{latitude:-33.45,longitude:-70.67,precision:'city'},
  'Bern, Switzerland':{latitude:46.95,longitude:7.45,precision:'city'},
  'Quito, Ecuador':{latitude:-0.18,longitude:-78.47,precision:'city'},
  'Lima, Peru':{latitude:-12.05,longitude:-77.04,precision:'city'},
  'India':{latitude:20.59,longitude:78.96,precision:'country'},
  'Ankara, Türkiye':{latitude:39.93,longitude:32.86,precision:'city'},
  'Mumbai, India':{latitude:19.08,longitude:72.88,precision:'city'},
  'Helsinki, Finland':{latitude:60.17,longitude:24.94,precision:'city'},
  'Aachen, Germany':{latitude:50.78,longitude:6.08,precision:'city'},
};
