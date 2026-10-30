#!/usr/bin/env node
// tools/grow-maxims.mjs — organ 1, step 1: for each mind, its 24 drawn FIT passages sent to the local model with the
// sealed maxim prompt; every reply kept, with the hash of the prompt that asked for it, in data/local/maxims.json.
// Resumable: a reply already kept is not asked again. Nothing here gates or builds a card: that is tools/cards.mjs.
//   node tools/grow-maxims.mjs
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { stock, drawn, maximPrompt, OPTIONS, MINDS, textsMatch, sha, read } from './stock.mjs';
import { ask, provenance } from './ollama.mjs';

const OUT = new URL('../data/local/maxims.json', import.meta.url);
if (!textsMatch()) { console.log('a text is not the one data/sources.json records'); process.exit(1); }
mkdirSync(new URL('../data/local/', import.meta.url), { recursive: true });
const rec = existsSync(OUT) ? JSON.parse(read('data/local/maxims.json')) : { kind: 'bred-minds.local-maxims', v: 1, asked: await provenance(), options: OPTIONS.maxim, items: [] };
const have = new Set(rec.items.map((x) => x.mind + ':' + x.index)), all = stock(), t0 = Date.now();
for (const [k, mind] of MINDS.entries()) {
  for (const d of drawn(all[mind], k)) {
    if (have.has(mind + ':' + d.index)) continue;
    const prompt = maximPrompt(d.text), t = Date.now(), reply = await ask(prompt, OPTIONS.maxim);
    rec.items.push({ mind, index: d.index, prompt: sha(prompt).slice(0, 16), reply, seconds: Math.round((Date.now() - t) / 1000) });
    writeFileSync(OUT, JSON.stringify(rec, null, 1) + '\n');
    console.log(mind, d.index, Math.round((Date.now() - t) / 1000) + ' s');
  }
}
console.log('maxims: ' + rec.items.length + ' replies · ' + Math.round((Date.now() - t0) / 1000) + ' s this run');
