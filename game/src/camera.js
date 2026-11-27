// Kestrel Courier — the camera.
// One file, one job: chase view and cockpit view, both smoothed so the camera
// never fights the pilot.

import * as THREE from 'three';
import { forwardVector } from './physics.js';

export function createCameraRig(camera) {
  return {
    camera,
    mode: 'chase', // 'chase' | 'cockpit'
    smoothedPos: new THREE.Vector3(0, 12, 14),
    smoothedLook: new THREE.Vector3(0, 4, 0),
    shake: 0,
  };
}

export function toggleCameraMode(rig) {
  rig.mode = rig.mode === 'chase' ? 'cockpit' : 'chase';
  return rig.mode;
}

export function updateCamera(rig, state, dt) {
  const camera = rig.camera;
  const forward = forwardVector(state.yaw, state.pitch);
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(forward, up).normalize();

  if (rig.mode === 'cockpit') {
    // Sit where the canopy is, high enough to see over the nose, and look
    // where the nose points. The canopy and propeller are hidden in this
    // view: the canopy is opaque glass from the inside and the prop would
    // strobe across it.
    const eye = state.position.clone()
      .addScaledVector(forward, 1.0)
      .add(new THREE.Vector3(0, 1.35, 0));
    const look = state.position.clone().addScaledVector(forward, 60);
    rig.smoothedPos.lerp(eye, 1 - Math.exp(-dt * 18));
    rig.smoothedLook.lerp(look, 1 - Math.exp(-dt * 18));
    camera.position.copy(rig.smoothedPos);
    camera.lookAt(rig.smoothedLook);
    camera.fov = 68;
    camera.updateProjectionMatrix();
    return;
  }

  // Chase: behind and above the tail, eased so banks feel smooth.
  const speedFactor = Math.min(1, state.airspeed / 70);
  const distance = 11.5 + speedFactor * 3.5;
  const height = 3.6 + speedFactor * 1.1;
  const desired = state.position.clone()
    .addScaledVector(forward, -distance)
    .add(new THREE.Vector3(0, height, 0))
    .addScaledVector(right, state.roll * -1.5);
  // Never let the camera sink into the ground.
  const minY = state.position.y * 0.4 + 3;
  desired.y = Math.max(desired.y, minY);
  const k = 1 - Math.exp(-dt * 5.5);
  rig.smoothedPos.lerp(desired, k);
  const lookTarget = state.position.clone()
    .addScaledVector(forward, 26)
    .add(new THREE.Vector3(0, 1.2, 0));
  rig.smoothedLook.lerp(lookTarget, 1 - Math.exp(-dt * 9));
  camera.position.copy(rig.smoothedPos);
  if (rig.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * rig.shake;
    camera.position.y += (Math.random() - 0.5) * rig.shake;
    rig.shake = Math.max(0, rig.shake - dt * 2);
  }
  camera.lookAt(rig.smoothedLook);
  camera.fov = 60 + speedFactor * 8;
  camera.updateProjectionMatrix();
}

export function addCameraShake(rig, amount) {
  rig.shake = Math.min(1.2, rig.shake + amount);
}
