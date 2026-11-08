import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fitScale, FURNITURE, furnitureRect, routeObstacles } from '../src/lib/furniture.js'
import { FURNITURE_TYPES } from '../src/lib/geometry.js'

const asset = name => JSON.parse(readFileSync(new URL(`../public/assets/furniture/${name}.gltf`, import.meta.url)))

/** A model's raw size, from what its file declares about its vertices. */
function rawSize(name) {
  const gltf = asset(name)
  const { min, max } = gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION]
  return max.map((value, axis) => value - min[axis])
}

test('every furniture type the contract allows has a size, and either a model or a fixture', () => {
  assert.deepEqual(Object.keys(FURNITURE).sort(), [...FURNITURE_TYPES].sort())
  for (const { model, fixture } of Object.values(FURNITURE)) assert.ok(Boolean(model) !== Boolean(fixture))
})

test('raw models are around 1.5 times too large, and fit their real-world boxes exactly', () => {
  for (const [type, { model, size }] of Object.entries(FURNITURE)) {
    if (!model) continue
    const raw = rawSize(model)
    const scale = fitScale(raw, size)
    scale.forEach((factor, axis) => assert.ok(Math.abs(raw[axis] * factor - size[axis]) < 1e-6, `${type} axis ${axis}`))
    if (type !== 'wardrobe') assert.ok(scale.every(factor => factor > 0.4 && factor < 0.95), `${type}: ${scale.join(', ')}`)
  }
})

test('a piece takes up its width along the wall and its depth toward the room', () => {
  const size = FURNITURE.bed.size
  const facing = furnitureRect({ type: 'bed', x: 1, z: 2, rotation: Math.PI / 2 })
  assert.deepEqual([facing.x, facing.z, facing.width, facing.depth], [1, 2, size[0], size[2]])
  // Facing +X, the width runs along Z: a turn of a quarter from plan +X.
  assert.ok(Math.abs(Math.abs(Math.sin(facing.rotation)) - 1) < 1e-9)
})

test('routes treat fixed furniture as obstacles, on its own floor, and walk around chairs', () => {
  const items = [
    { type: 'bed', floor: 0, x: 1, z: 1, rotation: 0 },
    { type: 'chair', floor: 0, x: 3, z: 1, rotation: 0 },
    { type: 'couch', floor: 1, x: 5, z: 1, rotation: 0 },
    { type: 'wall', floor: 0, x: 0, z: 0, width: 1, depth: 0.2, rotation: 0 },
  ]
  assert.deepEqual(routeObstacles(items, 0).map(rect => rect.x), [1])
  assert.deepEqual(routeObstacles(items, 1).map(rect => rect.x), [5])
})
