import { elementFloor, elementType, isEnclosure, isFurniture } from './geometry.js'

// The Kenney fixtures are authored facing -Z, the opposite way from the KayKit furniture.
const HALF_TURN = Math.PI

/**
 * Real-world bounding boxes in meters as [width, height, depth], with the front facing local +Z.
 * Models come from public/assets/furniture (see SOURCES.md) and are fitted to these boxes. The boxes
 * stay close to each model's own proportions, because stretching one much further makes it a lump.
 */
export const FURNITURE = {
  couch: { model: 'couch.gltf', size: [2.0, 0.82, 1.0] },
  chair: { model: 'chair_A_wood.gltf', size: [0.46, 0.88, 0.5], movable: true },
  table: { model: 'table_medium_long.gltf', size: [1.5, 0.74, 0.95] },
  bed: { model: 'bed_double_B.gltf', size: [1.6, 0.58, 2.05] },
  cabinet: { model: 'cabinet_medium.gltf', size: [1.2, 0.75, 0.55] },
  wardrobe: { model: 'cabinet_medium.gltf', size: [1.2, 2.0, 0.6] },
  fridge: { model: 'fridge.glb', size: [0.78, 1.8, 0.68], turn: HALF_TURN },
  sink: { model: 'sink_kitchen.glb', size: [0.6, 0.88, 0.52], turn: HALF_TURN },
  toilet: { model: 'toilet.glb', size: [0.44, 0.76, 0.68], turn: HALF_TURN },
  bath: { model: 'bathtub.glb', size: [1.7, 0.56, 0.76], turn: HALF_TURN },
}

/** Every model the viewer draws: the contract's types, plus the look a sink takes in a bathroom. */
export const FURNITURE_MODELS = {
  ...FURNITURE,
  bathroomSink: { model: 'sink_bathroom.glb', size: [0.6, 0.88, 0.46], turn: HALF_TURN },
}

/** Where a model lives. Under Vite's base path, so it also works from a subfolder. */
export const modelUrl = file => `${import.meta.env?.BASE_URL ?? '/'}assets/furniture/${file}`

/** The [x, y, z] scale that takes a model from its raw size to the target box. */
export const fitScale = (rawSize, size) => size.map((target, axis) => target / rawSize[axis])

/**
 * The floor area a piece takes up, in the walls' convention. Facing `rotation` turns the model about
 * +Y, which turns its local +X toward -rotation in plan.
 */
export function furnitureRect(item) {
  const [width, , depth] = FURNITURE[elementType(item)].size
  return { x: item.x, z: item.z, width: width * (item.fitWidth ?? 1), depth: depth * (item.fitDepth ?? 1), rotation: -item.rotation }
}

const BATHROOM_REACH = 3

/** Whether a straight line from a to b passes through a rectangle in the walls' convention. */
export function lineCrosses(a, b, rect) {
  const c = Math.cos(rect.rotation), s = Math.sin(rect.rotation)
  const local = point => [(point.x - rect.x) * c + (point.z - rect.z) * s, -(point.x - rect.x) * s + (point.z - rect.z) * c]
  const [ax, az] = local(a), [bx, bz] = local(b)
  let enter = 0, leave = 1
  for (const [start, change, half] of [[ax, bx - ax, rect.width / 2], [az, bz - az, rect.depth / 2]]) {
    if (Math.abs(change) < 1e-9) { if (Math.abs(start) > half) return false; continue }
    const first = (-half - start) / change, second = (half - start) / change
    enter = Math.max(enter, Math.min(first, second))
    leave = Math.min(leave, Math.max(first, second))
    if (enter > leave) return false
  }
  return true
}

/**
 * Which model draws an item. The contract has one sink, so a sink in the same room as a toilet or bath
 * (close by, with no wall between them) takes the pedestal basin, and any other the kitchen unit.
 */
export function drawnModel(item, elements) {
  const type = elementType(item)
  if (type !== 'sink') return type
  const floor = elementFloor(item)
  const here = elements.filter(element => elementFloor(element) === floor)
  const walls = here.filter(isEnclosure)
  const inBathroom = here.some(other => ['toilet', 'bath'].includes(elementType(other))
    && Math.hypot(other.x - item.x, other.z - item.z) <= BATHROOM_REACH
    && !walls.some(wall => lineCrosses(item, other, wall)))
  return inBathroom ? 'bathroomSink' : 'sink'
}

/** Fixed pieces block a fire escape. Chairs don't: anyone can shove one aside. */
export const routeObstacles = (elements, floor) => elements
  .filter(element => isFurniture(element) && elementFloor(element) === floor && !FURNITURE[elementType(element)].movable)
  .map(furnitureRect)
