import { limitset, parseCustom, orderNumbers } from './math.js';

export const DEFAULTS = Object.freeze({
  mode: 'limit', layout: 'numerical', limit: 5, prime: '', custom: '4.5.6.7.9.11', folded: false,
  labels: 'source', orientation: 'horizontal', root: 392, wave: 'warm',
  volume: 0.18, attack: 60, release: 900, tempo: 96, axisMode: 'chord'
});
export function validateConfig(raw) {
  const c = Object.fromEntries(Object.entries(DEFAULTS).map(([key, value]) => [key, raw[key] ?? value]));
  for (const [name, values] of Object.entries({
    mode: ['limit', 'custom'], layout: ['numerical', 'tonal', 'chordal'], labels: ['pitch', 'source'],
    orientation: ['horizontal', 'vertical'], wave: ['warm', 'sine', 'triangle', 'square', 'sawtooth'],
    axisMode: ['chord', 'arpeggio', 'tap']
  })) {
    if (!values.includes(c[name])) throw new RangeError('Invalid ' + name + '.');
  }
  if (typeof c.folded !== 'boolean') throw new RangeError('Invalid octave setting.');
  for (const [name, min, max] of [
    ['root', 20, 2000], ['volume', 0, 1], ['attack', 1, 1000],
    ['release', 30, 3000], ['tempo', 30, 240]
  ]) {
    if (typeof c[name] !== 'number' || !Number.isFinite(c[name]) || c[name] < min || c[name] > max) {
      throw new RangeError(name + ' must be between ' + min + ' and ' + max + '.');
    }
  }
  // Validate inactive controls too, so switching modes cannot resurrect bad input.
  limitset(c.limit, c.prime);
  parseCustom(c.custom);
  return c;
}
export const numbersFor = c => orderNumbers(c.mode === 'limit' ? limitset(c.limit, c.prime) : parseCustom(c.custom), c.layout);
export function readConfig(search, saved) {
  const params = new URLSearchParams(search);
  const shared = params.get('diamond');
  try {
    const config = shared ? JSON.parse(shared) : saved ? JSON.parse(saved) : {};
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error();
    // Upgrade the previous untouched sound preset, preserving deliberate sound edits and shared setups.
    if (!shared && config.wave === 'triangle' && config.attack === 5 && config.release === 250) {
      config.wave = DEFAULTS.wave; config.attack = DEFAULTS.attack; config.release = DEFAULTS.release;
    }
    if (shared && saved) {
      try { config.volume = validateConfig(JSON.parse(saved)).volume; } catch { /* Use the default listener volume. */ }
    }
    return { config: validateConfig(config), warning: '' };
  } catch {
    return { config: { ...DEFAULTS }, warning: 'That saved setup could not be loaded. Showing the default 5-limit diamond.' };
  }
}
export function shareURL(url, config) {
  const result = new URL(url);
  // Shared links include the musical setup; volume remains a listener preference.
  const { volume, ...musical } = validateConfig(config);
  result.search = '';
  result.hash = '';
  result.searchParams.set('diamond', JSON.stringify(musical));
  return result.href;
}
