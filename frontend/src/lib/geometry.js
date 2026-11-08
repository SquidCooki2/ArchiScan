/** Wall height in meters. Not part of the API payload (see docs/project_level_plan.md section 5). */
export const WALL_HEIGHT = 2.7

/** Conventional plan-cut height used in architectural floor plans. */
export const PLAN_CUT_HEIGHT = 1.2

/** Lowest height the section slider can reach. */
export const MIN_CUT_HEIGHT = 0.1

export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/**
 * Axis-aligned bounds of the plan, in meters, using each wall's rotated footprint.
 * Returns { minX, maxX, minZ, maxZ, cx, cz, sizeX, sizeZ, size }.
 */
export function computeBounds(walls) {
  if (!walls?.length) {
    return { minX: 0, maxX: 0, minZ: 0, maxZ: 0, cx: 0, cz: 0, sizeX: 0, sizeZ: 0, size: 0 }
  }
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const w of walls) {
    const c = Math.abs(Math.cos(w.rotation))
    const s = Math.abs(Math.sin(w.rotation))
    const hx = (c * w.width + s * w.depth) / 2
    const hz = (s * w.width + c * w.depth) / 2
    minX = Math.min(minX, w.x - hx)
    maxX = Math.max(maxX, w.x + hx)
    minZ = Math.min(minZ, w.z - hz)
    maxZ = Math.max(maxZ, w.z + hz)
  }
  const sizeX = maxX - minX
  const sizeZ = maxZ - minZ
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    sizeX,
    sizeZ,
    size: Math.max(sizeX, sizeZ),
  }
}

export function formatMeters(value, digits = 2) {
  return `${value.toFixed(digits)} m`
}

export function formatBytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
