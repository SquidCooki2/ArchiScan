import { PLAN_CUT_HEIGHT, WALL_HEIGHT } from './geometry.js'

const EPSILON = 1e-7

export const createSection = () => ({ enabled: false, axis: 'y', position: WALL_HEIGHT, flipped: false, scope: 'area' })

export function cutRange(bounds, axis, area = null, maxHeight = WALL_HEIGHT) {
  if (area && axis === 'x') return { min: area.minX + bounds.width / 2, max: area.maxX + bounds.width / 2 }
  if (area && axis === 'z') return { min: area.minZ + bounds.depth / 2, max: area.maxZ + bounds.depth / 2 }
  return { min: axis === 'y' ? 0.1 : 0, max: axis === 'y' ? maxHeight : axis === 'x' ? bounds.width : bounds.depth }
}

export function defaultCutPosition(bounds, axis, area = null) {
  const range = cutRange(bounds, axis, area)
  return axis === 'y' ? PLAN_CUT_HEIGHT : (range.min + range.max) / 2
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export function selectionRectangle(a, b, bounds) {
  return {
    minX: clamp(Math.min(a.x, b.x), -bounds.width / 2, bounds.width / 2),
    maxX: clamp(Math.max(a.x, b.x), -bounds.width / 2, bounds.width / 2),
    minZ: clamp(Math.min(a.z, b.z), -bounds.depth / 2, bounds.depth / 2),
    maxZ: clamp(Math.max(a.z, b.z), -bounds.depth / 2, bounds.depth / 2),
  }
}

export function validSelection(area) {
  return Boolean(area && area.maxX - area.minX >= 0.05 && area.maxZ - area.minZ >= 0.05)
}

export function moveSelection(area, dx, dz, bounds) {
  const x = clamp(dx, -bounds.width / 2 - area.minX, bounds.width / 2 - area.maxX)
  const z = clamp(dz, -bounds.depth / 2 - area.minZ, bounds.depth / 2 - area.maxZ)
  return { minX: area.minX + x, maxX: area.maxX + x, minZ: area.minZ + z, maxZ: area.maxZ + z }
}

export function resizeSelection(area, corner, point, bounds) {
  const result = { ...area }
  for (const [key, axis, size] of [[corner[0], 'x', bounds.width], [corner[1], 'z', bounds.depth]]) {
    result[key] = key.startsWith('min')
      ? clamp(point[axis], -size / 2, result[axis === 'x' ? 'maxX' : 'maxZ'] - 0.05)
      : clamp(point[axis], result[axis === 'x' ? 'minX' : 'minZ'] + 0.05, size / 2)
  }
  return result
}

export function cutCoordinate(bounds, section) {
  return section.position - (section.axis === 'x' ? bounds.width / 2 : section.axis === 'z' ? bounds.depth / 2 : 0)
}

/** Plane distance >= 0 is retained; coordinates are in the centered viewer space. */
export function cutPlane(bounds, section) {
  const sign = section.flipped ? 1 : -1
  return { normal: { x: 0, y: 0, z: 0, [section.axis]: sign }, constant: -sign * cutCoordinate(bounds, section) }
}

export function wallFootprint(wall, bounds) {
  const c = Math.cos(wall.rotation), s = Math.sin(wall.rotation)
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => {
    const lx = x * wall.width / 2, lz = z * wall.depth / 2
    return { x: wall.x - bounds.cx + c * lx - s * lz, z: wall.z - bounds.cz + s * lx + c * lz }
  })
}

export function polygonArea(points) {
  return Math.abs(points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length]
    return sum + p.x * q.z - q.x * p.z
  }, 0)) / 2
}

function clipPolygon(points, axis, value, keepGreater) {
  if (!points.length) return []
  const result = []
  const distance = p => (p[axis] - value) * (keepGreater ? 1 : -1)
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length]
    const da = distance(a), db = distance(b)
    if (da >= -EPSILON) result.push(a)
    if ((da > EPSILON && db < -EPSILON) || (da < -EPSILON && db > EPSILON)) {
      const t = da / (da - db)
      result.push({ x: a.x + t * (b.x - a.x), z: a.z + t * (b.z - a.z) })
    }
  }
  return result.filter((p, i) => {
    const previous = result[(i + result.length - 1) % result.length]
    return Math.hypot(p.x - previous.x, p.z - previous.z) > EPSILON
  })
}

/** Disjoint pieces: only the portion inside the rectangular area receives a cut. */
export function partitionFootprint(points, area) {
  if (!area) return [{ points, inside: false }]
  const pieces = []
  let remaining = points
  for (const [axis, value, keepGreater] of [['x', area.minX, true], ['x', area.maxX, false], ['z', area.minZ, true], ['z', area.maxZ, false]]) {
    const outside = clipPolygon(remaining, axis, value, !keepGreater)
    if (polygonArea(outside) > EPSILON) pieces.push({ points: outside, inside: false })
    remaining = clipPolygon(remaining, axis, value, keepGreater)
    if (!remaining.length) break
  }
  if (polygonArea(remaining) > EPSILON) pieces.push({ points: remaining, inside: true })
  return pieces
}

/** Flat triangle positions for a closed vertical prism over a convex footprint. */
export function prismPositions(points, height = WALL_HEIGHT, base = 0) {
  if (points.length < 3) return []
  const positions = []
  const push = (...vertices) => vertices.forEach(p => positions.push(...p))
  const bottom = p => [p.x, base, p.z], top = p => [p.x, height, p.z]
  for (let i = 1; i < points.length - 1; i++) {
    push(bottom(points[0]), bottom(points[i]), bottom(points[i + 1]))
    push(top(points[0]), top(points[i + 1]), top(points[i]))
  }
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length]
    push(bottom(p), top(p), top(q), bottom(p), top(q), bottom(q))
  })
  return positions
}

/** True intersections, including vertical cuts through diagonal walls, get a solid cap. */
export function sectionCap(points, bounds, section, bottom = 0, top = WALL_HEIGHT) {
  const coordinate = cutCoordinate(bounds, section)
  if (section.axis === 'y') {
    if (coordinate <= bottom + EPSILON || coordinate >= top - EPSILON) return []
    return points.map(p => [p.x, coordinate, p.z])
  }
  const axis = section.axis
  const values = points.map(p => p[axis])
  if (coordinate <= Math.min(...values) + EPSILON || coordinate >= Math.max(...values) - EPSILON) return []
  const crossings = []
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length]
    const da = a[axis] - coordinate, db = b[axis] - coordinate
    if (Math.abs(da) < EPSILON) crossings.push(a)
    if (da * db < 0) {
      const t = da / (da - db)
      crossings.push({ x: a.x + t * (b.x - a.x), z: a.z + t * (b.z - a.z) })
    }
  })
  const otherAxis = axis === 'x' ? 'z' : 'x'
  crossings.sort((a, b) => a[otherAxis] - b[otherAxis])
  if (crossings.length < 2) return []
  const a = crossings[0], b = crossings[crossings.length - 1]
  return [[a.x, bottom, a.z], [b.x, bottom, b.z], [b.x, top, b.z], [a.x, top, a.z]]
}

export function capPositions(points) {
  const result = []
  for (let i = 1; i < points.length - 1; i++) result.push(...points[0], ...points[i], ...points[i + 1])
  return result
}

export function centralArea(bounds) {
  return { minX: -bounds.width / 4, maxX: bounds.width / 4, minZ: -bounds.depth / 4, maxZ: bounds.depth / 4 }
}
