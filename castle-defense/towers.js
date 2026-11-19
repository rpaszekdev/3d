// ══════════════════════════════════════════════
//  TOWER DEFINITIONS — Castle Defense
//  All tower types, stats, upgrades, and VOXI assets
// ══════════════════════════════════════════════
// VOXI coordinate note: all numeric args in VOXI commands are parsed as HEX.
// V dimensions are parsed as decimal. Y axis is UP.
// B X Y Z W H D C — box
// S X Y Z R C — sphere
// C X Y Z R H C — cylinder
// K X Y Z R H C — cone
// P X Y Z C — point
// Colors: 0=black 1=red 2=green 3=blue 4=cyan 5=magenta 6=yellow 7=orange
//         8=white 9=gray a=brown b=pink c=dark-green d=tan e=maroon f=navy

// ──────────────────────────────────────────────
//  VOXI ASSET STRINGS
// ──────────────────────────────────────────────

const ARROW_BASE = `V 8 12 8
-- Wooden base
B 2 0 2 4 2 4 a
B 1 0 1 6 1 6 a
-- Wooden shaft
C 4 2 4 2 6 a
-- Platform
B 1 7 1 6 1 6 a
B 2 8 2 4 1 4 9
-- Battlements
P 1 8 1 9
P 1 8 6 9
P 6 8 1 9
P 6 8 6 9
-- Bow (curved wood)
P 4 9 2 a
P 4 a 3 a
P 4 b 4 a
P 4 a 5 a
P 4 9 6 a
-- Arrow nocked
P 4 a 4 8`;

const ARROW_LONGBOW = `V 8 12 8
-- Reinforced base
B 2 0 2 4 2 4 a
B 1 0 1 6 1 6 a
-- Taller shaft
C 4 2 4 2 7 a
-- Platform
B 1 8 1 6 1 6 9
B 2 9 2 4 1 4 a
-- Battlements
P 1 9 1 9
P 1 9 6 9
P 6 9 1 9
P 6 9 6 9
-- Long bow (larger)
P 4 9 1 a
P 4 a 2 a
P 4 b 4 a
P 4 a 6 a
P 4 9 7 a
-- Arrow
P 4 a 3 8
P 4 a 4 8
P 4 a 5 8`;

const ARROW_SNIPER = `V 8 12 8
-- Stone reinforced base
B 1 0 1 6 3 6 9
B 2 0 2 4 3 4 a
-- Tall shaft
C 4 3 4 2 6 a
-- Scope platform
B 1 8 1 6 1 6 9
B 2 9 2 4 1 4 9
-- Sniper rail
P 1 9 1 9
P 1 9 6 9
P 6 9 1 9
P 6 9 6 9
-- Long crossbow
P 4 a 1 0
P 4 a 2 0
P 4 a 3 0
P 4 a 4 8
P 4 a 5 0
P 4 a 6 0
P 4 a 7 0
-- Scope lens
P 4 b 4 4`;

const ARROW_MULTISHOT = `V 8 12 8
-- Wide base
B 1 0 1 6 2 6 a
-- Shaft
C 4 2 4 2 6 a
-- Wide platform
B 0 7 0 8 1 8 a
B 1 8 1 6 1 6 9
-- Three bows mounted
P 2 9 2 a
P 2 a 3 a
P 2 b 4 a
P 2 a 5 a
P 2 9 6 a
-- Second bow
P 4 9 2 a
P 4 a 3 a
P 4 b 4 a
P 4 a 5 a
P 4 9 6 a
-- Third bow
P 6 9 2 a
P 6 a 3 a
P 6 b 4 a
P 6 a 5 a
P 6 9 6 a
-- Arrows
P 2 a 4 8
P 4 a 4 8
P 6 a 4 8`;

const CANNON_BASE = `V 8 12 8
-- Heavy stone base
B 0 0 0 8 3 8 9
B 1 3 1 6 2 6 9
-- Platform
B 1 5 1 6 1 6 9
-- Cannon barrel (metal)
B 3 6 1 2 2 4 0
B 3 6 0 2 2 1 9
-- Smoke stack
P 3 8 1 9
P 4 8 1 9
-- Corner posts
P 1 6 1 1
P 6 6 1 1
P 1 6 6 1
P 6 6 6 1`;

const CANNON_HEAVY = `V 8 12 8
-- Reinforced stone base
B 0 0 0 8 4 8 9
B 1 4 1 6 2 6 9
-- Armored platform
B 0 6 0 8 1 8 9
B 1 7 1 6 1 6 0
-- Big cannon barrel
B 2 7 0 4 3 5 0
B 3 8 0 2 1 1 9
-- Ammo rack
P 1 7 6 1
P 2 7 6 1
P 1 7 5 7
-- Corner armor
P 0 7 0 0
P 7 7 0 0
P 0 7 7 0
P 7 7 7 0`;

const CANNON_MORTAR = `V 8 12 8
-- Heavy fortified base
B 0 0 0 8 5 8 9
B 1 5 1 6 1 6 9
-- Mortar tube (angled up)
C 4 6 4 2 3 0
K 4 9 4 2 2 9
-- Shells stacked
P 1 6 1 1
P 2 6 1 1
P 1 6 2 1
-- Blast shield
B 0 6 0 8 2 1 9
B 0 6 7 8 2 1 9
-- Platform rim
P 0 6 0 7
P 7 6 0 7
P 0 6 7 7
P 7 6 7 7`;

const CANNON_RAPID = `V 8 12 8
-- Stone base
B 0 0 0 8 3 8 9
B 1 3 1 6 2 6 9
-- Platform
B 1 5 1 6 1 6 9
-- Twin barrels
B 2 6 1 2 1 4 0
B 4 6 1 2 1 4 0
B 2 6 0 2 1 1 9
B 4 6 0 2 1 1 9
-- Ammo belt
P 1 6 5 6
P 1 6 6 6
P 2 6 6 6
-- Gear mechanism
P 3 7 3 6
P 3 7 4 6
-- Corner posts
P 1 6 1 1
P 6 6 1 1
P 1 6 6 1
P 6 6 6 1`;

const FROST_BASE = `V 8 12 8
-- Ice foundation
B 2 0 2 4 1 4 4
B 1 0 1 6 1 6 3
-- Crystal pillar
C 4 1 4 2 5 4
-- Ice platform
B 1 6 1 6 1 6 4
-- Crystal spire
K 4 7 4 2 4 4
-- Ice shards
P 2 7 2 8
P 5 7 2 8
P 2 7 5 8
P 5 7 5 8
-- Frost glow
P 4 b 4 8`;

const FROST_UPGRADED = `V 8 12 8
-- Thicker ice base
B 1 0 1 6 2 6 3
B 2 0 2 4 2 4 4
-- Crystal pillar
C 4 2 4 2 5 4
-- Wide platform
B 0 7 0 8 1 8 4
B 1 7 1 6 1 6 3
-- Tall crystal spire
K 4 8 4 2 3 4
-- Ice shards (larger)
P 1 8 1 8
P 6 8 1 8
P 1 8 6 8
P 6 8 6 8
P 2 8 2 4
P 5 8 5 4
-- Frost glow
P 4 b 4 8
P 3 a 4 4`;

const FROST_BLIZZARD = `V 8 12 8
-- Wide frozen base
B 0 0 0 8 2 8 3
B 1 0 1 6 2 6 4
-- Central pillar
C 4 2 4 2 4 4
-- Blizzard ring platform
B 0 6 0 8 1 8 4
-- Outer ice ring
C 4 7 4 3 1 3
-- Crystal spire center
K 4 7 4 2 4 4
-- Swirling ice shards
P 0 8 4 8
P 7 8 4 8
P 4 8 0 8
P 4 8 7 8
P 1 9 1 4
P 6 9 6 4
-- Frost glow apex
P 4 b 4 8`;

const FROST_PERMAFROST = `V 8 12 8
-- Deep frozen base
B 1 0 1 6 3 6 3
B 2 1 2 4 2 4 f
-- Frozen crystal shaft
C 4 3 4 1 5 4
-- Permafrost encasement
B 3 3 3 2 4 2 3
-- Sharp crystal top
K 4 8 4 1 3 8
-- Deep ice shards
P 2 8 2 4
P 5 8 2 4
P 2 8 5 4
P 5 8 5 4
-- Inner glow
P 4 5 4 8
P 4 7 4 8
P 4 b 4 4`;

const LIGHTNING_BASE = `V 8 12 8
-- Metal base
B 2 0 2 4 2 4 9
B 1 0 1 6 1 6 0
-- Metal spire shaft
C 4 2 4 1 7 9
-- Conductive rings
C 4 4 4 2 1 0
C 4 7 4 2 1 0
-- Spark tip
K 4 9 4 1 2 6
-- Spark accents
P 2 5 4 6
P 6 5 4 6
P 4 5 2 6
P 4 5 6 6
P 4 b 4 6`;

const LIGHTNING_UPGRADED = `V 8 12 8
-- Reinforced metal base
B 1 0 1 6 2 6 0
B 2 0 2 4 2 4 9
-- Taller spire
C 4 2 4 1 8 9
-- Conductive rings (3)
C 4 4 4 2 1 0
C 4 6 4 2 1 0
C 4 8 4 2 1 0
-- Spark tip
K 4 a 4 1 1 6
-- More spark accents
P 1 5 4 6
P 7 5 4 6
P 4 5 1 6
P 4 5 7 6
P 2 7 2 6
P 6 7 6 6
P 4 b 4 6`;

const LIGHTNING_TESLA = `V 8 12 8
-- Heavy metal base
B 0 0 0 8 3 8 0
B 1 0 1 6 3 6 9
-- Tesla coil shaft
C 4 3 4 1 6 9
-- Large coil rings
C 4 4 4 3 1 0
C 4 6 4 3 1 0
C 4 8 4 3 1 0
-- Tesla orb top
S 4 a 4 1 6
-- Electric arcs
P 1 5 4 6
P 7 5 4 6
P 4 5 1 6
P 4 5 7 6
P 1 7 1 6
P 7 7 7 6
P 1 7 7 6
P 7 7 1 6
P 4 b 4 6`;

const LIGHTNING_STORM = `V 8 12 8
-- Storm base
B 1 0 1 6 2 6 0
B 2 0 2 4 2 4 9
-- Thick power core
C 4 2 4 2 5 9
-- Storm collector dish
B 1 7 1 6 1 6 0
-- Power rod
C 4 8 4 1 3 6
-- Storm cloud (dark)
S 4 b 4 2 9
-- Lightning bolts
P 2 8 2 6
P 6 8 2 6
P 2 8 6 6
P 6 8 6 6
P 4 7 4 6
P 3 9 3 6
P 5 9 5 6`;

const BUFF_BASE = `V 8 12 8
-- Golden base
B 2 0 2 4 2 4 6
B 1 0 1 6 1 6 7
-- Central pillar
C 4 2 4 1 4 6
-- Drum body
C 4 6 4 2 3 7
-- Drum skin top
C 4 9 4 2 1 6
-- Ornamental posts
P 2 6 2 6
P 6 6 2 6
P 2 6 6 6
P 6 6 6 6
-- Beacon flame
P 4 a 4 1
P 4 b 4 6`;

const BUFF_UPGRADED = `V 8 12 8
-- Wide golden base
B 1 0 1 6 2 6 7
B 2 0 2 4 2 4 6
-- Pillar
C 4 2 4 1 4 6
-- Larger drum
C 4 6 4 3 3 7
-- Drum top
C 4 9 4 3 1 6
-- Ornaments
P 1 7 1 6
P 7 7 1 6
P 1 7 7 6
P 7 7 7 6
P 1 8 4 6
P 7 8 4 6
-- Beacon flame (taller)
P 4 a 4 1
P 4 b 4 6
P 3 a 4 7`;

const BUFF_WARDRUM = `V 8 12 8
-- Grand golden base
B 0 0 0 8 3 8 7
B 1 0 1 6 3 6 6
-- Twin drum pillars
C 2 3 4 1 3 6
C 6 3 4 1 3 6
-- Massive war drum
C 4 6 4 3 4 7
-- Drum skin
C 4 a 4 3 1 6
-- Drumsticks
P 1 8 4 a
P 7 8 4 a
P 1 9 4 a
P 7 9 4 a
-- War banner
P 4 b 4 1
P 4 b 3 1
P 4 b 5 1`;

const BUFF_ARSENAL = `V 8 12 8
-- Arsenal base
B 1 0 1 6 2 6 7
B 2 0 2 4 2 4 6
-- Weapon rack pillar
C 4 2 4 2 5 6
-- Arsenal platform
B 0 7 0 8 1 8 7
-- Weapon displays
P 1 8 1 9
P 1 8 3 0
P 1 8 5 9
-- Crossed swords
P 2 9 4 8
P 3 a 4 8
P 5 a 4 8
P 6 9 4 8
-- Golden aura beacon
P 4 8 4 6
P 4 9 4 6
P 4 a 4 1
P 4 b 4 6`;

const WALL_BASE = `V 8 12 8
-- Stone wall block
B 0 0 0 8 5 8 9
-- Battlements
B 0 5 0 2 2 8 9
B 3 5 0 2 2 8 9
B 6 5 0 2 2 8 9
-- Mortar lines
P 0 2 0 8
P 2 2 0 8
P 4 2 0 8
P 6 2 0 8`;

const WALL_REINFORCED = `V 8 12 8
-- Thick stone wall
B 0 0 0 8 7 8 9
-- Battlements
B 0 7 0 2 2 8 9
B 3 7 0 2 2 8 9
B 6 7 0 2 2 8 9
-- Iron bands
B 0 3 0 8 1 8 0
-- Corner iron
P 0 5 0 0
P 7 5 0 0
P 0 5 7 0
P 7 5 7 0`;

const WALL_FORTRESS = `V 8 12 8
-- Massive fortress wall
B 0 0 0 8 9 8 9
-- Thick battlements
B 0 9 0 3 2 8 9
B 5 9 0 3 2 8 9
-- Iron reinforcement bands
B 0 3 0 8 1 8 0
B 0 6 0 8 1 8 0
-- Arrow slits
P 4 5 0 0
P 4 7 0 0
-- Corner towers
B 0 0 0 2 b 2 9
B 6 0 0 2 b 2 9
P 1 b 1 9
P 7 b 1 9`;

const WALL_SPIKE = `V 8 12 8
-- Stone wall block
B 0 0 0 8 6 8 9
-- Battlements
B 0 6 0 2 2 8 9
B 3 6 0 2 2 8 9
B 6 6 0 2 2 8 9
-- Metal spikes (front face)
P 1 3 0 0
P 3 2 0 0
P 5 3 0 0
P 7 2 0 0
P 2 4 0 9
P 4 4 0 9
P 6 4 0 9
-- Spike tips
P 1 4 0 8
P 3 3 0 8
P 5 4 0 8
P 7 3 0 8`;

// ──────────────────────────────────────────────
//  TOWER DEFINITIONS
// ──────────────────────────────────────────────

export const TOWER_DEFS = {
  arrow: {
    name: 'Arrow Tower',
    cost: 50,
    stats: { range: 8, damage: 10, fireRate: 1.0, splash: 0, canHitFlying: true },
    special: null,
    asset: ARROW_BASE,
    upgrades: [
      {
        name: 'Long Bow',
        cost: 75,
        stats: { range: 9, damage: 15, fireRate: 1.0, splash: 0, canHitFlying: true },
        special: null,
        asset: ARROW_LONGBOW
      },
      {
        branches: [
          {
            name: 'Sniper',
            cost: 150,
            stats: { range: 12, damage: 30, fireRate: 1.0, splash: 0, canHitFlying: true },
            special: null,
            asset: ARROW_SNIPER
          },
          {
            name: 'Multishot',
            cost: 150,
            stats: { range: 9, damage: 10, fireRate: 1.0, splash: 0, canHitFlying: true },
            special: { type: 'multishot', targets: 3 },
            asset: ARROW_MULTISHOT
          }
        ]
      }
    ]
  },

  cannon: {
    name: 'Cannon Tower',
    cost: 100,
    stats: { range: 6, damage: 30, fireRate: 2.0, splash: 2, canHitFlying: false },
    special: null,
    asset: CANNON_BASE,
    upgrades: [
      {
        name: 'Heavy Cannon',
        cost: 120,
        stats: { range: 6, damage: 40, fireRate: 2.0, splash: 2.5, canHitFlying: false },
        special: null,
        asset: CANNON_HEAVY
      },
      {
        branches: [
          {
            name: 'Mortar',
            cost: 200,
            stats: { range: 6, damage: 60, fireRate: 2.0, splash: 3.5, canHitFlying: false },
            special: null,
            asset: CANNON_MORTAR
          },
          {
            name: 'Rapid Fire',
            cost: 200,
            stats: { range: 6, damage: 45, fireRate: 1.2, splash: 2.5, canHitFlying: false },
            special: null,
            asset: CANNON_RAPID
          }
        ]
      }
    ]
  },

  frost: {
    name: 'Frost Tower',
    cost: 80,
    stats: { range: 6, damage: 5, fireRate: 1.5, splash: 0, canHitFlying: true },
    special: { type: 'slow', factor: 0.4, duration: 2.0 },
    asset: FROST_BASE,
    upgrades: [
      {
        name: 'Deep Frost',
        cost: 100,
        stats: { range: 6, damage: 5, fireRate: 1.5, splash: 0, canHitFlying: true },
        special: { type: 'slow', factor: 0.3, duration: 2.5 },
        asset: FROST_UPGRADED
      },
      {
        branches: [
          {
            name: 'Blizzard',
            cost: 180,
            stats: { range: 6, damage: 5, fireRate: 1.5, splash: 3, canHitFlying: true },
            special: { type: 'slow', factor: 0.3, duration: 2.5 },
            asset: FROST_BLIZZARD
          },
          {
            name: 'Permafrost',
            cost: 180,
            stats: { range: 6, damage: 5, fireRate: 1.5, splash: 0, canHitFlying: true },
            special: { type: 'slow', factor: 0.15, duration: 4.0 },
            asset: FROST_PERMAFROST
          }
        ]
      }
    ]
  },

  lightning: {
    name: 'Lightning Tower',
    cost: 120,
    stats: { range: 7, damage: 20, fireRate: 1.8, splash: 0, canHitFlying: true },
    special: { type: 'chain', targets: 3, falloff: 0.6 },
    asset: LIGHTNING_BASE,
    upgrades: [
      {
        name: 'High Voltage',
        cost: 150,
        stats: { range: 7, damage: 30, fireRate: 1.8, splash: 0, canHitFlying: true },
        special: { type: 'chain', targets: 4, falloff: 0.6 },
        asset: LIGHTNING_UPGRADED
      },
      {
        branches: [
          {
            name: 'Tesla',
            cost: 250,
            stats: { range: 7, damage: 30, fireRate: 1.8, splash: 0, canHitFlying: true },
            special: { type: 'chain', targets: 6, falloff: 0.4 },
            asset: LIGHTNING_TESLA
          },
          {
            name: 'Storm',
            cost: 250,
            stats: { range: 7, damage: 50, fireRate: 1.2, splash: 0, canHitFlying: true },
            special: null,
            asset: LIGHTNING_STORM
          }
        ]
      }
    ]
  },

  buff: {
    name: 'Buff Tower',
    cost: 150,
    stats: { range: 5, damage: 0, fireRate: 0, splash: 0, canHitFlying: false },
    special: { type: 'buff', attackSpeedBoost: 0.2, damageBoost: 0.0 },
    asset: BUFF_BASE,
    upgrades: [
      {
        name: 'War Horn',
        cost: 120,
        stats: { range: 5, damage: 0, fireRate: 0, splash: 0, canHitFlying: false },
        special: { type: 'buff', attackSpeedBoost: 0.3, damageBoost: 0.0 },
        asset: BUFF_UPGRADED
      },
      {
        branches: [
          {
            name: 'War Drum',
            cost: 200,
            stats: { range: 5, damage: 0, fireRate: 0, splash: 0, canHitFlying: false },
            special: { type: 'buff', attackSpeedBoost: 0.5, damageBoost: 0.0 },
            asset: BUFF_WARDRUM
          },
          {
            name: 'Arsenal',
            cost: 200,
            stats: { range: 5, damage: 0, fireRate: 0, splash: 0, canHitFlying: false },
            special: { type: 'buff', attackSpeedBoost: 0.2, damageBoost: 0.25 },
            asset: BUFF_ARSENAL
          }
        ]
      }
    ]
  }
};

// ──────────────────────────────────────────────
//  WALL DEFINITION (separate — not a combat tower)
// ──────────────────────────────────────────────

export const WALL_DEF = {
  name: 'Wall',
  cost: 20,
  stats: { range: 0, damage: 0, fireRate: 0, splash: 0, hp: 100, canHitFlying: false },
  special: null,
  asset: WALL_BASE,
  upgrades: [
    {
      name: 'Reinforced Wall',
      cost: 30,
      stats: { range: 0, damage: 0, fireRate: 0, splash: 0, hp: 200, canHitFlying: false },
      special: null,
      asset: WALL_REINFORCED
    },
    {
      branches: [
        {
          name: 'Fortress Wall',
          cost: 60,
          stats: { range: 0, damage: 0, fireRate: 0, splash: 0, hp: 500, canHitFlying: false },
          special: null,
          asset: WALL_FORTRESS
        },
        {
          name: 'Spike Wall',
          cost: 60,
          stats: { range: 0, damage: 0, fireRate: 0, splash: 0, hp: 100, canHitFlying: false },
          special: { type: 'reflect', damage: 15 },
          asset: WALL_SPIKE
        }
      ]
    }
  ]
};

// ──────────────────────────────────────────────
//  HELPER: Compute total gold invested up to a given upgrade level
// ──────────────────────────────────────────────

function getTotalInvested(type, upgradeLevel, branchIndex) {
  const def = type === 'wall' ? WALL_DEF : TOWER_DEFS[type];
  if (!def) { return 0; }

  let total = def.cost;

  for (let i = 0; i < upgradeLevel; i++) {
    const upgrade = def.upgrades[i];
    if (!upgrade) { break; }

    if (upgrade.branches) {
      const branch = upgrade.branches[branchIndex ?? 0];
      total += branch ? branch.cost : 0;
    } else {
      total += upgrade.cost;
    }
  }

  return total;
}

// ──────────────────────────────────────────────
//  EXPORTED UTILITY FUNCTIONS
// ──────────────────────────────────────────────

/**
 * Returns the sell value of a tower (50% of total gold invested).
 * @param {string} type - Tower key ('arrow', 'cannon', etc.) or 'wall'
 * @param {number} upgradeLevel - 0 = base, 1 = first upgrade, 2 = second upgrade
 * @param {number} [branchIndex=0] - Branch index for level-2 upgrades (0 or 1)
 * @returns {number} Gold returned on sell
 */
export function getTowerSellValue(type, upgradeLevel, branchIndex = 0) {
  return Math.floor(getTotalInvested(type, upgradeLevel, branchIndex) * 0.5);
}

/**
 * Returns the cost to upgrade a tower to the next level.
 * @param {string} type - Tower key or 'wall'
 * @param {number} currentLevel - Current upgrade level (0 or 1)
 * @param {number} [branchIndex=0] - Branch index for level-2 upgrades
 * @returns {number|null} Upgrade cost, or null if max level
 */
export function getUpgradeCost(type, currentLevel, branchIndex = 0) {
  const def = type === 'wall' ? WALL_DEF : TOWER_DEFS[type];
  if (!def) { return null; }

  const nextUpgrade = def.upgrades[currentLevel];
  if (!nextUpgrade) { return null; }

  if (nextUpgrade.branches) {
    const branch = nextUpgrade.branches[branchIndex];
    return branch ? branch.cost : null;
  }

  return nextUpgrade.cost;
}

/**
 * Returns the full stats object for a tower at a given upgrade level.
 * @param {string} type - Tower key or 'wall'
 * @param {number} upgradeLevel - 0 = base, 1 = first upgrade, 2 = second upgrade
 * @param {number} [branchIndex=0] - Branch index for level-2 upgrades
 * @returns {{ stats: object, special: object|null, asset: string, name: string }|null}
 */
export function getTowerStats(type, upgradeLevel, branchIndex = 0) {
  const def = type === 'wall' ? WALL_DEF : TOWER_DEFS[type];
  if (!def) { return null; }

  if (upgradeLevel === 0) {
    return {
      name: def.name,
      stats: { ...def.stats },
      special: def.special ? { ...def.special } : null,
      asset: def.asset
    };
  }

  const upgrade = def.upgrades[upgradeLevel - 1];
  if (!upgrade) { return null; }

  if (upgrade.branches) {
    const branch = upgrade.branches[branchIndex ?? 0];
    if (!branch) { return null; }
    return {
      name: branch.name,
      stats: { ...branch.stats },
      special: branch.special ? { ...branch.special } : null,
      asset: branch.asset
    };
  }

  return {
    name: upgrade.name,
    stats: { ...upgrade.stats },
    special: upgrade.special ? { ...upgrade.special } : null,
    asset: upgrade.asset
  };
}
