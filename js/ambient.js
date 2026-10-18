import { rand, pick, clamp } from './util.js';
import { settings } from './settings.js';

const MAX_VOICES = 14;

// Ambient sound: a noise bed for each scene, scene events, and creature noises.
// All of it is synthesized. Gaps between sounds are random around a mean (`every`, in seconds).
export class Ambience {
  constructor(sound) {
    this.s = sound;
    this.beds = {};
    this.timers = {};
    this.voices = 0;
    this.bedTick = 0;
    this.creatureGap = 0;
  }

  get ctx() {
    return this.s.ctx;
  }

  // A random volume factor, so no two plays of a sound are the same level.
  vary() {
    return rand(0.5, 1);
  }

  // Opens an output for one sound on `bus`. Returns null when no voice is free.
  out(bus, vol, pan, dur) {
    if (!this.ctx || this.voices >= MAX_VOICES) return null;
    this.voices++;
    setTimeout(() => this.voices--, dur * 1000 + 100);
    const g = this.ctx.createGain();
    g.gain.value = vol;
    let p = null;
    if (this.ctx.createStereoPanner) {
      p = this.ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      g.connect(p).connect(bus);
    } else {
      g.connect(bus);
    }
    return { input: g, pan: p && p.pan, t: this.ctx.currentTime + 0.02 };
  }

  // `weights` maps a scene name to its share of the mix, 0 to 1, so beds cross-fade with the scenes.
  update(dt, weights, creatures, w) {
    if (!this.ctx) return;
    this.bedTick -= dt;
    if (this.bedTick <= 0) {
      this.bedTick = 0.1;
      const now = this.ctx.currentTime;
      for (const name of Object.keys(SCENE_SOUNDS)) {
        const wgt = weights[name] || 0;
        if (!this.beds[name] && wgt <= 0) continue;
        this.beds[name] ??= SCENE_SOUNDS[name].bed(this);
        const b = this.beds[name];
        b.level.gain.setTargetAtTime(wgt * b.mod(now), now, 0.4);
      }
    }

    const rate = settings.soundRate;
    for (const [name, wgt] of Object.entries(weights)) {
      if (wgt < 0.2 || !SCENE_SOUNDS[name]) continue;
      SCENE_SOUNDS[name].events.forEach((ev, i) => {
        const key = name + i;
        this.timers[key] ??= gap(ev.every) * rand(0.2, 1);
        this.timers[key] -= dt * rate;
        if (this.timers[key] > 0) return;
        this.timers[key] = gap(ev.every);
        ev.play(this, this.s.sceneBus, wgt * this.vary(), rand(-0.8, 0.8));
      });
    }

    // Creature noises keep a short gap between them, so a crowd does not turn into a din.
    this.creatureGap -= dt;
    for (const c of creatures) {
      const list = CREATURE_SOUNDS[c.kind];
      if (!list || c.dying >= 0 || !c.entered) continue;
      c.noise ??= list.map((cs) => gap(cs.every) * rand(0.3, 1));
      list.forEach((cs, i) => {
        c.noise[i] -= dt * rate;
        if (c.noise[i] > 0 || this.creatureGap > 0) return;
        if (cs.when && !cs.when(c)) {
          c.noise[i] = 0.3;
          return;
        }
        c.noise[i] = gap(cs.every);
        this.creatureGap = rand(0.3, 0.8);
        cs.play(this, this.s.creatureBus, this.vary(), (c.x / w) * 1.4 - 0.7);
      });
    }
  }
}

// A random gap with mean near `mean`: often short, sometimes long, never regular.
function gap(mean) {
  return mean * clamp(-Math.log(1 - Math.random()), 0.25, 3);
}

// A slow wobble between -1 and 1.
function wobble(t) {
  return (Math.sin(t) + Math.sin(t * 2.3 + 1) + Math.sin(t * 0.7 + 2)) / 3;
}

function noiseBed(a, { brown, type, freq, q = 0.7, base, swing, rate }) {
  const ctx = a.ctx;
  const src = ctx.createBufferSource();
  src.buffer = brown ? a.s.brown : a.s.hiss;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const level = ctx.createGain();
  level.gain.value = 0;
  src.connect(f).connect(level).connect(a.s.sceneBus);
  src.start(0, rand(0, 2));
  const seed = rand(0, 100);
  return { level, mod: (t) => base + swing * (0.5 + 0.5 * wobble(t * rate + seed)) };
}

// One oscillator note with a pitch glide and a fast attack.
function tone(a, dest, t, dur, { type = 'sine', f0, f1 = f0, peak = 0.2, attack = 0.01 }) {
  const ctx = a.ctx, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

// A burst of filtered noise.
function hiss(a, dest, t, dur, { type = 'bandpass', freq, q = 1, peak = 0.1, attack = 0.005 }) {
  const ctx = a.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = a.s.hiss;
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t, rand(0, 2), dur + 0.05);
  return { src, f, g };
}

// A gain node whose level pulses at `rate` Hz, from 1 - depth to 1.
function pulse(a, dest, t, dur, rate, depth) {
  const ctx = a.ctx, g = ctx.createGain(), l = ctx.createOscillator(), d = ctx.createGain();
  g.gain.value = 1 - depth / 2;
  l.frequency.value = rate;
  d.gain.value = depth / 2;
  l.connect(d).connect(g.gain);
  g.connect(dest);
  l.start(t);
  l.stop(t + dur + 0.05);
  return g;
}

// A swell: a slow rise and fall over the whole sound.
function swell(a, dest, t, dur, peak, attack, release) {
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + dur - release);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(dest);
  return g;
}

function ticks(a, dest, t, n, spacing, { freq, q = 3, peak, type = 'bandpass' }) {
  for (let i = 0; i < n; i++) hiss(a, dest, t + i * rand(...spacing), 0.025, { type, freq: freq * rand(0.85, 1.15), q, peak: peak * rand(0.6, 1) });
}

// Scene sounds.

function bird(a, bus, vol, pan) {
  const base = rand(2500, 4500), pattern = pick(['trill', 'down', 'up', 'two', 'warble']);
  const n = pattern === 'trill' ? 4 + Math.floor(rand(0, 6)) : 2 + Math.floor(rand(0, 4));
  const notes = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    const dur = pattern === 'trill' ? rand(0.03, 0.05) : rand(0.06, 0.14);
    let f0 = base, f1 = base;
    if (pattern === 'down') { f0 = base * (1 + 0.1 * (n - i)); f1 = f0 * 0.8; }
    if (pattern === 'up') { f0 = base * 0.8; f1 = base * 1.3; }
    if (pattern === 'two') { f0 = f1 = i % 2 ? base * 0.75 : base; }
    if (pattern === 'warble') { f0 = base * rand(0.8, 1.2); f1 = base * rand(0.8, 1.2); }
    notes.push([t, dur, f0, f1]);
    t += dur + rand(0.02, 0.08);
  }
  const o = a.out(bus, vol, pan, t);
  if (!o) return;
  for (const [nt, dur, f0, f1] of notes) tone(a, o.input, o.t + nt, dur, { f0, f1, peak: 0.12 });
}

function bee(a, bus, vol, pan) {
  const dur = rand(1.5, 3.5), o = a.out(bus, vol, pan, dur);
  if (!o) return;
  if (o.pan) o.pan.linearRampToValueAtTime(-pan, o.t + dur);
  const ctx = a.ctx, osc = ctx.createOscillator(), lp = ctx.createBiquadFilter();
  osc.type = 'sawtooth';
  const f = rand(170, 240);
  osc.frequency.setValueAtTime(f, o.t);
  osc.frequency.linearRampToValueAtTime(f * rand(0.9, 1.1), o.t + dur);
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  osc.connect(lp).connect(pulse(a, swell(a, o.input, o.t, dur, 0.06, 0.5, 0.6), o.t, dur, rand(20, 35), 0.5));
  osc.start(o.t);
  osc.stop(o.t + dur + 0.05);
}

function cicada(a, bus, vol, pan) {
  const dur = rand(2, 4), o = a.out(bus, vol, pan, dur);
  if (!o) return;
  const h = hiss(a, pulse(a, swell(a, o.input, o.t, dur, 1, 0.5, 0.8), o.t, dur, rand(40, 70), 0.8), o.t, dur, { freq: rand(4500, 6500), q: 4, peak: 0.12, attack: 0.05 });
  h.g.gain.setValueAtTime(0.12, o.t + dur - 0.05);
}

function gust(a, bus, vol, pan) {
  const dur = rand(3, 5), o = a.out(bus, vol, pan, dur);
  if (!o) return;
  const h = hiss(a, swell(a, o.input, o.t, dur, 1, dur * 0.4, dur * 0.5), o.t, dur, { freq: 300, q: 0.8, peak: 0.12, attack: 0.05 });
  h.g.gain.setValueAtTime(0.12, o.t + dur - 0.05);
  h.f.frequency.linearRampToValueAtTime(rand(700, 1000), o.t + dur * 0.5);
  h.f.frequency.linearRampToValueAtTime(300, o.t + dur);
}

function hawk(a, bus, vol, pan) {
  const n = Math.random() < 0.4 ? 2 : 1, o = a.out(bus, vol * 0.6, pan, n * 1.2);
  if (!o) return;
  const bp = a.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2400;
  bp.Q.value = 2;
  bp.connect(o.input);
  for (let i = 0; i < n; i++) tone(a, bp, o.t + i * 1.1, rand(0.7, 1), { type: 'sawtooth', f0: rand(2100, 2400), f1: rand(1400, 1700), peak: 0.1, attack: 0.08 });
}

function creak(a, bus, vol, pan) {
  const dur = rand(0.4, 0.8), o = a.out(bus, vol, pan, dur);
  if (!o) return;
  const bp = a.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = rand(700, 1100);
  bp.Q.value = 3;
  bp.connect(pulse(a, o.input, o.t, dur, rand(12, 20), 0.7));
  const f = rand(70, 130);
  tone(a, bp, o.t, dur, { type: 'sawtooth', f0: f, f1: f * rand(0.8, 1.4), peak: 0.15, attack: 0.08 });
}

function clink(a, bus, vol, pan) {
  const n = Math.random() < 0.3 ? 2 : 1, o = a.out(bus, vol, pan, 1);
  if (!o) return;
  for (let i = 0; i < n; i++) {
    const f = rand(2200, 3200), t = o.t + i * rand(0.12, 0.2);
    tone(a, o.input, t, rand(0.4, 0.7), { f0: f, peak: 0.05, attack: 0.002 });
    tone(a, o.input, t, rand(0.2, 0.4), { f0: f * 2.7, peak: 0.02, attack: 0.002 });
  }
}

function clock(a, bus, vol, pan) {
  const n = 4 + Math.floor(rand(0, 5)), o = a.out(bus, vol * 0.6, pan, n);
  if (!o) return;
  for (let i = 0; i < n; i++) hiss(a, o.input, o.t + i, 0.02, { freq: i % 2 ? 2600 : 3400, q: 6, peak: 0.08 });
}

function plop(a, bus, vol, pan) {
  const o = a.out(bus, vol, pan, 0.5);
  if (!o) return;
  const f = rand(300, 500);
  tone(a, o.input, o.t, rand(0.05, 0.09), { f0: f, f1: f * 3, peak: 0.15 });
  if (Math.random() < 0.4) tone(a, o.input, o.t + rand(0.15, 0.3), 0.05, { f0: f * 1.5, f1: f * 4, peak: 0.06 });
}

function frog(a, bus, vol, pan) {
  const n = 1 + Math.floor(rand(0, 3)), o = a.out(bus, vol, pan, n * 0.6);
  if (!o) return;
  const bp = a.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = rand(450, 650);
  bp.Q.value = 2;
  bp.connect(pulse(a, o.input, o.t, n * 0.6, rand(25, 40), 0.8));
  const f = rand(90, 150);
  for (let i = 0; i < n; i++) tone(a, bp, o.t + i * rand(0.35, 0.5), rand(0.2, 0.35), { type: 'sawtooth', f0: f, f1: f * 0.85, peak: 0.25, attack: 0.03 });
}

function cricket(a, bus, vol, pan) {
  const chirps = 3 + Math.floor(rand(0, 6)), every = rand(0.35, 0.6), pulses = 3 + Math.floor(rand(0, 2));
  const dur = chirps * every, o = a.out(bus, vol * 0.7, pan, dur);
  if (!o) return;
  const osc = a.ctx.createOscillator(), g = a.ctx.createGain();
  osc.frequency.value = rand(4200, 5200);
  g.gain.value = 0;
  for (let c = 0; c < chirps; c++) {
    for (let p = 0; p < pulses; p++) {
      const t = o.t + c * every + p * 0.03;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.004);
      g.gain.linearRampToValueAtTime(0, t + 0.014);
    }
  }
  osc.connect(g).connect(o.input);
  osc.start(o.t);
  osc.stop(o.t + dur + 0.05);
}

function owl(a, bus, vol, pan) {
  const pattern = pick([[0.45], [0.3, 0.5], [0.3, 0.25, 0.5]]), f = rand(330, 420);
  const o = a.out(bus, vol, pan, 2.5);
  if (!o) return;
  let t = o.t;
  for (const dur of pattern) {
    tone(a, o.input, t, dur, { f0: f, f1: f * 0.92, peak: 0.15, attack: 0.06 });
    t += dur + rand(0.2, 0.35);
  }
}

// Creature sounds.

function squeak(a, bus, vol, pan) {
  const n = 1 + Math.floor(rand(0, 3)), o = a.out(bus, vol, pan, n * 0.2);
  if (!o) return;
  const f = rand(2500, 4000);
  for (let i = 0; i < n; i++) tone(a, o.input, o.t + i * rand(0.1, 0.16), rand(0.06, 0.12), { type: pick(['sine', 'triangle']), f0: f * rand(0.9, 1.1), f1: f * rand(1.1, 1.3), peak: 0.07 });
}

function patter(a, bus, vol, pan) {
  const n = 4 + Math.floor(rand(0, 5)), o = a.out(bus, vol, pan, n * 0.05);
  if (!o) return;
  ticks(a, o.input, o.t, n, [0.03, 0.05], { freq: rand(3000, 5000), peak: 0.05 });
}

function skitter(a, bus, vol, pan) {
  const n = 6 + Math.floor(rand(0, 6)), o = a.out(bus, vol, pan, n * 0.04);
  if (!o) return;
  ticks(a, o.input, o.t, n, [0.02, 0.035], { freq: rand(1500, 2500), peak: 0.07 });
}

function click(a, bus, vol, pan) {
  const n = 2 + Math.floor(rand(0, 2)), o = a.out(bus, vol, pan, n * 0.1);
  if (!o) return;
  ticks(a, o.input, o.t, n, [0.05, 0.1], { type: 'highpass', freq: 3000, q: 0.7, peak: 0.08 });
}

function buzz(a, bus, vol, pan) {
  const dur = rand(0.3, 0.6), o = a.out(bus, vol, pan, dur);
  if (!o) return;
  tone(a, pulse(a, o.input, o.t, dur, 40, 0.6), o.t, dur, { type: 'sawtooth', f0: rand(250, 350), peak: 0.03, attack: 0.05 });
}

function flutter(a, bus, vol, pan) {
  const dur = rand(0.4, 0.8), o = a.out(bus, vol, pan, dur);
  if (!o) return;
  hiss(a, pulse(a, o.input, o.t, dur, rand(12, 16), 0.9), o.t, dur, { freq: 1200, q: 0.7, peak: 0.06, attack: 0.1 });
}

function bubbles(a, bus, vol, pan) {
  const n = 2 + Math.floor(rand(0, 4)), o = a.out(bus, vol, pan, n * 0.25);
  if (!o) return;
  let t = o.t, f = rand(300, 500);
  for (let i = 0; i < n; i++) {
    tone(a, o.input, t, 0.05, { f0: f, f1: f * 2, peak: 0.07 });
    t += rand(0.08, 0.2);
    f *= rand(1.05, 1.25);
  }
}

function zip(a, bus, vol, pan) {
  const o = a.out(bus, vol, pan, 0.1);
  if (!o) return;
  const f = rand(900, 1500);
  tone(a, o.input, o.t, 0.07, { f0: f, f1: f * 0.3, peak: 0.03 });
}

const running = (c) => c.state === 'run' && c.moving > 0.5;

// Keys are scene names from scenes.js.
const SCENE_SOUNDS = {
  kitchen: {
    bed: (a) => noiseBed(a, { brown: true, type: 'lowpass', freq: 450, base: 0.05, swing: 0.02, rate: 0.05 }),
    events: [{ every: 35, play: creak }, { every: 50, play: clink }, { every: 40, play: clock }],
  },
  meadow: {
    bed: (a) => noiseBed(a, { type: 'bandpass', freq: 700, base: 0.01, swing: 0.05, rate: 0.15 }),
    events: [{ every: 8, play: bird }, { every: 30, play: bee }],
  },
  desert: {
    bed: (a) => noiseBed(a, { type: 'bandpass', freq: 450, base: 0.015, swing: 0.08, rate: 0.1 }),
    events: [{ every: 25, play: cicada }, { every: 20, play: gust }, { every: 50, play: hawk }],
  },
  pond: {
    bed: (a) => noiseBed(a, { brown: true, type: 'lowpass', freq: 800, base: 0.05, swing: 0.04, rate: 0.4 }),
    events: [{ every: 6, play: plop }, { every: 14, play: frog }, { every: 25, play: bird }],
  },
  'living room at night': {
    bed: (a) => noiseBed(a, { brown: true, type: 'lowpass', freq: 300, base: 0.04, swing: 0.01, rate: 0.05 }),
    events: [{ every: 2.5, play: cricket }, { every: 45, play: owl }],
  },
};

// Keys are creature kinds from creatures.js. `when` limits a sound to a state, such as running.
const CREATURE_SOUNDS = {
  mouse: [{ every: 14, play: squeak }, { every: 8, play: patter, when: running }],
  lizard: [{ every: 9, play: skitter, when: running }],
  beetle: [{ every: 14, play: click }],
  ladybug: [{ every: 25, play: buzz }],
  butterfly: [{ every: 16, play: flutter }],
  fish: [{ every: 14, play: bubbles }],
  laser: [{ every: 14, play: zip }],
};
