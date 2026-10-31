# Bred Minds

**Live page: https://sjgant80-hub.github.io/bred-minds/**

Pattern-models of great minds, grown from their own public-domain words, then bred into new combinations: each step
sealed before it is measured, every failure kept.

These are MODELS of thought-patterns grown from public texts: not the people, not resurrections, not conscious beings.

- `data/texts/` six Project Gutenberg books, byte for byte, with Project Gutenberg's licence in each; `data/sources.json`
  names each one, its translator, its hash and the span of it that is the author's own words.
- `claims/` each organ's claims, committed before the code that measures them.
- `src/` the kernels (text, trace, card, stats, judge, cost), each under the mutation gate; `tools/` the steps, run in order:
  `grow-maxims` → `cards` → `write` → `judge` → `measure-1`; organ 2: `breed` → `write2` → `judge2` → `measure-2`. `receipts/` what was measured. `after-1` writes
  `data/after/`: what was looked at after a receipt, labelled as not sealed.
- `index.html` + `page/` the live page: it runs the same kernels in the browser and reads only committed files.

Organ 1: **7 of 7 sealed claims held** (receipt `receipts/organ-1.json`). The cold judge recognised 114 of 120 card answers
against 5 of 60 shams; the word-count trace model held its bar (57 of 120) but leans toward Emerson and James, shown in full
on the page.

Organ 2, breeding: **2 of 7 sealed claims held, 5 failed and kept** (receipt `receipts/organ-2.json`; seal 35bf5f9,
amendment 4dacaf8). 13 of 15 pairs grew a child. The child carries both parents far above the control (68 of 150 against
0.147), but a plain cross of six of each parent's own maxims carries both better (100 of 150) and more evenly.

Re-run both measurements from the committed replies (no model is asked anything):

```
npm test
node tools/measure-1.mjs --check
node tools/after-1.mjs --check
node tools/breed.mjs --check
node tools/measure-2.mjs --check
```

Code: MIT. Texts: public domain (Project Gutenberg's licence travels with each file). Supplier and support: AI Native Solutions.
