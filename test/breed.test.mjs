// breed.test.mjs — organ 2's kernel: the 15 pairs in order, the candidates in a reply, the child's gate at every edge
// (length, script, blocked words, shared words, the copy rule, drawing on both), the child and the cross, what a judge's
// numbers carry and how evenly, the trace model's pair, and the control. Garbage in never throws.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CANDIDATES, COPY, CROSS_EACH, THINKERS, pairs, candidates, latin, childGate, breed, cross, carries, balance, topTwo, samePair, control } from '../src/breed.mjs';
import { canonical } from '../src/card.mjs';
import { sha256Hex } from '../vendor/seed-library/sha256.mjs';

const BLOCKED = ['Marcus', 'Nietzsche', 'William James'];
const A = ['Keep the mind calm and steady against every passion.', 'Duty to others comes before private pleasure.'];
const B = ['Strength grows from danger and struggle.', 'Value what makes life stronger, scorn comfort.'];
const p = (o) => ({ marcus: 0, montaigne: 0, emerson: 0, james: 0, nietzsche: 0, thoreau: 0, none: 0, ...o });

test('the constants are the seal\'s', () => {
  assert.equal(CANDIDATES, 16); assert.equal(COPY, 0.75); assert.equal(CROSS_EACH, 6);
  assert.deepEqual(THINKERS, ['marcus', 'montaigne', 'emerson', 'james', 'nietzsche', 'thoreau']);
  assert.throws(() => { THINKERS.push('x'); });
});

test('pairs: every i < j, in order', () => {
  const ps = pairs(THINKERS);
  assert.equal(ps.length, 15);
  assert.deepEqual(ps.slice(0, 6), [['marcus', 'montaigne'], ['marcus', 'emerson'], ['marcus', 'james'], ['marcus', 'nietzsche'], ['marcus', 'thoreau'], ['montaigne', 'emerson']]);
  assert.deepEqual(ps[14], ['nietzsche', 'thoreau']);
  assert.deepEqual(pairs(['a', 'b']), [['a', 'b']]);
  assert.deepEqual(pairs(['a']), []);
  for (const g of [null, undefined, 'abc', 7, {}]) assert.deepEqual(pairs(g), []);
});

test('candidates: numbered lines with "." or ")" and a space, cleaned, in order, the first 16', () => {
  assert.deepEqual(candidates('Here you go:\n1. First one.\n  2) "Second one."\n3.Third has no space\nx. not a number\n10. Tenth.'), ['First one.', 'Second one.', 'Tenth.']);
  assert.deepEqual(candidates('1. a\r\n2. b'), ['a', 'b']);
  const many = Array.from({ length: 20 }, (_, i) => (i + 1) + '. m' + (i + 1)).join('\n');
  assert.equal(candidates(many).length, 16); assert.equal(candidates(many)[15], 'm16');
  assert.deepEqual(candidates('- 1. dash first'), []);
  assert.deepEqual(candidates('1: colon'), []);
  for (const g of [null, undefined, 7, {}, '']) assert.deepEqual(candidates(g), []);
});

test('latin: every letter Latin script; accents are Latin; digits and punctuation are not letters', () => {
  assert.ok(latin('Plain words, déjà vu, Übermut — 12 and 3!'));
  assert.ok(latin('')); assert.ok(latin(null));
  assert.ok(!latin('life is 短暂')); assert.ok(!latin('the λόγος rules')); assert.ok(!latin('Мир'));
});

test('the child gate: length 6 to 40 words', () => {
  const six = 'Calm duty against passion grows strength', five = 'Calm duty against passion grows';
  assert.equal(childGate(six, A, B, BLOCKED).ok, true);
  assert.deepEqual(childGate(five, A, B, BLOCKED), { ok: false, why: '5 words, not 6 to 40', both: false });
  const forty = 'calm duty strength ' + Array.from({ length: 37 }, () => 'word').join(' '), fortyOne = forty + ' more';
  assert.equal(childGate(forty, A, B, BLOCKED).ok, true);
  assert.deepEqual(childGate(fortyOne, A, B, BLOCKED), { ok: false, why: '41 words, not 6 to 40', both: false });
});

test('the child gate: Latin script, then blocked words', () => {
  assert.deepEqual(childGate('Calm duty against passion grows strength 力', A, B, BLOCKED), { ok: false, why: 'a letter outside Latin script', both: false });
  assert.deepEqual(childGate('Calm duty against passion grows strength, as Nietzsche said', A, B, BLOCKED), { ok: false, why: 'it names a blocked word', both: false });
  assert.equal(childGate('Calm duty against passion grows strength, as William said', A, B, BLOCKED).ok, true);
});

test('the child gate: at least 2 content words shared with the parents together', () => {
  assert.deepEqual(childGate('The river sings quietly under every mountain calm', A, B, BLOCKED), { ok: false, why: '1 content word shared with the parents, not 2', both: false });
  assert.deepEqual(childGate('The river sings quietly under every mountain', A, B, BLOCKED), { ok: false, why: '0 content words shared with the parents, not 2', both: false });
  const one = childGate('The river sings quietly beside calm strength', A, B, BLOCKED);   // calm from A, strength from B: 2 together
  assert.equal(one.ok, true); assert.equal(one.both, false);
  assert.equal(childGate('A river sings of calm, steady minds', A, B, BLOCKED).ok, true);   // calm and steady: 2, both from A
});

test('the child gate: not a copy of any one parent maxim (75% of its content words or more)', () => {
  // A[0]'s content words: keep, mind, calm, steady, passion
  const copy = { ok: false, why: 'a copy of a parent maxim', both: false };
  assert.deepEqual(childGate('Keep calm and steady by the river', A, B, BLOCKED), copy);                 // 3 of 4 = 75%: a copy
  assert.deepEqual(childGate('Keep calm and steady with passion, river', A, B, BLOCKED), copy);          // 4 of 5 = 80%
  assert.equal(childGate('Keep the calm mind steady, passion aside, river', A, B, BLOCKED).ok, true);   // 5 of 7 = 71%: new
  assert.equal(childGate('Keep calm beside the quiet river water', A, B, BLOCKED).ok, true);            // 2 of 6
  assert.deepEqual(childGate(A[1], A, B, BLOCKED), copy);                                                // the second maxim, word for word
  assert.deepEqual(childGate('Strength grows from danger, struggle and rain', A, B, BLOCKED), copy);    // 4 of 5 of the second parent's first
  assert.deepEqual(childGate('Value life stronger, scorn every comfort, then rest', A, B, BLOCKED), copy);   // the second parent's second
});

test('the child gate: both parents means 2 content words with each parent\'s maxims together', () => {
  const both = childGate('Calm duty in danger makes strength', A, B, BLOCKED);   // A: calm, duty; B: danger, strength
  assert.deepEqual(both, { ok: true, why: 'kept', both: true });
  assert.deepEqual(childGate('Calm duty in danger means strength', A, B, BLOCKED), { ok: true, why: 'kept', both: true });   // exactly 2 and 2
  assert.equal(childGate('Calm duty in danger means a river', A, B, BLOCKED).both, false);   // B: danger only
  assert.equal(childGate('Calm river in danger makes strength', A, B, BLOCKED).both, false);   // A: calm only
});

test('the child gate on garbage parents and blocked lists never throws', () => {
  for (const g of [null, undefined, 7, 'x', {}]) {
    assert.equal(childGate('Calm duty against passion grows strength', g, g, g).ok, false);
    assert.equal(childGate(g, A, B, BLOCKED).ok, false);
  }
  assert.equal(childGate('Calm duty against passion grows strength', A, null, null).ok, true);
});

const card = (mind, maxims, voice = [mind + ' voice one', mind + ' voice two']) => ({ mind, maxims: maxims.map((maxim, i) => ({ from: i, maxim })), voice });
const PA = card('marcus', ['Keep the mind calm and steady against every passion.', 'Duty to others comes before private pleasure.', 'Nature asks only what is reasonable.', 'The present moment is all we hold.', 'Judge actions, not opinions.', 'Accept what happens as fitting.', 'Seventh maxim of the first.']);
const PB = card('nietzsche', ['Strength grows from danger and struggle.', 'Value what makes life stronger, scorn comfort.', 'Truth is a mask worn by power.', 'The herd fears the exception.', 'Create your own values.', 'Pity weakens the giver.']);
const LINES = ['Calm duty in danger makes strength', 'A steady mind meets struggle with strength', 'Duty and danger both test a calm will', 'Passion and comfort weaken a steady person', 'Steady duty becomes strength in struggle', 'A calm mind values strength over comfort', 'Calm judgement grows from honest struggle', 'Pleasure and comfort weaken a steady duty', 'A calm danger is still a danger to strength', 'Present duty and present struggle make strength'];

test('breed: the first 12 kept become the child; fewer than 8 kept grows none', () => {
  const reply = 'Here:\n' + LINES.map((l, i) => (i + 1) + '. ' + l).join('\n');
  const r = breed(['marcus', 'nietzsche'], PA, PB, reply, BLOCKED);
  assert.equal(r.steps.length, 10);
  assert.ok(r.grown);
  const kept = r.steps.filter((s) => s.ok).map((s) => s.maxim);
  assert.deepEqual(r.card, { kind: 'child', pair: ['marcus', 'nietzsche'], maxims: kept.slice(0, 12).map((maxim) => ({ maxim })), voice: ['marcus voice one', 'nietzsche voice one'] });
  assert.equal(r.id, sha256Hex(canonical(r.card)));
  const seven = breed(['marcus', 'nietzsche'], PA, PB, kept.slice(0, 7).map((l, i) => (i + 1) + '. ' + l).join('\n'), BLOCKED);
  assert.deepEqual([seven.grown, seven.card, seven.id, seven.steps.length], [false, null, null, 7]);
  const eight = breed(['marcus', 'nietzsche'], PA, PB, kept.slice(0, 8).map((l, i) => (i + 1) + '. ' + l).join('\n'), BLOCKED);
  assert.equal(eight.grown, true); assert.equal(eight.card.maxims.length, 8);
  const lots = breed(['marcus', 'nietzsche'], PA, PB, Array.from({ length: 16 }, (_, i) => (i + 1) + '. ' + kept[i % kept.length] + ' ' + 'xyz'.repeat(i % 3)).join('\n'), BLOCKED);
  assert.equal(lots.card.maxims.length, 12);
});

test('breed and cross on garbage never throw', () => {
  for (const g of [null, undefined, 7, 'x', {}, { maxims: 'x', voice: 7 }]) {
    const r = breed(['a', 'b'], g, g, g, g); assert.equal(r.grown, false);
    const c = cross(['a', 'b'], g, g); assert.deepEqual(c.card, { kind: 'cross', pair: ['a', 'b'], maxims: [], voice: ['', ''] });
  }
});

test('cross: maxims 1 to 6 of each parent, alternating, the child\'s voice', () => {
  const c = cross(['marcus', 'nietzsche'], PA, PB);
  assert.deepEqual(c.card.maxims.map((m) => m.maxim), [PA.maxims[0].maxim, PB.maxims[0].maxim, PA.maxims[1].maxim, PB.maxims[1].maxim, PA.maxims[2].maxim, PB.maxims[2].maxim, PA.maxims[3].maxim, PB.maxims[3].maxim, PA.maxims[4].maxim, PB.maxims[4].maxim, PA.maxims[5].maxim, PB.maxims[5].maxim]);
  assert.deepEqual(c.card.voice, ['marcus voice one', 'nietzsche voice one']);
  assert.equal(c.card.kind, 'cross'); assert.deepEqual(c.card.pair, ['marcus', 'nietzsche']);
  assert.equal(c.id, sha256Hex(canonical(c.card)));
  const short = cross(['marcus', 'nietzsche'], card('marcus', ['one a', 'two a']), card('nietzsche', ['one b']));
  assert.deepEqual(short.card.maxims.map((m) => m.maxim), ['one a', 'one b', 'two a']);
  const strings = cross(['x', 'y'], { maxims: ['s1', 7, 's2'], voice: ['v'] }, { maxims: [{ maxim: 't1' }], voice: [] });
  assert.deepEqual(strings.card.maxims.map((m) => m.maxim), ['s1', 't1', 's2']); assert.deepEqual(strings.card.voice, ['v', '']);
});

test('carries: both numbers strictly above each other thinker; none is not compared', () => {
  assert.ok(carries(p({ marcus: 40, nietzsche: 30, emerson: 29 }), 'marcus', 'nietzsche'));
  assert.ok(carries(p({ marcus: 40, nietzsche: 30, emerson: 29 }), 'nietzsche', 'marcus'));
  assert.ok(carries(p({ marcus: 10, nietzsche: 10, none: 80 }), 'marcus', 'nietzsche'));
  assert.ok(!carries(p({ marcus: 40, nietzsche: 30, emerson: 30 }), 'marcus', 'nietzsche'));
  assert.ok(!carries(p({ marcus: 30, nietzsche: 40, thoreau: 30 }), 'marcus', 'nietzsche'));
  assert.ok(!carries(p({ marcus: 40, emerson: 30, nietzsche: 20 }), 'marcus', 'nietzsche'));
  assert.ok(!carries(p({}), 'marcus', 'nietzsche'));
  assert.ok(!carries(p({ marcus: 50, nietzsche: 50 }), 'marcus', 'marcus'));
  assert.ok(!carries(p({ marcus: 50, none: 50 }), 'marcus', 'none'));
  for (const g of [null, undefined, 0]) assert.ok(!carries(g, 'marcus', 'nietzsche'));
});

test('balance: the smaller of the two over their sum', () => {
  assert.equal(balance(p({ marcus: 30, nietzsche: 10 }), 'marcus', 'nietzsche'), 0.25);
  assert.equal(balance(p({ marcus: 10, nietzsche: 30 }), 'marcus', 'nietzsche'), 0.25);
  assert.equal(balance(p({ marcus: 20, nietzsche: 20 }), 'marcus', 'nietzsche'), 0.5);
  assert.equal(balance(p({ marcus: 20 }), 'marcus', 'nietzsche'), 0);
  assert.equal(balance(p({}), 'marcus', 'nietzsche'), 0);
  assert.equal(balance(p({ marcus: -5, nietzsche: 15 }), 'marcus', 'nietzsche'), 0);
  assert.equal(balance(p({ marcus: NaN, nietzsche: 15 }), 'marcus', 'nietzsche'), 0);
  assert.equal(balance({ marcus: 12, nietzsche: 4 }, 'marcus', 'nietzsche'), 0.25);
  assert.equal(balance(p({ marcus: 20, nietzsche: 20 }), 'marcus', 'marcus'), 0);
  assert.equal(balance(p({ marcus: 20, none: 20 }), 'marcus', 'none'), 0);
  for (const g of [null, undefined]) assert.equal(balance(g, 'marcus', 'nietzsche'), 0);
});

test('topTwo: the two highest scores, a tie to the earlier mind', () => {
  assert.deepEqual(topTwo([-5, -1, -3, -2], ['a', 'b', 'c', 'd']), ['b', 'd']);
  assert.deepEqual(topTwo([-1, -1, -1], ['a', 'b', 'c']), ['a', 'b']);
  assert.deepEqual(topTwo([-3, -1, -1], ['a', 'b', 'c']), ['b', 'c']);
  assert.deepEqual(topTwo([-1, -3, -1], ['a', 'b', 'c']), ['a', 'c']);
  assert.deepEqual(topTwo([0, 0], ['a', 'b']), ['a', 'b']);
  assert.deepEqual(topTwo([1, 2], ['a', 'b']), ['b', 'a']);
  assert.deepEqual(topTwo([-2, -1, -1, -2], ['a', 'b', 'c', 'd']), ['b', 'c']);
  assert.deepEqual(topTwo([-1, -2, -2, -2], ['a', 'b', 'c', 'd']), ['a', 'b']);
  assert.deepEqual(topTwo([-9, -2, -3, -2], ['a', 'b', 'c', 'd']), ['b', 'd']);
  assert.deepEqual(topTwo([-9, -9, -9, -1], ['a', 'b', 'c', 'd']), ['d', 'a']);
  for (const [s, m] of [[[1], ['a']], [[1, 2], ['a']], [null, ['a', 'b']], [[1, 2], null], ['ab', 'ab']]) assert.equal(topTwo(s, m), null);
});

test('samePair: either order, two distinct thinkers', () => {
  assert.ok(samePair(['marcus', 'nietzsche'], 'marcus', 'nietzsche'));
  assert.ok(samePair(['nietzsche', 'marcus'], 'marcus', 'nietzsche'));
  assert.ok(!samePair(['marcus', 'emerson'], 'marcus', 'nietzsche'));
  assert.ok(!samePair(['emerson', 'nietzsche'], 'marcus', 'nietzsche'));
  assert.ok(!samePair(['nietzsche', 'emerson'], 'marcus', 'nietzsche'));
  assert.ok(!samePair(['emerson', 'marcus'], 'marcus', 'nietzsche'));
  assert.ok(!samePair(['marcus', 'marcus'], 'marcus', 'marcus'));
  for (const g of [null, 'marcus,nietzsche', {}]) assert.ok(!samePair(g, 'marcus', 'nietzsche'));
});

test('control: the share of the pairs with its mind that it carries', () => {
  const ps = pairs(THINKERS);
  const reading = p({ marcus: 50, nietzsche: 30, emerson: 10 });
  assert.equal(control('marcus', ps, (a, b) => carries(reading, a, b)), 0.2);
  assert.equal(control('nietzsche', ps, (a, b) => carries(reading, a, b)), 0.2);
  assert.equal(control('emerson', ps, (a, b) => carries(reading, a, b)), 0);
  assert.equal(control('marcus', ps, () => true), 1);
  assert.equal(control('marcus', [['marcus', 'emerson'], ['james', 'marcus'], ['james', 'emerson']], (a, b) => b === 'emerson'), 0.5);
  assert.equal(control('nobody', ps, () => true), 0);
  for (const g of [null, 'x', [null, 7, 'ab']]) assert.equal(control('marcus', g, () => true), 0);
  assert.equal(control('marcus', ps, null), 0);
});
