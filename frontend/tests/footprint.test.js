import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { floorOutlines, pointInLoop } from '../src/lib/footprint.js'

const THICK = 0.2
const wall = (x1, z1, x2, z2) => {
  const horizontal = z1 === z2
  return { type: 'wall', x: (x1 + x2) / 2, z: (z1 + z2) / 2, width: Math.abs(horizontal ? x2 - x1 : z2 - z1) + THICK, depth: THICK, rotation: horizontal ? 0 : Math.PI / 2 }
}
/** Walls along a closed path of wall center lines. */
const ring = points => points.map((point, index) => wall(...point, ...points[(index + 1) % points.length]))
// An L: 10 m by 8 m with the corner from (5, 4) to (10, 8) missing.
const L_SHAPE = ring([[0, 0], [10, 0], [10, 4], [5, 4], [5, 8], [0, 8]])
const indoors = (outlines, point) => outlines.some(({ outer, holes }) => pointInLoop(point, outer) && !holes.some(hole => pointInLoop(point, hole)))
const area = loop => Math.abs(loop.reduce((sum, [x, z], index) => {
  const [nextX, nextZ] = loop[(index + 1) % loop.length]
  return sum + x * nextZ - nextX * z
}, 0) / 2)

test('the floor of an L-shaped house leaves out the missing corner', () => {
  const outlines = floorOutlines(L_SHAPE)
  assert.equal(outlines.length, 1)
  assert.ok(indoors(outlines, [2, 2]), 'first wing')
  assert.ok(indoors(outlines, [8, 2]), 'second wing')
  assert.ok(indoors(outlines, [2, 6]), 'third wing')
  assert.ok(!indoors(outlines, [7.5, 6]), 'the corner is outdoors')
  assert.ok(!indoors(outlines, [12, 2]), 'past the walls is outdoors')
  assert.equal(outlines[0].outer.length, 6, 'one point per corner of the L, not one per grid cell')
})

test('the floor’s edge lands inside the walls, never past them or short of them', () => {
  const [{ outer }] = floorOutlines(L_SHAPE)
  const xs = outer.map(([x]) => x), zs = outer.map(([, z]) => z)
  const outerFace = THICK / 2
  assert.ok(Math.min(...xs) > -outerFace && Math.min(...xs) < outerFace, `left edge ${Math.min(...xs)}`)
  assert.ok(Math.max(...xs) < 10 + outerFace && Math.max(...xs) > 10 - outerFace, `right edge ${Math.max(...xs)}`)
  assert.ok(Math.min(...zs) > -outerFace && Math.min(...zs) < outerFace, `top edge ${Math.min(...zs)}`)
  assert.ok(Math.max(...zs) < 8 + outerFace && Math.max(...zs) > 8 - outerFace, `bottom edge ${Math.max(...zs)}`)
  // Along the notch, the same walls from the other side.
  assert.ok(xs.some(x => x > 5 - outerFace && x < 5 + outerFace), 'the notch’s side wall')
  assert.ok(zs.some(z => z > 4 - outerFace && z < 4 + outerFace), 'the notch’s back wall')
})

test('a plain rectangular house still gets a plain rectangular floor', () => {
  const outlines = floorOutlines(ring([[0, 0], [10, 0], [10, 8], [0, 8]]))
  assert.equal(outlines.length, 1)
  assert.equal(outlines[0].outer.length, 4)
  assert.ok(Math.abs(area(outlines[0].outer) - 80) < 2, `area ${area(outlines[0].outer)}`)
})

test('a plan drawn at an angle gets the same floor, turned with it', () => {
  const angle = 0.5, cos = Math.cos(angle), sin = Math.sin(angle)
  const turn = ([x, z]) => [x * cos - z * sin, x * sin + z * cos]
  const turned = L_SHAPE.map(element => {
    const [x, z] = turn([element.x, element.z])
    const rotation = element.rotation + angle
    return { ...element, x, z, rotation: rotation >= Math.PI ? rotation - Math.PI : rotation }
  })
  const outlines = floorOutlines(turned)
  assert.ok(indoors(outlines, turn([2, 2])))
  assert.ok(indoors(outlines, turn([8, 2])))
  assert.ok(!indoors(outlines, turn([7.5, 6])))
  assert.equal(outlines[0].outer.length, 6)
})

test('two separate buildings on one floor get a floor each', () => {
  const outlines = floorOutlines([...ring([[0, 0], [5, 0], [5, 5], [0, 5]]), ...ring([[12, 0], [17, 0], [17, 5], [12, 5]])])
  assert.equal(outlines.length, 2)
  assert.ok(indoors(outlines, [2, 2]) && indoors(outlines, [14, 2]))
  assert.ok(!indoors(outlines, [8.5, 2]))
})

test('walls that don’t close give no outline, so the caller can fall back', () => {
  assert.equal(floorOutlines([wall(0, 0, 10, 0), wall(0, 8, 10, 8)]), null)
  assert.equal(floorOutlines([]), null)
  assert.equal(floorOutlines([{ type: 'stairs', x: 1, z: 1, width: 3, depth: 1, rotation: 0 }]), null)
})

test('a stairwell inside the floor stays an exact opening in it', () => {
  const well = [[2, 2], [4, 2], [4, 3], [2, 3]]
  const outlines = floorOutlines(L_SHAPE, [well])
  assert.deepEqual(outlines[0].holes, [well])
  assert.ok(!indoors(outlines, [3, 2.5]))
  assert.ok(indoors(outlines, [1, 2.5]))
})

test('a stairwell running past the walls becomes a notch, since a hole can’t cross its own edge', () => {
  const outlines = floorOutlines(L_SHAPE, [[[-1, 2], [2, 2], [2, 3], [-1, 3]]])
  assert.deepEqual(outlines[0].holes, [])
  assert.ok(!indoors(outlines, [1, 2.5]), 'open where the flight comes up')
  assert.ok(indoors(outlines, [1, 4]), 'floor beside it')
})

test('every floor of both samples gets a usable outline that keeps its rooms', () => {
  for (const name of ['house1_2floors', 'apartment_furnished_preview']) {
    const elements = JSON.parse(readFileSync(new URL(`../../sample_output/${name}.walls.json`, import.meta.url), 'utf8'))
    for (const floor of new Set(elements.map(element => element.floor ?? 0))) {
      const here = elements.filter(element => (element.floor ?? 0) === floor)
      const outlines = floorOutlines(here)
      assert.ok(outlines, `${name} floor ${floor}`)
      // Every piece of furniture stands indoors, so the floor must reach it.
      for (const item of here.filter(element => ['bed', 'couch', 'table', 'toilet', 'bath'].includes(element.type))) {
        assert.ok(indoors(outlines, [item.x, item.z]), `${name} floor ${floor}: ${item.type} at ${item.x}, ${item.z}`)
      }
    }
  }
})
