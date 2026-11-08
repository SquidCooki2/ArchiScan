import { useFrame } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { WALL_HEIGHT } from '../../lib/geometry'

const RISE_SECONDS = 0.6
const SWEEP_SECONDS = 0.9

/**
 * Renders walls[] as boxes inside a group centered on the world origin.
 * Each wall is drawn twice: a lit front-face mesh, and a flat back-face "cap"
 * that shows through the section cut as solid poché fill.
 */
function Walls({ walls, bounds, plane, reducedMotion }) {
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#e8e6e1',
        roughness: 0.85,
        metalness: 0,
        clippingPlanes: [plane],
        clipShadows: true,
        side: THREE.FrontSide,
      }),
    [plane],
  )
  const capMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#8ec5e8',
        clippingPlanes: [plane],
        side: THREE.BackSide,
      }),
    [plane],
  )
  const geometries = useMemo(
    () => walls.map((w) => new THREE.BoxGeometry(w.width, WALL_HEIGHT, w.depth)),
    [walls],
  )
  useEffect(
    () => () => {
      material.dispose()
      capMaterial.dispose()
    },
    [material, capMaterial],
  )
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries])

  // Walls rise in a diagonal sweep from the plan's top-left corner, like a scan passing over it.
  const delays = useMemo(() => {
    const span = bounds.sizeX + bounds.sizeZ || 1
    return walls.map((w) => ((w.x - bounds.minX + (w.z - bounds.minZ)) / span) * SWEEP_SECONDS)
  }, [walls, bounds])

  const groups = useRef([])
  const startedAt = useRef(null)
  const settled = useRef(false)

  useFrame(({ clock }) => {
    if (settled.current) return
    if (startedAt.current === null) startedAt.current = clock.elapsedTime
    const t = clock.elapsedTime - startedAt.current
    let done = true
    groups.current.forEach((g, i) => {
      if (!g) return
      const p = reducedMotion ? 1 : THREE.MathUtils.clamp((t - delays[i]) / RISE_SECONDS, 0, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      g.visible = eased > 0
      g.scale.y = Math.max(eased, 0.0001)
      if (p < 1) done = false
    })
    settled.current = done
  })

  return (
    <group position={[-bounds.cx, 0, -bounds.cz]}>
      {walls.map((w, index) => (
        <group
          key={index}
          ref={(el) => {
            groups.current[index] = el
          }}
          position={[w.x, 0, w.z]}
          rotation={[0, -w.rotation, 0]}
        >
          <mesh
            geometry={geometries[index]}
            material={material}
            position-y={WALL_HEIGHT / 2}
            castShadow
            receiveShadow
          />
          <mesh geometry={geometries[index]} material={capMaterial} position-y={WALL_HEIGHT / 2} />
        </group>
      ))}
    </group>
  )
}

export default memo(Walls)
