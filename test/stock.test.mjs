// stock.test.mjs — the tools build every prompt word for word as organ 1's seal writes it, read the texts the seal names,
// draw 24 FIT passages per mind, and never draw a TEST passage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEAL, MINDS, stock, drawn, maximPrompt, cardPrompt, basePrompt, textsMatch, SEEDS, OPTIONS } from '../tools/stock.mjs';
import { words } from '../src/text.mjs';

/** the prompt the seal quotes in a field: between the first ' and the ' that ends it, with \n read as a line break */
const quoted = (field, end) => { const a = field.indexOf("'") + 1; return field.slice(a, field.indexOf(end, a)).replace(/\\n/g, '\n'); };

test('the maxim prompt is the sealed one, word for word', () => {
  const sealed = quoted(SEAL.card.ask, "' The reply");
  assert.equal(maximPrompt('PASSAGE TEXT'), sealed.replace('<the passage>', 'PASSAGE TEXT'));
});

test('the card and base prompts are the sealed ones, word for word', () => {
  const card = { maxims: [{ maxim: 'A.' }, { maxim: 'B.' }], voice: ['v one', 'v two'] };
  const sealed = quoted(SEAL.perspectives.card, "'", 0);
  const want = quoted(SEAL.perspectives.card.slice(SEAL.perspectives.card.indexOf('exactly:')), "'\n").replace(/'$/, '');
  const filled = want.replace("<the card's maxims, one per line, each starting with - >", '- A.\n- B.').replace('<the two voice samples, each in quotation marks, one per line>', '"v one"\n"v two"').replace('<q>', 'Why?');
  assert.equal(cardPrompt(card, 'Why?'), filled);
  const base = quoted(SEAL.perspectives.base.slice(SEAL.perspectives.base.indexOf('exactly:')), "QUESTION: <q>'") + 'QUESTION: <q>';
  assert.equal(basePrompt('Why?'), base.replace('<q>', 'Why?'));
  assert.ok(sealed.length > 0);
});

test('the sealed seeds and options', () => {
  assert.deepEqual([SEEDS.card(2, 5), SEEDS.base(3), SEEDS.sham(1, 4), SEEDS.shamDraw(5), SEEDS.judge, SEEDS.again], [1079, 2003, 3041, 905, 4242, 1000]);
  assert.deepEqual(OPTIONS.maxim, { temperature: 0, seed: 7, num_ctx: 4096, num_predict: 120 });
  assert.deepEqual(OPTIONS.perspective, { temperature: 0.7, num_ctx: 4096, num_predict: 320 });
  assert.equal(SEAL.questions.length, 20);
});

test('the texts are the ones recorded; each mind draws 24 FIT passages of 120 to 400 words, never a TEST one', () => {
  assert.equal(textsMatch(), true);
  const all = stock();
  assert.deepEqual(Object.keys(all), MINDS);
  for (const [k, m] of MINDS.entries()) {
    const d = drawn(all[m], k), test = new Set(all[m].filter((p) => p.test).map((p) => p.index));
    assert.equal(d.length, 24, m); assert.equal(new Set(d.map((x) => x.index)).size, 24);
    assert.ok(d.every((x) => !test.has(x.index) && words(x.text).length >= 120 && words(x.text).length <= 400), m);
    assert.deepEqual(drawn(all[m], k), d, 'seeded');
  }
  const scrambled = stock(true);
  for (const [k, m] of MINDS.entries()) assert.deepEqual(drawn(scrambled[m], k), drawn(all[m], k), 'scrambling TEST changes no draw: ' + m);
});
