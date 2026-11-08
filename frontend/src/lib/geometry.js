export const WALL_HEIGHT = 2.7
export const PLAN_CUT_HEIGHT = 1.2
export const MIN_CUT_HEIGHT = 0.1
export const STRUCTURAL_TYPES = ['wall', 'window', 'door', 'stairs']
export const FURNITURE_TYPES = ['couch', 'chair', 'fridge', 'sink', 'bed', 'wardrobe', 'cabinet', 'toilet', 'table', 'bath']
export const ELEMENT_TYPES = [...STRUCTURAL_TYPES, ...FURNITURE_TYPES]
export const elementType = element => element.type ?? 'wall'
export const isFurniture = element => FURNITURE_TYPES.includes(elementType(element))
export const isStairs = element => elementType(element) === 'stairs'
/** Walls, windows, and doors: what encloses rooms. Stairs and furniture stand inside them. */
export const isEnclosure = element => ['wall', 'window', 'door'].includes(elementType(element))
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

/**
 * A staircase's rectangle in the walls' convention, with local +X pointing up the flight. The API
 * gives stairs a compass-style facing instead (0 = +Z, PI/2 = +X), so the two can't be mixed directly.
 */
export const stairRect = stair => ({ x: stair.x, z: stair.z, width: stair.width, depth: stair.depth, rotation: Math.PI / 2 - stair.rotation })

export function countElements(elements) {
  const counts = { wall: 0, window: 0, door: 0, stairs: 0, furniture: 0 }
  for (const element of elements) counts[isFurniture(element) ? 'furniture' : elementType(element)]++
  return counts
}

// Image-space clockwise angles become negative Y rotations in three.js.
/** A stairwell's corners in plan as [x, z], held inside `area` so an opening can't break its edge. */
export function stairwellCorners(stair, area, margin = 0) {
  const { x, z, width, depth, rotation } = stairRect(stair)
  const c = Math.cos(rotation), s = Math.sin(rotation)
  const clamp = (value, low, high) => Math.min(high - margin, Math.max(low + margin, value))
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
    const along = a * width / 2, across = b * depth / 2
    return [clamp(x + c * along - s * across, area.minX, area.maxX), clamp(z + s * along + c * across, area.minZ, area.maxZ)]
  })
}

export function computeBounds(elements) {
  // Furniture has no size in the data and always stands inside the building.
  const walls = elements.filter(element => !isFurniture(element)).map(element => (isStairs(element) ? stairRect(element) : element))
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

const isNumber = Number.isFinite

export function validElement(element) {
  if (!element || (element.floor !== undefined && (!Number.isInteger(element.floor) || element.floor < 0))) return false
  if (!ELEMENT_TYPES.includes(element.type === undefined ? 'wall' : element.type)) return false
  if (!isNumber(element.x) || !isNumber(element.z) || !isNumber(element.rotation)) return false
  // Stairs and furniture face any way around the circle. A wall's rotation only needs a half turn.
  const turn = isEnclosure(element) ? Math.PI : Math.PI * 2
  if (element.rotation < 0 || element.rotation >= turn) return false
  if (isFurniture(element)) return true
  if (!isNumber(element.width) || !isNumber(element.depth) || element.width <= 0 || element.depth <= 0) return false
  if (!['window', 'door'].includes(elementType(element))) return true
  if (element.sillHeight !== undefined && !isNumber(element.sillHeight)) return false
  const { sillHeight, height } = openingDimensions(element)
  return isNumber(sillHeight) && sillHeight >= 0 && sillHeight < WALL_HEIGHT && isNumber(height) && height > 0
    && (element.height === undefined || (isNumber(element.height) && element.height > 0))
}

export function validateWalls(walls) {
  if (!Array.isArray(walls) || !walls.some(element => element && isEnclosure(element))) throw new Error('No walls were found. Try a clearer floorplan image.')
  if (!walls.every(validElement)) throw new Error('The server returned invalid wall geometry or opening dimensions. Please try another floorplan.')
  return walls
}
