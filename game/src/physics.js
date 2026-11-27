// Kestrel Courier — the arcade flight model.
// One file, one job: advance the aircraft state one step (throttle, lift, banked
// turns, stall, takeoff, landing and crash) and report what happened.

import * as THREE from 'three';
import { PLANE, WORLD } from './config.js';

export function forwardVector(yaw, pitch, out = new THREE.Vector3()) {
  const cp = Math.cos(pitch);
  out.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
  return out;
}

export function headingDegrees(yaw) {
  const deg = (-yaw * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

export function createFlightState() {
  const r = WORLD.runway;
  return {
    position: new THREE.Vector3(r.x - r.length / 2 + 30, r.elevation + PLANE.gearHeight, r.z),
    yaw: -Math.PI / 2, // facing east, down the runway
    pitch: 0,
    roll: 0,
    airspeed: 0,
    throttle: 0,
    fuel: PLANE.fuelCapacity,
    damage: 0,
    onGround: true,
    verticalSpeed: 0,
    crashed: false,
    landedCleanly: false,
    time: 0,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function stepFlight(state, input, dt, world) {
  const events = { tookOff: false, touchedDown: false, crashed: false, hardLanding: false };
  if (state.crashed) return events;
  state.time += dt;

  // --- throttle ---
  // The autopilot names a throttle setting directly; the pilot's keys nudge it.
  if (input.throttleSet !== undefined && input.throttleSet !== null) {
    state.throttle += clamp(input.throttleSet - state.throttle, -1.5 * dt, 1.5 * dt);
  } else {
    if (input.throttleUp) state.throttle = clamp(state.throttle + 0.55 * dt, 0, 1);
    if (input.throttleDown) state.throttle = clamp(state.throttle - 0.8 * dt, 0, 1);
  }
  if (state.fuel <= 0) state.throttle = 0; // engine out

  // --- airspeed: thrust against drag, plus the airbrake ---
  const drag = 0.0016 * state.airspeed * state.airspeed;
  let accel = state.throttle * PLANE.accel - drag;
  if (input.brake) accel -= state.onGround ? 22 : 9;
  if (state.onGround) accel -= 1.2; // rolling resistance
  state.airspeed = Math.max(0, state.airspeed + accel * dt);

  // --- attitude: elevator and ailerons chase the pilot's input ---
  const liftFactor = clamp(state.airspeed / PLANE.stallSpeed, 0, 1);
  const pitchTarget = state.onGround && state.airspeed < PLANE.takeoffSpeed
    ? 0
    : input.pitch * PLANE.maxPitch * (0.35 + 0.65 * liftFactor);
  const rollTarget = input.roll * PLANE.maxRoll;
  const pitchRate = 1.7, rollRate = 2.6;
  state.pitch += clamp(pitchTarget - state.pitch, -pitchRate * dt, pitchRate * dt);
  state.roll += clamp(rollTarget - state.roll, -rollRate * dt, rollRate * dt);
  if (!input.roll && !state.onGround) {
    // Hands off the stick and the wings ease back toward level.
    state.roll += clamp(0 - state.roll, -0.5 * dt, 0.5 * dt);
  }

  // --- heading: banked turns in the air, gentle rudder steering on the ground ---
  // (banking does not turn an aircraft that is still on its wheels).
  if (!state.onGround) {
    const turnRate = clamp((9.81 * Math.tan(state.roll)) / Math.max(state.airspeed, 15), -0.9, 0.9) * 1.5;
    state.yaw -= turnRate * dt;
    state.yaw -= input.rudder * 0.28 * dt * clamp(state.airspeed / 60, 0.15, 1);
  } else {
    state.yaw -= input.rudder * 0.12 * dt * clamp(state.airspeed / 60, 0.15, 1);
  }

  // --- motion ---
  const forward = forwardVector(state.yaw, state.pitch);
  const velocity = forward.clone().multiplyScalar(state.airspeed);
  if (!state.onGround) {
    if (state.airspeed < PLANE.stallSpeed) {
      // The wing gives up: the nose drops and the aircraft sinks.
      velocity.y -= (PLANE.stallSpeed - state.airspeed) * 0.55;
      state.pitch += clamp(0 - state.pitch, -0.6 * dt, 0.6 * dt) * 0.4;
    }
    if (state.position.y > WORLD.maxAltitude) {
      state.position.y = WORLD.maxAltitude;
      state.pitch = Math.min(state.pitch, 0);
    }
  } else {
    velocity.y = 0;
  }
  state.position.addScaledVector(velocity, dt);
  state.verticalSpeed = state.verticalSpeed * 0.85 + velocity.y * 0.15;

  // --- fuel ---
  const burn = PLANE.fuelBurnIdle + state.throttle * (PLANE.fuelBurn - PLANE.fuelBurnIdle);
  state.fuel = Math.max(0, state.fuel - burn * dt);
  if (state.onGround && world.isOnRunway(state.position.x, state.position.z) && state.airspeed < 5) {
    state.fuel = Math.min(PLANE.fuelCapacity, state.fuel + 30 * dt);
  }

  // --- ground contact ---
  const groundY = world.heightAt(state.position.x, state.position.z) + PLANE.gearHeight;
  const inRiver = world.heightAt(state.position.x, state.position.z) < WORLD.waterLevel;
  if (state.position.y <= groundY) {
    if (state.onGround) {
      state.position.y = groundY;
    } else {
      const vy = velocity.y;
      const onRunway = world.isOnRunway(state.position.x, state.position.z);
      const tooFast = state.airspeed > 72 && !onRunway;
      const tooHard = vy < -8;
      const tooBanked = Math.abs(state.roll) > 0.85;
      if (inRiver || tooHard || tooBanked || tooFast) {
        state.crashed = true;
        state.position.y = groundY;
        events.crashed = true;
      } else if (vy < -4) {
        state.damage = Math.min(100, state.damage + 25);
        state.airspeed *= 0.55;
        state.pitch = 0;
        state.roll *= 0.3;
        state.onGround = true;
        state.position.y = groundY;
        state.landedCleanly = onRunway;
        events.hardLanding = true;
        events.touchedDown = true;
      } else {
        state.onGround = true;
        state.position.y = groundY;
        state.pitch = 0;
        state.roll *= 0.4;
        state.landedCleanly = onRunway;
        events.touchedDown = true;
      }
    }
  }

  // --- liftoff: enough speed and a pulled-back stick leaves the ground ---
  // (checked after ground contact, on its own, so a rotation on the runway
  // itself gets the aircraft airborne instead of waiting for the ground to drop).
  if (state.onGround && state.airspeed >= PLANE.takeoffSpeed && state.pitch > 0.06) {
    state.onGround = false;
    events.tookOff = true;
  }

  // Keep the island in reach: turn back gently past the edge.
  const edge = WORLD.size / 2 - 60;
  if (Math.abs(state.position.x) > edge || Math.abs(state.position.z) > edge) {
    state.position.x = clamp(state.position.x, -edge, edge);
    state.position.z = clamp(state.position.z, -edge, edge);
  }

  if (state.damage >= 100) {
    state.crashed = true;
    events.crashed = true;
  }
  return events;
}
