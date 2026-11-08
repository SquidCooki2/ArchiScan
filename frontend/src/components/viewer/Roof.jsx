/* oxlint-disable react/immutability -- Three.js clipping planes are mutable engine objects. */
import { useFrame } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { buildRoofGeometry } from '../../lib/roof'
import { CARD, CUT } from './colors'
import { surfaces } from './surfaces'
import { useSectionClipping } from './useSectionClipping'

/** Matches the walls' entrance: the roof settles once they have finished rising. */
const AFTER_WALLS_SECONDS = 1.2
const DROP_SECONDS = 0.55
const DROP_HEIGHT = 1.2

/**
 * Roof pieces from `plan.rects`, in plan coordinates. Each piece is drawn twice: lit surfaces plus
 * a back-face fill that reads as solid where a section cuts through it.
 */
function Roof({ plan, type, bounds, section, cut, region, loadedAt, reducedMotion }) {
  const planes = useSectionClipping(bounds, section, cut, region)
  const materials = useMemo(() => {
    const clipping = { clippingPlanes: planes, clipIntersection: true }
    const { shingles, shingleHeight, siding, sidingHeight } = surfaces()
    return {
      surfaces: [
        new THREE.MeshStandardMaterial({ map: shingles, bumpMap: shingleHeight, bumpScale: 1.5, roughness: 0.9, metalness: 0, clipShadows: true, ...clipping }),
        new THREE.MeshStandardMaterial({ color: CARD, map: siding, bumpMap: sidingHeight, bumpScale: 1.2, roughness: 0.85, metalness: 0, clipShadows: true, ...clipping }),
      ],
      fill: new THREE.MeshBasicMaterial({ color: CUT, side: THREE.BackSide, ...clipping }),
    }
  }, [planes])
  useEffect(() => () => [...materials.surfaces, materials.fill].forEach(material => material.dispose()), [materials])

  const geometries = useMemo(() => plan.rects.map(rect => buildRoofGeometry(type, rect)), [plan, type])
  useEffect(() => () => geometries.forEach(geometry => geometry.dispose()), [geometries])

  // Waits for the walls on a fresh model; plays at once when only the roof type changes.
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
    const p = reducedMotion ? 1 : THREE.MathUtils.clamp((clock.elapsedTime - t.start - t.delay) / DROP_SECONDS, 0, 1)
    g.visible = p > 0
    g.position.y = (1 - p) ** 3 * DROP_HEIGHT
    t.done = p >= 1
  })

  return <group position={[-bounds.cx, 0, -bounds.cz]}>
    <group ref={group} visible={false}>
      {plan.rects.map((rect, index) => <group key={index} position={[rect.x, plan.base + 0.001, rect.z]} rotation={[0, -rect.rotation, 0]}>
        <mesh geometry={geometries[index]} material={materials.surfaces} castShadow receiveShadow />
        <mesh geometry={geometries[index]} material={materials.fill} />
      </group>)}
    </group>
  </group>
}

export default memo(Roof)
