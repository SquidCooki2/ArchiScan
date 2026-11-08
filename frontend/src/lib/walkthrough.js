import { elementParts } from './elementParts.js'

export const EYE_HEIGHT = 1.65
export const BODY_HEIGHT = 1.8
export const BODY_RADIUS = 0.2
export const WALK_SPEED = 1.4
export const HUMAN_DRAG_TYPE = 'application/x-archiscan-human'

/** Meter-scale collision geometry is independent of overview section clipping. */
export function buildWalkWorld(elements, bounds, { openDoors = true } = {}) {
  const colliders = elements.flatMap(element => elementParts(element, { openDoors }))
    .filter(part => part.bottom < BODY_HEIGHT && part.top > 0.001)
    .map(part => {
      const c = Math.cos(part.rotation), s = Math.sin(part.rotation)
      return { x: part.x - bounds.cx, z: part.z - bounds.cz, c, s,
        halfWidth: part.width / 2, halfDepth: part.depth / 2,
        extentX: (Math.abs(c) * part.width + Math.abs(s) * part.depth) / 2,
        extentZ: (Math.abs(s) * part.width + Math.abs(c) * part.depth) / 2 }
    })
  return { colliders, minX: -bounds.width / 2, maxX: bounds.width / 2, minZ: -bounds.depth / 2, maxZ: bounds.depth / 2 }
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
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return { valid: false, reason: 'Choose a point on the model floor.' }
  const { x, z } = point
  if (x < world.minX + BODY_RADIUS || x > world.maxX - BODY_RADIUS || z < world.minZ + BODY_RADIUS || z > world.maxZ - BODY_RADIUS) {
    return { x, z, valid: false, reason: 'Stay inside the model floor with room for the person.' }
  }
  if (world.colliders.some(collider => intersectsSolid(point, collider))) {
    return { x, z, valid: false, reason: 'This spot intersects a wall, window, or solid object. Choose clear floor.' }
  }
  return { x, z, valid: true, reason: 'Clear floor. Ready to enter at 1.65 m eye height.' }
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
