#!/usr/bin/env node
// tools/judge2.mjs — organ 2, step 3: the cold judge's batches. The child answers (10 for each pair that grew a child),
// the 150 cross answers and organ 1's 60 single answers (its card answers to questions 1 to 10), in one order shuffled by
// the seed library (seed 4343), in batches of 45, the eighth holding what is left (claims/organ-2-amend.json); each
// batch's prompt is the sealed head for its size, then its passages, each on one line. Nothing in a batch
// says which card, or what kind of card, wrote a passage: which answer sits where is kept in data/judge2/order.json.
//   node tools/judge2.mjs prompts                                 → data/judge2/batch-<n>.prompt.txt, order.json
//   node tools/judge2.mjs record <n> <reply file> <tokens> <tool uses>   → data/judge2/batch-<n>.json
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { shuffle } from '../src/text.mjs';
import { readReply } from '../src/judge.mjs';
import { sha, read } from './stock.mjs';
import { keyOf } from './write.mjs';
import { keyOf2 } from './write2.mjs';
import { BATCH2, SEEDS2, headFor } from './stock2.mjs';

export const BATCHES = 8;
/** how many answers organ 2's judge reads: the 60 single and 150 cross, and 10 for every pair that grew a child */
export const expected = (c = JSON.parse(read('data/children.json'))) => 60 + 150 + 10 * c.pairs.filter((p) => p.child.grown).length;
/** batch b's size: 45, the last holding what is left (claims/organ-2-amend.json) */
export const sizeOf = (n, b) => Math.max(0, Math.min(BATCH2, n - b * BATCH2));
const single = (x) => 'single:' + x.mind + ':' + x.q;

/** every answer organ 2's judge reads, by key: the child and cross answers, and organ 1's card answers to questions 1 to 10 */
export function answers2(items2 = JSON.parse(read('data/local/perspectives-2.json')).items, items1 = JSON.parse(read('data/local/perspectives.json')).items) {
  const out = new Map(items2.map((x) => [keyOf2(x), { ...x }]));
  for (const x of items1) if (x.kind === 'card' && x.q <= 10) out.set(single(x), { kind: 'single', mind: x.mind, q: x.q, reply: x.reply, named: x.named, from: keyOf(x) });
  return out;
}

/** the keys in judging order */
export const order2 = (all = answers2()) => shuffle([...all.keys()], SEEDS2.judge);

/** batch b's prompt (b from 0): the head for its size, then its passages, each "<n>. <passage>" on one line */
export function batchPrompt2(all, keys, b) {
  return headFor(sizeOf(keys.length, b)) + '\n\n' + keys.slice(b * BATCH2, (b + 1) * BATCH2).map((k, i) => (i + 1) + '. ' + String(all.get(k).reply).replace(/\s+/g, ' ').trim()).join('\n');
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/judge2.mjs');
if (isMain) {
  const [what, n, file, tokens, uses] = process.argv.slice(2), all = answers2(), keys = order2(all);
  mkdirSync(new URL('../data/judge2/', import.meta.url), { recursive: true });
  if (what === 'prompts') {
    if (all.size !== expected() || Math.ceil(all.size / BATCH2) !== BATCHES) { console.log('answers: ' + all.size + ' of ' + expected()); process.exit(1); }
    writeFileSync(new URL('../data/judge2/order.json', import.meta.url), JSON.stringify({ kind: 'bred-minds.judge-order-2', seed: SEEDS2.judge, keys }, null, 1) + '\n');
    for (let b = 0; b < BATCHES; b++) { const p = batchPrompt2(all, keys, b); writeFileSync(new URL('../data/judge2/batch-' + (b + 1) + '.prompt.txt', import.meta.url), p + '\n'); console.log('batch ' + (b + 1) + ': ' + p.length + ' chars · ' + sha(p).slice(0, 16)); }
  } else if (what === 'record' && /^[1-8]$/.test(n || '') && file && /^\d+$/.test(tokens || '') && /^\d+$/.test(uses || '')) {
    const reply = readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), prompt = batchPrompt2(all, keys, Number(n) - 1), size = sizeOf(keys.length, Number(n) - 1), readings = readReply(reply, size);
    writeFileSync(new URL('../data/judge2/batch-' + n + '.json', import.meta.url), JSON.stringify({ kind: 'bred-minds.judge-answers-2', v: 1, batch: Number(n), judge: { name: 'claude-opus-5-5', asked: 'a fresh Claude Code subagent, cold: it read only its batch file and wrote only its reply file', tokens: Number(tokens), toolUses: Number(uses) }, prompt: sha(prompt).slice(0, 16), reply }, null, 1) + '\n');
    console.log('recorded ' + readings.filter(Boolean).length + ' of ' + size + ' readable lines');
  } else { console.log('usage: node tools/judge2.mjs prompts | record <1-8> <reply file> <tokens> <tool uses>'); process.exit(2); }
}
