import assert from 'node:assert/strict'
import { test } from 'node:test'
import { elementParts, squared } from '../src/lib/elementParts.js'
import { buildRoofGeometry } from '../src/lib/roof.js'
import { surfaceUvs } from '../src/lib/surfaceUv.js'

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} is not ${b}`)
const triangle = (...corners) => corners.flat()

test('a level face takes its pattern from plan position, in meters', () => {
  const uvs = surfaceUvs(triangle([1, 0, 2], [3, 0, 2], [1, 0, 5]))
  assert.deepEqual([...uvs], [1, 2, 3, 2, 1, 5])
})

test('a wall face runs along its length and straight up, whichever way its triangle winds', () => {
  for (const corners of [[[2, 0, 0], [4, 0, 0], [4, 2.7, 0]], [[2, 0, 0], [4, 2.7, 0], [4, 0, 0]]]) {
    const uvs = surfaceUvs(triangle(...corners))
    const v = corners.map((_, i) => uvs[i * 2 + 1])
    corners.forEach(([, y], i) => near(v[i], y))
    near(Math.abs(uvs[2] - uvs[0]), 2)
    near(Math.abs(uvs[4] - uvs[0]), 2)
  }
})

test('neighboring pieces of one wall share a continuous pattern, so no seam shows at the join', () => {
  const left = surfaceUvs(triangle([0, 0, 0], [2, 0, 0], [2, 2.7, 0]))
  const right = surfaceUvs(triangle([2, 0, 0], [4, 0, 0], [4, 2.7, 0]))
  near(left[2], right[0])
  near(left[3], right[1])
})

test('every roof shape carries meter coordinates with slopes measured up the pitch', () => {
  for (const type of ['flat', 'gable', 'hip']) {
    const geometry = buildRoofGeometry(type, { length: 8, width: 6 })
    const { position, uv } = geometry.attributes
    assert.ok(uv, `${type} has coordinates`)
    assert.equal(uv.count, position.count)
    for (let i = 0; i < uv.count; i++) assert.ok(Number.isFinite(uv.getX(i)) && Number.isFinite(uv.getY(i)), `${type} vertex ${i}`)
  }
})

test('quarter turns stored as 1.571 are squared up, and real angles are left alone', () => {
  assert.equal(squared(1.571), Math.PI / 2)
  assert.equal(squared(-1.571), -Math.PI / 2)
  assert.equal(squared(0.0004), 0)
  assert.equal(squared(0.5), 0.5)
  assert.equal(squared(Math.PI / 4), Math.PI / 4)
})

test('flush collinear walls stored at 1.571 meet with no gap once squared up', () => {
  const end = wall => {
    const [part] = elementParts(wall)
    return { side: part.x + Math.sin(part.rotation) * part.depth / 2, start: part.z - Math.sin(part.rotation) * part.width / 2, finish: part.z + Math.sin(part.rotation) * part.width / 2 }
  }
  const a = end({ type: 'wall', x: 3, z: 1.5, width: 3, depth: 0.2, rotation: 1.571 })
  const b = end({ type: 'wall', x: 3, z: 4.5, width: 3, depth: 0.2, rotation: 1.571 })
  near(a.finish, b.start)
  near(a.side, b.side)
  assert.equal(elementParts({ type: 'wall', x: 3, z: 1.5, width: 3, depth: 0.2, rotation: 1.571 })[0].rotation, Math.PI / 2)
})
