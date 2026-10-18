import { TAU, rand, pick } from './util.js';

// The app shows the scenes in this order and then starts again.
// Each scene paints a static background once per resize, and may draw a live overlay.
// `mix` gives the spawn weight of each creature kind. `glow` lights creatures up.
export const SCENES = [
  {
    name: 'kitchen',
    mix: { mouse: 1 },
    paint(g, w, h) {
      let y = 0;
      while (y < h) {
        const ph = rand(90, 130);
        let x = -rand(0, 300);
        while (x < w) {
          const pw = rand(280, 600);
          g.fillStyle = `hsl(${rand(24, 32)}, ${rand(30, 42)}%, ${rand(20, 28)}%)`;
          g.fillRect(x, y, pw, ph);
          g.strokeStyle = 'rgba(0,0,0,0.15)';
          g.lineWidth = 1;
          for (let i = 0; i < 9; i++) {
            const gy = y + rand(4, ph - 4), a = rand(1, 4), f = rand(0.005, 0.02), o = rand(0, TAU);
            g.beginPath();
            for (let gx = x; gx <= x + pw; gx += 12) g.lineTo(gx, gy + Math.sin(gx * f + o) * a);
            g.stroke();
          }
          g.fillStyle = 'rgba(0,0,0,0.5)';
          g.fillRect(x, y, 2, ph);
          x += pw;
        }
        g.fillStyle = 'rgba(0,0,0,0.5)';
        g.fillRect(0, y, w, 2);
        y += ph;
      }
      vignette(g, w, h, 0.55);
    },
  },
  {
    name: 'meadow',
    mix: { butterfly: 2, ladybug: 1 },
    paint(g, w, h) {
      g.fillStyle = '#26401d';
      g.fillRect(0, 0, w, h);
      patches(g, w, h, 'rgba(10,25,5,0.35)', 'rgba(70,100,30,0.2)');
      blades(g, w, h, 95, 125, 35, 50, 14, 30);
      // Small flowers in clumps.
      for (let i = 0; i < (w * h) / 40000; i++) {
        const cx = rand(0, w), cy = rand(0, h), colour = pick(['#f4f0f8', '#e7a6d4', '#b49ae8']);
        for (let j = 0; j < 6; j++) {
          const x = cx + rand(-40, 40), y = cy + rand(-40, 40), r = rand(3, 5);
          g.fillStyle = colour;
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * TAU;
            g.beginPath();
            g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.7, 0, TAU);
            g.fill();
          }
          g.fillStyle = '#e8c33a';
          g.beginPath();
          g.arc(x, y, r * 0.5, 0, TAU);
          g.fill();
        }
      }
      vignette(g, w, h, 0.45);
    },
  },
  {
    name: 'desert',
    mix: { lizard: 2, beetle: 1 },
    paint(g, w, h) {
      g.fillStyle = '#6b4630';
      g.fillRect(0, 0, w, h);
      patches(g, w, h, 'rgba(60,30,15,0.3)', 'rgba(160,110,70,0.18)');
      for (let i = 0; i < (w * h) / 60; i++) {
        g.fillStyle = `hsla(${rand(18, 35)}, ${rand(25, 45)}%, ${rand(25, 55)}%, 0.5)`;
        g.fillRect(rand(0, w), rand(0, h), rand(1, 2.5), rand(1, 2.5));
      }
      // Flat rocks in the corners and along the edges.
      for (let i = 0; i < 9; i++) {
        const x = Math.random() < 0.5 ? rand(0, w * 0.18) : rand(w * 0.82, w);
        const y = rand(0, h), rx = rand(40, 110), ry = rx * rand(0.5, 0.8), a = rand(0, TAU);
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.beginPath();
        g.ellipse(x + 8, y + 10, rx, ry, a, 0, TAU);
        g.fill();
        g.fillStyle = `hsl(${rand(20, 35)}, ${rand(8, 18)}%, ${rand(36, 46)}%)`;
        g.beginPath();
        g.ellipse(x, y, rx, ry, a, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.beginPath();
        g.ellipse(x - rx * 0.2, y - ry * 0.25, rx * 0.6, ry * 0.45, a, 0, TAU);
        g.fill();
      }
      vignette(g, w, h, 0.5);
    },
  },
  {
    name: 'pond',
    mix: { fish: 1 },
    paint(g, w, h) {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) / 2);
      gr.addColorStop(0, '#0f4253');
      gr.addColorStop(1, '#061c26');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < (w * h) / 4000; i++) {
        g.fillStyle = `hsla(${rand(180, 210)}, 20%, ${rand(15, 35)}%, 0.25)`;
        g.beginPath();
        g.ellipse(rand(0, w), rand(0, h), rand(3, 12), rand(2, 8), rand(0, TAU), 0, TAU);
        g.fill();
      }
      // Lily pads keep to the edges, out of the fish's way.
      for (let i = 0; i < 7; i++) {
        const edge = Math.random() < 0.5;
        const px = edge ? (Math.random() < 0.5 ? rand(0, w * 0.15) : rand(w * 0.85, w)) : rand(0, w);
        const py = edge ? rand(0, h) : (Math.random() < 0.5 ? rand(0, h * 0.15) : rand(h * 0.85, h));
        const r = rand(35, 70), a = rand(0, TAU);
        g.fillStyle = `hsl(${rand(95, 125)}, 45%, ${rand(22, 32)}%)`;
        g.beginPath();
        g.moveTo(px, py);
        g.arc(px, py, r, a + 0.35, a + TAU - 0.35);
        g.closePath();
        g.fill();
      }
      vignette(g, w, h, 0.5);
    },
    // Soft light patches drift across the water.
    overlay(ctx, w, h, t) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const x = w * (0.5 + 0.45 * Math.sin(t * 0.05 + i * 1.7));
        const y = h * (0.5 + 0.45 * Math.cos(t * 0.04 + i * 2.3));
        const r = Math.min(w, h) * 0.35;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(120,200,220,0.07)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      ctx.restore();
    },
  },
  {
    name: 'living room at night',
    glow: 1,
    mix: { laser: 1 },
    paint(g, w, h) {
      g.fillStyle = '#0d1022';
      g.fillRect(0, 0, w, h);
      // Carpet pile.
      for (let i = 0; i < (w * h) / 40; i++) {
        g.fillStyle = `hsla(${rand(225, 250)}, ${rand(15, 30)}%, ${rand(8, 18)}%, 0.6)`;
        g.fillRect(rand(0, w), rand(0, h), 1.5, 1.5);
      }
      vignette(g, w, h, 0.65);
    },
  },
];

function patches(g, w, h, dark, light) {
  for (let i = 0; i < 14; i++) {
    const x = rand(0, w), y = rand(0, h), r = rand(100, 300);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, i % 2 ? dark : light);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function blades(g, w, h, h0, h1, s0, s1, l0, l1) {
  g.lineCap = 'round';
  g.lineWidth = 2;
  for (let i = 0; i < (w * h) / 160; i++) {
    const x = rand(0, w), y = rand(0, h), a = rand(0, TAU), len = rand(5, 14);
    g.strokeStyle = `hsl(${rand(h0, h1)}, ${rand(s0, s1)}%, ${rand(l0, l1)}%)`;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
}

function vignette(g, w, h, strength) {
  const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) / 2);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(1, `rgba(0,0,0,${strength})`);
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
}
