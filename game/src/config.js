// Sky Courier: every tuning number, colour and mission in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** Chase camera: how far behind and above the plane it sits, and its focal length. */
export const CAMERA = {
  behind: 26, // metres behind the aircraft
  above: 7, // metres above the aircraft
  focal: 620, // perspective focal length, in logical pixels
  horizon: 300, // screen y of the horizon when level
};

/** The aircraft: a single-engine courier prop plane. Speeds in m/s, altitudes in m. */
export const PLANE = {
  minSpeed: 26, // below this the wing stops flying and it sinks
  cruiseSpeed: 62,
  maxSpeed: 96,
  climbRate: 9, // m/s at full throttle, level
  sinkRate: 7, // m/s when the throttle is idle
  turnRate: 0.55, // rad/s of heading at full bank
  maxBank: 0.62, // rad of roll at full deflection
  pitchRate: 0.4,
  maxPitch: 0.3,
  throttleUp: 0.55, // throttle change per second
  throttleDown: 0.8,
  fuel: 100, // percent at departure
  fuelBurn: 0.55, // percent per second at full throttle
  fuelIdle: 0.12, // percent per second at idle
  ringFuel: 6, // fuel refunded by each ring
};

/** The valley the course runs down. Distances in metres. */
export const VALLEY = {
  length: 5200, // runway to runway
  halfWidth: 260, // the flat valley floor, each side of the centreline
  wallStart: 300, // where the mountains begin to rise
  wallHeight: 320, // how high the side mountains get
  floorY: 0, // valley floor altitude
};

/** A target ring: a glowing hoop the plane must fly through. */
export const RING = {
  radius: 26, // metres, centre to rim
  hitRadius: 20, // flying within this of the centre counts
  points: 100,
  timeBonus: 4, // seconds added to the clock
};

/** Landing: what counts as a good touchdown on the destination runway. */
export const LANDING = {
  maxSink: 4.5, // m/s of vertical speed at touchdown
  maxSpeed: 58, // m/s over the threshold
  align: 0.22, // rad of heading error allowed
  points: 500,
  smoothBonus: 300, // extra for a gentle touchdown
};

/** The three missions. Same engine, different valley, rings and fuel. */
export const MISSIONS = [
  {
    id: 'valley',
    name: 'Valley Run',
    blurb: 'Six rings down the green valley. A gentle first sortie.',
    seed: 11,
    rings: 6,
    fuel: 100,
    dusk: 0,
    timeLimit: 240,
  },
  {
    id: 'alpine',
    name: 'Alpine Pass',
    blurb: 'Eight rings through the high pass. Mind the rock.',
    seed: 47,
    rings: 8,
    fuel: 92,
    dusk: 0,
    timeLimit: 260,
  },
  {
    id: 'night',
    name: 'Night Courier',
    blurb: 'Eight rings at dusk, on a short tank. Fly the lights.',
    seed: 83,
    rings: 8,
    fuel: 78,
    dusk: 1,
    timeLimit: 260,
  },
];

/** Palette: one coherent alpine day, and a dusk variant for the night mission. */
export const PALETTE = {
  day: {
    skyTop: '#2f6fd0',
    skyMid: '#7fb2e8',
    skyHorizon: '#dceefb',
    sun: '#fff3c4',
    cloud: 'rgba(255,255,255,0.85)',
    farMountain: '#8fa8c8',
    nearMountain: '#5d7a9e',
    groundFar: '#7da35c',
    groundNear: '#5d8a48',
    fieldA: '#8fae5e',
    fieldB: '#c2a55e',
    fieldC: '#6f9e57',
    river: '#4f9fd8',
    road: '#8d8578',
    runway: '#3c4148',
    runwayMark: '#f2f5f7',
    ring: '#ffb02e',
    ringCore: '#fff3c4',
    planeBody: '#e8eef4',
    planeTrim: '#d94f3d',
    planeGlass: '#1d3a5c',
    hud: '#7df9ff',
    hudWarn: '#ffb02e',
    hudBad: '#ff5a4e',
    panel: 'rgba(8,18,32,0.55)',
    text: '#eef4f8',
    muted: '#aebfcc',
  },
  dusk: {
    skyTop: '#2b2a55',
    skyMid: '#7a4a6e',
    skyHorizon: '#f2a35e',
    sun: '#ffd9a0',
    cloud: 'rgba(255,196,150,0.7)',
    farMountain: '#5a4a72',
    nearMountain: '#3e3358',
    groundFar: '#4a5a44',
    groundNear: '#37472f',
    fieldA: '#5a6b46',
    fieldB: '#8a6f4e',
    fieldC: '#46583c',
    river: '#3d6a8a',
    road: '#5e5648',
    runway: '#23262c',
    runwayMark: '#e8e2c8',
    ring: '#ffb02e',
    ringCore: '#fff3c4',
    planeBody: '#dfe6ec',
    planeTrim: '#d94f3d',
    planeGlass: '#16283e',
    hud: '#7df9ff',
    hudWarn: '#ffb02e',
    hudBad: '#ff5a4e',
    panel: 'rgba(10,10,28,0.6)',
    text: '#f2ecdf',
    muted: '#b9aec4',
  },
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'sky-courier.best';
