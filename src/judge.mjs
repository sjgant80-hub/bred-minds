// src/judge.mjs — reading the cold judge's replies, as organ 1's seal says: a line is read when it names all seven labels
// with whole numbers; numbers that do not add up to 100 are scaled to it; an unreadable or missing line is a miss. A
// passage is recognised as mind m only if m's number is strictly greater than every other label's, none included.
// Pure and total.
export const LABELS = Object.freeze(['marcus', 'montaigne', 'emerson', 'james', 'nietzsche', 'thoreau', 'none']);

/** one reply line → { n, p: { label: number } } or null */
export function readLine(line) {
  const m = /^\s*(\d+)\s*[:.)]\s*(.*)$/.exec(String(line ?? ''));
  if (!m) return null;
  const p = {};
  for (const l of LABELS) {
    const v = new RegExp('\\b' + l + '\\b\\s*[:=]?\\s*(\\d+)', 'i').exec(m[2]);
    if (!v) return null;
    p[l] = Number(v[1]);
  }
  const sum = LABELS.reduce((s, l) => s + p[l], 0);
  if (!(sum > 0)) return null;
  if (sum !== 100) for (const l of LABELS) p[l] = (p[l] * 100) / sum;
  return { n: Number(m[1]), p };
}

/** a batch reply → the reading of passages 1 … size, null where a line is missing or unreadable */
export function readReply(reply, size) {
  const got = new Map();
  for (const line of String(reply ?? '').split(/\r?\n/)) { const r = readLine(line); if (r && !got.has(r.n)) got.set(r.n, r.p); }
  return Array.from({ length: Number.isInteger(size) ? size : 0 }, (_, k) => got.get(k + 1) ?? null);   // a negative length is no passages
}

/** whether a reading recognises mind m: m's number strictly greater than every other label's */
export const recognises = (p, m) => !!p && LABELS.includes(m) && m !== 'none' && LABELS.every((l) => l === m || p[m] > p[l]);
