import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** A box by its center in plan and its height span. */
function box(width, depth, bottom, top, x = 0, z = 0) {
  const geometry = new THREE.BoxGeometry(width, top - bottom, depth)
  geometry.translate(x, (bottom + top) / 2, z)
  return geometry
}

/** An upright cylinder, optionally stretched into an oval along Z. */
function cylinder(radius, bottom, top, z = 0, stretch = 1) {
  const geometry = new THREE.CylinderGeometry(radius, radius * 0.92, top - bottom, 24)
  geometry.scale(1, 1, stretch)
  geometry.translate(0, (bottom + top) / 2, z)
  return geometry
}

/** Four walls and a floor: a basin or a tub you can see into. */
function tub(width, depth, bottom, top, rim, floor) {
  const inner = width - rim * 2
  return [
    box(width, rim, bottom, top, 0, -(depth - rim) / 2),
    box(width, rim, bottom, top, 0, (depth - rim) / 2),
    box(rim, depth - rim * 2, bottom, top, -(width - rim) / 2),
    box(rim, depth - rim * 2, bottom, top, (width - rim) / 2),
    box(inner, depth - rim * 2, bottom, bottom + floor),
  ]
}

const BUILDERS = {
  /** Fridge: a body, two doors on the +Z front, and a handle on each. */
  fridge([w, h, d]) {
    const doorZ = d / 2 - 0.025, split = h * 0.66, gap = 0.012
    return [
      box(w, d - 0.05, 0, h, 0, -0.025),
      box(w - 0.01, 0.05, gap, split - gap, 0, doorZ),
      box(w - 0.01, 0.05, split + gap, h, 0, doorZ),
      box(0.025, 0.03, split - 0.42, split - 0.1, w * 0.36, d / 2 + 0.012),
      box(0.025, 0.03, split + 0.08, split + 0.3, w * 0.36, d / 2 + 0.012),
    ]
  },
  /** Sink: a vanity with a basin in the top and a tap at the back. */
  sink([w, h, d]) {
    const basin = h - 0.12
    return [
      box(w, d, 0, basin),
      ...tub(w, d, basin, h, 0.05, 0.02),
      box(0.03, 0.03, h, h + 0.14, 0, -d / 2 + 0.05),
      box(0.03, 0.12, h + 0.11, h + 0.14, 0, -d / 2 + 0.11),
    ]
  },
  /** Toilet: an oval bowl and seat toward the +Z front, a tank against the back. */
  toilet([w, h, d]) {
    const tankDepth = d * 0.24, bowlHeight = h * 0.53, radius = w * 0.46, stretch = 1.3
    const bowlZ = d / 2 - radius * stretch
    return [
      cylinder(radius, 0, bowlHeight, bowlZ, stretch),
      cylinder(radius * 1.04, bowlHeight, bowlHeight + 0.03, bowlZ, stretch),
      box(w, tankDepth, bowlHeight * 0.75, h, 0, -d / 2 + tankDepth / 2),
    ]
  },
  /** Bath: a long tub, open on top. */
  bath([w, h, d]) {
    return tub(w, d, 0, h, 0.07, 0.14)
  },
}

/** A fixture built to fit its box in meters, standing on y = 0 and facing +Z. */
export function fixtureGeometry(type, size) {
  const pieces = BUILDERS[type](size)
  const geometry = mergeGeometries(pieces)
  pieces.forEach(piece => piece.dispose())
  return geometry
}
