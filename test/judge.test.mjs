// judge.test.mjs — reading the cold judge: a line needs all seven labels as whole numbers; a sum that is not 100 is scaled
// to it; missing and unreadable lines are misses; recognising a mind needs a strictly highest number, none included.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LABELS, readLine, readReply, recognises } from '../src/judge.mjs';

const L = (n, v) => n + ': ' + LABELS.map((l, i) => l + ' ' + v[i]).join(', ');

test('the labels, in the sealed order', () => {
  assert.deepEqual([...LABELS], ['marcus', 'montaigne', 'emerson', 'james', 'nietzsche', 'thoreau', 'none']);
  assert.ok(Object.isFrozen(LABELS));
});

test('a line: seven labels with whole numbers; a sum not 100 is scaled', () => {
  assert.deepEqual(readLine(L(7, [10, 20, 5, 5, 40, 10, 10])), { n: 7, p: { marcus: 10, montaigne: 20, emerson: 5, james: 5, nietzsche: 40, thoreau: 10, none: 10 } });
  const s = readLine(L(3, [1, 1, 1, 1, 1, 1, 4]));
  assert.equal(s.p.none, 40); assert.equal(s.p.marcus, 10);
  assert.equal(readLine('12. Marcus: 50, MONTAIGNE=10, emerson 10, james 10, nietzsche 10, thoreau 5, none 5').p.marcus, 50, 'case, colon and equals are read');
  assert.equal(readLine(' 4) ' + LABELS.map((l) => l + ' 0').join(' ')), null, 'a sum of 0 is unreadable');
  assert.equal(readLine(L(1, [10, 20, 5, 5, 40, 10, 10]).replace('none 10', '')), null, 'a missing label');
  assert.equal(readLine(L(1, [10, 20, 5, 5, 40, 10, 10]).replace('james 5', 'james x')), null);
  assert.equal(readLine('marcus 10'), null); assert.equal(readLine(null), null); assert.equal(readLine(''), null);
  assert.equal(readLine(L(2, [10, 20, 5, 5, 40, 10, 10]).replace('marcus', 'marcusx')), null, 'a label is a whole word');
});

test('a reply: one reading per passage in order; missing, unreadable and repeated lines', () => {
  const reply = ['preamble', L(2, [0, 0, 0, 0, 0, 100, 0]), L(1, [100, 0, 0, 0, 0, 0, 0]), L(1, [0, 100, 0, 0, 0, 0, 0]), '4: nonsense', ''].join('\r\n');
  const r = readReply(reply, 4);
  assert.equal(r.length, 4); assert.equal(r[0].marcus, 100, 'the first reading of a passage counts'); assert.equal(r[1].thoreau, 100);
  assert.equal(r[2], null); assert.equal(r[3], null);
  assert.deepEqual(readReply(reply, 0), []); assert.deepEqual(readReply(reply, -1), []); assert.deepEqual(readReply(reply, 2.5), []); assert.deepEqual(readReply(null, 2), [null, null]);
});

test('recognised only by a strictly highest number, none included', () => {
  const p = { marcus: 40, montaigne: 20, emerson: 10, james: 10, nietzsche: 5, thoreau: 5, none: 10 };
  assert.equal(recognises(p, 'marcus'), true); assert.equal(recognises(p, 'montaigne'), false);
  assert.equal(recognises({ ...p, none: 40 }, 'marcus'), false, 'a tie with none is a miss');
  assert.equal(recognises({ ...p, thoreau: 40 }, 'marcus'), false, 'a tie with another mind is a miss');
  assert.equal(recognises({ ...p, none: 90, marcus: 5 }, 'none'), false, 'none is never a mind');
  assert.equal(recognises(null, 'marcus'), false); assert.equal(recognises(p, 'plato'), false);
});
