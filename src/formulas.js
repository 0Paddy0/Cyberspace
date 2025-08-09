/**
 * @typedef {import('./types').Zone} Zone
 * @typedef {import('./types').RNG} RNG
 * @typedef {import('./types').Monster} Monster
 * @typedef {import('./types').Tier} Tier
 * @typedef {import('./types').Difficulty} Difficulty
 */

/**
 * @typedef {{hp: number, dps: number, def: number}} StatBlock
 */

/**
 * @typedef {{laser?: number, plasma?: number, ion?: number, kinetic?: number}} ResistMap
 */

/**
 * Clamp a number to an inclusive range.
 *
 * @param {number} n
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
export function clamp(n, lo, hi) {
  if (!Number.isFinite(n)) n = 0;
  if (!Number.isFinite(lo)) lo = 0;
  if (!Number.isFinite(hi)) hi = 0;
  return n < lo ? lo : n > hi ? hi : n;
}

/**
 * Round a number to two decimal places.
 *
 * @param {number} x
 * @returns {number}
 */
export function to2(x) {
  return Math.round((Number(x) || 0) * 100) / 100;
}

/**
 * Roll a random level for a zone at a given difficulty.
 *
 * @param {Zone} zone
 * @param {string} difficulty
 * @param {RNG} rng
 * @returns {number}
 */
export function rollZoneLevel(zone, difficulty, rng) {
  if (!zone || typeof zone !== 'object') {
    throw new Error('rollZoneLevel: zone must be an object');
  }
  const range = zone.level_range && zone.level_range[difficulty];
  if (!Array.isArray(range) || range.length !== 2) {
    throw new Error(`rollZoneLevel: missing level_range for difficulty ${difficulty}`);
  }
  let [min, max] = range;
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error('rollZoneLevel: invalid level range');
  }
  min = Math.floor(min);
  max = Math.floor(max);
  if (min > max) {
    throw new Error('rollZoneLevel: level range min greater than max');
  }
  if (!rng || typeof rng.int !== 'function') {
    throw new Error('rollZoneLevel: invalid rng');
  }
  return rng.int(min, max + 1);
}

/**
 * Compute the final monster level.
 *
 * @param {number} zoneLevel
 * @param {Monster} monsterDef
 * @param {Tier} tierDef
 * @param {{level_bonus?: number}|null} [extra=null]
 * @returns {number}
 */
export function computeMonsterLevel(zoneLevel, monsterDef, tierDef, extra = null) {
  if (!Number.isFinite(zoneLevel)) {
    throw new Error('computeMonsterLevel: zoneLevel must be a number');
  }
  const base = monsterDef && typeof monsterDef.base_level_offset === 'number' ? monsterDef.base_level_offset : 0;
  const tier = tierDef && typeof tierDef.level_bonus === 'number' ? tierDef.level_bonus : 0;
  const ex = extra && typeof extra.level_bonus === 'number' ? extra.level_bonus : 0;
  return zoneLevel + base + tier + ex;
}

/**
 * Scale monster stats based on various multipliers.
 *
 * @param {Object} params
 * @param {StatBlock} params.base
 * @param {number} params.zoneLevel
 * @param {number} params.monsterLevel
 * @param {Difficulty} params.diff
 * @param {Tier} params.tier
 * @param {{hp_mult?: number, dps_mult?: number, def_mult?: number}|null} [params.extra=null]
 * @returns {StatBlock}
 */
export function scaleStats({ base, zoneLevel, monsterLevel, diff, tier, extra = null }) {
  const levelDiff = Math.max(monsterLevel - zoneLevel, 0);
  const hpMult = diff.hp_mult * tier.hp_mult * (1 + 0.10 * levelDiff) * (extra && extra.hp_mult ? extra.hp_mult : 1);
  const dpsMult = diff.dmg_mult * tier.dps_mult * (1 + 0.08 * levelDiff) * (extra && extra.dps_mult ? extra.dps_mult : 1);
  const defMult = diff.def_mult * tier.def_mult * (1 + 0.06 * levelDiff) * (extra && extra.def_mult ? extra.def_mult : 1);

  return {
    hp: Math.round(base.hp * hpMult),
    dps: to2(base.dps * dpsMult),
    def: Math.round(base.def * defMult),
  };
}

const RES_KEYS = ['laser', 'plasma', 'ion', 'kinetic'];

/**
 * Combine resistance maps additively.
 *
 * @param {ResistMap} baseRes
 * @param {ResistMap} diffBonus
 * @param {ResistMap} [affixRes={}]
 * @returns {ResistMap}
 */
export function combineResists(baseRes, diffBonus, affixRes = {}) {
  const out = {};
  for (const key of RES_KEYS) {
    const b = baseRes && typeof baseRes[key] === 'number' ? baseRes[key] : 0;
    const d = diffBonus && typeof diffBonus[key] === 'number' ? diffBonus[key] : 0;
    const a = affixRes && typeof affixRes[key] === 'number' ? affixRes[key] : 0;
    out[key] = b + d + a;
  }
  return out;
}

/**
 * Clamp resistances to [-100, 99] and mark immunities.
 *
 * @param {ResistMap} resMap
 * @returns {{map: ResistMap, immune: Set<string>}}
 */
export function clampResists(resMap) {
  const map = {};
  const immune = new Set();
  for (const [key, val] of Object.entries(resMap || {})) {
    const v = Number(val) || 0;
    if (v >= 100) immune.add(key);
    map[key] = clamp(v, -100, 99);
  }
  return { map, immune };
}

/**
 * Pick a tier id based on probability weights.
 *
 * @param {Record<string, number>} defaultProbs
 * @param {Record<string, number>} [zoneOverrideProbs]
 * @param {RNG} rng
 * @returns {string}
 */
export function pickTierId(defaultProbs, zoneOverrideProbs, rng) {
  const probs = zoneOverrideProbs && Object.keys(zoneOverrideProbs).length ? zoneOverrideProbs : defaultProbs;
  if (!probs || typeof probs !== 'object') {
    throw new Error('pickTierId: invalid probability map');
  }
  if (!rng || typeof rng.float !== 'function') {
    throw new Error('pickTierId: invalid rng');
  }

  const entries = Object.entries(probs);
  const items = [];
  let total = 0;
  for (const [id, weight] of entries) {
    const w = Number(weight);
    if (w > 0) {
      items.push({ id, w });
      total += w;
    }
  }
  if (total <= 0) {
    throw new Error('pickTierId: no positive weights');
  }
  const r = rng.float();
  let acc = 0;
  for (const { id, w } of items) {
    acc += w / total;
    if (r < acc) return id;
  }
  return items[items.length - 1].id;
}

