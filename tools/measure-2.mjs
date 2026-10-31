#!/usr/bin/env node
// tools/measure-2.mjs — organ 2 measured against its sealed claims (claims/organ-2.json), from what is committed: organ 1's
// cards and answers, the local model's breeding replies and answers (data/local/), the children and crosses they grow, and
// the cold judge's replies (data/judge2/). Nothing is asked of any model here, so the receipt re-derives byte for byte
// anywhere. It refuses to run if the claims differ from the commit that sealed them, and names that commit.
//   node tools/measure-2.mjs [--check] → receipts/organ-2.json
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fit, scores } from '../src/trace.mjs';
import { readReply } from '../src/judge.mjs';
import { diffLow, wilson } from '../src/stats.mjs';
import { blockedIn } from '../src/text.mjs';
import { childGate, carries, balance, topTwo, samePair, control } from '../src/breed.mjs';
import { stock, SEAL, MINDS, sha, read } from './stock.mjs';
import { measure } from './measure-1.mjs';
import { PAIRS, BATCH2, parents, breedPrompt, children } from './stock2.mjs';
import { plan2, keyOf2 } from './write2.mjs';
import { answers2, order2, batchPrompt2, BATCHES } from './judge2.mjs';

const ROOT = new URL('../', import.meta.url);
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const r6 = (x) => (x === null ? null : Math.round(x * 1e6) / 1e6);
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

/** the commit that sealed organ 2's claims, and whether they are unchanged since */
function sealed() {
  const touched = git('log', '--format=%H', '--', 'claims/organ-2.json').split('\n').filter(Boolean);
  const unchanged = touched.length === 1 && git('status', '--porcelain', '--', 'claims/organ-2.json') === '';
  return { commit: touched[touched.length - 1] || null, unchanged };
}

/** the commit that added organ 2's amendment, and whether it is unchanged since (null when there is none) */
function amended() {
  const touched = git('log', '--format=%H', '--', 'claims/organ-2-amend.json').split('\n').filter(Boolean);
  if (!touched.length) return null;
  return { commit: touched[touched.length - 1], unchanged: touched.length === 1 && git('status', '--porcelain', '--', 'claims/organ-2-amend.json') === '' };
}

/** whether organ 1's files are what they were at organ 2's seal */
const organ1Unchanged = (commit) => ['data/cards.json', 'data/local/perspectives.json', 'receipts/organ-1.json'].every((f) => git('diff', '--name-only', commit, '--', f) === '' && git('status', '--porcelain', '--', f) === '');

export function measure2() {
  const s = sealed();
  if (!s.unchanged) throw new Error('claims/organ-2.json differs from the commit that sealed it');
  const am = amended();
  if (am && !am.unchanged) throw new Error('claims/organ-2-amend.json differs from the commit that added it');
  const SEAL2 = JSON.parse(read('claims/organ-2.json'));
  // D1, piece by piece
  const o1Files = organ1Unchanged(s.commit), o1Receipt = JSON.stringify(measure(), null, 1) + '\n' === read('receipts/organ-1.json');
  const all = stock(), scrambled = stock(true), fitOf = (st) => fit(Object.fromEntries(MINDS.map((m) => [m, st[m].filter((p) => !p.test).map((p) => p.text)])), MINDS);
  const modelId = (m) => sha(JSON.stringify([[...m.vocab].sort(), m.minds.map((x) => [...m.logp.get(x).known].sort(([a], [b]) => (a < b ? -1 : 1)))]));
  const model = fitOf(all), sameModel = modelId(fitOf(scrambled)) === modelId(model);
  const P = parents(), raw = JSON.parse(read('data/local/children.json')), C = children(raw.items, P), built = JSON.stringify(C, null, 1) + '\n';
  const breedMatch = raw.items.length === PAIRS.length && PAIRS.every((pair) => { const x = raw.items.find((i) => i.pair.join('+') === pair.join('+')); return x && x.prompt === sha(breedPrompt(P[pair[0]], P[pair[1]])).slice(0, 16); });
  const maximOf = (c) => c.maxims.map((m) => m.maxim);
  const gated = C.pairs.every((p) => !p.child.grown || p.child.card.maxims.every((m) => childGate(m.maxim, maximOf(P[p.pair[0]]), maximOf(P[p.pair[1]]), SEAL.blocked).ok));
  const R = JSON.parse(read('data/local/perspectives-2.json')), items2 = R.items, by2 = new Map(items2.map((x) => [keyOf2(x), x])), want = plan2(C);
  const answersMatch = want.length === items2.length && want.every((p) => by2.has(keyOf2(p)) && by2.get(keyOf2(p)).prompt === sha(p.prompt).slice(0, 16) && by2.get(keyOf2(p)).seed === p.seed);
  const namesApplied = items2.every((x) => x.named === blockedIn(x.reply, SEAL.blocked) && (x.first === undefined || blockedIn(x.first, SEAL.blocked)) && (!blockedIn(x.reply, SEAL.blocked) || x.first !== undefined));
  const A = answers2(items2), keys = order2(A);
  const batches = Array.from({ length: BATCHES }, (_, b) => (existsSync(new URL('data/judge2/batch-' + (b + 1) + '.json', ROOT)) ? JSON.parse(read('data/judge2/batch-' + (b + 1) + '.json')) : null));
  const judgeMatch = batches.every((b, i) => b && b.prompt === sha(batchPrompt2(A, keys, i)).slice(0, 16));
  const reading = new Map(keys.map((k, i) => { const b = batches[Math.floor(i / BATCH2)]; return [k, b ? readReply(b.reply, BATCH2)[i % BATCH2] : null]; }));
  const readable = [...reading.values()].filter(Boolean).length;
  // the values: carried, balance and the trace model's pair, for each child and cross answer; the control for each single
  const grown = new Map(C.pairs.map((p) => [p.pair.join('+'), p.child.grown]));
  const val = (kind, pair, q, f) => { const x = A.get(kind + ':' + pair.join('+') + ':' + q); return x && !x.named ? f(reading.get(kind + ':' + pair.join('+') + ':' + q), x) : 0; };
  const carriedF = (pair) => (p) => (carries(p, pair[0], pair[1]) ? 1 : 0);
  const childC = PAIRS.flatMap((pair) => Array.from({ length: 10 }, (_, i) => (grown.get(pair.join('+')) ? val('child', pair, i + 1, carriedF(pair)) : 0)));
  const crossC = PAIRS.flatMap((pair) => Array.from({ length: 10 }, (_, i) => val('cross', pair, i + 1, carriedF(pair))));
  const balF = (pair) => (p) => balance(p, pair[0], pair[1]);
  const childB = PAIRS.flatMap((pair) => Array.from({ length: 10 }, (_, i) => (grown.get(pair.join('+')) ? val('child', pair, i + 1, balF(pair)) : 0)));
  const crossB = PAIRS.flatMap((pair) => Array.from({ length: 10 }, (_, i) => val('cross', pair, i + 1, balF(pair))));
  const traceF = (pair) => (_, x) => (samePair(topTwo(scores(model, x.reply), MINDS), pair[0], pair[1]) ? 1 : 0);
  const childT = PAIRS.flatMap((pair) => Array.from({ length: 10 }, (_, i) => (grown.get(pair.join('+')) ? val('child', pair, i + 1, traceF(pair)) : 0)));
  const singles = [...A.entries()].filter(([, x]) => x.kind === 'single');
  const ctrlJ = singles.map(([k, x]) => (x.named ? 0 : control(x.mind, PAIRS, (a, b) => carries(reading.get(k), a, b))));
  const ctrlT = singles.map(([, x]) => { const t = topTwo(scores(model, x.reply), MINDS); return x.named ? 0 : control(x.mind, PAIRS, (a, b) => samePair(t, a, b)); });
  // D2, D3
  const kept = C.pairs.map((p) => p.child.steps.filter((x) => x.ok)), keptAll = kept.flat(), both = keptAll.filter((x) => x.both).length;
  // D4–D7
  const lowJ = diffLow(childC, ctrlJ, 2000, 99), lowX = diffLow(childC, crossC, 2000, 99), lowB = diffLow(childB, crossB, 2000, 99), lowT = diffLow(childT, ctrlT, 2000, 99);
  const childW = wilson(childC.reduce((a, b) => a + b, 0), childC.length);
  const D = {
    D1: { held: o1Files && o1Receipt && sameModel && gated && built === read('data/children.json') && breedMatch && answersMatch && judgeMatch && namesApplied,
      measured: 'organ 1 unchanged since the seal ' + o1Files + '; organ 1 receipt re-derives ' + o1Receipt + '; TEST never read ' + sameModel + '; every kept child maxim passes the gate ' + gated + '; children rebuild byte for byte ' + (built === read('data/children.json')) + '; breeding asked to its sealed prompts ' + breedMatch + '; ' + items2.length + ' answers to their sealed prompts and seeds ' + answersMatch + ' (' + items2.filter((x) => x.first !== undefined).length + ' asked again, ' + items2.filter((x) => x.named).length + ' still named); judge batches to their sealed prompts ' + judgeMatch + ' (' + readable + ' of ' + keys.length + ' lines readable); the name rule applied ' + namesApplied },
    D2: { held: C.pairs.every((p) => p.child.grown), measured: C.pairs.map((p, i) => p.pair.join('+') + ' ' + kept[i].length + ' of ' + p.child.steps.length).join(', ') },
    D3: { held: keptAll.length > 0 && both / keptAll.length >= 0.5, measured: both + ' of ' + keptAll.length + ' kept child maxims draw on both parents (' + r6(keptAll.length ? both / keptAll.length : 0) + ')' },
    D4: { held: !!childW && childW.rate >= 0.4 && lowJ !== null && lowJ > 0, measured: 'child answers carried both parents ' + childC.reduce((a, b) => a + b, 0) + ' of ' + childC.length + ' (' + (childW ? r6(childW.rate) : '—') + '); control mean ' + r6(mean(ctrlJ)) + ' over ' + ctrlJ.length + ' single answers; difference lower bound ' + r6(lowJ) },
    D5: { held: lowX !== null && lowX > -0.1, measured: 'child ' + r6(mean(childC)) + ' against cross ' + r6(mean(crossC)) + ' (' + crossC.reduce((a, b) => a + b, 0) + ' of ' + crossC.length + '); difference lower bound ' + r6(lowX) },
    D6: { held: lowB !== null && lowB > 0, measured: 'mean balance: child ' + r6(mean(childB)) + ' against cross ' + r6(mean(crossB)) + '; difference lower bound ' + r6(lowB) },
    D7: { held: lowT !== null && lowT > 0, measured: 'the trace model named both parents on ' + childT.reduce((a, b) => a + b, 0) + ' of ' + childT.length + ' child answers (' + r6(mean(childT)) + '); control mean ' + r6(mean(ctrlT)) + '; difference lower bound ' + r6(lowT) },
  };
  const verdicts = SEAL2.claims.map((c) => ({ id: c.id, kind: c.kind, claim: c.claim, held: D[c.id].held === true, measured: D[c.id].measured }));
  const perPair = PAIRS.map((pair, k) => { const sl = (xs) => xs.slice(k * 10, k * 10 + 10); const sum = (xs) => sl(xs).reduce((a, b) => a + b, 0);
    return { pair, kept: kept[k].length, both: kept[k].filter((x) => x.both).length, grown: C.pairs[k].child.grown, child: sum(childC), cross: sum(crossC), childBalance: r6(mean(sl(childB))), crossBalance: r6(mean(sl(crossB))), trace: sum(childT) }; });
  const perMind = MINDS.map((m) => { const ix = singles.map(([, x], i) => (x.mind === m ? i : -1)).filter((i) => i >= 0); return { mind: m, n: ix.length, judge: r6(mean(ix.map((i) => ctrlJ[i]))), trace: r6(mean(ix.map((i) => ctrlT[i]))) }; });
  const usage = batches.map((b) => (b ? { batch: b.batch, tokens: b.judge.tokens, toolUses: b.judge.toolUses } : null));
  return { kind: 'bred-minds.receipt', organ: 2, sealed: { commit: s.commit, ...(am ? { amended: am.commit } : {}) }, asked: { breed: raw.asked, perspectives: R.asked, judge: usage }, held: verdicts.filter((v) => v.held).length, verdicts,
    detail: { perPair, control: perMind, children: C.pairs.map((p) => ({ pair: p.pair, id: p.child.id, cross: p.cross.id })) } };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/measure-2.mjs');
if (isMain) {
  const text = JSON.stringify(measure2(), null, 1) + '\n';
  if (process.argv.includes('--check')) { if (read('receipts/organ-2.json') !== text) { console.log('RECEIPT MISMATCH'); process.exit(1); } console.log('RECEIPT REPRODUCED · ' + sha(text).slice(0, 16)); }
  else { mkdirSync(new URL('receipts/', ROOT), { recursive: true }); writeFileSync(new URL('receipts/organ-2.json', ROOT), text); const r = JSON.parse(text); for (const v of r.verdicts) console.log((v.held ? 'HELD   ' : 'FAILED ') + v.id + ' · ' + v.measured); console.log(r.held + ' of ' + r.verdicts.length + ' held'); }
}
