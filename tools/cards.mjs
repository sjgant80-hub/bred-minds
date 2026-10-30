#!/usr/bin/env node
// tools/cards.mjs — organ 1, step 2: each mind's card grown from its drawn passages and the local model's committed
// replies (data/local/maxims.json), through the gate (src/card.mjs); then the six sham cards, each of 12 maxims pooled
// from every grown card and two cards' voices, labelled with a mind. Deterministic: the cards rebuild byte for byte from
// the committed replies.   node tools/cards.mjs [--check] → data/cards.json
import { writeFileSync } from 'node:fs';
import { grow, sham } from '../src/card.mjs';
import { stock, drawn, maximPrompt, MINDS, SEAL, SEEDS, sha, read } from './stock.mjs';

/** the cards, from the replies given (a reply missing for a drawn passage stops the build: the card would differ) */
export function cards(replies = JSON.parse(read('data/local/maxims.json')), all = stock()) {
  const byKey = new Map(replies.items.map((x) => [x.mind + ':' + x.index, x]));
  const minds = MINDS.map((mind, k) => {
    const ds = drawn(all[mind], k), rs = ds.map((d) => byKey.get(mind + ':' + d.index));
    if (rs.some((r) => !r)) throw new Error('no reply kept for ' + mind + ' passage ' + ds[rs.findIndex((r) => !r)].index);
    const g = grow(mind, ds, rs.map((r) => r.reply), SEAL.blocked);
    return { mind, promptsMatch: rs.every((r, i) => r.prompt === sha(maximPrompt(ds[i].text)).slice(0, 16)), ...g };
  });
  const grown = minds.filter((m) => m.grown).map((m) => m.card);
  const shams = MINDS.map((mind, k) => ({ mind, ...sham(mind, grown, SEEDS.shamDraw(k)) }));
  return { kind: 'bred-minds.cards', v: 1, asked: replies.asked, minds: minds.map(({ mind, grown: g, card, id, steps, promptsMatch }) => ({ mind, grown: g, id, promptsMatch, kept: steps.filter((s) => s.kept).length, steps, card })), shams };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/cards.mjs');
if (isMain) {
  const text = JSON.stringify(cards(), null, 1) + '\n';
  if (process.argv.includes('--check')) { if (read('data/cards.json') !== text) { console.log('CARDS DIFFER from the committed replies'); process.exit(1); } console.log('CARDS REBUILT byte for byte · ' + sha(text).slice(0, 16)); }
  else { writeFileSync(new URL('../data/cards.json', import.meta.url), text); const c = JSON.parse(text); console.log(c.minds.map((m) => m.mind + ' ' + m.kept + ' kept' + (m.grown ? '' : ' (not grown)')).join(' · ')); }
}
