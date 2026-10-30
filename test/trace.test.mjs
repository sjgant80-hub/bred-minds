// trace.test.mjs — the trace model: fitted on what it is given only, the vocabulary at three sightings, add-one
// smoothing, equal priors, the highest log-likelihood wins, a tie goes to the earlier mind; nonsense gives nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fit, scores, attribute, MIN_COUNT } from '../src/trace.mjs';

const BY = { sea: ['wave wave tide salt shore', 'tide salt wave boat', 'salt wave shore'], hill: ['stone moss stone path', 'moss path rock stone', 'rock moss stone'], dust: ['wave stone'] };

test('a text goes to the mind whose words it uses', () => {
  const m = fit(BY, ['sea', 'hill']);
  assert.deepEqual(m.minds, ['sea', 'hill']);
  assert.equal(attribute(m, 'the salt tide and a wave'), 'sea');
  assert.equal(attribute(m, 'moss on the stone path'), 'hill');
  assert.equal(MIN_COUNT, 3);
});

test('the vocabulary: words seen at least three times across every mind together; others are skipped', () => {
  const m = fit(BY, ['sea', 'hill']);
  assert.deepEqual([...m.vocab].sort(), ['moss', 'salt', 'stone', 'wave']);
  assert.ok(!m.vocab.has('tide'), 'tide is seen twice');
  assert.deepEqual(scores(m, 'tide boat path'), [0, 0], 'words outside the vocabulary are skipped');
  assert.equal(attribute(m, 'tide boat path'), 'sea', 'a tie goes to the earlier mind');
  assert.equal(attribute(fit(BY, ['hill', 'sea']), 'tide boat path'), 'hill');
});

test('add-one smoothing over the vocabulary, each mind its own total', () => {
  const m = fit(BY, ['sea', 'hill']), [s, h] = scores(m, 'wave');
  assert.ok(Math.abs(s - Math.log((4 + 1) / (7 + 4))) < 1e-12, 'sea: wave 4 of 7 vocabulary words, V = 4');
  assert.ok(Math.abs(h - Math.log((0 + 1) / (7 + 4))) < 1e-12, 'hill never says wave');
  const two = scores(m, 'wave wave');
  assert.ok(Math.abs(two[0] - 2 * s) < 1e-12, 'each sighting counts');
  assert.ok(Math.abs(scores(m, 'WAVE')[0] - s) < 1e-12, 'lowercase');
});

test('fitted on what it is given and nothing else; nonsense gives nothing', () => {
  const a = fit(BY, ['sea', 'hill']), b = fit({ ...BY, dust: ['salt salt salt salt salt'] }, ['sea', 'hill']);
  assert.deepEqual(scores(a, 'salt wave'), scores(b, 'salt wave'), 'a mind not in the order is not read');
  assert.deepEqual(fit(BY, ['sea', 'nobody', 'hill']).minds, ['sea', 'hill']);
  assert.deepEqual(fit(null, ['sea']).minds, []); assert.deepEqual(fit(BY, 'sea').minds, []);
  assert.equal(attribute(fit(BY, []), 'wave'), null); assert.deepEqual(scores(fit(BY, []), 'wave'), []);
  assert.equal(attribute(fit({ x: ['a'] }, ['x']), 'a'), 'x', 'a model with an empty vocabulary still attributes');
});
