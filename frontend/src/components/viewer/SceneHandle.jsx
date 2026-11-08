import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CUT } from './colors'

/** Keep handles comfortably sized in pixels while the user orbits or zooms. */
export default function SceneHandle({ position, color = CUT, name, ...events }) {
  const mesh = useRef()
  const [x, y, z] = position
  const target = useMemo(() => new THREE.Vector3(x, y, z), [x, y, z])
  useFrame(({ camera, viewport, size }) => {
    mesh.current.scale.setScalar(viewport.getCurrentViewport(camera, target).height / size.height * 8)
  })
  return <mesh ref={mesh} name={name} position={position} renderOrder={5} {...events}>
    <sphereGeometry args={[1, 16, 12]} />
    <meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
    <mesh>
      <sphereGeometry args={[2.5, 12, 8]} />
      <meshBasicMaterial transparent opacity={0} depthTest={false} depthWrite={false} />
    </mesh>
  </mesh>
}
