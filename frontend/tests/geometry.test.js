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

test('asymmetric sample has a ten-by-eight-meter L footprint with its missing corner at bottom right', () => {
  const sample = JSON.parse(readFileSync(new URL('../src/samples/sampleWalls.json', import.meta.url)))
  validateWalls(sample)
  const bounds = computeBounds(sample)
  assert.ok(Math.abs(bounds.minX) < 0.001)
  assert.ok(Math.abs(bounds.minZ) < 0.001)
  assert.ok(Math.abs(bounds.maxX - 10) < 0.001)
  assert.ok(Math.abs(bounds.maxZ - 8) < 0.001)
  // Rotation -PI/2 maps local +X to world +Z, preserving image-down orientation.
  const wall = sample[4]
  const endpoint = [wall.x + Math.cos(-wall.rotation) * wall.width / 2, wall.z - Math.sin(-wall.rotation) * wall.width / 2]
  assert.ok(Math.abs(endpoint[0] - 6.1) < 0.001)
  assert.ok(Math.abs(endpoint[1] - 8) < 0.001)
})

test('incoming diagonal wall points down and right in image coordinates', () => {
  const sample = JSON.parse(readFileSync(new URL('../src/samples/sampleWalls.json', import.meta.url)))
  const diagonal = sample[1]
  const dx = Math.cos(-diagonal.rotation) * diagonal.width / 2
  const dz = -Math.sin(-diagonal.rotation) * diagonal.width / 2
  assert.ok(dx > 0 && dz > 0)
  assert.ok(Math.abs(dx - 0.45) < 0.001 && Math.abs(dz - 0.45) < 0.001)
})

test('bad server geometry is rejected before reaching the renderer', () => {
  const wall = { x: 0, z: 0, width: 4, depth: 0.2, rotation: 0 }
  for (const payload of [null, {}, [], [null], [{ ...wall, x: '0' }], [{ ...wall, width: -1 }], [{ ...wall, depth: 0 }], [{ ...wall, rotation: Math.PI }], [{ ...wall, z: Infinity }]]) {
    assert.throws(() => validateWalls(payload))
  }
  assert.deepEqual(validateWalls([wall]), [wall])
})

test('saved backend apartment output renders unchanged, including rounded vertical rotations', () => {
  const walls = JSON.parse(readFileSync(new URL('../../sample_output/apartment_furnished_preview.walls.json', import.meta.url)))
  assert.equal(validateWalls(walls), walls)
  assert.equal(walls.length, 17)
  assert.ok(walls.some(wall => wall.rotation === 1.571))
  const bounds = computeBounds(walls)
  assert.ok(Math.abs(bounds.width - 11.96) < 0.003)
  assert.ok(Math.abs(bounds.depth - 9.62) < 0.003)
  assert.ok(Object.values(bounds).every(Number.isFinite))
})

test('empty scene bounds are finite before the first upload', () => {
  assert.ok(Object.values(computeBounds([])).every(Number.isFinite))
})
