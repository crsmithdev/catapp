import { rand, pick } from './util.js';
import { settings } from './settings.js';

const MAX_VOICES = 10;

// Synthesized sounds. iOS allows audio only after a touch, so the first touch calls unlock().
export class Sound {
  constructor() {
    this.ctx = null;
    this.voices = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      // Play even when the iPad is in silent mode (iOS 17+).
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = settings.volume;
      this.master.connect(this.ctx.createDynamicsCompressor()).connect(this.ctx.destination);
      // White and brown noise, and a bus each for scene and creature sounds.
      const m = Math.floor(this.ctx.sampleRate * 3);
      this.hiss = this.ctx.createBuffer(1, m, this.ctx.sampleRate);
      this.brown = this.ctx.createBuffer(1, m, this.ctx.sampleRate);
      const h = this.hiss.getChannelData(0), b = this.brown.getChannelData(0);
      let last = 0;
      for (let i = 0; i < m; i++) {
        h[i] = Math.random() * 2 - 1;
        last = (last + 0.02 * h[i]) / 1.02;
        b[i] = last * 3.5;
      }
      this.sceneBus = this.ctx.createGain();
      this.creatureBus = this.ctx.createGain();
      this.sceneBus.connect(this.master);
      this.creatureBus.connect(this.master);
      this.setVolume();
    }
    // iOS can suspend or interrupt the context at any time; each touch resumes it.
    if (this.ctx.state !== 'running') this.ctx.resume();
  }

  // Applies the volume settings.
  setVolume() {
    if (!this.master) return;
    this.master.gain.value = settings.volume;
    this.sceneBus.gain.value = settings.sceneVolume;
    this.creatureBus.gain.value = settings.creatureVolume;
  }

  // Reserves a voice for `dur` seconds. Returns the start time, or -1 when no voice is free.
  voice(dur) {
    if (!this.ctx || !settings.volume || this.voices >= MAX_VOICES) return -1;
    this.voices++;
    setTimeout(() => this.voices--, dur * 1000 + 50);
    return this.ctx.currentTime;
  }

  envelope(t, peak, dur) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.master);
    return g;
  }

  // A high squeak, sometimes doubled.
  squeak() {
    const n = Math.random() < 0.4 ? 2 : 1;
    const f = rand(1600, 3400);
    let delay = 0;
    for (let i = 0; i < n; i++) {
      const dur = rand(0.08, 0.2);
      this.chirp(f * rand(0.9, 1.15), dur, delay);
      delay += dur + rand(0.02, 0.06);
    }
  }

  chirp(f, dur, delay) {
    const now = this.voice(delay + dur);
    if (now < 0) return;
    const t = now + delay;
    const o = this.ctx.createOscillator();
    o.type = pick(['sine', 'triangle']);
    o.frequency.setValueAtTime(f * 0.8, t);
    o.frequency.linearRampToValueAtTime(f * 1.25, t + dur * 0.4);
    o.frequency.linearRampToValueAtTime(f * 0.9, t + dur);
    o.connect(this.envelope(t, 0.35, dur));
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // Quick ticks, like small feet on the floor.
  scuttle() {
    const n = 3 + Math.floor(Math.random() * 3);
    const now = this.voice(n * 0.06);
    if (now < 0) return;
    for (let i = 0; i < n; i++) {
      const t = now + i * rand(0.035, 0.06);
      const src = this.ctx.createBufferSource();
      src.buffer = this.hiss;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = rand(2500, 5000);
      bp.Q.value = 3;
      src.connect(bp).connect(this.envelope(t, 0.4, 0.03));
      src.start(t, rand(0, 2.9), 0.04);
    }
  }

  // A soft drop for a touch on empty ground.
  plip() {
    const now = this.voice(0.12);
    if (now < 0) return;
    const f = rand(450, 800);
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(f, now);
    o.frequency.exponentialRampToValueAtTime(f * 0.5, now + 0.1);
    o.connect(this.envelope(now, 0.12, 0.1));
    o.start(now);
    o.stop(now + 0.12);
  }
}
