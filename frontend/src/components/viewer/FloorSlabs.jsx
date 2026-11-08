import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { computeBounds, elementFloor, floorBase, floorCount } from '../../lib/geometry'
import { SLAB } from './colors'
import { useSectionClipping } from './useSectionClipping'

const THICKNESS = 0.1
// Just inside the walls and just above the walls below, so no faces coincide and flicker.
const INSET = 0.02
const LIFT = 0.006

/**
 * A thin floor under each storey, sized to it, so rooms read as rooms against the white walls.
 * Escape routes leave out the ground slab: their glowing arrows need the dark table.
 */
export default function FloorSlabs({ walls, bounds, section, cut, region, visibleFloor, ground = true }) {
  const slabs = useMemo(() => {
    const result = []
    for (let floor = ground ? 0 : 1; floor < floorCount(walls); floor++) {
      const elements = walls.filter(element => elementFloor(element) === floor)
      if (elements.length) result.push({ floor, area: computeBounds(elements) })
    }
    return result
  }, [walls, ground])
  const planes = useSectionClipping(bounds, section, cut, region)
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: SLAB, roughness: 0.95, clippingPlanes: planes, clipIntersection: true }), [planes])
  useEffect(() => () => material.dispose(), [material])
  return <group position={[-bounds.cx, 0, -bounds.cz]}>
    {slabs.filter(({ floor }) => visibleFloor === 'all' || floor <= visibleFloor).map(({ floor, area }) => <mesh key={floor} name={`floor-slab-${floor}`} material={material} receiveShadow
      position={[area.cx, floorBase(floor) + LIFT - THICKNESS / 2, area.cz]}>
      <boxGeometry args={[area.width - INSET * 2, THICKNESS, area.depth - INSET * 2]} />
    </mesh>)}
  </group>
}
