/**
 * Texture coordinates in meters for a flat list of triangles, so a surface's pattern runs on at the
 * same scale from one piece to the next, without a seam. Level faces use plan X and Z. Anything else
 * uses its own direction along the face and straight up the slope, so boards stay level and roof
 * rows run along the eaves.
 */
export function surfaceUvs(positions) {
  const uvs = new Float32Array(positions.length / 3 * 2)
  for (let t = 0; t < positions.length; t += 9) {
    const [ax, ay, az] = [positions[t], positions[t + 1], positions[t + 2]]
    const ux = positions[t + 3] - ax, uy = positions[t + 4] - ay, uz = positions[t + 5] - az
    const vx = positions[t + 6] - ax, vy = positions[t + 7] - ay, vz = positions[t + 8] - az
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    const length = Math.hypot(nx, ny, nz) || 1
    nx /= length; ny /= length; nz /= length
    const level = Math.abs(ny) > 0.99
    const flat = Math.hypot(nx, nz) || 1
    const rightX = nz / flat, rightZ = -nx / flat
    // Up the slope: the normal crossed with the direction along the face.
    const upX = ny * rightZ, upY = nz * rightX - nx * rightZ, upZ = -ny * rightX
    const sign = upY < 0 ? -1 : 1
    for (let i = 0; i < 3; i++) {
      const x = positions[t + i * 3], y = positions[t + i * 3 + 1], z = positions[t + i * 3 + 2]
      const at = t / 9 * 6 + i * 2
      uvs[at] = level ? x : x * rightX + z * rightZ
      uvs[at + 1] = level ? z : (x * upX + y * upY + z * upZ) * sign
    }
  }
  return uvs
}
