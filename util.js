export const TAU = Math.PI * 2;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Returns a key of `weights` with probability proportional to its value.
export function weighted(weights) {
  const keys = Object.keys(weights);
  let r = Math.random() * keys.reduce((s, k) => s + weights[k], 0);
  for (const k of keys) {
    r -= weights[k];
    if (r <= 0) return k;
  }
  return keys[keys.length - 1];
}
