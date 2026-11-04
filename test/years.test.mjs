// years.test.mjs — the case over the years: CPI and the Copilot seat from the vendored, sourced basis (byte for byte, its
// hash pinned here), one check's costs from src/cost.mjs, both sides inflated alike, staff hours not, never a throw.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DEFAULTS, BASIS_KEYS, SEATS, sourcesOf, over, yearsCase } from '../src/years.mjs';
import { compare } from '../src/cost.mjs';

const RAW = readFileSync(new URL('../vendor/sovereign-enterprise/data/basis.json', import.meta.url));
const BASIS = JSON.parse(RAW.toString('utf8'));
const CHECK = Object.freeze({ peopleStaff: 100, peopleHours: 8, seats: 1, chatgptSeat: 15, railTotal: 7.5, railHours: 0.5 });

test('the basis is the vendored file, byte for byte, as its record names it', () => {
  const sha = createHash('sha256').update(RAW).digest('hex');
  assert.equal(sha, '83e9c2effa2f81596dcfa7110f030940032c1910cdf928d27d628ae59d73bb42');
  const rec = JSON.parse(readFileSync(new URL('../vendor/SOURCES.json', import.meta.url), 'utf8'));
  const f = rec.files.find((x) => x.path === 'vendor/sovereign-enterprise/data/basis.json');
  assert.equal(f.sha256, sha);
  assert.equal(BASIS.cpi.value, 0.031);
  assert.equal(BASIS['seat.copilot'].value, 23.1);
});

test('the defaults, and the sources the page lists', () => {
  assert.deepEqual(DEFAULTS, { checksPerMonth: 1, years: 3, seat: 'chatgpt' });
  assert.deepEqual(BASIS_KEYS, ['cpi', 'seat.copilot']);
  assert.deepEqual(SEATS, ['chatgpt', 'copilot']);
  assert.throws(() => { DEFAULTS.years = 9; });
  const s = sourcesOf(BASIS);
  assert.deepEqual(s.map((x) => x.key), ['cpi', 'seat.copilot']);
  assert.deepEqual(s.map((x) => x.value), [0.031, 23.1]);
  assert.equal(s[0].what, BASIS.cpi.what);
  assert.equal(s[1].what, 'Microsoft 365 Copilot (enterprise)');
  assert.equal(s[1].source, BASIS['seat.copilot'].source);
  for (const g of [null, undefined, 7, 'x', {}]) assert.deepEqual(sourcesOf(g), [], String(g));
});

test('over: a yearly cost rising by CPI each later year, rounded to the penny', () => {
  assert.equal(over(100, 0.1, 3), 331);
  assert.equal(over(100, 0, 4), 400);
  assert.equal(over(100, 0.1, 1), 100);
  assert.equal(over(100, 0.1, 0), 0);
  assert.equal(over(1380, 0.031, 3), 4269.67);       // 4269.666… rounds up
  assert.equal(over(90, 0.031, 3), 278.46);          // 278.456… rounds up
  assert.equal(over(10, 0.5, 2), 25);
});

test('the default case: one check a month for three years, the ChatGPT seat', () => {
  const r = yearsCase(CHECK, BASIS);
  assert.equal(r.ok, true);
  assert.deepEqual(r.inputs, DEFAULTS);
  assert.equal(r.cpi, 0.031);
  assert.equal(r.seatPerMonth, 15);
  assert.equal(r.checks, 12);
  assert.deepEqual(r.perYear, { people: 1380, rail: 90 });
  assert.deepEqual(r.over, { people: 4269.67, rail: 278.46 });
  assert.deepEqual([r.savingPerYear, r.savingOver], [1290, 3991.21]);
  assert.deepEqual([r.hoursBackPerYear, r.hoursBackOver], [90, 270]);
});

test('the Copilot seat comes from the basis; the checks and years are the reader\'s own', () => {
  const r = yearsCase(CHECK, BASIS, { seat: 'copilot', checksPerMonth: 4, years: 1 });
  assert.equal(r.seatPerMonth, 23.1);
  assert.equal(r.checks, 48);
  assert.deepEqual(r.perYear, { people: 4800 + 277.2, rail: 360 });
  assert.deepEqual(r.over, r.perYear);
  assert.equal(r.hoursBackPerYear, 360);
  assert.equal(r.hoursBackOver, 360);
  const dear = yearsCase(CHECK, { ...BASIS, 'seat.copilot': { value: 30 } }, { seat: 'copilot' });
  assert.equal(dear.perYear.people, 1200 + 360);
  const flat = yearsCase(CHECK, { ...BASIS, cpi: { value: 0 } }, { years: 10 });
  assert.deepEqual(flat.over, { people: 13800, rail: 900 });
  assert.equal(flat.hoursBackOver, 900);
  const two = yearsCase({ ...CHECK, seats: 2 }, BASIS);
  assert.equal(two.perYear.people, 1200 + 360);
  const none = yearsCase({ ...CHECK, seats: 0, peopleStaff: 0, peopleHours: 0, railTotal: 0, railHours: 0, chatgptSeat: 0 }, BASIS);
  assert.equal(none.ok, true);
  assert.deepEqual(none.perYear, { people: 0, rail: 0 });
});

test('it agrees with src/cost.mjs: a year of people and rail is the same either way', () => {
  const LOCK = { entries: [{ id: 'uk-national-living-wage', value: 12 }, { id: 'brysbaert-2019-reading-rate', wpm: 200 }, { id: 'chatgpt-business', price: 15 },
    { id: 'intel-i7-1255u-power', wattsHigh: 50 }, { id: 'desnz-electricity-nondomestic', pencePerKwh: 20 }, { id: 'fx-gbp-usd', gbpPerUsd: 0.8 }, { id: 'claude-opus-5-5', inPerM: 4, outPerM: 20 }] };
  const RUN = { passageWords: [120, 360], perspectiveWords: [150, 150, 300], localSeconds: 7200, judgeInChars: 30001, judgeOutChars: 3001 };
  for (const m of [1, 3]) {
    const c = compare(RUN, LOCK, {}, m);
    const r = yearsCase({ peopleStaff: c.people.staff, peopleHours: c.people.totalHours, seats: c.assume.seats, chatgptSeat: c.rates.seat, railTotal: c.rail.total, railHours: c.rail.totalHours }, BASIS, { checksPerMonth: m, years: 1 });
    assert.equal(r.perYear.people, Math.round(c.year.people * 100) / 100, 'people ' + m);
    assert.equal(r.perYear.rail, Math.round(c.year.rail * 100) / 100, 'rail ' + m);
    assert.equal(r.hoursBackPerYear, Math.round(c.year.hoursBack * 100) / 100, 'hours ' + m);
  }
});

test('the boundaries hold at both ends', () => {
  for (const ok of [{ checksPerMonth: 1 }, { checksPerMonth: 500 }, { years: 1 }, { years: 10 }, { seat: 'chatgpt' }, { seat: 'copilot' }]) assert.equal(yearsCase(CHECK, BASIS, ok).ok, true, JSON.stringify(ok));
  assert.equal(yearsCase({ ...CHECK, seats: 0 }, BASIS).ok, true);
  assert.equal(yearsCase(CHECK, BASIS, null).ok, true);
  assert.equal(yearsCase(CHECK, BASIS, 'x').ok, true);
});

test('each bad input refused with its reason, never a throw', () => {
  const why = (c, b, i) => yearsCase(c, b, i).why;
  const basisWhy = 'a sourced basis with every figure the case reads';
  for (const b of [null, undefined, 7, {}, { cpi: { value: 0.03 } }, { 'seat.copilot': { value: 23 } }, { ...BASIS, cpi: { value: '0.03' } }, { ...BASIS, cpi: { value: -0.01 } }, { ...BASIS, 'seat.copilot': { value: NaN } }, { ...BASIS, 'seat.copilot': null }])
    assert.equal(why(CHECK, b), basisWhy, JSON.stringify(b));
  for (const c of [null, undefined, 7, {}, { ...CHECK, peopleStaff: -1 }, { ...CHECK, peopleHours: Infinity }, { ...CHECK, chatgptSeat: '15' }, { ...CHECK, railTotal: NaN }, { ...CHECK, railHours: undefined }])
    assert.equal(why(c, BASIS), 'one check\'s costs: numbers', JSON.stringify(c));
  for (const s of [-1, 1.5, '1', undefined]) assert.equal(why({ ...CHECK, seats: s }, BASIS), 'seats: a whole number', String(s));
  for (const m of [0, 501, 2.5, -1, '4', NaN]) assert.equal(why(CHECK, BASIS, { checksPerMonth: m }), 'checks a month: 1 to 500', String(m));
  for (const y of [0, 11, 2.5, '3', null]) assert.equal(why(CHECK, BASIS, { years: y }), 'years: 1 to 10', String(y));
  for (const s of ['teams', '', null, 1]) assert.equal(why(CHECK, BASIS, { seat: s }), 'the seat: chatgpt or copilot', String(s));
  const hostile = { get cpi() { throw new Error('no'); } };
  assert.deepEqual(yearsCase(CHECK, hostile), { ok: false, why: 'the inputs could not be read' });
});
