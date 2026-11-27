// Kestrel Courier — screenshot poses.
// One file, one job: turn a ?shot= query into a deterministic starting pose
// (mission, aircraft state, autopilot target) so the shipped screenshots are
// real frames of the game flying itself. Nothing here is a mock: the pose only
// places the aircraft and switches the autopilot on.

export const SHOTS = {
  cover: {
    missionId: 'rings',
    position: [-40, 74, 10],
    yaw: -0.83,
    airspeed: 58,
    throttle: 0.65,
    autoTarget: [260, 70, -260],
    autoSpeed: 58,
  },
  rings: {
    missionId: 'rings',
    position: [100, 85, -120],
    yaw: -0.85,
    airspeed: 60,
    throttle: 0.7,
    autoTarget: [260, 70, -260],
    autoSpeed: 60,
  },
  landing: {
    missionId: 'landing',
    position: [300, 30, 8],
    yaw: Math.PI / 2,
    airspeed: 48,
    throttle: 0.35,
    // Aim 100m past the touchdown zone (x = -100): the glide meets the
    // runway in the zone, and the wheels touch before the autopilot's
    // arrival radius switches the target. The target sits at y = 0, below
    // the runway surface, so the descent carries through to a touchdown
    // instead of levelling off above it.
    autoTarget: [-100, 0, 0],
    autoSpeed: 46,
  },
  menu: {
    missionId: 'rings',
    position: null, // stay parked on the runway, menu open
    yaw: -Math.PI / 2,
    airspeed: 0,
    throttle: 0,
    autoTarget: null,
    autoSpeed: 55,
  },
};

export function getShotSetup(query) {
  const params = new URLSearchParams(query);
  const shotName = params.get('shot');
  const demo = params.get('demo') === '1';
  if (demo) {
    return {
      name: 'demo',
      missionId: 'rings',
      position: null,
      yaw: -Math.PI / 2,
      airspeed: 0,
      throttle: 0,
      autoTarget: [260, 70, -260],
      autoSpeed: 58,
      startFlying: true,
    };
  }
  if (!shotName || !SHOTS[shotName]) return null;
  const shot = SHOTS[shotName];
  return { name: shotName, ...shot, startFlying: shotName !== 'menu' };
}
