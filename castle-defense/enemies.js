// ══════════════════════════════════════════════════════════════
//  enemies.js — Enemy definitions, VOXI assets & wave generation
//  ES Module for Castle Defense
// ══════════════════════════════════════════════════════════════

// ─── VOXI Assets ─────────────────────────────────────────────
// Grid conventions:
//   V W H D — volume size
//   B X Y Z W H D C — box
//   S X Y Z R C — sphere
//   C X Y Z R H C — cylinder
//   K X Y Z R H C — cone
//   P X Y Z C — point
//   E X Y Z RX RY RZ C — ellipsoid
// Colors: 0=black 1=red 2=green 3=blue 4=cyan 5=magenta 6=yellow
//         7=orange 8=white 9=gray a=brown b=pink c=dk-green d=tan e=maroon f=navy

const ASSET_SOLDIER = `V 6 10 6
-- Soldier: gray armor, sword
-- Boots
B 1 0 2 2 1 2 a
B 3 0 2 2 1 2 a
-- Legs (gray trousers)
B 1 1 2 2 2 2 9
B 3 1 2 2 2 2 9
-- Torso (gray armor)
B 1 3 1 4 3 4 9
-- Belt
B 1 3 1 4 1 4 a
-- Arms (gray)
B 0 3 2 1 3 2 9
B 5 3 2 1 3 2 9
-- Hands
P 0 3 2 d
P 5 3 2 d
-- Sword (right hand)
P 5 3 3 9
P 5 4 3 8
P 5 5 3 8
P 5 6 3 8
P 5 7 3 8
-- Neck
P 2 6 2 d
P 3 6 2 d
-- Head
B 1 7 1 4 3 3 d
-- Helmet (gray)
B 1 9 1 4 1 3 9
B 1 7 1 4 1 1 9
-- Eyes
P 2 8 1 0
P 3 8 1 0`;

const ASSET_KNIGHT = `V 6 10 6
-- Knight: heavy blue armor, shield
-- Boots (iron)
B 1 0 2 2 1 2 9
B 3 0 2 2 1 2 9
-- Legs (blue plate)
B 1 1 2 2 2 2 3
B 3 1 2 2 2 2 3
-- Torso (blue plate)
B 1 3 1 4 3 4 3
-- Chest emblem
P 2 5 1 6
P 3 5 1 6
-- Belt
B 1 3 1 4 1 4 0
-- Right arm
B 5 3 2 1 3 2 3
-- Left arm (shield arm)
B 0 3 2 1 3 2 3
-- Shield (left side)
B 0 3 0 1 4 2 f
B 0 4 0 1 2 2 3
P 0 5 0 6
P 0 5 1 6
-- Sword
P 5 3 3 9
P 5 4 3 8
P 5 5 3 8
P 5 6 3 8
P 5 7 3 6
-- Neck
P 2 6 2 d
P 3 6 2 d
-- Head
B 1 7 1 4 3 3 d
-- Helmet (blue with visor)
B 1 9 1 4 1 4 3
B 1 7 1 4 1 1 3
B 1 7 4 4 3 1 3
P 1 8 1 9
P 4 8 1 9
-- Eye slit
P 2 8 1 0
P 3 8 1 0`;

const ASSET_SCOUT = `V 6 10 6
-- Scout: fast, light, green tunic
-- Boots
B 1 0 2 2 1 2 a
B 3 0 2 2 1 2 a
-- Legs (brown leather)
B 2 1 2 1 2 2 a
B 3 1 2 1 2 2 a
-- Torso (green tunic, slim)
B 1 3 2 4 3 3 c
-- Hood / cloak
B 1 5 1 4 2 4 c
-- Arms (green)
B 0 4 2 1 2 2 c
B 5 4 2 1 2 2 c
-- Dagger (right hand)
P 5 3 2 9
P 5 4 2 8
P 5 5 2 8
-- Neck
P 2 6 2 d
P 3 6 2 d
-- Head (hooded)
B 1 7 1 4 3 3 d
-- Hood
B 1 9 1 4 1 4 c
B 0 8 1 1 2 3 c
B 5 8 1 1 2 3 c
-- Eyes
P 2 8 1 0
P 3 8 1 0`;

const ASSET_OGRE = `V 12 14 12
-- Ogre: big, green, muscular
-- Feet
B 2 0 4 3 1 3 c
B 7 0 4 3 1 3 c
-- Legs (thick)
B 2 1 4 3 3 3 c
B 7 1 4 3 3 3 c
-- Loincloth
B 2 4 4 8 1 4 a
-- Torso (massive)
B 2 4 3 8 5 6 c
-- Belly
B 3 4 3 6 3 1 2
-- Arms (huge)
B 0 5 4 2 5 3 c
B 10 5 4 2 5 3 c
-- Fists
B 0 4 4 2 2 3 2
B 10 4 4 2 2 3 2
-- Club (right hand)
B 11 4 5 1 1 1 a
B 11 5 5 1 1 1 a
B 11 6 5 1 1 1 a
B 11 7 5 1 1 1 a
B 11 8 5 1 2 2 a
B 11 9 5 1 2 2 a
-- Neck
B 4 9 5 4 1 3 c
-- Head (big)
B 3 10 4 6 4 5 c
-- Jaw
B 4 10 3 4 2 1 c
-- Eyes (angry)
P 4 12 4 1
P 7 12 4 1
-- Teeth
P 4 10 4 8
P 5 10 4 8
P 6 10 4 8
P 7 10 4 8
-- Horns
P 3 13 5 a
P 3 13 6 a
P 8 13 5 a
P 8 13 6 a`;

const ASSET_SHIELDED_KNIGHT = `V 6 10 6
-- Shielded Knight: gold-rimmed shield, silver armor
-- Boots
B 1 0 2 2 1 2 9
B 3 0 2 2 1 2 9
-- Legs (silver plate)
B 1 1 2 2 2 2 8
B 3 1 2 2 2 2 8
-- Torso (silver plate)
B 1 3 1 4 3 4 8
-- Chest cross
P 2 5 1 6
P 3 5 1 6
P 2 4 1 6
P 3 4 1 6
-- Belt
B 1 3 1 4 1 4 9
-- Right arm
B 5 3 2 1 3 2 8
-- Left arm (shield arm)
B 0 3 2 1 3 2 8
-- Large shield (left side — gold & blue)
B 0 2 0 1 5 3 3
P 0 3 0 6
P 0 4 0 6
P 0 5 0 6
P 0 4 1 6
P 0 2 0 6
P 0 6 0 6
P 0 2 2 6
P 0 6 2 6
-- Sword
P 5 3 3 9
P 5 4 3 8
P 5 5 3 8
P 5 6 3 8
P 5 7 3 6
-- Neck
P 2 6 2 d
P 3 6 2 d
-- Head
B 1 7 1 4 3 3 d
-- Full helm (silver)
B 1 9 1 4 1 4 8
B 1 7 1 4 1 1 8
B 1 7 4 4 3 1 8
-- Plume (red)
B 2 9 4 2 1 1 1
B 2 9 5 2 1 1 1
-- Eye slit
P 2 8 1 0
P 3 8 1 0`;

const ASSET_HEALER = `V 6 10 6
-- Healer: white robes, green cross, staff
-- Sandals
P 1 0 3 a
P 2 0 3 a
P 3 0 3 a
P 4 0 3 a
-- Robe bottom (white, wide)
B 0 1 1 6 2 4 8
-- Robe body
B 1 3 1 4 3 4 8
-- Green cross on chest
P 2 5 1 2
P 3 5 1 2
P 2 4 1 2
P 3 4 1 2
P 1 5 1 2
P 4 5 1 2
-- Sleeves (white, wide)
B 0 4 2 1 2 2 8
B 5 4 2 1 2 2 8
-- Staff (right hand — green crystal top)
P 5 3 3 a
P 5 4 3 a
P 5 5 3 a
P 5 6 3 a
P 5 7 3 2
P 5 8 3 2
P 5 9 3 2
-- Neck
P 2 6 2 d
P 3 6 2 d
-- Head
B 1 7 1 4 3 3 d
-- Hood (white)
B 1 9 1 4 1 4 8
B 0 8 1 1 2 3 8
B 5 8 1 1 2 3 8
-- Eyes (kind, green)
P 2 8 1 2
P 3 8 1 2`;

const ASSET_BAT = `V 6 10 6
-- Bat: dark body, wide wings
-- Body (small, dark)
B 2 3 2 2 3 2 0
-- Belly
P 2 3 2 9
P 3 3 2 9
-- Head
B 2 6 2 2 2 2 0
-- Ears (pointy)
P 2 8 2 0
P 3 8 2 0
P 2 8 3 0
P 3 8 3 0
-- Eyes (red)
P 2 7 2 1
P 3 7 2 1
-- Fangs
P 2 6 2 8
P 3 6 2 8
-- Left wing (extended)
B 0 4 1 2 2 4 9
P 0 5 0 9
P 0 5 5 9
P 0 3 1 9
P 0 3 4 9
-- Right wing (extended)
B 4 4 1 2 2 4 9
P 5 5 0 9
P 5 5 5 9
P 5 3 1 9
P 5 3 4 9
-- Feet
P 2 2 2 9
P 3 2 2 9`;

const ASSET_DRAGON = `V 12 14 12
-- Dragon: red, wings, tail, horns
-- Tail
P 5 2 11 1
P 5 3 10 1
P 5 3 9 1
P 6 3 10 1
P 6 3 9 1
-- Hind legs
B 3 0 6 2 3 2 1
B 7 0 6 2 3 2 1
-- Claws
P 3 0 5 6
P 8 0 5 6
-- Body (red, long)
B 3 3 4 6 4 5 1
-- Belly (orange)
B 4 3 4 4 2 4 7
-- Front legs
B 3 0 3 2 3 2 1
B 7 0 3 2 3 2 1
-- Front claws
P 3 0 2 6
P 8 0 2 6
-- Left wing (large, membraned)
B 0 5 4 3 2 5 1
B 0 7 3 2 3 6 e
P 0 8 2 e
P 0 9 2 e
P 0 10 3 e
P 0 7 9 e
P 0 8 9 e
B 1 7 4 1 2 4 e
-- Right wing (large)
B 9 5 4 3 2 5 1
B 10 7 3 2 3 6 e
P 11 8 2 e
P 11 9 2 e
P 11 10 3 e
P 11 7 9 e
P 11 8 9 e
B 10 7 4 1 2 4 e
-- Neck (rises up)
B 4 7 3 4 2 3 1
B 5 9 2 2 2 3 1
-- Head
B 4 11 1 4 3 4 1
-- Horns
P 4 13 1 6
P 7 13 1 6
P 4 13 4 6
P 7 13 4 6
-- Eyes (yellow)
P 4 12 1 6
P 7 12 1 6
-- Nostrils
P 5 11 1 7
P 6 11 1 7
-- Jaw / teeth
P 4 11 1 8
P 5 11 0 8
P 6 11 0 8
P 7 11 1 8
-- Fire breath particles
P 5 11 0 6
P 6 11 0 6`;

const ASSET_WARLORD = `V 12 16 12
-- Warlord Boss: huge, gold crown, imposing
-- Boots (iron)
B 2 0 4 3 1 3 9
B 7 0 4 3 1 3 9
-- Legs (dark armor)
B 2 1 4 3 3 3 0
B 7 1 4 3 3 3 0
-- Skirt (red with gold trim)
B 1 4 3 10 1 6 6
B 1 4 3 10 1 1 1
B 1 4 8 10 1 1 1
-- Torso (black plate with gold)
B 2 5 3 8 4 6 0
-- Chest plate gold accents
B 4 7 3 4 2 1 6
P 3 8 3 6
P 8 8 3 6
P 5 6 3 6
P 6 6 3 6
-- Pauldrons (gold, large)
B 1 8 4 2 2 3 6
B 9 8 4 2 2 3 6
-- Arms (dark, thick)
B 0 5 4 2 4 3 0
B 10 5 4 2 4 3 0
-- Gauntlets (gold)
B 0 5 4 2 1 3 6
B 10 5 4 2 1 3 6
-- Great sword (right hand — huge)
P 11 5 5 9
P 11 6 5 6
P 11 7 5 8
P 11 8 5 8
P 11 9 5 8
P 11 10 5 8
P 11 11 5 8
P 11 12 5 6
P 11 13 5 6
-- Neck
B 4 9 5 4 1 3 d
-- Head
B 3 10 4 6 3 5 d
-- Helmet (black with gold)
B 3 12 4 6 1 5 0
B 3 10 4 6 1 1 0
B 3 10 8 6 3 1 0
-- Crown (gold, on top)
P 3 13 4 6
P 5 13 4 6
P 7 13 4 6
P 8 13 4 6
P 3 13 7 6
P 5 13 7 6
P 7 13 7 6
P 8 13 7 6
P 4 14 4 6
P 6 14 4 6
P 8 14 4 6
P 4 14 7 6
P 6 14 7 6
-- Eye slits (red glow)
P 4 11 4 1
P 7 11 4 1
-- Cape (red, behind)
B 3 5 9 6 5 1 1
B 3 4 10 6 4 1 1
B 4 3 11 4 3 1 1`;

const ASSET_SKY_LORD = `V 12 16 12
-- Sky Lord: flying boss, huge wings, purple/gold
-- Tail (long, spiked)
P 5 4 11 5
P 6 4 11 5
P 5 5 10 5
P 6 5 10 5
P 5 5 9 5
-- Legs (armored, tucked)
B 3 2 5 3 3 2 5
B 7 2 5 3 3 2 5
-- Talons
P 3 1 5 6
P 4 1 5 6
P 8 1 5 6
P 9 1 5 6
-- Body (purple, broad)
B 2 5 4 8 4 5 5
-- Chest plate (gold)
B 4 6 4 4 3 1 6
P 5 8 4 6
P 6 8 4 6
-- Arms / front claws
B 1 5 4 1 3 3 5
B 10 5 4 1 3 3 5
P 0 5 4 6
P 11 5 4 6
-- Left wing (massive — purple membrane, gold frame)
B 0 7 3 2 2 6 5
B 0 9 2 1 3 8 5
P 0 10 1 6
P 0 11 1 6
P 0 12 2 6
P 0 10 10 6
P 0 11 10 6
B 1 9 3 1 2 5 5
-- Right wing (massive)
B 10 7 3 2 2 6 5
B 11 9 2 1 3 8 5
P 11 10 1 6
P 11 11 1 6
P 11 12 2 6
P 11 10 10 6
P 11 11 10 6
B 10 9 3 1 2 5 5
-- Neck
B 4 9 4 4 2 3 5
-- Head (angular, fearsome)
B 3 11 3 6 3 5 5
-- Crown / crest (gold)
P 3 14 4 6
P 5 14 4 6
P 7 14 4 6
P 8 14 4 6
P 3 14 6 6
P 8 14 6 6
P 4 15 5 6
P 7 15 5 6
-- Eyes (glowing yellow)
P 4 12 3 6
P 7 12 3 6
-- Beak / jaw
B 4 11 2 4 1 2 9
P 5 11 2 6
P 6 11 2 6`;


// ─── Enemy Definitions ──────────────────────────────────────

export const ENEMY_DEFS = Object.freeze({
  soldier: Object.freeze({
    name: 'Soldier',
    hp: 30,
    speed: 2.5,
    reward: 10,
    damage: 5,
    special: null,
    asset: ASSET_SOLDIER,
    scale: 0.14,
    flying: false,
  }),

  knight: Object.freeze({
    name: 'Knight',
    hp: 80,
    speed: 1.5,
    reward: 25,
    damage: 10,
    special: null,
    asset: ASSET_KNIGHT,
    scale: 0.14,
    flying: false,
  }),

  scout: Object.freeze({
    name: 'Scout',
    hp: 15,
    speed: 5.0,
    reward: 8,
    damage: 3,
    special: null,
    asset: ASSET_SCOUT,
    scale: 0.14,
    flying: false,
  }),

  ogre: Object.freeze({
    name: 'Ogre',
    hp: 200,
    speed: 1.0,
    reward: 50,
    damage: 25,
    special: null,
    asset: ASSET_OGRE,
    scale: 0.14,
    flying: false,
  }),

  shieldedKnight: Object.freeze({
    name: 'Shielded Knight',
    hp: 60,
    speed: 1.5,
    reward: 35,
    damage: 10,
    special: Object.freeze({ type: 'shield', shieldHp: 80 }),
    asset: ASSET_SHIELDED_KNIGHT,
    scale: 0.14,
    flying: false,
  }),

  healer: Object.freeze({
    name: 'Healer',
    hp: 40,
    speed: 2.0,
    reward: 30,
    damage: 5,
    special: Object.freeze({ type: 'heal', rate: 5, range: 3 }),
    asset: ASSET_HEALER,
    scale: 0.14,
    flying: false,
  }),

  bat: Object.freeze({
    name: 'Bat',
    hp: 20,
    speed: 3.0,
    reward: 12,
    damage: 3,
    special: null,
    asset: ASSET_BAT,
    scale: 0.14,
    flying: true,
  }),

  dragon: Object.freeze({
    name: 'Dragon',
    hp: 150,
    speed: 2.0,
    reward: 40,
    damage: 15,
    special: null,
    asset: ASSET_DRAGON,
    scale: 0.14,
    flying: true,
  }),

  warlord: Object.freeze({
    name: 'Warlord',
    hp: 1000,
    speed: 0.8,
    reward: 500,
    damage: 50,
    special: Object.freeze({ type: 'boss', aura: 'speed', auraRange: 4, auraBoost: 0.3 }),
    asset: ASSET_WARLORD,
    scale: 0.14,
    flying: false,
  }),

  skyLord: Object.freeze({
    name: 'Sky Lord',
    hp: 800,
    speed: 1.0,
    reward: 600,
    damage: 40,
    special: Object.freeze({ type: 'boss', aura: 'speed', auraRange: 4, auraBoost: 0.3 }),
    asset: ASSET_SKY_LORD,
    scale: 0.14,
    flying: true,
  }),
});


// ─── Utility Functions ──────────────────────────────────────

/**
 * Returns enemy HP scaled by wave number.
 * HP grows 12% per wave past the first.
 */
export function getScaledHp(baseHp, waveNum) {
  if (waveNum < 1) return baseHp;
  return Math.round(baseHp * (1 + (waveNum - 1) * 0.12));
}

/**
 * Returns the boss type key for a given wave, or null if no boss.
 * Ground boss every 10 waves, flying boss every 15 waves.
 * If both trigger on the same wave, both appear.
 */
export function isWaveBoss(waveNum) {
  if (waveNum < 1) return null;

  const hasGroundBoss = waveNum % 10 === 0;
  const hasFlyingBoss = waveNum % 15 === 0;

  if (hasGroundBoss && hasFlyingBoss) return ['warlord', 'skyLord'];
  if (hasGroundBoss) return ['warlord'];
  if (hasFlyingBoss) return ['skyLord'];
  return null;
}


// ─── Internal helpers (not exported) ─────────────────────────

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function addSpawns(queue, type, count, startDelay, spacing) {
  const entries = [];
  for (let i = 0; i < count; i++) {
    entries.push({ type, delay: startDelay + i * spacing });
  }
  return [...queue, ...entries];
}

function addSwarm(queue, type, count, startDelay) {
  return addSpawns(queue, type, count, startDelay, 0.2);
}

function scaleCount(base, waveNum) {
  return Math.round(base * (1 + (waveNum - 1) * 0.15));
}


// ─── Wave Generation ─────────────────────────────────────────

/**
 * Generates the spawn list for a given wave number.
 * Returns an array of { type: string, delay: number } sorted by delay.
 *
 * Wave composition grows in complexity as waves progress,
 * introducing new enemy types at specific thresholds.
 */
export function generateWave(waveNum) {
  if (waveNum < 1) return [];

  let queue = [];
  const baseDelay = () => randomBetween(0.4, 0.8);
  let cursor = 0; // running time cursor for staggered spawns

  const bosses = isWaveBoss(waveNum);

  // ── Waves 1-3: soldiers only ──
  if (waveNum <= 3) {
    const count = 5 + waveNum * 2;
    for (let i = 0; i < count; i++) {
      queue = [...queue, { type: 'soldier', delay: cursor }];
      cursor += baseDelay();
    }
    return sortByDelay(queue);
  }

  // ── Boss waves ──
  if (bosses !== null) {
    for (const bossType of bosses) {
      // Boss spawns first
      queue = [...queue, { type: bossType, delay: 0.5 }];

      // Escort
      if (bossType === 'warlord') {
        const escortCount = Math.floor(waveNum / 10) * 3 + 2;
        cursor = 2.0;
        for (let i = 0; i < escortCount; i++) {
          queue = [...queue, { type: 'knight', delay: cursor }];
          cursor += baseDelay();
        }
        // Add shielded knights for later boss waves
        if (waveNum >= 20) {
          for (let i = 0; i < Math.floor(escortCount / 2); i++) {
            queue = [...queue, { type: 'shieldedKnight', delay: cursor }];
            cursor += baseDelay();
          }
        }
      }

      if (bossType === 'skyLord') {
        const dragonCount = Math.floor(waveNum / 15) * 2 + 1;
        cursor = 2.0;
        for (let i = 0; i < dragonCount; i++) {
          queue = [...queue, { type: 'dragon', delay: cursor }];
          cursor += baseDelay();
        }
        // Bat swarm escort
        queue = addSwarm(queue, 'bat', 4, cursor + 0.5);
      }
    }

    // Boss waves also get regular enemies scaled down
    const fillerCount = Math.floor(waveNum / 3);
    cursor = 4.0;
    for (let i = 0; i < fillerCount; i++) {
      queue = [...queue, { type: 'soldier', delay: cursor }];
      cursor += baseDelay();
    }

    return sortByDelay(queue);
  }

  // ── Regular waves (4+) ──

  // Base soldier count scales with wave
  const soldierCount = scaleCount(3, waveNum);
  cursor = 0;
  for (let i = 0; i < soldierCount; i++) {
    queue = [...queue, { type: 'soldier', delay: cursor }];
    cursor += baseDelay();
  }

  // Wave 4+: scouts (swarm of 5-8)
  if (waveNum >= 4) {
    const scoutCount = Math.min(5 + Math.floor((waveNum - 4) * 0.5), 8);
    queue = addSwarm(queue, 'scout', scoutCount, cursor + 0.3);
    cursor += scoutCount * 0.2 + 0.5;
  }

  // Wave 5+: bats
  if (waveNum >= 5) {
    const batCount = Math.min(2 + Math.floor((waveNum - 5) * 0.4), 6);
    for (let i = 0; i < batCount; i++) {
      queue = [...queue, { type: 'bat', delay: cursor }];
      cursor += baseDelay();
    }
  }

  // Wave 7+: knights
  if (waveNum >= 7) {
    const knightCount = Math.min(1 + Math.floor((waveNum - 7) * 0.3), 5);
    for (let i = 0; i < knightCount; i++) {
      queue = [...queue, { type: 'knight', delay: cursor }];
      cursor += baseDelay();
    }
  }

  // Wave 8+: shielded knights
  if (waveNum >= 8) {
    const shieldCount = Math.min(1 + Math.floor((waveNum - 8) * 0.25), 4);
    for (let i = 0; i < shieldCount; i++) {
      queue = [...queue, { type: 'shieldedKnight', delay: cursor }];
      cursor += baseDelay();
    }
  }

  // Wave 12+: ogres
  if (waveNum >= 12) {
    const ogreCount = Math.min(1 + Math.floor((waveNum - 12) * 0.2), 3);
    for (let i = 0; i < ogreCount; i++) {
      queue = [...queue, { type: 'ogre', delay: cursor }];
      cursor += baseDelay();
    }
  }

  // Wave 13+: healers (always with a knight pair)
  if (waveNum >= 13) {
    const healerCount = Math.min(1 + Math.floor((waveNum - 13) * 0.2), 3);
    for (let i = 0; i < healerCount; i++) {
      queue = [...queue, { type: 'healer', delay: cursor }];
      cursor += 0.3;
      queue = [...queue, { type: 'knight', delay: cursor }];
      cursor += baseDelay();
    }
  }

  // Wave 16+: dragons join regular waves
  if (waveNum >= 16) {
    const dragonCount = Math.min(1 + Math.floor((waveNum - 16) * 0.15), 3);
    for (let i = 0; i < dragonCount; i++) {
      queue = [...queue, { type: 'dragon', delay: cursor }];
      cursor += baseDelay();
    }
  }

  return sortByDelay(queue);
}


// ─── Sort helper ─────────────────────────────────────────────

function sortByDelay(queue) {
  return [...queue].sort((a, b) => a.delay - b.delay);
}
