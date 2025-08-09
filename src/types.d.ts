export type Placeholder = unknown;

export interface WeightedItem {
  weight: number;
  [key: string]: unknown;
}

export interface RNG {
  next(): number;
  float(): number;
  int(min: number, max: number): number;
  pickWeighted<T extends WeightedItem>(list: T[]): T | undefined;
}

export interface Difficulty {
  id: string;
  hp_mult: number;
  dmg_mult: number;
  def_mult: number;
  res_bonus: number;
  affix_pool: string[];
}

export interface ZoneSpawnEntry {
  monster_id: string;
  weight: number;
}

export interface ZoneLevelRange {
  normal: [number, number];
  nightmare: [number, number];
  hell: [number, number];
}

export interface Zone {
  id: string;
  name: string;
  level_range: ZoneLevelRange;
  spawn_table: ZoneSpawnEntry[];
}

export interface Monster {
  id: string;
  role: string;
  base_level_offset: number;
  base_hp: number;
  base_dps: number;
  base_def: number;
  base_res: number;
  ai: string;
}

export interface TierMinions {
  count_range: [number, number];
  level_bonus: number;
  hp_mult: number;
  dps_mult: number;
  def_mult: number;
}

export interface Tier {
  id: string;
  level_bonus: number;
  hp_mult: number;
  dps_mult: number;
  def_mult: number;
  affix_count: [number, number];
  minions?: TierMinions;
}

export interface Affix {
  id: string;
  mods: Record<string, unknown>;
}

export interface LootTableEntry {
  group: string;
  weight: number;
  [key: string]: unknown;
}

export interface LootTable {
  id: string;
  rolls: number;
  entries: LootTableEntry[];
}

export interface GameData {
  difficulties: Difficulty[];
  zones: Zone[];
  monsters: Monster[];
  tiers: Tier[];
  affixes: Affix[];
  loot_tables: LootTable[];
}

export interface AffixInstance {
  id: string;
  mods: Record<string, unknown>;
}

export interface UnitInstance {
  id: string;
  monster_id: string;
  name: string;
  tier: string;
  level: number;
  stats: {
    hp: number;
    dps: number;
    def: number;
  };
  resists: Record<string, number>;
  flags: { immune: string[] };
  affixes: AffixInstance[];
  ai: string;
  lootTable: string;
}
