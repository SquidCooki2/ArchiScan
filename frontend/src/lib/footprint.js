import { isEnclosure } from './geometry.js'
import { dominantAngle, erode, rasterizeFootprint, toFrame } from './roof.js'

/*
 * The outline of a floor as it really is, so a floor stops at the exterior walls instead of filling the
 * plan's bounding rectangle. It's traced from the same footprint the roof uses, at a finer grid, because
 * the edge has to land inside a wall: it can't show past the outer face or fall short of the inner one.
 */

const CELL = 0.05
// Slivers left over from tracing, in square meters.
const MIN_LOOP_AREA = 0.25

/** Follows the mask's cell edges into closed loops, with the inside on the left of each. */
function traceLoops(mask, nu, nv) {
  const on = (i, j) => i >= 0 && j >= 0 && i < nu && j < nv && mask[j * nu + i] === 1
  const key = (i, j) => j * (nu + 1) + i
  const edges = new Map()
  const add = (fromI, fromJ, toI, toJ) => {
    const from = key(fromI, fromJ)
    if (!edges.has(from)) edges.set(from, [])
    edges.get(from).push([toI, toJ])
  }
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      if (!on(i, j)) continue
      if (!on(i, j - 1)) add(i, j, i + 1, j)
      if (!on(i + 1, j)) add(i + 1, j, i + 1, j + 1)
      if (!on(i, j + 1)) add(i + 1, j + 1, i, j + 1)
      if (!on(i - 1, j)) add(i, j + 1, i, j)
    }
  }
  const loops = []
  for (const [startKey, outgoing] of edges) {
    while (outgoing.length) {
      const startI = startKey % (nu + 1), startJ = (startKey - startI) / (nu + 1)
      const loop = [[startI, startJ]]
      let [i, j] = outgoing.pop(), [fromI, fromJ] = loop[0]
      while (i !== startI || j !== startJ) {
        loop.push([i, j])
        const choices = edges.get(key(i, j))
        // Where two cells only touch at a corner, turning left keeps them as separate loops.
        const left = choices.findIndex(([nextI, nextJ]) => (i - fromI) * (nextJ - j) - (j - fromJ) * (nextI - i) > 0)
        const [next] = choices.splice(left >= 0 ? left : 0, 1)
        fromI = i; fromJ = j
        ;[i, j] = next
      }
      loops.push(loop)
    }
  }
  return loops
}

/** Drops the points along a straight run, so a long wall is one edge rather than hundreds. */
function corners(loop) {
  return loop.filter((point, index) => {
    const before = loop[(index + loop.length - 1) % loop.length], after = loop[(index + 1) % loop.length]
    return (point[0] - before[0]) * (after[1] - point[1]) !== (point[1] - before[1]) * (after[0] - point[0])
  })
}

const signedArea = loop => loop.reduce((sum, [x, z], index) => {
  const [nextX, nextZ] = loop[(index + 1) % loop.length]
  return sum + x * nextZ - nextX * z
}, 0) / 2

export function pointInLoop([x, z], loop) {
  let inside = false
  for (let a = 0, b = loop.length - 1; a < loop.length; b = a++) {
    const [ax, az] = loop[a], [bx, bz] = loop[b]
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside
  }
  return inside
}

/**
 * One floor's outlines in plan, each `{ outer, holes }` with points as [x, z]. `stairwells` are openings
 * to leave, as lists of corners. Null when the walls don't close into a building, so nothing can tell
 * inside from out. An opening that runs past the outline becomes a notch in it, as a hole can't cross
 * its own edge.
 */
export function floorOutlines(elements, stairwells = []) {
  const enclosure = elements.filter(isEnclosure)
  if (!enclosure.length) return null
  const angle = dominantAngle(enclosure)
  const raster = rasterizeFootprint(toFrame(enclosure, angle), CELL)
  if (!raster) return null
  const { nu, nv, cell, originU, originV } = raster
  // The footprint ends at the walls' outer faces, give or take a cell, so step in to be under them.
  const mask = erode(raster.mask, nu, nv, 1)
  const cos = Math.cos(angle), sin = Math.sin(angle)
  const toPlan = (i, j) => {
    const u = originU + i * cell, v = originV + j * cell
    return [u * cos - v * sin, u * sin + v * cos]
  }
  const cellAt = ([x, z]) => {
    const i = Math.floor((x * cos + z * sin - originU) / cell), j = Math.floor((-x * sin + z * cos - originV) / cell)
    return i >= 0 && j >= 0 && i < nu && j < nv ? j * nu + i : -1
  }
  const withinOutline = well => well.every((point, index) => {
    const next = well[(index + 1) % well.length]
    const steps = Math.max(1, Math.ceil(Math.hypot(next[0] - point[0], next[1] - point[1]) / cell))
    for (let step = 0; step <= steps; step++) {
      const k = cellAt([point[0] + (next[0] - point[0]) * step / steps, point[1] + (next[1] - point[1]) * step / steps])
      if (k < 0 || !mask[k]) return false
    }
    return true
  })
  const holes = []
  for (const well of stairwells) {
    if (withinOutline(well)) { holes.push(well); continue }
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        if (mask[j * nu + i] && pointInLoop(toPlan(i + 0.5, j + 0.5), well)) mask[j * nu + i] = 0
      }
    }
  }
  const loops = traceLoops(mask, nu, nv)
    .map(corners)
    .map(loop => loop.map(([i, j]) => toPlan(i, j)))
    .filter(loop => Math.abs(signedArea(loop)) >= MIN_LOOP_AREA)
  // Inside on the left means an outer loop runs one way round and a hole in it the other.
  const outlines = loops.filter(loop => signedArea(loop) > 0).map(outer => ({ outer, holes: [] }))
  if (!outlines.length) return null
  for (const hole of [...loops.filter(loop => signedArea(loop) < 0), ...holes]) {
    outlines.find(({ outer }) => pointInLoop(hole[0], outer))?.holes.push(hole)
  }
  return outlines
}
