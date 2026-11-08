import { Grid } from '@react-three/drei'

/** Infinite drafting grid, plus a slab under the model that catches its shadows. */
export default function Floor({ bounds, hasModel }) {
  return (
    <>
      {hasModel && (
        <mesh rotation-x={-Math.PI / 2} position-y={-0.002} receiveShadow>
          <planeGeometry args={[bounds.sizeX + 4, bounds.sizeZ + 4]} />
          <meshStandardMaterial color="#151515" roughness={1} metalness={0} />
        </mesh>
      )}
      <Grid
        infiniteGrid
        position-y={0.001}
        cellSize={0.5}
        cellThickness={0.6}
        cellColor="#2a2a2a"
        sectionSize={2.5}
        sectionThickness={1}
        sectionColor="#24425a"
        fadeDistance={40}
        fadeStrength={1.5}
      />
    </>
  )
}
