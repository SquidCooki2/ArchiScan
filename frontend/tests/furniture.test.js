import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FINISHES } from '../src/components/viewer/fixtureFinishes.js'
import { furnitureGeometry } from '../src/components/viewer/furnitureGeometry.js'
import { drawnModel, fitScale, FURNITURE, FURNITURE_MODELS, furnitureRect, routeObstacles } from '../src/lib/furniture.js'
import { FURNITURE_TYPES } from '../src/lib/geometry.js'

const assetUrl = file => new URL(`../public/assets/furniture/${file}`, import.meta.url)

/** A file's glTF description: the JSON itself, or the first chunk of a binary .glb. */
function gltfOf(file) {
  const bytes = readFileSync(assetUrl(file))
  if (file.endsWith('.gltf')) return JSON.parse(bytes)
  const length = bytes.readUInt32LE(12)
  return JSON.parse(bytes.subarray(20, 20 + length).toString('utf8'))
}

/** A model's raw size from what its file declares, across every node and primitive. */
function rawSize(file) {
  const gltf = gltfOf(file)
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  const visit = (index, offset) => {
    const node = gltf.nodes[index]
    const here = offset.map((value, axis) => value + (node.translation?.[axis] ?? 0))
    for (const primitive of gltf.meshes[node.mesh]?.primitives ?? []) {
      const accessor = gltf.accessors[primitive.attributes.POSITION]
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], accessor.min[axis] + here[axis])
        max[axis] = Math.max(max[axis], accessor.max[axis] + here[axis])
      }
    }
    for (const child of node.children ?? []) visit(child, here)
  }
  for (const root of gltf.scenes[gltf.scene ?? 0].nodes) visit(root, [0, 0, 0])
  return max.map((value, axis) => value - min[axis])
}

const loadScene = async file => {
  const bytes = readFileSync(assetUrl(file))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), '')
  return gltf.scene
}
const FIXTURES = ['fridge', 'sink', 'bathroomSink', 'toilet', 'bath']

test('every furniture type the contract allows has a size and a model file that exists', () => {
  assert.deepEqual(Object.keys(FURNITURE).sort(), [...FURNITURE_TYPES].sort())
  for (const { model } of Object.values(FURNITURE_MODELS)) assert.ok(existsSync(assetUrl(model)), model)
})

test('models keep close to their own proportions, so none is squashed into a lump', () => {
  for (const [kind, { model, size }] of Object.entries(FURNITURE_MODELS)) {
    const scale = fitScale(rawSize(model), size)
    const stretch = Math.max(...scale) / Math.min(...scale)
    // A wardrobe is the one exception: the packs have no tall cabinet, so a low one is raised.
    assert.ok(stretch < (kind === 'wardrobe' ? 4 : 1.75), `${kind} stretches ${stretch.toFixed(2)} times`)
  }
})

test('multi-node fixtures merge into one geometry, on the floor, centered, and at the target size', async () => {
  for (const kind of FIXTURES) {
    const definition = FURNITURE_MODELS[kind]
    const scene = await loadScene(definition.model)
    let meshes = 0
    scene.traverse(child => { if (child.isMesh) meshes++ })
    assert.ok(meshes > 1, `${kind} has several meshes in its file`)
    const geometry = furnitureGeometry(scene, definition)
    geometry.computeBoundingBox()
    const { min, max } = geometry.boundingBox
    definition.size.forEach((target, axis) => assert.ok(Math.abs(max.getComponent(axis) - min.getComponent(axis) - target) < 1e-3, `${kind} axis ${axis}`))
    assert.ok(Math.abs(min.y) < 1e-3, `${kind} stands on the floor`)
    assert.ok(Math.abs(min.x + max.x) < 1e-3 && Math.abs(min.z + max.z) < 1e-3, `${kind} is centered`)
    assert.ok(geometry.attributes.color.count === geometry.attributes.position.count, `${kind} carries its colors`)
    assert.equal(geometry.index, null)
  }
})

test('fixtures face +Z like the rest of the furniture: the toilet tank and sink tap are at the back', async () => {
  for (const kind of ['toilet', 'bathroomSink', 'sink']) {
    const definition = FURNITURE_MODELS[kind]
    const { attributes: { position } } = furnitureGeometry(await loadScene(definition.model), definition)
    let highest = 0
    for (let i = 0; i < position.count; i++) highest = Math.max(highest, position.getY(i))
    let sum = 0, count = 0
    for (let i = 0; i < position.count; i++) if (position.getY(i) > highest * 0.92) { sum += position.getZ(i); count++ }
    assert.ok(sum / count < 0, `${kind}: the tallest part is at z ${(sum / count).toFixed(2)}`)
  }
})

test('colors stay distinct between materials after grading', async () => {
  const definition = FURNITURE_MODELS.sink
  const { attributes: { color } } = furnitureGeometry(await loadScene(definition.model), definition)
  const tones = new Set()
  for (let i = 0; i < color.count; i++) tones.add(new THREE.Color(color.getX(i), color.getY(i), color.getZ(i)).getHexString())
  assert.ok(tones.size > 2, `${tones.size} tones`)
})

const sample = name => JSON.parse(readFileSync(new URL(`../../sample_output/${name}.walls.json`, import.meta.url)))

test('a sink in a room with a toilet or bath is a basin, and any other is a kitchen unit', () => {
  const house = sample('house1_2floors'), apartment = sample('apartment_furnished_preview')
  const kindAt = (elements, x, z) => drawnModel(elements.find(item => item.type === 'sink' && item.x === x && item.z === z), elements)
  assert.equal(kindAt(apartment, 9.07, 1.54), 'sink')
  assert.equal(kindAt(apartment, 6.35, 4.8), 'bathroomSink')
  assert.equal(kindAt(house, 11.77, 1.5), 'bathroomSink')
  assert.equal(drawnModel({ type: 'bed', floor: 0, x: 0, z: 0, rotation: 0 }, []), 'bed')
})

test('a wall between a sink and a toilet keeps them in different rooms, and floors never mix', () => {
  const sink = { type: 'sink', floor: 0, x: 0, z: 0, rotation: 0 }
  const toilet = { type: 'toilet', floor: 0, x: 2, z: 0, rotation: 0 }
  const wall = { type: 'wall', floor: 0, x: 1, z: 0, width: 4, depth: 0.2, rotation: Math.PI / 2 }
  assert.equal(drawnModel(sink, [sink, toilet]), 'bathroomSink')
  assert.equal(drawnModel(sink, [sink, toilet, wall]), 'sink')
  assert.equal(drawnModel(sink, [sink, { ...toilet, floor: 1 }]), 'sink')
  assert.equal(drawnModel(sink, [sink, { ...toilet, x: 3.5 }]), 'sink')
})

test('a piece takes up its width along the wall and its depth toward the room', () => {
  const size = FURNITURE.bed.size
  const facing = furnitureRect({ type: 'bed', x: 1, z: 2, rotation: Math.PI / 2 })
  assert.deepEqual([facing.x, facing.z, facing.width, facing.depth], [1, 2, size[0], size[2]])
  // Facing +X, the width runs along Z: a turn of a quarter from plan +X.
  assert.ok(Math.abs(Math.abs(Math.sin(facing.rotation)) - 1) < 1e-9)
})

test('routes treat fixed furniture as obstacles, on its own floor, and walk around chairs', () => {
  const items = [
    { type: 'bed', floor: 0, x: 1, z: 1, rotation: 0 },
    { type: 'chair', floor: 0, x: 3, z: 1, rotation: 0 },
    { type: 'couch', floor: 1, x: 5, z: 1, rotation: 0 },
    { type: 'wall', floor: 0, x: 0, z: 0, width: 1, depth: 0.2, rotation: 0 },
  ]
  assert.deepEqual(routeObstacles(items, 0).map(rect => rect.x), [1])
  assert.deepEqual(routeObstacles(items, 1).map(rect => rect.x), [5])
})

test('fixtures carry their homely finish: warm porcelain, an oak toilet lid, and dressing inside their footprint', async () => {
  const toneCount = (geometry, hex) => {
    const target = new THREE.Color(hex), { color } = geometry.attributes
    let matches = 0
    for (let i = 0; i < color.count; i++) {
      if (Math.abs(color.getX(i) - target.r) + Math.abs(color.getY(i) - target.g) + Math.abs(color.getZ(i) - target.b) < 0.08) matches++
    }
    return matches
  }
  const toilet = FURNITURE_MODELS.toilet
  const plain = furnitureGeometry(await loadScene(toilet.model), toilet)
  const finished = furnitureGeometry(await loadScene(toilet.model), { ...toilet, finish: FINISHES.toilet })
  assert.ok(toneCount(finished, '#b78c5e') > toneCount(plain, '#b78c5e'), 'the lid is oak')
  for (const kind of FIXTURES) {
    const definition = FURNITURE_MODELS[kind]
    const geometry = furnitureGeometry(await loadScene(definition.model), { ...definition, finish: FINISHES[kind] })
    geometry.computeBoundingBox()
    const { min, max } = geometry.boundingBox
    // Height is free, a roll can sit on a tank. The plan footprint is what keeps a piece clear of walls.
    for (const axis of [0, 2]) assert.ok(max.getComponent(axis) - min.getComponent(axis) < definition.size[axis] + 0.06, `${kind} axis ${axis} grew past its box`)
    assert.ok(min.y > -1e-3, `${kind} stays on the floor`)
    assert.equal(geometry.attributes.color.count, geometry.attributes.position.count)
  }
})
