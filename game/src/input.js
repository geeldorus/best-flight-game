// Kestrel Courier — keyboard and mouse input.
// One file, one job: turn key presses and mouse movement into the flight
// control values the physics step reads, plus edge-triggered action keys.

import { KEYS } from './config.js';

export function createInput() {
  return {
    keys: new Set(),
    mouseSteer: false,
    mouseX: 0, // -1..1 across the window
    mouseY: 0, // -1..1 down the window
    pressed: new Set(), // keys pressed since the last poll
    pitch: 0,
    roll: 0,
    rudder: 0,
    throttleUp: false,
    throttleDown: false,
    brake: false,
  };
}

function has(input, codes) {
  return codes.some((code) => input.keys.has(code));
}

export function attachInput(input, element) {
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    input.keys.add(event.code);
    input.pressed.add(event.code);
    if (event.code === 'Space') event.preventDefault();
    if (event.code.startsWith('Arrow')) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });
  window.addEventListener('blur', () => input.keys.clear());
  element.addEventListener('mousemove', (event) => {
    input.mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    input.mouseY = (event.clientY / window.innerHeight) * 2 - 1;
  });
  element.addEventListener('mousedown', () => {
    if (input.mouseSteer) element.requestPointerLock?.();
  });
}

export function pollInput(input) {
  input.throttleUp = has(input, KEYS.throttleUp);
  input.throttleDown = has(input, KEYS.throttleDown);
  input.brake = has(input, KEYS.brake);
  // ArrowUp climbs (positive pitch), ArrowDown descends; ArrowRight banks right.
  const pitchKeys = (has(input, KEYS.pitchUp) ? 1 : 0) - (has(input, KEYS.pitchDown) ? 1 : 0);
  const rollKeys = (has(input, KEYS.rollRight) ? 1 : 0) - (has(input, KEYS.rollLeft) ? 1 : 0);
  const rudderKeys = (has(input, KEYS.rudderRight) ? 1 : 0) - (has(input, KEYS.rudderLeft) ? 1 : 0);
  if (input.mouseSteer) {
    // Mouse steering: point where you want to go — up is climb, right is bank right.
    input.pitch = Math.max(-1, Math.min(1, -input.mouseY * 1.4)) * 0.9 + pitchKeys * 0.4;
    input.roll = Math.max(-1, Math.min(1, input.mouseX * 1.4)) * 0.9 + rollKeys * 0.4;
  } else {
    input.pitch = pitchKeys;
    input.roll = rollKeys;
  }
  input.pitch = Math.max(-1, Math.min(1, input.pitch));
  input.roll = Math.max(-1, Math.min(1, input.roll));
  input.rudder = rudderKeys;
}

export function wasPressed(input, codes) {
  const hit = codes.some((code) => input.pressed.has(code));
  return hit;
}

export function clearPressed(input) {
  input.pressed.clear();
}
