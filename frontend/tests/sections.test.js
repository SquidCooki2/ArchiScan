import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeBounds, WALL_HEIGHT } from '../src/lib/geometry.js'
import { capPositions, centralArea, createSection, cutCoordinate, cutPlane, cutRange, defaultCutPosition, elementParts, partitionFootprint, polygonArea, prismPositions, sectionCap, wallFootprint } from '../src/lib/sections.js'

const wall = { x: 8, z: 12, width: 8, depth: 2, rotation: 0 }
const bounds = computeBounds([wall])
const footprint = wallFootprint(wall, bounds)
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`)

test('section ranges and defaults produce visible interior cuts across all three axes', () => {
  assert.equal(createSection().enabled, false)
  assert.equal(defaultCutPosition(bounds, 'y'), 1.2)
  assert.equal(defaultCutPosition(bounds, 'x'), 4)
  assert.equal(defaultCutPosition(bounds, 'z'), 1)
  assert.deepEqual(cutRange(bounds, 'y'), { min: 0.1, max: WALL_HEIGHT })
  assert.deepEqual(cutRange(bounds, 'x'), { min: 0, max: 8 })
  assert.equal(cutCoordinate(bounds, { axis: 'x', position: 4 }), 0)
})

test('all cut planes retain the requested side, including reversed cuts', () => {
  for (const axis of ['x', 'y', 'z']) for (const flipped of [false, true]) {
    const section = { axis, position: defaultCutPosition(bounds, axis), flipped }
    const coordinate = cutCoordinate(bounds, section)
    const plane = cutPlane(bounds, section)
    assert.ok(plane.normal[axis] * (coordinate + (flipped ? 0.05 : -0.05)) + plane.constant > 0)
    assert.ok(plane.normal[axis] * (coordinate + (flipped ? -0.05 : 0.05)) + plane.constant < 0)
  }
})

test('rotated footprints preserve image-down orientation and exact wall area', () => {
  const points = wallFootprint({ ...wall, rotation: Math.PI / 4 }, bounds)
  close(polygonArea(points), wall.width * wall.depth)
  assert.ok(points[1].x > points[0].x && points[1].z > points[0].z)
  close(points.reduce((sum, p) => sum + p.x, 0), 0)
  close(points.reduce((sum, p) => sum + p.z, 0), 0)
})

test('area selection partitions a crossing wall instead of cutting the whole segment', () => {
  const area = { minX: -1, maxX: 1, minZ: -0.5, maxZ: 0.5 }
  const parts = partitionFootprint(footprint, area)
  const inside = parts.filter(part => part.inside)
  close(inside.reduce((sum, part) => sum + polygonArea(part.points), 0), 2)
  close(parts.filter(part => !part.inside).reduce((sum, part) => sum + polygonArea(part.points), 0), 14)
  for (const part of inside) for (const p of part.points) assert.ok(p.x >= area.minX && p.x <= area.maxX && p.z >= area.minZ && p.z <= area.maxZ)
})

test('area partitions conserve footprint area for rotated walls and arbitrary rectangles', () => {
  for (let i = 0; i < 60; i++) {
    const polygon = wallFootprint({ ...wall, rotation: i * Math.PI / 61 }, bounds)
    const area = { minX: -3 + i / 30, maxX: 1 + i / 45, minZ: -2 + i / 70, maxZ: 0.5 + i / 50 }
    const parts = partitionFootprint(polygon, area)
    close(parts.reduce((sum, part) => sum + polygonArea(part.points), 0), polygonArea(polygon))
    assert.ok(parts.every(part => part.points.length >= 3 && polygonArea(part.points) > 0))
  }
})

test('missing and disjoint areas leave walls intact; enclosing areas target the full wall', () => {
  assert.deepEqual(partitionFootprint(footprint, null), [{ points: footprint, inside: false }])
  const disjoint = partitionFootprint(footprint, { minX: 10, maxX: 11, minZ: 10, maxZ: 11 })
  assert.ok(disjoint.every(part => !part.inside))
  close(disjoint.reduce((sum, part) => sum + polygonArea(part.points), 0), 16)
  const enclosing = partitionFootprint(footprint, { minX: -10, maxX: 10, minZ: -10, maxZ: 10 })
  assert.equal(enclosing.length, 1)
  assert.equal(enclosing[0].inside, true)
})

test('closed prism triangles have outward winding and preserve the wall volume', () => {
  const positions = prismPositions(footprint)
  let volume = 0
  for (let i = 0; i < positions.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = positions.slice(i, i + 9)
    volume += (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6
  }
  close(volume, 16 * WALL_HEIGHT)
  assert.ok(positions.every(Number.isFinite))
})

test('solid caps are generated on the requested horizontal or vertical plane', () => {
  for (const axis of ['x', 'y', 'z']) {
    const section = { axis, position: defaultCutPosition(bounds, axis) }
    const cap = sectionCap(footprint, bounds, section)
    assert.equal(cap.length, 4)
    const coordinateIndex = { x: 0, y: 1, z: 2 }[axis]
    for (const vertex of cap) close(vertex[coordinateIndex], cutCoordinate(bounds, section))
    assert.equal(capPositions(cap).length, 18)
  }
  assert.deepEqual(sectionCap(footprint, bounds, { axis: 'x', position: 0 }), [])
  assert.deepEqual(sectionCap(footprint, bounds, { axis: 'y', position: WALL_HEIGHT }), [])
})

test('vertical caps through diagonal and area-partitioned walls stay inside their footprints', () => {
  const diagonal = wallFootprint({ ...wall, rotation: Math.PI / 4 }, bounds)
  const cap = sectionCap(diagonal, bounds, { axis: 'x', position: 4 })
  assert.equal(cap.length, 4)
  cap.forEach(vertex => { close(vertex[0], 0); assert.ok(Math.abs(vertex[2]) <= Math.SQRT2 + 1e-8) })
  const area = centralArea(bounds)
  for (const part of partitionFootprint(footprint, area).filter(part => part.inside)) {
    for (const [x, y, z] of sectionCap(part.points, bounds, { axis: 'y', position: 1.2 })) {
      assert.ok(x >= area.minX && x <= area.maxX && z >= area.minZ && z <= area.maxZ)
      assert.equal(y, 1.2)
    }
  }
})

test('a new model requires a user-drawn area instead of defaulting to a global cut', () => {
  assert.deepEqual(createSection(), { enabled: false, axis: 'y', position: WALL_HEIGHT, flipped: false, scope: 'area' })
})

test('3D corner drawing works in either direction and stays inside the model', async () => {
  const { selectionRectangle, validSelection } = await import('../src/lib/sections.js')
  assert.deepEqual(selectionRectangle({ x: 3, z: 0.8 }, { x: -2, z: -0.7 }, bounds), { minX: -2, maxX: 3, minZ: -0.7, maxZ: 0.8 })
  assert.deepEqual(selectionRectangle({ x: -100, z: -100 }, { x: 100, z: 100 }, bounds), { minX: -4, maxX: 4, minZ: -1, maxZ: 1 })
  assert.equal(validSelection({ minX: 0, maxX: 0, minZ: 0, maxZ: 1 }), false)
  assert.equal(validSelection({ minX: 0, maxX: 1, minZ: 0, maxZ: 1 }), true)
})

test('moving the selection preserves its dimensions and clamps at every model boundary', async () => {
  const { moveSelection } = await import('../src/lib/sections.js')
  const area = { minX: -1, maxX: 1, minZ: -0.5, maxZ: 0.5 }
  assert.deepEqual(moveSelection(area, 100, 100, bounds), { minX: 2, maxX: 4, minZ: 0, maxZ: 1 })
  assert.deepEqual(moveSelection(area, -100, -100, bounds), { minX: -4, maxX: -2, minZ: -1, maxZ: 0 })
  close(polygonArea(partitionFootprint(footprint, moveSelection(area, 1, 0, bounds)).find(part => part.inside).points), 2)
})

test('corner resizing holds the opposite corner and prevents inverted/zero-width regions', async () => {
  const { resizeSelection } = await import('../src/lib/sections.js')
  const area = { minX: -1, maxX: 1, minZ: -0.5, maxZ: 0.5 }
  assert.deepEqual(resizeSelection(area, ['maxX', 'maxZ'], { x: 3, z: 0.8 }, bounds), { minX: -1, maxX: 3, minZ: -0.5, maxZ: 0.8 })
  const inverted = resizeSelection(area, ['minX', 'minZ'], { x: 100, z: 100 }, bounds)
  assert.equal(inverted.maxX, area.maxX)
  assert.equal(inverted.maxZ, area.maxZ)
  close(inverted.maxX - inverted.minX, 0.05)
  close(inverted.maxZ - inverted.minZ, 0.05)
})

test('vertical cut sliders and initial planes stay inside the freely drawn region', () => {
  const area = { minX: -2.5, maxX: 1.5, minZ: -0.5, maxZ: 0.75 }
  assert.deepEqual(cutRange(bounds, 'x', area), { min: 1.5, max: 5.5 })
  assert.deepEqual(cutRange(bounds, 'z', area), { min: 0.5, max: 1.75 })
  assert.equal(defaultCutPosition(bounds, 'x', area), 3.5)
  assert.equal(defaultCutPosition(bounds, 'z', area), 1.125)
  assert.deepEqual(cutRange(bounds, 'y', area), { min: 0.1, max: WALL_HEIGHT })
})

test('windows and doors stack into a sill, an opening, and a lintel that fill the wall height', () => {
  const stack = element => elementParts(element).map(({ kind, base, top }) => [kind, base, top])
  assert.deepEqual(stack({ depth: 0.2 }), [['wall', 0, WALL_HEIGHT]])
  assert.deepEqual(stack({ type: 'window', depth: 0.2 }), [['wall', 0, 0.9], ['glass', 0.9, 2.1], ['wall', 2.1, WALL_HEIGHT]])
  assert.deepEqual(stack({ type: 'door', depth: 0.2 }), [['door', 0, 2.1], ['wall', 2.1, WALL_HEIGHT]])
  assert.deepEqual(stack({ type: 'door', depth: 0.2, height: 9 }), [['door', 0, WALL_HEIGHT]])
})

test('caps follow the stacked part they cut, and cut heights can reach the roof', () => {
  const section = { axis: 'y', position: 1.2 }
  assert.equal(sectionCap(footprint, bounds, section, 2.1, WALL_HEIGHT).length, 0)
  assert.equal(sectionCap(footprint, bounds, section, 0.9, 2.1).length, 4)
  assert.ok(sectionCap(footprint, bounds, { axis: 'x', position: 4 }, 2.1, WALL_HEIGHT).every(point => point[1] >= 2.1))
  assert.deepEqual(cutRange(bounds, 'y', null, 5), { min: 0.1, max: 5 })
})
