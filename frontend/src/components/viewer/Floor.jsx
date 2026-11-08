import { Grid } from '@react-three/drei'
import { WALK_FLOOR } from './colors'

/** The drafting table: only shadows and a faint grid, so the page background shows through. */
export default function Floor({ bounds, walkthrough = false, base = 0 }) {
  const size = Math.max(bounds.size + 6, 16)
  if (walkthrough) {
    return <mesh rotation-x={-Math.PI / 2} position-y={base} receiveShadow>
      <planeGeometry args={[size, size]} /><meshStandardMaterial color={WALK_FLOOR} roughness={1} />
    </mesh>
  }
  return <group>
    <mesh rotation-x={-Math.PI / 2} position-y={-0.025} receiveShadow>
      <planeGeometry args={[size * 3, size * 3]} /><shadowMaterial opacity={0.4} />
    </mesh>
    <Grid position={[0, -0.015, 0]} args={[size, size]} infiniteGrid cellSize={1} sectionSize={5} cellThickness={0.5} sectionThickness={0.8} cellColor="#2b323b" sectionColor="#3c4550" fadeDistance={Math.max(30, size * 1.8)} fadeStrength={2.5} />
  </group>
}
