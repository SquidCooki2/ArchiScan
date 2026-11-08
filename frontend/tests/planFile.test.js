import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { billOfMaterials } from '../src/lib/billOfMaterials.js'
import { modelJson } from '../src/lib/exports.js'
import { isPlanFile, parsePlanFile, validatePlanFiles } from '../src/lib/planFile.js'
import { settleFurniture } from '../src/lib/settleFurniture.js'

const sample = name => readFileSync(new URL(`../../sample_output/${name}.walls.json`, import.meta.url), 'utf8')
const wall = { type: 'wall', x: 1, z: 1, width: 4, depth: 0.2, rotation: 0 }
const parse = data => parsePlanFile(JSON.stringify(data), 'plan.json')

test('both saved backend outputs open as they are', () => {
  for (const name of ['house1_2floors', 'apartment_furnished_preview']) {
    const text = sample(name)
    const plan = parsePlanFile(text, `${name}.json`)
    assert.deepEqual(plan.walls, JSON.parse(text))
    assert.equal(plan.name, `${name}.json`)
    assert.equal(plan.roofType, null)
  }
})

test('a plan wrapped in { walls } opens too', () => {
  assert.deepEqual(parse({ walls: [wall] }).walls, [wall])
})

test('a file from the Export menu reopens with its elements, name, and roof', () => {
  for (const name of ['house1_2floors', 'apartment_furnished_preview']) {
    const walls = settleFurniture(JSON.parse(sample(name)))
    const text = modelJson(walls, billOfMaterials(walls, { roofType: 'hip' }), { name: 'Our house' })
    const plan = parsePlanFile(text, 'our-house-model.json')
    assert.deepEqual(plan.walls, walls)
    assert.equal(plan.name, 'Our house')
    assert.equal(plan.roofType, 'hip')
  }
})

test('only an export counts as already settled, so its furniture stays where it was saved', () => {
  const walls = settleFurniture(JSON.parse(sample('apartment_furnished_preview')))
  const exported = modelJson(walls, billOfMaterials(walls), { name: 'Flat' })
  assert.equal(parsePlanFile(exported, 'flat.json').settled, true)
  assert.equal(parse([wall]).settled, false)
  assert.equal(parse({ walls: [wall] }).settled, false)
})

test('a name or roof that isn’t usable falls back instead of failing', () => {
  const plan = parse({ model: 42, roof: 'dome', elements: [wall] })
  assert.equal(plan.name, 'plan.json')
  assert.equal(plan.roofType, null)
  assert.equal(parse({ model: '   ', elements: [wall] }).name, 'plan.json')
})

test('each kind of bad file gets a message that says what’s wrong', () => {
  const rejects = (input, pattern) => assert.throws(() => parsePlanFile(typeof input === 'string' ? input : JSON.stringify(input), 'plan.json'), pattern)
  rejects('{ not json', /plan\.json isn’t valid JSON/)
  rejects('null', /doesn’t hold a floor plan/)
  rejects('7', /doesn’t hold a floor plan/)
  rejects({ rooms: [] }, /doesn’t hold a floor plan/)
  rejects([], /no walls, doors, or windows/)
  rejects([{ type: 'chair', x: 0, z: 0, rotation: 0 }], /no walls, doors, or windows/)
  rejects([wall, { ...wall, width: 'wide' }], /Element 2 in plan\.json/)
  rejects([wall, null], /Element 2 in plan\.json/)
  rejects([wall, { ...wall, type: 'spaceship' }], /Element 2 in plan\.json/)
  rejects([{ ...wall, x: null }], /Element 1 in plan\.json/)
  rejects([{ ...wall, rotation: -1 }], /Element 1 in plan\.json/)
  rejects([wall, { type: 'bed', x: 0, z: 0, rotation: 0, fitWidth: 'big' }], /Element 2 in plan\.json/)
  rejects([wall, { type: 'bed', x: 0, z: 0, rotation: 0, fitDepth: -1 }], /Element 2 in plan\.json/)
  rejects([{ ...wall, floor: 5 }], /more than 5 floors/)
  rejects([{ ...wall, floor: 1e9 }], /more than 5 floors/)
  rejects([{ ...wall, width: 1e7 }], /over 500 meters/)
  rejects(Array.from({ length: 2501 }, () => wall), /over 2500 elements/)
})

test('a JSON file is recognized by its type or its extension', () => {
  assert.ok(isPlanFile({ name: 'plan.json', type: '' }))
  assert.ok(isPlanFile({ name: 'PLAN.JSON', type: '' }))
  assert.ok(isPlanFile({ name: 'plan', type: 'application/json' }))
  assert.ok(!isPlanFile({ name: 'plan.png', type: 'image/png' }))
  assert.ok(!isPlanFile({ name: 'json.png', type: 'image/png' }))
})

test('only one small, non-empty JSON file is allowed at a time', () => {
  const file = { name: 'plan.json', size: 100 }
  assert.doesNotThrow(() => validatePlanFiles([file]))
  assert.throws(() => validatePlanFiles([file, file]), /one JSON file/)
  assert.throws(() => validatePlanFiles([file, { name: 'floor.png', size: 100 }]), /one JSON file/)
  assert.throws(() => validatePlanFiles([{ name: 'plan.json', size: 0 }]), /empty/)
  assert.throws(() => validatePlanFiles([{ name: 'plan.json', size: 6 * 1024 * 1024 }]), /over 5 MB/)
})
