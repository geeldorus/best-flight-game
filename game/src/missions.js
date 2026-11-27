// Kestrel Courier — missions: ring run, parcel run, landing challenge.
// One file, one job: build each mission's markers in the world, watch the
// aircraft against them, and score what the pilot achieves.

import * as THREE from 'three';
import { MISSIONS, SCORE } from './config.js';

const RING_RADIUS = 18;

function makeRingMesh(position, faceFrom) {
  const geo = new THREE.TorusGeometry(RING_RADIUS, 1.6, 12, 44);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x35c8ff, emissive: 0x1899cc, emissiveIntensity: 0.9, metalness: 0.2, roughness: 0.4,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.position.set(position[0], position[1], position[2]);
  ring.lookAt(faceFrom[0], faceFrom[1], faceFrom[2]);
  return ring;
}

function makeBeaconColumn(x, z, colour, height = 260) {
  const geo = new THREE.CylinderGeometry(1.4, 1.4, height, 12, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color: colour, transparent: true, opacity: 0.07,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const column = new THREE.Mesh(geo, mat);
  column.position.set(x, height / 2, z);
  return column;
}

function makePadMarker(pad) {
  const group = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(12, 12, 0.6, 28),
    new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0x993d00, emissiveIntensity: 0.5 }),
  );
  disc.position.y = 0.4;
  group.add(disc);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(12, 14, 28),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.8;
  group.add(ring);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 16, 6),
    new THREE.MeshLambertMaterial({ color: 0xdddddd }),
  );
  pole.position.set(14, 8, 0);
  group.add(pole);
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(4.5, 2.6),
    new THREE.MeshBasicMaterial({ color: 0xff7a1a, side: THREE.DoubleSide }),
  );
  flag.position.set(16.3, 14.5, 0);
  group.add(flag);
  group.position.set(pad.pos[0], 4.4, pad.pos[2]);
  return group;
}

export function getMissionDef(id) {
  return MISSIONS.find((m) => m.id === id) ?? MISSIONS[0];
}

export function createMission(def, scene) {
  const mission = {
    def,
    scene,
    score: 0,
    elapsed: 0,
    progress: 0,
    total: 0,
    objective: def.blurb,
    done: false,
    failed: false,
    started: false,
    tookOff: false,
    rings: [],
    ringMeshes: [],
    pads: [],
    padMarkers: [],
    beacon: null,
    beaconColumn: null,
    beaconRounded: false,
    nextBeacon: null,
    landingScored: false,
    breakdown: [],
  };

  if (def.id === 'rings') {
    mission.total = def.rings.length;
    let prev = [0, 30, 0];
    def.rings.forEach((pos, i) => {
      const mesh = makeRingMesh(pos, prev);
      scene.add(mesh);
      mission.ringMeshes.push(mesh);
      mission.rings.push({ pos: new THREE.Vector3(pos[0], pos[1], pos[2]), passed: false, index: i });
      prev = pos;
    });
    mission.nextBeacon = makeBeaconColumn(def.rings[0][0], def.rings[0][2], 0xffb340);
    scene.add(mission.nextBeacon);
    mission.objective = 'Take off, then fly through ring 1 of 8 — follow the gold beam.';
  } else if (def.id === 'parcels') {
    mission.total = def.pads.length;
    mission.pads = def.pads.map((pad) => ({ ...pad, dropped: false, centre: new THREE.Vector3(pad.pos[0], 0, pad.pos[2]) }));
    mission.pads.forEach((pad) => {
      const marker = makePadMarker(pad);
      scene.add(marker);
      mission.padMarkers.push(marker);
    });
    mission.nextBeacon = makeBeaconColumn(def.pads[0].pos[0], def.pads[0].pos[2], 0xff7a1a);
    scene.add(mission.nextBeacon);
    mission.objective = 'Take off with the parcels, then drop one on Market Square — low and slow.';
  } else if (def.id === 'landing') {
    mission.total = 1;
    mission.beacon = new THREE.Vector3(def.beacon[0], def.beacon[1], def.beacon[2]);
    const beaconMesh = makeRingMesh(def.beacon, [0, 30, 0]);
    beaconMesh.material = beaconMesh.material.clone();
    beaconMesh.material.emissive = new THREE.Color(0xffb340);
    beaconMesh.material.color = new THREE.Color(0xffb340);
    scene.add(beaconMesh);
    mission.ringMeshes.push(beaconMesh);
    mission.beaconColumn = makeBeaconColumn(def.beacon[0], def.beacon[2], 0xffb340);
    scene.add(mission.beaconColumn);
    mission.objective = 'Take off, round the gold ring at the far headland, then land on the runway.';
  }
  paintMissionMarkers(mission);
  return mission;
}

function paintMissionMarkers(mission) {
  mission.ringMeshes.forEach((mesh, i) => {
    const ring = mission.rings[i];
    const isBeacon = mission.def.id === 'landing';
    if (isBeacon) {
      mesh.material.emissiveIntensity = mission.beaconRounded ? 0.15 : 1.4;
      return;
    }
    if (!ring) return;
    if (ring.passed) {
      mesh.material.color.set(0x2aff5a);
      mesh.material.emissive.set(0x1a8a34);
      mesh.material.emissiveIntensity = 0.5;
    } else if (i === mission.progress) {
      mesh.material.color.set(0xffb340);
      mesh.material.emissive.set(0xff9a00);
      mesh.material.emissiveIntensity = 1.6;
    } else {
      mesh.material.color.set(0x35c8ff);
      mesh.material.emissive.set(0x1899cc);
      mesh.material.emissiveIntensity = 0.9;
    }
  });
  mission.padMarkers.forEach((marker, i) => {
    const pad = mission.pads[i];
    marker.children[0].material = marker.children[0].material.clone();
    marker.children[0].material.color.set(pad.dropped ? 0x2aff5a : 0xff7a1a);
  });
}

export function disposeMission(mission) {
  const remove = (obj) => {
    if (!obj) return;
    mission.scene.remove(obj);
    obj.traverse?.((child) => {
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      else child.material?.dispose?.();
    });
  };
  mission.ringMeshes.forEach(remove);
  mission.padMarkers.forEach(remove);
  remove(mission.nextBeacon);
  remove(mission.beaconColumn);
}

function addScore(mission, points, label) {
  mission.score += points;
  mission.breakdown.push(`${label}: +${points}`);
}

export function updateMission(mission, state, events, dt, world, hooks) {
  if (mission.done || mission.failed) return;
  if (mission.started) mission.elapsed += dt;

  // Takeoff starts the clock.
  if (events.tookOff && !mission.tookOff) {
    mission.tookOff = true;
    mission.started = true;
    hooks.onTakeoff?.();
  }

  const pos = state.position;

  if (mission.def.id === 'rings') {
    const ring = mission.rings[mission.progress];
    if (ring && !ring.passed) {
      const d = pos.distanceTo(ring.pos);
      if (d < RING_RADIUS - 2) {
        ring.passed = true;
        mission.progress++;
        addScore(mission, SCORE.ring, `Ring ${ring.index + 1}`);
        hooks.onRing?.(ring.index + 1, mission.progress, mission.total);
        paintMissionMarkers(mission);
        if (mission.nextBeacon) {
          mission.scene.remove(mission.nextBeacon);
          mission.nextBeacon = null;
        }
        const next = mission.rings[mission.progress];
        if (next) {
          mission.nextBeacon = makeBeaconColumn(next.pos.x, next.pos.z, 0xffb340);
          mission.scene.add(mission.nextBeacon);
          mission.objective = `Ring ${mission.progress + 1} of ${mission.total} — follow the gold beam.`;
        } else {
          const bonus = Math.max(0, Math.round((mission.def.parSeconds - mission.elapsed) * SCORE.ringTimeBonus));
          if (bonus > 0) addScore(mission, bonus, `Time bonus (${Math.round(mission.elapsed)}s)`);
          mission.done = true;
          mission.objective = 'All rings flown — beautiful flying.';
          hooks.onComplete?.('Ring Run complete');
        }
      } else {
        const remaining = Math.round(d);
        mission.objective = `Ring ${mission.progress + 1} of ${mission.total} — ${remaining}m ahead. Follow the gold beam.`;
      }
    }
    // Pulse the next ring so it reads from far away.
    const nextMesh = mission.ringMeshes[mission.progress];
    if (nextMesh) {
      const s = 1 + Math.sin(state.time * 4) * 0.05;
      nextMesh.scale.setScalar(s);
    }
  }

  if (mission.def.id === 'parcels') {
    const pad = mission.pads[mission.progress];
    if (pad && !pad.dropped) {
      const dx = pos.x - pad.centre.x;
      const dz = pos.z - pad.centre.z;
      const horizontal = Math.hypot(dx, dz);
      const heightAboveGround = pos.y - world.heightAt(pos.x, pos.z);
      if (horizontal < 26 && heightAboveGround < 48 && state.airspeed < 56 && !state.onGround) {
        pad.dropped = true;
        mission.progress++;
        addScore(mission, SCORE.parcel, `Parcel to ${pad.name}`);
        hooks.onParcel?.(pad.name, mission.progress, mission.total);
        paintMissionMarkers(mission);
        if (mission.nextBeacon) {
          mission.scene.remove(mission.nextBeacon);
          mission.nextBeacon = null;
        }
        const nextPad = mission.pads[mission.progress];
        if (nextPad) {
          mission.nextBeacon = makeBeaconColumn(nextPad.centre.x, nextPad.centre.z, 0xff7a1a);
          mission.scene.add(mission.nextBeacon);
          mission.objective = `Parcel ${mission.progress + 1} of ${mission.total} — ${nextPad.name}. Low and slow over the orange pad.`;
        } else {
          mission.objective = 'All parcels delivered — bring her home to the runway.';
        }
      } else if (horizontal < 120) {
        mission.objective = `${pad.name}: ${Math.round(horizontal)}m away — get low (under 48m) and slow (under 110kt).`;
      }
    } else if (mission.progress >= mission.total && !mission.done) {
      mission.objective = 'All parcels delivered — land on the runway to finish.';
    }
  }

  if (mission.def.id === 'landing') {
    if (!mission.beaconRounded && mission.beacon) {
      const d = pos.distanceTo(mission.beacon);
      if (d < RING_RADIUS + 8) {
        mission.beaconRounded = true;
        mission.progress = 1;
        addScore(mission, SCORE.ring, 'Beacon rounded');
        hooks.onRing?.(1, 1, 1);
        paintMissionMarkers(mission);
        if (mission.beaconColumn) {
          mission.scene.remove(mission.beaconColumn);
          mission.beaconColumn = null;
        }
        mission.objective = 'Beacon rounded — now land on the runway, soft and centred.';
      } else {
        mission.objective = `Round the gold ring at the headland — ${Math.round(d)}m ahead.`;
      }
    }
  }

  // Landing finishes the parcel run and the landing challenge.
  if (events.touchedDown && (mission.def.id === 'parcels' || mission.def.id === 'landing')) {
    const ready = mission.def.id === 'landing'
      ? mission.beaconRounded
      : mission.progress >= mission.total;
    if (ready && !mission.landingScored) {
      mission.landingScored = true;
      scoreLanding(mission, state, world);
      mission.done = true;
      mission.objective = 'Down safe — nicely flown.';
      hooks.onComplete?.('Mission complete');
    } else if (!ready) {
      hooks.onEarlyLanding?.();
    }
  }

  if (events.crashed) {
    mission.failed = true;
    hooks.onCrash?.();
  }
  if (events.hardLanding) {
    hooks.onHardLanding?.(state.damage);
  }
}

function scoreLanding(mission, state, world) {
  const vs = Math.abs(state.verticalSpeed);
  const onRunway = world.isOnRunway(state.position.x, state.position.z);
  const centreOffset = Math.abs(state.position.z - 0);
  if (onRunway) {
    if (vs < 1.5) addScore(mission, SCORE.landingSoft, 'Butter-smooth touchdown');
    else if (vs < 3) addScore(mission, SCORE.landingOk, 'Firm but fair touchdown');
    if (centreOffset < 4) addScore(mission, SCORE.landingCentre, 'On the centreline');
    const along = Math.abs(state.position.x);
    if (along < 150) addScore(mission, SCORE.landingZone, 'Inside the touchdown zone');
    if (mission.def.id === 'landing') {
      mission.breakdown.push(`Touchdown: ${vs.toFixed(1)} m/s down, ${centreOffset.toFixed(0)}m off centre`);
    }
  } else {
    mission.breakdown.push('Landed off the runway — no landing bonus');
  }
}
