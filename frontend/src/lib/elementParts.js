import { elementFloor, elementType, floorCount, isFurniture, isStairs, openingDimensions, stairRect, WALL_HEIGHT } from './geometry.js'

export const STAIR_STEPS = Math.max(8, Math.round(WALL_HEIGHT / 0.18))
const CHEEK = 0.04
const STRING_RISE = 0.14
const RAIL_HEIGHT = 0.95
const RAIL_SIZE = 0.04
const POST_SIZE = 0.028
const STEPS_PER_POST = 3
// The lowest steps have no sides, so a flight that lands against a wall can still be stepped off.
export const STAIR_OPEN_FOOT = 0.7
const QUARTER_TURN = Math.PI / 2
const NEARLY_SQUARE = 0.002

/** Plans round a quarter turn to 1.571, so neighboring pieces miss by a hair and show cracks. Square them up. */
export function squared(rotation) {
  const nearest = Math.round(rotation / QUARTER_TURN) * QUARTER_TURN
  return Math.abs(rotation - nearest) < NEARLY_SQUARE ? nearest : rotation
}

/** Everything drawn as prisms: all but furniture, plus the guard around each stairwell above. */
export function structuralElements(elements) {
  const floors = floorCount(elements)
  const guards = elements.filter(element => isStairs(element) && elementFloor(element) + 1 < floors)
    .map(stair => ({ ...stair, type: 'stairGuard', floor: elementFloor(stair) + 1 }))
  return [...elements.filter(element => !isFurniture(element)), ...guards]
}

/** Renderable prisms in the element's local orientation, with actual vertical spans. */
export function elementParts(element, { openDoors = false } = {}) {
  const parts = []
  const type = elementType(element)
  const rotation = squared(type === 'stairs' || type === 'stairGuard' ? stairRect(element).rotation : element.rotation)
  const add = (role, x, z, width, depth, bottom, top, slope = 0) => {
    if (width <= 1e-7 || depth <= 1e-7 || top - bottom <= 1e-7) return
    const c = Math.cos(rotation), s = Math.sin(rotation)
    parts.push({ role, x: element.x + c * x - s * z, z: element.z + s * x + c * z,
      width, depth, rotation, bottom, top, ...(slope ? { slope } : {}) })
  }
  const { width, depth } = element
  if (type === 'stairs') {
    // Solid steps between closed strings, climbing along local +X, with a handrail on slim posts.
    const tread = width / STAIR_STEPS, rise = WALL_HEIGHT / STAIR_STEPS
    const side = [-1, 1]
    for (let step = 0; step < STAIR_STEPS; step++) {
      const x = -width / 2 + (step + 0.5) * tread, top = (step + 1) * rise
      add('wall', x, 0, tread, depth - CHEEK, 0, top)
      if ((step + 1) * tread <= STAIR_OPEN_FOOT) continue
      for (const edge of side) add('string', x, edge * (depth - CHEEK) / 2, tread, CHEEK, 0, top + STRING_RISE)
    }
    const firstSided = Math.ceil(STAIR_OPEN_FOOT / tread)
    for (let step = firstSided; step < STAIR_STEPS; step += STEPS_PER_POST) {
      const x = -width / 2 + (step + 0.5) * tread, top = (step + 1) * rise
      for (const edge of side) add('rail', x, edge * (depth - CHEEK) / 2, POST_SIZE, POST_SIZE, top, top + RAIL_HEIGHT)
    }
    // One long bar, sheared to the pitch of the flight when it's drawn.
    const start = -width / 2 + firstSided * tread
    const center = (start + width / 2) / 2
    const pitch = rise / tread
    const railY = WALL_HEIGHT / 2 + center * pitch + RAIL_HEIGHT
    for (const edge of side) add('rail', center, edge * (depth - CHEEK) / 2, width / 2 - start, RAIL_SIZE, railY - RAIL_SIZE / 2, railY + RAIL_SIZE / 2, pitch)
    return parts
  }
  if (type === 'stairGuard') {
    // Stops anyone upstairs stepping into the well. The head of the flight stays open.
    const postsAlong = Math.max(1, Math.round(width / 1))
    for (const edge of [-1, 1]) {
      const z = edge * (depth - CHEEK) / 2
      add('string', 0, z, width, CHEEK, 0, STRING_RISE)
      add('rail', 0, z, width, RAIL_SIZE, RAIL_HEIGHT - RAIL_SIZE, RAIL_HEIGHT)
      for (let post = 0; post <= postsAlong; post++) {
        add('rail', -width / 2 + POST_SIZE / 2 + post / postsAlong * (width - POST_SIZE), z, POST_SIZE, POST_SIZE, STRING_RISE, RAIL_HEIGHT - RAIL_SIZE)
      }
    }
    const foot = -width / 2 + CHEEK / 2
    add('string', foot, 0, CHEEK, depth, 0, STRING_RISE)
    add('rail', foot, 0, RAIL_SIZE, depth, RAIL_HEIGHT - RAIL_SIZE, RAIL_HEIGHT)
    return parts
  }
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
    const hingeX = element.x - Math.cos(rotation) * leaf.width / 2
    const hingeZ = element.z - Math.sin(rotation) * leaf.width / 2
    return parts.map(part => {
      if (!['door', 'doorPanel', 'hardware'].includes(part.role)) return part
      const x = part.x - hingeX, z = part.z - hingeZ
      return { ...part, x: hingeX - z, z: hingeZ + x, rotation: part.rotation + Math.PI / 2 }
    })
  }
  return parts
}
