// text.test.mjs — the traces read exactly as the seal says: the stop list is the sealed one; words, tokens, content
// words; blocked words whole and in any case; the author's own span by heading and occurrence; passages of 120 to 400
// words with headings and verse dropped; the TEST rule; the seeded shuffle. Nonsense gives empty, never a throw.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STOP, words, tokens, content, blockedIn, span, pieces, passages, isTest, shuffle } from '../src/text.mjs';

const seal = JSON.parse(readFileSync(new URL('../claims/organ-1.json', import.meta.url), 'utf8'));
const W = (n, w = 'word') => Array.from({ length: n }, (_, i) => w + i).join(' ');

test('the stop list is exactly the sealed one', () => {
  assert.deepEqual([...STOP], seal.stopWords);
  assert.ok(Object.isFrozen(STOP));
});

test('words, tokens and content words', () => {
  assert.deepEqual(words("Don't stop—it’s Émile's"), ["Don't", 'stop', 'it’s', "Émile's"]);
  assert.deepEqual(words(null), []); assert.deepEqual(words(''), []);
  assert.deepEqual(tokens("Don't STOP, it’s"), ["don't", 'stop', 'it', 's']);
  assert.deepEqual(tokens(undefined), []);
  assert.deepEqual([...content('The Stars and the things that bless us, with Nature')].sort(), ['bles', 'nature', 'star']);
  assert.deepEqual([...content('cat dog ease')], ['ease'], 'four letters or more');
  assert.equal(content('which would should').size, 0, 'stop words carry no claim');
});

test('blocked words: whole words and phrases, any case; a longer word is not the blocked one', () => {
  const B = seal.blocked;
  for (const s of ['As the STOIC said', 'william   james wrote', 'the over-man', 'like Thoreau.', 'the pragmatic method works']) assert.equal(blockedIn(s, B), true, s);
  for (const s of ['a stoical calm', 'James wrote it', 'pragmatics', 'marcuses', 'superhuman']) assert.equal(blockedIn(s, B), false, s);
  assert.equal(blockedIn('Stoic', null), false); assert.equal(blockedIn('Stoic', [7, '', '  ']), false);
  assert.equal(blockedIn(null, B), false);
  assert.equal(blockedIn('', ['  ']), false, 'a blocked entry with no words blocks nothing, even in an empty text'); assert.equal(blockedIn('', ['']), false);
});

test('the span: after the start marker, from the start heading at its occurrence to the end heading or the end marker', () => {
  const raw = ['head', '*** START OF X ***', '  CONTENTS', 'ONE', 'APPENDIX', '', 'ONE', 'text a', 'text b', 'APPENDIX', 'notes', '*** END OF X ***', 'licence'].join('\r\n');
  assert.equal(span(raw, { line: 'ONE', occurrence: 2 }, { line: 'APPENDIX', occurrence: 2 }), 'ONE\ntext a\ntext b');
  assert.equal(span(raw, { line: 'ONE', occurrence: 2 }, null), 'ONE\ntext a\ntext b\nAPPENDIX\nnotes');
  assert.equal(span(raw, { line: 'ONE', occurrence: 1 }, { line: 'APPENDIX', occurrence: 1 }), 'ONE');
  assert.equal(span(raw, { line: 'CONTENTS', occurrence: 1 }, null).split('\n')[0], '  CONTENTS', 'a heading is matched trimmed');
  for (const [s, e] of [[{ line: 'ONE', occurrence: 3 }, null], [{ line: 'ZZ', occurrence: 1 }, null], [{ line: 'ONE', occurrence: 0 }, null], [null, null], [{ line: 7, occurrence: 1 }, null], [{ line: 'ONE', occurrence: 2 }, { line: 'ONE', occurrence: 1 }]])
    assert.equal(span(raw, s, e), '', JSON.stringify([s, e]));
  assert.equal(span('no markers', { line: 'ONE', occurrence: 1 }, null), '');
  assert.equal(span('*** END OF X\n*** START OF X\nONE', { line: 'ONE', occurrence: 1 }, null), '', 'the end marker must come after the start');
  assert.equal(span(raw.replace('ONE\r\ntext a', 'ONE\ntext a'), { line: 'ONE', occurrence: 2 }, null).startsWith('ONE\ntext a'), true);
  assert.equal(span('*** START OF X\nONE\nx', { line: 'ONE', occurrence: 1 }, null), '', 'with no end marker there is no span');
  assert.equal(span('*** START OF X\nONE\nx\n*** END OF X', { line: 'ONE', occurrence: 1 }, null), 'ONE\nx', 'the start marker on the first line, the heading right after it');
  assert.equal(span('ONE\n*** END OF X', { line: 'ONE', occurrence: 1 }, null), '', 'an end marker alone is no span');
  assert.equal(span('ONE\nhead\n*** START OF X\nONE\ny\n*** END OF X', { line: 'ONE', occurrence: 1 }, null), 'ONE\ny', 'a heading before the start marker is not counted');
  assert.equal(span(raw, { line: 'ONE', occurrence: 1.5 }, null), '', 'an occurrence is a whole number');
});

test('passages: headings, contents and verse dropped; joined to at least 120 words; long ones cut to at most 400', () => {
  const para = (n) => W(n).replace(/(word\d*9) /g, '$1. ');
  const text = ['CHAPTER I', 'I. One\nII. Two\nIII. Three', para(50), para(80), 'short line\nshort line', para(130), para(950)].join('\n\n');
  const ps = passages(text);
  assert.ok(ps.every((p) => words(p).length >= 60 && words(p).length <= 400), ps.map((p) => words(p).length).join());
  assert.equal(words(ps[0]).length, 130, 'two short paragraphs join (50 + 80)');
  assert.ok(!ps[0].includes('CHAPTER') && !ps[0].includes('II. Two'), 'the heading and the contents are dropped');
  assert.equal(ps.slice(1).reduce((s, p) => s + words(p).length, 0), 130 + 950);
  assert.deepEqual(passages(W(90)), [], 'a tail under 120 words is dropped');
  assert.deepEqual(passages(null), []); assert.deepEqual(passages(''), []);
  assert.equal(passages(W(100) + '\r\n\r\n' + W(30)).length, 1, 'CRLF paragraphs read the same');
  assert.deepEqual(passages(W(120)).map((p) => words(p).length), [120], 'exactly 120 words is a passage');
  const eight = W(8, 'eight') + '\n' + W(8, 'more');
  assert.equal(words(passages(eight + '\n\n' + W(104)).join(' ')).length, 120, 'lines of exactly 8 words on average are kept');
  assert.deepEqual(passages(W(8, 'eight') + '\n' + W(7, 'less') + '\n\n' + W(105)), [], 'an average under 8 is dropped');
});

test('pieces: cut at sentence ends to at most 400 words; a short tail joins the piece before; no sentence end is cut at 400', () => {
  const s = (n) => W(n) + '.';
  const a = pieces([s(300), s(300), s(30)].join(' '));
  assert.deepEqual(a.map((p) => words(p).length), [300, 330]);
  const b = pieces(W(1000));
  assert.deepEqual(b.map((p) => words(p).length), [400, 400, 200]);
  assert.deepEqual(pieces(s(400)).map((p) => words(p).length), [400]);
  assert.deepEqual(pieces([s(250), s(250)].join(' ')).map((p) => words(p).length), [250, 250]);
  assert.deepEqual(pieces([s(150), s(150), s(150)].join(' ')).map((p) => words(p).length), [300, 150]);
  assert.deepEqual(pieces([s(200), s(200)].join(' ')).map((p) => words(p).length), [400], 'exactly 400 stays whole');
  assert.deepEqual(pieces([s(380), s(50)].join(' ')).map((p) => words(p).length), [400, 30], 'a piece under 60 joins the one before; over 400 is then cut');
  assert.deepEqual(pieces([s(380), s(60)].join(' ')).map((p) => words(p).length), [380, 60], 'a piece of exactly 60 stands');
  assert.deepEqual(pieces(W(399) + ' — end').map((p) => words(p).length), [400], '400 words with a stray dash is not cut');
  assert.deepEqual(pieces(W(800)).map((p) => words(p).length), [400, 400]);
});

test('the TEST rule: k mod 10 is 8 or 9', () => {
  assert.deepEqual(Array.from({ length: 21 }, (_, k) => k).filter(isTest), [8, 9, 18, 19]);
  for (const x of [-2, 8.5, '8', null]) assert.equal(isTest(x), false);
});

test('the seeded shuffle: a permutation, the same for the same seed, the input untouched', () => {
  const xs = Array.from({ length: 30 }, (_, i) => i), a = shuffle(xs, 100), b = shuffle(xs, 100);
  assert.deepEqual(a, b); assert.notDeepEqual(a, xs); assert.notDeepEqual(shuffle(xs, 101), a);
  assert.deepEqual([...a].sort((p, q) => p - q), xs); assert.deepEqual(xs, Array.from({ length: 30 }, (_, i) => i));
  assert.deepEqual(shuffle('x', 1), []); assert.deepEqual(shuffle([7], 1), [7]); assert.deepEqual(shuffle([1, 2], 3).sort(), [1, 2]);
  assert.deepEqual(shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 100), [2, 3, 6, 9, 5, 7, 0, 4, 1, 8], 'the draw is pinned: each pick by the seed library’s draw');
});
