// tools/stock2.mjs — organ 2's stock as its seal (claims/organ-2.json) defines it: organ 1's six cards, the 15 pairs, the
// breeding prompt built from the seal's own words, the seeds and options, the child and cross cards grown from the
// committed replies, and the judge's head for batches of 45. Shared by the tools that ask, judge and measure organ 2.
import { pairs, breed, cross } from '../src/breed.mjs';
import { SEAL, MINDS, read } from './stock.mjs';

export const SEAL2 = JSON.parse(read('claims/organ-2.json'));
export const PAIRS = pairs(MINDS);
export const QUESTIONS = SEAL.questions.slice(0, 10);
export const BATCH2 = 45;
export const OPTIONS2 = { breed: { temperature: 0, seed: 7, num_ctx: 4096, num_predict: 900 }, perspective: { temperature: 0.7, num_ctx: 4096, num_predict: 320 } };
export const SEEDS2 = { child: (k, q) => 5000 + 37 * k + q, cross: (k, q) => 6000 + 37 * k + q, again: 1000, judge: 4343 };

/** organ 1's grown cards by mind */
export const parents = (c = JSON.parse(read('data/cards.json'))) => Object.fromEntries(c.minds.filter((m) => m.grown).map((m) => [m.mind, m.card]));

/** the breeding prompt, word for word as sealed */
export const breedPrompt = (first, second) => 'Below are two patterns of thought, each described by twelve maxims it holds. They are models, not people.\n\nFIRST:\n'
  + first.maxims.map((m) => '- ' + m.maxim).join('\n') + '\n\nSECOND:\n' + second.maxims.map((m) => '- ' + m.maxim).join('\n')
  + '\n\nWrite 16 new maxims for a single pattern of thought that holds both. Each maxim is one sentence of plain modern English. Do not copy a maxim. Do not name any thinker, book or school of thought. Reply with the 16 maxims only, one per line, numbered 1 to 16.';

/** the sealed head of every organ 2 batch */
export const HEAD2 = (() => { const p = SEAL2.judge.prompt, a = p.indexOf("'") + 1; return p.slice(a, p.indexOf("' then the 45 passages", a)); })();

/** every pair's child and cross, from the committed breeding replies: { pairs: [{ k, pair, child: breed(), cross: cross() }] } */
export function children(replies = JSON.parse(read('data/local/children.json')).items, P = parents()) {
  const by = new Map(replies.map((x) => [x.pair.join('+'), x.reply]));
  return { kind: 'bred-minds.children', v: 1, pairs: PAIRS.map((pair, k) => {
    const [a, b] = pair, reply = by.get(pair.join('+'));
    return { k, pair, asked: reply !== undefined, child: breed(pair, P[a], P[b], reply ?? '', SEAL.blocked), cross: cross(pair, P[a], P[b]) };
  }) };
}
