// src/text.mjs — the traces, read exactly as organ 1's seal (claims/organ-1.json) defines them: an author's own span of a
// Project Gutenberg file, cut into passages, split FIT / TEST; words, content words, the blocked words, the stop list;
// and the seeded shuffle every draw uses (drawing without replacement by the seed library's rng). Pure, deterministic and total:
// nonsense in gives an empty result or false, never a throw.
import { rng, draw } from '../vendor/seed-library/seedlib.mjs';

/** the stop list, exactly as the seal holds it */
export const STOP = Object.freeze(['about', 'above', 'after', 'again', 'against', 'also', 'among', 'another', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'cannot', 'could', 'does', 'doing', 'down',
  'during', 'each', 'even', 'ever', 'every', 'from', 'further', 'have', 'having', 'here', 'hers', 'herself', 'himself', 'into', 'itself', 'just', 'least', 'less', 'like', 'made', 'make', 'many', 'more', 'most',
  'much', 'must', 'myself', 'never', 'nothing', 'once', 'only', 'other', 'ought', 'ours', 'ourselves', 'over', 'same', 'shall', 'should', 'since', 'some', 'such', 'than', 'that', 'their', 'theirs', 'them',
  'themselves', 'then', 'there', 'these', 'they', 'thing', 'things', 'this', 'those', 'though', 'through', 'thus', 'under', 'until', 'upon', 'very', 'what', 'when', 'where', 'whether', 'which', 'while', 'whom',
  'whose', 'will', 'with', 'within', 'without', 'would', 'your', 'yours', 'yourself', 'yourselves']);
const STOPSET = new Set(STOP);

/** words: runs of letters with an inner apostrophe allowed (any letters, so a translation's accents count) */
export const words = (s) => String(s ?? '').match(/\p{L}+(?:['’]\p{L}+)*/gu) || [];
/** the trace model's tokens: lowercase runs of a–z with an inner apostrophe */
export const tokens = (s) => String(s ?? '').toLowerCase().match(/[a-z]+(?:'[a-z]+)*/g) || [];
/** a content word, as the gate compares it: 4 or more letters, lowercase, not a stop word, a final s removed */
export const content = (s) => new Set(words(s).map((w) => w.toLowerCase()).filter((w) => w.length >= 4 && !STOPSET.has(w)).map((w) => (w.endsWith('s') ? w.slice(0, -1) : w)));

/** whether text names a blocked word or phrase: whole word, any case */
export function blockedIn(text, blocked) {
  const t = ' ' + words(text).join(' ').toLowerCase() + ' ';
  return (Array.isArray(blocked) ? blocked : []).some((b) => typeof b === 'string' && words(b).length > 0 && t.includes(' ' + words(b).join(' ').toLowerCase() + ' '));
}

/** the author's own span: after the Project Gutenberg start marker, from the start heading to the end heading (whole
 *  trimmed lines, at the occurrence given; no end heading = the Project Gutenberg end marker). '' if it cannot be found */
export function span(raw, start, end) {
  const lines = String(raw ?? '').replace(/\r\n?/g, '\n').split('\n'), from = lines.findIndex((l) => l.startsWith('*** START OF'));
  const after = lines.slice(from + 1), to = after.findIndex((l) => l.startsWith('*** END OF'));
  if (from === -1 || to === -1) return '';
  const body = after.slice(0, to);
  const nth = (heading) => {   // a heading that is not a string, or an occurrence that is not a whole count, matches no line
    let seen = 0;
    return heading ? body.findIndex((l) => l.trim() === heading.line && ++seen === heading.occurrence) : -1;
  };
  const a = nth(start), b = end ? nth(end) : body.length;
  return a === -1 || b === -1 ? '' : body.slice(a, b).join('\n');   // an end heading before the start gives nothing
}

/** a passage cut at sentence ends into pieces of at most 400 words; a piece under 60 joins the one before; a piece with
 *  no sentence end left over 400 is cut at 400 words */
export function pieces(passage) {
  const sentences = String(passage).split(/(?<=[.!?])\s+/), out = [];
  let cur = [];
  const flush = () => { if (cur.length) { out.push(cur.join(' ')); cur = []; } };
  for (const s of sentences) {
    if (cur.length && words(cur.join(' ') + ' ' + s).length > 400) flush();
    cur.push(s);
  }
  flush();
  const joined = [];
  for (const p of out) { if (joined.length && words(p).length < 60) joined[joined.length - 1] += ' ' + p; else joined.push(p); }
  return joined.flatMap((p) => (words(p).length <= 400 ? [p] : chunks(p.split(/\s+/))));
}

/** whitespace-separated tokens in runs of 400 */
const chunks = (ws) => Array.from({ length: Math.ceil(ws.length / 400) }, (_, i) => ws.slice(i * 400, i * 400 + 400).join(' '));

/** the span cut into passages, as the seal says */
export function passages(text) {
  const paras = String(text ?? '').replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/).filter((p) => {
    return words(p).length >= 8 * p.split('\n').filter((l) => l.trim()).length;   // a blank paragraph passes here, and is dropped below
  }).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const out = [];
  let cur = '';
  for (const p of paras) { cur = cur ? cur + ' ' + p : p; if (words(cur).length >= 120) { out.push(...pieces(cur)); cur = ''; } }
  return out;   // a tail under 120 words at the end of the span is not a passage
}

/** passage k is TEST when k mod 10 is 8 or 9 */
export const isTest = (k) => Number.isInteger(k) && k % 10 >= 8;

/** the seeded shuffle: draw without replacement, each pick by the seed library's draw on rng(seed); the input is not changed */
export function shuffle(xs, seed) {
  const r = rng(seed), pool = Array.isArray(xs) ? xs.slice() : [], out = [];
  while (pool.length) out.push(pool.splice(draw(r, pool.length), 1)[0]);
  return out;
}
