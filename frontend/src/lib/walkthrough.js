import { elementParts } from './elementParts.js'
import { elementFloor, floorBase } from './geometry.js'

export const EYE_HEIGHT = 1.65
export const BODY_HEIGHT = 1.8
export const BODY_RADIUS = 0.2
export const WALK_SPEED = 1.4

/** Meter-scale collision geometry is independent of overview section clipping. */
export function buildWalkWorld(elements, bounds, { openDoors = true, floor = 0 } = {}) {
  const colliders = elements.filter(element => elementFloor(element) === floor).flatMap(element => elementParts(element, { openDoors }))
    .filter(part => part.bottom < BODY_HEIGHT && part.top > 0.001)
    .map(part => {
      const c = Math.cos(part.rotation), s = Math.sin(part.rotation)
      return { x: part.x - bounds.cx, z: part.z - bounds.cz, c, s,
        halfWidth: part.width / 2, halfDepth: part.depth / 2,
        extentX: (Math.abs(c) * part.width + Math.abs(s) * part.depth) / 2,
        extentZ: (Math.abs(s) * part.width + Math.abs(c) * part.depth) / 2 }
    })
  return { colliders, floorY: floorBase(floor), minX: -bounds.width / 2, maxX: bounds.width / 2, minZ: -bounds.depth / 2, maxZ: bounds.depth / 2 }
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

export function placementAt(point, world) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return { valid: false, reason: 'Click a spot on the floor.' }
  const { x, z } = point
  if (x < world.minX + BODY_RADIUS || x > world.maxX - BODY_RADIUS || z < world.minZ + BODY_RADIUS || z > world.maxZ - BODY_RADIUS) {
    return { x, z, valid: false, reason: 'That spot is outside the building.' }
  }
  if (world.colliders.some(collider => intersectsSolid(point, collider))) {
    return { x, z, valid: false, reason: 'That spot is inside a wall. Pick clear floor.' }
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
    if (placementAt(nextX, world).valid) result = nextX
    const nextZ = { x: result.x, z: result.z + delta.z / steps }
    if (placementAt(nextZ, world).valid) result = nextZ
  }
  return result
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
