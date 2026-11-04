// src/years.mjs — the cost case carried over the years, in the shape of liveware's mintcase: one check's people and rail
// costs (from src/cost.mjs, counted from this run's own records) at the reader's own number of checks a month, held for
// the reader's own number of years, rising by UK CPI every later year. CPI and the Microsoft 365 Copilot seat are read
// from the vendored, sourced basis (vendor/sovereign-enterprise/data/basis.json, byte for byte); the ChatGPT Business
// seat comes in from the price lock through src/cost.mjs. CPI is applied to both sides, the rail included, which counts
// against the rail. Staff hours are not inflated. No price of ours appears here: these are the buyer's own costs.
// Pure, total, deterministic (integer powers by repeated multiplication): garbage in gives { ok: false, why }, never a throw.

export const DEFAULTS = Object.freeze({ checksPerMonth: 1, years: 3, seat: 'chatgpt' });
export const BASIS_KEYS = Object.freeze(['cpi', 'seat.copilot']);
export const SEATS = Object.freeze(['chatgpt', 'copilot']);

const isNum = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const r2 = (x) => Math.round(x * 100) / 100;

/** where each basis figure came from, for the page to list beside the numbers */
export function sourcesOf(basis) {
  try { return BASIS_KEYS.map((k) => ({ key: k, what: basis[k].what || basis[k].product, value: basis[k].value, source: basis[k].source })); } catch { return []; }
}

/** a yearly cost carried over `years`, rising by CPI each year after the first */
export function over(perYear, cpi, years) {
  let total = 0, factor = 1;
  for (let y = 0; y < years; y++) { total += perYear * factor; factor *= 1 + cpi; }
  return r2(total);
}

/** perCheck: { peopleStaff, peopleHours, seats, chatgptSeat, railTotal, railHours } (one check, from src/cost.mjs);
 *  input (all optional, defaults above): checksPerMonth (whole, 1 to 500), years (whole, 1 to 10), seat ('chatgpt' | 'copilot') */
export function yearsCase(perCheck, basis, input) {
  try {
    const b = basis || {}, cpi = (b.cpi || {}).value, copilot = (b['seat.copilot'] || {}).value;
    if (!isNum(cpi) || !isNum(copilot)) return { ok: false, why: 'a sourced basis with every figure the case reads' };
    const c = perCheck || {};
    if (!['peopleStaff', 'peopleHours', 'chatgptSeat', 'railTotal', 'railHours'].every((k) => isNum(c[k]))) return { ok: false, why: 'one check\'s costs: numbers' };
    if (!Number.isInteger(c.seats) || c.seats < 0) return { ok: false, why: 'seats: a whole number' };
    const i = { ...DEFAULTS, ...(input || {}) };
    if (!Number.isInteger(i.checksPerMonth) || i.checksPerMonth < 1 || i.checksPerMonth > 500) return { ok: false, why: 'checks a month: 1 to 500' };
    if (!Number.isInteger(i.years) || i.years < 1 || i.years > 10) return { ok: false, why: 'years: 1 to 10' };
    if (!SEATS.includes(i.seat)) return { ok: false, why: 'the seat: chatgpt or copilot' };
    const seatPerMonth = i.seat === 'copilot' ? copilot : c.chatgptSeat, checks = 12 * i.checksPerMonth;
    const perYear = { people: r2(checks * c.peopleStaff + 12 * c.seats * seatPerMonth), rail: r2(checks * c.railTotal) };
    const total = { people: over(perYear.people, cpi, i.years), rail: over(perYear.rail, cpi, i.years) };
    const hoursBackPerYear = r2(checks * (c.peopleHours - c.railHours));
    return { ok: true, inputs: i, cpi, seatPerMonth, checks, perYear, over: total, savingPerYear: r2(perYear.people - perYear.rail), savingOver: r2(total.people - total.rail),
      hoursBackPerYear, hoursBackOver: r2(hoursBackPerYear * i.years) };
  } catch { return { ok: false, why: 'the inputs could not be read' }; }
}

export default { DEFAULTS, BASIS_KEYS, SEATS, sourcesOf, over, yearsCase };
