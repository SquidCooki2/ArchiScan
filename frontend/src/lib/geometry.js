export const WALL_HEIGHT = 2.7
export const PLAN_CUT_HEIGHT = 1.2
export const MIN_CUT_HEIGHT = 0.1
export const ELEMENT_TYPES = ['wall', 'window', 'door']
export const elementType = element => element.type ?? 'wall'
export const MAX_FLOORS = 5

/** A missing floor means the ground floor, so single-floor payloads stay valid. */
export const elementFloor = element => element.floor ?? 0
export const floorBase = floor => floor * WALL_HEIGHT
export const floorCount = elements => elements.reduce((count, element) => Math.max(count, elementFloor(element) + 1), 1)

export function openingDimensions(element) {
  const window = elementType(element) === 'window'
  const sillHeight = element.sillHeight ?? (window ? 0.9 : 0)
  return { sillHeight, height: Math.min(element.height ?? (window ? 1.2 : 2.1), WALL_HEIGHT - sillHeight) }
}

export function countElements(elements) {
  const counts = { wall: 0, window: 0, door: 0 }
  for (const element of elements) counts[elementType(element)]++
  return counts
}

// Image-space clockwise angles become negative Y rotations in three.js.
export function computeBounds(walls) {
  if (!walls.length) return { minX: -4, maxX: 4, minZ: -4, maxZ: 4, cx: 0, cz: 0, size: 8, width: 8, depth: 8, sizeX: 8, sizeZ: 8 }
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const wall of walls) {
    const c = Math.abs(Math.cos(wall.rotation))
    const s = Math.abs(Math.sin(wall.rotation))
    const dx = (c * wall.width + s * wall.depth) / 2
    const dz = (s * wall.width + c * wall.depth) / 2
    minX = Math.min(minX, wall.x - dx)
    maxX = Math.max(maxX, wall.x + dx)
    minZ = Math.min(minZ, wall.z - dz)
    maxZ = Math.max(maxZ, wall.z + dz)
  }
  const width = maxX - minX, depth = maxZ - minZ
  return { minX, maxX, minZ, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, size: Math.max(width, depth), width, depth, sizeX: width, sizeZ: depth }
}

export function validateWalls(walls) {
  if (!Array.isArray(walls) || !walls.length) throw new Error('No walls were found. Try a clearer floorplan image.')
  if (!walls.every(w => {
    if (!w || (w.floor !== undefined && (!Number.isInteger(w.floor) || w.floor < 0)) || !ELEMENT_TYPES.includes(w.type === undefined ? 'wall' : w.type) || !['x', 'z', 'width', 'depth', 'rotation'].every(key => Number.isFinite(w[key])) || w.width <= 0 || w.depth <= 0 || w.rotation < 0 || w.rotation >= Math.PI) return false
    if (elementType(w) === 'wall') return true
    if (w.sillHeight !== undefined && !Number.isFinite(w.sillHeight)) return false
    const { sillHeight, height } = openingDimensions(w)
    return Number.isFinite(sillHeight) && sillHeight >= 0 && sillHeight < WALL_HEIGHT && Number.isFinite(height) && height > 0
      && (w.height === undefined || (Number.isFinite(w.height) && w.height > 0))
  })) {
    throw new Error('The server returned invalid wall geometry or opening dimensions. Please try another floorplan.')
  }
  return walls
}
