import { computeBounds } from './geometry.js'
import { rasterizeFootprint, toFrame } from './roof.js'

/**
 * Fire escape routing, in plan coordinates (meters, the same frame as the API elements).
 *
 * The route comes from a deterministic search on a floor grid, never from a language model, so it
 * can only pass through openings that exist in the plan. Walls and windows block; doors and gaps
 * are open. The fire spreads along walkable paths, so a wall really does protect the room behind it.
 *
 *   buildEvacuationMap(elements)  static: grid, building footprint, rooms, doors, windows
 *   computeFireField(map, fire)   walking distance from the fire to every cell
 *   planEvacuation(map, fire, person)  the route, its backup, and the written steps
 */

/** No route comes closer to the fire than this, in meters of walking distance. */
export const HAZARD_RADIUS = 1.5
/** Routes prefer to stay this far from the fire, in meters of walking distance. */
export const SMOKE_RADIUS = 6

/** A door route that passes closer than this loses to a window that stays farther from the fire. */
const SAFE_PASSING_DISTANCE = 2.5

const CELL = 0.1
const MAX_CELLS = 250_000
const MARGIN = 2.2 // grid margin around the plan, so routes can continue outside
const CLEARANCE = 0.18 // half a person's width; narrower openings aren't walkable
const WALL_COMFORT = 0.45 // routes drift toward the middle of a corridor within this distance
const CLEAR_OF_BUILDING = 1.2 // a route ends this far outside the footprint
const MIN_ROOM_AREA = 1.5
const WALKING_SPEED = 1.2 // meters per second

const SOLID = 1
const DOOR = 2
const OBSTACLE = 3

const STEPS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
]

/** Writes `value` into every cell an element's rectangle covers. */
function paint(grid, element, value, padWidth, padDepth) {
  const { nx, nz, cell, originX, originZ, kind } = grid
  const c = Math.cos(element.rotation), s = Math.sin(element.rotation)
  const hx = element.width / 2 + padWidth, hz = element.depth / 2 + padDepth
  const ex = Math.abs(c) * hx + Math.abs(s) * hz, ez = Math.abs(s) * hx + Math.abs(c) * hz
  const i0 = Math.max(0, Math.floor((element.x - ex - originX) / cell)), i1 = Math.min(nx - 1, Math.ceil((element.x + ex - originX) / cell))
  const j0 = Math.max(0, Math.floor((element.z - ez - originZ) / cell)), j1 = Math.min(nz - 1, Math.ceil((element.z + ez - originZ) / cell))
  for (let j = j0; j <= j1; j++) {
    const dz = originZ + (j + 0.5) * cell - element.z
    for (let i = i0; i <= i1; i++) {
      const dx = originX + (i + 0.5) * cell - element.x
      if (Math.abs(dx * c + dz * s) <= hx && Math.abs(-dx * s + dz * c) <= hz) kind[j * nx + i] = value
    }
  }
}

/** Two-pass chamfer distance, in meters, to the nearest cell where `isSource` holds. */
function distanceField(nx, nz, cell, isSource) {
  const field = new Float32Array(nx * nz)
  for (let k = 0; k < field.length; k++) field[k] = isSource(k) ? 0 : Infinity
  const relax = (k, n, cost) => { if (field[n] + cost < field[k]) field[k] = field[n] + cost }
  const diagonal = cell * Math.SQRT2
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i
      if (i > 0) relax(k, k - 1, cell)
      if (j > 0) {
        relax(k, k - nx, cell)
        if (i > 0) relax(k, k - nx - 1, diagonal)
        if (i < nx - 1) relax(k, k - nx + 1, diagonal)
      }
    }
  }
  for (let j = nz - 1; j >= 0; j--) {
    for (let i = nx - 1; i >= 0; i--) {
      const k = j * nx + i
      if (i < nx - 1) relax(k, k + 1, cell)
      if (j < nz - 1) {
        relax(k, k + nx, cell)
        if (i < nx - 1) relax(k, k + nx + 1, diagonal)
        if (i > 0) relax(k, k + nx - 1, diagonal)
      }
    }
  }
  return field
}

/** Minimal binary heap of [priority, value], stored in parallel arrays. */
function createHeap() {
  const keys = [], values = []
  return {
    get size() { return keys.length },
    push(key, value) {
      let i = keys.length
      keys.push(key); values.push(value)
      while (i > 0) {
        const parent = (i - 1) >> 1
        if (keys[parent] <= key) break
        keys[i] = keys[parent]; values[i] = values[parent]
        i = parent
      }
      keys[i] = key; values[i] = value
    },
    pop() {
      const top = values[0]
      const key = keys.pop(), value = values.pop()
      const n = keys.length
      if (n) {
        let i = 0
        for (;;) {
          let child = 2 * i + 1
          if (child >= n) break
          if (child + 1 < n && keys[child + 1] < keys[child]) child++
          if (keys[child] >= key) break
          keys[i] = keys[child]; values[i] = values[child]
          i = child
        }
        keys[i] = key; values[i] = value
      }
      return top
    },
  }
}

/** Dijkstra over the grid. Diagonals can't cut a blocked corner. */
function search(map, start, { open, stepCost, isGoal }) {
  const { nx, nz, cell } = map
  const distance = new Float64Array(nx * nz).fill(Infinity)
  const previous = new Int32Array(nx * nz).fill(-1)
  const heap = createHeap()
  distance[start] = 0
  heap.push(0, start)
  while (heap.size) {
    const k = heap.pop()
    if (isGoal?.(k)) return { goal: k, distance, previous }
    const i = k % nx, j = (k - i) / nx
    for (const [di, dj, length] of STEPS) {
      const ni = i + di, nj = j + dj
      if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue
      const n = nj * nx + ni
      if (!open(n) || (di && dj && (!open(j * nx + ni) || !open(nj * nx + i)))) continue
      const next = distance[k] + length * cell * (stepCost ? stepCost(n) : 1)
      if (next < distance[n]) {
        distance[n] = next
        previous[n] = k
        heap.push(next, n)
      }
    }
  }
  return { goal: -1, distance, previous }
}

const cellIndex = (map, point) => {
  const i = Math.floor((point.x - map.originX) / map.cell), j = Math.floor((point.z - map.originZ) / map.cell)
  return i < 0 || j < 0 || i >= map.nx || j >= map.nz ? -1 : j * map.nx + i
}
const cellCenter = (map, k) => {
  const i = k % map.nx
  return { x: map.originX + (i + 0.5) * map.cell, z: map.originZ + ((k - i) / map.nx + 0.5) * map.cell }
}

/** Nearest cell within `reach` meters that passes the test; rings outward from the point. */
function nearestCell(map, point, reach, test) {
  const start = cellIndex(map, point)
  if (start < 0) return -1
  if (test(start)) return start
  const i0 = start % map.nx, j0 = (start - i0) / map.nx
  const rings = Math.ceil(reach / map.cell)
  let best = -1, bestDistance = Infinity
  for (let r = 1; r <= rings; r++) {
    for (let j = j0 - r; j <= j0 + r; j++) {
      for (let i = i0 - r; i <= i0 + r; i++) {
        if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== r || i < 0 || j < 0 || i >= map.nx || j >= map.nz) continue
        const k = j * map.nx + i
        const d = (i - i0) ** 2 + (j - j0) ** 2
        if (d < bestDistance && test(k)) { best = k; bestDistance = d }
      }
    }
    if (best >= 0) return best
  }
  return -1
}

function findRooms(map) {
  const { nx, nz, kind, inside, cell, clearance } = map
  const roomOf = new Int16Array(nx * nz).fill(-1)
  const found = []
  const stack = []
  for (let seed = 0; seed < roomOf.length; seed++) {
    if (!inside[seed] || kind[seed] === SOLID || kind[seed] === DOOR || roomOf[seed] !== -1) continue
    const cells = []
    let center = seed
    roomOf[seed] = found.length
    stack.push(seed)
    while (stack.length) {
      const k = stack.pop()
      cells.push(k)
      if (clearance[k] > clearance[center]) center = k
      const i = k % nx
      for (const n of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, k >= nx ? k - nx : -1, k < nx * (nz - 1) ? k + nx : -1]) {
        if (n < 0 || !inside[n] || kind[n] === SOLID || kind[n] === DOOR || roomOf[n] !== -1) continue
        roomOf[n] = found.length
        stack.push(n)
      }
    }
    found.push({ cells, center, area: cells.length * cell * cell })
  }
  const rooms = found.filter(room => room.area >= MIN_ROOM_AREA).sort((a, b) => b.area - a.area)
  roomOf.fill(-1)
  return {
    roomOf,
    rooms: rooms.map((room, index) => {
      room.cells.forEach(k => { roomOf[k] = index })
      return { id: index, name: `Room ${index + 1}`, area: room.area, center: cellCenter(map, room.center) }
    }),
  }
}

/**
 * Static routing data for one plan. `obstacles` are extra solid rectangles in the element shape
 * ({ x, z, width, depth, rotation }), ready for furniture. They block routes but don't split rooms.
 */
export function buildEvacuationMap(allElements, { obstacles = [], floor = 0 } = {}) {
  const elements = allElements.filter(element => (element.floor ?? 0) === floor)
  const bounds = computeBounds(elements)
  const spanX = bounds.width + 2 * MARGIN, spanZ = bounds.depth + 2 * MARGIN
  const cell = Math.max(CELL, Math.sqrt((spanX * spanZ) / MAX_CELLS))
  const nx = Math.ceil(spanX / cell), nz = Math.ceil(spanZ / cell)
  const map = { nx, nz, cell, originX: bounds.minX - MARGIN, originZ: bounds.minZ - MARGIN, kind: new Uint8Array(nx * nz), bounds }

  const typed = type => elements.filter(element => (element.type ?? 'wall') === type)
  const solids = elements.filter(element => (element.type ?? 'wall') !== 'door')
  obstacles.forEach(obstacle => paint(map, obstacle, OBSTACLE, 0, 0))
  solids.forEach(element => paint(map, element, SOLID, cell / 2, cell / 2))
  // Doors go last so they also clear the half-cell padding from the walls beside them.
  typed('door').forEach(door => paint(map, door, DOOR, 0, cell))

  const raster = elements.length ? rasterizeFootprint(toFrame(elements, 0)) : null
  map.inside = new Uint8Array(nx * nz)
  for (let k = 0; k < map.inside.length; k++) {
    const { x, z } = cellCenter(map, k)
    if (raster) {
      const i = Math.floor((x - raster.originU) / raster.cell), j = Math.floor((z - raster.originV) / raster.cell)
      map.inside[k] = i >= 0 && j >= 0 && i < raster.nu && j < raster.nv ? raster.mask[j * raster.nu + i] : 0
    } else {
      // An open outline has no enclosed footprint, so its bounding box stands in for the building.
      map.inside[k] = x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ ? 1 : 0
    }
  }
  map.clearance = distanceField(nx, nz, cell, k => map.kind[k] === SOLID || map.kind[k] === OBSTACLE)
  map.outsideDistance = distanceField(nx, nz, cell, k => map.inside[k] === 1)
  Object.assign(map, findRooms(map))

  const insideAt = point => { const k = cellIndex(map, point); return k >= 0 && map.inside[k] === 1 }
  const sides = (element, offset) => {
    const nxDir = -Math.sin(element.rotation), nzDir = Math.cos(element.rotation)
    return [1, -1].map(sign => ({ x: element.x + sign * nxDir * offset, z: element.z + sign * nzDir * offset }))
  }
  map.doorOf = new Int16Array(nx * nz).fill(-1)
  map.doors = typed('door').map((door, index) => {
    paint({ ...map, kind: map.doorOf }, door, index, 0, cell)
    const [a, b] = sides(door, door.depth / 2 + 0.4)
    return { index, x: door.x, z: door.z, exterior: !insideAt(a) || !insideAt(b) }
  })
  map.windows = typed('window').flatMap(window => {
    const [a, b] = sides(window, window.depth / 2 + 0.4)
    if (insideAt(a) === insideAt(b)) return []
    const [standA, standB] = sides(window, window.depth / 2 + CLEARANCE + 0.15)
    const stand = insideAt(a) ? standA : standB
    const k = nearestCell(map, stand, 0.4, n => map.clearance[n] >= CLEARANCE && map.inside[n] === 1)
    return k < 0 ? [] : [{ x: window.x, z: window.z, cell: k }]
  })
  return map
}

/** Moves a point onto the nearest standable floor inside the building, or null if none is near. */
export function snapToFloor(map, point, reach = 0.8) {
  const k = nearestCell(map, point, reach, n => map.inside[n] === 1 && map.clearance[n] >= CLEARANCE)
  return k < 0 ? null : cellCenter(map, k)
}

export function roomAt(map, point) {
  const k = nearestCell(map, point, 0.5, n => map.roomOf[n] >= 0)
  return k < 0 ? null : map.rooms[map.roomOf[k]]
}

/** Walking distance from the fire to every cell. Walls stop it; doors are assumed open. */
export function computeFireField(map, fire) {
  const start = nearestCell(map, fire, 1, n => map.clearance[n] > 0)
  if (start < 0) return new Float64Array(map.nx * map.nz).fill(Infinity)
  return search(map, start, { open: n => map.clearance[n] > 0 }).distance
}

/** Removes grid zigzag, without moving closer to the fire or to walls than the search chose to. */
function straighten(map, cells, fireField, open) {
  const samplesClear = (a, b, minClearance, minFire) => {
    const pa = cellCenter(map, a), pb = cellCenter(map, b)
    const count = Math.ceil(Math.hypot(pb.x - pa.x, pb.z - pa.z) / (map.cell / 2))
    for (let s = 1; s < count; s++) {
      const k = cellIndex(map, { x: pa.x + ((pb.x - pa.x) * s) / count, z: pa.z + ((pb.z - pa.z) * s) / count })
      if (!open(k) || map.clearance[k] < minClearance || fireField[k] < minFire) return false
    }
    return true
  }
  const kept = [cells[0]]
  let i = 0
  while (i < cells.length - 1) {
    let best = i + 1
    let minClearance = Math.min(map.clearance[cells[i]], WALL_COMFORT)
    let minFire = fireField[cells[i]]
    for (let j = i + 1; j < cells.length && j - best <= 15; j++) {
      minClearance = Math.min(minClearance, map.clearance[cells[j]])
      minFire = Math.min(minFire, fireField[cells[j]])
      if (samplesClear(cells[i], cells[j], minClearance - 1e-6, minFire - 0.1)) best = j
    }
    kept.push(cells[best])
    i = best
  }
  return kept.map(k => cellCenter(map, k))
}

/** Rounds corners so the floor arrows read as one sweeping line. */
function roundCorners(points, passes = 2) {
  let result = points
  for (let pass = 0; pass < passes; pass++) {
    if (result.length < 3) return result
    const next = [result[0]]
    for (let i = 0; i < result.length - 1; i++) {
      const a = result[i], b = result[i + 1]
      if (i > 0) next.push({ x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 })
      if (i < result.length - 2) next.push({ x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 })
    }
    next.push(result[result.length - 1])
    result = next
  }
  return result
}

export function pathLength(points) {
  let length = 0
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z)
  return length
}

/** Evenly spaced positions and headings along a path, for placing arrows. */
export function samplePath(points, spacing, offset = spacing / 2) {
  const samples = []
  let next = offset, walked = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    const length = Math.hypot(b.x - a.x, b.z - a.z)
    if (!length) continue
    const dx = (b.x - a.x) / length, dz = (b.z - a.z) / length
    while (next <= walked + length) {
      const t = next - walked
      samples.push({ x: a.x + dx * t, z: a.z + dz * t, dx, dz, along: next })
      next += spacing
    }
    walked += length
  }
  return samples
}

/** Walks a finished path to learn which doors it uses and where it leaves the building. */
function readPath(map, points, fireField) {
  const crossings = []
  let lastDoor = -1, exitAlong = null, minFire = Infinity
  for (const sample of samplePath(points, 0.05, 0)) {
    const k = cellIndex(map, sample)
    if (k < 0) continue
    minFire = Math.min(minFire, fireField[k])
    const door = map.doorOf[k]
    if (door >= 0 && door !== lastDoor && exitAlong === null) crossings.push({ door: map.doors[door], along: sample.along })
    if (door >= 0) lastDoor = door
    if (exitAlong === null && map.outsideDistance[k] > 0.2) exitAlong = sample.along
  }
  return { crossings, exitAlong, minFire }
}

const meters = value => `${value.toFixed(1)} m`

function routeSteps({ crossings, length, exit }) {
  const steps = []
  let from = 0
  for (const { door, along } of crossings) {
    const walk = meters(along - from)
    steps.push(door.exterior ? `Walk ${walk} to the outside door and leave.` : `Walk ${walk} to the door. Go through it and close it behind you.`)
    from = along
  }
  if (exit === 'opening') steps.push(`Walk ${meters(length - from)} to the opening and leave.`)
  if (exit === 'window') steps.push(`Walk ${meters(length - from)} to the window. Open it and climb out.`)
  steps.push('Keep moving until you are well clear of the building, then call emergency services.')
  return steps
}

const SHELTER_STEPS = [
  'Close the door of the room you are in.',
  'Block the gap under the door with clothes or bedding.',
  'Call emergency services and say which room you are in.',
  'Signal from a window if you can reach one.',
]

function buildRoute(map, found, open, fireField) {
  const cells = []
  for (let k = found.goal; k !== -1; k = found.previous[k]) cells.push(k)
  cells.reverse()
  const points = roundCorners(straighten(map, cells, fireField, open))
  const { crossings, exitAlong, minFire } = readPath(map, points, fireField)
  return { points, crossings, exitAlong, minFireDistance: minFire, total: pathLength(points) }
}

/**
 * The plan for one fire and one person. `status` is one of:
 *   'route'   a way out on foot, through a door or a gap in the outline
 *   'window'  a window is the safer way out: the doors are cut off, or too close to the fire
 *   'shelter' nothing can be reached: stay put and signal
 */
export function planEvacuation(map, fire, person, fireField = computeFireField(map, fire)) {
  const start = nearestCell(map, person, 1, n => map.clearance[n] >= CLEARANCE)
  const fireRoom = roomAt(map, fire)
  const personRoom = roomAt(map, person)
  const startFire = start >= 0 ? fireField[start] : Infinity
  const nearFire = startFire < HAZARD_RADIUS
  // Someone already inside the danger zone may walk through it, but only away from the fire.
  const limit = Math.min(HAZARD_RADIUS, startFire - 0.01)
  const open = k => k >= 0 && map.clearance[k] >= CLEARANCE && fireField[k] >= limit
  const stepCost = k => {
    const clearance = map.clearance[k], burn = fireField[k]
    return 1
      + (clearance < WALL_COMFORT ? (WALL_COMFORT - clearance) * 4 : 0)
      + (burn < SMOKE_RADIUS ? 6 * (1 - burn / SMOKE_RADIUS) ** 2 : 0)
      + (fireRoom && map.roomOf[k] === fireRoom.id ? 0.5 : 0)
  }
  const blockedExits = map.doors.filter(door => {
    if (!door.exterior) return false
    const k = cellIndex(map, door)
    return k >= 0 && fireField[k] < HAZARD_RADIUS
  })
  const base = { fireRoom, personRoom, nearFire, blockedExits }
  if (start < 0) return { ...base, status: 'shelter', route: null, backup: null, steps: SHELTER_STEPS }

  const escape = search(map, start, { open, stepCost, isGoal: k => !map.inside[k] && map.outsideDistance[k] >= CLEAR_OF_BUILDING })
  const windowCells = new Set(map.windows.map(window => window.cell).filter(open))
  const toWindow = windowCells.size ? search(map, start, { open, stepCost, isGoal: k => windowCells.has(k) }) : { goal: -1 }
  const finish = route => ({
    ...route,
    throughFireRoom: Boolean(fireRoom && samplePath(route.points, 0.1, 0).some(sample => {
      const k = cellIndex(map, sample)
      return k >= 0 && map.roomOf[k] === fireRoom.id
    })),
  })
  const windowRoute = toWindow.goal >= 0 ? buildRoute(map, toWindow, open, fireField) : null
  const windowPlan = windowRoute && finish({ ...windowRoute, length: windowRoute.total, exit: 'window' })
  const windowResult = (extra = {}) => ({ ...base, status: 'window', route: windowPlan, backup: null, steps: routeSteps(windowPlan), seconds: windowPlan.length / WALKING_SPEED, ...extra })

  if (escape.goal < 0) return windowPlan ? windowResult() : { ...base, status: 'shelter', route: null, backup: null, steps: SHELTER_STEPS }

  const built = buildRoute(map, escape, open, fireField)
  const route = finish({
    ...built,
    length: built.exitAlong ?? built.total,
    exit: built.crossings.some(crossing => crossing.door.exterior) ? 'door' : 'opening',
  })
  // The door is the normal way out, unless reaching it means brushing past the fire.
  if (windowPlan && route.minFireDistance < SAFE_PASSING_DISTANCE && windowPlan.minFireDistance > route.minFireDistance) {
    return windowResult({ backup: route, doorTooClose: route.minFireDistance })
  }
  return { ...base, status: 'route', route, backup: windowPlan, steps: routeSteps(route), seconds: route.length / WALKING_SPEED }
}
