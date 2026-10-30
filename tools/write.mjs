#!/usr/bin/env node
// tools/write.mjs — organ 1, step 3: the 200 perspectives, each written by the local model to its sealed prompt and seed:
// 20 questions from each grown card, the 20 questions from no card at all (the base), and the first 10 questions from
// each of the six sham cards. A perspective that names a blocked word is asked once more with its seed + 1000; if it still
// names one it is kept and marked named. Every reply is kept with its prompt's hash in data/local/perspectives.json.
// Resumable.   node tools/write.mjs
import { writeFileSync, existsSync } from 'node:fs';
import { blockedIn } from '../src/text.mjs';
import { cardPrompt, basePrompt, OPTIONS, SEAL, SEEDS, MINDS, sha, read } from './stock.mjs';
import { ask, provenance } from './ollama.mjs';

const OUT = new URL('../data/local/perspectives.json', import.meta.url), Q = SEAL.questions;

/** every perspective organ 1 asks for, in the order it asks: { kind, mind, q, seed, prompt } */
export function plan(c = JSON.parse(read('data/cards.json'))) {
  const out = [];
  for (const [k, m] of c.minds.entries()) if (m.grown) for (let q = 1; q <= 20; q++) out.push({ kind: 'card', mind: m.mind, q, seed: SEEDS.card(k, q), prompt: cardPrompt(m.card, Q[q - 1]) });
  for (let q = 1; q <= 20; q++) out.push({ kind: 'base', mind: null, q, seed: SEEDS.base(q), prompt: basePrompt(Q[q - 1]) });
  for (const [k, s] of c.shams.entries()) for (let q = 1; q <= 10; q++) out.push({ kind: 'sham', mind: MINDS[k], q, seed: SEEDS.sham(k, q), prompt: cardPrompt(s.card, Q[q - 1]) });
  return out;
}
export const keyOf = (x) => x.kind + ':' + x.mind + ':' + x.q;

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/write.mjs');
if (isMain) {
  const rec = existsSync(OUT) ? JSON.parse(read('data/local/perspectives.json')) : { kind: 'bred-minds.local-perspectives', v: 1, asked: await provenance(), options: OPTIONS.perspective, items: [] };
  const have = new Set(rec.items.map(keyOf)), t0 = Date.now();
  for (const p of plan()) {
    if (have.has(keyOf(p))) continue;
    const t = Date.now(), first = await ask(p.prompt, { ...OPTIONS.perspective, seed: p.seed });
    const again = blockedIn(first, SEAL.blocked) ? await ask(p.prompt, { ...OPTIONS.perspective, seed: p.seed + SEEDS.again }) : null;
    const reply = again ?? first;
    rec.items.push({ kind: p.kind, mind: p.mind, q: p.q, seed: p.seed, prompt: sha(p.prompt).slice(0, 16), reply, named: blockedIn(reply, SEAL.blocked), ...(again === null ? {} : { first }), seconds: Math.round((Date.now() - t) / 1000) });
    writeFileSync(OUT, JSON.stringify(rec, null, 1) + '\n');
    console.log(p.kind, p.mind, p.q, Math.round((Date.now() - t) / 1000) + ' s' + (again === null ? '' : ' (asked again)'));
  }
  console.log('perspectives: ' + rec.items.length + ' · ' + Math.round((Date.now() - t0) / 1000) + ' s this run');
}
