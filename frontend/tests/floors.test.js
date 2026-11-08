import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { modelNameFor, orderFloorFiles } from '../src/lib/floorFiles.js'
import { computeBounds, elementFloor, floorBase, floorCount, validateWalls, WALL_HEIGHT } from '../src/lib/geometry.js'
import { computeRoofPlan, roofTopHeight } from '../src/lib/roof.js'
import { cutRange } from '../src/lib/sections.js'
import { buildWalkWorld, placementAt, suggestSpawn } from '../src/lib/walkthrough.js'

const house = JSON.parse(readFileSync(new URL('../../sample_output/house1_2floors.walls.json', import.meta.url)))
const apartment = JSON.parse(readFileSync(new URL('../../sample_output/apartment_furnished_preview.walls.json', import.meta.url)))
const wall = extra => ({ type: 'wall', x: 1, z: 1, width: 2, depth: 0.2, rotation: 0, ...extra })

test('a missing floor is the ground floor, and floors stack by wall height', () => {
  assert.equal(elementFloor(wall()), 0)
  assert.equal(floorCount([wall()]), 1)
  assert.equal(floorCount([wall(), wall({ floor: 2 })]), 3)
  assert.equal(floorBase(2), 2 * WALL_HEIGHT)
})

test('floors must be non-negative whole numbers', () => {
  assert.ok(validateWalls([wall({ floor: 1 })]))
  for (const floor of [-1, 1.5, '1', null]) assert.throws(() => validateWalls([wall({ floor })]), /invalid/)
})

test('the saved two-floor house is valid and has two floors', () => {
  assert.ok(validateWalls(house))
  assert.equal(floorCount(house), 2)
  assert.equal(floorCount(apartment), 1)
})

test('the roof sits on the top floor and only covers that floor', () => {
  const plan = computeRoofPlan(house)
  assert.equal(plan.base, 2 * WALL_HEIGHT)
  assert.ok(roofTopHeight(plan, 'flat') > 2 * WALL_HEIGHT)
  assert.ok(roofTopHeight(plan, 'gable') > roofTopHeight(plan, 'flat'))
  assert.equal(computeRoofPlan(apartment).base, WALL_HEIGHT)
  assert.deepEqual(computeRoofPlan([]).rects, [])
})

test('the cut height can reach any floor, or stay within one', () => {
  const bounds = computeBounds(house)
  assert.deepEqual(cutRange(bounds, 'y', null, 7), { min: 0.1, max: 7 })
  assert.deepEqual(cutRange(bounds, 'y', null, 2 * WALL_HEIGHT, WALL_HEIGHT + 0.1), { min: WALL_HEIGHT + 0.1, max: 2 * WALL_HEIGHT })
})

test('walking only collides with the floor you are on', () => {
  const elements = [wall({ width: 10 }), wall({ z: 9, width: 10 }), wall({ floor: 1, z: 5, width: 10 })]
  const bounds = computeBounds(elements)
  const upperWall = { x: 1 - bounds.cx, z: 5 - bounds.cz }
  assert.equal(placementAt(upperWall, buildWalkWorld(elements, bounds, { floor: 0 })).valid, true)
  assert.equal(placementAt(upperWall, buildWalkWorld(elements, bounds, { floor: 1 })).valid, false)
  assert.equal(buildWalkWorld(elements, bounds, { floor: 1 }).floorY, WALL_HEIGHT)
})

test('starting in the middle always finds clear floor, on every floor of the house', () => {
  const bounds = computeBounds(house)
  for (const floor of [0, 1]) {
    const world = buildWalkWorld(house, bounds, { floor })
    assert.equal(placementAt(suggestSpawn(world), world).valid, true)
  }
  const apartmentBounds = computeBounds(apartment)
  const world = buildWalkWorld(apartment, apartmentBounds)
  assert.equal(placementAt(suggestSpawn(world), world).valid, true)
})

test('floor images are read in file-name order, and at most five', () => {
  const files = ['floor10.png', 'floor2.png', 'Floor1.png'].map(name => ({ name }))
  assert.deepEqual(orderFloorFiles(files).map(file => file.name), ['Floor1.png', 'floor2.png', 'floor10.png'])
  assert.throws(() => orderFloorFiles(Array.from({ length: 6 }, (_, i) => ({ name: `${i}.png` }))), /up to 5/)
  assert.equal(modelNameFor([{ name: 'a.png' }]), 'a.png')
  assert.equal(modelNameFor([{ name: 'a.png' }, { name: 'b.png' }]), 'a.png and 1 more')
})
