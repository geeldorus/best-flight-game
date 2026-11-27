// Kestrel Courier — the game itself.
// One file, one job: own the renderer, the loop and the menu / flying /
// debrief state machine, and wire the physics, missions, camera, HUD, audio
// and input together.

import * as THREE from 'three';
import { WORLD, MISSIONS, KEYS } from './config.js';
import { buildWorld } from './terrain.js';
import { buildAircraft, spinPropeller, blinkNavLights } from './aircraft.js';
import { createFlightState, stepFlight, headingDegrees } from './physics.js';
import { createInput, attachInput, pollInput, wasPressed, clearPressed } from './input.js';
import {
  createAudio, startAudio, updateAudio, playRingChime, playParcelThud,
  playTouchdown, playCrash, playFanfare,
} from './audio.js';
import { createHud, updateHud, flashBanner } from './hud.js';
import { getMissionDef, createMission, disposeMission, updateMission } from './missions.js';
import { createAutopilot, autopilotInput } from './autopilot.js';
import { createCameraRig, toggleCameraMode, updateCamera, addCameraShake } from './camera.js';
import { getShotSetup } from './shots.js';

const container = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true });
// ?lowfx=1 turns shadows off for weak machines (and for fast headless tests);
// the game, the flight model and the HUD are identical either way.
const lowFx = new URLSearchParams(window.location.search).get('lowfx') === '1';
renderer.setPixelRatio(lowFx ? 1 : Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = !lowFx;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 9000);
const world = buildWorld(scene);
const plane = buildAircraft();
scene.add(plane);

const hud = createHud();
const input = createInput();
attachInput(input, window);
const audio = createAudio();
const auto = createAutopilot();
const rig = createCameraRig(camera);

let gameState = 'menu'; // 'menu' | 'flying' | 'paused' | 'over'
let flight = createFlightState();
let mission = null;
let selectedMissionId = 'rings';
let menuOrbit = 0;

const menuEl = document.getElementById('menu');
const debriefEl = document.getElementById('debrief');
const pickerEl = document.getElementById('mission-picker');

function buildMissionPicker() {
  pickerEl.innerHTML = '';
  MISSIONS.forEach((def) => {
    const card = document.createElement('div');
    card.className = 'mission-card' + (def.id === selectedMissionId ? ' sel' : '');
    card.innerHTML = `<h3>${def.name}</h3><p>${def.blurb}</p><span class="key">PRESS ${def.key}</span>`;
    card.addEventListener('click', () => {
      selectedMissionId = def.id;
      buildMissionPicker();
      startAudio(audio);
    });
    pickerEl.appendChild(card);
  });
}

function showMenu() {
  gameState = 'menu';
  menuEl.classList.remove('hidden');
  debriefEl.classList.add('hidden');
  buildMissionPicker();
}

function showDebrief(title, sub, lines) {
  gameState = 'over';
  document.getElementById('debrief-title').textContent = title;
  document.getElementById('debrief-sub').textContent = sub;
  document.getElementById('debrief-lines').innerHTML = lines
    .map((line) => `<div>${line}</div>`)
    .join('');
  debriefEl.classList.remove('hidden');
}

function nextAutoTarget() {
  if (!mission) return null;
  if (mission.def.id === 'rings') {
    const next = mission.rings[mission.progress];
    return next ? { x: next.pos.x, y: next.pos.y, z: next.pos.z } : { x: 0, y: 90, z: 0 };
  }
  if (mission.def.id === 'parcels') {
    const next = mission.pads[mission.progress];
    return next ? { x: next.centre.x, y: 45, z: next.centre.z } : { x: 0, y: 8, z: 0 };
  }
  if (mission.def.id === 'landing') {
    if (!mission.beaconRounded) {
      return { x: mission.beacon.x, y: mission.beacon.y, z: mission.beacon.z };
    }
    // Beacon rounded: aim for the threshold, then down the runway to roll out.
    // Both targets sit at y = 0 so the descent carries through to a touchdown.
    return flight.position.x < 60 ? { x: -400, y: 0, z: 0 } : { x: 0, y: 0, z: 0 };
  }
  return null;
}

function startMission(missionId) {
  if (mission) disposeMission(mission);
  const def = getMissionDef(missionId);
  flight = createFlightState();
  mission = createMission(def, scene);
  auto.enabled = false;
  auto.target = null;
  auto.onArrive = null;
  menuEl.classList.add('hidden');
  debriefEl.classList.add('hidden');
  gameState = 'flying';
  flashBanner(hud, def.name.toUpperCase(), 'Throttle up with W, rotate at 60 knots — good luck, courier.', 3);
}

function restartMission() {
  startMission(mission ? mission.def.id : selectedMissionId);
}

function armAutopilot(target, speed) {
  auto.enabled = true;
  auto.targetSpeed = speed ?? 55;
  auto.target = target ? { x: target[0], y: target[1], z: target[2] } : null;
  auto.onArrive = () => {
    auto.target = nextAutoTarget();
    auto.onArrive = () => {
      auto.target = nextAutoTarget();
    };
  };
}

function applyShotSetup(setup) {
  if (setup.name === 'menu') {
    // The menu shot keeps the title screen open over the parked aircraft.
    selectedMissionId = setup.missionId;
    if (mission) disposeMission(mission);
    mission = createMission(getMissionDef(selectedMissionId), scene);
    buildMissionPicker();
    showMenu();
    return;
  }
  selectedMissionId = setup.missionId;
  startMission(setup.missionId);
  if (setup.position) {
    flight.position.set(setup.position[0], setup.position[1], setup.position[2]);
    flight.yaw = setup.yaw;
    flight.airspeed = setup.airspeed;
    flight.throttle = setup.throttle;
    flight.onGround = false;
    flight.landedCleanly = false;
  }
  if (setup.autoTarget) armAutopilot(setup.autoTarget, setup.autoSpeed);
  if (setup.startFlying) {
    mission.started = true;
    mission.tookOff = true;
  }
}

// --- mission event hooks: sounds, banners, debriefs ---
function missionHooks() {
  return {
    onTakeoff() {
      flashBanner(hud, 'AIRBORNE', 'Gear down, flaps up — she flies.');
      playTouchdown(audio, true);
    },
    onRing(n, done, total) {
      playRingChime(audio);
      flashBanner(hud, `RING ${n} / ${total}`, done >= total ? 'Course complete!' : 'Nice and smooth — next ring.');
    },
    onParcel(name, done, total) {
      playParcelThud(audio);
      flashBanner(hud, 'PARCEL AWAY', `${name} — ${done} of ${total} delivered.`);
    },
    onEarlyLanding() {
      flashBanner(hud, 'TOO SOON', 'Finish the job first, then land.', 2.5);
    },
    onHardLanding(damage) {
      addCameraShake(rig, 0.7);
      playTouchdown(audio, false);
      flashBanner(hud, 'HARD LANDING', `Airframe damage ${Math.round(damage)}% — be gentle next time.`, 2.5);
    },
    onComplete(title) {
      playFanfare(audio);
      const lines = [
        ...mission.breakdown,
        `<b>FINAL SCORE: ${mission.score}</b> &nbsp;·&nbsp; TIME ${formatClock(mission.elapsed)}`,
      ];
      setTimeout(() => showDebrief('MISSION COMPLETE', title, lines), 1400);
    },
    onCrash() {
      playCrash(audio);
      addCameraShake(rig, 1.2);
      const lines = [
        ...mission.breakdown,
        `Score banked: <b>${mission.score}</b>`,
        'Press R to climb back into the cockpit.',
      ];
      setTimeout(() => showDebrief('CRASHED', 'The Kestrel is a write-off — the pilot walked away.', lines), 1400);
    },
  };
}

function formatClock(seconds) {
  const t = Math.floor(seconds);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

// --- global keys ---
window.addEventListener('keydown', () => startAudio(audio), { once: true });
window.addEventListener('pointerdown', () => startAudio(audio), { once: true });
document.getElementById('fly-btn').addEventListener('click', () => {
  startAudio(audio);
  startMission(selectedMissionId);
});
document.getElementById('again-btn').addEventListener('click', restartMission);
document.getElementById('menu-btn').addEventListener('click', showMenu);

function handleActionKeys() {
  if (wasPressed(input, KEYS.camera)) {
    const mode = toggleCameraMode(rig);
    flashBanner(hud, mode === 'cockpit' ? 'COCKPIT VIEW' : 'CHASE VIEW', '', 1.2);
  }
  if (wasPressed(input, KEYS.mouseSteer)) {
    input.mouseSteer = !input.mouseSteer;
    flashBanner(hud, input.mouseSteer ? 'MOUSE STEERING ON' : 'MOUSE STEERING OFF', 'Move the mouse to steer.', 1.5);
  }
  if (wasPressed(input, KEYS.sound)) {
    audio.enabled = !audio.enabled;
    flashBanner(hud, audio.enabled ? 'SOUND ON' : 'SOUND OFF', '', 1.2);
  }
  if (wasPressed(input, KEYS.reset) && (gameState === 'flying' || gameState === 'over')) {
    restartMission();
  }
  if (wasPressed(input, KEYS.pause)) {
    if (gameState === 'flying') {
      gameState = 'paused';
      flashBanner(hud, 'PAUSED', 'Press P to keep flying.', 60);
    } else if (gameState === 'paused') {
      gameState = 'flying';
    }
  }
  if (gameState === 'menu') {
    for (const def of MISSIONS) {
      if (wasPressed(input, [def.key === '1' ? 'Digit1' : def.key === '2' ? 'Digit2' : 'Digit3'])) {
        selectedMissionId = def.id;
        buildMissionPicker();
      }
    }
    if (wasPressed(input, KEYS.confirm)) startMission(selectedMissionId);
  }
  clearPressed(input);
}

// --- the loop ---
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now() / 1000;

  handleActionKeys();

  if (gameState === 'flying') {
    pollInput(input);
    const control = auto.enabled ? autopilotInput(auto, flight, dt) : input;
    const events = stepFlight(flight, control, dt, world);
    updateMission(mission, flight, events, dt, world, missionHooks());
    if (events.touchedDown && !flight.crashed) playTouchdown(audio, Math.abs(flight.verticalSpeed) < 3);
    if (flight.crashed) {
      // Let the wreck settle, then the crash hook's debrief appears.
    }
    updateAudio(audio, flight.throttle, flight.airspeed, flight.onGround);
    updateHud(hud, flight, mission, now);
  } else if (gameState === 'menu') {
    menuOrbit += dt * 0.12;
    const r = 26;
    camera.position.set(
      flight.position.x + Math.cos(menuOrbit) * r,
      flight.position.y + 10,
      flight.position.z + Math.sin(menuOrbit) * r,
    );
    camera.lookAt(flight.position.x, flight.position.y + 1, flight.position.z);
    updateHud(hud, flight, mission, now);
  }

  // Keep the mesh on the flight state.
  plane.position.copy(flight.position);
  plane.rotation.set(flight.pitch, flight.yaw, -flight.roll, 'YXZ');
  spinPropeller(plane, flight.throttle, dt);
  blinkNavLights(plane, now);
  // The cockpit camera sits ahead of the canopy: hide the canopy glass and
  // the propeller there, or the pilot stares at the inside of both.
  const inCockpit = rig.mode === 'cockpit';
  plane.userData.canopy.visible = !inCockpit;
  plane.userData.prop.visible = !inCockpit;

  if (gameState === 'flying' || gameState === 'paused' || gameState === 'over') {
    updateCamera(rig, flight, dt);
  }
  world.update(dt);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- boot ---
buildMissionPicker();
mission = createMission(getMissionDef(selectedMissionId), scene);
const shot = getShotSetup(window.location.search);
if (shot) {
  applyShotSetup(shot);
} else {
  showMenu();
}
animate();

// Debug handle for play-testing: window.__kestrel exposes live state.
window.__kestrel = {
  get state() { return gameState; },
  get flight() { return flight; },
  get mission() { return mission; },
  get auto() { return auto; },
  startMission,
  headingDegrees,
};
