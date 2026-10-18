import { TAU, rand, pick, clamp } from './util.js';

// Palettes are HSL ranges. Cats see blue and yellow best, so most kinds lean on those.
const YELLOW = { h: [44, 56], s: [80, 95], l: [52, 64] };
const BLUE = { h: [200, 225], s: [70, 90], l: [50, 62] };
const GREY = { h: [20, 40], s: [5, 15], l: [55, 72] };
const RED = { h: [355, 365], s: [80, 90], l: [48, 55] };
const ORANGE = { h: [20, 32], s: [85, 95], l: [52, 60] };
const GREEN = { h: [80, 110], s: [55, 75], l: [45, 55] };

// Gait parameters, in seconds and radians:
//   run, pause: duration ranges of each state; pause [0, 0] never stops.
//   kick: largest turn when a run starts. wobble: largest turn rate during a run.
//   accel: how fast speed follows its target. flutter: speed and height bob.
export const KINDS = {
  mouse: {
    size: [34, 50], speed: [200, 340], palettes: [YELLOW, BLUE, GREY, GREY],
    run: [0.4, 1.6], pause: [0.25, 1.4], kick: 1.3, wobble: 1.2, accel: 14,
    shadow: [0.6, 0.35], draw: drawMouse,
  },
  beetle: {
    size: [31, 48], speed: [60, 120], palettes: [BLUE, YELLOW, GREEN],
    run: [2, 6], pause: [0.4, 2], kick: 0.8, wobble: 0.9, accel: 6,
    shadow: [0.45, 0.35], draw: drawBeetle,
  },
  ladybug: {
    size: [28, 42], speed: [50, 100], palettes: [RED, YELLOW, BLUE],
    run: [2, 6], pause: [0.4, 2.5], kick: 0.8, wobble: 1.0, accel: 6,
    shadow: [0.42, 0.4], draw: drawLadybug, init: initLadybug,
  },
  lizard: {
    size: [48, 70], speed: [220, 380], palettes: [GREEN, BLUE, YELLOW],
    run: [0.3, 1.2], pause: [0.4, 2.2], kick: 1.5, wobble: 1.0, accel: 16,
    shadow: [0.9, 0.2], draw: drawLizard,
  },
  butterfly: {
    size: [42, 64], speed: [90, 170], palettes: [YELLOW, BLUE, ORANGE],
    run: [1, 3], pause: [0, 0], kick: 1.0, wobble: 2.5, accel: 3, flutter: true,
    shadow: [0.5, 0.5], draw: drawButterfly,
  },
  fish: {
    size: [50, 84], speed: [70, 160], palettes: [ORANGE, YELLOW, BLUE, GREY],
    run: [3, 8], pause: [0.5, 2], kick: 0.9, wobble: 0.6, accel: 2,
    shadow: [0.55, 0.25], draw: drawFish,
  },
  laser: {
    size: [20, 28], speed: [350, 700], palettes: [RED, GREEN, BLUE],
    run: [0.12, 0.6], pause: [0.05, 0.9], kick: Math.PI, wobble: 3, accel: 20,
    shadow: null, draw: drawLaser,
  },
};

function colours(p) {
  const h = rand(...p.h), s = rand(...p.s), l = rand(...p.l);
  const c = (dl) => `hsl(${h % 360}, ${s}%, ${clamp(l + dl, 5, 95)}%)`;
  return { body: c(0), dark: c(-24), light: c(18) };
}

// Makes a creature just outside a random edge, heading inward.
export function makeCreature(kind, w, h) {
  const k = KINDS[kind];
  const size = rand(...k.size);
  const m = size * 2;
  const edge = Math.floor(Math.random() * 4);
  const x = edge === 1 ? w + m : edge === 3 ? -m : rand(0, w);
  const y = edge === 0 ? -m : edge === 2 ? h + m : rand(0, h);
  const tx = rand(w * 0.2, w * 0.8), ty = rand(h * 0.2, h * 0.8);
  const c = {
    kind, k, x, y, size,
    angle: Math.atan2(ty - y, tx - x),
    base: rand(...k.speed),
    speed: 0,
    col: colours(pick(k.palettes)),
    phase: rand(0, TAU),
    seed: rand(0, TAU),
    state: 'run',
    stateTimer: rand(...k.run),
    turnRate: 0,
    flee: 0,
    // Some creatures only peek in and back out.
    life: Math.random() < 0.15 ? rand(0.8, 1.6) : rand(8, 25),
    age: 0,
    z: 0,
    entered: false,
    leaving: false,
    dying: -1,
  };
  c.speed = c.base;
  k.init?.(c);
  return c;
}

function turnToward(c, target, maxStep) {
  const d = Math.atan2(Math.sin(target - c.angle), Math.cos(target - c.angle));
  c.angle += clamp(d, -maxStep, maxStep);
}

function exitAngle(c, w, h) {
  const d = [c.x, w - c.x, c.y, h - c.y];
  const i = d.indexOf(Math.min(...d));
  return [Math.PI, 0, -Math.PI / 2, Math.PI / 2][i];
}

// Advances one creature. Returns false when it is gone.
export function updateCreature(c, dt, w, h) {
  c.age += dt;
  if (c.dying >= 0) {
    c.dying += dt / 0.35;
    return c.dying < 1;
  }
  const k = c.k;

  c.stateTimer -= dt;
  if (c.stateTimer <= 0) {
    if (c.state === 'run' && k.pause[1] > 0) {
      c.state = 'stop';
      c.stateTimer = rand(...k.pause);
    } else {
      c.state = 'run';
      c.stateTimer = rand(...k.run);
      c.angle += rand(-k.kick, k.kick);
    }
  }
  c.turnRate = clamp(c.turnRate + rand(-1, 1) * k.wobble * dt * 6, -k.wobble, k.wobble);
  if (c.state === 'run') c.angle += c.turnRate * dt;

  let target = c.state === 'run' ? c.base : 0;
  if (k.flutter) {
    target *= 0.7 + 0.5 * Math.sin(c.age * 3 + c.seed);
    c.z = 0.5 + 0.5 * Math.sin(c.age * 2 + c.seed);
  }
  c.speed += (target - c.speed) * Math.min(1, dt * k.accel);

  if (c.x > 0 && c.x < w && c.y > 0 && c.y < h) c.entered = true;
  if (!c.leaving && c.age > c.life) c.leaving = true;

  // Steering. A fleeing creature ignores the edges and may escape off screen.
  if (c.flee > 0) {
    c.flee -= dt;
  } else if (c.leaving) {
    turnToward(c, exitAngle(c, w, h), 4 * dt);
  } else {
    const pad = 70 + c.size;
    const nearEdge = c.x < pad || c.x > w - pad || c.y < pad || c.y > h - pad;
    if (nearEdge) turnToward(c, Math.atan2(h / 2 - c.y, w / 2 - c.x), (c.entered ? 3 : 2) * dt);
  }

  const sp = c.flee > 0 ? Math.max(c.speed, c.base * (1.5 + 2 * c.flee / 0.9)) : c.speed;
  c.x += Math.cos(c.angle) * sp * dt;
  c.y += Math.sin(c.angle) * sp * dt;
  c.phase += dt * (3 + sp * 0.06);
  c.moving = sp / c.base;

  const m = c.size * 3;
  const outside = c.x < -m || c.x > w + m || c.y < -m || c.y > h + m;
  return !((c.entered || c.leaving) && outside);
}

// Makes the creature dart away from a touch at (tx, ty).
export function scare(c, tx, ty) {
  c.flee = 0.9;
  c.state = 'run';
  c.stateTimer = rand(...c.k.run) + 0.9;
  c.angle = Math.atan2(c.y - ty, c.x - tx) + rand(-0.4, 0.4);
}

export function hitRadius(c) {
  return c.size * 0.6 + 30;
}

export function drawCreature(ctx, c, glow) {
  const k = c.k, s = c.size;
  const p = Math.max(0, c.dying);
  ctx.save();
  ctx.globalAlpha = 1 - p;

  if (k.shadow) {
    const off = 3 + c.z * 18;
    ctx.save();
    ctx.translate(c.x + off, c.y + off * 1.3);
    ctx.rotate(c.angle);
    ctx.fillStyle = `rgba(0,0,0,${0.28 - c.z * 0.12})`;
    ellipse(ctx, 0, 0, s * k.shadow[0], s * k.shadow[1]);
    ctx.restore();
  }

  ctx.translate(c.x, c.y);
  if (glow > 0) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.4);
    g.addColorStop(0, c.col.light);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (1 - p) * 0.45 * glow;
    ctx.fillStyle = g;
    circle(ctx, 0, 0, s * 1.4);
    ctx.restore();
  }
  ctx.rotate(c.angle);
  if (p > 0) ctx.scale(1 + p * 0.7, 1 - p * 0.7);
  k.draw(ctx, c, s);
  ctx.restore();
}

function ellipse(ctx, x, y, rx, ry, fill) {
  if (fill) ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
}

function circle(ctx, x, y, r, fill) {
  if (fill) ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// All shapes face +x. `s` is the creature size in CSS pixels.

function drawMouse(ctx, c, s) {
  const run = clamp(c.moving, 0, 1.5);
  ctx.lineCap = 'round';
  ctx.strokeStyle = c.col.dark;
  ctx.lineWidth = s * 0.08;
  const sw = Math.sin(c.phase * 2) * s * 0.3 * (0.3 + run);
  ctx.beginPath();
  ctx.moveTo(-s * 0.5, 0);
  ctx.bezierCurveTo(-s * 0.9, sw, -s * 1.2, -sw, -s * 1.6, sw * 0.5);
  ctx.stroke();
  // Feet show when it runs.
  if (run > 0.1) {
    ctx.fillStyle = c.col.dark;
    for (const [fx, side] of [[0.25, 1], [-0.3, 1], [0.25, -1], [-0.3, -1]]) {
      const o = Math.sin(c.phase * 4 + fx * 10 + (side > 0 ? 0 : Math.PI)) * s * 0.1;
      circle(ctx, s * fx + o, side * s * 0.3, s * 0.06);
    }
  }
  ellipse(ctx, 0, 0, s * 0.55, s * 0.32, c.col.body);
  ellipse(ctx, s * 0.45, 0, s * 0.28, s * 0.22, c.col.body);
  circle(ctx, s * 0.32, -s * 0.2, s * 0.14, c.col.light);
  circle(ctx, s * 0.32, s * 0.2, s * 0.14, c.col.light);
  circle(ctx, s * 0.72, 0, s * 0.05, '#f6a');
  circle(ctx, s * 0.55, -s * 0.1, s * 0.04, '#111');
  circle(ctx, s * 0.55, s * 0.1, s * 0.04, '#111');
  // Whiskers.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  for (const side of [-1, 1]) {
    line(ctx, s * 0.68, side * s * 0.04, s * 0.85, side * s * 0.22);
    line(ctx, s * 0.68, side * s * 0.04, s * 0.9, side * s * 0.1);
  }
}

function drawLegs(ctx, c, s, reach) {
  ctx.strokeStyle = '#151515';
  ctx.lineWidth = s * 0.06;
  ctx.lineCap = 'round';
  const run = clamp(c.moving, 0, 1.5);
  for (const i of [-1, 0, 1]) {
    for (const side of [-1, 1]) {
      const swing = Math.sin(c.phase * 3 + i * 2 + (side > 0 ? Math.PI : 0)) * s * 0.12 * run;
      line(ctx, i * s * 0.22, side * s * 0.15, i * s * 0.3 + swing, side * s * reach);
    }
  }
}

function drawBeetle(ctx, c, s) {
  drawLegs(ctx, c, s, 0.5);
  ctx.strokeStyle = '#151515';
  ctx.lineWidth = s * 0.04;
  for (const side of [-1, 1]) line(ctx, s * 0.45, side * s * 0.06, s * 0.75, side * s * 0.25);
  circle(ctx, s * 0.38, 0, s * 0.15, '#1d1d1d');
  ellipse(ctx, 0, 0, s * 0.42, s * 0.3, c.col.body);
  ctx.strokeStyle = c.col.dark;
  ctx.lineWidth = s * 0.04;
  line(ctx, -s * 0.4, 0, s * 0.22, 0);
  ctx.globalAlpha *= 0.5;
  ellipse(ctx, s * 0.05, -s * 0.12, s * 0.18, s * 0.06, c.col.light);
}

function initLadybug(c) {
  c.spots = [];
  const n = 2 + Math.floor(Math.random() * 6);
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), r = rand(0.08, 0.26);
    c.spots.push({ x: Math.cos(a) * r - 0.03, y: Math.sin(a) * r, r: rand(0.04, 0.08) });
  }
}

function drawLadybug(ctx, c, s) {
  drawLegs(ctx, c, s, 0.42);
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(s * 0.3, 0, s * 0.17, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
  circle(ctx, s * 0.38, -s * 0.08, s * 0.035, '#eee');
  circle(ctx, s * 0.38, s * 0.08, s * 0.035, '#eee');
  circle(ctx, -s * 0.03, 0, s * 0.36, c.col.body);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = s * 0.035;
  line(ctx, -s * 0.39, 0, s * 0.3, 0);
  ctx.fillStyle = '#111';
  for (const sp of c.spots) circle(ctx, sp.x * s, sp.y * s, sp.r * s);
  ctx.globalAlpha *= 0.4;
  ellipse(ctx, s * 0.05, -s * 0.16, s * 0.12, s * 0.05, '#fff');
}

function drawLizard(ctx, c, s) {
  const run = clamp(c.moving, 0, 1.5);
  const n = 12, len = s * 1.7;
  const amp = s * 0.16 * (0.25 + run);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    pts.push([s * 0.5 - i * (len / n), Math.sin(c.phase * 2 - i * 0.7) * amp * (i / n + 0.15)]);
  }
  // Legs at the shoulder and the hip.
  ctx.strokeStyle = c.col.dark;
  ctx.lineCap = 'round';
  ctx.lineWidth = s * 0.07;
  for (const [i, ph] of [[2, 0], [5, Math.PI]]) {
    const [px, py] = pts[i];
    for (const side of [-1, 1]) {
      const sw = Math.sin(c.phase * 2 + ph + (side > 0 ? Math.PI : 0)) * s * 0.18 * run;
      line(ctx, px, py, px + sw + s * 0.08, py + side * s * 0.3);
    }
  }
  ctx.fillStyle = c.col.body;
  for (let i = n; i >= 0; i--) {
    const r = s * 0.15 * (1 - (i / n) * 0.85);
    circle(ctx, pts[i][0], pts[i][1], r);
  }
  ellipse(ctx, s * 0.62, pts[0][1], s * 0.18, s * 0.13);
  ctx.globalAlpha *= 0.6;
  ctx.fillStyle = c.col.light;
  for (let i = 1; i < 7; i += 2) circle(ctx, pts[i][0], pts[i][1], s * 0.04);
  ctx.globalAlpha /= 0.6;
  circle(ctx, s * 0.68, pts[0][1] - s * 0.08, s * 0.035, '#111');
  circle(ctx, s * 0.68, pts[0][1] + s * 0.08, s * 0.035, '#111');
}

function drawButterfly(ctx, c, s) {
  // Seen from above, the wings narrow as they rise.
  const f = 0.15 + 0.85 * Math.abs(Math.sin(c.age * 13 + c.seed));
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(1, f);
    ellipse(ctx, s * 0.08, side * s * 0.36, s * 0.28, s * 0.34, c.col.body);
    ellipse(ctx, -s * 0.18, side * s * 0.28, s * 0.2, s * 0.26, c.col.light);
    circle(ctx, s * 0.12, side * s * 0.42, s * 0.08, c.col.dark);
    ctx.restore();
  }
  ellipse(ctx, 0, 0, s * 0.3, s * 0.06, '#222');
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1.5;
  for (const side of [-1, 1]) line(ctx, s * 0.28, 0, s * 0.5, side * s * 0.15);
}

function drawFish(ctx, c, s) {
  const sw = Math.sin(c.phase * 1.5) * 0.5;
  ctx.save();
  ctx.translate(-s * 0.48, 0);
  ctx.rotate(sw);
  ctx.fillStyle = c.col.light;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-s * 0.35, -s * 0.22);
  ctx.lineTo(-s * 0.28, 0);
  ctx.lineTo(-s * 0.35, s * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(s * 0.15, side * s * 0.16);
    ctx.rotate(side * (0.6 + sw * 0.5));
    ellipse(ctx, -s * 0.08, 0, s * 0.12, s * 0.05, c.col.light);
    ctx.restore();
  }
  ellipse(ctx, 0, 0, s * 0.55, s * 0.2, c.col.body);
  ctx.globalAlpha *= 0.5;
  ellipse(ctx, -s * 0.05, 0, s * 0.3, s * 0.06, c.col.dark);
  ctx.globalAlpha /= 0.5;
  circle(ctx, s * 0.38, -s * 0.09, s * 0.04, '#111');
  circle(ctx, s * 0.38, s * 0.09, s * 0.04, '#111');
}

function drawLaser(ctx, c, s) {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.25, c.col.light);
  g.addColorStop(0.5, c.col.body);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  circle(ctx, 0, 0, s);
}
