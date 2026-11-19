// walls-v2.js — 3-tier historical wall system for castle defense
// ES module, no external dependencies

// ---------------------------------------------------------------------------
// VOXI Assets
// ---------------------------------------------------------------------------

const WOOD_VOXI = `
-- Wooden Palisade (short brown logs)
V 8 6 8
B 0 0 0 2 5 8 a
B 2 0 0 2 5 8 a
B 4 0 0 2 5 8 a
B 6 0 0 2 5 8 a
B 0 5 0 2 1 2 a
B 3 5 0 2 1 2 a
B 6 5 0 2 1 2 a
-- pointed tops
K 1 5 1 1 1 a
K 3 5 4 1 1 a
K 5 5 1 1 1 a
K 7 5 4 1 1 a
`.trim();

const STONE_VOXI = `
-- Stone Wall (medium gray blocks with crenellations)
V 8 A 8
B 0 0 0 8 8 8 9
-- mortar lines
B 0 3 0 8 1 8 8
B 0 6 0 8 1 8 8
-- crenellations on top
B 0 8 0 2 2 2 9
B 3 8 0 2 2 2 9
B 6 8 0 2 2 2 9
B 0 8 6 2 2 2 9
B 3 8 6 2 2 2 9
B 6 8 6 2 2 2 9
`.trim();

const IRON_VOXI = `
-- Iron Fortress (tall dark wall with machicolations)
V 8 E 8
B 0 0 0 8 C 8 0
-- reinforcement bands
B 0 3 0 8 1 8 9
B 0 7 0 8 1 8 9
B 0 B 0 8 1 8 9
-- overhanging machicolation ledge (wider than base)
B 0 C 0 8 2 8 0
B 0 C 0 1 2 1 9
B 7 C 0 1 2 1 9
-- arrow slits (dark holes)
B 2 5 0 1 2 1 0
B 5 5 0 1 2 1 0
B 2 9 0 1 2 1 0
B 5 9 0 1 2 1 0
`.trim();

const GATE_VOXI = `
-- Gate (wooden door with iron bands)
V 8 8 8
B 0 0 0 2 8 8 9
B 6 0 0 2 8 8 9
B 0 6 0 8 2 8 9
-- wooden door panels
B 2 0 2 4 6 4 a
-- iron bands across door
B 2 1 2 4 1 4 0
B 2 3 2 4 1 4 0
B 2 5 2 4 1 4 0
-- iron ring handle
S 4 3 1 1 0
`.trim();

// ---------------------------------------------------------------------------
// Tier Definitions
// ---------------------------------------------------------------------------

const TIER_ORDER = ['wood', 'stone', 'iron'];

const WALL_TIERS = Object.freeze({
  wood: Object.freeze({
    name: 'Wooden Palisade',
    hp: 100,
    cost: 20,
    height: 2,
    arrowSlitDps: 2,
    special: 'flammable',
    asset: WOOD_VOXI,
  }),
  stone: Object.freeze({
    name: 'Stone Wall',
    hp: 400,
    cost: 60,
    height: 4,
    arrowSlitDps: 2,
    special: null,
    asset: STONE_VOXI,
  }),
  iron: Object.freeze({
    name: 'Iron Fortress',
    hp: 800,
    cost: 120,
    height: 6,
    arrowSlitDps: 2,
    special: 'machicolation',
    asset: IRON_VOXI,
  }),
});

const GATE_DEF = Object.freeze({
  name: 'Castle Gate',
  hpRatio: 0.6,
  costRatio: 0.8,
  canToggle: true,
  asset: GATE_VOXI,
});

// ---------------------------------------------------------------------------
// Climb Rules
// ---------------------------------------------------------------------------

// Enemies that can climb stone walls (height 3-4)
const HEAVY_CLIMBERS = Object.freeze(new Set([
  'knight', 'shieldedKnight', 'ogre', 'heavyKnight',
]));

// ladderBearer always bypasses walls regardless of height
const WALL_BYPASS = Object.freeze(new Set(['ladderBearer']));

// ---------------------------------------------------------------------------
// Stats Lookups
// ---------------------------------------------------------------------------

/**
 * @param {string} tier - 'wood' | 'stone' | 'iron'
 * @returns {{ hp: number, cost: number, height: number, arrowSlitDps: number, asset: string, special: string|null, name: string }}
 */
function getWallTierStats(tier) {
  const data = WALL_TIERS[tier];
  if (!data) {
    throw new Error(`Unknown wall tier: ${tier}`);
  }
  return { ...data };
}

/**
 * Returns gate stats computed from a parent wall tier.
 * @param {string} [parentTier='wood'] - tier of the wall the gate belongs to
 * @returns {{ name: string, hp: number, cost: number, canToggle: boolean, asset: string }}
 */
function getGateStats(parentTier = 'wood') {
  const parent = WALL_TIERS[parentTier];
  if (!parent) {
    throw new Error(`Unknown parent tier for gate: ${parentTier}`);
  }
  return {
    name: GATE_DEF.name,
    hp: Math.round(parent.hp * GATE_DEF.hpRatio),
    cost: Math.round(parent.cost * GATE_DEF.costRatio),
    canToggle: GATE_DEF.canToggle,
    asset: GATE_DEF.asset,
  };
}

// ---------------------------------------------------------------------------
// Height / Climb Mechanics
// ---------------------------------------------------------------------------

/**
 * Determines whether an enemy type can climb a wall of a given height.
 * ladderBearer always bypasses walls.
 *
 * @param {number} wallHeight - height in blocks (2, 4, or 6)
 * @param {string} enemyType - e.g. 'soldier', 'knight', 'ogre'
 * @returns {boolean}
 */
function canClimbWall(wallHeight, enemyType) {
  if (!enemyType) return false;

  // ladderBearer always bypasses
  if (WALL_BYPASS.has(enemyType)) return true;

  // Wood (1-2): all ground enemies can climb
  if (wallHeight <= 2) return true;

  // Stone (3-4): only heavy enemies
  if (wallHeight <= 4) return HEAVY_CLIMBERS.has(enemyType);

  // Iron (5-6): nothing can climb
  return false;
}

// ---------------------------------------------------------------------------
// Passive Damage (Arrow Slits + Machicolation)
// ---------------------------------------------------------------------------

const ARROW_SLIT_RANGE = 3;   // cells
const MACHICOLATION_RANGE = 1; // cells — directly adjacent only
const MACHICOLATION_DPS = 5;

/**
 * Computes passive damage dealt by a wall to nearby enemies each tick.
 *
 * @param {{ tier: string }} wall - the wall building
 * @param {{ dist: number }[]} adjacentEnemies - enemies sorted by distance, each with at least { dist }
 * @param {number} dt - delta time in seconds
 * @returns {{ enemyIdx: number, damage: number }[]}
 */
function getWallPassiveDamage(wall, adjacentEnemies, dt) {
  if (!adjacentEnemies || adjacentEnemies.length === 0) return [];

  const tier = WALL_TIERS[wall.tier];
  if (!tier) return [];

  const results = [];

  // Arrow slit: hit the closest enemy within range
  const closestInRange = adjacentEnemies.findIndex(e => e.dist <= ARROW_SLIT_RANGE);
  if (closestInRange !== -1) {
    results.push({
      enemyIdx: closestInRange,
      damage: tier.arrowSlitDps * dt,
    });
  }

  // Machicolation (iron only): +5 dps to all enemies within 1 cell
  if (tier.special === 'machicolation') {
    for (let i = 0; i < adjacentEnemies.length; i++) {
      if (adjacentEnemies[i].dist > MACHICOLATION_RANGE) break;

      const existing = results.find(r => r.enemyIdx === i);
      if (existing) {
        // Combine with arrow slit damage — return new object (immutable)
        const idx = results.indexOf(existing);
        results[idx] = {
          enemyIdx: i,
          damage: existing.damage + MACHICOLATION_DPS * dt,
        };
      } else {
        results.push({
          enemyIdx: i,
          damage: MACHICOLATION_DPS * dt,
        });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Repair System
// ---------------------------------------------------------------------------

const REPAIR_FRACTION = 0.2;

/**
 * Heals each wall building by 20% of its max HP (between waves).
 * Does not exceed max HP. Returns a new array (no mutation).
 *
 * @param {{ tier: string, hp: number }[]} buildings - wall buildings
 * @returns {{ building: { tier: string, hp: number }, healAmount: number }[]}
 */
function repairWalls(buildings) {
  if (!buildings || buildings.length === 0) return [];

  return buildings.reduce((acc, building) => {
    const tierData = WALL_TIERS[building.tier];
    if (!tierData) return acc;

    const maxHp = tierData.hp;
    const heal = Math.min(
      Math.round(maxHp * REPAIR_FRACTION),
      maxHp - building.hp,
    );

    if (heal > 0) {
      return [...acc, { building, healAmount: heal }];
    }
    return acc;
  }, []);
}

// ---------------------------------------------------------------------------
// Economy: Sell & Upgrade
// ---------------------------------------------------------------------------

const SELL_RATIO = 0.5;

/**
 * @param {string} tier
 * @returns {number} gold received from selling
 */
function getWallSellValue(tier) {
  const data = WALL_TIERS[tier];
  if (!data) {
    throw new Error(`Unknown wall tier: ${tier}`);
  }
  return Math.round(data.cost * SELL_RATIO);
}

/**
 * @param {string} currentTier
 * @returns {string|null} next tier or null if max
 */
function getNextWallTier(currentTier) {
  const idx = TIER_ORDER.indexOf(currentTier);
  if (idx === -1 || idx >= TIER_ORDER.length - 1) return null;
  return TIER_ORDER[idx + 1];
}

/**
 * @param {string} fromTier
 * @returns {number|null} gold cost to upgrade, or null if already max tier
 */
function getWallUpgradeCost(fromTier) {
  const nextTier = getNextWallTier(fromTier);
  if (!nextTier) return null;

  const currentCost = WALL_TIERS[fromTier].cost;
  const nextCost = WALL_TIERS[nextTier].cost;
  return nextCost - currentCost;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  WALL_TIERS,
  GATE_DEF,
  getWallTierStats,
  getGateStats,
  getWallPassiveDamage,
  repairWalls,
  canClimbWall,
  getWallSellValue,
  getWallUpgradeCost,
  getNextWallTier,
};
