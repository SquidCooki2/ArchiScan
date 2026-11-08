import { displayQuantity, displaySize, orderQuantity } from './billOfMaterials.js'
import { squared, STAIR_STEPS } from './elementParts.js'
import { furnitureRect } from './furniture.js'
import { computeBounds, elementFloor, elementType, floorCount, isEnclosure, isFurniture, isStairs, stairRect } from './geometry.js'

/** A file-safe version of the model's name. */
export const fileStem = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'floor-plan'

/** A spreadsheet reads a leading = + - or @ as a formula, and a file name could start with one. */
const csvCell = value => {
  if (typeof value === 'number') return String(value)
  const text = String(value ?? '')
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
const csvRows = rows => rows.map(row => row.map(csvCell).join(',')).join('\r\n')
const round = (value, places = 2) => Number(value.toFixed(places))

/** The bill as a spreadsheet: quantities first, then the schedules an architect would issue with them. */
export function bomCsv(bom, { name, units = 'metric' }) {
  const rows = [
    ['ArchiTech bill of materials'],
    ['Model', name],
    ['Roof', bom.roofType],
    ['Units', units],
    ['Measured from the floor plan. Assumed rows use a typical light-frame build-up. Check before ordering.'],
    [],
    ['MasterFormat', 'Section', 'Item', 'How it was worked out', 'Quantity', 'Unit', 'Waste percent', 'To order', 'Order unit'],
  ]
  for (const section of bom.sections) {
    for (const row of section.rows) {
      const quantity = displayQuantity(row.quantity, row.kind, units), order = orderQuantity(row, units)
      // Spelled out, because a spreadsheet would turn a bare 03 into 3.
      rows.push([`Division ${section.code}`, section.title, row.item, row.detail, round(quantity.value), quantity.unit, Math.round(row.waste * 100), order.value, order.unit])
    }
  }
  const sizeUnit = units === 'metric' ? ' (mm)' : ''
  const size = meters => displaySize(meters, units)
  const area = value => round(displayQuantity(value, 'area', units).value)
  const areaUnit = displayQuantity(0, 'area', units).unit
  const length = value => round(displayQuantity(value, 'length', units).value)
  rows.push([], ['Wall types'], ['Mark', 'Where', `Thickness${sizeUnit}`, `Length (${displayQuantity(0, 'length', units).unit})`, `Area (${areaUnit})`])
  for (const wall of bom.walls) rows.push([wall.mark, wall.exterior ? 'Exterior' : 'Interior', size(wall.thickness), length(wall.length), area(wall.area)])
  rows.push([], ['Door schedule'], ['Mark', 'Where', `Width${sizeUnit}`, `Height${sizeUnit}`, 'Count'])
  for (const door of bom.doors) rows.push([door.mark, door.where, size(door.width), size(door.height), door.count])
  rows.push([], ['Window schedule'], ['Mark', `Width${sizeUnit}`, `Height${sizeUnit}`, `Sill${sizeUnit}`, 'Count', `Glass each (${areaUnit})`])
  for (const window of bom.windows) rows.push([window.mark, size(window.width), size(window.height), size(window.sill), window.count, area(window.glass)])
  rows.push([], ['Room schedule'], ['Room', 'Likely use', 'Floor', `Area (${areaUnit})`, `Glass (${areaUnit})`, 'Glass to floor percent'])
  for (const room of bom.rooms) rows.push([room.name, room.type ?? '', room.floor + 1, area(room.area), area(room.windowArea), Math.round(room.daylight * 100)])
  rows.push([], ['First-look checks. Not a code review.'], ['Check', 'Result', 'Detail'])
  for (const check of bom.checks) rows.push([check.label, check.pass ? 'OK' : 'Look at this', check.text])
  // The byte order mark tells Excel the file is UTF-8, so m² stays m².
  return `﻿${csvRows(rows)}\r\n`
}

const FLOOR_GAP = 3
// AIA layer names, so a CAD standard can pick them up as they are. Numbers are AutoCAD's color index.
const LAYERS = { 'A-WALL': 7, 'A-GLAZ': 4, 'A-DOOR': 2, 'A-FLOR-STRS': 3, 'A-FURN': 8, 'A-ANNO': 7 }
const LAYER_OF = { wall: 'A-WALL', window: 'A-GLAZ', door: 'A-DOOR' }

const corners = ({ x, z, width, depth, rotation }) => {
  const angle = squared(rotation), c = Math.cos(angle), s = Math.sin(angle)
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
    const along = a * width / 2, across = b * depth / 2
    return { x: x + c * along - s * across, z: z + s * along + c * across }
  })
}

const number = value => {
  const fixed = value.toFixed(4)
  return fixed === '-0.0000' ? '0.0000' : fixed
}

/**
 * Floor plans as a DXF drawing, one floor beside the next, in meters. It's the R12 format because nearly
 * every CAD tool opens it, including AutoCAD, Revit, SketchUp, Rhino and ArchiCAD. Plan Z runs down the
 * image, so it becomes negative Y to keep the drawing the right way up.
 */
export function floorPlansDxf(elements, { name }) {
  const out = []
  const put = (...pairs) => { for (const [code, value] of pairs) out.push(String(code), String(value)) }
  const section = (title, write) => { put([0, 'SECTION'], [2, title]); write(); put([0, 'ENDSEC']) }
  const bounds = computeBounds(elements)
  const place = (floor, { x, z }) => ({ x: x - bounds.minX + floor * (bounds.width + FLOOR_GAP), y: bounds.minZ - z })
  const polygon = (layer, floor, points) => {
    put([0, 'POLYLINE'], [8, layer], [66, 1], [10, '0.0'], [20, '0.0'], [30, '0.0'], [70, 1])
    for (const point of points) {
      const { x, y } = place(floor, point)
      put([0, 'VERTEX'], [8, layer], [10, number(x)], [20, number(y)], [30, '0.0'])
    }
    put([0, 'SEQEND'], [8, layer])
  }
  const line = (layer, floor, from, to) => {
    const a = place(floor, from), b = place(floor, to)
    put([0, 'LINE'], [8, layer], [10, number(a.x)], [20, number(a.y)], [30, '0.0'], [11, number(b.x)], [21, number(b.y)], [31, '0.0'])
  }
  const text = (layer, floor, point, words, height = 0.25) => {
    const { x, y } = place(floor, point)
    // A DXF string can't hold a line break, and non-ASCII needs a code page this format doesn't carry.
    put([0, 'TEXT'], [8, layer], [10, number(x)], [20, number(y)], [30, '0.0'], [40, height], [1, words.replace(/[^\x20-\x7e]/g, '_')])
  }

  section('HEADER', () => put([9, '$ACADVER'], [1, 'AC1009']))
  section('TABLES', () => {
    put([0, 'TABLE'], [2, 'LAYER'], [70, Object.keys(LAYERS).length])
    for (const [layer, color] of Object.entries(LAYERS)) put([0, 'LAYER'], [2, layer], [70, 0], [62, color], [6, 'CONTINUOUS'])
    put([0, 'ENDTAB'])
  })
  section('ENTITIES', () => {
    for (let floor = 0; floor < floorCount(elements); floor++) {
      const here = elements.filter(element => elementFloor(element) === floor)
      text('A-ANNO', floor, { x: bounds.minX, z: bounds.minZ - 0.6 }, `${name}, Floor ${floor + 1} (meters)`)
      for (const element of here.filter(isEnclosure)) {
        const type = elementType(element), points = corners(element)
        polygon(LAYER_OF[type], floor, points)
        // A window shows its glass as a line down the middle of the wall.
        if (type === 'window') line('A-GLAZ', floor, { x: (points[0].x + points[3].x) / 2, z: (points[0].z + points[3].z) / 2 }, { x: (points[1].x + points[2].x) / 2, z: (points[1].z + points[2].z) / 2 })
      }
      for (const stair of here.filter(isStairs)) {
        const rect = stairRect(stair), points = corners(rect)
        polygon('A-FLOR-STRS', floor, points)
        for (let step = 1; step < STAIR_STEPS; step++) {
          const t = step / STAIR_STEPS
          line('A-FLOR-STRS', floor,
            { x: points[0].x + (points[1].x - points[0].x) * t, z: points[0].z + (points[1].z - points[0].z) * t },
            { x: points[3].x + (points[2].x - points[3].x) * t, z: points[3].z + (points[2].z - points[3].z) * t })
        }
      }
      for (const item of here.filter(isFurniture)) {
        const rect = furnitureRect(item)
        polygon('A-FURN', floor, corners(rect))
        text('A-FURN', floor, { x: rect.x, z: rect.z }, elementType(item), 0.1)
      }
    }
  })
  put([0, 'EOF'])
  return `${out.join('\r\n')}\r\n`
}

/** The model itself, plus its bill, for anything that wants to read the data directly. */
export function modelJson(elements, bom, { name, units = 'metric' }) {
  return `${JSON.stringify({ project: 'ArchiTech', model: name, lengthsIn: 'meters', roof: bom.roofType, displayUnits: units, elements, billOfMaterials: bom }, null, 2)}\n`
}
