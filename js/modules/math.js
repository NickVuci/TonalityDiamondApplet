/**
 * Math utilities module for Tonality Diamond Applet
 * Provides functions for calculations related to ratios, primes, and normalization
 */

/**
 * Calculate the greatest common divisor of two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} The GCD of a and b
 */
export const gcd = (a, b) => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
};

/**
 * Generate an array of prime numbers up to n (inclusive)
 * @param {number} n - Upper limit
 * @returns {number[]} Array of primes up to n
 */
export const primesUpTo = (n) => {
  n = Math.max(2, n | 0);
  const s = new Array(n + 1).fill(true);
  s[0] = s[1] = false;
  for (let p = 2; p * p <= n; p++) {
    if (s[p]) {
      for (let k = p * p; k <= n; k += p) {
        s[k] = false;
      }
    }
  }
  return [...Array(n + 1).keys()].filter(i => s[i]);
};

/**
 * Check if a number only contains prime factors from the allowed list
 * @param {number} n - Number to check
 * @param {number[]} allow - List of allowed prime factors
 * @returns {boolean} True if n only contains allowed prime factors
 */
export const factorAllowed = (n, allow) => {
  if (n === 1) return true;
  let m = n;
  for (const p of allow) {
    while (m % p === 0) m /= p;
  }
  return m === 1;
};

/**
 * Normalize a float to the range [1, 2)
 * @param {number} r - Number to normalize
 * @returns {number} Normalized value in [1, 2)
 */
export const normalizeFloat = (r) => {
  let x = r;
  while (x >= 2) x /= 2;
  while (x < 1) x *= 2;
  return x;
};

/**
 * Normalize a fraction to be in the first octave
 * @param {number} sn - Numerator
 * @param {number} sd - Denominator
 * @returns {[number, number]} Normalized [numerator, denominator]
 */
export const normalizeFrac = (sn, sd) => {
  if (sn === sd) return [1, 1];
  let n = sn, d = sd;
  while (n / d >= 2) d *= 2;
  while (n / d < 1) n *= 2;
  const g = gcd(n, d);
  return [n / g, d / g];
};

/**
 * Find the largest prime factor of a number
 * @param {number} n - Number to factorize
 * @returns {number} Largest prime factor
 */
export const largestPrimeFactor = (n) => {
  n = Math.abs(n | 0);
  if (n <= 1) return 1;
  let maxPrime = 1;
  while (n % 2 === 0) {
    maxPrime = 2;
    n /= 2;
  }
  for (let p = 3; p * p <= n; p += 2) {
    while (n % p === 0) {
      maxPrime = p;
      n /= p;
    }
  }
  if (n > 2) maxPrime = n;
  return maxPrime;
};

/**
 * Generate a set of odd numbers from 1 to L
 * @param {number} L - Upper limit
 * @returns {number[]} Array of odd numbers
 */
export const oddset = (L) => {
  const out = [];
  for (let i = 1; i <= L; i += 2) out.push(i);
  return out;
};

/**
 * Generate limit set with optional prime filtering
 * @param {number} L - Odd limit
 * @param {number|string} P - Prime limit (optional)
 * @returns {number[]} Array of numbers in the limit set
 */
export const limitset = (L, P) => {
  L = Math.max(1, L | 0);
  if (L % 2 === 0) L--;
  const odds = oddset(L);
  const p = parseInt(P, 10);
  if (!isFinite(p) || p < 2) return odds;
  const allow = primesUpTo(p);
  return odds.filter(n => factorAllowed(n, allow));
};

/**
 * Parse custom number input (period-separated values)
 * @param {string} text - Input string
 * @returns {number[]} Array of unique numbers
 */
export const parseCustom = (text) => {
  const arr = (text || '').split(/[^\d]+/).filter(Boolean).map(x => parseInt(x, 10)).filter(n => Number.isFinite(n) && n > 0);
  const out = [];
  const seen = new Set();
  for (const n of arr) {
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
};

/**
 * Clamp a value between min and max
 * @param {number} x - Value to clamp
 * @param {number} a - Minimum value
 * @param {number} b - Maximum value
 * @returns {number} Clamped value
 */
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
