#!/usr/bin/env node
/**
 * benchmark-temporal.js — Unbiased temporal-spatial reasoning benchmark
 *
 * Generates random animated VOXI scenes with known ground truth,
 * produces depth text matrices, and outputs questions for LLM testing.
 *
 * No human designs the questions — everything is programmatic.
 *
 * Usage: node benchmark-temporal.js --count 30 --seed 42
 */

import { textViewAtFrame, frameDiff, parseVoxiAnim } from './voxi-reasoning/text-view.js';

// ── Deterministic RNG ──────────────────────────────────────────────
class RNG {
  constructor(seed) { this.s = seed; }
  next() { this.s = (this.s * 1103515245 + 12345) & 0x7fffffff; return this.s / 0x7fffffff; }
  int(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; }
  pick(arr) { return arr[this.int(0, arr.length - 1)]; }
  shuffle(arr) { const a = [...arr]; for (let i = a.length-1; i > 0; i--) { const j = this.int(0, i); [a[i],a[j]] = [a[j],a[i]]; } return a; }
}

// ── Scene Generation ───────────────────────────────────────────────

const COLORS = [
  { id: 1, name: 'red' },
  { id: 3, name: 'blue' },
  { id: 6, name: 'yellow' },
  { id: 2, name: 'green' },
  { id: 5, name: 'magenta' },
  { id: 7, name: 'orange' },
];

const SHAPES = ['box', 'sphere'];

function generateObject(rng, gridSize, usedPositions) {
  const color = rng.pick(COLORS);
  const shape = rng.pick(SHAPES);
  const size = rng.int(2, 3);

  // Find non-overlapping position
  let x, z, attempts = 0;
  do {
    x = rng.int(1, gridSize - size - 1);
    z = rng.int(1, gridSize - size - 1);
    attempts++;
  } while (attempts < 50 && usedPositions.some(p =>
    Math.abs(p.x - x) < size + 2 && Math.abs(p.z - z) < size + 2
  ));

  usedPositions.push({ x, z, size });
  return { x, z, y: 1, size, color, shape };
}

function objectToVoxi(obj) {
  if (obj.shape === 'box') {
    return `B ${obj.x} ${obj.y} ${obj.z} ${obj.size} ${obj.size} ${obj.size} ${obj.color.id}`;
  } else {
    const cx = obj.x + Math.floor(obj.size/2);
    const cy = obj.y + Math.floor(obj.size/2);
    const cz = obj.z + Math.floor(obj.size/2);
    return `S ${cx} ${cy} ${cz} ${Math.floor(obj.size/2)} ${obj.color.id}`;
  }
}

// ── Question Types ─────────────────────────────────────────────────

function generateCollisionQuestion(rng, gridSize) {
  const G = gridSize;
  const usedPositions = [];

  // Object A moves right, Object B is stationary
  const colorA = rng.pick(COLORS);
  const colorB = rng.pick(COLORS.filter(c => c.id !== colorA.id));
  const size = rng.int(2, 3);

  // A starts left, moves right
  const startX_A = rng.int(1, 3);
  const z_A = rng.int(2, G - size - 2);

  // B is stationary somewhere
  const x_B = rng.int(G/2, G - size - 1);
  const z_B_options = [z_A, z_A + rng.int(3, 6)]; // same lane or different lane
  const sameLane = rng.next() > 0.5;
  const z_B = sameLane ? z_A : z_A + rng.int(4, 7);

  // Movement: A moves right in 3 steps
  const step = rng.int(2, 4);
  const positions_A = [
    { x: startX_A, frame: 0 },
    { x: startX_A + step, frame: 4 },
    { x: startX_A + step * 2, frame: 8 },
  ];

  // Check if collision happens
  const willCollide = sameLane && positions_A.some(p => {
    const aRight = p.x + size;
    return aRight > x_B && p.x < x_B + size;
  });

  // Find collision frame
  let collisionFrame = -1;
  if (sameLane) {
    for (const p of positions_A) {
      if (p.x + size > x_B && p.x < x_B + size) {
        collisionFrame = p.frame;
        break;
      }
    }
  }

  // Generate VOXI code
  const lines = [`V ${G} ${G} ${G}`, `B 0 0 0 ${G} 1 ${G} 9`, ''];
  for (const p of positions_A) {
    lines.push(`T ${p.frame}`);
    lines.push(`B ${p.x} 1 ${z_A} ${size} ${size} ${size} ${colorA.id}`);
    lines.push(`B ${x_B} 1 ${z_B} ${size} ${size} ${size} ${colorB.id}`);
  }
  const code = lines.join('\n');

  const answer = willCollide ? 'YES' : 'NO';
  const question = `The ${colorA.name} ${size}x${size}x${size} object moves rightward across the floor. The ${colorB.name} ${size}x${size}x${size} object is stationary. Do they collide at any frame?`;

  return { code, question, answer, type: 'collision', choices: ['YES', 'NO'] };
}

function generatePositionQuestion(rng, gridSize) {
  const G = gridSize;
  const numObjects = rng.int(3, 4);
  const usedPositions = [];
  const objects = [];

  for (let i = 0; i < numObjects; i++) {
    objects.push(generateObject(rng, G, usedPositions));
  }

  // Pick two random objects
  const [objA, objB] = rng.shuffle(objects).slice(0, 2);

  // Generate static scene (T=0 only)
  const lines = [`V ${G} ${G} ${G}`, `B 0 0 0 ${G} 1 ${G} 9`, '', 'T 0'];
  for (const obj of objects) {
    lines.push(objectToVoxi(obj));
  }
  const code = lines.join('\n');

  // Determine spatial relationship
  const dx = objB.x - objA.x;
  const dz = objB.z - objA.z;

  let answer;
  if (Math.abs(dx) > Math.abs(dz)) {
    answer = dx > 0 ? 'RIGHT' : 'LEFT';
  } else {
    // In our view, +Z = "behind" (farther from camera in front view)
    answer = dz > 0 ? 'BEHIND' : 'IN FRONT';
  }

  const question = `Where is the ${objB.color.name} object relative to the ${objA.color.name} object?`;
  const choices = ['LEFT', 'RIGHT', 'BEHIND', 'IN FRONT'];

  return { code, question, answer, type: 'position', choices };
}

function generateMotionDirectionQuestion(rng, gridSize) {
  const G = gridSize;
  const color = rng.pick(COLORS);
  const size = rng.int(2, 3);

  // Random start position
  const startX = rng.int(2, G - size - 4);
  const startZ = rng.int(2, G - size - 4);

  // Random direction
  const directions = [
    { name: 'RIGHT', dx: rng.int(2,4), dz: 0 },
    { name: 'LEFT', dx: -rng.int(2,4), dz: 0 },
    { name: 'AWAY', dx: 0, dz: rng.int(2,4) },   // +Z = away from camera
    { name: 'TOWARD', dx: 0, dz: -rng.int(2,4) }, // -Z = toward camera
  ];
  const dir = rng.pick(directions);

  // Ensure end position is in bounds
  const endX = Math.max(1, Math.min(G - size - 1, startX + dir.dx * 2));
  const endZ = Math.max(1, Math.min(G - size - 1, startZ + dir.dz * 2));
  const midX = Math.round((startX + endX) / 2);
  const midZ = Math.round((startZ + endZ) / 2);

  // Add a stationary object for reference
  const refColor = rng.pick(COLORS.filter(c => c.id !== color.id));
  const refX = rng.int(1, G - 4);
  const refZ = rng.int(1, G - 4);

  const lines = [
    `V ${G} ${G} ${G}`, `B 0 0 0 ${G} 1 ${G} 9`, '',
    `T 0`, `B ${startX} 1 ${startZ} ${size} ${size} ${size} ${color.id}`,
    `B ${refX} 1 ${refZ} 3 3 3 ${refColor.id}`,
    `T 5`, `B ${midX} 1 ${midZ} ${size} ${size} ${size} ${color.id}`,
    `B ${refX} 1 ${refZ} 3 3 3 ${refColor.id}`,
    `T 10`, `B ${endX} 1 ${endZ} ${size} ${size} ${size} ${color.id}`,
    `B ${refX} 1 ${refZ} 3 3 3 ${refColor.id}`,
  ];
  const code = lines.join('\n');

  const question = `The ${color.name} object moves over 10 frames. The ${refColor.name} object is stationary. In which direction does the ${color.name} object move?`;
  const choices = ['LEFT', 'RIGHT', 'TOWARD camera', 'AWAY from camera'];
  const answerMap = { LEFT: 'LEFT', RIGHT: 'RIGHT', TOWARD: 'TOWARD camera', AWAY: 'AWAY from camera' };

  return { code, question, answer: answerMap[dir.name], type: 'motion', choices };
}

function generateCountQuestion(rng, gridSize) {
  const G = gridSize;
  const numObjects = rng.int(2, 5);
  const usedPositions = [];
  const objects = [];

  for (let i = 0; i < numObjects; i++) {
    objects.push(generateObject(rng, G, usedPositions));
  }

  const lines = [`V ${G} ${G} ${G}`, `B 0 0 0 ${G} 1 ${G} 9`, '', 'T 0'];
  for (const obj of objects) {
    lines.push(objectToVoxi(obj));
  }
  const code = lines.join('\n');

  const question = `How many distinct objects are on the table (not counting the floor)?`;
  const answer = String(numObjects);
  const choices = ['2', '3', '4', '5'];

  return { code, question, answer, type: 'count', choices };
}

function generateCloserQuestion(rng, gridSize) {
  const G = gridSize;
  const usedPositions = [];
  const objA = generateObject(rng, G, usedPositions);
  const objB = generateObject(rng, G, usedPositions);

  const lines = [`V ${G} ${G} ${G}`, `B 0 0 0 ${G} 1 ${G} 9`, '', 'T 0'];
  lines.push(objectToVoxi(objA));
  lines.push(objectToVoxi(objB));
  const code = lines.join('\n');

  // Lower Z = closer to camera (front view)
  const answer = objA.z < objB.z ? objA.color.name : objB.color.name;
  const question = `Which object is closer to the camera (front view): the ${objA.color.name} or the ${objB.color.name}?`;
  const choices = [objA.color.name, objB.color.name];

  return { code, question, answer, type: 'closer', choices };
}

// ── Main ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const count = parseInt(args.find((a,i) => args[i-1] === '--count') || '30');
const seed = parseInt(args.find((a,i) => args[i-1] === '--seed') || '42');

const rng = new RNG(seed);
const G = 16; // grid size

const generators = [
  generateCollisionQuestion,
  generatePositionQuestion,
  generateMotionDirectionQuestion,
  generateCountQuestion,
  generateCloserQuestion,
];

const tasks = [];

for (let i = 0; i < count; i++) {
  const gen = rng.pick(generators);
  const task = gen(rng, G);
  task.id = i + 1;

  // Generate depth views for frames
  const { frames } = parseVoxiAnim(task.code);
  const frameNums = [...frames.keys()].sort((a, b) => a - b);

  task.depthViews = {};
  for (const fn of frameNums) {
    task.depthViews[fn] = textViewAtFrame(task.code, fn);
  }

  // Generate diffs if multiple frames
  if (frameNums.length > 1) {
    task.diffs = {};
    for (let j = 1; j < frameNums.length; j++) {
      task.diffs[`${frameNums[j-1]}_${frameNums[j]}`] = frameDiff(task.code, frameNums[j-1], frameNums[j]);
    }
  }

  tasks.push(task);
}

// Output as JSON for the test runner
const output = {
  benchmark: 'temporal-spatial-reasoning',
  seed,
  count: tasks.length,
  gridSize: G,
  tasks: tasks.map(t => ({
    id: t.id,
    type: t.type,
    code: t.code,
    question: t.question,
    choices: t.choices,
    answer: t.answer,
    depthViews: t.depthViews,
    diffs: t.diffs || null,
  })),
};

console.log(JSON.stringify(output, null, 2));
