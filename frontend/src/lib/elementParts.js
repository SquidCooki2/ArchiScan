import { elementType, openingDimensions, WALL_HEIGHT } from './geometry.js'

/** Renderable prisms in the element's local orientation, with actual vertical spans. */
export function elementParts(element, { openDoors = false } = {}) {
  const parts = []
  const add = (role, x, z, width, depth, bottom, top) => {
    if (width <= 1e-7 || depth <= 1e-7 || top - bottom <= 1e-7) return
    const c = Math.cos(element.rotation), s = Math.sin(element.rotation)
    parts.push({ role, x: element.x + c * x - s * z, z: element.z + s * x + c * z,
      width, depth, rotation: element.rotation, bottom, top })
  }
  const { width, depth } = element
  const type = elementType(element)
  if (type === 'wall') {
    add('wall', 0, 0, width, depth, 0, WALL_HEIGHT)
    return parts
  }
  const { sillHeight: sill, height } = openingDimensions(element)
  const top = sill + height
  // Reconstruct the host wall beneath the sill and above the opening.
  add('wall', 0, 0, width, depth, 0, sill)
  add('wall', 0, 0, width, depth, top, WALL_HEIGHT)
  const frame = Math.min(0.055, width * 0.12, height * 0.12, depth * 0.45)
  const frameDepth = depth * 0.8
  add('frame', -width / 2 + frame / 2, 0, frame, frameDepth, sill, top)
  add('frame', width / 2 - frame / 2, 0, frame, frameDepth, sill, top)
  add('frame', 0, 0, width - 2 * frame, frameDepth, top - frame, top)

  if (type === 'window') {
    add('frame', 0, 0, width - 2 * frame, frameDepth, sill, sill + frame)
    const mullion = frame * 0.7
    add('frame', 0, 0, mullion, frameDepth, sill + frame, top - frame)
    const paneWidth = (width - 2 * frame - mullion) / 2
    for (const side of [-1, 1]) {
      add('glass', side * (paneWidth + mullion) / 2, 0, paneWidth, Math.min(0.014, depth * 0.15), sill + frame, top - frame)
    }
  } else {
    const gap = Math.min(0.015, height * 0.05, width * 0.02)
    const leafWidth = width - 2 * frame - gap
    const leafDepth = Math.min(0.045, depth * 0.4)
    const leafBottom = sill + gap, leafTop = top - frame - gap
    add('door', 0, 0, leafWidth, leafDepth, leafBottom, leafTop)
    // Closed leaves are intentional: no hinge side or swing angle is supplied.
    const leafHeight = leafTop - leafBottom
    for (const side of [-1, 1]) {
      for (const fraction of [0.28, 0.72]) {
        const center = leafBottom + leafHeight * fraction
        add('doorPanel', 0, side * (leafDepth / 2 + 0.002), leafWidth * 0.76, 0.004, center - leafHeight * 0.16, center + leafHeight * 0.16)
      }
      const handleY = sill + Math.min(1, height * 0.5)
      const handleX = leafWidth * 0.34
      add('hardware', handleX, side * (leafDepth / 2 + 0.012), Math.min(0.035, leafWidth * 0.08), 0.02, handleY - Math.min(0.06, height * 0.05), handleY + Math.min(0.06, height * 0.05))
      add('hardware', handleX - leafWidth * 0.05, side * (leafDepth / 2 + 0.03), Math.min(0.12, leafWidth * 0.25), 0.025, handleY - Math.min(0.012, height * 0.02), handleY + Math.min(0.012, height * 0.02))
    }
  }
  if (openDoors && type === 'door') {
    const leaf = parts.find(part => part.role === 'door')
    if (!leaf) return parts
    const hingeX = element.x - Math.cos(element.rotation) * leaf.width / 2
    const hingeZ = element.z - Math.sin(element.rotation) * leaf.width / 2
    return parts.map(part => {
      if (!['door', 'doorPanel', 'hardware'].includes(part.role)) return part
      const x = part.x - hingeX, z = part.z - hingeZ
      return { ...part, x: hingeX - z, z: hingeZ + x, rotation: part.rotation + Math.PI / 2 }
    })
  }
  return parts
}
