import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { floorOutlines } from '../../lib/footprint'
import { computeBounds, elementFloor, floorBase, floorCount, isFurniture, isStairs, stairwellCorners, WALL_HEIGHT } from '../../lib/geometry'
import { CARD, SLAB } from './colors'
import { surfaces } from './surfaces'
import { useSectionClipping } from './useSectionClipping'

const THICKNESS = 0.1
// Just inside the walls and just above the walls below, so no faces coincide and flicker.
const INSET = 0.02
const LIFT = 0.006

/** Points in plan as a shape's outline. Shape Y is plan -Z, because the shape lies down later. */
function outline(Path, corners) {
  const path = new Path()
  corners.forEach(([x, z], index) => (index ? path.lineTo(x, -z) : path.moveTo(x, -z)))
  path.closePath()
  return path
}

/** The floor's real outline. Walls that don't close into a building fall back to their bounding rectangle. */
function slabOutlines(elements, area, stairwells) {
  const { minX, maxX, minZ, maxZ } = area
  return floorOutlines(elements, stairwells)
    ?? [{ outer: [[minX + INSET, minZ + INSET], [maxX - INSET, minZ + INSET], [maxX - INSET, maxZ - INSET], [minX + INSET, maxZ - INSET]], holes: stairwells }]
}

const toShape = ({ outer, holes }) => {
  const shape = outline(THREE.Shape, outer)
  shape.holes = holes.map(hole => outline(THREE.Path, hole))
  return shape
}

/**
 * A thin floor under each storey, following its exterior walls so the lawn shows outside them, with
 * an opening wherever a flight arrives from below. While walking, each also gets a white ceiling.
 * Floors are oak boards, except for escape routes: their glowing arrows need a plain, dark surface, so
 * those leave out the ground slab and keep upper ones plain.
 */
export default function FloorSlabs({ walls, bounds, section, cut, region, visibleFloor, ground = true, walking = false, boards = true }) {
  const floors = floorCount(walls)
  const slabs = useMemo(() => {
    const flights = walls.filter(isStairs)
    const result = []
    for (let floor = 0; floor < floors; floor++) {
      const elements = walls.filter(element => elementFloor(element) === floor && !isFurniture(element))
      if (!elements.length) continue
      const area = computeBounds(elements)
      const stairwells = flights.filter(stair => elementFloor(stair) + 1 === floor).map(stair => stairwellCorners(stair, area, INSET * 2))
      const outlines = slabOutlines(elements, area, stairwells)
      const shapes = outlines.map(toShape)
      const solid = new THREE.ExtrudeGeometry(shapes, { depth: THICKNESS, bevelEnabled: false })
      solid.rotateX(-Math.PI / 2)
      const underside = new THREE.ShapeGeometry(shapes)
      underside.rotateX(-Math.PI / 2)
      // The top of the house has no stairwell to leave open.
      const cover = new THREE.ShapeGeometry(outlines.map(({ outer }) => outline(THREE.Shape, outer)))
      cover.rotateX(-Math.PI / 2)
      result.push({ floor, solid, underside, cover })
    }
    return result
  }, [walls, floors])
  useEffect(() => () => slabs.forEach(({ solid, underside, cover }) => { solid.dispose(); underside.dispose(); cover.dispose() }), [slabs])
  const planes = useSectionClipping(bounds, section, cut, region)
  const material = useMemo(() => new THREE.MeshStandardMaterial({ ...(boards ? { map: surfaces().planks, roughness: 0.7 } : { color: SLAB, roughness: 0.95 }), clippingPlanes: planes, clipIntersection: true }), [planes, boards])
  const ceiling = useMemo(() => new THREE.MeshStandardMaterial({ color: CARD, roughness: 1, side: THREE.DoubleSide }), [])
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => ceiling.dispose(), [ceiling])
  const top = walking ? slabs.filter(({ floor }) => floor === floors - 1) : []
  return <group position={[-bounds.cx, 0, -bounds.cz]}>
    {slabs.filter(({ floor }) => (ground || floor > 0) && (visibleFloor === 'all' || floor <= visibleFloor)).map(({ floor, solid, underside }) => <group key={floor}>
      <mesh name={`floor-slab-${floor}`} geometry={solid} material={material} receiveShadow position-y={floorBase(floor) + LIFT - THICKNESS} />
      {walking && floor > 0 && <mesh name={`ceiling-${floor}`} geometry={underside} material={ceiling} position-y={floorBase(floor) + LIFT - THICKNESS - 0.002} />}
    </group>)}
    {top.map(({ floor, cover }) => <mesh key={floor} name="top-ceiling" geometry={cover} material={ceiling} position-y={floorBase(floor) + WALL_HEIGHT} />)}
  </group>
}
