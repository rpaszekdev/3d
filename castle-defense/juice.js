/**
 * juice.js — Visual effects system for Castle Defense
 *
 * Post-processing, screen shake, death explosions, damage numbers,
 * gold particles, projectile trails, impact flashes, and more.
 *
 * All public functions are exported as named exports.
 * THREE.js is imported as an ES module dependency.
 */

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";

// ---------------------------------------------------------------------------
// VOXI color palette
// ---------------------------------------------------------------------------
const COLORS = [
  0x111111, 0xcc2222, 0x22aa22, 0x2255cc, 0x22cccc, 0xcc22cc, 0xcccc22,
  0xdd8822, 0xeeeeee, 0x888888, 0x8b4513, 0xff88aa, 0x226622, 0xd2b48c,
  0x771122, 0x112266,
];

// ---------------------------------------------------------------------------
// 1. Post-Processing Pipeline
// ---------------------------------------------------------------------------

/** Custom vignette shader — darkens edges of the screen. */
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 1.0 },
    darkness: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float offset;
    uniform float darkness;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      // Distance from centre, normalised so corners = 1
      vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
      float vigAmount = 1.0 - dot(uv, uv);
      texel.rgb *= mix(1.0, vigAmount, darkness);
      gl_FragColor = texel;
    }
  `,
};

/**
 * Build and return an EffectComposer with bloom, FXAA, and vignette.
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @returns {EffectComposer}
 */
export function createComposer(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const pixelRatio = renderer.getPixelRatio();

  const composer = new EffectComposer(renderer);

  // Base render
  composer.addPass(new RenderPass(scene, camera));

  // Bloom — glow on projectiles and towers
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(size.x, size.y),
    0.3, // strength
    0.3, // radius
    0.9, // threshold
  );
  composer.addPass(bloom);

  // FXAA anti-aliasing
  const fxaa = new ShaderPass(FXAAShader);
  fxaa.uniforms["resolution"].value.set(
    1 / (size.x * pixelRatio),
    1 / (size.y * pixelRatio),
  );
  composer.addPass(fxaa);

  // Vignette
  const vignette = new ShaderPass(VignetteShader);
  composer.addPass(vignette);

  return composer;
}

// ---------------------------------------------------------------------------
// 2. Screen Shake
// ---------------------------------------------------------------------------

/** Module-level shake state. */
const shakeState = {
  active: false,
  intensity: 0,
  duration: 0,
  elapsed: 0,
  basePosition: new THREE.Vector3(),
};

/**
 * Begin a screen shake.
 * @param {THREE.Camera} camera
 * @param {number} intensity  Max offset in world units (e.g. 0.15)
 * @param {number} duration   Seconds (e.g. 0.25)
 */
export function triggerShake(camera, intensity = 0.15, duration = 0.25) {
  shakeState.active = true;
  shakeState.intensity = intensity;
  shakeState.duration = duration;
  shakeState.elapsed = 0;
  shakeState.basePosition.copy(camera.position);
}

/**
 * Per-frame shake update. Applies decaying random jitter then restores
 * the camera when the shake ends.
 * @param {THREE.Camera} camera
 * @param {number} dt  Delta time in seconds
 */
export function updateShake(camera, dt) {
  if (!shakeState.active) return;

  shakeState.elapsed += dt;

  if (shakeState.elapsed >= shakeState.duration) {
    // Restore original position
    camera.position.copy(shakeState.basePosition);
    shakeState.active = false;
    return;
  }

  // Decay from 1 → 0
  const progress = shakeState.elapsed / shakeState.duration;
  const decay = 1 - progress;
  const mag = shakeState.intensity * decay;

  camera.position.set(
    shakeState.basePosition.x + (Math.random() - 0.5) * 2 * mag,
    shakeState.basePosition.y + (Math.random() - 0.5) * 2 * mag,
    shakeState.basePosition.z + (Math.random() - 0.5) * 2 * mag,
  );
}

// ---------------------------------------------------------------------------
// 3. Voxel Death Explosion
// ---------------------------------------------------------------------------

/** Pool of shared geometries to avoid per-frame allocation. */
const DEBRIS_GEO = new THREE.BoxGeometry(0.08, 0.08, 0.08);

/** Active explosion groups. */
const explosions = [];

/**
 * Spawn a burst of coloured debris cubes when an enemy dies.
 * @param {THREE.Scene} scene
 * @param {THREE.Vector3} position  Centre of the explosion
 * @param {number[]} voxelColors    Array of VOXI colour indices
 * @param {number} [scale=1]        Multiplier on spread velocity
 */
export function createDeathExplosion(scene, position, voxelColors, scale = 1) {
  const count = 15 + Math.floor(Math.random() * 11); // 15-25
  const pieces = [];

  for (let i = 0; i < count; i++) {
    const colorIdx =
      voxelColors[Math.floor(Math.random() * voxelColors.length)];
    const hex =
      typeof colorIdx === "number" && colorIdx < COLORS.length
        ? COLORS[colorIdx]
        : colorIdx; // allow raw hex too

    const mat = new THREE.MeshStandardMaterial({
      color: hex,
      transparent: true,
      opacity: 1,
    });
    const mesh = new THREE.Mesh(DEBRIS_GEO, mat);
    mesh.position.copy(position);

    // Random outward + upward velocity
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 3 * scale,
      Math.random() * 3 * scale + 1.5 * scale, // upward bias
      (Math.random() - 0.5) * 3 * scale,
    );

    // Random spin axis and speed
    const spinAxis = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5,
    ).normalize();
    const spinSpeed = Math.random() * 8 + 4; // rad/s

    scene.add(mesh);
    pieces.push({ mesh, vel, spinAxis, spinSpeed, mat });
  }

  explosions.push({
    pieces,
    elapsed: 0,
    lifetime: 0.8,
    scene,
  });
}

/**
 * Tick all active explosions. Applies gravity, spin, and opacity fade.
 * Removes finished explosions and disposes materials.
 * @param {number} dt
 */
export function updateExplosions(dt) {
  const GRAVITY = -12;

  for (let i = explosions.length - 1; i >= 0; i--) {
    const ex = explosions[i];
    ex.elapsed += dt;

    if (ex.elapsed >= ex.lifetime) {
      // Cleanup
      for (const p of ex.pieces) {
        ex.scene.remove(p.mesh);
        p.mat.dispose();
      }
      explosions.splice(i, 1);
      continue;
    }

    const progress = ex.elapsed / ex.lifetime;

    for (const p of ex.pieces) {
      // Gravity
      p.vel.y += GRAVITY * dt;

      // Move
      p.mesh.position.addScaledVector(p.vel, dt);

      // Spin
      p.mesh.rotateOnAxis(p.spinAxis, p.spinSpeed * dt);

      // Fade opacity
      p.mat.opacity = 1 - progress;
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Floating Damage Numbers
// ---------------------------------------------------------------------------

/** Active damage number sprites. */
const damageNumbers = [];

/**
 * Create a canvas texture showing a number with the given colour.
 * @param {number} damage
 * @param {string} cssColor  e.g. '#ff4444'
 * @returns {THREE.Texture}
 */
function makeDamageTexture(damage, cssColor) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = cssColor;
  ctx.font = "bold 72px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Outline for readability
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 6;
  ctx.strokeText(String(damage), size / 2, size / 2);
  ctx.fillText(String(damage), size / 2, size / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Spawn a floating damage number sprite.
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera  (unused currently, kept for API symmetry)
 * @param {THREE.Vector3} position
 * @param {number} damage
 * @param {number} [color=0xff4444]  Hex colour
 */
export function spawnDamageNumber(
  scene,
  camera,
  position,
  damage,
  color = 0xff4444,
) {
  const cssColor = "#" + new THREE.Color(color).getHexString();
  const texture = makeDamageTexture(damage, cssColor);

  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 1,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(mat);

  // Scale based on damage magnitude — bigger hit = bigger text
  const baseScale = 0.4 + Math.min(damage / 50, 0.6);
  sprite.scale.set(baseScale, baseScale, 1);

  sprite.position.copy(position);
  // Slight random horizontal offset so overlapping numbers spread
  sprite.position.x += (Math.random() - 0.5) * 0.3;
  sprite.position.z += (Math.random() - 0.5) * 0.3;

  scene.add(sprite);

  damageNumbers.push({
    sprite,
    mat,
    texture,
    elapsed: 0,
    lifetime: 0.8,
    startY: sprite.position.y,
    scene,
  });
}

/**
 * Update all active damage number sprites (float up + fade).
 * @param {number} dt
 */
export function updateDamageNumbers(dt) {
  for (let i = damageNumbers.length - 1; i >= 0; i--) {
    const dn = damageNumbers[i];
    dn.elapsed += dt;

    if (dn.elapsed >= dn.lifetime) {
      dn.scene.remove(dn.sprite);
      dn.mat.dispose();
      dn.texture.dispose();
      damageNumbers.splice(i, 1);
      continue;
    }

    const progress = dn.elapsed / dn.lifetime;
    // Float upward 1.5 units over lifetime
    dn.sprite.position.y = dn.startY + progress * 1.5;
    dn.mat.opacity = 1 - progress;
  }
}

// ---------------------------------------------------------------------------
// 5. Gold Pickup Particles
// ---------------------------------------------------------------------------

const GOLD_GEO = new THREE.BoxGeometry(0.06, 0.06, 0.06);

/** Active gold particle groups. */
const goldParticles = [];

/**
 * Spawn small yellow cubes that float upward and fade.
 * @param {THREE.Scene} scene
 * @param {THREE.Vector3} position
 * @param {number} amount  Gold earned (affects particle count slightly)
 */
export function spawnGoldParticles(scene, position, amount) {
  const count = 3 + Math.min(Math.floor(amount / 10), 2); // 3-5
  const pieces = [];

  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 1,
    });
    const mesh = new THREE.Mesh(GOLD_GEO, mat);
    mesh.position.copy(position);
    mesh.position.x += (Math.random() - 0.5) * 0.4;
    mesh.position.z += (Math.random() - 0.5) * 0.4;

    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      1.5 + Math.random() * 1.0,
      (Math.random() - 0.5) * 0.5,
    );

    scene.add(mesh);
    pieces.push({ mesh, mat, vel });
  }

  goldParticles.push({
    pieces,
    elapsed: 0,
    lifetime: 0.8,
    scene,
  });
}

/**
 * Animate gold particles (rise + fade). Removes finished groups.
 * @param {number} dt
 */
export function updateGoldParticles(dt) {
  for (let i = goldParticles.length - 1; i >= 0; i--) {
    const gp = goldParticles[i];
    gp.elapsed += dt;

    if (gp.elapsed >= gp.lifetime) {
      for (const p of gp.pieces) {
        gp.scene.remove(p.mesh);
        p.mat.dispose();
      }
      goldParticles.splice(i, 1);
      continue;
    }

    const progress = gp.elapsed / gp.lifetime;
    for (const p of gp.pieces) {
      p.mesh.position.addScaledVector(p.vel, dt);
      // Slow down horizontal drift
      p.vel.x *= 0.96;
      p.vel.z *= 0.96;
      p.mat.opacity = 1 - progress;
      // Gentle spin
      p.mesh.rotation.y += dt * 4;
    }
  }
}

// ---------------------------------------------------------------------------
// 6. Projectile Trails
// ---------------------------------------------------------------------------

const MAX_TRAIL_POINTS = 8;

/**
 * Create a trail object that tracks the last N positions of a projectile.
 * @param {THREE.Scene} scene
 * @param {THREE.Vector3} position  Initial position
 * @param {number} color            Hex colour
 * @returns {{ line: THREE.Line, positions: Float32Array, head: number, count: number, color: number }}
 */
export function createTrail(scene, position, color) {
  const positions = new Float32Array(MAX_TRAIL_POINTS * 3);
  // Fill all slots with the initial position
  for (let i = 0; i < MAX_TRAIL_POINTS; i++) {
    positions[i * 3] = position.x;
    positions[i * 3 + 1] = position.y;
    positions[i * 3 + 2] = position.z;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.7,
  });

  const line = new THREE.Line(geometry, material);
  line.frustumCulled = false;
  scene.add(line);

  return { line, positions, head: 0, count: 0, color };
}

/**
 * Push a new point onto the trail ring buffer.
 * @param {{ line: THREE.Line, positions: Float32Array, head: number, count: number }} trail
 * @param {THREE.Vector3} newPosition
 * @param {number} dt
 */
export function updateTrail(trail, newPosition, dt) {
  // Shift existing points down (oldest falls off)
  // We store points newest-first so the line draws tail → head
  for (let i = MAX_TRAIL_POINTS - 1; i > 0; i--) {
    trail.positions[i * 3] = trail.positions[(i - 1) * 3];
    trail.positions[i * 3 + 1] = trail.positions[(i - 1) * 3 + 1];
    trail.positions[i * 3 + 2] = trail.positions[(i - 1) * 3 + 2];
  }
  trail.positions[0] = newPosition.x;
  trail.positions[1] = newPosition.y;
  trail.positions[2] = newPosition.z;

  if (trail.count < MAX_TRAIL_POINTS) trail.count++;

  trail.line.geometry.attributes.position.needsUpdate = true;
  // Fade material slightly each frame so stale trails dim
  trail.line.material.opacity = Math.min(
    0.7,
    trail.line.material.opacity + dt * 2,
  );
}

/**
 * Remove trail line from scene and dispose resources.
 * @param {THREE.Scene} scene
 * @param {{ line: THREE.Line }} trail
 */
export function removeTrail(scene, trail) {
  scene.remove(trail.line);
  trail.line.geometry.dispose();
  trail.line.material.dispose();
}

// ---------------------------------------------------------------------------
// 7. Impact Flash
// ---------------------------------------------------------------------------

/** Active flash effects: { mesh, originalColors[], elapsed, duration } */
const flashes = [];

/**
 * Temporarily turn all materials on a mesh white, then restore.
 * @param {THREE.Mesh|THREE.Group} mesh
 * @param {number} [duration=0.12]  Seconds
 */
export function flashMesh(mesh, duration = 0.12) {
  const originalColors = [];

  mesh.traverse((child) => {
    if (child.isMesh && child.material) {
      const mats = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (const mat of mats) {
        if (mat.color) {
          originalColors.push({ mat, color: mat.color.clone() });
          mat.color.set(0xffffff);
        }
        if (mat.emissive) {
          originalColors.push({ mat, emissive: mat.emissive.clone() });
          mat.emissive.set(0xffffff);
        }
      }
    }
  });

  flashes.push({ mesh, originalColors, elapsed: 0, duration });
}

/**
 * Tick active flashes and restore colours when done.
 * @param {number} dt
 */
export function updateFlashes(dt) {
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i];
    f.elapsed += dt;

    if (f.elapsed >= f.duration) {
      // Restore original colours
      for (const entry of f.originalColors) {
        if (entry.color) entry.mat.color.copy(entry.color);
        if (entry.emissive) entry.mat.emissive.copy(entry.emissive);
      }
      flashes.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// 8. Master Update
// ---------------------------------------------------------------------------

/**
 * Call once per frame to update every juice subsystem.
 * @param {number} dt  Delta time in seconds
 */
export function updateAllJuice(dt) {
  // Note: updateShake requires the camera, so the caller must invoke
  // updateShake(camera, dt) separately before or after this call,
  // OR pass camera to a wrapper. We update everything else here.
  updateExplosions(dt);
  updateDamageNumbers(dt);
  updateGoldParticles(dt);
  updateFlashes(dt);
}
