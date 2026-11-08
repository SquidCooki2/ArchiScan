import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { computeBounds, validateWalls } from '../src/lib/geometry.js'

test('camera bounds include the thickness of diagonal and vertical walls', () => {
  const diagonal = computeBounds([{ x: 2, z: 3, width: 4, depth: 2, rotation: Math.PI / 4 }])
  assert.ok(Math.abs(diagonal.width - 3 * Math.SQRT2) < 1e-10)
  assert.equal(diagonal.cx, 2)
  assert.equal(diagonal.cz, 3)
  const vertical = computeBounds([{ x: 10, z: 20, width: 8, depth: 0.2, rotation: Math.PI / 2 }])
  assert.ok(Math.abs(vertical.width - 0.2) < 1e-10)
  assert.equal(vertical.depth, 8)
})

test('asymmetric sample has an eight-meter L footprint with its missing corner at bottom right', () => {
  const sample = JSON.parse(readFileSync(new URL('../src/samples/sampleWalls.json', import.meta.url)))
  validateWalls(sample)
  const bounds = computeBounds(sample)
  assert.ok(Math.abs(bounds.minX) < 1e-10)
  assert.ok(Math.abs(bounds.minZ) < 1e-10)
  assert.ok(Math.abs(bounds.maxX - 8) < 1e-10)
  assert.ok(Math.abs(bounds.maxZ - 8) < 1e-10)
  // Rotation -PI/2 maps local +X to world +Z, preserving image-down orientation.
  const wall = sample[3]
  const endpoint = [wall.x + Math.cos(-wall.rotation) * wall.width / 2, wall.z - Math.sin(-wall.rotation) * wall.width / 2]
  assert.ok(Math.abs(endpoint[0] - 4.1) < 1e-10)
  assert.ok(Math.abs(endpoint[1] - 7.9) < 1e-10)
})

test('bad server geometry is rejected before reaching the renderer', () => {
  const wall = { x: 0, z: 0, width: 4, depth: 0.2, rotation: 0 }
  for (const payload of [null, {}, [], [null], [{ ...wall, x: '0' }], [{ ...wall, width: -1 }], [{ ...wall, depth: 0 }], [{ ...wall, rotation: Math.PI }], [{ ...wall, z: Infinity }]]) {
    assert.throws(() => validateWalls(payload))
  }
  assert.deepEqual(validateWalls([wall]), [wall])
})

test('empty scene bounds are finite before the first upload', () => {
  assert.ok(Object.values(computeBounds([])).every(Number.isFinite))
})
