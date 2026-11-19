/**
 * meta.js — Meta-game systems for Castle Defense
 *
 * Economy, leaderboard, challenge modifiers, achievements,
 * stats tracker, UI overlay, minimap, and HUD updates.
 *
 * All public functions are exported as named exports (ES module).
 */

// ---------------------------------------------------------------------------
// 1. Economy System
// ---------------------------------------------------------------------------

const economy = {
  gold: 0,
  totalEarned: 0,
  totalSpent: 0,
  interestTimer: 0,
  comboKills: 0,
  comboTimer: 0,
  comboGoldBuffer: 0,
  waveDamageTaken: 0,
  waveKillGold: 0,
};

const INTEREST_INTERVAL = 5;
const INTEREST_RATE = 0.01;
const COMBO_WINDOW = 2;
const COMBO_THRESHOLD = 3;
const COMBO_MULTIPLIER = 1.5;

/**
 * Initialise the economy with starting gold.
 * @param {number} initialGold
 * @returns {{ gold: number, totalEarned: number, totalSpent: number }}
 */
export function createEconomy(initialGold) {
  const startGold =
    getMultiplier("startGold") !== 1 ? getMultiplier("startGold") : initialGold;

  economy.gold = startGold;
  economy.totalEarned = startGold;
  economy.totalSpent = 0;
  economy.interestTimer = 0;
  economy.comboKills = 0;
  economy.comboTimer = 0;
  economy.comboGoldBuffer = 0;
  economy.waveDamageTaken = 0;
  economy.waveKillGold = 0;

  return {
    gold: economy.gold,
    totalEarned: economy.totalEarned,
    totalSpent: economy.totalSpent,
  };
}

/**
 * Tick the economy (interest accumulation and combo decay).
 * @param {number} dt  Delta time in seconds
 * @returns {{ interestEarned: number, comboExpired: boolean }}
 */
export function updateEconomy(dt) {
  let interestEarned = 0;
  let comboExpired = false;

  // Interest
  const challenge = getActiveChallenge();
  const noInterest = challenge.multipliers.noInterest === true;

  if (!noInterest) {
    economy.interestTimer += dt;
    if (economy.interestTimer >= INTEREST_INTERVAL) {
      economy.interestTimer -= INTEREST_INTERVAL;
      const interest = Math.floor(economy.gold * INTEREST_RATE);
      if (interest > 0) {
        economy.gold += interest;
        economy.totalEarned += interest;
        interestEarned = interest;
      }
    }
  }

  // Combo decay
  if (economy.comboKills > 0) {
    economy.comboTimer -= dt;
    if (economy.comboTimer <= 0) {
      economy.comboKills = 0;
      economy.comboTimer = 0;
      economy.comboGoldBuffer = 0;
      comboExpired = true;
    }
  }

  return { interestEarned, comboExpired };
}

/** @returns {number} Current gold balance */
export function getGold() {
  return economy.gold;
}

/**
 * Spend gold if sufficient funds exist.
 * @param {number} amount
 * @returns {boolean} true if spent, false if insufficient
 */
export function spendGold(amount) {
  if (amount < 0) return false;
  if (economy.gold < amount) return false;

  economy.gold -= amount;
  economy.totalSpent += amount;
  return true;
}

/**
 * Add gold to the player's balance.
 * @param {number} amount
 * @param {object} [options]
 * @param {boolean} [options.isKillGold]  If true, track for wave/combo bonuses
 * @returns {{ earned: number, comboCount: number, isCombo: boolean }}
 */
export function earnGold(amount, options = {}) {
  if (amount < 0) return { earned: 0, comboCount: 0, isCombo: false };

  const goldMult = getMultiplier("goldMultiplier");
  let finalAmount = Math.floor(amount * goldMult);
  let isCombo = false;
  let comboCount = 0;

  if (options.isKillGold) {
    // Combo tracking
    economy.comboKills += 1;
    economy.comboTimer = COMBO_WINDOW;

    if (economy.comboKills >= COMBO_THRESHOLD) {
      finalAmount = Math.floor(finalAmount * COMBO_MULTIPLIER);
      isCombo = true;
    }
    comboCount = economy.comboKills;
    economy.comboGoldBuffer += finalAmount;
    economy.waveKillGold += finalAmount;
  }

  economy.gold += finalAmount;
  economy.totalEarned += finalAmount;

  return { earned: finalAmount, comboCount, isCombo };
}

/**
 * Calculate interest earned per tick at current gold level.
 * @returns {number}
 */
export function getInterestRate() {
  const challenge = getActiveChallenge();
  if (challenge.multipliers.noInterest === true) return 0;
  return Math.floor(economy.gold * INTEREST_RATE);
}

/**
 * Calculate and award wave completion bonus.
 * @param {number} waveNum
 * @returns {{ bonus: number, noDamageBonus: number, total: number }}
 */
export function awardWaveBonus(waveNum) {
  const goldMult = getMultiplier("goldMultiplier");
  const baseBonus = Math.floor((25 + waveNum * 10) * goldMult);
  let noDamageBonus = 0;

  if (economy.waveDamageTaken === 0 && waveNum > 0) {
    noDamageBonus = Math.floor(economy.waveKillGold * 0.5);
  }

  const total = baseBonus + noDamageBonus;
  economy.gold += total;
  economy.totalEarned += total;

  // Reset per-wave trackers
  economy.waveDamageTaken = 0;
  economy.waveKillGold = 0;

  return { bonus: baseBonus, noDamageBonus, total };
}

/**
 * Record damage taken during current wave (for no-damage bonus calc).
 * @param {number} damage
 */
export function recordWaveDamage(damage) {
  economy.waveDamageTaken += damage;
}

/**
 * Get economy snapshot for stats display.
 * @returns {{ gold: number, totalEarned: number, totalSpent: number }}
 */
export function getEconomyStats() {
  return {
    gold: economy.gold,
    totalEarned: economy.totalEarned,
    totalSpent: economy.totalSpent,
  };
}

// ---------------------------------------------------------------------------
// 2. Challenge Modifiers
// ---------------------------------------------------------------------------

export const CHALLENGES = {
  normal: {
    name: "Normal",
    description: "Standard game",
    multipliers: {},
  },
  hard: {
    name: "Hard Mode",
    description: "Enemies have 50% more HP and move 25% faster",
    multipliers: { enemyHp: 1.5, enemySpeed: 1.25 },
  },
  ironman: {
    name: "Iron Man",
    description: "Castle has 1 HP. One hit and it's over.",
    multipliers: { castleHp: 1 },
  },
  fast: {
    name: "Blitz",
    description: "2x game speed, 2x gold rewards",
    multipliers: { gameSpeed: 2, goldMultiplier: 2 },
  },
  poverty: {
    name: "Poverty",
    description: "Start with 50 gold, no interest",
    multipliers: { startGold: 50, noInterest: true },
  },
  swarm: {
    name: "Swarm",
    description: "3x enemy count, 50% HP each",
    multipliers: { enemyCount: 3, enemyHp: 0.5 },
  },
};

let activeChallenge = "normal";

/**
 * Get the active challenge definition.
 * @returns {{ name: string, description: string, multipliers: object }}
 */
export function getActiveChallenge() {
  return CHALLENGES[activeChallenge] || CHALLENGES.normal;
}

/**
 * Set the active challenge by ID.
 * @param {string} id
 * @returns {boolean} true if valid challenge
 */
export function setChallenge(id) {
  if (!CHALLENGES[id]) return false;
  activeChallenge = id;
  return true;
}

/**
 * Get a specific multiplier value from the active challenge.
 * Returns 1.0 if the key is not set.
 * @param {string} key
 * @returns {number}
 */
export function getMultiplier(key) {
  const challenge = getActiveChallenge();
  const val = challenge.multipliers[key];
  if (val === undefined || val === true || val === false) return 1.0;
  return val;
}

// ---------------------------------------------------------------------------
// 3. Leaderboard (localStorage)
// ---------------------------------------------------------------------------

const LEADERBOARD_KEY = "castle-defense-leaderboard";
const MAX_LEADERBOARD = 10;

/**
 * Save a score entry to the leaderboard.
 * @param {{ wave: number, kills: number, gold: number, challenge: string, time: number, date: string }} data
 * @returns {number} Position on leaderboard (1-based), or -1 if not in top 10
 */
export function saveScore(data) {
  const board = getLeaderboard();
  const entry = {
    wave: data.wave || 0,
    kills: data.kills || 0,
    gold: data.gold || 0,
    challenge: data.challenge || "normal",
    time: data.time || 0,
    date: data.date || new Date().toISOString(),
  };

  board.push(entry);
  board.sort((a, b) => {
    if (b.wave !== a.wave) return b.wave - a.wave;
    return b.kills - a.kills;
  });

  const trimmed = board.slice(0, MAX_LEADERBOARD);
  const position = trimmed.findIndex(
    (e) =>
      e === entry ||
      (e.wave === entry.wave &&
        e.kills === entry.kills &&
        e.date === entry.date),
  );

  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(trimmed));
  } catch (_) {
    // localStorage unavailable or full — silently ignore
  }

  return position >= 0 ? position + 1 : -1;
}

/**
 * Get the top 10 leaderboard entries sorted by wave then kills.
 * @returns {Array<{ wave: number, kills: number, gold: number, challenge: string, time: number, date: string }>}
 */
export function getLeaderboard() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_LEADERBOARD);
  } catch (_) {
    return [];
  }
}

/** Clear all leaderboard data. */
export function clearLeaderboard() {
  try {
    localStorage.removeItem(LEADERBOARD_KEY);
  } catch (_) {
    // silently ignore
  }
}

// ---------------------------------------------------------------------------
// 4. Achievements
// ---------------------------------------------------------------------------

const ACHIEVEMENTS_KEY = "castle-defense-achievements";

export const ACHIEVEMENTS = {
  firstBlood: {
    name: "First Blood",
    desc: "Kill your first enemy",
    check: (stats) => stats.kills >= 1,
  },
  wave10: {
    name: "Survivor",
    desc: "Reach wave 10",
    check: (stats) => stats.wave >= 10,
  },
  wave25: {
    name: "Veteran",
    desc: "Reach wave 25",
    check: (stats) => stats.wave >= 25,
  },
  wave50: {
    name: "Legend",
    desc: "Reach wave 50",
    check: (stats) => stats.wave >= 50,
  },
  untouched: {
    name: "Untouched",
    desc: "Complete a wave without losing HP",
    check: (stats) => stats.waveDamageTaken === 0 && stats.wave > 0,
  },
  rich: {
    name: "Midas",
    desc: "Have 1000+ gold at once",
    check: (stats) => stats.gold >= 1000,
  },
  combo5: {
    name: "Combo Master",
    desc: "Get a 5x kill combo",
    check: (stats) => stats.maxCombo >= 5,
  },
  bossSlayer: {
    name: "Boss Slayer",
    desc: "Kill your first boss",
    check: (stats) => stats.bossKills >= 1,
  },
  allTowers: {
    name: "Arsenal",
    desc: "Build one of each tower type",
    check: (stats) => stats.uniqueTowers >= 5,
  },
  upgrade3: {
    name: "Fully Loaded",
    desc: "Fully upgrade a tower to tier 3",
    check: (stats) => stats.maxUpgrade >= 3,
  },
  kills100: {
    name: "Centurion",
    desc: "Kill 100 enemies in one game",
    check: (stats) => stats.kills >= 100,
  },
  kills500: {
    name: "Warlord",
    desc: "Kill 500 enemies in one game",
    check: (stats) => stats.kills >= 500,
  },
};

/**
 * Check all achievements against current stats and return newly unlocked IDs.
 * @param {object} stats
 * @returns {string[]} Array of newly unlocked achievement IDs
 */
export function checkAchievements(stats) {
  const unlocked = getUnlocked();
  const newlyUnlocked = [];

  for (const [id, achievement] of Object.entries(ACHIEVEMENTS)) {
    if (unlocked.has(id)) continue;
    try {
      if (achievement.check(stats)) {
        unlockAchievement(id);
        newlyUnlocked.push(id);
      }
    } catch (_) {
      // skip broken check functions
    }
  }

  return newlyUnlocked;
}

/**
 * Get the set of unlocked achievement IDs from localStorage.
 * @returns {Set<string>}
 */
export function getUnlocked() {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed);
  } catch (_) {
    return new Set();
  }
}

/**
 * Mark an achievement as unlocked in localStorage.
 * @param {string} id
 */
export function unlockAchievement(id) {
  const unlocked = getUnlocked();
  unlocked.add(id);
  try {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify([...unlocked]));
  } catch (_) {
    // silently ignore
  }
}

// ---------------------------------------------------------------------------
// 5. Game Stats Tracker
// ---------------------------------------------------------------------------

const stats = {
  kills: 0,
  bossKills: 0,
  gold: 0,
  wave: 0,
  waveDamageTaken: 0,
  maxCombo: 0,
  currentCombo: 0,
  comboTimer: 0,
  uniqueTowers: new Set(),
  maxUpgrade: 0,
  totalDamageDealt: 0,
  towersBuilt: 0,
  towersUpgraded: 0,
  gameTime: 0,
};

/**
 * Reset and return a fresh stats object.
 * @returns {object}
 */
export function createStats() {
  stats.kills = 0;
  stats.bossKills = 0;
  stats.gold = 0;
  stats.wave = 0;
  stats.waveDamageTaken = 0;
  stats.maxCombo = 0;
  stats.currentCombo = 0;
  stats.comboTimer = 0;
  stats.uniqueTowers = new Set();
  stats.maxUpgrade = 0;
  stats.totalDamageDealt = 0;
  stats.towersBuilt = 0;
  stats.towersUpgraded = 0;
  stats.gameTime = 0;

  return getStats();
}

/**
 * Get a plain-object snapshot of current stats.
 * @returns {object}
 */
export function getStats() {
  return {
    kills: stats.kills,
    bossKills: stats.bossKills,
    gold: stats.gold,
    wave: stats.wave,
    waveDamageTaken: stats.waveDamageTaken,
    maxCombo: stats.maxCombo,
    currentCombo: stats.currentCombo,
    comboTimer: stats.comboTimer,
    uniqueTowers: stats.uniqueTowers.size,
    maxUpgrade: stats.maxUpgrade,
    totalDamageDealt: stats.totalDamageDealt,
    towersBuilt: stats.towersBuilt,
    towersUpgraded: stats.towersUpgraded,
    gameTime: stats.gameTime,
  };
}

/**
 * Set a stat to a specific value.
 * @param {string} key
 * @param {*} value
 */
export function updateStat(key, value) {
  if (key === "uniqueTowers") {
    if (typeof value === "string") {
      stats.uniqueTowers.add(value);
    }
    return;
  }
  if (key in stats) {
    stats[key] = value;
  }
}

/**
 * Increment a numeric stat by an amount.
 * @param {string} key
 * @param {number} [amount=1]
 */
export function incrementStat(key, amount = 1) {
  if (key === "uniqueTowers") return;
  if (key in stats && typeof stats[key] === "number") {
    stats[key] += amount;

    // Auto-track maxCombo
    if (key === "currentCombo" && stats.currentCombo > stats.maxCombo) {
      stats.maxCombo = stats.currentCombo;
    }
  }
}

// ---------------------------------------------------------------------------
// 6. CSS Styles
// ---------------------------------------------------------------------------

/**
 * Return the complete CSS string for the game UI overlay.
 * @returns {string}
 */
export function getGameCSS() {
  return /* css */ `
/* ===== RESET & BASE ===== */
#game-ui {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  pointer-events: none;
  z-index: 1000;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  color: #e5e5e5;
  user-select: none;
}
#game-ui * { box-sizing: border-box; }
#game-ui button, #game-ui .clickable { pointer-events: auto; cursor: pointer; }

/* ===== HUD TOP BAR ===== */
#hud {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 10px 20px;
  background: linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 100%);
  border-bottom: 2px solid rgba(245,158,11,0.4);
  pointer-events: auto;
}
#hud .stat {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.5px;
}
#hud .stat.gold { color: #f59e0b; }
#hud .stat.hp { color: #22c55e; }
#hud .stat.wave { color: #60a5fa; }
#hud .stat.kills { color: #f87171; }
#hud .small {
  font-size: 12px;
  opacity: 0.7;
  font-weight: 400;
}
#hud .stat.gold::before { content: '\\1F4B0'; margin-right: 4px; }
#hud .stat.hp::before { content: '\\2764\\FE0F'; margin-right: 4px; }
#hud .stat.wave::before { content: '\\1F30A'; margin-right: 4px; }
#hud .stat.kills::before { content: '\\2694\\FE0F'; margin-right: 4px; }

/* ===== COMBO DISPLAY ===== */
#combo-display {
  color: #fbbf24;
  font-size: 20px;
  font-weight: 900;
  text-shadow: 0 0 10px rgba(251,191,36,0.8), 0 0 20px rgba(251,191,36,0.4);
  animation: combo-pulse 0.3s ease-out;
  margin-left: auto;
}
@keyframes combo-pulse {
  0% { transform: scale(1.6); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1.0); }
}

/* ===== HP BAR ===== */
#hp-bar-container {
  width: 120px;
  height: 8px;
  background: rgba(255,255,255,0.1);
  border-radius: 4px;
  overflow: hidden;
  margin-left: 4px;
}
#hp-bar {
  height: 100%;
  background: #22c55e;
  border-radius: 4px;
  transition: width 0.3s ease, background-color 0.3s ease;
}
#hp-bar.medium { background: #eab308; }
#hp-bar.low { background: #ef4444; }

/* ===== BUILD PANEL (BOTTOM) ===== */
#build-panel {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 8px;
  padding: 12px 20px 16px;
  background: linear-gradient(0deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 80%, transparent 100%);
  pointer-events: auto;
}
.build-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 14px 8px;
  background: rgba(255,255,255,0.08);
  border: 2px solid rgba(255,255,255,0.15);
  border-radius: 8px;
  color: #e5e5e5;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.15s ease;
  min-width: 72px;
  position: relative;
}
.build-btn:hover {
  background: rgba(245,158,11,0.2);
  border-color: #f59e0b;
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(245,158,11,0.3);
}
.build-btn:active {
  transform: translateY(-2px);
}
.build-btn.selected {
  background: rgba(245,158,11,0.3);
  border-color: #f59e0b;
  box-shadow: 0 0 12px rgba(245,158,11,0.4), inset 0 0 8px rgba(245,158,11,0.15);
}
.build-btn .btn-name {
  font-size: 13px;
  font-weight: 700;
}
.build-btn .btn-cost {
  color: #f59e0b;
  font-size: 11px;
}
.build-btn .btn-key {
  position: absolute;
  top: -8px;
  right: -6px;
  background: rgba(0,0,0,0.8);
  border: 1px solid rgba(255,255,255,0.25);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 10px;
  color: #aaa;
}
.build-btn.sell-btn {
  border-color: rgba(239,68,68,0.4);
}
.build-btn.sell-btn:hover {
  background: rgba(239,68,68,0.2);
  border-color: #ef4444;
  box-shadow: 0 4px 16px rgba(239,68,68,0.3);
}

/* ===== UPGRADE PANEL ===== */
#upgrade-panel {
  display: none;
  position: absolute;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.9);
  border: 2px solid rgba(245,158,11,0.5);
  border-radius: 12px;
  padding: 16px 20px;
  pointer-events: auto;
  min-width: 200px;
}
#upgrade-panel h3 {
  margin: 0 0 10px;
  color: #f59e0b;
  font-size: 14px;
  text-align: center;
}
.upgrade-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  margin: 4px 0;
  background: rgba(255,255,255,0.05);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.upgrade-option:hover {
  background: rgba(245,158,11,0.15);
}
.upgrade-option .upgrade-cost {
  color: #f59e0b;
  font-weight: 700;
  font-size: 13px;
}

/* ===== RIGHT SIDE PANEL ===== */
#side-panel {
  position: absolute;
  top: 60px;
  right: 0;
  width: 180px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  pointer-events: auto;
  transition: transform 0.3s ease;
}
#side-panel.collapsed {
  transform: translateX(160px);
}
#side-toggle {
  position: absolute;
  left: -28px;
  top: 4px;
  width: 28px;
  height: 32px;
  background: rgba(0,0,0,0.8);
  border: 1px solid rgba(255,255,255,0.15);
  border-right: none;
  border-radius: 6px 0 0 6px;
  color: #aaa;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 0.15s;
}
#side-toggle:hover { color: #f59e0b; }

/* Minimap */
#minimap-container {
  background: rgba(0,0,0,0.85);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 8px;
  padding: 6px;
}
#minimap-container h4 {
  margin: 0 0 4px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #888;
  text-align: center;
}
#minimap {
  display: block;
  width: 150px;
  height: 150px;
  border-radius: 4px;
  image-rendering: pixelated;
}

/* Wave preview */
#wave-preview {
  background: rgba(0,0,0,0.85);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 8px;
  padding: 8px;
}
#wave-preview h4 {
  margin: 0 0 6px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #888;
}
#wave-preview-content {
  font-size: 12px;
  line-height: 1.6;
  color: #bbb;
}
.enemy-preview-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.enemy-preview-row .count { color: #f87171; font-weight: 700; }

/* ===== ACHIEVEMENT NOTIFICATION ===== */
.achievement-toast {
  position: absolute;
  right: -320px;
  top: 60px;
  width: 280px;
  padding: 14px 18px;
  background: rgba(0,0,0,0.92);
  border: 2px solid #f59e0b;
  border-radius: 10px;
  animation: achievement-slide 3s ease forwards;
  box-shadow: 0 0 24px rgba(245,158,11,0.35), 0 0 8px rgba(245,158,11,0.2);
  z-index: 1100;
  pointer-events: none;
}
.achievement-toast h5 {
  margin: 0 0 4px;
  color: #f59e0b;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 2px;
}
.achievement-toast .ach-name {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 2px;
}
.achievement-toast .ach-desc {
  font-size: 12px;
  color: #aaa;
}
@keyframes achievement-slide {
  0%   { right: -320px; opacity: 0; }
  10%  { right: 12px; opacity: 1; }
  80%  { right: 12px; opacity: 1; }
  100% { right: -320px; opacity: 0; }
}

/* ===== WAVE BANNER ===== */
#wave-banner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0.5);
  text-align: center;
  opacity: 0;
  pointer-events: none;
  transition: none;
  z-index: 1050;
}
#wave-banner.visible {
  animation: wave-banner-anim 2.5s ease forwards;
}
#wave-banner h2 {
  font-size: 48px;
  font-weight: 900;
  color: #fff;
  text-shadow: 0 0 20px rgba(96,165,250,0.8), 0 2px 4px rgba(0,0,0,0.6);
  margin: 0;
}
#wave-banner.boss h2 {
  color: #ef4444;
  text-shadow: 0 0 20px rgba(239,68,68,0.8), 0 0 40px rgba(239,68,68,0.4);
}
#wave-banner p {
  font-size: 18px;
  color: #aaa;
  margin: 6px 0 0;
}
@keyframes wave-banner-anim {
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
  15%  { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
  25%  { transform: translate(-50%, -50%) scale(1.0); }
  75%  { opacity: 1; transform: translate(-50%, -50%) scale(1.0); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.1); }
}

/* ===== START SCREEN ===== */
#start-screen {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.92);
  pointer-events: auto;
  z-index: 2000;
}
#start-screen h1 {
  font-size: 56px;
  font-weight: 900;
  color: #f59e0b;
  text-shadow: 0 0 30px rgba(245,158,11,0.6), 0 4px 8px rgba(0,0,0,0.8);
  margin: 0 0 6px;
  letter-spacing: 6px;
}
#start-screen h2 {
  font-size: 18px;
  font-weight: 400;
  color: #888;
  margin: 0 0 28px;
  letter-spacing: 2px;
}
.challenge-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  max-width: 540px;
  margin-bottom: 32px;
}
.challenge-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px 14px;
  background: rgba(255,255,255,0.06);
  border: 2px solid rgba(255,255,255,0.12);
  border-radius: 10px;
  color: #e5e5e5;
  transition: all 0.2s ease;
  min-width: 160px;
}
.challenge-btn:hover {
  background: rgba(245,158,11,0.15);
  border-color: #f59e0b;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(245,158,11,0.25);
}
.challenge-btn .ch-name {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
}
.challenge-btn .ch-desc {
  font-size: 11px;
  color: #888;
  text-align: center;
  line-height: 1.4;
}

/* ===== LEADERBOARD ===== */
#leaderboard-display {
  width: 100%;
  max-width: 480px;
  margin-top: 12px;
}
#leaderboard-display h3 {
  text-align: center;
  color: #f59e0b;
  font-size: 16px;
  margin: 0 0 10px;
  letter-spacing: 2px;
}
.lb-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.lb-table th {
  text-align: left;
  color: #888;
  font-weight: 600;
  padding: 4px 8px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.lb-table td {
  padding: 4px 8px;
  color: #ccc;
}
.lb-table tr:nth-child(even) td { background: rgba(255,255,255,0.03); }
.lb-table .rank-1 td { color: #f59e0b; font-weight: 700; }
.lb-table .rank-2 td { color: #d1d5db; font-weight: 600; }
.lb-table .rank-3 td { color: #b45309; font-weight: 600; }

/* ===== GAME OVER ===== */
#game-over {
  display: none;
  position: absolute;
  inset: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.92);
  pointer-events: auto;
  z-index: 2000;
}
#game-over.visible { display: flex; }
#game-over h1 {
  font-size: 48px;
  font-weight: 900;
  color: #ef4444;
  text-shadow: 0 0 24px rgba(239,68,68,0.5);
  margin: 0 0 24px;
  letter-spacing: 4px;
}
.go-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px 32px;
  margin-bottom: 20px;
  text-align: center;
}
.go-stat-label {
  font-size: 12px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.go-stat-value {
  font-size: 28px;
  font-weight: 800;
  color: #fff;
}
.go-stat-value.gold-val { color: #f59e0b; }
.go-achievements {
  margin: 16px 0;
  text-align: center;
}
.go-achievements h3 {
  color: #f59e0b;
  font-size: 14px;
  margin: 0 0 8px;
  letter-spacing: 1px;
}
.go-ach-item {
  display: inline-block;
  background: rgba(245,158,11,0.15);
  border: 1px solid rgba(245,158,11,0.3);
  border-radius: 6px;
  padding: 4px 12px;
  margin: 3px;
  font-size: 12px;
  color: #f59e0b;
}
.go-leaderboard {
  color: #888;
  font-size: 14px;
  margin-bottom: 20px;
}
.go-leaderboard strong { color: #f59e0b; }
.go-play-again {
  padding: 14px 40px;
  font-size: 18px;
  font-weight: 700;
  color: #000;
  background: #f59e0b;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 1px;
}
.go-play-again:hover {
  background: #fbbf24;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(245,158,11,0.4);
}

/* ===== PAUSE MENU ===== */
#pause-menu {
  display: none;
  position: absolute;
  inset: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.88);
  pointer-events: auto;
  z-index: 2000;
}
#pause-menu.visible { display: flex; }
#pause-menu h2 {
  font-size: 36px;
  font-weight: 800;
  color: #fff;
  margin: 0 0 28px;
  letter-spacing: 4px;
}
.pause-btn {
  display: block;
  width: 220px;
  padding: 12px 0;
  margin: 6px 0;
  font-size: 16px;
  font-weight: 600;
  color: #e5e5e5;
  background: rgba(255,255,255,0.08);
  border: 2px solid rgba(255,255,255,0.15);
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s ease;
}
.pause-btn:hover {
  background: rgba(245,158,11,0.2);
  border-color: #f59e0b;
  color: #f59e0b;
}
.pause-volume {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px 0;
  color: #aaa;
  font-size: 14px;
}
.pause-volume input[type="range"] {
  width: 140px;
  accent-color: #f59e0b;
}
#pause-achievements {
  margin-top: 20px;
  max-height: 200px;
  overflow-y: auto;
  width: 280px;
}
#pause-achievements h4 {
  color: #f59e0b;
  font-size: 13px;
  margin: 0 0 8px;
  text-align: center;
  letter-spacing: 1px;
}
.pause-ach-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 8px;
  font-size: 12px;
  color: #888;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.pause-ach-item.unlocked { color: #f59e0b; }
.pause-ach-item .ach-status { font-weight: 700; }
`;
}

// ---------------------------------------------------------------------------
// 6. UI Overlay HTML Generator
// ---------------------------------------------------------------------------

/**
 * Generate the complete game UI overlay HTML string.
 * @returns {string}
 */
export function createGameUI() {
  const challengeButtons = Object.entries(CHALLENGES)
    .map(
      ([id, ch]) =>
        `<button class="challenge-btn clickable" data-challenge="${id}">
      <span class="ch-name">${ch.name}</span>
      <span class="ch-desc">${ch.description}</span>
    </button>`,
    )
    .join("\n");

  const leaderboard = getLeaderboard();
  const lbRows =
    leaderboard.length > 0
      ? leaderboard
          .map((e, i) => {
            const rankClass = i < 3 ? ` class="rank-${i + 1}"` : "";
            const timeStr = formatTime(e.time);
            return `<tr${rankClass}>
          <td>${i + 1}</td>
          <td>${e.wave}</td>
          <td>${e.kills}</td>
          <td>${e.gold}</td>
          <td>${e.challenge || "-"}</td>
          <td>${timeStr}</td>
        </tr>`;
          })
          .join("\n")
      : '<tr><td colspan="6" style="text-align:center;color:#555;padding:12px;">No scores yet</td></tr>';

  const buildButtons = [
    { name: "Arrow", key: "1", cost: 50, id: "arrow" },
    { name: "Cannon", key: "2", cost: 100, id: "cannon" },
    { name: "Frost", key: "3", cost: 75, id: "frost" },
    { name: "Lightning", key: "4", cost: 125, id: "lightning" },
    { name: "Buff", key: "5", cost: 80, id: "buff" },
  ]
    .map(
      (b) =>
        `<button class="build-btn clickable" data-tower="${b.id}" data-cost="${b.cost}">
      <span class="btn-key">${b.key}</span>
      <span class="btn-name">${b.name}</span>
      <span class="btn-cost">${b.cost}g</span>
    </button>`,
    )
    .join("\n");

  const sellButton = `<button class="build-btn sell-btn clickable" data-action="sell">
    <span class="btn-key">0</span>
    <span class="btn-name">Sell</span>
    <span class="btn-cost">50%</span>
  </button>`;

  // Achievement list for pause menu
  const allAchievements = Object.entries(ACHIEVEMENTS);
  const unlocked = getUnlocked();
  const pauseAchList = allAchievements
    .map(([id, ach]) => {
      const isUnlocked = unlocked.has(id);
      const cls = isUnlocked ? "pause-ach-item unlocked" : "pause-ach-item";
      const status = isUnlocked ? "Unlocked" : "Locked";
      return `<div class="${cls}">
      <span>${ach.name} — ${ach.desc}</span>
      <span class="ach-status">${status}</span>
    </div>`;
    })
    .join("\n");

  return `<div id="game-ui">
  <!-- HUD TOP BAR -->
  <div id="hud">
    <div class="stat gold">Gold: <span id="gold">200</span> <span id="interest-indicator" class="small">(+0/5s)</span></div>
    <div class="stat hp">
      Castle: <span id="hp">100</span>/<span id="hp-max">100</span>
      <div id="hp-bar-container"><div id="hp-bar" style="width:100%"></div></div>
    </div>
    <div class="stat wave">Wave: <span id="wave">0</span> <span id="wave-timer" class="small"></span></div>
    <div class="stat kills">Kills: <span id="kills">0</span></div>
    <div class="stat combo" id="combo-display" style="display:none">COMBO x<span id="combo-count">0</span></div>
  </div>

  <!-- WAVE BANNER -->
  <div id="wave-banner">
    <h2 id="wave-banner-title">Wave 1</h2>
    <p id="wave-banner-subtitle"></p>
  </div>

  <!-- BUILD PANEL -->
  <div id="build-panel">
    ${buildButtons}
    ${sellButton}
  </div>

  <!-- UPGRADE PANEL -->
  <div id="upgrade-panel">
    <h3 id="upgrade-title">Upgrade Tower</h3>
    <div id="upgrade-options"></div>
  </div>

  <!-- RIGHT SIDE PANEL -->
  <div id="side-panel">
    <button id="side-toggle" class="clickable">&lt;</button>
    <div id="minimap-container">
      <h4>Map</h4>
      <canvas id="minimap" width="150" height="150"></canvas>
    </div>
    <div id="wave-preview">
      <h4>Next Wave</h4>
      <div id="wave-preview-content">Waiting...</div>
    </div>
  </div>

  <!-- ACHIEVEMENT TOAST CONTAINER -->
  <div id="achievement-container"></div>

  <!-- START SCREEN -->
  <div id="start-screen">
    <h1>CASTLE DEFENSE</h1>
    <h2>Choose Difficulty</h2>
    <div class="challenge-grid">
      ${challengeButtons}
    </div>
    <div id="leaderboard-display">
      <h3>LEADERBOARD</h3>
      <table class="lb-table">
        <thead><tr><th>#</th><th>Wave</th><th>Kills</th><th>Gold</th><th>Mode</th><th>Time</th></tr></thead>
        <tbody>${lbRows}</tbody>
      </table>
    </div>
  </div>

  <!-- GAME OVER -->
  <div id="game-over">
    <h1>GAME OVER</h1>
    <div class="go-stats">
      <div><div class="go-stat-label">Waves</div><div class="go-stat-value" id="go-waves">0</div></div>
      <div><div class="go-stat-label">Kills</div><div class="go-stat-value" id="go-kills">0</div></div>
      <div><div class="go-stat-label">Gold Earned</div><div class="go-stat-value gold-val" id="go-gold">0</div></div>
      <div><div class="go-stat-label">Time</div><div class="go-stat-value" id="go-time">0:00</div></div>
    </div>
    <div class="go-achievements" id="go-achievements"></div>
    <div class="go-leaderboard" id="go-leaderboard"></div>
    <button class="go-play-again clickable" id="go-play-again">PLAY AGAIN</button>
  </div>

  <!-- PAUSE MENU -->
  <div id="pause-menu">
    <h2>PAUSED</h2>
    <button class="pause-btn clickable" id="pause-resume">Resume</button>
    <button class="pause-btn clickable" id="pause-restart">Restart</button>
    <button class="pause-btn clickable" id="pause-mute">Mute: OFF</button>
    <div class="pause-volume">
      <span>Volume</span>
      <input type="range" id="pause-volume" min="0" max="100" value="80">
      <span id="pause-volume-label">80%</span>
    </div>
    <div id="pause-achievements">
      <h4>ACHIEVEMENTS</h4>
      ${pauseAchList}
    </div>
  </div>
</div>`;
}

// ---------------------------------------------------------------------------
// 7. Minimap Renderer
// ---------------------------------------------------------------------------

let minimapCtx = null;
let minimapSize = 30;
let minimapTimer = 0;
const MINIMAP_UPDATE_INTERVAL = 0.25;

/**
 * Initialise the minimap renderer.
 * @param {string} canvasId  The canvas element ID (e.g. 'minimap')
 * @param {number} mapSize   Grid dimensions (e.g. 30)
 * @returns {{ ctx: CanvasRenderingContext2D, mapSize: number }}
 */
export function createMinimap(canvasId, mapSize) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  minimapCtx = canvas.getContext("2d");
  minimapSize = mapSize || 30;
  minimapTimer = 0;

  return { ctx: minimapCtx, mapSize: minimapSize };
}

/**
 * Render the minimap. Throttled to update every 0.25s.
 * @param {Array<Array<number>>} grid        2D grid (0=ground, >0=structure)
 * @param {Array<{ x: number, z: number, flying?: boolean }>} enemies
 * @param {Array<{ x: number, z: number }>} buildings  Towers and walls
 * @param {{ x: number, z: number }} castlePos
 * @param {number} [dt]  Delta time for throttle. Pass 0 to force redraw.
 */
export function updateMinimap(grid, enemies, buildings, castlePos, dt = 0) {
  if (!minimapCtx) return;

  minimapTimer += dt;
  if (dt > 0 && minimapTimer < MINIMAP_UPDATE_INTERVAL) return;
  minimapTimer = 0;

  const ctx = minimapCtx;
  const canvas = ctx.canvas;
  const cellW = canvas.width / minimapSize;
  const cellH = canvas.height / minimapSize;

  // Clear
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw grid
  if (grid) {
    for (let z = 0; z < minimapSize; z++) {
      for (let x = 0; x < minimapSize; x++) {
        const cell = grid[z] ? grid[z][x] : 0;
        if (cell > 0) {
          ctx.fillStyle = "#6b7280";
          ctx.fillRect(x * cellW, z * cellH, cellW, cellH);
        } else {
          ctx.fillStyle = "#16a34a";
          ctx.fillRect(x * cellW, z * cellH, cellW, cellH);
        }
      }
    }
  }

  // Draw buildings (towers/walls) over grid
  if (buildings) {
    ctx.fillStyle = "#9ca3af";
    for (const b of buildings) {
      const bx = Math.floor(b.x);
      const bz = Math.floor(b.z);
      if (bx >= 0 && bx < minimapSize && bz >= 0 && bz < minimapSize) {
        ctx.fillRect(bx * cellW, bz * cellH, cellW, cellH);
      }
    }
  }

  // Draw castle
  if (castlePos) {
    ctx.fillStyle = "#f59e0b";
    const cx = Math.floor(castlePos.x);
    const cz = Math.floor(castlePos.z);
    const castleRadius = 2;
    for (let dz = -castleRadius; dz <= castleRadius; dz++) {
      for (let dx = -castleRadius; dx <= castleRadius; dx++) {
        const px = cx + dx;
        const pz = cz + dz;
        if (px >= 0 && px < minimapSize && pz >= 0 && pz < minimapSize) {
          ctx.fillRect(px * cellW, pz * cellH, cellW, cellH);
        }
      }
    }
  }

  // Draw enemies
  if (enemies) {
    for (const e of enemies) {
      const ex = Math.floor(e.x);
      const ez = Math.floor(e.z);
      if (ex >= 0 && ex < minimapSize && ez >= 0 && ez < minimapSize) {
        ctx.fillStyle = e.flying ? "#3b82f6" : "#ef4444";
        ctx.fillRect(ex * cellW, ez * cellH, cellW + 1, cellH + 1);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 8. HUD Update Functions
// ---------------------------------------------------------------------------

/**
 * Update all HUD elements from game state.
 * @param {{ gold: number, hp: number, maxHp: number, wave: number, kills: number, combo: number, interestPerTick: number, nextWaveIn: number }} state
 */
export function updateHUD(state) {
  setTextContent("gold", state.gold);
  setTextContent("hp", state.hp);
  setTextContent("hp-max", state.maxHp);
  setTextContent("wave", state.wave);
  setTextContent("kills", state.kills);
  setTextContent("interest-indicator", `(+${state.interestPerTick || 0}/5s)`);

  // HP bar width and color
  const hpBar = document.getElementById("hp-bar");
  if (hpBar) {
    const pct = state.maxHp > 0 ? (state.hp / state.maxHp) * 100 : 0;
    hpBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    hpBar.classList.remove("medium", "low");
    if (pct <= 25) {
      hpBar.classList.add("low");
    } else if (pct <= 50) {
      hpBar.classList.add("medium");
    }
  }

  // Wave timer
  if (state.nextWaveIn != null && state.nextWaveIn > 0) {
    setTextContent("wave-timer", `(${Math.ceil(state.nextWaveIn)}s)`);
  } else {
    setTextContent("wave-timer", "");
  }

  // Combo
  const comboEl = document.getElementById("combo-display");
  if (comboEl) {
    if (state.combo >= COMBO_THRESHOLD) {
      comboEl.style.display = "";
      setTextContent("combo-count", state.combo);
    } else {
      comboEl.style.display = "none";
    }
  }
}

/**
 * Display a large wave banner in the centre of the screen.
 * @param {number} waveNum
 * @param {boolean} [isBoss=false]
 */
export function showWaveBanner(waveNum, isBoss = false) {
  const banner = document.getElementById("wave-banner");
  if (!banner) return;

  const title = document.getElementById("wave-banner-title");
  const subtitle = document.getElementById("wave-banner-subtitle");

  if (title)
    title.textContent = isBoss ? `BOSS WAVE ${waveNum}` : `Wave ${waveNum}`;
  if (subtitle) subtitle.textContent = isBoss ? "Prepare yourself!" : "";

  banner.classList.remove("visible", "boss");
  // Force reflow to restart animation
  void banner.offsetWidth;
  if (isBoss) banner.classList.add("boss");
  banner.classList.add("visible");

  setTimeout(() => {
    banner.classList.remove("visible", "boss");
  }, 2600);
}

/**
 * Show an achievement notification that slides in from the right.
 * @param {string} name
 * @param {string} desc
 */
export function showAchievement(name, desc) {
  const container = document.getElementById("achievement-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "achievement-toast";
  toast.innerHTML = `
    <h5>Achievement Unlocked</h5>
    <div class="ach-name">${escapeHtml(name)}</div>
    <div class="ach-desc">${escapeHtml(desc)}</div>
  `;

  // Stack multiple toasts
  const existing = container.querySelectorAll(".achievement-toast");
  const offset = 60 + existing.length * 90;
  toast.style.top = `${offset}px`;

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 3200);
}

/**
 * Trigger the combo display with a pulse animation.
 * @param {number} count
 */
export function showCombo(count) {
  const comboEl = document.getElementById("combo-display");
  if (!comboEl) return;

  comboEl.style.display = "";
  setTextContent("combo-count", count);

  // Re-trigger animation
  comboEl.style.animation = "none";
  void comboEl.offsetWidth;
  comboEl.style.animation = "combo-pulse 0.3s ease-out";
}

/**
 * Show the game over overlay with final stats.
 * @param {{ wave: number, kills: number, totalEarned: number, gameTime: number, newAchievements?: string[] }} stats
 * @param {number} leaderboardPosition  1-based, or -1 if not on board
 */
export function showGameOver(stats, leaderboardPosition) {
  const overlay = document.getElementById("game-over");
  if (!overlay) return;

  setTextContent("go-waves", stats.wave);
  setTextContent("go-kills", stats.kills);
  setTextContent("go-gold", stats.totalEarned);
  setTextContent("go-time", formatTime(stats.gameTime));

  // Achievements
  const achContainer = document.getElementById("go-achievements");
  if (achContainer) {
    if (stats.newAchievements && stats.newAchievements.length > 0) {
      const achHtml = stats.newAchievements
        .map((id) => {
          const ach = ACHIEVEMENTS[id];
          return ach
            ? `<span class="go-ach-item">${escapeHtml(ach.name)}</span>`
            : "";
        })
        .join("");
      achContainer.innerHTML = `<h3>NEW ACHIEVEMENTS</h3>${achHtml}`;
    } else {
      achContainer.innerHTML = "";
    }
  }

  // Leaderboard position
  const lbEl = document.getElementById("go-leaderboard");
  if (lbEl) {
    if (leaderboardPosition > 0) {
      lbEl.innerHTML = `Leaderboard: <strong>#${leaderboardPosition}</strong>`;
    } else {
      lbEl.innerHTML = "Did not make top 10";
    }
  }

  overlay.classList.add("visible");
}

/**
 * Hide the game over overlay.
 */
export function hideGameOver() {
  const overlay = document.getElementById("game-over");
  if (overlay) overlay.classList.remove("visible");
}

/**
 * Hide the start screen.
 */
export function hideStartScreen() {
  const startScreen = document.getElementById("start-screen");
  if (startScreen) startScreen.style.display = "none";
}

/**
 * Show/hide the pause menu.
 * @param {boolean} show
 */
export function togglePause(show) {
  const menu = document.getElementById("pause-menu");
  if (!menu) return;
  if (show) {
    // Refresh achievement list
    refreshPauseAchievements();
    menu.classList.add("visible");
  } else {
    menu.classList.remove("visible");
  }
}

/**
 * Update the wave preview panel with upcoming enemy info.
 * @param {Array<{ type: string, count: number }>} enemies
 */
export function updateWavePreview(enemies) {
  const el = document.getElementById("wave-preview-content");
  if (!el) return;

  if (!enemies || enemies.length === 0) {
    el.innerHTML = '<span style="color:#555">Waiting...</span>';
    return;
  }

  const rows = enemies
    .map(
      (e) =>
        `<div class="enemy-preview-row">
      <span>${escapeHtml(e.type)}</span>
      <span class="count">x${e.count}</span>
    </div>`,
    )
    .join("");

  el.innerHTML = rows;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Safely set text content of an element by ID.
 * @param {string} id
 * @param {*} text
 */
function setTextContent(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(text);
}

/**
 * Escape HTML to prevent XSS in dynamic content.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Format seconds into M:SS string.
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatTime(totalSeconds) {
  const s = Math.floor(totalSeconds || 0);
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

/**
 * Refresh the achievements list in the pause menu.
 */
function refreshPauseAchievements() {
  const container = document.getElementById("pause-achievements");
  if (!container) return;

  const unlocked = getUnlocked();
  const items = Object.entries(ACHIEVEMENTS)
    .map(([id, ach]) => {
      const isUnlocked = unlocked.has(id);
      const cls = isUnlocked ? "pause-ach-item unlocked" : "pause-ach-item";
      const status = isUnlocked ? "Unlocked" : "Locked";
      return `<div class="${cls}">
      <span>${escapeHtml(ach.name)} — ${escapeHtml(ach.desc)}</span>
      <span class="ach-status">${status}</span>
    </div>`;
    })
    .join("");

  container.innerHTML = `<h4>ACHIEVEMENTS</h4>${items}`;
}
