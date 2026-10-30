// src/card.mjs — a mind card, as organ 1's seal grows it: maxims the local model drew from the author's own FIT passages,
// each kept only if it passes the gate (6 to 40 words, at least 2 content words shared with its passage, no blocked
// word), the first 12 kept in draw order, and the first 60 words of the passages behind the first two as its voice. A
// mind with fewer than 8 kept is not grown. A sham card pools every mind's kept maxims and draws 12 at random, with two
// minds' voices. A card is canonical JSON; its id is the SHA-256 of that JSON. Pure (but for the hash) and total.
import { words, content, blockedIn, shuffle } from './text.mjs';
import { sha256Hex } from '../vendor/seed-library/sha256.mjs';

export const KEEP = 12, MIN_KEPT = 8, MIN_WORDS = 6, MAX_WORDS = 40, SHARED = 2, VOICE_WORDS = 60;

/** a text up to the end of its n-th word (all of it when it holds fewer) */
export function firstWords(text, n) {
  const t = String(text ?? ''), last = [...t.matchAll(/\p{L}+(?:['’]\p{L}+)*/gu)][n - 1];
  return last ? t.slice(0, last.index + last[0].length) : t;
}

/** a maxim as the local model replied, trimmed, surrounding quotes removed */
export const clean = (reply) => String(reply ?? '').trim().replace(/^["'“‘]+|["'”’]+$/g, '').trim();

/** the gate: → { ok, why } */
export function gate(maxim, passage, blocked) {
  const n = words(maxim).length;
  if (n < MIN_WORDS || n > MAX_WORDS) return { ok: false, why: n + ' words, not ' + MIN_WORDS + ' to ' + MAX_WORDS };
  const p = content(passage), shared = [...content(maxim)].filter((w) => p.has(w)).length;
  if (shared < SHARED) return { ok: false, why: shared + ' content word' + (shared === 1 ? '' : 's') + ' shared with its passage, not ' + SHARED };
  if (blockedIn(maxim, blocked)) return { ok: false, why: 'it names a blocked word' };
  return { ok: true, why: 'kept' };
}

/** canonical JSON: keys sorted at every level */
export const canonical = (x) => (Array.isArray(x) ? '[' + x.map(canonical).join(',') + ']' : x && typeof x === 'object' ? '{' + Object.keys(x).sort().map((k) => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}' : JSON.stringify(x));

/** grow a card: drawn = [{ index, text }] in draw order, replies = the local model's reply for each, in the same order.
 *  → { grown, card, id, steps } (card null when fewer than MIN_KEPT are kept) */
export function grow(mind, drawn, replies, blocked) {
  const ds = Array.isArray(drawn) ? drawn : [], rs = Array.isArray(replies) ? replies : [];
  const steps = ds.map((d, i) => { const maxim = clean(rs[i]), g = gate(maxim, d && d.text, blocked); return { index: d && d.index, maxim, kept: g.ok, why: g.why }; });
  const kept = steps.map((s, i) => ({ ...s, text: ds[i] && ds[i].text })).filter((s) => s.kept).slice(0, KEEP);
  if (kept.length < MIN_KEPT) return { grown: false, card: null, id: null, steps };
  const voice = kept.slice(0, 2).map((s) => firstWords(s.text, VOICE_WORDS));
  const card = { mind, maxims: kept.map((s) => ({ from: s.index, maxim: s.maxim })), voice };
  return { grown: true, card, id: sha256Hex(canonical(card)), steps };
}

/** a sham card for a label: 12 maxims drawn from every grown card's maxims pooled, the voices of two cards drawn the same way */
export function sham(label, cards, seed) {
  const cs = (Array.isArray(cards) ? cards : []).filter((c) => c && Array.isArray(c.maxims) && Array.isArray(c.voice));
  const pool = cs.flatMap((c) => c.maxims.map((m) => m.maxim)), voices = shuffle(cs, seed).slice(0, 2).map((c) => c.voice[0]);
  const card = { mind: label, sham: true, maxims: shuffle(pool, seed).slice(0, KEEP).map((maxim) => ({ from: null, maxim })), voice: voices };
  return { card, id: sha256Hex(canonical(card)) };
}
