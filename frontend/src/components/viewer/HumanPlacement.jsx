import { useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { BODY_RADIUS, HUMAN_DRAG_TYPE, placementAt } from '../../lib/walkthrough'

function HumanMarker({ placement }) {
  const color = placement.valid ? '#a5b4fc' : '#f87171'
  return <group name="human-placement-avatar" position={[placement.x, 0, placement.z]} rotation-y={Math.atan2(placement.x, placement.z)}>
    <mesh position-y={1.67}><sphereGeometry args={[0.11, 16, 12]} /><meshStandardMaterial color={color} transparent opacity={0.8} depthTest={false} depthWrite={false} /></mesh>
    <mesh position-y={1.15}><capsuleGeometry args={[0.12, 0.48, 4, 12]} /><meshStandardMaterial color={color} transparent opacity={0.75} depthTest={false} depthWrite={false} /></mesh>
    {[-1, 1].map(side => <group key={side}>
      <mesh position={[side * 0.075, 0.45, 0]}><cylinderGeometry args={[0.055, 0.045, 0.85, 10]} /><meshStandardMaterial color={color} transparent opacity={0.75} depthTest={false} depthWrite={false} /></mesh>
      <mesh position={[side * 0.075, 0.025, -0.025]}><boxGeometry args={[0.11, 0.05, 0.18]} /><meshStandardMaterial color={color} transparent opacity={0.75} depthTest={false} depthWrite={false} /></mesh>
      <mesh position={[side * 0.16, 1.12, 0]}><capsuleGeometry args={[0.04, 0.45, 4, 8]} /><meshStandardMaterial color={color} transparent opacity={0.75} depthTest={false} depthWrite={false} /></mesh>
    </group>)}
    <mesh rotation-x={-Math.PI / 2} position-y={0.01}><ringGeometry args={[BODY_RADIUS, BODY_RADIUS + 0.04, 32]} /><meshBasicMaterial color={color} side={THREE.DoubleSide} depthTest={false} /></mesh>
  </group>
}

export default function HumanPlacement({ world, placement, bridge, onPreview, onEnter, onCancel }) {
  const get = useThree(state => state.get)
  const ground = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const latest = useRef(placement)
  const apiRef = useRef(null)
  useImperativeHandle(bridge, () => ({
    preview: (x, y) => apiRef.current?.preview(x, y),
    drop: (x, y) => apiRef.current?.drop(x, y),
    set: point => apiRef.current?.set(point),
    enter: () => apiRef.current?.enter(),
  }), [])
  useEffect(() => { latest.current = placement }, [placement])
  useEffect(() => {
    const { gl } = get()
    const canvas = gl.domElement
    const raycaster = new THREE.Raycaster()
    const report = (point, fixed = false) => {
      const result = { ...placementAt(point, world), fixed }
      latest.current = result
      onPreview(result)
      return result
    }
    const pointAt = (x, y) => {
      const rect = canvas.getBoundingClientRect()
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom || document.elementFromPoint(x, y) !== canvas) return null
      raycaster.setFromCamera(new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2), get().camera)
      return raycaster.ray.intersectPlane(ground, new THREE.Vector3())
    }
    const enter = point => {
      const result = report(point, true)
      if (result.valid) onEnter({ x: result.x, z: result.z })
      return result.valid
    }
    const api = {
      preview: (x, y) => report(pointAt(x, y)),
      drop: (x, y) => enter(pointAt(x, y)),
      set: point => report(point, true),
      enter: () => enter(latest.current),
    }
    apiRef.current = api
    const isHuman = event => Array.from(event.dataTransfer?.types ?? []).includes(HUMAN_DRAG_TYPE)
    const over = event => { if (isHuman(event)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; api.preview(event.clientX, event.clientY) } }
    const drop = event => { if (isHuman(event)) { event.preventDefault(); api.drop(event.clientX, event.clientY) } }
    const escape = event => { if (event.key === 'Escape') onCancel() }
    canvas.addEventListener('dragover', over)
    canvas.addEventListener('drop', drop)
    window.addEventListener('keydown', escape)
    return () => {
      canvas.removeEventListener('dragover', over)
      canvas.removeEventListener('drop', drop)
      window.removeEventListener('keydown', escape)
      if (apiRef.current === api) apiRef.current = null
    }
  }, [get, ground, world, bridge, onPreview, onEnter, onCancel])
  const show = (event, fixed) => {
    if ((!fixed && latest.current?.fixed) || event.delta > 4) return
    const point = event.ray.intersectPlane(ground, new THREE.Vector3())
    const result = { ...placementAt(point, world), fixed }
    latest.current = result
    onPreview(result)
  }
  return <group>
    <mesh name="human-placement-floor" rotation-x={-Math.PI / 2} position-y={0.001} onPointerMove={event => show(event, false)} onClick={event => { event.stopPropagation(); show(event, true) }}>
      <planeGeometry args={[world.maxX - world.minX + 2, world.maxZ - world.minZ + 2]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
    {placement && Number.isFinite(placement.x) && Number.isFinite(placement.z) && <HumanMarker placement={placement} />}
  </group>
}
