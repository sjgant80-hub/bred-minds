#!/usr/bin/env node
// tools/measure-1.mjs — organ 1 measured against its sealed claims (claims/organ-1.json), from what is committed: the
// texts, the local model's replies (data/local/), the cards they grow, and the cold judge's replies (data/judge/). Nothing
// is asked of any model here, so the receipt re-derives byte for byte anywhere. It refuses to run if the claims differ
// from the commit that sealed them, and names that commit.   node tools/measure-1.mjs [--check] → receipts/organ-1.json
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fit, attribute } from '../src/trace.mjs';
import { gate } from '../src/card.mjs';
import { readReply, recognises } from '../src/judge.mjs';
import { wilson, diffLow } from '../src/stats.mjs';
import { blockedIn } from '../src/text.mjs';
import { stock, textsMatch, SEAL, MINDS, sha, read } from './stock.mjs';
import { cards } from './cards.mjs';
import { plan, keyOf } from './write.mjs';
import { order, batchPrompt, BATCH } from './judge.mjs';

const ROOT = new URL('../', import.meta.url);
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const W = (k, n) => { const w = wilson(k, n); return w && { k, n, rate: r6(w.rate), low: r6(w.low), high: r6(w.high) }; };

/** the commit that sealed the claims, and whether they are unchanged since */
function sealed() {
  const touched = git('log', '--format=%H', '--', 'claims/organ-1.json').split('\n').filter(Boolean);
  const unchanged = touched.length === 1 && git('status', '--porcelain', '--', 'claims/organ-1.json') === '';
  return { commit: touched[touched.length - 1] || null, unchanged };
}

/** a fitted model's identity: its vocabulary and every mind's log-likelihoods, hashed */
const modelId = (m) => sha(JSON.stringify([[...m.vocab].sort(), m.minds.map((x) => [...m.logp.get(x).known].sort(([a], [b]) => (a < b ? -1 : 1)))]));

export function measure() {
  const s = sealed();
  if (!s.unchanged) throw new Error('claims/organ-1.json differs from the commit that sealed it');
  const all = stock(), fitOf = (st) => fit(Object.fromEntries(MINDS.map((m) => [m, st[m].filter((p) => !p.test).map((p) => p.text)])), MINDS);
  const model = fitOf(all), scrambled = stock(true);
  const C = cards(), built = JSON.stringify(C, null, 1) + '\n';
  // B1, piece by piece
  const testNeverRead = JSON.stringify(cards(undefined, scrambled)) === JSON.stringify(C) && modelId(fitOf(scrambled)) === modelId(model);
  const byIndex = (m) => new Map(all[m].map((p) => [p.index, p.text]));
  const maximsGated = C.minds.every((m) => !m.grown || m.card.maxims.every((x) => gate(x.maxim, byIndex(m.mind).get(x.from), SEAL.blocked).ok));
  const P = JSON.parse(read('data/local/perspectives.json')), items = P.items, byKey = new Map(items.map((x) => [keyOf(x), x])), want = plan(C);
  const perspectivesMatch = want.length === items.length && want.every((p) => byKey.has(keyOf(p)) && byKey.get(keyOf(p)).prompt === sha(p.prompt).slice(0, 16) && byKey.get(keyOf(p)).seed === p.seed);
  const namesApplied = items.every((x) => x.named === blockedIn(x.reply, SEAL.blocked) && (x.first === undefined || blockedIn(x.first, SEAL.blocked)) && (!blockedIn(x.reply, SEAL.blocked) || x.first !== undefined));
  const keys = order(items), batches = [1, 2, 3, 4].map((n) => (existsSync(new URL('data/judge/batch-' + n + '.json', ROOT)) ? JSON.parse(read('data/judge/batch-' + n + '.json')) : null));
  const judgeMatch = batches.every((b, i) => b && b.prompt === sha(batchPrompt(items, keys, i)).slice(0, 16));
  const reading = new Map(keys.map((k, i) => [k, batches[Math.floor(i / BATCH)] ? readReply(batches[Math.floor(i / BATCH)].reply, BATCH)[i % BATCH] : null]));
  // B2: the trace model on TEST passages
  const recall = MINDS.map((m) => { const t = all[m].filter((p) => p.test); return { mind: m, n: t.length, right: t.filter((p) => attribute(model, p.text) === m).length }; });
  const macro = recall.reduce((a, r) => a + r.right / r.n, 0) / MINDS.length;
  // B3–B7
  const grownMinds = C.minds.filter((m) => m.grown).map((m) => m.mind);
  const kind = (k) => items.filter((x) => x.kind === k);
  const judged = (x) => !x.named && recognises(reading.get(keyOf(x)), x.mind), traced = (x) => !x.named && attribute(model, x.reply) === x.mind;
  const card = kind('card'), shamI = kind('sham'), base = kind('base');
  const perMind = MINDS.map((m) => { const c = card.filter((x) => x.mind === m); return { mind: m, n: c.length, judge: c.filter(judged).length, trace: c.filter(traced).length, sham: shamI.filter((x) => x.mind === m && judged(x)).length }; });
  const cardJ = W(card.filter(judged).length, card.length), shamJ = W(shamI.filter(judged).length, shamI.length), cardT = W(card.filter(traced).length, card.length);
  const none = (xs) => xs.map((x) => reading.get(keyOf(x))).filter(Boolean).map((p) => p.none);
  const baseNone = none(base), cardNone = none(card), noneLow = diffLow(baseNone, cardNone, 2000, 99), mean = (a) => (a.length ? r6(a.reduce((s, x) => s + x, 0) / a.length) : null);
  const B = {
    B1: { held: textsMatch() && testNeverRead && maximsGated && built === read('data/cards.json') && C.minds.every((m) => m.promptsMatch) && perspectivesMatch && judgeMatch && namesApplied,
      measured: 'texts as recorded ' + textsMatch() + '; TEST never read ' + testNeverRead + '; every kept maxim passes the gate ' + maximsGated + '; cards rebuild byte for byte ' + (built === read('data/cards.json')) + '; maxims asked to their sealed prompts ' + C.minds.every((m) => m.promptsMatch) + '; ' + items.length + ' perspectives to their sealed prompts and seeds ' + perspectivesMatch + ' (' + items.filter((x) => x.first !== undefined).length + ' asked again, ' + items.filter((x) => x.named).length + ' still named); judge batches to their sealed prompts ' + judgeMatch + ' (' + [...reading.values()].filter(Boolean).length + ' of 200 lines readable); the name rule applied ' + namesApplied },
    B2: { held: macro >= 0.8 && recall.every((r) => r.right / r.n >= 0.5), measured: 'macro accuracy ' + r6(macro) + ' on ' + recall.reduce((a, r) => a + r.n, 0) + ' TEST passages; ' + recall.map((r) => r.mind + ' ' + r.right + '/' + r.n).join(', ') },
    B3: { held: grownMinds.length === 6, measured: C.minds.map((m) => m.mind + ' ' + m.kept + ' of 24 kept').join(', ') },
    B4: { held: !!cardJ && cardJ.rate >= 0.4 && cardJ.low > 1 / 6, measured: cardJ ? cardJ.k + ' of ' + cardJ.n + ' recognised (' + cardJ.rate + ', Wilson ' + cardJ.low + '–' + cardJ.high + '; chance 0.166667); by mind ' + perMind.map((m) => m.mind + ' ' + m.judge + '/' + m.n).join(', ') : 'no card perspectives' },
    B5: { held: !!cardJ && !!shamJ && cardJ.low > shamJ.high, measured: 'cards ' + (cardJ ? cardJ.low : '—') + ' (lower bound) against shams ' + (shamJ ? shamJ.high + ' (upper bound; ' + shamJ.k + ' of ' + shamJ.n + ')' : '—') },
    B6: { held: !!cardT && cardT.low > 1 / 6, measured: cardT ? 'the trace model: ' + cardT.k + ' of ' + cardT.n + ' (' + cardT.rate + ', Wilson ' + cardT.low + '–' + cardT.high + '); by mind ' + perMind.map((m) => m.mind + ' ' + m.trace + '/' + m.n).join(', ') : 'no card perspectives' },
    B7: { held: noneLow !== null && noneLow > 0, measured: 'mean "none": base ' + mean(baseNone) + ' (' + baseNone.length + ' readable) against cards ' + mean(cardNone) + ' (' + cardNone.length + ' readable); bound ' + (noneLow === null ? '—' : r6(noneLow)) },
  };
  const verdicts = SEAL.claims.map((c) => ({ id: c.id, kind: c.kind, claim: c.claim, held: B[c.id].held === true, measured: B[c.id].measured }));
  return { kind: 'bred-minds.receipt', organ: 1, sealed: { commit: s.commit }, asked: { maxims: JSON.parse(read('data/local/maxims.json')).asked, perspectives: P.asked }, held: verdicts.filter((v) => v.held).length, verdicts,
    detail: { recall, perMind, cardJudge: cardJ, shamJudge: shamJ, cardTrace: cardT, cards: C.minds.map((m) => ({ mind: m.mind, id: m.id, kept: m.kept, grown: m.grown })) } };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/measure-1.mjs');
if (isMain) {
  const text = JSON.stringify(measure(), null, 1) + '\n';
  if (process.argv.includes('--check')) { if (read('receipts/organ-1.json') !== text) { console.log('RECEIPT MISMATCH'); process.exit(1); } console.log('RECEIPT REPRODUCED · ' + sha(text).slice(0, 16)); }
  else { mkdirSync(new URL('receipts/', ROOT), { recursive: true }); writeFileSync(new URL('receipts/organ-1.json', ROOT), text); const r = JSON.parse(text); for (const v of r.verdicts) console.log((v.held ? 'HELD   ' : 'FAILED ') + v.id + ' · ' + v.measured); console.log(r.held + ' of ' + r.verdicts.length + ' held'); }
}
