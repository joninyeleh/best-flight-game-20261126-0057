// All sound is synthesised with WebAudio — no audio files.
// Engine hum, wind rush, ring chime, crash thud and landing fanfare.

export function createAudio() {
  return {
    ctx: null,
    engineOsc: null,
    engineGain: null,
    windSource: null,
    windGain: null,
    windFilter: null,
    muted: false,
    started: false,
  };
}

export function ensureAudio(audio) {
  if (audio.started) {
    if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
    return;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  audio.ctx = ctx;
  audio.started = true;

  // Engine: two detuned saws through a low-pass filter.
  audio.engineOsc = ctx.createOscillator();
  audio.engineOsc.type = 'sawtooth';
  audio.engineOsc.frequency.value = 55;
  const engineOsc2 = ctx.createOscillator();
  engineOsc2.type = 'sawtooth';
  engineOsc2.frequency.value = 55 * 1.007;
  audio.engineFilter = ctx.createBiquadFilter();
  audio.engineFilter.type = 'lowpass';
  audio.engineFilter.frequency.value = 320;
  audio.engineGain = ctx.createGain();
  audio.engineGain.gain.value = 0;
  audio.engineOsc.connect(audio.engineFilter);
  engineOsc2.connect(audio.engineFilter);
  audio.engineFilter.connect(audio.engineGain);
  audio.engineGain.connect(ctx.destination);
  audio.engineOsc.start();
  engineOsc2.start();
  audio.engineOsc2 = engineOsc2;

  // Wind: looped noise through a band-pass filter.
  const len = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  audio.windSource = ctx.createBufferSource();
  audio.windSource.buffer = buffer;
  audio.windSource.loop = true;
  audio.windFilter = ctx.createBiquadFilter();
  audio.windFilter.type = 'bandpass';
  audio.windFilter.frequency.value = 700;
  audio.windFilter.Q.value = 0.6;
  audio.windGain = ctx.createGain();
  audio.windGain.gain.value = 0;
  audio.windSource.connect(audio.windFilter);
  audio.windFilter.connect(audio.windGain);
  audio.windGain.connect(ctx.destination);
  audio.windSource.start();
}

// Called every frame while flying: engine note follows throttle, wind follows speed.
export function updateEngineSound(audio, throttle, speed, stalled) {
  if (!audio.started || !audio.ctx) return;
  const t = audio.ctx.currentTime;
  const rpm = 42 + throttle * 58 + speed * 0.25;
  audio.engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
  audio.engineOsc2.frequency.setTargetAtTime(rpm * 1.007, t, 0.08);
  audio.engineFilter.frequency.setTargetAtTime(240 + throttle * 700, t, 0.1);
  const level = audio.muted ? 0 : 0.045 + throttle * 0.05 + (stalled ? 0.02 : 0);
  audio.engineGain.gain.setTargetAtTime(level, t, 0.1);
  const windLevel = audio.muted ? 0 : Math.max(0, (speed - 18) / 90) * 0.09;
  audio.windGain.gain.setTargetAtTime(windLevel, t, 0.15);
  audio.windFilter.frequency.setTargetAtTime(500 + speed * 9, t, 0.15);
}

function blip(audio, freq, when, dur, type, gain) {
  if (!audio.started || !audio.ctx || audio.muted) return;
  const ctx = audio.ctx;
  const osc = ctx.createOscillator();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(gain || 0.16, when + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + dur + 0.05);
}

export function playRingChime(audio) {
  if (!audio.started || !audio.ctx) return;
  const t = audio.ctx.currentTime;
  blip(audio, 880, t, 0.35, 'sine', 0.18);
  blip(audio, 1318, t + 0.07, 0.45, 'sine', 0.14);
}

export function playCrash(audio) {
  if (!audio.started || !audio.ctx) return;
  const ctx = audio.ctx;
  const t = ctx.currentTime;
  // Low thud.
  blip(audio, 62, t, 0.5, 'sine', 0.5);
  blip(audio, 41, t + 0.05, 0.6, 'triangle', 0.4);
  // Noise burst.
  const len = ctx.sampleRate * 0.4;
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.value = audio.muted ? 0 : 0.5;
  src.connect(g);
  g.connect(ctx.destination);
  src.start(t);
}

export function playLandingFanfare(audio) {
  if (!audio.started || !audio.ctx) return;
  const t = audio.ctx.currentTime;
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => blip(audio, f, t + i * 0.11, 0.5, 'triangle', 0.16));
}

export function playWarning(audio) {
  if (!audio.started || !audio.ctx) return;
  const t = audio.ctx.currentTime;
  blip(audio, 440, t, 0.18, 'square', 0.06);
  blip(audio, 440, t + 0.22, 0.18, 'square', 0.06);
}

export function setMuted(audio, muted) {
  audio.muted = muted;
  if (audio.ctx) {
    const t = audio.ctx.currentTime;
    if (audio.engineGain) audio.engineGain.gain.setTargetAtTime(0, t, 0.05);
    if (audio.windGain) audio.windGain.gain.setTargetAtTime(0, t, 0.05);
  }
}
