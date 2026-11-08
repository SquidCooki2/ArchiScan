import { STAIR_STEPS } from './elementParts.js'
import { buildEvacuationBuilding, buildingRooms } from './evacuation.js'
import { drawnModel, furnitureRect } from './furniture.js'
import { elementFloor, elementType, floorCount, isEnclosure, isFurniture, isStairs, openingDimensions, WALL_HEIGHT } from './geometry.js'
import { computeRoofPlan, rasterizeFootprint, ROOF_OVERHANG, ROOF_PITCH, toFrame } from './roof.js'

/*
 * A takeoff from the plan. A floor plan says where things are and how big, not what they're made of, so
 * every row says how it was worked out: measured rows come straight from the drawing, and assumed rows
 * apply a typical light-frame house build-up to those measurements. Everything here is in meters.
 */

const FEET = 3.28084
export const UNIT_SYSTEMS = [{ id: 'metric', label: 'Metric' }, { id: 'imperial', label: 'Imperial' }]
const UNITS = {
  metric: { length: ['m', 1], area: ['m²', 1], volume: ['m³', 1], count: ['pcs', 1] },
  imperial: { length: ['ft', FEET], area: ['ft²', FEET ** 2], volume: ['yd³', (FEET / 3) ** 3], count: ['pcs', 1] },
}
const SHEET = { metric: { size: 2.88, label: 'sheets', unit: '1.2 × 2.4 m sheets' }, imperial: { size: 32, label: 'sheets', unit: '4 × 8 ft sheets' } }
// Two coats at a usual spreading rate of 10 m² per liter, or 350 ft² per gallon.
const PAINT = { metric: { size: 5, label: 'L', unit: 'L' }, imperial: { size: 175, label: 'gal', unit: 'gal' } }

const STUD_SPACING = 0.4
const STUDS_PER_OPENING = 4
const PLATES = 3
const HEADER_BEARING = 0.3
const SLAB_THICKNESS = 0.1
// Figures for the first-look checks, from the 2021 International Residential Code.
const CODE = { glazing: 0.08, habitableArea: 6.5, egressDoor: 0.813, stairWidth: 0.914, maxRise: 0.196, minRun: 0.254 }
const SIDE_REACH = 0.2
// Plans round to the centimeter, so a 1.33 m and a 1.34 m window are the same window. Schedules group to this.
const SIZE_MODULE = 0.05
const nominal = meters => Math.round(meters / SIZE_MODULE) * SIZE_MODULE

const FURNITURE_NAMES = { couch: 'Sofa', chair: 'Chair', table: 'Table', bed: 'Bed', cabinet: 'Cabinet', wardrobe: 'Wardrobe' }
const PLUMBING_NAMES = { toilet: 'Toilet', bath: 'Bathtub', sink: 'Kitchen sink', bathroomSink: 'Bathroom basin' }

const cellAt = (map, x, z) => {
  const i = Math.floor((x - map.originX) / map.cell), j = Math.floor((z - map.originZ) / map.cell)
  return i < 0 || j < 0 || i >= map.nx || j >= map.nz ? -1 : j * map.nx + i
}
const outsideAt = (map, x, z) => {
  const k = cellAt(map, x, z)
  return k < 0 || !map.inside[k]
}

/** Points just off each long face of a piece, at a few places along its length. */
function faceSamples(element, along) {
  const ux = Math.cos(element.rotation), uz = Math.sin(element.rotation)
  const offset = element.depth / 2 + SIDE_REACH
  return [1, -1].map(side => ({
    x: element.x + ux * along * element.width - uz * side * offset,
    z: element.z + uz * along * element.width + ux * side * offset,
  }))
}

/** A piece is exterior when most of its length has the outside of the building on one side. */
function isExterior(element, map) {
  const stations = [-0.35, -0.15, 0, 0.15, 0.35]
  const open = stations.filter(along => faceSamples(element, along).some(({ x, z }) => outsideAt(map, x, z)))
  return open.length * 2 > stations.length
}

function grossArea(enclosures, map) {
  const raster = enclosures.length ? rasterizeFootprint(toFrame(enclosures, 0)) : null
  if (!raster) return map.bounds.width * map.bounds.depth
  return raster.mask.reduce((sum, inside) => sum + inside, 0) * raster.cell ** 2
}

const openingArea = element => {
  if (elementType(element) === 'wall') return 0
  return element.width * openingDimensions(element).height
}

function roomType(items) {
  const has = (...kinds) => items.some(item => kinds.includes(item))
  if (has('toilet', 'bath', 'bathroomSink')) return 'Bathroom'
  if (has('bed')) return 'Bedroom'
  if (has('fridge', 'sink')) return has('couch') ? 'Open-plan living' : 'Kitchen'
  if (has('couch')) return 'Living room'
  if (has('table')) return 'Dining room'
  return null
}

/** The rooms' areas, likely uses, and glass. Room numbers match the escape route's. */
function measureRooms(elements, building) {
  const rooms = buildingRooms(building).map(room => ({ key: room.key, name: room.name, floor: room.floor, id: room.id, area: room.area, windowArea: 0, items: [] }))
  const roomOn = (floor, x, z) => {
    const map = building.maps[floor], k = cellAt(map, x, z)
    const id = k < 0 ? -1 : map.roomOf[k]
    return id < 0 ? null : rooms.find(room => room.floor === floor && room.id === id) ?? null
  }
  for (const window of elements.filter(element => elementType(element) === 'window')) {
    const floor = elementFloor(window)
    const room = faceSamples(window, 0).map(({ x, z }) => roomOn(floor, x, z)).find(Boolean)
    if (room) room.windowArea += openingArea(window)
  }
  for (const item of elements.filter(isFurniture)) {
    const { x, z, width, depth } = furnitureRect(item)
    const reach = Math.max(width, depth) / 2 + 0.1
    const spots = [[0, 0], [reach, 0], [-reach, 0], [0, reach], [0, -reach]]
    const room = spots.map(([dx, dz]) => roomOn(elementFloor(item), x + dx, z + dz)).find(Boolean)
    if (room) room.items.push(drawnModel(item, elements))
  }
  return rooms.map(room => ({ key: room.key, name: room.name, floor: room.floor, area: room.area, windowArea: room.windowArea, type: roomType(room.items), daylight: room.windowArea / room.area }))
}

/** What one floor measures, independent of any assumption about how it's built. */
function measureFloor(elements, floor, map) {
  const here = elements.filter(element => elementFloor(element) === floor)
  const pieces = here.filter(isEnclosure).map(element => ({ element, type: elementType(element), exterior: isExterior(element, map) }))
  const flightsHere = elements.filter(element => isStairs(element) && elementFloor(element) === floor)
  const flightsBelow = elements.filter(element => isStairs(element) && elementFloor(element) === floor - 1)
  const gross = grossArea(here.filter(isEnclosure), map)
  const footprint = element => element.width * element.depth
  const sum = (list, value) => list.reduce((total, item) => total + value(item), 0)
  const wallFootprint = sum(pieces, ({ element }) => footprint(element))
  const voidArea = sum(flightsBelow, footprint)
  const side = exterior => {
    const list = pieces.filter(piece => piece.exterior === exterior)
    const length = sum(list, ({ element }) => element.width)
    const openings = sum(list, ({ element }) => openingArea(element))
    return { length, gross: length * WALL_HEIGHT, openings, net: length * WALL_HEIGHT - openings }
  }
  // A door interrupts the baseboard on each room side: one for an outside door, two for an inside one.
  const doorFaces = sum(pieces.filter(piece => piece.type === 'door'), ({ element, exterior }) => element.width * (exterior ? 1 : 2))
  return {
    floor, pieces, flightsHere, voidArea,
    gross,
    net: Math.max(0, gross - wallFootprint - voidArea - sum(flightsHere, footprint)),
    exterior: side(true),
    interior: side(false),
    doorFaces,
    openings: pieces.filter(piece => piece.type !== 'wall').length,
    headers: sum(pieces.filter(piece => piece.type !== 'wall'), ({ element }) => element.width + HEADER_BEARING),
  }
}

/** Numbers each distinct size once, so a mark means the same thing on every floor. */
function schedule(pieces, type, prefix, describe) {
  const groups = new Map()
  for (const piece of pieces.filter(item => item.type === type)) {
    const { sillHeight, height } = openingDimensions(piece.element)
    const size = [nominal(piece.element.width), nominal(height), nominal(sillHeight)]
    const key = `${piece.exterior}-${size.map(value => value.toFixed(2)).join('-')}`
    if (!groups.has(key)) groups.set(key, { width: size[0], height: size[1], sill: size[2], exterior: piece.exterior, floors: {} })
    const group = groups.get(key), floor = elementFloor(piece.element)
    group.floors[floor] = (group.floors[floor] ?? 0) + 1
  }
  return [...groups.values()]
    .sort((a, b) => Number(b.exterior) - Number(a.exterior) || b.width * b.height - a.width * a.height)
    .map((group, index) => ({ mark: `${prefix}${index + 1}`, ...group, ...describe(group) }))
}

/** One floor plan's worth of measuring is slow enough to keep, so options can change without redoing it. */
export function measureBuilding(elements) {
  const building = buildEvacuationBuilding(elements, { furniture: false })
  const floors = building.maps.map((map, floor) => measureFloor(elements, floor, map))
  const pieces = floors.flatMap(floor => floor.pieces)
  return {
    floors,
    doors: schedule(pieces, 'door', 'D', ({ exterior }) => ({ where: exterior ? 'Exterior' : 'Interior' })),
    windows: schedule(pieces, 'window', 'W', ({ width, height, exterior }) => ({ where: exterior ? 'Exterior' : 'Interior', glass: width * height })),
    rooms: measureRooms(elements, building),
    roofPlan: computeRoofPlan(elements),
  }
}

/** The roof's surfaces for one choice of roof. Pieces of an L-shaped house are summed. */
export function roofQuantities(plan, type) {
  const totals = { plan: 0, covering: 0, ridge: 0, hips: 0, eaves: 0, rakes: 0, gableArea: 0, soffit: 0 }
  const cos = Math.cos(ROOF_PITCH), tan = Math.tan(ROOF_PITCH)
  for (const { length, width } of plan.rects) {
    const hl = length / 2 + ROOF_OVERHANG, hw = width / 2 + ROOF_OVERHANG
    const area = 4 * hl * hw
    totals.plan += area
    totals.soffit += area - length * width
    if (type === 'flat') {
      totals.covering += area
      totals.eaves += 4 * (hl + hw)
    } else if (type === 'hip') {
      const rise = tan * hw
      totals.covering += area / cos
      totals.ridge += 2 * Math.max(hl - hw, 0)
      totals.eaves += 4 * (hl + hw)
      totals.hips += 4 * Math.hypot(hw, hw, rise)
    } else {
      totals.covering += area / cos
      totals.ridge += 2 * hl
      totals.eaves += 4 * hl
      totals.rakes += 4 * (hw / cos)
      // Two triangles, each as wide as the wall and rising to the ridge.
      totals.gableArea += 2 * (width / 2 * (width / 2 * tan))
    }
  }
  return totals
}

const add = (rows, item, detail, quantity, kind, waste = 0, pack = null) => {
  if (quantity > 1e-6) rows.push({ item, detail, quantity, kind, waste, pack })
}

function countBy(values) {
  const counts = new Map()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])
}

/** Wall types by side of the building and thickness, ready to map to assemblies. */
function wallTypes(floors) {
  const groups = new Map()
  for (const { pieces } of floors) for (const { element, exterior } of pieces) {
    const thickness = Math.round(element.depth * 100) / 100
    const key = `${exterior}-${thickness}`
    if (!groups.has(key)) groups.set(key, { exterior, thickness, length: 0 })
    groups.get(key).length += element.width
  }
  const sorted = [...groups.values()].sort((a, b) => Number(b.exterior) - Number(a.exterior) || b.thickness - a.thickness)
  return sorted.map((group, index) => ({ mark: `WT${index + 1}`, ...group }))
}

function stairFacts(stair) {
  return { rise: WALL_HEIGHT / STAIR_STEPS, run: stair.width / STAIR_STEPS, width: stair.depth, slope: Math.hypot(stair.width, WALL_HEIGHT) }
}

function checks(rooms, doors, stairs, wholeBuilding) {
  const results = []
  const habitable = rooms.filter(room => room.area >= CODE.habitableArea && room.type !== 'Bathroom')
  const dark = habitable.filter(room => room.daylight < CODE.glazing)
  if (habitable.length) {
    results.push({
      label: 'Daylight',
      pass: dark.length === 0,
      text: dark.length
        ? `${dark.map(room => room.name).join(', ')} ${dark.length === 1 ? 'has' : 'have'} less than 8% glass to floor area. Fine for a hall or store, not for a room people live in.`
        : `All ${habitable.length} larger rooms have at least 8% glass to floor area.`,
    })
  }
  const exteriorDoors = doors.filter(door => door.exterior)
  if (wholeBuilding) {
    const narrow = exteriorDoors.filter(door => door.width < CODE.egressDoor)
    results.push({
      label: 'Exit door',
      pass: exteriorDoors.length > 0 && narrow.length < exteriorDoors.length,
      text: !exteriorDoors.length
        ? 'No door to the outside was found. Check the plan was read correctly.'
        : narrow.length === exteriorDoors.length
          ? 'Every door to the outside is under 813 mm wide, the usual minimum for an exit.'
          : 'At least one door to the outside is 813 mm wide or more.',
    })
  }
  for (const { rise, run, width } of stairs.slice(0, 1)) {
    const problems = [
      rise > CODE.maxRise && `rise of ${Math.round(rise * 1000)} mm is over 196 mm`,
      run < CODE.minRun && `going of ${Math.round(run * 1000)} mm is under 254 mm`,
      width < CODE.stairWidth && `width of ${Math.round(width * 1000)} mm is under 914 mm`,
    ].filter(Boolean)
    results.push({
      label: 'Stairs',
      pass: !problems.length,
      text: problems.length ? `The ${problems.join(' and the ')}.` : `Rise ${Math.round(rise * 1000)} mm, going ${Math.round(run * 1000)} mm, width ${Math.round(width * 1000)} mm.`,
    })
  }
  return results
}

/**
 * The whole bill for one view. `floor` is 'all' or a floor index. The roof and the ground slab belong to
 * the building, so a single upper floor's bill leaves them out.
 */
export function billOfMaterials(elements, { roofType = 'gable', floor = 'all' } = {}, measured = measureBuilding(elements)) {
  const wholeBuilding = floor === 'all'
  const floors = wholeBuilding ? measured.floors : measured.floors.filter(item => item.floor === floor)
  const total = read => floors.reduce((sum, item) => sum + read(item), 0)
  const onFloor = element => wholeBuilding || elementFloor(element) === floor
  const roof = wholeBuilding ? roofQuantities(measured.roofPlan, roofType) : null
  const exteriorNet = total(item => item.exterior.net), interiorNet = total(item => item.interior.net)
  const exteriorLength = total(item => item.exterior.length), interiorLength = total(item => item.interior.length)
  const netFloor = total(item => item.net), grossFloor = total(item => item.gross)
  const wallLength = exteriorLength + interiorLength
  const glass = total(item => item.pieces.filter(piece => piece.type === 'window').reduce((sum, { element }) => sum + openingArea(element), 0))
  const gableArea = roof?.gableArea ?? 0
  const pitched = roofType !== 'flat'

  const concrete = [], framing = [], envelope = [], finishes = [], stairsRows = [], plumbing = [], equipment = [], furnishings = []

  if (wholeBuilding || floor === 0) {
    const ground = measured.floors[0].gross
    add(concrete, 'Ground floor slab', `Footprint at an assumed ${SLAB_THICKNESS * 1000} mm thick`, ground * SLAB_THICKNESS, 'volume', 0.05)
  }

  add(framing, 'Wall studs', `Assumed ${STUD_SPACING * 1000} mm (16 in) centers, plus ${STUDS_PER_OPENING} at each opening`, Math.ceil(wallLength / STUD_SPACING) + STUDS_PER_OPENING * total(item => item.openings), 'count', 0.1)
  add(framing, 'Wall plates', `Assumed ${PLATES} runs: one bottom and two top`, wallLength * PLATES, 'length', 0.1)
  add(framing, 'Opening headers', 'Each opening plus 150 mm bearing at both ends', total(item => item.headers), 'length', 0.05)
  const deck = floors.filter(item => item.floor > 0).reduce((sum, item) => sum + item.gross - item.voidArea, 0)
  add(framing, 'Upper floor deck', 'Upper floors less the stairwell', deck, 'area', 0.1, SHEET)

  add(envelope, 'Exterior sheathing', gableArea ? 'Exterior walls less openings, plus gable ends' : 'Exterior walls less openings', exteriorNet + gableArea, 'area', 0.1, SHEET)
  add(envelope, 'Wall insulation', 'Exterior walls less openings', exteriorNet, 'area', 0.05)
  add(envelope, 'Weather barrier', 'Exterior walls, openings included for wrapping', total(item => item.exterior.gross) + gableArea, 'area', 0.1)
  add(envelope, 'Exterior siding', gableArea ? 'Exterior walls less openings, plus gable ends' : 'Exterior walls less openings', exteriorNet + gableArea, 'area', 0.1)
  if (roof) {
    const covering = pitched ? 'Roof shingles' : 'Roof membrane'
    const pitchNote = pitched ? `Slope area at ${Math.round(ROOF_PITCH * 180 / Math.PI)} degrees with a ${ROOF_OVERHANG * 1000} mm overhang` : `Plan area with a ${ROOF_OVERHANG * 1000} mm overhang`
    add(envelope, covering, pitchNote, roof.covering, 'area', roofType === 'hip' ? 0.15 : 0.1)
    if (pitched) add(envelope, 'Roof underlayment', 'Same as the slope area', roof.covering, 'area', 0.1)
    add(envelope, 'Ridge cap', 'Along each ridge', roof.ridge + roof.hips, 'length', 0.05)
    add(envelope, pitched ? 'Gutters' : 'Roof edge trim', pitched ? 'Along the eaves' : 'Around the roof', roof.eaves, 'length', 0.05)
    add(envelope, 'Rake trim', 'Up the gable ends', roof.rakes, 'length', 0.05)
    add(envelope, 'Soffit', 'The overhang, seen from below', roof.soffit, 'area', 0.1)
    add(envelope, 'Ceiling insulation', 'Below the roof, over the top floor', measured.floors.at(-1).gross, 'area', 0.05)
  }

  add(finishes, 'Wall board', 'Both faces of interior walls and the inside of exterior walls, less openings', interiorNet * 2 + exteriorNet, 'area', 0.12, SHEET)
  add(finishes, 'Ceiling board', 'Net floor area', netFloor, 'area', 0.12, SHEET)
  add(finishes, 'Wall paint', 'Same faces as the wall board, two coats', interiorNet * 2 + exteriorNet, 'area', 0, PAINT)
  add(finishes, 'Ceiling paint', 'Net floor area, two coats', netFloor, 'area', 0, PAINT)
  add(finishes, 'Floor finish', 'Net floor area, clear of walls and stairs', netFloor, 'area', 0.1)
  add(finishes, 'Baseboard', 'Room sides of every wall, less door widths', Math.max(0, interiorLength * 2 + exteriorLength - total(item => item.doorFaces)), 'length', 0.1)

  const flights = elements.filter(element => isStairs(element) && onFloor(element)).map(stairFacts)
  add(stairsRows, 'Stair flights', flights.length ? `${STAIR_STEPS} risers at ${Math.round(flights[0].rise * 1000)} mm` : '', flights.length, 'count')
  add(stairsRows, 'Treads', 'Every step of every flight', flights.length * STAIR_STEPS, 'count', 0.05)
  add(stairsRows, 'Handrail', 'Both sides, along the slope', flights.reduce((sum, { slope }) => sum + slope * 2, 0), 'length', 0.1)
  const guardFlights = elements.filter(element => isStairs(element) && elementFloor(element) + 1 < floorCount(elements) && (wholeBuilding || elementFloor(element) + 1 === floor))
  add(stairsRows, 'Stairwell guard', 'Around the opening upstairs, the head of the flight left open', guardFlights.reduce((sum, stair) => sum + stair.width * 2 + stair.depth, 0), 'length', 0.1)

  const items = elements.filter(element => isFurniture(element) && onFloor(element))
  for (const [kind, count] of countBy(items.map(item => drawnModel(item, elements)))) {
    if (PLUMBING_NAMES[kind]) add(plumbing, PLUMBING_NAMES[kind], 'Counted from the plan. Needs supply and drain rough-in', count, 'count')
    else if (kind === 'fridge') add(equipment, 'Refrigerator', 'Counted from the plan. Needs a power point', count, 'count')
    else add(furnishings, FURNITURE_NAMES[kind] ?? kind, 'Counted from the plan', count, 'count')
  }

  const walls = wallTypes(floors).map(type => ({ ...type, area: type.length * WALL_HEIGHT, volume: type.length * WALL_HEIGHT * type.thickness }))
  const inView = row => wholeBuilding ? Object.values(row.floors).reduce((sum, count) => sum + count, 0) : row.floors[floor] ?? 0
  const doors = measured.doors.map(row => ({ ...row, count: inView(row) })).filter(row => row.count)
  const windows = measured.windows.map(row => ({ ...row, count: inView(row) })).filter(row => row.count)
  const rooms = measured.rooms.filter(room => wholeBuilding || room.floor === floor)

  const sections = [
    { id: 'concrete', code: '03', title: 'Concrete', rows: concrete },
    { id: 'framing', code: '06', title: 'Wood framing', rows: framing },
    { id: 'stairs', code: '06', title: 'Stairs', rows: stairsRows },
    { id: 'envelope', code: '07', title: 'Roof and outside walls', rows: envelope },
    { id: 'finishes', code: '09', title: 'Interior finishes', rows: finishes },
    { id: 'equipment', code: '11', title: 'Equipment', rows: equipment },
    { id: 'furnishings', code: '12', title: 'Furnishings', rows: furnishings },
    { id: 'plumbing', code: '22', title: 'Plumbing fixtures', rows: plumbing },
  ].filter(section => section.rows.length)

  return {
    roofType,
    floor,
    summary: { grossFloor, netFloor, exteriorLength, interiorLength, glass, glazingRatio: netFloor ? glass / netFloor : 0, wallArea: exteriorNet + interiorNet, wallHeight: WALL_HEIGHT },
    walls,
    doors,
    windows,
    rooms,
    sections,
    checks: checks(rooms, measured.doors, elements.filter(isStairs).map(stairFacts), wholeBuilding),
  }
}

/** A quantity in the chosen units, as a number and with its unit. */
export function displayQuantity(quantity, kind, units = 'metric') {
  const [unit, factor] = UNITS[units][kind]
  const value = quantity * factor
  return { value, unit, text: `${kind === 'count' ? Math.round(value) : value.toFixed(1)} ${unit}` }
}

/** What to order: the quantity plus waste, rounded up to something that can be bought. */
export function orderQuantity(row, units = 'metric') {
  const { value, unit } = displayQuantity(row.quantity, row.kind, units)
  const needed = value * (1 + row.waste)
  if (row.pack) {
    const { size, label, unit: packUnit } = row.pack[units]
    const count = Math.ceil(needed / size - 1e-9)
    return { value: count, unit: packUnit, text: `${count} ${label}` }
  }
  const count = Math.ceil(needed - 1e-9)
  return { value: count, unit, text: `${count} ${unit}` }
}

/** A plan dimension: millimeters, or feet and inches to the nearest inch. */
export function displaySize(meters, units = 'metric') {
  if (units === 'metric') return `${Math.round(meters * 1000)}`
  const inches = Math.round(meters * FEET * 12)
  return `${Math.floor(inches / 12)}'-${inches % 12}"`
}
