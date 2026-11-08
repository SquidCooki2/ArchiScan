import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { computeBounds } from '../src/lib/geometry.js'
import { elementParts } from '../src/lib/elementParts.js'
import { BODY_HEIGHT, BODY_RADIUS, EYE_HEIGHT, WALK_SPEED, buildWalkWorld, humanFov, intersectsSolid, moveWithCollision, placementAt, walkingVector } from '../src/lib/walkthrough.js'

const bounds = { cx: 0, cz: 0, width: 10, depth: 10 }
const base = { x: 0, z: 0, width: 2, depth: 0.2, rotation: 0 }
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`)

test('human dimensions and walking speed remain in model meters', () => {
  assert.equal(EYE_HEIGHT, 1.65)
  assert.ok(EYE_HEIGHT < BODY_HEIGHT)
  assert.equal(BODY_RADIUS, 0.2)
  assert.equal(WALK_SPEED, 1.4)
})

test('a moderate perspective is maintained in landscape and capped on portrait displays', () => {
  const aspect = 16 / 9, vertical = humanFov(aspect)
  close(2 * Math.atan(Math.tan(vertical * Math.PI / 360) * aspect) * 180 / Math.PI, 75)
  assert.equal(humanFov(390 / 844), 65)
})

test('placement rejects solid walls at any rotation and requires radius clearance', () => {
  for (const rotation of [0, Math.PI / 4, Math.PI / 2]) {
    const world = buildWalkWorld([{ ...base, rotation }], bounds)
    assert.equal(placementAt({ x: 0, z: 0 }, world).valid, false)
    assert.equal(placementAt({ x: 2, z: 2 }, world).valid, true)
  }
})

test('circle-box collision handles corners accurately instead of treating expanded AABBs as solid', () => {
  const world = buildWalkWorld([base], bounds)
  assert.equal(intersectsSolid({ x: 1.14, z: 0.24 }, world.colliders[0]), true)
  assert.equal(intersectsSolid({ x: 1.16, z: 0.26 }, world.colliders[0]), false)
})

test('open doors use the same swung leaf for rendering and collision while retaining their frame', () => {
  const door = { ...base, type: 'door', width: 0.9, sillHeight: 0, height: 2.1 }
  const closed = elementParts(door), open = elementParts(door, { openDoors: true })
  assert.deepEqual(open.filter(part => part.role === 'frame'), closed.filter(part => part.role === 'frame'))
  close(open.find(part => part.role === 'door').rotation, Math.PI / 2)
  assert.equal(placementAt({ x: 0, z: 0 }, buildWalkWorld([door], bounds, { openDoors: false })).valid, false)
  assert.equal(placementAt({ x: 0, z: 0 }, buildWalkWorld([door], bounds)).valid, true)
})

test('doorways must be wide and tall enough for the collision body', () => {
  const door = { ...base, type: 'door', width: 0.9, sillHeight: 0, height: 2.1 }
  assert.equal(placementAt({ x: 0, z: 0 }, buildWalkWorld([{ ...door, width: 0.4 }], bounds)).valid, false)
  assert.equal(placementAt({ x: 0, z: 0 }, buildWalkWorld([{ ...door, height: 1.6 }], bounds)).valid, false)
  assert.equal(placementAt({ x: 0, z: 0 }, buildWalkWorld([door], bounds)).valid, true)
})

test('glazing and window sill walls block walking, including floor-to-ceiling windows', () => {
  for (const sillHeight of [0, 0.9]) {
    const window = { ...base, type: 'window', sillHeight, height: 2.4 - sillHeight }
    assert.equal(placementAt({ x: 0, z: 0 }, buildWalkWorld([window], bounds)).valid, false)
  }
})

test('diagonal input is normalized and yaw changes direction without changing walking speed', () => {
  const forward = walkingVector(1, 0, 0)
  close(forward.x, 0); close(forward.z, -WALK_SPEED)
  const diagonal = walkingVector(1, 1, Math.PI / 3)
  close(Math.hypot(diagonal.x, diagonal.z), WALK_SPEED)
  const right = walkingVector(0, 1, 0)
  close(right.x, WALK_SPEED); close(right.z, 0)
})

test('large movement steps cannot tunnel through walls', () => {
  const world = buildWalkWorld([base], bounds)
  const result = moveWithCollision({ x: 0, z: -2 }, { x: 0, z: 4 }, world)
  assert.ok(result.z <= -0.3 + 1e-8)
  assert.equal(placementAt(result, world).valid, true)
})

test('walking slides along walls rather than freezing both movement axes', () => {
  const world = buildWalkWorld([{ ...base, width: 6, rotation: Math.PI / 2 }], bounds)
  const result = moveWithCollision({ x: -0.5, z: -1 }, { x: 1, z: 1 }, world)
  assert.ok(result.x <= -0.3 + 1e-8)
  close(result.z, 0)
})

test('inferred floor boundaries prevent walking out of incomplete model geometry', () => {
  const world = buildWalkWorld([], bounds)
  assert.equal(placementAt({ x: NaN, z: 0 }, world).valid, false)
  assert.equal(placementAt({ x: 5, z: 0 }, world).valid, false)
  const result = moveWithCollision({ x: 4, z: 0 }, { x: 4, z: 0 }, world)
  assert.ok(result.x <= 4.8 + 1e-8)
})

test('a person cannot be placed on a floor too small for their body', () => {
  const world = buildWalkWorld([], { ...bounds, width: 0.3, depth: 0.3 })
  assert.equal(placementAt({ x: 0, z: 0 }, world).valid, false)
})

test('rotated open doorways remain traversable in the image-space orientation', () => {
  const door = { ...base, type: 'door', rotation: Math.PI / 2, width: 0.9, height: 2.1, sillHeight: 0 }
  const world = buildWalkWorld([door], bounds)
  assert.equal(placementAt({ x: 0, z: 0 }, world).valid, true)
  const result = moveWithCollision({ x: -1, z: 0 }, { x: 2, z: 0 }, world)
  close(result.x, 1)
})

test('all three internal doors in the dynamic backend sample have clear human-scale passages', () => {
  const elements = JSON.parse(readFileSync(new URL('../../sample_output/apartment_furnished_preview.walls.json', import.meta.url)))
  const modelBounds = computeBounds(elements), world = buildWalkWorld(elements, modelBounds)
  const doors = elements.filter(element => element.type === 'door' && element.z > 1)
  assert.equal(doors.length, 3)
  for (const door of doors) {
    const point = { x: door.x - modelBounds.cx, z: door.z - modelBounds.cz }
    assert.equal(placementAt(point, world).valid, true)
    const result = moveWithCollision({ x: point.x, z: point.z - 0.4 }, { x: 0, z: 0.8 }, world)
    close(result.z, point.z + 0.4)
  }
})
