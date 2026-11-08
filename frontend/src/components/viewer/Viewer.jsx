import { Component, useEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { computeBounds, WALL_HEIGHT } from '../../lib/geometry'
import Floor from './Floor'
import Walls from './Walls'

function Unavailable() {
  return <div role="status" className="absolute inset-x-6 top-28 mx-auto max-w-md rounded-xl border border-white/10 bg-neutral-900 p-4 text-center text-xs leading-5 text-white/60">The 3D viewer could not start. Enable WebGL in your browser, then reload this page.</div>
}

class ViewerBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <Unavailable /> : this.props.children }
}

function CameraRig({ bounds, resetKey }) {
  const get = useThree(state => state.get)
  const size = useThree(state => state.size)
  const controls = useRef()
  useEffect(() => {
    if (!controls.current) return
    const { camera } = get()
    const vertical = THREE.MathUtils.degToRad(camera.fov)
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * size.width / size.height)
    const radius = Math.hypot(bounds.width, bounds.depth, WALL_HEIGHT) / 2
    const distance = radius / Math.sin(Math.min(vertical, horizontal) / 2) * 1.4
    const target = new THREE.Vector3(0, WALL_HEIGHT / 2, 0)
    camera.position.copy(target).add(new THREE.Vector3(1, 1.05, 1.25).normalize().multiplyScalar(distance))
    camera.near = Math.max(0.01, distance / 1000)
    camera.far = Math.max(200, distance * 12)
    camera.updateProjectionMatrix()
    controls.current.target.copy(target)
    controls.current.minDistance = Math.max(0.5, bounds.size * 0.15)
    controls.current.maxDistance = distance * 3
    controls.current.update()
  }, [get, size.width, size.height, bounds, resetKey])
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI / 2 - 0.05} />
}

export default function Viewer({ walls, modelKey, clipEnabled, clipHeight, resetKey }) {
  const bounds = useMemo(() => computeBounds(walls), [walls])
  const shadowSize = Math.max(bounds.size, 12)
  return <ViewerBoundary>
    <Canvas shadows="percentage" dpr={[1, 1.75]} camera={{ position: [12, 12, 12], fov: 45 }} gl={{ localClippingEnabled: true, alpha: true }} fallback={<Unavailable />}>
      <ambientLight intensity={0.4} />
      <directionalLight castShadow position={[shadowSize, shadowSize * 1.5, shadowSize * 0.75]} intensity={2} shadow-mapSize={[2048, 2048]} shadow-camera-left={-shadowSize} shadow-camera-right={shadowSize} shadow-camera-top={shadowSize} shadow-camera-bottom={-shadowSize} shadow-camera-far={shadowSize * 5} shadow-normalBias={0.03} />
      {/* A local studio environment avoids a network-dependent HDR download. */}
      <Environment resolution={64}>
        <Lightformer position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[15, 15, 1]} intensity={1.5} />
        <Lightformer position={[-8, 4, 0]} rotation-y={Math.PI / 2} scale={[10, 6, 1]} color="#a5b4fc" intensity={1} />
      </Environment>
      <Floor bounds={bounds} />
      {walls.length > 0 && <Walls key={modelKey} walls={walls} bounds={bounds} clipEnabled={clipEnabled} clipHeight={clipHeight} />}
      <CameraRig bounds={bounds} resetKey={resetKey} />
    </Canvas>
  </ViewerBoundary>
}
