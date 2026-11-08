import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { buildEvacuationBuilding, planEscape } from '../src/lib/evacuation.js'
import { furnitureRect } from '../src/lib/furniture.js'
import { computeBounds, elementFloor, isEnclosure, isFurniture, isStairs, stairRect } from '../src/lib/geometry.js'
import { rectOverlap, settleFurniture } from '../src/lib/settleFurniture.js'
import { buildWalkBuilding, placementAt } from '../src/lib/walkthrough.js'

const sample = name => JSON.parse(readFileSync(new URL(`../../sample_output/${name}.walls.json`, import.meta.url)))
const SAMPLES = ['house1_2floors', 'apartment_furnished_preview']
const WALL = { type: 'wall', floor: 0, depth: 0.2 }
const room = (width, depth) => [
  { ...WALL, x: width / 2, z: 0, width, rotation: 0 },
  { ...WALL, x: width / 2, z: depth, width, rotation: 0 },
  { ...WALL, x: 0, z: depth / 2, width: depth, rotation: Math.PI / 2 },
  { ...WALL, x: width, z: depth / 2, width: depth, rotation: Math.PI / 2 },
]
const deepest = (item, others) => Math.max(0, ...others.map(other => rectOverlap(furnitureRect(item), other)?.depth ?? 0))

for (const name of SAMPLES) {
  test(`${name}: no furniture stands in a wall, window, door or stairwell`, () => {
    const settled = settleFurniture(sample(name))
    for (const item of settled.filter(isFurniture)) {
      const floor = elementFloor(item)
      const solid = [...settled.filter(element => isEnclosure(element) && elementFloor(element) === floor),
        ...settled.filter(element => isStairs(element) && [floor, floor - 1].includes(elementFloor(element))).map(stairRect)]
      assert.ok(deepest(item, solid) < 0.003, `${item.type} at ${item.x.toFixed(2)}, ${item.z.toFixed(2)} is ${deepest(item, solid).toFixed(3)} m in`)
    }
  })

  test(`${name}: pieces clear each other, apart from chairs tucked under tables`, () => {
    const items = settleFurniture(sample(name)).filter(isFurniture)
    items.forEach((a, i) => items.slice(i + 1).forEach(b => {
      if (elementFloor(a) !== elementFloor(b)) return
      const tucked = [a.type, b.type].includes('chair') && [a.type, b.type].includes('table')
      const depth = rectOverlap(furnitureRect(a), furnitureRect(b))?.depth ?? 0
      assert.ok(depth <= (tucked ? 0.31 : 0.01), `${a.type} and ${b.type} overlap by ${depth.toFixed(3)} m`)
    }))
  })

  test(`${name}: pieces stay in the room they were placed in, and every other element is untouched`, () => {
    const raw = sample(name)
    const settled = settleFurniture(raw)
    raw.forEach((element, index) => {
      if (!isFurniture(element)) { assert.equal(settled[index], element); return }
      const moved = Math.hypot(settled[index].x - element.x, settled[index].z - element.z)
      assert.ok(moved < 1.2, `${element.type} moved ${moved.toFixed(2)} m`)
    })
    const bounds = computeBounds(raw.filter(isEnclosure))
    for (const item of settled.filter(isFurniture)) {
      assert.ok(item.x > bounds.minX && item.x < bounds.maxX && item.z > bounds.minZ && item.z < bounds.maxZ)
    }
  })

  test(`${name}: settling twice changes nothing, and a settled plan still walks and escapes`, () => {
    const once = settleFurniture(sample(name))
    const twice = settleFurniture(once)
    once.forEach((element, index) => {
      assert.ok(Math.abs(element.x - twice[index].x) < 0.03 && Math.abs(element.z - twice[index].z) < 0.03, element.type)
    })
    const building = buildEvacuationBuilding(once)
    const rooms = building.maps[0].rooms
    const plan = planEscape(building, { ...rooms[0].center, floor: 0 }, { ...rooms.at(-1).center, floor: 0 })
    assert.ok(['route', 'window'].includes(plan.status), plan.status)
    assert.ok(buildWalkBuilding(once, computeBounds(once)).floors.length >= 1)
  })
}

test('a piece halfway through a wall moves to the side its middle is on', () => {
  const walls = room(5, 5)
  const bed = { type: 'bed', floor: 0, x: 0.5, z: 2.5, rotation: Math.PI / 2 }
  const settled = settleFurniture([...walls, bed]).at(-1)
  assert.ok(settled.x > 1, `${settled.x}`)
  assert.equal(settled.z, 2.5)
  assert.equal(settled.fitWidth, undefined)
})

test('a piece too big for its room is trimmed to fit, and no further than it has to be', () => {
  const walls = room(1.4, 5)
  const bed = { type: 'bed', floor: 0, x: 0.7, z: 2.5, rotation: 0 }
  const settled = settleFurniture([...walls, bed]).at(-1)
  assert.ok(settled.fitWidth < 1 && settled.fitWidth >= 0.7)
  assert.equal(settled.fitDepth, undefined)
  assert.ok(deepest(settled, walls) < 0.003)
})

test('the landing at each end of a flight stays clear', () => {
  const stair = { type: 'stairs', floor: 0, x: 3, z: 3, width: 3, depth: 1, rotation: 0 }
  const walls = room(6, 8)
  const cabinet = { type: 'cabinet', floor: 0, x: 3, z: 1.2, rotation: 0 }
  const settled = settleFurniture([...walls, { ...walls[0], floor: 1 }, stair, cabinet]).at(-1)
  assert.ok(settled.z + 0.3 < 3 - 1.5 - 0.7 + 0.1 || Math.abs(settled.x - 3) > 1, `${settled.x}, ${settled.z}`)
})

test('a plan with no furniture comes back as it was', () => {
  const walls = room(4, 4)
  assert.equal(settleFurniture(walls), walls)
})

test('a settled placement is still valid in walking, because the rectangle follows the trim', () => {
  const walls = room(1.4, 5)
  const bed = settleFurniture([...walls, { type: 'bed', floor: 0, x: 0.7, z: 2.5, rotation: 0 }]).at(-1)
  const bounds = computeBounds(walls)
  const world = buildWalkBuilding([...walls, bed], bounds).floors[0]
  assert.equal(placementAt({ x: bed.x - bounds.cx, z: bed.z - bounds.cz }, world).valid, false)
})
