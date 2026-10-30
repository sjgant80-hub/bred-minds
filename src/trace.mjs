// src/trace.mjs — the trace model of organ 1's seal: multinomial naive Bayes over lowercase words. The vocabulary is every
// word seen at least 3 times across all FIT passages together; each mind's counts over its own FIT passages, add-one
// smoothing, equal priors; a text goes to the mind with the highest log-likelihood, a tie to the earlier mind. It holds
// no language model: a pattern it recognises is a pattern in the words. Pure, deterministic, total.
import { tokens } from './text.mjs';

export const MIN_COUNT = 3;

/** fit({ mind: [passage text, …] }, order) → a model; minds in the order given */
export function fit(byMind, order) {
  const minds = Array.isArray(order) ? order.filter((m) => byMind && Array.isArray(byMind[m])) : [];
  const counts = new Map(minds.map((m) => [m, new Map()])), all = new Map();
  for (const m of minds) for (const p of byMind[m]) for (const t of tokens(p)) { counts.get(m).set(t, (counts.get(m).get(t) || 0) + 1); all.set(t, (all.get(t) || 0) + 1); }
  const vocab = new Set([...all].filter(([, n]) => n >= MIN_COUNT).map(([t]) => t)), V = vocab.size;
  const logp = new Map(minds.map((m) => {
    const c = counts.get(m), total = [...c].reduce((s, [t, n]) => s + (vocab.has(t) ? n : 0), 0), denom = Math.log(total + V);
    return [m, { known: new Map([...c].filter(([t]) => vocab.has(t)).map(([t, n]) => [t, Math.log(n + 1) - denom])), unseen: -denom }];
  }));
  return { minds, vocab, logp };
}

/** each mind's log-likelihood of a text (words outside the vocabulary are skipped) */
export function scores(model, text) {
  const ts = tokens(text).filter((t) => model.vocab.has(t));
  return model.minds.map((m) => { const l = model.logp.get(m); return ts.reduce((s, t) => s + (l.known.get(t) ?? l.unseen), 0); });
}

/** the mind a text is attributed to: the highest score, a tie to the earlier mind; null for a model with no minds */
export function attribute(model, text) {
  const s = scores(model, text);
  if (!s.length) return null;
  return model.minds[s.reduce((b, v, k) => (v > s[b] ? k : b), 0)];
}
