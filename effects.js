import { TAU, rand, pick } from './util.js';

const MAX_PARTS = 400;
const MAX_RINGS = 40;

// Particle bursts and expanding rings. Both lists have a hard cap.
export class Effects {
  constructor() {
    this.parts = [];
    this.rings = [];
  }

  burst(x, y, colours) {
    for (let i = 0; i < 30 && this.parts.length < MAX_PARTS; i++) {
      const a = rand(0, TAU), v = rand(120, 520), life = rand(0.4, 0.9);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, r: rand(3, 9), colour: pick(colours) });
    }
    this.ring(x, y, 0.45, 12, 110, colours[0], 7);
  }

  ripple(x, y) {
    this.ring(x, y, 0.6, 6, 70, 'rgba(255,255,255,0.7)', 3);
  }

  ring(x, y, dur, r0, r1, colour, width) {
    if (this.rings.length >= MAX_RINGS) this.rings.shift();
    this.rings.push({ x, y, age: 0, dur, r0, r1, colour, width });
  }

  update(dt) {
    const drag = Math.exp(-4 * dt);
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.parts[i] = this.parts[this.parts.length - 1];
        this.parts.pop();
        continue;
      }
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (const r of this.rings) r.age += dt;
    this.rings = this.rings.filter((r) => r.age < r.dur);
  }

  draw(ctx) {
    ctx.save();
    for (const r of this.rings) {
      const t = r.age / r.dur;
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = r.colour;
      ctx.lineWidth = r.width * (1 - t * 0.6);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * (1 - (1 - t) ** 3), 0, TAU);
      ctx.stroke();
    }
    for (const p of this.parts) {
      const t = p.life / p.max;
      ctx.globalAlpha = t;
      ctx.fillStyle = p.colour;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.4 + 0.6 * t), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}
