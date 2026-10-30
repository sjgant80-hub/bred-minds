// src/breed.mjs — organ 2's breeding, as its seal says: the pairs of minds; the candidates in the local model's reply; the
// child's gate (6 to 40 words, Latin script only, no blocked word, at least 2 content words shared with the parents'
// maxims, and no copy of any one parent maxim); the child card (the first 12 kept, the first voice sample of each parent)
// and the naive cross (six maxims from each parent, alternating); what a judge's numbers carry, how evenly, and the trace
// model's pair. A card is canonical JSON; its id is the SHA-256 of that JSON. Pure (but for the hash) and total.
import { words, content, blockedIn } from './text.mjs';
import { clean, canonical, KEEP, MIN_KEPT, MIN_WORDS, MAX_WORDS, SHARED } from './card.mjs';
import { sha256Hex } from '../vendor/seed-library/sha256.mjs';

export const CANDIDATES = 16, COPY = 0.75, CROSS_EACH = 6;
export const THINKERS = Object.freeze(['marcus', 'montaigne', 'emerson', 'james', 'nietzsche', 'thoreau']);

/** the pairs of minds in order: [first, second] for every i < j */
export function pairs(minds) {
  const ms = Array.isArray(minds) ? minds : [];
  return ms.flatMap((a, i) => ms.slice(i + 1).map((b) => [a, b]));
}

/** the candidates in a reply: each line that begins with a whole number, '.' or ')' and a space, in order, the first 16 */
export function candidates(reply) {
  const out = [];
  for (const line of String(reply ?? '').split(/\r?\n/)) { const m = /^\s*\d+[.)] (.*)$/.exec(line); if (m) out.push(clean(m[1])); }
  return out.slice(0, CANDIDATES);
}

/** whether every letter in a text is Latin script */
export const latin = (s) => !/(?!\p{Script=Latin})\p{L}/u.test(String(s ?? ''));

const maximsOf = (c) => (c && Array.isArray(c.maxims) ? c.maxims.map((m) => (m && typeof m === 'object' ? m.maxim : m)).filter((m) => typeof m === 'string') : []);
const pooled = (ms) => new Set(ms.flatMap((m) => [...content(m)]));

/** the child's gate, given the two parents' maxims: → { ok, why, both } (both: it shares 2 content words with each parent) */
export function childGate(maxim, first, second, blocked) {
  const n = words(maxim).length, c = content(maxim), A = Array.isArray(first) ? first : [], B = Array.isArray(second) ? second : [];
  const shared = (set) => [...c].filter((w) => set.has(w)).length;
  if (n < MIN_WORDS || n > MAX_WORDS) return { ok: false, why: n + ' words, not ' + MIN_WORDS + ' to ' + MAX_WORDS, both: false };
  if (!latin(maxim)) return { ok: false, why: 'a letter outside Latin script', both: false };
  if (blockedIn(maxim, blocked)) return { ok: false, why: 'it names a blocked word', both: false };
  const a = shared(pooled(A)), b = shared(pooled(B)), all = shared(pooled([...A, ...B]));
  if (all < SHARED) return { ok: false, why: all + ' content word' + (all === 1 ? '' : 's') + ' shared with the parents, not ' + SHARED, both: false };
  if ([...A, ...B].some((p) => shared(content(p)) >= COPY * c.size)) return { ok: false, why: 'a copy of a parent maxim', both: false };
  return { ok: true, why: 'kept', both: a >= SHARED && b >= SHARED };
}

const voiceOf = (first, second) => [first, second].map((c) => (c && Array.isArray(c.voice) && typeof c.voice[0] === 'string' ? c.voice[0] : ''));

/** breed a child from the local model's reply: → { grown, card, id, steps } (card null when fewer than 8 are kept) */
export function breed(pair, first, second, reply, blocked) {
  const A = maximsOf(first), B = maximsOf(second);
  const steps = candidates(reply).map((maxim) => ({ maxim, ...childGate(maxim, A, B, blocked) }));
  const kept = steps.filter((s) => s.ok).slice(0, KEEP);
  if (kept.length < MIN_KEPT) return { grown: false, card: null, id: null, steps };
  const card = { kind: 'child', pair: [...pair], maxims: kept.map((s) => ({ maxim: s.maxim })), voice: voiceOf(first, second) };
  return { grown: true, card, id: sha256Hex(canonical(card)), steps };
}

/** the naive cross: maxims 1 to 6 of each parent, alternating, with the child's voice */
export function cross(pair, first, second) {
  const A = maximsOf(first), B = maximsOf(second), maxims = [];
  for (let i = 0; i < CROSS_EACH; i++) for (const m of [A[i], B[i]]) if (m !== undefined) maxims.push({ maxim: m });
  const card = { kind: 'cross', pair: [...pair], maxims, voice: voiceOf(first, second) };
  return { card, id: sha256Hex(canonical(card)) };
}

const ok2 = (a, b) => a !== b && THINKERS.includes(a) && THINKERS.includes(b);

/** whether a reading carries the pair: a's and b's numbers each strictly greater than each other thinker's ('none' aside) */
export const carries = (p, a, b) => !!p && ok2(a, b) && THINKERS.every((l) => l === a || l === b || (p[a] > p[l] && p[b] > p[l]));

/** how evenly a reading carries the pair: the smaller number over their sum (0 when the sum is 0 or the reading is missing) */
export function balance(p, a, b) {
  if (!p || !ok2(a, b)) return 0;
  const x = Number.isFinite(p[a]) ? Math.max(0, p[a]) : 0, y = Number.isFinite(p[b]) ? Math.max(0, p[b]) : 0;
  return x + y > 0 ? Math.min(x, y) / (x + y) : 0;
}

/** the trace model's pair: the minds of the two highest scores, a tie to the earlier mind; null if it cannot name two */
export function topTwo(scores, minds) {
  if (!Array.isArray(scores) || !Array.isArray(minds) || scores.length !== minds.length || scores.length < 2) return null;
  const best = (skip) => scores.reduce((b, v, k) => (k !== skip && (b < 0 || v > scores[b]) ? k : b), -1), i = best(-1);
  return [minds[i], minds[best(i)]];
}

/** whether a named pair is the pair (a, b), in either order */
export const samePair = (t, a, b) => Array.isArray(t) && ok2(a, b) && ((t[0] === a && t[1] === b) || (t[0] === b && t[1] === a));

/** a single answer's control value: the share of the pairs that contain its mind that it carries (isCarried(a, b)) */
export function control(mind, ps, isCarried) {
  const mine = (Array.isArray(ps) ? ps : []).filter((p) => Array.isArray(p) && (p[0] === mind || p[1] === mind));
  return mine.length && typeof isCarried === 'function' ? mine.filter(([a, b]) => isCarried(a, b)).length / mine.length : 0;
}
