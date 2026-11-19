// ══════════════════════════════════════════════════════════════
//  siege-enemies.js — Historical siege enemy types & wave gen
//  ES Module for Castle Defense
// ══════════════════════════════════════════════════════════════

import { ENEMY_DEFS, getScaledHp } from './enemies.js';


// ─── VOXI Assets (Siege Units) ─────────────────────────────

const ASSET_SAPPER = `V 6 8 6
-- Sapper: small figure with shovel, brown clothes
-- Boots
B 1 0 2 2 1 2 a
B 3 0 2 2 1 2 a
-- Legs (brown trousers)
B 1 1 2 2 2 2 a
B 3 1 2 2 2 2 a
-- Torso (brown tunic)
B 1 3 1 4 3 4 a
-- Belt with tools
B 1 3 1 4 1 4 9
P 0 3 2 9
P 0 4 2 9
-- Arms (brown)
B 0 3 2 1 3 2 a
B 5 3 2 1 3 2 a
-- Shovel (right hand)
P 5 3 3 9
P 5 4 3 9
P 5 5 3 9
P 5 6 3 9
B 5 7 2 1 1 2 9
-- Head (leather cap)
B 1 6 1 4 2 3 d
B 1 7 1 4 1 3 a
-- Eyes
P 2 7 1 0
P 3 7 1 0`;

const ASSET_LADDER_BEARER = `V 6 14 6
-- Ladder Bearer: figure carrying tall ladder on back
-- Boots
B 1 0 2 2 1 2 a
B 3 0 2 2 1 2 a
-- Legs
B 1 1 2 2 2 2 9
B 3 1 2 2 2 2 9
-- Torso (gray tunic)
B 1 3 1 4 3 4 9
-- Belt
B 1 3 1 4 1 4 a
-- Arms raised (holding ladder)
B 0 4 2 1 3 2 9
B 5 4 2 1 3 2 9
-- Head
B 1 7 1 4 2 3 d
-- Helmet
B 1 8 1 4 1 3 9
-- Eyes
P 2 8 1 0
P 3 8 1 0
-- Ladder (tall, on back)
P 1 0 5 7
P 1 2 5 7
P 1 4 5 7
P 1 6 5 7
P 1 8 5 7
P 1 A 5 7
P 1 C 5 7
P 4 0 5 7
P 4 2 5 7
P 4 4 5 7
P 4 6 5 7
P 4 8 5 7
P 4 A 5 7
P 4 C 5 7
-- Rungs
B 1 1 5 3 1 1 7
B 1 3 5 3 1 1 7
B 1 5 5 3 1 1 7
B 1 7 5 3 1 1 7
B 1 9 5 3 1 1 7
B 1 B 5 3 1 1 7`;

const ASSET_BATTERING_RAM = `V 12 8 12
-- Battering Ram: large horizontal log with metal cap, 4 carriers
-- Ram body (long brown log)
C 6 4 6 1 A a
-- Metal cap (front)
C 6 4 1 2 1 9
S 6 4 0 2 9
-- Metal bands
C 6 4 3 2 1 9
C 6 4 8 2 1 9
-- Carrier frame (wooden beams)
B 1 2 2 1 1 8 a
B A 2 2 1 1 8 a
B 1 2 9 1 1 8 a
B A 2 9 1 1 8 a
-- Roof frame
B 0 6 1 C 1 1 a
B 0 6 A C 1 1 a
B 0 6 1 1 1 A a
B B 6 1 1 1 A a
-- Carrier 1 (front left)
B 1 0 2 2 4 2 d
B 1 4 1 2 2 3 9
P 1 5 1 0
-- Carrier 2 (front right)
B 9 0 2 2 4 2 d
B 9 4 1 2 2 3 9
P A 5 1 0
-- Carrier 3 (rear left)
B 1 0 9 2 4 2 d
B 1 4 8 2 2 3 9
P 1 5 8 0
-- Carrier 4 (rear right)
B 9 0 9 2 4 2 d
B 9 4 8 2 2 3 9
P A 5 8 0`;

const ASSET_TREBUCHET = `V 10 12 10
-- Trebuchet: counterweight siege engine on wheels
-- Wheels (left and right)
C 1 1 5 2 1 a
C 9 1 5 2 1 a
-- Axle
C 5 1 5 1 8 9
-- Base frame
B 2 2 3 6 1 4 a
-- Upright frame (A-frame)
B 3 2 4 1 8 2 a
B 6 2 4 1 8 2 a
-- Crossbar
B 3 9 4 4 1 2 a
-- Throwing arm (long beam, angled)
B 2 8 5 7 1 1 a
-- Counterweight (heavy stone block)
B 1 6 4 2 2 3 9
B 1 5 4 2 1 3 9
-- Sling (at throwing end)
P 8 8 5 a
P 9 7 5 a
P 9 6 5 a
-- Projectile (stone ball)
S 9 6 5 1 9
-- Winch mechanism
C 4 3 5 1 2 a
P 3 3 4 9
P 3 3 6 9`;

const ASSET_SIEGE_TOWER = `V A 10 A
-- Siege Tower: tall wheeled wooden tower
-- Wheels
C 1 1 2 1 1 a
C 9 1 2 1 1 a
C 1 1 8 1 1 a
C 9 1 8 1 1 a
-- Base platform
B 0 2 0 A 1 A a
-- Front wall
B 0 2 0 A E 1 a
-- Back wall
B 0 2 9 A E 1 a
-- Left wall
B 0 2 0 1 E A a
-- Right wall
B 9 2 0 1 E A a
-- Floor levels
B 1 5 1 8 1 8 a
B 1 9 1 8 1 8 a
B 1 D 1 8 1 8 a
-- Drawbridge (front, top — hinged down)
B 2 E 0 6 1 1 a
P 3 F 0 9
P 6 F 0 9
-- Battlements (top)
P 0 F 0 a
P 3 F 0 a
P 6 F 0 a
P 9 F 0 a
P 0 F 9 a
P 9 F 9 a
-- Iron reinforcement strips
P 0 4 0 9
P 0 8 0 9
P 0 C 0 9
P 9 4 0 9
P 9 8 0 9
P 9 C 0 9
-- Troops visible inside (top level)
B 3 D 3 2 2 2 d
B 5 D 3 2 2 2 d
B 3 D 5 2 2 2 9`;

const ASSET_FIRE_POT_THROWER = `V 6 A 6
-- Fire Pot Thrower: light figure with flaming pot
-- Boots
B 1 0 2 2 1 2 a
B 3 0 2 2 1 2 a
-- Legs (light cloth)
B 1 1 2 2 2 2 d
B 3 1 2 2 2 2 d
-- Torso (dark tunic)
B 1 3 1 4 3 4 0
-- Bandolier (orange — fire pots)
P 1 5 1 7
P 2 4 1 7
P 3 3 1 7
P 4 4 1 7
-- Arms
B 0 3 2 1 3 2 0
B 5 3 2 1 3 2 0
-- Throwing hand raised (right arm extended up)
P 5 6 2 d
P 5 7 2 d
-- Fire pot (in hand)
S 5 8 2 1 7
-- Flames on pot
P 5 9 2 6
P 4 9 2 1
P 5 9 1 1
-- Head (wrapped cloth)
B 1 6 1 4 2 3 d
B 1 7 1 4 1 3 0
-- Eyes
P 2 7 1 6
P 3 7 1 6`;

const ASSET_HEAVY_KNIGHT = `V 8 C 8
-- Heavy Knight: large armored knight, full plate
-- Boots (thick iron)
B 1 0 3 2 2 3 9
B 5 0 3 2 2 3 9
-- Greaves (plate legs)
B 1 2 3 2 3 3 9
B 5 2 3 2 3 3 9
-- Tassets
B 1 5 2 6 1 4 9
-- Torso (heavy plate — dark iron)
B 1 6 2 6 4 5 9
-- Chest plate raised
B 2 7 2 4 2 4 8
-- Gorget
B 2 9 3 4 1 3 9
-- Pauldrons (big)
B 0 8 3 2 2 3 9
B 6 8 3 2 2 3 9
-- Arms (plate)
B 0 5 3 1 4 3 9
B 7 5 3 1 4 3 9
-- Gauntlets
B 0 5 3 1 1 3 8
B 7 5 3 1 1 3 8
-- Great mace (right hand)
P 7 5 4 9
P 7 6 4 9
P 7 7 4 9
P 7 8 4 9
B 7 9 3 1 2 3 9
P 7 B 4 9
-- Shield (left — iron)
B 0 5 2 1 5 1 9
B 0 6 2 1 3 1 8
P 0 7 2 1
-- Head (great helm)
B 2 A 2 4 2 4 9
B 2 B 2 4 1 4 8
-- Eye slit
P 3 B 2 0
P 4 B 2 0
-- Plume (red)
P 3 C 5 1
P 4 C 5 1
P 3 C 4 1`;


// ─── Siege Enemy Definitions ──────────────────────────────────

export const SIEGE_ENEMY_DEFS = Object.freeze({
  sapper: Object.freeze({
    name: 'Sapper',
    hp: 40,
    speed: 2.0,
    reward: 8,
    damage: 3,
    special: Object.freeze({ type: 'sapper' }),
    flying: false,
    asset: ASSET_SAPPER,
    scale: 0.14,
    arrowReduction: 0,
    wallDamageMultiplier: 3,
  }),

  ladderBearer: Object.freeze({
    name: 'Ladder Bearer',
    hp: 60,
    speed: 1.5,
    reward: 10,
    damage: 2,
    special: Object.freeze({ type: 'ladder' }),
    flying: false,
    asset: ASSET_LADDER_BEARER,
    scale: 0.14,
    arrowReduction: 0,
    wallDamageMultiplier: 1,
  }),

  batteringRam: Object.freeze({
    name: 'Battering Ram',
    hp: 300,
    speed: 0.6,
    reward: 25,
    damage: 5,
    special: Object.freeze({ type: 'ram' }),
    flying: false,
    asset: ASSET_BATTERING_RAM,
    scale: 0.12,
    arrowReduction: 0.75,
    wallDamageMultiplier: 3,
  }),

  trebuchet: Object.freeze({
    name: 'Trebuchet',
    hp: 200,
    speed: 0.3,
    reward: 30,
    damage: 40,
    special: Object.freeze({ type: 'trebuchet', range: 18, reloadTime: 4 }),
    flying: false,
    asset: ASSET_TREBUCHET,
    scale: 0.12,
    arrowReduction: 0,
    wallDamageMultiplier: 1,
  }),

  siegeTower: Object.freeze({
    name: 'Siege Tower',
    hp: 500,
    speed: 0.4,
    reward: 50,
    damage: 2,
    special: Object.freeze({ type: 'siegeTower', deployCount: 3, troopType: 'heavyKnight' }),
    flying: false,
    asset: ASSET_SIEGE_TOWER,
    scale: 0.10,
    arrowReduction: 0,
    wallDamageMultiplier: 1,
  }),

  firePotThrower: Object.freeze({
    name: 'Fire Pot Thrower',
    hp: 35,
    speed: 2.5,
    reward: 7,
    damage: 2,
    special: Object.freeze({ type: 'firePot', dot: 5, dotDuration: 3, woodMultiplier: 2 }),
    flying: false,
    asset: ASSET_FIRE_POT_THROWER,
    scale: 0.14,
    arrowReduction: 0,
    wallDamageMultiplier: 1,
  }),

  heavyKnight: Object.freeze({
    name: 'Heavy Knight',
    hp: 120,
    speed: 3.0,
    reward: 15,
    damage: 4,
    special: Object.freeze({ type: 'heavyArmor' }),
    flying: false,
    asset: ASSET_HEAVY_KNIGHT,
    scale: 0.12,
    arrowReduction: 0.7,
    wallDamageMultiplier: 1,
  }),
});


// ─── All enemy defs combined (for wave generation lookups) ──

const ALL_DEFS = { ...ENEMY_DEFS, ...SIEGE_ENEMY_DEFS };


// ─── Internal Helpers ──────────────────────────────────────

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function sortByDelay(queue) {
  return [...queue].sort((a, b) => a.delay - b.delay);
}

function scaleCount(base, waveNum) {
  return Math.round(base * (1 + (waveNum - 1) * 0.15));
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


// ─── Boss Detection ─────────────────────────────────────────

/**
 * Returns boss types for siege waves, or null.
 * Boss waves every 5 waves:
 *   5  = warlord escort
 *  10  = warlord + heavyKnights
 *  15  = skyLord + siegeTowers
 *  20+ = both bosses + full combined arms
 */
export function isSiegeWaveBoss(waveNum) {
  if (waveNum < 5 || waveNum % 5 !== 0) return null;

  const bosses = [];

  // Ground boss at multiples of 10, or wave 5 (first boss)
  if (waveNum === 5 || waveNum % 10 === 0) {
    bosses.push('warlord');
  }

  // Flying boss at multiples of 15
  if (waveNum % 15 === 0) {
    bosses.push('skyLord');
  }

  // Wave 20+: both bosses every 5 waves
  if (waveNum >= 20 && waveNum % 5 === 0) {
    if (!bosses.includes('warlord')) bosses.push('warlord');
    if (!bosses.includes('skyLord')) bosses.push('skyLord');
  }

  return bosses.length > 0 ? bosses : null;
}


// ─── Wave Generation (Siege) ────────────────────────────────

/**
 * Generates the spawn list for a siege wave.
 * Returns [{type, delay}, ...] sorted by delay.
 *
 * Historical siege progression:
 *   1-3   Reconnaissance: soldiers, scouts
 *   4-6   Probing attacks: archers, ladder bearers, men-at-arms
 *   7-9   Active siege: sappers, fire pot throwers, battering rams
 *  10-12  Bombardment: trebuchets, heavy knights
 *  13-15  Breach & storm: siege towers, combined arms
 *  16+    Full combined arms, escalating
 */
export function generateSiegeWave(waveNum) {
  if (waveNum < 1) return [];

  let queue = [];
  const baseDelay = () => randomBetween(0.4, 0.8);
  let cursor = 0;

  const bosses = isSiegeWaveBoss(waveNum);

  // ── Boss waves ──────────────────────────────────────────
  if (bosses !== null) {
    queue = generateBossWave(queue, bosses, waveNum, cursor, baseDelay);
    return sortByDelay(queue);
  }

  // ── Waves 1-3: Reconnaissance ──────────────────────────
  if (waveNum <= 3) {
    const soldierCount = 5 + waveNum * 2;
    for (let i = 0; i < soldierCount; i++) {
      queue = [...queue, { type: 'soldier', delay: cursor }];
      cursor += baseDelay();
    }
    if (waveNum >= 2) {
      const scoutCount = 2 + waveNum;
      queue = addSwarm(queue, 'scout', scoutCount, cursor + 0.3);
    }
    return sortByDelay(queue);
  }

  // ── Waves 4-6: Probing Attacks ─────────────────────────
  if (waveNum <= 6) {
    queue = addReconPhase(queue, waveNum, cursor, baseDelay);
    cursor = getMaxDelay(queue) + 1.0;
    queue = addProbingPhase(queue, waveNum, cursor, baseDelay);
    return sortByDelay(queue);
  }

  // ── Waves 7-9: Active Siege ────────────────────────────
  if (waveNum <= 9) {
    queue = addReconPhase(queue, waveNum, cursor, baseDelay);
    cursor = getMaxDelay(queue) + 1.0;
    queue = addProbingPhase(queue, waveNum, cursor, baseDelay);
    cursor = getMaxDelay(queue) + 1.0;
    queue = addActiveSiegePhase(queue, waveNum, cursor, baseDelay);
    return sortByDelay(queue);
  }

  // ── Waves 10-12: Bombardment ───────────────────────────
  if (waveNum <= 12) {
    queue = addReconPhase(queue, waveNum, cursor, baseDelay);
    cursor = getMaxDelay(queue) + 1.0;
    queue = addProbingPhase(queue, waveNum, cursor, baseDelay);
    cursor = getMaxDelay(queue) + 1.0;
    queue = addActiveSiegePhase(queue, waveNum, cursor, baseDelay);
    cursor = getMaxDelay(queue) + 1.0;
    queue = addBombardmentPhase(queue, waveNum, cursor, baseDelay);
    return sortByDelay(queue);
  }

  // ── Waves 13-15: Breach & Storm ────────────────────────
  if (waveNum <= 15) {
    queue = addReconPhase(queue, waveNum, cursor, baseDelay);
    cursor = getMaxDelay(queue) + 0.8;
    queue = addProbingPhase(queue, waveNum, cursor, baseDelay);
    cursor = getMaxDelay(queue) + 0.8;
    queue = addActiveSiegePhase(queue, waveNum, cursor, baseDelay);
    cursor = getMaxDelay(queue) + 0.8;
    queue = addBombardmentPhase(queue, waveNum, cursor, baseDelay);
    cursor = getMaxDelay(queue) + 0.8;
    queue = addBreachPhase(queue, waveNum, cursor, baseDelay);
    return sortByDelay(queue);
  }

  // ── Waves 16+: Full Combined Arms ─────────────────────
  queue = addReconPhase(queue, waveNum, cursor, baseDelay);
  cursor = getMaxDelay(queue) + 0.6;
  queue = addProbingPhase(queue, waveNum, cursor, baseDelay);
  cursor = getMaxDelay(queue) + 0.6;
  queue = addActiveSiegePhase(queue, waveNum, cursor, baseDelay);
  cursor = getMaxDelay(queue) + 0.6;
  queue = addBombardmentPhase(queue, waveNum, cursor, baseDelay);
  cursor = getMaxDelay(queue) + 0.6;
  queue = addBreachPhase(queue, waveNum, cursor, baseDelay);
  cursor = getMaxDelay(queue) + 0.6;
  queue = addCombinedArmsEscalation(queue, waveNum, cursor, baseDelay);

  return sortByDelay(queue);
}


// ─── Phase Generators ──────────────────────────────────────

function addReconPhase(queue, waveNum, cursor, baseDelay) {
  const soldierCount = scaleCount(3, waveNum);
  for (let i = 0; i < soldierCount; i++) {
    queue = [...queue, { type: 'soldier', delay: cursor }];
    cursor += baseDelay();
  }

  if (waveNum >= 2) {
    const scoutCount = Math.min(3 + Math.floor((waveNum - 1) * 0.5), 8);
    queue = addSwarm(queue, 'scout', scoutCount, cursor + 0.3);
  }

  return queue;
}

function addProbingPhase(queue, waveNum, cursor, baseDelay) {
  // Ladder bearers (unlock wave 5)
  if (waveNum >= 5) {
    const ladderCount = Math.min(1 + Math.floor((waveNum - 5) * 0.3), 4);
    for (let i = 0; i < ladderCount; i++) {
      queue = [...queue, { type: 'ladderBearer', delay: cursor }];
      cursor += baseDelay();
    }
  }

  // Knights as men-at-arms
  if (waveNum >= 4) {
    const knightCount = Math.min(2 + Math.floor((waveNum - 4) * 0.3), 6);
    for (let i = 0; i < knightCount; i++) {
      queue = [...queue, { type: 'knight', delay: cursor }];
      cursor += baseDelay();
    }
  }

  // Bats for aerial harassment
  if (waveNum >= 5) {
    const batCount = Math.min(2 + Math.floor((waveNum - 5) * 0.4), 6);
    for (let i = 0; i < batCount; i++) {
      queue = [...queue, { type: 'bat', delay: cursor }];
      cursor += baseDelay();
    }
  }

  // Shielded knights
  if (waveNum >= 8) {
    const shieldCount = Math.min(1 + Math.floor((waveNum - 8) * 0.25), 4);
    for (let i = 0; i < shieldCount; i++) {
      queue = [...queue, { type: 'shieldedKnight', delay: cursor }];
      cursor += baseDelay();
    }
  }

  return queue;
}

function addActiveSiegePhase(queue, waveNum, cursor, baseDelay) {
  // Sappers (unlock wave 7)
  if (waveNum >= 7) {
    const sapperCount = Math.min(1 + Math.floor((waveNum - 7) * 0.4), 5);
    for (let i = 0; i < sapperCount; i++) {
      queue = [...queue, { type: 'sapper', delay: cursor }];
      cursor += baseDelay();
    }
  }

  // Fire Pot Throwers (unlock wave 8)
  if (waveNum >= 8) {
    const fireCount = Math.min(1 + Math.floor((waveNum - 8) * 0.3), 4);
    for (let i = 0; i < fireCount; i++) {
      queue = [...queue, { type: 'firePotThrower', delay: cursor }];
      cursor += baseDelay();
    }
  }

  // Battering Ram (unlock wave 9)
  if (waveNum >= 9) {
    const ramCount = Math.min(1 + Math.floor((waveNum - 9) * 0.15), 3);
    for (let i = 0; i < ramCount; i++) {
      queue = [...queue, { type: 'batteringRam', delay: cursor }];
      cursor += baseDelay() * 2; // rams spaced further apart
    }
  }

  return queue;
}

function addBombardmentPhase(queue, waveNum, cursor, baseDelay) {
  // Trebuchets (unlock wave 11)
  if (waveNum >= 11) {
    const trebCount = Math.min(1 + Math.floor((waveNum - 11) * 0.15), 3);
    for (let i = 0; i < trebCount; i++) {
      queue = [...queue, { type: 'trebuchet', delay: cursor }];
      cursor += baseDelay() * 3; // trebuchets well-spaced
    }
  }

  // Heavy Knights (unlock wave 10)
  if (waveNum >= 10) {
    const heavyCount = Math.min(2 + Math.floor((waveNum - 10) * 0.3), 6);
    for (let i = 0; i < heavyCount; i++) {
      queue = [...queue, { type: 'heavyKnight', delay: cursor }];
      cursor += baseDelay();
    }
  }

  // Ogres as siege support
  if (waveNum >= 12) {
    const ogreCount = Math.min(1 + Math.floor((waveNum - 12) * 0.2), 3);
    for (let i = 0; i < ogreCount; i++) {
      queue = [...queue, { type: 'ogre', delay: cursor }];
      cursor += baseDelay();
    }
  }

  return queue;
}

function addBreachPhase(queue, waveNum, cursor, baseDelay) {
  // Siege Towers (unlock wave 13)
  if (waveNum >= 13) {
    const towerCount = Math.min(1 + Math.floor((waveNum - 13) * 0.15), 3);
    for (let i = 0; i < towerCount; i++) {
      queue = [...queue, { type: 'siegeTower', delay: cursor }];
      cursor += baseDelay() * 3;
    }
  }

  // Healers with knight escorts
  if (waveNum >= 13) {
    const healerCount = Math.min(1 + Math.floor((waveNum - 13) * 0.2), 3);
    for (let i = 0; i < healerCount; i++) {
      queue = [...queue, { type: 'healer', delay: cursor }];
      cursor += 0.3;
      queue = [...queue, { type: 'heavyKnight', delay: cursor }];
      cursor += baseDelay();
    }
  }

  // Dragons join at wave 14+
  if (waveNum >= 14) {
    const dragonCount = Math.min(1 + Math.floor((waveNum - 14) * 0.15), 3);
    for (let i = 0; i < dragonCount; i++) {
      queue = [...queue, { type: 'dragon', delay: cursor }];
      cursor += baseDelay();
    }
  }

  return queue;
}

function addCombinedArmsEscalation(queue, waveNum, cursor, baseDelay) {
  // Extra waves of all unit types scaled by how far past wave 16
  const escalation = waveNum - 16;

  // Additional heavy knights
  const extraHeavy = Math.min(2 + Math.floor(escalation * 0.5), 8);
  for (let i = 0; i < extraHeavy; i++) {
    queue = [...queue, { type: 'heavyKnight', delay: cursor }];
    cursor += baseDelay();
  }

  // Additional sappers in swarm
  const extraSappers = Math.min(2 + Math.floor(escalation * 0.3), 6);
  queue = addSwarm(queue, 'sapper', extraSappers, cursor + 0.3);
  cursor += extraSappers * 0.2 + 0.5;

  // More fire pot throwers
  const extraFire = Math.min(1 + Math.floor(escalation * 0.3), 5);
  for (let i = 0; i < extraFire; i++) {
    queue = [...queue, { type: 'firePotThrower', delay: cursor }];
    cursor += baseDelay();
  }

  // Extra dragons
  if (escalation >= 2) {
    const extraDragons = Math.min(1 + Math.floor((escalation - 2) * 0.2), 4);
    for (let i = 0; i < extraDragons; i++) {
      queue = [...queue, { type: 'dragon', delay: cursor }];
      cursor += baseDelay();
    }
  }

  return queue;
}


// ─── Boss Wave Generator ───────────────────────────────────

function generateBossWave(queue, bosses, waveNum, cursor, baseDelay) {
  for (const bossType of bosses) {
    queue = [...queue, { type: bossType, delay: 0.5 }];

    if (bossType === 'warlord') {
      // Warlord escort: heavy knights + battering ram
      const escortCount = Math.floor(waveNum / 5) * 2 + 2;
      cursor = 2.0;
      for (let i = 0; i < escortCount; i++) {
        queue = [...queue, { type: 'heavyKnight', delay: cursor }];
        cursor += baseDelay();
      }
      // Battering ram support (wave 10+)
      if (waveNum >= 10) {
        queue = [...queue, { type: 'batteringRam', delay: cursor + 0.5 }];
      }
      // Shielded knights for later boss waves
      if (waveNum >= 20) {
        const shieldCount = Math.floor(escortCount / 2);
        for (let i = 0; i < shieldCount; i++) {
          queue = [...queue, { type: 'shieldedKnight', delay: cursor }];
          cursor += baseDelay();
        }
      }
    }

    if (bossType === 'skyLord') {
      // Sky Lord escort: dragons + siege towers
      const dragonCount = Math.floor(waveNum / 15) * 2 + 1;
      cursor = 2.0;
      for (let i = 0; i < dragonCount; i++) {
        queue = [...queue, { type: 'dragon', delay: cursor }];
        cursor += baseDelay();
      }
      queue = addSwarm(queue, 'bat', 4, cursor + 0.5);
      // Siege tower support (wave 15+)
      if (waveNum >= 15) {
        queue = [...queue, { type: 'siegeTower', delay: cursor + 1.0 }];
      }
    }
  }

  // Filler infantry scaled to wave
  const fillerCount = Math.floor(waveNum / 3);
  cursor = 4.0;
  for (let i = 0; i < fillerCount; i++) {
    const fillerType = i % 3 === 0 ? 'knight' : 'soldier';
    queue = [...queue, { type: fillerType, delay: cursor }];
    cursor += baseDelay();
  }

  // Sappers on boss waves 10+
  if (waveNum >= 10) {
    const sapperCount = Math.min(Math.floor(waveNum / 5), 4);
    queue = addSwarm(queue, 'sapper', sapperCount, cursor + 0.5);
  }

  // Trebuchet support on boss waves 15+
  if (waveNum >= 15) {
    queue = [...queue, { type: 'trebuchet', delay: cursor + 1.5 }];
  }

  return queue;
}


// ─── Behavior System ────────────────────────────────────────

/**
 * Returns an action descriptor for siege enemy special behaviors.
 *
 * @param {Object} enemy - The enemy instance (must have .type, .special, etc.)
 * @param {number} dt - Delta time in seconds
 * @param {Object} ctx - Context: { nearestWall, distToWall, nearestGate,
 *                        distToGate, wallHeight, isUnderground }
 * @returns {Object} Action descriptor for the game loop
 */
export function getSiegeSpecialBehavior(enemy, dt, ctx) {
  const def = ALL_DEFS[enemy.type];
  if (!def || !def.special) return { action: 'move' };

  const specialType = def.special.type;

  switch (specialType) {
    case 'sapper':
      return getSapperBehavior(enemy, ctx);

    case 'ladder':
      return getLadderBehavior(enemy, ctx);

    case 'ram':
      return getRamBehavior(enemy, ctx);

    case 'trebuchet':
      return getTrebuchetBehavior(enemy, dt, ctx);

    case 'siegeTower':
      return getSiegeTowerBehavior(enemy, ctx);

    case 'firePot':
      return getFirePotBehavior(enemy, ctx);

    case 'heavyArmor':
      return { action: 'move' };

    default:
      return { action: 'move' };
  }
}


// ─── Individual Behavior Functions ─────────────────────────

function getSapperBehavior(enemy, ctx) {
  // Burrow when approaching wall (within 5 cells)
  if (ctx.distToWall <= 5 && ctx.distToWall > 1.5 && !ctx.isUnderground) {
    return { action: 'burrow', duration: 2.0 };
  }
  // Attack wall when adjacent
  if (ctx.distToWall <= 1.5) {
    return { action: 'attackWall', multiplier: 3 };
  }
  return { action: 'move' };
}

function getLadderBehavior(enemy, ctx) {
  // Place ladder when at wall
  if (ctx.nearestWall && ctx.distToWall <= 1.5) {
    return {
      action: 'placeLadder',
      wallGx: ctx.nearestWall.gx,
      wallGz: ctx.nearestWall.gz,
    };
  }
  return { action: 'move' };
}

function getRamBehavior(enemy, ctx) {
  // Prioritize gate over wall
  if (ctx.nearestGate && ctx.distToGate <= 1.5) {
    return { action: 'attackGate', multiplier: 3 };
  }
  return { action: 'move' };
}

function getTrebuchetBehavior(enemy, dt, ctx) {
  const range = 18;
  // Fire at structures from maximum range
  if (ctx.nearestWall && ctx.distToWall <= range && ctx.distToWall > 3) {
    return {
      action: 'bombard',
      targetGx: ctx.nearestWall.gx,
      targetGz: ctx.nearestWall.gz,
      damage: 40,
    };
  }
  // Move closer if out of range
  return { action: 'move' };
}

function getSiegeTowerBehavior(enemy, ctx) {
  // Deploy troops when reaching wall
  if (ctx.nearestWall && ctx.distToWall <= 1.5) {
    return {
      action: 'deployTroops',
      count: 3,
      troopType: 'heavyKnight',
    };
  }
  return { action: 'move' };
}

function getFirePotBehavior(enemy, ctx) {
  const throwRange = 4;
  // Throw fire pots at nearby structures
  if (ctx.nearestWall && ctx.distToWall <= throwRange) {
    return {
      action: 'throwFire',
      targetGx: ctx.nearestWall.gx,
      targetGz: ctx.nearestWall.gz,
      dot: { damage: 5, duration: 3 },
    };
  }
  return { action: 'move' };
}


// ─── Utility ────────────────────────────────────────────────

function getMaxDelay(queue) {
  if (queue.length === 0) return 0;
  return Math.max(...queue.map(e => e.delay));
}
