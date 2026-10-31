// stock2.test.mjs — organ 2's tools build the breeding prompt and the judge head word for word as its seal writes them,
// use the sealed seeds and options, read organ 1's six grown cards, and run the 15 pairs in the sealed order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEAL2, PAIRS, QUESTIONS, BATCH2, OPTIONS2, SEEDS2, parents, breedPrompt, HEAD2, headFor } from '../tools/stock2.mjs';
import { SEAL, MINDS } from '../tools/stock.mjs';

const quoted = (field, end) => { const a = field.indexOf("'") + 1; return field.slice(a, field.indexOf(end, a)).replace(/\\n/g, '\n'); };

test('the breeding prompt is the sealed one, word for word', () => {
  const want = quoted(SEAL2.breed.ask.slice(SEAL2.breed.ask.indexOf('this prompt:')), "1 to 16.'") + '1 to 16.';
  const A = { maxims: [{ maxim: 'A one.' }, { maxim: 'A two.' }] }, B = { maxims: [{ maxim: 'B one.' }] };
  const filled = want.replace("<the first parent's maxims, one per line, each starting with - >", '- A one.\n- A two.').replace("<the second parent's maxims, one per line, each starting with - >", '- B one.');
  assert.equal(breedPrompt(A, B), filled);
  assert.ok(SEAL2.breed.ask.includes('temperature 0, seed 7, num_ctx 4096, num_predict 900'));
});

test('the judge head is the sealed one, and asks for 45 lines', () => {
  assert.ok(HEAD2.startsWith('Below are 45 short passages.'));
  assert.ok(HEAD2.endsWith('none 10'));
  assert.ok(HEAD2.includes('of one of six thinkers, of two of them together, or of none of them'));
  assert.ok(HEAD2.includes('Reply with exactly 45 lines'));
  assert.equal(BATCH2, 45);
});

test('a short batch\'s head changes only its two numbers (claims/organ-2-amend.json)', () => {
  assert.equal(headFor(45), HEAD2);
  const h25 = headFor(25);
  assert.ok(h25.startsWith('Below are 25 short passages.') && h25.includes('Reply with exactly 25 lines'));
  assert.equal(h25.replace('Below are 25 short', 'Below are 45 short').replace('exactly 25 lines', 'exactly 45 lines'), HEAD2);
  assert.ok(!h25.includes('45'));
});

test('the sealed seeds, options and questions', () => {
  assert.deepEqual([SEEDS2.child(2, 5), SEEDS2.cross(14, 10), SEEDS2.again, SEEDS2.judge], [5079, 6528, 1000, 4343]);
  assert.deepEqual(OPTIONS2.breed, { temperature: 0, seed: 7, num_ctx: 4096, num_predict: 900 });
  assert.deepEqual(OPTIONS2.perspective, { temperature: 0.7, num_ctx: 4096, num_predict: 320 });
  assert.deepEqual(QUESTIONS, SEAL.questions.slice(0, 10));
  assert.ok(SEAL2.perspectives.child.includes('seed 5000 + 37k + q') && SEAL2.perspectives.cross.includes('seed 6000 + 37k + q'));
  assert.ok(SEAL2.judge.batches.includes('rng seed 4343') && SEAL2.judge.batches.includes('eight batches of 45'));
});

test('the 15 pairs in the sealed order, from organ 1\'s six grown cards', () => {
  assert.equal(PAIRS.length, 15);
  assert.deepEqual(PAIRS[0], [MINDS[0], MINDS[1]]); assert.deepEqual(PAIRS[14], [MINDS[4], MINDS[5]]);
  const P = parents();
  assert.deepEqual(Object.keys(P), MINDS);
  for (const m of MINDS) assert.equal(P[m].maxims.length, 12, m);
});
