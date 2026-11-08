import { useFrame } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { WALL_HEIGHT } from '../../lib/geometry'
import { buildRoofGeometry } from '../../lib/roof'

/** Matches the walls' entrance: the roof settles once they have finished rising. */
const AFTER_WALLS_SECONDS = 1.4
const DROP_SECONDS = 0.55
const DROP_HEIGHT = 1.2

/**
 * Roof pieces from `plan.rects`, in plan coordinates, inside the same centered group as the walls.
 * Like the walls, each piece is drawn twice: lit surfaces plus a back-face cap that shows as
 * solid blueprint fill where the section plane cuts through it.
 */
function Roof({ plan, type, bounds, plane, loadedAt, reducedMotion }) {
  const roofMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#62666b',
        roughness: 0.9,
        metalness: 0,
        clippingPlanes: [plane],
        clipShadows: true,
      }),
    [plane],
  )
  const gableMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#e8e6e1',
        roughness: 0.85,
        metalness: 0,
        clippingPlanes: [plane],
        clipShadows: true,
      }),
    [plane],
  )
  const capMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#8ec5e8', side: THREE.BackSide, clippingPlanes: [plane] }),
    [plane],
  )
  useEffect(
    () => () => {
      roofMaterial.dispose()
      gableMaterial.dispose()
      capMaterial.dispose()
    },
    [roofMaterial, gableMaterial, capMaterial],
  )

  const geometries = useMemo(() => plan.rects.map((r) => buildRoofGeometry(type, r)), [plan, type])
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries])

  const surfaceMaterials = useMemo(() => [roofMaterial, gableMaterial], [roofMaterial, gableMaterial])

  // Drop-in: waits for the walls on a fresh model, plays at once when only the roof type changes.
  const group = useRef(null)
  const timing = useRef(null)
  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    if (!timing.current) {
      const sinceLoad = (performance.now() - loadedAt) / 1000
      timing.current = { start: clock.elapsedTime, delay: Math.max(0, AFTER_WALLS_SECONDS - sinceLoad), done: false }
    }
    const t = timing.current
    if (t.done) return
    const p = reducedMotion
      ? 1
      : THREE.MathUtils.clamp((clock.elapsedTime - t.start - t.delay) / DROP_SECONDS, 0, 1)
    const eased = 1 - Math.pow(1 - p, 3)
    g.visible = p > 0
    g.position.y = (1 - eased) * DROP_HEIGHT
    t.done = p >= 1
  })

  return (
    <group position={[-bounds.cx, 0, -bounds.cz]}>
      <group ref={group} visible={false}>
        {plan.rects.map((r, index) => (
          <group key={index} position={[r.x, WALL_HEIGHT + 0.001, r.z]} rotation={[0, -r.rotation, 0]}>
            <mesh geometry={geometries[index]} material={surfaceMaterials} castShadow receiveShadow />
            <mesh geometry={geometries[index]} material={capMaterial} />
          </group>
        ))}
      </group>
    </group>
  )
}

export default memo(Roof)
