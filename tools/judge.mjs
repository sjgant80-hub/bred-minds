#!/usr/bin/env node
// tools/judge.mjs — organ 1, step 4: the cold judge's batches. The 200 perspectives, in one order shuffled by the seed
// library (seed 4242), in four batches of 50; each batch's prompt is the sealed one, then its passages, each on one line.
// Nothing in a batch says which card, if any, wrote a passage: which perspective sits where is kept in data/judge/order.json,
// never shown. A fresh subagent reads one prompt file and writes one reply file; this records the reply.
//   node tools/judge.mjs prompts                 → data/judge/batch-<n>.prompt.txt, data/judge/order.json
//   node tools/judge.mjs record <n> <reply file> → data/judge/batch-<n>.json
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { shuffle } from '../src/text.mjs';
import { readReply } from '../src/judge.mjs';
import { SEAL, SEEDS, sha, read } from './stock.mjs';
import { keyOf } from './write.mjs';

export const BATCH = 50;

/** the sealed head of every batch */
export const HEAD = (() => { const p = SEAL.judge.prompt, a = p.indexOf("'") + 1; return p.slice(a, p.indexOf("' then the 50 passages", a)); })();

/** the perspectives in judging order: the plan's keys, shuffled */
export function order(items = JSON.parse(read('data/local/perspectives.json')).items) {
  return shuffle(items.map(keyOf), SEEDS.judge);
}

/** batch b's prompt (b from 0): the head, then its 50 passages, each "<n>. <passage>" on one line */
export function batchPrompt(items, keys, b) {
  const by = new Map(items.map((x) => [keyOf(x), x]));
  return HEAD + '\n\n' + keys.slice(b * BATCH, (b + 1) * BATCH).map((k, i) => (i + 1) + '. ' + String(by.get(k).reply).replace(/\s+/g, ' ').trim()).join('\n');
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/judge.mjs');
if (isMain) {
  const [what, n, file] = process.argv.slice(2), items = JSON.parse(read('data/local/perspectives.json')).items, keys = order(items);
  mkdirSync(new URL('../data/judge/', import.meta.url), { recursive: true });
  if (what === 'prompts') {
    if (items.length !== 200) { console.log('perspectives: ' + items.length + ' of 200 written'); process.exit(1); }
    writeFileSync(new URL('../data/judge/order.json', import.meta.url), JSON.stringify({ kind: 'bred-minds.judge-order', seed: SEEDS.judge, keys }, null, 1) + '\n');
    for (let b = 0; b < 4; b++) { const p = batchPrompt(items, keys, b); writeFileSync(new URL('../data/judge/batch-' + (b + 1) + '.prompt.txt', import.meta.url), p + '\n'); console.log('batch ' + (b + 1) + ': ' + p.length + ' chars · ' + sha(p).slice(0, 16)); }
  } else if (what === 'record' && /^[1-4]$/.test(n || '') && file) {
    const reply = readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), b = Number(n) - 1, prompt = batchPrompt(items, keys, b), readings = readReply(reply, BATCH);
    writeFileSync(new URL('../data/judge/batch-' + n + '.json', import.meta.url), JSON.stringify({ kind: 'bred-minds.judge-answers', v: 1, batch: Number(n), judge: { name: 'claude-opus-5-5', asked: 'a fresh Claude Code subagent, cold: this prompt only, no tools but reading its prompt and writing its reply' }, prompt: sha(prompt).slice(0, 16), reply }, null, 1) + '\n');
    console.log('recorded ' + readings.filter(Boolean).length + ' of 50 readable lines');
  } else { console.log('usage: node tools/judge.mjs prompts | record <1-4> <reply file>'); process.exit(2); }
}
