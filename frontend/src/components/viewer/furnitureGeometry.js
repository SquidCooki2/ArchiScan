import * as THREE from 'three'
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { fitScale } from '../../lib/furniture.js'
import { FURNITURE } from './colors.js'

const pixels = new WeakMap()
// Softens the low-poly facets of a curved bowl or tub, and leaves real corners crisp.
const SOFT_CREASE = 0.85

/** A texture's image as readable pixels, kept per image since the whole pack shares one atlas. */
function readable(image) {
  if (!pixels.has(image)) {
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(image, 0, 0)
    pixels.set(image, context.getImageData(0, 0, image.width, image.height))
  }
  return pixels.get(image)
}

const wrap = value => value - Math.floor(value)

function sampleTexture(texture, u, v, color) {
  const { data, width, height } = readable(texture.image)
  const x = Math.min(width - 1, Math.floor(wrap(u) * width))
  const row = Math.min(height - 1, Math.floor(wrap(v) * height))
  const y = texture.flipY ? height - 1 - row : row
  const o = (y * width + x) * 4
  return color.setRGB(data[o] / 255, data[o + 1] / 255, data[o + 2] / 255, THREE.SRGBColorSpace)
}

/**
 * Both packs are low-poly with flat color, so each vertex can carry its color. Pulling the toy-bright
 * originals toward one soft tone makes them read as a set on the model, and keeps saturated blue for
 * the cut tools, while each piece's wood and fabric stay easy to tell apart.
 */
function grade(color, { muted, tint, tone }) {
  const luma = color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722
  return color.setRGB(color.r + (luma - color.r) * muted, color.g + (luma - color.g) * muted, color.b + (luma - color.b) * muted).lerp(tone, tint)
}

/** A finish's color for this vertex of this material, or null to keep the model's own. */
function finishColor(finish, name, x, y, z) {
  const region = finish?.regions?.find(({ material, min, max }) => material === name
    && x >= min[0] && x <= max[0] && y >= min[1] && y <= max[1] && z >= min[2] && z <= max[2])
  return region?.color ?? finish?.palette?.[name] ?? null
}

function bakedPart(mesh, look, finish) {
  mesh.updateWorldMatrix(true, false)
  const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)
  const { position, uv } = geometry.attributes
  const colors = new Float32Array(position.count * 3)
  const { color: base, map, name } = mesh.material
  const color = new THREE.Color()
  for (let i = 0; i < position.count; i++) {
    const finished = finishColor(finish, name, position.getX(i), position.getY(i), position.getZ(i))
    if (finished) color.set(finished)
    else {
      if (map && uv) sampleTexture(map, uv.getX(i), uv.getY(i), color).multiply(base)
      else color.copy(base)
      grade(color, look)
    }
    color.toArray(colors, i * 3)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  for (const attribute of Object.keys(geometry.attributes)) {
    if (!['position', 'normal', 'color'].includes(attribute)) geometry.deleteAttribute(attribute)
  }
  return geometry.index ? geometry.toNonIndexed() : geometry
}

/** The Kenney files repeat some nodes exactly. Drawn twice they'd only cost triangles. */
function sameGeometryKey(mesh) {
  mesh.updateWorldMatrix(true, false)
  const { position } = mesh.geometry.attributes
  const first = [0, 1, 2].map(i => position.array[i]?.toFixed(4)).join()
  const last = [3, 2, 1].map(i => position.array[position.array.length - i]?.toFixed(4)).join()
  return `${mesh.material.name}|${position.count}|${first}|${last}|${mesh.matrixWorld.elements.slice(12, 15).join()}`
}

function coloredGeometry(geometry, tone) {
  const plain = geometry.index ? geometry.toNonIndexed() : geometry
  plain.deleteAttribute('uv')
  const color = new THREE.Color(tone)
  const colors = new Float32Array(plain.attributes.position.count * 3)
  for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i)
  plain.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return plain
}

function dressingGeometry({ shape = 'box', at, size, color }) {
  const source = shape === 'cylinder' ? new THREE.CylinderGeometry(0.5, 0.5, 1, 14)
    : shape === 'sphere' ? new THREE.IcosahedronGeometry(0.5, 2)
    : new THREE.BoxGeometry(1, 1, 1)
  source.scale(size[0], size[1], size[2])
  source.translate(at[0], at[1], at[2])
  return coloredGeometry(source, color)
}

/**
 * One geometry from a whole model: every node merged, colors baked in, standing on y = 0, centered in
 * plan, and fitted to `size` in meters. One draw call per kind of furniture, however many there are.
 */
export function furnitureGeometry(scene, { size, turn = 0, muted = 0.12, tint = 0.3, tone = FURNITURE, finish = null }) {
  const look = { muted, tint, tone: new THREE.Color(tone) }
  const parts = []
  const seen = new Set()
  scene.traverse(child => {
    if (!child.isMesh) return
    const key = sameGeometryKey(child)
    if (seen.has(key)) return
    seen.add(key)
    parts.push(bakedPart(child, look, finish))
  })
  let geometry = parts.length === 1 ? parts[0] : mergeGeometries(parts)
  if (turn) geometry.rotateY(turn)
  geometry.computeBoundingBox()
  const { min, max } = geometry.boundingBox
  geometry.translate(-(min.x + max.x) / 2, -min.y, -(min.z + max.z) / 2)
  const [x, y, z] = fitScale([max.x - min.x, max.y - min.y, max.z - min.z], size)
  geometry.scale(x, y, z)
  if (finish) {
    geometry = toCreasedNormals(geometry, SOFT_CREASE)
    if (finish.dressing?.length) geometry = mergeGeometries([geometry, ...finish.dressing.map(dressingGeometry)])
  }
  geometry.computeBoundingSphere()
  return geometry
}

/** A plain box at the final size, shown until the models arrive and kept if they can't load. */
export function placeholderGeometry([width, height, depth], tone) {
  const geometry = new THREE.BoxGeometry(width, height, depth)
  geometry.translate(0, height / 2, 0)
  return coloredGeometry(geometry, tone)
}
