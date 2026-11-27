// Kestrel Courier — the Kestrel K-1 bush plane, built from primitives.
// One file, one job: the aircraft mesh, its propeller spin and its navigation lights.

import * as THREE from 'three';

export function buildAircraft() {
  const plane = new THREE.Group();
  const cream = new THREE.MeshLambertMaterial({ color: 0xf2e3c6 });
  const orange = new THREE.MeshLambertMaterial({ color: 0xe8641c });
  const navy = new THREE.MeshLambertMaterial({ color: 0x22405e });
  const glass = new THREE.MeshPhongMaterial({ color: 0x18324a, shininess: 140, specular: 0x99ccff });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });

  // Fuselage: a tapered body with a rounded nose.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.95, 4.6, 12), cream);
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  plane.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), orange);
  nose.scale.set(1, 1, 1.4);
  nose.position.set(0, 0, 2.35);
  nose.castShadow = true;
  plane.add(nose);
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 12), cream);
  tailCone.rotation.x = -Math.PI / 2;
  tailCone.position.set(0, 0.1, -3.0);
  tailCone.castShadow = true;
  plane.add(tailCone);

  // Canopy: a glass bubble the pilot can see out of.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 10), glass);
  canopy.scale.set(0.85, 0.75, 1.7);
  canopy.position.set(0, 0.62, 0.7);
  plane.add(canopy);

  // Wings: a low wing with a navy cheatline stripe and orange tips.
  const wingGeo = new THREE.BoxGeometry(9.4, 0.16, 1.7);
  const wing = new THREE.Mesh(wingGeo, cream);
  wing.position.set(0, -0.15, 0.35);
  wing.castShadow = true;
  plane.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 1.72), orange);
    tip.position.set(side * 4.2, -0.15, 0.35);
    tip.castShadow = true;
    plane.add(tip);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.06, 0.22), navy);
    stripe.position.set(0, -0.05, 1.05);
    plane.add(stripe);
  }

  // Tail: fin and stabilisers.
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 1.3), orange);
  fin.position.set(0, 0.75, -3.4);
  fin.rotation.x = 0.25;
  fin.castShadow = true;
  plane.add(fin);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 1.0), cream);
  stab.position.set(0, 0.15, -3.5);
  stab.castShadow = true;
  plane.add(stab);

  // Propeller: spinner cone plus two blades that spin.
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 10), navy);
  spinner.rotation.x = Math.PI / 2;
  spinner.position.set(0, 0, 3.0);
  plane.add(spinner);
  const prop = new THREE.Group();
  const bladeA = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.1, 0.08), dark);
  const bladeB = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.22, 0.08), dark);
  prop.add(bladeA);
  prop.add(bladeB);
  prop.position.set(0, 0, 2.95);
  plane.add(prop);

  // Fixed landing gear: struts and wheels, always visible.
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 6), dark);
    strut.position.set(side * 0.8, -0.85, 0.9);
    strut.rotation.z = side * 0.35;
    plane.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 12), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.05, -1.35, 0.9);
    plane.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.14, 10), dark);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -0.95, -3.2);
  plane.add(tailWheel);

  // Navigation lights: red port, green starboard, white tail.
  const lightMat = (c) => new THREE.MeshBasicMaterial({ color: c });
  const port = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), lightMat(0xff2a2a));
  port.position.set(-4.75, -0.1, 0.35);
  plane.add(port);
  const starboard = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), lightMat(0x2aff5a));
  starboard.position.set(4.75, -0.1, 0.35);
  plane.add(starboard);
  const tailLight = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), lightMat(0xffffff));
  tailLight.position.set(0, 0.1, -3.85);
  plane.add(tailLight);

  plane.userData.prop = prop;
  plane.userData.canopy = canopy;
  plane.userData.portLight = port;
  plane.userData.starboardLight = starboard;

  // The parts above were laid out nose-toward +Z; the flight model flies
  // nose-toward -Z, so tuck them into a shell turned half a revolution.
  const shell = new THREE.Group();
  shell.rotation.y = Math.PI;
  for (const child of [...plane.children]) shell.add(child);
  plane.add(shell);
  return plane;
}

export function spinPropeller(plane, throttle, dt) {
  const prop = plane.userData.prop;
  prop.rotation.z += (4 + throttle * 55) * dt;
}

export function blinkNavLights(plane, time) {
  const on = Math.sin(time * 4) > 0;
  plane.userData.portLight.visible = on;
  plane.userData.starboardLight.visible = on;
}
