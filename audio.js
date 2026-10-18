import { rand, pick } from './util.js';

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
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.createDynamicsCompressor()).connect(this.ctx.destination);
      const n = Math.floor(this.ctx.sampleRate * 0.2);
      this.noise = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    // iOS can suspend or interrupt the context at any time; each touch resumes it.
    if (this.ctx.state !== 'running') this.ctx.resume();
  }

  // Reserves a voice for `dur` seconds. Returns the start time, or -1 when no voice is free.
  voice(dur) {
    if (!this.ctx || this.voices >= MAX_VOICES) return -1;
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
      src.buffer = this.noise;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = rand(2500, 5000);
      bp.Q.value = 3;
      src.connect(bp).connect(this.envelope(t, 0.4, 0.03));
      src.start(t, rand(0, 0.15), 0.04);
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
