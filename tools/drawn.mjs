#!/usr/bin/env node
// tools/drawn.mjs — the 144 passages the cards were grown from (each mind's 24 drawn FIT passages, in draw order), written
// out for the live page so a reader can open the passage behind any maxim without fetching the book. Derived from the
// texts alone; --check rebuilds it and says whether it matches.   node tools/drawn.mjs [--check] → data/drawn.json
import { writeFileSync } from 'node:fs';
import { stock, drawn, MINDS, sha, read } from './stock.mjs';

export const build = () => { const all = stock(); return { kind: 'bred-minds.drawn', v: 1, minds: MINDS.map((mind, k) => ({ mind, passages: drawn(all[mind], k) })) }; };

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/drawn.mjs');
if (isMain) {
  const text = JSON.stringify(build(), null, 1) + '\n';
  if (process.argv.includes('--check')) { if (read('data/drawn.json') !== text) { console.log('DRAWN PASSAGES DIFFER from the texts'); process.exit(1); } console.log('DRAWN PASSAGES REBUILT byte for byte · ' + sha(text).slice(0, 16)); }
  else { writeFileSync(new URL('../data/drawn.json', import.meta.url), text); console.log('drawn: ' + MINDS.length + ' minds × 24 passages · ' + text.length + ' chars'); }
}
