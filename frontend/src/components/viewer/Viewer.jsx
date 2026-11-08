import { Component, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { buildWalkWorld } from '../../lib/walkthrough'
import { WALL_HEIGHT } from '../../lib/geometry'
import HumanPlacement from './HumanPlacement'
import HumanCamera from './HumanCamera'
import { computeBounds } from '../../lib/geometry'
import Floor from './Floor'
import Walls from './Walls'
import CameraRig from './CameraRig'
import SectionPlane from './SectionPlane'
import RegionSelection from './RegionSelection'
import CutPlaneHandle from './CutPlaneHandle'
import { useReducedMotion } from '../../lib/useReducedMotion'

function Unavailable() {
  return <div role="status" className="absolute inset-x-6 top-28 mx-auto max-w-md rounded-xl border border-white/10 bg-neutral-900 p-4 text-center text-xs leading-5 text-white/60">The 3D viewer could not start. Enable WebGL in your browser, then reload this page.</div>
}

class ViewerBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <Unavailable /> : this.props.children }
}

export default function Viewer({ walls, modelKey, section, selectedWalls, area, onSelect, resetKey, drawingArea, onArea, onCompleteArea, onCancelArea, onPosition, humanMode, humanPlacement, humanSpawn, humanBridge, humanMovement, onHumanPreview, onHumanEnter, onHumanExit, onHumanLocked, onHumanTransition }) {
  const [manipulating, setManipulating] = useState(false)
  const bounds = useMemo(() => computeBounds(walls), [walls])
  const walking = humanMode !== 'overview'
  const visibleSection = useMemo(() => walking ? { ...section, enabled: false, scope: 'all' } : section, [section, walking])
  const world = useMemo(() => buildWalkWorld(walls, bounds), [walls, bounds])
  const reducedMotion = useReducedMotion()
  const targetBounds = useMemo(() => {
    if (section.scope !== 'walls' || !selectedWalls.length) return { minX: -bounds.width / 2, maxX: bounds.width / 2, minZ: -bounds.depth / 2, maxZ: bounds.depth / 2 }
    const selected = computeBounds(walls.filter((_, i) => selectedWalls.includes(i)))
    return { minX: selected.minX - bounds.cx, maxX: selected.maxX - bounds.cx, minZ: selected.minZ - bounds.cz, maxZ: selected.maxZ - bounds.cz }
  }, [walls, bounds, section.scope, selectedWalls])
  const hasTarget = section.scope === 'all' || (section.scope === 'walls' ? selectedWalls.length > 0 : Boolean(area))
  const shadowSize = Math.max(bounds.size, 12)
  return <ViewerBoundary>
    <Canvas shadows="percentage" dpr={[1, 1.75]} camera={{ position: [12, 12, 12], fov: 45 }} gl={{ localClippingEnabled: true, alpha: true }} style={{ cursor: humanMode === 'placing' ? 'crosshair' : humanMode === 'human' ? 'default' : drawingArea ? 'crosshair' : manipulating ? 'grabbing' : section.scope === 'walls' ? 'crosshair' : 'grab' }} fallback={<Unavailable />}>
      <ambientLight intensity={humanMode === 'human' ? 0.8 : 0.4} />
      <directionalLight castShadow position={[shadowSize, shadowSize * 1.5, shadowSize * 0.75]} intensity={2} shadow-mapSize={[2048, 2048]} shadow-autoUpdate={humanMode !== 'human'} shadow-needsUpdate={humanMode === 'human'} shadow-camera-left={-shadowSize} shadow-camera-right={shadowSize} shadow-camera-top={shadowSize} shadow-camera-bottom={-shadowSize} shadow-camera-far={shadowSize * 5} shadow-normalBias={0.03} />
      {/* A local studio environment avoids a network-dependent HDR download. */}
      <Environment resolution={64}>
        <Lightformer position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[15, 15, 1]} intensity={1.5} />
        <Lightformer position={[-8, 4, 0]} rotation-y={Math.PI / 2} scale={[10, 6, 1]} color="#a5b4fc" intensity={1} />
      </Environment>
      <Floor bounds={bounds} walkthrough={walking} />
      {humanMode === 'human' && <mesh name="inferred-walkthrough-ceiling" position-y={WALL_HEIGHT} rotation-x={Math.PI / 2}><planeGeometry args={[bounds.width, bounds.depth]} /><meshStandardMaterial color="#e8e6e1" roughness={1} /></mesh>}
      {walls.length > 0 && <Walls key={modelKey} walls={walls} bounds={bounds} section={visibleSection} area={walking ? null : area} selectedWalls={selectedWalls} selecting={!walking && section.scope === 'walls'} onSelect={onSelect} openDoors={walking} />}
      {walls.length > 0 && !walking && section.enabled && hasTarget && <SectionPlane bounds={bounds} targetBounds={targetBounds} section={section} area={area} />}
      {walls.length > 0 && !walking && section.scope === 'area' && <RegionSelection bounds={bounds} area={area} drawing={drawingArea}
        onArea={onArea} onComplete={onCompleteArea} onCancel={onCancelArea} onDragging={setManipulating} section={section} onPosition={onPosition} />}
      {walls.length > 0 && !walking && section.enabled && hasTarget && !drawingArea && <CutPlaneHandle bounds={bounds} targetBounds={targetBounds}
        section={section} area={area} onPosition={onPosition} onDragging={setManipulating} />}
      <OrbitControls makeDefault enabled={humanMode !== 'human' && !drawingArea && !manipulating} enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI / 2 - 0.05} />
      <CameraRig bounds={bounds} fitKey={resetKey} reducedMotion={reducedMotion} hasModel={walls.length > 0} active={!walking} />
      {humanMode === 'placing' && <HumanPlacement world={world} placement={humanPlacement} bridge={humanBridge} onPreview={onHumanPreview} onEnter={onHumanEnter} onCancel={onHumanExit} />}
      {walking && <HumanCamera mode={humanMode} spawn={humanSpawn} world={world} bridge={humanBridge} movement={humanMovement} reducedMotion={reducedMotion} onExit={onHumanExit} onLocked={onHumanLocked} onTransition={onHumanTransition} />}
    </Canvas>
  </ViewerBoundary>
}
