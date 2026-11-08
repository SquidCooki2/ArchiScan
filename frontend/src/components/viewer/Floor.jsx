import { useEffect, useMemo } from 'react'
import { Grid } from '@react-three/drei'
import * as THREE from 'three'
import { surfaces } from './surfaces'

// Meters of grass past the walls before the edge starts to fade, and how long that fade takes.
const YARD = 3.5
const YARD_FADE = 1.5
// The landing page's house turns beside its text, so its lawn stays clear of the words.
const PATCH = 1.6
const PATCH_FADE = 1
// While walking, the lawn reaches past whatever the windows can see.
const FIELD = 40
const FIELD_FADE = 12
const CORNER = 2
// The scene's bright, even light washes out plain green, so this holds it back to sit with the house.
const GRASS_TINT = '#a9b39c'
// Under the floor slabs and above the grid. The walls start at 0, so there's no gap to see.
const LAWN_Y = -0.01

/** How solid the lawn is across its width and depth: fully inside, fading out to nothing at a rounded edge. */
function edgeTexture(width, depth, fade) {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')
  const image = context.createImageData(size, size)
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      const x = Math.abs((column + 0.5) / size - 0.5) * width - (width / 2 - CORNER)
      const z = Math.abs((row + 0.5) / size - 0.5) * depth - (depth / 2 - CORNER)
      const distance = Math.hypot(Math.max(x, 0), Math.max(z, 0)) + Math.min(Math.max(x, z), 0) - CORNER
      const t = Math.min(1, Math.max(0, -distance / fade))
      const value = t * t * (3 - 2 * t) * 255
      const at = (row * size + column) * 4
      image.data[at] = image.data[at + 1] = image.data[at + 2] = value
      image.data[at + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  // The lawn's texture coordinates are in meters from its center, so its edge has to be scaled to fit.
  texture.repeat.set(1 / width, 1 / depth)
  texture.offset.set(0.5, 0.5)
  return texture
}

/** Grass around the house and under it. The floor slabs sit on top, so it only shows outside the walls. */
function Lawn({ bounds, field, patch }) {
  const reach = field ? FIELD : patch ? PATCH : YARD, fade = field ? FIELD_FADE : patch ? PATCH_FADE : YARD_FADE
  const width = bounds.width + 2 * (reach + fade), depth = bounds.depth + 2 * (reach + fade)
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(width, depth)
    const { position, uv } = plane.attributes
    for (let index = 0; index < position.count; index++) uv.setXY(index, position.getX(index), position.getY(index))
    return plane
  }, [width, depth])
  const edge = useMemo(() => edgeTexture(width, depth, fade), [width, depth, fade])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => edge.dispose(), [edge])
  // Drawn before the grid and writing depth, so the grid stays hidden beneath it. Fully clear parts are
  // thrown away, or the empty corners would hide the grid too.
  return <mesh name="lawn" geometry={geometry} rotation-x={-Math.PI / 2} position-y={LAWN_Y} renderOrder={-1} receiveShadow>
    <meshStandardMaterial map={surfaces().grass} color={GRASS_TINT} alphaMap={edge} transparent alphaTest={0.02} roughness={1} envMapIntensity={0.4} />
  </mesh>
}

/** The lawn on a drafting table: beyond the grass, only shadows and a faint grid over the page background. */
export default function Floor({ bounds, walkthrough = false, lawn = true, hero = false }) {
  const size = Math.max(bounds.size + 6, 16)
  return <group>
    {lawn && <Lawn bounds={bounds} field={walkthrough} patch={hero} />}
    {!walkthrough && <>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.025} receiveShadow>
        <planeGeometry args={[size * 3, size * 3]} /><shadowMaterial opacity={0.4} depthWrite={false} />
      </mesh>
      <Grid position={[0, -0.015, 0]} args={[size, size]} infiniteGrid cellSize={1} sectionSize={5} cellThickness={0.5} sectionThickness={0.8} cellColor="#2b323b" sectionColor="#3c4550" fadeDistance={Math.max(30, size * 1.8)} fadeStrength={2.5} />
    </>}
  </group>
}
