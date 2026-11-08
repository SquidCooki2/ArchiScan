import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { WALL_HEIGHT, computeBounds } from '../../lib/geometry'
import CameraRig from './CameraRig'
import Floor from './Floor'
import SectionPlane from './SectionPlane'
import Walls from './Walls'

/** Far above the walls: an "off" clipping plane that never cuts anything. */
const NO_CUT = WALL_HEIGHT + 100

export default function Viewer({ walls, modelKey, fitKey, clipEnabled, clipHeight, reducedMotion }) {
  const bounds = useMemo(() => computeBounds(walls), [walls])

  // One shared plane; the wall material and cap material both reference it.
  // Normal (0,-1,0) keeps everything below y = constant.
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), NO_CUT), [])
  // Moving a three.js object in place is the normal R3F pattern; the renderer reads it next frame.
  useEffect(() => {
    // oxlint-disable-next-line react/immutability
    plane.constant = clipEnabled ? clipHeight : NO_CUT
  }, [plane, clipEnabled, clipHeight])

  const shadowExtent = Math.max(bounds.size, 8) / 2 + 4
  const hasModel = walls.length > 0

  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      camera={{ position: [10, 10, 10], fov: 45, near: 0.1, far: 500 }}
      gl={{ localClippingEnabled: true, antialias: true }}
      aria-label={hasModel ? '3D model of the uploaded floorplan. Drag to orbit, scroll to zoom.' : undefined}
    >
      <ambientLight intensity={0.4} />
      <directionalLight
        castShadow
        position={[8, 12, 6]}
        intensity={1.5}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
        shadow-camera-far={60}
      />

      {/* Local light rig instead of a downloaded HDR: no network dependency, no crash when offline. */}
      <Suspense fallback={null}>
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={1.6} position={[0, 6, -10]} scale={[16, 6, 1]} />
          <Lightformer form="rect" intensity={0.8} position={[-10, 3, 2]} rotation-y={Math.PI / 2} scale={[12, 4, 1]} />
          <Lightformer form="rect" intensity={0.5} color="#8ec5e8" position={[10, 2, 4]} rotation-y={-Math.PI / 2} scale={[10, 3, 1]} />
        </Environment>
      </Suspense>

      <Floor bounds={bounds} hasModel={hasModel} />

      {hasModel && (
        <Walls key={modelKey} walls={walls} bounds={bounds} plane={plane} reducedMotion={reducedMotion} />
      )}

      {hasModel && clipEnabled && clipHeight < WALL_HEIGHT && (
        <SectionPlane bounds={bounds} height={clipHeight} />
      )}

      <OrbitControls
        makeDefault
        enableDamping
        minDistance={2}
        maxDistance={120}
        maxPolarAngle={Math.PI / 2 - 0.05}
      />
      <CameraRig bounds={bounds} fitKey={fitKey} reducedMotion={reducedMotion} />
    </Canvas>
  )
}
