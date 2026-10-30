// stats.test.mjs — the Wilson interval at z = 1.96, and the bootstrap lower bound of a difference of means: known values,
// edges, seeded, nonsense gives null.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wilson, diffLow, Z } from '../src/stats.mjs';

const near = (a, b, e = 1e-4) => assert.ok(Math.abs(a - b) < e, a + ' vs ' + b);

test('the Wilson interval: known values', () => {
  assert.equal(Z, 1.96);
  const a = wilson(5, 10); near(a.rate, 0.5); near(a.low, 0.236593); near(a.high, 0.763407);
  const b = wilson(0, 10); near(b.low, 0); near(b.high, 0.277530);
  const c = wilson(10, 10); near(c.low, 0.722470); near(c.high, 1);
  const d = wilson(48, 120); near(d.rate, 0.4); near(d.low, 0.316763); near(d.high, 0.489441);
  const e = wilson(1, 1); near(e.low, 0.206549); near(e.high, 1);
  assert.ok(wilson(30, 120).low < wilson(48, 120).low);
  near(wilson(5, 10, 1).low, 0.349244, 1e-5);
});

test('the Wilson interval: nonsense gives null', () => {
  for (const [k, n] of [[1, 0], [-1, 5], [6, 5], [1.5, 5], [1, 2.5], ['1', 5], [1, null]]) assert.equal(wilson(k, n), null, k + '/' + n);
  assert.notEqual(wilson(0, 1), null); assert.notEqual(wilson(5, 5), null);
});

test('the bootstrap lower bound: below the difference, above zero for a clear one, seeded', () => {
  const a = Array.from({ length: 40 }, (_, i) => 50 + (i % 7)), b = Array.from({ length: 40 }, (_, i) => 20 + (i % 5));
  const low = diffLow(a, b);
  assert.equal(low, 30.15, 'pinned: 2,000 resamples, seed 99, the 2.5th percentile');
  assert.ok(low > 25 && low < 33, String(low));
  assert.equal(diffLow(a, b), low); assert.notEqual(diffLow(a, b, 2000, 98), low);
  assert.ok(diffLow(b, a) < -25);
  assert.equal(diffLow([5, 5, 5], [5, 5]), 0);
  assert.ok(diffLow(a, b, 40) > 25);
});

test('the bootstrap lower bound: nonsense gives null', () => {
  for (const [a, b] of [[[], [1]], [[1], []], [null, [1]], [[1], 'x'], [[1, NaN], [1]], [[1], [Infinity]]]) assert.equal(diffLow(a, b), null);
  for (const n of [0, -5, 2.5, '9']) assert.equal(diffLow([1, 2], [1], n), null, 'resamples must be a whole number above 0: ' + n);
  assert.equal(diffLow([3, 3], [1, 1], 1), 2);
});
