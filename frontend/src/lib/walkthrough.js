import { elementParts, STAIR_OPEN_FOOT } from './elementParts.js'
import { furnitureRect } from './furniture.js'
import { elementFloor, floorBase, floorCount, isEnclosure, isFurniture, isStairs, stairRect, WALL_HEIGHT } from './geometry.js'

export const EYE_HEIGHT = 1.65
export const BODY_HEIGHT = 1.8
export const BODY_RADIUS = 0.2
export const WALK_SPEED = 1.4

const GUARD = 0.04

const collider = (rect, bounds) => {
  const c = Math.cos(rect.rotation), s = Math.sin(rect.rotation)
  return { x: rect.x - bounds.cx, z: rect.z - bounds.cz, c, s,
    halfWidth: rect.width / 2, halfDepth: rect.depth / 2,
    extentX: (Math.abs(c) * rect.width + Math.abs(s) * rect.depth) / 2,
    extentZ: (Math.abs(s) * rect.width + Math.abs(c) * rect.depth) / 2 }
}

/** One flight between two floors, centered like the walking world, with +along pointing upstairs. */
function stairLink(stair, bounds) {
  const rect = stairRect(stair)
  return { floor: elementFloor(stair), x: stair.x - bounds.cx, z: stair.z - bounds.cz, ux: Math.cos(rect.rotation), uz: Math.sin(rect.rotation),
    halfRun: stair.width / 2, halfWidth: stair.depth / 2, rect }
}

/** How far up a flight a point is, 0 to 1, or null when it isn't on the flight. */
export function stairProgress(point, link) {
  const dx = point.x - link.x, dz = point.z - link.z
  const along = dx * link.ux + dz * link.uz
  const across = -dx * link.uz + dz * link.ux
  if (Math.abs(along) > link.halfRun || Math.abs(across) > link.halfWidth) return null
  return (along + link.halfRun) / (link.halfRun * 2)
}

/** A flight is a corridor: walled along both sides, and closed at the end you can't leave by here. */
function corridor(link, closedEnd, bounds) {
  const { rect } = link
  const offset = (along, across) => ({ x: rect.x + link.ux * along - link.uz * across, z: rect.z + link.uz * along + link.ux * across })
  const piece = (along, across, width, depth) => collider({ ...offset(along, across), width, depth, rotation: rect.rotation }, bounds)
  // Downstairs, the lowest steps have no sides to walk into.
  const open = closedEnd > 0 ? STAIR_OPEN_FOOT : 0
  return [
    piece(open / 2, link.halfWidth, rect.width - open, GUARD),
    piece(open / 2, -link.halfWidth, rect.width - open, GUARD),
    piece(closedEnd * link.halfRun, 0, GUARD, rect.depth),
  ]
}

/** Meter-scale collision geometry for one floor, independent of overview section clipping. */
export function buildWalkWorld(elements, bounds, { openDoors = true, floor = 0 } = {}) {
  const here = elements.filter(element => elementFloor(element) === floor)
  const colliders = here.filter(isEnclosure).flatMap(element => elementParts(element, { openDoors }))
    .filter(part => part.bottom < BODY_HEIGHT && part.top > 0.001)
    .map(part => collider(part, bounds))
  colliders.push(...here.filter(isFurniture).map(item => collider(furnitureRect(item), bounds)))
  const floors = floorCount(elements)
  const stairs = []
  for (const stair of elements.filter(isStairs)) {
    const link = stairLink(stair, bounds)
    const connects = link.floor + 1 < floors
    if (link.floor === floor && !connects) { colliders.push(collider(link.rect, bounds)); continue }
    if (link.floor === floor) colliders.push(...corridor(link, 1, bounds))
    else if (link.floor + 1 === floor) colliders.push(...corridor(link, -1, bounds))
    else continue
    stairs.push(link)
  }
  return { colliders, stairs, floorY: floorBase(floor), minX: -bounds.width / 2, maxX: bounds.width / 2, minZ: -bounds.depth / 2, maxZ: bounds.depth / 2 }
}

/** Every floor's world. Walking moves between them where a flight connects two floors. */
export function buildWalkBuilding(elements, bounds, options) {
  return { floors: Array.from({ length: floorCount(elements) }, (_, floor) => buildWalkWorld(elements, bounds, { ...options, floor })) }
}

export function intersectsSolid(point, collider, radius = BODY_RADIUS) {
  const dx = point.x - collider.x, dz = point.z - collider.z
  if (Math.abs(dx) >= collider.extentX + radius || Math.abs(dz) >= collider.extentZ + radius) return false
  const x = collider.c * dx + collider.s * dz
  const z = -collider.s * dx + collider.c * dz
  const gapX = Math.max(0, Math.abs(x) - collider.halfWidth)
  const gapZ = Math.max(0, Math.abs(z) - collider.halfDepth)
  return gapX * gapX + gapZ * gapZ < radius * radius - 1e-9
}

function isBlocked(point, world) {
  const { x, z } = point
  if (x < world.minX + BODY_RADIUS || x > world.maxX - BODY_RADIUS || z < world.minZ + BODY_RADIUS || z > world.maxZ - BODY_RADIUS) return true
  return world.colliders.some(solid => intersectsSolid(point, solid))
}

export function placementAt(point, world) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return { valid: false, reason: 'Click a spot on the floor.' }
  const { x, z } = point
  if (x < world.minX + BODY_RADIUS || x > world.maxX - BODY_RADIUS || z < world.minZ + BODY_RADIUS || z > world.maxZ - BODY_RADIUS) {
    return { x, z, valid: false, reason: 'That spot is outside the building.' }
  }
  if (world.stairs?.some(link => stairProgress(point, link) !== null)) return { x, z, valid: false, reason: 'That spot is on the stairs. Pick clear floor.' }
  if (world.colliders.some(solid => intersectsSolid(point, solid))) {
    return { x, z, valid: false, reason: 'That spot is blocked. Pick clear floor.' }
  }
  return { x, z, valid: true, reason: 'Click to start walking here.' }
}

/** The clear spot nearest the middle of the plan, for starting without pointing at the model. */
export function suggestSpawn(world) {
  const cx = (world.minX + world.maxX) / 2, cz = (world.minZ + world.maxZ) / 2
  const reach = Math.hypot(world.maxX - world.minX, world.maxZ - world.minZ) / 2
  for (let radius = 0; radius <= reach; radius += 0.25) {
    const steps = Math.max(1, Math.ceil(radius * 8))
    for (let i = 0; i < steps; i++) {
      const angle = i / steps * Math.PI * 2
      const point = { x: cx + Math.cos(angle) * radius, z: cz + Math.sin(angle) * radius }
      if (placementAt(point, world).valid) return point
    }
  }
  return null
}

/** Substeps prevent tunneling; resolving each axis separately permits wall sliding. */
export function moveWithCollision(position, delta, world) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(delta.x), Math.abs(delta.z)) / (BODY_RADIUS * 0.45)))
  let result = { x: position.x, z: position.z }
  for (let i = 0; i < steps; i++) {
    const nextX = { x: result.x + delta.x / steps, z: result.z }
    if (!isBlocked(nextX, world)) result = nextX
    const nextZ = { x: result.x, z: result.z + delta.z / steps }
    if (!isBlocked(nextZ, world)) result = nextZ
  }
  return result
}

/**
 * One move through the building. Past the middle of a flight you belong to the floor at its other
 * end, whose walls and guard then apply. Substeps keep a fast move from skipping that change.
 */
export function walkStep(position, delta, building) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(delta.x), Math.abs(delta.z)) / (BODY_RADIUS * 0.45)))
  let { x, z, floor } = position
  for (let i = 0; i < steps; i++) {
    ({ x, z } = moveWithCollision({ x, z }, { x: delta.x / steps, z: delta.z / steps }, building.floors[floor]))
    for (const link of building.floors[floor].stairs) {
      const progress = stairProgress({ x, z }, link)
      if (progress !== null) { floor = link.floor + (progress >= 0.5 ? 1 : 0); break }
    }
  }
  return { x, z, floor }
}

/** Standing height: the floor's level, or partway up a flight. */
export function walkHeight(position, building) {
  const world = building.floors[position.floor]
  for (const link of world.stairs) {
    const progress = stairProgress(position, link)
    if (progress !== null) return floorBase(link.floor) + progress * WALL_HEIGHT
  }
  return world.floorY
}

export function walkingVector(forward, right, yaw) {
  const length = Math.max(1, Math.hypot(forward, right))
  return { x: (-Math.sin(yaw) * forward + Math.cos(yaw) * right) * WALK_SPEED / length,
    z: (-Math.cos(yaw) * forward - Math.sin(yaw) * right) * WALK_SPEED / length }
}

/** A moderate 75° horizontal view, capped at 65° vertical on narrow displays. */
export function humanFov(aspect) {
  return Math.min(65, 2 * Math.atan(Math.tan(75 * Math.PI / 360) / Math.max(0.1, aspect)) * 180 / Math.PI)
}
