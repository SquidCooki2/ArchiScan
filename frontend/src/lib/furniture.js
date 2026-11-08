import { elementFloor, elementType, isFurniture } from './geometry.js'

/**
 * Real-world bounding boxes in meters as [width, height, depth], with the front facing local +Z.
 * Models with a `model` come from public/assets/furniture, authored about 1.5x too large in game
 * units, and are fitted to these boxes. The rest are fixtures the pack doesn't include.
 */
export const FURNITURE = {
  couch: { model: 'couch', size: [2.0, 0.85, 0.92] },
  chair: { model: 'chair_A', size: [0.46, 0.88, 0.5], movable: true },
  table: { model: 'table_medium_long', size: [1.6, 0.75, 0.85] },
  bed: { model: 'bed_double_A', size: [1.6, 0.55, 2.05] },
  cabinet: { model: 'cabinet_medium', size: [1.2, 0.85, 0.5] },
  wardrobe: { model: 'cabinet_medium', size: [1.2, 2.0, 0.6] },
  fridge: { size: [0.7, 1.8, 0.7], fixture: true },
  sink: { size: [0.6, 0.86, 0.5], fixture: true },
  toilet: { size: [0.4, 0.76, 0.68], fixture: true },
  bath: { size: [1.7, 0.56, 0.76], fixture: true },
}

/** Where a model lives. Under Vite's base path, so it also works from a subfolder. */
export const modelUrl = name => `${import.meta.env?.BASE_URL ?? '/'}assets/furniture/${name}.gltf`

/** The [x, y, z] scale that takes a model from its raw size to the target box. */
export const fitScale = (rawSize, size) => size.map((target, axis) => target / rawSize[axis])

/**
 * The floor area a piece takes up, in the walls' convention. Facing `rotation` turns the model about
 * +Y, which turns its local +X toward -rotation in plan.
 */
export function furnitureRect(item) {
  const [width, , depth] = FURNITURE[elementType(item)].size
  return { x: item.x, z: item.z, width, depth, rotation: -item.rotation }
}

/** Fixed pieces block a fire escape. Chairs don't: anyone can shove one aside. */
export const routeObstacles = (elements, floor) => elements
  .filter(element => isFurniture(element) && elementFloor(element) === floor && !FURNITURE[elementType(element)].movable)
  .map(furnitureRect)
