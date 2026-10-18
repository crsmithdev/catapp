// Settings. To add one, add a field here and read `settings.<key>` where it applies.
// A field with `group` starts a new heading in the panel.
const FIELDS = [
  { group: 'Scenes' },
  { key: 'rotation', label: 'Scene change every', min: 0.5, max: 10, step: 0.5, value: 2, format: (v) => `${v} min` },
  { group: 'Creatures' },
  { key: 'count', label: 'Creatures on screen', min: 1, max: 8, step: 1, value: 3, format: (v) => `${v}` },
  { key: 'speed', label: 'Creature speed', min: 0.3, max: 2, step: 0.1, value: 1, format: (v) => `${v.toFixed(1)}×` },
  { key: 'speedVariety', label: 'Speed variation', min: 0, max: 0.8, step: 0.05, value: 0.3, format: (v) => `±${Math.round(v * 100)}%` },
  { key: 'size', label: 'Creature size', min: 0.5, max: 2, step: 0.1, value: 1, format: (v) => `${v.toFixed(1)}×` },
  { group: 'Touch' },
  { key: 'effectSize', label: 'Touch effect size', min: 0.5, max: 2, step: 0.1, value: 1, format: (v) => `${v.toFixed(1)}×` },
  { key: 'flee', label: 'Run away from near touches', min: 0, max: 2, step: 0.1, value: 1, format: (v) => (v ? `${v.toFixed(1)}×` : 'off') },
  { group: 'Sound' },
  { key: 'volume', label: 'Master volume', min: 0, max: 1, step: 0.1, value: 0.7, format: (v) => (v ? `${Math.round(v * 100)}%` : 'off') },
  { key: 'sceneVolume', label: 'Scene sounds', min: 0, max: 1, step: 0.05, value: 0.6, format: (v) => (v ? `${Math.round(v * 100)}%` : 'off') },
  { key: 'creatureVolume', label: 'Creature sounds', min: 0, max: 1, step: 0.05, value: 0.6, format: (v) => (v ? `${Math.round(v * 100)}%` : 'off') },
  { key: 'soundRate', label: 'Sound frequency', min: 0.25, max: 3, step: 0.25, value: 1, format: (v) => `${v}×` },
];

const KEY = 'critters.settings';
const HOLD_MS = 1000;

export const settings = Object.fromEntries(FIELDS.filter((f) => f.key).map((f) => [f.key, f.value]));
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
  for (const f of FIELDS) if (f.key && typeof saved[f.key] === 'number') settings[f.key] = saved[f.key];
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

  // Each group is a section, so a column break never splits one.
  let section = list;
  for (const f of FIELDS) {
    if (f.group) {
      section = document.createElement('section');
      const h = document.createElement('h3');
      h.textContent = f.group;
      section.append(h);
      list.append(section);
      continue;
    }
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
    section.append(row);
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
