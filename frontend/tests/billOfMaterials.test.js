import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { billCost, billOfMaterials, displayQuantity, displaySize, measureBuilding, orderQuantity, roofQuantities, rowPrice } from '../src/lib/billOfMaterials.js'
import { doorPrice, money, roughMoney, windowPrice } from '../src/lib/prices.js'
import { bomCsv, fileStem, floorPlansDxf, modelJson } from '../src/lib/exports.js'
import { WALL_HEIGHT } from '../src/lib/geometry.js'
import { settleFurniture } from '../src/lib/settleFurniture.js'

const sample = name => JSON.parse(readFileSync(new URL(`../../sample_output/${name}.walls.json`, import.meta.url)))
const house = sample('house1_2floors'), apartment = sample('apartment_furnished_preview')
const near = (actual, expected, tolerance = 0.01) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`)
const rowOf = (bom, item) => bom.sections.flatMap(section => section.rows).find(row => row.item === item)

// A plain 10 by 6 m room with 0.2 m walls, one door and one window.
const box = [
  { type: 'wall', x: 5, z: 0, width: 10, depth: 0.2, rotation: 0 },
  { type: 'wall', x: 5, z: 6, width: 10, depth: 0.2, rotation: 0 },
  { type: 'wall', x: 0, z: 3, width: 5.8, depth: 0.2, rotation: Math.PI / 2 },
  { type: 'wall', x: 10, z: 1.5, width: 2.8, depth: 0.2, rotation: Math.PI / 2 },
  { type: 'door', x: 10, z: 3.4, width: 1, depth: 0.2, rotation: Math.PI / 2 },
  { type: 'window', x: 10, z: 4.9, width: 2, depth: 0.2, rotation: Math.PI / 2 },
]

test('a plain room measures what a tape measure would', () => {
  const bom = billOfMaterials(box)
  const { summary } = bom
  near(summary.exteriorLength, 31.6, 0.01)
  near(summary.interiorLength, 0)
  near(summary.glass, 2 * 1.2)
  const openings = 2 * 1.2 + 1 * 2.1
  near(summary.wallArea, 31.6 * WALL_HEIGHT - openings)
  near(rowOf(bom, 'Exterior siding').quantity, 31.6 * WALL_HEIGHT - openings + roofQuantities(measureBuilding(box).roofPlan, 'gable').gableArea)
})

test('the outside of the sample house is its perimeter on both floors, and its gross area its footprint', () => {
  const { summary } = billOfMaterials(house)
  near(summary.exteriorLength, 2 * 2 * (12.2 + 8.7), 2)
  near(summary.grossFloor, 2 * 12.2 * 8.7, 3)
  assert.ok(summary.netFloor < summary.grossFloor)
  assert.ok(summary.interiorLength > 20, 'interior walls are found')
})

test('floors add up to the whole building', () => {
  const measured = measureBuilding(house)
  const whole = billOfMaterials(house, {}, measured).summary
  const parts = [0, 1].map(floor => billOfMaterials(house, { floor }, measured).summary)
  for (const key of ['grossFloor', 'netFloor', 'exteriorLength', 'interiorLength', 'glass', 'wallArea']) near(parts[0][key] + parts[1][key], whole[key], 1e-6)
})

test('the roof and the ground slab appear only where they belong', () => {
  const measured = measureBuilding(house)
  assert.ok(rowOf(billOfMaterials(house, {}, measured), 'Roof shingles'))
  assert.equal(rowOf(billOfMaterials(house, { floor: 1 }, measured), 'Roof shingles'), undefined)
  assert.ok(rowOf(billOfMaterials(house, { floor: 0 }, measured), 'Ground floor slab'))
  assert.equal(rowOf(billOfMaterials(house, { floor: 1 }, measured), 'Ground floor slab'), undefined)
  assert.ok(rowOf(billOfMaterials(house, { floor: 1 }, measured), 'Upper floor deck'))
})

test('roof quantities follow the roof type', () => {
  const plan = { rects: [{ length: 10, width: 6 }] }
  const gable = roofQuantities(plan, 'gable'), hip = roofQuantities(plan, 'hip'), flat = roofQuantities(plan, 'flat')
  // 10.6 by 6.6 m with the overhang, over the cosine of 30 degrees.
  near(gable.covering, 10.6 * 6.6 / Math.cos(Math.PI / 6))
  near(hip.covering, gable.covering)
  near(flat.covering, 10.6 * 6.6)
  near(gable.ridge, 10.6)
  near(gable.gableArea, 6 * 6 * Math.tan(Math.PI / 6) / 2)
  assert.equal(hip.gableArea, 0)
  assert.equal(flat.ridge, 0)
  near(hip.ridge, 10.6 - 6.6)
  const shingles = type => rowOf(billOfMaterials(house, { roofType: type }), 'Roof shingles')
  assert.ok(shingles('hip').waste > shingles('gable').waste, 'hips cut more shingles')
  assert.equal(shingles('flat'), undefined)
  assert.ok(rowOf(billOfMaterials(house, { roofType: 'flat' }), 'Roof membrane'))
})

test('what to order includes waste and rounds up to what can be bought', () => {
  const area = { quantity: 100, kind: 'area', waste: 0.1, pack: null }
  assert.deepEqual([orderQuantity(area).value, orderQuantity(area).unit], [110, 'm²'])
  const sheets = { ...area, pack: { metric: { size: 2.88, label: 'sheets', unit: '1.2 × 2.4 m sheets' }, imperial: { size: 32, label: 'sheets', unit: '4 × 8 ft sheets' } } }
  assert.equal(orderQuantity(sheets).value, Math.ceil(110 / 2.88))
  assert.equal(orderQuantity(sheets, 'imperial').value, Math.ceil(100 * 10.7639 * 1.1 / 32))
  assert.equal(orderQuantity(sheets).text, `${Math.ceil(110 / 2.88)} sheets`)
})

test('units convert, and counts stay whole', () => {
  near(displayQuantity(10, 'length', 'imperial').value, 32.8084, 0.001)
  near(displayQuantity(1, 'area', 'imperial').value, 10.7639, 0.001)
  near(displayQuantity(1, 'volume', 'imperial').value, 1.308, 0.001)
  assert.equal(displayQuantity(7, 'count', 'imperial').text, '7 pcs')
  assert.equal(displaySize(0.9), '900')
  assert.equal(displaySize(0.9144, 'imperial'), `3'-0"`)
})

test('schedules group plan rounding to one mark, keep marks across floors, and count every opening', () => {
  const doubled = [...box, { type: 'window', x: 3, z: 0, width: 2.01, depth: 0.2, rotation: 0, floor: 1 }, { type: 'wall', x: 5, z: 6, width: 10, depth: 0.2, rotation: 0, floor: 1 }]
  const { windows } = billOfMaterials(doubled)
  assert.equal(windows.length, 1)
  assert.equal(windows[0].count, 2)
  const scheduled = billOfMaterials(house)
  const counted = kind => house.filter(element => element.type === kind).length
  assert.equal(scheduled.doors.reduce((sum, door) => sum + door.count, 0), counted('door'))
  assert.equal(scheduled.windows.reduce((sum, window) => sum + window.count, 0), counted('window'))
  const rawSizes = new Set(house.filter(element => element.type === 'window').map(window => window.width)).size
  assert.ok(scheduled.windows.length < rawSizes, `${scheduled.windows.length} marks from ${rawSizes} sizes`)
  const upstairs = billOfMaterials(house, { floor: 1 })
  for (const door of upstairs.doors) assert.ok(scheduled.doors.some(row => row.mark === door.mark && row.width === door.width))
})

test('room numbers match the escape route, and use is read from the furniture', () => {
  const rooms = billOfMaterials(house).rooms
  assert.deepEqual(rooms.map(room => room.name).slice(0, 3), ['Room 1', 'Room 2', 'Room 3'])
  assert.ok(rooms.some(room => room.type === 'Bedroom'))
  assert.ok(rooms.some(room => room.type === 'Bathroom'))
})

test('checks catch a narrow exit and steep stairs, and fixtures are counted from the plan', () => {
  const exit = billOfMaterials(apartment).checks.find(check => check.label === 'Exit door')
  assert.equal(exit.pass, false)
  assert.equal(billOfMaterials(house).checks.find(check => check.label === 'Exit door').pass, true)
  const steep = billOfMaterials([...box, { type: 'stairs', x: 5, z: 3, width: 2, depth: 0.8, rotation: 0 }]).checks.find(check => check.label === 'Stairs')
  assert.equal(steep.pass, false)
  assert.match(steep.text, /going of 133 mm/)
  assert.match(steep.text, /width of 800 mm/)
  assert.equal(rowOf(billOfMaterials(apartment), 'Toilet').quantity, 1)
  assert.equal(rowOf(billOfMaterials(apartment), 'Refrigerator').quantity, 1)
})

test('settling furniture changes no counts', () => {
  const before = billOfMaterials(house), after = billOfMaterials(settleFurniture(house))
  assert.equal(rowOf(after, 'Bed').quantity, rowOf(before, 'Bed').quantity)
  assert.equal(after.summary.grossFloor, before.summary.grossFloor)
})

test('every row in both samples has a price, under every roof, floor and unit', () => {
  for (const model of [house, apartment]) for (const roofType of ['flat', 'gable', 'hip']) for (const floor of ['all', 0]) for (const units of ['metric', 'imperial']) {
    const bom = billOfMaterials(model, { roofType, floor })
    for (const row of bom.sections.flatMap(section => section.rows)) {
      const price = rowPrice(row, units)
      assert.ok(price && price.each > 0 && price.total > 0, `${row.item} in ${units}`)
    }
  }
})

test('a price multiplies out from the amount to order and the unit price shown', () => {
  const bom = billOfMaterials(house)
  for (const units of ['metric', 'imperial']) for (const row of bom.sections.flatMap(section => section.rows)) {
    const { each, total } = rowPrice(row, units)
    assert.equal(total, Math.round(each * orderQuantity(row, units).value), row.item)
  }
  assert.deepEqual({ each: 5, per: 'pc' }, (({ each, per }) => ({ each, per }))(rowPrice(rowOf(bom, 'Wall studs'))))
  assert.equal(rowPrice(rowOf(bom, 'Wall board')).per, 'sheet')
  assert.equal(rowPrice(rowOf(bom, 'Wall paint'), 'imperial').per, 'gal')
  near(rowPrice(rowOf(bom, 'Wall paint'), 'imperial').each, 37.85)
  near(rowPrice(rowOf(bom, 'Floor finish'), 'imperial').each, 2.97)
})

test('the estimated cost adds up, including doors and windows', () => {
  const bom = billOfMaterials(house)
  const cost = billCost(bom)
  const rows = bom.sections.flatMap(section => section.rows)
  assert.equal(cost.materials, rows.reduce((sum, row) => sum + rowPrice(row).total, 0))
  assert.equal(cost.materials, Object.values(cost.sections).reduce((sum, value) => sum + value, 0))
  assert.equal(cost.openings, [...bom.doors, ...bom.windows].reduce((sum, row) => sum + row.each * row.count, 0))
  assert.equal(cost.total, cost.materials + cost.openings)
  assert.ok(cost.openings > 0)
  for (const door of bom.doors) assert.equal(door.each, doorPrice(door.exterior))
  for (const window of bom.windows) assert.equal(window.each, windowPrice(window.glass))
})

test('the estimated cost responds to the choices, and barely moves with the units', () => {
  const measured = measureBuilding(house)
  const whole = billCost(billOfMaterials(house, {}, measured)).total
  const metric = billCost(billOfMaterials(house, {}, measured), 'metric').total, imperial = billCost(billOfMaterials(house, {}, measured), 'imperial').total
  assert.ok(Math.abs(imperial - metric) / metric < 0.03, `${metric} and ${imperial} differ only through rounding up`)
  const upper = billCost(billOfMaterials(house, { floor: 1 }, measured)).total
  assert.ok(upper > 0 && upper < whole, 'one floor costs less than the building')
  assert.notEqual(billCost(billOfMaterials(house, { roofType: 'flat' }, measured)).sections.envelope, billCost(billOfMaterials(house, { roofType: 'hip' }, measured)).sections.envelope)
})

test('an item with no price shows as such and adds nothing, rather than breaking the bill', () => {
  const bom = { sections: [{ id: 'x', rows: [{ item: 'Unknown thing', quantity: 2, kind: 'count', waste: 0, pack: null }] }], doors: [], windows: [] }
  assert.equal(rowPrice(bom.sections[0].rows[0]), null)
  assert.equal(billCost(bom).total, 0)
})

test('money reads plainly, with cents only on small unit prices', () => {
  assert.equal(money(5), '$5')
  assert.equal(money(0.61), '$0.61')
  assert.equal(money(37.85), '$37.85')
  assert.equal(money(2466), '$2,466')
  assert.equal(money(0), '$0')
  assert.equal(roughMoney(68449), '$68,400')
  assert.equal(windowPrice(0.1), 150, 'a small window still has a floor price')
  assert.equal(windowPrice(1.8), 540)
})

test('the exports carry the prices and agree with the panel', () => {
  const bom = billOfMaterials(house)
  const cost = billCost(bom)
  const lines = bomCsv(bom, { name: 'x', units: 'metric' }).split('\r\n')
  assert.ok(lines.some(line => line.endsWith('Priced per,Estimated price (USD)')))
  assert.ok(lines.includes(`Total,${cost.total}`))
  assert.ok(lines.some(line => line.startsWith('"Rough US retail prices')))
  const studs = lines.find(line => line.includes(',Wall studs,')).split(',')
  assert.equal(Number(studs.at(-1)), rowPrice(rowOf(bom, 'Wall studs')).total)
  const parsed = JSON.parse(modelJson(house, bom, { name: 'x', units: 'metric' }))
  assert.equal(parsed.estimatedCost.total, cost.total)
  assert.equal(parsed.estimatedCost.currency, 'USD')
  assert.equal(parsed.billOfMaterials.sections[0].rows[0].estimatedPrice.total, rowPrice(bom.sections[0].rows[0]).total)
  assert.ok(parsed.billOfMaterials.doors.every(door => door.each > 0))
})

test('the CSV opens cleanly: UTF-8 marked, quoted where needed, and safe from spreadsheet formulas', () => {
  const csv = bomCsv(billOfMaterials(house), { name: '=SUM(A1), "my" plan', units: 'metric' })
  assert.equal(csv[0], '﻿')
  assert.ok(csv.includes(`"'=SUM(A1), ""my"" plan"`))
  assert.ok(csv.includes('m²'))
  for (const heading of ['MasterFormat,Section,Item', 'Division 03,Concrete,', 'Wall types', 'Door schedule', 'Window schedule', 'Room schedule']) assert.ok(csv.includes(heading), heading)
  const line = csv.split('\r\n').find(row => row.includes(',Floor finish,'))
  const fields = line.split(',')
  const order = Number(fields.at(-5)), quantity = Number(fields.at(-8))
  assert.ok(order >= quantity * 1.1 - 0.01 && order <= quantity * 1.1 + 1)
  assert.ok(bomCsv(billOfMaterials(house), { name: 'x', units: 'imperial' }).includes('ft²'))
})

/** A DXF file is alternating lines of code and value. */
function dxfPairs(text) {
  const lines = text.trimEnd().split('\r\n')
  assert.equal(lines.length % 2, 0, 'codes and values pair up')
  const pairs = []
  for (let i = 0; i < lines.length; i += 2) {
    assert.match(lines[i], /^\d+$/, `line ${i} is a group code`)
    pairs.push([Number(lines[i]), lines[i + 1]])
  }
  return pairs
}

test('the DXF is well formed, with one closed outline per piece on standard layers', () => {
  const pairs = dxfPairs(floorPlansDxf(house, { name: 'Two-floor house' }))
  assert.deepEqual(pairs.at(-1), [0, 'EOF'])
  assert.equal(pairs.filter(([code, value]) => code === 0 && value === 'SECTION').length, pairs.filter(([code, value]) => code === 0 && value === 'ENDSEC').length)
  const polylines = pairs.filter(([code, value]) => code === 0 && value === 'POLYLINE').length
  assert.equal(polylines, house.length, 'walls, openings, stairs and furniture each get an outline')
  assert.equal(pairs.filter(([code, value]) => code === 0 && value === 'SEQEND').length, polylines)
  assert.equal(pairs.filter(([code, value]) => code === 0 && value === 'VERTEX').length, polylines * 4)
  const layers = new Set(pairs.filter(([code]) => code === 8).map(([, value]) => value))
  for (const layer of ['A-WALL', 'A-GLAZ', 'A-DOOR', 'A-FLOR-STRS', 'A-FURN', 'A-ANNO']) assert.ok(layers.has(layer), layer)
  for (const [code, value] of pairs) if (code === 10 || code === 20) assert.ok(Number.isFinite(Number(value)), `${code} ${value}`)
})

test('floors sit side by side in the DXF, the right way up, and odd names stay readable', () => {
  const twoFloors = [...box, ...box.map(element => ({ ...element, floor: 1 }))]
  const pairs = dxfPairs(floorPlansDxf(twoFloors, { name: 'Café\nplan' }))
  const xs = pairs.filter(([code]) => code === 10).map(([, value]) => Number(value))
  assert.ok(Math.max(...xs) > 20, 'the second floor is beside the first')
  assert.ok(Math.min(...pairs.filter(([code]) => code === 20).map(([, value]) => Number(value))) < -5, 'plan Z becomes negative Y')
  const title = pairs.find(([code, value]) => code === 1 && value.includes('plan, Floor 1'))
  assert.ok(title, 'the title is one printable line')
  assert.match(title[1], /^[\x20-\x7e]+$/)
})

test('the JSON carries the model and its quantities, and file names are safe', () => {
  const parsed = JSON.parse(modelJson(house, billOfMaterials(house), { name: 'Two-floor house', units: 'imperial' }))
  assert.equal(parsed.project, 'ArchiTech')
  assert.equal(parsed.elements.length, house.length)
  assert.equal(parsed.lengthsIn, 'meters')
  assert.ok(parsed.billOfMaterials.sections.length > 3)
  assert.equal(fileStem('Two-floor house'), 'two-floor-house')
  assert.equal(fileStem('../../etc/passwd'), 'etc-passwd')
  assert.equal(fileStem('平面図'), 'floor-plan')
})
