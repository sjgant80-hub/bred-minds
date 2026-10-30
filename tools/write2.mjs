#!/usr/bin/env node
// tools/write2.mjs — organ 2, step 2: the answers, each written by the local model to its sealed prompt and seed: organ 1's
// card prompt with a child card (questions 1 to 10, for every pair that grew a child), then with each naive cross. An
// answer that names a blocked word is asked once more with its seed + 1000; if it still names one it is kept and marked
// named. Every reply is kept with its prompt's hash in data/local/perspectives-2.json. Resumable.   node tools/write2.mjs
import { writeFileSync, existsSync } from 'node:fs';
import { blockedIn } from '../src/text.mjs';
import { cardPrompt, SEAL, sha, read } from './stock.mjs';
import { QUESTIONS, OPTIONS2, SEEDS2 } from './stock2.mjs';

const OUT = new URL('../data/local/perspectives-2.json', import.meta.url);

/** every answer organ 2 asks for, in the order it asks: { kind, pair, k, q, seed, prompt } */
export function plan2(c = JSON.parse(read('data/children.json'))) {
  const out = [];
  for (const p of c.pairs) if (p.child.grown) QUESTIONS.forEach((Q, i) => out.push({ kind: 'child', pair: p.pair, k: p.k, q: i + 1, seed: SEEDS2.child(p.k, i + 1), prompt: cardPrompt(p.child.card, Q) }));
  for (const p of c.pairs) QUESTIONS.forEach((Q, i) => out.push({ kind: 'cross', pair: p.pair, k: p.k, q: i + 1, seed: SEEDS2.cross(p.k, i + 1), prompt: cardPrompt(p.cross.card, Q) }));
  return out;
}
export const keyOf2 = (x) => x.kind + ':' + x.pair.join('+') + ':' + x.q;

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/write2.mjs');
if (isMain) {
  const { ask, provenance } = await import('./ollama.mjs');
  const rec = existsSync(OUT) ? JSON.parse(read('data/local/perspectives-2.json')) : { kind: 'bred-minds.local-perspectives-2', v: 1, asked: await provenance(), options: OPTIONS2.perspective, items: [] };
  const have = new Set(rec.items.map(keyOf2)), t0 = Date.now();
  for (const p of plan2()) {
    if (have.has(keyOf2(p))) continue;
    const t = Date.now(), first = await ask(p.prompt, { ...OPTIONS2.perspective, seed: p.seed });
    const again = blockedIn(first, SEAL.blocked) ? await ask(p.prompt, { ...OPTIONS2.perspective, seed: p.seed + SEEDS2.again }) : null;
    const reply = again ?? first;
    rec.items.push({ kind: p.kind, pair: p.pair, q: p.q, seed: p.seed, prompt: sha(p.prompt).slice(0, 16), reply, named: blockedIn(reply, SEAL.blocked), ...(again === null ? {} : { first }), seconds: Math.round((Date.now() - t) / 1000) });
    writeFileSync(OUT, JSON.stringify(rec, null, 1) + '\n');
    console.log(p.kind, p.pair.join('+'), p.q, Math.round((Date.now() - t) / 1000) + ' s' + (again === null ? '' : ' (asked again)'));
  }
  console.log('answers: ' + rec.items.length + ' · ' + Math.round((Date.now() - t0) / 1000) + ' s this run');
}
