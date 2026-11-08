import { Edges } from '@react-three/drei'
import * as THREE from 'three'

/** A faint sheet of glass at the cut height, outlined like a section line. */
export default function SectionPlane({ bounds, height }) {
  return (
    <mesh position-y={height} rotation-x={-Math.PI / 2} renderOrder={1}>
      <planeGeometry args={[bounds.sizeX + 1.2, bounds.sizeZ + 1.2]} />
      <meshBasicMaterial
        color="#8ec5e8"
        transparent
        opacity={0.07}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
      <Edges color="#8ec5e8" transparent opacity={0.7} />
    </mesh>
  )
}
