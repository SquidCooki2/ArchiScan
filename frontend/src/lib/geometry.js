export const WALL_HEIGHT = 2.7

// Image-space clockwise angles become negative Y rotations in three.js.
export function computeBounds(walls) {
  if (!walls.length) return { minX: -4, maxX: 4, minZ: -4, maxZ: 4, cx: 0, cz: 0, size: 8, width: 8, depth: 8 }
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
  return { minX, maxX, minZ, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, size: Math.max(width, depth), width, depth }
}

export function validateWalls(walls) {
  if (!Array.isArray(walls) || !walls.length) throw new Error('No walls were found. Try a clearer floorplan image.')
  if (!walls.every(w => w && ['x', 'z', 'width', 'depth', 'rotation'].every(key => Number.isFinite(w[key])) && w.width > 0 && w.depth > 0 && w.rotation >= 0 && w.rotation < Math.PI)) {
    throw new Error('The server returned invalid wall geometry. Please try another floorplan.')
  }
  return walls
}
