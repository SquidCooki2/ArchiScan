import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { BODY_RADIUS, placementAt } from '../../lib/walkthrough'
import { CUT } from './colors'

function HumanMarker({ placement, floorY }) {
  const color = placement.valid ? CUT : '#f87171'
  return <group name="human-placement-avatar" position={[placement.x, floorY, placement.z]} rotation-y={Math.atan2(placement.x, placement.z)}>
    <mesh position-y={1.67}><sphereGeometry args={[0.11, 16, 12]} /><meshStandardMaterial color={color} transparent opacity={0.85} depthTest={false} depthWrite={false} /></mesh>
    <mesh position-y={1.15}><capsuleGeometry args={[0.12, 0.48, 4, 12]} /><meshStandardMaterial color={color} transparent opacity={0.8} depthTest={false} depthWrite={false} /></mesh>
    {[-1, 1].map(side => <mesh key={side} position={[side * 0.075, 0.45, 0]}><cylinderGeometry args={[0.055, 0.045, 0.85, 10]} /><meshStandardMaterial color={color} transparent opacity={0.8} depthTest={false} depthWrite={false} /></mesh>)}
    <mesh rotation-x={-Math.PI / 2} position-y={0.01}><ringGeometry args={[BODY_RADIUS, BODY_RADIUS + 0.04, 32]} /><meshBasicMaterial color={color} side={THREE.DoubleSide} depthTest={false} /></mesh>
  </group>
}

/** Shows where you'd stand as the pointer moves, and starts walking on a click on clear floor. */
export default function HumanPlacement({ world, placement, onPreview, onEnter, onCancel }) {
  const ground = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -world.floorY), [world.floorY])
  useEffect(() => {
    const escape = event => { if (event.key === 'Escape') onCancel() }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [onCancel])
  const at = event => placementAt(event.ray.intersectPlane(ground, new THREE.Vector3()), world)
  return <group>
    <mesh name="human-placement-floor" rotation-x={-Math.PI / 2} position-y={world.floorY + 0.001}
      onPointerMove={event => onPreview(at(event))} onPointerOut={() => onPreview(null)}
      onClick={event => {
        // A drag is an orbit, not a choice of spot.
        if (event.delta > 4) return
        event.stopPropagation()
        const result = at(event)
        onPreview(result)
        if (result.valid) onEnter({ x: result.x, z: result.z })
      }}>
      <planeGeometry args={[world.maxX - world.minX + 40, world.maxZ - world.minZ + 40]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
    {placement && Number.isFinite(placement.x) && Number.isFinite(placement.z) && <HumanMarker placement={placement} floorY={world.floorY} />}
  </group>
}
