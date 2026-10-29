import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFrac, largestPrimeFactor, limitset, parseCustom, pitch, uniquePitches } from '../js/modules/math.js';
import { DEFAULTS, readConfig, validateConfig, shareURL } from '../js/modules/config.js';

test('octave reduction preserves rational equivalence, including sub-unison pitches', () => {
  assert.deepEqual(normalizeFrac(7, 3), [7, 6]);
  assert.deepEqual(normalizeFrac(3, 7), [12, 7]);
  assert.deepEqual(normalizeFrac(4, 4), [1, 1]);
  assert.ok(Math.abs(pitch(3, 7, false, 440).frequency - 440 * 3 / 7) < 1e-10);
  assert.equal(pitch(3, 7, true, 440).key, '12/7');
});
test('known 5-, 7-, and 11-limit diamonds contain the expected pitches', () => {
  assert.deepEqual(limitset(7), [1, 3, 5, 7]);
  assert.deepEqual(limitset(11, 5), [1, 3, 5, 9]);
  assert.equal(uniquePitches(limitset(5), true, 220).length, 7);
  assert.equal(uniquePitches(limitset(7), true, 220).length, 13);
  assert.equal(uniquePitches(limitset(11), true, 220).length, 29);
  assert.equal(largestPrimeFactor(45), 5);
});
test('malformed and oversized inputs are rejected before allocation or factorization', () => {
  for (const n of [0, -1, Infinity, NaN, 1e20, 2.5]) assert.throws(() => normalizeFrac(n, 1));
  for (const n of [0, 2, 1000000000, Infinity]) assert.throws(() => limitset(n));
  assert.throws(() => limitset(7, 1000000000));
  for (const text of ['', '-3', '0.5', '256', '3abc5', '1e6', 'Infinity']) assert.throws(() => parseCustom(text));
  assert.throws(() => parseCustom(Array.from({length: 17}, (_, i) => i + 1).join('.')));
  assert.deepEqual(parseCustom('4:5:6:7:4'), [4, 5, 6, 7]);
});
test('labels do not change sounding pitch; fold is a separate setting', () => {
  const source = validateConfig({ ...DEFAULTS, labels: 'source' });
  const reduced = validateConfig({ ...DEFAULTS, labels: 'pitch' });
  assert.deepEqual(uniquePitches(limitset(7), source.folded, source.root), uniquePitches(limitset(7), reduced.folded, reduced.root));
});
test('sharing round-trips musical settings and invalid stored settings recover', () => {
  const c = { ...DEFAULTS, custom: '4.5.6.7.9.11', mode: 'custom', folded: false, root: 392 };
  const link = new URL(shareURL('https://example.test/subfolder/?old=1#test', c));
  assert.equal(link.pathname, '/subfolder/');
  assert.equal(link.hash, '');
  assert.deepEqual(readConfig(link.search).config, c);
  assert.deepEqual(readConfig('?diamond=%7Bbad').config, DEFAULTS);
  assert.ok(readConfig('', JSON.stringify({ root: -1 })).warning);
});

import { orderNumbers } from '../js/modules/math.js';
import { numbersFor } from '../js/modules/config.js';

test('all three 11-limit layouts match the requested historical orders', () => {
  const nums = [1, 3, 5, 7, 9, 11];
  assert.deepEqual(orderNumbers(nums, 'numerical'), [1, 3, 5, 7, 9, 11]);
  assert.deepEqual(orderNumbers(nums, 'tonal'), [1, 9, 5, 11, 3, 7]);
  assert.deepEqual(orderNumbers(nums, 'chordal'), [1, 5, 3, 7, 9, 11]);
  assert.deepEqual(nums, [1, 3, 5, 7, 9, 11]);
});
test('layouts handle smaller limits, extended limits, and custom harmonics without losing pitches', () => {
  assert.deepEqual(orderNumbers(limitset(5), 'chordal'), [1, 5, 3]);
  assert.deepEqual(orderNumbers(limitset(7), 'tonal'), [1, 5, 3, 7]);
  assert.deepEqual(orderNumbers(limitset(13), 'chordal'), [1, 5, 3, 7, 9, 11, 13]);
  const custom = [11, 4, 7, 5, 6, 9];
  assert.deepEqual(orderNumbers(custom, 'chordal'), [4, 5, 6, 7, 9, 11]);
  for (const folded of [true, false]) {
    const original = uniquePitches(custom, folded, 392);
    for (const layout of ['numerical', 'tonal', 'chordal']) {
      assert.deepEqual(uniquePitches(orderNumbers(custom, layout), folded, 392), original);
    }
  }
});
test('layout survives share links and old configurations retain numerical ordering', () => {
  const config = validateConfig({ ...DEFAULTS, limit: 11, layout: 'tonal' });
  assert.deepEqual(numbersFor(config), [1, 9, 5, 11, 3, 7]);
  const restored = readConfig(new URL(shareURL('https://example.test/', config)).search).config;
  assert.equal(restored.layout, 'tonal');
  assert.deepEqual(numbersFor(restored), numbersFor(config));
  assert.equal(readConfig('', JSON.stringify({ limit: 7 })).config.layout, 'numerical');
  assert.throws(() => validateConfig({ layout: 'unknown' }));
});

test('old default sound upgrades while custom and shared sounds remain explicit', () => {
  const old={...DEFAULTS,wave:'triangle',attack:5,release:250,root:440,volume:0.58};
  const upgraded=readConfig('',JSON.stringify(old)).config;
  assert.equal(upgraded.wave,'warm');assert.equal(upgraded.root,440);assert.equal(upgraded.volume,0.58);
  assert.equal(readConfig('',JSON.stringify({...old,attack:20})).config.wave,'triangle');
  const shared=new URL(shareURL('https://example.test/',old));
  assert.equal(readConfig(shared.search).config.wave,'triangle');
});
