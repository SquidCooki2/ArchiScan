import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { buildEvacuationMap, computeFireField, HAZARD_RADIUS, pathLength, planEvacuation, roomAt, samplePath, snapToFloor } from '../src/lib/evacuation.js'

const apartment = JSON.parse(readFileSync(new URL('../../sample_output/apartment_furnished_preview.walls.json', import.meta.url)))
const map = buildEvacuationMap(apartment)
// Places in the saved apartment, by what the original drawing labels them.
const KITCHEN = { x: 9.4, z: 1.6 }
const LIVING = { x: 2.5, z: 2 }
const BEDROOM_1 = { x: 2.2, z: 6 }
const BEDROOM_2 = { x: 9, z: 6 }
const BATH = { x: 6.2, z: 6 }
const OUTSIDE_DOOR = { x: 5.337, z: 0.108 }

/** Every point of a route must stand on walkable floor; no crossing walls or windows. */
function assertWalkable(points) {
  for (const sample of samplePath(points, 0.05, 0)) {
    const i = Math.floor((sample.x - map.originX) / map.cell), j = Math.floor((sample.z - map.originZ) / map.cell)
    const k = j * map.nx + i
    assert.ok(map.clearance[k] > 0.05, `route enters a wall at ${sample.x.toFixed(2)}, ${sample.z.toFixed(2)}`)
  }
}

test('the apartment reads as four rooms, one outside door, and six outside windows', () => {
  assert.equal(map.rooms.length, 4)
  assert.deepEqual(map.rooms.map(room => room.name), ['Room 1', 'Room 2', 'Room 3', 'Room 4'])
  assert.ok(map.rooms[0].area > 30, 'the living and kitchen space is the largest room')
  assert.equal(map.doors.length, 4)
  assert.deepEqual(map.doors.filter(door => door.exterior).map(door => door.x), [OUTSIDE_DOOR.x])
  assert.equal(map.windows.length, 6)
  assert.notEqual(roomAt(map, BEDROOM_1).id, roomAt(map, BEDROOM_2).id)
  assert.equal(roomAt(map, KITCHEN).id, roomAt(map, LIVING).id)
})

test('fire in the kitchen, person in the bedroom: out through both doors, clear of the fire', () => {
  const plan = planEvacuation(map, KITCHEN, BEDROOM_1)
  assert.equal(plan.status, 'route')
  assert.equal(plan.route.exit, 'door')
  assert.deepEqual(plan.route.crossings.map(crossing => crossing.door.exterior), [false, true])
  assert.ok(plan.route.crossings[0].door.x < 4.2, 'leaves by the bedroom door')
  assert.ok(plan.route.minFireDistance > 3, `stays ${plan.route.minFireDistance} m away`)
  assert.equal(plan.route.throughFireRoom, true)
  assert.equal(plan.steps.length, 3)
  assert.match(plan.steps[0], /close it behind you/)
  assert.match(plan.steps[1], /outside door/)
  assertWalkable(plan.route.points)
  assert.ok(plan.route.length > 4 && plan.route.length < 12, `${plan.route.length} m`)
})

test('the route ends clear of the building, not in the doorway', () => {
  const { route } = planEvacuation(map, KITCHEN, BEDROOM_1)
  const end = route.points[route.points.length - 1]
  assert.ok(end.z < -0.8, `ends at z = ${end.z}`)
  assert.ok(pathLength(route.points) > route.length)
})

test('a fire at the only outside door sends the person out of a window', () => {
  const plan = planEvacuation(map, { x: 5.3, z: 1 }, BEDROOM_1)
  assert.equal(plan.status, 'window')
  assert.equal(plan.route.exit, 'window')
  assert.deepEqual(plan.blockedExits.map(door => door.x), [OUTSIDE_DOOR.x])
  assert.match(plan.steps[0], /window/)
  assert.ok(plan.route.length < 5, 'uses the window in the same room')
  assertWalkable(plan.route.points)
})

test('a window wins over a door route that brushes past the fire, and the door becomes the backup', () => {
  const plan = planEvacuation(map, map.rooms[0].center, BEDROOM_1)
  assert.equal(plan.status, 'window')
  assert.equal(plan.backup.exit, 'door')
  assert.ok(plan.doorTooClose < 2.5)
  assert.ok(plan.route.minFireDistance > plan.doorTooClose)
  assert.equal(plan.route.throughFireRoom, false)
})

test('routes never come within the hazard radius of the fire, by walking distance', () => {
  const fire = { x: 3.7, z: 2.6 }
  const field = computeFireField(map, fire)
  const plan = planEvacuation(map, fire, BATH, field)
  assert.notEqual(plan.status, 'shelter')
  assert.ok(plan.route.minFireDistance >= HAZARD_RADIUS - 0.15, `${plan.route.minFireDistance} m`)
})

test('walls shelter what is behind them: the fire field goes around, through the doors', () => {
  const fire = { x: 1, z: 3.3 }
  const field = computeFireField(map, fire)
  const behind = snapToFloor(map, { x: 1, z: 4.4 })
  const i = Math.floor((behind.x - map.originX) / map.cell), j = Math.floor((behind.z - map.originZ) / map.cell)
  const straightLine = Math.hypot(behind.x - fire.x, behind.z - fire.z)
  assert.ok(field[j * map.nx + i] > straightLine + 3, 'the walk goes around the wall to the door')
})

test('someone next to the fire is told so and still walks away from it', () => {
  const plan = planEvacuation(map, { x: 3, z: 2 }, { x: 3.8, z: 2 })
  assert.equal(plan.nearFire, true)
  assert.notEqual(plan.status, 'shelter')
  assert.ok(plan.route.points.length > 1)
})

test('a sealed room with no window gives shelter steps instead of a route', () => {
  const box = [
    { type: 'wall', x: 2, z: 0, width: 4, depth: 0.2, rotation: 0 },
    { type: 'wall', x: 2, z: 4, width: 4, depth: 0.2, rotation: 0 },
    { type: 'wall', x: 0, z: 2, width: 4, depth: 0.2, rotation: Math.PI / 2 },
    { type: 'wall', x: 4, z: 2, width: 4, depth: 0.2, rotation: Math.PI / 2 },
  ]
  const sealed = buildEvacuationMap(box)
  const plan = planEvacuation(sealed, { x: 3, z: 3 }, { x: 1, z: 1 })
  assert.equal(plan.status, 'shelter')
  assert.equal(plan.route, null)
  assert.match(plan.steps[0], /Close the door/)
})

test('plans without typed doors still escape through gaps in the walls', () => {
  const sample = JSON.parse(readFileSync(new URL('../src/samples/sampleWalls.json', import.meta.url)))
  const open = buildEvacuationMap(sample)
  const inside = snapToFloor(open, { x: 2, z: 2 }, 2)
  const fire = snapToFloor(open, { x: 8, z: 2 }, 2)
  const plan = planEvacuation(open, fire, inside)
  assert.equal(plan.status, 'route')
  assert.equal(plan.route.exit, 'opening')
  assert.match(plan.steps[0], /opening/)
})

test('obstacles block the route but leave the rooms as they were', () => {
  // A wardrobe across the bedroom doorway, ready for the furniture work.
  const blocked = buildEvacuationMap(apartment, { obstacles: [{ x: 3.744, z: 4.3, width: 1.6, depth: 0.6, rotation: 0 }] })
  assert.equal(blocked.rooms.length, 4)
  assert.equal(planEvacuation(map, KITCHEN, BEDROOM_1).status, 'route')
  assert.equal(planEvacuation(blocked, KITCHEN, BEDROOM_1).status, 'window')
})

test('elements on other floors are ignored', () => {
  const upstairs = { type: 'wall', floor: 1, x: 5, z: 1.6, width: 8, depth: 0.2, rotation: 0 }
  const plan = planEvacuation(buildEvacuationMap([...apartment, upstairs]), KITCHEN, BEDROOM_1)
  assert.equal(plan.status, 'route')
  assert.deepEqual(plan.route.crossings.map(crossing => crossing.door.exterior), [false, true])
})

test('snapping pulls a point off a wall and rejects clicks far outside the building', () => {
  const snapped = snapToFloor(map, { x: 4.842, z: 6 })
  assert.ok(Math.abs(snapped.x - 4.842) > 0.15)
  assert.equal(snapToFloor(map, { x: -3, z: -3 }), null)
  assert.equal(snapToFloor(map, { x: 40, z: 40 }), null)
})

test('arrow samples are evenly spaced and point along the path', () => {
  const samples = samplePath([{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 2 }], 1)
  assert.deepEqual(samples.map(sample => sample.along), [0.5, 1.5, 2.5, 3.5, 4.5])
  assert.deepEqual([samples[0].dx, samples[0].dz], [1, 0])
  assert.deepEqual([samples[4].dx, samples[4].dz], [0, 1])
})
