/** Bounded, exact integer ratios for the diamond. No DOM or audio dependencies. */
export const MAX_ODD_LIMIT = 31;
export const MAX_NUMBERS = 16;
export const MAX_HARMONIC = 255;
export const clamp = (x, min, max) => Math.min(max, Math.max(min, x));

function positiveInteger(n) {
  if (!Number.isSafeInteger(n) || n < 1 || n > MAX_HARMONIC) {
    throw new RangeError('Use whole numbers from 1 to 255.');
  }
}
export function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}
export function reduce(n, d) {
  positiveInteger(n); positiveInteger(d);
  const g = gcd(n, d);
  return [n / g, d / g];
}
export function normalizeFrac(n, d) {
  positiveInteger(n); positiveInteger(d);
  while (n >= 2 * d) d *= 2;
  while (n < d) n *= 2;
  const g = gcd(n, d);
  return [n / g, d / g];
}
export function largestPrimeFactor(n) {
  positiveInteger(n);
  let largest = 1;
  for (let p = 2; p * p <= n; p++) {
    while (n % p === 0) { largest = p; n /= p; }
  }
  return Math.max(largest, n);
}
export function limitset(limit, prime = '') {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_ODD_LIMIT || limit % 2 === 0) {
    throw new RangeError('Choose an odd limit from 1 to 31.');
  }
  if (prime !== '' && (!Number.isInteger(Number(prime)) || Number(prime) < 2 || Number(prime) > MAX_HARMONIC)) {
    throw new RangeError('The prime limit must be a whole number from 2 to 255, or blank.');
  }
  return Array.from({ length: (limit + 1) / 2 }, (_, i) => 2 * i + 1)
    .filter(n => prime === '' || largestPrimeFactor(n) <= Number(prime));
}
export function parseCustom(text) {
  if (typeof text !== 'string' || text.length > 300 || !/^\s*\d+(?:[\s.,:]+\d+)*\s*$/.test(text)) {
    throw new RangeError('Enter whole numbers separated by spaces, periods, commas, or colons.');
  }
  const numbers = [...new Set(text.trim().split(/[\s.,:]+/).map(Number))];
  numbers.forEach(positiveInteger);
  if (numbers.length > MAX_NUMBERS) throw new RangeError('Use at most 16 different numbers.');
  return numbers;
}
export function pitch(n, d, folded, root) {
  const [num, den] = folded ? normalizeFrac(n, d) : reduce(n, d);
  const ratio = num / den;
  return { num, den, key: num + '/' + den, ratio, frequency: root * ratio, cents: 1200 * Math.log2(ratio) };
}
export function uniquePitches(numbers, folded, root) {
  const notes = new Map();
  for (const d of numbers) for (const n of numbers) {
    const note = pitch(n, d, folded, root);
    notes.set(note.key, note);
  }
  return [...notes.values()].sort((a, b) => a.ratio - b.ratio);
}

/**
 * Order axis harmonics without changing the set of ratios.
 * Chordal ordering lifts small harmonics into the 4:5:6:7 register;
 * higher harmonics then continue in numerical order.
 */
export function orderNumbers(numbers, layout = 'numerical') {
  numbers.forEach(positiveInteger);
  const copy = [...numbers];
  if (layout === 'numerical') return copy.sort((a, b) => a - b);
  if (layout === 'tonal') {
    const tone = n => { const [num, den] = normalizeFrac(n, 1); return num / den; };
    return copy.sort((a, b) => tone(a) - tone(b) || a - b);
  }
  if (layout === 'chordal') {
    const register = n => { while (n < 4) n *= 2; return n; };
    return copy.sort((a, b) => register(a) - register(b) || a - b);
  }
  throw new RangeError('Choose a numerical, tonal, or chordal layout.');
}
