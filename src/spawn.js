import { createRNG } from './rng.js';
import { loadAllData } from './dataLoader.js';
import {
  rollZoneLevel,
  computeMonsterLevel,
  scaleStats,
  combineResists,
  clampResists,
  pickTierId,
} from './formulas.js';

/** @typedef {import('./types').GameData} GameData */
/** @typedef {import('./types').Monster} Monster */
/** @typedef {import('./types').Tier} Tier */
/** @typedef {import('./types').Difficulty} Difficulty */
/** @typedef {import('./types').Affix} Affix */
/** @typedef {import('./types').AffixInstance} AffixInstance */
/** @typedef {import('./types').UnitInstance} UnitInstance */
/** @typedef {import('./types').RNG} RNG */

const RES_KEYS = ['laser', 'plasma', 'ion', 'kinetic'];

/**
 * Merge difficulty multipliers with optional overrides.
 *
 * @param {Difficulty} diff
 * @param {{hp_mult?: number, dmg_mult?: number, def_mult?: number, res_bonus?: Record<string, number>}|undefined} o
 * @returns {Difficulty}
 */
function mergeDifficulty(diff, o) {
  const out = {
    ...diff,
    res_bonus: { ...(diff.res_bonus || {}) },
  };
  if (!o || typeof o !== 'object') return out;
  if (typeof o.hp_mult === 'number') out.hp_mult *= o.hp_mult;
  if (typeof o.dmg_mult === 'number') out.dmg_mult *= o.dmg_mult;
  if (typeof o.def_mult === 'number') out.def_mult *= o.def_mult;
  if (o.res_bonus && typeof o.res_bonus === 'object') {
    for (const key of RES_KEYS) {
      if (typeof o.res_bonus[key] === 'number') {
        out.res_bonus[key] = (out.res_bonus[key] || 0) + o.res_bonus[key];
      }
    }
  }
  return out;
}

/**
 * Spawn a pack of monsters for a zone and difficulty.
 *
 * @param {{zoneId: string, difficulty: string, seed?: string|number, debug?: boolean}} params
 * @returns {Promise<UnitInstance[]>}
 */
export async function spawnPack({ zoneId, difficulty, seed, debug = false }) {
  const data = await loadAllData();
  const rng = createRNG(seed ?? 'default');

  const zone = data.zones.find((z) => z.id === zoneId);
  if (!zone) {
    throw new Error(`spawnPack: zone '${zoneId}' not found`);
  }
  if (!Array.isArray(zone.spawn_table) || zone.spawn_table.length === 0) {
    throw new Error(`spawnPack: zone '${zoneId}' has empty spawn table`);
  }

  const zoneLevel = rollZoneLevel(zone, difficulty, rng);

  const mdefEntry = rng.pickWeighted(zone.spawn_table.map((s) => ({ ...s }))); // copy
  if (!mdefEntry) {
    throw new Error(`spawnPack: failed to pick monster for zone '${zoneId}'`);
  }

  const monster = data.monsters.find((m) => m.id === mdefEntry.monster_id);
  if (!monster) {
    throw new Error(`spawnPack: monster '${mdefEntry.monster_id}' not found`);
  }

  const defaultProbs = { normal: 0.86, champion: 0.10, unique: 0.035, boss: 0.005 };
  const tierId = pickTierId(defaultProbs, zone.tier_probs, rng);
  const tier = data.tiers.find((t) => t.id === tierId);
  if (!tier) {
    throw new Error(`spawnPack: tier '${tierId}' not found`);
  }

  const diff = data.difficulties.find((d) => d.id === difficulty);
  if (!diff) {
    throw new Error(`spawnPack: difficulty '${difficulty}' not found`);
  }

  const effDiff = mergeDifficulty(diff, zone.difficulty_multipliers);

  const affixPool = (diff.affix_pool || [])
    .map((id) => data.affixes.find((a) => a.id === id))
    .filter(Boolean);

  const leader = buildUnitInstance(
    monster,
    tierId,
    zoneLevel,
    effDiff,
    data,
    rng,
    { affixPool }
  );

  /** @type {UnitInstance[]} */
  const pack = [leader];

  if (tierId === 'unique' && tier.minions) {
    const [minC, maxC] = tier.minions.count_range;
    const count = rng.int(minC, maxC + 1);
    for (let i = 0; i < count; i++) {
      const extra = {
        level_bonus: tier.minions.level_bonus,
        hp_mult: tier.minions.hp_mult,
        dps_mult: tier.minions.dps_mult,
        def_mult: tier.minions.def_mult,
        affixPool: [],
        affixCount: 0,
      };
      const minion = buildUnitInstance(
        monster,
        'normal',
        zoneLevel,
        effDiff,
        data,
        rng,
        extra
      );
      pack.push(minion);
    }
  }

  if (debug) {
    const effDiffMults = {
      hp: effDiff.hp_mult,
      dmg: effDiff.dmg_mult,
      def: effDiff.def_mult,
      res_bonus: effDiff.res_bonus,
    };
    console.debug('[spawnPack]', {
      zoneId,
      tierId,
      zoneLevel,
      effDiffMults,
      override: !!zone.tier_probs || !!zone.difficulty_multipliers,
    });
  }

  return pack;
}

/**
 * Build a unit instance from definitions.
 *
 * @param {Monster} m
 * @param {string} tierId
 * @param {number} zoneLevel
 * @param {Difficulty} diff
 * @param {GameData} data
 * @param {RNG} rng
 * @param {Object} [extra]
 * @param {Affix[]} [extra.affixPool]
 * @param {number} [extra.affixCount]
 * @param {number} [extra.level_bonus]
 * @param {number} [extra.hp_mult]
 * @param {number} [extra.dps_mult]
 * @param {number} [extra.def_mult]
 * @returns {UnitInstance}
 */
export function buildUnitInstance(
  m,
  tierId,
  zoneLevel,
  diff,
  data,
  rng,
  extra = {}
) {
  const tier = data.tiers.find((t) => t.id === tierId);
  if (!tier) {
    throw new Error(`buildUnitInstance: tier '${tierId}' not found`);
  }

  let affixes = [];
  const pool = extra.affixPool || [];
  let count;
  if (typeof extra.affixCount === 'number') {
    count = extra.affixCount;
  } else {
    const [min, max] = tier.affix_count;
    count = rng.int(min, max + 1);
  }
  affixes = rollAffixes(pool, count, rng);

  const level = computeMonsterLevel(zoneLevel, m, tier, extra);

  const stats = scaleStats({
    base: { hp: m.base_hp, dps: m.base_dps, def: m.base_def },
    zoneLevel,
    monsterLevel: level,
    diff,
    tier,
    extra,
  });

  const affixRes = sumAffixRes(affixes);
  const resists = combineResists(m.base_res, diff.res_bonus, affixRes);
  const { map, immune } = clampResists(resists);

  const lootTable = tierId === 'unique' || tierId === 'boss' ? 'elite_creep' : 'common_creep';

  return {
    id: cryptoRandomLike(rng),
    monster_id: m.id,
    name: `${capitalize(m.id)} ${tierId}`,
    tier: tierId,
    level,
    stats,
    resists: map,
    flags: { immune: Array.from(immune) },
    affixes,
    ai: m.ai,
    lootTable,
  };
}

/**
 * Roll a set of affixes from a pool.
 *
 * @param {Affix[]} affixPool
 * @param {number} count
 * @param {RNG} rng
 * @returns {AffixInstance[]}
 */
export function rollAffixes(affixPool, count, rng) {
  const pool = [...(affixPool || [])];
  let c = Math.max(0, Math.floor(count));
  if (pool.length === 0 && c > 0) {
    console.warn('rollAffixes: affix pool empty, reducing count to 0');
    c = 0;
  }
  if (c > pool.length) {
    console.warn(`rollAffixes: clamped affix_count ${c} to pool size ${pool.length}`);
    c = pool.length;
  }
  /** @type {AffixInstance[]} */
  const res = [];
  for (let i = 0; i < c; i++) {
    const idx = rng.int(0, pool.length);
    const [picked] = pool.splice(idx, 1);
    res.push({ id: picked.id, mods: picked.mods });
  }
  return res;
}

/**
 * Create a simple GUID-like string from RNG.
 *
 * @param {RNG} rng
 * @returns {string}
 */
export function cryptoRandomLike(rng) {
  return 'u-' + rng.int(0, 1e9).toString(36);
}

/**
 * Capitalize the first letter of a string.
 *
 * @param {string} s
 * @returns {string}
 */
export function capitalize(s) {
  return typeof s === 'string' && s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Sum resistances provided by affixes.
 *
 * @param {AffixInstance[]} affixes
 * @returns {Record<string, number>}
 */
function sumAffixRes(affixes) {
  const res = {};
  for (const aff of affixes || []) {
    for (const key of RES_KEYS) {
      const v = aff.mods && typeof aff.mods[key] === 'number' ? aff.mods[key] : 0;
      if (v) res[key] = (res[key] || 0) + v;
    }
  }
  return res;
}

