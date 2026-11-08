import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { computeBounds, elementFloor, floorBase, floorCount, isFurniture, isStairs, stairwellCorners, WALL_HEIGHT } from '../../lib/geometry'
import { CARD, SLAB, WALK_FLOOR } from './colors'
import { useSectionClipping } from './useSectionClipping'

const THICKNESS = 0.1
// Just inside the walls and just above the walls below, so no faces coincide and flicker.
const INSET = 0.02
const LIFT = 0.006

/** A rectangle in plan as a shape's outline. Shape Y is plan -Z, because the shape lies down later. */
function outline(Path, corners) {
  const path = new Path()
  corners.forEach(([x, z], index) => (index ? path.lineTo(x, -z) : path.moveTo(x, -z)))
  path.closePath()
  return path
}

function slabShape(area, stairs) {
  const { minX, maxX, minZ, maxZ } = area
  const shape = outline(THREE.Shape, [[minX + INSET, minZ + INSET], [maxX - INSET, minZ + INSET], [maxX - INSET, maxZ - INSET], [minX + INSET, maxZ - INSET]])
  shape.holes = stairs.map(stair => outline(THREE.Path, stairwellCorners(stair, area, INSET * 2)))
  return shape
}

/**
 * A thin floor under each storey, sized to it, so rooms read as rooms against the white walls, with
 * an opening wherever a flight arrives from below. While walking, each also gets a white ceiling.
 * Escape routes leave out the ground slab: their glowing arrows need the dark table.
 */
export default function FloorSlabs({ walls, bounds, section, cut, region, visibleFloor, ground = true, walking = false }) {
  const floors = floorCount(walls)
  const slabs = useMemo(() => {
    const flights = walls.filter(isStairs)
    const result = []
    for (let floor = 0; floor < floors; floor++) {
      const elements = walls.filter(element => elementFloor(element) === floor && !isFurniture(element))
      if (!elements.length) continue
      const area = computeBounds(elements)
      const shape = slabShape(area, flights.filter(stair => elementFloor(stair) + 1 === floor))
      const solid = new THREE.ExtrudeGeometry(shape, { depth: THICKNESS, bevelEnabled: false })
      solid.rotateX(-Math.PI / 2)
      const underside = new THREE.ShapeGeometry(shape)
      underside.rotateX(-Math.PI / 2)
      result.push({ floor, solid, underside, area })
    }
    return result
  }, [walls, floors])
  useEffect(() => () => slabs.forEach(({ solid, underside }) => { solid.dispose(); underside.dispose() }), [slabs])
  const planes = useSectionClipping(bounds, section, cut, region)
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: walking ? WALK_FLOOR : SLAB, roughness: 0.95, clippingPlanes: planes, clipIntersection: true }), [planes, walking])
  const ceiling = useMemo(() => new THREE.MeshStandardMaterial({ color: CARD, roughness: 1, side: THREE.DoubleSide }), [])
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => ceiling.dispose(), [ceiling])
  const top = walking ? slabs.filter(({ floor }) => floor === floors - 1) : []
  return <group position={[-bounds.cx, 0, -bounds.cz]}>
    {slabs.filter(({ floor }) => (ground || floor > 0) && (visibleFloor === 'all' || floor <= visibleFloor)).map(({ floor, solid, underside }) => <group key={floor}>
      <mesh name={`floor-slab-${floor}`} geometry={solid} material={material} receiveShadow position-y={floorBase(floor) + LIFT - THICKNESS} />
      {walking && floor > 0 && <mesh name={`ceiling-${floor}`} geometry={underside} material={ceiling} position-y={floorBase(floor) + LIFT - THICKNESS - 0.002} />}
    </group>)}
    {top.map(({ floor, area }) => <mesh key={floor} name="top-ceiling" material={ceiling} rotation-x={Math.PI / 2} position={[area.cx, floorBase(floor) + WALL_HEIGHT, area.cz]}><planeGeometry args={[area.width, area.depth]} /></mesh>)}
  </group>
}
