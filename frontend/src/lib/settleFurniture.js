import { elementParts } from './elementParts.js'
import { FURNITURE, furnitureRect } from './furniture.js'
import { computeBounds, elementFloor, elementType, floorCount, isEnclosure, isFurniture, isStairs, stairRect } from './geometry.js'

// A hair off every wall, so faces never coincide.
const CLEARANCE = 0.012
// A chair can be pushed in under its table this far, which it often must in a small room.
const CHAIR_TUCK = 0.3
// Room to step on and off a flight.
const LANDING = 0.7
const MIN_FIT = 0.7
const RELAX_PASSES = 60
const SHRINK_ROUNDS = 6
const SETTLED = 0.002

const axesOf = rect => {
  const c = Math.cos(rect.rotation), s = Math.sin(rect.rotation)
  return [[c, s], [-s, c]]
}

/** How far rect `a` must move, and which way, to clear rect `b`: the shortest way out. Null if clear. */
export function rectOverlap(a, b) {
  const [ax, az] = axesOf(a), [bx, bz] = axesOf(b)
  const dx = a.x - b.x, dz = a.z - b.z
  const reach = (rect, [x1, z1], [x2, z2], [nx, nz]) => (Math.abs(x1 * nx + z1 * nz) * rect.width + Math.abs(x2 * nx + z2 * nz) * rect.depth) / 2
  let best = null
  for (const axis of [ax, az, bx, bz]) {
    const along = dx * axis[0] + dz * axis[1]
    const depth = reach(a, ax, az, axis) + reach(b, bx, bz, axis) - Math.abs(along)
    if (depth <= 0) return null
    if (!best || depth < best.depth) {
      const sign = along < 0 ? -1 : 1
      best = { depth, x: axis[0] * sign, z: axis[1] * sign }
    }
  }
  return best
}

const isChair = piece => elementType(piece.item) === 'chair'
const isTable = piece => elementType(piece.item) === 'table'
const rectOf = piece => furnitureRect({ ...piece.item, x: piece.x, z: piece.z, fitWidth: piece.fitWidth, fitDepth: piece.fitDepth })
const areaOf = piece => { const { width, depth } = rectOf(piece); return width * depth }
const allowance = (a, b) => (isChair(a) && isTable(b)) || (isChair(b) && isTable(a)) ? CHAIR_TUCK : 0

/** Everything on a floor that furniture can't stand in. Open door leaves give way last. */
function floorObstacles(elements, floor, floors) {
  const here = elements.filter(element => elementFloor(element) === floor)
  const enclosures = here.filter(isEnclosure)
  const solid = [...enclosures]
  for (const stair of elements.filter(isStairs)) {
    const flight = elementFloor(stair)
    const connects = flight + 1 < floors
    if (flight !== floor && flight + 1 !== floor) continue
    const rect = stairRect(stair)
    const c = Math.cos(rect.rotation), s = Math.sin(rect.rotation)
    // Keep the end of the flight you step off at clear, as well as the flight or its well.
    const shift = !connects ? 0 : (flight === floor ? -LANDING / 2 : LANDING / 2)
    solid.push({ ...rect, x: rect.x + c * shift, z: rect.z + s * shift, width: rect.width + (connects ? LANDING : 0) })
  }
  if (enclosures.length) {
    // Past the plan's edge on all four sides, so nothing leaves the building to get clear of a wall.
    const { minX, maxX, minZ, maxZ } = computeBounds(enclosures)
    const far = 100
    solid.push({ x: minX - far / 2, z: (minZ + maxZ) / 2, width: far, depth: far * 2, rotation: 0 },
      { x: maxX + far / 2, z: (minZ + maxZ) / 2, width: far, depth: far * 2, rotation: 0 },
      { x: (minX + maxX) / 2, z: minZ - far / 2, width: far * 2, depth: far, rotation: 0 },
      { x: (minX + maxX) / 2, z: maxZ + far / 2, width: far * 2, depth: far, rotation: 0 })
  }
  const leaves = enclosures.filter(element => elementType(element) === 'door')
    .flatMap(door => elementParts(door, { openDoors: true }).filter(part => part.role === 'door'))
  return { solid, leaves }
}

function push(piece, overlap, share) {
  piece.x += overlap.x * (overlap.depth + CLEARANCE) * share
  piece.z += overlap.z * (overlap.depth + CLEARANCE) * share
}

function relax(pieces, { solid, leaves }) {
  for (let pass = 0; pass < RELAX_PASSES; pass++) {
    let moved = false
    for (const piece of pieces) {
      for (const leaf of leaves) {
        const overlap = rectOverlap(rectOf(piece), leaf)
        if (overlap) { push(piece, overlap, 1); moved = true }
      }
    }
    pieces.forEach((a, i) => pieces.slice(i + 1).forEach(b => {
      const overlap = rectOverlap(rectOf(a), rectOf(b))
      const allowed = allowance(a, b)
      if (!overlap || overlap.depth <= allowed + SETTLED) return
      const trimmed = { ...overlap, depth: overlap.depth - allowed }
      // The smaller piece does most of the moving, and a chair all of it.
      const areaA = areaOf(a), areaB = areaOf(b)
      const shareA = isChair(a) && !isChair(b) ? 1 : isChair(b) && !isChair(a) ? 0 : areaB / (areaA + areaB)
      push(a, trimmed, shareA)
      push(b, { ...trimmed, x: -trimmed.x, z: -trimmed.z }, 1 - shareA)
      moved = true
    }))
    // Walls go last, so they always win.
    for (const piece of pieces) {
      for (const wall of solid) {
        const overlap = rectOverlap(rectOf(piece), wall)
        if (overlap) { push(piece, overlap, 1); moved = true }
      }
    }
    if (!moved) return
  }
}

/** Trims a piece along whichever of its sides faces the conflict. */
function shrink(piece, overlap) {
  const [width, , depth] = FURNITURE[elementType(piece.item)].size
  const rect = rectOf(piece)
  const [ax] = axesOf(rect)
  const alongWidth = Math.abs(overlap.x * ax[0] + overlap.z * ax[1]) > Math.SQRT1_2
  const current = alongWidth ? rect.width : rect.depth
  piece[alongWidth ? 'fitWidth' : 'fitDepth'] = Math.max(MIN_FIT, (current - overlap.depth - CLEARANCE * 2) / (alongWidth ? width : depth))
}

function shrinkConflicts(pieces, { solid }) {
  let any = false
  for (const piece of pieces) {
    for (const wall of solid) {
      const overlap = rectOverlap(rectOf(piece), wall)
      if (overlap && overlap.depth > SETTLED) { shrink(piece, overlap); any = true }
    }
  }
  // Two pieces short of room both give a little, so neither ends up a sliver. Chairs keep their shape.
  pieces.forEach((a, i) => pieces.slice(i + 1).forEach(b => {
    const overlap = rectOverlap(rectOf(a), rectOf(b))
    if (!overlap || overlap.depth <= allowance(a, b) + SETTLED) return
    const trimming = [a, b].filter(piece => !isChair(piece))
    const each = { ...overlap, depth: (overlap.depth - allowance(a, b)) / trimming.length }
    trimming.forEach(piece => shrink(piece, each))
    any = true
  }))
  return any
}

/**
 * A parsed plan places furniture by eye, and our models come in fixed sizes, so pieces land inside walls,
 * stairwells and each other. This nudges each one the shortest way clear, trimming a piece only when
 * its room is too small for it. Everything else (drawing, walking, routes) then uses the settled spots.
 */
export function settleFurniture(elements) {
  if (!elements.some(isFurniture)) return elements
  const floors = floorCount(elements)
  const settled = new Map()
  for (let floor = 0; floor < floors; floor++) {
    const pieces = elements.filter(element => isFurniture(element) && elementFloor(element) === floor)
      .map(item => ({ item, x: item.x, z: item.z }))
    if (!pieces.length) continue
    const obstacles = floorObstacles(elements, floor, floors)
    relax(pieces, obstacles)
    for (let round = 0; round < SHRINK_ROUNDS && shrinkConflicts(pieces, obstacles); round++) relax(pieces, obstacles)
    for (const piece of pieces) {
      const { item, x, z, fitWidth, fitDepth } = piece
      settled.set(item, { ...item, x, z, ...(fitWidth ? { fitWidth } : {}), ...(fitDepth ? { fitDepth } : {}) })
    }
  }
  return elements.map(element => settled.get(element) ?? element)
}
