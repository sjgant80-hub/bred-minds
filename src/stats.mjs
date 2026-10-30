// src/stats.mjs — how sure a rate or a difference is, as organ 1's seal judges them: the Wilson score interval at
// z = 1.96 for a rate, and a bootstrap lower bound for a difference of two means (each group resampled on its own, the
// 2.5th percentile of the differences). Pure, seeded, total: nonsense gives null.
import { rng, draw } from '../vendor/seed-library/seedlib.mjs';

export const Z = 1.96;

/** the Wilson interval of k successes in n: { rate, low, high }; null when n is not a whole number above 0 or k is outside 0…n */
export function wilson(k, n, z = Z) {
  if (!Number.isInteger(n) || n < 1 || !Number.isInteger(k) || k < 0 || k > n) return null;
  const p = k / n, z2 = z * z, mid = (p + z2 / (2 * n)) / (1 + z2 / n), half = (z / (1 + z2 / n)) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return { rate: p, low: Math.max(0, mid - half), high: Math.min(1, mid + half) };
}

const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** the 95% lower bound of mean(a) − mean(b): each group resampled with replacement, n times, seeded */
export function diffLow(a, b, n = 2000, seed = 99) {
  if (!Array.isArray(a) || !Array.isArray(b) || !a.length || !b.length || ![...a, ...b].every(Number.isFinite) || !(Number.isInteger(n) && n > 0)) return null;
  const r = rng(seed), d = Array.from({ length: n }, () => mean(a.map(() => a[draw(r, a.length)])) - mean(b.map(() => b[draw(r, b.length)])));
  d.sort((x, y) => x - y);
  return d[Math.floor(0.025 * n)];
}
