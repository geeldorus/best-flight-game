// Kestrel Courier — game-wide constants and mission definitions.
// One file, one job: every number the rest of the game tunes lives here.

export const WORLD = {
  size: 2600, // island is size x size metres, centred on (0, 0)
  runway: { x: 0, z: 0, length: 420, width: 30, heading: 0, elevation: 2.0 },
  waterLevel: 0.55,
  maxAltitude: 420,
};

export const PLANE = {
  maxSpeed: 92, // m/s at full throttle, level flight
  cruiseSpeed: 58,
  stallSpeed: 27, // below this the wing stops flying and the nose drops
  takeoffSpeed: 31,
  accel: 14, // m/s^2 at full throttle
  drag: 0.055, // quadratic drag coefficient
  pitchRate: 0.85, // rad/s at full elevator
  rollRate: 1.9, // rad/s at full aileron
  maxPitch: 0.62,
  maxRoll: 1.25,
  gearHeight: 1.35, // wheels below the fuselage centre
  fuelCapacity: 100,
  fuelBurn: 0.55, // units per second at full throttle
  fuelBurnIdle: 0.06,
};

export const SCORE = {
  ring: 100,
  ringTimeBonus: 12, // per second under par, ring run
  parcel: 150,
  landingSoft: 300, // touchdown vertical speed under 1.5 m/s
  landingOk: 150, // under 3 m/s
  landingCentre: 150, // within 4 m of centreline
  landingZone: 100, // inside the touchdown zone
  crashPenalty: 0,
};

export const MISSIONS = [
  {
    id: 'rings',
    key: '1',
    name: 'Ring Run',
    blurb: 'Thread 8 glowing rings over the island against the clock. Smooth banks beat full throttle.',
    parSeconds: 150,
    rings: [
      [260, 70, -260], [520, 95, 60], [330, 80, 420], [-40, 65, 520],
      [-420, 90, 300], [-560, 110, -120], [-300, 75, -480], [60, 60, -420],
    ],
  },
  {
    id: 'parcels',
    key: '2',
    name: 'Parcel Run',
    blurb: 'Drop parcels on the three town pads, low and slow, then bring her home to the runway.',
    parSeconds: 240,
    pads: [
      { pos: [430, 0, 330], name: 'Market Square' },
      { pos: [520, 0, 430], name: 'Harbour Quay' },
      { pos: [360, 0, 470], name: 'Mill Green' },
    ],
  },
  {
    id: 'landing',
    key: '3',
    name: 'Landing Challenge',
    blurb: 'Take off, round the beacon at the far headland, and grease it onto the runway. Soft and centred wins.',
    parSeconds: 210,
    beacon: [-620, 130, -80],
  },
];

export const KEYS = {
  throttleUp: ['KeyW'],
  throttleDown: ['KeyS'],
  pitchUp: ['ArrowUp'],
  pitchDown: ['ArrowDown'],
  rollLeft: ['ArrowLeft'],
  rollRight: ['ArrowRight'],
  rudderLeft: ['KeyA'],
  rudderRight: ['KeyD'],
  brake: ['Space'],
  camera: ['KeyC'],
  mouseSteer: ['KeyM'],
  sound: ['KeyN'],
  reset: ['KeyR'],
  pause: ['KeyP', 'Escape'],
  confirm: ['Enter'],
};
