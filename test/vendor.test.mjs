// vendor.test.mjs — every file under vendor/ is a copy, and says where it is a copy of. Each one is named in
// vendor/SOURCES.json with the repository, the commit, its path there, its git blob id and its SHA-256, and the bytes on
// disk match both hashes. GitHub's runner then fetches each file from that commit and compares it byte for byte (gate.yml),
// so a vendored file cannot be edited in place, and a file dropped into vendor/ without a record fails here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ROOT = new URL('../', import.meta.url);
const REC = JSON.parse(readFileSync(new URL('vendor/SOURCES.json', ROOT), 'utf8'));

/** every file under vendor/, as a path from the repository root */
function filesUnder(dir) {
  const out = [];
  for (const name of readdirSync(new URL(dir, ROOT))) {
    const p = dir + name;
    if (statSync(new URL(p, ROOT)).isDirectory()) out.push(...filesUnder(p + '/')); else out.push(p);
  }
  return out;
}

/** the id git gives a file's bytes: SHA-1 over "blob <length>\0" and the bytes */
const blobOf = (buf) => createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + buf.length + '\0'), buf])).digest('hex');

test('the record names each copy fully', () => {
  assert.equal(REC.kind, 'bred-minds.vendor');
  assert.ok(Array.isArray(REC.files) && REC.files.length >= 1);
  for (const f of REC.files) {
    assert.match(f.repo, /^[\w.-]+\/[\w.-]+$/, f.path);
    assert.match(f.commit, /^[0-9a-f]{40}$/, f.path);
    assert.match(f.blob, /^[0-9a-f]{40}$/, f.path);
    assert.match(f.sha256, /^[0-9a-f]{64}$/, f.path);
    assert.ok(typeof f.src === 'string' && f.src.length > 0 && !f.src.startsWith('/'), f.path);
    assert.ok(f.path.startsWith('vendor/'), f.path);
    assert.ok(typeof f.licence === 'string' && f.licence.length > 0, f.path);
  }
  assert.equal(new Set(REC.files.map((f) => f.path)).size, REC.files.length, 'each copy named once');
});

test('every file under vendor/ is named in the record, and nothing named is missing', () => {
  const onDisk = filesUnder('vendor/').filter((p) => p !== 'vendor/SOURCES.json').sort();
  assert.deepEqual(onDisk, REC.files.map((f) => f.path).sort());
});

test('the bytes on disk are the bytes the record names: its git blob id and its SHA-256', () => {
  for (const f of REC.files) {
    const buf = readFileSync(new URL(f.path, ROOT));
    assert.equal(blobOf(buf), f.blob, f.path + ': blob');
    assert.equal(createHash('sha256').update(buf).digest('hex'), f.sha256, f.path + ': sha256');
  }
});

test('the blob id rule is git\'s own (the two ids from `git hash-object --stdin`)', () => {
  assert.equal(blobOf(Buffer.from('')), 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
  assert.equal(blobOf(Buffer.from('hello\n')), 'ce013625030ba8dba906f756967f9e9ca394464a');
});
