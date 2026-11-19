#!/usr/bin/env node
/**
 * Test the text-view projection system.
 * Run: node test-text-view.js
 */

import { textViewFromCode } from './text-view.js';

// ── Test 1: Sphere ──
console.log('═'.repeat(60));
console.log('TEST 1: Sphere (should show circular depth in all views)');
console.log('═'.repeat(60));
console.log(textViewFromCode(`
V 16 16 16
S 8 8 8 5 7
`));

// ── Test 2: Room with objects ──
console.log('\n' + '═'.repeat(60));
console.log('TEST 2: Room with pillar and two markers');
console.log('═'.repeat(60));
console.log(textViewFromCode(`
V 16 10 16
-- Floor
B 0 0 0 16 1 16 9
-- Back wall
B 0 1 0 16 9 1 9
-- Left wall
B 0 1 0 1 9 16 9
-- Pillar
B 7 1 7 2 9 2 7
-- Camera marker (front-left)
P 3 3 12 6
-- Target marker (back-right, behind pillar)
P 12 3 3 1
`));

// ── Test 3: L-shaped object ──
console.log('\n' + '═'.repeat(60));
console.log('TEST 3: L-shape (asymmetric — tests view orientation)');
console.log('═'.repeat(60));
console.log(textViewFromCode(`
V 12 12 12
-- Vertical part of L
B 1 1 1 3 8 3 4
-- Horizontal part of L
B 1 1 1 8 3 3 4
`));

// ── Test 4: Two separated cubes ──
console.log('\n' + '═'.repeat(60));
console.log('TEST 4: Two cubes (tests depth separation)');
console.log('═'.repeat(60));
console.log(textViewFromCode(`
V 16 16 16
-- Near cube (close to front)
B 2 2 2 4 4 4 2
-- Far cube (near back)
B 10 10 10 4 4 4 1
`));
