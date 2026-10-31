// page/app.mjs — the live page. It reads only committed files from this site and runs the same kernels the measurement
// runs (src/*.mjs): the passages are cut, the gate re-checked, the trace model fitted and the cost case computed here, in
// the reader's browser. Every piece of text from a file reaches the page through textContent, never as markup.
import { span, passages, isTest, words, tokens, content } from '../src/text.mjs';
import { fit, scores, attribute } from '../src/trace.mjs';
import { readReply, recognises, LABELS } from '../src/judge.mjs';
import { gate, firstWords } from '../src/card.mjs';
import { compare, ASSUME } from '../src/cost.mjs';
import { childGate } from '../src/breed.mjs';

window.__bm = true;
const $ = (id) => document.getElementById(id);
const BATCH = 50;

/** an element: attributes (class, href, aria-*, hidden…), then children (strings become text) */
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) { if (v === false || v == null) continue; if (k === 'class') e.className = v; else if (k === 'on') for (const [ev, f] of Object.entries(v)) e.addEventListener(ev, f); else e.setAttribute(k, v === true ? '' : v); }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k instanceof Node ? k : String(k));
  return e;
}
const fill = (id, ...kids) => { const e = typeof id === 'string' ? $(id) : id; e.replaceChildren(...kids.flat().filter((k) => k != null && k !== false)); return e; };
const getJSON = async (p) => { try { const r = await fetch(p, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch { return null; } };
const getText = async (p) => { try { const r = await fetch(p, { cache: 'no-cache' }); return r.ok ? await r.text() : null; } catch { return null; } };
const pct = (x, d = 0) => (x * 100).toFixed(d) + '%';
const gbp = (x) => (x < 1 ? Math.round(x * 100) + 'p' : '£' + (x < 100 ? x.toFixed(2) : Math.round(x).toLocaleString('en-GB')));
const hrs = (x) => (x < 1 ? Math.round(x * 60) + ' minutes' : x.toFixed(1) + ' hours');
const mindTag = (m, names) => h('span', { class: 'mind m-' + m }, m === 'none' ? 'none' : (names[m] || m));
const keyOf = (x) => x.kind + ':' + x.mind + ':' + x.q;

// theme switch and the tab underline
(() => {
  const root = document.documentElement;
  try { const t = localStorage.getItem('bm-theme'); if (t) root.dataset.theme = t; } catch {}
  $('theme').addEventListener('click', () => {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('bm-theme', root.dataset.theme); } catch {}
  });
  const links = [...document.querySelectorAll('#tabs a')], secs = links.map((a) => document.querySelector(a.getAttribute('href')));
  const on = () => { let k = 0; secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top < 90) k = i; }); links.forEach((a, i) => a.classList.toggle('on', i === k)); };
  addEventListener('scroll', on, { passive: true }); on();
})();

const [seal, sources, cards, drawn, maxims, persp, order, receipt, lock, witness] = await Promise.all([
  getJSON('claims/organ-1.json'), getJSON('data/sources.json'), getJSON('data/cards.json'), getJSON('data/drawn.json'), getJSON('data/local/maxims.json'),
  getJSON('data/local/perspectives.json'), getJSON('data/judge/order.json'), getJSON('receipts/organ-1.json'), getJSON('data/prices.lock.json'), getJSON('data/witness.json')]);
const batches = order ? await Promise.all([1, 2, 3, 4].map((n) => getJSON('data/judge/batch-' + n + '.json'))) : [];
const after = receipt ? await getJSON('data/after/organ-1-lean.json') : null;
const usage = batches.every(Boolean) && batches.length ? await getJSON('data/judge/usage.json') : null;
const [seal2, kids, receipt2] = await Promise.all([getJSON('claims/organ-2.json'), getJSON('data/children.json'), getJSON('receipts/organ-2.json')]);
const prompts = batches.every(Boolean) ? await Promise.all([1, 2, 3, 4].map((n) => getText('data/judge/batch-' + n + '.prompt.txt'))) : [];
const MINDS = sources ? sources.minds.map((m) => m.mind) : [];
const NAMES = Object.fromEntries((sources ? sources.minds : []).map((m) => [m.mind, m.name]));
const Q = seal ? seal.questions : [];
const items = persp && persp.items && persp.items.length === 200 ? persp.items : null;
const byKey = new Map((items || []).map((x) => [keyOf(x), x]));
const verdict = (id) => receipt && receipt.verdicts.find((v) => v.id === id);
const held = (id) => !!(verdict(id) && verdict(id).held);

// the judge's reading of every answer, by key
const reading = new Map();
if (order && batches.every(Boolean)) order.keys.forEach((k, i) => { const b = batches[Math.floor(i / BATCH)]; reading.set(k, readReply(b.reply, BATCH)[i % BATCH]); });

// ---------- overview ----------
function overview() {
  if (!receipt) {
    fill('kpis', h('div', { class: 'panel' }, h('small', {}, 'Organ 1'), h('div', { class: 'big' }, 'Being measured'), h('small', {}, 'the receipt appears here when it is committed')));
    fill('headline', 'The six cards are grown and committed. The answers, the judge and the receipt follow, in that order, each committed before the next step reads it.');
  } else {
    const d = receipt.detail, macro = d.recall.reduce((a, r) => a + r.right / r.n, 0) / d.recall.length;
    fill('kpis',
      h('div', { class: 'panel' }, h('small', {}, 'Sealed claims held'), h('div', { class: 'big' }, receipt.held + ' of ' + receipt.verdicts.length), h('small', {}, receipt.held === receipt.verdicts.length ? 'none failed; a failure would be kept and shown' : 'the failures are kept and shown')),
      h('div', { class: 'panel' }, h('small', {}, 'Card answers the judge recognised'), h('div', { class: 'big' }, d.cardJudge ? pct(d.cardJudge.rate) : '—'), h('small', {}, d.cardJudge ? d.cardJudge.k + ' of ' + d.cardJudge.n + '; chance is 1 in 6 (17%)' : '')),
      h('div', { class: 'panel' }, h('small', {}, 'Sham answers "recognised" as their label'), h('div', { class: 'big' }, d.shamJudge ? pct(d.shamJudge.rate) : '—'), h('small', {}, d.shamJudge ? d.shamJudge.k + ' of ' + d.shamJudge.n + ', the control' : '')),
      h('div', { class: 'panel' }, h('small', {}, 'Trace model on unseen book passages'), h('div', { class: 'big' }, pct(macro)), h('small', {}, 'right author, mean of the six; no language model inside')));
    fill('headline', headline());
  }
  if (cards) fill('minds', cards.minds.map((m) => {
    const src = sources.minds.find((s) => s.mind === m.mind), pm = receipt && receipt.detail.perMind.find((x) => x.mind === m.mind);
    return h('div', { class: 'panel' }, mindTag(m.mind, NAMES), h('p', { class: 'note' }, src.work.split(/;(?![^(]*\))/)[0].split(', with')[0]),
      h('p', {}, m.kept + ' of 24 maxims kept by the gate; card ', h('code', {}, m.id.slice(0, 12))),
      pm ? h('p', {}, 'Judge recognised ', h('b', {}, pm.judge + ' of ' + pm.n), ' of its answers; the trace model ', h('b', {}, pm.trace + ' of ' + pm.n), '; its sham ', pm.sham + ' of 10.') : null);
  }));
}

/** the headline sentence, from what held */
function headline() {
  const d = receipt.detail, n = receipt.verdicts.length;
  const s = [receipt.held + ' of ' + n + ' sealed claims held.'];
  if (held('B4') && held('B5')) s.push('A cold judge recognised whose pattern of thought a card\'s answers carried far more often than chance, and far more often than it "recognised" the sham cards.');
  else if (held('B4')) s.push('A cold judge recognised the cards\' answers more often than chance, but not clearly more often than the shams, so the recognition is not shown to come from the cards.');
  else s.push('The cold judge did not recognise the cards\' answers at the sealed bar: the pattern did not carry far enough to be named reliably.');
  const L = leanRead();
  if (held('B6') && L) s.push('The trace model, with no language model inside it, held its sealed bar too (' + d.cardTrace.k + ' of ' + d.cardTrace.n + '), but unevenly, and with a lean found after the receipt: it sent ' + L.leanK + ' of the ' + L.ctrlN + ' control answers to ' + NAMES[L.pair[0]] + ' or ' + NAMES[L.pair[1]] + ', so the card answers it gave those two (' + L.card[L.pair[0]] + ' and ' + L.card[L.pair[1]] + ' of 20) are only partly the card. Outside that lean its clearest signal is ' + NAMES[L.best] + ' (' + L.card[L.best] + ' of 20 card answers, against ' + L.ctrl[L.best] + ' of the ' + L.ctrlN + ' controls)' + (L.weak.length ? '; ' + L.weak.map((m) => NAMES[m]).join(', ').replace(/, ([^,]*)$/, ' and $1') + ' it hardly ever named (' + L.weak.map((m) => L.card[m]).join(', ').replace(/, ([^,]*)$/, ' and $1') + ' of 20).' : '.'));
  else s.push(held('B6') ? 'The trace model, with no language model inside it, recognised them too: the pattern reached the words.' : 'The trace model, with no language model inside it, did not: what carried was the ideas, not the old books\' words.');
  return s.join(' ');
}

/** the lean, read from where the trace model sent every answer: each mind's own card answers against the 80 controls
 *  (the base answers and the shams), the two minds the controls went to most, and the clearest signal outside them */
function leanRead(a = after) {
  if (!a || !a.groups) return null;
  const card = {}, ctrl = Object.fromEntries(MINDS.map((m) => [m, 0])); let ctrlN = 0;
  for (const g of a.groups) { if (g.kind === 'card') card[g.mind] = g.sent[g.mind]; else { ctrlN += g.n; for (const m of MINDS) ctrl[m] += g.sent[m]; } }
  if (!ctrlN || MINDS.some((m) => card[m] == null)) return null;
  const pair = [...MINDS].sort((x, y) => ctrl[y] - ctrl[x]).slice(0, 2), gap = (m) => card[m] / 20 - ctrl[m] / ctrlN;
  const best = MINDS.filter((m) => !pair.includes(m)).sort((x, y) => gap(y) - gap(x))[0];
  return { card, ctrl, ctrlN, pair, leanK: ctrl[pair[0]] + ctrl[pair[1]], best, weak: MINDS.filter((m) => card[m] < 5) };
}

// ---------- the cards ----------
let shown = MINDS[0];
const CJK = /[　-鿿＀-￯]/;
function cardView() {
  if (!cards) { fill('card', h('p', { class: 'out' }, 'The cards could not be loaded.')); return; }
  fill('cardpick', MINDS.map((m) => h('button', { 'aria-pressed': String(m === shown), class: m === shown ? 'go' : null, on: { click: () => { shown = m; cardView(); } } }, NAMES[m])));
  const m = cards.minds.find((x) => x.mind === shown), src = sources.minds.find((s) => s.mind === shown);
  const texts = new Map(((drawn && drawn.minds.find((x) => x.mind === shown)) || { passages: [] }).passages.map((p) => [p.index, p.text]));
  const dropped = m.steps.filter((s) => !s.kept);
  fill('card',
    h('h3', {}, NAMES[shown], ' ', h('span', { class: 'pill' }, 'card ' + m.id.slice(0, 16))),
    h('p', { class: 'note' }, src.work + '. ', h('a', { href: src.from.split(' ')[0] }, 'Project Gutenberg'), '.'),
    h('ol', { class: 'maxims' }, m.card.maxims.map((x, i) => {
      const g = gate(x.maxim, texts.get(x.from) || '', seal ? seal.blocked : []);
      return h('li', {}, h('details', {}, h('summary', {}, (i + 1) + '. ' + x.maxim),
        h('p', { class: 'note' }, 'From passage ' + x.from + ' of the book. The gate, re-run here: ' + (g.ok ? 'kept' : g.why) + ' (' + words(x.maxim).length + ' words).'),
        h('div', { class: 'quote' }, texts.get(x.from) || 'passage not loaded')));
    })),
    h('h3', {}, 'Voice'), m.card.voice.map((v) => h('div', { class: 'quote' }, '“' + v + '”')),
    dropped.length ? h('details', {}, h('summary', {}, 'The ' + dropped.length + ' the gate dropped, and why'), h('ul', {}, dropped.map((s) => h('li', {}, s.maxim + ' — ', h('i', {}, s.why))))) : h('p', { class: 'note' }, 'The gate dropped none.'),
    h('p', { class: 'note' }, m.kept + ' of 24 kept; the card takes the first 12.'),
    m.card.maxims.some((x) => CJK.test(x.maxim)) ? h('p', { class: 'note' }, 'One maxim on this card ends in Chinese: the local model switched language mid-sentence. The sealed gate does not check language, so it was kept, and it is shown as it is. It is the only one of the ' + cards.minds.reduce((a, c) => a + c.card.maxims.length, 0) + ' maxims on the six cards.') : null);
  if (seal) $('blockedlist').textContent = seal.blocked.join(' · ');
  gateExample();
  fill('shams', cards.shams.map((s) => h('details', {}, h('summary', {}, 'Sham labelled ' + NAMES[s.mind] + ' · ' + s.id.slice(0, 12)), h('ol', {}, s.card.maxims.map((x) => h('li', {}, x.maxim))))));
}

/** one sentence the gate kept and one it dropped for sharing too few words, from the real run, the gate re-run here */
function gateExample() {
  if (!drawn || !seal) return;
  const text = (mind, i) => ((drawn.minds.find((x) => x.mind === mind) || { passages: [] }).passages.find((p) => p.index === i) || {}).text || '';
  const show = (mind, s, label) => {
    const t = text(mind, s.index), g = gate(s.maxim, t, seal.blocked), inP = content(t), mine = [...content(s.maxim)];
    return h('div', { class: 'panel' }, h('p', {}, h('b', {}, label + ' '), mindTag(mind, NAMES), ', passage ' + s.index + '.'), h('div', { class: 'quote' }, s.maxim),
      h('p', { class: 'note' }, 'Its content words (compared after a final "s" is removed, as sealed, so "status" reads "statu"): ' + mine.map((w) => (inP.has(w) ? w + ' (in the passage)' : w)).join(', ') + '. ' + words(s.maxim).length + ' words. The gate, re-run here: ' + g.why + '.'),
      h('details', {}, h('summary', {}, 'The passage it came from'), h('div', { class: 'quote' }, t)));
  };
  const m = cards.minds.find((x) => x.steps.some((s) => !s.kept && /shared/.test(s.why)));
  if (!m) return;
  fill('gateeg', show(m.mind, m.steps.find((s) => s.kept), 'Kept.'), show(m.mind, m.steps.find((s) => !s.kept && /shared/.test(s.why)), 'Dropped.'));
}

// ---------- the blind test ----------
let model = null;
const score = { you: 0, judge: 0, n: 0 };
function blind() {
  if (!items) return;
  const pool = items.filter((x) => x.kind !== 'sham'), x = pool[Math.floor(Math.random() * pool.length)], truth = x.kind === 'base' ? 'none' : x.mind;
  const box = fill('blindbox', h('p', { class: 'note' }, 'Question ' + x.q + ' of 20'), h('h3', {}, Q[x.q - 1]), h('div', { class: 'quote' }, x.reply.replace(/\s+/g, ' ').trim()),
    h('p', {}, h('b', {}, 'Whose pattern of thought does it carry?')));
  const out = h('div', { 'aria-live': 'polite' });
  const buttons = h('div', { class: 'guess' }, [...MINDS, 'none'].map((m) => h('button', { on: { click: () => reveal(m) } }, m === 'none' ? 'None of them' : NAMES[m])));
  box.append(buttons, out);
  function reveal(guess) {
    for (const b of buttons.children) b.disabled = true;
    const p = reading.get(keyOf(x)), jRight = p ? (truth === 'none' ? LABELS.every((l) => l === 'none' || p.none > p[l]) : recognises(p, truth)) : false;
    score.n++; if (guess === truth) score.you++; if (jRight) score.judge++;
    out.append(h('p', { class: 'verdict' }, guess === truth ? 'Right. ' : 'Not this time. ', 'It was written ', truth === 'none' ? 'from no card at all.' : h('span', {}, 'from the card of ', mindTag(truth, NAMES), '.')),
      x.named ? h('p', { class: 'note' }, 'This answer named a thinker even when asked again, so the receipt counts it as a miss whatever the judge said.') : null,
      p ? h('div', {}, h('p', { class: 'note' }, 'The judge\'s numbers (it saw this answer among 50, cold):'), bars(p)) : h('p', { class: 'note' }, 'The judge\'s reading appears here once its replies are committed.'),
      model ? h('p', { class: 'note' }, 'The trace model reads it as ', mindTag(attribute(model, x.reply), NAMES), '.') : h('p', { class: 'note' }, 'Grow the trace model below to see its call as well.'),
      h('button', { class: 'go', on: { click: blind } }, 'Next answer'));
    fill('blindscore', 'You: ' + score.you + ' of ' + score.n + '. The judge, on the same answers: ' + score.judge + ' of ' + score.n + '. Sham answers are left out of this game: they have no single right mind.');
  }
}
function bars(p) {
  return h('div', { class: 'bars' }, LABELS.map((l) => { const i = h('i', { class: 'm-' + l }); i.style.width = Math.max(0, Math.min(100, p[l])) + '%'; return h('div', { class: 'bar' }, h('span', {}, l === 'none' ? 'none' : NAMES[l].split(' ').pop()), h('span', { class: 't' }, i), h('span', { class: 'mono' }, Math.round(p[l]))); }));
}

// ---------- the trace model in the browser ----------
async function hex(buf) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map((b) => b.toString(16).padStart(2, '0')).join(''); }
async function grow() {
  const btn = $('load'); btn.disabled = true;
  const rows = [], stock = {};
  for (const s of sources.minds) {
    fill('loadout', 'Fetching ' + s.name + ' (' + (s.bytes / 1e6).toFixed(1) + ' MB)…');
    let buf; try { const r = await fetch(s.path); buf = await r.arrayBuffer(); } catch { fill('loadout', 'Could not fetch ' + s.path + '.'); btn.disabled = false; return; }
    const sum = await hex(buf), ps = passages(span(new TextDecoder('utf-8').decode(buf), s.start, s.end)).map((text, index) => ({ index, text, test: isTest(index) }));
    stock[s.mind] = ps; rows.push({ s, ok: sum === s.sha256, fit: ps.filter((p) => !p.test).length, test: ps.filter((p) => p.test).length });
  }
  fill('loadout', 'Fitting the model on the FIT passages…');
  await new Promise((r) => setTimeout(r, 30));
  model = fit(Object.fromEntries(MINDS.map((m) => [m, stock[m].filter((p) => !p.test).map((p) => p.text)])), MINDS);
  const recall = MINDS.map((m) => { const t = stock[m].filter((p) => p.test); return { mind: m, n: t.length, right: t.filter((p) => attribute(model, p.text) === m).length }; });
  const macro = recall.reduce((a, r) => a + r.right / r.n, 0) / recall.length, same = receipt ? JSON.stringify(recall) === JSON.stringify(receipt.detail.recall) : null;
  fill('loadout', 'Grown in this tab: ' + model.vocab.size.toLocaleString('en-GB') + ' words in its vocabulary.');
  fill('books', h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Book'), h('th', {}, 'Fingerprint'), h('th', { class: 'num' }, 'FIT'), h('th', { class: 'num' }, 'TEST'), h('th', { class: 'num' }, 'Right on TEST'))),
    h('tbody', {}, rows.map((r, i) => h('tr', {}, h('td', {}, r.s.name), h('td', { class: r.ok ? 'held' : 'failed' }, r.ok ? 'matches the record' : 'DIFFERS'), h('td', { class: 'num' }, r.fit), h('td', { class: 'num' }, r.test), h('td', { class: 'num' }, recall[i].right + ' / ' + recall[i].n)))))),
    h('p', {}, 'Mean accuracy on passages the model never saw: ', h('b', {}, pct(macro, 1)), '. ', same === null ? 'The receipt is not committed yet.' : same ? h('span', { class: 'held' }, 'Identical to the receipt, mind by mind.') : h('span', { class: 'failed' }, 'Different from the receipt.')));
  unseen = MINDS.flatMap((m) => stock[m].filter((p) => p.test).map((p) => ({ mind: m, index: p.index, text: p.text })));
  if (after && items) {
    const mine = after.groups.map((g) => { const sent = Object.fromEntries(MINDS.map((m) => [m, 0])); for (const x of items.filter((i) => i.kind === g.kind && i.mind === g.mind)) { const to = attribute(model, x.reply); if (to) sent[to]++; } return { ...g, sent }; });
    const same = JSON.stringify(mine) === JSON.stringify(after.groups);
    leanView({ ...after, groups: mine }, h('p', {}, 'Re-derived in this tab from the model you just grew: ', same ? h('span', { class: 'held' }, 'identical to the committed file, every cell.') : h('span', { class: 'failed' }, 'different from the committed file.')));
  }
  $('tryit').hidden = false;
}
let unseen = [], picked = null;
function pickUnseen() {
  picked = unseen[Math.floor(Math.random() * unseen.length)];
  $('mine').value = picked.text; fill('attrout', h('p', { class: 'note' }, 'A TEST passage: the model was never fitted on it. Whose is it? Press the button to see the model\'s call and the answer.'));
}
function attributeMine() {
  const t = $('mine').value, s = scores(model, t), known = tokens(t).filter((w) => model.vocab.has(w)).length;
  if (!known) { fill('attrout', h('p', { class: 'out' }, 'None of these words is in the model\'s vocabulary.')); return; }
  const truth = picked && picked.text === t ? picked : null;
  const top = Math.max(...s), z = s.map((v) => Math.exp(v - top)), sumz = z.reduce((a, b) => a + b, 0), post = z.map((v) => v / sumz);
  const ranked = MINDS.map((m, i) => ({ m, p: post[i] })).sort((a, b) => b.p - a.p);
  fill('attrout', h('p', {}, 'Reads most like ', mindTag(ranked[0].m, NAMES), ' (' + known + ' words in the vocabulary).'),
    truth ? h('p', { class: 'verdict' }, 'It was by ', mindTag(truth.mind, NAMES), ' (passage ' + truth.index + ' of the book): the model is ', ranked[0].m === truth.mind ? h('span', { class: 'held' }, 'right') : h('span', { class: 'failed' }, 'wrong'), '.') : null,
    h('div', { class: 'bars' }, ranked.map((r) => { const i = h('i', { class: 'm-' + r.m }); i.style.width = (r.p * 100).toFixed(1) + '%'; return h('div', { class: 'bar' }, h('span', {}, NAMES[r.m].split(' ').pop()), h('span', { class: 't' }, i), h('span', { class: 'mono' }, pct(r.p, r.p < 0.995 && r.p > 0.005 ? 1 : 0))); })),
    h('p', { class: 'note' }, 'These are the model\'s own odds, with equal odds for each author before it reads. A word-count model is very sure of itself on long texts; the order counts for more than the size.'));
}

// ---------- results ----------
function results() {
  if (seal) fill('expect', seal.expectations);
  if (!receipt) { fill('resultsbody', h('p', {}, 'Organ 1 is sealed (', h('code', {}, 'claims/organ-1.json'), ') and being grown. The seven claims it will be measured against:'),
    h('ol', {}, (seal ? seal.claims : []).map((c) => h('li', {}, h('b', {}, c.id + ' '), c.claim)))); return; }
  fill('resultsbody', h('p', {}, 'Sealed at commit ', h('code', {}, receipt.sealed.commit.slice(0, 7)), '. The local model: ', h('code', {}, receipt.asked.maxims.model), ', digest ', h('code', {}, receipt.asked.maxims.digest.slice(0, 12)), '.'),
    h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Claim'), h('th', {}, 'Result'), h('th', {}, 'Measured'))),
      h('tbody', {}, receipt.verdicts.map((v) => { const [title, ...rest] = v.claim.split(': '), upper = rest.length && title === title.toUpperCase();
        return h('tr', {}, h('td', {}, h('b', {}, v.id + ' '), upper ? h('b', {}, title.charAt(0) + title.slice(1).toLowerCase() + ': ') : null, upper ? rest.join(': ') : v.claim), h('td', { class: v.held ? 'held' : 'failed' }, v.held ? 'HELD' : 'FAILED'), h('td', { class: 'note' }, v.measured)); })))));
  const pm = receipt.detail.perMind;
  fill('permind', h('h3', {}, 'Mind by mind'), h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Mind'), h('th', { class: 'num' }, 'Judge, card answers'), h('th', { class: 'num' }, 'Trace model, card answers'), h('th', { class: 'num' }, 'Judge, sham answers'), h('th', { class: 'num' }, 'Trace model, unseen book passages'))),
    h('tbody', {}, pm.map((m) => { const r = receipt.detail.recall.find((x) => x.mind === m.mind); return h('tr', {}, h('td', {}, mindTag(m.mind, NAMES)), h('td', { class: 'num' }, m.judge + ' / ' + m.n), h('td', { class: 'num' }, m.trace + ' / ' + m.n), h('td', { class: 'num' }, m.sham + ' / 10'), h('td', { class: 'num' }, r.right + ' / ' + r.n)); })))),
    h('p', { class: 'note' }, 'Chance for any one mind is 1 in 6. A sham answer counts as "recognised" when the judge picks the mind the sham is labelled with.'));
  leanView();
}

/** where the trace model sent every answer: found after the receipt, not sealed, shown because B6's mind-by-mind counts are uneven */
function leanView(a = after, check = null) {
  const L = leanRead(a);
  if (!L) return;
  const label = (g) => g.kind === 'card' ? h('span', {}, 'Card of ', mindTag(g.mind, NAMES)) : g.kind === 'sham' ? h('span', {}, 'Sham labelled ', NAMES[g.mind]) : h('span', {}, 'No card (base)');
  fill('lean', h('h3', {}, 'Where the trace model sent the answers'),
    h('p', {}, h('span', { class: 'pill' }, 'found after the receipt, not sealed'), ' B6 held, but its mind-by-mind counts are uneven, so every answer\'s call is shown. Each row is a group of answers; each column is the mind the trace model named.'),
    h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Answers'), h('th', { class: 'num' }, 'n'), MINDS.map((m) => h('th', { class: 'num' }, NAMES[m].split(' ').pop())))),
      h('tbody', {}, a.groups.map((g) => h('tr', {}, h('td', {}, label(g)), h('td', { class: 'num' }, g.n), MINDS.map((m) => h('td', { class: 'num' + (g.kind === 'card' && g.mind === m ? ' held' : '') }, g.sent[m] ? String(g.sent[m]) : '·'))))))),
    h('p', {}, h('b', {}, 'Read plainly. '), 'The 80 controls (20 answers written from no card, 60 from shams) are the answers no single mind wrote. The trace model sent ' + L.leanK + ' of them to ' + NAMES[L.pair[0]] + ' or ' + NAMES[L.pair[1]] + ': it leans toward those two for any modern-English advice. So a card answer it gives to one of them is only partly the card speaking. Outside the lean, the answers from ' + NAMES[L.best].split(' ').pop() + '\'s card went to him ' + L.card[L.best] + ' times in 20, where only ' + L.ctrl[L.best] + ' of the 80 controls did: that is the cleanest sign the words carried. ' + (L.weak.length ? L.weak.map((m) => NAMES[m]).join(', ').replace(/, ([^,]*)$/, ' and $1') + ' it almost never named. Why is a guess, not a measured cause: perhaps that the maxims were stated in modern English, and the Marcus and Montaigne it was fitted on are 17th-century translations. That does not explain Thoreau, whose answers went mostly to Emerson, his neighbour in Concord and in vocabulary.' : '')),
    h('p', { class: 'note' }, 'The judge does not share the lean: it recognised the card answers of all six minds 18 to 20 times in 20, and the shams 5 times in 60. The lesson is written into the next seal: a word-count check is barred against the controls, not against chance.'),
    check);
}

// ---------- breeding (organ 2) ----------
const short = (m) => (m === 'marcus' ? 'Marcus' : (NAMES[m] || m).split(' ').pop());
const pairName = (p) => short(p[0]) + ' × ' + short(p[1]);
let pairShown = 0;
function verdictTable(r) {
  return h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Claim'), h('th', {}, 'Result'), h('th', {}, 'Measured'))),
    h('tbody', {}, r.verdicts.map((v) => { const [title, ...rest] = v.claim.split(': '), upper = rest.length && title === title.toUpperCase();
      return h('tr', {}, h('td', {}, h('b', {}, v.id + ' '), upper ? h('b', {}, title.charAt(0) + title.slice(1).toLowerCase() + ': ') : null, upper ? rest.join(': ') : v.claim), h('td', { class: v.held ? 'held' : 'failed' }, v.held ? 'HELD' : 'FAILED'), h('td', { class: 'note' }, v.measured)); }))));
}
/** organ 2's headline, from its receipt: what held, and the numbers behind D4 to D7 */
function headline2(r = receipt2) {
  const pp = r.detail.perPair, sum = (k) => pp.reduce((a, x) => a + (x.grown || k === 'cross' ? x[k] : 0), 0), n = pp.length * 10;
  const ctrl = (k) => r.detail.control.reduce((a, x) => a + x[k], 0) / r.detail.control.length, held2 = (id) => !!(r.verdicts.find((v) => v.id === id) || {}).held;
  const grown = pp.filter((x) => x.grown).length, bal = (k) => pp.reduce((a, x) => a + x[k], 0) / pp.length;
  return r.held + ' of ' + r.verdicts.length + ' sealed claims held. ' + grown + ' of 15 pairs grew a child. The cold judge named both parents as the top two in ' + sum('child') + ' of ' + n + ' child answers; one parent\'s answers alone got a given partner named beside them ' + pct(ctrl('judge')) + ' of the time' + (held2('D4') ? ', so the child carries both.' : ', so carrying both is not shown.') +
    ' The naive cross carried both in ' + sum('cross') + ' of ' + n + (held2('D5') ? ': the child is as good as a plain mix, in new words.' : ': the child falls short of a plain mix.') +
    ' Balance (0.50 is perfectly even): child ' + bal('childBalance').toFixed(2) + ', cross ' + bal('crossBalance').toFixed(2) + (held2('D6') ? ', so the child is the more even.' : ', so the child is not shown to be more even.') +
    ' The trace model named both parents in ' + sum('trace') + ' of ' + n + ' child answers, against ' + pct(ctrl('trace')) + ' for one parent alone' + (held2('D7') ? ': both reached the words.' : ': not shown to reach the words.');
}
function breeding() {
  if (!seal2) { fill('b2status', h('p', { class: 'out' }, 'Organ 2 could not be loaded.')); return; }
  fill('b2expect', seal2.expectations);
  const claims = h('ol', {}, seal2.claims.map((c) => h('li', {}, h('b', {}, c.id + ' '), c.claim)));
  if (receipt2) fill('b2status', h('p', {}, headline2()), h('p', { class: 'note' }, 'Sealed at commit ', h('code', {}, receipt2.sealed.commit.slice(0, 7)), ', measured once; the receipt re-derives byte for byte on GitHub\'s runner. The failures are kept.'));
  else if (kids) { const g = kids.pairs.filter((p) => p.child.grown).length;
    fill('b2status', h('p', {}, h('b', {}, g + ' of 15 pairs grew a child. '), g < 15 ? 'D2 needs all 15, so it fails, and the failure is kept. The pairs that grew none mostly wrote near-copies of a parent maxim, which the gate refuses; as sealed, their answers count as misses. The batch change this forced was written down before any answer: ' : '', g < 15 ? h('code', {}, 'claims/organ-2-amend.json') : null, g < 15 ? '. ' : '',
      'Pick a pair below. The answers, the cold judge and the receipt follow, each committed before the next step reads it. The seven claims:'), claims); }
  else fill('b2status', h('p', {}, 'Organ 2 is sealed (', h('code', {}, 'claims/organ-2.json'), ') and its kernel and tools are committed; the local model is breeding the 15 children. The seven claims they will be measured against:'), claims);
  if (!kids || !cards) return;
  const P = Object.fromEntries(cards.minds.filter((m) => m.grown).map((m) => [m.mind, m.card.maxims.map((x) => x.maxim)]));
  fill('b2pick', kids.pairs.map((p, i) => h('button', { 'aria-pressed': String(i === pairShown), class: i === pairShown ? 'go' : null, on: { click: () => { pairShown = i; breeding(); } } }, pairName(p.pair))));
  const p = kids.pairs[pairShown], [a, b] = p.pair, c = p.child, x = p.cross;
  const dropped = c.steps.filter((s) => !s.ok), keptN = c.steps.length - dropped.length;
  fill('b2cards',
    h('div', { class: 'panel' }, h('h3', {}, 'The child of ', mindTag(a, NAMES), ' and ', mindTag(b, NAMES)), c.grown ? h('p', {}, h('span', { class: 'pill' }, 'card ' + c.id.slice(0, 16))) : null,
      c.grown ? h('ol', { class: 'maxims' }, c.card.maxims.map((m) => { const g = childGate(m.maxim, P[a], P[b], seal.blocked);
        return h('li', {}, m.maxim, ' ', g.both ? h('span', { class: 'pill' }, 'draws on both') : null, h('span', { class: 'note' }, ' · gate re-run here: ' + (g.ok ? 'kept' : g.why))); }))
        : h('p', { class: 'failed' }, 'No child grew: only ' + keptN + ' of ' + c.steps.length + ' candidates passed the gate, and the seal needs 8.'),
      h('p', { class: 'note' }, keptN + ' of ' + c.steps.length + ' candidates kept by the gate; the child takes the first 12.'),
      dropped.length ? h('details', {}, h('summary', {}, 'The ' + dropped.length + ' the gate dropped, and why'), h('ul', {}, dropped.map((s) => h('li', {}, s.maxim + ' — ', h('i', {}, s.why))))) : h('p', { class: 'note' }, 'The gate dropped none.'),
      h('h3', {}, 'Voice'), x.card.voice.map((v, i) => h('div', { class: 'quote' }, h('small', {}, short(p.pair[i]) + ': '), '“' + v + '”'))),
    h('div', { class: 'panel' }, h('h3', {}, 'The naive cross'), h('p', { class: 'note' }, 'The control: six of each parent\'s own maxims, alternating, and the same voice. It never went through the local model.'),
      h('ol', { class: 'maxims' }, x.card.maxims.map((m, i) => h('li', {}, m.maxim, ' ', h('span', { class: 'pill' }, short(p.pair[i % 2]))))),
      h('p', { class: 'note' }, 'Card ' + x.id.slice(0, 16) + '.')));
  if (!receipt2) { fill('b2results'); return; }
  const d = receipt2.detail;
  fill('b2results', h('h3', {}, 'Results'), verdictTable(receipt2),
    h('h3', {}, 'Pair by pair'), h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Pair'), h('th', { class: 'num' }, 'Kept'), h('th', { class: 'num' }, 'Draw on both'), h('th', { class: 'num' }, 'Judge: child carried both'), h('th', { class: 'num' }, 'Judge: cross carried both'), h('th', { class: 'num' }, 'Balance: child'), h('th', { class: 'num' }, 'Balance: cross'), h('th', { class: 'num' }, 'Trace model: child'))),
      h('tbody', {}, d.perPair.map((r) => h('tr', {}, h('td', {}, pairName(r.pair)), h('td', { class: 'num' }, r.kept + ' / 16'), h('td', { class: 'num' }, r.both + ' / ' + r.kept), h('td', { class: 'num' }, r.grown ? r.child + ' / 10' : '—'), h('td', { class: 'num' }, r.cross + ' / 10'), h('td', { class: 'num' }, r.grown ? r.childBalance.toFixed(2) : '—'), h('td', { class: 'num' }, r.crossBalance.toFixed(2)), h('td', { class: 'num' }, r.grown ? r.trace + ' / 10' : '—')))))),
    h('p', { class: 'note' }, 'Carried both: the judge\'s numbers for both parents are each higher than for every other thinker. Balance: the smaller of the two parents\' numbers over their sum (0.50 is perfectly even). The control is each parent\'s own organ 1 answers, judged in the same batches: how often one parent alone gets a given partner named beside it.'),
    h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'One parent alone (control)'), h('th', { class: 'num' }, 'Answers'), h('th', { class: 'num' }, 'Judge: a partner named beside it'), h('th', { class: 'num' }, 'Trace model: a partner named beside it'))),
      h('tbody', {}, d.control.map((r) => h('tr', {}, h('td', {}, mindTag(r.mind, NAMES)), h('td', { class: 'num' }, r.n), h('td', { class: 'num' }, pct(r.judge)), h('td', { class: 'num' }, pct(r.trace))))))));
}

// ---------- traced from the real run ----------
function traced() {
  if (!cards || !drawn) return;
  const m = cards.minds[0], x = m.card.maxims[0], text = drawn.minds[0].passages.find((p) => p.index === x.from).text, g = gate(x.maxim, text, seal.blocked);
  const inPassage = content(text), shared = [...content(x.maxim)].filter((w) => inPassage.has(w));
  const a = byKey.get('card:' + m.mind + ':1'), p = a && reading.get('card:' + m.mind + ':1');
  fill('traced', h('ol', { class: 'steps' },
    h('li', {}, h('b', {}, 'The passage. '), NAMES[m.mind] + ', passage ' + x.from + ' of the book (FIT: ' + x.from + ' mod 10 is ' + (x.from % 10) + '). It begins:', h('div', { class: 'quote' }, firstWords(text, 45) + ' …')),
    h('li', {}, h('b', {}, 'The maxim the local model stated. '), h('div', { class: 'quote' }, x.maxim)),
    h('li', {}, h('b', {}, 'The gate, re-run in your browser. '), (g.ok ? 'Kept: ' : 'Dropped: ') + words(x.maxim).length + ' words; words it shares with its passage include ' + shared.slice(0, 6).join(', ') + '; no blocked word.'),
    h('li', {}, h('b', {}, 'The card. '), 'First of twelve maxims on card ', h('code', {}, m.id.slice(0, 16)), '.'),
    a ? h('li', {}, h('b', {}, 'An answer written from the card alone. '), 'Question 1: ' + Q[0], h('div', { class: 'quote' }, words(a.reply).slice(0, 60).join(' ') + ' …')) : h('li', {}, 'The answers are being written.'),
    p ? h('li', {}, h('b', {}, 'The cold judge\'s numbers. '), bars(p), recognises(p, m.mind) ? h('span', { class: 'held' }, 'Recognised as ' + NAMES[m.mind] + '.') : h('span', { class: 'failed' }, 'Not recognised as ' + NAMES[m.mind] + '.')) : null));
}

// ---------- blueprint ----------
function blueprint() {
  const what = { text: 'The traces: the author\'s own span, passages, FIT and TEST, words, the blocked-word check, the seeded shuffle', trace: 'The trace model: naive Bayes over words; no language model inside', card: 'The gate, card growth, sham cards and the card id', stats: 'Wilson intervals and the bootstrap lower bound', judge: 'Reading the judge\'s replies; the recognition rule', cost: 'The cost case on this page', breed: 'Organ 2: the pairs, the child gate (Latin script, traced, no copy), the child and the naive cross, what the judge carried, balance, the trace pair, the control' };
  const rows = witness ? witness.kernels : Object.keys(what).map((k) => ({ kernel: k }));
  fill($('kernels').querySelector('tbody'), rows.map((r) => h('tr', {}, h('td', {}, h('code', {}, 'src/' + r.kernel + '.mjs')), h('td', {}, what[r.kernel] || ''), h('td', { class: 'num' }, r.total ? r.killed + ' / ' + r.total : '—'))));
}

// ---------- the case ----------
const RANGES = { maximMinutes: [0, 5, 0.5, 'Minutes to write a maxim'], askSeconds: [0, 120, 5, 'Seconds to ask the seat for an answer'], decideSeconds: [0, 60, 5, 'Seconds to decide whose an answer is'], reviewers: [1, 5, 1, 'Reviewers reading every answer'], setupMinutes: [0, 120, 5, 'Minutes of a person to start and check the rail'], charsPerToken: [2, 5, 0.5, 'Characters per judge token'], seats: [0, 5, 1, 'AI seats held for the check'] };
const over = { ...ASSUME }; let perMonth = 1;
function runRecord() {
  if (!items || !drawn || !maxims || prompts.length !== 4 || !prompts.every((x) => typeof x === 'string')) return null;
  return { passageWords: drawn.minds.flatMap((m) => m.passages.map((p) => words(p.text).length)), perspectiveWords: items.map((x) => words(x.reply).length),
    localSeconds: maxims.items.reduce((a, x) => a + x.seconds, 0) + items.reduce((a, x) => a + x.seconds, 0),
    judgeInChars: prompts.reduce((a, x) => a + x.length, 0), judgeOutChars: batches.reduce((a, b) => a + b.reply.length, 0), judgeTokens: usage ? usage.tokens : 0 };
}
function caseView() {
  const run = runRecord();
  fill($('sources').querySelector('tbody'), (lock ? lock.entries : []).map((e) => { const url = (String(e.source).match(/https?:\/\/\S+/) || [])[0];
    return h('tr', {}, h('td', {}, e.what || e.product || e.model || e.chip || e.id), h('td', { class: 'mono' }, e.value ?? e.price ?? e.wpm ?? e.pencePerKwh ?? e.gbpPerUsd ?? (e.inPerM != null ? e.inPerM + ' / ' + e.outPerM + ' per M' : e.wattsHigh + ' W max')), h('td', {}, url ? h('a', { href: url }, (e.publisher || e.provider || e.vendor || new URL(url).hostname)) : e.source), h('td', {}, e.checked)); }));
  if (!run) { fill('costlead', 'Computed when the run is complete'); fill('costvs', h('p', { class: 'note' }, 'The case counts the words read, the seconds the local model ran and the characters the judge read and wrote, from this run\'s own records. It appears once the judge\'s replies are committed.')); return; }
  const c = compare(run, lock, over, perMonth), P = c.people, R = c.rail;
  fill('costlead', 'People: ' + hrs(P.totalHours) + ', ' + gbp(P.total) + ' · The rail: ' + gbp(R.total));
  fill('costvs',
    h('div', { class: 'panel' }, h('h3', {}, 'People with an AI seat'), h('ul', {},
      h('li', {}, 'Read the ' + run.passageWords.length + ' source passages: ' + hrs(P.hours.read)), h('li', {}, 'Write a maxim from each: ' + hrs(P.hours.write)),
      h('li', {}, 'Ask the seat for the ' + run.perspectiveWords.length + ' answers: ' + hrs(P.hours.ask)), h('li', {}, 'Read every answer blind and decide whose it is (' + c.assume.reviewers + ' reviewer' + (c.assume.reviewers === 1 ? '' : 's') + '): ' + hrs(P.hours.review)),
      h('li', {}, 'Staff time at the National Living Wage (' + gbp(c.rates.wage) + ' an hour): ' + gbp(P.staff)), h('li', {}, c.assume.seats + ' AI seat' + (c.assume.seats === 1 ? '' : 's') + ' for the month: ' + gbp(P.seat))),
      h('p', {}, h('b', {}, 'Total: ' + gbp(P.total)))),
    h('div', { class: 'panel' }, h('h3', {}, 'This rail'), h('ul', {},
      h('li', {}, 'A person starts and checks it: ' + hrs(R.totalHours) + ', ' + gbp(R.staff)),
      h('li', {}, 'The laptop ran the local model for ' + hrs(run.localSeconds / 3600) + ': ' + R.kWh.toFixed(3) + ' kWh at the chip\'s maximum ' + c.rates.watts + ' W, ' + gbp(R.power)),
      h('li', {}, 'The cold judge: ' + R.tokens.in.toLocaleString('en-GB') + ' tokens in and ' + R.tokens.out.toLocaleString('en-GB') + ' out, ' + gbp(R.judge) + '. Counted high: the input is ' + (run.judgeTokens > Math.ceil(run.judgeInChars / c.assume.charsPerToken) ? 'the harness\'s own count of the four whole judge sessions (their instructions, the batch, the reply), all priced as input' : 'its prompts at one token per ' + c.assume.charsPerToken + ' characters') + '; the replies at one token per ' + c.assume.charsPerToken + ' characters.'),
      h('li', {}, 'The trace model: seconds of the laptop, no cost worth counting')),
      h('p', {}, h('b', {}, 'Total: ' + gbp(R.total)))));
  const pw = run.passageWords.reduce((a, b) => a + b, 0), sw = run.perspectiveWords.reduce((a, b) => a + b, 0), r = c.rates, a = c.assume;
  fill('formulas', h('ul', {},
    h('li', {}, 'Reading the sources: ' + pw.toLocaleString('en-GB') + ' words in the ' + run.passageWords.length + ' passages ÷ ' + r.wpm + ' words a minute (the adult reading rate, Brysbaert 2019) = ' + hrs(P.hours.read) + '.'),
    h('li', {}, 'Writing the maxims: ' + run.passageWords.length + ' × ' + a.maximMinutes + ' minute = ' + hrs(P.hours.write) + '.'),
    h('li', {}, 'Asking the seat: ' + run.perspectiveWords.length + ' answers × ' + a.askSeconds + ' seconds = ' + hrs(P.hours.ask) + '.'),
    h('li', {}, 'Reviewing blind: (' + sw.toLocaleString('en-GB') + ' answer words ÷ ' + r.wpm + ' a minute + ' + run.perspectiveWords.length + ' × ' + a.decideSeconds + ' seconds to decide) × ' + a.reviewers + ' reviewer' + (a.reviewers === 1 ? '' : 's') + ' = ' + hrs(P.hours.review) + '.'),
    h('li', {}, 'Staff: ' + P.totalHours.toFixed(2) + ' hours × ' + gbp(r.wage) + ' = ' + gbp(P.staff) + '; seat: ' + a.seats + ' × ' + gbp(r.seat) + ' = ' + gbp(P.seat) + '.'),
    h('li', {}, 'The rail\'s person: ' + a.setupMinutes + ' minutes × ' + gbp(r.wage) + ' an hour = ' + gbp(R.staff) + '.'),
    h('li', {}, 'Power: ' + Math.round(run.localSeconds).toLocaleString('en-GB') + ' seconds × ' + r.watts + ' W ÷ 3,600,000 = ' + R.kWh.toFixed(3) + ' kWh × ' + r.pencePerKwh + 'p = ' + gbp(R.power) + '.'),
    h('li', {}, 'Judge: (' + R.tokens.in.toLocaleString('en-GB') + ' × $' + r.inPerM + ' + ' + R.tokens.out.toLocaleString('en-GB') + ' × $' + r.outPerM + ') ÷ 1,000,000 × ' + r.gbpPerUsd + ' £ per $ = ' + gbp(R.judge) + '.')),
    h('p', { class: 'note' }, 'The counts are from this run\'s own records; the rates from data/prices.lock.json; the arithmetic is src/cost.mjs, under the mutation gate.'));
  fill('year', h('label', { class: 'controls' }, 'Checks a month ', (() => { const i = h('input', { type: 'number', min: '1', max: '500', value: String(perMonth), 'aria-label': 'Checks a month' }); i.addEventListener('input', () => { const v = Number(i.value); if (Number.isFinite(v) && v >= 1 && v <= 500) { perMonth = v; caseView(); } }); return i; })()),
    h('p', {}, 'At ' + perMonth + ' check' + (perMonth === 1 ? '' : 's') + ' a month: people ' + gbp(c.year.people) + ' a year; the rail ' + gbp(c.year.rail) + '. ', h('b', {}, gbp(c.year.save) + ' saved and ' + Math.round(c.year.hoursBack) + ' hours of staff time back'), ', every one of them re-checkable.'),
    (() => { const med = lock.entries.find((e) => e.id === 'ons-ashe-2025-median-hourly'), alt = med && compare(run, { entries: lock.entries.map((e) => (e.id === 'uk-national-living-wage' ? { ...e, value: med.value } : e)) }, over, perMonth);
      return alt ? h('p', { class: 'note' }, 'At the UK median hourly wage (' + gbp(med.value) + ', ONS) instead of the legal floor: people ' + gbp(alt.people.total) + ' a check, the rail ' + gbp(alt.rail.total) + '; ' + gbp(alt.year.save) + ' saved a year at this rate of checks.') : null; })());
  $('runtime').textContent = 'For this check the local model ran for ' + hrs(maxims.items.reduce((a, x) => a + x.seconds, 0) / 3600) + ' on the 144 maxims and ' + hrs(items.reduce((a, x) => a + x.seconds, 0) / 3600) + ' on the 200 answers.';
}
function sliders() {
  fill('sliders', Object.entries(RANGES).map(([k, [lo, hi, st, label]]) => {
    const v = h('span', { class: 'mono' }, String(over[k])), i = h('input', { type: 'range', min: String(lo), max: String(hi), step: String(st), value: String(over[k]), 'aria-label': label });
    i.addEventListener('input', () => { over[k] = Number(i.value); v.textContent = i.value; caseView(); });
    return h('label', {}, h('span', {}, label), v, i);
  }));
}

// ---------- risks, board, paper ----------
function words2() {
  const d = receipt && receipt.detail;
  const risks = [
    ['The judge knows these thinkers too well; it may guess from famous ideas.', 'That is why the shams exist. A sham card carries maxims from all six under one label; the receipt compares real cards against shams' + (receipt ? ' (B5 ' + (held('B5') ? 'held' : 'failed') + ').' : '.')],
    ['A model is not the person.', 'Agreed, and the page says so first. A card is twelve sentences a small model drew from a translation. It is tested for whether a pattern carried, not for whether it says what the author would say.'],
    ['The judge is a cloud model.', 'It sees only the generated answers, in shuffled batches of 50, cold. Swap in a local judge and the whole run stays on the machine; the receipt names which judge was used.'],
    ['The local model writes modern English; the books are old translations.', receipt ? (held('B6') ? (leanRead() ? 'It mattered. The trace model, fitted only on the old books, held its sealed bar on the card answers, but it leans toward Emerson and James for any modern-English advice, and it almost never named the minds read from 17th-century translations. The page shows every call, and the next organ bars the word-count check against the controls instead of chance.' : 'The trace model, fitted only on the old books, still recognised the card answers: the voice carried into the words.') : 'Measured and said plainly: the trace model did not recognise the card answers at the sealed bar. What carried, carried as ideas, not as the old books\' words.') : 'B6 measures exactly this, and the expectation written before the run left it open.'],
    ['A result like this can be tuned until it looks good.', 'Not here. The prompts, seeds, questions, thresholds and claims were committed before any model was asked anything, and the measurement refuses to run if the seal changed.'],
  ];
  fill('risks', risks.map(([q, a]) => h('details', { class: 'panel' }, h('summary', {}, q), h('p', {}, a))));
  fill('board', receipt
    ? 'Organ 1 asked whether a twelve-line card grown from an author\'s own words carries a recognisable pattern of thought. ' + receipt.held + ' of ' + receipt.verdicts.length + ' sealed claims held. ' + (d.cardJudge ? 'A cold judge recognised ' + d.cardJudge.k + ' of ' + d.cardJudge.n + ' card answers (' + pct(d.cardJudge.rate) + ', chance 17%)' + (d.shamJudge ? ' against ' + d.shamJudge.k + ' of ' + d.shamJudge.n + ' sham answers' : '') + '. ' : '') + 'The whole check ran on one ordinary laptop, its only cloud step a judge that never saw a card, and it rebuilds byte for byte on GitHub\'s runner. The method is the product: any persona, from any source you own, grown and proven the same way before anyone relies on it.'
    : 'The board case is written from the receipt once it is committed.');
  if (receipt) fill('paperresults', h('p', {}, h('b', {}, 'Results. '), headline() + ' ' + receipt.verdicts.map((v) => v.id + ' ' + (v.held ? 'held' : 'failed')).join(', ') + '.'));
  fill('paper2results', receipt2 ? h('p', {}, h('b', {}, 'Organ 2 results. '), headline2() + ' ' + receipt2.verdicts.map((v) => v.id + ' ' + (v.held ? 'held' : 'failed')).join(', ') + '.')
    : h('p', { class: 'note' }, seal2 ? 'Organ 2 is sealed (claims/organ-2.json, committed before its code) and being bred; its results appear here from its receipt.' : ''));
}

// ---------- start ----------
overview(); cardView(); results(); breeding(); traced(); blueprint(); sliders(); caseView(); words2();
if (items) blind();
$('load').addEventListener('click', grow);
$('attr').addEventListener('click', () => model && attributeMine());
$('unseen').addEventListener('click', () => model && unseen.length && pickUnseen());
if (receipt) $('sealnote').append(' Sealed at commit ', h('code', {}, receipt.sealed.commit.slice(0, 7)), '; measured once.');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
