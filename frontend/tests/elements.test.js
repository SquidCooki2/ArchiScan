import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeBounds, openingDimensions, validateWalls, WALL_HEIGHT } from '../src/lib/geometry.js'
import { elementParts } from '../src/lib/elementParts.js'
import { polygonArea, prismPositions, sectionCap, wallFootprint } from '../src/lib/sections.js'

const window = { type: 'window', x: 5, z: 7, width: 2, depth: 0.2, rotation: 0, sillHeight: 0.9, height: 1.2 }
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`)

test('typed openings validate while unknown types and malformed opening heights fail safely', () => {
  for (const extra of [{ type: 'stairs' }, { type: null }, { sillHeight: -1 }, { sillHeight: 2.7 }, { sillHeight: null }, { sillHeight: '0.9' }, { height: 0 }, { height: null }, { height: Infinity }, { height: '1.2' }]) {
    assert.throws(() => validateWalls([{ ...window, ...extra }]))
  }
  const walls = [{ x: 0, z: 0, width: 2, depth: 0.2, rotation: 0 }]
  assert.equal(validateWalls(walls), walls)
  assert.equal(validateWalls([window])[0], window)
})

test('opening defaults and height clamping match the backend contract', () => {
  assert.deepEqual(openingDimensions({ type: 'window' }), { sillHeight: 0.9, height: 1.2 })
  assert.deepEqual(openingDimensions({ type: 'door' }), { sillHeight: 0, height: 2.1 })
  const oversized = { ...window, sillHeight: 2.3, height: 5 }
  validateWalls([oversized])
  close(openingDimensions(oversized).height, 0.4)
  assert.ok(elementParts(oversized).every(part => part.top <= WALL_HEIGHT && part.bottom >= 0))
})

test('windows have an actual opening with lower/upper wall infill, frames, mullion and two thin panes', () => {
  const parts = elementParts(window)
  const infill = parts.filter(part => part.role === 'wall')
  assert.deepEqual(infill.map(part => [part.bottom, part.top]), [[0, 0.9], [2.1, 2.7]])
  const panes = parts.filter(part => part.role === 'glass')
  assert.equal(panes.length, 2)
  assert.ok(panes.every(part => part.depth <= 0.014 && part.bottom > 0.9 && part.top < 2.1))
  assert.equal(parts.filter(part => part.role === 'frame').length, 5)
  assert.ok(infill.every(part => !(part.bottom < 1.5 && part.top > 1.5)))
})

test('custom window sill and height control geometry rather than hardcoded defaults', () => {
  const parts = elementParts({ ...window, sillHeight: 1.1, height: 0.8 })
  const infill = parts.filter(part => part.role === 'wall')
  close(infill[0].top, 1.1)
  close(infill[1].bottom, 1.9)
  assert.ok(parts.filter(part => part.role === 'glass').every(part => part.bottom > 1.1 && part.top < 1.9))
})

test('doors have a framed wood leaf, raised panels and handles with a structural lintel above', () => {
  const parts = elementParts({ ...window, type: 'door', sillHeight: 0, height: 2.1 })
  const infill = parts.filter(part => part.role === 'wall')
  assert.deepEqual(infill.map(part => [part.bottom, part.top]), [[2.1, 2.7]])
  assert.equal(parts.filter(part => part.role === 'door').length, 1)
  assert.equal(parts.filter(part => part.role === 'doorPanel').length, 4)
  assert.equal(parts.filter(part => part.role === 'hardware').length, 4)
  assert.ok(parts.filter(part => part.role !== 'wall').every(part => part.bottom >= 0 && part.top <= 2.1))
})

test('legacy untyped walls remain a single full-height prism', () => {
  const parts = elementParts({ ...window, type: undefined })
  assert.equal(parts.length, 1)
  assert.equal(parts[0].role, 'wall')
  assert.equal(parts[0].bottom, 0)
  assert.equal(parts[0].top, 2.7)
})

test('rotated opening parts follow image-space coordinates and retain vertical placement', () => {
  const parts = elementParts({ ...window, rotation: Math.PI / 2 })
  const jambs = parts.filter(part => part.role === 'frame').slice(0, 2)
  close(jambs[0].x, window.x)
  close(jambs[1].x, window.x)
  assert.ok(jambs[0].z < window.z && jambs[1].z > window.z)
  assert.equal(jambs[0].bottom, 0.9)
  assert.equal(jambs[0].top, 2.1)
})

test('section caps respect part elevations and do not fill the window opening with wall material', () => {
  const bounds = computeBounds([window])
  const parts = elementParts(window)
  let cutArea = 0
  for (const part of parts) {
    const points = wallFootprint(part, bounds)
    const horizontal = sectionCap(points, bounds, { axis: 'y', position: 1.5 }, part.bottom, part.top)
    if (part.role === 'wall') assert.equal(horizontal.length, 0)
    if (horizontal.length) cutArea += polygonArea(points)
    const vertical = sectionCap(points, bounds, { axis: 'x', position: 1.4 }, part.bottom, part.top)
    for (const vertex of vertical) assert.ok(vertex[1] >= part.bottom && vertex[1] <= part.top)
  }
  assert.ok(cutArea > 0 && cutArea < window.width * window.depth * 0.3)
})

test('a raised prism has the requested sill and top, with the correct closed volume', () => {
  const points = wallFootprint(window, computeBounds([window]))
  const vertices = prismPositions(points, 2.1, 0.9)
  const ys = vertices.filter((_, index) => index % 3 === 1)
  assert.equal(Math.min(...ys), 0.9)
  assert.equal(Math.max(...ys), 2.1)
  let volume = 0
  for (let i = 0; i < vertices.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = vertices.slice(i, i + 9)
    volume += (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6
  }
  close(volume, window.width * window.depth * 1.2)
})
