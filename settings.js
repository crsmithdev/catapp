// Settings. To add one, add a field here and read `settings.<key>` where it applies.
export const FIELDS = [
  { key: 'rotation', label: 'Scene change every', min: 0.5, max: 10, step: 0.5, value: 2, format: (v) => `${v} min` },
  { key: 'count', label: 'Creatures on screen', min: 1, max: 8, step: 1, value: 3, format: (v) => `${v}` },
  { key: 'speed', label: 'Creature speed', min: 0.3, max: 2, step: 0.1, value: 1, format: (v) => `${v.toFixed(1)}×` },
  { key: 'size', label: 'Creature size', min: 0.5, max: 2, step: 0.1, value: 1, format: (v) => `${v.toFixed(1)}×` },
  { key: 'effectSize', label: 'Touch effect size', min: 0.5, max: 2, step: 0.1, value: 1, format: (v) => `${v.toFixed(1)}×` },
  { key: 'flee', label: 'Run away from near touches', min: 0, max: 2, step: 0.1, value: 1, format: (v) => (v ? `${v.toFixed(1)}×` : 'off') },
  { key: 'volume', label: 'Sound volume', min: 0, max: 1, step: 0.1, value: 0.7, format: (v) => (v ? `${Math.round(v * 100)}%` : 'off') },
];

const KEY = 'critters.settings';
const HOLD_MS = 1000;

export const settings = Object.fromEntries(FIELDS.map((f) => [f.key, f.value]));
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
  for (const f of FIELDS) if (typeof saved[f.key] === 'number') settings[f.key] = saved[f.key];
} catch {}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
}

// Builds the panel and wires the gear. The gear opens the panel only after a hold,
// so a cat's tap does not open it. `onChange(key)` runs after each change.
export function initSettings(onChange) {
  const gear = document.getElementById('gear');
  const panel = document.getElementById('panel');
  const list = panel.querySelector('.fields');

  for (const f of FIELDS) {
    const row = document.createElement('label');
    row.className = 'field';
    row.innerHTML = `<span class="name"></span><output></output><input type="range">`;
    row.querySelector('.name').textContent = f.label;
    const input = row.querySelector('input');
    const out = row.querySelector('output');
    Object.assign(input, { min: f.min, max: f.max, step: f.step, value: settings[f.key] });
    out.textContent = f.format(settings[f.key]);
    input.addEventListener('input', () => {
      settings[f.key] = Number(input.value);
      out.textContent = f.format(settings[f.key]);
      save();
      onChange(f.key);
    });
    list.append(row);
  }

  let timer = 0;
  const cancel = () => {
    clearTimeout(timer);
    gear.classList.remove('holding');
  };
  gear.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    gear.classList.add('holding');
    timer = setTimeout(() => {
      cancel();
      panel.hidden = false;
    }, HOLD_MS);
  });
  for (const type of ['pointerup', 'pointercancel']) gear.addEventListener(type, cancel);
  panel.querySelector('.close').addEventListener('click', () => (panel.hidden = true));
}
