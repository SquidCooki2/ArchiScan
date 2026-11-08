/* oxlint-disable react/immutability -- Three.js clipping planes are mutable engine objects. */
import { useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { cutPlane } from '../../lib/sections'

const FAR = 1e6

/**
 * Clipping planes for surfaces that follow the model's cut, such as roofs and floor slabs. Use them
 * with `clipIntersection`: a fragment is removed only when it's beyond the cut and also inside the
 * target region. The fixed plane count avoids shader recompiles as cuts turn on and off.
 */
export function useSectionClipping(bounds, section, cut, region) {
  const planes = useMemo(() => Array.from({ length: 5 }, () => new THREE.Plane()), [])
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
  return planes
}
