// page.test.mjs — the live page keeps its word. (1) No measured result is typed into index.html or page/app.mjs: each is
// read from the committed records as the page loads, so a re-run that changed a number could never leave an old one on
// the page. (2) Every number typed into the page's prose is a design number found in the seals or the sources, or one of
// the few page facts named below with its reason. (3) The page works offline after one visit: the service worker keeps
// every module the page imports and every record it reads on load, and every file it keeps exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const json = (p) => JSON.parse(read(p));
const HTML = read('index.html'), APP = read('page/app.mjs'), SW = read('sw.js');

/** the measured results, as the page would print them: "k of n" (and "k times in n") and bare numbers */
function measured() {
  const r1 = json('receipts/organ-1.json'), r2 = json('receipts/organ-2.json'), cards = json('data/cards.json'), maxims = json('data/local/maxims.json');
  const perspectives2 = json('data/local/perspectives-2.json'), d = r1.detail, pp = r2.detail.perPair;
  const kOfN = [d.cardJudge, d.shamJudge, d.cardTrace].map((x) => [x.k, x.n]);
  const n2 = perspectives2.items.filter((x) => x.kind === 'cross').length;
  const sum = (f) => pp.reduce((a, x) => a + f(x), 0);
  kOfN.push([sum((x) => (x.grown ? x.child : 0)), n2], [sum((x) => x.cross), n2], [sum((x) => (x.grown ? x.trace : 0)), n2], [sum((x) => x.both), sum((x) => x.kept)]);
  const b7 = /base ([\d.]+).*cards ([\d.]+)/.exec(r1.verdicts.find((v) => v.id === 'B7').measured);
  const bare = [Number(b7[1]).toFixed(1), Number(b7[2]).toFixed(1), String(cards.minds.reduce((a, m) => a + m.kept, 0)), String(maxims.items.length)];
  return { kOfN, bare };
}

test('the page\'s scripts parse (a broken script would leave every section empty)', () => {
  for (const f of ['page/app.mjs', 'page/boot.js', 'sw.js']) {
    const r = spawnSync(process.execPath, ['--check', fileURLToPath(new URL('../' + f, import.meta.url))], { encoding: 'utf8' });
    assert.equal(r.status, 0, f + ': ' + r.stderr);
  }
});

test('no measured result is typed into the page: each is read from the records as it loads', () => {
  const { kOfN, bare } = measured();
  assert.equal(kOfN.length, 7);
  assert.deepEqual(bare, ['80.7', '13.4', '126', '144']);
  const typed = [];
  for (const [f, t] of [['index.html', HTML], ['page/app.mjs', APP]]) {
    for (const [k, n] of kOfN) if (new RegExp('(?<![\\d.])' + k + '\\s+(?:of|times in|in)\\s+' + n + '(?!\\d)').test(t)) typed.push(f + ': ' + k + ' of ' + n);
    for (const x of bare) if (new RegExp('(?<![\\d.,])' + x.replace('.', '\\.') + '(?!\\d|[.,]\\d)').test(t)) typed.push(f + ': ' + x);
  }
  assert.deepEqual(typed, []);
});

test('the check above would catch a typed-in result', () => {
  const { kOfN } = measured(), [k, n] = kOfN[0];
  assert.ok(new RegExp('(?<![\\d.])' + k + '\\s+(?:of|times in|in)\\s+' + n + '(?!\\d)').test('the judge named ' + k + ' times in ' + n + ' answers'));
});

/** every number in the seals and the sources, including those inside their strings */
function designNumbers() {
  const out = new Set(), walk = (v) => {
    if (typeof v === 'number') out.add(String(v));
    else if (typeof v === 'string') for (const m of v.matchAll(/\d+(?:\.\d+)?/g)) out.add(m[0]);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  for (const f of ['claims/organ-1.json', 'claims/organ-2.json', 'claims/organ-2-amend.json', 'data/sources.json']) walk(json(f));
  return out;
}

/** the page facts that are not in a seal, each with why it is true */
const FACTS = {
  '0.33': 'the worked balance example on the page: 20 ÷ 60, rounded to two places (checked below)',
  '4.7': 'the download size of qwen2.5:7b, as `ollama list` reports it for the digest the receipts name',
  '1255': 'part of the laptop chip\'s model name, Intel Core i7-1255U, the chip data/prices.lock.json prices',
  '2.0': 'the version of the Apache License that qwen2.5:7b\'s own manifest names (`ollama show qwen2.5:7b --license`)',
};

test('every number typed into the page\'s prose is a design number from the seals or the sources, or a named page fact', () => {
  assert.equal((20 / 60).toFixed(2), '0.33');
  assert.ok(JSON.stringify(json('data/prices.lock.json')).includes('i7-1255U'));
  const prose = HTML.replace(/<head>[\s\S]*?<\/head>/, '').replace(/<pre>[\s\S]*?<\/pre>/g, '').replace(/<code>[\s\S]*?<\/code>/g, '').replace(/<[^>]+>/g, ' ');
  const seal = designNumbers(), stray = [];
  for (const m of prose.matchAll(/(?<![\w.])\d+(?:[.,]\d+)*/g)) { const x = m[0].replace(/,/g, ''); if (!seal.has(x) && !FACTS[x]) stray.push(m[0]); }
  assert.deepEqual([...new Set(stray)], []);
});

/** what the page imports (following src/ and vendor/ imports) and what it reads on load */
function pageNeeds() {
  const need = new Set(), seen = new Set(), stack = ['page/app.mjs'];
  while (stack.length) {
    const f = stack.pop(); if (seen.has(f)) continue; seen.add(f); need.add(f);
    const dir = f.split('/').slice(0, -1);
    for (const m of read(f).matchAll(/^import\s[^;]*?from\s+'(\.{1,2}\/[^']+)'/gm)) {
      const parts = [...dir]; for (const p of m[1].split('/')) { if (p === '..') parts.pop(); else if (p !== '.') parts.push(p); }
      stack.push(parts.join('/'));
    }
  }
  for (const m of APP.matchAll(/get(?:JSON|Text)\('([^']+)'\)/g)) need.add(m[1]);
  for (const m of APP.matchAll(/'(data\/judge2?\/batch-)' \+ n \+ '(\.json|\.prompt\.txt)'/g)) {
    const dir = m[1].slice(0, m[1].lastIndexOf('/')), ext = m[2];
    for (const f of readdirSync(new URL('../' + dir + '/', import.meta.url))) if (/^batch-\d+/.test(f) && f.endsWith(ext) && f.split('.').length === ext.split('.').length) need.add(dir + '/' + f);
  }
  return need;
}

test('the page works offline after one visit: the service worker keeps every module and record the page loads', () => {
  const expr = (/const SHELL = (\[[\s\S]*?\]);\nself\.addEventListener/.exec(SW) || [, '[]'])[1];
  const shell = new Set(new Function('return ' + expr)());          // sw.js's own list, evaluated as the worker would
  assert.ok(shell.size > 30, 'sw.js SHELL read');
  const need = pageNeeds();
  assert.ok(need.has('src/breed.mjs') && need.has('vendor/seed-library/seedlib.mjs') && need.has('receipts/organ-2.json') && need.has('data/judge2/batch-8.json') && need.has('data/judge/batch-4.prompt.txt'));
  assert.ok(!need.has('data/judge2/batch-1.prompt.txt'), 'organ 2\'s prompts are not read by the page');
  for (const f of ['index.html', 'page/page.css', 'page/boot.js', 'manifest.webmanifest', 'page/icon.svg']) need.add(f);
  assert.deepEqual([...need].filter((f) => !shell.has(f)).sort(), [], 'missing from sw.js SHELL');
  assert.deepEqual([...shell].filter((f) => f !== './' && !existsSync(new URL('../' + f, import.meta.url))), [], 'SHELL names a file that does not exist');
});
