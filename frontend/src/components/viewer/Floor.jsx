import { Grid } from '@react-three/drei'

export default function Floor({ bounds }) {
  const size = Math.max(bounds.size + 6, 16)
  return <group>
    <mesh rotation-x={-Math.PI / 2} position-y={-0.025} receiveShadow>
      <planeGeometry args={[size, size]} /><meshStandardMaterial color="#111117" roughness={1} />
    </mesh>
    <Grid position={[0, -0.015, 0]} args={[size, size]} infiniteGrid cellSize={1} sectionSize={5} cellThickness={0.5} sectionThickness={0.8} cellColor="#303039" sectionColor="#454455" fadeDistance={Math.max(35, size * 2)} fadeStrength={2} />
  </group>
}
