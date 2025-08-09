/**
 * Simple deterministic pseudo random number generator based on xorshift32.
 *
 * @param {string|number} seed
 * @returns {import('./types').RNG}
 */
export function createRNG(seed) {
  let state = hashSeed(seed);

  /**
   * Generate the next random float between 0 (inclusive) and 1 (exclusive).
   * @returns {number}
   */
  function next() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  }

  return {
    next,
    float: next,
    int(min, max) {
      if (typeof min !== 'number') min = 0;
      if (typeof max !== 'number') max = 0;

      min = Math.floor(min);
      max = Math.floor(max);

      if (min > max) {
        const tmp = min;
        min = max;
        max = tmp;
      }
      if (min === max) return min;

      return Math.floor(next() * (max - min)) + min;
    },
    pickWeighted(list) {
      if (!Array.isArray(list) || list.length === 0) {
        throw new Error('[rng] pickWeighted: empty list');
      }
      let total = 0;
      for (let i = 0; i < list.length; i++) {
        const w = list[i].weight;
        if (typeof w !== 'number' || Number.isNaN(w) || w < 0) {
          throw new Error(`[rng] pickWeighted: invalid weight at index ${i}`);
        }
        total += w;
      }
      if (total <= 0) {
        throw new Error('[rng] pickWeighted: total weight <= 0');
      }
      let r = next() * total;
      for (let i = 0; i < list.length; i++) {
        const w = list[i].weight;
        if (r < w) return list[i];
        r -= w;
      }
      return list[list.length - 1];
    },
  };
}

/**
 * Hash a string or number into a 32bit seed.
 * @param {string|number} v
 * @returns {number}
 */
export function hashSeed(v) {
  return typeof v === 'string' ? hashString(v) : normalizeSeed(Number(v) || 0);
}

/**
 * Convert any numeric value to an unsigned 32bit integer.
 * @param {number} n
 * @returns {number}
 */
function normalizeSeed(n) {
  n = Math.floor(n);
  n %= 4294967296; // 2^32
  if (n < 0) n += 4294967296;
  return n >>> 0;
}

/**
 * Very small string hash to convert a string to a 32bit seed.
 * @param {string} str
 * @returns {number}
 */
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return normalizeSeed(h);
}

