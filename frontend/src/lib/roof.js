import * as THREE from 'three'
import { WALL_HEIGHT } from './geometry.js'

/**
 * Roofs are generated entirely on the frontend from the wall data (no API change).
 *
 * Pipeline:
 *   1. Find the plan's dominant orientation, so rotated plans still decompose into clean rectangles.
 *   2. Rasterize every element (walls, windows, doors) into a grid, close small gaps such as
 *      doorways, and flood-fill from outside to get the building footprint.
 *   3. Cover the footprint with a few overlapping rectangles (largest first). Overlapping hip or
 *      gable roofs with the same pitch meet in natural valleys, like a real L-shaped house.
 *   4. Build one closed roof solid per rectangle.
 */

export const ROOF_TYPES = [
  { id: 'flat', label: 'Flat' },
  { id: 'gable', label: 'Gable' },
  { id: 'hip', label: 'Hip' },
]
export const DEFAULT_ROOF = 'gable'

export const ROOF_PITCH = Math.PI / 6 // 30 degrees
export const ROOF_OVERHANG = 0.3
export const FLAT_ROOF_THICKNESS = 0.3

const CELL = 0.1 // raster resolution, meters
const MAX_CELLS = 1_500_000
const CLOSE_RADIUS = 0.6 // closes openings up to ~1.2 m wide
const MIN_PIECE_AREA = 1.5 // m²; smaller leftovers are covered by the overhang
const MIN_PIECE_SIZE = 0.8 // m; thinner strips are skipped
const MAX_PIECES = 12

/** Weighted mean wall direction, folded into a 90° period. Returns radians in (-π/4, π/4]. */
function dominantAngle(elements) {
  let c = 0
  let s = 0
  for (const e of elements) {
    c += e.width * Math.cos(4 * e.rotation)
    s += e.width * Math.sin(4 * e.rotation)
  }
  const angle = Math.atan2(s, c) / 4
  return Math.abs(angle) < (2 * Math.PI) / 180 ? 0 : angle
}

/** Element extents in a frame rotated by `angle`. */
export function toFrame(elements, angle) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return elements.map((e) => ({
    u: e.x * cos + e.z * sin,
    v: -e.x * sin + e.z * cos,
    rot: e.rotation - angle,
    hw: e.width / 2,
    hd: e.depth / 2,
  }))
}

function frameBounds(items, pad = 0) {
  let minU = Infinity
  let maxU = -Infinity
  let minV = Infinity
  let maxV = -Infinity
  for (const it of items) {
    const c = Math.abs(Math.cos(it.rot))
    const s = Math.abs(Math.sin(it.rot))
    const eu = c * (it.hw + pad) + s * (it.hd + pad)
    const ev = s * (it.hw + pad) + c * (it.hd + pad)
    minU = Math.min(minU, it.u - eu)
    maxU = Math.max(maxU, it.u + eu)
    minV = Math.min(minV, it.v - ev)
    maxV = Math.max(maxV, it.v + ev)
  }
  return { minU, maxU, minV, maxV }
}

/** Separable square erosion: a cell survives if every cell within k (Chebyshev) is set. */
function erode(mask, nu, nv, k) {
  const tmp = new Uint8Array(mask.length)
  const out = new Uint8Array(mask.length)
  const span = 2 * k + 1
  for (let j = 0; j < nv; j++) {
    let run = 0
    const row = j * nu
    for (let i = 0; i < nu + k; i++) {
      if (i < nu) run += mask[row + i]
      if (i - span >= 0) run -= mask[row + i - span]
      const c = i - k
      if (c >= 0) tmp[row + c] = c - k >= 0 && c + k < nu && run === span ? 1 : 0
    }
  }
  for (let i = 0; i < nu; i++) {
    let run = 0
    for (let j = 0; j < nv + k; j++) {
      if (j < nv) run += tmp[j * nu + i]
      if (j - span >= 0) run -= tmp[(j - span) * nu + i]
      const c = j - k
      if (c >= 0) out[c * nu + i] = c - k >= 0 && c + k < nv && run === span ? 1 : 0
    }
  }
  return out
}

/** Footprint mask in the rotated frame, or null if the outline isn't closed. */
export function rasterizeFootprint(items) {
  const pad = CLOSE_RADIUS + 3 * CELL
  const b = frameBounds(items, 0)
  const spanU = b.maxU - b.minU + 2 * pad
  const spanV = b.maxV - b.minV + 2 * pad
  const cell = Math.max(CELL, Math.sqrt((spanU * spanV) / MAX_CELLS))
  const nu = Math.ceil(spanU / cell)
  const nv = Math.ceil(spanV / cell)
  const originU = b.minU - pad
  const originV = b.minV - pad

  // 1. Solid cells: each element dilated by CLOSE_RADIUS.
  const solid = new Uint8Array(nu * nv)
  for (const it of items) {
    const hx = it.hw + CLOSE_RADIUS
    const hz = it.hd + CLOSE_RADIUS
    const c = Math.cos(it.rot)
    const s = Math.sin(it.rot)
    const eu = Math.abs(c) * hx + Math.abs(s) * hz
    const ev = Math.abs(s) * hx + Math.abs(c) * hz
    const i0 = Math.max(0, Math.floor((it.u - eu - originU) / cell))
    const i1 = Math.min(nu - 1, Math.ceil((it.u + eu - originU) / cell))
    const j0 = Math.max(0, Math.floor((it.v - ev - originV) / cell))
    const j1 = Math.min(nv - 1, Math.ceil((it.v + ev - originV) / cell))
    for (let j = j0; j <= j1; j++) {
      const dv = originV + (j + 0.5) * cell - it.v
      for (let i = i0; i <= i1; i++) {
        const du = originU + (i + 0.5) * cell - it.u
        if (Math.abs(du * c + dv * s) <= hx && Math.abs(-du * s + dv * c) <= hz) solid[j * nu + i] = 1
      }
    }
  }

  // 2. Flood-fill the outside from the border; everything else is inside.
  const outside = new Uint8Array(nu * nv)
  const stack = new Int32Array(nu * nv)
  let top = 0
  const seed = (idx) => {
    if (!solid[idx] && !outside[idx]) {
      outside[idx] = 1
      stack[top++] = idx
    }
  }
  for (let i = 0; i < nu; i++) {
    seed(i)
    seed((nv - 1) * nu + i)
  }
  for (let j = 0; j < nv; j++) {
    seed(j * nu)
    seed(j * nu + nu - 1)
  }
  while (top > 0) {
    const idx = stack[--top]
    const i = idx % nu
    if (i > 0) seed(idx - 1)
    if (i < nu - 1) seed(idx + 1)
    if (idx >= nu) seed(idx - nu)
    if (idx < nu * (nv - 1)) seed(idx + nu)
  }
  const inside = new Uint8Array(nu * nv)
  for (let k = 0; k < inside.length; k++) inside[k] = outside[k] ? 0 : 1

  // 3. Undo the dilation (morphological closing), leaving the outer faces of the walls.
  const footprint = erode(inside, nu, nv, Math.round(CLOSE_RADIUS / cell))

  // An open outline leaks: the footprint collapses to just the walls.
  let area = 0
  for (let k = 0; k < footprint.length; k++) area += footprint[k]
  area *= cell * cell
  const bboxArea = (b.maxU - b.minU) * (b.maxV - b.minV)
  if (area < 0.3 * bboxArea) return null

  return { mask: footprint, nu, nv, cell, originU, originV }
}

/** Largest all-ones rectangle (histogram method). Returns cell bounds [i0, i1) × [j0, j1). */
function largestRect(mask, nu, nv) {
  const heights = new Int32Array(nu)
  const stackStart = new Int32Array(nu + 1)
  const stackHeight = new Int32Array(nu + 1)
  let best = null
  let bestArea = 0
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) heights[i] = mask[j * nu + i] ? heights[i] + 1 : 0
    let sp = 0
    for (let i = 0; i <= nu; i++) {
      const h = i < nu ? heights[i] : 0
      let start = i
      while (sp > 0 && stackHeight[sp - 1] >= h) {
        sp--
        const area = stackHeight[sp] * (i - stackStart[sp])
        if (area > bestArea) {
          bestArea = area
          best = { i0: stackStart[sp], i1: i, j0: j + 1 - stackHeight[sp], j1: j + 1 }
        }
        start = stackStart[sp]
      }
      stackStart[sp] = start
      stackHeight[sp] = h
      sp++
    }
  }
  return best
}

/** Grows a rectangle in all four directions while it stays inside the footprint. */
function growRect(r, mask, nu, nv) {
  const colFull = (i, j0, j1) => {
    for (let j = j0; j < j1; j++) if (!mask[j * nu + i]) return false
    return true
  }
  const rowFull = (j, i0, i1) => {
    for (let i = i0; i < i1; i++) if (!mask[j * nu + i]) return false
    return true
  }
  let { i0, i1, j0, j1 } = r
  let changed = true
  while (changed) {
    changed = false
    if (i0 > 0 && colFull(i0 - 1, j0, j1)) {
      i0--
      changed = true
    }
    if (i1 < nu && colFull(i1, j0, j1)) {
      i1++
      changed = true
    }
    if (j0 > 0 && rowFull(j0 - 1, i0, i1)) {
      j0--
      changed = true
    }
    if (j1 < nv && rowFull(j1, i0, i1)) {
      j1++
      changed = true
    }
  }
  return { i0, i1, j0, j1 }
}

function decompose({ mask, nu, nv, cell }) {
  const uncovered = mask.slice()
  const minCells = MIN_PIECE_AREA / (cell * cell)
  const minSide = MIN_PIECE_SIZE / cell
  const rects = []
  for (let guard = 0; rects.length < MAX_PIECES && guard < MAX_PIECES * 4; guard++) {
    const r = largestRect(uncovered, nu, nv)
    if (!r || (r.i1 - r.i0) * (r.j1 - r.j0) < minCells) break
    const clear = (q) => {
      for (let j = q.j0; j < q.j1; j++) for (let i = q.i0; i < q.i1; i++) uncovered[j * nu + i] = 0
    }
    if (Math.min(r.i1 - r.i0, r.j1 - r.j0) < minSide) {
      clear(r) // a thin sliver: leave it to the overhang
      continue
    }
    const grown = growRect(r, mask, nu, nv)
    rects.push(grown)
    clear(grown)
  }
  return rects
}

/**
 * Computes where roof pieces go. Each piece is a rectangle in plan coordinates
 * (same convention as walls): { x, z, length, width, rotation }, with `length` along `rotation`.
 */
export function computeRoofPlan(elements) {
  if (!elements?.length) return { rects: [] }
  const angle = dominantAngle(elements)
  const items = toFrame(elements, angle)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  const raster = rasterizeFootprint(items)
  let frameRects
  if (raster) {
    frameRects = decompose(raster).map((r) => ({
      u0: raster.originU + r.i0 * raster.cell,
      u1: raster.originU + r.i1 * raster.cell,
      v0: raster.originV + r.j0 * raster.cell,
      v1: raster.originV + r.j1 * raster.cell,
    }))
  }
  if (!frameRects?.length) {
    // Outline isn't closed (e.g. a wide open-plan gap): fall back to one roof over the whole plan.
    const b = frameBounds(items)
    frameRects = [{ u0: b.minU, u1: b.maxU, v0: b.minV, v1: b.maxV }]
  }

  const rects = frameRects.map(({ u0, u1, v0, v1 }) => {
    const uc = (u0 + u1) / 2
    const vc = (v0 + v1) / 2
    const du = u1 - u0
    const dv = v1 - v0
    const alongU = du >= dv
    return {
      x: uc * cos - vc * sin,
      z: uc * sin + vc * cos,
      length: alongU ? du : dv,
      width: alongU ? dv : du,
      rotation: alongU ? angle : angle + Math.PI / 2,
    }
  })
  return { rects }
}

const riseFor = (width) => Math.tan(ROOF_PITCH) * (width / 2 + ROOF_OVERHANG)

/** Highest point of the building with this roof, in meters. */
export function roofTopHeight(plan, type) {
  if (!plan.rects.length) return WALL_HEIGHT
  if (type === 'flat') return WALL_HEIGHT + FLAT_ROOF_THICKNESS
  return WALL_HEIGHT + Math.max(...plan.rects.map((r) => riseFor(r.width)))
}

/**
 * One closed roof solid for a rectangle, in local space: long axis along X, centered on the
 * origin, base at y = 0. Material group 0 is the roof surface; group 1 is the vertical gable ends.
 */
export function buildRoofGeometry(type, rect) {
  const hl = rect.length / 2 + ROOF_OVERHANG
  const hw = rect.width / 2 + ROOF_OVERHANG

  if (type === 'flat') {
    const box = new THREE.BoxGeometry(hl * 2, FLAT_ROOF_THICKNESS, hw * 2)
    box.translate(0, FLAT_ROOF_THICKNESS / 2, 0)
    box.clearGroups()
    box.addGroup(0, box.index.count, 0)
    return box
  }

  const h = Math.tan(ROOF_PITCH) * hw
  const rl = type === 'hip' ? Math.max(hl - hw, 0) : hl
  const V = THREE.Vector3
  const A = new V(-hl, 0, -hw)
  const B = new V(hl, 0, -hw)
  const C = new V(hl, 0, hw)
  const D = new V(-hl, 0, hw)
  const R1 = new V(-rl, h, 0)
  const R2 = new V(rl, h, 0)
  const center = new V(0, h / 3, 0)

  const surface = [
    [A, B, R2], [A, R2, R1], // north slope
    [D, C, R2], [D, R2, R1], // south slope
    [A, C, B], [A, D, C], // soffit
  ]
  const ends = [
    [A, D, R1],
    [B, C, R2],
  ]
  // Hip ends are sloped roof; gable ends are vertical wall.
  const groups = type === 'hip' ? [[...surface, ...ends], []] : [surface, ends]

  const positions = []
  const ab = new V()
  const ac = new V()
  const n = new V()
  const g = new V()
  const counts = groups.map((tris) => {
    let count = 0
    for (const [a, b, c] of tris) {
      n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a))
      if (n.lengthSq() < 1e-12) continue // degenerate (pyramid hip)
      g.copy(a).add(b).add(c).divideScalar(3).sub(center)
      const [p, q, r] = n.dot(g) >= 0 ? [a, b, c] : [a, c, b] // face outward
      positions.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z)
      count += 3
    }
    return count
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.addGroup(0, counts[0], 0)
  if (counts[1]) geometry.addGroup(counts[0], counts[1], 1)
  geometry.computeVertexNormals()
  return geometry
}
