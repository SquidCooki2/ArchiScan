import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { buildingBounds, buildingFloors, floorElevation } from '../src/lib/floors.js'
import { countElements, validateWalls, WALL_HEIGHT } from '../src/lib/geometry.js'
import { buildWalkWorld, placementAt, EYE_HEIGHT } from '../src/lib/walkthrough.js'

const fixture = JSON.parse(readFileSync(new URL('../../sample_output/house1_2floors.walls.json', import.meta.url)))

test('authoritative two-floor house groups all 80 elements without changing the backend array', () => {
  assert.equal(validateWalls(fixture), fixture)
  const floors = buildingFloors(fixture)
  assert.deepEqual(floors.map(f => [f.id, f.walls.length, f.elevation, f.height]), [[0, 34, 0, 2.7], [1, 46, 2.7, 2.7]])
  assert.deepEqual(countElements(floors[0].walls), { wall: 22, window: 9, door: 3 })
  assert.deepEqual(countElements(floors[1].walls), { wall: 30, window: 10, door: 6 })
  assert.ok(floors.every(f => f.walls.every(e => e.floor === f.id)))
  assert.equal(buildingBounds(fixture).maxY, 5.4)
  const upper = buildingBounds(floors[1].walls)
  assert.equal(upper.minY, 2.7)
  assert.equal(upper.height, 2.7)
  assert.ok(upper.width > 8 && upper.depth > 8)
})

test('missing floor means ground; arbitrary sorted indices preserve their actual elevations and gaps', () => {
  const element = { x: 0, z: 0, width: 4, depth: 0.2, rotation: 0 }
  const elements = [element, { ...element, floor: 7 }, { ...element, floor: 2 }, { ...element, floor: 0 }]
  validateWalls(elements)
  const floors = buildingFloors(elements)
  assert.deepEqual(floors.map(f => f.id), [0, 2, 7])
  assert.equal(floors[0].walls.length, 2)
  assert.equal(floors[2].elevation, 7 * WALL_HEIGHT)
  assert.equal(buildingBounds(elements).maxY, 8 * WALL_HEIGHT)
  assert.equal(buildingFloors([element])[0].elevation, 0)
  assert.equal(floorElevation(1) + EYE_HEIGHT, 4.35)
  assert.equal(buildingFloors([]).length, 0)
  assert.ok(Object.values(buildingBounds([])).every(Number.isFinite))
})

test('malformed floor tags are rejected before rendering rather than overlapping floors', () => {
  for (const floor of [-1, 0.5, '1', null, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => validateWalls([{ ...fixture[0], floor }]), /invalid wall geometry/)
  }
})

test('walk collision worlds contain only the isolated floor, with clear spawn locations on both actual plans', () => {
  const floors = buildingFloors(fixture)
  for (const floor of floors) {
    const world = buildWalkWorld(floor.walls, floor.bounds)
    const clear = []
    for (let x = world.minX + 0.5; x < world.maxX - 0.5; x += 0.5) {
      for (let z = world.minZ + 0.5; z < world.maxZ - 0.5; z += 0.5) if (placementAt({ x, z }, world).valid) clear.push({ x, z })
    }
    assert.ok(clear.length > 20)
    assert.ok(world.colliders.length > floor.walls.length)
  }
})
