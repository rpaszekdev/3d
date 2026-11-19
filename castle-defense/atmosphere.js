/**
 * atmosphere.js — Atmosphere effects for Castle Defense
 *
 * Day/night cycle, lava moat, weather system, procedural audio,
 * and torch/fire particles. All effects are self-contained and
 * driven by a single updateAtmosphere(dt) call each frame.
 *
 * Three.js 0.163.0 — ES module.
 */

import * as THREE from "three";

// ===========================================================================
// 1. Day/Night Cycle
// ===========================================================================

const CYCLE_DURATION = 300; // seconds for a full day (5 min)

// Phase boundaries on a 0-1 timeline
// 0.0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk
const PHASE_DAWN_START = 0.2;
const PHASE_DAY_START = 0.3;
const PHASE_DUSK_START = 0.7;
const PHASE_NIGHT_START = 0.8;

// Color presets
const COLOR_NIGHT = new THREE.Color(0x6688cc);
const COLOR_DAWN = new THREE.Color(0xffaa66);
const COLOR_DAY = new THREE.Color(0xffffff);
const COLOR_DUSK = new THREE.Color(0xcc88aa);

const BG_NIGHT = new THREE.Color(0x1a2850);
const BG_DAY = new THREE.Color(0x4488cc);

// Module state — never mutated, replaced on each tick
let dayNightState = {
  time: CYCLE_DURATION * 0.5, // start at noon (full daylight)
  phase: "night", // current phase string
  t: 0, // 0-1 position in cycle
  scene: null,
  sunLight: null,
  ambientLight: null,
};

/**
 * Initialise the day/night cycle. Call once after scene setup.
 */
export function createDayNight(scene, sunLight, ambientLight) {
  dayNightState = {
    ...dayNightState,
    scene,
    sunLight,
    ambientLight,
  };
}

/**
 * Returns the current phase: 'dawn' | 'day' | 'dusk' | 'night'.
 */
export function getDayPhase() {
  return dayNightState.phase;
}

/**
 * Returns 0-1 float representing time of day (0 = midnight, 0.5 = noon).
 */
export function getTimeOfDay() {
  return dayNightState.t;
}

/**
 * Advance the day/night cycle by dt seconds.
 */
export function updateDayNight(dt) {
  // Permanent daytime — don't touch lights
  return;

  const newTime = dayNightState.time + dt;
  const t = (newTime % CYCLE_DURATION) / CYCLE_DURATION;

  // Determine phase
  let phase = "night";
  if (t >= PHASE_DAWN_START && t < PHASE_DAY_START) phase = "dawn";
  else if (t >= PHASE_DAY_START && t < PHASE_DUSK_START) phase = "day";
  else if (t >= PHASE_DUSK_START && t < PHASE_NIGHT_START) phase = "dusk";

  // Compute interpolation factors for smooth blending
  const sunColor = new THREE.Color();
  const bgColor = new THREE.Color();
  let sunIntensity = 0.3;
  let ambientIntensity = 0.15;

  if (phase === "night") {
    sunColor.copy(COLOR_NIGHT);
    bgColor.copy(BG_NIGHT);
    sunIntensity = 1.0;
    ambientIntensity = 0.7;
  } else if (phase === "dawn") {
    const f = (t - PHASE_DAWN_START) / (PHASE_DAY_START - PHASE_DAWN_START);
    sunColor.copy(COLOR_NIGHT).lerp(COLOR_DAWN, f);
    bgColor.copy(BG_NIGHT).lerp(BG_DAY, f);
    sunIntensity = THREE.MathUtils.lerp(1.0, 1.4, f);
    ambientIntensity = THREE.MathUtils.lerp(0.7, 0.9, f);
  } else if (phase === "day") {
    const midpoint = (PHASE_DAY_START + PHASE_DUSK_START) / 2;
    const halfSpan = (PHASE_DUSK_START - PHASE_DAY_START) / 2;
    const distFromMid = Math.abs(t - midpoint) / halfSpan;
    const f = 1 - distFromMid;

    sunColor.copy(COLOR_DAWN).lerp(COLOR_DAY, f);
    bgColor.copy(BG_DAY);
    sunIntensity = THREE.MathUtils.lerp(1.4, 1.8, f);
    ambientIntensity = THREE.MathUtils.lerp(0.9, 1.1, f);
  } else if (phase === "dusk") {
    const f = (t - PHASE_DUSK_START) / (PHASE_NIGHT_START - PHASE_DUSK_START);
    sunColor.copy(COLOR_DUSK).lerp(COLOR_NIGHT, f);
    bgColor.copy(BG_DAY).lerp(BG_NIGHT, f);
    sunIntensity = THREE.MathUtils.lerp(1.4, 1.0, f);
    ambientIntensity = THREE.MathUtils.lerp(0.9, 0.7, f);
  }

  // Apply values (we mutate Three.js objects — they are external mutable refs)
  sunLight.color.copy(sunColor);
  sunLight.intensity = sunIntensity;
  ambientLight.intensity = ambientIntensity;

  if (scene) {
    scene.background = bgColor.clone();
    if (scene.fog) {
      scene.fog.color.copy(bgColor);
    }
  }

  dayNightState = {
    ...dayNightState,
    time: newTime,
    t,
    phase,
  };
}

// ===========================================================================
// 2. Lava Moat
// ===========================================================================

const LAVA_DAMAGE_PER_SEC = 5;
const LAVA_GAP = 1; // 1 cell gap between castle and lava
const LAVA_WIDTH = 1; // 1 cell wide ring
const MAX_BUBBLES = 20;
const BUBBLE_LIFETIME = 0.8; // seconds

// Lava shader — inline GLSL
const LAVA_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const LAVA_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv;
    float noise = sin(uv.x * 8.0 + uTime * 2.0) * sin(uv.y * 6.0 + uTime * 1.5) * 0.5 + 0.5;
    vec3 hot = vec3(1.0, 0.4, 0.0);
    vec3 cool = vec3(0.6, 0.1, 0.0);
    vec3 color = mix(cool, hot, noise);
    gl_FragColor = vec4(color, 0.9);
  }
`;

let lavaState = {
  meshes: [],
  material: null,
  time: 0,
  innerRadius: 0,
  outerRadius: 0,
  centerX: 0,
  centerZ: 0,
  bubbles: [],
  bubbleGroup: null,
  scene: null,
  cellSize: 1,
};

/**
 * Create the lava moat ring around the castle.
 * castleCenterX/Z — world-space center of the castle.
 * castleSize — number of cells across the castle footprint.
 * cellSize — world units per cell.
 */
export function createLavaMoat(
  scene,
  castleCenterX,
  castleCenterZ,
  castleSize,
  cellSize,
) {
  const halfCastle = (castleSize * cellSize) / 2;
  const innerRadius = halfCastle + LAVA_GAP * cellSize;
  const outerRadius = innerRadius + LAVA_WIDTH * cellSize;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: LAVA_VERTEX,
    fragmentShader: LAVA_FRAGMENT,
    transparent: true,
    side: THREE.DoubleSide,
  });

  // Build a ring from 4 rectangular planes (one per side)
  const meshes = buildLavaRing(
    castleCenterX,
    castleCenterZ,
    innerRadius,
    outerRadius,
    material,
  );
  meshes.forEach((m) => scene.add(m));

  // Bubble particle pool
  const bubbleGeometry = new THREE.SphereGeometry(0.15, 6, 6);
  const bubbleMaterial = new THREE.MeshBasicMaterial({ color: 0xff6600 });
  const bubbleGroup = new THREE.Group();
  scene.add(bubbleGroup);

  const bubbles = [];
  for (let i = 0; i < MAX_BUBBLES; i++) {
    const mesh = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
    mesh.visible = false;
    bubbleGroup.add(mesh);
    bubbles.push({ mesh, life: 0, active: false, vx: 0, vy: 0, vz: 0 });
  }

  lavaState = {
    meshes,
    material,
    time: 0,
    innerRadius,
    outerRadius,
    centerX: castleCenterX,
    centerZ: castleCenterZ,
    bubbles,
    bubbleGroup,
    scene,
    cellSize,
  };
}

/**
 * Build 4 rectangular planes forming a ring around the center.
 */
function buildLavaRing(cx, cz, inner, outer, material) {
  const meshes = [];
  const y = 0.05; // slightly above ground

  // Each side is a box-shaped strip
  // Top strip (negative Z)
  meshes.push(
    makeLavaPlane(
      cx - outer,
      cz - outer,
      outer * 2,
      outer - inner,
      y,
      material,
    ),
  );
  // Bottom strip (positive Z)
  meshes.push(
    makeLavaPlane(
      cx - outer,
      cz + inner,
      outer * 2,
      outer - inner,
      y,
      material,
    ),
  );
  // Left strip (negative X, excluding corners already covered)
  meshes.push(
    makeLavaPlane(
      cx - outer,
      cz - inner,
      outer - inner,
      inner * 2,
      y,
      material,
    ),
  );
  // Right strip (positive X)
  meshes.push(
    makeLavaPlane(
      cx + inner,
      cz - inner,
      outer - inner,
      inner * 2,
      y,
      material,
    ),
  );

  return meshes;
}

/**
 * Create a single lava plane at world position (x, z) with given width/depth.
 */
function makeLavaPlane(x, z, width, depth, y, material) {
  const geo = new THREE.PlaneGeometry(width, depth);
  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x + width / 2, y, z + depth / 2);
  return mesh;
}

/**
 * Returns true if the given world position is within the lava ring.
 */
export function isInLava(worldX, worldZ) {
  const { innerRadius, outerRadius, centerX, centerZ } = lavaState;
  if (outerRadius === 0) return false;

  // Use square ring (Chebyshev distance) matching the rectangular moat
  const dx = Math.abs(worldX - centerX);
  const dz = Math.abs(worldZ - centerZ);
  const maxDist = Math.max(dx, dz);
  return maxDist >= innerRadius && maxDist <= outerRadius;
}

/**
 * Returns the lava damage per second constant.
 */
export function getLavaDamagePerSec() {
  return LAVA_DAMAGE_PER_SEC;
}

/**
 * Advance lava animation and bubble particles.
 */
export function updateLavaMoat(dt) {
  if (!lavaState.material) return;

  const newTime = lavaState.time + dt;
  lavaState.material.uniforms.uTime.value = newTime;

  // Spawn occasional bubbles
  const spawnChance = dt * 8; // ~8 bubbles/sec attempt rate
  if (Math.random() < spawnChance) {
    spawnBubble(newTime);
  }

  // Update active bubbles
  const updatedBubbles = lavaState.bubbles.map((b) => {
    if (!b.active) return b;

    const newLife = b.life - dt;
    if (newLife <= 0) {
      b.mesh.visible = false;
      return { ...b, active: false, life: 0 };
    }

    b.mesh.position.x += b.vx * dt;
    b.mesh.position.y += b.vy * dt;
    b.mesh.position.z += b.vz * dt;

    // Fade out by shrinking
    const scale = Math.max(0, newLife / BUBBLE_LIFETIME);
    b.mesh.scale.setScalar(scale);

    return { ...b, life: newLife };
  });

  lavaState = { ...lavaState, time: newTime, bubbles: updatedBubbles };
}

/**
 * Spawn a single lava bubble at a random point in the moat.
 */
function spawnBubble() {
  const { bubbles, innerRadius, outerRadius, centerX, centerZ } = lavaState;
  const available = bubbles.find((b) => !b.active);
  if (!available) return;

  // Random point in the lava ring
  const side = Math.floor(Math.random() * 4);
  const midR = (innerRadius + outerRadius) / 2;
  const spread = (outerRadius - innerRadius) / 2;
  let x = centerX;
  let z = centerZ;

  const along = (Math.random() - 0.5) * 2 * outerRadius;
  const across = midR + (Math.random() - 0.5) * spread;

  if (side === 0) {
    x += along;
    z -= across;
  } else if (side === 1) {
    x += along;
    z += across;
  } else if (side === 2) {
    x -= across;
    z += along;
  } else {
    x += across;
    z += along;
  }

  available.mesh.position.set(x, 0.1, z);
  available.mesh.scale.setScalar(1);
  available.mesh.visible = true;
  available.active = true;
  available.life = BUBBLE_LIFETIME;
  available.vx = (Math.random() - 0.5) * 0.3;
  available.vy = 1.5 + Math.random() * 0.8;
  available.vz = (Math.random() - 0.5) * 0.3;
}

// ===========================================================================
// 3. Weather System
// ===========================================================================

const RAIN_COUNT = 2000;
const RAIN_AREA = 60; // world units square
const RAIN_HEIGHT = 30;

let weatherState = {
  type: "clear", // 'clear' | 'rain' | 'storm'
  scene: null,
  rainPoints: null,
  rainGeo: null,
  positions: null,
  velocities: null,
  time: 0,
  lightningTimer: 0,
  lightningCooldown: 5,
  flashTimer: 0,
  storedAmbientIntensity: 0,
};

/**
 * Initialise the weather particle system.
 */
export function createWeather(scene) {
  const positions = new Float32Array(RAIN_COUNT * 3);
  const velocities = new Float32Array(RAIN_COUNT);

  for (let i = 0; i < RAIN_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * RAIN_AREA;
    positions[i * 3 + 1] = Math.random() * RAIN_HEIGHT;
    positions[i * 3 + 2] = (Math.random() - 0.5) * RAIN_AREA;
    velocities[i] = 12 + Math.random() * 6; // fall speed
  }

  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const rainMat = new THREE.PointsMaterial({
    color: 0xaaaacc,
    size: 0.15,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });

  const rainPoints = new THREE.Points(rainGeo, rainMat);
  rainPoints.visible = false;
  scene.add(rainPoints);

  weatherState = {
    ...weatherState,
    scene,
    rainPoints,
    rainGeo,
    positions,
    velocities,
    lightningCooldown: 3 + Math.random() * 5,
  };
}

/**
 * Force a weather type: 'clear', 'rain', or 'storm'.
 */
export function setWeather(type) {
  weatherState = { ...weatherState, type };

  if (weatherState.rainPoints) {
    weatherState.rainPoints.visible = type === "rain" || type === "storm";
  }
}

/**
 * Advance weather particles and lightning.
 */
export function updateWeather(dt) {
  const { type, rainPoints, positions, velocities, rainGeo } = weatherState;
  if (!rainPoints) return;

  const newTime = weatherState.time + dt;

  // Auto weather: chance of rain at dusk/night
  if (type === "clear") {
    const phase = getDayPhase();
    if ((phase === "dusk" || phase === "night") && Math.random() < dt * 0.02) {
      setWeather("rain");
    }
  } else if (type === "rain") {
    const phase = getDayPhase();
    // Chance of clearing during day/dawn
    if ((phase === "day" || phase === "dawn") && Math.random() < dt * 0.05) {
      setWeather("clear");
    }
    // Chance of upgrading to storm at night
    if (phase === "night" && Math.random() < dt * 0.01) {
      setWeather("storm");
    }
  } else if (type === "storm") {
    if (getDayPhase() === "day" && Math.random() < dt * 0.08) {
      setWeather("clear");
    }
  }

  // Update rain particles if visible
  if (type === "rain" || type === "storm") {
    const windOffset = Math.sin(newTime * 0.5) * 2;
    for (let i = 0; i < RAIN_COUNT; i++) {
      const idx = i * 3;
      positions[idx + 1] -= velocities[i] * dt;
      positions[idx] += windOffset * dt * 0.3;

      // Recycle when below ground
      if (positions[idx + 1] < 0) {
        positions[idx] = (Math.random() - 0.5) * RAIN_AREA;
        positions[idx + 1] = RAIN_HEIGHT;
        positions[idx + 2] = (Math.random() - 0.5) * RAIN_AREA;
      }
    }
    rainGeo.attributes.position.needsUpdate = true;
  }

  // Storm lightning
  let newLightningTimer = weatherState.lightningTimer;
  let newFlashTimer = weatherState.flashTimer;
  let newCooldown = weatherState.lightningCooldown;

  if (type === "storm") {
    newLightningTimer += dt;
    if (newLightningTimer >= newCooldown) {
      // Trigger flash
      newFlashTimer = 0.1;
      newLightningTimer = 0;
      newCooldown = 3 + Math.random() * 5;

      // Store current ambient intensity if available
      if (dayNightState.ambientLight) {
        weatherState = {
          ...weatherState,
          storedAmbientIntensity: dayNightState.ambientLight.intensity,
        };
      }
    }
  }

  // Process active flash
  if (newFlashTimer > 0) {
    newFlashTimer -= dt;
    if (dayNightState.ambientLight) {
      if (newFlashTimer > 0) {
        dayNightState.ambientLight.intensity = 2.0;
      } else {
        dayNightState.ambientLight.intensity =
          weatherState.storedAmbientIntensity;
        newFlashTimer = 0;
      }
    }
  }

  weatherState = {
    ...weatherState,
    time: newTime,
    lightningTimer: newLightningTimer,
    flashTimer: newFlashTimer,
    lightningCooldown: newCooldown,
  };
}

// ===========================================================================
// 4. Procedural Sound Effects (Web Audio API)
// ===========================================================================

let audioState = {
  ctx: null,
  masterGain: null,
  volume: 0.5,
  muted: false,
};

/**
 * Initialise the Web Audio context. Must be called from a user gesture handler.
 */
export function initAudio() {
  if (audioState.ctx) return;

  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.5;
  masterGain.connect(ctx.destination);

  audioState = { ctx, masterGain, volume: 0.5, muted: false };
}

/**
 * Set master volume (0-1).
 */
export function setVolume(v) {
  const clamped = Math.max(0, Math.min(1, v));
  audioState = { ...audioState, volume: clamped };
  if (audioState.masterGain && !audioState.muted) {
    audioState.masterGain.gain.value = clamped;
  }
}

/**
 * Returns true if audio is muted.
 */
export function isMuted() {
  return audioState.muted;
}

/**
 * Toggle mute on/off.
 */
export function toggleMute() {
  const newMuted = !audioState.muted;
  audioState = { ...audioState, muted: newMuted };
  if (audioState.masterGain) {
    audioState.masterGain.gain.value = newMuted ? 0 : audioState.volume;
  }
}

/**
 * Create a white noise buffer (used by several sound effects).
 */
function createNoiseBuffer(duration) {
  const { ctx } = audioState;
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/**
 * Play a procedural sound effect by type name.
 */
export function playSound(type) {
  if (!audioState.ctx) return;

  const generators = {
    arrowShoot: playArrowShoot,
    cannonFire: playCannonFire,
    frostShoot: playFrostShoot,
    lightningZap: playLightningZap,
    enemyDeath: playEnemyDeath,
    enemyDeathBoss: playEnemyDeathBoss,
    goldPickup: playGoldPickup,
    waveStart: playWaveStart,
    build: playBuild,
    hit: playHit,
    upgrade: playUpgrade,
  };

  const fn = generators[type];
  if (fn) fn();
}

/** Short high-pitched twang — triangle wave sweep 800→200Hz, 0.1s */
function playArrowShoot() {
  const { ctx, masterGain } = audioState;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(800, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);

  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.1);
}

/** Low boom — white noise burst with low-pass filter, sweep 200→50Hz */
function playCannonFire() {
  const { ctx, masterGain } = audioState;
  const now = ctx.currentTime;

  const buffer = createNoiseBuffer(0.15);
  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(200, now);
  filter.frequency.exponentialRampToValueAtTime(50, now + 0.15);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.6, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  src.start(now);
}

/** Crystalline zing — sine 2000Hz with vibrato, 0.2s */
function playFrostShoot() {
  const { ctx, masterGain } = audioState;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const vibrato = ctx.createOscillator();
  const vibratoGain = ctx.createGain();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(2000, now);

  vibrato.type = "sine";
  vibrato.frequency.setValueAtTime(30, now);
  vibratoGain.gain.setValueAtTime(100, now);

  vibrato.connect(vibratoGain);
  vibratoGain.connect(osc.frequency);

  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  osc.connect(gain);
  gain.connect(masterGain);

  osc.start(now);
  vibrato.start(now);
  osc.stop(now + 0.2);
  vibrato.stop(now + 0.2);
}

/** Electric crackle — white noise + sine 1500Hz, 0.1s */
function playLightningZap() {
  const { ctx, masterGain } = audioState;
  const now = ctx.currentTime;

  // Noise component
  const buffer = createNoiseBuffer(0.1);
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = buffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.4, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  noiseSrc.connect(noiseGain);
  noiseGain.connect(masterGain);

  // Sine component
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1500, now);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.3, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(oscGain);
  oscGain.connect(masterGain);

  noiseSrc.start(now);
  osc.start(now);
  osc.stop(now + 0.1);
}

/** Satisfying crunch — noise burst 0.08s + low sine 150Hz 0.1s */
function playEnemyDeath() {
  const { ctx, masterGain } = audioState;
  const now = ctx.currentTime;

  const buffer = createNoiseBuffer(0.08);
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = buffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.35, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  noiseSrc.connect(noiseGain);
  noiseGain.connect(masterGain);

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, now);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.3, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(oscGain);
  oscGain.connect(masterGain);

  noiseSrc.start(now);
  osc.start(now);
  osc.stop(now + 0.1);
}

/** Bigger boss death — longer noise 0.3s + descending sine 300→80Hz */
function playEnemyDeathBoss() {
  const { ctx, masterGain } = audioState;
  const now = ctx.currentTime;

  const buffer = createNoiseBuffer(0.3);
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = buffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.5, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  noiseSrc.connect(noiseGain);
  noiseGain.connect(masterGain);

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.4, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc.connect(oscGain);
  oscGain.connect(masterGain);

  noiseSrc.start(now);
  osc.start(now);
  osc.stop(now + 0.3);
}

/** Ascending chime — sine 800→1200Hz, 0.15s */
function playGoldPickup() {
  const { ctx, masterGain } = audioState;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(800, now);
  osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.15);
}

/** Fanfare — three ascending tones C E G, 0.1s each, square wave */
function playWaveStart() {
  const { ctx, masterGain } = audioState;
  const now = ctx.currentTime;

  // C4 = 261.63, E4 = 329.63, G4 = 392.00
  const notes = [261.63, 329.63, 392.0];

  notes.forEach((freq, i) => {
    const start = now + i * 0.1;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, start);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(start);
    osc.stop(start + 0.1);
  });
}

/** Placement thud — noise burst + sine 200Hz, 0.1s */
function playBuild() {
  const { ctx, masterGain } = audioState;
  const now = ctx.currentTime;

  const buffer = createNoiseBuffer(0.1);
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = buffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.25, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  noiseSrc.connect(noiseGain);
  noiseGain.connect(masterGain);

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(200, now);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.3, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(oscGain);
  oscGain.connect(masterGain);

  noiseSrc.start(now);
  osc.start(now);
  osc.stop(now + 0.1);
}

/** Quick thwack — noise 0.05s */
function playHit() {
  const { ctx, masterGain } = audioState;
  const now = ctx.currentTime;

  const buffer = createNoiseBuffer(0.05);
  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  src.connect(gain);
  gain.connect(masterGain);
  src.start(now);
}

/** Ascending sparkle — sine sweep 500→2000Hz, 0.3s */
function playUpgrade() {
  const { ctx, masterGain } = audioState;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(500, now);
  osc.frequency.exponentialRampToValueAtTime(2000, now + 0.3);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.setValueAtTime(0.25, now + 0.15);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.3);
}

// ===========================================================================
// 5. Torch / Fire Particles
// ===========================================================================

const TORCH_PARTICLE_COUNT = 6;

let torchState = {
  torches: [], // array of { light, particles, geo, baseIntensity, freqOffset }
  time: 0,
  scene: null,
};

/**
 * Create torches at the given world positions.
 * positions — array of THREE.Vector3.
 */
export function createTorches(scene, positions) {
  const torches = positions.map((pos) => {
    // Point light with orange glow
    const light = new THREE.PointLight(0xff8833, 0.8, 8);
    light.position.copy(pos);
    scene.add(light);

    // Fire particles using THREE.Points
    const count = TORCH_PARTICLE_COUNT;
    const posArray = new Float32Array(count * 3);
    const colorArray = new Float32Array(count * 3);
    const lifetimes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      resetFireParticle(posArray, colorArray, lifetimes, i, pos);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(posArray, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colorArray, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);

    return {
      light,
      points,
      geo,
      positions: posArray,
      colors: colorArray,
      lifetimes,
      basePos: pos.clone(),
      baseIntensity: 0.8,
      freqOffset: Math.random() * Math.PI * 2,
    };
  });

  torchState = { torches, time: 0, scene };
}

/**
 * Reset a single fire particle to its origin with random offset.
 */
function resetFireParticle(posArr, colorArr, lifetimes, index, basePos) {
  const i3 = index * 3;
  posArr[i3] = basePos.x + (Math.random() - 0.5) * 0.3;
  posArr[i3 + 1] = basePos.y;
  posArr[i3 + 2] = basePos.z + (Math.random() - 0.5) * 0.3;

  // Random orange-yellow color
  const r = 0.9 + Math.random() * 0.1;
  const g = 0.3 + Math.random() * 0.4;
  const b = Math.random() * 0.1;
  colorArr[i3] = r;
  colorArr[i3 + 1] = g;
  colorArr[i3 + 2] = b;

  lifetimes[index] = 0.4 + Math.random() * 0.6; // 0.4-1.0s lifetime
}

/**
 * Advance torch flicker and fire particles.
 */
export function updateTorches(dt) {
  const newTime = torchState.time + dt;

  torchState.torches.forEach((torch) => {
    // Flicker light intensity
    const flicker =
      Math.sin(newTime * 8 + torch.freqOffset) * 0.15 +
      Math.sin(newTime * 13 + torch.freqOffset * 1.7) * 0.1;
    torch.light.intensity = torch.baseIntensity + flicker;

    // Update fire particles
    const {
      positions: posArr,
      colors: colorArr,
      lifetimes,
      basePos,
      geo,
    } = torch;
    const count = lifetimes.length;

    for (let i = 0; i < count; i++) {
      lifetimes[i] -= dt;

      if (lifetimes[i] <= 0) {
        resetFireParticle(posArr, colorArr, lifetimes, i, basePos);
      } else {
        const i3 = i * 3;
        // Float upward with slight drift
        posArr[i3 + 1] += 1.5 * dt;
        posArr[i3] += Math.sin(newTime * 3 + i) * 0.2 * dt;
        posArr[i3 + 2] += Math.cos(newTime * 2.5 + i) * 0.2 * dt;

        // Fade color toward dark red as lifetime decreases
        const lifeFrac = lifetimes[i] / 1.0;
        colorArr[i3 + 1] *= 0.95 + lifeFrac * 0.05; // green fades
      }
    }

    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });

  torchState = { ...torchState, time: newTime };
}

// ===========================================================================
// Master Update
// ===========================================================================

/**
 * Update all atmosphere effects. Call once per frame with delta time in seconds.
 */
export function updateAtmosphere(dt) {
  updateDayNight(dt);
  updateLavaMoat(dt);
  updateWeather(dt);
  updateTorches(dt);
}
