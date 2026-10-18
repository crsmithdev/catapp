import { TAU, rand, pick } from './util.js';
import { settings } from './settings.js';

const MAX_PARTS = 400;
const MAX_RINGS = 40;
const CONFETTI = ['#f2c230', '#3b8beb', '#ffffff', '#7fd1f5', '#ffe680'];

// Each kind of hit effect adds particles and rings around (x, y).
// `s` is the effect size setting; `colours` are the creature's colours.
const BURSTS = {
  pop(fx, x, y, colours, s) {
    fx.spray(x, y, 30, { speed: [120, 520], life: [0.4, 0.9], r: [3, 9], colours, shape: 'dot' }, s);
    fx.ring(x, y, 0.45, 12, 110, colours[0], 7, 0, s);
  },
  confetti(fx, x, y, colours, s) {
    fx.spray(x, y, 36, { speed: [150, 450], life: [0.8, 1.4], r: [4, 8], colours: CONFETTI, shape: 'rect', drag: 2.5, spin: 12 }, s);
  },
  stars(fx, x, y, colours, s) {
    fx.spray(x, y, 12, { speed: [100, 350], life: [0.6, 1.1], r: [8, 14], colours: [colours[1], '#fff', '#f2c230'], shape: 'star', spin: 6 }, s);
    fx.ring(x, y, 0.4, 10, 80, '#fff', 4, 0, s);
  },
  shock(fx, x, y, colours, s) {
    for (let i = 0; i < 3; i++) fx.ring(x, y, 0.5, 8, 90 + i * 40, i % 2 ? '#fff' : colours[0], 8 - i * 2, i * 0.1, s);
    fx.spray(x, y, 10, { speed: [60, 200], life: [0.3, 0.6], r: [3, 6], colours, shape: 'dot' }, s);
  },
  sparkle(fx, x, y, colours, s) {
    fx.spray(x, y, 24, { speed: [300, 800], life: [0.25, 0.5], r: [2, 3.5], colours: ['#fff', colours[1]], shape: 'streak', drag: 6 }, s);
    fx.ring(x, y, 0.3, 6, 50, colours[1], 5, 0, s);
  },
};

// Particle bursts and expanding rings. Both lists have a hard cap.
export class Effects {
  constructor() {
    this.parts = [];
    this.rings = [];
  }

  // Picks a random kind of hit effect.
  burst(x, y, colours) {
    BURSTS[pick(Object.keys(BURSTS))](this, x, y, colours, settings.effectSize);
  }

  ripple(x, y) {
    this.ring(x, y, 0.6, 6, 70, 'rgba(255,255,255,0.7)', 3, 0, settings.effectSize);
  }

  spray(x, y, n, o, s) {
    for (let i = 0; i < n && this.parts.length < MAX_PARTS; i++) {
      const a = rand(0, TAU), v = rand(...o.speed) * s, life = rand(...o.life);
      this.parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life,
        r: rand(...o.r) * s, colour: pick(o.colours), shape: o.shape, drag: o.drag ?? 4,
        rot: rand(0, TAU), spin: rand(-1, 1) * (o.spin ?? 0),
      });
    }
  }

  // A ring starts after `delay` seconds and grows from r0 to r1.
  ring(x, y, dur, r0, r1, colour, width, delay, s) {
    if (this.rings.length >= MAX_RINGS) this.rings.shift();
    this.rings.push({ x, y, age: -delay, dur, r0: r0 * s, r1: r1 * s, colour, width: width * Math.sqrt(s) });
  }

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.parts[i] = this.parts[this.parts.length - 1];
        this.parts.pop();
        continue;
      }
      const drag = Math.exp(-p.drag * dt);
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
    for (const r of this.rings) r.age += dt;
    this.rings = this.rings.filter((r) => r.age < r.dur);
  }

  draw(ctx) {
    ctx.save();
    for (const r of this.rings) {
      if (r.age < 0) continue;
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
      ctx.globalAlpha = Math.min(1, t * 1.5);
      ctx.fillStyle = p.colour;
      ctx.strokeStyle = p.colour;
      const r = p.r * (0.4 + 0.6 * t);
      if (p.shape === 'dot') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, TAU);
        ctx.fill();
      } else if (p.shape === 'streak') {
        ctx.lineWidth = r;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
        ctx.stroke();
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        if (p.shape === 'rect') {
          // Confetti turns over as it spins.
          ctx.fillRect(-r, -r * 0.5 * Math.abs(Math.cos(p.rot * 1.7)), r * 2, r * Math.abs(Math.cos(p.rot * 1.7)));
        } else {
          star(ctx, p.r);
        }
        ctx.restore();
      }
    }
    ctx.restore();
  }
}

function star(ctx, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}
