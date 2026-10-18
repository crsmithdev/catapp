import { TAU, rand } from './util.js';

// Each scene paints a static background once per resize, and may draw a live overlay.
// `mix` gives the spawn weight of each creature kind. `glow` lights creatures up.
export const SCENES = [
  {
    name: 'grass',
    mix: { mouse: 3, beetle: 2, ladybug: 2, lizard: 2, butterfly: 2, laser: 1 },
    paint(g, w, h) {
      g.fillStyle = '#26401d';
      g.fillRect(0, 0, w, h);
      patches(g, w, h, 'rgba(10,25,5,0.35)', 'rgba(70,100,30,0.2)');
      blades(g, w, h, 95, 125, 35, 50, 14, 30);
      vignette(g, w, h, 0.45);
    },
  },
  {
    name: 'wood',
    mix: { mouse: 3, beetle: 2, ladybug: 1, lizard: 1, laser: 3 },
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
    name: 'pond',
    mix: { fish: 6, butterfly: 2 },
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
    name: 'night',
    glow: 1,
    mix: { mouse: 2, beetle: 1, butterfly: 2, lizard: 1, laser: 3 },
    paint(g, w, h) {
      g.fillStyle = '#0a0f1f';
      g.fillRect(0, 0, w, h);
      blades(g, w, h, 210, 235, 20, 35, 8, 16);
      vignette(g, w, h, 0.6);
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
