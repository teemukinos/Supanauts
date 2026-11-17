/** Organizer's editorial archive. Separate from moderated member submissions. */
export type ArchiveEvent = {
  city: string;
  slug: string;
  title: string;
  date: string;
  venue?: string;
  description: string;
  paragraphs: string[];
  source?: string;
  resources: {title: string; url: string}[];
  film?: 'helsinki' | 'dublin';
};

// Sources: original Luma listings and the supplied community archive (6 Nov 2026).
// Dates are historical labels; uncertain dates never become calendar timestamps.
export const eventArchive: ArchiveEvent[] = [
  {city:'Amsterdam',slug:'amsterdam',title:'Supabase × Claude Community Meetup',date:'5 November 2026',venue:'Epicenter Amsterdam',
    description:'Lightning talks, a Claude Code workshop and time to build together.',
    paragraphs:[
      'The Amsterdam programme brought Supabase and Claude builders together at Epicenter for talks and a hands-on workshop. The challenge: build something ambitious with Claude Code, then share the result.',
      'The original listing names Fernanda Grace Lins, Ferhat Elmas and Teemu Kinos as speakers. It includes a build session and judging; project results will be added when their makers submit them.'
    ],source:'https://luma.com/supabase-lvcl',resources:[{title:'Community on tour — web presentation',url:'https://skene.ai/roadshow'}]},
  {city:'Berlin',slug:'berlin',title:'AI Payments for the Real Economy Hack',date:'24 October 2026',venue:'Revent, Rosenthaler Straße 13',
    description:'A day of building small-business software with Stripe Connect, Supabase and AI.',
    paragraphs:[
      'The Berlin hackathon asked teams to build software that adapts to what a small business needs. The published brief required Stripe Connect, Supabase and AI, with demos explaining both the product and its running costs.',
      'Julia Fontana, Elie Joseph and Teemu Kinos are listed as hosts. The programme ran from team matching through finalist demos and awards. Makers can share their own projects through Supanauts.'
    ],source:'https://luma.com/vx78o719',resources:[]},
  {city:'Stockholm',slug:'stockholm',title:'Supabase Roadshow with Skene',date:'22 September 2026',venue:'Epicenter, Jakobsbergsgatan 24',
    description:'Laptops open, builder demos and conversations around the same table.',
    paragraphs:[
      'The Stockholm roadshow stop invited people to bring whatever they were building: a side project, a startup or a weekend experiment. The programme at Epicenter included lunch and builder demos.',
      'The gallery brings together original photographs of the coworking tables, presentations and group at the end of the day.'
    ],source:'https://luma.com/y6bexb2h',resources:[]},
  {city:'Dublin',slug:'dublin',title:'Supabase and Anthropic community meetup',date:'July 2026',
    description:'A community gathering captured in the Dublin event film.',
    paragraphs:[
      'The Dublin archive brings together a short event film and preparation for a panel about Supabase, Anthropic and building with AI. The film captures the setting, shared tables and people working together.',
      'The surviving records disagree on the exact day, so this archive records July. Images below are frames from the original film, rather than a separate photo shoot.'
    ],resources:[{title:'Dublin — web presentation',url:'https://skene.ai/dublin'}],film:'dublin'},
  {city:'Helsinki',slug:'helsinki',title:'Skene Welcomes Supabase to HEL',date:'17 June 2026',venue:'Bar tÿpo, Tekstin talo',
    description:'A coworking day of demos, shared ideas and new connections before midsummer.',
    paragraphs:[
      'The Helsinki community met at Bar tÿpo for a full coworking day. The invitation welcomed builders using Supabase, including people working with Lovable, Bolt and v0.',
      'Teemu Kinos hosted the event with Skene and Mari Luukkainen. The programme combined coffee, lunch and builder demos. These photographs show the conversations, presentations and group that made the day.'
    ],source:'https://luma.com/8l00l79p',resources:[],film:'helsinki'},
];

export type ArchivePhoto = {
  file: string;
  city: string;
  alt: string;
  width: number;
  height: number;
  kind: 'photo' | 'film-still';
};

const hel = (id:string,alt:string):ArchivePhoto => ({file:`restored/helsinki-${id}.webp`,city:'Helsinki',alt,width:1800,height:1201,kind:'photo'});
const sto = (id:string,alt:string,width:number,height:number):ArchivePhoto => ({file:`restored/stockholm-${id}.webp`,city:'Stockholm',alt,width,height,kind:'photo'});

const cityPhoto = (city:'Berlin'|'Amsterdam',id:string,alt:string,width:number,height:number):ArchivePhoto => ({file:`restored/${city.toLowerCase()}-${id}.webp`,city,alt,width,height,kind:'photo'});

export const archivePhotos: ArchivePhoto[] = [
  hel('4M0A6230','Three builders sharing a laptop beside the plants at Bar tÿpo'),
  cityPhoto('Amsterdam','IMG_1205',"A presenter explaining a pixel-art project map at Epicenter Amsterdam",1800,1200),
  cityPhoto('Berlin','IMG_0796',"The Berlin hackathon group gathered in the presentation room at Revent",1800,1200),
  sto('IMG_0518','The Stockholm meetup group waving beneath the wooden staircase at Epicenter',1800,1200),
  hel('4M0A6390','The Helsinki meetup group gathered together at Bar tÿpo'),
  sto('IMG_0473','Builders chatting on the sofas at Epicenter',1800,1200),
  hel('4M0A6202','A builder smiling during a conversation in Helsinki'),
  sto('IMG_0488','A presenter explaining a project to the Stockholm audience',1512,1800),
  hel('4M0A6197','A builder working on a laptop at a shared table'),
  hel('4M0A6210','A builder with an orange beanie working beside an open laptop'),
  sto('IMG_0476','Builders sitting around the coworking table at Epicenter',1601,1800),
  hel('4M0A6216','Builders listening and discussing a project beside the window'),
  sto('IMG_0483','Attendees following a presentation from the sofa with a laptop',1350,1800),
  hel('4M0A6225','Two builders discussing an idea with an open laptop'),
  hel('4M0A6256','A conversation between builders in the Helsinki meetup room'),
  sto('IMG_0479','A presentation beside the coworking table at Epicenter',1800,1200),
  hel('4M0A6266','A wide view of the Helsinki coworking room and shared tables'),
  sto('IMG_0482','A presenter beside a screen during the Stockholm meetup',1512,1800),
  hel('4M0A6280','A builder presenting StoryRoots to the Helsinki group'),
  sto('IMG_0496','A builder presenting beside a large display at Epicenter',1800,1200),
  hel('4M0A6293','Builders listening to a demo at Bar tÿpo'),
  hel('4M0A6308','A builder explaining a project beside the presentation screen'),
  hel('4M0A6314','Builders laughing together between presentations'),
  sto('IMG_0505','A presenter demonstrating software to the Stockholm group',1800,1200),
  hel('4M0A6340','The Helsinki audience watching a presentation'),
  hel('4M0A6347','A presenter gesturing toward the screen at Bar tÿpo'),
  sto('IMG_0520','Builders talking together after the Stockholm presentations',1800,1200),
  hel('4M0A6353','A presenter speaking to the Helsinki group'),
  hel('4M0A6370','The Helsinki group smiling and celebrating together'),
  hel('4M0A6394','A closer view of the Helsinki group with Supabase boxes'),
  cityPhoto('Amsterdam','IMG_1175',"A builder demonstrating a game on screen at Epicenter Amsterdam",1800,1200),
  cityPhoto('Amsterdam','IMG_1179',"A builder presenting World Peace Goes Public in Amsterdam",1800,1200),
  cityPhoto('Amsterdam','IMG_1182',"A builder presenting a project with two displays at Epicenter Amsterdam",1800,1200),
  cityPhoto('Amsterdam','IMG_1185',"A builder showing a software project during the Amsterdam demos",1800,1200),
  cityPhoto('Amsterdam','IMG_1191',"A builder discussing a project from the stage at Epicenter Amsterdam",1800,1200),
  cityPhoto('Amsterdam','IMG_1199',"A builder demonstrating an app during the Amsterdam meetup",1800,1200),
  cityPhoto('Amsterdam','IMG_1207',"A builder presenting Starlight Mission Control in Amsterdam",1800,1200),
  cityPhoto('Amsterdam','IMG_1215',"A builder demonstrating a running game at the Amsterdam meetup",1800,1200),
  cityPhoto('Amsterdam','IMG_1221',"A builder showing a dark-themed app on screen in Amsterdam",1800,1200),
  cityPhoto('Amsterdam','IMG_1224',"A builder demonstrating an audio editor at Epicenter Amsterdam",1800,1200),
  cityPhoto('Berlin','IMG_0782',"Three builders working through an idea around a laptop in Berlin",1800,1200),
  cityPhoto('Berlin','IMG_0783',"Two builders sharing a table with their laptops at the Berlin hackathon",1800,1350),
  cityPhoto('Berlin','IMG_0790',"Builders working at a shared desk beside the windows at Revent",1800,1200),
  cityPhoto('Berlin','IMG_0793',"Two builders comparing work on a laptop beside the curtains",1800,1200),
  cityPhoto('Berlin','IMG_0785',"A team working around a long table at the Berlin hackathon",1512,1800),
  cityPhoto('Berlin','IMG_2500',"A speaker explaining a diagram to the Berlin hackathon audience",1800,1200),
  cityPhoto('Berlin','IMG_2505',"Builders discussing ideas at a whiteboard in Berlin",1800,1200),
  cityPhoto('Berlin','IMG_2508',"Hackathon participants talking together between build sessions",1800,1200),
  cityPhoto('Berlin','IMG_2515',"A Berlin team working around a table, seen through the glass meeting-room wall",1800,1200),
  cityPhoto('Berlin','IMG_2519',"A builder presenting Common Ground at the Berlin hackathon",1800,1350),
  cityPhoto('Berlin','IMG_2523',"Two builders presenting their project together in Berlin",1800,1350),
  cityPhoto('Berlin','IMG_2524',"A builder demonstrating software to the Berlin audience",1800,1200),
  cityPhoto('Berlin','IMG_2526',"A builder explaining a project while holding a laptop in Berlin",1800,1350),
  cityPhoto('Berlin','IMG_8670',"A team celebrating together after the Berlin hackathon presentations",1800,1350),
  cityPhoto('Berlin','IMG_8676',"Builders posing together at the end of the Berlin hackathon",1800,1350),
  cityPhoto('Berlin','IMG_0809',"A team and organizer smiling together after the Berlin demos",1800,1350),
  cityPhoto('Berlin','IMG_2528',"Three builders smiling for a selfie at the Berlin hackathon",1800,1350),
  {file:'dublin-7.5.webp',city:'Dublin',alt:'Builders gathered at a shared table, from the Dublin event film',width:540,height:960,kind:'film-still'},
  {file:'dublin-12.webp',city:'Dublin',alt:'Hands typing on a laptop, from the Dublin event film',width:540,height:960,kind:'film-still'},
  {file:'dublin-21.webp',city:'Dublin',alt:'A builder working at the Dublin meetup, from the event film',width:540,height:960,kind:'film-still'},
];

export function eventPhotos(city:string){return archivePhotos.filter(photo=>photo.city===city);}
