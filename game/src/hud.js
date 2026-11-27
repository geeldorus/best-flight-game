// Kestrel Courier — the cockpit instruments and on-screen messages.
// One file, one job: paint the HUD (attitude ball, compass tape, speed, altitude,
// heading, fuel, damage, throttle) and flash the centre banner.

import { headingDegrees } from './physics.js';

const MS_TO_KT = 1.94384;
const M_TO_FT = 3.28084;

export function createHud() {
  return {
    speed: document.getElementById('speed'),
    alt: document.getElementById('alt'),
    hdg: document.getElementById('hdg'),
    vs: document.getElementById('vs'),
    score: document.getElementById('score'),
    clock: document.getElementById('clock'),
    rings: document.getElementById('rings'),
    fuelBar: document.getElementById('fuel-bar'),
    fuelPct: document.getElementById('fuel-pct'),
    damageBar: document.getElementById('damage-bar'),
    damagePct: document.getElementById('damage-pct'),
    throttleBar: document.getElementById('throttle-bar'),
    throttlePct: document.getElementById('throttle-pct'),
    gearState: document.getElementById('gear-state'),
    missionName: document.getElementById('mission-name'),
    missionObjective: document.getElementById('mission-objective'),
    flash: document.getElementById('flash'),
    flashSub: document.getElementById('flash-sub'),
    attitude: document.getElementById('attitude'),
    compass: document.getElementById('compass'),
    damageFlash: document.getElementById('damage-flash'),
    status: document.getElementById('status'),
    flashUntil: 0,
  };
}

function drawAttitude(hud, pitch, roll) {
  const canvas = hud.attitude;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2, r = w / 2 - 6;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  // Sky above the horizon, ground below it, rolled and pitched.
  ctx.translate(cx, cy);
  ctx.rotate(-roll);
  const pitchPx = pitch * 150;
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-r - 10, -r - 10 - pitchPx, (r + 10) * 2, r + 10 + pitchPx);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-r - 10, -pitchPx, (r + 10) * 2, r + 10 + pitchPx);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-r, -pitchPx);
  ctx.lineTo(r, -pitchPx);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  for (const [dy, len] of [[-40, 60], [40, 60], [-80, 40], [80, 40]]) {
    ctx.beginPath();
    ctx.moveTo(cx - len / 2 - cx, -pitchPx + dy);
    ctx.lineTo(cx + len / 2 - cx, -pitchPx + dy);
    ctx.stroke();
  }
  ctx.restore();
  // Fixed wings marker and bezel.
  ctx.strokeStyle = '#ffb340';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx - 52, cy);
  ctx.lineTo(cx - 18, cy);
  ctx.moveTo(cx + 18, cy);
  ctx.lineTo(cx + 52, cy);
  ctx.stroke();
  ctx.fillStyle = '#ffb340';
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,220,255,0.6)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

function drawCompass(hud, heading) {
  const canvas = hud.compass;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(8,18,28,0.62)';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,220,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const pxPerDeg = 4;
  for (let d = 0; d < 360; d += 5) {
    let rel = ((d - heading + 540) % 360) - 180;
    const x = w / 2 + rel * pxPerDeg;
    if (x < -20 || x > w + 20) continue;
    const major = d % 45 === 0;
    ctx.strokeStyle = major ? '#dff4ff' : 'rgba(223,244,255,0.45)';
    ctx.lineWidth = major ? 2.5 : 1.2;
    ctx.beginPath();
    ctx.moveTo(x, h - 8);
    ctx.lineTo(x, h - (major ? 22 : 14));
    ctx.stroke();
    if (major) {
      ctx.fillStyle = d === 0 ? '#ffb340' : '#dff4ff';
      ctx.fillText(labels[d] ?? String(d).padStart(3, '0'), x, 14);
    }
  }
  // Centre caret.
  ctx.fillStyle = '#ffb340';
  ctx.beginPath();
  ctx.moveTo(w / 2 - 7, 0);
  ctx.lineTo(w / 2 + 7, 0);
  ctx.lineTo(w / 2, 9);
  ctx.closePath();
  ctx.fill();
}

export function updateHud(hud, state, mission, now) {
  const speedKt = Math.round(state.airspeed * MS_TO_KT);
  const altFt = Math.max(0, Math.round((state.position.y - 2) * M_TO_FT));
  const hdg = Math.round(headingDegrees(state.yaw));
  const vsFpm = Math.round(state.verticalSpeed * M_TO_FT * 60);
  hud.speed.textContent = String(speedKt);
  hud.alt.textContent = String(altFt);
  hud.hdg.textContent = String(hdg).padStart(3, '0');
  hud.vs.textContent = `${vsFpm >= 0 ? '+' : ''}${vsFpm}`;
  hud.score.textContent = String(mission.score);
  const t = Math.floor(mission.elapsed);
  hud.clock.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  hud.rings.textContent = `${mission.progress} / ${mission.total}`;
  hud.fuelBar.style.width = `${state.fuel}%`;
  hud.fuelPct.textContent = `${Math.round(state.fuel)}%`;
  hud.damageBar.style.width = `${state.damage}%`;
  hud.damagePct.textContent = `${Math.round(state.damage)}%`;
  hud.throttleBar.style.width = `${Math.round(state.throttle * 100)}%`;
  hud.throttlePct.textContent = `${Math.round(state.throttle * 100)}%`;
  hud.gearState.textContent = state.onGround ? 'ON GROUND' : 'GEAR DOWN';
  hud.missionName.textContent = mission.def.name;
  hud.missionObjective.textContent = mission.objective;
  drawAttitude(hud, state.pitch, state.roll);
  drawCompass(hud, hdg);
  if (now > hud.flashUntil) {
    hud.flash.textContent = '';
    hud.flashSub.textContent = '';
  }
  hud.damageFlash.style.opacity = state.damage > 60 ? '0.7' : state.damage > 30 ? '0.35' : '0';
}

export function flashBanner(hud, text, sub, seconds = 2.2) {
  hud.flash.textContent = text;
  hud.flashSub.textContent = sub ?? '';
  hud.flashUntil = performance.now() / 1000 + seconds;
  hud.status.textContent = `${text} ${sub ?? ''}`;
}
