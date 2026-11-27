// Kestrel Courier — synthesised sound, no audio files.
// One file, one job: the engine drone, the wind, and the chimes and thuds
// that mark rings, parcels and landings. Everything is built with WebAudio.

export function createAudio() {
  return {
    ctx: null,
    enabled: true,
    engineOsc: null,
    engineOsc2: null,
    engineGain: null,
    engineFilter: null,
    windGain: null,
    windSource: null,
    started: false,
  };
}

function makeNoiseBuffer(ctx, seconds = 2) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export function startAudio(audio) {
  if (audio.started) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  audio.ctx = ctx;
  audio.started = true;

  // Engine: two detuned saws through a lowpass, pitch following the throttle.
  audio.engineFilter = ctx.createBiquadFilter();
  audio.engineFilter.type = 'lowpass';
  audio.engineFilter.frequency.value = 420;
  audio.engineFilter.Q.value = 1.2;
  audio.engineGain = ctx.createGain();
  audio.engineGain.gain.value = 0.0;
  audio.engineOsc = ctx.createOscillator();
  audio.engineOsc.type = 'sawtooth';
  audio.engineOsc.frequency.value = 58;
  audio.engineOsc2 = ctx.createOscillator();
  audio.engineOsc2.type = 'sawtooth';
  audio.engineOsc2.frequency.value = 87;
  const osc2Gain = ctx.createGain();
  osc2Gain.gain.value = 0.5;
  audio.engineOsc.connect(audio.engineFilter);
  audio.engineOsc2.connect(osc2Gain);
  osc2Gain.connect(audio.engineFilter);
  audio.engineFilter.connect(audio.engineGain);
  audio.engineGain.connect(ctx.destination);
  audio.engineOsc.start();
  audio.engineOsc2.start();

  // Wind: looped noise through a bandpass, loudness following airspeed.
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.value = 700;
  windFilter.Q.value = 0.6;
  audio.windGain = ctx.createGain();
  audio.windGain.gain.value = 0.0;
  audio.windSource = ctx.createBufferSource();
  audio.windSource.buffer = makeNoiseBuffer(ctx);
  audio.windSource.loop = true;
  audio.windSource.connect(windFilter);
  windFilter.connect(audio.windGain);
  audio.windGain.connect(ctx.destination);
  audio.windSource.start();
}

export function updateAudio(audio, throttle, airspeed, onGround) {
  if (!audio.started || !audio.ctx) return;
  const t = audio.ctx.currentTime;
  const on = audio.enabled ? 1 : 0;
  const engineLevel = onGround && airspeed < 2 ? 0.05 + throttle * 0.1 : 0.06 + throttle * 0.12;
  audio.engineGain.gain.setTargetAtTime(engineLevel * on, t, 0.1);
  audio.engineOsc.frequency.setTargetAtTime(52 + throttle * 68, t, 0.1);
  audio.engineOsc2.frequency.setTargetAtTime(78 + throttle * 102, t, 0.1);
  audio.engineFilter.frequency.setTargetAtTime(320 + throttle * 900, t, 0.15);
  audio.windGain.gain.setTargetAtTime(Math.min(0.16, airspeed * 0.0016) * on, t, 0.2);
}

function playTone(audio, freq, when, duration, type = 'sine', level = 0.22) {
  if (!audio.started || !audio.enabled) return;
  const ctx = audio.ctx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, ctx.currentTime + when);
  gain.gain.linearRampToValueAtTime(level, ctx.currentTime + when + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + when);
  osc.stop(ctx.currentTime + when + duration + 0.05);
}

export function playRingChime(audio) {
  playTone(audio, 880, 0, 0.35);
  playTone(audio, 1318, 0.09, 0.45);
}

export function playParcelThud(audio) {
  playTone(audio, 196, 0, 0.25, 'triangle', 0.3);
  playTone(audio, 294, 0.08, 0.3, 'sine', 0.2);
}

export function playTouchdown(audio, soft) {
  if (!audio.started || !audio.enabled) return;
  const ctx = audio.ctx;
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, 0.3);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = soft ? 320 : 180;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(soft ? 0.25 : 0.5, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start();
  if (soft) playTone(audio, 523, 0.05, 0.4, 'sine', 0.15);
}

export function playCrash(audio) {
  if (!audio.started || !audio.enabled) return;
  const ctx = audio.ctx;
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, 0.8);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 240;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.6, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start();
  playTone(audio, 110, 0, 0.7, 'sawtooth', 0.2);
}

export function playFanfare(audio) {
  playTone(audio, 523, 0, 0.3);
  playTone(audio, 659, 0.12, 0.3);
  playTone(audio, 784, 0.24, 0.5);
}
