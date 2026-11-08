import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { elementParts, STAIR_STEPS, structuralElements } from '../src/lib/elementParts.js'
import { buildEvacuationBuilding, computeFireFields, HAZARD_RADIUS, planEscape, roomAt, samplePath } from '../src/lib/evacuation.js'
import { computeBounds, stairRect, stairwellCorners, validateWalls, WALL_HEIGHT } from '../src/lib/geometry.js'
import { buildWalkBuilding, EYE_HEIGHT, placementAt, walkHeight, walkStep } from '../src/lib/walkthrough.js'

const house = JSON.parse(readFileSync(new URL('../../sample_output/house1_2floors.walls.json', import.meta.url)))
const stair = house.find(element => element.type === 'stairs')
const close = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} is not close to ${b}`)

test('the sample house is valid, with one flight joining its two floors', () => {
  assert.equal(validateWalls(house), house)
  assert.deepEqual([stair.floor, stair.width, stair.depth], [0, 4.1, 1.1])
})

test('a rotation is the direction up the flight: 0 is +Z, a quarter turn is +X', () => {
  for (const [rotation, x, z] of [[0, 0, 1], [Math.PI / 2, 1, 0], [Math.PI, 0, -1], [Math.PI * 1.5, -1, 0]]) {
    const { rotation: local } = stairRect({ x: 0, z: 0, width: 4, depth: 1, rotation })
    close(Math.cos(local), x)
    close(Math.sin(local), z)
  }
})

test('steps climb evenly from the floor to the floor above, foot to head', () => {
  const treads = elementParts(stair).filter(part => part.role === 'wall')
  assert.equal(treads.length, STAIR_STEPS)
  close(treads.at(-1).top, WALL_HEIGHT)
  treads.forEach((tread, index) => close(tread.top, (index + 1) * WALL_HEIGHT / STAIR_STEPS))
  // This flight's rotation is pi, so it climbs toward -Z: the first step is the southernmost.
  assert.ok(treads[0].z > treads.at(-1).z)
  assert.ok(treads[0].z < stair.z + stair.width / 2 && treads.at(-1).z > stair.z - stair.width / 2)
})

test('a guard around the stairwell stands on the upper floor, open at the head of the flight', () => {
  const guards = structuralElements(house).filter(element => element.type === 'stairGuard')
  assert.equal(guards.length, 1)
  assert.equal(guards[0].floor, 1)
  const parts = elementParts(guards[0]).filter(part => part.role === 'string')
  assert.equal(parts.length, 3)
  assert.ok(parts.every(part => part.z >= stair.z - 0.01), 'nothing across the head of the flight')
  assert.equal(structuralElements(house).filter(element => ['couch', 'bed'].includes(element.type)).length, 0)
})

test('the stairwell opening matches the flight and stays inside the slab', () => {
  const upper = computeBounds(house.filter(element => element.floor === 1 && element.width))
  const corners = stairwellCorners(stair, upper, 0.04)
  const xs = corners.map(([x]) => x), zs = corners.map(([, z]) => z)
  close(Math.max(...xs) - Math.min(...xs), stair.depth, 5e-3)
  close(Math.max(...zs) - Math.min(...zs), stair.width, 5e-3)
  corners.forEach(([x, z]) => assert.ok(x > upper.minX && x < upper.maxX && z > upper.minZ && z < upper.maxZ))
  const tiny = stairwellCorners(stair, { minX: 11, maxX: 12, minZ: 5, maxZ: 7 }, 0.04)
  tiny.forEach(([x, z]) => assert.ok(x >= 11.04 && x <= 11.96 && z >= 5.04 && z <= 6.96))
})

/** Walks a straight line through the world, returning where the walker ended up. */
function walk(building, from, to, seconds = 12, speed = 1.4) {
  let position = from
  const heights = []
  for (let t = 0; t < seconds; t += 1 / 30) {
    const dx = to.x - position.x, dz = to.z - position.z, distance = Math.hypot(dx, dz)
    if (distance < 0.02) break
    const step = Math.min(distance, speed / 30)
    position = walkStep(position, { x: dx / distance * step, z: dz / distance * step }, building)
    heights.push(walkHeight(position, building))
  }
  return { position, heights }
}

const bounds = computeBounds(house)
const walking = buildWalkBuilding(house, bounds)
const local = (x, z, floor) => ({ x: x - bounds.cx, z: z - bounds.cz, floor })
// In this plan the flight lands 0.3 m from an outside wall.
const FOOT = local(stair.x, stair.z + stair.width / 2 + 0.1, 0)
const HEAD = local(stair.x, stair.z - stair.width / 2 - 0.4, 1)

test('walking up the flight changes floor at the middle and arrives at the upper floor', () => {
  assert.equal(placementAt(FOOT, walking.floors[0]).valid, true)
  assert.equal(placementAt(HEAD, walking.floors[1]).valid, true)
  assert.equal(walkHeight(FOOT, walking), 0)
  const { position, heights } = walk(walking, FOOT, HEAD)
  assert.equal(position.floor, 1)
  close(position.z, HEAD.z, 0.03)
  close(heights.at(-1), WALL_HEIGHT)
  heights.slice(1).forEach((height, index) => assert.ok(height >= heights[index] - 1e-9, 'never steps down on the way up'))
  assert.ok(heights.at(-1) + EYE_HEIGHT < WALL_HEIGHT * 2)
})

test('walking back down returns to the ground floor', () => {
  const { position, heights } = walk(walking, HEAD, FOOT)
  assert.equal(position.floor, 0)
  close(position.z, FOOT.z, 0.03)
  assert.equal(heights.at(-1), 0)
})

test('the flight only opens at its ends, and nobody falls down the well upstairs', () => {
  const beside = local(stair.x - stair.depth / 2 - 0.4, stair.z, 1)
  if (placementAt(beside, walking.floors[1]).valid) {
    const { position } = walk(walking, beside, local(stair.x, stair.z, 1), 4)
    assert.equal(position.floor, 1)
    assert.equal(walkHeight(position, walking), WALL_HEIGHT)
    assert.ok(Math.abs(position.x - (stair.x - bounds.cx)) > stair.depth / 2)
  }
  assert.equal(placementAt(local(stair.x, stair.z, 0), walking.floors[0]).valid, false)
})

test('the lowest steps are open at the side, so a flight landing against a wall can be left', () => {
  const offToTheSide = local(stair.x - stair.depth / 2 - 0.4, stair.z + stair.width / 2 - 0.3, 0)
  const { position, heights } = walk(walking, FOOT, offToTheSide, 4)
  close(position.x, offToTheSide.x, 0.03)
  assert.equal(heights.at(-1), 0)
})

test('furniture blocks walking, chairs included', () => {
  const chair = house.find(element => element.type === 'chair')
  const world = walking.floors[chair.floor]
  assert.equal(placementAt({ x: chair.x - bounds.cx, z: chair.z - bounds.cz }, world).valid, false)
})

const building = buildEvacuationBuilding(house)
const roomsOn = floor => building.maps[floor].rooms
const upstairs = { ...roomsOn(1)[0].center, floor: 1 }
const farFromStairs = floor => [...roomsOn(floor)].sort((a, b) => Math.hypot(b.center.x - stair.x, b.center.z - stair.z) - Math.hypot(a.center.x - stair.x, a.center.z - stair.z))[0]

test('rooms get one numbering across the building, and a key that names them anywhere', () => {
  const rooms = building.maps.flatMap(map => map.rooms)
  assert.deepEqual(rooms.map(room => room.name), rooms.map((_, index) => `Room ${index + 1}`))
  assert.equal(new Set(rooms.map(room => room.key)).size, rooms.length)
  assert.ok(rooms.every(room => Number.isInteger(room.key)))
  assert.equal(building.links.length, 1)
})

test('from upstairs the route goes down the flight and out, without crossing a wall', () => {
  const room = farFromStairs(0)
  const fire = { ...room.center, floor: 0 }
  const person = { ...farFromStairs(1).center, floor: 1 }
  const plan = planEscape(building, fire, person)
  assert.ok(['route', 'window'].includes(plan.status), plan.status)
  assert.equal(plan.route.flights, 1)
  assert.deepEqual(plan.stepGroups.map(group => group.floor), [1, 0])
  assert.match(plan.stepGroups[0].steps.at(-1), /Go down to Floor 1/)
  const samples = samplePath(plan.route.points, 0.05, 0)
  assert.ok(samples.length > 10)
  close(samples[0].y, WALL_HEIGHT)
  close(plan.route.points.at(-1).y, 0)
  for (let index = 1; index < samples.length; index++) assert.ok(samples[index].y <= samples[index - 1].y + 1e-9, 'never climbs')
  const onFlight = sample => Math.abs(sample.x - stair.x) < stair.depth / 2 && Math.abs(sample.z - stair.z) < stair.width / 2 + 0.01
  for (const sample of samples.filter(sample => !onFlight(sample))) {
    const map = building.maps[sample.y ? 1 : 0]
    const k = Math.floor((sample.z - map.originZ) / map.cell) * map.nx + Math.floor((sample.x - map.originX) / map.cell)
    assert.ok(map.clearance[k] > 0.05, `route enters a wall at ${sample.x.toFixed(2)}, ${sample.z.toFixed(2)} (y ${sample.y})`)
  }
  assert.equal(plan.backup?.signal, true)
  assert.equal(plan.backup.points[0].floor, 1)
})

test('with the flight on fire, someone upstairs signals from a window instead of going down', () => {
  const fire = { x: stair.x, z: stair.z + stair.width / 2 + 0.4, floor: 0 }
  const plan = planEscape(building, fire, upstairs)
  assert.equal(plan.status, 'signal')
  assert.equal(plan.stairsCutOff, true)
  assert.equal(plan.route.exit, 'window')
  assert.equal(plan.route.flights, 0)
  assert.equal(plan.route.points.at(-1).floor, 1)
  assert.match(plan.steps.at(-1), /signal for help/)
})

test('a fire upstairs reaches the ground only through the stairs, so people below get out as usual', () => {
  const fire = { ...farFromStairs(1).center, floor: 1 }
  const fields = computeFireFields(building, fire)
  const person = { ...farFromStairs(0).center, floor: 0 }
  const map = building.maps[0]
  const footField = fields[0][building.links[0].footCell]
  assert.ok(footField > stair.width, 'walking distance includes the flight')
  const plan = planEscape(building, fire, person, fields)
  assert.ok(['route', 'window'].includes(plan.status))
  assert.equal(plan.fireFloor, 1)
  assert.equal(plan.personFloor, 0)
  assert.equal(plan.fireRoom.floor, 1)
  assert.equal(roomAt(map, person).floor, 0)
  assert.ok(plan.route.minFireDistance >= HAZARD_RADIUS)
})

test('fixed furniture blocks routes, and when it blocks them all the route says it goes past it', () => {
  const room = { type: 'wall', floor: 0 }
  const walls = [
    { ...room, x: 3, z: 0, width: 6, depth: 0.2, rotation: 0 },
    { ...room, x: 3, z: 6, width: 6, depth: 0.2, rotation: 0 },
    { ...room, x: 0, z: 3, width: 6, depth: 0.2, rotation: Math.PI / 2 },
    { ...room, x: 6, z: 2, width: 4, depth: 0.2, rotation: Math.PI / 2 },
    { ...room, x: 6, z: 5.6, width: 0.8, depth: 0.2, rotation: Math.PI / 2 },
    { type: 'door', floor: 0, x: 6, z: 4.6, width: 1.2, depth: 0.2, rotation: Math.PI / 2 },
  ]
  // A wardrobe right across the only door. Rotated so it lies along the wall.
  const wardrobe = { type: 'wardrobe', floor: 0, x: 5.4, z: 4.6, rotation: Math.PI / 2 }
  const blocked = buildEvacuationBuilding([...walls, wardrobe, { ...wardrobe, z: 3.4 }, { ...wardrobe, z: 5.4 }])
  const clear = buildEvacuationBuilding(walls)
  const fire = { x: 1, z: 1, floor: 0 }, person = { x: 2.5, z: 5, floor: 0 }
  assert.equal(planEscape(clear, fire, person).status, 'route')
  assert.equal(planEscape(clear, fire, person).pastFurniture, undefined)
  const plan = planEscape(blocked, fire, person)
  assert.equal(plan.pastFurniture, true)
  assert.equal(plan.status, 'route')
})

test('a desk under a window still leaves that window as the way out', () => {
  const apartment = JSON.parse(readFileSync(new URL('../../sample_output/apartment_furnished_preview.walls.json', import.meta.url)))
  const furnished = buildEvacuationBuilding(apartment)
  const bedroom = roomAt(furnished.maps[0], { x: 2.25, z: 5.5 })
  const plan = planEscape(furnished, { ...furnished.maps[0].rooms[0].center, floor: 0 }, { ...bedroom.center, floor: 0 })
  assert.equal(plan.status, 'window')
  assert.equal(plan.route.throughFireRoom, false)
  assert.ok(plan.route.length < 3, `${plan.route.length} m`)
})

test('bad stairs and furniture are rejected before reaching the renderer', () => {
  const valid = { type: 'wall', x: 0, z: 0, width: 2, depth: 0.2, rotation: 0 }
  assert.ok(validateWalls([valid, { type: 'stairs', floor: 0, x: 1, z: 1, width: 3, depth: 1, rotation: 3.14 }]))
  assert.throws(() => validateWalls([valid, { type: 'stairs', floor: 0, x: 1, z: 1, width: 3, depth: 1, rotation: 7 }]))
  assert.throws(() => validateWalls([valid, { type: 'stairs', floor: 0, x: 1, z: 1, width: 3, rotation: 0 }]))
  assert.ok(validateWalls([valid, { type: 'bed', floor: 0, x: 1, z: 1, rotation: 6 }]))
  assert.throws(() => validateWalls([valid, { type: 'bed', floor: 0, x: 1, z: 1, rotation: -1 }]))
  assert.throws(() => validateWalls([valid, { type: 'spaceship', floor: 0, x: 1, z: 1, rotation: 0 }]))
  assert.throws(() => validateWalls([{ type: 'bed', floor: 0, x: 1, z: 1, rotation: 0 }]), 'needs walls')
})
