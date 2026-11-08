/* oxlint-disable react/immutability -- Three.js clipping planes and materials are mutable engine objects. */
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { WALL_HEIGHT } from '../../lib/geometry'
import { useReducedMotion } from '../../lib/useReducedMotion'

function Wall({ wall, index, material, capMaterial, clipEnabled, clipHeight, reducedMotion }) {
  const body = useRef()
  const cap = useRef()
  const elapsed = useRef(0)
  useFrame((_, delta) => {
    elapsed.current += delta
    const t = reducedMotion ? 1 : THREE.MathUtils.clamp((elapsed.current - Math.min(index * 0.035, 0.45)) / 0.6, 0, 1)
    const scale = 1 - (1 - t) ** 3
    body.current.scale.y = Math.max(0.0001, scale)
    cap.current.visible = clipEnabled && clipHeight < WALL_HEIGHT - 0.001 && clipHeight < WALL_HEIGHT * scale
  })
  return <group position={[wall.x, 0, wall.z]} rotation={[0, -wall.rotation, 0]}>
    <group ref={body} scale={[1, reducedMotion ? 1 : 0.0001, 1]}>
      <mesh position-y={WALL_HEIGHT / 2} castShadow receiveShadow material={material}>
        <boxGeometry args={[wall.width, WALL_HEIGHT, wall.depth]} />
      </mesh>
    </group>
    {/* Each wall is a rectangular prism: its horizontal intersection is a rectangle. */}
    <mesh ref={cap} position-y={clipHeight + 0.001} rotation-x={-Math.PI / 2} material={capMaterial} visible={false}>
      <planeGeometry args={[wall.width, wall.depth]} />
    </mesh>
  </group>
}

export default function Walls({ walls, bounds, clipEnabled, clipHeight }) {
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), WALL_HEIGHT), [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e8e6e1', roughness: 0.85, metalness: 0, side: THREE.DoubleSide, clipShadows: true }), [])
  const capMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#a5b4fc', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), [])
  const reducedMotion = useReducedMotion()
  useEffect(() => {
    plane.constant = clipHeight
    material.clippingPlanes = clipEnabled ? [plane] : []
    material.needsUpdate = true
  }, [plane, material, clipHeight, clipEnabled])
  useEffect(() => () => { material.dispose(); capMaterial.dispose() }, [material, capMaterial])
  return <group position={[-bounds.cx, 0, -bounds.cz]}>
    {walls.map((wall, index) => <Wall key={index} wall={wall} index={index} material={material} capMaterial={capMaterial} clipEnabled={clipEnabled} clipHeight={clipHeight} reducedMotion={reducedMotion} />)}
  </group>
}
