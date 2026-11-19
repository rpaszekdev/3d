/**
 * terrain-render.js — Three.js terrain renderer for Castle Defense
 *
 * Converts terrain data from terrain.js into a 3D Three.js scene.
 * Uses InstancedMesh for performance, supports elevation, water,
 * forests, mountains, swamps, bridges, and path visualization.
 *
 * Usage:
 *   import { createTerrainScene, getGroundMeshes, getCellWorldPos, disposeTerrainScene } from './terrain-render.js';
 *   const handle = createTerrainScene(scene, map, getAssetMesh);
 */

import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════

const MAP_SIZE = 30;
const CELL_SIZE = 2;
const HALF_MAP = (MAP_SIZE * CELL_SIZE) / 2;

const CELL_HEIGHT = 0.3;
const MOUNTAIN_MIN_HEIGHT = 3;
const MOUNTAIN_MAX_HEIGHT = 5;
const BRIDGE_Y = 0;
const WATER_Y = -0.3;

const ELEVATION_Y = Object.freeze({
  '-1': -0.5,   // water
  '0':   0,     // ground
  '1':   1.0,   // low_hill
  '2':   2.0,   // high_hill
  '3':   3.0,   // mountain
});

const TREE_VOXI = `V 8 12 8
C 4 0 4 1 5 a
S 4 7 4 3 c
S 4 9 4 2 c`;

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

function gridToWorld(gx, gz) {
  return {
    x: (gx - MAP_SIZE / 2 + 0.5) * CELL_SIZE,
    z: (gz - MAP_SIZE / 2 + 0.5) * CELL_SIZE,
  };
}

function elevationToY(elev) {
  return ELEVATION_Y[String(elev)] ?? 0;
}

/**
 * Parse a CSS color string (hex shorthand, hex 6-digit, or named)
 * into a THREE.Color instance.
 */
function parseCSSColor(cssColor) {
  return new THREE.Color(cssColor);
}

/**
 * Convert a THREE.Color to a hex integer for use as a map key.
 */
function colorToHex(color) {
  return color.getHex();
}

/**
 * Build a Set of grid keys for fast lookup.
 */
function cellSetFromArray(cells) {
  const s = new Set();
  for (const { x, z } of cells) {
    s.add(`${x},${z}`);
  }
  return s;
}

// ═══════════════════════════════════════════════════════════════
//  GROUND CELLS (InstancedMesh grouped by color)
// ═══════════════════════════════════════════════════════════════

function buildGroundInstances(map, pathSet) {
  const { gridSize, terrain, elevation, colors } = map;
  const cellGeo = new THREE.BoxGeometry(CELL_SIZE, CELL_HEIGHT, CELL_SIZE);

  // Group cells by hex color
  const groups = new Map(); // hex -> [{gx, gz, y}]

  for (let gx = 0; gx < gridSize; gx++) {
    for (let gz = 0; gz < gridSize; gz++) {
      const type = terrain[gx][gz];
      if (type === 'water') continue; // water handled separately

      let cssColor = colors[gx][gz];

      // Paths get a subtle lightening
      if (pathSet.has(`${gx},${gz}`) && type === 'ground') {
        const base = parseCSSColor(cssColor);
        cssColor = `#${base.clone().lerp(new THREE.Color(0xffffff), 0.12).getHexString()}`;
      }

      // Swamp cells get slight darkening
      if (type === 'swamp') {
        const base = parseCSSColor(cssColor);
        cssColor = `#${base.clone().lerp(new THREE.Color(0x000000), 0.15).getHexString()}`;
      }

      const hex = colorToHex(parseCSSColor(cssColor));
      const y = elevationToY(elevation[gx][gz]);

      if (!groups.has(hex)) groups.set(hex, []);
      groups.get(hex).push({ gx, gz, y });
    }
  }

  // Build one InstancedMesh per color group
  const meshes = [];
  const dummy = new THREE.Object3D();

  for (const [hex, cells] of groups) {
    const mat = new THREE.MeshStandardMaterial({
      color: hex,
      roughness: 0.85,
      metalness: 0.05,
    });
    const instMesh = new THREE.InstancedMesh(cellGeo, mat, cells.length);
    instMesh.castShadow = false;
    instMesh.receiveShadow = true;

    for (let i = 0; i < cells.length; i++) {
      const { gx, gz, y } = cells[i];
      const world = gridToWorld(gx, gz);
      dummy.position.set(world.x, y - CELL_HEIGHT / 2, world.z);
      dummy.updateMatrix();
      instMesh.setMatrixAt(i, dummy.matrix);
    }
    instMesh.instanceMatrix.needsUpdate = true;
    meshes.push(instMesh);
  }

  return { meshes, geometry: cellGeo };
}

// ═══════════════════════════════════════════════════════════════
//  WATER
// ═══════════════════════════════════════════════════════════════

function buildWater(map) {
  const { waterCells } = map;
  if (!waterCells || waterCells.length === 0) return null;

  const geo = new THREE.PlaneGeometry(CELL_SIZE, CELL_SIZE);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x2266aa,
    transparent: true,
    opacity: 0.65,
    roughness: 0.3,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  const instMesh = new THREE.InstancedMesh(geo, mat, waterCells.length);
  instMesh.receiveShadow = true;
  instMesh.castShadow = false;

  const dummy = new THREE.Object3D();
  dummy.rotation.x = -Math.PI / 2;

  for (let i = 0; i < waterCells.length; i++) {
    const { x, z } = waterCells[i];
    const world = gridToWorld(x, z);
    dummy.position.set(world.x, WATER_Y, world.z);
    dummy.updateMatrix();
    instMesh.setMatrixAt(i, dummy.matrix);
  }
  instMesh.instanceMatrix.needsUpdate = true;

  // Store base Y for animation
  instMesh.userData.baseY = WATER_Y;
  instMesh.userData.time = 0;

  return { mesh: instMesh, geometry: geo, material: mat };
}

// ═══════════════════════════════════════════════════════════════
//  MOUNTAINS (InstancedMesh)
// ═══════════════════════════════════════════════════════════════

function buildMountains(map) {
  const { mountainCells, elevation } = map;
  if (!mountainCells || mountainCells.length === 0) return null;

  const maxH = MOUNTAIN_MAX_HEIGHT;
  const geo = new THREE.BoxGeometry(CELL_SIZE, maxH, CELL_SIZE);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x777788,
    roughness: 0.9,
    metalness: 0.05,
  });
  const instMesh = new THREE.InstancedMesh(geo, mat, mountainCells.length);
  instMesh.castShadow = true;
  instMesh.receiveShadow = true;

  const dummy = new THREE.Object3D();

  for (let i = 0; i < mountainCells.length; i++) {
    const { x, z } = mountainCells[i];
    const world = gridToWorld(x, z);
    const elev = elevation[x]?.[z] ?? 3;
    const h = MOUNTAIN_MIN_HEIGHT + (elev / 3) * (MOUNTAIN_MAX_HEIGHT - MOUNTAIN_MIN_HEIGHT);
    dummy.position.set(world.x, h / 2, world.z);
    dummy.scale.set(1, h / maxH, 1);
    dummy.updateMatrix();
    instMesh.setMatrixAt(i, dummy.matrix);
  }
  instMesh.instanceMatrix.needsUpdate = true;

  return { mesh: instMesh, geometry: geo, material: mat };
}

// ═══════════════════════════════════════════════════════════════
//  BRIDGES
// ═══════════════════════════════════════════════════════════════

function buildBridges(map) {
  const { bridgeCells } = map;
  if (!bridgeCells || bridgeCells.length === 0) return [];

  const geo = new THREE.BoxGeometry(CELL_SIZE, 0.2, CELL_SIZE);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8B6914,
    roughness: 0.8,
    metalness: 0.05,
  });

  const meshes = [];
  const dummy = new THREE.Object3D();

  const instMesh = new THREE.InstancedMesh(geo, mat, bridgeCells.length);
  instMesh.castShadow = true;
  instMesh.receiveShadow = true;

  for (let i = 0; i < bridgeCells.length; i++) {
    const { x, z } = bridgeCells[i];
    const world = gridToWorld(x, z);
    dummy.position.set(world.x, BRIDGE_Y, world.z);
    dummy.updateMatrix();
    instMesh.setMatrixAt(i, dummy.matrix);
  }
  instMesh.instanceMatrix.needsUpdate = true;
  meshes.push(instMesh);

  return { meshes, geometry: geo, material: mat };
}

// ═══════════════════════════════════════════════════════════════
//  FORESTS (VOXI tree models)
// ═══════════════════════════════════════════════════════════════

function buildForests(map, getAssetMesh) {
  const { forestCells, elevation } = map;
  if (!forestCells || forestCells.length === 0) return [];

  const meshes = [];

  for (const { x, z } of forestCells) {
    const treeMesh = getAssetMesh(TREE_VOXI, 0.25);
    const world = gridToWorld(x, z);
    const y = elevationToY(elevation[x]?.[z] ?? 0);
    treeMesh.position.set(world.x, y, world.z);
    treeMesh.castShadow = true;
    treeMesh.receiveShadow = true;
    meshes.push(treeMesh);
  }

  return meshes;
}

// ═══════════════════════════════════════════════════════════════
//  SWAMP PARTICLES (subtle floating motes)
// ═══════════════════════════════════════════════════════════════

function buildSwampParticles(map) {
  const { swampCells } = map;
  if (!swampCells || swampCells.length === 0) return null;

  const count = Math.min(swampCells.length * 3, 200);
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const cell = swampCells[i % swampCells.length];
    const world = gridToWorld(cell.x, cell.z);
    positions[i * 3] = world.x + (Math.random() - 0.5) * CELL_SIZE;
    positions[i * 3 + 1] = 0.1 + Math.random() * 0.5;
    positions[i * 3 + 2] = world.z + (Math.random() - 0.5) * CELL_SIZE;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0x88aa66,
    size: 0.15,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });

  const points = new THREE.Points(geo, mat);
  points.userData.basePositions = positions.slice();
  points.userData.time = 0;

  return { points, geometry: geo, material: mat };
}

// ═══════════════════════════════════════════════════════════════
//  PATH SET BUILDER
// ═══════════════════════════════════════════════════════════════

function buildPathSet(map) {
  const s = new Set();
  if (!map.paths) return s;
  for (const path of map.paths) {
    for (const { x, z } of path) {
      s.add(`${x},${z}`);
    }
  }
  return s;
}

// ═══════════════════════════════════════════════════════════════
//  PUBLIC API
// ═══════════════════════════════════════════════════════════════

/**
 * Build the full terrain scene from a map object.
 *
 * @param {THREE.Scene} scene
 * @param {object} map - terrain map from generateTerrain()
 * @param {function} getAssetMesh - callback (voxiCode, scale) => THREE.Object3D
 * @returns {object} TerrainHandle
 */
export function createTerrainScene(scene, map, getAssetMesh) {
  const allObjects = [];
  const pathSet = buildPathSet(map);

  // 1. Ground cells
  const ground = buildGroundInstances(map, pathSet);
  const groundMeshes = ground.meshes;
  for (const m of groundMeshes) {
    scene.add(m);
    allObjects.push(m);
  }

  // 2. Water
  const waterResult = buildWater(map);
  let waterMesh = null;
  if (waterResult) {
    waterMesh = waterResult.mesh;
    scene.add(waterMesh);
    allObjects.push(waterMesh);
  }

  // 3. Mountains
  const mountainResult = buildMountains(map);
  let mountainMesh = null;
  if (mountainResult) {
    mountainMesh = mountainResult.mesh;
    scene.add(mountainMesh);
    allObjects.push(mountainMesh);
  }

  // 4. Bridges
  const bridgeResult = buildBridges(map);
  const bridgeMeshes = bridgeResult.meshes ?? [];
  for (const m of bridgeMeshes) {
    scene.add(m);
    allObjects.push(m);
  }

  // 5. Forest trees
  const forestMeshes = buildForests(map, getAssetMesh);
  for (const m of forestMeshes) {
    scene.add(m);
    allObjects.push(m);
  }

  // 6. Swamp particles
  const swampResult = buildSwampParticles(map);
  if (swampResult) {
    scene.add(swampResult.points);
    allObjects.push(swampResult.points);
  }

  const handle = Object.freeze({
    groundMeshes,
    waterMesh,
    forestMeshes,
    mountainMesh,
    bridgeMeshes,
    swampParticles: swampResult?.points ?? null,
    allObjects,

    // Store internals for disposal
    _geometries: [
      ground.geometry,
      waterResult?.geometry,
      mountainResult?.geometry,
      bridgeResult?.geometry,
      swampResult?.geometry,
    ].filter(Boolean),

    _materials: [
      waterResult?.material,
      mountainResult?.material,
      bridgeResult?.material,
      swampResult?.material,
    ].filter(Boolean),

    /**
     * Animate water oscillation and swamp particles.
     * Call once per frame with delta time in seconds.
     */
    update(dt) {
      // Water Y oscillation
      if (waterMesh) {
        waterMesh.userData.time += dt;
        waterMesh.position.y = Math.sin(waterMesh.userData.time * 1.2) * 0.08;
      }

      // Swamp particle drift
      if (swampResult) {
        swampResult.points.userData.time += dt;
        const t = swampResult.points.userData.time;
        const pos = swampResult.geometry.attributes.position;
        const base = swampResult.points.userData.basePositions;

        for (let i = 0; i < pos.count; i++) {
          pos.array[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.8 + i) * 0.15;
        }
        pos.needsUpdate = true;
      }
    },
  });

  return handle;
}

/**
 * Returns ground meshes for raycasting (mouse picking).
 * @param {object} handle - TerrainHandle from createTerrainScene
 * @returns {THREE.Object3D[]}
 */
export function getGroundMeshes(handle) {
  return [...handle.groundMeshes];
}

/**
 * Get world position for a grid cell based on elevation.
 * @param {object} map - terrain map
 * @param {number} gx - grid x
 * @param {number} gz - grid z
 * @returns {{ x: number, y: number, z: number }}
 */
export function getCellWorldPos(map, gx, gz) {
  const world = gridToWorld(gx, gz);
  const elev = map.elevation[gx]?.[gz] ?? 0;
  return {
    x: world.x,
    y: elevationToY(elev),
    z: world.z,
  };
}

/**
 * Remove all terrain objects from the scene and dispose GPU resources.
 * @param {THREE.Scene} scene
 * @param {object} handle - TerrainHandle from createTerrainScene
 */
export function disposeTerrainScene(scene, handle) {
  // Remove all objects from scene
  for (const obj of handle.allObjects) {
    scene.remove(obj);

    // Dispose InstancedMesh / Mesh materials
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => m.dispose());
      } else {
        obj.material.dispose();
      }
    }
    if (obj.geometry) {
      obj.geometry.dispose();
    }

    // Dispose children (forest tree groups)
    if (obj.children) {
      obj.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
  }

  // Dispose shared geometries and materials
  for (const geo of handle._geometries) {
    geo.dispose();
  }
  for (const mat of handle._materials) {
    mat.dispose();
  }
}
