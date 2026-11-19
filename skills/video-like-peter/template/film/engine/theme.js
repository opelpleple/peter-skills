// Look of the film in one place: palette C, the beat grid, chapter times T, type sizes TYPE and the world map
// the camera travels over (STATION). Scenes read colours and times from here, never their own numbers.
//
// The palette is a neutral placeholder. To brand a film, replace the values (keep the names, or add new ones)
// and mirror them in ui/tokens.css so captured UI components match the film.

export const C = {
  // accent
  accent: '#3D5AFE',        // primary accent (links, highlights, the cursor click ring)
  accentDeep: '#2A40C8',
  accentSoft: '#E8ECFF',
  warm: '#FF7A45',          // a second accent for the one thing that must pop
  // neutrals
  ink: '#16171C', muted: '#5E6070', faint: '#8A8C99', line: '#D6D8E2',
  white: '#FFFFFF', black: '#000000',
  // fields (one colour per station)
  page: '#F2F1EC',          // the light station
  dark: '#14151B',          // the dark station
  darkLift: '#23252F',
  // status
  success: '#1FA971', successSoft: '#E2F6EC',
};

// 120 BPM in 4/4: a beat is 0.5 s (15 frames at 30 fps), a bar is 2 s, a four bar phrase 8 s. Every arrival
// sits on the 0.125 s grid; chapter changes sit on bars. Change BPM only together with the music plan.
export const BPM = 120;
export const BEAT = 60 / BPM;
export const FR = 1 / 30;                       // one frame (core.js FPS = 30)
export const beat = (n) => n * BEAT;            // beat(16) = 8.0 s
export const bar = (n) => (n - 1) * 4 * BEAT;   // bar(1) = 0, bar(5) = 8.0 s

// Chapter times in seconds (scene time). With an empty CUT table in main.js, film time = scene time.
export const T = {
  intro: 0.0,       // s01 dark: headline blurs in word by word
  move: 3.75,       // camera starts travelling to the light station (lands 4.0)
  card: 4.0,        // s02 light: card pops in, cursor clicks, counter runs
  end: 8.0,
  total: 8.0,
};

// World map. Each station is a cell of GX x GY world units; neighbouring cells touch, so a camera move from
// one to the next sweeps a clean colour edge through the frame. A scene names its station; the director
// builds the scene at that station's centre.
export const GX = 2600, GY = 1500;
export const STATION = {
  dark: { col: 0, row: 0, color: C.dark },
  light: { col: 1, row: 0, color: C.page },     // to the right of dark: the camera pans across
  lab: { col: 0, row: 2, color: C.page },       // test scenes (devOnly); the camera parks here when one is built alone
};
for (const s of Object.values(STATION)) { s.x = s.col * GX; s.y = s.row * GY; }

// Type scale (font size in design px on the 1920x1080 frame). UI type must reach 18 px or more at its biggest.
export const TYPE = {
  headline: 120,
  sub: 44,
  card: 30,
  counter: 96,
};
