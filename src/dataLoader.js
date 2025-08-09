const cache = new Map();

function deepFreeze(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const key of Object.keys(obj)) {
      // @ts-ignore recursive freeze
      deepFreeze(obj[key]);
    }
  }
  return obj;
}

function fail(ctx, message) {
  return new Error(`${ctx} ${message}`);
}

function assertKey(obj, key, ctx) {
  if (!(key in obj)) {
    throw fail(ctx, `missing key '${key}'`);
  }
  return obj[key];
}

function assertArray(arr, ctx) {
  if (!Array.isArray(arr)) {
    throw fail(ctx, `must be array, got: ${JSON.stringify(arr)}`);
  }
  return arr;
}

/**
 * Load a JSON file with caching and helpful errors.
 * @param {string} path
 * @returns {Promise<any>}
 */
export async function loadJSON(path) {
  if (cache.has(path)) {
    return cache.get(path);
  }
  let res;
  try {
    res = await fetch(path);
  } catch (err) {
    throw new Error(`[${path}] fetch failed: ${err.message}`);
  }
  if (!res.ok) {
    throw new Error(`[${path}] HTTP ${res.status} ${res.statusText}`);
  }
  let text;
  try {
    text = await res.text();
  } catch (err) {
    throw new Error(`[${path}] read error: ${err.message}`);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(`[${path}] parse error: ${err.message}`);
  }
  deepFreeze(data);
  cache.set(path, data);
  return data;
}

/**
 * Load and validate all game data files.
 * @returns {Promise<import('./types').GameData>}
 */
export async function loadAllData() {
  const [difficulties, zones, monsters, tiers, affixes, loot_tables] = await Promise.all([
    loadJSON('/data/difficulties.json'),
    loadJSON('/data/zones.json'),
    loadJSON('/data/monsters.json'),
    loadJSON('/data/tiers.json'),
    loadJSON('/data/affixes.json'),
    loadJSON('/data/lootTables.json'),
  ]);

  // Difficulties
  assertArray(difficulties, '[difficulties.json]');
  difficulties.forEach((d, i) => {
    const c = `[difficulties.json] difficulty[${i}]`;
    assertKey(d, 'id', c);
    assertKey(d, 'hp_mult', c);
    assertKey(d, 'dmg_mult', c);
    assertKey(d, 'def_mult', c);
    assertKey(d, 'res_bonus', c);
    const pool = assertKey(d, 'affix_pool', c);
    assertArray(pool, `${c}.affix_pool`);
  });

  // Monsters
  assertArray(monsters, '[monsters.json]');
  monsters.forEach((m, i) => {
    const c = `[monsters.json] monster[${i}]`;
    assertKey(m, 'id', c);
    assertKey(m, 'role', c);
    assertKey(m, 'base_level_offset', c);
    assertKey(m, 'base_hp', c);
    assertKey(m, 'base_dps', c);
    assertKey(m, 'base_def', c);
    assertKey(m, 'base_res', c);
    assertKey(m, 'ai', c);
  });

  // Affixes
  assertArray(affixes, '[affixes.json]');
  affixes.forEach((a, i) => {
    const c = `[affixes.json] affix[${i}]`;
    assertKey(a, 'id', c);
    const mods = assertKey(a, 'mods', c);
    if (mods === null || typeof mods !== 'object' || Array.isArray(mods)) {
      throw fail('[affixes.json]', `affix[${i}].mods must be object, got: ${JSON.stringify(mods)}`);
    }
  });

  // Tiers
  assertArray(tiers, '[tiers.json]');
  tiers.forEach((t, i) => {
    const c = `[tiers.json] tier[${i}]`;
    assertKey(t, 'id', c);
    assertKey(t, 'level_bonus', c);
    assertKey(t, 'hp_mult', c);
    assertKey(t, 'dps_mult', c);
    assertKey(t, 'def_mult', c);
    const ac = assertKey(t, 'affix_count', c);
    if (!Array.isArray(ac) || ac.length !== 2) {
      throw fail('[tiers.json]', `tier[${i}].affix_count must be [min,max] array, got: ${JSON.stringify(ac)}`);
    }
    if (ac[0] > ac[1]) {
      throw fail('[tiers.json]', `tier[${i}].affix_count invalid: ${ac[0]} > ${ac[1]}`);
    }
    if (t.minions !== undefined) {
      const mc = `[tiers.json] tier[${i}].minions`;
      const minions = assertKey(t, 'minions', c);
      const cr = assertKey(minions, 'count_range', mc);
      if (!Array.isArray(cr) || cr.length !== 2) {
        throw fail('[tiers.json]', `tier[${i}].minions.count_range must be [min,max] array, got: ${JSON.stringify(cr)}`);
      }
      if (cr[0] > cr[1]) {
        throw fail('[tiers.json]', `tier[${i}].minions.count_range invalid: ${cr[0]} > ${cr[1]}`);
      }
      assertKey(minions, 'level_bonus', mc);
      assertKey(minions, 'hp_mult', mc);
      assertKey(minions, 'dps_mult', mc);
      assertKey(minions, 'def_mult', mc);
    }
  });

  // Zones
  assertArray(zones, '[zones.json]');
  zones.forEach((z, i) => {
    const c = `[zones.json] zone[${i}]`;
    assertKey(z, 'id', c);
    assertKey(z, 'name', c);
    const lr = assertKey(z, 'level_range', c);
    ['normal', 'nightmare', 'hell'].forEach((d) => {
      const r = assertKey(lr, d, `${c}.level_range`);
      if (!Array.isArray(r) || r.length !== 2) {
        throw fail('[zones.json]', `zone[${i}].level_range.${d} must be [min,max] array, got: ${JSON.stringify(r)}`);
      }
      if (r[0] > r[1]) {
        throw fail('[zones.json]', `zone[${i}].level_range.${d} invalid: ${r[0]} > ${r[1]}`);
      }
    });
    const st = assertKey(z, 'spawn_table', c);
    assertArray(st, `${c}.spawn_table`);
    st.forEach((s, j) => {
      const sc = `[zones.json] zone[${i}].spawn_table[${j}]`;
      assertKey(s, 'monster_id', sc);
      assertKey(s, 'weight', sc);
    });
  });

  // Loot tables
  assertArray(loot_tables, '[lootTables.json]');
  loot_tables.forEach((t, i) => {
    const c = `[lootTables.json] table[${i}]`;
    assertKey(t, 'id', c);
    assertKey(t, 'rolls', c);
    const entries = assertKey(t, 'entries', c);
    assertArray(entries, `${c}.entries`);
    entries.forEach((e, j) => {
      const ec = `[lootTables.json] table[${i}].entries[${j}]`;
      assertKey(e, 'group', ec);
      assertKey(e, 'weight', ec);
    });
  });

  // Cross-checks
  const monsterIds = new Set(monsters.map((m) => m.id));
  zones.forEach((z, i) => {
    z.spawn_table.forEach((s, j) => {
      if (!monsterIds.has(s.monster_id)) {
        throw fail('[zones.json]', `zone[${i}].spawn_table[${j}].monster_id '${s.monster_id}' not found in monsters`);
      }
    });
  });

  const affixIds = new Set(affixes.map((a) => a.id));
  difficulties.forEach((d, i) => {
    d.affix_pool.forEach((a, j) => {
      if (!affixIds.has(a)) {
        throw fail('[difficulties.json]', `difficulty[${i}].affix_pool[${j}] unknown affix '${a}'`);
      }
    });
  });

  return { difficulties, zones, monsters, tiers, affixes, loot_tables };
}

/**
 * Lookup a difficulty by id.
 * @param {import('./types').GameData} data
 * @param {string} id
 * @returns {import('./types').Difficulty|undefined}
 */
export function getDifficultyById(data, id) {
  return data.difficulties.find((d) => d.id === id);
}

/**
 * Lookup a zone by id.
 * @param {import('./types').GameData} data
 * @param {string} id
 * @returns {import('./types').Zone|undefined}
 */
export function getZoneById(data, id) {
  return data.zones.find((z) => z.id === id);
}

/**
 * Lookup a monster by id.
 * @param {import('./types').GameData} data
 * @param {string} id
 * @returns {import('./types').Monster|undefined}
 */
export function getMonsterById(data, id) {
  return data.monsters.find((m) => m.id === id);
}

/**
 * Lookup a tier by id.
 * @param {import('./types').GameData} data
 * @param {string} id
 * @returns {import('./types').Tier|undefined}
 */
export function getTierById(data, id) {
  return data.tiers.find((t) => t.id === id);
}
