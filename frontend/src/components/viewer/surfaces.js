import * as THREE from 'three'

/*
 * Painted once in the browser, so the house needs no image downloads. Each pattern is one tile, repeated
 * by real distance: geometry carries texture coordinates in meters (see lib/surfaceUv.js).
 */
function seeded(seed) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function tile(size, meters, paint, colorSpace) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  paint(canvas.getContext('2d'), size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1 / meters, 1 / meters)
  texture.anisotropy = 8
  texture.colorSpace = colorSpace
  return texture
}

const speckle = (context, size, random, base, spread) => {
  const image = context.getImageData(0, 0, size, size)
  const { data } = image
  for (let i = 0; i < data.length; i += 4) {
    const shift = (random() - 0.5) * spread + base
    data[i] += shift; data[i + 1] += shift; data[i + 2] += shift
  }
  context.putImageData(image, 0, 0)
}

const grey = value => `rgb(${value},${value},${value})`

/** Smooth painted plaster: near-white, so the material's color still decides the hue. */
function paintPlaster(context, size) {
  const random = seeded(11)
  context.fillStyle = grey(244)
  context.fillRect(0, 0, size, size)
  for (let i = 0; i < 220; i++) {
    const x = random() * size, y = random() * size, r = 18 + random() * 70
    const shade = random() < 0.5 ? 255 : 226
    const gradient = context.createRadialGradient(x, y, 0, x, y, r)
    gradient.addColorStop(0, `rgba(${shade},${shade},${shade},0.1)`)
    gradient.addColorStop(1, `rgba(${shade},${shade},${shade},0)`)
    context.fillStyle = gradient
    for (const [dx, dy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
      context.setTransform(1, 0, 0, 1, dx, dy)
      context.fillRect(x - r, y - r, r * 2, r * 2)
    }
  }
  context.setTransform(1, 0, 0, 1, 0, 0)
  speckle(context, size, random, 0, 3)
}

const BOARDS = 8
/** Painted weatherboard for the outside of the house, one shadow line per board. */
function paintSiding(context, size) {
  const random = seeded(23)
  const board = size / BOARDS
  for (let i = 0; i < BOARDS; i++) {
    const y = i * board
    const gradient = context.createLinearGradient(0, y, 0, y + board)
    gradient.addColorStop(0, grey(255))
    gradient.addColorStop(0.9, grey(240))
    gradient.addColorStop(0.95, grey(214))
    gradient.addColorStop(1, grey(190))
    context.fillStyle = gradient
    context.fillRect(0, y, size, board)
  }
  speckle(context, size, random, 0, 5)
}

function paintSidingHeight(context, size) {
  const board = size / BOARDS
  for (let i = 0; i < BOARDS; i++) {
    const gradient = context.createLinearGradient(0, i * board, 0, (i + 1) * board)
    gradient.addColorStop(0, grey(60))
    gradient.addColorStop(0.93, grey(220))
    gradient.addColorStop(1, grey(30))
    context.fillStyle = gradient
    context.fillRect(0, i * board, size, board)
  }
}

/** A mown lawn: soft patches of lighter and darker green, under thousands of short blades. */
function paintGrass(context, size) {
  const random = seeded(71)
  context.fillStyle = 'hsl(98 34% 31%)'
  context.fillRect(0, 0, size, size)
  for (let p = 0; p < 40; p++) {
    const x = random() * size, y = random() * size, radius = size * (0.08 + random() * 0.14)
    const color = `${88 + random() * 22} ${28 + random() * 14}% ${24 + random() * 15}%`
    // Painted a tile away in every direction too, so a patch running off one edge comes back on the other.
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        const gradient = context.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, radius)
        gradient.addColorStop(0, `hsl(${color} / 0.3)`)
        gradient.addColorStop(1, `hsl(${color} / 0)`)
        context.fillStyle = gradient
        context.fillRect(x + dx - radius, y + dy - radius, radius * 2, radius * 2)
      }
    }
  }
  context.lineCap = 'round'
  for (let b = 0; b < 26000; b++) {
    const x = random() * size, y = random() * size
    const length = size * (0.006 + random() * 0.012), lean = (random() - 0.5) * 2.4 - Math.PI / 2
    context.strokeStyle = `hsl(${84 + random() * 28} ${30 + random() * 22}% ${22 + random() * 24}% / ${0.3 + random() * 0.4})`
    context.lineWidth = 0.8 + random() * 1.2
    context.beginPath()
    for (const [dx, dy] of [[0, 0], [x < length ? size : 0, 0], [0, y < length ? size : 0]]) {
      context.moveTo(x + dx, y + dy)
      context.lineTo(x + dx + Math.cos(lean) * length, y + dy + Math.sin(lean) * length)
    }
    context.stroke()
  }
  speckle(context, size, random, 0, 9)
}

const PLANK_ROWS = 12
/** Warm oak boards with staggered joints and a little grain. Boards run along X. */
function paintPlanks(context, size) {
  const random = seeded(37)
  const row = size / PLANK_ROWS
  for (let r = 0; r < PLANK_ROWS; r++) {
    let x = -random() * size * 0.5
    while (x < size) {
      const length = size * (0.38 + random() * 0.3)
      const light = 50 + random() * 7
      const hue = 31 + random() * 5
      context.fillStyle = `hsl(${hue} 40% ${light}%)`
      context.fillRect(x, r * row, length, row)
      for (let g = 0; g < 26; g++) {
        const y = r * row + random() * row
        context.strokeStyle = `hsla(${hue - 4} 45% ${light - 18}% / ${0.05 + random() * 0.1})`
        context.lineWidth = 0.6 + random()
        context.beginPath()
        const from = x + random() * length * 0.7
        context.moveTo(from, y)
        context.bezierCurveTo(from + length * 0.1, y + (random() - 0.5) * 3, from + length * 0.2, y + (random() - 0.5) * 3, from + length * 0.3, y)
        context.stroke()
      }
      context.fillStyle = 'rgba(62,42,24,0.55)'
      context.fillRect(x + length - 1.5, r * row, 1.5, row)
      x += length
    }
    context.fillStyle = 'rgba(62,42,24,0.6)'
    context.fillRect(0, r * row, size, 1.5)
  }
}

const SHINGLE_ROWS = 10
/** Roof tiles in slightly varied warm greys, each row half a tile along from the last. */
function paintShingles(context, size, heights = false) {
  const random = seeded(53)
  const row = size / SHINGLE_ROWS, across = 8, tab = size / across
  for (let r = 0; r < SHINGLE_ROWS; r++) {
    for (let c = -1; c <= across; c++) {
      const x = c * tab + (r % 2 ? tab / 2 : 0), y = r * row
      const gradient = context.createLinearGradient(0, y, 0, y + row)
      if (heights) {
        gradient.addColorStop(0, grey(70))
        gradient.addColorStop(0.92, grey(225))
        gradient.addColorStop(1, grey(20))
      } else {
        const light = 33 + random() * 4.5, hue = 24 + random() * 6, sat = 8 + random() * 3
        gradient.addColorStop(0, `hsl(${hue} ${sat}% ${light - 3}%)`)
        gradient.addColorStop(0.9, `hsl(${hue} ${sat}% ${light + 2}%)`)
        gradient.addColorStop(1, `hsl(${hue} ${sat}% ${light - 12}%)`)
      }
      context.fillStyle = gradient
      context.fillRect(x, y, tab - 1, row)
      context.fillStyle = heights ? grey(20) : 'rgba(20,16,13,0.55)'
      context.fillRect(x + tab - 1.5, y, 1.5, row)
    }
  }
}

let cache = null
/** Shared across the model and never disposed: there's one of each for the life of the page. */
export function surfaces() {
  if (cache) return cache
  cache = {
    plaster: tile(512, 2.4, paintPlaster, THREE.SRGBColorSpace),
    siding: tile(512, 1.28, paintSiding, THREE.SRGBColorSpace),
    sidingHeight: tile(256, 1.28, paintSidingHeight, THREE.NoColorSpace),
    planks: tile(1024, 2.4, paintPlanks, THREE.SRGBColorSpace),
    grass: tile(1024, 5, paintGrass, THREE.SRGBColorSpace),
    shingles: tile(1024, 2.4, paintShingles, THREE.SRGBColorSpace),
    shingleHeight: tile(512, 2.4, (context, size) => paintShingles(context, size, true), THREE.NoColorSpace),
  }
  return cache
}
