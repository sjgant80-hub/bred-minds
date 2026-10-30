#!/usr/bin/env node
// tools/breed.mjs — organ 2, step 1: for each of the 15 pairs, the two parent cards sent to the local model with the
// sealed breeding prompt; every reply kept, with the hash of the prompt that asked for it, in data/local/children.json.
// Resumable. When all 15 are in, the children and the naive crosses are grown from the replies into data/children.json.
//   node tools/breed.mjs            ask what is missing, then grow
//   node tools/breed.mjs --check    the children rebuild byte for byte from the committed replies
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { sha, read } from './stock.mjs';
import { PAIRS, OPTIONS2, parents, breedPrompt, children } from './stock2.mjs';

const OUT = new URL('../data/local/children.json', import.meta.url), BUILT = new URL('../data/children.json', import.meta.url);
const text = () => JSON.stringify(children(), null, 1) + '\n';

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/breed.mjs');
if (isMain && process.argv.includes('--check')) {
  const t = text();
  if (read('data/children.json') !== t) { console.log('CHILDREN DIFFER from the committed replies'); process.exit(1); }
  console.log('CHILDREN REBUILT byte for byte · ' + sha(t).slice(0, 16));
} else if (isMain) {
  const { ask, provenance } = await import('./ollama.mjs');
  mkdirSync(new URL('../data/local/', import.meta.url), { recursive: true });
  const rec = existsSync(OUT) ? JSON.parse(read('data/local/children.json')) : { kind: 'bred-minds.local-children', v: 1, asked: await provenance(), options: OPTIONS2.breed, items: [] };
  const have = new Set(rec.items.map((x) => x.pair.join('+'))), P = parents(), t0 = Date.now();
  for (const pair of PAIRS) {
    if (have.has(pair.join('+'))) continue;
    const prompt = breedPrompt(P[pair[0]], P[pair[1]]), t = Date.now(), reply = await ask(prompt, OPTIONS2.breed);
    rec.items.push({ pair, prompt: sha(prompt).slice(0, 16), reply, seconds: Math.round((Date.now() - t) / 1000) });
    writeFileSync(OUT, JSON.stringify(rec, null, 1) + '\n');
    console.log(pair.join(' + '), Math.round((Date.now() - t) / 1000) + ' s');
  }
  console.log('children asked: ' + rec.items.length + ' of ' + PAIRS.length + ' · ' + Math.round((Date.now() - t0) / 1000) + ' s this run');
  if (rec.items.length === PAIRS.length) {
    const t = text(), c = JSON.parse(t);
    writeFileSync(BUILT, t);
    for (const p of c.pairs) console.log(p.pair.join(' + ') + ': ' + p.child.steps.filter((s) => s.ok).length + ' of ' + p.child.steps.length + ' kept' + (p.child.grown ? '' : ' — NO CHILD'));
  }
}
