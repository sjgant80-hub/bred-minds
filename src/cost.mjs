// src/cost.mjs — the cost case: checking whether a persona carries its source's pattern of thought, done by people with
// an AI seat, against done by this rail (a local model on a laptop that is already on, the trace model, one cold judge).
// Every figure comes from the run's own records and the price lock (data/prices.lock.json); every assumption is named
// in ASSUME and the page lets the reader move it. Pure, deterministic, total: garbage in gives zeros, never a throw.

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, x) : 0);
const sum = (xs) => (Array.isArray(xs) ? xs.reduce((s, x) => s + num(x), 0) : 0);
const per = (a, b) => (b > 0 ? a / b : 0);
const count = (xs) => (Array.isArray(xs) ? xs.filter((x) => num(x) > 0).length : 0);   // a record counts when it has words

/** the assumptions, at the floor: a minute to write a maxim, half a minute to ask the seat for a perspective, 15 seconds
 *  to decide a sample, one reviewer, half an hour to start and check the rail, a token for every 3 characters (more
 *  tokens than the usual 4, so the judge is not under-costed), one seat, held for the month the check is done in */
export const ASSUME = Object.freeze({ maximMinutes: 1, askSeconds: 30, decideSeconds: 15, reviewers: 1, setupMinutes: 30, charsPerToken: 3, seats: 1 });

/** the assumptions with the reader's changes: a change that is not a finite number of zero or more keeps the default */
export const assume = (over) => Object.fromEntries(Object.entries(ASSUME).map(([k, v]) => [k, over && typeof over[k] === 'number' && Number.isFinite(over[k]) && over[k] >= 0 ? over[k] : v]));

/** the numbers the case reads from the price lock (a missing entry reads as 0) */
export function rates(lock) {
  const e = new Map((lock && Array.isArray(lock.entries) ? lock.entries : []).filter(Boolean).map((x) => [x.id, x]));
  const g = (id, k) => num((e.get(id) || {})[k]);
  return { wage: g('uk-national-living-wage', 'value'), wpm: g('brysbaert-2019-reading-rate', 'wpm'), seat: g('chatgpt-business', 'price'),
    watts: g('intel-i7-1255u-power', 'wattsHigh'), pencePerKwh: g('desnz-electricity-nondomestic', 'pencePerKwh'), gbpPerUsd: g('fx-gbp-usd', 'gbpPerUsd'),
    inPerM: g('claude-opus-5-5', 'inPerM'), outPerM: g('claude-opus-5-5', 'outPerM') };
}

/** people with a seat: read every source passage, write a maxim from each, ask the seat for every perspective, then
 *  read every perspective blind and decide whose it is (each reviewer) */
export function people(run, r, a) {
  const pw = run && run.passageWords, sw = run && run.perspectiveWords, n = count(sw);
  const hours = {
    read: per(sum(pw), r.wpm * 60),
    write: count(pw) * a.maximMinutes / 60,
    ask: n * a.askSeconds / 3600,
    review: a.reviewers * (per(sum(sw), r.wpm * 60) + n * a.decideSeconds / 3600),
  };
  const total = hours.read + hours.write + hours.ask + hours.review;
  return { hours, totalHours: total, staff: total * r.wage, seat: a.seats * r.seat, total: total * r.wage + a.seats * r.seat };
}

/** the rail: a person starts and checks it; the laptop's extra power for every second the local model ran (at the chip's
 *  maximum); the cold judge's tokens at its API rates */
export function rail(run, r, a) {
  const setup = a.setupMinutes / 60, kWh = num(run && run.localSeconds) * r.watts / 3.6e6;
  const tokens = { in: Math.ceil(per(num(run && run.judgeInChars), a.charsPerToken)), out: Math.ceil(per(num(run && run.judgeOutChars), a.charsPerToken)) };
  const judge = (tokens.in * r.inPerM + tokens.out * r.outPerM) / 1e6 * r.gbpPerUsd;
  return { totalHours: setup, staff: setup * r.wage, kWh, power: kWh * r.pencePerKwh / 100, tokens, judge, total: setup * r.wage + kWh * r.pencePerKwh / 100 + judge };
}

/** the two side by side, and a year at a number of checks a month (the seats are held each month there is a check) */
export function compare(run, lock, over, checksPerMonth = 1) {
  const r = rates(lock), a = assume(over), p = people(run, r, a), q = rail(run, r, a), m = num(checksPerMonth);
  return { rates: r, assume: a, people: p, rail: q, save: p.total - q.total, share: per(p.total - q.total, p.total), hoursBack: p.totalHours - q.totalHours,
    year: (() => { const pp = 12 * (m * p.staff + (m > 0 ? p.seat : 0)), rr = 12 * m * q.total; return { checks: 12 * m, people: pp, rail: rr, save: pp - rr, hoursBack: 12 * m * (p.totalHours - q.totalHours) }; })() };
}
