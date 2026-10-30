// cost.test.mjs — the cost case reads the price lock's own entries, adds the hours people would spend and the rail's
// power and judge tokens exactly, keeps every default when a change is nonsense, and never throws on garbage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ASSUME, assume, rates, people, rail, compare } from '../src/cost.mjs';

const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, (m || '') + ' ' + a + ' ≠ ' + b);
const LOCK = { entries: [null, 5, 'x',
  { id: 'uk-national-living-wage', value: 12 }, { id: 'brysbaert-2019-reading-rate', wpm: 200 }, { id: 'chatgpt-business', price: 15 },
  { id: 'intel-i7-1255u-power', wattsLow: 15, wattsHigh: 50 }, { id: 'desnz-electricity-nondomestic', pencePerKwh: 20 }, { id: 'fx-gbp-usd', gbpPerUsd: 0.8 },
  { id: 'claude-opus-5-5', inPerM: 4, outPerM: 20 }] };
const RUN = { passageWords: [120, 360], perspectiveWords: [150, 150, 300], localSeconds: 7200, judgeInChars: 30001, judgeOutChars: 3001 };

test('the rates are the lock entries the case names (the chip at its maximum power)', () => {
  assert.deepEqual(rates(LOCK), { wage: 12, wpm: 200, seat: 15, watts: 50, pencePerKwh: 20, gbpPerUsd: 0.8, inPerM: 4, outPerM: 20 });
  assert.deepEqual(rates({ entries: [] }), { wage: 0, wpm: 0, seat: 0, watts: 0, pencePerKwh: 0, gbpPerUsd: 0, inPerM: 0, outPerM: 0 });
  for (const g of [null, undefined, 7, 'x', {}, { entries: 'x' }, { entries: [{ id: 'fx-gbp-usd', gbpPerUsd: -2 }, { id: 'uk-national-living-wage', value: 'ten' }] }]) {
    const r = rates(g); assert.ok(Object.values(r).every((v) => v === 0), JSON.stringify(g));
  }
});

test('the assumptions: the floor by default; a change counts only when it is a finite number of zero or more', () => {
  assert.deepEqual(assume(), { ...ASSUME });
  assert.deepEqual(ASSUME, { maximMinutes: 1, askSeconds: 30, decideSeconds: 15, reviewers: 1, setupMinutes: 30, charsPerToken: 3, seats: 1 });
  assert.equal(assume({ reviewers: 0 }).reviewers, 0);
  assert.equal(assume({ reviewers: 3 }).reviewers, 3);
  for (const bad of [-1, NaN, Infinity, '2', null]) assert.equal(assume({ reviewers: bad }).reviewers, 1, String(bad));
  assert.deepEqual(assume('x'), { ...ASSUME });
  assert.throws(() => { ASSUME.reviewers = 9; });
});

test('people: reading, writing, asking and reviewing, hour by hour, then the seat', () => {
  const r = rates(LOCK), p = people(RUN, r, assume());
  near(p.hours.read, 480 / 12000, 'read'); near(p.hours.write, 2 / 60, 'write'); near(p.hours.ask, 90 / 3600, 'ask'); near(p.hours.review, 600 / 12000 + 45 / 3600, 'review');
  const h = 0.04 + 2 / 60 + 0.025 + 0.0625;
  near(p.totalHours, h); near(p.staff, h * 12); assert.equal(p.seat, 15); near(p.total, h * 12 + 15);
  const three = people(RUN, r, assume({ reviewers: 3, seats: 2 }));
  near(three.hours.review, 3 * 0.0625); assert.equal(three.seat, 30);
  const none = people(RUN, r, assume({ reviewers: 0 })); assert.equal(none.hours.review, 0);
  assert.equal(people(RUN, { ...r, wpm: 0 }, assume()).hours.read, 0);
});

test('people: garbage records read as no work', () => {
  const r = rates(LOCK), a = assume();
  for (const run of [null, undefined, {}, { passageWords: 'abc', perspectiveWords: 'abcd' }, { passageWords: [-5, NaN, 'x'], perspectiveWords: [] }]) {
    const p = people(run, r, a);
    assert.equal(p.totalHours, 0, JSON.stringify(run)); assert.equal(p.total, 15);
  }
  const one = people({ passageWords: [0, -5, 'x', NaN, Infinity, 240], perspectiveWords: [0, 120] }, r, a);
  near(one.hours.read, 240 / 12000); near(one.hours.write, 1 / 60); near(one.hours.ask, 30 / 3600);
});

test('the rail: the setup at the wage, the laptop power for the seconds the model ran, the judge tokens rounded up', () => {
  const r = rates(LOCK), q = rail(RUN, r, assume());
  assert.equal(q.totalHours, 0.5); assert.equal(q.staff, 6);
  near(q.kWh, 0.1); near(q.power, 0.02);
  assert.deepEqual(q.tokens, { in: 10001, out: 1001 });
  near(q.judge, (10001 * 4 + 1001 * 20) / 1e6 * 0.8); near(q.total, 6 + 0.02 + 0.0480192);
  assert.deepEqual(rail(RUN, r, assume({ charsPerToken: 0 })).tokens, { in: 0, out: 0 });
  const g = rail(null, r, assume()); assert.equal(g.kWh, 0); assert.deepEqual(g.tokens, { in: 0, out: 0 }); assert.equal(g.total, 6);
  assert.equal(rail({ localSeconds: -9, judgeInChars: 'x' }, r, assume()).total, 6);
});

test('the rail: the judge\'s input is the larger of its prompts in tokens and the harness\'s count of its whole sessions', () => {
  const r = rates(LOCK), a = assume();
  assert.deepEqual(rail({ ...RUN, judgeTokens: 40000.2 }, r, a).tokens, { in: 40001, out: 1001 });
  assert.deepEqual(rail({ ...RUN, judgeTokens: 10002 }, r, a).tokens, { in: 10002, out: 1001 });
  assert.deepEqual(rail({ ...RUN, judgeTokens: 10000 }, r, a).tokens, { in: 10001, out: 1001 });
  near(rail({ ...RUN, judgeTokens: 40000 }, r, a).judge, (40000 * 4 + 1001 * 20) / 1e6 * 0.8);
  assert.deepEqual(rail({ ...RUN, judgeTokens: 500 }, r, assume({ charsPerToken: 0 })).tokens, { in: 500, out: 0 });
  for (const bad of [-5, NaN, Infinity, '90000', null]) assert.deepEqual(rail({ ...RUN, judgeTokens: bad }, r, a).tokens, { in: 10001, out: 1001 }, String(bad));
});

test('the comparison and the year', () => {
  const c = compare(RUN, LOCK, { reviewers: 1 }), p = 0.160833333333 * 12 + 15;
  near(c.people.total, (0.04 + 2 / 60 + 0.025 + 0.0625) * 12 + 15); near(c.rail.total, 6.0680192);
  near(c.save, c.people.total - 6.0680192); near(c.share, (c.people.total - 6.0680192) / c.people.total); near(c.hoursBack, 0.04 + 2 / 60 + 0.025 + 0.0625 - 0.5);
  assert.equal(c.year.checks, 12); near(c.year.people, 12 * c.people.total); near(c.year.rail, 12 * 6.0680192); near(c.year.save, c.year.people - c.year.rail);
  const two = compare(RUN, LOCK, {}, 2);
  assert.equal(two.year.checks, 24); near(two.year.people, 12 * (2 * c.people.staff + 15)); near(two.year.rail, 24 * 6.0680192); near(two.year.hoursBack, 24 * c.hoursBack);
  const zero = compare(RUN, LOCK, {}, 0);
  assert.deepEqual([zero.year.checks, zero.year.people, zero.year.rail, zero.year.save, zero.year.hoursBack].map((x) => x + 0), [0, 0, 0, 0, 0]);
  assert.equal(compare(RUN, LOCK, {}, -3).year.checks, 0);
  assert.deepEqual(c.rates, rates(LOCK)); assert.deepEqual(c.assume, assume());
  assert.ok(p > 0);
});

test('nothing in, nothing out: no NaN, no throw', () => {
  for (const args of [[], [null, null, null, null], [7, 'x', 'y', 'z'], [{}, { entries: [{}] }, { reviewers: -1 }, NaN]]) {
    const c = compare(...args);
    assert.equal(c.share, 0); assert.equal(c.people.total, 0); assert.equal(c.rail.total, 0);
    assert.ok(JSON.stringify(c).indexOf('null') === -1, 'no NaN');
  }
});
