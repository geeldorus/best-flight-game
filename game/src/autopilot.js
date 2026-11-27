// Kestrel Courier — the autopilot.
// One file, one job: fly the aircraft toward a target point (a ring, a pad, a
// runway threshold) with smooth banks and sensible throttle. Used by the demo
// mode and by the screenshot poses, never by the player.
// The autopilot commands pitch and roll as fractions of full deflection
// (feedforward), so the aircraft holds the bank and pitch it asks for
// instead of sagging under a proportional controller's steady-state error.

import { PLANE } from './config.js';
import { headingDegrees } from './physics.js';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function angleDifference(target, current) {
  let d = target - current;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

export function createAutopilot() {
  return {
    enabled: false,
    target: null, // { x, y, z } the pilot is steering for
    targetSpeed: 55,
    onArrive: null,
    hasFlown: false, // set once the aircraft has left the ground
  };
}

export function autopilotInput(auto, state, dt) {
  const input = { throttleUp: false, throttleDown: false, throttleSet: null, pitch: 0, roll: 0, rudder: 0, brake: false };
  if (!auto.enabled || !auto.target) return input;

  const dx = auto.target.x - state.position.x;
  const dy = auto.target.y - state.position.y;
  const dz = auto.target.z - state.position.z;
  const dist = Math.hypot(dx, dy, dz);

  // Heading to the target, in the same compass frame as the HUD.
  const desiredHeading = (Math.atan2(dx, -dz) * 180) / Math.PI;
  const currentHeading = headingDegrees(state.yaw);
  const headingError = angleDifference(desiredHeading, currentHeading);

  // Bank toward the target: gentle for small errors, firm for big ones.
  const desiredRoll = clamp(headingError / 45, -1, 1) * 0.85;
  input.roll = clamp(desiredRoll / PLANE.maxRoll, -1, 1);
  input.rudder = clamp(headingError / 120, -0.5, 0.5);

  // Pitch to hold the target's altitude, eased near the target. The descent
  // is capped so the sink rate never reaches crash territory on its own.
  let desiredPitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)) * 1.4, -0.16, 0.35);
  // Flare: close to the ground, ease to a gentle descent so the wheels meet
  // the runway instead of diving into it.
  if (state.position.y < 10) desiredPitch = Math.max(desiredPitch, -0.06);
  input.pitch = clamp(desiredPitch / PLANE.maxPitch, -1, 1);

  // Throttle: the power that holds the target speed against drag, plus a
  // nudge for the speed error — steady, not bang-bang, so the lever sits
  // still instead of hunting up and down. On final approach to a ground
  // target (a runway or a pad) the target speed eases off; rings are
  // flown through at speed, never slowed for.
  const wantSpeed = (dist < 60 && auto.target.y < 10)
    ? Math.max(30, auto.targetSpeed * 0.85)
    : auto.targetSpeed;
  const dragThrottle = (0.0016 * wantSpeed * wantSpeed) / PLANE.accel;
  input.throttleSet = clamp(dragThrottle + (wantSpeed - state.airspeed) * 0.02, 0, 1);

  if (!state.onGround) auto.hasFlown = true;

  // On the runway, keep the wings level and the rudder centred.
  if (state.onGround) {
    input.roll = clamp((0 - state.roll) * 2, -1, 1);
    input.rudder = 0;
    if (auto.hasFlown) {
      // Landing rollout: cut the power, brake, and stay down.
      input.throttleSet = 0;
      input.brake = true;
      input.pitch = 0;
    } else {
      // Takeoff roll: rotate once there is flying speed.
      input.pitch = state.airspeed > 31 ? 0.45 : 0;
    }
  }

  if (dist < 12 && auto.onArrive) {
    const arrive = auto.onArrive;
    auto.onArrive = null;
    arrive();
  }
  return input;
}
