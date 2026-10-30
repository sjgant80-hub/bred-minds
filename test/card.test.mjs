// card.test.mjs — a mind card grows only from maxims that pass the gate, the first 12 kept in draw order, two voices of
// 60 words; fewer than 8 kept and the mind is not grown; a sham pools every card's maxims; ids are hashes of canonical
// JSON. Nonsense is refused with the reason, never thrown.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clean, gate, canonical, grow, sham, firstWords, KEEP, MIN_KEPT, MIN_WORDS, MAX_WORDS, SHARED, VOICE_WORDS } from '../src/card.mjs';
import { sha256Hex } from '../vendor/seed-library/sha256.mjs';

const B = JSON.parse(readFileSync(new URL('../claims/organ-1.json', import.meta.url), 'utf8')).blocked;
const PASSAGE = 'Patience grows in the garden of hardship, and every hardship borne with patience teaches the soul its own strength. ' + Array.from({ length: 70 }, (_, i) => 'filler' + i).join(' ');
const GOOD = 'Patience under hardship teaches a person their own inner strength.';

test('the sealed numbers', () => {
  assert.deepEqual([KEEP, MIN_KEPT, MIN_WORDS, MAX_WORDS, SHARED, VOICE_WORDS], [12, 8, 6, 40, 2, 60]);
});

test('clean: trimmed, surrounding quotes removed', () => {
  assert.equal(clean('  "A maxim."  '), 'A maxim.'); assert.equal(clean('“A maxim.”'), 'A maxim.'); assert.equal(clean("'x'"), 'x');
  assert.equal(clean(null), ''); assert.equal(clean(7), '7');
});

test('the gate: 6 to 40 words, 2 content words shared with the passage, no blocked word', () => {
  assert.deepEqual(gate(GOOD, PASSAGE, B), { ok: true, why: 'kept' });
  assert.deepEqual(gate('Patience teaches hardship strength now.', PASSAGE, B), { ok: false, why: '5 words, not 6 to 40' });
  assert.equal(gate('Patience teaches hardship strength now always.', PASSAGE, B).ok, true, 'six words is enough');
  assert.deepEqual(gate(GOOD + ' ' + Array.from({ length: 31 }, () => 'and').join(' '), PASSAGE, B), { ok: false, why: '41 words, not 6 to 40' });
  assert.equal(gate(GOOD.replace('.', '') + ' ' + Array.from({ length: 30 }, () => 'and').join(' ').split(' ').slice(0, 30).join(' '), PASSAGE, B).ok, true, '40 words is allowed');
  assert.deepEqual(gate('One should always be kind to all strangers.', PASSAGE, B), { ok: false, why: '0 content words shared with its passage, not 2' });
  assert.deepEqual(gate('Patience matters more than wealth to anyone.', PASSAGE, B), { ok: false, why: '1 content word shared with its passage, not 2' });
  assert.deepEqual(gate('A Stoic learns patience through every hardship.', PASSAGE, B), { ok: false, why: 'it names a blocked word' });
  assert.equal(gate('Hardships teach patience to the willing heart.', PASSAGE, B).ok, true, 'a final s is removed before comparing');
  assert.equal(gate(GOOD, null, B).ok, false); assert.equal(gate(null, PASSAGE, B).ok, false);
});

test('the first 60 words: up to the end of the 60th word; a shorter text whole', () => {
  const sixty = Array.from({ length: 60 }, () => 'alpha').join(' ');
  assert.equal(firstWords(sixty + '.', 60), sixty, 'the full stop after the 60th word is not kept');
  assert.equal(firstWords(sixty + ' beta gamma', 60), sixty);
  assert.equal(firstWords('one two', 60), 'one two'); assert.equal(firstWords(null, 60), '');
});

test('canonical JSON: keys sorted at every level', () => {
  assert.equal(canonical({ b: 1, a: [{ d: 2, c: 'x' }] }), '{"a":[{"c":"x","d":2}],"b":1}');
  assert.equal(canonical(null), 'null');
});

const drawn = Array.from({ length: 24 }, (_, i) => ({ index: i * 10, text: PASSAGE.replace('Patience', 'Patience' + i) }));
const replies = drawn.map((_, i) => (i % 3 === 2 ? 'Too short.' : '"' + GOOD.replace('person', 'person ' + i) + '"'));

test('a card: the first 12 kept in draw order, each with the passage it came from; two voices of 60 words; its id is its hash', () => {
  const g = grow('marcus', drawn, replies, B);
  assert.equal(g.grown, true); assert.equal(g.card.mind, 'marcus');
  assert.equal(g.card.maxims.length, 12);
  assert.deepEqual(g.card.maxims.map((m) => m.from), [0, 10, 30, 40, 60, 70, 90, 100, 120, 130, 150, 160]);
  assert.equal(g.card.maxims[1].maxim, GOOD.replace('person', 'person 1'));
  assert.equal(g.card.voice.length, 2); assert.equal(g.card.voice[0].split(' ').length, 60); assert.ok(g.card.voice[1].startsWith('Patience1 '));
  assert.equal(g.id, sha256Hex(canonical(g.card)));
  assert.deepEqual(g.steps.map((s) => s.kept).slice(0, 6), [true, true, false, true, true, false]);
  assert.equal(g.steps[2].why, '2 words, not 6 to 40');
  assert.equal(grow('marcus', drawn, replies, B).id, g.id, 'the same draws and replies grow the same card');
  const shortVoice = grow('m', drawn.map((d) => ({ ...d, text: GOOD + ' ' + GOOD + ' patience hardship strength teaches' })), replies, B);
  assert.equal(shortVoice.card.voice[0], GOOD + ' ' + GOOD + ' patience hardship strength teaches', 'a passage of 60 words or fewer is its own voice');
});

test('fewer than 8 kept: the mind is not grown; nonsense grows nothing', () => {
  const few = replies.map((r, i) => (i < 7 ? r : 'no'));
  const g = grow('marcus', drawn, few, B);
  assert.equal(g.grown, false); assert.equal(g.card, null); assert.equal(g.id, null); assert.equal(g.steps.filter((s) => s.kept).length, 5);
  assert.equal(grow('m', drawn, replies.map((r, i) => (i < 11 ? r : 'no')), B).grown, true, 'eight kept is enough');
  assert.equal(grow('m', drawn, replies.map((r, i) => (i < 10 ? r : 'no')), B).grown, false, 'seven kept is not');
  assert.deepEqual(grow('m', null, null, B), { grown: false, card: null, id: null, steps: [] });
  assert.equal(grow('m', [null, 3], ['x', 'y'], B).grown, false);
});

test('a sham: 12 maxims drawn from every card pooled, two cards’ voices, seeded; labelled and marked', () => {
  const cards = ['a', 'b', 'c'].map((m, k) => ({ mind: m, maxims: Array.from({ length: 12 }, (_, i) => ({ from: i, maxim: m + i })), voice: [m + '-v1', m + '-v2'] }));
  const s = sham('a', cards, 900), t = sham('a', cards, 900);
  assert.deepEqual(s, t); assert.equal(s.card.mind, 'a'); assert.equal(s.card.sham, true);
  assert.equal(s.card.maxims.length, 12); assert.ok(s.card.maxims.every((m) => m.from === null));
  assert.ok(new Set(s.card.maxims.map((m) => m.maxim[0])).size > 1, 'drawn from more than one mind');
  assert.equal(s.card.voice.length, 2); assert.ok(s.card.voice.every((v) => v.endsWith('-v1')));
  assert.notDeepEqual(sham('a', cards, 901).card.maxims, s.card.maxims);
  assert.equal(s.id, sha256Hex(canonical(s.card)));
  assert.deepEqual(sham('x', null, 1).card.maxims, []); assert.deepEqual(sham('x', [null, { mind: 'q' }], 1).card.voice, []);
});
