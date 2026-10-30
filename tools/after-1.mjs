#!/usr/bin/env node
// tools/after-1.mjs — organ 1, read after its measurement: where the trace model sent every one of the 200 answers. This
// is NOT a sealed claim: it was looked at after the receipt was committed, because B6 held while its mind-by-mind counts were
// uneven. It uses the same fitted model as the measurement (FIT passages only), so it rebuilds byte for byte from what is
// committed.   node tools/after-1.mjs [--check] → data/after/organ-1-lean.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { fit, attribute } from '../src/trace.mjs';
import { stock, MINDS, sha, read } from './stock.mjs';

/** for each group of answers (each card, each sham label, the base), how many the trace model gave to each mind */
export function lean(items = JSON.parse(read('data/local/perspectives.json')).items, all = stock()) {
  const model = fit(Object.fromEntries(MINDS.map((m) => [m, all[m].filter((p) => !p.test).map((p) => p.text)])), MINDS);
  const groups = [...MINDS.map((m) => ['card', m]), ...MINDS.map((m) => ['sham', m]), ['base', null]];
  return {
    kind: 'bred-minds.after', v: 1, organ: 1,
    note: 'Found after the measurement, not sealed: where the trace model (fitted on FIT passages only, as in the receipt) sent every answer.',
    receipt: sha(read('receipts/organ-1.json')).slice(0, 16),
    groups: groups.map(([kind, mind]) => {
      const sent = Object.fromEntries(MINDS.map((m) => [m, 0])), xs = items.filter((x) => x.kind === kind && x.mind === mind);
      for (const x of xs) { const to = attribute(model, x.reply); if (to) sent[to]++; }
      return { kind, mind, n: xs.length, sent };
    }),
  };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/after-1.mjs');
if (isMain) {
  const text = JSON.stringify(lean(), null, 1) + '\n';
  if (process.argv.includes('--check')) { if (read('data/after/organ-1-lean.json') !== text) { console.log('LEAN DIFFERS from the committed answers'); process.exit(1); } console.log('LEAN REBUILT byte for byte · ' + sha(text).slice(0, 16)); }
  else { mkdirSync(new URL('../data/after/', import.meta.url), { recursive: true }); writeFileSync(new URL('../data/after/organ-1-lean.json', import.meta.url), text); console.log('data/after/organ-1-lean.json · ' + sha(text).slice(0, 16)); }
}
