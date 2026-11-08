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
import { createSection } from '../../lib/sections'
import FloorSlab from './FloorSlab'
import { useReducedMotion } from '../../lib/useReducedMotion'

function Unavailable() {
  return <div role="status" className="absolute inset-x-6 top-28 mx-auto max-w-md rounded-xl border border-white/10 bg-neutral-900 p-4 text-center text-xs leading-5 text-white/60">The 3D viewer could not start. Enable WebGL in your browser, then reload this page.</div>
}

class ViewerBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <Unavailable /> : this.props.children }
}

function FloorScene({ floor, centerBounds, edit, active, walking, modelKey, drawingArea, onSelect, onArea, onCompleteArea, onCancelArea, onPosition, onDragging }) {
  const { walls, bounds, elevation } = floor
  const section = walking ? { ...edit.section, enabled: false, scope: 'all' } : edit.section
  const area = walking ? null : edit.area
  const selectedWalls = edit.selectedWalls
  const targetBounds = useMemo(() => {
    const selected = section.scope === 'walls' && selectedWalls.length ? computeBounds(walls.filter((_, i) => selectedWalls.includes(i))) : bounds
    return { minX: selected.minX - bounds.cx, maxX: selected.maxX - bounds.cx, minZ: selected.minZ - bounds.cz, maxZ: selected.maxZ - bounds.cz }
  }, [walls, bounds, section.scope, selectedWalls])
  const hasTarget = section.scope === 'all' || (section.scope === 'walls' ? selectedWalls.length > 0 : Boolean(area))
  return <group name={`building-floor-${floor.id}`} position={[bounds.cx - centerBounds.cx, elevation, bounds.cz - centerBounds.cz]} userData={{ floorId: floor.id, elevation }}>
    <FloorSlab bounds={bounds} section={section} area={area} elevation={elevation} floorId={floor.id} offsetX={bounds.cx - centerBounds.cx} offsetZ={bounds.cz - centerBounds.cz} />
    {walking && <Floor bounds={bounds} walkthrough />}
    {walking && <mesh name="inferred-walkthrough-ceiling" position-y={WALL_HEIGHT} rotation-x={Math.PI / 2}><planeGeometry args={[bounds.width, bounds.depth]} /><meshStandardMaterial color="#e8e6e1" roughness={1} /></mesh>}
    <Walls key={modelKey} walls={walls} bounds={bounds} section={section} area={area} selectedWalls={selectedWalls} selecting={active && !walking && section.scope === 'walls'} onSelect={onSelect} openDoors={walking} elevation={elevation} floorId={floor.id} offsetX={bounds.cx - centerBounds.cx} offsetZ={bounds.cz - centerBounds.cz} />
    {active && !walking && section.enabled && hasTarget && <SectionPlane bounds={bounds} targetBounds={targetBounds} section={section} area={area} />}
    {active && !walking && section.scope === 'area' && <RegionSelection bounds={bounds} area={area} drawing={drawingArea} elevation={elevation}
      onArea={onArea} onComplete={onCompleteArea} onCancel={onCancelArea} onDragging={onDragging} section={section} onPosition={onPosition} />}
    {active && !walking && section.enabled && hasTarget && !drawingArea && <CutPlaneHandle bounds={bounds} targetBounds={targetBounds} elevation={elevation}
      section={section} area={area} onPosition={onPosition} onDragging={onDragging} />}
  </group>
}

export default function Viewer({ walls, floors, floorId, floorEdits, viewBounds, modelKey, section, resetKey, drawingArea, onSelect, onArea, onCompleteArea, onCancelArea, onPosition, humanMode = 'overview', humanPlacement, humanSpawn, humanBridge, humanMovement, onHumanPreview, onHumanEnter, onHumanExit, onHumanLocked, onHumanTransition }) {
  const [manipulating, setManipulating] = useState(false)
  const bounds = viewBounds
  const activeFloor = floors.find(floor => floor.id === floorId)
  const walking = humanMode !== 'overview'
  const world = useMemo(() => buildWalkWorld(walls, bounds), [walls, bounds])
  const reducedMotion = useReducedMotion()
  const shadowSize = Math.max(bounds.size, bounds.maxY, 12)
  return <ViewerBoundary>
    <Canvas shadows="percentage" dpr={[1, 1.75]} camera={{ position: [12, 12, 12], fov: 45 }} gl={{ localClippingEnabled: true, alpha: true }} style={{ cursor: humanMode === 'placing' ? 'crosshair' : humanMode === 'human' ? 'default' : drawingArea ? 'crosshair' : manipulating ? 'grabbing' : section.scope === 'walls' ? 'crosshair' : 'grab' }} fallback={<Unavailable />}>
      <ambientLight intensity={humanMode === 'human' ? 0.8 : 0.4} />
      <directionalLight castShadow position={[shadowSize, shadowSize * 1.5, shadowSize * 0.75]} intensity={2} shadow-mapSize={[2048, 2048]} shadow-autoUpdate={humanMode !== 'human'} shadow-needsUpdate={humanMode === 'human'} shadow-camera-left={-shadowSize} shadow-camera-right={shadowSize} shadow-camera-top={shadowSize} shadow-camera-bottom={-shadowSize} shadow-camera-far={shadowSize * 5} shadow-normalBias={0.03} />
      {/* A local studio environment avoids a network-dependent HDR download. */}
      <Environment resolution={64}>
        <Lightformer position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[15, 15, 1]} intensity={1.5} />
        <Lightformer position={[-8, 4, 0]} rotation-y={Math.PI / 2} scale={[10, 6, 1]} color="#a5b4fc" intensity={1} />
      </Environment>
      {!walking && <Floor bounds={bounds} />}
      {floors.filter(floor => floorId === 'all' || floor.id === floorId).map(floor => <FloorScene key={floor.id} floor={floor} centerBounds={bounds}
        edit={floorEdits[floor.id] ?? { section: createSection(), selectedWalls: [], area: null }} active={floor.id === floorId} walking={walking} modelKey={modelKey}
        drawingArea={drawingArea} onSelect={onSelect} onArea={onArea} onCompleteArea={onCompleteArea} onCancelArea={onCancelArea} onPosition={onPosition} onDragging={setManipulating} />)}
      <OrbitControls makeDefault enabled={humanMode !== 'human' && !drawingArea && !manipulating} enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI / 2 - 0.05} />
      <CameraRig panelOpen={Boolean(activeFloor)} bounds={bounds} fitKey={resetKey} reducedMotion={reducedMotion} hasModel={walls.length > 0} active={!walking} />
      {humanMode === 'placing' && <group position-y={activeFloor?.elevation ?? 0}><HumanPlacement elevation={activeFloor?.elevation ?? 0} world={world} placement={humanPlacement} bridge={humanBridge} onPreview={onHumanPreview} onEnter={onHumanEnter} onCancel={onHumanExit} /></group>}
      {walking && <HumanCamera elevation={activeFloor?.elevation ?? 0} mode={humanMode} spawn={humanSpawn} world={world} bridge={humanBridge} movement={humanMovement} reducedMotion={reducedMotion} onExit={onHumanExit} onLocked={onHumanLocked} onTransition={onHumanTransition} />}
    </Canvas>
  </ViewerBoundary>
}
