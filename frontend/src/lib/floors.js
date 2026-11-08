import { computeBounds, WALL_HEIGHT } from './geometry.js'

export const elementFloor = element => element.floor ?? 0
export const floorElevation = floor => floor * WALL_HEIGHT

/** The backend supplies floor indices, not elevations, slabs, or room polygons. */
export function buildingFloors(elements) {
  const groups = new Map()
  for (const element of elements) {
    const id = elementFloor(element)
    if (!groups.has(id)) groups.set(id, [])
    groups.get(id).push(element)
  }
  return [...groups].sort(([a], [b]) => a - b).map(([id, walls]) => ({
    id, label: `Floor ${id + 1}`, elevation: floorElevation(id), height: WALL_HEIGHT,
    walls, bounds: computeBounds(walls),
  }))
}

export function buildingBounds(elements, floors = buildingFloors(elements)) {
  const bounds = computeBounds(elements)
  const minY = floors.length ? Math.min(...floors.map(f => f.elevation)) : 0
  const maxY = floors.length ? Math.max(...floors.map(f => f.elevation + f.height)) : WALL_HEIGHT
  return { ...bounds, minY, maxY, height: maxY - minY }
}
