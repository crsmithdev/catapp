import { rand, weighted } from './util.js';
import { makeCreature, updateCreature, drawCreature, scare, hitRadius } from './creatures.js';
import { SCENES } from './scenes.js';
import { Effects } from './effects.js';
import { Sound } from './audio.js';

const FADE = 6;
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

// The one global: the game state. Tests read it and call game.step().
const game = (window.game = {
  w: 0, h: 0, dpr: 1, t: 0,
  creatures: [],
  effects: new Effects(),
  sound: new Sound(),
  scene: Math.floor(Math.random() * SCENES.length),
  next: -1,
  fade: 0,
  sceneTimer: rand(180, 360),
  backdrops: new Map(),
  target: 2,
  targetTimer: rand(20, 60),
  spawnTimer: 0,
  step,
});

function backdrop(i) {
  if (!game.backdrops.has(i)) {
    const c = document.createElement('canvas');
    c.width = Math.round(game.w * game.dpr);
    c.height = Math.round(game.h * game.dpr);
    const g = c.getContext('2d');
    g.scale(game.dpr, game.dpr);
    SCENES[i].paint(g, game.w, game.h);
    game.backdrops.set(i, c);
  }
  return game.backdrops.get(i);
}

function resize() {
  game.dpr = Math.min(window.devicePixelRatio || 1, 2);
  game.w = window.innerWidth;
  game.h = window.innerHeight;
  canvas.width = Math.round(game.w * game.dpr);
  canvas.height = Math.round(game.h * game.dpr);
  game.backdrops.clear();
}

function step(dt) {
  game.t += dt;
  const { w, h } = game;

  game.sceneTimer -= dt;
  if (game.next < 0 && game.sceneTimer <= 0) {
    do game.next = Math.floor(Math.random() * SCENES.length); while (game.next === game.scene);
    game.fade = 0;
  }
  if (game.next >= 0) {
    game.fade += dt / FADE;
    if (game.fade >= 1) {
      game.backdrops.delete(game.scene);
      game.scene = game.next;
      game.next = -1;
      game.fade = 0;
      game.sceneTimer = rand(180, 360);
    }
  }

  // The number of creatures drifts, so the pace changes.
  game.targetTimer -= dt;
  if (game.targetTimer <= 0) {
    game.target = 1 + Math.floor(Math.random() * 4);
    game.targetTimer = rand(20, 60);
  }

  game.spawnTimer -= dt;
  const alive = game.creatures.filter((c) => c.dying < 0).length;
  if (alive < game.target && game.spawnTimer <= 0) {
    const mix = SCENES[game.next >= 0 ? game.next : game.scene].mix;
    game.creatures.push(makeCreature(weighted(mix), w, h));
    game.spawnTimer = rand(0.5, 2.5);
  }

  game.creatures = game.creatures.filter((c) => updateCreature(c, dt, w, h));
  game.effects.update(dt);
}

function draw() {
  const { w, h } = game;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(backdrop(game.scene), 0, 0);
  if (game.next >= 0) {
    ctx.globalAlpha = game.fade;
    ctx.drawImage(backdrop(game.next), 0, 0);
    ctx.globalAlpha = 1;
  }
  ctx.setTransform(game.dpr, 0, 0, game.dpr, 0, 0);

  const cur = SCENES[game.scene];
  const nxt = game.next >= 0 ? SCENES[game.next] : null;
  if (cur.overlay) {
    ctx.globalAlpha = nxt ? 1 - game.fade : 1;
    cur.overlay(ctx, w, h, game.t);
  }
  if (nxt?.overlay) {
    ctx.globalAlpha = game.fade;
    nxt.overlay(ctx, w, h, game.t);
  }
  ctx.globalAlpha = 1;

  const glow = nxt ? (cur.glow || 0) * (1 - game.fade) + (nxt.glow || 0) * game.fade : cur.glow || 0;
  for (const c of game.creatures) drawCreature(ctx, c, glow);
  game.effects.draw(ctx);
}

// A touch kills the nearest creature in reach. Otherwise it scares the creatures nearby.
function touch(x, y) {
  let best = null, bestD = Infinity;
  for (const c of game.creatures) {
    if (c.dying >= 0) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < hitRadius(c) && d < bestD) {
      best = c;
      bestD = d;
    }
  }
  if (best) {
    best.dying = 0;
    game.effects.burst(best.x, best.y, [best.col.body, best.col.light, '#fff']);
    game.sound.squeak();
    game.spawnTimer = Math.max(game.spawnTimer, rand(1, 3));
    return true;
  }
  let scared = false;
  for (const c of game.creatures) {
    if (c.dying >= 0) continue;
    if (Math.hypot(c.x - x, c.y - y) < hitRadius(c) * 3) {
      scare(c, x, y);
      scared = true;
    }
  }
  game.effects.ripple(x, y);
  if (scared) game.sound.scuttle();
  else game.sound.plip();
  return false;
}

// A paw that slides across the glass can still catch a creature, but makes no ripples.
function swipe(x, y) {
  for (const c of game.creatures) {
    if (c.dying < 0 && Math.hypot(c.x - x, c.y - y) < hitRadius(c)) {
      touch(c.x, c.y);
      return;
    }
  }
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  game.sound.unlock();
  touch(e.clientX, e.clientY);
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse' && !e.buttons) return;
  swipe(e.clientX, e.clientY);
});
for (const type of ['touchstart', 'touchmove', 'touchend', 'gesturestart', 'gesturechange', 'contextmenu', 'dblclick']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}
window.addEventListener('resize', resize);

let last = performance.now();
function frame(now) {
  step(Math.min(0.05, (now - last) / 1000));
  last = now;
  draw();
  requestAnimationFrame(frame);
}

resize();
requestAnimationFrame(frame);
