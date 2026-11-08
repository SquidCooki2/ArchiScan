/* oxlint-disable react/immutability -- Three.js clipping planes are mutable engine objects. */
import { useFrame } from '@react-three/fiber'
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { WALL_HEIGHT } from '../../lib/geometry'
import { buildRoofGeometry } from '../../lib/roof'
import { cutPlane } from '../../lib/sections'

/** Matches the walls' entrance: the roof settles once they have finished rising. */
const AFTER_WALLS_SECONDS = 1.2
const DROP_SECONDS = 0.55
const DROP_HEIGHT = 1.2
const FAR = 1e6

/**
 * Roof pieces from `plan.rects`, in plan coordinates. Each piece is drawn twice: lit surfaces plus
 * a back-face fill that reads as solid where a section cuts through it.
 *
 * The clipping planes use intersection mode: a fragment is removed only when it is beyond the cut
 * and also inside the target region. That lets one material follow every section scope, and the
 * fixed plane count avoids shader recompiles as sections turn on and off.
 */
function Roof({ plan, type, bounds, section, cut, region, loadedAt, reducedMotion }) {
  const planes = useMemo(() => Array.from({ length: 5 }, () => new THREE.Plane()), [])
  const materials = useMemo(() => {
    const clipping = { clippingPlanes: planes, clipIntersection: true }
    return {
      surfaces: [
        new THREE.MeshStandardMaterial({ color: '#62666b', roughness: 0.9, metalness: 0, clipShadows: true, ...clipping }),
        new THREE.MeshStandardMaterial({ color: '#e8e6e1', roughness: 0.85, metalness: 0, clipShadows: true, ...clipping }),
      ],
      fill: new THREE.MeshBasicMaterial({ color: '#a5b4fc', side: THREE.BackSide, ...clipping }),
    }
  }, [planes])
  useEffect(() => () => [...materials.surfaces, materials.fill].forEach(material => material.dispose()), [materials])

  useLayoutEffect(() => {
    const [slice, minX, maxX, minZ, maxZ] = planes
    if (!cut) { slice.set(new THREE.Vector3(0, 1, 0), FAR) } else {
      const definition = cutPlane(bounds, section)
      slice.normal.set(definition.normal.x, definition.normal.y, definition.normal.z)
      slice.constant = definition.constant
    }
    // A boundary plane's kept side is the outside of the region; parked planes keep nothing.
    minX.set(new THREE.Vector3(-1, 0, 0), region ? region.minX : -FAR)
    maxX.set(new THREE.Vector3(1, 0, 0), region ? -region.maxX : -FAR)
    minZ.set(new THREE.Vector3(0, 0, -1), region ? region.minZ : -FAR)
    maxZ.set(new THREE.Vector3(0, 0, 1), region ? -region.maxZ : -FAR)
  }, [planes, bounds, section, cut, region])

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
      {plan.rects.map((rect, index) => <group key={index} position={[rect.x, WALL_HEIGHT + 0.001, rect.z]} rotation={[0, -rect.rotation, 0]}>
        <mesh geometry={geometries[index]} material={materials.surfaces} castShadow receiveShadow />
        <mesh geometry={geometries[index]} material={materials.fill} />
      </group>)}
    </group>
  </group>
}

export default memo(Roof)
