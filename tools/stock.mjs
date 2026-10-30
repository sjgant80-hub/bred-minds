// tools/stock.mjs — organ 1's breeding stock as its seal (claims/organ-1.json) defines it: the six texts checked byte for
// byte, each author's own span cut into passages and split FIT / TEST, each mind's 24 drawn FIT passages, and every
// prompt built from the seal's own words. Shared by the tools that ask the local model, the judge prompts and the
// measurement, so all of them read the stock the same way.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { span, passages, isTest, words, shuffle } from '../src/text.mjs';

const ROOT = new URL('../', import.meta.url);
export const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
export const SEAL = JSON.parse(read('claims/organ-1.json'));
export const SOURCES = JSON.parse(read('data/sources.json'));
export const MINDS = SOURCES.minds.map((m) => m.mind);
export const sha = (s) => createHash('sha256').update(s).digest('hex');

/** each text is the one data/sources.json records */
export const textsMatch = () => SOURCES.minds.every((m) => sha(readFileSync(new URL(m.path, ROOT))) === m.sha256);

/** every mind's passages in book order, each { index, text, test } */
export function stock(scramble = false) {
  return Object.fromEntries(SOURCES.minds.map((m) => {
    const ps = passages(span(read(m.path), m.start, m.end)).map((text, index) => ({ index, text, test: isTest(index) }));
    return [m.mind, scramble ? ps.map((p) => (p.test ? { ...p, text: shuffle(words(p.text), 7 + p.index).join(' ') } : p)) : ps];
  }));
}

/** mind k's 24 drawn FIT passages of 120 to 400 words, in draw order */
export function drawn(ps, k) {
  const pool = ps.filter((p) => !p.test && words(p.text).length >= 120 && words(p.text).length <= 400);
  return shuffle(pool, 100 + k).slice(0, 24).map(({ index, text }) => ({ index, text }));
}

export const OPTIONS = { maxim: { temperature: 0, seed: 7, num_ctx: 4096, num_predict: 120 }, perspective: { temperature: 0.7, num_ctx: 4096, num_predict: 320 } };

/** the maxim prompt, word for word as sealed */
export const maximPrompt = (passage) => 'Here is a passage from an old book.\n\n' + passage + '\n\nIn one sentence of plain modern English, state the main claim this passage makes about how to live, think or act. Use only what the passage says. Reply with the sentence only.';

/** the card prompt, word for word as sealed */
export const cardPrompt = (card, q) => 'You are writing as a model of one pattern of thought. It is described below by maxims it holds and two short samples of its voice. It is a model, not a person.\n\nMAXIMS:\n'
  + card.maxims.map((m) => '- ' + m.maxim).join('\n') + '\n\nVOICE:\n' + card.voice.map((v) => '"' + v + '"').join('\n')
  + '\n\nAnswer the question below in 120 to 160 words, from that pattern of thought, in your own words. Do not name any thinker, book or school of thought, and do not quote the samples.\n\nQUESTION: ' + q;

/** the base prompt, word for word as sealed */
export const basePrompt = (q) => 'Answer the question below in 120 to 160 words, thoughtfully, in your own words. Do not name any thinker, book or school of thought.\n\nQUESTION: ' + q;

/** the seeds: a card's perspective, the base's, a sham's (question q counts from 1) */
export const SEEDS = { card: (k, q) => 1000 + 37 * k + q, base: (q) => 2000 + q, sham: (k, q) => 3000 + 37 * k + q, again: 1000, shamDraw: (k) => 900 + k, judge: 4242 };
