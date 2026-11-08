import { Edges } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { WALL_HEIGHT } from '../../lib/geometry'
import { cutCoordinate } from '../../lib/sections'

/** Non-interactive plane guide, restricted to the chosen area or wall bounds. */
export default function SectionPlane({ bounds, targetBounds, section, area }) {
  const { axis } = section
  const coordinate = cutCoordinate(bounds, section)
  const extent = section.scope === 'area' && area ? area : targetBounds
  const width = extent.maxX - extent.minX, depth = extent.maxZ - extent.minZ
  const cx = (extent.minX + extent.maxX) / 2, cz = (extent.minZ + extent.maxZ) / 2
  const position = axis === 'y' ? [cx, coordinate, cz] : axis === 'x' ? [coordinate, WALL_HEIGHT / 2, cz] : [cx, WALL_HEIGHT / 2, coordinate]
  const rotation = axis === 'y' ? [-Math.PI / 2, 0, 0] : axis === 'x' ? [0, Math.PI / 2, 0] : [0, 0, 0]
  const dimensions = axis === 'y' ? [width + 0.15, depth + 0.15] : axis === 'x' ? [depth + 0.15, WALL_HEIGHT + 0.15] : [width + 0.15, WALL_HEIGHT + 0.15]
  const noRaycast = useMemo(() => () => null, [])
  return <mesh position={position} rotation={rotation} renderOrder={1} raycast={noRaycast}>
    <planeGeometry args={dimensions} />
    <meshBasicMaterial color="#a5b4fc" transparent opacity={0.07} depthWrite={false} side={THREE.DoubleSide} />
    <Edges color="#a5b4fc" transparent opacity={0.6} raycast={noRaycast} />
  </mesh>
}
