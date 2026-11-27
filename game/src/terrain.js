// Kestrel Courier — Gullwing Island: terrain, runway, town, river, clouds and sky.
// One file, one job: build every static piece of the world and answer heightAt(x, z)
// for the flight model. All placement is seeded, so the island never changes.

import * as THREE from 'three';
import { WORLD } from './config.js';
import { mulberry32, range, pickFrom } from './random.js';

const SEED = 20261127;

const HILLS = [
  [-720, -620, 95, 30], [760, 660, 115, 34], [-880, 520, 75, 26],
  [620, -780, 85, 28], [180, 880, 62, 24], [-260, -900, 70, 26],
];

export function riverCentreX(z) {
  return -350 + 260 * Math.sin(z * 0.0011 + 0.5);
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function heightAt(x, z) {
  let h = 5 * Math.sin(x * 0.0035) * Math.cos(z * 0.0028)
    + 3.5 * Math.sin(x * 0.0013 + 1.7) * Math.sin(z * 0.0019 + 0.4)
    + 2.2;
  for (const [hx, hz, amp, sigma] of HILLS) {
    const dx = x - hx, dz = z - hz;
    h += amp * Math.exp(-(dx * dx + dz * dz) / (2 * sigma * sigma * 9));
  }
  // Carve the river channel.
  const dRiver = Math.abs(x - riverCentreX(z));
  h -= 4.5 * (1 - smoothstep(8, 46, dRiver));
  // Flatten the airfield around the runway.
  const r = WORLD.runway;
  const dx = Math.max(Math.abs(x - r.x) - r.length / 2, 0);
  const dz = Math.max(Math.abs(z - r.z) - r.width / 2, 0);
  const dRun = Math.hypot(dx, dz);
  h = r.elevation + (h - r.elevation) * smoothstep(0, 130, dRun);
  // Flatten the town bowl.
  const dTown = Math.hypot(x - 450, z - 400);
  h = 4.0 + (h - 4.0) * smoothstep(60, 190, dTown);
  return h;
}

export function isOnRunway(x, z) {
  const r = WORLD.runway;
  return Math.abs(x - r.x) <= r.length / 2 + 4 && Math.abs(z - r.z) <= r.width / 2 + 4;
}

function grassColour(h, random) {
  const c = new THREE.Color();
  const n = random() * 0.16;
  if (h > 20) c.setRGB(0.42 + n, 0.4 + n, 0.36 + n); // rock on the high hills
  else if (h < 2.3) c.setRGB(0.78 + n, 0.72 + n, 0.5 + n); // sand by the river
  else c.setRGB(0.32 + n * 0.7, 0.58 + n * 0.8, 0.26 + n * 0.5); // meadow greens
  return c;
}

function buildTerrainMesh(random) {
  const size = WORLD.size;
  const geo = new THREE.PlaneGeometry(size, size, 150, 150);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const colour = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    if (isOnRunway(x, z)) colour.setRGB(0.23, 0.24, 0.27);
    else colour.copy(grassColour(h, random));
    colours[i * 3] = colour.r;
    colours[i * 3 + 1] = colour.g;
    colours[i * 3 + 2] = colour.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
    vertexColors: true, flatShading: true,
  }));
  mesh.receiveShadow = true;
  return mesh;
}

function buildRunwayMarkings(scene) {
  const r = WORLD.runway;
  const y = r.elevation + 0.12;
  const white = new THREE.MeshBasicMaterial({ color: 0xf2f2ea });
  // Centreline dashes.
  for (let x = -r.length / 2 + 20; x < r.length / 2 - 10; x += 30) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.6), white);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(x, y, r.z);
    scene.add(dash);
  }
  // Threshold bars at both ends.
  for (const end of [-1, 1]) {
    for (let k = -2; k <= 2; k++) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.2), white);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(end * (r.length / 2 - 12), y, r.z + k * 5);
      scene.add(bar);
    }
  }
  // Edge lights: small amber posts along both edges.
  const lampGeo = new THREE.SphereGeometry(0.55, 8, 6);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffc861 });
  for (let x = -r.length / 2; x <= r.length / 2; x += 35) {
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(x, y + 0.6, r.z + side * (r.width / 2 + 1.5));
      scene.add(lamp);
    }
  }
  // Windsock beside the threshold.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 7, 6),
    new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }),
  );
  pole.position.set(-r.length / 2 + 8, r.elevation + 3.5, r.z + r.width / 2 + 8);
  scene.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(0.7, 3.2, 10),
    new THREE.MeshLambertMaterial({ color: 0xff7a1a }),
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(-r.length / 2 + 9.6, r.elevation + 6.6, r.z + r.width / 2 + 8);
  scene.add(sock);
}

function buildRoad(scene) {
  // A dirt road from the runway apron to the town square.
  const mat = new THREE.MeshLambertMaterial({ color: 0x8a6b45 });
  const pts = [[-40, 60], [140, 170], [300, 280], [430, 400]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[i + 1];
    const len = Math.hypot(x2 - x1, z2 - z1);
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(len, 7), mat);
    seg.rotation.x = -Math.PI / 2;
    seg.rotation.z = -Math.atan2(z2 - z1, x2 - x1);
    seg.position.set((x1 + x2) / 2, heightAt((x1 + x2) / 2, (z1 + z2) / 2) + 0.25, (z1 + z2) / 2);
    scene.add(seg);
  }
}

function buildTown(scene, random) {
  const group = new THREE.Group();
  const wallPalette = [0xf2e3c6, 0xe8b48a, 0xcfe0e8, 0xf0d0d0, 0xdfe8c8];
  const roofPalette = [0xb8442c, 0x7a4a2b, 0x4a6b8a, 0x5d7a45];
  const placed = [];
  let guard = 0;
  while (placed.length < 34 && guard < 600) {
    guard++;
    const x = range(random, 330, 580);
    const z = range(random, 300, 510);
    if (placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 26)) continue;
    if (Math.hypot(x - 450, z - 400) < 34) continue; // keep the square clear
    placed.push([x, z]);
    const w = range(random, 9, 15), d = range(random, 8, 13), hgt = range(random, 5, 9);
    const house = new THREE.Group();
    const walls = new THREE.Mesh(
      new THREE.BoxGeometry(w, hgt, d),
      new THREE.MeshLambertMaterial({ color: pickFrom(random, wallPalette) }),
    );
    walls.position.y = hgt / 2;
    walls.castShadow = true;
    house.add(walls);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.hypot(w, d) * 0.62, range(random, 3, 5), 4),
      new THREE.MeshLambertMaterial({ color: pickFrom(random, roofPalette), flatShading: true }),
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.y = hgt + roof.geometry.parameters.height / 2;
    roof.castShadow = true;
    house.add(roof);
    house.position.set(x, heightAt(x, z), z);
    house.rotation.y = random() * Math.PI;
    group.add(house);
  }
  // Church with a spire on the square's edge.
  const church = new THREE.Group();
  const nave = new THREE.Mesh(
    new THREE.BoxGeometry(14, 10, 20),
    new THREE.MeshLambertMaterial({ color: 0xe8e0cc }),
  );
  nave.position.y = 5;
  church.add(nave);
  const spire = new THREE.Mesh(
    new THREE.ConeGeometry(4.5, 14, 4),
    new THREE.MeshLambertMaterial({ color: 0x4a6b8a, flatShading: true }),
  );
  spire.rotation.y = Math.PI / 4;
  spire.position.set(0, 17, -8);
  church.add(spire);
  church.position.set(415, heightAt(415, 365), 365);
  group.add(church);
  scene.add(group);
}

function buildTrees(scene, random) {
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 4, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2b });
  const crownGeo = new THREE.ConeGeometry(3.4, 9, 7);
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x3f7d3a, flatShading: true });
  const count = 260;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, count);
  const dummy = new THREE.Object3D();
  let placed = 0, guard = 0;
  while (placed < count && guard < 4000) {
    guard++;
    const x = range(random, -1150, 1150);
    const z = range(random, -1150, 1150);
    const h = heightAt(x, z);
    if (h < 3.2 || h > 22) continue;
    if (isOnRunway(x, z)) continue;
    if (Math.abs(x - riverCentreX(z)) < 34) continue;
    if (Math.hypot(x - 450, z - 400) < 150) continue;
    if (Math.hypot(x, z) < 260) continue; // keep the airfield approaches clear
    const s = range(random, 0.8, 1.5);
    dummy.position.set(x, h + 2 * s, z);
    dummy.scale.setScalar(s);
    dummy.rotation.y = random() * Math.PI;
    dummy.updateMatrix();
    trunks.setMatrixAt(placed, dummy.matrix);
    dummy.position.y = h + (4 + 4.5) * s;
    dummy.updateMatrix();
    crowns.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  trunks.count = placed;
  crowns.count = placed;
  trunks.castShadow = true;
  crowns.castShadow = true;
  scene.add(trunks);
  scene.add(crowns);
}

function buildClouds(scene, random) {
  const clouds = [];
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 14; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(random() * 3);
    for (let p = 0; p < puffs; p++) {
      const r = range(random, 9, 20);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
      puff.position.set(range(random, -18, 18), range(random, -3, 3), range(random, -10, 10));
      puff.scale.y = 0.55;
      cloud.add(puff);
    }
    cloud.position.set(range(random, -1200, 1200), range(random, 130, 195), range(random, -1200, 1200));
    cloud.userData.speed = range(random, 1.5, 3.5);
    clouds.push(cloud);
    scene.add(cloud);
  }
  return clouds;
}

function buildSky(scene) {
  const geo = new THREE.SphereGeometry(4200, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x2f7fc4) },
      mid: { value: new THREE.Color(0x9fd4ef) },
      low: { value: new THREE.Color(0xe8f3f8) },
    },
    vertexShader: 'varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vPos; uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main(){
        float t = clamp(vPos.y / 1200.0, -0.1, 1.0);
        vec3 c = t > 0.25 ? mix(mid, top, (t - 0.25) / 0.75) : mix(low, mid, (t + 0.1) / 0.35);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(geo, mat));
  // Sun disc, low in the west so the light rakes across the island.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(90, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff2c8, fog: false }),
  );
  sun.position.set(-2600, 620, -1400);
  sun.lookAt(0, 0, 0);
  scene.add(sun);
}

export function buildWorld(scene) {
  const random = mulberry32(SEED);
  scene.fog = new THREE.Fog(0xcfe8f5, 750, 2600);
  buildSky(scene);
  scene.add(buildTerrainMesh(random));
  // River water: a wide sheet that only shows where the channel dips below it.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.size, WORLD.size),
    new THREE.MeshPhongMaterial({ color: 0x2f6fb2, transparent: true, opacity: 0.82, shininess: 120 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = WORLD.waterLevel;
  scene.add(water);
  buildRunwayMarkings(scene);
  buildRoad(scene);
  buildTown(scene, random);
  buildTrees(scene, random);
  const clouds = buildClouds(scene, random);

  const hemi = new THREE.HemisphereLight(0xbfe3f5, 0x5d7a45, 0.95);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xfff0d0, 2.1);
  sunLight.position.set(-900, 700, -500);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -700;
  sunLight.shadow.camera.right = 700;
  sunLight.shadow.camera.top = 700;
  sunLight.shadow.camera.bottom = -700;
  sunLight.shadow.camera.far = 2600;
  scene.add(sunLight);

  return {
    heightAt,
    isOnRunway,
    update(dt) {
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.speed * dt;
        if (cloud.position.x > 1350) cloud.position.x = -1350;
      }
    },
  };
}
