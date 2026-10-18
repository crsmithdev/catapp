import { rand, weighted } from './util.js';
import { makeCreature, updateCreature, drawCreature, scare, hitRadius } from './creatures.js';
import { SCENES } from './scenes.js';
import { settings, initSettings } from './settings.js';
import { Effects } from './effects.js';
import { Sound } from './audio.js';
import { Ambience } from './ambient.js';

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
  sceneAge: 0,
  backdrops: new Map(),
  spawnTimer: 0,
  step,
});
game.ambience = new Ambience(game.sound);

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

  // The rotation setting is read at every frame, so a change applies to the current scene.
  game.sceneAge += dt;
  if (game.next < 0 && game.sceneAge >= settings.rotation * 60) {
    game.next = (game.scene + 1) % SCENES.length;
    game.fade = 0;
    game.sceneAge = 0;
    // The old scene's creatures run off, and the new scene's creatures come in.
    for (const c of game.creatures) c.leaving = true;
  }
  if (game.next >= 0) {
    game.fade += dt / FADE;
    if (game.fade >= 1) {
      game.backdrops.delete(game.scene);
      game.scene = game.next;
      game.next = -1;
      game.fade = 0;
    }
  }

  game.spawnTimer -= dt;
  const alive = game.creatures.filter((c) => c.dying < 0 && !c.leaving).length;
  // When the count setting drops, the oldest extra creatures leave.
  let extra = alive - settings.count;
  for (const c of game.creatures) {
    if (extra <= 0) break;
    if (c.dying < 0 && !c.leaving) {
      c.leaving = true;
      extra--;
    }
  }
  if (alive < settings.count && game.spawnTimer <= 0) {
    const mix = SCENES[game.next >= 0 ? game.next : game.scene].mix;
    game.creatures.push(makeCreature(weighted(mix), w, h));
    game.spawnTimer = rand(0.5, 2.5);
  }

  game.creatures = game.creatures.filter((c) => updateCreature(c, dt * settings.speed, w, h));
  game.effects.update(dt);

  const weights = { [SCENES[game.scene].name]: game.next >= 0 ? 1 - game.fade : 1 };
  if (game.next >= 0) weights[SCENES[game.next].name] = game.fade;
  game.ambience.update(dt, weights, game.creatures, w);
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
  // The flee setting scales both the reach of a near touch and the speed of the dash.
  let scared = false;
  for (const c of game.creatures) {
    if (c.dying >= 0 || !settings.flee) continue;
    if (Math.hypot(c.x - x, c.y - y) < hitRadius(c) * (1 + 2 * settings.flee)) {
      scare(c, x, y, settings.flee);
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
// Block zoom, scroll and callouts everywhere except in the settings panel.
for (const type of ['touchstart', 'touchmove', 'touchend', 'gesturestart', 'gesturechange', 'contextmenu', 'dblclick']) {
  document.addEventListener(type, (e) => {
    if (!e.target.closest?.('#panel')) e.preventDefault();
  }, { passive: false });
}
window.addEventListener('resize', resize);
initSettings((key) => {
  if (['volume', 'sceneVolume', 'creatureVolume'].includes(key)) game.sound.setVolume();
});

let last = performance.now();
function frame(now) {
  step(Math.min(0.05, (now - last) / 1000));
  last = now;
  draw();
  requestAnimationFrame(frame);
}

resize();
requestAnimationFrame(frame);
