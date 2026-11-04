#!/usr/bin/env node
// tools/witness-check.mjs — the page's Blueprint table reads data/witness.json. On GitHub's runner each kernel's fresh
// mutation-gate report is held against that record, so the counts on the page are the counts the runner found.
//   node tools/witness-check.mjs <kernel> <report file>   exit 1 unless the report is clean and its total and killed match
//   node tools/witness-check.mjs --kernels                exit 1 unless every src/*.mjs kernel has exactly one entry
import { readFileSync, readdirSync } from 'node:fs';

const rec = JSON.parse(readFileSync(new URL('../data/witness.json', import.meta.url), 'utf8'));
const [what, file] = process.argv.slice(2);
const fail = (why) => { console.log('WITNESS RECORD MISMATCH · ' + why); process.exit(1); };

if (what === '--kernels') {
  const src = readdirSync(new URL('../src/', import.meta.url)).filter((f) => f.endsWith('.mjs')).map((f) => f.slice(0, -4)).sort();
  const listed = rec.kernels.map((k) => k.kernel).sort();
  if (JSON.stringify(src) !== JSON.stringify(listed)) fail('src/ has ' + src.join(',') + ' but data/witness.json lists ' + listed.join(','));
  const killed = rec.kernels.reduce((a, k) => a + k.killed, 0), total = rec.kernels.reduce((a, k) => a + k.total, 0);
  if (killed !== rec.killed || total !== rec.total) fail('the totals ' + rec.killed + '/' + rec.total + ' are not the sum of the kernels ' + killed + '/' + total);
  console.log('WITNESS RECORD covers every kernel · ' + killed + '/' + total);
} else if (what && file) {
  const text = readFileSync(file, 'utf8'), m = /\{[\s\S]*\}/.exec(text);
  if (!m) fail('no report in ' + file);
  const r = JSON.parse(m[0]), k = rec.kernels.find((x) => x.kernel === what);
  if (!k) fail(what + ' is not in data/witness.json');
  if (r.clean !== true || (r.survived || []).length) fail(what + ' is not clean');
  if (r.total !== k.total || r.killed !== k.killed) fail(what + ': the runner found ' + r.killed + '/' + r.total + ', the record says ' + k.killed + '/' + k.total);
  console.log('WITNESS RECORD matches · ' + what + ' ' + r.killed + '/' + r.total);
} else { console.log('usage: node tools/witness-check.mjs <kernel> <report file> | --kernels'); process.exit(2); }
