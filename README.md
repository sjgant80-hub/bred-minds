# Bred Minds

**Live page: https://sjgant80-hub.github.io/bred-minds/**

Pattern-models of great minds, grown from their own public-domain words, then bred into new combinations: each step
sealed before it is measured, every failure kept.

These are MODELS of thought-patterns grown from public texts: not the people, not resurrections, not conscious beings.

- `data/texts/` six Project Gutenberg books, byte for byte, with Project Gutenberg's licence in each; `data/sources.json`
  names each one, its translator, its hash and the span of it that is the author's own words.
- `claims/` each organ's claims, committed before the code that measures them.
- `src/` the kernels (text, trace, card, stats, judge, cost), each under the mutation gate; `tools/` the steps, run in order:
  `grow-maxims` → `cards` → `write` → `judge` → `measure-1`. `receipts/` what was measured.
- `index.html` + `page/` the live page: it runs the same kernels in the browser and reads only committed files.

Re-run organ 1's measurement from the committed replies (no model is asked anything):

```
npm test
node tools/measure-1.mjs --check
```

Code: MIT. Texts: public domain (Project Gutenberg's licence travels with each file). Supplier and support: AI Native Solutions.
